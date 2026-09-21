import type { Permiso } from './permisos';
import type { Atribucion, CupoFirma, RolUsuario } from '../types/index';

// ═══════════════════ Atribuciones ═══════════════════
// El cargo dice quién es la persona; la atribución suma poder sobre esa cuenta.
// Reglas del modelo, acordadas con la directiva:
//   · Sólo suman: una atribución nunca le quita algo al cargo. Si se necesita
//     «menos que Vocal», eso es otro cargo, no una casilla.
//   · Son por cuenta, no por cargo: mañana entra otro Vocal sin atribuciones y
//     no hereda el poder del que hoy hace también de Director.
//   · Pueden vencer, con motivo escrito: ayuda temporaria sin crear roles.
//   · Las delicadas (ocupar un cupo de firma o borrar) sólo las concede la
//     cuenta fundadora o un Desarrollador.
//   · No existe la casilla «gestionar usuarios» ni «borrar sin doble firma»:
//     eso se tiene por cargo o no se tiene.
//   · Si se retira la atribución, la firma ya puesta en una solicitud pendiente
//     deja de valer (ver `cupoVigente` en firestore.rules y lib/eliminaciones).

export type Atributo =
  | 'gestionar_agenda'
  | 'eliminar_agenda'
  | 'gestionar_listas'
  | 'cerrar_listas'
  | 'gestionar_cartas'
  | 'gestionar_actas'
  | 'ver_documentos'
  | 'subir_documentos'
  | 'acuse_recibo'
  | 'resolver_justificaciones'
  | 'ver_metricas'
  | 'ver_cuentas'
  | 'solicitar_borrados'
  | 'eliminar_documento'
  | 'eliminar_ficha'
  | 'cupo_direccion'
  | 'cupo_secretaria'
  | 'cupo_tesoreria';

interface DefinicionAtributo {
  etiqueta: string;
  descripcion: string;
  /** Permisos que suma sobre el cargo. */
  permisos: Permiso[];
  /** Sólo Dirección fundadora o Desarrollador pueden concederla. */
  delicada: boolean;
  /** Cupo de firma que habilita, si corresponde. */
  cupo?: CupoFirma;
}

export const ATRIBUCIONES: Record<Atributo, DefinicionAtributo> = {
  gestionar_agenda: {
    etiqueta: 'Crear y editar actividades',
    descripcion: 'Agenda, convocatorias, tipos de actividad y enlaces de la actividad.',
    permisos: ['crear_evento', 'editar_evento'],
    delicada: false
  },
  eliminar_agenda: {
    etiqueta: 'Eliminar actividades',
    descripcion: 'Borrar una actividad, sus futuras y los enlaces adjuntos. No pide segunda firma.',
    permisos: ['eliminar_evento'],
    delicada: false
  },
  gestionar_listas: {
    etiqueta: 'Pasar la lista de asistencia',
    descripcion: 'Marcar presente, ausente o justificado, y agregar o quitar personas de la lista.',
    permisos: ['pasar_lista'],
    delicada: false
  },
  cerrar_listas: {
    etiqueta: 'Cerrar la lista de asistencia',
    descripcion: 'Congela los conteos de una actividad. Después de cerrada sólo se corrige con doble firma.',
    permisos: ['finalizar_lista'],
    delicada: false
  },
  gestionar_cartas: {
    etiqueta: 'Registrar cartas',
    descripcion: 'Ingresar cartas recibidas y emitidas con folio, y corregir lo que se escribió mal.',
    permisos: ['gestionar_cartas'],
    delicada: false
  },
  gestionar_actas: {
    etiqueta: 'Redactar actas',
    descripcion: 'Escribir el borrador y cargar los acuerdos. Firmar es otro permiso.',
    permisos: ['gestionar_actas'],
    delicada: false
  },
  ver_documentos: {
    etiqueta: 'Leer el libro de documentos',
    descripcion: 'Ver los enlaces del libro institucional y abrirlos.',
    permisos: ['ver_documentos'],
    delicada: false
  },
  subir_documentos: {
    etiqueta: 'Subir documentos al libro',
    descripcion: 'Adjuntar enlaces nuevos al libro institucional. Borrarlos es otra atribución.',
    permisos: ['gestionar_documentos'],
    delicada: false
  },
  acuse_recibo: {
    etiqueta: 'Dar acuse de recibo',
    descripcion: 'Firmar el «visto» de cartas y justificativos. Queda con nombre, cargo y hora.',
    permisos: ['acuse_recibo'],
    delicada: false
  },
  resolver_justificaciones: {
    etiqueta: 'Aprobar o rechazar justificativos',
    descripcion: 'Cerrar la solicitud de un hermano. La resolución queda firmada.',
    permisos: ['resolver_justificaciones'],
    delicada: false
  },
  ver_metricas: {
    etiqueta: 'Ver métricas y exportar',
    descripcion: 'Dashboard de asistencia, Excel y PDF apaisado.',
    permisos: ['ver_metricas', 'exportar_datos'],
    delicada: false
  },
  ver_cuentas: {
    etiqueta: 'Ver cuentas y cargos',
    descripcion: 'Lee la pantalla de cuentas sin poder cambiar nada.',
    permisos: ['ver_cuentas'],
    delicada: false
  },
  solicitar_borrados: {
    etiqueta: 'Pedir borrados',
    descripcion: 'Inicia una solicitud de eliminación, que igual necesita Dirección y Secretaría.',
    permisos: [],
    delicada: true
  },
  eliminar_documento: {
    etiqueta: 'Cerrar el borrado de documentos',
    descripcion: 'Ocupa el cupo de Dirección para eliminar un documento del libro.',
    permisos: ['eliminar_documento'],
    delicada: true
  },
  eliminar_ficha: {
    etiqueta: 'Eliminar fichas de personas',
    descripcion: 'Ocupa el cupo de Dirección para bajar una ficha del directorio.',
    permisos: ['eliminar_miembro'],
    delicada: true
  },
  cupo_direccion: {
    etiqueta: 'Firmar como Dirección',
    descripcion: 'Ocupa el cupo de Dirección en actas y solicitudes de borrado.',
    permisos: [],
    delicada: true,
    cupo: 'Director'
  },
  cupo_secretaria: {
    etiqueta: 'Firmar como Secretaría',
    descripcion: 'Ocupa el cupo de Secretaría en actas y solicitudes de borrado.',
    permisos: [],
    delicada: true,
    cupo: 'Secretario'
  },
  cupo_tesoreria: {
    etiqueta: 'Firmar como Tesorería',
    descripcion: 'Ocupa el cupo de Tesorería, obligatorio para cerrar un acta.',
    permisos: [],
    delicada: true,
    cupo: 'Tesorero'
  }
};

export const LISTA_ATRIBUTOS = Object.keys(ATRIBUCIONES) as Atributo[];

export function etiquetaAtributo(atributo: string): string {
  return ATRIBUCIONES[atributo as Atributo]?.etiqueta || atributo;
}

export function esAtributoDelicado(atributo: string): boolean {
  return ATRIBUCIONES[atributo as Atributo]?.delicada === true;
}

export function esAtributo(atributo: unknown): atributo is Atributo {
  return typeof atributo === 'string' && Object.prototype.hasOwnProperty.call(ATRIBUCIONES, atributo);
}

/** Una atribución está vigente si no fue revocada y su plazo no venció. */
export function atribucionVigente(atribucion: Atribucion | undefined, ahora = Date.now()): boolean {
  if (!atribucion?.atributo) return false;
  if (!esAtributo(atribucion.atributo)) return false;
  if (atribucion.hasta) {
    const limite = Date.parse(atribucion.hasta);
    if (!Number.isFinite(limite) || limite <= ahora) return false;
  }
  return true;
}

export function atribucionesVigentes(lista: Atribucion[] | undefined, ahora = Date.now()): Atribucion[] {
  if (!Array.isArray(lista)) return [];
  return lista.filter(a => atribucionVigente(a, ahora));
}

/** Permisos extra que otorgan las atribuciones vigentes de una cuenta. */
export function permisosPorAtribuciones(
  lista: Atribucion[] | undefined,
  ahora = Date.now()
): Set<Permiso> {
  const permisos = new Set<Permiso>();
  for (const atribucion of atribucionesVigentes(lista, ahora)) {
    for (const permiso of ATRIBUCIONES[atribucion.atributo as Atributo]?.permisos || []) permisos.add(permiso);
  }
  return permisos;
}

/**
 * Quién puede ocupar cada cupo de firma. El de Dirección lo da el cargo de
 * Director (o el Desarrollador y la cuenta fundadora, que operan con sus
 * permisos); el Vocal necesita la atribución. El de Vocalía es propio del
 * cargo de Vocal y es el único que no se puede prestar.
 */
export function puedeOcuparCupo(
  rol: RolUsuario | string | undefined,
  cupo: CupoFirma,
  atribuciones?: Atribucion[],
  ahora = Date.now()
): boolean {
  const vigente = atribucionesVigentes(atribuciones, ahora).map(a => a.atributo);
  switch (cupo) {
    case 'Director':
      return rol === 'Director' || rol === 'Desarrollador' || vigente.includes('cupo_direccion');
    case 'Secretario':
      return rol === 'Secretario' || vigente.includes('cupo_secretaria');
    case 'Tesorero':
      return rol === 'Tesorero' || vigente.includes('cupo_tesoreria');
    case 'Vocal':
      return rol === 'Vocal';
  }
}

/** Cupo que habilita una atribución, para validar el traspaso de firma. */
export function cupoDe(atributo: string): CupoFirma | undefined {
  return ATRIBUCIONES[atributo as Atributo]?.cupo;
}
