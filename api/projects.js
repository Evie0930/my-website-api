import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch projects', detail: error.message });
  }

  return res.status(200).json({ data: data || [] });
}
