import { NextResponse } from 'next/server';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import { prepararAvisoGestion } from '@/lib/prepararAvisoGestion';
import { enviarColaAvisos } from '@/lib/enviarColaAvisos';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    const { db, messaging } = obtenerFirebaseAdmin();
    // Recuperar avisos recientes incluso si el cliente se cerró antes de
    // solicitar su envío. No se reenvían cumpleaños ni avisos históricos.
    const recientes = await db.collection('notificaciones').where('fecha', '>=', new Date(Date.now() - 2 * 86400000).toISOString()).get();
    for (const aviso of recientes.docs) await prepararAvisoGestion(db, aviso.id);
    const resultado = await enviarColaAvisos(db, messaging);
    return NextResponse.json(resultado, { status: resultado.fallidos || resultado.incompleto ? 503 : 200 });
  } catch { return NextResponse.json({ error: 'No se pudieron procesar los avisos pendientes.' }, { status: 500 }); }
}
