import type { Autoria, OfertaCargo, RolUsuario, UsuarioApp } from '../types/index';

// ═══════════════════ Traspaso del cargo de Director ═══════════════════
// Cambiar de Director no puede depender de que alguien mueva un hilo central
// de la app. Un Director ofrece su cargo a una cuenta activa, la otra persona
// tiene 24 horas para aceptar, y recién ahí se hace el cambio en un solo paso:
// quien recibe asume como Director con todos los permisos del cargo, y quien lo
// ofreció pasa a Miembro. Si rechaza o no responde, no se toca nada y la
// oferta queda registrada como vencida.
//
// La cuenta fundadora queda fuera de este flujo a propósito: si el fundador se
// bajara del cargo con el mismo botón, la app se quedaría sin la llave para
// volver a ponerlo. Ese cambio lo hace un Desarrollador.

export const VENTANA_TRASPASO_MS = 24 * 60 * 60 * 1000;
export const CARGO_TRASPASABLE: RolUsuario = 'Director';
/** Cargo al que pasa quien ofrece, una vez aceptado el traspaso. */
export const CARGO_QUE_SE_CEDE: RolUsuario = 'Miembro';

export function ventanahMs(): number {
  return VENTANA_TRASPASO_MS;
}

/** Sólo quien ya es Director puede ofrecer su propio cargo. */
export function puedeOfrecerCargo(cuenta: Pick<UsuarioApp, 'rol' | 'activo'> | undefined, esFundador: boolean): boolean {
  return !!cuenta?.activo && cuenta.rol === CARGO_TRASPASABLE && !esFundador;
}

export function crearOferta(
  destino: Pick<UsuarioApp, 'uid'>,
  origen: Pick<UsuarioApp, 'uid' | 'nombre' | 'rol'>,
  ofrecidoPor: Autoria,
  ahora = Date.now(),
  ventanaMs: number = VENTANA_TRASPASO_MS
): OfertaCargo {
  return {
    id: `oferta-${origen.uid}`,
    desdeUid: origen.uid,
    desdeNombre: origen.nombre,
    ofrecidoPor,
    creadaEn: new Date(ahora).toISOString(),
    expiraEn: new Date(ahora + ventanaMs).toISOString(),
    estado: 'Pendiente',
    cargoOfrecido: CARGO_TRASPASABLE,
    cargoDeQuienOfrece: CARGO_QUE_SE_CEDE
  };
}

/** Estado vigente de la oferta: si pasó la ventana, se lee como Vencida. */
export function estadoVigente(
  oferta: Pick<OfertaCargo, 'estado' | 'expiraEn'> | undefined,
  ahora = Date.now()
): OfertaCargo['estado'] | undefined {
  if (!oferta) return undefined;
  if (oferta.estado !== 'Pendiente') return oferta.estado;
  const limite = Date.parse(oferta.expiraEn || '');
  return Number.isFinite(limite) && limite <= ahora ? 'Vencida' : 'Pendiente';
}

export function puedeResponder(oferta: OfertaCargo | undefined, uid: string, ahora = Date.now()): boolean {
  return !!oferta && oferta.estado === 'Pendiente' && estadoVigente(oferta, ahora) === 'Pendiente' && !!uid;
}

/**
 * Efecto de aceptar: dos cuentas cambian de cargo. Se devuelve el par completo
 * para que el llamador escriba ambos documentos y deje constancia en el
 * historial. Si el que ofrece ya no es Director, la oferta se anula sola.
 */
export function aplicarAceptacion(
  cuentaQueOfrece: Pick<UsuarioApp, 'uid' | 'rol'>,
  cuentaQueRecibe: Pick<UsuarioApp, 'uid' | 'rol'>,
  oferta: OfertaCargo,
  ahora = Date.now()
): { ofrece: { uid: string; rol: RolUsuario }; recibe: { uid: string; rol: RolUsuario } } | undefined {
  if (oferta.cargoOfrecido !== CARGO_TRASPASABLE) return undefined;
  if (cuentaQueOfrece.rol !== CARGO_TRASPASABLE) return undefined;
  if (estadoVigente(oferta, ahora) !== 'Pendiente') return undefined;
  return {
    ofrece: { uid: cuentaQueOfrece.uid, rol: oferta.cargoDeQuienOfrece || CARGO_QUE_SE_CEDE },
    recibe: { uid: cuentaQueRecibe.uid, rol: CARGO_TRASPASABLE }
  };
}

/** Cierre de la oferta sin cambio de cargos (rechazo, vencimiento o cancelación). */
export function cerrarOferta(
  oferta: OfertaCargo,
  estado: 'Rechazada' | 'Vencida' | 'Cancelada',
  ahora = Date.now()
): OfertaCargo {
  return { ...oferta, estado, resueltaEn: new Date(ahora).toISOString() };
}

/** Mensaje para la persona que recibió la oferta. */
export function textoOferta(oferta: OfertaCargo): string {
  return `${oferta.desdeNombre} te ofrece el cargo de Director. Si aceptas dentro del plazo, quedas como Director con todos sus permisos y ${oferta.desdeNombre} pasa a ${oferta.cargoDeQuienOfrece}. Si no respondes, todo sigue igual.`;
}
