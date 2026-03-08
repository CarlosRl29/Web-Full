# AXION v2 – Railway Deployment (API + Postgres + Web)

Deploy the backend API first (mobile testing depends on it), then optionally the web app.

**Important**: Use branch `axion-v2-clean` for production. Do not use `main` – set it per service in Settings → Source → Branch.

## 1. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in.
2. **New Project** → **Deploy from GitHub repo**.
3. Select your repo (`Web-Full` or similar).
4. For each service: **Settings** → **Source** → **Branch** → set to `axion-v2-clean`.

## 2. Add Postgres

1. In the project, click **+ New** → **Database** → **PostgreSQL**.
2. Railway creates a Postgres service and sets `DATABASE_URL` automatically when you link it.

## 3. Configure API Service (deploy this first)

1. Click your **API service** (the one from GitHub).
2. **Settings** → **Source** → **Branch**: `axion-v2-clean`.
3. **Settings** → **Service**:
   - **Root Directory**: leave **empty** (monorepo root `/`). Do not use `/apps/api`.
   - **Build Command**: (uses `nixpacks.toml`) – no override needed.
   - **Start Command**: (uses `nixpacks.toml`) – no override needed.
3. **Variables** → add/link:
   - `DATABASE_URL`: from Postgres (link the Postgres service, or copy the variable).
   - `JWT_ACCESS_SECRET`: generate a strong secret, e.g. `openssl rand -base64 32`.
   - `JWT_REFRESH_SECRET`: another strong secret (different from access secret).
4. **Settings** → **Networking** → **Generate Domain** to get a public URL like `https://xxx.up.railway.app`.

## 4. Link Postgres to API

1. Open the API service.
2. **Variables** → **Add Variable** → **Add Reference**.
3. Select the Postgres service → `DATABASE_URL`.
4. Railway will inject the connection string.

## 5. Run Migrations & Seed (first deploy)

After the first successful deploy:

1. **Settings** → open a **Shell** or use Railway CLI.
2. Or run locally with `DATABASE_URL` from Railway:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate:deploy -w @gym/api
   DATABASE_URL="postgresql://..." SEED_ADMIN_EMAIL=admin@yourdomain.com SEED_ADMIN_PASSWORD=YourStrongPassword npm run db:seed -w @gym/api
   ```

The `deploy:api` script runs `db:migrate:deploy` before `start`, so migrations run on every deploy.

## 6. Verify API

- **Health**: `https://YOUR-RAILWAY-URL/api/health` → `{"success":true,"data":{"status":"ok","db":"connected"}}`
- **Exercises** (public): `https://YOUR-RAILWAY-URL/api/exercises?limit=5`

## 7. (Optional) Deploy Web Service

Web depends on `packages/shared`, so it must build from the monorepo root.

1. **+ New** → **GitHub Repo** → same repo, same project.
2. **Settings** → **Source** → **Branch**: `axion-v2-clean`.
3. **Variables** → add `DEPLOY_TARGET` = `web` (required – tells nixpacks to run build:web/start:web instead of API).
4. **Variables** → add `NEXT_PUBLIC_API_URL` = `https://YOUR-API-RAILWAY-URL/api` (your API service domain). Required at build time.
5. **Settings** → **Service**:
   - **Root Directory**: leave **empty** (monorepo root). Do **not** use `/apps/web` – web needs `packages/*`.
   - Build/Start use nixpacks.toml (no overrides needed when `DEPLOY_TARGET=web`).
6. **Settings** → **Networking** → **Generate Domain**.

## 8. Update Mobile App

Create or update `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://YOUR-RAILWAY-URL/api
```

Rebuild/restart the Expo app so it uses the new API URL.

## Environment Variables Summary

| Variable             | Required | Source                          |
|----------------------|----------|----------------------------------|
| `DATABASE_URL`       | Yes      | Railway Postgres (link service)  |
| `JWT_ACCESS_SECRET`  | Yes      | Generate (e.g. `openssl rand -base64 32`) |
| `JWT_REFRESH_SECRET` | Yes      | Generate (different from access) |
| `PORT`             | No       | Set by Railway                  |
| `SEED_ADMIN_EMAIL` | No*      | Only for manual seed in prod    |
| `SEED_ADMIN_PASSWORD` | No*   | Only for manual seed in prod    |

\* Do not use default `admin@gym.local` / `Admin1234` in production. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` when running seed.

## Troubleshooting

- **Build fails**: Ensure `npm ci` works at monorepo root. Check `packages/shared` builds before `apps/api`.
- **DB connection fails**: Verify `DATABASE_URL` is linked from Postgres. Railway Postgres uses SSL; Prisma handles it.
- **502 Bad Gateway**: Check logs. Often the app crashes on startup (e.g. missing env vars).
- **FATAL: In production, set JWT_ACCESS_SECRET...**: Add `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in Railway Variables. Generate with `openssl rand -base64 32`.
- **Web build fails / wrong branch**: Ensure branch is `axion-v2-clean`, Root Directory is empty, and `DEPLOY_TARGET=web` is set for the Web service.
- **Web runs build:api**: Set `DEPLOY_TARGET=web` in the Web service Variables.
