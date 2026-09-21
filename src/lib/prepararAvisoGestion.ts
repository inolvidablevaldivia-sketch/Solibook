import type { Firestore } from 'firebase-admin/firestore';
import { puedeJustificarPorOtros } from './justificaciones';

const CATEGORIAS: Record<string, string> = { Carta: 'Correspondencia', Acta: 'Actas', Justificacion: 'Justificaciones' };
// Copia un aviso existente a las bandejas de gestión y crea su cola push.
// El identificador de origen es único: reintentos no recrean colas ya enviadas.
export async function prepararAvisoGestion(db: Firestore, id: string) {
  return db.runTransaction(async tx => {
    const control = db.doc(`avisos_procesados/${id}`);
    const [previo, origen, usuarios] = await Promise.all([
      tx.get(control), tx.get(db.doc(`notificaciones/${id}`)), tx.get(db.collection('usuarios'))
    ]);
    if (previo.exists || !origen.exists) return false;
    const aviso = origen.data()!;
    const categoria = CATEGORIAS[aviso.tipo];
    // No enviar avisos históricos con fecha 'Ahora', ni cumpleaños/calendario.
    const fecha = Date.parse(aviso.fecha);
    if (!categoria || !Number.isFinite(fecha) || fecha > Date.now() + 60000 || Date.now() - fecha > 2 * 86400000) return false;
    for (const cuenta of usuarios.docs) {
      const usuario = cuenta.data();
      if (!usuario.activo || !puedeJustificarPorOtros(usuario.rol)) continue;
      const avisoId = id;
      tx.set(db.doc(`usuarios/${cuenta.id}/avisos/${avisoId}`), { ...aviso, id: avisoId });
      tx.set(db.doc(`cola_avisos/general-${avisoId}-${cuenta.id}`), { uid: cuenta.id, avisoId, solicitudId: `general-${id}`, categoria, titulo: aviso.titulo, mensaje: aviso.mensaje, estado: 'pendiente', creadaEn: new Date().toISOString() });
    }
    tx.set(control, { procesadoEn: new Date().toISOString() });
    return true;
  });
}
