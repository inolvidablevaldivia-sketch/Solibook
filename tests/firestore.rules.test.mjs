import { test } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Ejecutar con Firebase Emulator Suite; jamás apunta a producción.
test('reglas de Firebase: eliminaciones, privacidad y firmas', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  const [host, puerto] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const env = await initializeTestEnvironment({ projectId: 'demo-solibook', firestore: { host, port: Number(puerto), rules: fs.readFileSync('firestore.rules', 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async contexto => {
      const db = contexto.firestore();
      for (const [uid, rol] of [['d', 'Director'], ['s', 'Secretario'], ['dev', 'Desarrollador'], ['m', 'Miembro'], ['t', 'Tesorero']]) await setDoc(doc(db, 'usuarios', uid), { uid, rol, activo: true, integranteId: 'm', nombre: uid });
      for (const coleccion of ['cartas', 'actas', 'documentos', 'integrantes']) await setDoc(doc(db, coleccion, 'registro'), { titulo: 'Original', vistoPor: [] });
      await setDoc(doc(db, 'configuracion/estado'), { fundador: 'd' });
    });
    const d = env.authenticatedContext('d').firestore();
    const s = env.authenticatedContext('s').firestore();
    const dev = env.authenticatedContext('dev').firestore();
    const m = env.authenticatedContext('m').firestore();
    await t.test('ningún cliente borra directamente, ni fundador ni desarrollador', async () => {
      for (const db of [d, s, dev, m]) for (const coleccion of ['cartas', 'actas', 'documentos', 'integrantes']) await assertFails(deleteDoc(doc(db, coleccion, 'registro')));
    });
    await t.test('solicitudes, bloqueos y auditoría no se pueden falsificar', async () => {
      for (const coleccion of ['solicitudes_eliminacion', 'bloqueos_eliminacion', 'registros_eliminados', 'cola_avisos']) await assertFails(setDoc(doc(dev, coleccion, 'falso'), { estado: 'Eliminado' }));
    });
    await t.test('bloqueo impide editar y tombstone impide resucitar', async () => {
      await assertSucceeds(updateDoc(doc(d, 'documentos/registro'), { titulo: 'Antes del bloqueo' }));
      await env.withSecurityRulesDisabled(async contexto => {
        await setDoc(doc(contexto.firestore(), 'bloqueos_eliminacion/documentos__registro'), { solicitudId: 'pendiente' });
        await setDoc(doc(contexto.firestore(), 'registros_eliminados/cartas__borrada'), { solicitudId: 'cerrada' });
      });
      await assertFails(updateDoc(doc(d, 'documentos/registro'), { titulo: 'Cambio no autorizado' }));
      await assertFails(setDoc(doc(d, 'cartas/borrada'), { asunto: 'Resucitada', vistoPor: [] }));
    });
    await t.test('alias es privado incluso frente a Dirección; nadie escribe sus propios avisos', async () => {
      await assertSucceeds(setDoc(doc(m, 'usuarios/m/privado/ajustes'), { nombrePrivado: 'Solo mío' }));
      await assertSucceeds(getDoc(doc(m, 'usuarios/m/privado/ajustes')));
      await assertFails(getDoc(doc(d, 'usuarios/m/privado/ajustes')));
      await assertFails(setDoc(doc(m, 'usuarios/m/avisos/falso'), { titulo: 'falso' }));
      await assertFails(getDoc(doc(m, 'usuarios/s/avisos/otro')));
    });
    await t.test('acta solo abre con firmas reales de dos cargos distintos', async () => {
      await env.withSecurityRulesDisabled(async contexto => setDoc(doc(contexto.firestore(), 'actas/firmas'), { titulo: 'Acta', estado: 'Cerrada', version: 1, aprobadoPresidente: true, aprobadoSecretaria: true, temasTratados: 'Antes', acuerdos: 'Antes' }));
      await assertFails(updateDoc(doc(d, 'actas/firmas'), { acuerdos: 'Edición sin abrir' }));
      await assertSucceeds(updateDoc(doc(d, 'actas/firmas'), { estado: 'En_Solicitud_Edicion', aprobadoPresidente: false, aprobadoSecretaria: false, firmaEdicionDirectorUid: '', firmaEdicionSecretarioUid: '' }));
      await assertFails(updateDoc(doc(d, 'actas/firmas'), { aprobadoSecretaria: true, firmaEdicionSecretarioUid: 'd' }));
      await assertSucceeds(updateDoc(doc(d, 'actas/firmas'), { aprobadoPresidente: true, firmaEdicionDirectorUid: 'd' }));
      await assertSucceeds(updateDoc(doc(s, 'actas/firmas'), { aprobadoSecretaria: true, firmaEdicionSecretarioUid: 's', estado: 'Borrador' }));
      await assertSucceeds(updateDoc(doc(s, 'actas/firmas'), { acuerdos: 'Autorizado', estado: 'Cerrada', version: 2 }));
    });
  } finally { await env.cleanup(); }
});
