'use client';

import type { Atribucion, RolUsuario } from '@/types';

import { permisosPorAtribuciones } from './atributos';

// Catálogo central de permisos de la aplicación.
export type Permiso =
  | 'ver_agenda'
  | 'crear_evento'
  | 'editar_evento'
  | 'eliminar_evento'
  | 'pasar_lista'
  | 'finalizar_lista'
  | 'gestionar_justificaciones' // registrar/corregir justificaciones
  | 'resolver_justificaciones' // aprobar o rechazar
  | 'ver_miembros'
  | 'crear_miembro'
  | 'editar_miembro'
  | 'eliminar_miembro'
  | 'ver_cartas'
  | 'gestionar_cartas'
  | 'ver_actas'
  | 'gestionar_actas'
  | 'ver_documentos'
  | 'gestionar_documentos' // crear y editar documentos institucionales
  | 'eliminar_documento'
  | 'acuse_recibo' // marcar "visto por" en cartas y justificaciones
  | 'ver_metricas'
  | 'exportar_datos'
  | 'ver_cuentas' // leer la pantalla de cuentas sin cambiar nada
  | 'aprobar_ingresos' // aceptar, vincular o rechazar una cuenta nueva
  | 'gestionar_usuarios';

export const PERMISOS: Permiso[] = [
  'ver_agenda',
  'crear_evento',
  'editar_evento',
  'eliminar_evento',
  'pasar_lista',
  'finalizar_lista',
  'gestionar_justificaciones',
  'resolver_justificaciones',
  'ver_miembros',
  'crear_miembro',
  'editar_miembro',
  'eliminar_miembro',
  'ver_cartas',
  'gestionar_cartas',
  'ver_actas',
  'gestionar_actas',
  'ver_documentos',
  'gestionar_documentos',
  'eliminar_documento',
  'acuse_recibo',
  'ver_metricas',
  'exportar_datos',
  'ver_cuentas',
  'aprobar_ingresos',
  'gestionar_usuarios'
];

export const ROLES: RolUsuario[] = [
  'Director',
  'Vocal',
  'Secretario',
  'Tesorero',
  'Administrativo',
  'Miembro',
  'Desarrollador'
];

// Cuentas que no pueden ser creadas, bajadas ni suspendidas por un Director
// que no sea fundador: tienen el peso de Dirección o la llave de la app. Incluir
// a 'Vocal' aquí es deliberado: nadie desarma la firma de un Vocal de rebote.
export const ROLES_SUPERIORES: RolUsuario[] = ['Director', 'Vocal', 'Desarrollador'];

export const DESCRIPCION_ROL: Record<RolUsuario, string> = {
  Director:
    'Toda la operación y la administración de cuentas de Secretaría, Tesorería, ayudantes y miembros. No borra por sí solo: los borrados de cartas, actas, documentos y fichas necesitan la firma de Secretaría. Para pasar el cargo ofrece el traspaso y espera la aceptación. El Director fundador actúa con los permisos de Desarrollador.',
  Vocal:
    'Director Vocal: agenda, ensayos, repertorio, listas y justificativos (los aprueba y rechaza); lee correspondencia y actas y puede acusar recibo. No administra cuentas, no borra registros y no mueve el libro de documentos. Su firma en el acta es la cuarta, opcional.',
  Secretario:
    'Toda la operación y los libros, sin administrar cuentas ni roles. Acepta los ingresos nuevos, corrige cartas y firma el cupo de Secretaría en actas y borrados.',
  Tesorero:
    'Lee la correspondencia y las actas y da acuse de recibo; tiene el libro de documentos y firma el acta (cupo obligatorio). Crea y edita fichas. La agenda y las listas son de Secretariado: si un día las necesita, se le concede como atribución.',
  Administrativo:
    'Ayudante de Secretaría o Tesorería: registra la operación (actividades, listas, cartas, actas en borrador, documentos y justificativos de otros). No cierra listas, no acusa recibo, no aprueba justificativos, no borra y no administra cuentas. Cada acción queda firmada con su nombre y cargo.',
  Miembro:
    'Ve las actividades en las que está citado, con sus enlaces, y justifica sus inasistencias futuras. No edita nada. Sus datos los mantiene la Secretaría.',
  Desarrollador:
    'Soporte técnico con acceso absoluto, incluidas las cuentas de cualquier nivel. El Director fundador comparte estos permisos sin cambiar de rol.'
};

// Permisos por diferencia respecto al acceso total, para mantener la matriz
// alineada con la definición acordada de cada cargo.
const SIN_ADMINISTRAR_CUENTAS: Permiso[] = PERMISOS.filter(p => p !== 'gestionar_usuarios');

// Lo que la Dirección hace en la agenda y los libros, sin administrar cuentas
// y sin cerrar borrados. Se le resta también lo que el Vocal no toca.
const SIN_LIBRO_DOCUMENTOS: Permiso[] = SIN_ADMINISTRAR_CUENTAS.filter(
  p => p !== 'ver_documentos' && p !== 'gestionar_documentos' && p !== 'eliminar_documento'
);

/** El Vocal escribe en agenda, listas y justificativos; lee los demás libros. */
const VOCAL: Permiso[] = SIN_LIBRO_DOCUMENTOS.filter(
  p =>
    p !== 'gestionar_cartas' &&
    p !== 'gestionar_actas' &&
    p !== 'eliminar_miembro' &&
    p !== 'ver_cuentas' &&
    p !== 'aprobar_ingresos'
);

/** El Tesorero mira, acusa y firma; la operación diaria es de Secretariado. */
const TESORERO: Permiso[] = [
  'ver_agenda',
  'ver_cartas',
  'acuse_recibo',
  'ver_actas',
  'ver_documentos',
  'gestionar_documentos',
  'eliminar_documento',
  'ver_miembros',
  'crear_miembro',
  'editar_miembro',
  'gestionar_justificaciones'
];

/** Ayudante: registra la operación, no la cierra ni la borra. */
const ADMINISTRATIVO: Permiso[] = [
  'ver_agenda',
  'crear_evento',
  'editar_evento',
  'pasar_lista',
  'gestionar_justificaciones',
  'ver_cartas',
  'gestionar_cartas',
  'ver_actas',
  'gestionar_actas',
  'ver_documentos',
  'gestionar_documentos',
  'ver_miembros',
  'crear_miembro',
  'editar_miembro'
];

const MIEMBRO: Permiso[] = ['ver_agenda'];

export const MATRIZ_PERMISOS: Record<RolUsuario, Permiso[]> = {
  Director: [...PERMISOS],
  Desarrollador: [...PERMISOS],
  Vocal: VOCAL,
  Secretario: [...SIN_ADMINISTRAR_CUENTAS],
  Tesorero: TESORERO,
  Administrativo: ADMINISTRATIVO,
  Miembro: MIEMBRO
};

// Migración de cargos guardados antes de este modelo.
const ROLES_LEGADOS: Record<string, RolUsuario> = {
  Administrador: 'Director',
  Secretaria: 'Secretario',
  // El asiento que se llamaba 'Directiva' hoy es 'Administrativo': describe a
  // los ayudantes y deja de confundirse con la «Cuerda Directiva».
  Directiva: 'Administrativo'
};

// Convierte cualquier valor guardado (nuevo o antiguo) al cargo vigente.
export const normalizarRol = (rol: string | undefined): RolUsuario => {
  if (!rol) return 'Miembro';
  if (rol in ROLES_LEGADOS) return ROLES_LEGADOS[rol];
  return (ROLES as string[]).includes(rol) ? (rol as RolUsuario) : 'Miembro';
};

export const tienePermiso = (rol: RolUsuario | string | undefined, permiso: Permiso): boolean => {
  if (!rol) return false;
  return MATRIZ_PERMISOS[normalizarRol(rol)]?.includes(permiso) ?? false;
};

/** Permisos reales de una cuenta: los de su cargo más las atribuciones vigentes. */
export const permisosEfectivos = (
  rol: RolUsuario | string | undefined,
  atribuciones?: Atribucion[],
  ahora = Date.now()
): Set<Permiso> => {
  const efectivos = new Set<Permiso>(MATRIZ_PERMISOS[normalizarRol(rol)] || []);
  for (const permiso of permisosPorAtribuciones(atribuciones, ahora)) efectivos.add(permiso);
  return efectivos;
};

export const puedeConAtribuciones = (
  rol: RolUsuario | string | undefined,
  permiso: Permiso,
  atribuciones?: Atribucion[],
  ahora = Date.now()
): boolean => permisosEfectivos(rol, atribuciones, ahora).has(permiso);

export const ETIQUETA_PERMISO: Record<Permiso, string> = {
  ver_agenda: 'Ver agenda',
  crear_evento: 'Crear evento',
  editar_evento: 'Editar evento',
  eliminar_evento: 'Eliminar evento',
  pasar_lista: 'Pasar lista',
  finalizar_lista: 'Finalizar lista',
  gestionar_justificaciones: 'Registrar justificaciones',
  resolver_justificaciones: 'Aprobar o rechazar justificaciones',
  ver_miembros: 'Ver miembros',
  crear_miembro: 'Crear miembro',
  editar_miembro: 'Editar miembro',
  eliminar_miembro: 'Eliminar miembro',
  ver_cartas: 'Ver cartas',
  gestionar_cartas: 'Gestionar cartas',
  ver_actas: 'Ver actas',
  gestionar_actas: 'Gestionar actas',
  ver_documentos: 'Ver documentos',
  gestionar_documentos: 'Gestionar documentos',
  eliminar_documento: 'Eliminar documentos',
  acuse_recibo: 'Dar acuse de recibo (visto)',
  ver_metricas: 'Ver métricas',
  exportar_datos: 'Exportar datos',
  ver_cuentas: 'Ver cuentas y cargos',
  aprobar_ingresos: 'Aceptar ingresos nuevos',
  gestionar_usuarios: 'Gestionar usuarios'
};
