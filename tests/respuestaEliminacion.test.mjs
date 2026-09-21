import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function cargarCliente(ruta) {
  // Transpilar TS a JS (target es2022, ESM-ish) sin resolver imports.
  const codigo = ts.transpileModule(
    fs.readFileSync(ruta, 'utf8').replace(/^'use client';?\s*/, ''),
    { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  // Usar el mismo patrón de CommonJS que los otros tests: envolver en función
  // que acepte imports dinámicos. Simulamos las mínimas APIs de navegador.
  const textEncoder = class { encode(s) { return Buffer.from(s, 'utf8'); } };
  const sandbox = {
    Buffer, Uint8Array, console, Promise, Map, Set, JSON, TextDecoder, TextEncoder: textEncoder,
    exports: {}, module: { exports: {} },
    require: () => { throw new Error('no import resolvable'); }
  };
  const envoltura = codigo
    .replace(/^\s*import\s+[^;]+;?\s*/gm, ''); // quitar imports de tipos (no hay runtime imports)
  // Convertir ESM exports a formato ejecutable por Function.
  const finalCode = envoltura
    .replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\n\}/g, '')
    .replace(/export\s+async\s+function\s+(\w+)/g, 'async function $1')
    .replace(/export\s+function\s+(\w+)/g, 'function $1')
    .replace(/export\s+const\s+(\w+)/g, 'const $1')
    + '\nmodule.exports = { interpretarRespuestaEliminacion };';
  // Reemplazar exports de const que no necesitamos (la interfaz ya se fue).
  const codigoLimpio = finalCode
    .replace(/^\s*const\s+MAX_BODY\s*=\s*\d+;?\s*$/m, 'const MAX_BODY = 8192;')
    .replace(/^\s*async\s+function\s+leerComoTexto/m, 'async function leerComoTexto')
    + '\nmodule.exports = { interpretarRespuestaEliminacion, leerComoTexto };';

  const fn = new Function('require', 'module', 'exports', 'TextDecoder', 'Uint8Array', 'Buffer', 'Promise', 'JSON', 'console', codigoLimpio);
  fn(sandbox.require, sandbox.module, sandbox.exports, TextDecoder, Uint8Array, Buffer, Promise, JSON, console);
  return sandbox.module.exports;
}

const { interpretarRespuestaEliminacion } = cargarCliente('src/lib/respuestaEliminacion.ts');

function respuesta(status, body, ct = 'application/json; charset=utf-8') {
  const headers = new Map();
  if (ct) headers.set('content-type', ct);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: k => headers.get(k.toLowerCase()) || null },
    body: body == null ? null : (() => {
      const data = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      let devuelto = false;
      return {
        getReader: () => ({
          read: async () => {
            if (devuelto) return { done: true, value: undefined };
            devuelto = true;
            return { done: false, value: new Uint8Array(data) };
          },
          cancel: async () => {}
        })
      };
    })(),
  };
}

function respuestaCortada(texto) {
  const data = Buffer.from(texto);
  const mitad = new Uint8Array(data.subarray(0, Math.floor(data.length / 2)));
  let devuelto = false;
  return {
    status: 200,
    ok: true,
    headers: { get: k => k === 'content-type' ? 'application/json' : null },
    body: {
      getReader: () => ({
        read: async () => {
          if (devuelto) return { done: true, value: undefined };
          devuelto = true;
          return { done: false, value: mitad };
        },
        cancel: async () => {}
      })
    }
  };
}

test('respuesta exitosa se interpreta como ok', async () => {
  const r = await interpretarRespuestaEliminacion(respuesta(200, '{"estado":"Eliminado","mensaje":"Solicitud eliminada."}'));
  assert.equal(r.ok, true);
  assert.equal(r.estado, 'Eliminado');
  assert.equal(r.mensaje, 'Solicitud eliminada.');
  assert.equal(r.respuestaAmbigua, undefined);
});

test('respuesta vacía es ambigua y pide revisar Notificaciones', async () => {
  const r = await interpretarRespuestaEliminacion(respuesta(200, '', null));
  assert.equal(r.ok, false);
  assert.equal(r.respuestaAmbigua, true);
  assert.match(r.errorServidor || '', /Notificaciones/);
});

test('respuesta 500 HTML (Vercel) se detecta como ambigua', async () => {
  const r = await interpretarRespuestaEliminacion(respuesta(500, '<!doctype html><html><body>Internal Server Error</body></html>', 'text/html'));
  assert.equal(r.ok, false);
  assert.equal(r.respuestaAmbigua, true);
  assert.match(r.errorServidor || '', /página/);
});

test('JSON inválido / cortado es ambiguo sin suponer éxito', async () => {
  const r = await interpretarRespuestaEliminacion(respuestaCortada('{"estado":"Pendiente","mensaje":"Solicitud enviada a'));
  assert.equal(r.ok, false);
  assert.equal(r.respuestaAmbigua, true);
  assert.match(r.errorServidor || '', /incompleta/);
});

test('error de negocio con código falta_contraparte se conserva para confirmación', async () => {
  const r = await interpretarRespuestaEliminacion(respuesta(409, '{"error":"Falta Secretaría. ¿Continuar?","codigo":"falta_contraparte"}'));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'falta_contraparte');
  assert.match(r.errorServidor || '', /Secretaría/);
});

test('respuesta 401 con mensaje de sesión vencida', async () => {
  const r = await interpretarRespuestaEliminacion(respuesta(401, '{"error":"La sesión venció."}'));
  assert.equal(r.ok, false);
  assert.match(r.errorServidor || '', /sesión/);
});

test('sin cuerpo disponible (body null) es ambigua', async () => {
  const r = await interpretarRespuestaEliminacion({ status: 0, ok: false, headers: { get: () => null }, body: null });
  assert.equal(r.ok, false);
  assert.equal(r.respuestaAmbigua, true);
});
