# Security

## Secrets

`.env` was committed in the initial commit. It is now untracked and git-ignored, but **it is still in
git history**, so treat `MONGODB_URI` and `JWT_SECRET` as compromised:

1. Rotate the database user password (and the Atlas connection string) and generate a new `JWT_SECRET`
   (≥ 32 random chars). Rotating the JWT secret signs everybody out, which is intended.
2. If the repository is, or will be, public or shared, purge history:
   `git filter-repo --path .env --invert-paths`, then force-push and have collaborators re-clone.
3. Keep real values only in `.env` locally and in your host's secret manager. `.env.example` documents the keys.

The server refuses to start without `MONGODB_URI` or with a `JWT_SECRET` shorter than 32 characters.

## Authentication and sessions

- Passwords: bcrypt cost 12, never selected by default (`select: false`), 8-72 characters with a letter and a digit.
- Session: JWT (HS256 pinned, 7 days) in an **httpOnly, SameSite=Lax, Secure-in-production cookie**.
  JavaScript cannot read it, so an XSS bug cannot exfiltrate the token (previously it sat in `localStorage`).
- On every request the server checks that the user still exists, so deleted accounts lose access immediately.
- Invalid/expired token → `401` (the client then drops its session state).
- Login runs bcrypt even for unknown emails (equal response time) and returns one generic message.
- Rate limiting: 20 attempts / 15 min / IP on login, register, password change, account deletion.
  Put the app behind a proxy → set `TRUST_PROXY=true`.

## CSRF and CORS

- CORS allows only `CLIENT_ORIGIN`, with credentials.
- Cookies are `SameSite=Lax`, and `originGuard` rejects any POST/PUT/DELETE whose `Origin` header differs from `CLIENT_ORIGIN`.

## Authorization and privacy

All viewer-dependent rules are enforced server-side (see the matrix in [api.md](api.md#privacy-matrix)):

- Private dreams return `404` to everyone but the author, for read, like and comment.
- Anonymous dreams never include the author id, name or avatar for non-authors; the author's own
  comments on an anonymous dream are shown as "Anonymous" too; anonymous dreams are not listed on profiles.
- Likers are never listed, only `likesCount` and `likedByMe`.
- Only the author edits or deletes a dream; a comment can be deleted by its author or the dream's owner.
- `serializeDream` / `serializeUser` are the only exits for data. Add new fields there deliberately.
- Covered by `server/test/privacy.test.js`.

## Input handling

- Every route validates with zod; unknown fields are dropped, so `userId`, `likes`, etc. cannot be mass-assigned.
- Query values are coerced to strings/numbers by the schema, so `?tag[$ne]=x` style operator injection is rejected.
- User search escapes regex input, matches names only, needs 2+ chars and returns at most 10 users (no email enumeration, no ReDoS).
- Pagination is bounded (`limit` ≤ 50). JSON body ≤ 50 kb.
- Avatar URLs must be `https` on an allow-listed host; websites must be `http(s)`. This blocks `javascript:` URLs and third-party tracking pixels.
- Mentions are filtered to ids of users that exist.
- React escapes all rendered text; there is no `dangerouslySetInnerHTML`.
- `helmet` sets security headers; `x-powered-by` is disabled.

## Known residual risks

- `POST /auth/register` answers `409 Email already registered`, which reveals that an email exists.
  Removing this needs email verification (send the same response either way). Rate limiting slows enumeration.
- No refresh tokens or server-side session revocation; a stolen cookie is valid up to 7 days.
- No email verification or password reset yet.
- `npm audit` should be run regularly; dev-server (Vite/esbuild) advisories only affect local development.

## Deployment checklist

- [ ] `NODE_ENV=production`, HTTPS everywhere (cookies are `Secure` in production)
- [ ] `CLIENT_ORIGIN` set to the exact production frontend origin
- [ ] Frontend and API on the same site (same registrable domain) so `SameSite=Lax` cookies are sent
- [ ] `TRUST_PROXY=true` behind a proxy / load balancer
- [ ] Fresh `JWT_SECRET` and DB credentials, not the ones from git history
- [ ] MongoDB not exposed publicly, least-privilege DB user
- [ ] `npm audit`, `npm test`, `npm run build` green in CI
