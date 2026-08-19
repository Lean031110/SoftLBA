# Política de Seguridad — SoftLBA

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad de seguridad en SoftLBA:

1. **NO abras un Issue público** describiendo la vulnerabilidad.
2. Contacta al mantenedor directamente vía GitHub (mensaje privado).
3. Incluye: descripción del problema, pasos para reproducir, y
   sugerencia de fix si la tienes.

## Tiempo de respuesta

- Confirmación de recepción: 48 horas.
- Evaluación inicial: 7 días.
- Fix o mitigación: 30 días (dependiendo de severidad).

## Alcance

Esta política cubre:
- El código fuente del repositorio principal.
- Las APIs expuestas por el servidor.
- El servicio de realtime (Socket.IO).
- El Service Worker / PWA.

## Buenas prácticas para despliegue

- **NUNCA** subas `.env` al repositorio.
- Cambia `NEXTAUTH_SECRET` y `REALTIME_SECRET` en producción.
- Usa `COOKIE_SECURE=true` si tienes HTTPS.
- Configura `ALLOWED_ORIGINS` en el servicio realtime.
- Desactiva `DEMO_USERS` en producción.
