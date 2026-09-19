'use client';

// Utilidades para el manejo de enlaces externos (Google Drive y similares).
// La aplicación nunca sube archivos: solo guarda la dirección del documento.

// Agrega el protocolo cuando el usuario pega un enlace sin "https://".
export const normalizarEnlace = (url: string): string => {
  const limpio = (url || '').trim();
  if (!limpio) return '';
  if (/^https?:\/\//i.test(limpio)) return limpio;
  return `https://${limpio.replace(/^\/+/, '')}`;
};

// Verifica que sea una dirección utilizable con protocolo http o https.
export const esEnlaceValido = (url: string): boolean => {
  const normalizado = normalizarEnlace(url);
  if (!normalizado) return false;
  try {
    const parsed = new URL(normalizado);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export type ServicioEnlace = 'Docs' | 'Sheets' | 'Drive' | 'Dropbox' | 'OneDrive' | 'Enlace';

// Identifica el servicio para mostrar una etiqueta comprensible en la ficha.
export const detectarServicio = (url: string): ServicioEnlace => {
  const normalizado = normalizarEnlace(url).toLowerCase();
  if (!normalizado) return 'Enlace';

  if (normalizado.includes('docs.google.com/document')) return 'Docs';
  if (normalizado.includes('docs.google.com/spreadsheets')) return 'Sheets';
  if (normalizado.includes('drive.google.com')) return 'Drive';
  if (normalizado.includes('dropbox.com')) return 'Dropbox';
  if (normalizado.includes('onedrive.live.com') || normalizado.includes('1drv.ms')) return 'OneDrive';

  return 'Enlace';
};

// Advierte cuando un enlace de Drive apunta a una sesión personal (/u/) sin
// permiso de lectura compartido, caso en que otros usuarios no podrán abrirlo.
export const pareceEnlacePrivado = (url: string): boolean => {
  const normalizado = normalizarEnlace(url).toLowerCase();
  if (!normalizado.includes('drive.google.com')) return false;
  const tieneUsuarioFijo = /\/u\/\d+\//.test(normalizado);
  const estaCompartido = normalizado.includes('usp=sharing');
  return tieneUsuarioFijo && !estaCompartido;
};
