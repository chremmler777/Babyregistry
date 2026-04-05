# Baby Registry — Design Spec

**Date:** 2026-04-05
**Repo:** https://github.com/chremmler777/Babyregistry

## Goal

A free, always-accessible, shareable baby gift registry website. Owner imports items from Excel; guests view items and mark ones they plan to gift. Claimed items disappear so other guests don't double-buy.

## Requirements

- Free hosting, always on (no cold starts), one shareable URL.
- Public site, no login for guests.
- Guest can claim an item with a single click + confirm; claimed items disappear from the public view.
- Owner imports/updates items from an Excel file.
- Small dataset (under ~200 items).

## Architecture

- **Frontend:** Static site on **GitHub Pages** (plain HTML / CSS / vanilla JS, no build step).
- **Database:** **Supabase** free tier (Postgres + auto-generated REST API).
- **Admin:** Local Node script on the owner's machine that reads Excel and upserts into Supabase using a service-role key kept in a local `.env` (never committed).

The browser talks directly to Supabase using the public `anon` key. Row-Level Security policies on Supabase restrict what anon can do. The service-role key is only ever used from the owner's laptop.

## Data Model

Single table `items`:

| column          | type                | notes                                  |
| --------------- | ------------------- | -------------------------------------- |
| id              | uuid (pk)           | default `gen_random_uuid()`            |
| name            | text not null       | item title                             |
| description     | text                | longer description                     |
| link            | text                | URL to product page                    |
| price           | numeric             | nullable                               |
| image_url       | text                | nullable; card shows placeholder if missing |
| category        | text                | free-form; powers filter/grouping      |
| claimed         | boolean not null    | default false                          |
| claimed_at      | timestamptz         | nullable                               |
| import_key      | text unique         | stable key for re-import upsert (e.g., slug of name) |
| created_at      | timestamptz         | default now()                          |

Index on `claimed` for fast public query.

## Supabase RLS Policies

- `anon` role:
  - `SELECT` allowed where `claimed = false`.
  - `UPDATE` allowed only when the update sets `claimed = true` AND the row's current `claimed = false` AND no other columns are modified. Enforced via a policy + a trigger that rejects writes to any column other than `claimed` and `claimed_at` from the anon role.
  - `INSERT` and `DELETE` denied.
- `service_role` (admin script): full access.

## Public Site (`index.html` + `app.js` + `style.css`)

- On load: fetch unclaimed items from Supabase (`GET /rest/v1/items?claimed=eq.false`).
- Render as a responsive card grid, grouped by `category`.
- Each card shows: image (or placeholder), name, price, short description, "View product" link (if `link` is a URL), and an **"I'll get this"** button.
- Button → confirm dialog ("Mark as your gift? Others won't see it anymore.") → `PATCH /rest/v1/items?id=eq.<id>&claimed=eq.false` setting `claimed=true, claimed_at=now()`.
- If response returns 0 rows updated → toast "Someone just claimed that one — refreshing" → reload list.
- If network error → toast "Couldn't save, try again" → leave card visible.
- Mobile-friendly (single-column grid on narrow viewports).
- Optional category filter dropdown built from distinct categories in the data.

## Admin Import Script (`import.mjs`)

- Command: `node import.mjs <path-to-xlsx>`.
- Reads `.env` for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Parses Excel using a lightweight lib (e.g., `xlsx` or `exceljs`).
- For each row, computes `import_key` as a slug of `name`.
- Upserts into `items` on `import_key`:
  - INSERT if new.
  - UPDATE `name, description, link, price, image_url, category` for existing rows.
  - Never touches `claimed` or `claimed_at` — existing claims are preserved.
- Prints a summary: N inserted, N updated, N unchanged.
- Helper `unclaim.mjs` (or `--unclaim <id>` flag) for fixing accidental claims.

**Expected Excel columns** (owner will shape the sheet to match): `name, description, link, price, image_url, category`. The import script validates headers and errors clearly if a required header is missing.

## Repo Layout

```
Babyregistry/
├── index.html
├── style.css
├── app.js
├── import.mjs
├── package.json           # deps for import script only
├── .env.example
├── .gitignore             # ignores .env, node_modules
├── README.md
├── test/
│   └── import.test.mjs    # node --test
└── docs/superpowers/specs/2026-04-05-baby-registry-design.md
```

## Error Handling & Edge Cases

- **Concurrent claim race:** conditional UPDATE (`... AND claimed=false`); 0 rows → refresh list with friendly message.
- **Network failure on claim:** toast + retry; item stays visible.
- **Re-import preserves claims:** upsert on `import_key`, never writes `claimed`/`claimed_at`.
- **Missing image URL:** card shows a placeholder graphic.
- **Missing price:** card omits the price line.
- **Owner mistake (accidental claim):** owner runs `unclaim.mjs` locally.

## Testing

- **Unit:** Excel parser — fixture xlsx with a few rows including blanks and missing optional fields; asserts correct row objects.
- **Integration:** claim flow — against a Supabase dev project or a local Postgres, assert second claim on same item returns 0 rows.
- **Manual smoke:** load site in two browsers, claim in one, refresh other → item gone.

No heavy test framework — `node --test` with a `test/` folder.

## Rollout

1. Create Supabase project; create `items` table + RLS policies + trigger via SQL migration file checked into the repo (`supabase/schema.sql`).
2. Put the `anon` key and project URL directly in `app.js` (public by design — RLS is the real security boundary).
3. Build and smoke-test the static site locally, open `index.html` in a browser.
4. Push to `main`; enable GitHub Pages on `main` / root.
5. Owner runs `node import.mjs "BABY ESSENTIALS.xlsx"` from their laptop with `.env` populated.
6. Share the Pages URL with family.

## Out of Scope

- User accounts / login.
- Un-claim from the public site.
- Notifications, emails, or messaging.
- Image uploads (owner provides image URLs in the sheet if desired).
- Multiple registries / multi-user.
