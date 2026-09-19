'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Integrante,
  Evento,
  AsistenciaRegistro,
  Carta,
  Acta,
  Justificacion,
  NotificacionItem,
  EstadoAsistencia
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
  const [tiposEventos, setTiposEventos] = useState<string[]>(TIPOS_EVENTOS_BASE);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaRegistro[]>([]);
  const [cartas, setCartas] = useState<Carta[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [justificaciones, setJustificaciones] = useState<Justificacion[]>([]);
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [usuarioActivo, setUsuarioActivo] = useState({
    nombre: 'Pastoral & Secretaría General',
    rol: 'Administración',
    iniciales: 'SG'
  });

  // Carga inicial persistente de LocalStorage
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
    }
    setIsLoaded(true);
  }, []);

  // Persistir en cada cambio
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
    } catch (e) {
      console.error('Error persistiendo datos:', e);
    }
  }, [integrantes, eventos, tiposEventos, asistencias, cartas, actas, justificaciones, notificaciones, isLoaded]);

  // Funciones de Integrantes
  const agregarIntegrante = (nuevo: Omit<Integrante, 'id'>) => {
    const id = `int-${Date.now()}`;
    setIntegrantes(prev => {
      const actualizados = [ ...prev, { ...nuevo, id } ];
      return actualizados.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    });
  };

  const actualizarIntegrante = (id: string, datos: Partial<Integrante>) => {
    setIntegrantes(prev => prev.map(item => item.id === id ? { ...item, ...datos } : item));
  };

  const eliminarIntegrante = (id: string) => {
    setIntegrantes(prev => prev.filter(item => item.id !== id));
  };

  // Funciones de Eventos
  const agregarEvento = (nuevo: Omit<Evento, 'id'>): string => {
    const id = `ev-${Date.now()}`;
    setEventos(prev => [ { ...nuevo, id }, ...prev ]);
    return id;
  };

  const agregarEventosLote = (nuevos: Omit<Evento, 'id'>[]) => {
    const listos: Evento[] = nuevos.map((n, idx) => ({
      ...n,
      id: `ev-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`
    }));
    setEventos(prev => [ ...listos, ...prev ]);
  };

  const agregarTipoEvento = (tipo: string) => {
    const limpio = tipo.trim();
    if (limpio && !tiposEventos.includes(limpio)) {
      setTiposEventos(prev => [...prev, limpio]);
    }
  };

  const actualizarEvento = (id: string, datos: Partial<Evento>, editarFuturosDelGrupo: boolean = false) => {
    setEventos(prev => {
      const objetivo = prev.find(e => e.id === id);
      if (!objetivo) return prev;

      if (editarFuturosDelGrupo && objetivo.grupoRecurrenciaId) {
        const fechaObjetivo = new Date(objetivo.fechaHoraInicio).getTime();
        return prev.map(item => {
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
            return { ...item, ...datos, fechaHoraInicio: nuevaFechaHora };
          }
          return item;
        });
      }

      return prev.map(item => item.id === id ? { ...item, ...datos } : item);
    });
  };

  const eliminarEvento = (id: string, borrarFuturosDelGrupo: boolean = false) => {
    setEventos(prev => {
      const objetivo = prev.find(e => e.id === id);
      if (!objetivo) return prev;
      if (borrarFuturosDelGrupo && objetivo.grupoRecurrenciaId) {
        const fechaObjetivo = new Date(objetivo.fechaHoraInicio).getTime();
        return prev.filter(e => {
          // Solo borrar si es del mismo grupo y su fecha es mayor o igual a la actual
          if (e.grupoRecurrenciaId === objetivo.grupoRecurrenciaId) {
            return new Date(e.fechaHoraInicio).getTime() < fechaObjetivo;
          }
          return true;
        });
      }
      return prev.filter(e => e.id !== id);
    });
  };

  // Funciones de Asistencias
  const marcarAsistencia = (eventoId: string, integranteId: string, estado: EstadoAsistencia, motivo?: string) => {
    setAsistencias(prev => {
      const idx = prev.findIndex(a => a.eventoId === eventoId && a.integranteId === integranteId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          estado,
          motivoJustificacion: motivo ?? copy[idx].motivoJustificacion,
          horaMarcado: new Date().toISOString()
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            id: `as-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            eventoId,
            integranteId,
            estado,
            motivoJustificacion: motivo,
            horaMarcado: new Date().toISOString()
          }
        ];
      }
    });
  };

  const marcarTodosPresentes = (eventoId: string, integrantesIds: string[]) => {
    setAsistencias(prev => {
      const filtered = prev.filter(a => a.eventoId !== eventoId);
      const nuevos: AsistenciaRegistro[] = integrantesIds.map(id => ({
        id: `as-${Date.now()}-${id}`,
        eventoId,
        integranteId: id,
        estado: 'Presente',
        horaMarcado: new Date().toISOString()
      }));
      return [...filtered, ...nuevos];
    });
  };

  const cerrarAsistenciaEvento = (eventoId: string) => {
    setEventos(prev => prev.map(ev => ev.id === eventoId ? { ...ev, asistenciaFinalizada: true } : ev));
  };

  // Funciones de Cartas
  const agregarCarta = (nueva: Omit<Carta, 'id'>) => {
    const id = `car-${Date.now()}`;
    setCartas(prev => [ { ...nueva, id }, ...prev ]);
    setNotificaciones(prev => [
      {
        id: `notif-${Date.now()}`,
        tipo: 'Carta',
        titulo: 'Nueva Correspondencia Registrada',
        mensaje: `${nueva.tipoFlujo === 'Recibida' ? 'De: ' : 'Para: '} ${nueva.remitenteDestinatario} (${nueva.folio})`,
        fecha: 'Hace un momento',
        leido: false,
        accionId: id
      },
      ...prev
    ]);
  };

  const marcarCartaLeida = (cartaId: string, usuarioInitials: string) => {
    setCartas(prev => prev.map(c => {
      if (c.id === cartaId && !c.vistoPor.includes(usuarioInitials)) {
        return { ...c, vistoPor: [...c.vistoPor, usuarioInitials] };
      }
      return c;
    }));
  };

  const actualizarEstadoCarta = (cartaId: string, estado: Carta['estado']) => {
    setCartas(prev => prev.map(c => c.id === cartaId ? { ...c, estado } : c));
  };

  // Funciones de Actas
  const agregarActa = (nueva: Omit<Acta, 'id'>) => {
    const id = `act-${Date.now()}`;
    setActas(prev => [ { ...nueva, id }, ...prev ]);
  };

  const solicitarEdicionActa = (actaId: string) => {
    setActas(prev => prev.map(a => a.id === actaId ? {
      ...a,
      estado: 'En_Solicitud_Edicion',
      aprobadoPresidente: false,
      aprobadoSecretaria: false
    } : a));
    setNotificaciones(prev => [
      {
        id: `notif-${Date.now()}`,
        tipo: 'Acta',
        titulo: 'Solicitud de Edición de Acta',
        mensaje: 'Se ha solicitado autorización conjunta para modificar un acta cerrada.',
        fecha: 'Ahora',
        leido: false,
        accionId: actaId
      },
      ...prev
    ]);
  };

  const aprobarEdicionActa = (actaId: string, rol: 'Presidente' | 'Secretaria') => {
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
  };

  const guardarEdicionActa = (actaId: string, temas: string, acuerdos: string) => {
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
  };

  const deshacerEdicionActa = (actaId: string) => {
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
  };

  // Funciones de Justificaciones
  const agregarJustificacion = (nueva: Omit<Justificacion, 'id'>) => {
    const id = `just-${Date.now()}`;
    setJustificaciones(prev => [ { ...nueva, id }, ...prev ]);
    setNotificaciones(prev => [
      {
        id: `notif-${Date.now()}`,
        tipo: 'Justificacion',
        titulo: 'Nueva Justificación Enviada',
        mensaje: `Motivo: ${nueva.motivo.slice(0, 50)}...`,
        fecha: 'Ahora',
        leido: false,
        accionId: id
      },
      ...prev
    ]);
  };

  const resolverJustificacion = (id: string, estado: 'Aprobado' | 'Rechazado') => {
    setJustificaciones(prev => prev.map(j => {
      if (j.id === id) {
        // También actualizar la asistencia asociada si existe
        if (estado === 'Aprobado') {
          marcarAsistencia(j.eventoId, j.integranteId, 'Justificado', j.motivo);
        } else {
          marcarAsistencia(j.eventoId, j.integranteId, 'Ausente', 'Justificación rechazada');
        }
        return { ...j, estado };
      }
      return j;
    }));
  };

  const marcarJustificacionLeida = (id: string, usuarioInitials: string) => {
    setJustificaciones(prev => prev.map(j => {
      if (j.id === id && !j.vistoPor.includes(usuarioInitials)) {
        return { ...j, vistoPor: [...j.vistoPor, usuarioInitials] };
      }
      return j;
    }));
  };

  // Notificaciones
  const marcarNotificacionLeida = (id: string) => {
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
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
