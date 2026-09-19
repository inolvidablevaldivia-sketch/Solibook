'use client';

import { RolUsuario } from '@/types';

// Catálogo central de permisos de la aplicación.
export type Permiso =
  | 'ver_agenda'
  | 'crear_evento'
  | 'editar_evento'
  | 'eliminar_evento'
  | 'pasar_lista'
  | 'finalizar_lista'
  | 'gestionar_justificaciones'
  | 'ver_miembros'
  | 'crear_miembro'
  | 'editar_miembro'
  | 'eliminar_miembro'
  | 'ver_cartas'
  | 'gestionar_cartas'
  | 'ver_actas'
  | 'gestionar_actas'
  | 'ver_documentos'
  | 'gestionar_documentos'
  | 'ver_metricas'
  | 'exportar_datos'
  | 'gestionar_usuarios';

export const PERMISOS: Permiso[] = [
  'ver_agenda',
  'crear_evento',
  'editar_evento',
  'eliminar_evento',
  'pasar_lista',
  'finalizar_lista',
  'gestionar_justificaciones',
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
  'ver_metricas',
  'exportar_datos',
  'gestionar_usuarios'
];

export const ROLES: RolUsuario[] = ['Administrador', 'Directiva', 'Secretaria', 'Miembro'];

export const DESCRIPCION_ROL: Record<RolUsuario, string> = {
  Administrador: 'Acceso total al sistema, incluida la gestión de usuarios y permisos.',
  Directiva: 'Gestión completa de la operación, sin eliminar miembros ni administrar usuarios.',
  Secretaria: 'Gestión administrativa y de registros, sin eliminar miembros, eventos ni administrar usuarios.',
  Miembro: 'Acceso de solo lectura a la agenda, el listado de miembros, las actas y los documentos.'
};

// Permisos que definen la base de cada rol, expresados por diferencia respecto
// del rol inmediatamente superior para mantener la matriz legible.
const SIN_ELIMINAR_MIEMBRO_NI_USUARIOS: Permiso[] = PERMISOS.filter(
  p => p !== 'eliminar_miembro' && p !== 'gestionar_usuarios'
);

const SECRETARIA: Permiso[] = SIN_ELIMINAR_MIEMBRO_NI_USUARIOS.filter(
  p => p !== 'eliminar_evento'
);

const MIEMBRO: Permiso[] = ['ver_agenda', 'ver_miembros', 'ver_actas', 'ver_documentos'];

export const MATRIZ_PERMISOS: Record<RolUsuario, Permiso[]> = {
  Administrador: [...PERMISOS],
  Directiva: SIN_ELIMINAR_MIEMBRO_NI_USUARIOS,
  Secretaria: SECRETARIA,
  Miembro: MIEMBRO
};

export const tienePermiso = (rol: RolUsuario | undefined, permiso: Permiso): boolean => {
  if (!rol) return false;
  return MATRIZ_PERMISOS[rol]?.includes(permiso) ?? false;
};

export const ETIQUETA_PERMISO: Record<Permiso, string> = {
  ver_agenda: 'Ver agenda',
  crear_evento: 'Crear evento',
  editar_evento: 'Editar evento',
  eliminar_evento: 'Eliminar evento',
  pasar_lista: 'Pasar lista',
  finalizar_lista: 'Finalizar lista',
  gestionar_justificaciones: 'Gestionar justificaciones',
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
  ver_metricas: 'Ver métricas',
  exportar_datos: 'Exportar datos',
  gestionar_usuarios: 'Gestionar usuarios'
};
