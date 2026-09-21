import type { Evento, Integrante, UsuarioApp } from '../types/index';
import { eventoJustificable, fechaActividadChile, puedeJustificarPorOtros } from './justificaciones';

export type VentanaCalendario = 'anterior' | 'mismo';
export interface PreferenciasCalendario {
  pushTipos?: Record<string, boolean>;
  antelacion?: 'anterior' | 'mismo' | 'ambos';
}

// Diferencia de fechas civiles, no de bloques de 24 h: respeta el horario de verano.
export function ventanaCalendario(evento: Evento, ahora: Date): VentanaCalendario | null {
  const inicio = Date.parse(evento.fechaHoraInicio);
  if (!Number.isFinite(inicio) || inicio <= ahora.getTime()) return null;
  const hoy = fechaActividadChile(ahora.toISOString());
  const fecha = fechaActividadChile(evento.fechaHoraInicio);
  const dias = (Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86400000;
  return dias === 0 ? 'mismo' : dias === 1 ? 'anterior' : null;
}

export function destinatarioCalendario(usuario: UsuarioApp, evento: Evento, ficha: Integrante | undefined, ahora: Date): boolean {
  if (!usuario.activo) return false;
  if (puedeJustificarPorOtros(usuario.rol)) return true;
  return usuario.rol === 'Miembro' && !!ficha && ficha.id === usuario.integranteId && eventoJustificable(evento, ficha, ahora.getTime());
}

export function permitePushCalendario(preferencias: PreferenciasCalendario, tipo: string, ventana: VentanaCalendario): boolean {
  if (preferencias.pushTipos?.[tipo] === false) return false;
  const antelacion = preferencias.antelacion ?? 'ambos';
  return antelacion === 'ambos' || antelacion === ventana;
}
