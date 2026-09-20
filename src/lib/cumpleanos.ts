// Cálculos de cumpleaños compartidos por Inicio, los avisos internos y el
// envío programado de notificaciones. Las fechas de nacimiento son YYYY-MM-DD.

export interface ProximoCumpleanos {
  fecha: Date;
  diasRestantes: number;
  anioNacimiento: number;
}

const esBisiesto = (anio: number) => anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);

const parsearFechaNacimiento = (valor?: string): [number, number, number] | null => {
  if (!valor) return null;
  const partes = valor.split('-').map(Number);
  if (partes.length !== 3 || partes.some(n => Number.isNaN(n))) return null;
  const [anio, mes, dia] = partes;
  if (anio < 1900 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return [anio, mes, dia];
};

const fechaCumpleanosEnAnio = (anio: number, mes: number, dia: number): Date => {
  // Quienes nacieron el 29 de febrero celebran el 28 en años no bisiestos.
  const diaAjustado = mes === 2 && dia === 29 && !esBisiesto(anio) ? 28 : dia;
  return new Date(anio, mes - 1, diaAjustado);
};

const inicioDia = (fecha: Date): Date => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

const diasCalendarioEntre = (inicio: Date, fin: Date): number => {
  const utcInicio = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const utcFin = Date.UTC(fin.getFullYear(), fin.getMonth(), fin.getDate());
  return Math.round((utcFin - utcInicio) / 86400000);
};

export const obtenerProximoCumpleanos = (
  fechaNacimiento?: string,
  referencia: Date = new Date()
): ProximoCumpleanos | null => {
  const partes = parsearFechaNacimiento(fechaNacimiento);
  if (!partes) return null;

  const [anioNacimiento, mes, dia] = partes;
  const hoy = inicioDia(referencia);
  let proximo = fechaCumpleanosEnAnio(hoy.getFullYear(), mes, dia);
  if (proximo.getTime() < hoy.getTime()) {
    proximo = fechaCumpleanosEnAnio(hoy.getFullYear() + 1, mes, dia);
  }

  return {
    fecha: proximo,
    diasRestantes: diasCalendarioEntre(hoy, proximo),
    anioNacimiento
  };
};

export const cumpleanosCorrespondeAFecha = (
  fechaNacimiento: string | undefined,
  anio: number,
  mes: number,
  dia: number
): boolean => {
  const partes = parsearFechaNacimiento(fechaNacimiento);
  if (!partes) return false;
  const [, mesNacimiento, diaNacimiento] = partes;
  if (mesNacimiento !== mes) return false;
  if (mesNacimiento === 2 && diaNacimiento === 29 && !esBisiesto(anio)) return dia === 28;
  return diaNacimiento === dia;
};

export const fechaChile = (referencia: Date = new Date()): { anio: number; mes: number; dia: number } => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(referencia);

  const obtener = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find(p => p.type === tipo)?.value || 0);
  return { anio: obtener('year'), mes: obtener('month'), dia: obtener('day') };
};
