'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
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
  DocumentoAdjunto,
  DocumentoEvento
} from '@/types';
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
import { collection, onSnapshot, query, where, doc, setDoc, runTransaction } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useEliminaciones } from '@/context/EliminacionesContext';
import { useAjustes } from '@/context/AjustesContext';
import { useAuth } from '@/context/AuthContext';
import { obtenerProximoCumpleanos } from '@/lib/cumpleanos';
import { ColeccionConDemo, filtrarDatosDemo } from '@/lib/datosDemo';

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
  guardarEdicionActa: (actaId: string, temas: string, acuerdos: string) => Promise<boolean>;
  deshacerEdicionActa: (actaId: string) => void;

  // Justificaciones
  justificaciones: Justificacion[];
  agregarJustificacion: (nueva: Omit<Justificacion, 'id'>) => void;
  resolverJustificacion: (id: string, estado: 'Aprobado' | 'Rechazado') => void;
  marcarJustificacionLeida: (id: string, usuarioInitials: string) => void;

  // Notificaciones
  notificaciones: NotificacionItem[];
  marcarNotificacionLeida: (id: string) => void;

  // Documentos institucionales, de miembros y de eventos
  documentos: DocumentoInstitucional[];
  agregarDocumento: (nuevo: Omit<DocumentoInstitucional, 'id'>) => void;
  eliminarDocumento: (id: string) => void;
  agregarDocumentoMiembro: (integranteId: string, doc: Omit<DocumentoAdjunto, 'id'>) => void;
  eliminarDocumentoMiembro: (integranteId: string, docId: string) => void;
  documentosEvento: DocumentoEvento[];
  agregarDocumentoEvento: (eventoId: string, doc: Omit<DocumentoEvento, 'id' | 'eventoId'>) => void;
  eliminarDocumentoEvento: (id: string) => void;

  // Utilidades PWA
  forzarActualizacionApp: () => void;
  usuarioActivo: { nombre: string; rol: string; iniciales: string };

  // Mantenimiento: retire de la nube y del dispositivo los registros de
  // demostración de las primeras versiones. Devuelve cuántos eliminó.
  cantidadDatosDemoEnUso: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TIPOS_EVENTOS_POR_DEFECTO = [
  'Ensayo',
  'Presentación',
  'Concierto',
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
  const [tiposEventos, setTiposEventos] = useState<string[]>(TIPOS_EVENTOS_POR_DEFECTO);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaRegistro[]>([]);
  const [cartas, setCartas] = useState<Carta[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [justificaciones, setJustificaciones] = useState<Justificacion[]>([]);
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoInstitucional[]>([]);
  const [documentosEvento, setDocumentosEvento] = useState<DocumentoEvento[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Identidad de sincronización: al iniciar o cerrar sesión se rearman las
  // suscripciones a Firestore (las reglas pueden exigir usuario autenticado).
  const { usuario, modoLocal, puede } = useAuth();
  const { solicitar: solicitarEliminacion, advertirBloqueo } = useEliminaciones();
  const { leidas, marcarLeida, avisos } = useAjustes();
  const claveSync = modoLocal ? 'modo-local' : (usuario?.uid ?? 'sin-sesion');
  // Solo los roles de gestión publican cambios en la configuración compartida
  // (tipos de actividad). Se guarda como dato estable para no reabrir las
  // suscripciones en cada render.
  const puedeConfigurarEventos = puede('crear_evento');

  const usuarioActivo = {
    nombre: usuario?.nombre || 'Sin sesión',
    rol: usuario?.rol || '',
    iniciales: (usuario?.nombre || 'SD').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
  };

  // Espejos síncronos del estado para leer el valor más reciente dentro de
  // las mutaciones (y calcular qué documentos escribir en Firestore).
  const integrantesRef = useRef<Integrante[]>([]);
  const tiposEventosRef = useRef<string[]>(TIPOS_EVENTOS_POR_DEFECTO);
  const eventosRef = useRef<Evento[]>([]);
  const asistenciasRef = useRef<AsistenciaRegistro[]>([]);
  const cartasRef = useRef<Carta[]>([]);
  const actasRef = useRef<Acta[]>([]);
  const justificacionesRef = useRef<Justificacion[]>([]);
  const notificacionesRef = useRef<NotificacionItem[]>([]);
  const documentosRef = useRef<DocumentoInstitucional[]>([]);
  const documentosEventoRef = useRef<DocumentoEvento[]>([]);

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
    documentosEventoRef.current = documentosEvento;
  });

  // Carga inicial desde LocalStorage (respaldo y modo sin conexión).
  // Solibook arranca sin datos: no hay integrantes, actividades ni documentos
  // de demostración. Lo único que se recupera es lo que ya estaba guardado en
  // este dispositivo, depurado de los registros de ejemplo antiguos.
  useEffect(() => {
    const leer = <T,>(clave: string): T[] => {
      try {
        const bruto = localStorage.getItem(clave);
        if (!bruto) return [];
        const parseado: unknown = JSON.parse(bruto);
        return Array.isArray(parseado) ? (parseado as T[]) : [];
      } catch {
        return [];
      }
    };

    const dataIntegrantes = leer<Integrante>('solibook_integrantes');
    const dataEventos = leer<Evento>('solibook_eventos');
    const dataTipos = leer<string>('solibook_tipos_eventos');
    const dataAsistencias = leer<AsistenciaRegistro>('solibook_asistencias');

    setIntegrantes(
      ordenarIntegrantes(filtrarDatosDemo('integrantes', dataIntegrantes))
    );
    setEventos(filtrarDatosDemo('eventos', dataEventos));
    setTiposEventos(
      tiposUnicos([
        ...TIPOS_EVENTOS_POR_DEFECTO,
        ...dataTipos,
        ...dataEventos.map(e => e.tipo)
      ])
    );
    setAsistencias(filtrarDatosDemo('asistencias', dataAsistencias));
    setCartas(filtrarDatosDemo('cartas', leer<Carta>('solibook_cartas')));
    setActas(filtrarDatosDemo('actas', leer<Acta>('solibook_actas')));
    setJustificaciones(
      filtrarDatosDemo('justificaciones', leer<Justificacion>('solibook_justificaciones'))
    );
    setNotificaciones(
      filtrarDatosDemo('notificaciones', leer<NotificacionItem>('solibook_notificaciones'))
    );
    setDocumentos(filtrarDatosDemo('documentos', leer<DocumentoInstitucional>('solibook_documentos')));
    setDocumentosEvento(
      filtrarDatosDemo('documentosEvento', leer<DocumentoEvento>('solibook_documentos_evento'))
    );
    setIsLoaded(true);
  }, []);

  // Suscripciones en tiempo real a Firestore. Cada cambio remoto reemplaza el
  // estado local; si la nube está vacía se migran los datos locales (siembra
  // única, protegida por transacción en "configuracion/semillas").
  useEffect(() => {
    if (!isLoaded || modoLocal || !usuario?.uid) return;

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
        () => integrantesRef.current,
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
        () => eventosRef.current,
        undefined,
        alSerRestringida(() => setEventos([]))
      ),
      suscribirseColeccion<AsistenciaRegistro>(
        COLECCIONES.asistencias,
        items => setAsistencias(items),
        () => asistenciasRef.current,
        undefined,
        alSerRestringida(() => setAsistencias([]))
      ),
      suscribirseColeccion<Carta>(
        COLECCIONES.cartas,
        items => setCartas(items),
        () => cartasRef.current,
        undefined,
        alSerRestringida(() => setCartas([]))
      ),
      suscribirseColeccion<Acta>(
        COLECCIONES.actas,
        items => setActas(items),
        () => actasRef.current,
        undefined,
        alSerRestringida(() => setActas([]))
      ),
      ...(sesionReal && usuario?.rol === 'Miembro'
        ? [usuario.integranteId ? onSnapshot(
            query(collection(db, COLECCIONES.justificaciones), where('integranteId', '==', usuario.integranteId)),
            snap => setJustificaciones(snap.docs.map(d => ({ ...d.data(), id: d.id } as Justificacion))),
            () => setJustificaciones([])
          ) : (() => { setJustificaciones([]); return () => {}; })()]
        : [suscribirseColeccion<Justificacion>(
            COLECCIONES.justificaciones,
            items => setJustificaciones(items),
            () => justificacionesRef.current,
            undefined,
            alSerRestringida(() => setJustificaciones([]))
          )]),
      suscribirseColeccion<NotificacionItem>(
        COLECCIONES.notificaciones,
        items => setNotificaciones(items),
        () => notificacionesRef.current,
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
      suscribirseColeccion<DocumentoEvento>(
        COLECCIONES.documentosEvento,
        items => setDocumentosEvento(items),
        () => documentosEventoRef.current,
        undefined,
        alSerRestringida(() => setDocumentosEvento([]))
      ),
      suscribirseDocumento<{ tiposEventos?: string[] }>(
        DOC_CONFIG_GENERAL.coleccion,
        DOC_CONFIG_GENERAL.id,
        datos => {
          if (datos?.tiposEventos) {
            setTiposEventos(tiposUnicos([...TIPOS_EVENTOS_POR_DEFECTO, ...datos.tiposEventos]));
            // Las categorías por defecto (Ensayo, Presentación, Concierto,
            // Reunión, Administrativo, Otro) deben existir también en el
            // documento compartido, aunque la configuración sea antigua.
            const publicados = datos.tiposEventos;
            const faltantes = TIPOS_EVENTOS_POR_DEFECTO.filter(tipo => !publicados.includes(tipo));
            if (faltantes.length > 0 && puedeConfigurarEventos) {
              void setDoc(
                doc(db, DOC_CONFIG_GENERAL.coleccion, DOC_CONFIG_GENERAL.id),
                { tiposEventos: tiposUnicos([...TIPOS_EVENTOS_POR_DEFECTO, ...publicados]) },
                { merge: true }
              ).catch(() => {
                /* sin permiso o sin conexión: se mantiene la configuración local */
              });
            }
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
  }, [isLoaded, claveSync, modoLocal, usuario?.uid, usuario?.integranteId, usuario?.rol, usuario?.activo, puedeConfigurarEventos]);

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
      localStorage.setItem('solibook_documentos_evento', JSON.stringify(documentosEvento));
    } catch (e) {
      console.error('Error persistiendo datos:', e);
    }
  }, [integrantes, eventos, tiposEventos, asistencias, cartas, actas, justificaciones, notificaciones, documentos, documentosEvento, isLoaded]);

  // Aviso interno de cumpleaños: aparece una sola vez desde siete días antes.
  // El envío push del día exacto se ejecuta desde /api/cron/cumpleanos.
  useEffect(() => {
    // Los avisos de cumpleaños son parte de la coordinación interna; el rol
    // Miembro no lee el centro de notificaciones ni crea avisos compartidos.
    if (!isLoaded || !puede('ver_miembros')) return;

    const porAvisar: NotificacionItem[] = [];

    integrantes
      .filter(i => i.estado === 'Activo' && i.fechaNacimiento)
      .forEach(i => {
        const proximo = obtenerProximoCumpleanos(i.fechaNacimiento);
        if (!proximo || proximo.diasRestantes > 7) return;

        const idEstable = `cumple-${i.id}-${proximo.fecha.getFullYear()}`;
        const fechaTexto = proximo.fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'long' });

        porAvisar.push({
          id: idEstable,
          tipo: 'Calendario',
          titulo:
            proximo.diasRestantes === 0
              ? `Hoy cumple años ${i.nombreCompleto}`
              : `Cumpleaños de ${i.nombreCompleto}`,
          mensaje:
            proximo.diasRestantes === 0
              ? `Cumple ${proximo.fecha.getFullYear() - proximo.anioNacimiento} años hoy.`
              : `Cumple años el ${fechaTexto} (en ${proximo.diasRestantes} día${proximo.diasRestantes === 1 ? '' : 's'}).`,
          fecha:
            proximo.diasRestantes === 0
              ? 'Hoy'
              : `En ${proximo.diasRestantes} día${proximo.diasRestantes === 1 ? '' : 's'}`,
          leido: false,
          accionId: i.id
        });
      });

    const nuevas = porAvisar.filter(n => !notificaciones.some(existente => existente.id === n.id));
    if (nuevas.length > 0) {
      setNotificaciones(prev => [...prev, ...nuevas]);
      // Los IDs son estables, así que todos los dispositivos comparten el mismo aviso.
      nuevas.forEach(n => void guardarDocumento(COLECCIONES.notificaciones, n.id, n));
    }
  }, [integrantes, notificaciones, isLoaded, puede]);

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
    if (advertirBloqueo('integrantes', id)) return;
    const actual = integrantesRef.current.find(item => item.id === id);
    setIntegrantes(prev => prev.map(item => item.id === id ? { ...item, ...datos } : item));
    if (actual) void guardarDocumento(COLECCIONES.integrantes, id, { ...actual, ...datos });
  };

  const eliminarIntegrante = (id: string) => {
    void solicitarEliminacion('integrantes', id, integrantesRef.current.find(i => i.id === id)?.nombreCompleto || id);
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
    const idsEventosEliminados = new Set(eliminados);
    const documentosEliminados = documentosEventoRef.current
      .filter(documento => idsEventosEliminados.has(documento.eventoId))
      .map(documento => documento.id);
    setEventos(siguiente);
    setDocumentosEvento(prev => prev.filter(documento => !idsEventosEliminados.has(documento.eventoId)));
    void eliminarDocumentosFirestore(COLECCIONES.eventos, eliminados);
    void eliminarDocumentosFirestore(COLECCIONES.documentosEvento, documentosEliminados);
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
    const id = `car-${crypto.randomUUID()}`;
    const notificacion: NotificacionItem = {
      id: `notif-${crypto.randomUUID()}`,
      tipo: 'Carta',
      titulo: 'Nueva Correspondencia Registrada',
      mensaje: `${nueva.tipoFlujo === 'Recibida' ? 'De: ' : 'Para: '} ${nueva.remitenteDestinatario} (${nueva.folio})`,
      fecha: new Date().toISOString(),
      leido: false,
      accionId: id
    };
    setCartas(prev => [{ ...nueva, id }, ...prev]);
    setNotificaciones(prev => [notificacion, ...prev]);
    void guardarDocumento(COLECCIONES.cartas, id, { ...nueva, id });
    void guardarDocumento(COLECCIONES.notificaciones, notificacion.id, notificacion).then(() => intentarAvisoPush(notificacion.id));
  };

  const marcarCartaLeida = (cartaId: string, usuarioInitials: string) => {
    if (advertirBloqueo('cartas', cartaId)) return;
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
    if (advertirBloqueo('cartas', cartaId)) return;
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
    if (advertirBloqueo('actas', actaId)) return;
    const actaActual = actasRef.current.find(a => a.id === actaId);
    const notificacion: NotificacionItem = {
      id: `notif-${crypto.randomUUID()}`,
      tipo: 'Acta',
      titulo: 'Solicitud de Edición de Acta',
      mensaje: 'Se ha solicitado autorización conjunta para modificar un acta cerrada.',
      fecha: new Date().toISOString(),
      leido: false,
      accionId: actaId
    };
    setActas(prev => prev.map(a => a.id === actaId ? {
      ...a,
      estado: 'En_Solicitud_Edicion',
      aprobadoPresidente: false,
      aprobadoSecretaria: false,
      firmaEdicionDirectorUid: '',
      firmaEdicionSecretarioUid: ''
    } : a));
    setNotificaciones(prev => [notificacion, ...prev]);
    if (actaActual) {
      void guardarDocumento(COLECCIONES.actas, actaId, {
        ...actaActual,
        estado: 'En_Solicitud_Edicion',
        aprobadoPresidente: false,
        aprobadoSecretaria: false,
      firmaEdicionDirectorUid: '',
      firmaEdicionSecretarioUid: ''
      });
    }
    void guardarDocumento(COLECCIONES.notificaciones, notificacion.id, notificacion).then(() => intentarAvisoPush(notificacion.id));
  };

  const aprobarEdicionActa = async (actaId: string, rol: 'Presidente' | 'Secretaria') => {
    if (advertirBloqueo('actas', actaId)) return;
    if (modoLocal || !usuario || (rol === 'Presidente' ? usuario.rol !== 'Director' : usuario.rol !== 'Secretario')) {
      alert('Esta firma corresponde únicamente a una cuenta autenticada con el cargo indicado.'); return;
    }
    try {
      await runTransaction(db, async tx => {
        const ref = doc(db, COLECCIONES.actas, actaId);
        const snapshot = await tx.get(ref);
        const acta = snapshot.data() as Acta | undefined;
        if (!acta || acta.estado !== 'En_Solicitud_Edicion') return;
        const pres = rol === 'Presidente' ? true : acta.aprobadoPresidente;
        const sec = rol === 'Secretaria' ? true : acta.aprobadoSecretaria;
        tx.update(ref, {
          aprobadoPresidente: pres, aprobadoSecretaria: sec,
          ...(rol === 'Presidente' ? { firmaEdicionDirectorUid: usuario.uid } : { firmaEdicionSecretarioUid: usuario.uid }),
          estado: pres && sec ? 'Borrador' : 'En_Solicitud_Edicion'
        });
      });
    } catch { alert('No se pudo registrar la firma. Revisa la conexión, el cargo y las reglas.'); }
  };

  const guardarEdicionActa = async (actaId: string, temas: string, acuerdos: string): Promise<boolean> => {
    if (advertirBloqueo('actas', actaId)) return false;
    if (modoLocal || !usuario) { alert('La edición autorizada requiere conexión y sesión con Google.'); return false; }
    try {
      await runTransaction(db, async tx => {
        const ref = doc(db, COLECCIONES.actas, actaId);
        const snapshot = await tx.get(ref);
        const acta = snapshot.data() as Acta | undefined;
        if (!acta || acta.estado !== 'Borrador' || !acta.aprobadoPresidente || !acta.aprobadoSecretaria || !acta.firmaEdicionDirectorUid || !acta.firmaEdicionSecretarioUid || acta.firmaEdicionDirectorUid === acta.firmaEdicionSecretarioUid) throw new Error('Faltan firmas');
        tx.update(ref, {
          backupAnterior: { temasTratados: acta.temasTratados, acuerdos: acta.acuerdos, fechaModificacion: new Date().toISOString() },
          temasTratados: temas, acuerdos, version: acta.version + 1, estado: 'Cerrada'
        });
      });
      return true;
    } catch { alert('No se pudo guardar. Revisa las dos firmas, los cargos vigentes y la conexión. Tus cambios siguen en el formulario.'); return false; }
  };

  const deshacerEdicionActa = (actaId: string) => {
    if (advertirBloqueo('actas', actaId)) return;
    const acta = actasRef.current.find(a => a.id === actaId);
    if (!acta?.backupAnterior) return;
    if (acta.estado !== 'Borrador' || !acta.firmaEdicionDirectorUid || !acta.firmaEdicionSecretarioUid) {
      if (acta.estado !== 'En_Solicitud_Edicion') solicitarEdicionActa(actaId);
      alert('Para restaurar el respaldo, Dirección y Secretaría deben autorizar la apertura. Luego pulsa Deshacer nuevamente.');
      return;
    }
    guardarEdicionActa(actaId, acta.backupAnterior.temasTratados, acta.backupAnterior.acuerdos);
  };

  const intentarAvisoPush = async (id: string) => {
    if (modoLocal || !auth.currentUser) return;
    try {
      await fetch(`/api/avisos?id=${encodeURIComponent(id)}`, { method: 'POST', headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } });
    } catch { /* El cron recupera los avisos recientes que no llegaron al servidor. */ }
  };

  // Funciones de Justificaciones
  const agregarJustificacion = (nueva: Omit<Justificacion, 'id'>) => {
    const id = `just-${Date.now()}`;
    const notificacion: NotificacionItem = {
      id: `notif-${crypto.randomUUID()}`,
      tipo: 'Justificacion',
      titulo: 'Nueva Justificación Enviada',
      mensaje: `Motivo: ${nueva.motivo.slice(0, 50)}...`,
      fecha: new Date().toISOString(),
      leido: false,
      accionId: id
    };
    setJustificaciones(prev => [{ ...nueva, id }, ...prev]);
    setNotificaciones(prev => [notificacion, ...prev]);
    void guardarDocumento(COLECCIONES.justificaciones, id, { ...nueva, id });
    void guardarDocumento(COLECCIONES.notificaciones, notificacion.id, notificacion).then(() => intentarAvisoPush(notificacion.id));
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
  const marcarNotificacionLeida = (id: string) => { void marcarLeida(id); };

  // Documentos institucionales (Libro de Documentos)
  const agregarDocumento = (nuevo: Omit<DocumentoInstitucional, 'id'>) => {
    const id = `doc-${Date.now()}`;
    setDocumentos(prev => [{ ...nuevo, id }, ...prev]);
    void guardarDocumento(COLECCIONES.documentos, id, { ...nuevo, id });
  };

  const eliminarDocumento = (id: string) => {
    void solicitarEliminacion('documentos', id, documentosRef.current.find(d => d.id === id)?.titulo || id);
  };

  const agregarDocumentoEvento = (
    eventoId: string,
    docAdjunto: Omit<DocumentoEvento, 'id' | 'eventoId'>
  ) => {
    const nuevo: DocumentoEvento = { ...docAdjunto, eventoId, id: `doce-${Date.now()}` };
    setDocumentosEvento(prev => [...prev, nuevo]);
    void guardarDocumento(COLECCIONES.documentosEvento, nuevo.id, nuevo);
  };

  const eliminarDocumentoEvento = (id: string) => {
    setDocumentosEvento(prev => prev.filter(documento => documento.id !== id));
    void eliminarDocumentoFirestore(COLECCIONES.documentosEvento, id);
  };

  // Documentos de respaldo de un miembro (se guardan dentro de su ficha)
  const agregarDocumentoMiembro = (integranteId: string, docAdjunto: Omit<DocumentoAdjunto, 'id'>) => {
    if (advertirBloqueo('integrantes', integranteId)) return;
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
    if (advertirBloqueo('integrantes', integranteId)) return;
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

  // Cuántos registros de la demostración siguen cargados en pantalla. Se usa
  // para avisar en Usuarios y Permisos antes de limpiarlos.
  const cantidadDatosDemoEnUso = useMemo(() => {
    const listas: [ColeccionConDemo, { id: string }[]][] = [
      ['integrantes', integrantes],
      ['eventos', eventos],
      ['asistencias', asistencias],
      ['cartas', cartas],
      ['actas', actas],
      ['justificaciones', justificaciones],
      ['notificaciones', notificaciones],
      ['documentos', documentos],
      ['documentosEvento', documentosEvento]
    ];
    return listas.reduce(
      (total, [coleccion, items]) => total + (items.length - filtrarDatosDemo(coleccion, items).length),
      0
    );
  }, [integrantes, eventos, asistencias, cartas, actas, justificaciones, notificaciones, documentos, documentosEvento]);

  // Botón Maestro de Recarga PWA
  const forzarActualizacionApp = () => {
    if (typeof window !== 'undefined') {
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach(name => caches.delete(name));
        });
      }
      // No se desregistran service workers: el de Firebase Messaging mantiene
      // los avisos de cumpleaños aun cuando se refresca la interfaz.
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
        notificaciones: [...new Map([...notificaciones, ...avisos].map(n => [n.id, n])).values()].sort((a, b) => (Date.parse(b.fecha) || 0) - (Date.parse(a.fecha) || 0)).map(n => ({ ...n, leido: leidas[n.id] === true })),
        marcarNotificacionLeida,
        documentos,
        agregarDocumento,
        eliminarDocumento,
        agregarDocumentoMiembro,
        eliminarDocumentoMiembro,
        documentosEvento,
        agregarDocumentoEvento,
        eliminarDocumentoEvento,
        forzarActualizacionApp,
        usuarioActivo,
        cantidadDatosDemoEnUso
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
