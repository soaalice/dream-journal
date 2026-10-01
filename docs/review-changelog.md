# Code review: findings and status

## Security

| Finding | Status |
| --- | --- |
| `.env` (DB URI + JWT secret) committed | Untracked and ignored, `.env.example` added. **You must rotate the secrets and optionally purge history**, see [security.md](security.md#secrets) |
| Any user could read other users' private dreams (`/dreams/user/:id`, like, comment) | Fixed: server-side visibility checks, `404` for hidden dreams |
| Anonymous dreams exposed the author in the API | Fixed: author stripped for non-authors, incl. the author's own comments; not listed on profiles |
| Regex / NoSQL injection and email enumeration in user search | Fixed: escaped regex, name-only, min length, capped, zod-coerced query |
| No server-side validation, mass assignment, unsafe avatar URLs | Fixed: zod schemas on every route, URL allow-list |
| Open CORS, no helmet, no rate limiting, unbounded body | Fixed: single-origin CORS, helmet, rate limits, 50 kb limit |
| JWT in `localStorage`, `403` on bad token, no algorithm pin, optional secret | Fixed: httpOnly cookie, `401`, HS256 pinned, secret required at boot, user existence checked |
| Login timing / user enumeration | Login equalised; register still reveals duplicates (documented residual risk) |
| bcrypt cost 10, password selectable | Cost 12, `select: false`, complexity rule |
| Stack traces / internals in errors | Central error handler, generic 500 |

## Bugs

| Finding | Status |
| --- | --- |
| Counters (`dreamCount`, followers) drifted | Computed on demand, removed from the schema |
| Like toggle raced | Atomic aggregation-pipeline update |
| `PUT /dreams/:id` overwrote missing fields with `undefined` | Partial update schema |
| Unbounded `page` / `limit` | Bounded, returns `total` and `hasMore` |
| `id` vs `_id` mismatch between login and profile responses | One serializer, always `_id` |
| Like/comment responses lost populated author, breaking the client | Responses are fully serialized dreams |
| Detail page used `dream.userId` as string and a hardcoded avatar | Uses the serialized author |
| Explore page keyed cards by `dream.id` (undefined) and filtered only preloaded dreams | Server-side filtering, search and pagination |
| `MentionsInput` stored match strings instead of ids, buttons submitted the form, user search refetched on every render | Ids parsed from text, `type="button"`, stable callbacks |
| Expired token never handled | Global `401` handler logs the user out |
| Dark mode not persisted | Saved in `localStorage` (falls back to system preference) |
| Dream form did not await the save, navigated even on failure, no error display | Awaited, errors shown, double-submit prevented |

## Missing features, now added

- Edit dream page and delete dream button (`/dream/:id/edit`)
- `GET /dreams/:id` (deep links, private dreams of the owner)
- Delete comment (author or dream owner)
- Full-text search and tag/mood filters on the server
- Public profiles for other users, follow / unfollow, real follower counts
- Change password and delete account
- Server unit tests (`npm test`), `typecheck` script

## Refactoring

- Server: `app.js` factory, `config.js`, `utils/serialize.js`, `utils/validation.js`, central error handling, async handler, indexes.
- Client: `lib/api.ts` replaces eight copies of fetch + token boilerplate; `AuthContext` split from `AppContext`; memoized context values; `any` removed from date utils.
- Removed dead `mockData.ts` and the self-dependency `"dream-journal": "file:"` in `package.json`.
- API base URL is configurable through `VITE_API_URL`.

## Still open

- Rotate the leaked secrets (action required from you).
- Email verification and password reset (needs an email provider).
- Mention notifications.
- Session revocation / refresh tokens.
- React Query (or similar) instead of the hand-written dream store.
- HTTP-level integration tests (would need `mongodb-memory-server` or a test database).
- Existing MongoDB documents created by the old schema still carry the unused `dreamCount`, `followersCount`,
  `followingCount` fields and string avatar URLs from any host. They are ignored by the new code, but
  existing users with non-allow-listed avatars will be unable to save their profile until they pick one from the allowed hosts.
