import { NextResponse } from 'next/server';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import { enviarRecordatoriosCalendario } from '@/lib/enviarRecordatoriosCalendario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    const { db, messaging } = obtenerFirebaseAdmin();
    const origen = new URL(process.env.APP_URL || 'https://solibook.vercel.app').origin;
    if (!origen.startsWith('https://')) throw new Error('APP_URL debe usar HTTPS.');
    const resultado = await enviarRecordatoriosCalendario(db, messaging, new Date(), origen);
    return NextResponse.json({ ok: !resultado.incompleto && !resultado.fallidos, ...resultado }, { status: resultado.incompleto || resultado.fallidos ? 503 : 200 });
  } catch (error) {
    console.error('[Cron calendario] Error de ejecución:', error);
    return NextResponse.json({ error: 'No se pudieron completar los recordatorios.' }, { status: 500 });
  }
}
