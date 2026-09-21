import type { Atribucion, Autoria, RolUsuario } from '../types/index';
import { atribucionVigente } from './atributos';

export const TIPOS_ELIMINACION = ['cartas', 'actas', 'documentos', 'integrantes'] as const;
export type TipoEliminacion = typeof TIPOS_ELIMINACION[number];
/**
 * Los dos cupos que cierran un borrado. Tesorería y Vocalía firman el acta, pero
 * un borrado siempre lo autorizan Dirección y Secretaría: es el candado que no
 * se reparte.
 */
export type CargoFirma = 'Director' | 'Secretario';
export type AccionEliminacion = 'solicitar' | 'aprobar' | 'rechazar' | 'cancelar';
export interface FirmaEliminacion {
  uid: string;
  nombre: string;
  fecha: string;
  /** Cargo con el que firmó. Si ocupó el cupo por atribución, se ve aquí. */
  rol?: string;
}
export interface SolicitudEliminacion {
  id: string;
  tipo: TipoEliminacion;
  registroId: string;
  titulo: string;
  solicitanteUid: string;
  solicitanteNombre: string;
  /** Quién pidió el borrado, con su cargo. Los ayudantes quedan identificados. */
  solicitante?: Autoria;
  creadaEn: string;
  estado: 'Pendiente' | 'Eliminado' | 'Rechazado' | 'Cancelado';
  firmas: Partial<Record<CargoFirma, FirmaEliminacion>>;
  destinatarios: string[];
  cerradaEn?: string;
  resueltaPor?: string;
  resueltaPorNombre?: string;
  resueltaPorRol?: string;
  excepcion?: string;
}
export function rolEliminacion(rol: string): RolUsuario | string {
  return rol === 'Administrador' ? 'Director' : rol === 'Secretaria' ? 'Secretario' : rol === 'Directiva' ? 'Administrativo' : rol;
}

function tiene(atribuciones: Atribucion[] | undefined, atributo: string, ahora: number): boolean {
  return Array.isArray(atribuciones) && atribuciones.some(a => a.atributo === atributo && atribucionVigente(a, ahora));
}

/**
 * Quién puede iniciar un pedido de borrado. El límite es por libro, no por
 * persona: Dirección y Secretaría en todo; Tesorería sólo el libro de
 * documentos (es el suyo); los ayudantes avisan duplicados de cartas y actas;
 * el Vocal y el Miembro no piden borrados. Con la atribución
 * «solicitar_borrados» se amplía lo que corresponde.
 */
export function puedeSolicitarEliminacion(
  rol: string,
  tipo: TipoEliminacion,
  atribuciones?: Atribucion[],
  ahora = Date.now()
): boolean {
  const cargo = rolEliminacion(rol);
  if (['Director', 'Secretario', 'Desarrollador'].includes(cargo)) return true;
  if (tiene(atribuciones, 'solicitar_borrados', ahora)) return true;
  if (cargo === 'Tesorero') return tipo === 'documentos';
  if (cargo === 'Administrativo') return tipo === 'cartas' || tipo === 'actas';
  return false;
}

/**
 * Cupo que esta cuenta puede firmar en una solicitud: 'Director' si es Director
 * o si tiene la atribución delicada de ocuparlo, 'Secretario' si es Secretario
 * o tiene la suya. El Desarrollador y la cuenta fundadora no ocupan cupo: su
 * borrado es directo y queda anotado como excepción.
 */
export function cupoQueSePuedeFirmar(
  rol: string,
  atribuciones?: Atribucion[],
  ahora = Date.now()
): CargoFirma | undefined {
  const cargo = rolEliminacion(rol);
  if (cargo === 'Secretario') return 'Secretario';
  if (cargo === 'Director') return 'Director';
  if (tiene(atribuciones, 'cupo_secretaria', ahora)) return 'Secretario';
  if (tiene(atribuciones, 'cupo_direccion', ahora)) return 'Director';
  return undefined;
}

export function puedeResolverEliminacion(
  rol: string,
  atribuciones?: Atribucion[],
  ahora = Date.now()
): boolean {
  return rolEliminacion(rol) === 'Desarrollador' || cupoQueSePuedeFirmar(rol, atribuciones, ahora) !== undefined;
}

/** Si la cuenta todavía puede ocupar el cupo con el que firmó. */
export function firmaVigente(
  firma: FirmaEliminacion | undefined,
  cargo: CargoFirma,
  usuarios: { uid: string; rol: string; activo?: boolean; atribuciones?: Atribucion[] }[],
  ahora = Date.now()
): boolean {
  if (!firma?.uid) return false;
  const cuenta = usuarios.find(u => u.uid === firma.uid);
  if (!cuenta?.activo) return false;
  return cupoQueSePuedeFirmar(cuenta.rol, cuenta.atribuciones, ahora) === cargo;
}

/** Cuántas cuentas activas puede haber en cada cupo, para avisar si falta contraparte. */
export function cuposCubiertos(
  usuarios: { rol: string; activo?: boolean; atribuciones?: Atribucion[] }[],
  ahora = Date.now()
): CargoFirma[] {
  const disponibles = usuarios.filter(u => u.activo);
  return (['Director', 'Secretario'] as CargoFirma[]).filter(cargo =>
    disponibles.some(u => cupoQueSePuedeFirmar(u.rol, u.atribuciones, ahora) === cargo)
  );
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
