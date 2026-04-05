# Baby Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, publicly shareable baby-gift registry on GitHub Pages backed by Supabase, with a local Excel import script.

**Architecture:** Static HTML/CSS/vanilla-JS frontend on GitHub Pages talks directly to Supabase REST API. Supabase RLS restricts anon role to reading unclaimed items and claiming them. Owner runs a local Node script with a service-role key to import/update items from Excel.

**Tech Stack:** HTML / CSS / vanilla JS (no build), Supabase (Postgres + PostgREST), Node 20+, `@supabase/supabase-js`, `xlsx` (SheetJS) for Excel parsing, `node --test` for tests.

---

## File Structure

- `index.html` — public registry page
- `style.css` — responsive card grid
- `app.js` — fetch, render, claim flow
- `config.js` — Supabase URL + anon key (public, committed)
- `import.mjs` — CLI entry for Excel import
- `lib/parseExcel.mjs` — parse xlsx into row objects (pure function, testable)
- `lib/slug.mjs` — slug helper for import_key (pure function, testable)
- `lib/supabaseAdmin.mjs` — admin Supabase client factory + upsert helper
- `supabase/schema.sql` — DDL for items table, index, RLS policies, trigger
- `package.json` — admin-script deps only
- `.env.example` — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- `.gitignore` — `.env`, `node_modules`
- `README.md` — setup + usage
- `test/parseExcel.test.mjs`
- `test/slug.test.mjs`

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `README.md`

- [ ] **Step 1: Write `.gitignore`**

Create `.gitignore`:
```
.env
node_modules/
*.log
.DS_Store
```

- [ ] **Step 2: Write `.env.example`**

Create `.env.example`:
```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [ ] **Step 3: Write `package.json`**

Create `package.json`:
```json
{
  "name": "baby-registry",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "import": "node import.mjs",
    "test": "node --test test/"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "dotenv": "^16.4.5",
    "xlsx": "^0.18.5"
  }
}
```

- [ ] **Step 4: Write `README.md`**

Create `README.md`:
```markdown
# Baby Registry

Public baby gift registry. Static site on GitHub Pages + Supabase.

## Setup (once)

1. Create a Supabase project at https://supabase.com.
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. Copy your project URL and anon key into `config.js`.
4. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Settings → API).
5. `npm install`

## Import items from Excel

Excel must have columns: `name, description, link, price, image_url, category`.

```
npm run import -- path/to/registry.xlsx
```

Re-running preserves existing claims.

## Deploy

Push to `main`. In GitHub → Settings → Pages, serve from `main` / root.
```

- [ ] **Step 5: Install deps**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json`, no errors.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example package.json package-lock.json README.md
git commit -m "chore: project scaffolding"
```

---

## Task 2: Supabase schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write schema SQL**

Create `supabase/schema.sql`:
```sql
-- Items table
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  link text,
  price numeric,
  image_url text,
  category text,
  claimed boolean not null default false,
  claimed_at timestamptz,
  import_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists items_claimed_idx on public.items (claimed);

-- Enable Row Level Security
alter table public.items enable row level security;

-- Anon can read unclaimed items
drop policy if exists "anon read unclaimed" on public.items;
create policy "anon read unclaimed"
  on public.items
  for select
  to anon
  using (claimed = false);

-- Anon can update only to claim an unclaimed item
drop policy if exists "anon claim unclaimed" on public.items;
create policy "anon claim unclaimed"
  on public.items
  for update
  to anon
  using (claimed = false)
  with check (claimed = true);

-- Trigger prevents anon from modifying any column other than claimed/claimed_at
create or replace function public.guard_anon_item_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'anon' then
    if new.name        is distinct from old.name
    or new.description is distinct from old.description
    or new.link        is distinct from old.link
    or new.price       is distinct from old.price
    or new.image_url   is distinct from old.image_url
    or new.category    is distinct from old.category
    or new.import_key  is distinct from old.import_key
    or new.id          is distinct from old.id
    or new.created_at  is distinct from old.created_at then
      raise exception 'anon can only set claimed/claimed_at';
    end if;
    if new.claimed <> true then
      raise exception 'anon can only set claimed=true';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_anon_item_update on public.items;
create trigger guard_anon_item_update
  before update on public.items
  for each row
  execute function public.guard_anon_item_update();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: supabase schema with RLS policies and anon update guard"
```

---

## Task 3: Slug helper (TDD)

**Files:**
- Create: `lib/slug.mjs`
- Test: `test/slug.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/slug.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../lib/slug.mjs';

test('lowercases and replaces spaces with dashes', () => {
  assert.equal(slug('Graco Car Seat'), 'graco-car-seat');
});

test('strips punctuation', () => {
  assert.equal(slug("Baby's First Book!"), 'babys-first-book');
});

test('collapses repeated separators', () => {
  assert.equal(slug('Crib   ---  Sheet'), 'crib-sheet');
});

test('trims leading/trailing separators', () => {
  assert.equal(slug('  Hello  '), 'hello');
});

test('handles unicode by stripping non-ascii-alnum', () => {
  assert.equal(slug('Café Latté'), 'caf-latt');
});

test('empty input throws', () => {
  assert.throws(() => slug(''), /empty/i);
  assert.throws(() => slug('   '), /empty/i);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/slug.mjs'`.

- [ ] **Step 3: Implement `slug`**

Create `lib/slug.mjs`:
```javascript
export function slug(input) {
  const s = String(input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) throw new Error('slug: empty input');
  return s;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/slug.mjs test/slug.test.mjs
git commit -m "feat: slug helper for import_key"
```

---

## Task 4: Excel parser (TDD)

**Files:**
- Create: `lib/parseExcel.mjs`
- Test: `test/parseExcel.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/parseExcel.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseExcel } from '../lib/parseExcel.mjs';

function makeXlsxBuffer(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('parses required columns', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price', 'image_url', 'category'],
    ['Crib', 'Wood crib', 'http://x/crib', 200, 'http://x/crib.jpg', 'Nursery'],
  ]);
  const rows = parseExcel(buf);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    name: 'Crib',
    description: 'Wood crib',
    link: 'http://x/crib',
    price: 200,
    image_url: 'http://x/crib.jpg',
    category: 'Nursery',
  });
});

test('skips rows with blank name', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price', 'image_url', 'category'],
    ['', 'orphan', '', '', '', ''],
    ['Bottle', '', '', '', '', 'Feeding'],
  ]);
  const rows = parseExcel(buf);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Bottle');
});

test('maps missing optional cells to null', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price', 'image_url', 'category'],
    ['Hat', '', '', '', '', ''],
  ]);
  const rows = parseExcel(buf);
  assert.equal(rows[0].description, null);
  assert.equal(rows[0].price, null);
  assert.equal(rows[0].image_url, null);
});

test('throws on missing required header', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price'],
    ['Hat', '', '', ''],
  ]);
  assert.throws(() => parseExcel(buf), /missing.*image_url|missing.*category/i);
});

test('coerces price strings to numbers when possible', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price', 'image_url', 'category'],
    ['A', '', '', '19.99', '', 'x'],
    ['B', '', '', 'free', '', 'x'],
  ]);
  const rows = parseExcel(buf);
  assert.equal(rows[0].price, 19.99);
  assert.equal(rows[1].price, null);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `parseExcel`**

Create `lib/parseExcel.mjs`:
```javascript
import * as XLSX from 'xlsx';

const REQUIRED = ['name', 'description', 'link', 'price', 'image_url', 'category'];

function cellToString(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function cellToNumber(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

export function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (aoa.length === 0) return [];
  const header = aoa[0].map((h) => String(h).trim().toLowerCase());
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length) {
    throw new Error(`parseExcel: missing required column(s): ${missing.join(', ')}`);
  }
  const idx = Object.fromEntries(REQUIRED.map((k) => [k, header.indexOf(k)]));
  const out = [];
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    const name = cellToString(row[idx.name]);
    if (!name) continue;
    out.push({
      name,
      description: cellToString(row[idx.description]),
      link: cellToString(row[idx.link]),
      price: cellToNumber(row[idx.price]),
      image_url: cellToString(row[idx.image_url]),
      category: cellToString(row[idx.category]),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test`
Expected: all parseExcel tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/parseExcel.mjs test/parseExcel.test.mjs
git commit -m "feat: Excel parser for registry imports"
```

---

## Task 5: Supabase admin helper

**Files:**
- Create: `lib/supabaseAdmin.mjs`

- [ ] **Step 1: Write admin client factory + upsert helper**

Create `lib/supabaseAdmin.mjs`:
```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabaseAdmin.mjs
git commit -m "feat: supabase admin client + upsert helper"
```

---

## Task 6: Import CLI

**Files:**
- Create: `import.mjs`

- [ ] **Step 1: Write CLI**

Create `import.mjs`:
```javascript
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
```

- [ ] **Step 2: Smoke test help output**

Run: `node import.mjs`
Expected: prints `Usage:` lines and exits 1.

- [ ] **Step 3: Commit**

```bash
git add import.mjs
git commit -m "feat: import CLI with --unclaim helper"
```

---

## Task 7: Frontend config

**Files:**
- Create: `config.js`

- [ ] **Step 1: Write config**

Create `config.js`:
```javascript
// Public Supabase config. Safe to commit — anon key is meant to be public,
// and the database is protected by Row-Level Security policies.
window.SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-KEY',
};
```

- [ ] **Step 2: Commit**

```bash
git add config.js
git commit -m "feat: frontend config stub"
```

---

## Task 8: Frontend HTML

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write index.html**

Create `index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Baby Registry</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>Baby Registry</h1>
    <p class="tagline">Pick something you'd like to gift. Once you claim it, others won't see it anymore.</p>
    <label class="filter">
      Category:
      <select id="category-filter"><option value="">All</option></select>
    </label>
  </header>

  <main id="grid" aria-live="polite"></main>

  <div id="toast" role="status" aria-live="polite"></div>

  <template id="card-template">
    <article class="card">
      <div class="card-img"><img alt="" loading="lazy"></div>
      <div class="card-body">
        <h3 class="card-name"></h3>
        <p class="card-desc"></p>
        <p class="card-price"></p>
        <div class="card-actions">
          <a class="card-link" target="_blank" rel="noopener">View product</a>
          <button class="card-claim" type="button">I'll get this</button>
        </div>
      </div>
    </article>
  </template>

  <script src="config.js"></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: public registry HTML"
```

---

## Task 9: Frontend CSS

**Files:**
- Create: `style.css`

- [ ] **Step 1: Write style.css**

Create `style.css`:
```css
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  background: #faf7f5;
  color: #2b2b2b;
}
header {
  padding: 2rem 1rem 1rem;
  text-align: center;
  background: #fff;
  border-bottom: 1px solid #eee;
}
header h1 { margin: 0 0 .25rem; font-size: 2rem; }
.tagline { margin: 0 0 1rem; color: #666; }
.filter { font-size: .9rem; color: #555; }
.filter select { margin-left: .5rem; padding: .25rem .5rem; }
main {
  max-width: 1100px;
  margin: 1.5rem auto;
  padding: 0 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
.category-group { grid-column: 1 / -1; }
.category-group h2 {
  margin: 1rem 0 .5rem;
  font-size: 1.1rem;
  color: #444;
  border-bottom: 1px solid #e5e5e5;
  padding-bottom: .25rem;
}
.category-group .cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.card-img {
  aspect-ratio: 4 / 3;
  background: #f0ece8;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.card-img img { width: 100%; height: 100%; object-fit: cover; }
.card-img.placeholder::before {
  content: "🍼";
  font-size: 3rem;
  opacity: .4;
}
.card-body { padding: .75rem; display: flex; flex-direction: column; gap: .25rem; flex: 1; }
.card-name { margin: 0; font-size: 1rem; }
.card-desc { margin: 0; font-size: .85rem; color: #666; }
.card-price { margin: .25rem 0; font-weight: 600; }
.card-actions { margin-top: auto; display: flex; gap: .5rem; align-items: center; justify-content: space-between; }
.card-link { font-size: .85rem; color: #0066cc; text-decoration: none; }
.card-link:hover { text-decoration: underline; }
.card-link[hidden] { display: none; }
.card-claim {
  background: #d97a66;
  color: #fff;
  border: 0;
  padding: .5rem .75rem;
  border-radius: 6px;
  font-size: .85rem;
  cursor: pointer;
}
.card-claim:hover { background: #c66550; }
.card-claim:disabled { opacity: .6; cursor: not-allowed; }
#toast {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  padding: .75rem 1rem;
  border-radius: 6px;
  font-size: .9rem;
  opacity: 0;
  transition: opacity .2s;
  pointer-events: none;
}
#toast.show { opacity: 1; }
@media (max-width: 520px) {
  main, .category-group .cards { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: responsive card grid styles"
```

---

## Task 10: Frontend app (fetch + render + claim)

**Files:**
- Create: `app.js`

- [ ] **Step 1: Write app.js**

Create `app.js`:
```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { url, anonKey } = window.SUPABASE_CONFIG;
const supabase = createClient(url, anonKey);

const grid = document.getElementById('grid');
const filterSelect = document.getElementById('category-filter');
const toastEl = document.getElementById('toast');
const cardTemplate = document.getElementById('card-template');

let allItems = [];

function isUrl(s) {
  if (!s) return false;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function renderCard(item) {
  const frag = cardTemplate.content.cloneNode(true);
  const imgWrap = frag.querySelector('.card-img');
  const img = frag.querySelector('.card-img img');
  if (item.image_url) {
    img.src = item.image_url;
    img.alt = item.name;
  } else {
    img.remove();
    imgWrap.classList.add('placeholder');
  }
  frag.querySelector('.card-name').textContent = item.name;
  const desc = frag.querySelector('.card-desc');
  if (item.description) desc.textContent = item.description; else desc.remove();
  const price = frag.querySelector('.card-price');
  if (item.price != null) price.textContent = `$${Number(item.price).toFixed(2)}`;
  else price.remove();
  const link = frag.querySelector('.card-link');
  if (isUrl(item.link)) link.href = item.link; else link.hidden = true;
  const btn = frag.querySelector('.card-claim');
  btn.addEventListener('click', () => onClaim(item, btn));
  return frag;
}

function render() {
  const filter = filterSelect.value;
  const items = filter ? allItems.filter((i) => i.category === filter) : allItems;
  grid.innerHTML = '';
  if (items.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888">No items available right now.</p>';
    return;
  }
  const byCat = new Map();
  for (const item of items) {
    const key = item.category || 'Other';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(item);
  }
  for (const [cat, list] of byCat) {
    const group = document.createElement('section');
    group.className = 'category-group';
    const h = document.createElement('h2');
    h.textContent = cat;
    group.appendChild(h);
    const inner = document.createElement('div');
    inner.className = 'cards';
    for (const item of list) inner.appendChild(renderCard(item));
    group.appendChild(inner);
    grid.appendChild(group);
  }
}

function populateCategoryFilter() {
  const cats = [...new Set(allItems.map((i) => i.category).filter(Boolean))].sort();
  filterSelect.innerHTML = '<option value="">All</option>' +
    cats.map((c) => `<option value="${c}">${c}</option>`).join('');
}

async function loadItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('claimed', false)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    grid.innerHTML = '<p style="color:#c00">Could not load items. Try refreshing.</p>';
    console.error(error);
    return;
  }
  allItems = data ?? [];
  populateCategoryFilter();
  render();
}

async function onClaim(item, btn) {
  const ok = confirm(`Mark "${item.name}" as your gift? Others won't see it anymore.`);
  if (!ok) return;
  btn.disabled = true;
  const { data, error } = await supabase
    .from('items')
    .update({ claimed: true, claimed_at: new Date().toISOString() })
    .eq('id', item.id)
    .eq('claimed', false)
    .select('id');
  if (error) {
    console.error(error);
    showToast("Couldn't save — try again.");
    btn.disabled = false;
    return;
  }
  if (!data || data.length === 0) {
    showToast('Someone just claimed that one — refreshing.');
    await loadItems();
    return;
  }
  allItems = allItems.filter((i) => i.id !== item.id);
  render();
  showToast('Got it! Thank you 💛');
}

filterSelect.addEventListener('change', render);
loadItems();
```

- [ ] **Step 2: Commit**

```bash
git add app.js
git commit -m "feat: registry frontend with claim flow"
```

---

## Task 11: Manual smoke test

**Files:** none modified

- [ ] **Step 1: Create Supabase project and run schema**

1. Go to https://supabase.com, create a free project.
2. Open SQL editor, paste contents of `supabase/schema.sql`, run.
3. Supabase → Settings → API: copy `URL`, `anon` key, and `service_role` key.

- [ ] **Step 2: Fill in configs**

Edit `config.js` and replace `url` and `anonKey` with real values.
Copy `.env.example` to `.env` and fill in `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 3: Seed a few test items**

Create `test-items.xlsx` with these rows:

| name | description | link | price | image_url | category |
| --- | --- | --- | --- | --- | --- |
| Crib | Wood convertible crib | https://example.com/crib | 299 | https://picsum.photos/seed/crib/400/300 | Nursery |
| Bottles | Set of 4 | https://example.com/bottles | 25 | https://picsum.photos/seed/bottle/400/300 | Feeding |
| Swaddle | Muslin swaddle | | 15 | | Sleep |

Run: `npm run import -- test-items.xlsx`
Expected: `Done: 3 inserted, 0 updated, 0 unchanged.`

- [ ] **Step 4: Serve the site locally**

Run: `python3 -m http.server 8000`
Open http://localhost:8000 in two browsers.

Verify:
- 3 items visible, grouped by category.
- Category filter works.
- Click "I'll get this" on Crib, confirm → card disappears.
- Refresh second browser → Crib is gone there too.
- The Swaddle card shows the placeholder (no image).

- [ ] **Step 5: Test re-import preserves claims**

Edit `test-items.xlsx`, change Bottles price to `30`. Re-run: `npm run import -- test-items.xlsx`
Expected: `Done: 0 inserted, 1 updated, 2 unchanged.`
Reload the site — Crib is still gone (claim preserved), Bottles price now shows $30.

- [ ] **Step 6: Test unclaim**

In Supabase SQL editor, grab the Crib's `id`.
Run: `npm run import -- --unclaim <id>`
Expected: `Unclaimed: Crib (<id>)` and Crib reappears on the site.

---

## Task 12: Deploy to GitHub Pages

**Files:** none modified

- [ ] **Step 1: Push to GitHub**

```bash
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages**

GitHub repo → Settings → Pages → Source: `Deploy from a branch`, Branch: `main`, Folder: `/ (root)` → Save.

- [ ] **Step 3: Visit the published URL**

Expected: the live registry loads at `https://chremmler777.github.io/Babyregistry/` and items appear.

- [ ] **Step 4: Share the link**

Done.
