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
  'gestionar_usuarios'
];

export const ROLES: RolUsuario[] = [
  'Director',
  'Secretario',
  'Tesorero',
  'Directiva',
  'Miembro',
  'Desarrollador'
];

// Roles con poder sobre cuentas: solo el Desarrollador —o el Director fundador,
// que opera con sus mismos permisos (ver rolEfectivo en AuthContext)— puede
// crear, modificar o suspender cuentas con estos roles (el Director administra
// al resto).
export const ROLES_SUPERIORES: RolUsuario[] = ['Director', 'Desarrollador'];

export const DESCRIPCION_ROL: Record<RolUsuario, string> = {
  Director:
    'Acceso total a la operación y administración de usuarios, excepto modificar cuentas de nivel Director o Desarrollador. El Director fundador (quien creó la cuenta inicial) actúa con los permisos de Desarrollador: administra cualquier cuenta, nombra Directores y elimina registros sin segunda firma.',
  Secretario: 'Gestión completa de la operación y registros, sin administrar usuarios ni roles.',
  Tesorero:
    'Gestión completa de la operación, sin administrar roles, sin agregar ni eliminar miembros y sin aprobar justificaciones.',
  Directiva:
    'Gestión de la operación, sin administrar roles, sin agregar ni eliminar miembros, sin aprobar justificaciones, sin dar acuse de recibo y sin eliminar documentos.',
  Miembro:
    'Consulta el calendario y puede justificar sus propias actividades futuras donde esté citado. El resto de la información está restringida.',
  Desarrollador:
    'Soporte técnico con acceso absoluto, incluida la administración de cuentas de cualquier nivel. El Director fundador comparte estos permisos sin cambiar de rol.'
};

// Permisos por diferencia respecto al acceso total, para mantener la matriz
// alineada con la definición acordada de cada rol.
const SIN_ADMINISTRAR_ROLES: Permiso[] = PERMISOS.filter(p => p !== 'gestionar_usuarios');

const TESORERO: Permiso[] = SIN_ADMINISTRAR_ROLES.filter(
  p =>
    p !== 'crear_miembro' &&
    p !== 'eliminar_miembro' &&
    p !== 'resolver_justificaciones'
);

const DIRECTIVA: Permiso[] = TESORERO.filter(
  p => p !== 'acuse_recibo' && p !== 'eliminar_documento'
);

const MIEMBRO: Permiso[] = ['ver_agenda'];

export const MATRIZ_PERMISOS: Record<RolUsuario, Permiso[]> = {
  Director: [...PERMISOS],
  Desarrollador: [...PERMISOS],
  Secretario: SIN_ADMINISTRAR_ROLES,
  Tesorero: TESORERO,
  Directiva: DIRECTIVA,
  Miembro: MIEMBRO
};

// Migración de roles antiguos guardados antes del nuevo modelo.
const ROLES_LEGADOS: Record<string, RolUsuario> = {
  Administrador: 'Director',
  Secretaria: 'Secretario'
};

// Convierte cualquier valor guardado (nuevo o antiguo) al rol vigente.
export const normalizarRol = (rol: string | undefined): RolUsuario => {
  if (!rol) return 'Miembro';
  if (rol in ROLES_LEGADOS) return ROLES_LEGADOS[rol];
  return (ROLES as string[]).includes(rol) ? (rol as RolUsuario) : 'Miembro';
};

export const tienePermiso = (rol: RolUsuario | string | undefined, permiso: Permiso): boolean => {
  if (!rol) return false;
  return MATRIZ_PERMISOS[normalizarRol(rol)]?.includes(permiso) ?? false;
};

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
  gestionar_usuarios: 'Gestionar usuarios'
};
