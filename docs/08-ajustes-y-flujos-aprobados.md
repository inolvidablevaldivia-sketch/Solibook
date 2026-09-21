# Ajustes y flujos aprobados — 20 septiembre 2026

## Etapa implementada: perfil y ajustes

- La foto de la cabecera abre «Mi perfil y ajustes».
- Nombre privado, foto comprimida, rol de solo lectura y estado de vinculación.
- El nombre privado NO sustituye `usuarios.nombre` ni se guarda en la lista compartida.
- `usuarios/{uid}/privado/ajustes`: alias, preferencias push por tipo y antelación.
- `usuarios/{uid}/privado/lecturas`: estado de lectura por identificador de aviso.
- Las reglas de estas subcolecciones permiten acceso solo al titular activo.
- Buscar actualización y cerrar sesión pasan a ajustes.
- Preferencias guardadas por cuenta; en modo local solo se guardan en este equipo.
- Activación/desactivación push por dispositivo, con errores visibles.
- El cron existente de cumpleaños respeta su preferencia. No cambia los avisos internos.
- Los avisos históricos se consideran no leídos para cada cuenta hasta que esa persona los lea. No se puede recuperar quién leyó antes, porque el estado antiguo era compartido.

### Despliegue y verificación

Publicar `firestore.rules` junto con esta versión. Sin esas reglas, la interfaz
muestra un error al cargar ajustes privados y no permite sobrescribirlos.
No se han publicado reglas ni desplegado Firebase desde esta sesión.

Comprobar con dos cuentas reales en un entorno de prueba:
1. A guarda alias y foto; B ve la foto, nunca el alias privado.
2. A lee una notificación; B la conserva sin leer.
3. A inicia sesión en otro dispositivo y ve sus ajustes y lecturas.
4. Bloquear permisos push: mostrar instrucciones sin confirmar activación.
5. Guardar sin conexión: no confirmar sincronización antes del acuse de Firestore.
6. Desactivar cumpleaños y ejecutar el cron con dispositivos de prueba.

## Estado del alcance aprobado

### Justificar — implementado en la segunda etapa

Inicio → Justificar. Cada integrante para sí; directiva para cualquier integrante
activo. Preselecciona el próximo evento futuro donde esté citado y que no tenga
una justificación pendiente/aprobada. Calendario mensual con selección de varios
eventos (hasta 20 por envío), motivo obligatorio y foto opcional comprimida.
Las fechas se muestran en horario de Chile. Cambiar la selección no edita la agenda.

- `/api/justificaciones` verifica token Firebase, cuenta activa, rol y vínculo.
- Lee ficha y convocatorias vigentes dentro de una transacción. Si algún evento
  es pasado, inexistente o no corresponde, se rechaza el lote entero.
- Cada actividad recibe su justificación pendiente y aviso interno atómicamente.
- No crea asistencia ni aprueba la justificación al enviarla. La resolución usa
  el flujo existente de Dirección/Secretaría/Desarrollador.
- IDs deterministas y verificación de registros anteriores evitan duplicados
  pendientes/aprobados al reintentar. Tras rechazo puede volver a enviarse; se
  renueva el registro de ese par integrante/evento y genera un aviso nuevo.
- La campanita muestra integrante, evento, fecha, motivo y foto para revisión.
- Miembros escuchan solo sus justificaciones mediante consulta filtrada; las
  reglas les permiten leerlas, nunca escribir ni resolver desde el cliente.
- Se cierra la creación directa de justificaciones en reglas. El método antiguo
  `agregarJustificacion` está sin consumidores y ya no debe usarse para altas.
- Sin conexión/modo local no se simula un envío exitoso. Se requiere Google y red.
- El push de justificaciones se completó en la cuarta etapa (guía 10).

Para producción, publicar las reglas actualizadas y configurar las mismas
variables `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` y
`FIREBASE_ADMIN_PRIVATE_KEY` que usa el cron de cumpleaños. El entorno de esta
sesión no tiene esas variables; no se probaron envíos contra Firebase real.

Pruebas: `npm run test:justificaciones` (9 pruebas de lógica y handler con
Firebase sustituido por un doble en memoria), TypeScript y build correctos.
El endpoint real rechaza sin token con HTTP 401. Las pruebas no sustituyen una
verificación del despliegue/reglas reales ni prueban concurrencia del emulador.

Revisión manual pendiente con dos cuentas de prueba:
1. Miembro vinculado: próxima actividad preseleccionada, selección multifecha,
   adjuntar/quitar foto, enviar y consultar Pendiente.
2. Directiva: cambiar de integrante y comprobar que cambia la convocatoria.
3. Dirección: ver foto y motivo en campanita, aprobar/rechazar y comprobar el
   estado en la cuenta solicitante y la asistencia con el flujo existente.
4. Reintentar el mismo envío: no generar otra solicitud pendiente ni otro aviso.
5. Cambiar/cancelar un evento antes de enviar: rechazar sin altas parciales.
6. Verificar que una cuenta no pueda consultar las justificaciones de otra.

### Calendario — implementado en la tercera etapa

Cron diario para hoy/mañana; push por tipo y antelación personal, convocatoria
validada para Miembros y bandeja interna privada independiente del push.
Ver `docs/09-recordatorios-calendario.md` para configuración, límites del horario
matinal, recuperación y pruebas. Aún no hay avisos inmediatos por crear/cambiar/cancelar actividades. El push de
correspondencia/justificaciones/actas se completó en la cuarta etapa.

### Eliminación — implementada en la cuarta etapa

Pulsación larga, solicitudes, doble firma, rechazo/cancelación, bloqueo, historial,
excepciones y push. Se cerraron los borrados directos en reglas. Ver la guía 10
para los detalles, las pruebas y la verificación pendiente de reglas/despliegue.

### Cierre de otros ajustes

Acuses nuevos usan la identidad oficial de la cuenta. Las firmas de edición de
actas quedaron ligadas al cargo real. Push de correspondencia, justificaciones,
edición de actas y eliminaciones conectado con la cola y preferencias personales.
La guía 10 contiene el estado consolidado más reciente.

## Validaciones de esta etapa

- `npx tsc --noEmit`: correcto.
- `npm run build`: compilación de producción correcta.
- ESLint de los componentes nuevos y puntos de integración: sin errores;
  quedan advertencias de `<img>` para las fotos, como en el código existente.
- Lint global: 7 errores en patrones ya existentes de VistaAsistencia,
  AppContext y AuthContext; no se modificaron esos bloques en esta etapa.
- Vista previa de desarrollo: responde HTTP 200.
- No se pudo realizar la prueba automatizada de navegador: la descarga de
  Chromium falló con ECONNRESET. No se han validado visualmente los flujos ni
  probado el envío real a FCM ni reglas con cuentas de producción.
