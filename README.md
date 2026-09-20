This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Solibook — puesta en marcha

Solibook comienza **sin datos de demostración**: no hay integrantes, actividades, cartas ni
actas de ejemplo. La primera persona que ingresa con Google reclama la cuenta fundadora y
queda como **Director**; el resto de las cuentas entran como **Miembro** hasta que se les
asigne un rol en *Usuarios y Permisos*.

Las categorías de actividad por defecto son: *Ensayo, Presentación, Concierto, Reunión,
Administrativo y Otro* (la persona con rol de gestión puede agregar más).

Si algún dispositivo alcanzó a sincronizar la demostración de las primeras versiones,
*Usuarios y Permisos → Mantenimiento → Eliminar datos de demostración* la retira de la nube
y de ese dispositivo. Solo elimina los identificadores conocidos de la demo: el trabajo real
del ministerio no se toca.

La configuración de Firebase se toma de variables `NEXT_PUBLIC_FIREBASE_*` y, si no existen,
usa los valores por defecto de `src/lib/firebase.ts`. Las reglas de seguridad viven en
`firestore.rules` (Firebase Console → Firestore → Reglas).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
