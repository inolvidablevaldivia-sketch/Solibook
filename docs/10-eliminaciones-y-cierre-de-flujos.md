# Eliminaciones autorizadas y cierre de flujos

## Experiencia implementada

- Cartas, actas y documentos: mantener presionado abre **Eliminar**. También
  hay un menú «…» accesible con teclado. En Miembros se reutiliza el menú ya
  existente y el botón de la tabla; ambos llaman al mismo circuito autorizado.
- La solicitud de Director/Secretario cuenta como su firma. Un solicitante de
  otro cargo permitido no aporta firma y requiere que ambos cargos autoricen.
- El registro queda protegido contra ediciones mientras está pendiente.
- Campanita → **Eliminaciones**: autorizar, rechazar o cancelar la solicitud
  propia. Rechazo/cancelación conserva el registro y quita los avisos pendientes
  de todos los participantes; queda un aviso informativo y el historial cerrado.
- Las solicitudes no caducan. El historial conserva título, ID, solicitante,
  firmas con UID/nombre/fecha, resolución y excepción si corresponde.
- Director fundador (UID de `configuracion/estado`, con rol Director vigente) y
  Desarrollador pueden eliminar directamente, siempre con confirmación.
- Si no existe cuenta activa del otro cargo, se requiere confirmar una segunda
  advertencia antes de eliminar con la única firma disponible. Queda registrado.
- Eventos quedan fuera de la doble firma. No se borran archivos externos en Drive.
- Al borrar un integrante se retira el vínculo de las cuentas asociadas; no se
  borran cuentas ni registros históricos de asistencia/justificación.
- Modo local: no se realiza ninguna eliminación ni se simula su éxito.

### Quién puede solicitar

Director, Secretario y Desarrollador en las cuatro colecciones. Tesorero también
puede solicitar en cartas, actas y documentos. Directiva en cartas y actas.
Solo Dirección/Secretaría aportan firmas; Desarrollador tiene la excepción
acordada. Miembro no puede solicitar. Estos permisos se comprueban en servidor.

## Seguridad y concurrencia

`POST /api/eliminaciones` verifica el token Firebase (incluida revocación), la
cuenta activa y el rol actual. No acepta firmas ni identidades enviadas por el
cliente. Una transacción vuelve a leer cargos, fundador, solicitud, registro y
bloqueo antes de decidir.

Colecciones:
- `solicitudes_eliminacion`: estado e historial; solo servidor escribe.
- `bloqueos_eliminacion/{coleccion}__{id}`: una solicitud pendiente por registro.
- `registros_eliminados/{coleccion}__{id}`: impide que una escritura local antigua
  recree un registro borrado después de reconectar.
- `usuarios/{uid}/avisos`: avisos internos personales.
- `cola_avisos`: entregas push pendientes, inaccesibles a clientes.

Las reglas deniegan el borrado directo en las cuatro colecciones **incluso a
clientes Director/Desarrollador**; sus excepciones pasan también por el servidor.
Tampoco permiten editar bloqueados ni escribir solicitudes/firmas desde el
cliente. Las firmas de cuentas suspendidas o que cambiaron de cargo se descartan
al resolver. Dos peticiones simultáneas no deben crear dos trámites para el mismo
registro. Una solicitud terminal no vuelve a ejecutarse por reintentar.

Se retiró la limpieza masiva de datos demo: no puede constituir una vía paralela
para saltarse las autorizaciones. Los registros de ejemplo se eliminan desde
sus libros con el mismo circuito.

## Push restantes

- Solicitudes y resoluciones de eliminación: aviso interno atómico, más una cola
  push que respeta «Solicitudes de eliminación» en Ajustes.
- Nuevas cartas, justificaciones y solicitudes de edición de actas: distribuidas
  solo a roles de gestión, respetando sus interruptores de Correspondencia,
  Justificaciones y Actas. No se distribuyen estos contenidos a Miembros.
- Los avisos internos se mantienen aunque no haya dispositivo o el push esté
  apagado. Los originales compartidos se deduplican con su copia personal.
- `after()` de Next.js procesa los push tras responder, sin retrasar el resultado
  de la eliminación. El cron `/api/cron/avisos` a las 12:15 UTC recupera la cola y
  prepara avisos generales recientes (48 h) que el cliente no alcanzó a enviar.
- La entrega se confirma por token; fallos temporales se conservan para reintento.
  Hay reserva de 5 minutos y lotes FCM de hasta 500. Un mensaje aceptado por FCM
  justo antes de una caída puede repetirse al reintentar: no se promete entrega
  exactamente una vez. Los tags estables evitan múltiples tarjetas iguales.
- Una cola pendiente se retira si se cierra la solicitud. No es posible retirar
  del teléfono un push que ya se haya entregado antes de cerrar.
- Si falla el intento inmediato, el respaldo diario puede demorar hasta la
  siguiente pasada; no es una garantía de notificación instantánea.
- La cola procesa hasta 100 trabajos por ejecución. Para volúmenes grandes,
  usar el programador más frecuente descrito en la guía 09 y supervisar la cola.

## Otros ajustes de consistencia

- Acuses nuevos usan las iniciales del nombre oficial del usuario autenticado,
  no el texto fijo «SG» ni el alias privado. No se reescribió el historial antiguo.
- Firmas de **edición de actas** ligadas al cargo real y a UIDs distintos.
  Las reglas solo permiten cambiar contenido tras ambas firmas vigentes.
  La firma usa transacción para no perder la firma concurrente de la contraparte.
- El acta autorizada ahora muestra el botón Editar cuando pasa a Borrador.
  Restaurar el respaldo también pide apertura con ambas firmas antes de guardar.
  Las excepciones de eliminación no se aplican a estas firmas de edición.
- El modo local deja de iniciar suscripciones de Firestore que podían vaciar sus
  datos al recibir una caché remota vacía. No envía cambios como si tuviera sesión.

## Pruebas ejecutadas

- `npm test`: **50 aprobadas**, 1 suite de reglas omitida por falta de emulador.
  Incluye 24 de eliminación/cola/avisos generales, 17 de calendario y 9 de
  justificaciones. Firebase está sustituido por dobles transaccionales en memoria.
- TypeScript y compilación de producción correctos.
- Prueba real con Chromium a 390×844 en modo local: Ajustes abre, la campanita
  permite filtrar Eliminaciones, pulsación larga abre el menú sin abrir detalle,
  confirmar no borra sin Google y muestra explicación. Sin errores de página.
- Lint global conserva los 7 errores anteriores de React en AppContext,
  AuthContext y VistaAsistencia. Los módulos nuevos pasan lint.

### Verificación de reglas pendiente (necesaria antes de publicar)

No se pudo iniciar el emulador: falta Java y fallaron las descargas externas de
Java en el sandbox. Se dejó una suite ejecutable, **no se da por aprobada**:

```sh
# Con Java compatible y Firebase CLI instalados, desde la raíz del repositorio:
firebase emulators:exec --only firestore --project demo-solibook \
  --config firebase.test.json "npm run test:reglas"
```

Esta suite comprueba borrado directo denegado, bloqueo, tombstones, privacidad,
imposibilidad de falsificar solicitudes y firmas de edición. Sin
`FIRESTORE_EMULATOR_HOST`, `test:reglas` se omite expresamente. Usa únicamente
el proyecto de demostración `demo-solibook`, nunca producción.

## Despliegue y prueba final con cuentas reales

1. Ejecutar la suite de reglas y luego publicar `firestore.rules` coordinadamente
   con esta versión. El servidor Admin no está sujeto a esas reglas: **publicar
   el código sin cerrar los borrados del cliente no asegura la doble firma**.
2. Configurar las variables Firebase Admin, `CRON_SECRET`, VAPID y `APP_URL` de
   las guías anteriores. No se solicitaron ni guardaron credenciales en el repo.
3. Verificar con Director no fundador + Secretario: aprobación y rechazo desde
   dos dispositivos, desaparición del pendiente para ambos y conservación/borrado
   del registro según el resultado.
4. Verificar excepción del fundador/Desarrollador y falta de contraparte con su
   advertencia. Comprobar también una cuenta suspendida y un cambio de cargo.
5. Probar la doble firma de edición con un acta de prueba y restaurar su respaldo.
6. Activar/desactivar push por tipo, cerrar la app y comprobar la recepción real.

No se desplegó ni se publicaron reglas desde esta sesión. La revisión de
recepción FCM y de permisos con cuentas reales sigue pendiente. Los límites de
recordatorios diarios del calendario siguen vigentes (ver guía 09); no se añadieron
avisos instantáneos de creación/cambio/cancelación de eventos.
