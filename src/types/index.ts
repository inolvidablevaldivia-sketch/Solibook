export type Cuerda = 'Soprano' | 'Contralto' | 'Tenor' | 'Bajo' | 'Solista' | 'Directiva';
export type EstadoIntegrante = 'Activo' | 'En receso' | 'Inactivo';
export type TipoEvento = 'Ensayo' | 'Presentación' | 'Reunión' | 'Administrativo' | string;
export type TipoConvocatoria = 'Todos' | 'Por Cuerda' | 'Personalizada';
export type EstadoAsistencia = 'Presente' | 'Ausente' | 'Justificado';
export type EstadoJustificacion = 'Pendiente' | 'Aprobado' | 'Rechazado';
export type EstadoCarta = 'Pendiente' | 'Aceptada' | 'Declinada' | 'Archivada';
export type EstadoActa = 'Borrador' | 'Cerrada' | 'En_Solicitud_Edicion';

/**
 * Cargos de la directiva. Un cargo define **quién es** la persona (lo que firma
 * en un acta y lo que aparece en un acuse); el poder extra se concede con
 * atribuciones (ver lib/atributos), que sólo suman y pueden vencer.
 *
 *   Director        → la operación completa y nombrar cargos.
 *   Vocal           → «Director Vocal»: agenda, listas, justificativos, leer y
 *                     acusar correspondencia y actas. No gestiona cuentas, no
 *                     borra y no toca el libro de documentos.
 *   Secretario      → la operación completa, sin administrar cuentas; acepta
 *                     los ingresos nuevos y corrige cartas.
 *   Tesorero        → lectura y acuses, el libro de documentos y firma el acta.
 *                     No mueve la agenda ni las listas: eso es Secretariado.
 *   Administrativo  → ayudante de Secretaría o Tesorería (el cargo que antes se
 *                     llamaba 'Directiva'). Registra, no cierra ni borra.
 *   Miembro         → su calendario y sus justificativos. Sin atribuciones.
 *   Desarrollador   → soporte técnico con acceso absoluto.
 *
 * 'Director fundador' no es un cargo: es la cuenta que reclamó
 * configuracion/estado y opera con los permisos de Desarrollador.
 */
export type RolUsuario =
  | 'Director'
  | 'Vocal'
  | 'Secretario'
  | 'Tesorero'
  | 'Administrativo'
  | 'Miembro'
  | 'Desarrollador';

/** Cupos de firma de la directiva. El de Dirección lo ocupa quien tiene el peso de Director. */
export type CupoFirma = 'Director' | 'Secretario' | 'Tesorero' | 'Vocal';

/**
 * Autoría: quién hizo algo, con el cargo con el que actuó y cuándo. Se guarda
 * en el documento para poder responder «qué Director autorizó este borrado» o
 * «qué administrativo subió este archivo» sin perseguir a nadie.
 */
export interface Autoria {
  uid: string;
  nombre: string;
  rol: string;
  fecha?: string;
}

/** Un acuse de recibo es una autoría: la carta queda «vista por» alguien. */
export type AcuseRecibo = Autoria;

/**
 * Como se guarda realmente: los acuses anteriores a este modelo eran cadenas con
 * las iniciales y conviven con los nuevos, que son objetos. Al leerse se
 * normalizan (ver lib/autorias); nunca se reescriben en silencio.
 */
export type AcuseGuardado = AcuseRecibo | string;

/** Estado del alta de una cuenta que entró con su cuenta de Google. */
export type EstadoIngreso = 'Pendiente' | 'Aceptado' | 'Rechazado' | 'Sin respuesta';

/** Atribución activa concedida a una cuenta. Se retira borrando la entrada. */
export interface Atribucion {
  /** Identificador del atributo (ver lib/atributos). */
  atributo: string;
  /** Quién lo concedió y cuándo, para poder rendir cuentas. */
  otorgadoPor: Autoria;
  motivo?: string;
  /** ISO. Sin fecha de término la atribución no vence. */
  hasta?: string;
}

/** Constancia fechada de un traspaso de cargo ya resuelto. */
export interface ConstanciaTraspaso {
  id: string;
  desdeUid: string;
  desdeNombre: string;
  haciaUid: string;
  haciaNombre: string;
  aceptadaEn: string;
  firmadaPor: Autoria;
  /** Cargo que tenía quien recibió antes de aceptar. */
  rolAnteriorDestino: RolUsuario;
  nota?: string;
}

export interface UsuarioApp {
  uid: string;
  email: string;
  nombre: string;
  fotoUrl?: string;
  // Valores antiguos ('Administrador', 'Secretaria', 'Directiva') se migran a
  // 'Director', 'Secretario' y 'Administrativo' al leerse (lib/permisos).
  rol: RolUsuario;
  integranteId?: string; // vínculo con su ficha en Miembros
  activo: boolean;
  fechaIngreso: string;
  ultimoAcceso?: string;
  /**
   * Alta de la cuenta. Las cuentas creadas antes del flujo de aprobación no lo
   * traen y se leen como 'Aceptado'.
   */
  estadoIngreso?: EstadoIngreso;
  /** Atribuciones vigentes concedidas por Dirección o Desarrollador. */
  atribuciones?: Atribucion[];
  /** Offer de traspaso de Dirección pendiente de respuesta. */
  ofertaDirector?: OfertaCargo;
  /** Copia de la oferta que esta cuenta envió, para mostrar su estado. */
  ofertaDirectorEmitida?: OfertaCargo;
  /** Constancia del último traspaso de cargo aceptado (no se borra). */
  ultimoTraspaso?: ConstanciaTraspaso;
  /** Quién aceptó el ingreso de esta cuenta y cuándo. */
  aceptadoPor?: Autoria;
}

/**
 * Traspaso del cargo de Director con ventana de respuesta: si la persona
 * acepta dentro del plazo, asume el cargo y quien lo ofreció pasa a Miembro;
 * si rechaza o no responde, todo queda como estaba.
 */
export interface OfertaCargo {
  id: string;
  desdeUid: string;
  desdeNombre: string;
  ofrecidoPor: Autoria;
  creadaEn: string;
  expiraEn: string;
  estado: 'Pendiente' | 'Aceptada' | 'Rechazada' | 'Vencida' | 'Cancelada';
  cargoOfrecido: RolUsuario;
  cargoDeQuienOfrece: RolUsuario;
  resueltaEn?: string;
}

export interface DocumentoAdjunto {
  id: string;
  titulo: string;
  enlaceUrl: string; // enlace a Google Drive
  nota?: string;
  fechaCarga: string;
  /** Quién subió el archivo. Los ayudantes quedan identificados uno a uno. */
  subidoPor?: Autoria;
}

export type CategoriaDocumento =
  | 'Constitución'
  | 'Tributario'
  | 'Bancario'
  | 'Contrato'
  | 'Reglamento'
  | 'Otro';

export interface DocumentoInstitucional {
  id: string;
  titulo: string;
  categoria: CategoriaDocumento;
  descripcion?: string;
  enlaceUrl: string;
  fechaCarga: string;
  subidoPor?: Autoria;
}

// Documentos asociados a una actividad. Viven en una colección independiente
// de los eventos para que el rol Miembro no pueda leer enlaces administrativos
// sensibles aunque sí tenga acceso al calendario.
export interface DocumentoEvento {
  id: string;
  eventoId: string;
  titulo: string;
  enlaceUrl: string;
  fechaCarga: string;
  subidoPor?: Autoria;
}

export interface Integrante {
  id: string;
  nombreCompleto: string;
  telefono: string;
  email: string;
  direccion: string;
  iglesia: string;
  cuerda: Cuerda;
  estado: EstadoIntegrante;
  fechaIngreso: string;
  notas?: string;
  fechaNacimiento?: string; // YYYY-MM-DD
  fotoUrl?: string; // base64 comprimido
  documentos?: DocumentoAdjunto[];
  /** Quién creó la ficha y quién la editó por última vez. */
  creadoPor?: Autoria;
  editadoPor?: Autoria;
}

export interface Evento {
  id: string;
  titulo: string;
  tipo: TipoEvento;
  fechaHoraInicio: string; // ISO String
  fechaHoraFin?: string;
  lugarNombre: string;
  direccion?: string;
  notas?: string;
  tipoConvocatoria: TipoConvocatoria;
  cuerdasConvocadas?: Cuerda[];
  integrantesConvocadosIds?: string[];
  asistenciaFinalizada: boolean;
  /** Quién congeló el conteo. Se discute una falta y hay que saber quién. */
  listaCerradaPor?: Autoria;
  grupoRecurrenciaId?: string; // ID único que agrupa los eventos creados periódicamente juntos
  creadoPor?: Autoria;
  editadoPor?: Autoria;
}

export interface AsistenciaRegistro {
  id: string;
  eventoId: string;
  integranteId: string;
  estado: EstadoAsistencia;
  motivoJustificacion?: string;
  adjuntoUrl?: string;
  horaMarcado: string;
  /** El paso de lista se discute cuando alguien falta: hay que saber quién lo marcó. */
  marcadoPor?: Autoria;
}

export interface Justificacion {
  id: string;
  integranteId: string;
  eventoId: string;
  motivo: string;
  adjuntoUrl?: string; // base64 o URL
  estado: EstadoJustificacion;
  canalIngreso: 'Secretaria_Manual' | 'Link_Autoservicio' | 'App_Integrante';
  creadoPorUid?: string;
  /** Quién registró el justificativo cuando lo ingresó la directiva. */
  creadoPorNombre?: string;
  creadoPorRol?: string;
  vistoPor: AcuseGuardado[];
  fechaIngreso: string;
  // Quién aprobó o rechazó y cuándo. Sin esto, la resolución no era atribuible.
  resueltaPorUid?: string;
  resueltaPorNombre?: string;
  resueltaPorRol?: string;
  fechaResolucion?: string;
}

export interface Carta {
  id: string;
  tipoFlujo: 'Recibida' | 'Emitida';
  folio: string;
  remitenteDestinatario: string;
  asunto: string;
  descripcion: string;
  fechaDocumento: string;
  archivoAdjuntoUrl?: string;
  estado: EstadoCarta;
  eventoAsociadoId?: string;
  /** Acuses de recibo de la directiva, con nombre, cargo y hora. */
  vistoPor: AcuseGuardado[];
  registradaPor?: Autoria;
  /** Última corrección del texto: Secretaría corrige y todos se enteran. */
  ultimaEdicion?: Autoria;
  /**
   * Fecha de la edición que exige volver a acusar. Un acuse anterior a este
   * momento se marca como «leído antes de la corrección».
   */
  reacuseDesde?: string;
}

/** Cupo de firma del acta. Los tres primeros son obligatorios para cerrarla. */
export interface FirmaActa {
  uid: string;
  nombre: string;
  rol: string;
  fecha: string;
}

export interface Acta {
  id: string;
  eventoId?: string;
  fechaReunion: string;
  titulo: string;
  temasTratados: string;
  acuerdos: string;
  fotoManuscritaUrl?: string;
  estado: EstadoActa;
  version: number;
  backupAnterior?: {
    temasTratados: string;
    acuerdos: string;
    fechaModificacion: string;
  };
  /**
   * Estado de los cupos de apertura. Dirección, Secretaría y Tesorería son
   * obligatorios; la firma de Vocalía se suma si el Vocal quiere constar.
   */
  firmas?: Partial<Record<CupoFirma, FirmaActa>>;
  // --- Campos espejo del modelo anterior, que leen las reglas de Firestore ---
  aprobadoPresidente: boolean;
  aprobadoSecretaria: boolean;
  aprobadoTesoreria?: boolean;
  aprobadoVocalia?: boolean;
  firmaEdicionDirectorUid?: string;
  firmaEdicionSecretarioUid?: string;
  firmaEdicionTesoreroUid?: string;
  firmaEdicionVocalUid?: string;
  registradaPor?: Autoria;
  /** Quién escribió la versión corregida después de una reapertura. */
  editadaPor?: Autoria;
}

export interface NotificacionItem {
  id: string;
  tipo: 'Justificacion' | 'Carta' | 'Acta' | 'Calendario' | 'Eliminacion' | 'Cuenta' | 'Atribucion';
  titulo: string;
  mensaje: string;
  fecha: string;
  leido: boolean;
  accionId?: string;
}
