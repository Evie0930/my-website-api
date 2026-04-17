import { supabaseAdmin } from './_supabase.js';

async function incrementViewsWithRetry(maxRetry = 5) {
  let attempts = 0;
  while (attempts < maxRetry) {
    attempts += 1;

    const current = await supabaseAdmin.from('site_stats').select('id, views').eq('id', 1).single();
    if (current.error) throw current.error;

    const currentViews = Number(current.data?.views || 0);
    const nextViews = currentViews + 1;

    const updated = await supabaseAdmin
      .from('site_stats')
      .update({ views: nextViews })
      .eq('id', 1)
      .eq('views', currentViews)
      .select('views')
      .single();

    if (!updated.error && updated.data) return Number(updated.data.views || nextViews);
  }
  throw new Error('Failed to increment views after retries');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const views = await incrementViewsWithRetry();
    return res.status(200).json({ views });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update views', detail: error.message });
  }
}
