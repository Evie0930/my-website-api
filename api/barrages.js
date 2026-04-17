import { supabaseAnon } from './_supabase.js';
import {
  MAX_BARRAGE_LENGTH,
  countVisibleChars,
  isValidViewerToken,
  parseBarragePayload,
  sanitizeContent,
  isRejectedPattern,
  isAllowedBarrageText,
  isGarbageOrNoise,
} from './_barrageValidate.js';

function mergeByCreatedAt(a, b, limit) {
  const merged = [...(a || []), ...(b || [])].sort(
    (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime(),
  );
  const seen = new Set();
  const out = [];
  for (const row of merged) {
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

async function insertBarrageRow(row) {
  return supabaseAnon
    .from('barrages')
    .insert([row])
    .select('id, content, created_at, is_private_test')
    .single();
}

function isMissingColumnError(err) {
  const msg = String(err?.message || '');
  return /column|schema|does not exist|not found in the schema cache/i.test(msg);
}

function normalizeLegacyRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    is_private_test: false,
  }));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const rawHeader = req.headers['x-barrage-viewer'] ?? req.headers['X-Barrage-Viewer'];
    const token = typeof rawHeader === 'string' ? rawHeader.trim() : '';

    const { data: publicRows, error: pubErr } = await supabaseAnon
      .from('barrages')
      .select('id, content, created_at, is_private_test')
      .eq('is_private_test', false)
      .order('created_at', { ascending: false })
      .limit(80);

    if (pubErr) {
      const msg = String(pubErr.message || '');
      if (isMissingColumnError(pubErr)) {
        // Backward-compatible fallback: schema without is_private_test/viewer_token.
        const { data: legacyRows, error: legacyErr } = await supabaseAnon
          .from('barrages')
          .select('id, content, created_at')
          .order('created_at', { ascending: false })
          .limit(60);
        if (legacyErr) {
          return res.status(500).json({ error: 'Failed to fetch barrages', detail: legacyErr.message });
        }
        return res.status(200).json({ data: normalizeLegacyRows(legacyRows) });
      }
      return res.status(500).json({ error: 'Failed to fetch barrages', detail: pubErr.message });
    }

    let data = publicRows || [];

    if (isValidViewerToken(token)) {
      const { data: privateRows, error: privErr } = await supabaseAnon
        .from('barrages')
        .select('id, content, created_at, is_private_test')
        .eq('is_private_test', true)
        .eq('viewer_token', token)
        .order('created_at', { ascending: false })
        .limit(40);

      if (privErr) {
        const msg = String(privErr.message || '');
        if (/column|schema|does not exist/i.test(msg)) {
          return res.status(500).json({
            error: 'Failed to fetch barrages',
            detail: privErr.message,
            hint: 'Run supabase/barrages-private-test.sql in Supabase SQL Editor',
          });
        }
        return res.status(500).json({ error: 'Failed to fetch barrages', detail: privErr.message });
      }

      data = mergeByCreatedAt(publicRows, privateRows, 60);
    } else {
      data = (publicRows || []).slice(0, 60);
    }

    return res.status(200).json({ data: data || [] });
  }

  if (req.method === 'POST') {
    let body = {};
    try {
      const incoming = req.body;
      body = typeof incoming === 'string' ? JSON.parse(incoming || '{}') : incoming || {};
    } catch {
      return res.status(400).json({ error: 'invalid json body' });
    }
    const raw = String(body.content || '').trim();
    const viewerToken = typeof body.viewer_token === 'string' ? body.viewer_token.trim() : '';

    if (!raw) {
      return res.status(400).json({ error: 'content is required' });
    }
    if (countVisibleChars(raw) > MAX_BARRAGE_LENGTH) {
      return res.status(400).json({ error: `content exceeds ${MAX_BARRAGE_LENGTH} characters` });
    }

    const { isPrivateTest, body: inner } = parseBarragePayload(raw);

    if (isPrivateTest) {
      if (!isValidViewerToken(viewerToken)) {
        return res.status(400).json({ error: 'viewer_token required for test barrage' });
      }
      if (!inner) {
        return res.status(400).json({ error: 'test barrage needs text after [测试]' });
      }
    }

    const textToValidate = inner;
    if (!textToValidate) {
      return res.status(400).json({ error: 'content is required' });
    }
    if (isRejectedPattern(textToValidate)) {
      return res.status(400).json({ error: 'invalid content pattern' });
    }
    if (!isAllowedBarrageText(textToValidate)) {
      return res.status(400).json({ error: 'content includes unsupported characters' });
    }
    if (isGarbageOrNoise(textToValidate)) {
      return res.status(400).json({ error: 'invalid content pattern' });
    }

    const safeContent = sanitizeContent(textToValidate);
    const finalContent = isPrivateTest ? `[测试] ${safeContent}` : safeContent;

    const row = {
      content: finalContent,
      is_private_test: isPrivateTest,
      viewer_token: isPrivateTest ? viewerToken : null,
    };

    let { data, error } = await insertBarrageRow(row);
    if (error && isMissingColumnError(error)) {
      // Backward-compatible fallback: insert only content when optional columns are absent.
      const fallbackRes = await supabaseAnon
        .from('barrages')
        .insert([{ content: finalContent }])
        .select('id, content, created_at')
        .single();
      data = fallbackRes.data
        ? {
            ...fallbackRes.data,
            is_private_test: false,
          }
        : null;
      error = fallbackRes.error;
    }

    if (error) {
      const msg = String(error.message || '');
      const code = String(error.code || '');
      const permissionDenied =
        code === '42501' ||
        code === 'PGRST301' ||
        /permission denied|row-level security|RLS|insufficient privilege|new row violates row-level security/i.test(
          msg,
        );
      if (permissionDenied) {
        return res.status(403).json({
          error: 'Database permission denied',
          detail: error.message,
          code: error.code,
        });
      }
      if (isMissingColumnError(error)) {
        return res.status(500).json({
          error: 'Database schema mismatch',
          detail: error.message,
          hint: 'Run supabase/barrages-private-test.sql in Supabase SQL Editor',
        });
      }
      return res.status(500).json({ error: 'Failed to submit message', detail: error.message, code: error.code });
    }

    return res.status(201).json({ ok: true, data });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}
