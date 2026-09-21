import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const requireNode = createRequire(import.meta.url);
function cargar(ruta, dependencias = {}) {
  const codigo = ts.transpileModule(fs.readFileSync(ruta, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modulo = { exports: {} };
  new Function('require', 'module', 'exports', codigo)(id => dependencias[id] ?? requireNode(id), modulo, modulo.exports);
  return modulo.exports;
}
const justificaciones = cargar('src/lib/justificaciones.ts');
const reglas = cargar('src/lib/recordatoriosCalendario.ts', { './justificaciones': justificaciones });
const servicio = cargar('src/lib/enviarRecordatoriosCalendario.ts', { './recordatoriosCalendario': reglas });
const ahora = new Date('2026-09-20T12:00:00Z');
const evento = { id: 'ensayo', titulo: 'Ensayo general', tipo: 'Ensayo', fechaHoraInicio: '2026-09-21T22:00:00Z', lugarNombre: 'Templo', tipoConvocatoria: 'Todos' };
const miembro = { uid: 'u', activo: true, rol: 'Miembro', integranteId: 'ana' };
const ficha = { id: 'ana', estado: 'Activo', cuerda: 'Soprano' };

test('ventanas civiles de Chile: hoy, mañana, fuera de plazo, fecha inválida y horario de verano', () => {
  assert.equal(reglas.ventanaCalendario(evento, ahora), 'anterior');
  assert.equal(reglas.ventanaCalendario({ ...evento, fechaHoraInicio: '2026-09-20T23:00:00Z' }, ahora), 'mismo');
  assert.equal(reglas.ventanaCalendario({ ...evento, fechaHoraInicio: ahora.toISOString() }, ahora), null);
  assert.equal(reglas.ventanaCalendario({ ...evento, fechaHoraInicio: '2026-09-22T22:00:00Z' }, ahora), null);
  assert.equal(reglas.ventanaCalendario({ ...evento, fechaHoraInicio: 'no es fecha' }, ahora), null);
  // UTC ya cambió de día, Chile todavía no.
  assert.equal(reglas.ventanaCalendario({ ...evento, fechaHoraInicio: '2026-09-21T02:00:00Z' }, new Date('2026-09-21T01:00:00Z')), 'mismo');
  // Cambio de horario de verano: diferencia de fechas civiles, no de 24 horas.
  assert.equal(reglas.ventanaCalendario({ ...evento, fechaHoraInicio: '2026-09-06T12:00:00Z' }, new Date('2026-09-05T13:00:00Z')), 'anterior');
});
test('convocatorias y cuentas: directiva ve todo; Miembro solo ficha activa citada', () => {
  assert.equal(reglas.destinatarioCalendario(miembro, evento, ficha, ahora), true);
  assert.equal(reglas.destinatarioCalendario(miembro, evento, undefined, ahora), false);
  assert.equal(reglas.destinatarioCalendario({ ...miembro, activo: false }, evento, ficha, ahora), false);
  assert.equal(reglas.destinatarioCalendario(miembro, evento, { ...ficha, estado: 'Inactivo' }, ahora), false);
  const porCuerda = { ...evento, tipoConvocatoria: 'Por Cuerda', cuerdasConvocadas: ['Tenor'] };
  assert.equal(reglas.destinatarioCalendario(miembro, porCuerda, ficha, ahora), false);
  assert.equal(reglas.destinatarioCalendario({ ...miembro, rol: 'Director' }, porCuerda, undefined, ahora), true);
  assert.equal(reglas.destinatarioCalendario(miembro, { ...evento, tipoConvocatoria: 'Personalizada', integrantesConvocadosIds: ['otra'] }, ficha, ahora), false);
  assert.equal(reglas.destinatarioCalendario({ ...miembro, rol: 'desconocido' }, evento, ficha, ahora), false);
});
test('preferencias de tipo y antelación, incluidos tipos personalizados', () => {
  assert.equal(reglas.permitePushCalendario({}, 'Retiro', 'anterior'), true);
  assert.equal(reglas.permitePushCalendario({ pushTipos: { Retiro: false } }, 'Retiro', 'mismo'), false);
  assert.equal(reglas.permitePushCalendario({ antelacion: 'mismo' }, 'Ensayo', 'anterior'), false);
  assert.equal(reglas.permitePushCalendario({ antelacion: 'anterior' }, 'Ensayo', 'mismo'), false);
  for (const ventana of ['mismo', 'anterior']) assert.equal(reglas.permitePushCalendario({ antelacion: 'ambos' }, 'Ensayo', ventana), true);
});

function entorno() {
  const datos = new Map([
    ['eventos/ensayo', evento], ['usuarios/u', miembro], ['integrantes/ana', ficha],
    ['dispositivos_notificaciones/d1', { uid: 'u', token: 'token1' }]
  ]);
  const snapshot = path => ({ id: path.split('/').at(-1), exists: datos.has(path), data: () => datos.get(path) });
  const referencia = path => ({ path, get: async () => snapshot(path) });
  let cola = Promise.resolve();
  const db = {
    doc: referencia,
    collection: path => {
      const consulta = filtro => ({
        get: async () => ({ docs: [...datos.keys()].filter(p => p.startsWith(path + '/') && p.slice(path.length + 1).indexOf('/') === -1 && (!filtro || datos.get(p)[filtro.campo] === filtro.valor)).map(snapshot) }),
        where: (campo, op, valor) => consulta({ campo, valor })
      });
      return consulta();
    },
    runTransaction: fn => {
      const trabajo = cola.then(async () => {
        const escrituras = [];
        const resultado = await fn({
          get: async ref => snapshot(ref.path),
          set: (ref, valor) => escrituras.push(() => datos.set(ref.path, valor)),
          update: (ref, valor) => escrituras.push(() => datos.set(ref.path, { ...datos.get(ref.path), ...valor })),
          delete: ref => escrituras.push(() => datos.delete(ref.path))
        });
        escrituras.forEach(escribir => escribir());
        return resultado;
      });
      cola = trabajo.catch(() => {});
      return trabajo;
    }
  };
  const envios = [];
  const messaging = { sendEachForMulticast: async mensaje => {
    envios.push(mensaje);
    return { responses: mensaje.tokens.map(() => ({ success: true })) };
  } };
  const ejecutar = () => servicio.enviarRecordatoriosCalendario(db, messaging, ahora, 'https://solibook.test', () => ahora);
  const avisos = () => [...datos].filter(([p]) => p.startsWith('usuarios/u/avisos/'));
  return { datos, db, messaging, ejecutar, avisos, envios };
}
test('crea aviso interno incluso sin dispositivos o con push/antelación desactivados', async () => {
  for (const ajuste of ['sin_dispositivo', { pushTipos: { Ensayo: false } }, { antelacion: 'mismo' }]) {
    const e = entorno();
    if (ajuste === 'sin_dispositivo') e.datos.delete('dispositivos_notificaciones/d1');
    else e.datos.set('usuarios/u/privado/ajustes', ajuste);
    const res = await e.ejecutar();
    assert.equal(res.avisosCreados, 1);
    assert.equal(e.avisos().length, 1);
    assert.equal(e.envios.length, 0);
  }
});
test('envía push con TTL, enlace y tag estables; un reintento no duplica', async () => {
  const e = entorno();
  const primero = await e.ejecutar();
  assert.equal(primero.enviados, 1);
  assert.equal(e.envios[0].webpush.fcmOptions.link, 'https://solibook.test/?vista=agenda');
  assert.ok(Number(e.envios[0].webpush.headers.TTL) > 0);
  assert.equal(e.envios[0].webpush.notification.tag, e.avisos()[0][1].id);
  const segundo = await e.ejecutar();
  assert.equal(segundo.enviados, 0);
  assert.equal(segundo.avisosCreados, 0);
  assert.equal(e.envios.length, 1);
});
test('dos ejecuciones concurrentes no reservan la misma entrega', async () => {
  const e = entorno();
  await Promise.all([e.ejecutar(), e.ejecutar()]);
  assert.equal(e.envios.length, 1);
  assert.equal(e.avisos().length, 1);
});
test('fallo parcial: reintenta solo el dispositivo fallido', async () => {
  const e = entorno();
  e.datos.set('dispositivos_notificaciones/d2', { uid: 'u', token: 'token2' });
  let intento = 0;
  const enviados = [];
  e.messaging.sendEachForMulticast = async m => {
    enviados.push(m.tokens);
    intento++;
    return { responses: m.tokens.map(t => intento === 1 && t === 'token2' ? { success: false, error: { code: 'messaging/internal-error' } } : { success: true }) };
  };
  assert.equal((await e.ejecutar()).fallidos, 1);
  assert.equal((await e.ejecutar()).enviados, 1);
  assert.deepEqual(enviados, [['token1', 'token2'], ['token2']]);
});
test('error de transporte libera la reserva para reintentar', async () => {
  const e = entorno();
  const original = e.messaging.sendEachForMulticast;
  e.messaging.sendEachForMulticast = async () => { throw Error('red'); };
  assert.equal((await e.ejecutar()).fallidos, 1);
  e.messaging.sendEachForMulticast = original;
  assert.equal((await e.ejecutar()).enviados, 1);
  assert.equal(e.avisos().length, 1);
});
test('retira tokens inválidos; no elimina un token renovado durante el envío', async () => {
  for (const renovado of [false, true]) {
    const e = entorno();
    e.messaging.sendEachForMulticast = async () => {
      if (renovado) e.datos.set('dispositivos_notificaciones/d1', { uid: 'u', token: 'nuevo' });
      return { responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }] };
    };
    assert.equal((await e.ejecutar()).invalidos, 1);
    assert.equal(e.datos.has('dispositivos_notificaciones/d1'), renovado);
  }
});
test('no entrega a cuentas suspendidas, no citadas ni eventos pasados', async () => {
  for (const modificar of [
    e => e.datos.set('usuarios/u', { ...miembro, activo: false }),
    e => e.datos.set('eventos/ensayo', { ...evento, tipoConvocatoria: 'Personalizada', integrantesConvocadosIds: [] }),
    e => e.datos.set('eventos/ensayo', { ...evento, fechaHoraInicio: '2026-09-19T20:00:00Z' })
  ]) {
    const e = entorno(); modificar(e); await e.ejecutar();
    assert.equal(e.envios.length, 0); assert.equal(e.avisos().length, 0);
  }
});
test('cron rechaza llamadas sin secreto antes de acceder a Firebase', async () => {
  let llamadas = 0;
  const ruta = cargar('src/app/api/cron/calendario/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/firebaseAdmin': { obtenerFirebaseAdmin: () => { llamadas++; throw Error('no debe acceder'); } },
    '@/lib/enviarRecordatoriosCalendario': servicio
  });
  const original = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'solo-prueba';
    assert.equal((await ruta.GET(new Request('https://solibook.test/api/cron/calendario'))).status, 401);
    assert.equal((await ruta.GET(new Request('https://solibook.test/api/cron/calendario', { headers: { authorization: 'Bearer otro' } }))).status, 401);
    assert.equal(llamadas, 0);
  } finally { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; }
});
test('service worker no duplica la notificación automática de FCM', () => {
  let callback;
  const mostradas = [];
  const contexto = {
    importScripts: () => {},
    firebase: { initializeApp: () => {}, messaging: () => ({ onBackgroundMessage: fn => { callback = fn; } }) },
    self: { registration: { showNotification: (...args) => mostradas.push(args) }, addEventListener: () => {} }
  };
  vm.runInNewContext(fs.readFileSync('public/firebase-messaging-sw.js', 'utf8'), contexto);
  callback({ notification: { title: 'Recordatorio' } });
  assert.equal(mostradas.length, 0);
  callback({ data: {} });
  assert.equal(mostradas.length, 1);
});

test('lotes FCM no superan 500 dispositivos', async () => {
  const e = entorno();
  for (let n = 2; n <= 501; n++) e.datos.set(`dispositivos_notificaciones/d${n}`, { uid: 'u', token: `token${n}` });
  assert.equal((await e.ejecutar()).enviados, 501);
  assert.deepEqual(e.envios.map(m => m.tokens.length), [500, 1]);
});
test('una reserva abandonada expira; una vigente no se roba', async () => {
  const e = entorno();
  await e.ejecutar();
  const [clave, datos] = [...e.datos].find(([p]) => p.startsWith('envios_calendario/'));
  e.datos.set(clave, { ...datos, estado: 'enviando', reservadoHasta: Date.now() + 60000 });
  assert.equal((await e.ejecutar()).enviados, 0);
  e.datos.set(clave, { ...datos, estado: 'enviando', reservadoHasta: Date.now() - 1 });
  assert.equal((await e.ejecutar()).enviados, 1);
});
test('revalida suspensión o cancelación ocurrida después de leer las listas', async () => {
  for (const mutar of [
    e => e.datos.set('usuarios/u', { ...miembro, activo: false }),
    e => e.datos.delete('eventos/ensayo'),
    e => e.datos.set('eventos/ensayo', { ...evento, tipoConvocatoria: 'Personalizada', integrantesConvocadosIds: [] })
  ]) {
    const e = entorno();
    const original = e.db.runTransaction;
    e.db.runTransaction = fn => { mutar(e); return original(fn); };
    await e.ejecutar();
    assert.equal(e.avisos().length, 0);
    assert.equal(e.envios.length, 0);
  }
});
test('no envía a un dispositivo retirado tras consultar las listas', async () => {
  const e = entorno();
  const original = e.db.runTransaction;
  e.db.runTransaction = fn => { e.datos.delete('dispositivos_notificaciones/d1'); return original(fn); };
  await e.ejecutar();
  assert.equal(e.avisos().length, 1);
  assert.equal(e.envios.length, 0);
});
test('al tocar el push abre la agenda y nunca navega a un dominio externo', async () => {
  for (const enlace of ['https://solibook.test/?vista=agenda', 'https://externo.test/']) {
    const manejadores = new Map();
    let promesa;
    let destino;
    const ventana = { url: 'https://solibook.test/', focus: async () => {}, navigate: async url => { destino = url; return ventana; } };
    vm.runInNewContext(fs.readFileSync('public/firebase-messaging-sw.js', 'utf8'), {
      URL, importScripts: () => {},
      clients: { matchAll: async () => [ventana] },
      firebase: { initializeApp: () => {}, messaging: () => ({ onBackgroundMessage: () => {} }) },
      self: { location: { origin: 'https://solibook.test' }, addEventListener: (evento, fn) => manejadores.set(evento, fn) }
    });
    manejadores.get('notificationclick')({ stopImmediatePropagation: () => {}, notification: { close: () => {}, data: { FCM_MSG: { fcmOptions: { link: enlace } } } }, waitUntil: p => { promesa = p; } });
    await promesa;
    assert.equal(destino, enlace.includes('externo') ? 'https://solibook.test' : enlace);
  }
});
