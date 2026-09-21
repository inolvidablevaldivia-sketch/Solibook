# Cargos, atribuciones, altas y trazabilidad

Documento de referencia del modelo de autorización acordado con la directiva.
Rige por sobre cualquier descripción anterior de «roles». El código que lo
implementa está en `src/lib/permisos.ts` (matriz), `src/lib/atributos.ts`
(atribuciones y cupos), `src/lib/ingresos.ts` (altas), `src/lib/traspasos.ts`
(paso de Dirección), `src/lib/actasProtocolo.ts` (firmas de acta),
`src/lib/autorias.ts` (quién hizo qué) y `firestore.rules` (lo mismo, en el
servidor).

## Idea central: cargo + atribuciones que sólo suman

- El **cargo** es la identidad pública: cómo aparece alguien cuando firma un
  acta, acusa recibo una carta o autoriza un borrado. También define los
  permisos base.
- Una **atribución** agrega una capacidad concreta, con `motivo`, quién la
  concedió y un `hasta` opcional. **Nunca quita** nada: si se retira, lo único
  que pasa es que la firma que ya estaba puesta sobre esa base pierde validez
  para el futuro.
- Los cargos vigentes son `Director`, `Secretario`, `Tesorero`, `Vocal`,
  `Administrativo` (el ayudante del libro), `Miembro` y `Desarrollador`. Los
  valores guardados `Administrador`, `Secretaria` y `Directiva` se normalizan a
  `Director`, `Secretario` y `Administrativo` al leer, sin reescribir datos.
- **Miembro no recibe atribuciones por diseño**: su acceso es su calendario y
  sus justificativos. Si hace falta algo más, se le da un cargo.

## Qué puede hacer cada cargo

| | Agenda | Listas | Justificativos | Correspondencia | Actas | Documentos | Fichas | Métricas | Cuentas |
|---|---|---|---|---|---|---|---|---|---|
| Director | todo | pasa y cierra | aprueba | registra, corrige, acusa | firma cupo, redacta | todo (borrado con doble firma) | todo | sí | administra |
| Secretario | todo | pasa y cierra | aprueba | registra, corrige, acusa | firma cupo, redacta | todo | todo | sí | no |
| Vocal | todo, sin borrar fichas | pasa y cierra | aprueba | leer, acusar, PDF | leer, PDF, 4ª firma opcional | **nada** (salvo atribución) | ver, crear, editar | sí | no |
| Tesorero | leer | no | leer, adjuntar, justifica por otros | leer, acusar, PDF | **firma su cupo**, pide reapertura | todo (borrado con doble firma) | ver, crear, editar | no | no |
| Administrativo | crear y editar | pasa (no cierra) | registra (no aprueba) | registra (no acusa) | redacta borrador | sube (no borra) | ver, crear, editar | no | no |
| Miembro | su calendario | no | justifica hasta 20 actividades futuras, con foto | no | no | no | no | no | no |

Tesorería y Vocalía **nunca** autorizan borrados de libro: el borrado sigue
siendo Dirección + Secretaría, con dos cuentas distintas (`10-eliminaciones-y-cierre-de-flujos.md`).

Atribuciones simples (las concede Dirección con `gestionar_usuarios`):
`gestionar_agenda`, `gestionar_listas`, `gestionar_cartas`, `gestionar_actas`,
`ver_documentos`, `subir_documentos`, `acuse_recibo`, `resolver_justificaciones`,
`ver_metricas`, `ver_cuentas`, `solicitar_borrados`.

Atribuciones delicadas (sólo Desarrollador o el Director fundador):
`cerrar_listas`, `eliminar_agenda`, `eliminar_documento`, `eliminar_ficha`,
`cupo_direccion`, `cupo_secretaria`, `cupo_tesoreria`. El cupo de **Vocalía no
se puede prestar**: es del cargo.

## Altas: quien llega con su Gmail entra como Pendiente

1. La cuenta se crea con `estadoIngreso: 'Pendiente'` y rol `Miembro`. Mientras
   está pendiente **no ve nada del ministerio**: la app muestra una pantalla de
   espera (`page.tsx`) y `firestore.rules` lo refuerza con `cuentaVigente()`.
2. Dirección **y** Secretaría ven la persona en Cuentas → *Ingresos por aceptar*
   con tres acciones: **Aceptar y crear ficha**, **Aceptar y vincular a ficha
   existente**, **Rechazar**. El Vocal no acepta altas.
3. Si en **30 días** nadie responde, el pedido pasa a «sin respuesta»: sale de
   la lista de pendientes, queda en el historial y la persona no pierde su
   cuenta; si vuelve a entrar, el pedido reaparece para retomarlo.
4. La **primera** cuenta del ministerio no espera: reclama
   `configuracion/estado.fundador` en una transacción y nace como Director
   fundador, con permisos de Desarrollador.

**Fichas sin cuenta**: una ficha creada a mano es un miembro normal y figura en
directorio, asistencia y métricas como «sin cuenta». Cuando esa persona saca su
correo, se **vincula** la ficha desde la pantalla de Cuentas o desde la propia
ficha, en cualquier orden. Una ficha pertenece a una sola cuenta: al vincular, se
muestra quién la ocupa hoy y se ofrece el traspaso con constancia.

## Traspaso de la Dirección

Quien tiene el cargo vigente (o la cuenta fundadora/Desarrollador) **ofrece** la
Dirección desde la ficha de la persona destinataria. La oferta vive **24 horas**
en `usuarios/{destino}.ofertaDirector` y se responde desde el banner de la app
(`/api/cargos`, en una transacción que escribe las dos cuentas a la vez).
Al aceptar: el destinatario pasa a Director con todos sus permisos y quien la
ofrecía pasa a **Miembro ordinario**, con constancia fechada en
`ultimoTraspaso` de ambas cuentas. Si rechaza o vence, nada cambia y queda
anotado. Mientras corre la ventana, el vigente conserva todo. La cuenta fundadora
no ofrece su cargo.

## Actas: tres cupos obligatorios

- `firmas` es un mapa por cupo: `Director`, `Secretario`, `Tesorero` y `Vocal`
  (opcional), con nombre, cargo y hora de cada firma.
- El acta nace en `Borrador` con las firmas limpias; se **cierra sola** cuando
  están los tres obligatorios, puestos por **tres cuentas distintas**. Nadie
  ocupa dos cupos en la misma acta.
- Para corregirla hay que **pedir apertura**; la autorizan Dirección **y**
  Secretaría (el Tesorero puede pedirla, no autorizarla). Al guardar la edición
  se limpian las firmas y **los tres vuelven a firmar** sobre el texto nuevo; la
  autorización que permitió editar queda en `edicionAutorizadaPor`.
- Una vez cerrada, el texto queda fijo. `firestore.rules` exige que los campos
  espejo (`aprobadoPresidente`, `firmaEdicion*Uid`, `aprobadoTesoreria`)
  concuerden con `firmas`, así nadie marca una autorización sin firmarla.

## Correspondencia

- Registrar una carta deja `registradaPor` (autoría). El **acuse** es un objeto
  (`uid`, nombre, cargo, hora); los acuses guardados como iniciales antes de
  este modelo se leen como tales y **no se reescriben**.
- Secretaría puede **corregir** una carta. El acuse de quien ya la leyó **no se
  reinicia**: el aviso le indica «corregida después de tu lectura» y aparece el
  botón **Volver a acusar**; quien registró puede **Pedir re-acuse** a todos.
- El PDF membretado imprime la constancia: quién registró, cada acuse con hora
  y la última corrección.

## Trazabilidad

Se anota autoría (nombre, cargo, hora) en: alta y edición de fichas, creación y
edición de actividades, quién marcó asistencia y quién cerró la lista
(`listaCerradaPor`), subida y retiro de enlaces y documentos, resolución de
justificativos, registro/corrección/acuse de cartas, redacción y edición de
actas. La autoría no se puede reescribir: `firestore.rules` compara
`creadoPorUid` y `registradaPor` en cada update.

## Al desplegar

1. Pegar `firestore.rules` completo en Firebase Console → Firestore → Reglas
   (o `firebase deploy --only firestore:rules`).
2. Las cuentas existentes no traen `estadoIngreso` y se leen como aceptadas: la
   migración no requiere editar documentos.
3. Probar con una cuenta Gmail nueva: debe quedar en espera y aparecer en
   Cuentas → Ingresos por aceptar.
