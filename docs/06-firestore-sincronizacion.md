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

## Reglas de seguridad recomendadas

Si todavía no tienes reglas publicadas, este es el punto de partida seguro
(Firebase Console → Firestore Database → Reglas):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo usuarios con sesión de Google pueden leer o modificar datos
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Si hoy usas las reglas de prueba (`allow read, write: if true;`), funcionarán
igual, pero recuerda endurecerlas antes de publicar la app: con ellas cualquier
persona con la URL del proyecto puede leer o borrar la base de datos.

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
   reglas recomendadas de arriba.
4. Abre la app, inicia sesión con Google: la primera cuenta registrada queda
   como **Administrador** y tus datos locales se migran solos a la nube.

A partir de ahí, cualquier otro usuario que ingrese con Google verá los mismos
miembros, agenda, asistencias, cartas, actas, documentos y usuarios; y los
cambios se reflejan en vivo para todos.
