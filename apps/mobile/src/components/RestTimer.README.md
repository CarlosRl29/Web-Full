# RestTimer

Cronómetro regresivo para descansos en modo entrenamiento guiado. Compatible con Expo SDK 54 (Expo Go) en iOS y Android.

## Comportamiento

- **Foreground**: Al llegar a 0 → sonido (expo-av, mp3 local) + vibración + `onDone` (una sola vez vía `completedRef`).
- **Background**: Depende de `expo-notifications`. Al llegar a `endAt` se muestra notificación local.

## iOS en Expo Go

> **Limitación**: En Expo Go, el sonido de la notificación local es siempre el **sonido por defecto del sistema**. No se usa el mp3 personalizado (`rest-done.mp3`). El sonido custom solo se reproduce cuando la app está en foreground (expo-av).

Para sonido custom en notificaciones en background, se requiere un development build con el plugin configurado.

## Android

- Canal `rest-timer` con importancia alta (`AndroidImportance.HIGH`) y sonido por defecto.
- `setNotificationChannelAsync` se ejecuta antes de programar la notificación.
- `channelId` se pasa en el trigger para Android 8.0+.

## Robustez

- Cancelar notificación programada en unmount y al presionar Skip.
- Al +15s: reprogramar con el mismo `NOTIFICATION_ID` (cancelar antes de programar).
- Evitar drift: `remaining` siempre calculado desde `endAtRef.current`.
- `completedRef` evita múltiples ejecuciones de `onDone` y bloquea +15s tras completar.

---

## How to test

### Foreground

1. Iniciar un entrenamiento guiado que incluya descanso.
2. Verificar que el cronómetro muestra `mm:ss` correctamente.
3. Esperar a que llegue a 0 → debe sonar el mp3, vibrar y ejecutar `onDone` una sola vez.
4. Probar **Skip** → debe cancelar la notificación, sonar, vibrar y ejecutar `onDone`.
5. Probar **+15s** → debe añadir 15 segundos y reprogramar la notificación; el display se actualiza sin drift.

### Background

1. Iniciar descanso (ej. 30 s).
2. Poner la app en background (Home o cambiar de app).
3. Esperar a que termine el tiempo.
4. **iOS (Expo Go)**: Notificación con sonido por defecto del sistema.
5. **Android**: Notificación en canal `rest-timer` con sonido y vibración configurados.

### Comandos PowerShell (rutas con espacios)

```powershell
# Navegar al proyecto (usar comillas para rutas con espacios)
cd "c:\dev\full app gym"

# Instalar dependencias
npm install

# Iniciar Expo desde la raíz del monorepo
npm run dev:mobile

# O con expo directamente
npx expo start -w apps/mobile

# Android
npx expo start -w apps/mobile --android

# iOS (requiere Mac)
npx expo start -w apps/mobile --ios
```
