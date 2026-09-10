# 03 — Run and verify (modules 1 & 2)

Commands to run from `packages/server`.

```bash
cd packages/server

npm install
npx prisma --version                     # must say 7.10.0 - see below
npx prisma migrate dev --name add_user   # creates the User table
npx prisma generate                      # writes src/generated/prisma

npm run start:dev
```

Three routes should be mapped, then `API listening on http://localhost:3003`.

### Pin the Prisma CLI version

`npm install --save-dev prisma` on its own installs **prisma 8.0.0-rc**, a release
candidate for a completely different CLI. It is published under the `latest` tag
while `@prisma/client`'s `latest` is still 7.10.0, so the two packages end up on
different major versions.

You can tell it happened because `npx prisma migrate dev` answers:

```
[CLI.UNKNOWN_COMMAND] No command registered for `migrate`, did you mean `migration`?
```

The v8 CLI renamed `migrate` to `migration` and is a deploy platform rather than
an ORM tool. **The CLI and the client must always be the same version.** Install
it pinned:

```bash
npm install --save-dev prisma@7.10.0
```

It also drops a few editor-tooling folders and a `skills-lock.json` at the repo
root. Once you are back on 7.10.0 those are orphaned and safe to delete.

### If something goes wrong

| Problem | Fix |
|---|---|
| `No command registered for \`migrate\`` | You are on the Prisma 8 RC. `npm install --save-dev prisma@7.10.0` |
| Lots of `npm audit` warnings | Re-check after pinning to 7.10.0 — most came from the v8 RC. Do **not** run `npm audit fix --force` |
| `PrismaClientInitializationError: ... A driver adapter is required` | Prisma 7 dropped the bundled query engine. `npm install @prisma/adapter-pg@7.10.0` — `PrismaService` already passes it |
| npm complains about peer dependencies | `npm install @nestjs/jwt bcryptjs --legacy-peer-deps` |
| TS error on `import bcrypt from 'bcryptjs'` | Change it to `import * as bcrypt from 'bcryptjs';` in `identity.service.ts` |
| **P3014** shadow database | Make a second free Supabase project, put its session-pooler URL in `.env` as `SHADOW_DATABASE_URL`, then add `shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),` next to `url:` in `prisma.config.ts` |
| `Can't reach database server` | Check `DATABASE_URL` in `.env` is the **Session pooler** string, port **5432** |

---

## The checks

Import `postman/collections/revenue-platform.postman_collection.json` into Postman
and hit **Run** — every check below is in there with an assertion attached. The
curl equivalents are here for when you want to see the raw exchange.

```bash
# 1 - register
curl -X POST http://localhost:3003/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"fewa@mtn.test","name":"Fewa","password":"supersecret1"}'
```
→ **201**, and a user object with **no `passwordHash` in it**.

```bash
# 2 - same email again (run the exact same command)
```
→ **409 Conflict**.

```bash
# 3 - login
curl -X POST http://localhost:3003/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fewa@mtn.test","password":"supersecret1"}'
```
→ **200** and `{"access_token":"eyJ..."}`. Copy the token.

```bash
# 4 - wrong password
curl -i -X POST http://localhost:3003/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fewa@mtn.test","password":"wrongpassword"}'
```
→ **401**, not 500. A `try/catch` around the login body is what turns this into a
500 by swallowing the `UnauthorizedException`. There isn't one — confirm it stays
that way.

```bash
# 5 - unknown email
curl -i -X POST http://localhost:3003/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@mtn.test","password":"supersecret1"}'
```
→ **401** with the *same* message as check 4. If they ever differ, anyone can
discover which emails are registered.

```bash
# 6 - protected route
curl http://localhost:3003/auth/me -H "Authorization: Bearer PASTE_TOKEN"
```
→ **200** and your user.

```bash
# 7 - no token
curl -i http://localhost:3003/auth/me
```
→ **401**.

```bash
# 8 - tampered token
curl -i http://localhost:3003/auth/me -H "Authorization: Bearer PASTE_TOKENxxxx"
```
→ **401**. This is what proves the token is *verified*, not merely decoded.

```bash
# 9 - junk in the body
curl -i -X POST http://localhost:3003/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","name":"x","password":"123","isAdmin":true}'
```
→ **400** listing every problem, including that `isAdmin` is not allowed.
That last one is `forbidNonWhitelisted` earning its keep: without it, someone
could try to set fields you never meant to expose.

Finally:

```bash
npx prisma studio
```

Look at the `User` row. `passwordHash` should be an unreadable string starting
`$2a$` or `$2b$`. If you can read the password, something is wrong.

## Done when

- [ ] All nine checks return the expected status
- [ ] `passwordHash` in the database is a hash, not a password
- [ ] No response anywhere contains `passwordHash`
- [ ] Wrong password returns 401, not 500
- [ ] Deleting `JWT_SECRET` from `.env` makes the app refuse to start
