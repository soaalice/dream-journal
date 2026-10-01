# Architecture

## Layout

```
server/
  index.js            entry: load config, connect to MongoDB, listen, graceful shutdown
  app.js              createApp(config): middleware stack and routers (testable, no side effects)
  config.js           env loading and validation (fail fast)
  middleware/
    auth.js           JWT cookie helpers, authenticate / optionalAuth, CSRF origin guard
    errorHandler.js   single place that maps errors to HTTP responses
  models/             Mongoose schemas: User, Dream (comments are embedded)
  routes/             auth.js, dreams.js, users.js
  utils/
    validation.js     zod schemas + validate() middleware + escapeRegex
    serialize.js      privacy-aware serialization (the only way dreams leave the server)
    asyncHandler.js   async route wrapper and HttpError
  test/               node:test unit tests
src/
  lib/api.ts          the only place that calls fetch (base URL, cookies, errors, 401 handling)
  context/
    AuthContext.tsx   session: login, register, logout, profile, password, account deletion
    AppContext.tsx    dreams store, theme, dream/comment/follow actions; useApp() = auth + app
  pages/, components/ UI
  types/              shared client types (mirror the serialized API shapes)
```

## Request flow

1. `helmet`, `cors` (single origin, credentials), JSON body limit (50 kb), `cookie-parser`.
2. `originGuard` rejects state-changing requests whose `Origin` is not `CLIENT_ORIGIN`.
3. Global rate limit (600 req / 15 min / IP) and a stricter one (20 / 15 min) on login, register,
   password change and account deletion.
4. Router → `validate(schema)` (zod, unknown fields stripped) → `authenticate` / `optionalAuth` → handler.
5. Handlers never return Mongoose documents directly. They call `serializeDream` / `serializeUser`,
   which apply the viewer-dependent privacy rules.
6. Errors flow to `errorHandler`; 5xx responses never include internals.

## Data model

**User**: `name`, `email` (unique, lowercase), `password` (bcrypt cost 12, `select: false`), `bio`,
`location`, `website`, `avatarUrl`, `following[]`, `joinedAt`.
Dream count, followers count and following count are **computed**, not stored, so they cannot drift.

**Dream**: `title`, `content`, `userId`, `privacyLevel` (`public` | `private` | `anonymous`),
`tags[]`, `mood`, `likes[]` (user ids), `comments[]` (embedded: `content`, `userId`, `mentions[]`),
`mentions[]`. Indexes: text (title/content/tags), `(privacyLevel, createdAt)`, `(userId, createdAt)`, `tags`.

## Serialized dream (what the client receives)

```jsonc
{
  "_id": "...", "title": "...", "content": "...", "createdAt": "...", "updatedAt": "...",
  "userId": { "_id": "...", "name": "...", "avatarUrl": "..." },  // null if anonymous and viewer is not the author
  "userName": "Alice",                                            // "Anonymous" when hidden
  "isOwner": false,
  "privacyLevel": "public",
  "tags": ["sea"], "mood": "peaceful", "mentions": ["<userId>"],
  "likesCount": 3, "likedByMe": true,                             // the list of likers is never exposed
  "comments": [{ "_id": "...", "content": "...", "userId": "...|null", "userName": "...",
                 "userAvatar": "...", "createdAt": "...", "mentions": [], "canDelete": true }]
}
```

## Client design

- **Session** is an httpOnly cookie. The client holds only the `user` object in memory and
  restores it on load through `GET /auth/me`. Nothing sensitive is in `localStorage`
  (only the light/dark theme preference).
- **`lib/api.ts`** sends `credentials: 'include'`, parses errors into `ApiError`, and calls a
  registered handler on `401` so an expired session logs the user out everywhere.
- **`AppContext`** keeps dreams in a map keyed by id, so a like/comment response replaces the
  dream in place. The store is reset and reloaded when the signed-in user changes (so `likedByMe`
  and `isOwner` are always correct for the current viewer).
- **Explore** filters, searches (Mongo text search) and paginates on the server.
- **Detail / edit pages** fetch their dream by id (`GET /dreams/:id`), so deep links and private
  dreams work even when the dream is not in the preloaded feed.

## Known limits / future work

- No notifications for mentions (they are stored and validated, nothing is sent).
- No email verification or password reset (needs an email provider).
- Counts are computed with `countDocuments`; cache them if profile views become hot.
- A data-fetching library such as React Query would replace the hand-rolled store in `AppContext`.
- No refresh tokens: sessions last 7 days and are not revocable server-side except by deleting the account.
