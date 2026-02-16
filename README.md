# Gym Platform Monorepo (MVP Core Loop)

Monorepo escalable para plataforma de gym con:

- `apps/mobile`: React Native Expo + TypeScript (modo entrenamiento guiado).
- `apps/web`: Next.js + TypeScript (base usuarios/coaches).
- `apps/api`: NestJS + TypeScript + Prisma + PostgreSQL.
- `packages/shared`: tipos y esquemas Zod compartidos.

## 1) Estructura

```txt
.
├─ apps/
│  ├─ api/
│  ├─ mobile/
│  └─ web/
├─ packages/
│  └─ shared/
├─ docker-compose.yml
└─ README.md
```

## 2) Requisitos

- Node.js 20+
- npm 10+
- Docker + Docker Compose

## 3) Configuracion local

1. Copia variables de entorno:

```bash
cp .env.example .env
```

2. Instala dependencias del monorepo:

```bash
npm install
```

3. Levanta PostgreSQL con Docker:

```bash
docker compose up -d postgres
```

4. Genera cliente Prisma, migra y siembra data:

```bash
npm run db:generate -w apps/api
npm run db:migrate -w apps/api
npm run db:seed -w apps/api
```

## 4) Ejecutar servicios

### API (NestJS)

```bash
npm run dev:api
```

- URL: `http://localhost:3001/api`
- Endpoints Sprint 1:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `GET /api/auth/me`
  - `GET /api/exercises`
  - `GET /api/exercises/:id`
  - `POST /api/exercises` (ADMIN)
  - `GET /api/routines`
  - `GET /api/routines/:id`
  - `POST /api/routines`
  - `PATCH /api/routines/:id`
  - `DELETE /api/routines/:id`
  - `POST /api/workout-sessions/start`
  - `GET /api/workout-sessions/active`
  - `PATCH /api/workout-sessions/progress`
  - `POST /api/workout-sessions/finish`

### Mobile (Expo)

```bash
npm run dev:mobile
```

Variables recomendadas para mobile (`apps/mobile/.env`):

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001/api
EXPO_PUBLIC_ACCESS_TOKEN=<jwt_access_token>
```

Flujo Sprint 1:

- Pantalla `Pre-Start` con overrides de descanso por sesion:
  - `rest_between_exercises_seconds`
  - `rest_after_round_seconds`
  - `rest_after_set_seconds`
- Pantalla de entrenamiento guiado con:
  - un ejercicio enfocado a la vez
  - conteos `ejercicio X/Y`, `ronda`, `set`
  - registro rapido de sets (+/-) y autosave
  - descansos inline (`Transicion` y `Descanso`) con `Skip` y `+15s`
- Reanudacion por `current_pointer`
- Persistencia local offline-first + cola de sync al volver internet

### Web (Next.js)

```bash
npm run dev:web
```

## 5) Ejecutar todo con Docker (Postgres + API)

```bash
docker compose up --build
```

Esto levanta:

- `postgres` en `localhost:5432`
- `api` en `localhost:3001`

## 6) Tests minimos

Se incluyen tests de:

- Auth (`apps/api/test/auth.service.spec.ts`)
- Start session (`apps/api/test/workout-sessions.service.spec.ts`)

Ejecutar:

```bash
npm run test -w apps/api
```

## 7) Notas de arquitectura y validacion

- Validaciones de payload:
  - `packages/shared` define schemas Zod consumidos por API/mobile/web.
  - API usa `ZodValidationPipe` para DTO validation.
- Respuesta consistente:
  - éxito: `{ success: true, data: ... }`
  - error: `{ success: false, error: ... }`
- RBAC:
  - Roles `USER`, `COACH`, `ADMIN`
  - creación de ejercicios restringida a `ADMIN`.

## 8) Usuario admin seed

- Email: `admin@gym.local`
- Password: `Admin1234`

## 9) Sprints implementados

- Sprint 0:
  - monorepo base + `shared` + Docker + PostgreSQL
- Sprint 1:
  - API con auth/routines/exercises/workout sessions
  - mobile guided training loop con pre-start y offline-first local
