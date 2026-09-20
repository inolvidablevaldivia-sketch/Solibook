# Notificaciones push de cumpleaños

Solibook mantiene dos recordatorios complementarios:

1. **Aviso interno:** entre 7 días antes y el día del cumpleaños, aparece en Inicio y en la campanita para los roles de gestión que abran la aplicación.
2. **Push del teléfono:** el día exacto, un cron diario consulta los miembros activos y avisa a los dispositivos de roles de gestión que hayan activado los recordatorios.

Los cumpleaños del 29 de febrero se consideran el **28 de febrero** en años no bisiestos.

> El push no se envía a cuentas con rol **Miembro** y los enlaces/documentos administrativos tampoco se exponen a dicho rol.

## Requisitos de Firebase

1. En Firebase Console, abre **Project settings → Cloud Messaging**.
2. En **Web configuration**, genera una **Web Push certificate** y copia la clave pública VAPID.
3. En la plataforma de despliegue agrega:

```text
NEXT_PUBLIC_FIREBASE_VAPID_KEY=clave_publica_vapid
```

4. Crea una cuenta de servicio con permiso Firebase Admin / Cloud Messaging y agrega estas variables de entorno **sólo en servidor**:

```text
FIREBASE_ADMIN_PROJECT_ID=solibook-solideo
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@solibook-solideo.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CRON_SECRET=un_valor_largo_aleatorio
```

Nunca se deben publicar ni versionar las últimas cuatro variables.

## Programación en Vercel

El archivo [`vercel.json`](../vercel.json) programa la ruta:

```text
GET /api/cron/cumpleanos
0 12 * * *
```

El horario corresponde aproximadamente a las 09:00 de Santiago durante el horario de verano. La fecha se calcula siempre en la zona `America/Santiago`, por lo que el aviso no se moverá de día con los cambios de horario; en invierno llegará aproximadamente una hora antes.

Vercel envía el encabezado `Authorization: Bearer <CRON_SECRET>` al cron. La ruta rechaza cualquier otra solicitud.

## Activación por persona

Cada integrante de la gestión debe:

1. abrir Solibook en su teléfono;
2. tocar la campanita;
3. presionar **Activar avisos**;
4. aceptar el permiso del sistema.

El token del dispositivo se guarda en `dispositivos_notificaciones`. Las reglas de Firestore permiten que una persona registre o quite únicamente su propio dispositivo. El cron usa Firebase Admin, por lo que puede leer los tokens sin abrirlos a los usuarios.

## Compatibilidad y prueba

- Android/Chrome y PWA instalada: admite avisos en segundo plano tras conceder permiso.
- iPhone/iPad: requiere una PWA agregada a la pantalla de inicio y una versión compatible de iOS.
- Navegadores de escritorio: pueden pedir permiso, pero las políticas del equipo pueden bloquear los avisos.

Para probar sin esperar un cumpleaños real, crea temporalmente un integrante activo con fecha de nacimiento correspondiente al día actual. Después de comprobar el envío, elimina o corrige esa fecha y el documento `envios_cumpleanos/cumple-<id>-<año>` que haya quedado de la prueba.

> Las reglas de Firestore de [`firestore.rules`](../firestore.rules) deben publicarse junto con esta versión para habilitar `documentos_evento` y `dispositivos_notificaciones`.
