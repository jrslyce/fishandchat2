# Fish and Chat EBS

Minimal Twitch Extension Backend Service (Cloudflare Worker). Verifies the Extension Helper JWT,
looks up the viewer's display name via Helix once they've shared their Twitch ID, and stores their
save state in Cloudflare D1.

D1 binds directly to the Worker, so there are no storage credentials to manage — the binding in
`wrangler.toml` is the whole configuration.

## Local setup

```sh
cd ebs
npm install
cp .dev.vars.example .dev.vars
```

Fill in `.dev.vars`:
- `TWITCH_EXTENSION_SECRET` — from the Twitch dev console, your extension's "Secret" (base64).
- `TWITCH_CLIENT_ID` — already filled with the registered client ID.
- `TWITCH_CLIENT_SECRET` — the OAuth client secret for that same client ID (used to fetch an
  app access token for Helix `/users` lookups).

Never commit `.dev.vars` (already gitignored) and never put these values in the frontend's
`fish-and-chat/.env` — anything `VITE_`-prefixed ships to every viewer's browser.

Create the database and apply the schema (once):

```sh
npx wrangler d1 create fish-and-chat-saves
```

Paste the printed `database_id` into `wrangler.toml`, then:

```sh
npx wrangler d1 migrations apply fish-and-chat-saves --local
```

```sh
npm run dev
# Worker runs on http://127.0.0.1:8787 — GET /health should return {"ok":true}
```

`--local` keeps the database in `.wrangler/` on disk. Drop the flag to apply against the real
remote database — do that once before the first deploy.

## Deploy

```sh
npx wrangler login
npx wrangler secret put TWITCH_EXTENSION_SECRET
npx wrangler secret put TWITCH_CLIENT_SECRET
npx wrangler secret put TWITCH_CLIENT_ID
npx wrangler d1 migrations apply fish-and-chat-saves --remote
npm run deploy
```

`wrangler deploy` prints your Worker's URL (`https://fish-and-chat-ebs.<your-subdomain>.workers.dev`).
Paste that into the frontend's `fish-and-chat/.env` as `VITE_EBS_BASE_URL`, then rebuild the
frontend before re-zipping for the Twitch hosted test.

## Endpoints

- `GET /health` — no auth, liveness check.
- `GET /profile` — `Authorization: Bearer <Twitch Extension JWT>`. Returns
  `{ shared: false, displayName: null }` if the viewer hasn't shared their Twitch ID yet, or
  `{ shared: true, displayName: "..." }` once they have.
- `GET /save` — same auth. Returns `{ scopeUsed, save: { state, updatedAt } | null }`.
- `PUT /save` — same auth, body `{ state, updatedAt }`. Returns `{ scopeUsed, stale }`.
  `stale: true` means a newer snapshot for this key was already stored and this write was
  dropped on purpose — the client should treat its state as superseded, not retry.

### Write cadence

The frontend autosaves to localStorage every 5s; do **not** mirror that to `PUT /save`. One
continuously-playing viewer at that rate is ~17k writes/day, against a 100k rows/day free tier.
Flush on a coarse timer plus `pagehide`, and let localStorage own the session.

## Note on full JWT verification

`window.Twitch.ext` only exists inside a real Twitch extension iframe — you can't fully exercise
the `/profile` flow from plain `localhost`. Use the Twitch Developer Rig or an actual Hosted Test
to verify end-to-end.
