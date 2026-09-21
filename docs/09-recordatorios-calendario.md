# Recordatorios del calendario

## Qué incluye

- Todos los tipos de evento, incluidos los personalizados.
- Director, Secretaría, Tesorero, Directiva y Desarrollador: todo el calendario.
- Miembro: ficha activa vinculada y convocatoria Todos / Por Cuerda / Personalizada.
- Cuenta suspendida o rol desconocido: sin entrega.
- Preferencias por tipo y día anterior / mismo día / ambos aplicadas solo al push.
- Avisos internos siempre, incluso con push desactivado o sin teléfono registrado.
- Bandeja privada `usuarios/{uid}/avisos/{id}`, lectura solo del titular; escritura
  exclusiva del servidor. La bandeja se combina con los avisos anteriores en la
  campanita, con filtro Calendario y botón para abrir Agenda.
- Push con la app cerrada y también en primer plano mediante el service worker.
  Al tocarlo se abre Agenda. FCM muestra los mensajes de fondo una sola vez.

## Programación y límites reales

`vercel.json` agrega `GET /api/cron/calendario` a las **12:00 UTC cada día**,
además del cron existente de cumpleaños. Son las 08:00 de Chile continental en
invierno y las 09:00 en verano. Cada pasada revisa los días civiles de hoy y
mañana en `America/Santiago`; no calcula el día anterior restando 24 horas.

La documentación oficial consultada el 20-09-2026 permite un cron diario en
Hobby, con ejecución dentro de la hora programada (no garantiza el minuto):
https://vercel.com/docs/cron-jobs/usage-and-pricing

**No es una alarma de hora exacta.** Los eventos que ya comenzaron se omiten.
Una actividad anterior a la pasada matinal no tendrá push del mismo día. Con la
preferencia «ambos» o «día anterior», puede recibir el aviso de la jornada previa.
Un evento creado después de la pasada y que ocurra antes de la siguiente puede
no generar recordatorio. Esto también aplica a su aviso interno generado por cron.

Para cubrir actividades tempranas o recién creadas, configurar un programador
con más frecuencia que invoque esta misma ruta con el secreto:
- En Vercel Pro, reemplazar el cron diario por, por ejemplo, `*/15 * * * *`.
- O usar un programador HTTPS externo confiable con esa frecuencia.
No habilitar una expresión de 15 minutos en Hobby: el despliegue la rechaza.
Un cron frecuente usa la misma deduplicación (no reenvía cada 15 minutos), pero
puede generar avisos desde el comienzo del día chileno. No hay aún horas de silencio.
Incluso así, ninguna entrega push puede garantizar recepción puntual en un teléfono
sin red, sin permisos o restringido por su sistema operativo.

Esta etapa implementa recordatorios; **no** avisos inmediatos de creación,
cambio o cancelación. Las actividades se revalidan antes de generar el aviso y
antes del envío. El historial conserva avisos ya generados; no se retira del
sistema operativo un push ya entregado si después cambia el evento.

## Configuración para desplegar

1. Publicar las reglas actualizadas de `firestore.rules` para permitir al titular
   leer `/usuarios/{uid}/avisos/*` sin abrir la bandeja a otras cuentas.
2. Variables de servidor: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
   `FIREBASE_ADMIN_PRIVATE_KEY` y `CRON_SECRET`. Son las mismas del cron existente.
3. Opcional `APP_URL`: origen HTTPS público. Por defecto `https://solibook.vercel.app`.
   No se toma el origen del header Host del visitante.
4. Variable pública `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, configuración FCM y permisos
   del navegador. Activar avisos desde Ajustes en cada dispositivo.
5. Desplegar en producción (el cron de Vercel no se ejecuta en la vista previa).
6. Ejecutar una prueba con cuentas de Director y Miembro vinculadas, y revisar
   la respuesta/log del cron y la campanita con push encendido y apagado.

Nunca poner CRON_SECRET en código del navegador ni en la URL. La ruta exige
`Authorization: Bearer <CRON_SECRET>` y rechaza sin acceder a Firebase si falta
el secreto o no coincide. No se publicaron reglas ni se desplegó desde esta sesión.

## Recuperación, reintentos y costos

- Avisos internos con ID determinista por cuenta, evento, fecha/hora y ventana.
  Reejecutar no los duplica ni cambia el estado personal de leído.
- `envios_calendario/{hash}` registra cada dispositivo sin exponer tokens en IDs.
  No tiene acceso cliente (candado final de reglas). Reserva transaccional de
  5 minutos para coordinar ejecuciones concurrentes.
- FCM en lotes de máximo 500. Confirmados no se reenvían; fallos temporales
  vuelven a pendiente; tokens inválidos se retiran sin borrar uno ya renovado.
- TTL del push limitado al inicio del evento, para no entregar un recordatorio
  después de la actividad por reconectar tarde.
- Respuesta 503 si hubo fallos temporales o se agotó el presupuesto de trabajo.
  Vercel no proporciona aquí un bucle de reintentos implementado por la app:
  volver a invocar con autorización durante la misma ventana del recordatorio.
  Una reserva de un proceso interrumpido necesita 5 minutos para caducar.
- No se promete entrega exactamente una vez: si FCM acepta un envío y el
  proceso cae antes de guardar la confirmación, un reintento puede repetirlo.
  El tag estable ayuda a reemplazar el aviso en el teléfono.
- Esta versión lee las listas completas de eventos, usuarios activos, fichas y
  dispositivos una vez por ejecución. Para volúmenes grandes, migrar a una cola
  paginada antes de aumentar la frecuencia indiscriminadamente.
- Los avisos/controles conservan historial; no se ha añadido limpieza automática.

## Validación de esta sesión

- `npm run test:calendario`: 17 pruebas (lógica, servicio con dobles en memoria,
  autorización del endpoint y comportamiento del service worker).
- Incluye convocatoria, preferencias, fechas Chile/DST, ausencia de dispositivos,
  reintentos, concurrencia simulada, fallos parciales, reservas caducadas, tokens
  inválidos/renovados, lotes de 500 y navegación segura al tocar un aviso.
- `npm run test:justificaciones`: 9 pruebas previas, sin regresiones.
- `npx tsc --noEmit` y `npm run build`: correctos.
- No se probó entrega FCM real ni reglas con emulador/cuentas reales. Las pruebas
  con dobles no sustituyen esa verificación ni un ensayo de concurrencia real.

## Actualización posterior

La guía 10 completa la cola push de correspondencia, justificaciones, edición
de actas y eliminaciones. Se mantiene la programación y los límites del calendario
descritos aquí.
