import type { AcuseRecibo, Autoria } from '../types/index';

// ═══════════════════ Cómo se lee «quién fue» ═══════════════════
// Varios cargos se repiten (dos Directores, dos Vocales, los ayudantes de
// Secretaría y Tesorería). Para que se distingan sin llenar la pantalla de
// texto, hay una sola convención en toda la app:
//
//   · espacios chicos  → iniciales de nombre y apellido: «DR» (Daniel Rojas)
//   · detalles         → nombre completo, cargo y hora:
//                        «Daniel Rojas · Vocal · 12 mar 2026, 14:32»
//
// Las iniciales se calculan, nunca se guardan. Si dos personas del mismo
// documento chocan, se amplían con la siguiente palabra del nombre; si el
// nombre completo es idéntico pero las cuentas son distintas, se numeran,
// porque el uid manda y dos personas no se fusionan por parecerse.

/** Iniciales de nombre y apellido. Sin nombre devuelve vacío: no se inventa. */
export function inicialesDe(nombre: string | undefined): string {
  return (nombre || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0]!.toUpperCase())
    .join('');
}

/** Iniciales tomadas de las primeras `cantidad` palabras del nombre. */
function inicialesConPalabras(nombre: string | undefined, cantidad: number): string {
  const partes = (nombre || '').split(' ').filter(Boolean).slice(0, cantidad);
  const siglas = partes.map(parte => parte[0]!.toUpperCase()).join('');
  return siglas || 'SD';
}

/**
 * Etiqueta corta para un grupo que se muestra junto (los acuses de una carta,
 * las firmas de un acta). Desambigua sin preguntar.
 */
export function etiquetasCortas(grupo: Autoria[]): string[] {
  const base = grupo.map(a => inicialesConPalabras(a.nombre, 2));
  const etiquetas = [...base];
  // La misma cuenta repetida (alguien que acusó dos veces) no es otra persona.
  const esOtraPersona = (i: number, j: number) => i !== j && (grupo[j]?.uid || j) !== (grupo[i]?.uid || i);
  const ocupada = (valor: string, excepto: number) =>
    etiquetas.some((etiqueta, j) => j !== excepto && etiqueta === valor);

  // Ronda 1: a quien choca se le amplía con más palabras del nombre.
  base.forEach((actual, i) => {
    const choca = base.some((etiqueta, j) => etiqueta === actual && esOtraPersona(i, j));
    if (!choca) return;
    const palabras = (grupo[i].nombre || '').split(' ').filter(Boolean).length;
    for (let cantidad = 3; cantidad <= Math.max(palabras, 4); cantidad++) {
      const ampliada = inicialesConPalabras(grupo[i].nombre, cantidad);
      if (ampliada === actual || ocupada(ampliada, i)) continue;
      etiquetas[i] = ampliada;
      return;
    }
  });

  // Ronda 2: mismo nombre y apellidos en cuentas distintas → se numeran.
  const vistas = new Map<string, number>();
  return etiquetas.map((etiqueta, i) => {
    const duplicada = etiquetas.some((valor, j) => j !== i && valor === etiqueta && esOtraPersona(i, j));
    if (!duplicada) return etiqueta || 'SD';
    const numero = (vistas.get(etiqueta) || 0) + 1;
    vistas.set(etiqueta, numero);
    return `${etiqueta} ${numero}`;
  });
}

/** Etiqueta corta de una persona, dado el grupo en el que aparece. */
export function etiquetaCorta(autor: Autoria | undefined, grupo: Autoria[] = []): string {
  if (!autor) return '—';
  const todas = grupo.length ? grupo : [autor];
  const indice = Math.max(todas.findIndex(a => a.uid === autor.uid), 0);
  return etiquetasCortas(todas)[indice] || inicialesDe(autor.nombre) || 'SD';
}

/** Nombre completo, cargo y hora. Para fichas, detalles y PDF. */
export function etiquetaDetalle(autor: Autoria | null | undefined): string {
  if (!autor) return 'Sin registro de autoría';
  const nombre = autor.nombre || 'Sin nombre';
  const cuerpo = autor.rol ? `${nombre} · ${autor.rol}` : nombre;
  const fecha = fechaLegible(autor.fecha);
  return fecha ? `${cuerpo} · ${fecha}` : cuerpo;
}

/**
 * Une columnas sueltas (`xUid`, `xNombre`, `xRol`, `xFecha`) en una autoría.
 * Los documentos anteriores a este modelo guardan los campos por separado.
 */
export function autorDe(uid?: string, nombre?: string, rol?: string, fecha?: string): Autoria | undefined {
  if (!uid && !nombre && !rol) return undefined;
  return { uid: uid || '', nombre: nombre || '', rol: rol || '', fecha };
}

/** Firma de la sesión actual, para escribirla dentro de un documento. */
export function firmar(
  sesion: { uid: string; nombre: string; rol: string } | null | undefined,
  fecha: string = new Date().toISOString()
): Autoria | undefined {
  if (!sesion) return undefined;
  return { uid: sesion.uid, nombre: sesion.nombre, rol: sesion.rol, fecha };
}

// ═══════════════════ Acuses de recibo ═══════════════════
// Un acuse es una autoría. Antes se guardaban sólo iniciales en una lista de
// strings, lo que impedía saber cuál de los Directores había leído una carta y
// hacía que dos personas con las mismas iniciales se bloquearan entre sí. Se
// acepta el formato antiguo y se muestra tal cual, sin disfrazarlo.

export type AcuseGuardado = AcuseRecibo | string;

/** Fecha legable en hora de Chile. Con valores ilegibles devuelve vacío. */
export function fechaLegible(iso: string | undefined): string {
  if (!iso) return '';
  const momento = Date.parse(iso);
  if (!Number.isFinite(momento)) return '';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
    .format(new Date(momento))
    .replace(/\./g, '');
}

/** Un acuse antiguo era solo una cadena con las iniciales. */
export function esAcuseAntiguo(acuse: AcuseGuardado): boolean {
  return typeof acuse === 'string';
}

export function normalizarAcuse(acuse: AcuseGuardado): AcuseRecibo {
  if (typeof acuse === 'string') {
    // Registro legado: se conserva el texto y se marca que no hay uid ni fecha.
    return { uid: '', nombre: acuse.trim(), rol: 'acuse antiguo', fecha: '' };
  }
  if (!acuse || typeof acuse !== 'object') return { uid: '', nombre: '', rol: '', fecha: '' };
  return {
    uid: typeof acuse.uid === 'string' ? acuse.uid : '',
    nombre: typeof acuse.nombre === 'string' ? acuse.nombre : '',
    rol: typeof acuse.rol === 'string' ? acuse.rol : '',
    fecha: typeof acuse.fecha === 'string' ? acuse.fecha : ''
  };
}

export function normalizarAcuses(lista: unknown): AcuseRecibo[] {
  if (!Array.isArray(lista)) return [];
  return lista.map(item => normalizarAcuse(item as AcuseGuardado)).filter(a => a.uid || a.nombre);
}

/** Convierte una autoría en acuse, y un acuse antiguo en algo presentable. */
export function acuseComoAutoria(acuse: AcuseGuardado): Autoria {
  return normalizarAcuse(acuse);
}

export function crearAcuse(sesion: { uid: string; nombre: string; rol: string }, fecha?: string): AcuseRecibo {
  return { uid: sesion.uid, nombre: sesion.nombre, rol: sesion.rol, fecha: fecha || new Date().toISOString() };
}

export function yaAcusado(acuses: AcuseRecibo[], uid: string): boolean {
  return !!uid && acuses.some(a => a.uid === uid);
}

/**
 * Agrega un acuse sin duplicar la persona. Si ya acusó, devuelve la lista
 * original intacta: reescribirla podría destruir los acuses antiguos.
 */
export function agregarAcuse(acuses: AcuseGuardado[], acuse: AcuseRecibo): AcuseGuardado[] {
  const originales = Array.isArray(acuses) ? [...acuses] : [];
  if (yaAcusado(normalizarAcuses(originales), acuse.uid)) return originales;
  return [...originales, acuse];
}

/** Etiqueta para mostrar en la lista: iniciales, con el detalle al pasar. */
export function etiquetaAcuse(acuse: AcuseGuardado, grupo: AcuseGuardado[] = []): string {
  const autor = acuseComoAutoria(acuse);
  return etiquetaCorta(autor, grupo.map(acuseComoAutoria));
}

/** Los acuses en una línea, para el PDF y los textos compartidos. */
export function acusesComoTexto(acuses: unknown): string {
  const lista = normalizarAcuses(acuses);
  if (!lista.length) return 'Sin acuses registrados';
  return lista
    .map(a => {
      const nombre = a.nombre || 'Sin nombre';
      const antigua = !a.uid;
      const rol = a.rol && a.rol !== 'acuse antiguo' ? ` (${a.rol})` : '';
      const fecha = antigua ? '' : fechaLegible(a.fecha);
      return [`${nombre}${rol}`, fecha].filter(Boolean).join(' · ');
    })
    .join(' — ');
}
