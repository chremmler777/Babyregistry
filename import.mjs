#!/usr/bin/env node
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { parseExcel } from './lib/parseExcel.mjs';
import { makeAdminClient, upsertItems } from './lib/supabaseAdmin.mjs';

async function main() {
  const [, , file, ...rest] = process.argv;

  const unclaimFlag = rest.includes('--unclaim');
  if (file === '--unclaim') {
    const id = rest[0] ?? process.argv[3];
    return unclaim(id);
  }
  if (unclaimFlag) {
    const idIndex = rest.indexOf('--unclaim') + 1;
    return unclaim(rest[idIndex]);
  }

  if (!file) {
    console.error('Usage: node import.mjs <path-to-xlsx>');
    console.error('       node import.mjs --unclaim <item-id>');
    process.exit(1);
  }

  const buf = await readFile(file);
  const rows = parseExcel(buf);
  console.log(`Parsed ${rows.length} rows from ${file}`);

  const client = makeAdminClient({
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const { inserted, updated, unchanged } = await upsertItems(client, rows);
  console.log(`Done: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged.`);
}

async function unclaim(id) {
  if (!id) {
    console.error('Usage: node import.mjs --unclaim <item-id>');
    process.exit(1);
  }
  const client = makeAdminClient({
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const { data, error } = await client
    .from('items')
    .update({ claimed: false, claimed_at: null })
    .eq('id', id)
    .select('id, name');
  if (error) { console.error(error); process.exit(1); }
  if (!data?.length) { console.error('No item with id', id); process.exit(1); }
  console.log(`Unclaimed: ${data[0].name} (${data[0].id})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
