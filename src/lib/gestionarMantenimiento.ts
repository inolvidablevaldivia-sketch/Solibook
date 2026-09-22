import { FieldValue, type DocumentReference, type Firestore, type Query } from 'firebase-admin/firestore';
import type { UsuarioApp } from '@/types';
import {
  confirmacionCoincide,
  ErrorMantenimiento,
  esOperadorMantenimiento,
  tituloDeRegistro,
  type EntradaMantenimiento
} from './mantenimiento';

const COLECCIONES_ACCION_ID = [
  'integrantes',
  'eventos',
  'asistencias',
  'cartas',
  'actas',
  'justificaciones',
  'documentos',
  'documentos_evento',
  'solicitudes_eliminacion',
  'usuarios'
] as const;

async function existeDocumentoConId(db: Firestore, id: string): Promise<boolean> {
  const lecturas = await Promise.all(COLECCIONES_ACCION_ID.map(coleccion => db.doc(`${coleccion}/${id}`).get()));
  return lecturas.some(snap => snap.exists);
}

async function borrarReferencias(db: Firestore, refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 450) {
    const lote = db.batch();
    refs.slice(i, i + 450).forEach(ref => lote.delete(ref));
    await lote.commit();
  }
}

async function refsDeConsulta(consulta: Query): Promise<DocumentReference[]> {
  const snap = await consulta.get();
  return snap.docs.map(d => d.ref);
}

async function borrarAvisosYNotificacionesDe(db: Firestore, accionId: string) {
  const [notificaciones, cola, usuarios] = await Promise.all([
    refsDeConsulta(db.collection('notificaciones').where('accionId', '==', accionId)),
    refsDeConsulta(db.collection('cola_avisos').where('solicitudId', '==', accionId)),
    db.collection('usuarios').get()
  ]);
  const avisos: DocumentReference[] = [];
  for (const usuario of usuarios.docs) {
    const propios = await db.collection(`usuarios/${usuario.id}/avisos`).where('accionId', '==', accionId).get();
    propios.docs.forEach(d => avisos.push(d.ref));
  }
  await borrarReferencias(db, [...notificaciones, ...cola, ...avisos]);
}

async function hijosDeEvento(db: Firestore, eventoId: string): Promise<DocumentReference[]> {
  const [asistencias, documentos, justificaciones] = await Promise.all([
    refsDeConsulta(db.collection('asistencias').where('eventoId', '==', eventoId)),
    refsDeConsulta(db.collection('documentos_evento').where('eventoId', '==', eventoId)),
    refsDeConsulta(db.collection('justificaciones').where('eventoId', '==', eventoId))
  ]);
  return [...asistencias, ...documentos, ...justificaciones];
}

async function desvincularFicha(db: Firestore, integranteId: string) {
  const cuentas = await db.collection('usuarios').where('integranteId', '==', integranteId).get();
  for (let i = 0; i < cuentas.docs.length; i += 450) {
    const lote = db.batch();
    cuentas.docs.slice(i, i + 450).forEach(d => lote.update(d.ref, { integranteId: FieldValue.delete() }));
    await lote.commit();
  }
}

export async function ejecutarMantenimiento(
  db: Firestore,
  uid: string,
  entrada: EntradaMantenimiento
): Promise<{ mensaje: string; borrados: number }> {
  const [usuarioSnap, estadoSnap] = await Promise.all([
    db.doc(`usuarios/${uid}`).get(),
    db.doc('configuracion/estado').get()
  ]);
  const usuario = { ...(usuarioSnap.data() as object), uid: usuarioSnap.id } as UsuarioApp;
  const fundador = estadoSnap.data()?.fundador as string | undefined;
  if (!esOperadorMantenimiento(usuario, fundador, uid)) {
    throw new ErrorMantenimiento('Esta herramienta es exclusiva de la cuenta fundadora y del Desarrollador.', 403);
  }

  if (entrada.accion === 'eliminar_registro') {
    const coleccion = entrada.coleccion!;
    const registroId = entrada.registroId!;
    if (coleccion === 'usuarios' && (registroId === uid || registroId === fundador)) {
      throw new ErrorMantenimiento('No se puede borrar la cuenta en sesión ni la cuenta fundadora.');
    }
    const ref = db.doc(`${coleccion}/${registroId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new ErrorMantenimiento('El registro ya no existe.', 404);
    const titulo = tituloDeRegistro(snap.data() as Record<string, unknown>, registroId);
    if (!confirmacionCoincide(titulo, entrada.confirmacion)) {
      throw new ErrorMantenimiento('El título no coincide. No se borró nada.');
    }
    const hijos = coleccion === 'eventos' ? await hijosDeEvento(db, registroId) : [];
    if (coleccion === 'integrantes') {
      hijos.push(...(await refsDeConsulta(db.collection('justificaciones').where('integranteId', '==', registroId))));
    }
    await borrarReferencias(db, [ref, ...hijos]);
    if (coleccion === 'integrantes') await desvincularFicha(db, registroId);
    await borrarAvisosYNotificacionesDe(db, registroId);
    console.info('[Mantenimiento]', { uid, accion: entrada.accion, coleccion, registroId, titulo, hijos: hijos.length });
    return { mensaje: `Se eliminó «${titulo}» y ${hijos.length} registro(s) asociado(s), sin dejar solicitud ni historial.`, borrados: 1 + hijos.length };
  }

  if (entrada.accion === 'descartar_solicitud') {
    const solicitudId = entrada.solicitudId || entrada.registroId!;
    const solicitudRef = db.doc(`solicitudes_eliminacion/${solicitudId}`);
    const solicitudSnap = await solicitudRef.get();
    if (!solicitudSnap.exists) throw new ErrorMantenimiento('La solicitud ya no existe.', 404);
    const solicitud = solicitudSnap.data() as { titulo?: string; tipo?: string; registroId?: string };
    const titulo = tituloDeRegistro(solicitud as Record<string, unknown>, solicitudId);
    if (!confirmacionCoincide(titulo, entrada.confirmacion)) {
      throw new ErrorMantenimiento('El título no coincide. No se descartó nada.');
    }
    const refs = [solicitudRef];
    if (solicitud.tipo && solicitud.registroId) {
      refs.push(db.doc(`bloqueos_eliminacion/${solicitud.tipo}__${solicitud.registroId}`));
    }
    const bloqueos = await db.collection('bloqueos_eliminacion').where('solicitudId', '==', solicitudId).get();
    bloqueos.docs.forEach(d => refs.push(d.ref));
    await borrarReferencias(db, refs);
    await borrarAvisosYNotificacionesDe(db, solicitudId);
    console.info('[Mantenimiento]', { uid, accion: entrada.accion, solicitudId, titulo });
    return { mensaje: `Se descartó la solicitud «${titulo}» y se levantó el bloqueo. El registro original no se tocó.`, borrados: refs.length };
  }

  if (entrada.accion === 'limpiar_notificaciones_huerfanas') {
    const registroId = entrada.registroId!;
    const ref = db.doc(`notificaciones/${registroId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new ErrorMantenimiento('Esa notificación ya no existe.', 404);
    const datos = snap.data() as Record<string, unknown>;
    const titulo = tituloDeRegistro(datos, registroId);
    if (!confirmacionCoincide(titulo, entrada.confirmacion)) {
      throw new ErrorMantenimiento('El título no coincide. No se borró nada.');
    }
    const accionId = typeof datos.accionId === 'string' ? datos.accionId : '';
    if (!accionId) throw new ErrorMantenimiento('Esa notificación no tiene accionId: no se considera huérfana.');
    if (await existeDocumentoConId(db, accionId)) {
      throw new ErrorMantenimiento('Esa notificación todavía apunta a un documento existente.');
    }
    await borrarReferencias(db, [ref]);
    console.info('[Mantenimiento]', { uid, accion: entrada.accion, registroId, titulo, accionId });
    return { mensaje: `Se eliminó la notificación huérfana «${titulo}».`, borrados: 1 };
  }

  const tituloEsperado = 'dispositivos inactivos';
  if (!confirmacionCoincide(tituloEsperado, entrada.confirmacion)) {
    throw new ErrorMantenimiento('Teclea «dispositivos inactivos» para confirmar. No se borró nada.');
  }
  const [dispositivos, cuentas] = await Promise.all([
    db.collection('dispositivos_notificaciones').get(),
    db.collection('usuarios').get()
  ]);
  const activos = new Set(
    cuentas.docs
      .filter(d => {
        const data = d.data() as UsuarioApp;
        return data.activo !== false && (data.estadoIngreso || 'Aceptado') === 'Aceptado';
      })
      .map(d => d.id)
  );
  const inactivos = dispositivos.docs.filter(d => {
    const data = d.data() as { uid?: string; token?: string };
    return !data.uid || !activos.has(data.uid) || !data.token;
  });
  await borrarReferencias(db, inactivos.map(d => d.ref));
  console.info('[Mantenimiento]', { uid, accion: entrada.accion, borrados: inactivos.length });
  return { mensaje: `Se eliminaron ${inactivos.length} token(s) de dispositivos inactivos.`, borrados: inactivos.length };
}
