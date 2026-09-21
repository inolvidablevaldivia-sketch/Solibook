import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// ═══════════════════════════════════════════════════════════════════════════
// Cargos, atribuciones, cupos y autorías.
//
// Se ejecutan los módulos reales de `src/lib` (transpilados), sin Firebase ni
// navegador: todo lo que decide quién puede qué es función pura de una cuenta.
// Un cambio en la matriz de permisos que rompa un acuerdo de la directiva
// tendría que fallar acá antes que en producción.
// ═══════════════════════════════════════════════════════════════════════════

function cargar(ruta, dependencias = {}) {
  const codigo = ts.transpileModule(fs.readFileSync(ruta, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const modulo = { exports: {} };
  // Los `./otro-modulo` se resuelven contra el archivo que importa: así la
  // lógica puede apoyarse en sus vecinos de src/lib sin que este test los
  // enumere, y nada de esto depende de Firebase ni de `window`.
  const requirePropio = id => {
    if (Object.prototype.hasOwnProperty.call(dependencias, id)) return dependencias[id];
    if (id.startsWith('.')) {
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        const candidato = path.join(path.dirname(ruta), id + ext);
        if (fs.existsSync(candidato)) return cargar(candidato, dependencias);
      }
    }
    return {};
  };
  new Function('require', 'module', 'exports', codigo)(requirePropio, modulo, modulo.exports);
  return modulo.exports;
}

const permisos = cargar('src/lib/permisos.ts');
const atributos = cargar('src/lib/atributos.ts');
const ingresos = cargar('src/lib/ingresos.ts');
const traspasos = cargar('src/lib/traspasos.ts');
const protocolo = cargar('src/lib/actasProtocolo.ts');
const eliminaciones = cargar('src/lib/eliminaciones.ts');
const autorias = cargar('src/lib/autorias.ts');

// ─────────────────────────── El cargo, por sí solo ───────────────────────────

test('cada cargo tiene exactamente lo acordado, sin depender del nombre guardado', () => {
  const tiene = (rol, permiso) => permisos.permisosEfectivos(rol, []).has(permiso);

  // Dirección y Desarrollador mandan en todo; Secretaría no administra cuentas.
  assert.equal(tiene('Director', 'gestionar_usuarios'), true);
  assert.equal(tiene('Desarrollador', 'gestionar_usuarios'), true);
  assert.equal(tiene('Secretario', 'gestionar_usuarios'), false);
  assert.equal(tiene('Secretario', 'gestionar_cartas'), true);

  // Tesorería mira, acusa y lleva su libro; no toca agenda, listas ni métricas.
  for (const permiso of ['ver_agenda', 'ver_cartas', 'acuse_recibo', 'ver_documentos', 'gestionar_documentos', 'crear_miembro', 'gestionar_justificaciones']) {
    assert.equal(tiene('Tesorero', permiso), true, `Tesorero debe tener ${permiso}`);
  }
  for (const permiso of ['crear_evento', 'eliminar_evento', 'pasar_lista', 'finalizar_lista', 'ver_metricas', 'exportar_datos', 'gestionar_actas', 'gestionar_cartas', 'resolver_justificaciones', 'eliminar_miembro', 'gestionar_usuarios', 'ver_cuentas', 'aprobar_ingresos']) {
    assert.equal(tiene('Tesorero', permiso), false, `Tesorero no debe tener ${permiso}`);
  }

  // Vocal: operación diaria y lectura de libros, sin correspondencia ni actas
  // escritas, sin libro de documentos y sin pantalla de cuentas.
  for (const permiso of ['crear_evento', 'eliminar_evento', 'finalizar_lista', 'resolver_justificaciones', 'acuse_recibo', 'ver_actas', 'ver_metricas']) {
    assert.equal(tiene('Vocal', permiso), true, `Vocal debe tener ${permiso}`);
  }
  for (const permiso of ['gestionar_usuarios', 'ver_cuentas', 'aprobar_ingresos', 'gestionar_cartas', 'gestionar_actas', 'ver_documentos', 'eliminar_miembro']) {
    assert.equal(tiene('Vocal', permiso), false, `Vocal no debe tener ${permiso}`);
  }

  // Ayudante del libro: escribe, no cierra ni borra.
  for (const permiso of ['crear_evento', 'pasar_lista', 'gestionar_cartas', 'gestionar_actas', 'gestionar_documentos', 'crear_miembro']) {
    assert.equal(tiene('Administrativo', permiso), true, `Administrativo debe tener ${permiso}`);
  }
  for (const permiso of ['finalizar_lista', 'eliminar_evento', 'acuse_recibo', 'resolver_justificaciones', 'eliminar_documento', 'eliminar_miembro', 'ver_metricas', 'ver_cuentas', 'gestionar_usuarios']) {
    assert.equal(tiene('Administrativo', permiso), false, `Administrativo no debe tener ${permiso}`);
  }

  // Miembro: sólo el calendario, sin atributos por diseño.
  assert.deepEqual([...permisos.permisosEfectivos('Miembro', [])], ['ver_agenda']);
});

test('los cargos guardados antes del modelo siguen funcionando', () => {
  assert.equal(permisos.normalizarRol('Administrador'), 'Director');
  assert.equal(permisos.normalizarRol('Secretaria'), 'Secretario');
  assert.equal(permisos.normalizarRol('Directiva'), 'Administrativo');
  assert.equal(permisos.normalizarRol('AlgoRaro'), 'Miembro');
  assert.equal(permisos.permisosEfectivos('Administrador', []).has('gestionar_usuarios'), true);
});

// ─────────────────────── Las atribuciones sólo suman ───────────────────────

test('una atribución suma permisos y nunca resta los del cargo', () => {
  const antes = permisos.permisosEfectivos('Administrativo', []);
  const conAgenda = permisos.permisosEfectivos('Administrativo', [{ atributo: 'eliminar_agenda', otorgadoPor: { uid: 'u1' } }]);
  assert.equal(conAgenda.has('eliminar_evento'), true);
  for (const permiso of antes) assert.equal(conAgenda.has(permiso), true, `se perdió ${permiso}`);

  // Retirada la atribución (o vencida), el permiso desaparece con ella.
  const vencida = permisos.permisosEfectivos('Administrativo', [{ atributo: 'eliminar_agenda', otorgadoPor: { uid: 'u1' }, hasta: '2020-01-01T00:00:00.000Z' }], Date.now());
  assert.equal(vencida.has('eliminar_evento'), false);
});

test('una atribución caduca la firma que ya puso en un pedido pendiente', () => {
  const hoy = Date.now();
  const firmante = { uid: 'ana', rol: 'Administrativo', activo: true, atribuciones: [{ atributo: 'cupo_direccion', otorgadoPor: { uid: 'f' }, hasta: '2020-01-01T00:00:00.000Z' }] };
  assert.equal(eliminaciones.firmaVigente({ uid: 'ana', nombre: 'Ana', fecha: '' }, 'Director', [firmante], hoy), false);
  const vigente = { ...firmante, atribuciones: [{ atributo: 'cupo_direccion', otorgadoPor: { uid: 'f' }, hasta: new Date(hoy + 86_400_000).toISOString() }] };
  assert.equal(eliminaciones.firmaVigente({ uid: 'ana', nombre: 'Ana', fecha: '' }, 'Director', [vigente], hoy), true);
});

test('quién puede pedir un borrado, por libro', () => {
  const pedir = (rol, tipo, atribuciones) => eliminaciones.puedeSolicitarEliminacion(rol, tipo, atribuciones || []);
  assert.equal(pedir('Director', 'cartas'), true);
  assert.equal(pedir('Secretario', 'integrantes'), true);
  // Tesorería sólo mueve su propio libro.
  assert.equal(pedir('Tesorero', 'documentos'), true);
  assert.equal(pedir('Tesorero', 'cartas'), false);
  // El Ayudante avisa duplicados de cartas y actas; no borra fichas ni documentos.
  assert.equal(pedir('Administrativo', 'cartas'), true);
  assert.equal(pedir('Administrativo', 'actas'), true);
  assert.equal(pedir('Administrativo', 'integrantes'), false);
  // El Vocal y el Miembro no piden borrados, pero el Vocal puede recibirlo.
  assert.equal(pedir('Vocal', 'cartas'), false);
  assert.equal(pedir('Vocal', 'cartas', [{ atributo: 'solicitar_borrados', otorgadoPor: { uid: 'f' } }]), true);
  assert.equal(pedir('Miembro', 'cartas'), false);
});

test('los borrados los autorizan dos cuentas de Dirección y Secretaría', () => {
  assert.equal(eliminaciones.cupoQueSePuedeFirmar('Tesorero'), undefined);
  assert.equal(eliminaciones.cupoQueSePuedeFirmar('Secretario'), 'Secretario');
  assert.equal(eliminaciones.cupoQueSePuedeFirmar('Administrativo', [{ atributo: 'cupo_direccion', otorgadoPor: { uid: 'f' } }]), 'Director');
  // El Desarrollador no ocupa cupo: resuelve por excepción, no como firma.
  assert.equal(eliminaciones.cupoQueSePuedeFirmar('Desarrollador'), undefined);
  assert.equal(eliminaciones.puedeResolverEliminacion('Desarrollador'), true);
});

// ─────────────────────────────── Cupos de acta ───────────────────────────────

test('el acta se cierra con tres cupos de cuentas distintas', () => {
  const acta = { id: 'a1', estado: 'Borrador', version: 1, temasTratados: '', acuerdos: '', fechaReunion: '2026-01-01', titulo: 'Acta', firmadoPor: undefined };
  const firma = (uid, nombre, rol) => ({ uid, nombre, rol, fecha: `${uid}-hora` });
  assert.deepEqual(protocolo.cuposFaltantes(acta), ['Director', 'Secretario', 'Tesorero']);

  const conDos = protocolo.firmarCupo(protocolo.firmarCupo(acta, 'Director', firma('d', 'Dire', 'Director')), 'Secretario', firma('s', 'Secreta', 'Secretario'));
  assert.equal(protocolo.puedeCerrarActa(conDos), false);
  assert.equal(conDos.estado, 'Borrador');

  const conTres = protocolo.firmarCupo(conDos, 'Tesorero', firma('t', 'Teso', 'Tesorero'));
  assert.equal(protocolo.puedeCerrarActa(conTres), true);
  assert.equal(conTres.estado, 'Cerrada');
  assert.equal(conTres.aprobadoPresidente, true);
  assert.equal(conTres.aprobadoTesoreria, true);

  // La Vocalía se puede sumar, pero no es necesaria ni para cerrar ni para abrir.
  const conVocal = protocolo.firmarCupo(conTres, 'Vocal', firma('v', 'Voca', 'Vocal'));
  assert.equal(protocolo.cuposFaltantes(conVocal).length, 0);
  assert.equal(conVocal.aprobadoVocalia, true);
});

test('una misma cuenta no ocupa dos cupos del mismo acta', () => {
  const acta = { id: 'a2', estado: 'Borrador', version: 1, firmas: {}, titulo: 'Acta', fechaReunion: '2026-01-01', temasTratados: '', acuerdos: '' };
  const firmante = { uid: 'misma', nombre: 'Alguien', rol: 'Director', fecha: 'ahora' };
  const conUno = protocolo.firmarCupo(acta, 'Director', firmante);
  assert.throws(() => protocolo.firmarCupo(conUno, 'Secretario', firmante), /un cargo, una firma/i);
});

test('quién ocupa cada cupo: el cargo, o la atribución prestada', () => {
  const ocupar = (rol, cupo, atribuciones) => atributos.puedeOcuparCupo(rol, cupo, atribuciones || []);
  assert.equal(ocupar('Director', 'Director'), true);
  assert.equal(ocupar('Vocal', 'Director'), false);
  assert.equal(ocupar('Vocal', 'Director', [{ atributo: 'cupo_direccion', otorgadoPor: { uid: 'f' } }]), true);
  assert.equal(ocupar('Secretario', 'Secretario'), true);
  assert.equal(ocupar('Administrativo', 'Secretario', [{ atributo: 'cupo_secretaria', otorgadoPor: { uid: 'f' }, hasta: '2020-01-01T00:00:00.000Z' }]), false);
  assert.equal(ocupar('Tesorero', 'Tesorero'), true);
  // El cupo de Vocalía es el único que no se puede prestar.
  assert.equal(ocupar('Director', 'Vocal'), false);
  assert.equal(ocupar('Vocal', 'Vocal'), true);
  assert.equal(ocupar('Desarrollador', 'Director'), true);
});

test('la reapertura la autorizan Dirección y Secretaría; el Tesorero vuelve a firmar al cerrar', () => {
  const cerrado = { id: 'a3', estado: 'Cerrada', version: 3, titulo: 'Acta', fechaReunion: '2026-01-01', temasTratados: 'Antes', acuerdos: 'Antes', firmas: {
    Director: { uid: 'd', nombre: 'Dire', rol: 'Director', fecha: 'f1' },
    Secretario: { uid: 's', nombre: 'Secreta', rol: 'Secretario', fecha: 'f2' },
    Tesorero: { uid: 't', nombre: 'Teso', rol: 'Tesorero', fecha: 'f3' }
  } };
  const pedida = protocolo.solicitarApertura(cerrado);
  assert.equal(pedida.estado, 'En_Solicitud_Edicion');
  assert.equal(Object.keys(pedida.firmas || {}).length, 0, 'al pedir apertura se limpian las firmas');
  assert.equal(protocolo.puedeEditarTrasApertura(pedida), false);

  assert.throws(() => protocolo.autorizarApertura(pedida, 'Tesorero', { uid: 't', nombre: 'Teso', rol: 'Tesorero', fecha: 'x' }), /solo Dirección y Secretaría/i);

  const conDirector = protocolo.autorizarApertura(pedida, 'Director', { uid: 'd', nombre: 'Dire', rol: 'Director', fecha: 'x' });
  assert.equal(conDirector.estado, 'En_Solicitud_Edicion', 'una sola autorización no abre el acta');
  assert.equal(conDirector.aprobadoPresidente, true, 'la autorización queda espejada en los campos viejos');

  const conSecretaria = protocolo.autorizarApertura(conDirector, 'Secretario', { uid: 's', nombre: 'Secreta', rol: 'Secretario', fecha: 'y' });
  assert.equal(conSecretaria.estado, 'Borrador');
  assert.equal(protocolo.puedeEditarTrasApertura({...conSecretaria, estado: 'En_Solicitud_Edicion'}), true);

  // Guardar la edición deja el texto nuevo sin firmas, con las tres por volver a poner.
  const editada = protocolo.aplicarEdicion({ ...conSecretaria, estado: 'Borrador', aprobadoPresidente: true, aprobadoSecretaria: true }, 'Después', 'Acuerdos', [
    { uid: 'd', nombre: 'Dire', rol: 'Director', fecha: 'x' },
    { uid: 's', nombre: 'Secreta', rol: 'Secretario', fecha: 'y' }
  ]);
  assert.equal(editada.version, 4);
  assert.equal(Object.keys(editada.firmas || {}).length, 0);
  assert.deepEqual(editada.backupAnterior.temasTratados, 'Antes');
  assert.equal(editada.edicionAutorizadaPor.length, 2, 'queda la constancia de quién autorizó editar');
  assert.deepEqual(protocolo.cuposFaltantes(editada), ['Director', 'Secretario', 'Tesorero']);
});

// ───────────────────────────── Altas y esperas ─────────────────────────────

test('una cuenta nueva no entra al ministerio hasta que la aceptan', () => {
  const ahora = Date.parse('2026-09-21T12:00:00.000Z');
  const pendiente = { estadoIngreso: 'Pendiente', fechaIngreso: '2026-09-20T12:00:00.000Z' };
  assert.equal(ingresos.puedeIngresar(pendiente, ahora), false, 'mientras espera no ve la agenda');
  assert.equal(permisos.puedeConAtribuciones('Miembro', 'ver_agenda', []), true);
  assert.equal(ingresos.puede(pendiente, 'ver_agenda', ahora), false, 'puede() también bloquea al pendiente');
  assert.equal(ingresos.puede({ ...pendiente, estadoIngreso: 'Aceptado', rol: 'Miembro', activo: true }, 'ver_agenda', ahora), true);

  // Las cuentas anteriores al flujo no traen estado y no pierden el acceso.
  assert.equal(ingresos.puedeIngresar({ rol: 'Miembro', activo: true }, ahora), true);
  assert.equal(ingresos.puedeIngresar({ estadoIngreso: 'Rechazado', fechaIngreso: '2026-09-20T12:00:00.000Z' }, ahora), false);
});

test('el pedido sin respuesta caduca a los 30 días y queda en el historial', () => {
  const hace40 = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const cuenta = { estadoIngreso: 'Pendiente', fechaIngreso: hace40 };
  assert.equal(ingresos.estaVencidoIngreso(cuenta), true);
  assert.equal(ingresos.estadoVigente(cuenta), 'Sin respuesta');
  assert.equal(ingresos.diasRestantes({ fechaIngreso: new Date().toISOString() }) > 28, true);
  assert.match(ingresos.mensajeEspera('Sin respuesta'), /vuelve a entrar/i);
});

test('aceptar y rechazar sólo lo hace Dirección, Secretaría o Desarrollador', () => {
  const puede = (rol, atribuciones) => ingresos.puedeGestionarIngresos(rol, atribuciones || []);
  assert.equal(puede('Director'), true);
  assert.equal(puede('Secretario'), true);
  assert.equal(puede('Desarrollador'), true);
  assert.equal(puede('Vocal'), false, 'el Vocal no acepta ingresos');
  assert.equal(puede('Tesorero'), false);
  assert.equal(puede('Miembro'), false);
});

test('la ficha creada a mano sirve para las estadísticas y se puede vincular después', () => {
  const cuentaNueva = { nombre: 'Ana Pérez', email: 'ana@correo.cl' };
  const ficha = ingresos.fichaDesdeCuenta(cuentaNueva, { cuerda: 'Tenor', iglesia: 'Central' });
  assert.equal(ficha.nombreCompleto, 'Ana Pérez');
  assert.equal(ficha.cuerda, 'Tenor');
  assert.equal(ficha.estado, 'Activo');

  const integrantes = [
    { id: 'i1', nombreCompleto: 'Bea Sol', email: 'otra@correo.cl', cuerda: 'Soprano', estado: 'Activo' },
    { id: 'i2', nombreCompleto: 'Ana Pérez', email: '', cuerda: 'Directiva', estado: 'Activo' }
  ];
  // Se sugiere por nombre exacto cuando el correo no coincide con ninguna ficha.
  assert.equal(ingresos.sugerirFicha(cuentaNueva, integrantes).id, 'i2');
  assert.equal(ingresos.sugerirFicha({ nombre: 'Bea Sol', email: 'ana@correo.cl' }, integrantes).id, 'i1');
  assert.equal(ingresos.sugerirFicha({ nombre: 'Nadie', email: '' }, integrantes), undefined);
});

// ─────────────────────────── Traspaso de la Dirección ───────────────────────────

test('la oferta de cargo vive 24 horas y sólo la puede responder su destinatario', () => {
  const ahora = Date.parse('2026-09-21T12:00:00.000Z');
  const directora = { uid: 'd', nombre: 'Dire', rol: 'Director', activo: true };
  const oferta = traspasos.crearOferta({ uid: 'nuevo' }, directora, { uid: 'd', nombre: 'Dire', rol: 'Director', fecha: new Date(ahora).toISOString() }, ahora);
  assert.equal(oferta.estado, 'Pendiente');
  assert.equal(traspasos.puedeResponder(oferta, 'nuevo', ahora), true);
  assert.equal(traspasos.puedeResponder(oferta, 'nuevo', ahora + traspasos.VENTANA_TRASPASO_MS + 1), false);
  assert.equal(traspasos.estadoVigente(oferta, ahora + traspasos.VENTANA_TRASPASO_MS + 1), 'Vencida');

  // Nadie ofrece la Dirección si no la tiene, y la cuenta fundadora no la traspasa.
  assert.equal(traspasos.puedeOfrecerCargo({ rol: 'Secretario', activo: true }, false), false);
  assert.equal(traspasos.puedeOfrecerCargo({ rol: 'Director', activo: true }, true), false);
  assert.equal(traspasos.puedeOfrecerCargo({ rol: 'Director', activo: true }, false), true);
});

test('al aceptar se intercambian los cargos; si no, no cambia nada', () => {
  const ahora = Date.now();
  const oferta = { ...traspasos.crearOferta({ uid: 'nuevo' }, { uid: 'd', nombre: 'Dire', rol: 'Director' }, { uid: 'd', nombre: 'Dire', rol: 'Director', fecha: '' }, ahora), cargoOfrecido: 'Director', cargoDeQuienOfrece: 'Miembro' };
  const cambio = traspasos.aplicarAceptacion({ uid: 'd', rol: 'Director' }, { uid: 'nuevo', rol: 'Vocal' }, oferta, ahora);
  assert.deepEqual(cambio.ofrece, { uid: 'd', rol: 'Miembro' });
  assert.deepEqual(cambio.recibe, { uid: 'nuevo', rol: 'Director' });

  // Rechazo o vencimiento: sin cambio de roles y con la oferta cerrada.
  assert.equal(traspasos.cerrarOferta(oferta, 'Rechazada', ahora).estado, 'Rechazada');
  const vencida = { ...oferta, expiraEn: new Date(ahora - 1000).toISOString() };
  assert.equal(traspasos.aplicarAceptacion({ uid: 'd', rol: 'Director' }, { uid: 'nuevo', rol: 'Vocal' }, vencida, ahora), undefined);
});

// ───────────────────────────── Autorías y acuses ─────────────────────────────

test('toda autoría guarda nombre, cargo y hora; las iniciales se desambigan', () => {
  const firma = autorias.firmar({ uid: 'u1', nombre: 'Ana Pérez', rol: 'Secretario' }, '2026-09-21T12:00:00.000Z');
  assert.equal(firma.nombre, 'Ana Pérez');
  assert.equal(firma.rol, 'Secretario');
  assert.match(autorias.etiquetaDetalle(firma), /Ana Pérez/);
  assert.match(autorias.etiquetaDetalle(firma), /Secretario/);

  const mismas = [
    { uid: 'a', nombre: 'Ana Pérez', rol: 'Director', fecha: '' },
    { uid: 'b', nombre: 'Ana Ruiz', rol: 'Secretario', fecha: '' }
  ];
  const etiquetas = mismas.map(a => autorias.etiquetaCorta(a, mismas));
  assert.notEqual(etiquetas[0], etiquetas[1], 'dos "AP" no pueden mostrarse iguales');
});

test('un acuse nuevo es un objeto y los viejos se leen sin tocarlos', () => {
  const acuse = autorias.crearAcuse({ uid: 'u2', nombre: 'Bea Sol', rol: 'Tesorero' }, '2026-09-21T13:00:00.000Z');
  assert.equal(acuse.uid, 'u2');
  const lista = autorias.agregarAcuse(['AP'], acuse);
  assert.equal(lista.length, 2);
  assert.equal(autorias.normalizarAcuses(lista)[0].nombre, 'AP', 'el acuse antiguo conserva sus iniciales');
  assert.equal(autorias.normalizarAcuses(lista)[1].nombre, 'Bea Sol');
  // El mismo uid no acusa dos veces: el acuse anterior se conserva.
  assert.deepEqual(autorias.agregarAcuse(lista, { ...acuse, fecha: 'otra' }), lista);
  assert.equal(autorias.yaAcusado(autorias.normalizarAcuses(lista), 'u2'), true);
  assert.match(autorias.acusesComoTexto(lista), /AP/);
});

test('el aviso de carta corregida no reinicia el acuse de quien ya la leyó', () => {
  const leyoAntes = [{ uid: 'u1', nombre: 'Ana', rol: 'Vocal', fecha: '2026-09-20T10:00:00.000Z' }];
  const editadaEn = '2026-09-21T10:00:00.000Z';
  assert.equal(autorias.yaAcusado(leyoAntes, 'u1'), true, 'el acuse sigue puesto');
  assert.equal(Date.parse(leyoAntes[0].fecha) < Date.parse(editadaEn), true, 'pero es anterior a la corrección');
  // Y la lista sigue intacta: nadie pierde su lectura.
  assert.equal(autorias.normalizarAcuses(leyoAntes).length, 1);
});
