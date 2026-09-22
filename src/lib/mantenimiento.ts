// Helpers puros del panel de mantenimiento. Sin Firebase Admin: el cliente
// los usa para mostrar títulos y el servidor para validar el cuerpo.

export const COLECCIONES_MANTENIMIENTO = [
  'integrantes',
  'eventos',
  'asistencias',
  'cartas',
  'actas',
  'justificaciones',
  'documentos',
  'documentos_evento',
  'notificaciones',
  'usuarios'
] as const;

export type ColeccionMantenimiento = (typeof COLECCIONES_MANTENIMIENTO)[number];

export const ACCIONES_MANTENIMIENTO = [
  'eliminar_registro',
  'descartar_solicitud',
  'limpiar_notificaciones_huerfanas',
  'limpiar_dispositivos'
] as const;

export type AccionMantenimiento = (typeof ACCIONES_MANTENIMIENTO)[number];

export class ErrorMantenimiento extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function esColeccionMantenimiento(valor: unknown): valor is ColeccionMantenimiento {
  return typeof valor === 'string' && (COLECCIONES_MANTENIMIENTO as readonly string[]).includes(valor);
}

export function tituloDeRegistro(datos: Record<string, unknown> | undefined, id: string): string {
  if (!datos) return id;
  const candidato =
    datos.titulo ||
    datos.asunto ||
    datos.nombreCompleto ||
    datos.nombre ||
    datos.folio ||
    datos.motivo ||
    datos.email ||
    datos.navegador ||
    id;
  return String(candidato).slice(0, 240);
}

export function confirmacionCoincide(esperado: string, recibido: unknown): boolean {
  if (typeof recibido !== 'string') return false;
  return esperado.trim() === recibido.trim() && esperado.trim().length > 0;
}

export function idValido(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 180 && !id.includes('/') && id !== '.' && id !== '..';
}

export function esOperadorMantenimiento(
  usuario: { rol?: string; activo?: boolean } | undefined,
  fundador: string | undefined,
  uid: string
): boolean {
  if (!usuario?.activo) return false;
  const rol =
    usuario.rol === 'Administrador' ? 'Director' : usuario.rol === 'Secretaria' ? 'Secretario' : usuario.rol === 'Directiva' ? 'Administrativo' : usuario.rol;
  return rol === 'Desarrollador' || (rol === 'Director' && fundador === uid);
}

export interface EntradaMantenimiento {
  accion: AccionMantenimiento;
  coleccion?: ColeccionMantenimiento;
  registroId?: string;
  solicitudId?: string;
  confirmacion: string;
}

export function validarMantenimiento(valor: unknown): EntradaMantenimiento {
  if (!valor || typeof valor !== 'object') throw new ErrorMantenimiento('La solicitud no es válida.');
  const datos = valor as Record<string, unknown>;
  if (!(ACCIONES_MANTENIMIENTO as readonly string[]).includes(String(datos.accion))) {
    throw new ErrorMantenimiento('Acción no reconocida.');
  }
  const accion = datos.accion as AccionMantenimiento;
  const confirmacion = typeof datos.confirmacion === 'string' ? datos.confirmacion : '';
  if (!confirmacion.trim()) throw new ErrorMantenimiento('Teclea el título del registro para confirmar.');
  if (accion === 'eliminar_registro') {
    if (!esColeccionMantenimiento(datos.coleccion) || !idValido(datos.registroId)) {
      throw new ErrorMantenimiento('Indica la colección y el registro a eliminar.');
    }
    return { accion, coleccion: datos.coleccion, registroId: datos.registroId, confirmacion };
  }
  if (accion === 'descartar_solicitud') {
    if (!idValido(datos.solicitudId) && !idValido(datos.registroId)) {
      throw new ErrorMantenimiento('Indica la solicitud a descartar.');
    }
    return {
      accion,
      solicitudId: idValido(datos.solicitudId) ? datos.solicitudId : undefined,
      registroId: idValido(datos.registroId) ? datos.registroId : undefined,
      confirmacion
    };
  }
  if (accion === 'limpiar_notificaciones_huerfanas') {
    if (!idValido(datos.registroId)) throw new ErrorMantenimiento('Indica la notificación huérfana a borrar.');
    return { accion, registroId: datos.registroId, confirmacion };
  }
  return { accion, confirmacion };
}
