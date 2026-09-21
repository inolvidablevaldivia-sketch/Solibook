import type { Evento, Integrante } from '../types/index';

export const MAX_EVENTOS_JUSTIFICACION = 20;
export const MAX_FOTO_JUSTIFICACION = 200_000;

export function puedeJustificarPorOtros(rol: string): boolean {
  return ['Director', 'Administrador', 'Secretario', 'Secretaria', 'Tesorero', 'Directiva', 'Desarrollador'].includes(rol);
}

export function eventoJustificable(evento: Evento, integrante: Integrante, ahora = Date.now()): boolean {
  if (integrante.estado !== 'Activo' || Date.parse(evento.fechaHoraInicio) <= ahora || !Number.isFinite(Date.parse(evento.fechaHoraInicio))) return false;
  if (evento.tipoConvocatoria === 'Todos') return true;
  if (evento.tipoConvocatoria === 'Por Cuerda') return evento.cuerdasConvocadas?.includes(integrante.cuerda) === true;
  if (evento.tipoConvocatoria === 'Personalizada') return evento.integrantesConvocadosIds?.includes(integrante.id) === true;
  return false;
}

export function fechaActividadChile(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export interface SolicitudJustificacion {
  integranteId: string;
  eventoIds: string[];
  motivo: string;
  adjuntoUrl?: string;
}
export function validarSolicitudJustificacion(valor: unknown): SolicitudJustificacion {
  if (!valor || typeof valor !== 'object') throw new Error('La solicitud no es válida.');
  const datos = valor as Record<string, unknown>;
  const idValido = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 180 && !id.includes('/') && id !== '.' && id !== '..';
  if (!idValido(datos.integranteId)) throw new Error('Selecciona un integrante válido.');
  if (!Array.isArray(datos.eventoIds) || !datos.eventoIds.length || datos.eventoIds.length > MAX_EVENTOS_JUSTIFICACION || !datos.eventoIds.every(idValido)) throw new Error(`Selecciona entre 1 y ${MAX_EVENTOS_JUSTIFICACION} actividades.`);
  if (typeof datos.motivo !== 'string' || !datos.motivo.trim() || datos.motivo.trim().length > 2000) throw new Error('Escribe un motivo de hasta 2000 caracteres.');
  if (datos.adjuntoUrl !== undefined && (typeof datos.adjuntoUrl !== 'string' || datos.adjuntoUrl.length > MAX_FOTO_JUSTIFICACION || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(datos.adjuntoUrl))) throw new Error('Adjunta una foto JPEG válida de hasta 200 KB una vez comprimida.');
  return { integranteId: datos.integranteId, eventoIds: [...new Set(datos.eventoIds)], motivo: datos.motivo.trim(), ...(datos.adjuntoUrl ? { adjuntoUrl: datos.adjuntoUrl as string } : {}) };
}
