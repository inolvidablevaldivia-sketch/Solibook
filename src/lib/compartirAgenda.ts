import { Evento } from '@/types';

export const fechaISODeHoy = (): string => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

const fechaDesdeCampo = (valor: string, limite: 'inicio' | 'fin'): Date =>
  new Date(`${valor || fechaISODeHoy()}T${limite === 'inicio' ? '00:00:00' : '23:59:59'}`);

export const filtrarEventosParaCompartir = (
  eventos: Evento[],
  desde: string,
  hasta: string,
  tiposSeleccionados: string[]
): Evento[] => {
  const inicio = fechaDesdeCampo(desde, 'inicio').getTime();
  const termino = fechaDesdeCampo(hasta, 'fin').getTime();
  const tipos = new Set(tiposSeleccionados);

  return eventos
    .filter(evento => {
      const fecha = new Date(evento.fechaHoraInicio).getTime();
      return fecha >= inicio && fecha <= termino && tipos.has(evento.tipo);
    })
    .sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime());
};

const formatoFechaRango = (valor: string): string =>
  new Date(`${valor}T12:00:00`).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

const formatoFechaEvento = (valor: string): string =>
  new Date(valor).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

const formatoHora = (valor: string): string =>
  new Date(valor).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

export const formatearEventoParaWhatsApp = (evento: Evento): string => {
  const lineas = [
    `*${formatoFechaEvento(evento.fechaHoraInicio).toLocaleUpperCase('es-CL')} — ${evento.tipo.toLocaleUpperCase('es-CL')}*`,
    `*${evento.titulo}*`,
    `${formatoHora(evento.fechaHoraInicio)} hrs${evento.lugarNombre ? ` · ${evento.lugarNombre}` : ''}`
  ];

  if (evento.direccion?.trim()) lineas.push(evento.direccion.trim());
  if (evento.notas?.trim()) lineas.push(evento.notas.trim());

  return lineas.join('\n');
};

export const formatearCalendarioParaWhatsApp = (
  eventos: Evento[],
  desde: string,
  hasta: string,
  tiposSeleccionados: string[]
): string => {
  const encabezado = [
    '*SOLÍ DEO — CALENDARIO DE ACTIVIDADES*',
    `*${formatoFechaRango(desde)} al ${formatoFechaRango(hasta)}*`,
    tiposSeleccionados.length > 0 ? `_Tipos: ${tiposSeleccionados.join(' · ')}_` : ''
  ].filter(Boolean);

  if (eventos.length === 0) return [...encabezado, '', '_No hay actividades en el rango seleccionado._'].join('\n');

  return [...encabezado, '', eventos.map(formatearEventoParaWhatsApp).join('\n\n')].join('\n');
};
