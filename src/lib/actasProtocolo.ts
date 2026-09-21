import type { Acta, CupoFirma, FirmaActa } from '../types/index';

// ═══════════════════ Protocolo de firmas del acta ═══════════════════
// Un acta se cierra con tres firmas obligatorias: Dirección, Secretaría y
// Tesorería. La de Vocalía es la cuarta y es opcional: suma constancia, pero no
// abre ni cierra nada. Cerrado el acta, cualquier cambio vuelve a pedir el
// doble check de Dirección y Secretaría, y después los tres deben firmar de
// nuevo sobre el texto corregido.

export const CUPOS_APERTURA: CupoFirma[] = ['Director', 'Secretario', 'Tesorero', 'Vocal'];
export const CUPOS_OBLIGATORIOS: CupoFirma[] = ['Director', 'Secretario', 'Tesorero'];

export const ETIQUETA_CUPO: Record<CupoFirma, string> = {
  Director: 'Dirección',
  Secretario: 'Secretaría',
  Tesorero: 'Tesorería',
  Vocal: 'Vocalía'
};

/** Campos espejo que leen las reglas de Firestore y las versiones anteriores. */
const CAMPO_LEGADO: Partial<Record<CupoFirma, { aprobado: 'aprobadoPresidente' | 'aprobadoSecretaria' | 'aprobadoTesoreria' | 'aprobadoVocalia'; uid: 'firmaEdicionDirectorUid' | 'firmaEdicionSecretarioUid' | 'firmaEdicionTesoreroUid' | 'firmaEdicionVocalUid' }>> = {
  Director: { aprobado: 'aprobadoPresidente', uid: 'firmaEdicionDirectorUid' },
  Secretario: { aprobado: 'aprobadoSecretaria', uid: 'firmaEdicionSecretarioUid' },
  Tesorero: { aprobado: 'aprobadoTesoreria', uid: 'firmaEdicionTesoreroUid' },
  Vocal: { aprobado: 'aprobadoVocalia', uid: 'firmaEdicionVocalUid' }
};

/**
 * Estado de los cupos. Los actas anteriores a este modelo no traen `firmas`:
 * se reconstruyen desde los campos legados, así ninguna apertura firmada en el
 * pasado se pierde ni se invalida.
 */
export function firmasDelActa(acta: Acta): Partial<Record<CupoFirma, FirmaActa>> {
  if (acta.firmas && Object.keys(acta.firmas).length) return acta.firmas;
  const firmas: Partial<Record<CupoFirma, FirmaActa>> = {};
  for (const cupo of CUPOS_APERTURA) {
    const legado = CAMPO_LEGADO[cupo]!;
    const uid = (acta[legado.uid] as string | undefined) || '';
    if (!uid) continue;
    firmas[cupo] = { uid, nombre: uid, rol: cupo === 'Director' ? 'Director' : cupo, fecha: '' };
  }
  return firmas;
}

export function estaFirmado(acta: Acta, cupo: CupoFirma): boolean {
  return !!firmasDelActa(acta)[cupo]?.uid;
}

/** Los tres obligatorios, por cuentas distintas. Con eso el acta queda cerrada. */
export function puedeCerrarActa(acta: Acta): boolean {
  const firmas = firmasDelActa(acta);
  const uids = CUPOS_OBLIGATORIOS.map(cupo => firmas[cupo]?.uid || '');
  if (uids.some(uid => !uid)) return false;
  return new Set(uids).size === uids.length;
}

/** Cupo que falta para cerrar, en el orden en que se pide. */
export function cuposFaltantes(acta: Acta): CupoFirma[] {
  const firmas = firmasDelActa(acta);
  return CUPOS_OBLIGATORIOS.filter(cupo => !firmas[cupo]?.uid);
}

/**
 * Aplica una firma al acta, con los campos espejo. Nadie firma dos cupos en el
 * mismo acta: eso evitaría el doble check con dos cargos propios.
 */
export function firmarCupo(acta: Acta, cupo: CupoFirma, firma: FirmaActa): Acta {
  const firmas = { ...firmasDelActa(acta) };
  const ocupadoPorOtro = Object.entries(firmas).find(
    ([otroCupo, otra]) => otroCupo !== cupo && otra?.uid === firma.uid
  );
  if (ocupadoPorOtro) throw new Error(`Esta cuenta ya firmó como ${ETIQUETA_CUPO[ocupadoPorOtro[0] as CupoFirma]}. Un cargo, una firma por acta.`);
  firmas[cupo] = firma;
  const siguiente: Acta = espiarCamposLegados({ ...acta, firmas });
  if (puedeCerrarActa(siguiente)) siguiente.estado = 'Cerrada';
  return siguiente;
}

/** Escribe y limpia los campos espejo a partir del mapa de firmas. */
function espiarCamposLegados(acta: Acta): Acta {
  // Un acta anterior al mapa de firmas se reconstruye desde sus campos espejo,
  // así una apertura firmada antes no se queda sin constancia. `firmas: {}`
  // explícito sí manda: es la limpieza que se hace al abrir o al corregir.
  const firmas = acta.firmas ? acta.firmas : firmasDelActa(acta);
  const espejo = acta as unknown as Record<string, unknown>;
  for (const [cupo, campos] of Object.entries(CAMPO_LEGADO)) {
    espejo[campos.aprobado] = !!firmas[cupo as CupoFirma]?.uid;
    espejo[campos.uid] = firmas[cupo as CupoFirma]?.uid || '';
  }
  return { ...acta, ...espejo, firmas };
}

/**
 * Solicitud de apertura de un acta cerrada: se limpian las firmas y queda a
 * espera del doble check de Dirección y Secretaría.
 */
export function solicitarApertura(acta: Acta): Acta {
  return espiarCamposLegados({ ...acta, estado: 'En_Solicitud_Edicion', firmas: {} });
}

/**
 * Firma durante la reapertura: solo Dirección y Secretaría, y con dos cuentas
 * distintas. Cuando están las dos, el acta pasa a borrador editable.
 */
export function autorizarApertura(
  acta: Acta,
  cupo: CupoFirma,
  firma: FirmaActa
): Acta {
  if (cupo !== 'Director' && cupo !== 'Secretario') {
    throw new Error('La reapertura de un acta la autorizan solo Dirección y Secretaría.');
  }
  const firmas = { ...firmasDelActa(acta) };
  const otra = Object.entries(firmas).find(([otroCupo, otraFirma]) => otroCupo !== cupo && otraFirma?.uid === firma.uid);
  if (otra) throw new Error(`Esta cuenta ya firmó como ${ETIQUETA_CUPO[otra[0] as CupoFirma]}. Un cargo, una firma por acta.`);
  firmas[cupo] = firma;
  const autoriz = !!firmas.Director?.uid && !!firmas.Secretario?.uid && firmas.Director.uid !== firmas.Secretario.uid;
  return espiarCamposLegados({
    ...acta,
    firmas,
    estado: autoriz ? 'Borrador' : 'En_Solicitud_Edicion'
  });
}

/** Autorizaciones de reapertura: solo Dirección y Secretaría, dos cuentas. */
export function puedeEditarTrasApertura(acta: Acta): boolean {
  const firmas = acta.firmas || {};
  const director = firmas.Director?.uid || '';
  const secretario = firmas.Secretario?.uid || '';
  return acta.estado === 'En_Solicitud_Edicion' && !!director && !!secretario && director !== secretario;
}

/**
 * Guardar una edición autorizada deja el acta en borrador con las firmas
 * limpias: los tres cupos vuelven a firmar sobre el texto corregido.
 */
export function aplicarEdicion(
  acta: Acta,
  temasTratados: string,
  acuerdos: string,
  autorizacion?: FirmaActa[]
): Acta {
  const respaldo = {
    temasTratados: acta.temasTratados,
    acuerdos: acta.acuerdos,
    fechaModificacion: new Date().toISOString()
  };
  return espiarCamposLegados({
    ...acta,
    temasTratados,
    acuerdos,
    version: (acta.version || 0) + 1,
    backupAnterior: respaldo,
    estado: 'Borrador',
    // Las firmas de cierre se limpian: nadie queda amarrado a un texto que no
    // leyó. La autorización que permitió editar queda anotada aparte.
    firmas: {},
    ...(autorizacion && autorizacion.length ? { edicionAutorizadaPor: autorizacion } : {})
  });
}
