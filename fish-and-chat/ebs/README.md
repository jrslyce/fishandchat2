# Fish and Chat EBS

Twitch Extension Backend Service on Cloudflare Workers. Verifies the Extension Helper JWT,
checks Bits transactions with Twitch Helix, keeps per-channel Candy Bar wallets and
account-wide premium entitlements in D1, and hosts one hibernating WebSocket pond room
per Twitch channel.

This deploys as `fish-and-chat-social`, alongside the existing `fish-and-chat-ebs` save
Worker. The older Worker and its `fish-and-chat-saves` D1 database must stay intact for
existing player saves. This service uses a separate `fish-and-chat-wallets` D1 database.

## Local setup

```sh
cd ebs
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply fish-and-chat-wallets --local
```

Fill in `.dev.vars`:
- `TWITCH_EXTENSION_SECRET` — from the Twitch dev console, your extension's "Secret" (base64).
- `TWITCH_CLIENT_ID` — already filled with the registered client ID.
- `TWITCH_CLIENT_SECRET` — the OAuth client secret for that same client ID (used to fetch an
  app access token for Helix `/users` lookups).
- `TWITCH_EVENTSUB_SECRET` — a random ASCII secret (10-100 characters) used for the
  `extension.bits_transaction.create` webhook subscription.

Never commit `.dev.vars` (already gitignored) and never put these values in the frontend's
`fish-and-chat/.env` — anything `VITE_`-prefixed ships to every viewer's browser.

```sh
npm run dev
# Worker runs on http://127.0.0.1:8787 — GET /health should return {"ok":true}
```

## Deploy

```sh
npx wrangler login
# The fish-and-chat-wallets D1 database already exists and its ID is in wrangler.toml.
# Its initial schema was applied through the Cloudflare API on 2026-11-11.
# This idempotent migration records the schema in Wrangler's migration history.
npx wrangler d1 migrations apply fish-and-chat-wallets --remote
npx wrangler secret put TWITCH_EXTENSION_SECRET
npx wrangler secret put TWITCH_CLIENT_SECRET
npx wrangler secret put TWITCH_CLIENT_ID
npx wrangler secret put TWITCH_EVENTSUB_SECRET
npm run deploy
```

`wrangler deploy` prints your Worker's URL (`https://fish-and-chat-social.<your-subdomain>.workers.dev`).
Paste that into the frontend's `fish-and-chat/.env` as `VITE_EBS_BASE_URL`, then rebuild the
frontend before re-zipping for the Twitch hosted test.

Register the three Bits SKUs in Twitch's Monetization tab before enabling them:
`pack-snack` = 100 Bits, `pack-value` = 500 Bits, `pack-party` = 1000 Bits.
Do not mark these as broadcast products: the pond announcement happens only after
a verified Candy redemption, not when a viewer funds the wallet.
Create one `extension.bits_transaction.create` EventSub webhook subscription for the
extension client ID, pointing at `https://<worker-host>/eventsub/bits` and using the same
`TWITCH_EVENTSUB_SECRET`. This lets the server fulfill a Bits exchange even if the viewer
closes the panel before its callback arrives. The browser callback and webhook use one
transaction ID as their ledger key, so duplicate delivery credits only once.

## Endpoints

- `GET /health` — no auth, liveness check.
- `GET /profile` — `Authorization: Bearer <Twitch Extension JWT>`. Returns
  `{ shared: false, displayName: null }` if the viewer hasn't shared their Twitch ID yet, or
  `{ shared: true, displayName: "..." }` once they have.
- `GET /wallet` — verified viewer's channel wallets, ledger activity, and premium entitlements.
- `POST /bits/fulfill` — verifies a Twitch transaction ID, SKU, price, buyer, and channel
  with Helix, then credits the channel wallet once.
- `POST /eventsub/bits` — signed Twitch webhook for server-side Bits fulfillment and retry.
- `POST /premium/redeem` — debits the active channel wallet once for an account-wide
  permanent entitlement; fashion unlocks announce to that channel's pond.
- `POST /pond/ticket` — one-use, short-lived ticket for a verified identity.
- `GET /pond/ws` — channel presence room (ticket required) for up to 101 fishers.

## Release gates

The game stores broader progress in a client-written Muxy state. On Twitch, client-side
quest Candy rewards are suppressed and the quest UI shows coins and XP only; local standalone
debug play retains those rewards. Twitch Candy spending beyond permanent premium
items (pond events, bundles, Box of Not Fish) is disabled until those rewards and deliveries
are moved behind trusted server receipts. Existing client-owned premium items need a deliberate
migration into D1 before enabling the new wallet on an established audience. Local standalone
debug grants remain available for testing. Verify a real Hosted Test Bits exchange, an
idempotent replay, cross-channel entitlement, and 100 connected clients before release.

## Note on full JWT verification

`window.Twitch.ext` only exists inside a real Twitch extension iframe — you can't fully exercise
the `/profile` flow from plain `localhost`. Use the Twitch Developer Rig or an actual Hosted Test
to verify end-to-end.
