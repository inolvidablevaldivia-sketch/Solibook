import { Integrante, Evento, AsistenciaRegistro, Carta, Acta, Justificacion, NotificacionItem } from '../types';

export const INTEGRANTES_INICIALES: Integrante[] = [
  {
    id: 'int-01',
    nombreCompleto: 'Carlos Alvarado M.',
    telefono: '+56 9 8765 4321',
    email: 'carlos.alvarado@email.com',
    direccion: 'Av. Alemania 450, Valdivia',
    iglesia: 'Iglesia Bautista Central',
    cuerda: 'Tenor',
    estado: 'Activo',
    fechaIngreso: '2024-03-01'
  },
  {
    id: 'int-02',
    nombreCompleto: 'Marcela Bravo G.',
    telefono: '+56 9 9123 4567',
    email: 'marcela.bravo@email.com',
    direccion: 'Calle Los Robles 123, Isla Teja',
    iglesia: 'Iglesia Alianza Cristiana',
    cuerda: 'Soprano',
    estado: 'Activo',
    fechaIngreso: '2023-08-15'
  },
  {
    id: 'int-03',
    nombreCompleto: 'Fernando Cortés S.',
    telefono: '+56 9 7654 3210',
    email: 'fernando.cortes@email.com',
    direccion: 'Picarte 1890, Valdivia',
    iglesia: 'Iglesia Metodista Pentecostal',
    cuerda: 'Bajo',
    estado: 'Activo',
    fechaIngreso: '2024-01-10'
  },
  {
    id: 'int-04',
    nombreCompleto: 'Valentina Díaz R.',
    telefono: '+56 9 8234 5678',
    email: 'valentina.diaz@email.com',
    direccion: 'Condell 670, Valdivia',
    iglesia: 'Iglesia Presbiteriana',
    cuerda: 'Contralto',
    estado: 'Activo',
    fechaIngreso: '2023-05-20'
  },
  {
    id: 'int-05',
    nombreCompleto: 'Esteban Rojas P.',
    telefono: '+56 9 6543 2109',
    email: 'esteban.rojas@email.com',
    direccion: 'Av. Francia 820, Valdivia',
    iglesia: 'Iglesia del Señor',
    cuerda: 'Tenor',
    estado: 'Activo',
    fechaIngreso: '2024-04-12'
  },
  {
    id: 'int-06',
    nombreCompleto: 'Sofía Valenzuela K.',
    telefono: '+56 9 5432 1098',
    email: 'sofia.valenzuela@email.com',
    direccion: 'Los Laureles 412, Isla Teja',
    iglesia: 'Iglesia Bautista Central',
    cuerda: 'Soprano',
    estado: 'Activo',
    fechaIngreso: '2023-11-05'
  },
  {
    id: 'int-07',
    nombreCompleto: 'Matías González L.',
    telefono: '+56 9 4321 0987',
    email: 'matias.gonzalez@email.com',
    direccion: 'Chacabuco 340, Valdivia',
    iglesia: 'Centro Cristiano Vida',
    cuerda: 'Bajo',
    estado: 'Activo',
    fechaIngreso: '2024-02-18'
  },
  {
    id: 'int-08',
    nombreCompleto: 'Constanza Henríquez T.',
    telefono: '+56 9 3210 9876',
    email: 'constanza.h@email.com',
    direccion: 'Simpson 1120, Valdivia',
    iglesia: 'Iglesia Alianza Cristiana',
    cuerda: 'Contralto',
    estado: 'Activo',
    fechaIngreso: '2024-05-02'
  },
  {
    id: 'int-09',
    nombreCompleto: 'Rodrigo Morales N.',
    telefono: '+56 9 2109 8765',
    email: 'rodrigo.morales@email.com',
    direccion: 'Camino a Niebla Km 3',
    iglesia: 'Iglesia Bautista El Redentor',
    cuerda: 'Solista',
    estado: 'Activo',
    fechaIngreso: '2022-09-14'
  },
  {
    id: 'int-10',
    nombreCompleto: 'Camila Sepúlveda O.',
    telefono: '+56 9 1098 7654',
    email: 'camila.sepulveda@email.com',
    direccion: 'Errázuriz 950, Valdivia',
    iglesia: 'Iglesia Bautista Central',
    cuerda: 'Soprano',
    estado: 'Inactivo',
    fechaIngreso: '2023-03-10',
    notas: 'En receso por estudios universitarios.'
  }
];

export const EVENTOS_INICIALES: Evento[] = [
  {
    id: 'ev-01',
    titulo: 'Ensayo General y Acople',
    tipo: 'Ensayo',
    fechaHoraInicio: '2026-09-19T19:30:00',
    fechaHoraFin: '2026-09-19T21:30:00',
    lugarNombre: 'Templo Bautista Central',
    direccion: 'Av. Alemania 450, Valdivia',
    notas: 'Llevar carpeta institucional y uniforme completo.',
    tipoConvocatoria: 'Todos',
    asistenciaFinalizada: false
  },
  {
    id: 'ev-02',
    titulo: 'Ensayo Parcial Tenores y Bajos',
    tipo: 'Ensayo',
    fechaHoraInicio: '2026-09-22T20:00:00',
    fechaHoraFin: '2026-09-22T21:30:00',
    lugarNombre: 'Salón de Actos Teja',
    direccion: 'Los Laureles 120, Isla Teja',
    notas: 'Revisión exclusiva de armonías graves.',
    tipoConvocatoria: 'Por Cuerda',
    cuerdasConvocadas: ['Tenor', 'Bajo'],
    asistenciaFinalizada: true
  },
  {
    id: 'ev-03',
    titulo: 'Presentación Aniversario Iglesia Alianza',
    tipo: 'Presentación',
    fechaHoraInicio: '2026-09-27T18:00:00',
    fechaHoraFin: '2026-09-27T20:30:00',
    lugarNombre: 'Templo Alianza Cristiana',
    direccion: 'Calle Los Robles 340, Valdivia',
    notas: 'Llegada puntual a las 17:00 hrs para prueba de sonido.',
    tipoConvocatoria: 'Todos',
    asistenciaFinalizada: false
  },
  {
    id: 'ev-04',
    titulo: 'Reunión Ordinaria de Directiva',
    tipo: 'Reunión',
    fechaHoraInicio: '2026-09-30T19:00:00',
    fechaHoraFin: '2026-09-30T21:00:00',
    lugarNombre: 'Sala de Conferencias',
    tipoConvocatoria: 'Por Cuerda',
    cuerdasConvocadas: ['Directiva'],
    asistenciaFinalizada: false
  }
];

export const ASISTENCIAS_INICIALES: AsistenciaRegistro[] = [
  // Del evento ev-02 (Ensayo Tenores y Bajos)
  {
    id: 'as-01',
    eventoId: 'ev-02',
    integranteId: 'int-01', // Carlos (Tenor)
    estado: 'Presente',
    horaMarcado: '2026-09-22T20:05:00'
  },
  {
    id: 'as-02',
    eventoId: 'ev-02',
    integranteId: 'int-03', // Fernando (Bajo)
    estado: 'Presente',
    horaMarcado: '2026-09-22T20:02:00'
  },
  {
    id: 'as-03',
    eventoId: 'ev-02',
    integranteId: 'int-05', // Esteban (Tenor)
    estado: 'Justificado',
    motivoJustificacion: 'Turno nocturno laboral en hospital',
    horaMarcado: '2026-09-22T19:50:00'
  },
  {
    id: 'as-04',
    eventoId: 'ev-02',
    integranteId: 'int-07', // Matías (Bajo)
    estado: 'Ausente',
    horaMarcado: '2026-09-22T21:30:00'
  }
];

export const CARTAS_INICIALES: Carta[] = [
  {
    id: 'car-01',
    tipoFlujo: 'Recibida',
    folio: 'REC-2026-014',
    remitenteDestinatario: 'Pastoral Juvenil - Iglesia Bautista Central',
    asunto: 'Invitación Especial a Concierto Primavera',
    descripcion: 'Nos honraría contar con la participación especial del Ministerio Vocal Solí Deo en nuestro encuentro anual el próximo 24 de Octubre.',
    fechaDocumento: '2026-09-12',
    estado: 'Pendiente',
    vistoPor: ['JD (Director)', 'MR (Secretaria)']
  },
  {
    id: 'car-02',
    tipoFlujo: 'Emitida',
    folio: 'EMI-2026-008',
    remitenteDestinatario: 'Consejo Pastoral Alianza Cristiana',
    asunto: 'Agradecimiento por Facilitación de Dependencias',
    descripcion: 'Expresamos nuestra sincera gratitud por la acogida y facilitación del templo para las jornadas de ensayo del presente semestre.',
    fechaDocumento: '2026-09-05',
    estado: 'Aceptada',
    vistoPor: ['JD (Director)']
  }
];

export const ACTAS_INICIALES: Acta[] = [
  {
    id: 'act-01',
    fechaReunion: '2026-09-02',
    titulo: 'Acta N° 08 — Planificación Semestre Primavera',
    temasTratados: '1. Cronograma de presentaciones confirmadas.\n2. Adquisición de nuevas carpetas y uniformidad.\n3. Evaluación de ingresos y compromisos de integrantes.',
    acuerdos: '• Se aprueba la participación en el Aniversario de la Iglesia Alianza para el 27 de Septiembre.\n• Tesorería coordinará el pedido de carpetas institucionales antes del 15 de Octubre.\n• Secretaría enviará link de justificaciones para asegurar registro previo a cada cita.',
    estado: 'Cerrada',
    version: 1,
    aprobadoPresidente: true,
    aprobadoSecretaria: true
  }
];

export const JUSTIFICACIONES_INICIALES: Justificacion[] = [
  {
    id: 'just-01',
    integranteId: 'int-05',
    eventoId: 'ev-01',
    motivo: 'Viaje laboral fuera de la ciudad por jornada de capacitación.',
    estado: 'Pendiente',
    canalIngreso: 'Link_Autoservicio',
    vistoPor: ['MR (Secretaria)'],
    fechaIngreso: '2026-09-17T14:20:00'
  }
];

export const NOTIFICACIONES_INICIALES: NotificacionItem[] = [
  {
    id: 'notif-01',
    tipo: 'Justificacion',
    titulo: 'Nueva Justificación recibida',
    mensaje: 'Esteban Rojas envió justificación para Ensayo General (19 Sept).',
    fecha: 'Hace 2 horas',
    leido: false,
    accionId: 'just-01'
  },
  {
    id: 'notif-02',
    tipo: 'Carta',
    titulo: 'Carta por responder',
    mensaje: 'Invitación Especial a Concierto Primavera (Pastoral Juvenil).',
    fecha: 'Ayer',
    leido: false,
    accionId: 'car-01'
  }
];
