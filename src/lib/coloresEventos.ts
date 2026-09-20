// Colores semánticos para que los tipos importantes se reconozcan en toda la
// aplicación. La comparación ignora mayúsculas y tildes para cubrir registros
// antiguos como "Presentacion" sin perder el tratamiento especial.

export type ClaveVisualEvento = 'ensayo' | 'presentacion' | 'concierto' | 'otro';

export interface EstiloEvento {
  clave: ClaveVisualEvento;
  etiqueta: string;
  chip: string;
  calendario: string;
  punto: string;
  acento: string;
  boton: string;
}

export const normalizarTipoEvento = (tipo: string): string =>
  (tipo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-CL');

export const obtenerEstiloEvento = (tipo: string): EstiloEvento => {
  const normalizado = normalizarTipoEvento(tipo);

  if (normalizado === 'presentacion') {
    return {
      clave: 'presentacion',
      etiqueta: 'Presentación',
      chip: 'bg-rose-100 text-[#9F1239] border border-rose-200',
      calendario: 'bg-rose-50 border-rose-300 text-[#9F1239]',
      punto: 'bg-[#B42335]',
      acento: 'border-l-[#B42335]',
      boton: 'bg-[#B42335] hover:bg-[#941F30] text-white'
    };
  }

  if (normalizado === 'concierto') {
    return {
      clave: 'concierto',
      etiqueta: 'Concierto',
      chip: 'bg-[#FFF3D6] text-[#805300] border border-[#F2D18C]',
      calendario: 'bg-[#FFF8E8] border-[#E6B95C] text-[#805300]',
      punto: 'bg-[#9A6700]',
      acento: 'border-l-[#9A6700]',
      boton: 'bg-[#9A6700] hover:bg-[#7D5300] text-white'
    };
  }

  if (normalizado === 'ensayo') {
    return {
      clave: 'ensayo',
      etiqueta: 'Ensayo',
      chip: 'bg-sky-100/70 text-[#0077B6] border border-sky-200',
      calendario: 'bg-sky-50/70 border-sky-300 text-[#0077B6]',
      punto: 'bg-[#0099DD]',
      acento: 'border-l-[#0099DD]',
      boton: 'bg-[#0077B6] hover:bg-[#0068A0] text-white'
    };
  }

  return {
    clave: 'otro',
    etiqueta: tipo || 'Actividad',
    chip: 'bg-amber-100/70 text-amber-900 border border-amber-200',
    calendario: 'bg-amber-50 border-amber-300 text-amber-900',
    punto: 'bg-amber-600',
    acento: 'border-l-amber-500',
    boton: 'bg-amber-700 hover:bg-amber-800 text-white'
  };
};
