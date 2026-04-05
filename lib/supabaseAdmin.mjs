import { createClient } from '@supabase/supabase-js';
import { slug } from './slug.mjs';

export function makeAdminClient({ url, serviceKey }) {
  if (!url || !serviceKey) {
    throw new Error('supabaseAdmin: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Upsert a list of parsed rows into `items`, keyed on import_key.
 * Never writes `claimed` or `claimed_at` — existing claims are preserved.
 * Returns { inserted, updated, unchanged }.
 */
export async function upsertItems(client, rows) {
  const keyed = rows.map((r) => ({ ...r, import_key: slug(r.name) }));

  // Fetch existing rows to categorize inserted vs updated vs unchanged.
  const keys = keyed.map((r) => r.import_key);
  const { data: existing, error: selErr } = await client
    .from('items')
    .select('import_key, name, description, link, price, image_url, category')
    .in('import_key', keys);
  if (selErr) throw selErr;

  const existingByKey = new Map((existing ?? []).map((e) => [e.import_key, e]));

  let inserted = 0, updated = 0, unchanged = 0;
  for (const r of keyed) {
    const prev = existingByKey.get(r.import_key);
    if (!prev) { inserted++; continue; }
    const changed =
      prev.name !== r.name ||
      prev.description !== r.description ||
      prev.link !== r.link ||
      Number(prev.price) !== Number(r.price) ||
      prev.image_url !== r.image_url ||
      prev.category !== r.category;
    if (changed) updated++; else unchanged++;
  }

  const { error: upErr } = await client
    .from('items')
    .upsert(keyed, { onConflict: 'import_key', ignoreDuplicates: false });
  if (upErr) throw upErr;

  return { inserted, updated, unchanged };
}
