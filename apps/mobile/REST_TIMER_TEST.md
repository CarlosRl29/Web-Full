# Rest Timer – How to Test

## Requisitos

- Dispositivo físico (iOS o Android) con Expo Go instalado.
- Rutas con espacios: usar comillas en PowerShell.

## Comandos (PowerShell)

```powershell
# Desde la raíz del monorepo
cd "c:\dev\full app gym"

# Arrancar Expo (evitar workspace root como projectRoot)
$env:EXPO_USE_METRO_WORKSPACE_ROOT = "0"
npm run start -w apps/mobile -- --clear
```

Alternativa desde `apps/mobile`:

```powershell
cd "c:\dev\full app gym\apps\mobile"
$env:EXPO_USE_METRO_WORKSPACE_ROOT = "0"
npx expo start --clear
```

## Test en Foreground

1. Abre la app en Expo Go.
2. Inicia una sesión guiada y completa un set para activar el Rest Timer.
3. Comprueba:
   - Contador regresivo **mm:ss** estable (sin saltos).
   - **Skip**: termina de inmediato, suena mp3, vibra, cierra el descanso.
   - **+15s**: suma 15 segundos y reprograma la notificación.
4. Deja que llegue a 0:
   - Suena el mp3 local.
   - Vibra.
   - Se cierra el descanso y se muestra el siguiente ejercicio.

## Test en Background

1. Con el Rest Timer activo (p. ej. 30 s), bloquea el teléfono o cambia a otra app.
2. Espera a que termine el tiempo.
3. Comprueba:
   - **iOS**: Notificación con sonido por defecto del sistema.
   - **Android**: Notificación en canal "Rest Timer" con sonido por defecto.

## Criterios de éxito

- Cronómetro estable (mm:ss).
- Skip y +15s funcionan correctamente.
- Foreground: mp3 + vibración al terminar.
- Background: notificación al finalizar (iOS sonido default en Expo Go; Android con canal configurado).
