import { getAuth } from 'firebase-admin/auth';
import { NextResponse } from 'next/server';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import { enviarColaAvisos } from '@/lib/enviarColaAvisos';
import { validarEliminacion } from '@/lib/eliminaciones';
import { ErrorEliminacion, gestionarEliminacion } from '@/lib/gestionarEliminacion';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Programar la cola de avisos sin depender de que `after()` exista en la
// ruta del runtime. Si el helper no está disponible o falla al registrar
// la tarea, la cola queda en Firestore y el cron / el siguiente acceso
// la envía sin reintentar la eliminación.
function programarCola(db: unknown, messaging: unknown, solicitudId: string) {
  const ejecutar = async () => {
    try {
      // @ts-expect-error – tipado dinámico para que una importación
      // defectuosa no tumbe la respuesta.
      await enviarColaAvisos(db, messaging, solicitudId);
    } catch (e) {
      console.error('[Push] La cola conserva los avisos para reintentar:', e);
    }
  };
  let after: ((fn: () => unknown) => void) | undefined;
  try {
    // Importación dinámica: si el bundle no incluyó `after` por alguna
    // razón (runtime edge, versión antigua, etc.) se usa setImmediate.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    after = require('next/server').after;
  } catch { /* no disponible */ }
  if (typeof after === 'function') {
    try { after(ejecutar); return; }
    catch (e) { console.warn('[Eliminaciones] after() no disponible, cola en segundo plano:', e); }
  }
  // Respaldo: no esperamos. La cola se entrega asíncronamente y el
  // cron la recupera si el proceso se cae antes.
  void ejecutar();
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });

  let db, messaging;
  try {
    ({ db, messaging } = obtenerFirebaseAdmin());
  } catch (e) {
    console.error('[Eliminaciones] Firebase Admin no está configurado:', e);
    return NextResponse.json({ error: 'El servidor no está listo. Revisa la configuración de Firebase Admin en Vercel e inténtalo de nuevo.' }, { status: 503 });
  }

  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(token, true)).uid;
  } catch {
    return NextResponse.json({ error: 'La sesión venció. Vuelve a iniciar sesión.' }, { status: 401 });
  }

  // Leer el cuerpo de forma defensiva. request.json() falla con un error
  // claro si el JSON es inválido; además limitamos el tamaño con un
  // lector manual para evitar cuerpos gigantescos (ataque DoS).
  const lector = request.body?.getReader();
  if (!lector) return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 });
  let texto: string;
  try {
    const partes: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        try { await lector.cancel(); } catch { /* ignorar */ }
        return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
      }
      partes.push(value);
    }
    const total = new Uint8Array(bytes);
    let offset = 0;
    for (const parte of partes) { total.set(parte, offset); offset += parte.byteLength; }
    texto = Buffer.from(total).toString('utf8');
  } catch (e) {
    console.error('[Eliminaciones] Error al leer el cuerpo:', e);
    return NextResponse.json({ error: 'No se pudo leer la solicitud.' }, { status: 400 });
  }

  let entrada;
  try {
    const parseado = JSON.parse(texto || 'null');
    entrada = validarEliminacion(parseado);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Solicitud inválida.' }, { status: 400 });
  }

  try {
    const resultado = await gestionarEliminacion(db, uid, entrada);
    programarCola(db, messaging, resultado.solicitudId);
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof ErrorEliminacion) {
      return NextResponse.json({ error: e.message, codigo: e.codigo }, { status: e.status });
    }
    console.error('[Eliminaciones] No se pudo completar:', e);
    return NextResponse.json({ error: 'No se pudo completar la operación. Puedes reintentar sin duplicar la solicitud.' }, { status: 500 });
  }
}
