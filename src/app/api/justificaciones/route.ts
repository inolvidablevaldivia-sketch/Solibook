import { createHash, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { after, NextResponse } from 'next/server';
import { prepararAvisoGestion } from '@/lib/prepararAvisoGestion';
import { enviarColaAvisos } from '@/lib/enviarColaAvisos';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import { eventoJustificable, puedeJustificarPorOtros, validarSolicitudJustificacion } from '@/lib/justificaciones';
import { puedeConAtribuciones } from '@/lib/permisos';
import type { Evento, Integrante, Justificacion, UsuarioApp } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;
class Rechazo extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: 'Inicia sesión para enviar una justificación.' }, { status: 401 });
  try {
    const { db, messaging } = obtenerFirebaseAdmin();
    let uid: string;
    try { uid = (await getAuth().verifyIdToken(token, true)).uid; }
    catch { throw new Rechazo('La sesión venció. Vuelve a iniciar sesión.', 401); }
    // Límite real al leer el stream, incluso si Content-Length no viene informado.
    const lector = request.body?.getReader();
    if (!lector) throw new Rechazo('Falta la solicitud.', 400);
    let bytes = 0;
    const partes: Uint8Array[] = [];
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 240_000) { await lector.cancel(); throw new Rechazo('La foto es demasiado grande.', 413); }
      partes.push(value);
    }
    let solicitud;
    try { solicitud = validarSolicitudJustificacion(JSON.parse(Buffer.concat(partes).toString('utf8'))); }
    catch (e) { throw new Rechazo(e instanceof Error ? e.message : 'Solicitud inválida.', 400); }
    const { integranteId, eventoIds, motivo, adjuntoUrl } = solicitud;
    const avisoIds: string[] = [];
    const resultado = await db.runTransaction(async tx => {
      avisoIds.length = 0;
      // Se comprueban de nuevo rol, vínculo, convocatorias y fechas en servidor.
      const usuarioDoc = await tx.get(db.doc(`usuarios/${uid}`));
      const usuario = usuarioDoc.data() as UsuarioApp | undefined;
      if (!usuario?.activo) throw new Rechazo('Tu cuenta no está activa.', 403);
      // Quién justifica a otro: por cargo, o porque tiene la atribución de
      // resolver justificativos (que es más capacidad, no menos).
      const gestion = puedeJustificarPorOtros(usuario.rol)
        || puedeConAtribuciones(usuario.rol, 'resolver_justificaciones', usuario.atribuciones);
      if (!gestion && (usuario.rol !== 'Miembro' || usuario.integranteId !== integranteId)) throw new Rechazo('Solo puedes justificar tus propias actividades.', 403);
      const integranteDoc = await tx.get(db.doc(`integrantes/${integranteId}`));
      if (!integranteDoc.exists) throw new Rechazo('No se encontró la ficha del integrante.', 409);
      const integrante = { ...integranteDoc.data(), id: integranteId } as Integrante;
      const eventosDocs = await Promise.all(eventoIds.map(id => tx.get(db.doc(`eventos/${id}`))));
      const ahora = Date.now();
      const eventos = eventosDocs.map((snap, i) => {
        const evento = { ...snap.data(), id: eventoIds[i] } as Evento;
        if (!snap.exists || !eventoJustificable(evento, integrante, ahora)) throw new Rechazo('Una actividad ya comenzó, fue eliminada o no corresponde a su convocatoria. Revisa la selección.', 409);
        return evento;
      });
      // Incluye registros anteriores al nuevo flujo. IDs deterministas también
      // evitan duplicados cuando llegan dos envíos simultáneos o un reintento.
      const anteriores = await tx.get(db.collection('justificaciones').where('integranteId', '==', integranteId));
      const cubiertos = new Set(anteriores.docs.filter(d => ['Pendiente', 'Aprobado'].includes(d.data().estado)).map(d => d.data().eventoId));
      const registros = eventos.filter(e => !cubiertos.has(e.id)).map(evento => {
        const id = `just-app-${createHash('sha256').update(JSON.stringify([integranteId, evento.id])).digest('hex')}`;
        return { evento, id };
      });
      // Lectura del ID fijo fuerza conflicto transaccional en envíos simultáneos.
      await Promise.all(registros.map(r => tx.get(db.doc(`justificaciones/${r.id}`))));
      for (const { evento, id } of registros) {
        const justificacion: Justificacion = {
          id, integranteId, eventoId: evento.id, motivo, estado: 'Pendiente',
          canalIngreso: gestion ? 'Secretaria_Manual' : 'App_Integrante',
          vistoPor: [], fechaIngreso: new Date(ahora).toISOString(),
          creadoPorUid: uid,
          ...(gestion ? { creadoPorNombre: usuario.nombre, creadoPorRol: usuario.rol } : {}),
          ...(adjuntoUrl ? { adjuntoUrl } : {})
        };
        tx.set(db.doc(`justificaciones/${id}`), justificacion);
        const avisoId = `notif-just-${randomUUID()}`;
        avisoIds.push(avisoId);
        tx.set(db.doc(`notificaciones/${avisoId}`), {
          id: avisoId, tipo: 'Justificacion', titulo: 'Justificación pendiente',
          // Si alguien justificó por otra persona, tiene que leerse quién lo hizo.
          mensaje: `${integrante.nombreCompleto}${gestion ? ` (lo presentó ${usuario.nombre})` : ''} · ${evento.titulo} · ${new Date(evento.fechaHoraInicio).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`,
          fecha: new Date(ahora).toISOString(), leido: false, accionId: id
        });
      }
      return { enviadas: registros.length, omitidas: eventos.length - registros.length };
    });
    after(async () => {
      try {
        for (const id of avisoIds) { await prepararAvisoGestion(db, id); await enviarColaAvisos(db, messaging, `general-${id}`); }
      } catch (e) { console.error('[Avisos] El cron recuperará la entrega pendiente:', e); }
    });
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof Rechazo) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[Justificaciones] No se pudo registrar la solicitud:', e);
    return NextResponse.json({ error: 'No se pudo enviar. Revisa la conexión o inténtalo más tarde.' }, { status: 500 });
  }
}
