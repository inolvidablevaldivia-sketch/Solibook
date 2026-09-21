'use client';

// Lectura segura de respuestas del endpoint /api/eliminaciones.
// El problema real de "Unexpected end of JSON input" ocurre cuando el
// cliente llama a .json() sobre una respuesta vacía, HTML o truncada
// (timeouts de Vercel, pantallas de despliegue, cortes de red, páginas
// 500/429/502 del proveedor). En esos casos no sabemos si la operación
// se ejecutó en el servidor, así que:
//  - No se reintenta (es una operación destructiva).
//  - Se indica revisar el registro y Notificaciones.
//  - Se distingue entre error de red, respuesta no JSON, y error de negocio.

export interface ResultadoEliminacion {
  ok: boolean;
  estado?: string;
  mensaje?: string;
  codigo?: string;
  errorServidor?: string;
  /** La respuesta llegó pero no se pudo interpretar (vacía, HTML, JSON inválido). */
  respuestaAmbigua?: boolean;
}

const MAX_BODY = 8192;

async function leerComoTexto(respuesta: Response): Promise<string> {
  try {
    const lector = respuesta.body?.getReader();
    if (!lector) return '';
    const trozos: Uint8Array[] = [];
    let bytes = 0;
    while (bytes < MAX_BODY) {
      const { done, value } = await lector.read();
      if (done) break;
      trozos.push(value);
      bytes += value.byteLength;
    }
    try { await lector.cancel(); } catch { /* ignorar */ }
    const total = new Uint8Array(bytes);
    let offset = 0;
    for (const trozo of trozos) {
      total.set(trozo, offset);
      offset += trozo.byteLength;
    }
    return new TextDecoder('utf8', { fatal: false }).decode(total);
  } catch {
    return '';
  }
}

export async function interpretarRespuestaEliminacion(respuesta: Response): Promise<ResultadoEliminacion> {
  const texto = await leerComoTexto(respuesta);

  if (!texto) {
    // Cuerpo vacío: 204, corte de red, timeout del proveedor, error sin body.
    return {
      ok: false,
      respuestaAmbigua: true,
      errorServidor: `Respuesta vacía del servidor (estado ${respuesta.status}). Revisa el registro en Notificaciones antes de reintentar.`
    };
  }

  // Detectar HTML (página de error Vercel / protección de despliegue / Cloudflare).
  const pareceHtml = /^\s*(<!doctype|<html|<head|<body|<!-)/i.test(texto);
  if (pareceHtml || !/^[\s]*[{[]/.test(texto.slice(0, 20))) {
    return {
      ok: false,
      respuestaAmbigua: true,
      errorServidor: `El servidor devolvió una página en lugar de JSON (estado ${respuesta.status}). Comprueba tu conexión y revisa el registro en Notificaciones.`
    };
  }

  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return {
      ok: false,
      respuestaAmbigua: true,
      errorServidor: 'La respuesta del servidor está incompleta o dañada. Revisa el registro en Notificaciones antes de reintentar.'
    };
  }

  if (!datos || typeof datos !== 'object') {
    return {
      ok: false,
      respuestaAmbigua: true,
      errorServidor: 'Respuesta inesperada del servidor. Revisa el registro en Notificaciones.'
    };
  }

  const d = datos as Record<string, unknown>;
  const estado = typeof d.estado === 'string' ? d.estado : undefined;
  const mensaje = typeof d.mensaje === 'string' ? d.mensaje : undefined;
  const codigo = typeof d.codigo === 'string' ? d.codigo : undefined;
  const error = typeof d.error === 'string' ? d.error : undefined;

  if (respuesta.ok && mensaje) {
    return { ok: true, estado, mensaje, codigo };
  }

  return {
    ok: false,
    estado,
    mensaje,
    codigo,
    errorServidor: error || (respuesta.status >= 500
      ? 'No se pudo completar la operación en el servidor. Revisa el registro en Notificaciones antes de reintentar.'
      : `Error del servidor (${respuesta.status}). Revisa el registro en Notificaciones.`)
  };
}
