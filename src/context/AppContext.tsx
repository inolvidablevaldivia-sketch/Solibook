'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Integrante,
  Evento,
  AsistenciaRegistro,
  Carta,
  Acta,
  Justificacion,
  NotificacionItem,
  EstadoAsistencia,
  DocumentoInstitucional,
  DocumentoAdjunto
} from '@/types';
import {
  INTEGRANTES_INICIALES,
  EVENTOS_INICIALES,
  ASISTENCIAS_INICIALES,
  CARTAS_INICIALES,
  ACTAS_INICIALES,
  JUSTIFICACIONES_INICIALES,
  NOTIFICACIONES_INICIALES
} from '@/lib/initialData';
import {
  COLECCIONES,
  DOC_CONFIG_GENERAL,
  suscribirseColeccion,
  suscribirseDocumento,
  guardarDocumento,
  guardarDocumentos,
  eliminarDocumento as eliminarDocumentoFirestore,
  eliminarDocumentos as eliminarDocumentosFirestore
} from '@/lib/firestoreSync';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

interface AppContextType {
  // Integrantes
  integrantes: Integrante[];
  agregarIntegrante: (nuevo: Omit<Integrante, 'id'>) => void;
  actualizarIntegrante: (id: string, datos: Partial<Integrante>) => void;
  eliminarIntegrante: (id: string) => void;

  // Eventos / Agenda
  eventos: Evento[];
  tiposEventos: string[];
  agregarTipoEvento: (tipo: string) => void;
  agregarEvento: (nuevo: Omit<Evento, 'id'>) => string;
  agregarEventosLote: (nuevos: Omit<Evento, 'id'>[]) => void;
  actualizarEvento: (id: string, datos: Partial<Evento>, editarFuturosDelGrupo?: boolean) => void;
  eliminarEvento: (id: string, borrarFuturosDelGrupo?: boolean) => void;

  // Asistencias
  asistencias: AsistenciaRegistro[];
  marcarAsistencia: (eventoId: string, integranteId: string, estado: EstadoAsistencia, motivo?: string) => void;
  marcarTodosPresentes: (eventoId: string, integrantesIds: string[]) => void;
  marcarTodosEstado: (eventoId: string, integrantesIds: string[], estado: EstadoAsistencia) => void;
  quitarDeLista: (eventoId: string, integranteId: string, convocadosActualesIds: string[]) => void;
  agregarAListaEvento: (eventoId: string, integrantesIds: string[], convocadosActualesIds: string[]) => void;
  cerrarAsistenciaEvento: (eventoId: string) => void;

  // Cartas
  cartas: Carta[];
  agregarCarta: (nueva: Omit<Carta, 'id'>) => void;
  marcarCartaLeida: (cartaId: string, usuarioInitials: string) => void;
  actualizarEstadoCarta: (cartaId: string, estado: Carta['estado']) => void;

  // Actas
  actas: Acta[];
  agregarActa: (nueva: Omit<Acta, 'id'>) => void;
  solicitarEdicionActa: (actaId: string) => void;
  aprobarEdicionActa: (actaId: string, rol: 'Presidente' | 'Secretaria') => void;
  guardarEdicionActa: (actaId: string, temas: string, acuerdos: string) => void;
  deshacerEdicionActa: (actaId: string) => void;

  // Justificaciones
  justificaciones: Justificacion[];
  agregarJustificacion: (nueva: Omit<Justificacion, 'id'>) => void;
  resolverJustificacion: (id: string, estado: 'Aprobado' | 'Rechazado') => void;
  marcarJustificacionLeida: (id: string, usuarioInitials: string) => void;

  // Notificaciones
  notificaciones: NotificacionItem[];
  marcarNotificacionLeida: (id: string) => void;

  // Documentos institucionales y de miembros
  documentos: DocumentoInstitucional[];
  agregarDocumento: (nuevo: Omit<DocumentoInstitucional, 'id'>) => void;
  eliminarDocumento: (id: string) => void;
  agregarDocumentoMiembro: (integranteId: string, doc: Omit<DocumentoAdjunto, 'id'>) => void;
  eliminarDocumentoMiembro: (integranteId: string, docId: string) => void;

  // Utilidades PWA
  forzarActualizacionApp: () => void;
  usuarioActivo: { nombre: string; rol: string; iniciales: string };
  setUsuarioActivo: (u: { nombre: string; rol: string; iniciales: string }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TIPOS_EVENTOS_BASE = [
  'Ensayo',
  'Presentación',
  'Reunión',
  'Administrativo',
  'Otro'
];

const tiposUnicos = (tipos: string[]) => Array.from(new Set(tipos.filter(Boolean)));

const ordenarIntegrantes = (lista: Integrante[]) =>
  [...lista].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

// ---- Cálculos puros (sin efectos) compartidos por el estado local y Firestore ----

const calcularActualizacionEvento = (
  prev: Evento[],
  id: string,
  datos: Partial<Evento>,
  editarFuturosDelGrupo: boolean
): { siguiente: Evento[]; cambiados: Evento[] } => {
  const objetivo = prev.find(e => e.id === id);
  if (!objetivo) return { siguiente: prev, cambiados: [] };

  if (editarFuturosDelGrupo && objetivo.grupoRecurrenciaId) {
    const fechaObjetivo = new Date(objetivo.fechaHoraInicio).getTime();
    const cambiados: Evento[] = [];
    const siguiente = prev.map(item => {
      if (
        item.grupoRecurrenciaId === objetivo.grupoRecurrenciaId &&
        new Date(item.fechaHoraInicio).getTime() >= fechaObjetivo
      ) {
        // Actualizar campos preservando la fecha particular de cada uno
        let nuevaFechaHora = item.fechaHoraInicio;
        if (datos.fechaHoraInicio) {
          const horaNueva = datos.fechaHoraInicio.split('T')[1];
          const fechaBase = item.fechaHoraInicio.split('T')[0];
          nuevaFechaHora = `${fechaBase}T${horaNueva}`;
        }
        const actualizado = { ...item, ...datos, fechaHoraInicio: nuevaFechaHora };
        cambiados.push(actualizado);
        return actualizado;
      }
      return item;
    });
    return { siguiente, cambiados };
  }

  const cambiado = { ...objetivo, ...datos };
  return { siguiente: prev.map(item => (item.id === id ? cambiado : item)), cambiados: [cambiado] };
};

const calcularEliminacionEvento = (
  prev: Evento[],
  id: string,
  borrarFuturosDelGrupo: boolean
): { siguiente: Evento[]; eliminados: string[] } => {
  const objetivo = prev.find(e => e.id === id);
  if (!objetivo) return { siguiente: prev, eliminados: [] };

  if (borrarFuturosDelGrupo && objetivo.grupoRecurrenciaId) {
    const fechaObjetivo = new Date(objetivo.fechaHoraInicio).getTime();
    const eliminados = prev
      .filter(
        e =>
          e.grupoRecurrenciaId === objetivo.grupoRecurrenciaId &&
          new Date(e.fechaHoraInicio).getTime() >= fechaObjetivo
      )
      .map(e => e.id);
    // Solo borrar si es del mismo grupo y su fecha es mayor o igual a la actual
    return { siguiente: prev.filter(e => !eliminados.includes(e.id)), eliminados };
  }

  return { siguiente: prev.filter(e => e.id !== id), eliminados: [id] };
};

const calcularMarcadoAsistencia = (
  prev: AsistenciaRegistro[],
  eventoId: string,
  integranteId: string,
  estado: EstadoAsistencia,
  motivo?: string
): { siguiente: AsistenciaRegistro[]; documento: AsistenciaRegistro } => {
  const existente = prev.find(a => a.eventoId === eventoId && a.integranteId === integranteId);
  if (existente) {
    const documento: AsistenciaRegistro = {
      ...existente,
      estado,
      motivoJustificacion: motivo ?? existente.motivoJustificacion,
      horaMarcado: new Date().toISOString()
    };
    return {
      siguiente: prev.map(a => (a.id === existente.id ? documento : a)),
      documento
    };
  }
  const documento: AsistenciaRegistro = {
    id: `as-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventoId,
    integranteId,
    estado,
    motivoJustificacion: motivo,
    horaMarcado: new Date().toISOString()
  };
  return { siguiente: [...prev, documento], documento };
};

// Marcado masivo del paso de lista. Las justificaciones aprobadas quedan
// protegidas: "Todos Presentes" y "Todos Ausentes" no las sobrescriben.
// Solo un cambio manual, persona por persona, puede alterar un Justificado.
const calcularMarcadoMasivo = (
  prev: AsistenciaRegistro[],
  eventoId: string,
  integrantesIds: string[],
  estado: EstadoAsistencia
): { siguiente: AsistenciaRegistro[]; guardar: AsistenciaRegistro[]; eliminar: string[] } => {
  const justificadosProtegidos = prev.filter(
    a => a.eventoId === eventoId && a.estado === 'Justificado'
  );
  const idsProtegidos = justificadosProtegidos.map(a => a.integranteId);
  const reemplazados = prev.filter(a => a.eventoId === eventoId && a.estado !== 'Justificado');
  const restantes = prev.filter(a => a.eventoId !== eventoId);
  const nuevos: AsistenciaRegistro[] = integrantesIds
    .filter(id => !idsProtegidos.includes(id))
    .map(id => ({
      id: `as-${Date.now()}-${id}`,
      eventoId,
      integranteId: id,
      estado,
      horaMarcado: new Date().toISOString()
    }));
  return {
    siguiente: [...restantes, ...justificadosProtegidos, ...nuevos],
    guardar: nuevos,
    eliminar: reemplazados.map(a => a.id)
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
  const [tiposEventos, setTiposEventos] = useState<string[]>(TIPOS_EVENTOS_BASE);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaRegistro[]>([]);
  const [cartas, setCartas] = useState<Carta[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [justificaciones, setJustificaciones] = useState<Justificacion[]>([]);
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoInstitucional[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Identidad de sincronización: al iniciar o cerrar sesión se rearman las
  // suscripciones a Firestore (las reglas pueden exigir usuario autenticado).
  const { usuario, modoLocal } = useAuth();
  const claveSync = modoLocal ? 'modo-local' : (usuario?.uid ?? 'sin-sesion');

  const [usuarioActivo, setUsuarioActivo] = useState({
    nombre: 'Pastoral & Secretaría General',
    rol: 'Administración',
    iniciales: 'SG'
  });

  // Espejos síncronos del estado para leer el valor más reciente dentro de
  // las mutaciones (y calcular qué documentos escribir en Firestore).
  const integrantesRef = useRef<Integrante[]>([]);
  const tiposEventosRef = useRef<string[]>(TIPOS_EVENTOS_BASE);
  const eventosRef = useRef<Evento[]>([]);
  const asistenciasRef = useRef<AsistenciaRegistro[]>([]);
  const cartasRef = useRef<Carta[]>([]);
  const actasRef = useRef<Acta[]>([]);
  const justificacionesRef = useRef<Justificacion[]>([]);
  const notificacionesRef = useRef<NotificacionItem[]>([]);
  const documentosRef = useRef<DocumentoInstitucional[]>([]);

  useEffect(() => {
    integrantesRef.current = integrantes;
    tiposEventosRef.current = tiposEventos;
    eventosRef.current = eventos;
    asistenciasRef.current = asistencias;
    cartasRef.current = cartas;
    actasRef.current = actas;
    justificacionesRef.current = justificaciones;
    notificacionesRef.current = notificaciones;
    documentosRef.current = documentos;
  });

  // Carga inicial persistente de LocalStorage (respaldo y modo sin conexión)
  useEffect(() => {
    try {
      const storedInt = localStorage.getItem('solibook_integrantes');
      const storedEv = localStorage.getItem('solibook_eventos');
      const storedTipos = localStorage.getItem('solibook_tipos_eventos');
      const storedAs = localStorage.getItem('solibook_asistencias');
      const storedCar = localStorage.getItem('solibook_cartas');
      const storedAct = localStorage.getItem('solibook_actas');
      const storedJust = localStorage.getItem('solibook_justificaciones');
      const storedNot = localStorage.getItem('solibook_notificaciones');
      const storedDocs = localStorage.getItem('solibook_documentos');

      const dataIntegrantes: Integrante[] = storedInt ? JSON.parse(storedInt) : INTEGRANTES_INICIALES;
      const dataEventos: Evento[] = storedEv ? JSON.parse(storedEv) : EVENTOS_INICIALES;
      const dataTipos: string[] = storedTipos ? JSON.parse(storedTipos) : TIPOS_EVENTOS_BASE;
      // Siempre ordenar alfabéticamente por defecto
      dataIntegrantes.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

      setIntegrantes(dataIntegrantes);
      setEventos(dataEventos);
      setTiposEventos(tiposUnicos([...TIPOS_EVENTOS_BASE, ...dataTipos, ...dataEventos.map(e => e.tipo)]));
      setAsistencias(storedAs ? JSON.parse(storedAs) : ASISTENCIAS_INICIALES);
      setCartas(storedCar ? JSON.parse(storedCar) : CARTAS_INICIALES);
      setActas(storedAct ? JSON.parse(storedAct) : ACTAS_INICIALES);
      setJustificaciones(storedJust ? JSON.parse(storedJust) : JUSTIFICACIONES_INICIALES);
      setNotificaciones(storedNot ? JSON.parse(storedNot) : NOTIFICACIONES_INICIALES);
      setDocumentos(storedDocs ? JSON.parse(storedDocs) : []);
    } catch {
      const base = [...INTEGRANTES_INICIALES].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
      setIntegrantes(base);
      setEventos(EVENTOS_INICIALES);
      setTiposEventos(tiposUnicos([...TIPOS_EVENTOS_BASE, ...EVENTOS_INICIALES.map(e => e.tipo)]));
      setAsistencias(ASISTENCIAS_INICIALES);
      setCartas(CARTAS_INICIALES);
      setActas(ACTAS_INICIALES);
      setJustificaciones(JUSTIFICACIONES_INICIALES);
      setNotificaciones(NOTIFICACIONES_INICIALES);
      setDocumentos([]);
    }
    setIsLoaded(true);
  }, []);

  // Suscripciones en tiempo real a Firestore. Cada cambio remoto reemplaza el
  // estado local; si la nube está vacía se migran los datos locales (siembra
  // única, protegida por transacción en "configuracion/semillas").
  useEffect(() => {
    if (!isLoaded) return;

    // Con sesión real, un "permiso denegado" significa que el rol no tiene
    // acceso a esa colección: se muestra vacía en lugar del contenido local
    // de demostración. En modo local (sin Firebase) se conserva todo.
    const sesionReal = !modoLocal && !!usuario?.uid;
    const alSerRestringida = (vaciar: () => void) => {
      return (error: { code?: string }) => {
        if (error?.code === 'permission-denied' && sesionReal) vaciar();
      };
    };

    let suscripcionFichaPropia: (() => void) | undefined;

    const desuscribir = [
      suscribirseColeccion<Integrante>(
        COLECCIONES.integrantes,
        items => setIntegrantes(ordenarIntegrantes(items)),
        () =>
          integrantesRef.current.length > 0 ? integrantesRef.current : INTEGRANTES_INICIALES,
        undefined,
        error => {
          if (error?.code !== 'permission-denied' || !sesionReal) return;
          // Rol sin acceso al directorio (p. ej. Miembro): solo se escucha la
          // ficha vinculada a la cuenta, para saber su cuerda y si está citado.
          if (usuario?.integranteId) {
            suscripcionFichaPropia?.();
            suscripcionFichaPropia = suscribirseDocumento<Integrante>(
              COLECCIONES.integrantes,
              usuario.integranteId,
              ficha => setIntegrantes(ficha ? [ficha] : [])
            );
          } else {
            setIntegrantes([]);
          }
        }
      ),
      suscribirseColeccion<Evento>(
        COLECCIONES.eventos,
        items => setEventos(items),
        () => (eventosRef.current.length > 0 ? eventosRef.current : EVENTOS_INICIALES),
        undefined,
        alSerRestringida(() => setEventos([]))
      ),
      suscribirseColeccion<AsistenciaRegistro>(
        COLECCIONES.asistencias,
        items => setAsistencias(items),
        () => (asistenciasRef.current.length > 0 ? asistenciasRef.current : ASISTENCIAS_INICIALES),
        undefined,
        alSerRestringida(() => setAsistencias([]))
      ),
      suscribirseColeccion<Carta>(
        COLECCIONES.cartas,
        items => setCartas(items),
        () => (cartasRef.current.length > 0 ? cartasRef.current : CARTAS_INICIALES),
        undefined,
        alSerRestringida(() => setCartas([]))
      ),
      suscribirseColeccion<Acta>(
        COLECCIONES.actas,
        items => setActas(items),
        () => (actasRef.current.length > 0 ? actasRef.current : ACTAS_INICIALES),
        undefined,
        alSerRestringida(() => setActas([]))
      ),
      suscribirseColeccion<Justificacion>(
        COLECCIONES.justificaciones,
        items => setJustificaciones(items),
        () =>
          justificacionesRef.current.length > 0
            ? justificacionesRef.current
            : JUSTIFICACIONES_INICIALES,
        undefined,
        alSerRestringida(() => setJustificaciones([]))
      ),
      suscribirseColeccion<NotificacionItem>(
        COLECCIONES.notificaciones,
        items => setNotificaciones(items),
        () =>
          notificacionesRef.current.length > 0
            ? notificacionesRef.current
            : NOTIFICACIONES_INICIALES,
        undefined,
        alSerRestringida(() => setNotificaciones([]))
      ),
      suscribirseColeccion<DocumentoInstitucional>(
        COLECCIONES.documentos,
        items => setDocumentos(items),
        () => documentosRef.current,
        undefined,
        alSerRestringida(() => setDocumentos([]))
      ),
      suscribirseDocumento<{ tiposEventos?: string[] }>(
        DOC_CONFIG_GENERAL.coleccion,
        DOC_CONFIG_GENERAL.id,
        datos => {
          if (datos?.tiposEventos) {
            setTiposEventos(tiposUnicos([...TIPOS_EVENTOS_BASE, ...datos.tiposEventos]));
          } else if (datos === null) {
            // Documento aún inexistente: publicar la configuración local
            void setDoc(
              doc(db, DOC_CONFIG_GENERAL.coleccion, DOC_CONFIG_GENERAL.id),
              { tiposEventos: tiposEventosRef.current },
              { merge: true }
            ).catch(() => {
              /* sin permiso o sin conexión: se mantiene la configuración local */
            });
          }
        }
      )
    ];

    return () => {
      suscripcionFichaPropia?.();
      desuscribir.forEach(cancelar => cancelar());
    };
    // Nota: el rol y el estado de la cuenta forman parte de las dependencias
    // porque al cambiar (p. ej. la fundadora recibe Director, o un Miembro es
    // promovido) las suscripciones deben reintentarse con los nuevos permisos.
  }, [isLoaded, claveSync, modoLocal, usuario?.uid, usuario?.integranteId, usuario?.rol, usuario?.activo]);

  // Persistir en cada cambio (respaldo local y carga instantánea al abrir)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem('solibook_integrantes', JSON.stringify(integrantes));
      localStorage.setItem('solibook_eventos', JSON.stringify(eventos));
      localStorage.setItem('solibook_tipos_eventos', JSON.stringify(tiposEventos));
      localStorage.setItem('solibook_asistencias', JSON.stringify(asistencias));
      localStorage.setItem('solibook_cartas', JSON.stringify(cartas));
      localStorage.setItem('solibook_actas', JSON.stringify(actas));
      localStorage.setItem('solibook_justificaciones', JSON.stringify(justificaciones));
      localStorage.setItem('solibook_notificaciones', JSON.stringify(notificaciones));
      localStorage.setItem('solibook_documentos', JSON.stringify(documentos));
    } catch (e) {
      console.error('Error persistiendo datos:', e);
    }
  }, [integrantes, eventos, tiposEventos, asistencias, cartas, actas, justificaciones, notificaciones, documentos, isLoaded]);

  // Aviso automático de cumpleaños: recorre los miembros activos con fecha de
  // nacimiento y avisa cuando el próximo cumpleaños está a 7 días o menos.
  // Usa un identificador estable para no duplicar la notificación.
  useEffect(() => {
    if (!isLoaded) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const porAvisar: NotificacionItem[] = [];

    integrantes
      .filter(i => i.estado === 'Activo' && i.fechaNacimiento)
      .forEach(i => {
        const partes = (i.fechaNacimiento as string).split('-').map(Number);
        if (partes.length !== 3 || partes.some(n => Number.isNaN(n))) return;
        const [anioNac, mesNac, diaNac] = partes;

        // Próximo cumpleaños considerando que el 29 de febrero cae el 28 en años no bisiestos
        let proximo = new Date(hoy.getFullYear(), mesNac - 1, diaNac);
        if (proximo.getTime() < hoy.getTime()) {
          proximo = new Date(hoy.getFullYear() + 1, mesNac - 1, diaNac);
        }
        const diasRestantes = Math.round((proximo.getTime() - hoy.getTime()) / 86400000);
        if (diasRestantes > 7) return;

        const idEstable = `cumple-${i.id}-${proximo.getFullYear()}`;
        const fechaTexto = proximo.toLocaleDateString('es-CL', { day: '2-digit', month: 'long' });

        porAvisar.push({
          id: idEstable,
          tipo: 'Calendario',
          titulo:
            diasRestantes === 0
              ? `Hoy cumple años ${i.nombreCompleto}`
              : `Cumpleaños de ${i.nombreCompleto}`,
          mensaje:
            diasRestantes === 0
              ? `Cumple ${proximo.getFullYear() - anioNac} años hoy.`
              : `Cumple años el ${fechaTexto} (en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}).`,
          fecha: diasRestantes === 0 ? 'Hoy' : `En ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`,
          leido: false,
          accionId: i.id
        });
      });

    const nuevas = porAvisar.filter(n => !notificaciones.some(existente => existente.id === n.id));
    if (nuevas.length > 0) {
      setNotificaciones(prev => [...prev, ...nuevas]);
      // Los IDs son estables, así que todos los dispositivos comparten el mismo aviso
      nuevas.forEach(n => void guardarDocumento(COLECCIONES.notificaciones, n.id, n));
    }
  }, [integrantes, notificaciones, isLoaded]);

  // Funciones de Integrantes
  const agregarIntegrante = (nuevo: Omit<Integrante, 'id'>) => {
    const id = `int-${Date.now()}`;
    const documento: Integrante = { ...nuevo, id };
    setIntegrantes(prev =>
      ordenarIntegrantes([...prev, documento])
    );
    void guardarDocumento(COLECCIONES.integrantes, id, documento);
  };

  const actualizarIntegrante = (id: string, datos: Partial<Integrante>) => {
    const actual = integrantesRef.current.find(item => item.id === id);
    setIntegrantes(prev => prev.map(item => item.id === id ? { ...item, ...datos } : item));
    if (actual) void guardarDocumento(COLECCIONES.integrantes, id, { ...actual, ...datos });
  };

  const eliminarIntegrante = (id: string) => {
    setIntegrantes(prev => prev.filter(item => item.id !== id));
    void eliminarDocumentoFirestore(COLECCIONES.integrantes, id);
  };

  // Funciones de Eventos
  const agregarEvento = (nuevo: Omit<Evento, 'id'>): string => {
    const id = `ev-${Date.now()}`;
    const documento: Evento = { ...nuevo, id };
    setEventos(prev => [documento, ...prev]);
    void guardarDocumento(COLECCIONES.eventos, id, documento);
    return id;
  };

  const agregarEventosLote = (nuevos: Omit<Evento, 'id'>[]) => {
    const listos: Evento[] = nuevos.map((n, idx) => ({
      ...n,
      id: `ev-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`
    }));
    setEventos(prev => [...listos, ...prev]);
    void guardarDocumentos(COLECCIONES.eventos, listos);
  };

  const agregarTipoEvento = (tipo: string) => {
    const limpio = tipo.trim();
    if (!limpio) return;
    const actuales = tiposEventosRef.current;
    if (actuales.includes(limpio)) return;
    const siguientes = [...actuales, limpio];
    setTiposEventos(siguientes);
    void setDoc(
      doc(db, DOC_CONFIG_GENERAL.coleccion, DOC_CONFIG_GENERAL.id),
      { tiposEventos: siguientes },
      { merge: true }
    ).catch(() => {
      /* sin permiso o sin conexión: queda solo en este dispositivo */
    });
  };

  const actualizarEvento = (id: string, datos: Partial<Evento>, editarFuturosDelGrupo: boolean = false) => {
    const { siguiente, cambiados } = calcularActualizacionEvento(
      eventosRef.current,
      id,
      datos,
      editarFuturosDelGrupo
    );
    setEventos(siguiente);
    void guardarDocumentos(COLECCIONES.eventos, cambiados);
  };

  const eliminarEvento = (id: string, borrarFuturosDelGrupo: boolean = false) => {
    const { siguiente, eliminados } = calcularEliminacionEvento(eventosRef.current, id, borrarFuturosDelGrupo);
    setEventos(siguiente);
    void eliminarDocumentosFirestore(COLECCIONES.eventos, eliminados);
  };

  // Funciones de Asistencias
  const marcarAsistencia = (eventoId: string, integranteId: string, estado: EstadoAsistencia, motivo?: string) => {
    const { siguiente, documento } = calcularMarcadoAsistencia(
      asistenciasRef.current,
      eventoId,
      integranteId,
      estado,
      motivo
    );
    setAsistencias(siguiente);
    void guardarDocumento(COLECCIONES.asistencias, documento.id, documento);
  };

  const aplicarMarcadoMasivo = (
    eventoId: string,
    integrantesIds: string[],
    estado: EstadoAsistencia
  ) => {
    const { siguiente, guardar, eliminar } = calcularMarcadoMasivo(
      asistenciasRef.current,
      eventoId,
      integrantesIds,
      estado
    );
    setAsistencias(siguiente);
    void guardarDocumentos(COLECCIONES.asistencias, guardar);
    void eliminarDocumentosFirestore(COLECCIONES.asistencias, eliminar);
  };

  const marcarTodosPresentes = (eventoId: string, integrantesIds: string[]) => {
    aplicarMarcadoMasivo(eventoId, integrantesIds, 'Presente');
  };

  const marcarTodosEstado = (
    eventoId: string,
    integrantesIds: string[],
    estado: EstadoAsistencia
  ) => {
    aplicarMarcadoMasivo(eventoId, integrantesIds, estado);
  };

  // Quita a un integrante de la convocatoria de un evento puntual.
  // No elimina al miembro del directorio y deja de contar para estadísticas.
  const quitarDeLista = (eventoId: string, integranteId: string, convocadosActualesIds: string[]) => {
    const nuevaLista = convocadosActualesIds.filter(id => id !== integranteId);
    const eventoActual = eventosRef.current.find(ev => ev.id === eventoId);

    const eventoActualizado: Evento | undefined = eventoActual
      ? {
          ...eventoActual,
          tipoConvocatoria: 'Personalizada',
          cuerdasConvocadas: undefined,
          integrantesConvocadosIds: nuevaLista
        }
      : undefined;

    setEventos(prev => prev.map(ev => (ev.id === eventoId && eventoActualizado ? eventoActualizado : ev)));
    // Se borra cualquier marca previa para que no afecte estadísticas
    const asistenciasQuitadas = asistenciasRef.current.filter(
      a => a.eventoId === eventoId && a.integranteId === integranteId
    );
    setAsistencias(prev => prev.filter(a => !(a.eventoId === eventoId && a.integranteId === integranteId)));

    if (eventoActualizado) void guardarDocumento(COLECCIONES.eventos, eventoId, eventoActualizado);
    void eliminarDocumentosFirestore(COLECCIONES.asistencias, asistenciasQuitadas.map(a => a.id));
  };

  // Suma integrantes a la convocatoria de un evento puntual (pasan a contar como citados)
  const agregarAListaEvento = (eventoId: string, integrantesIds: string[], convocadosActualesIds: string[]) => {
    const nuevaLista = Array.from(new Set([...convocadosActualesIds, ...integrantesIds]));
    const eventoActual = eventosRef.current.find(ev => ev.id === eventoId);

    const eventoActualizado: Evento | undefined = eventoActual
      ? {
          ...eventoActual,
          tipoConvocatoria: 'Personalizada',
          cuerdasConvocadas: undefined,
          integrantesConvocadosIds: nuevaLista
        }
      : undefined;

    setEventos(prev => prev.map(ev => (ev.id === eventoId && eventoActualizado ? eventoActualizado : ev)));

    if (eventoActualizado) void guardarDocumento(COLECCIONES.eventos, eventoId, eventoActualizado);
  };

  const cerrarAsistenciaEvento = (eventoId: string) => {
    const eventoActual = eventosRef.current.find(ev => ev.id === eventoId);
    setEventos(prev => prev.map(ev => ev.id === eventoId ? { ...ev, asistenciaFinalizada: true } : ev));
    if (eventoActual) {
      void guardarDocumento(COLECCIONES.eventos, eventoId, { ...eventoActual, asistenciaFinalizada: true });
    }
  };

  // Funciones de Cartas
  const agregarCarta = (nueva: Omit<Carta, 'id'>) => {
    const id = `car-${Date.now()}`;
    const notificacion: NotificacionItem = {
      id: `notif-${Date.now()}`,
      tipo: 'Carta',
      titulo: 'Nueva Correspondencia Registrada',
      mensaje: `${nueva.tipoFlujo === 'Recibida' ? 'De: ' : 'Para: '} ${nueva.remitenteDestinatario} (${nueva.folio})`,
      fecha: 'Hace un momento',
      leido: false,
      accionId: id
    };
    setCartas(prev => [{ ...nueva, id }, ...prev]);
    setNotificaciones(prev => [notificacion, ...prev]);
    void guardarDocumento(COLECCIONES.cartas, id, { ...nueva, id });
    void guardarDocumento(COLECCIONES.notificaciones, notificacion.id, notificacion);
  };

  const marcarCartaLeida = (cartaId: string, usuarioInitials: string) => {
    const cartaActual = cartasRef.current.find(c => c.id === cartaId);
    setCartas(prev => prev.map(c => {
      if (c.id === cartaId && !c.vistoPor.includes(usuarioInitials)) {
        return { ...c, vistoPor: [...c.vistoPor, usuarioInitials] };
      }
      return c;
    }));
    if (cartaActual && !cartaActual.vistoPor.includes(usuarioInitials)) {
      void guardarDocumento(COLECCIONES.cartas, cartaId, {
        ...cartaActual,
        vistoPor: [...cartaActual.vistoPor, usuarioInitials]
      });
    }
  };

  const actualizarEstadoCarta = (cartaId: string, estado: Carta['estado']) => {
    const cartaActual = cartasRef.current.find(c => c.id === cartaId);
    setCartas(prev => prev.map(c => c.id === cartaId ? { ...c, estado } : c));
    if (cartaActual) void guardarDocumento(COLECCIONES.cartas, cartaId, { ...cartaActual, estado });
  };

  // Funciones de Actas
  const agregarActa = (nueva: Omit<Acta, 'id'>) => {
    const id = `act-${Date.now()}`;
    setActas(prev => [{ ...nueva, id }, ...prev]);
    void guardarDocumento(COLECCIONES.actas, id, { ...nueva, id });
  };

  const solicitarEdicionActa = (actaId: string) => {
    const actaActual = actasRef.current.find(a => a.id === actaId);
    const notificacion: NotificacionItem = {
      id: `notif-${Date.now()}`,
      tipo: 'Acta',
      titulo: 'Solicitud de Edición de Acta',
      mensaje: 'Se ha solicitado autorización conjunta para modificar un acta cerrada.',
      fecha: 'Ahora',
      leido: false,
      accionId: actaId
    };
    setActas(prev => prev.map(a => a.id === actaId ? {
      ...a,
      estado: 'En_Solicitud_Edicion',
      aprobadoPresidente: false,
      aprobadoSecretaria: false
    } : a));
    setNotificaciones(prev => [notificacion, ...prev]);
    if (actaActual) {
      void guardarDocumento(COLECCIONES.actas, actaId, {
        ...actaActual,
        estado: 'En_Solicitud_Edicion',
        aprobadoPresidente: false,
        aprobadoSecretaria: false
      });
    }
    void guardarDocumento(COLECCIONES.notificaciones, notificacion.id, notificacion);
  };

  const aprobarEdicionActa = (actaId: string, rol: 'Presidente' | 'Secretaria') => {
    const actaActual = actasRef.current.find(a => a.id === actaId);
    setActas(prev => prev.map(a => {
      if (a.id === actaId) {
        const pres = rol === 'Presidente' ? true : a.aprobadoPresidente;
        const sec = rol === 'Secretaria' ? true : a.aprobadoSecretaria;
        const yaAmbos = pres && sec;
        return {
          ...a,
          aprobadoPresidente: pres,
          aprobadoSecretaria: sec,
          estado: yaAmbos ? 'Borrador' : 'En_Solicitud_Edicion'
        };
      }
      return a;
    }));
    if (actaActual) {
      const pres = rol === 'Presidente' ? true : actaActual.aprobadoPresidente;
      const sec = rol === 'Secretaria' ? true : actaActual.aprobadoSecretaria;
      void guardarDocumento(COLECCIONES.actas, actaId, {
        ...actaActual,
        aprobadoPresidente: pres,
        aprobadoSecretaria: sec,
        estado: pres && sec ? 'Borrador' : 'En_Solicitud_Edicion'
      });
    }
  };

  const guardarEdicionActa = (actaId: string, temas: string, acuerdos: string) => {
    const actaActual = actasRef.current.find(a => a.id === actaId);
    setActas(prev => prev.map(a => {
      if (a.id === actaId) {
        return {
          ...a,
          backupAnterior: {
            temasTratados: a.temasTratados,
            acuerdos: a.acuerdos,
            fechaModificacion: new Date().toISOString()
          },
          temasTratados: temas,
          acuerdos: acuerdos,
          version: a.version + 1,
          estado: 'Cerrada',
          aprobadoPresidente: true,
          aprobadoSecretaria: true
        };
      }
      return a;
    }));
    if (actaActual) {
      void guardarDocumento(COLECCIONES.actas, actaId, {
        ...actaActual,
        backupAnterior: {
          temasTratados: actaActual.temasTratados,
          acuerdos: actaActual.acuerdos,
          fechaModificacion: new Date().toISOString()
        },
        temasTratados: temas,
        acuerdos: acuerdos,
        version: actaActual.version + 1,
        estado: 'Cerrada',
        aprobadoPresidente: true,
        aprobadoSecretaria: true
      });
    }
  };

  const deshacerEdicionActa = (actaId: string) => {
    const actaActual = actasRef.current.find(a => a.id === actaId);
    setActas(prev => prev.map(a => {
      if (a.id === actaId && a.backupAnterior) {
        return {
          ...a,
          temasTratados: a.backupAnterior.temasTratados,
          acuerdos: a.backupAnterior.acuerdos,
          backupAnterior: undefined,
          version: a.version + 1
        };
      }
      return a;
    }));
    if (actaActual?.backupAnterior) {
      void guardarDocumento(COLECCIONES.actas, actaId, {
        ...actaActual,
        temasTratados: actaActual.backupAnterior.temasTratados,
        acuerdos: actaActual.backupAnterior.acuerdos,
        backupAnterior: undefined,
        version: actaActual.version + 1
      });
    }
  };

  // Funciones de Justificaciones
  const agregarJustificacion = (nueva: Omit<Justificacion, 'id'>) => {
    const id = `just-${Date.now()}`;
    const notificacion: NotificacionItem = {
      id: `notif-${Date.now()}`,
      tipo: 'Justificacion',
      titulo: 'Nueva Justificación Enviada',
      mensaje: `Motivo: ${nueva.motivo.slice(0, 50)}...`,
      fecha: 'Ahora',
      leido: false,
      accionId: id
    };
    setJustificaciones(prev => [{ ...nueva, id }, ...prev]);
    setNotificaciones(prev => [notificacion, ...prev]);
    void guardarDocumento(COLECCIONES.justificaciones, id, { ...nueva, id });
    void guardarDocumento(COLECCIONES.notificaciones, notificacion.id, notificacion);
  };

  const resolverJustificacion = (id: string, estado: 'Aprobado' | 'Rechazado') => {
    const justificacionActual = justificacionesRef.current.find(j => j.id === id);
    setJustificaciones(prev => prev.map(j => (j.id === id ? { ...j, estado } : j)));
    if (!justificacionActual) return;

    void guardarDocumento(COLECCIONES.justificaciones, id, { ...justificacionActual, estado });
    // También actualizar la asistencia asociada si existe
    if (estado === 'Aprobado') {
      marcarAsistencia(justificacionActual.eventoId, justificacionActual.integranteId, 'Justificado', justificacionActual.motivo);
    } else {
      marcarAsistencia(justificacionActual.eventoId, justificacionActual.integranteId, 'Ausente', 'Justificación rechazada');
    }
  };

  const marcarJustificacionLeida = (id: string, usuarioInitials: string) => {
    const justificacionActual = justificacionesRef.current.find(j => j.id === id);
    setJustificaciones(prev => prev.map(j => {
      if (j.id === id && !j.vistoPor.includes(usuarioInitials)) {
        return { ...j, vistoPor: [...j.vistoPor, usuarioInitials] };
      }
      return j;
    }));
    if (justificacionActual && !justificacionActual.vistoPor.includes(usuarioInitials)) {
      void guardarDocumento(COLECCIONES.justificaciones, id, {
        ...justificacionActual,
        vistoPor: [...justificacionActual.vistoPor, usuarioInitials]
      });
    }
  };

  // Notificaciones
  const marcarNotificacionLeida = (id: string) => {
    const notificacionActual = notificacionesRef.current.find(n => n.id === id);
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
    if (notificacionActual) {
      void guardarDocumento(COLECCIONES.notificaciones, id, { ...notificacionActual, leido: true });
    }
  };

  // Documentos institucionales (Libro de Documentos)
  const agregarDocumento = (nuevo: Omit<DocumentoInstitucional, 'id'>) => {
    const id = `doc-${Date.now()}`;
    setDocumentos(prev => [{ ...nuevo, id }, ...prev]);
    void guardarDocumento(COLECCIONES.documentos, id, { ...nuevo, id });
  };

  const eliminarDocumento = (id: string) => {
    setDocumentos(prev => prev.filter(d => d.id !== id));
    void eliminarDocumentoFirestore(COLECCIONES.documentos, id);
  };

  // Documentos de respaldo de un miembro (se guardan dentro de su ficha)
  const agregarDocumentoMiembro = (integranteId: string, docAdjunto: Omit<DocumentoAdjunto, 'id'>) => {
    const nuevo: DocumentoAdjunto = { ...docAdjunto, id: `docm-${Date.now()}` };
    const integranteActual = integrantesRef.current.find(i => i.id === integranteId);
    setIntegrantes(prev => prev.map(i => (
      i.id === integranteId
        ? { ...i, documentos: [...(i.documentos || []), nuevo] }
        : i
    )));
    if (integranteActual) {
      void guardarDocumento(COLECCIONES.integrantes, integranteId, {
        ...integranteActual,
        documentos: [...(integranteActual.documentos || []), nuevo]
      });
    }
  };

  const eliminarDocumentoMiembro = (integranteId: string, docId: string) => {
    const integranteActual = integrantesRef.current.find(i => i.id === integranteId);
    setIntegrantes(prev => prev.map(i => (
      i.id === integranteId
        ? { ...i, documentos: (i.documentos || []).filter(d => d.id !== docId) }
        : i
    )));
    if (integranteActual) {
      void guardarDocumento(COLECCIONES.integrantes, integranteId, {
        ...integranteActual,
        documentos: (integranteActual.documentos || []).filter(d => d.id !== docId)
      });
    }
  };

  // Botón Maestro de Recarga PWA
  const forzarActualizacionApp = () => {
    if (typeof window !== 'undefined') {
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach(name => caches.delete(name));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
      window.location.reload();
    }
  };

  return (
    <AppContext.Provider
      value={{
        integrantes,
        agregarIntegrante,
        actualizarIntegrante,
        eliminarIntegrante,
        eventos,
        tiposEventos,
        agregarTipoEvento,
        agregarEvento,
        agregarEventosLote,
        actualizarEvento,
        eliminarEvento,
        asistencias,
        marcarAsistencia,
        marcarTodosPresentes,
        marcarTodosEstado,
        quitarDeLista,
        agregarAListaEvento,
        cerrarAsistenciaEvento,
        cartas,
        agregarCarta,
        marcarCartaLeida,
        actualizarEstadoCarta,
        actas,
        agregarActa,
        solicitarEdicionActa,
        aprobarEdicionActa,
        guardarEdicionActa,
        deshacerEdicionActa,
        justificaciones,
        agregarJustificacion,
        resolverJustificacion,
        marcarJustificacionLeida,
        notificaciones,
        marcarNotificacionLeida,
        documentos,
        agregarDocumento,
        eliminarDocumento,
        agregarDocumentoMiembro,
        eliminarDocumentoMiembro,
        forzarActualizacionApp,
        usuarioActivo,
        setUsuarioActivo
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe ser usado dentro de un AppProvider');
  return context;
};
