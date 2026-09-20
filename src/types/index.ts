export type Cuerda = 'Soprano' | 'Contralto' | 'Tenor' | 'Bajo' | 'Solista' | 'Directiva';
export type EstadoIntegrante = 'Activo' | 'En receso' | 'Inactivo';
export type TipoEvento = 'Ensayo' | 'Presentación' | 'Reunión' | 'Administrativo' | string;
export type TipoConvocatoria = 'Todos' | 'Por Cuerda' | 'Personalizada';
export type EstadoAsistencia = 'Presente' | 'Ausente' | 'Justificado';
export type EstadoJustificacion = 'Pendiente' | 'Aprobado' | 'Rechazado';
export type EstadoCarta = 'Pendiente' | 'Aceptada' | 'Declinada' | 'Archivada';
export type EstadoActa = 'Borrador' | 'Cerrada' | 'En_Solicitud_Edicion';

export type RolUsuario = 'Director' | 'Secretario' | 'Tesorero' | 'Directiva' | 'Miembro' | 'Desarrollador';

export interface UsuarioApp {
  uid: string;
  email: string;
  nombre: string;
  fotoUrl?: string;
  // Valores antiguos ('Administrador', 'Secretaria') se migran automáticamente
  // a 'Director' y 'Secretario' al leerse (ver normalizarRol en lib/permisos).
  rol: RolUsuario;
  integranteId?: string; // vínculo con su ficha en Miembros
  activo: boolean;
  fechaIngreso: string;
  ultimoAcceso?: string;
}

export interface DocumentoAdjunto {
  id: string;
  titulo: string;
  enlaceUrl: string; // enlace a Google Drive
  nota?: string;
  fechaCarga: string;
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
  grupoRecurrenciaId?: string; // ID único que agrupa los eventos creados periódicamente juntos
}

export interface AsistenciaRegistro {
  id: string;
  eventoId: string;
  integranteId: string;
  estado: EstadoAsistencia;
  motivoJustificacion?: string;
  adjuntoUrl?: string;
  horaMarcado: string;
}

export interface Justificacion {
  id: string;
  integranteId: string;
  eventoId: string;
  motivo: string;
  adjuntoUrl?: string; // base64 o URL
  estado: EstadoJustificacion;
  canalIngreso: 'Secretaria_Manual' | 'Link_Autoservicio';
  vistoPor: string[]; // Lista de iniciales o nombres de directiva
  fechaIngreso: string;
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
  vistoPor: string[];
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
  aprobadoPresidente: boolean;
  aprobadoSecretaria: boolean;
}

export interface NotificacionItem {
  id: string;
  tipo: 'Justificacion' | 'Carta' | 'Acta' | 'Calendario';
  titulo: string;
  mensaje: string;
  fecha: string;
  leido: boolean;
  accionId?: string;
}
