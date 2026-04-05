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
