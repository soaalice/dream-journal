# REST API

Base URL: `http://localhost:5000/api`. All bodies are JSON. The session is an httpOnly cookie named
`token` (a `Authorization: Bearer <jwt>` header is also accepted for non-browser clients). Browsers must
send requests with `credentials: 'include'` from `CLIENT_ORIGIN`.

## Conventions

- Validation failure → `400 { "message": "Validation failed", "errors": [{ "path", "message" }] }`
- Not authenticated / expired session → `401`
- Not allowed → `403`; resource missing **or not visible to you** → `404`
- Duplicate → `409`; rate limited → `429`; unexpected → `500 { "message": "Internal server error" }`
- Ids are 24-char hex strings; anything else → `400`.
- Unknown JSON fields are ignored (never mass-assigned).

## Auth

| Method | Path | Auth | Body | Result |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | – | `name` (2-50), `email`, `password`, `avatarUrl?` | `201 { user }` + session cookie |
| POST | `/auth/login` | – | `email`, `password` | `200 { user }` + session cookie |
| POST | `/auth/logout` | – | – | clears the cookie |
| GET | `/auth/me` | yes | – | `{ user }` |

Password rule: 8-72 characters, at least one letter and one digit.
`avatarUrl` must be `https` and its host must be in `AVATAR_HOSTS`.
`register`/`login` are limited to 20 attempts / 15 min / IP.

## Dreams

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/dreams/feed` | optional | Public + anonymous dreams. Query: `page`, `limit` (1-50), `tag` and `mood` (comma-separated, OR), `q` (text search). Returns `{ dreams, page, limit, total, hasMore }` |
| GET | `/dreams/user/:userId` | yes | Your own dreams (all levels, optional `privacyLevel`), or only the `public` dreams of someone else |
| GET | `/dreams/:id` | optional | One dream, if you may see it |
| POST | `/dreams` | yes | `title` (≤120), `content` (10-10000), `privacyLevel`, `mood`, `tags?` (≤10, ≤30 chars), `mentions?` (≤20 user ids) |
| PUT | `/dreams/:id` | owner | Same fields, all optional, at least one |
| DELETE | `/dreams/:id` | owner | |
| POST | `/dreams/:id/like` | yes | Atomic toggle. Returns the updated dream |
| POST | `/dreams/:id/comments` | yes | `content` (1-1000), `mentions?`. Returns the updated dream |
| DELETE | `/dreams/:id/comments/:commentId` | comment author or dream owner | Returns the updated dream |

Moods: `happy sad scary confusing exciting peaceful anxious mysterious`.

## Users (all require auth)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/users/search?q=` | Name autocomplete for @mentions (min 2 chars, max 10 results; never matches or returns email) |
| GET | `/users/:id` | Public profile with `dreamCount`, `followersCount`, `followingCount`, `isFollowing`. `email` only for yourself. `dreamCount` of others counts public dreams only |
| PUT | `/users/profile` | `name`, `bio` (≤160), `location` (≤100), `website` (http/https), `avatarUrl?` |
| PUT | `/users/password` | `currentPassword`, `newPassword` |
| DELETE | `/users/me` | `password`. Deletes the account, its dreams, comments, likes, mentions and follow links |
| POST | `/users/:id/follow` | Toggle follow (not yourself) |

## Privacy matrix

| Dream level | Anyone logged out | Any logged-in user | Author |
| --- | --- | --- | --- |
| `public` | read, author shown | read/like/comment, author shown | everything |
| `anonymous` | read, **author hidden** | read/like/comment, **author hidden**, not listed on the author's profile | everything, author shown |
| `private` | 404 | 404 | everything |
