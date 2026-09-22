import { getAuth } from 'firebase-admin/auth';
import { NextResponse } from 'next/server';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import { ejecutarMantenimiento } from '@/lib/gestionarMantenimiento';
import { ErrorMantenimiento, validarMantenimiento } from '@/lib/mantenimiento';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ENCABEZADOS_JSON = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
} as const;

const responderJson = (cuerpo: Record<string, unknown>, status = 200) =>
  new NextResponse(JSON.stringify(cuerpo), { status, headers: ENCABEZADOS_JSON });

const responderError = (error: string, status: number) => responderJson({ error }, status);

async function leerCuerpo(request: Request): Promise<{ texto: string } | { respuesta: NextResponse }> {
  const lector = request.body?.getReader();
  if (!lector) return { respuesta: responderError('Falta la solicitud.', 400) };
  try {
    const partes: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {
        try { await lector.cancel(); } catch { /* ignorar */ }
        return { respuesta: responderError('Solicitud demasiado grande.', 413) };
      }
      partes.push(value);
    }
    const total = new Uint8Array(bytes);
    let offset = 0;
    for (const parte of partes) { total.set(parte, offset); offset += parte.byteLength; }
    return { texto: Buffer.from(total).toString('utf8') };
  } catch (e) {
    console.error('[Mantenimiento] Error al leer el cuerpo:', e);
    return { respuesta: responderError('No se pudo leer la solicitud.', 400) };
  }
}

async function procesar(request: Request): Promise<NextResponse> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return responderError('Inicia sesión para continuar.', 401);

  let db;
  try {
    ({ db } = obtenerFirebaseAdmin());
  } catch (e) {
    console.error('[Mantenimiento] Firebase Admin no está configurado:', e);
    return responderError('El servidor no está listo. Revisa la configuración de Firebase Admin.', 503);
  }

  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(token, true)).uid;
  } catch {
    return responderError('La sesión venció. Vuelve a iniciar sesión.', 401);
  }

  const cuerpo = await leerCuerpo(request);
  if ('respuesta' in cuerpo) return cuerpo.respuesta;

  let entrada;
  try {
    entrada = validarMantenimiento(JSON.parse(cuerpo.texto || 'null'));
  } catch (e) {
    return responderError(e instanceof Error ? e.message : 'Solicitud inválida.', 400);
  }

  try {
    const resultado = await ejecutarMantenimiento(db, uid, entrada);
    return responderJson(resultado);
  } catch (e) {
    if (e instanceof ErrorMantenimiento) return responderError(e.message, e.status);
    console.error('[Mantenimiento] No se pudo completar:', e);
    return responderError('No se pudo completar la operación. Revisa el registro del servidor.', 500);
  }
}

export async function POST(request: Request) {
  try {
    return await procesar(request);
  } catch (e) {
    console.error('[Mantenimiento] Error inesperado:', e);
    return responderError('Error inesperado del servidor.', 500);
  }
}

export function GET() {
  return responderJson({ error: 'Método no permitido. Usa POST con Authorization: Bearer <token>.', servicio: 'mantenimiento' }, 405);
}
export { GET as PUT, GET as PATCH, GET as DELETE };
