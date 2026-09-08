# @revenue-platform/server

The NestJS API for revenue-platform. See the [repository README](../../README.md)
for what the platform does and which modules exist.

## Commands

```bash
npm run start:dev     # watch mode
npm run build         # compile to dist/
npm run start:prod    # run the compiled build
npm run lint          # oxlint
npm test              # vitest
npx prisma studio     # browse the database
```

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase **Session pooler** string, port 5432 |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `PORT` | defaults to 3000 |

The app refuses to start without `DATABASE_URL` or `JWT_SECRET` — both are read
with `getOrThrow`, so a missing value fails at boot rather than silently later.

## Prisma notes

- Prisma 7 removed `directUrl`. One `url`, set in `prisma.config.ts`.
- Prisma 7 does not load `.env` on its own — `prisma.config.ts` imports
  `dotenv/config` first.
- The generated client is real files in `src/generated/prisma`. It is gitignored
  and must be regenerated after every schema change: `npx prisma generate`.
- Keep the `prisma` CLI and `@prisma/client` on the same version. Install the CLI
  pinned: `npm install --save-dev prisma@7.10.0`.
