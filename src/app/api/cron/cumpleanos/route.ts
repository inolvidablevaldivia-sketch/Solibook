import { NextRequest, NextResponse } from 'next/server';
import { cumpleanosCorrespondeAFecha, fechaChile } from '@/lib/cumpleanos';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IntegrantePush {
  id: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
  estado: string;
}

interface UsuarioPush {
  uid: string;
  rol: string;
  activo: boolean;
}

interface DispositivoPush {
  id: string;
  uid: string;
  token: string;
}

const esRolGestion = (rol: string) => !['Miembro'].includes(rol);

const añosQueCumple = (fechaNacimiento: string | undefined, anio: number): number | null => {
  const nacimiento = Number(fechaNacimiento?.split('-')[0]);
  return Number.isFinite(nacimiento) ? anio - nacimiento : null;
};

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const { db, messaging } = obtenerFirebaseAdmin();
    const hoy = fechaChile();

    const [integrantesSnapshot, usuariosSnapshot, dispositivosSnapshot] = await Promise.all([
      db.collection('integrantes').where('estado', '==', 'Activo').get(),
      db.collection('usuarios').where('activo', '==', true).get(),
      db.collection('dispositivos_notificaciones').get()
    ]);

    const integrantes = integrantesSnapshot.docs.map(documento => documento.data() as IntegrantePush);
    const usuariosGestion = new Set(
      usuariosSnapshot.docs
        .map(documento => documento.data() as UsuarioPush)
        .filter(usuario => esRolGestion(usuario.rol))
        .map(usuario => usuario.uid)
    );
    // Preferencias privadas: el servidor Admin puede leerlas sin exponerlas
    // al directorio compartido ni desactivar los avisos internos.
    const preferencias = await Promise.all([...usuariosGestion].map(async uid => {
      const ajustes = await db.doc(`usuarios/${uid}/privado/ajustes`).get();
      return { uid, activo: ajustes.data()?.pushTipos?.['Cumpleaños'] !== false };
    }));
    preferencias.filter(p => !p.activo).forEach(p => usuariosGestion.delete(p.uid));
    const dispositivos = dispositivosSnapshot.docs
      .map(documento => documento.data() as DispositivoPush)
      .filter(dispositivo => usuariosGestion.has(dispositivo.uid) && Boolean(dispositivo.token));

    if (dispositivos.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0, detalle: 'No hay dispositivos con avisos activados.' });
    }

    let enviados = 0;
    let cumpleañosDetectados = 0;

    for (const integrante of integrantes) {
      if (!cumpleanosCorrespondeAFecha(integrante.fechaNacimiento, hoy.anio, hoy.mes, hoy.dia)) continue;
      cumpleañosDetectados += 1;

      const identificador = `cumple-${integrante.id}-${hoy.anio}`;
      const controlRef = db.collection('envios_cumpleanos').doc(identificador);
      const debeEnviar = await db.runTransaction(async transaccion => {
        const anterior = await transaccion.get(controlRef);
        if (anterior.exists) return false;
        transaccion.set(controlRef, {
          id: identificador,
          integranteId: integrante.id,
          anio: hoy.anio,
          preparadoEn: new Date().toISOString(),
          zonaHoraria: 'America/Santiago'
        });
        return true;
      });

      if (!debeEnviar) continue;

      const edad = añosQueCumple(integrante.fechaNacimiento, hoy.anio);
      const resultado = await messaging.sendEachForMulticast({
        tokens: dispositivos.map(dispositivo => dispositivo.token),
        notification: {
          title: `Hoy cumple años ${integrante.nombreCompleto}`,
          body: edad ? `¡${integrante.nombreCompleto} cumple ${edad} años hoy!` : 'No olvides enviarle un saludo.'
        },
        webpush: {
          notification: {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: identificador,
            renotify: false
          },
          fcmOptions: { link: 'https://solibook.vercel.app/' }
        }
      });

      enviados += resultado.successCount;

      const invalidos = resultado.responses
        .map((respuesta, indice) => ({ respuesta, dispositivo: dispositivos[indice] }))
        .filter(({ respuesta }) => !respuesta.success)
        .filter(({ respuesta }) =>
          ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(
            respuesta.error?.code || ''
          )
        )
        .map(({ dispositivo }) => dispositivo.id);

      await Promise.all(invalidos.map(id => db.collection('dispositivos_notificaciones').doc(id).delete()));
      await controlRef.set({ enviadoEn: new Date().toISOString(), enviados: resultado.successCount }, { merge: true });
    }

    return NextResponse.json({ ok: true, enviados, cumpleañosDetectados });
  } catch (error) {
    console.error('[Cron cumpleaños] Error al enviar notificaciones:', error);
    return NextResponse.json({ ok: false, error: 'No fue posible ejecutar el envío programado.' }, { status: 500 });
  }
}
