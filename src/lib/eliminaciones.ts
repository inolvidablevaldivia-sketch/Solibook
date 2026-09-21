import type { RolUsuario } from '../types/index';

export const TIPOS_ELIMINACION = ['cartas', 'actas', 'documentos', 'integrantes'] as const;
export type TipoEliminacion = typeof TIPOS_ELIMINACION[number];
export type CargoFirma = 'Director' | 'Secretario';
export type AccionEliminacion = 'solicitar' | 'aprobar' | 'rechazar' | 'cancelar';
export interface FirmaEliminacion { uid: string; nombre: string; fecha: string }
export interface SolicitudEliminacion {
  id: string;
  tipo: TipoEliminacion;
  registroId: string;
  titulo: string;
  solicitanteUid: string;
  solicitanteNombre: string;
  creadaEn: string;
  estado: 'Pendiente' | 'Eliminado' | 'Rechazado' | 'Cancelado';
  firmas: Partial<Record<CargoFirma, FirmaEliminacion>>;
  destinatarios: string[];
  cerradaEn?: string;
  resueltaPor?: string;
  resueltaPorNombre?: string;
  excepcion?: string;
}
export function rolEliminacion(rol: string): RolUsuario | string {
  return rol === 'Administrador' ? 'Director' : rol === 'Secretaria' ? 'Secretario' : rol;
}
export function puedeSolicitarEliminacion(rol: string, tipo: TipoEliminacion): boolean {
  const cargo = rolEliminacion(rol);
  if (['Director', 'Secretario', 'Desarrollador'].includes(cargo)) return true;
  if (tipo === 'integrantes') return false;
  if (tipo === 'documentos') return cargo === 'Tesorero';
  return ['Tesorero', 'Directiva'].includes(cargo);
}
export interface EntradaEliminacion {
  accion: AccionEliminacion;
  tipo?: TipoEliminacion;
  registroId?: string;
  solicitudId?: string;
  aceptarFaltaCargo?: boolean;
}
export function validarEliminacion(datos: unknown): EntradaEliminacion {
  if (!datos || typeof datos !== 'object') throw new Error('Solicitud inválida.');
  const d = datos as Record<string, unknown>;
  if (!['solicitar', 'aprobar', 'rechazar', 'cancelar'].includes(String(d.accion))) throw new Error('Acción inválida.');
  const idValido = (id: unknown) => typeof id === 'string' && /^[\w-]{1,180}$/.test(id);
  if (d.accion === 'solicitar') {
    if (!TIPOS_ELIMINACION.includes(d.tipo as TipoEliminacion) || !idValido(d.registroId)) throw new Error('Registro inválido.');
  } else if (!idValido(d.solicitudId)) throw new Error('Solicitud inválida.');
  return { accion: d.accion as AccionEliminacion, ...(d.accion === 'solicitar' ? { tipo: d.tipo as TipoEliminacion, registroId: d.registroId as string } : { solicitudId: d.solicitudId as string }), aceptarFaltaCargo: d.aceptarFaltaCargo === true };
}
