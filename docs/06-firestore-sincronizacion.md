# Sincronización en línea con Cloud Firestore

Solibook sincroniza todos sus datos en tiempo real usando Cloud Firestore, de modo
que la directiva y los miembros ven la misma información en todos sus dispositivos.

## Colecciones utilizadas

| Colección       | Contenido                                                        |
| --------------- | ---------------------------------------------------------------- |
| `integrantes`   | Fichas del directorio (incluye `documentos` adjuntos por miembro) |
| `eventos`       | Agenda de ensayos, presentaciones y reuniones                    |
| `asistencias`   | Registros del paso de lista por evento                           |
| `cartas`        | Correspondencia recibida y emitida                               |
| `actas`         | Actas de reunión con versionado y respaldo                       |
| `justificaciones` | Solicitudes de justificación de inasistencias                  |
| `notificaciones` | Avisos del centro de notificaciones (compartidos)               |
| `documentos`    | Libro de documentos institucionales                              |
| `usuarios`      | Directorio de cuentas, roles, estado y vínculo con miembro      |
| `configuracion` | Documento `general` (tipos de evento) y `semillas` (migración)  |

## Cómo funciona

- **Tiempo real:** cada colección se escucha con `onSnapshot`; un cambio hecho
  por un usuario aparece al instante en el resto de los dispositivos.
- **Optimista y offline primero:** la escritura se refleja de inmediato en la
  pantalla y queda en la caché persistente de Firestore. Sin internet, la app
  sigue funcionando y los cambios se suben solos al recuperar la conexión.
- **Migración automática:** la primera vez que la app encuentra una colección
  vacía en la nube, sube los datos locales del dispositivo (o los datos de
  demostración). Un documento candado (`configuracion/semillas`) garantiza que
  la siembra ocurra una sola vez aunque varios equipos entren a la vez.
- **Modo local:** "Continuar sin conexión" sigue disponible; en ese modo la app
  usa solo `localStorage`, igual que antes de la sincronización.

## Reglas de seguridad (modelo de roles)

Las reglas endurecidas viven en [`firestore.rules`](../firestore.rules) en la
raíz del repositorio. Se publican en Firebase Console → Firestore Database →
Reglas, o con `firebase deploy --only firestore:rules`.

La seguridad real la hacen cumplir los servidores de Firebase, no el navegador:
aunque alguien modifique el código en su equipo, no podrá leer ni escribir nada
que su rol no permita.

### Matriz de roles

| Permiso \ Rol | Director | Desarrollador | Secretario | Tesorero | Directiva | Miembro |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Ver calendario y su citación | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Operación diaria (eventos, asistencia, cartas, actas, documentos) | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ |
| Acuse de recibo (vistoPor) | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Eliminar documentos | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Agregar / eliminar miembros | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Aprobar / rechazar justificaciones | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Administrar usuarios y roles | ✅ *(1)* | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| Modificar cuentas Director / Desarrollador | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |

*(1)* El Director administra usuarios pero no puede nombrar roles Director ni
Desarrollador.

### Detalles clave de las reglas

- **Cuenta fundadora:** la primera persona que inicia sesión reclama el rol
  Director mediante una transacción atómica en `configuracion/estado`. Todo el
  resto entra como Miembro hasta que la directiva le asigne rol.
- **`get` vs `list` en integrantes:** el rol Miembro no puede listar el
  directorio, pero sí puede leer **su propia ficha** (`perfil().integranteId`)
  para saber su cuerda y si está citado.
- **Transiciones protegidas:** en `justificaciones`, cualquier rol de gestión
  puede registrar una (nace como `Pendiente`), pero solo Director, Secretario y
  Desarrollador pueden cambiar su resolución; el sello `vistoPor` exige además
  el rol con acuse de recibo.
- **Migración de roles antiguos:** los valores `Administrador` y `Secretaria`
  guardados antes del cambio se tratan como `Director` y `Secretario`, y las
  cuentas se reescriben solas con el valor nuevo al iniciar sesión.
- **Candado final:** toda colección no declarada queda denegada
  (`if false`), evitando fugas por colecciones futuras mal configuradas.
- **Tope de imagen:** la foto de perfil en Base64 se limita a ~950 KB para no
  chocar con el límite de 1 MB por documento de Firestore.

> Las imágenes y adjuntos se guardan como Base64 comprimido (~30–60 KB) dentro
> de los propios documentos, muy por debajo del límite de 1 MB por documento,
> por lo que no se requiere Firebase Storage para la sincronización.

## Paso a paso para dejarla operativa

1. **Authentication → Sign-in method:** habilita el proveedor **Google**.
2. **Authentication → Settings → Dominios autorizados:** agrega el dominio donde
   se publica la app (por ejemplo `tu-app.vercel.app` y cualquier dominio de
   vista previa). Sin este paso, el botón "Ingresar con Google" fallará con
   `auth/unauthorized-domain` en ese dominio.
3. **Firestore Database:** crea la base de datos (modo nativo) y publica las
   reglas de `firestore.rules`.
4. Publica las reglas y la versión nueva de la app **juntas** (mismo momento),
   para que las cuentas no escriban roles que las reglas aún no conocen.
5. Abre la app e inicia sesión con Google **primero tú**: tu cuenta reclama el
   rol de Director fundador y los datos locales se migran solos a la nube. Los
   demás usuarios entrarán como Miembro hasta que les asignes su rol en
   **Usuarios y Permisos** (quienes ya tenían rol guardado lo conservan por la
   migración automática).

A partir de ahí, cualquier otro usuario que ingrese con Google verá los mismos
miembros, agenda, asistencias, cartas, actas, documentos y usuarios; y los
cambios se reflejan en vivo para todos.
