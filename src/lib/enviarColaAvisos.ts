import { puedeJustificarPorOtros } from './justificaciones';
import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';

interface AvisoEnCola {
  uid: string; avisoId: string; categoria: string; titulo: string; mensaje: string;
  estado: string; reservadoHasta?: number; ejecucion?: string; entregados?: Record<string, boolean>;
}
// Las solicitudes internas se confirman antes del push. Esta cola permite
// recuperar envíos fallidos sin volver a ejecutar una eliminación.
export async function enviarColaAvisos(db: Firestore, messaging: Messaging, solicitudId?: string) {
  const comienzo = Date.now();
  const ejecucion = randomUUID();
  const consulta = solicitudId ? db.collection('cola_avisos').where('solicitudId', '==', solicitudId) : db.collection('cola_avisos').where('estado', '==', 'pendiente');
  const cola = await consulta.limit(100).get();
  const origen = new URL(process.env.APP_URL || 'https://solibook.vercel.app').origin;
  if (!origen.startsWith('https://')) throw new Error('APP_URL debe usar HTTPS');
  const resumen = { enviados: 0, fallidos: 0, omitidos: 0, incompleto: false };
  for (const documento of cola.docs) {
    if (Date.now() - comienzo > 40000) return { ...resumen, incompleto: true };
    const ref = documento.ref;
    const trabajo = await db.runTransaction(async tx => {
      const actual = await tx.get(ref);
      const datos = actual.data() as AvisoEnCola | undefined;
      if (!datos || datos.estado !== 'pendiente' || (datos.reservadoHasta || 0) > Date.now()) return null;
      tx.update(ref, { ejecucion, reservadoHasta: Date.now() + 300000 });
      return datos;
    });
    if (!trabajo) continue;
    const entregados = trabajo.entregados || {};
    const finalizar = async (estado: string, liberar = true) => db.runTransaction(async tx => {
      const actual = await tx.get(ref);
      if (actual.exists && actual.data()?.ejecucion === ejecucion) tx.update(ref, { estado, entregados, reservadoHasta: liberar ? 0 : Date.now() + 300000, actualizadoEn: new Date().toISOString() });
    });
    try {
      const [cuenta, ajustes, aviso, dispositivos] = await Promise.all([
        db.doc(`usuarios/${trabajo.uid}`).get(), db.doc(`usuarios/${trabajo.uid}/privado/ajustes`).get(),
        db.doc(`usuarios/${trabajo.uid}/avisos/${trabajo.avisoId}`).get(),
        db.collection('dispositivos_notificaciones').where('uid', '==', trabajo.uid).get()
      ]);
      if (!cuenta.data()?.activo || (trabajo.categoria !== 'Solicitudes de eliminación' && !puedeJustificarPorOtros(cuenta.data()?.rol || '')) || !aviso.exists || ajustes.data()?.pushTipos?.[trabajo.categoria] === false) {
        resumen.omitidos++; await finalizar('omitido'); continue;
      }
      const tokens = [...new Map(dispositivos.docs.filter(d => typeof d.data().token === 'string').map(d => [d.data().token as string, d])).entries()];
      const pendientes = tokens.filter(([token]) => !entregados[createHash('sha256').update(token).digest('hex')]);
      let fallo = false;
      for (let i = 0; i < pendientes.length; i += 500) {
        const lote = pendientes.slice(i, i + 500);
        // Si un rechazo/cancelación cerró la solicitud, no mandar su aviso pendiente.
        if (!(await ref.get()).exists) break;
        const resultado = await messaging.sendEachForMulticast({
          tokens: lote.map(([token]) => token), notification: { title: trabajo.titulo.slice(0, 180), body: trabajo.mensaje.slice(0, 500) },
          data: { avisoId: trabajo.avisoId },
          webpush: { headers: { TTL: '86400' }, notification: { icon: '/icon-192.png', tag: trabajo.avisoId, renotify: false }, fcmOptions: { link: `${origen}/?vista=notificaciones` } }
        });
        for (let j = 0; j < lote.length; j++) {
          const [token, dispositivo] = lote[j];
          const respuesta = resultado.responses[j];
          const invalido = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(respuesta.error?.code || '');
          if (respuesta.success || invalido) entregados[createHash('sha256').update(token).digest('hex')] = true;
          if (respuesta.success) resumen.enviados++;
          else if (invalido) {
            await db.runTransaction(async tx => {
              const actual = await tx.get(dispositivo.ref);
              if (actual.data()?.token === token) tx.delete(dispositivo.ref);
            });
          } else { fallo = true; resumen.fallidos++; }
        }
        await finalizar('pendiente', false);
      }
      await finalizar(fallo ? 'pendiente' : 'enviado');
    } catch { resumen.fallidos++; await finalizar('pendiente'); }
  }
  return resumen;
}
