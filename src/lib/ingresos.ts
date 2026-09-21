import type { Atribucion, EstadoIngreso, Integrante, UsuarioApp } from '../types/index';
import type { Permiso } from './permisos';
import { puedeConAtribuciones } from './permisos';

/**
 * Decisión única para cliente y servidor: ¿esta cuenta puede con este permiso?
 * Son los permisos del cargo más las atribuciones vigentes, y exige que el
 * ingreso esté aceptado: una cuenta pendiente no puede con nada del ministerio.
 */
export function puede(
  cuenta: Partial<UsuarioApp> | null | undefined,
  permiso: Permiso,
  ahora = Date.now()
): boolean {
  if (!cuenta || cuenta.activo === false) return false;
  if (!puedeIngresar(cuenta, ahora)) return false;
  return puedeConAtribuciones(cuenta.rol, permiso, cuenta.atribuciones, ahora);
}

// ═══════════════════ Ingresos nuevos ═══════════════════
// Antes, cualquiera que entraba con su cuenta de Google quedaba adentro como
// Miembro y leía el calendario completo. Hoy la cuenta nace 'Pendiente': la
// persona ve una pantalla de espera y Dirección o Secretaría deciden. Si en 30
// días nadie responde, el pedido pasa a 'Sin respuesta' para que la lista no se
// llene de basura; la cuenta no se borra, queda en el historial.

export const DIAS_HASTA_VENCIMIENTO = 30;
export const MS_HASTA_VENCIMIENTO = DIAS_HASTA_VENCIMIENTO * 24 * 60 * 60 * 1000;

/** Estado de alta. Las cuentas anteriores a este flujo ya estaban aceptadas. */
export function estadoIngreso(cuenta: Partial<UsuarioApp> | null | undefined): EstadoIngreso {
  return cuenta?.estadoIngreso || 'Aceptado';
}

/** Estado real, incluyendo la caducidad por fecha (sin reescribir el documento). */
export function estadoVigente(
  cuenta: Partial<UsuarioApp> | null | undefined,
  ahora = Date.now()
): EstadoIngreso {
  const estado = estadoIngreso(cuenta);
  if (estado === 'Pendiente' && cuenta && estaVencidoIngreso(cuenta, ahora)) return 'Sin respuesta';
  return estado;
}

export function puedeIngresar(
  cuenta: Partial<UsuarioApp> | null | undefined,
  ahora = Date.now()
): boolean {
  return estadoVigente(cuenta, ahora) === 'Aceptado';
}

/** Quién acepta o rechaza: Dirección y Secretaría (y quien tenga el permiso). */
export function puedeGestionarIngresos(
  rol: string | undefined,
  atribuciones?: Atribucion[],
  ahora = Date.now()
): boolean {
  return puedeConAtribuciones(rol, 'aprobar_ingresos', atribuciones, ahora);
}

/** Cuándo caduca un pedido pendiente. */
export function fechaVencimiento(desdeIso: string | undefined, ahora = Date.now()): string {
  const desde = Date.parse(desdeIso || '');
  return new Date((Number.isFinite(desde) ? desde : ahora) + MS_HASTA_VENCIMIENTO).toISOString();
}

/** Días que quedan antes de que el pedido caduque. Negativo si ya venció. */
export function diasRestantes(cuenta: Partial<UsuarioApp>, ahora = Date.now()): number {
  const inicio = Date.parse(cuenta.fechaIngreso || '');
  if (!Number.isFinite(inicio)) return DIAS_HASTA_VENCIMIENTO;
  return Math.ceil((inicio + MS_HASTA_VENCIMIENTO - ahora) / (24 * 60 * 60 * 1000));
}

export function estaVencidoIngreso(
  cuenta: Partial<UsuarioApp>,
  ahora = Date.now()
): boolean {
  if (estadoIngreso(cuenta) !== 'Pendiente') return false;
  const inicio = Date.parse(cuenta.fechaIngreso || '');
  return Number.isFinite(inicio) && inicio + MS_HASTA_VENCIMIENTO <= ahora;
}

/**
 * Un ingreso pendiente suele corresponder a una ficha que Secretaría ya tiene
 * creada a mano. Se sugiere por correo o por nombre exacto, pero nunca se
 * vincula solo: lo decide una persona.
 */
export function sugerirFicha(
  cuenta: Pick<UsuarioApp, 'email' | 'nombre'>,
  integrantes: Integrante[]
): Integrante | undefined {
  const correo = (cuenta.email || '').trim().toLowerCase();
  if (correo) {
    const porCorreo = integrantes.find(i => (i.email || '').trim().toLowerCase() === correo);
    if (porCorreo) return porCorreo;
  }
  const nombre = (cuenta.nombre || '').trim().toLowerCase();
  if (!nombre) return undefined;
  return integrantes.find(i => (i.nombreCompleto || '').trim().toLowerCase() === nombre);
}

/** Ficha nueva a partir del ingreso, con lo mínimo para no perder al alguien. */
export function fichaDesdeCuenta(
  cuenta: Pick<UsuarioApp, 'nombre' | 'email'>,
  extra: Partial<Pick<Integrante, 'cuerda' | 'iglesia' | 'telefono'>> = {}
): Omit<Integrante, 'id'> {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    nombreCompleto: (cuenta.nombre || '').trim() || 'Sin nombre',
    telefono: extra.telefono || '',
    email: cuenta.email || '',
    direccion: '',
    iglesia: extra.iglesia || '',
    cuerda: extra.cuerda || 'Directiva',
    estado: 'Activo',
    fechaIngreso: hoy,
    notas: 'Ficha creada al aceptar el ingreso a la app.'
  };
}

/** Mensaje que ve la persona mientras espera. Sin promesas vacías. */
export function mensajeEspera(estado: EstadoIngreso): string {
  switch (estado) {
    case 'Pendiente':
      return 'Tu cuenta está registrada. Dirección o Secretaría debe aceptarte para que puedas ver el calendario.';
    case 'Rechazado':
      return 'Este ingreso no fue aceptado. Habla con Dirección para revisar el dato.';
    case 'Sin respuesta':
      return 'La solicitud venció sin respuesta. Vuelve a entrar y avisa a Dirección para que la retome.';
    default:
      return '';
  }
}
