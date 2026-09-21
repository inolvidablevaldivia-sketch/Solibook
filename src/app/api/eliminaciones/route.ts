import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { after, NextResponse } from 'next/server';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import { enviarColaAvisos } from '@/lib/enviarColaAvisos';
import { validarEliminacion } from '@/lib/eliminaciones';
import { ErrorEliminacion, gestionarEliminacion } from '@/lib/gestionarEliminacion';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Todas las respuestas de esta ruta salen por aquí: cuerpo JSON serializado a
// mano y encabezados explícitos. Así el cliente (interpretarRespuestaEliminacion)
// nunca recibe un cuerpo vacío ni una página HTML del proveedor cuando algo
// falla dentro de nuestro código.
const ENCABEZADOS_JSON = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
} as const;

const responderJson = (cuerpo: Record<string, unknown>, status = 200) =>
  new NextResponse(JSON.stringify(cuerpo), { status, headers: ENCABEZADOS_JSON });

const responderError = (error: string, status: number, codigo?: string) =>
  responderJson(codigo ? { error, codigo } : { error }, status);

// La cola de avisos se entrega después de responder. Si `after()` no puede
// registrar la tarea, la cola queda en Firestore y el cron / el siguiente
// acceso la envía sin reintentar la eliminación.
function programarCola(db: Firestore, messaging: Messaging, solicitudId: string) {
  const ejecutar = async () => {
    try {
      await enviarColaAvisos(db, messaging, solicitudId);
    } catch (e) {
      console.error('[Push] La cola conserva los avisos para reintentar:', e);
    }
  };
  try {
    after(ejecutar);
  } catch (e) {
    console.warn('[Eliminaciones] after() no disponible, cola en segundo plano:', e);
    void ejecutar();
  }
}

// Lee el cuerpo con un tope de tamaño (evita cuerpos gigantescos) y sin
// depender de request.json(), que lanza errores poco claros con JSON inválido.
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
      if (bytes > 4096) {
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
    console.error('[Eliminaciones] Error al leer el cuerpo:', e);
    return { respuesta: responderError('No se pudo leer la solicitud.', 400) };
  }
}

async function procesar(request: Request): Promise<NextResponse> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return responderError('Inicia sesión para continuar.', 401);

  let db, messaging;
  try {
    ({ db, messaging } = obtenerFirebaseAdmin());
  } catch (e) {
    console.error('[Eliminaciones] Firebase Admin no está configurado:', e);
    return responderError('El servidor no está listo. Revisa la configuración de Firebase Admin en Vercel e inténtalo de nuevo.', 503);
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
    entrada = validarEliminacion(JSON.parse(cuerpo.texto || 'null'));
  } catch (e) {
    return responderError(e instanceof Error ? e.message : 'Solicitud inválida.', 400);
  }

  try {
    const resultado = await gestionarEliminacion(db, uid, entrada);
    programarCola(db, messaging, resultado.solicitudId);
    return responderJson(resultado);
  } catch (e) {
    if (e instanceof ErrorEliminacion) return responderError(e.message, e.status, e.codigo);
    console.error('[Eliminaciones] No se pudo completar:', e);
    return responderError('No se pudo completar la operación. Puedes reintentar sin duplicar la solicitud.', 500);
  }
}

export async function POST(request: Request) {
  // Red de seguridad global: cualquier excepción no prevista (bundle, runtime,
  // Firebase Admin, serialización) se convierte igualmente en JSON con estado
  // 500, en lugar de la respuesta vacía que el cliente no puede interpretar.
  try {
    return await procesar(request);
  } catch (e) {
    console.error('[Eliminaciones] Error inesperado:', e);
    return responderError('Error inesperado del servidor. Revisa el registro en Notificaciones antes de reintentar.', 500);
  }
}

// El endpoint solo opera por POST. Los demás métodos responden igualmente en
// JSON (405) para que una comprobación desde el navegador o un monitor nunca
// reciba una respuesta vacía.
export function GET() {
  return responderJson({ error: 'Método no permitido. Usa POST con Authorization: Bearer <token>.', servicio: 'eliminaciones' }, 405);
}
export { GET as PUT, GET as PATCH, GET as DELETE };
