import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import nodePath from 'node:path';
const requireNode = createRequire(import.meta.url);

// Ejecuta los módulos reales, sustituyendo únicamente Firebase y Next en las
// pruebas del handler. No usa credenciales, red ni base de producción.
function cargar(ruta, dependencias = {}) {
  const codigo = ts.transpileModule(fs.readFileSync(ruta, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const modulo = { exports: {} };
  // Los './otro-modulo' se resuelven contra el archivo que importa, así la lógica
  // de justificaciones puede apoyarse en permisos.ts sin que el test la enumere.
  const requirePropio = id => {
    if (Object.prototype.hasOwnProperty.call(dependencias, id)) return dependencias[id];
    if (id.startsWith('.')) {
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        const candidato = nodePath.join(nodePath.dirname(ruta), id + ext);
        if (fs.existsSync(candidato)) return cargar(candidato, dependencias);
      }
    }
    return requireNode(id);
  };
  new Function('require', 'module', 'exports', codigo)(requirePropio, modulo, modulo.exports);
  return modulo.exports;
}
const logica = cargar('src/lib/justificaciones.ts');
const ficha = { id: 'ana', nombreCompleto: 'Ana Pérez', estado: 'Activo', cuerda: 'Soprano' };
const evento = { id: 'ensayo', titulo: 'Ensayo', fechaHoraInicio: '2099-04-10T20:00:00Z', tipoConvocatoria: 'Todos' };

test('convocatorias: todos, cuerda, personalizada, inactivo y fecha pasada', () => {
  assert.equal(logica.eventoJustificable(evento, ficha), true);
  assert.equal(logica.eventoJustificable({ ...evento, tipoConvocatoria: 'Por Cuerda', cuerdasConvocadas: ['Tenor'] }, ficha), false);
  assert.equal(logica.eventoJustificable({ ...evento, tipoConvocatoria: 'Por Cuerda', cuerdasConvocadas: ['Soprano'] }, ficha), true);
  assert.equal(logica.eventoJustificable({ ...evento, tipoConvocatoria: 'Personalizada', integrantesConvocadosIds: ['ana'] }, ficha), true);
  assert.equal(logica.eventoJustificable({ ...evento, tipoConvocatoria: 'Personalizada', integrantesConvocadosIds: ['otra'] }, ficha), false);
  assert.equal(logica.eventoJustificable(evento, { ...ficha, estado: 'Inactivo' }), false);
  assert.equal(logica.eventoJustificable({ ...evento, fechaHoraInicio: '2020-01-01' }, ficha), false);
  assert.equal(logica.eventoJustificable({ ...evento, fechaHoraInicio: 'inválida' }, ficha), false);
  assert.equal(logica.eventoJustificable(evento, ficha, Date.parse(evento.fechaHoraInicio)), false);
});
test('validación y límites del motivo, IDs y foto', () => {
  const base = { integranteId: 'ana', eventoIds: ['ensayo', 'ensayo'], motivo: ' Enfermedad ' };
  assert.deepEqual(logica.validarSolicitudJustificacion(base).eventoIds, ['ensayo']);
  assert.equal(logica.validarSolicitudJustificacion(base).motivo, 'Enfermedad');
  for (const cambio of [{ motivo: ' ' }, { motivo: 'a'.repeat(2001) }, { eventoIds: [] }, { eventoIds: Array(21).fill('e') }, { eventoIds: ['../cuenta'] }, { integranteId: '/' }, { adjuntoUrl: 'javascript:alert(1)' }, { adjuntoUrl: 'data:image/svg+xml;base64,AAAA' }, { adjuntoUrl: 'x'.repeat(200001) }]) {
    assert.throws(() => logica.validarSolicitudJustificacion({ ...base, ...cambio }));
  }
});
test('fecha de Chile respeta el cambio de día y los roles desconocidos no gestionan', () => {
  assert.equal(logica.fechaActividadChile('2026-09-21T01:00:00Z'), '2026-09-20');
  assert.equal(logica.puedeJustificarPorOtros('Directiva'), true);
  assert.equal(logica.puedeJustificarPorOtros('Secretaria'), true);
  assert.equal(logica.puedeJustificarPorOtros('Miembro'), false);
  assert.equal(logica.puedeJustificarPorOtros('Desconocido'), false);
});

function entorno(rol = 'Miembro') {
  const datos = new Map([
    ['usuarios/u1', { uid: 'u1', activo: true, rol, integranteId: 'ana' }],
    ['integrantes/ana', ficha], ['eventos/ensayo', evento],
    ['eventos/concierto', { ...evento, id: 'concierto', titulo: 'Concierto' }]
  ]);
  const db = {
    doc: path => ({ path }),
    collection: path => ({ where: (campo, op, valor) => ({ path, campo, valor }) }),
    runTransaction: async fn => {
      const pendientes = [];
      const snap = (path, valor) => ({ id: path.split('/').at(-1), exists: !!valor, data: () => valor });
      const resultado = await fn({
        get: async ref => ref.campo ? { docs: [...datos].filter(([p, v]) => p.startsWith(ref.path + '/') && v[ref.campo] === ref.valor).map(([p, v]) => snap(p, v)) } : snap(ref.path, datos.get(ref.path)),
        set: (ref, valor) => pendientes.push([ref.path, valor])
      });
      pendientes.forEach(([path, valor]) => datos.set(path, valor));
      return resultado;
    }
  };
  const ruta = cargar('src/app/api/justificaciones/route.ts', {
    '@/lib/firebaseAdmin': { obtenerFirebaseAdmin: () => ({ db }) },
    '@/lib/justificaciones': logica,
    '@/lib/permisos': cargar('src/lib/permisos.ts'),
    'firebase-admin/auth': { getAuth: () => ({ verifyIdToken: async token => { if (token !== 'valido') throw Error('invalid'); return { uid: 'u1' }; } }) },
    'next/server': { NextResponse: Response, after: () => {} },
    '@/lib/prepararAvisoGestion': { prepararAvisoGestion: async () => {} },
    '@/lib/enviarColaAvisos': { enviarColaAvisos: async () => {} }
  });
  const enviar = (cambios = {}, token = 'valido') => ruta.POST(new Request('https://solibook.test/api/justificaciones', {
    method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ integranteId: 'ana', eventoIds: ['ensayo', 'concierto'], motivo: 'Licencia médica', ...cambios })
  }));
  return { datos, enviar };
}

test('API: crea una solicitud pendiente y un aviso por evento, con autor real', async () => {
  const { datos, enviar } = entorno();
  const res = await enviar({ creadoPorUid: 'suplantado', estado: 'Aprobado' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { enviadas: 2, omitidas: 0 });
  const justificaciones = [...datos].filter(([p]) => p.startsWith('justificaciones/')).map(([, v]) => v);
  assert.equal(justificaciones.length, 2);
  assert.ok(justificaciones.every(j => j.estado === 'Pendiente' && j.creadoPorUid === 'u1' && j.canalIngreso === 'App_Integrante'));
  assert.equal([...datos.keys()].filter(p => p.startsWith('notificaciones/')).length, 2);
  assert.equal([...datos.keys()].filter(p => p.startsWith('asistencias/')).length, 0);
  const repetir = await enviar();
  assert.deepEqual(await repetir.json(), { enviadas: 0, omitidas: 2 });
});
test('API: bloquea sesión ausente, inválida, suspendida y suplantación de integrante', async () => {
  const { datos, enviar } = entorno();
  assert.equal((await enviar({}, null)).status, 401);
  assert.equal((await enviar({}, 'invalido')).status, 401);
  assert.equal((await enviar({ integranteId: 'otro' })).status, 403);
  datos.set('usuarios/u1', { activo: false, rol: 'Miembro', integranteId: 'ana' });
  assert.equal((await enviar()).status, 403);
  assert.equal([...datos.keys()].some(p => p.startsWith('justificaciones/')), false);
});
test('API: directiva puede enviar para otro integrante activo', async () => {
  const { datos, enviar } = entorno('Directiva');
  datos.set('integrantes/otro', { ...ficha, id: 'otro' });
  const res = await enviar({ integranteId: 'otro' });
  assert.equal(res.status, 200);
  assert.ok([...datos].filter(([p]) => p.startsWith('justificaciones/')).every(([, j]) => j.canalIngreso === 'Secretaria_Manual'));
});
test('API: rechaza todo el lote si un evento dejó de ser válido', async () => {
  for (const cambio of [{ fechaHoraInicio: '2020-01-01' }, { tipoConvocatoria: 'Personalizada', integrantesConvocadosIds: [] }]) {
    const { datos, enviar } = entorno();
    datos.set('eventos/concierto', { ...evento, ...cambio });
    assert.equal((await enviar()).status, 409);
    assert.equal([...datos.keys()].some(p => p.startsWith('justificaciones/')), false);
  }
});
test('API: respeta justificaciones anteriores y solo crea las que faltan', async () => {
  const { datos, enviar } = entorno();
  datos.set('justificaciones/legado', { integranteId: 'ana', eventoId: 'ensayo', estado: 'Aprobado' });
  const res = await enviar();
  assert.deepEqual(await res.json(), { enviadas: 1, omitidas: 1 });
});
test('API: cuerpo excesivo y campos inválidos no producen escrituras', async () => {
  const { datos, enviar } = entorno();
  assert.equal((await enviar({ motivo: '' })).status, 400);
  assert.equal((await enviar({ adjuntoUrl: 'x'.repeat(250000) })).status, 413);
  assert.equal([...datos.keys()].some(p => p.startsWith('justificaciones/')), false);
});
