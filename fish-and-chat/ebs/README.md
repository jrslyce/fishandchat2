# Fish and Chat EBS

Minimal Twitch Extension Backend Service (Cloudflare Worker). Verifies the Extension Helper JWT
and, once a viewer has shared their Twitch ID, looks up their display name via Helix so the
frontend can show it. No storage yet — this is the identity/auth handshake only.

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

```sh
npm run dev
# Worker runs on http://127.0.0.1:8787 — GET /health should return {"ok":true}
```

## Deploy

```sh
npx wrangler login
npx wrangler secret put TWITCH_EXTENSION_SECRET
npx wrangler secret put TWITCH_CLIENT_SECRET
npx wrangler secret put TWITCH_CLIENT_ID
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

## Note on full JWT verification

`window.Twitch.ext` only exists inside a real Twitch extension iframe — you can't fully exercise
the `/profile` flow from plain `localhost`. Use the Twitch Developer Rig or an actual Hosted Test
to verify end-to-end.
