import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const requireNode = createRequire(import.meta.url);
function cargar(ruta, dependencias = {}) {
  const codigo = ts.transpileModule(fs.readFileSync(ruta, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modulo = { exports: {} };
  new Function('require', 'module', 'exports', codigo)(id => dependencias[id] ?? requireNode(id), modulo, modulo.exports);
  return modulo.exports;
}
const logica = cargar('src/lib/eliminaciones.ts');
const BORRAR = '__BORRAR_CAMPO__';
const servicio = cargar('src/lib/gestionarEliminacion.ts', { './eliminaciones': logica, 'firebase-admin/firestore': { FieldValue: { delete: () => BORRAR } } });
const justificaciones = cargar('src/lib/justificaciones.ts');
const cola = cargar('src/lib/enviarColaAvisos.ts', { './justificaciones': justificaciones });

function entorno() {
  const usuario = (uid, rol, mas = {}) => ({ uid, rol, activo: true, nombre: uid, ...mas });
  const datos = new Map([
    ['usuarios/d', usuario('d', 'Director')], ['usuarios/s', usuario('s', 'Secretario')],
    ['usuarios/f', usuario('f', 'Director')], ['usuarios/dev', usuario('dev', 'Desarrollador')],
    ['usuarios/t', usuario('t', 'Tesorero')], ['usuarios/m', usuario('m', 'Miembro', { integranteId: 'ana' })],
    ['configuracion/estado', { fundador: 'f' }], ['cartas/c1', { id: 'c1', asunto: 'Carta original' }],
    ['actas/a1', { id: 'a1', titulo: 'Acta original' }], ['documentos/doc1', { id: 'doc1', titulo: 'Estatuto' }],
    ['integrantes/ana', { id: 'ana', nombreCompleto: 'Ana' }]
  ]);
  const ref = path => ({ path, get: async () => snap(path) });
  const snap = path => ({ id: path.split('/').at(-1), ref: ref(path), exists: datos.has(path), data: () => datos.has(path) ? structuredClone(datos.get(path)) : undefined });
  const consulta = (path, filtro, limite = Infinity) => ({
    path, filtro, limite, where: (campo, op, valor) => consulta(path, { campo, valor }, limite), limit: n => consulta(path, filtro, n),
    get: async () => ({ docs: [...datos.keys()].filter(p => p.startsWith(path + '/') && !p.slice(path.length + 1).includes('/') && (!filtro || datos.get(p)[filtro.campo] === filtro.valor)).slice(0, limite).map(snap) })
  });
  let secuencia = Promise.resolve();
  const db = {
    doc: ref, collection: path => consulta(path),
    runTransaction: fn => {
      const resultado = secuencia.then(async () => {
        const cambios = [];
        let escribiendo = false;
        const resultado = await fn({
          get: async r => { assert.equal(escribiendo, false, 'Firestore exige leer antes de escribir'); return r.where ? r.get() : snap(r.path); },
          set: (r, valor) => { escribiendo = true; cambios.push(() => datos.set(r.path, structuredClone(valor))); },
          delete: r => { escribiendo = true; cambios.push(() => datos.delete(r.path)); },
          update: (r, valor) => { escribiendo = true; cambios.push(() => { const nuevo = { ...datos.get(r.path), ...valor }; for (const k of Object.keys(nuevo)) if (nuevo[k] === BORRAR) delete nuevo[k]; datos.set(r.path, nuevo); }); }
        });
        cambios.forEach(aplicar => aplicar());
        return resultado;
      });
      secuencia = resultado.catch(() => {});
      return resultado;
    }
  };
  const actuar = (uid, entrada) => servicio.gestionarEliminacion(db, uid, logica.validarEliminacion(entrada));
  const pedir = (uid = 'd', tipo = 'cartas', registroId = 'c1', extra = {}) => actuar(uid, { accion: 'solicitar', tipo, registroId, ...extra });
  const resolver = (uid, id, accion = 'aprobar', extra = {}) => actuar(uid, { accion, solicitudId: id, ...extra });
  const pendientes = () => [...datos].filter(([p]) => p.startsWith('solicitudes_eliminacion/')).map(([, d]) => d).filter(s => s.estado === 'Pendiente');
  return { datos, db, actuar, pedir, resolver, pendientes };
}

test('valida tipo, identificadores, acción y permisos de solicitud', () => {
  for (const entrada of [{ accion: 'borrarTodo' }, { accion: 'solicitar', tipo: 'usuarios', registroId: 'd' }, { accion: 'solicitar', tipo: 'cartas', registroId: '../x' }, { accion: 'aprobar', solicitudId: '' }]) assert.throws(() => logica.validarEliminacion(entrada));
  assert.equal(logica.puedeSolicitarEliminacion('Miembro', 'cartas'), false);
  assert.equal(logica.puedeSolicitarEliminacion('Tesorero', 'documentos'), true);
  assert.equal(logica.puedeSolicitarEliminacion('Tesorero', 'integrantes'), false);
  assert.equal(logica.puedeSolicitarEliminacion('Secretaria', 'actas'), true);
});
for (const [tipo, id] of [['cartas', 'c1'], ['actas', 'a1'], ['documentos', 'doc1'], ['integrantes', 'ana']]) {
  test(`${tipo}: solicitud firma Dirección; Secretaría completa y borra atómicamente`, async () => {
    const e = entorno(); const r = await e.pedir('d', tipo, id);
    assert.equal(r.estado, 'Pendiente'); assert.ok(e.datos.has(`${tipo}/${id}`));
    const solicitud = e.datos.get(`solicitudes_eliminacion/${r.solicitudId}`);
    assert.equal(solicitud.firmas.Director.uid, 'd'); assert.equal(solicitud.firmas.Secretario, undefined);
    assert.ok(e.datos.has(`usuarios/s/avisos/elim-${r.solicitudId}-pendiente`));
    assert.ok(e.datos.has(`bloqueos_eliminacion/${tipo}__${id}`));
    assert.equal((await e.resolver('s', r.solicitudId)).estado, 'Eliminado');
    assert.equal(e.datos.has(`${tipo}/${id}`), false);
    assert.equal(e.datos.has(`bloqueos_eliminacion/${tipo}__${id}`), false);
    assert.ok(e.datos.has(`registros_eliminados/${tipo}__${id}`));
    assert.equal(e.pendientes().length, 0);
    assert.equal(e.datos.has(`usuarios/d/avisos/elim-${r.solicitudId}-pendiente`), false);
    assert.ok(e.datos.has(`usuarios/d/avisos/elim-${r.solicitudId}-cerrada`));
    if (tipo === 'integrantes') assert.equal(e.datos.get('usuarios/m').integranteId, undefined);
  });
}
test('Secretaría solicita; Dirección completa (orden inverso)', async () => {
  const e = entorno(); const r = await e.pedir('s');
  assert.equal((await e.resolver('d', r.solicitudId)).estado, 'Eliminado');
});
test('un rechazo cierra para ambos y conserva el registro; no queda en cola pendiente', async () => {
  const e = entorno(); const r = await e.pedir();
  assert.equal((await e.resolver('s', r.solicitudId, 'rechazar')).estado, 'Rechazado');
  assert.ok(e.datos.has('cartas/c1')); assert.equal(e.pendientes().length, 0);
  for (const [p] of e.datos) assert.equal(p.includes(r.solicitudId) && p.includes('-pendiente'), false);
  assert.equal((await e.resolver('d', r.solicitudId)).estado, 'Rechazado');
  assert.ok(e.datos.has('cartas/c1'));
});
test('solo el solicitante cancela y no hay caducidad automática', async () => {
  const e = entorno(); const r = await e.pedir();
  await assert.rejects(e.resolver('s', r.solicitudId, 'cancelar'), /Solo quien solicitó/);
  e.datos.get(`solicitudes_eliminacion/${r.solicitudId}`).creadaEn = '2000-01-01T00:00:00Z';
  assert.equal((await e.resolver('d', r.solicitudId, 'cancelar')).estado, 'Cancelado');
  assert.ok(e.datos.has('cartas/c1'));
});
test('fundador y Desarrollador eliminan directamente; otro Director no', async () => {
  for (const uid of ['f', 'dev']) {
    const e = entorno(); const r = await e.pedir(uid);
    assert.equal(r.estado, 'Eliminado');
    assert.ok(e.datos.get(`solicitudes_eliminacion/${r.solicitudId}`).excepcion);
  }
  const e = entorno(); assert.equal((await e.pedir('d')).estado, 'Pendiente');
});
test('la excepción de fundador exige tener cargo Director vigente', async () => {
  const e = entorno(); e.datos.get('usuarios/f').rol = 'Secretario';
  assert.equal((await e.pedir('f')).estado, 'Pendiente');
});
test('sin contraparte exige confirmar advertencia y deja auditoría', async () => {
  const e = entorno(); e.datos.get('usuarios/s').activo = false;
  await assert.rejects(e.pedir(), err => err.codigo === 'falta_contraparte');
  assert.ok(e.datos.has('cartas/c1')); assert.equal(e.pendientes().length, 0);
  const r = await e.pedir('d', 'cartas', 'c1', { aceptarFaltaCargo: true });
  assert.equal(r.estado, 'Eliminado');
  assert.match(e.datos.get(`solicitudes_eliminacion/${r.solicitudId}`).excepcion, /Sin contraparte/);
});
test('solicitante tercero no firma: necesita ambas autorizaciones', async () => {
  const e = entorno(); const r = await e.pedir('t', 'documentos', 'doc1');
  assert.deepEqual(e.datos.get(`solicitudes_eliminacion/${r.solicitudId}`).firmas, {});
  await assert.rejects(e.resolver('t', r.solicitudId), /Solo Dirección/);
  assert.equal((await e.resolver('d', r.solicitudId)).estado, 'Pendiente');
  assert.equal((await e.resolver('s', r.solicitudId)).estado, 'Eliminado');
});
test('doble solicitud simultánea devuelve la misma solicitud pendiente', async () => {
  const e = entorno(); const [a, b] = await Promise.all([e.pedir(), e.pedir('s')]);
  assert.equal(a.solicitudId, b.solicitudId); assert.equal(e.pendientes().length, 1);
});
test('firma revocada por cambio de rol o suspensión ya no autoriza', async () => {
  const e = entorno(); const r = await e.pedir();
  e.datos.get('usuarios/d').activo = false;
  // Fundador sigue siendo Director activo: no hay excepción por cargo ausente.
  assert.equal((await e.resolver('s', r.solicitudId)).estado, 'Pendiente');
  assert.equal(e.datos.get(`solicitudes_eliminacion/${r.solicitudId}`).firmas.Director, undefined);
  assert.ok(e.datos.has('cartas/c1'));
});
test('cuenta inactiva, Miembro y suplantación de firma no autorizan', async () => {
  const e = entorno();
  await assert.rejects(e.pedir('m'), /cargo/);
  const r = await e.pedir();
  await assert.rejects(e.resolver('m', r.solicitudId), /No puedes/);
  e.datos.get('usuarios/s').activo = false;
  await assert.rejects(e.resolver('s', r.solicitudId), /no está activa/);
  assert.ok(e.datos.has('cartas/c1'));
});
test('rechazo/segunda firma concurrentes producen un solo resultado terminal', async () => {
  const e = entorno(); const r = await e.pedir();
  const [a, b] = await Promise.all([e.resolver('s', r.solicitudId, 'rechazar'), e.resolver('s', r.solicitudId)]);
  assert.equal(a.estado, b.estado); assert.equal(a.estado, 'Rechazado'); assert.ok(e.datos.has('cartas/c1'));
});
test('nuevo pedido tras rechazo es independiente y reintentar cerrado no vuelve a borrar', async () => {
  const e = entorno(); const a = await e.pedir(); await e.resolver('s', a.solicitudId, 'rechazar');
  const b = await e.pedir(); assert.notEqual(a.solicitudId, b.solicitudId);
  await e.resolver('s', b.solicitudId);
  assert.equal((await e.resolver('s', b.solicitudId)).estado, 'Eliminado');
  await assert.rejects(e.pedir(), /ya no existe/);
});
test('push respeta preferencia, conserva aviso interno y no repite confirmados', async () => {
  const e = entorno(); const r = await e.pedir();
  e.datos.set('dispositivos_notificaciones/ds', { uid: 's', token: 'token-s' });
  e.datos.set('dispositivos_notificaciones/df', { uid: 'f', token: 'token-f' });
  e.datos.set('usuarios/f/privado/ajustes', { pushTipos: { 'Solicitudes de eliminación': false } });
  const enviados = [];
  const messaging = { sendEachForMulticast: async m => { enviados.push(m); return { responses: m.tokens.map(() => ({ success: true })) }; } };
  await cola.enviarColaAvisos(e.db, messaging, r.solicitudId);
  await cola.enviarColaAvisos(e.db, messaging, r.solicitudId);
  assert.equal(enviados.length, 1); assert.deepEqual(enviados[0].tokens, ['token-s']);
  assert.ok(e.datos.has(`usuarios/f/avisos/elim-${r.solicitudId}-pendiente`));
  assert.ok(enviados[0].webpush.fcmOptions.link.endsWith('?vista=notificaciones'));
});
test('push fallido se recupera desde la cola sin repetir la eliminación', async () => {
  const e = entorno(); const r = await e.pedir('f');
  e.datos.set('dispositivos_notificaciones/ds', { uid: 's', token: 'token-s' });
  const fallo = { sendEachForMulticast: async () => { throw Error('FCM caído'); } };
  assert.ok((await cola.enviarColaAvisos(e.db, fallo, r.solicitudId)).fallidos);
  assert.equal(e.datos.has('cartas/c1'), false);
  const bien = { sendEachForMulticast: async m => ({ responses: m.tokens.map(() => ({ success: true })) }) };
  assert.equal((await cola.enviarColaAvisos(e.db, bien, r.solicitudId)).enviados, 1);
});

test('API rechaza sesiones inválidas, roles sin permiso y cuerpos malformados', async () => {
  const e = entorno(); const tareas = [];
  const ruta = cargar('src/app/api/eliminaciones/route.ts', {
    'next/server': { NextResponse: Response, after: fn => tareas.push(fn) },
    'firebase-admin/auth': { getAuth: () => ({ verifyIdToken: async token => { if (token === 'malo') throw Error('inválido'); return { uid: token }; } }) },
    '@/lib/firebaseAdmin': { obtenerFirebaseAdmin: () => ({ db: e.db, messaging: {} }) },
    '@/lib/eliminaciones': logica, '@/lib/gestionarEliminacion': servicio,
    '@/lib/enviarColaAvisos': { enviarColaAvisos: async () => {} }
  });
  const enviar = (token, body) => ruta.POST(new Request('https://solibook.test/api/eliminaciones', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body }));
  const solicitud = JSON.stringify({ accion: 'solicitar', tipo: 'cartas', registroId: 'c1' });
  assert.equal((await enviar(null, solicitud)).status, 401);
  assert.equal((await enviar('malo', solicitud)).status, 401);
  assert.equal((await enviar('m', solicitud)).status, 403);
  assert.equal((await enviar('d', '{bad')).status, 400);
  assert.equal((await enviar('d', 'x'.repeat(4097))).status, 413);
  assert.ok(e.datos.has('cartas/c1')); assert.equal(tareas.length, 0);
  assert.equal((await enviar('d', solicitud)).status, 200); assert.equal(tareas.length, 1);
});
const generales = cargar('src/lib/prepararAvisoGestion.ts', { './justificaciones': justificaciones });
test('cartas, actas y justificaciones se distribuyen solo a gestión, sin duplicados', async () => {
  for (const tipo of ['Carta', 'Acta', 'Justificacion']) {
    const e = entorno();
    e.datos.set('notificaciones/n1', { id: 'n1', tipo, titulo: 'Aviso', mensaje: 'Mensaje', fecha: new Date().toISOString(), leido: false });
    assert.equal(await generales.prepararAvisoGestion(e.db, 'n1'), true);
    assert.ok(e.datos.has('usuarios/s/avisos/n1')); assert.equal(e.datos.has('usuarios/m/avisos/n1'), false);
    const cantidad = [...e.datos.keys()].filter(p => p.startsWith('cola_avisos/')).length;
    assert.equal(await generales.prepararAvisoGestion(e.db, 'n1'), false);
    assert.equal([...e.datos.keys()].filter(p => p.startsWith('cola_avisos/')).length, cantidad);
  }
});
test('no distribuye avisos generales históricos ni cumpleaños/calendario', async () => {
  for (const datos of [{ tipo: 'Carta', fecha: 'Ahora' }, { tipo: 'Carta', fecha: '2020-01-01' }, { tipo: 'Calendario', fecha: new Date().toISOString() }]) {
    const e = entorno(); e.datos.set('notificaciones/n1', datos);
    assert.equal(await generales.prepararAvisoGestion(e.db, 'n1'), false);
    assert.equal([...e.datos.keys()].some(p => p.startsWith('cola_avisos/')), false);
  }
});
test('push general respeta el interruptor y un rol revocado antes del envío', async () => {
  const e = entorno();
  e.datos.set('notificaciones/n1', { id: 'n1', tipo: 'Carta', titulo: 'Carta', mensaje: 'Contenido', fecha: new Date().toISOString() });
  await generales.prepararAvisoGestion(e.db, 'n1');
  e.datos.set('dispositivos_notificaciones/s', { uid: 's', token: 's' });
  e.datos.set('dispositivos_notificaciones/d', { uid: 'd', token: 'd' });
  e.datos.set('usuarios/s/privado/ajustes', { pushTipos: { Correspondencia: false } });
  e.datos.get('usuarios/d').rol = 'Miembro';
  let envios = 0;
  await cola.enviarColaAvisos(e.db, { sendEachForMulticast: async () => { envios++; return { responses: [] }; } });
  assert.equal(envios, 0);
  assert.ok(e.datos.has('usuarios/s/avisos/n1'));
});
test('cola parcial reintenta solo tokens fallidos y retira los inválidos', async () => {
  const e = entorno(); const r = await e.pedir();
  for (const id of ['uno', 'dos', 'invalido']) e.datos.set(`dispositivos_notificaciones/${id}`, { uid: 's', token: id });
  const enviados = [];
  let primero = true;
  const messaging = { sendEachForMulticast: async mensaje => {
    enviados.push(mensaje.tokens);
    const responses = mensaje.tokens.map(t => t === 'invalido' ? { success: false, error: { code: 'messaging/registration-token-not-registered' } } : t === 'dos' && primero ? { success: false, error: { code: 'messaging/internal-error' } } : { success: true });
    primero = false; return { responses };
  } };
  await cola.enviarColaAvisos(e.db, messaging, r.solicitudId);
  assert.equal(e.datos.has('dispositivos_notificaciones/invalido'), false);
  await cola.enviarColaAvisos(e.db, messaging, r.solicitudId);
  assert.deepEqual(enviados, [['uno', 'dos', 'invalido'], ['dos']]);
});
