import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { UsuarioApp } from '@/types';
import { puedeSolicitarEliminacion, rolEliminacion, type CargoFirma, type EntradaEliminacion, type SolicitudEliminacion } from './eliminaciones';

export class ErrorEliminacion extends Error {
  constructor(message: string, public status = 400, public codigo = 'solicitud_invalida') { super(message); }
}

export async function gestionarEliminacion(db: Firestore, uid: string, entrada: EntradaEliminacion) {
  const idNuevo = `elim-${randomUUID()}`;
  return db.runTransaction(async tx => {
    const [cuentas, fundadorDoc] = await Promise.all([tx.get(db.collection('usuarios')), tx.get(db.doc('configuracion/estado'))]);
    const usuarios = cuentas.docs.map(d => ({ ...d.data(), uid: d.id } as UsuarioApp));
    const usuario = usuarios.find(u => u.uid === uid);
    if (!usuario?.activo) throw new ErrorEliminacion('Tu cuenta no está activa.', 403);
    const rol = rolEliminacion(usuario.rol);
    const directo = rol === 'Desarrollador' || (rol === 'Director' && fundadorDoc.data()?.fundador === uid);
    const ahora = new Date().toISOString();
    let solicitud: SolicitudEliminacion;
    if (entrada.accion === 'solicitar') {
      if (!puedeSolicitarEliminacion(rol, entrada.tipo!)) throw new ErrorEliminacion('Tu cargo no puede solicitar esta eliminación.', 403);
      solicitud = { id: idNuevo, tipo: entrada.tipo!, registroId: entrada.registroId!, titulo: '', solicitanteUid: uid, solicitanteNombre: usuario.nombre, creadaEn: ahora, estado: 'Pendiente', firmas: {}, destinatarios: [] };
    } else {
      const previa = await tx.get(db.doc(`solicitudes_eliminacion/${entrada.solicitudId}`));
      if (!previa.exists) throw new ErrorEliminacion('La solicitud ya no existe.', 404);
      solicitud = previa.data() as SolicitudEliminacion;
      if (!['Director', 'Secretario', 'Desarrollador'].includes(rol) && solicitud.solicitanteUid !== uid) throw new ErrorEliminacion('No puedes resolver esta solicitud.', 403);
      if (solicitud.estado !== 'Pendiente') return { solicitudId: solicitud.id, estado: solicitud.estado, mensaje: `La solicitud ya está ${solicitud.estado.toLowerCase()}.` };
    }
    const registroRef = db.doc(`${solicitud.tipo}/${solicitud.registroId}`);
    const bloqueoRef = db.doc(`bloqueos_eliminacion/${solicitud.tipo}__${solicitud.registroId}`);
    const [registro, bloqueo] = await Promise.all([tx.get(registroRef), tx.get(bloqueoRef)]);
    if (entrada.accion === 'solicitar' && bloqueo.exists) {
      return { solicitudId: bloqueo.data()!.solicitudId as string, estado: 'Pendiente', mensaje: 'Este registro ya tiene una solicitud pendiente. Revísala en Notificaciones.' };
    }
    if (entrada.accion !== 'solicitar' && bloqueo.data()?.solicitudId !== solicitud.id) throw new ErrorEliminacion('El bloqueo no coincide. No se realizó ningún cambio.', 409);
    if (entrada.accion === 'solicitar' && !registro.exists) throw new ErrorEliminacion('El registro ya no existe.', 404);
    if (entrada.accion === 'solicitar') solicitud.titulo = String(registro.data()?.titulo || registro.data()?.asunto || registro.data()?.nombreCompleto || solicitud.registroId).slice(0, 240);
    const cargos: CargoFirma[] = ['Director', 'Secretario'];
    const activos = usuarios.filter(u => u.activo);
    const cargosDisponibles = cargos.filter(cargo => activos.some(u => rolEliminacion(u.rol) === cargo));
    // Una firma de una cuenta suspendida o que cambió de cargo deja de valer.
    solicitud.firmas = Object.fromEntries(Object.entries(solicitud.firmas).filter(([cargo, firma]) => activos.some(u => u.uid === firma.uid && rolEliminacion(u.rol) === cargo)));
    const esFirmante = rol === 'Director' || rol === 'Secretario';
    if (entrada.accion === 'cancelar') {
      if (solicitud.solicitanteUid !== uid) throw new ErrorEliminacion('Solo quien solicitó puede cancelar.', 403);
      solicitud.estado = 'Cancelado';
    } else if (entrada.accion === 'rechazar') {
      if (!esFirmante && !directo) throw new ErrorEliminacion('Solo Dirección o Secretaría pueden rechazar.', 403);
      solicitud.estado = 'Rechazado';
    } else {
      if (entrada.accion === 'aprobar' && !esFirmante && !directo) throw new ErrorEliminacion('Solo Dirección o Secretaría pueden firmar.', 403);
      if (!registro.exists) throw new ErrorEliminacion('El registro ya no existe. Cancela o rechaza la solicitud para cerrarla.', 409);
      if (!cargosDisponibles.length && !directo) throw new ErrorEliminacion('No hay Director ni Secretario activo que pueda autorizar.', 409);
      if (esFirmante) solicitud.firmas[rol as CargoFirma] = { uid, nombre: usuario.nombre, fecha: ahora };
      const completa = cargosDisponibles.length > 0 && cargosDisponibles.every(c => !!solicitud.firmas[c]);
      if (directo || completa) {
        if (!directo && cargosDisponibles.length < 2 && !entrada.aceptarFaltaCargo) throw new ErrorEliminacion(`No hay una cuenta activa de ${cargosDisponibles.includes('Director') ? 'Secretaría' : 'Dirección'}. Se eliminará con la única firma disponible. ¿Continuar?`, 409, 'falta_contraparte');
        solicitud.estado = 'Eliminado';
        if (directo) solicitud.excepcion = rol === 'Desarrollador' ? 'Desarrollador' : 'Director fundador';
        else if (cargosDisponibles.length < 2) solicitud.excepcion = `Sin contraparte activa: firma de ${cargosDisponibles[0]}`;
      }
    }
    const revisores = activos.filter(u => ['Director', 'Secretario', 'Desarrollador'].includes(rolEliminacion(u.rol))).map(u => u.uid);
    solicitud.destinatarios = [...new Set([...solicitud.destinatarios, ...revisores, solicitud.solicitanteUid])];
    const pendientes = solicitud.estado === 'Pendiente';
    if (!pendientes) { solicitud.cerradaEn = ahora; solicitud.resueltaPor = uid; solicitud.resueltaPorNombre = usuario.nombre; }
    tx.set(db.doc(`solicitudes_eliminacion/${solicitud.id}`), solicitud);
    if (pendientes) tx.set(bloqueoRef, { solicitudId: solicitud.id, creadaEn: solicitud.creadaEn });
    else tx.delete(bloqueoRef);
    if (solicitud.estado === 'Eliminado') {
      tx.delete(registroRef);
      tx.set(db.doc(`registros_eliminados/${solicitud.tipo}__${solicitud.registroId}`), { solicitudId: solicitud.id, eliminadaEn: ahora });
      // Conservar historia de asistencia, pero no dejar cuentas apuntando a una
      // ficha inexistente. No se borran archivos externos de Drive ni cuentas.
      if (solicitud.tipo === 'integrantes') usuarios.filter(u => u.integranteId === solicitud.registroId).forEach(u => tx.update(db.doc(`usuarios/${u.uid}`), { integranteId: FieldValue.delete() }));
    }
    for (const destinatario of solicitud.destinatarios) {
      const pendienteRef = db.doc(`usuarios/${destinatario}/avisos/elim-${solicitud.id}-pendiente`);
      if (!pendientes) tx.delete(pendienteRef);
      const avisoId = `elim-${solicitud.id}-${pendientes ? 'pendiente' : 'cerrada'}`;
      const titulo = pendientes ? 'Autorización de eliminación' : `Solicitud: ${solicitud.estado}`;
      const mensaje = `${solicitud.titulo} · ${solicitud.tipo}. ${pendientes ? `Solicitada por ${solicitud.solicitanteNombre}. Esperando ${cargosDisponibles.filter(c => !solicitud.firmas[c]).join(' y ') || 'autorización'}.` : `Resuelta por ${usuario.nombre}.${solicitud.excepcion ? ` Excepción: ${solicitud.excepcion}.` : ''}`}`;
      tx.set(db.doc(`usuarios/${destinatario}/avisos/${avisoId}`), { id: avisoId, tipo: 'Eliminacion', titulo, mensaje, fecha: ahora, leido: false, accionId: solicitud.id });
      // La cola se entrega fuera de la transacción. El registro interno no
      // depende de un envío FCM exitoso ni de la preferencia del dispositivo.
      if (destinatario !== uid) tx.set(db.doc(`cola_avisos/${avisoId}-${destinatario}`), { uid: destinatario, solicitudId: solicitud.id, avisoId, categoria: 'Solicitudes de eliminación', titulo, mensaje, estado: 'pendiente', creadaEn: ahora });
      if (!pendientes) tx.delete(db.doc(`cola_avisos/elim-${solicitud.id}-pendiente-${destinatario}`));
    }
    return { solicitudId: solicitud.id, estado: solicitud.estado, mensaje: pendientes ? 'Solicitud enviada a Notificaciones. El registro permanece bloqueado hasta resolverla.' : `Solicitud ${solicitud.estado.toLowerCase()}.${solicitud.excepcion ? ` ${solicitud.excepcion}.` : ''}` };
  });
}
