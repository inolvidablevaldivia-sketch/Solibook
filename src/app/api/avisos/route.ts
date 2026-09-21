import { after, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import { puedeJustificarPorOtros } from '@/lib/justificaciones';
import { puedeSolicitarEliminacion } from '@/lib/eliminaciones';
import { prepararAvisoGestion } from '@/lib/prepararAvisoGestion';
import { enviarColaAvisos } from '@/lib/enviarColaAvisos';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  // Solo admite un ID ya guardado; no recibe destinatarios, contenido ni roles.
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[\w-]{1,180}$/.test(id)) return NextResponse.json({ error: 'Aviso inválido.' }, { status: 400 });
  try {
    const { db, messaging } = obtenerFirebaseAdmin();
    let uid;
    try { uid = (await getAuth().verifyIdToken(token, true)).uid; }
    catch { return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 }); }
    const usuario = (await db.doc(`usuarios/${uid}`).get()).data();
    // Quien avisa de un duplicado es quien justifica por otros o quien puede
    // iniciar un pedido de borrado (el Ayudante del libro puede, y sólo avisar).
    if (!usuario?.activo || (!puedeJustificarPorOtros(usuario.rol) && !puedeSolicitarEliminacion(usuario.rol, 'cartas', usuario.atribuciones))) return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
    await prepararAvisoGestion(db, id);
    after(async () => { try { await enviarColaAvisos(db, messaging, `general-${id}`); } catch (e) { console.error('[Avisos] Pendiente de reintento:', e); } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'No se pudo preparar el push. El aviso interno se conserva.' }, { status: 500 }); }
}
