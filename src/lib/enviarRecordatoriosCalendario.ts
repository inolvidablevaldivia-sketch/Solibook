import { createHash, randomUUID } from 'node:crypto';
import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import type { Evento, Integrante, NotificacionItem, UsuarioApp } from '@/types';
import { destinatarioCalendario, permitePushCalendario, ventanaCalendario, type PreferenciasCalendario } from './recordatoriosCalendario';

const hash = (partes: string[]) => createHash('sha256').update(JSON.stringify(partes)).digest('hex');
const INVALIDOS = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
interface Dispositivo { id: string; uid: string; token: string }

// Se reserva cada entrega por dispositivo, no el cron completo. Así una falla
// parcial no hace que los teléfonos ya atendidos reciban nuevamente el aviso.
export async function enviarRecordatoriosCalendario(db: Firestore, messaging: Messaging, ahora = new Date(), origen = 'https://solibook.vercel.app', reloj = () => new Date()) {
  const comienzo = Date.now();
  const ejecucion = randomUUID();
  const [eventosSnap, usuariosSnap, integrantesSnap, dispositivosSnap] = await Promise.all([
    db.collection('eventos').get(), db.collection('usuarios').where('activo', '==', true).get(),
    db.collection('integrantes').get(), db.collection('dispositivos_notificaciones').get()
  ]);
  const eventos = eventosSnap.docs.map(d => ({ ...d.data(), id: d.id } as Evento)).filter(e => ventanaCalendario(e, ahora));
  const usuarios = usuariosSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UsuarioApp));
  const integrantes = new Map(integrantesSnap.docs.map(d => [d.id, { ...d.data(), id: d.id } as Integrante]));
  const dispositivos = dispositivosSnap.docs.map(d => ({ ...d.data(), id: d.id } as Dispositivo)).filter(d => typeof d.token === 'string' && d.token.length > 0);
  const resumen = { avisosCreados: 0, enviados: 0, invalidos: 0, fallidos: 0, incompleto: false };

  for (const usuario of usuarios) {
    const ajustes = (await db.doc(`usuarios/${usuario.uid}/privado/ajustes`).get()).data() as PreferenciasCalendario | undefined;
    for (const evento of eventos) {
      if (Date.now() - comienzo > 45000) return { ...resumen, incompleto: true };
      const ventana = ventanaCalendario(evento, ahora)!;
      if (!destinatarioCalendario(usuario, evento, integrantes.get(usuario.integranteId || ''), ahora)) continue;
      const id = `cal-${hash([usuario.uid, evento.id, evento.fechaHoraInicio, ventana])}`;
      const titulo = `${ventana === 'mismo' ? 'Hoy' : 'Mañana'}: ${evento.titulo}`;
      const hora = new Date(evento.fechaHoraInicio).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const mensaje = `${hora}${evento.lugarNombre ? ` · ${evento.lugarNombre}` : ''}`;
      const aviso: NotificacionItem = { id, tipo: 'Calendario', titulo, mensaje, fecha: ahora.toISOString(), leido: false, accionId: evento.id };
      const avisoRef = db.doc(`usuarios/${usuario.uid}/avisos/${id}`);
      const resultadoAviso = await db.runTransaction(async tx => {
        const [existente, usuarioActual, eventoActual] = await Promise.all([
          tx.get(avisoRef), tx.get(db.doc(`usuarios/${usuario.uid}`)), tx.get(db.doc(`eventos/${evento.id}`))
        ]);
        const u = { ...usuarioActual.data(), uid: usuario.uid } as UsuarioApp;
        const ev = { ...eventoActual.data(), id: evento.id } as Evento;
        const fichaActual = u.integranteId ? await tx.get(db.doc(`integrantes/${u.integranteId}`)) : undefined;
        const ficha = fichaActual?.exists ? { ...fichaActual.data(), id: u.integranteId } as Integrante : undefined;
        if (!usuarioActual.exists || !eventoActual.exists || ev.fechaHoraInicio !== evento.fechaHoraInicio || ventanaCalendario(ev, reloj()) !== ventana || !destinatarioCalendario(u, ev, ficha, reloj())) return 'omitido';
        if (existente.exists) return 'existente';
        tx.set(avisoRef, { ...aviso, titulo: `${ventana === 'mismo' ? 'Hoy' : 'Mañana'}: ${ev.titulo}`, mensaje: `${hora}${ev.lugarNombre ? ` · ${ev.lugarNombre}` : ''}` });
        return 'creado';
      });
      if (resultadoAviso === 'omitido') continue;
      if (resultadoAviso === 'creado') resumen.avisosCreados++;
      // El aviso interno ya existe, incluso sin dispositivos o con push apagado.
      if (!permitePushCalendario(ajustes || {}, evento.tipo, ventana)) continue;
      const propios = [...new Map(dispositivos.filter(d => d.uid === usuario.uid).map(d => [d.token, d])).values()];
      for (let i = 0; i < propios.length; i += 500) {
        if (Date.now() - comienzo > 45000) return { ...resumen, incompleto: true };
        // Releer datos sensibles antes del envío: una cuenta suspendida, un
        // cambio de convocatoria o una cancelación no deben generar push obsoleto.
        const [uSnap, eSnap, pSnap] = await Promise.all([
          db.doc(`usuarios/${usuario.uid}`).get(), db.doc(`eventos/${evento.id}`).get(), db.doc(`usuarios/${usuario.uid}/privado/ajustes`).get()
        ]);
        const vigente = { ...eSnap.data(), id: evento.id } as Evento;
        const cuenta = { ...uSnap.data(), uid: usuario.uid } as UsuarioApp;
        const fichaSnap = cuenta.integranteId ? await db.doc(`integrantes/${cuenta.integranteId}`).get() : undefined;
        const ficha = fichaSnap?.exists ? { ...fichaSnap.data(), id: cuenta.integranteId } as Integrante : undefined;
        if (!uSnap.exists || !eSnap.exists || vigente.fechaHoraInicio !== evento.fechaHoraInicio || ventanaCalendario(vigente, reloj()) !== ventana || !destinatarioCalendario(cuenta, vigente, ficha, reloj()) || !permitePushCalendario(pSnap.data() || {}, vigente.tipo, ventana)) continue;
        const reservados: { dispositivo: Dispositivo; ref: DocumentReference }[] = [];
        for (const dispositivo of propios.slice(i, i + 500)) {
          if (Date.now() - comienzo > 40000) { resumen.incompleto = true; break; }
          const ref = db.doc(`envios_calendario/${hash([id, dispositivo.token])}`);
          const reservar = await db.runTransaction(async tx => {
            const [control, registrado] = await Promise.all([tx.get(ref), tx.get(db.doc(`dispositivos_notificaciones/${dispositivo.id}`))]);
            if (!registrado.exists || registrado.data()?.uid !== usuario.uid || registrado.data()?.token !== dispositivo.token) return false;
            const datos = control.data();
            if (datos?.estado === 'enviado' || datos?.estado === 'invalido' || datos?.reservadoHasta > Date.now()) return false;
            tx.set(ref, { estado: 'enviando', reservadoHasta: Date.now() + 5 * 60000, ejecucion, avisoId: id, uid: usuario.uid, actualizadoEn: new Date().toISOString() });
            return true;
          });
          if (reservar) reservados.push({ dispositivo, ref });
        }
        if (!reservados.length) continue;
        const registrar = async (ref: DocumentReference, estado: string) => db.runTransaction(async tx => {
          const control = await tx.get(ref);
          if (control.data()?.ejecucion === ejecucion) tx.update(ref, { estado, reservadoHasta: 0, actualizadoEn: new Date().toISOString() });
        });
        const ttl = Math.max(0, Math.floor((Date.parse(vigente.fechaHoraInicio) - reloj().getTime()) / 1000));
        if (!ttl) {
          await Promise.all(reservados.map(r => registrar(r.ref, 'invalido')));
          continue;
        }
        let resultado;
        try {
          resultado = await messaging.sendEachForMulticast({
            tokens: reservados.map(r => r.dispositivo.token),
            notification: { title: `${ventana === 'mismo' ? 'Hoy' : 'Mañana'}: ${vigente.titulo}`.slice(0, 180), body: `${hora}${vigente.lugarNombre ? ` · ${vigente.lugarNombre}` : ''}`.slice(0, 500) },
            data: { eventoId: evento.id, avisoId: id },
            webpush: { headers: { TTL: String(ttl) }, notification: { icon: '/icon-192.png', badge: '/icon-192.png', tag: id, renotify: false }, fcmOptions: { link: `${origen}/?vista=agenda` } }
          });
        } catch {
          resumen.fallidos += reservados.length;
          await Promise.all(reservados.map(r => registrar(r.ref, 'pendiente')));
          continue;
        }
        for (let j = 0; j < reservados.length; j++) {
          const { dispositivo, ref } = reservados[j];
          const respuesta = resultado.responses[j];
          if (respuesta.success) { resumen.enviados++; await registrar(ref, 'enviado'); }
          else if (INVALIDOS.includes(respuesta.error?.code || '')) {
            resumen.invalidos++;
            await registrar(ref, 'invalido');
            // Nunca eliminar un token que el dispositivo ya renovó.
            await db.runTransaction(async tx => {
              const deviceRef = db.doc(`dispositivos_notificaciones/${dispositivo.id}`);
              const actual = await tx.get(deviceRef);
              if (actual.data()?.token === dispositivo.token) tx.delete(deviceRef);
            });
          } else { resumen.fallidos++; await registrar(ref, 'pendiente'); }
        }
      }
    }
  }
  return resumen;
}
