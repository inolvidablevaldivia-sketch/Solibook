import { getAuth } from 'firebase-admin/auth';
import { after, NextResponse } from 'next/server';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import { enviarColaAvisos } from '@/lib/enviarColaAvisos';
import { validarEliminacion } from '@/lib/eliminaciones';
import { ErrorEliminacion, gestionarEliminacion } from '@/lib/gestionarEliminacion';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  try {
    const { db, messaging } = obtenerFirebaseAdmin();
    let uid;
    try { uid = (await getAuth().verifyIdToken(token, true)).uid; }
    catch { return NextResponse.json({ error: 'La sesión venció. Vuelve a iniciar sesión.' }, { status: 401 }); }
    const lector = request.body?.getReader();
    if (!lector) throw new ErrorEliminacion('Falta la solicitud.');
    const partes: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await lector.cancel(); throw new ErrorEliminacion('Solicitud demasiado grande.', 413); }
      partes.push(value);
    }
    let entrada;
    try { entrada = validarEliminacion(JSON.parse(Buffer.concat(partes).toString('utf8'))); }
    catch (e) { throw new ErrorEliminacion(e instanceof Error ? e.message : 'Solicitud inválida.'); }
    const resultado = await gestionarEliminacion(db, uid, entrada);
    after(async () => {
      try { await enviarColaAvisos(db, messaging, resultado.solicitudId); }
      catch (e) { console.error('[Push] La cola conserva los avisos para reintentar:', e); }
    });
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof ErrorEliminacion) return NextResponse.json({ error: e.message, codigo: e.codigo }, { status: e.status });
    console.error('[Eliminaciones] No se pudo completar:', e);
    return NextResponse.json({ error: 'No se pudo completar la operación. Puedes reintentar sin duplicar la solicitud.' }, { status: 500 });
  }
}
