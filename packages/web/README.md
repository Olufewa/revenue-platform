# web

The Revenue Platform web app: Next.js (App Router), Tailwind CSS and Zustand.

Sign-in, the shell, routes and design system are in place. The other screens are
placeholders that don't fetch data yet.

## Commands

Run from the repository root:

```bash
npm run dev:web     # http://localhost:3001
npm run build:web
npm run lint:web
npm run test:web
npm run typecheck -w web
```

## Layout

```
src/
  app/globals.css      design tokens
  app/(auth)/          sign-in
  app/session/         sign-in and sign-out endpoints, which set the cookie
  app/(app)/           pages with the sidebar: /services and /services/:id/*
  app/design-system/   living style guide
  components/ui/       the component kit
  components/layout/   sidebar, page header, placeholders
  proxy.ts             page guard, and adds the bearer token to API calls
  stores/              workspace (persisted)
  lib/api.ts           fetch wrapper for client components
  lib/money.ts         formats the API's { amount, currency } values
```

## Calling the API

The API has no CORS setup, so `src/proxy.ts` forwards `/api/*` to `API_URL`
(default `http://localhost:3003`). Use the `api()` helper, which adds the bearer
token through `proxy.ts`:

```ts
const services = await api<Service[]>('/services');
```

`API_URL` is read at runtime, so it doesn't need to be set at build time.

## Authentication

The API issues a 15-minute access token and a 7-day refresh token. Both are kept
in httpOnly cookies (`rp_session` and `rp_refresh`), so page scripts can't read
them. `POST /session` signs in through the API and sets them. `DELETE /session`
revokes the session on the API and clears them.

`src/proxy.ts` runs on every request and:

- refreshes the session when the access token has expired or is about to, so
  client code never has to handle expiry
- redirects signed-out visitors to `/sign-in?next=<path>`
- turns the access cookie into `Authorization: Bearer` on `/api/*` requests, and
  never forwards cookies to the API

If the API refuses a refresh, the session is over and both cookies are cleared. If
it can't be reached, the person is sent to sign-in but the refresh cookie stays,
so they are signed back in without a password once the API returns.

`/design-system` is public because it only shows sample data.

The proxy reads the token's expiry and email but can't verify its signature,
because the secret belongs to the API. A forged cookie can open a page shell but
gets no data, so **pages must load their data from the API**, not from anything
bundled into the page.

Limits that come from the API:

- An access token already issued works for up to 15 minutes after sign-out.
- Signing out ends this device's session, not the person's other devices.
- If the API is unreachable during sign-out, the cookies are still cleared, but
  the refresh token stays valid on the API until it expires.

## Design system

Open `/design-system` to see every token and component. The tokens are defined
in `src/app/globals.css` and become utilities such as `bg-paper`, `text-ink-2`,
`border-line` and `rounded-panel`. Tailwind's default colours are removed, so
only the design's colours are available.

The rules behind it:

- **Numbers first.** Each screen answers one money question at the top. Figures
  are large, tabular (`num`), right-aligned and carry the currency.
- **Ink, paper, one gold.** Colour is for meaning. Gold marks the single most
  important thing on a screen, always as a fill with ink on top, and only one
  primary action per screen.
- **Spacing over boxes.** Group with whitespace and alignment. Hairlines only
  when spacing can't do the job. No drop shadows or gradients.
- **Ledger-true.** A transaction always shows both legs, never only a net figure.
- **Status is never colour alone.** Every status pairs a shape or symbol with its
  colour.
- **Destructive actions** are outlined red and sit away from copy and confirm.
- **Money format.** Full precision in tables (`formatMoney`), compact in tiles
  (`formatCompact`). Never convert amounts to a JavaScript number for display.
- **Fonts.** Geist for text and Geist Mono for IDs, keys and times.
- **Controls** are 36px tall, or 44px on touch (`h-control`). Radius is 8px on
  controls and 12px on panels.
