# LiveDocs

A simplified Google Docs-like application with real-time collaboration.

## Environment variables (required for public hosting)

All secrets and deployment URLs must be set via environment variables. **Never commit `.env` files.**

### Backend (`Back-end/.env` or host dashboard)

Copy from `Back-end/.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `ATLAS_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Auth token secret (32+ characters in production) |
| `CORS_ORIGIN` | Yes (prod) | Frontend URL, e.g. `https://your-user.github.io` |
| `PORT` | No | Server port (default `5000`, Render sets this) |
| `JWT_EXPIRES_IN` | No | Token expiry (default `7d`) |
| `NODE_ENV` | No | Set `production` on Render |
| `ADMIN_EMAILS` | No | Comma-separated admin emails |
| `ADMIN_SEED_ON_STARTUP` | No | `true` to sync admin password on boot (dev only recommended) |
| `ADMIN_PASSWORD` | If seeding | Admin password when seed is enabled |

### Frontend (build-time — `Front-end/.env.production` or CI)

Copy from `Front-end/.env.production.example`:

| Variable | Required (prod) | Description |
|----------|-----------------|-------------|
| `REACT_APP_API_BASE_URL` | Yes | Backend API URL |
| `REACT_APP_SOCKET_URL` | Yes | WebSocket URL (usually same as API) |

For local development, use `Front-end/.env.local` (see `Front-end/.env.example`).

## Local development

```bash
# Backend
cd Back-end
cp .env.example .env
# Edit .env with your MongoDB URI and secrets
npm install
npm start

# Frontend (separate terminal)
cd Front-end
cp .env.example .env.local
npm install
npm start
```

## Deploying publicly

### Backend (e.g. Render)

1. Create a Web Service from the `Back-end` folder.
2. Set environment variables in the Render dashboard (not in code):
   - `NODE_ENV=production`
   - `ATLAS_URI`
   - `JWT_SECRET` (generate a long random string)
   - `CORS_ORIGIN=https://<your-github-username>.github.io`
   - `ADMIN_EMAILS=your@email.com`
3. Do **not** set `ADMIN_SEED_ON_STARTUP=true` in production unless you need one-time bootstrap.

### Frontend (e.g. GitHub Pages)

1. Copy `Front-end/.env.production.example` to `.env.production`.
2. Set `REACT_APP_API_BASE_URL` and `REACT_APP_SOCKET_URL` to your Render backend URL.
3. Build: `npm run build`
4. Deploy the `build` folder to GitHub Pages.

Or set `REACT_APP_*` variables in GitHub Actions secrets for CI builds.

## Security notes

- Passwords are bcrypt-hashed; admins cannot view user passwords, only reset them.
- `.env` files are gitignored — rotate credentials if they were ever committed.
- Production rejects weak `JWT_SECRET` and wildcard `CORS_ORIGIN`.
