# Getting started

## Requirements

- Node.js 20+
- A MongoDB instance (local or Atlas)

## Install

```bash
npm install
```

## Configure

Backend – copy `.env.example` to `.env` and fill it in:

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | At least 32 random characters. The server refuses to start otherwise |
| `PORT` | no | API port, default `5000` |
| `CLIENT_ORIGIN` | no | Exact frontend origin, default `http://localhost:5173`. Used for CORS **and** the CSRF origin check |
| `TRUST_PROXY` | no | `true` when behind a reverse proxy, so rate limiting sees real client IPs |
| `AVATAR_HOSTS` | no | Comma-separated hosts allowed in avatar URLs, default `api.dicebear.com` |
| `NODE_ENV` | no | `production` turns on `Secure` cookies |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Frontend – optional, copy `.env.local.example` to `.env.local`:

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | API base URL, default `http://localhost:5000/api` |

> `.env` is git-ignored. Never commit it. See [security.md](security.md#secrets) if a secret was ever committed.

## Run

```bash
npm run dev:all     # Vite on :5173 + API on :5000
npm run dev         # frontend only
npm run server      # API only
```

## Quality checks

```bash
npm test            # server unit tests (node:test, no database needed)
npm run typecheck   # TypeScript, client
npm run lint        # ESLint
npm run build       # production build of the client
```

The tests cover the privacy rules (who can see which dream, anonymity), input validation, config
fail-fast, and the CSRF origin guard. They do not need MongoDB.
