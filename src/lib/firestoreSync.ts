'use client';

// Capa de sincronización en tiempo real con Cloud Firestore.
//
// Diseño:
// - Cada colección de la app se escucha con onSnapshot: cualquier cambio hecho
//   por otro usuario llega al instante y reemplaza el estado local.
// - Las escrituras son "dispara y olvida": el estado local se actualiza de
//   forma optimista y Firestore propaga el cambio (con caché persistente, los
//   cambios hechos sin conexión se encolan y se suben al recuperar internet).
// - Si Firestore no responde o las reglas rechazan el acceso (p. ej. "modo
//   local" sin sesión de Google), la app sigue funcionando con localStorage
//   tal como lo hacía antes de la sincronización.

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';

// Nombres de las colecciones usadas en Firestore (mismo criterio que las
// claves de localStorage históricas, sin el prefijo "solibook_").
export const COLECCIONES = {
  integrantes: 'integrantes',
  eventos: 'eventos',
  asistencias: 'asistencias',
  cartas: 'cartas',
  actas: 'actas',
  justificaciones: 'justificaciones',
  notificaciones: 'notificaciones',
  documentos: 'documentos',
  documentosEvento: 'documentos_evento',
  usuarios: 'usuarios'
} as const;

// Documento de configuración compartida (tipos de evento personalizados)
export const DOC_CONFIG_GENERAL = { coleccion: 'configuracion', id: 'general' } as const;

// La mayoría de las entidades usan `id`; los usuarios usan `uid`.
const idPorDefecto = <T>(item: T): string => (item as { id: string }).id;

const aviso = (operacion: string, coleccion: string, error: unknown) => {
  const codigo = (error as { code?: string })?.code;
  if (codigo === 'permission-denied') {
    console.warn(
      `[Sync] Sin permiso para ${operacion} en "${coleccion}". ` +
        'Revisa las reglas de Firestore o inicia sesión. La app sigue en modo local.'
    );
  } else {
    console.warn(`[Sync] Error al ${operacion} en "${coleccion}":`, error);
  }
};

// Firestore no acepta valores `undefined`. Los limpiamos de forma recursiva
// (también dentro de arreglos y objetos anidados) para que escribir objetos
// con campos opcionales vacíos sea seguro.
export const limpiarDatos = <T>(valor: T): T => {
  if (Array.isArray(valor)) return valor.map(item => limpiarDatos(item)) as T;
  if (valor !== null && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, valorInterno] of Object.entries(valor as Record<string, unknown>)) {
      if (valorInterno !== undefined) salida[clave] = limpiarDatos(valorInterno);
    }
    return salida as T;
  }
  return valor;
};

const comoDocumento = (datos: object) => limpiarDatos(datos) as Record<string, unknown>;

// Guarda (crea o reemplaza por completo) un documento.
export const guardarDocumento = async (
  coleccion: string,
  id: string,
  datos: object
): Promise<void> => {
  try {
    await setDoc(doc(db, coleccion, id), comoDocumento(datos));
  } catch (error) {
    aviso('guardar', coleccion, error);
  }
};

// Escribe varios documentos por lotes atómicos de 450 operaciones.
const escribirLote = async <T>(
  coleccion: string,
  documentos: T[],
  obtenerId: (item: T) => string
): Promise<void> => {
  for (let i = 0; i < documentos.length; i += 450) {
    const lote = writeBatch(db);
    documentos
      .slice(i, i + 450)
      .forEach(item => lote.set(doc(db, coleccion, obtenerId(item)), comoDocumento(item as object)));
    await lote.commit();
  }
};

export const guardarDocumentos = async <T extends { id: string }>(
  coleccion: string,
  documentos: T[]
): Promise<void> => {
  if (documentos.length === 0) return;
  try {
    await escribirLote(coleccion, documentos, idPorDefecto);
  } catch (error) {
    aviso('guardar lote', coleccion, error);
  }
};

export const eliminarDocumento = async (coleccion: string, id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, coleccion, id));
  } catch (error) {
    aviso('eliminar', coleccion, error);
  }
};

export const eliminarDocumentos = async (coleccion: string, ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  try {
    for (let i = 0; i < ids.length; i += 450) {
      const lote = writeBatch(db);
      ids.slice(i, i + 450).forEach(id => lote.delete(doc(db, coleccion, id)));
      await lote.commit();
    }
  } catch (error) {
    aviso('eliminar lote', coleccion, error);
  }
};

// Siembra una colección vacía con los datos locales, pero solo si ningún otro
// dispositivo lo hizo antes. El documento "configuracion/semillas" actúa de
// candado dentro de una transacción: evita siembras duplicadas y también que
// los datos reaparezcan si alguien vació la colección a propósito.
const reclamarYSembrar = async <T>(
  coleccion: string,
  semilla: T[],
  obtenerId: (item: T) => string
): Promise<void> => {
  try {
    const metaRef = doc(db, 'configuracion', 'semillas');
    const reclamado = await runTransaction(db, async transaccion => {
      const meta = await transaccion.get(metaRef);
      if (meta.exists() && meta.data()?.[coleccion]) return false;
      transaccion.set(metaRef, { [coleccion]: new Date().toISOString() }, { merge: true });
      return true;
    });
    if (!reclamado) return;
    await escribirLote(coleccion, semilla, obtenerId);
  } catch (error) {
    aviso('sembrar', coleccion, error);
  }
};

// Escucha una colección completa en tiempo real.
// - alRecibir: se llama con la lista completa en cada cambio remoto o local.
// - obtenerSemilla: datos a subir si la nube está vacía (migración inicial).
//   Devolver [] para colecciones que no se siembran.
// - obtenerId: cómo extraer el id de cada documento al sembrar (uid en usuarios).
// - alFallar: reacción ante un error del oyente (p. ej. permiso denegado por rol).
export const suscribirseColeccion = <T extends object>(
  coleccion: string,
  alRecibir: (items: T[]) => void,
  obtenerSemilla: () => T[],
  obtenerId: (item: T) => string = idPorDefecto,
  alFallar?: (error: { code?: string }) => void
): Unsubscribe => {
  return onSnapshot(
    collection(db, coleccion),
    snapshot => {
      const items = snapshot.docs.map(d => d.data() as T);
      if (items.length === 0 && !snapshot.metadata.fromCache) {
        // La nube está vacía: intentar migrar los datos locales (una sola vez).
        const semilla = obtenerSemilla();
        if (semilla.length > 0) {
          void reclamarYSembrar(coleccion, semilla, obtenerId);
          return; // el siguiente snapshot ya traerá los documentos sembrados
        }
      }
      alRecibir(items);
    },
    error => {
      aviso('escuchar', coleccion, error);
      alFallar?.(error);
    }
  );
};

// Escucha un documento puntual (usado para la configuración compartida).
export const suscribirseDocumento = <T>(
  coleccion: string,
  id: string,
  alRecibir: (datos: T | null) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, coleccion, id),
    snapshot => alRecibir(snapshot.exists() ? (snapshot.data() as T) : null),
    error => aviso('escuchar', `${coleccion}/${id}`, error)
  );
};
