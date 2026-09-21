import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { NextResponse } from 'next/server';
import { obtenerFirebaseAdmin } from '@/lib/firebaseAdmin';
import {
  aplicarAceptacion,
  cerrarOferta,
  crearOferta,
  estadoVigente,
  puedeOfrecerCargo
} from '@/lib/traspasos';
import type { Autoria, OfertaCargo, UsuarioApp } from '@/types';

export const runtime = 'nodejs';

// El traspaso de la Dirección se concreta aquí, y sólo aquí, porque toca dos
// cuentas a la vez: si se hiciera desde el cliente, una de las dos escrituras
// podría perderse y quedaríamos con dos Directores (o con ninguno). Además la
// cuenta fundadora no se ofrece a sí misma: eso lo sabe sólo el servidor.

const responder = (cuerpo: Record<string, unknown>, status = 200) =>
  new NextResponse(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

const ENCABEZADO = /^Bearer (.+)$/;

async function identidadDe(request: Request): Promise<string | undefined> {
  const token = request.headers.get('authorization')?.match(ENCABEZADO)?.[1];
  if (!token) return undefined;
  try {
    return (await getAuth().verifyIdToken(token, true)).uid;
  } catch {
    return undefined;
  }
}

const idConstancia = (origenUid: string, destinoUid: string, ahora: number) =>
  `traspaso-${createHash('sha256').update(`${origenUid}|${destinoUid}|${Math.floor(ahora / 600000)}`).digest('hex').slice(0, 24)}`;

export async function POST(request: Request) {
  const uid = await identidadDe(request);
  if (!uid) return responder({ error: 'Inicia sesión para ofrecer o responder el cargo.' }, 401);

  let cuerpo: { accion?: string; destinoUid?: string };
  try {
    const texto = await request.text();
    if (texto.length > 2048) return responder({ error: 'La solicitud es demasiado grande.' }, 413);
    cuerpo = JSON.parse(texto || '{}');
  } catch {
    return responder({ error: 'No se entendió la solicitud.' }, 400);
  }
  const accion = cuerpo.accion;
  if (!['ofrecer', 'aceptar', 'rechazar'].includes(accion || '')) return responder({ error: 'Acción no reconocida.' }, 400);

  try {
    const { db } = obtenerFirebaseAdmin();
    const resultado = await db.runTransaction(async tx => {
      const ahora = Date.now();
      const docs = await tx.get(db.collection('usuarios'));
      const cuentas = new Map<string, UsuarioApp>();
      docs.forEach(snap => cuentas.set(snap.id, { ...(snap.data() as object), uid: snap.id } as UsuarioApp));
      const fundador = (await tx.get(db.doc('configuracion/estado'))).data()?.fundador as string | undefined;

      const autor = cuentas.get(uid);
      if (!autor?.activo) throw new Error('Tu cuenta no está activa.');
      const iso = new Date(ahora).toISOString();
      const firma = (rol: string): Autoria => ({ uid, nombre: autor.nombre, rol, fecha: iso });

      if (accion === 'ofrecer') {
        // Sólo quien hoy es Director ofrece, y nunca la cuenta fundadora.
        if (!puedeOfrecerCargo(autor, fundador === uid)) throw new Error('Sólo quien tiene la Dirección puede ofrecerla.');
        const destinoUid = String(cuerpo.destinoUid || '');
        const destino = cuentas.get(destinoUid);
        if (!destino?.activo) throw new Error('La persona que recibe la oferta no tiene una cuenta activa.');
        if (estadoVigente(destino.ofertaDirector, ahora) !== undefined && destino.ofertaDirector?.estado === 'Pendiente') {
          throw new Error('Esa persona ya tiene una oferta esperando respuesta.');
        }
        const oferta = crearOferta({ uid: destinoUid }, autor, firma(autor.rol), ahora);
        tx.set(db.doc(`usuarios/${destinoUid}`), { ofertaDirector: oferta }, { merge: true });
        // La oferta queda también en quien la envía, para poder mostrarla como enviada.
        tx.set(db.doc(`usuarios/${uid}`), { ofertaDirectorEmitida: oferta }, { merge: true });
        tx.set(db.doc(`usuarios/${destinoUid}/avisos/notif-oferta`), {
          id: 'notif-oferta',
          tipo: 'Cuenta',
          titulo: 'Te ofrecen la Dirección',
          mensaje: `${autor.nombre} te ofrece el cargo de Director. Tienes 24 horas para responder.`,
          fecha: iso,
          leido: false
        });
        return { mensaje: 'Oferta enviada. Tienes 24 horas de espera: si no responde, todo sigue igual.' };
      }

      // Responder una oferta: la leemos de la cuenta propia.
      const oferta = autor.ofertaDirector;
      if (!oferta || oferta.estado !== 'Pendiente') throw new Error('No tienes una oferta pendiente.');
      if (estadoVigente(oferta, ahora) !== 'Pendiente') {
        // Vencer no cambia nada: se anota y listo.
        tx.set(db.doc(`usuarios/${uid}`), { ofertaDirector: cerrarOferta(oferta, 'Vencida', ahora) }, { merge: true });
        throw new Error('La oferta venció. Nadie cambió de cargo.');
      }
      const origenUid = oferta.desdeUid;
      const origen = cuentas.get(origenUid);
      if (!origen) throw new Error('La cuenta que hizo la oferta ya no existe.');

      if (accion === 'rechazar') {
        const rechazada = { ...cerrarOferta(oferta, 'Rechazada', ahora), resueltaPor: firma(autor.rol) };
        tx.set(db.doc(`usuarios/${uid}`), { ofertaDirector: rechazada }, { merge: true });
        tx.set(db.doc(`usuarios/${origenUid}`), { ofertaDirectorEmitida: rechazada }, { merge: true });
        return { mensaje: 'Rechazaste la oferta. El cargo sigue con quien lo tenía.' };
      }

      // Aceptar: los dos documentos se escriben en la misma transacción.
      const cambio = aplicarAceptacion({ uid: origenUid, rol: origen.rol }, { uid, rol: autor.rol }, oferta as OfertaCargo, ahora);
      if (!cambio) throw new Error('La oferta ya no es válida: revisa que la Dirección siga en la cuenta que la envió.');
      const constancia = {
        id: idConstancia(origenUid, uid, ahora),
        desdeUid: origenUid,
        desdeNombre: origen.nombre,
        haciaUid: uid,
        haciaNombre: autor.nombre,
        aceptadaEn: new Date(ahora).toISOString(),
        firmadaPor: firma(oferta.cargoOfrecido),
        rolAnteriorDestino: autor.rol,
        nota: 'Traspaso de Dirección aceptado por quien lo recibió.'
      };
      tx.set(db.doc(`usuarios/${uid}`), {
        rol: cambio.recibe.rol,
        ofertaDirector: { ...oferta, estado: 'Aceptada', resueltaEn: new Date(ahora).toISOString() },
        ultimoTraspaso: constancia
      }, { merge: true });
      tx.set(db.doc(`usuarios/${origenUid}`), {
        rol: cambio.ofrece.rol,
        ofertaDirectorEmitida: { ...oferta, estado: 'Aceptada', resueltaEn: new Date(ahora).toISOString() },
        ultimoTraspaso: constancia
      }, { merge: true });
      // Las atribuciones concedidas para actuar como Dirección no se heredan solas.
      if (origen.atribuciones?.length) {
        tx.set(db.doc(`usuarios/${origenUid}`), { atribuciones: [] }, { merge: true });
      }
      return { mensaje: 'Aceptaste la Dirección. Ya tienes sus permisos; quien la dejó pasó a Miembro.' };
    });
    return responder(resultado);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'No se pudo completar la operación.';
    // Error de negocio, no del sistema: se avisa con 409 para que el cliente lo lea.
    return responder({ error: mensaje }, 409);
  }
}
