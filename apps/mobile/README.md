# Mobile Core Loop (Sprint 1.6)

## Flujo soportado

- Login real (`/auth/login`) con persistencia de tokens JWT en `AsyncStorage`.
- Rutinas reales (`/routines`) y PreStart real (`/workout-sessions/start`).
- Guided desde snapshot real de sesion activa.
- Progress con `event_id` por evento y cola offline persistente.
- Observabilidad fina por evento: `pending`, `sending`, `acked`, `failed`.

## Configuracion

Crear `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://<IP_DE_MI_PC>:3001/api
```

## Idempotencia de progress

- Cada PATCH de progreso incluye `event_id` (uuid v4 generado en mobile).
- Backend persiste eventos en `WorkoutProcessedEvent` por sesion activa.
- Si llega un `event_id` repetido, devuelve snapshot actual sin reaplicar cambios.

## Observabilidad en UI

- Badge en Guided: `Online/Offline`.
- Badge en Guided: `Pendientes: N` (solo `pending + failed`).
- Header global: `Online/Offline` + `Pendientes: N`.
- Solo en `__DEV__`:
  - `Forzar sync`
  - `Reintentar failed`
  - `Ver cola` (modal con status, attempts y last_error)

## Sync engine por evento

Cada evento guarda:

- `status`: `pending | sending | acked | failed`
- `attempts`
- `last_error`
- `updated_at`

Backoff incremental al fallar envio:

- 1s, 2s, 5s, 10s, 30s (max)
- Si falla, queda `failed` y se reintenta:
  - automaticamente al reconectar
  - periodicamente cuando hay red y vence backoff
  - manualmente con `Forzar sync` o `Reintentar failed` (dev)

## Reanudar sesion

Al abrir app:

1. Si hay `activeSession` local -> Guided directo.
2. Si no hay local pero API tiene `ACTIVE` -> descarga snapshot y continua.
3. Conflicto local vs API:
   - Si hay pendientes u offline: se prioriza local.
   - Al reconectar y sin pendientes: se reconcilia con snapshot remoto.

## Pruebas manuales (modo avion)

### 1) Flujo base online

1. Login en mobile.
2. Seleccionar rutina/dia.
3. PreStart -> Iniciar sesion.
4. Completar 2-3 sets y validar que `Pendientes: 0`.

### 2) Offline queue robusta

1. Iniciar sesion guiada con internet.
2. Activar modo avion en el telefono.
3. Completar varios sets y cambios de pointer.
4. Validar que eventos nuevos quedan `pending` y `Pendientes: N` aumenta.
5. Desactivar modo avion.
6. Esperar auto-sync o tocar `Forzar sync` (dev).
7. Validar transicion `sending -> acked` y luego `Pendientes: 0`.
8. Validar progreso consistente en backend.

### 3) Falla de servidor (500) y recuperacion

1. Con internet activo, forzar error 500 en `/workout-sessions/progress`.
2. Completar sets en Guided.
3. Abrir `Ver cola` y validar `failed`, `attempts` creciendo y `last_error`.
4. Arreglar server.
5. Tocar `Reintentar failed` o `Forzar sync`.
6. Validar `sending -> acked` y cola vacia.

## Contratos listos para mobile parity (User Portal + Marketplace)

Los siguientes endpoints ya quedan disponibles para consumo mobile:

- `GET /routines/owned`: rutinas propias del usuario.
- `GET /routines/assigned`: rutinas asignadas activas (solo lectura).
- `GET /routines/active` y `PATCH /routines/active`: leer/cambiar rutina activa de entrenamiento.
- `GET /routines/marketplace` y `GET /routines/marketplace/:id`: explorar marketplace.
- `POST /routines/:id/clone`: clonar rutina publica a la cuenta del usuario.
- `POST /routines/:id/reviews`: rating (1-5) + review corta.
- `POST /routines/:id/follow`: seguir al coach autor de una rutina publica.
