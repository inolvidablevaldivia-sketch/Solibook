'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { EstadoAsistencia, Evento, Integrante, Justificacion } from '@/types';
import {
  Check,
  X,
  Search,
  CheckCheck,
  CalendarPlus,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  UserPlus,
  MoreVertical,
  UserMinus,
  FileText,
  Lock,
  ListChecks,
  PieChart
} from 'lucide-react';

interface VistaAsistenciaProps {
  eventoIdInicial?: string;
  onVolver?: () => void;
  onCrearEvento?: () => void;
}

const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

export const VistaAsistencia: React.FC<VistaAsistenciaProps> = ({
  eventoIdInicial,
  onVolver,
  onCrearEvento
}) => {
  const { eventos, integrantes, asistencias, justificaciones } = useApp();
  const { puede } = useAuth();

  const [eventoAbiertoId, setEventoAbiertoId] = useState<string | null>(eventoIdInicial || null);

  useEffect(() => {
    if (eventoIdInicial) setEventoAbiertoId(eventoIdInicial);
  }, [eventoIdInicial]);

  const activos = useMemo(() => integrantes.filter(i => i.estado === 'Activo'), [integrantes]);

  const convocadosDe = useMemo(() => {
    return (ev: Evento): Integrante[] => {
      if (ev.tipoConvocatoria === 'Por Cuerda' && ev.cuerdasConvocadas) {
        return activos.filter(i => ev.cuerdasConvocadas!.includes(i.cuerda));
      }
      if (ev.tipoConvocatoria === 'Personalizada') {
        const ids = ev.integrantesConvocadosIds || [];
        return activos.filter(i => ids.includes(i.id));
      }
      return activos;
    };
  }, [activos]);

  const ahora = new Date();

  const eventosOrdenados = useMemo(
    () =>
      [...eventos].sort(
        (a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime()
      ),
    [eventos]
  );

  // 1) evento de hoy sin lista finalizada (el más cercano por hora)
  // 2) si no hay, el próximo futuro sin finalizar
  const eventoSugerido = useMemo(() => {
    const hoyStr = ahora.toDateString();
    const pendientesHoy = eventosOrdenados.filter(
      ev => !ev.asistenciaFinalizada && new Date(ev.fechaHoraInicio).toDateString() === hoyStr
    );
    if (pendientesHoy.length > 0) {
      return [...pendientesHoy].sort((a, b) => {
        const da = Math.abs(new Date(a.fechaHoraInicio).getTime() - ahora.getTime());
        const db = Math.abs(new Date(b.fechaHoraInicio).getTime() - ahora.getTime());
        return da - db;
      })[0];
    }
    return (
      eventosOrdenados.find(
        ev => !ev.asistenciaFinalizada && new Date(ev.fechaHoraInicio).getTime() >= ahora.getTime()
      ) || null
    );
  }, [eventosOrdenados, ahora]);

  const eventosPendientes = useMemo(
    () => eventosOrdenados.filter(ev => !ev.asistenciaFinalizada),
    [eventosOrdenados]
  );

  const ultimasListas = useMemo(
    () =>
      [...eventos]
        .filter(ev => ev.asistenciaFinalizada)
        .sort((a, b) => new Date(b.fechaHoraInicio).getTime() - new Date(a.fechaHoraInicio).getTime())
        .slice(0, 5),
    [eventos]
  );

  const porcentajeDe = (ev: Evento) => {
    const convocados = convocadosDe(ev);
    if (convocados.length === 0) return 0;
    const presentes = convocados.filter(i =>
      asistencias.some(a => a.eventoId === ev.id && a.integranteId === i.id && a.estado === 'Presente')
    ).length;
    return Math.round((presentes / convocados.length) * 100);
  };

  // Métricas rápidas
  const metricas = useMemo(() => {
    const mes = ahora.getMonth();
    const anio = ahora.getFullYear();
    const delMes = eventos.filter(ev => {
      const f = new Date(ev.fechaHoraInicio);
      return f.getMonth() === mes && f.getFullYear() === anio && ev.asistenciaFinalizada;
    });

    let citados = 0;
    let presentes = 0;
    let ausenciasSinJustificar = 0;

    delMes.forEach(ev => {
      const convocados = convocadosDe(ev);
      citados += convocados.length;
      convocados.forEach(i => {
        const reg = asistencias.find(a => a.eventoId === ev.id && a.integranteId === i.id);
        if (reg?.estado === 'Presente') presentes++;
        if (reg?.estado === 'Ausente' || !reg) ausenciasSinJustificar++;
      });
    });

    return {
      porcentajeMes: citados > 0 ? Math.round((presentes / citados) * 100) : 0,
      ausencias: ausenciasSinJustificar,
      justificacionesPendientes: justificaciones.filter(j => j.estado === 'Pendiente').length,
      pendientes: eventos.filter(ev => !ev.asistenciaFinalizada).length
    };
  }, [eventos, asistencias, justificaciones, convocadosDe, ahora]);

  const eventoAbierto = eventos.find(e => e.id === eventoAbiertoId) || null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-16">
      {/* Asistencia más cercana */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Asistencia</h2>

        {eventoSugerido ? (
          <button
            onClick={() => setEventoAbiertoId(eventoSugerido.id)}
            className="w-full text-left rounded-2xl p-4 bg-gradient-to-r from-[#0099DD] to-[#0077B6] text-white shadow-sm hover:brightness-105 transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-100">
              Asistencia más cercana
            </span>
            <p className="text-lg font-bold leading-tight mt-1">{eventoSugerido.titulo}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-sky-50 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                {fmtFechaHora(eventoSugerido.fechaHoraInicio)}
              </span>
              <span className="text-xs font-semibold flex items-center gap-1">
                Pasar lista <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </button>
        ) : (
          <div className="rounded-2xl p-6 border border-dashed border-slate-200 text-center">
            <CalendarClock className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No hay actividades próximas pendientes.</p>
          </div>
        )}

        {puede('crear_evento') && (
          <button
            onClick={onCrearEvento}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-[#0099DD] hover:text-[#0099DD] text-xs font-bold transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            Crear evento
          </button>
        )}
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center">
          <PieChart className="w-4 h-4 text-[#0099DD] mx-auto mb-1" />
          <span className="text-base font-black text-slate-800 block">{metricas.porcentajeMes}%</span>
          <span className="text-[10px] text-slate-500 font-semibold">Mes</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center">
          <AlertCircle className="w-4 h-4 text-[#8B1E2B] mx-auto mb-1" />
          <span className="text-base font-black text-slate-800 block">{metricas.ausencias}</span>
          <span className="text-[10px] text-slate-500 font-semibold">Ausencias</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center">
          <FileText className="w-4 h-4 text-amber-600 mx-auto mb-1" />
          <span className="text-base font-black text-slate-800 block">
            {metricas.justificacionesPendientes}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">Justificaciones</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center">
          <ListChecks className="w-4 h-4 text-slate-500 mx-auto mb-1" />
          <span className="text-base font-black text-slate-800 block">{metricas.pendientes}</span>
          <span className="text-[10px] text-slate-500 font-semibold">Pendientes</span>
        </div>
      </div>

      {/* Pendientes */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Pendientes</h3>
        {eventosPendientes.length === 0 && (
          <p className="text-xs text-slate-400 py-2">No hay listas pendientes.</p>
        )}
        {eventosPendientes.map(ev => (
          <button
            key={ev.id}
            onClick={() => setEventoAbiertoId(ev.id)}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-[#0099DD]/40 hover:bg-sky-50/40 transition-colors text-left"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{ev.titulo}</p>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {fmtFechaHora(ev.fechaHoraInicio)}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </button>
        ))}
      </div>

      {/* Últimas listas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Últimas listas</h3>
        {ultimasListas.length === 0 && (
          <p className="text-xs text-slate-400 py-2">Aún no hay listas cerradas.</p>
        )}
        {ultimasListas.map(ev => (
          <button
            key={ev.id}
            onClick={() => setEventoAbiertoId(ev.id)}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{ev.titulo}</p>
              <span className="text-[11px] text-slate-500">{fmtFechaHora(ev.fechaHoraInicio)}</span>
            </div>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg shrink-0">
              {porcentajeDe(ev)}%
            </span>
          </button>
        ))}
      </div>

      {eventoAbierto && (
        <ModalPasoLista
          evento={eventoAbierto}
          onCerrar={() => {
            setEventoAbiertoId(null);
            if (eventoIdInicial && onVolver) onVolver();
          }}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* MODAL PASO DE LISTA                                                 */
/* ------------------------------------------------------------------ */

const ModalPasoLista: React.FC<{ evento: Evento; onCerrar: () => void }> = ({ evento, onCerrar }) => {
  const {
    integrantes,
    asistencias,
    justificaciones,
    marcarAsistencia,
    marcarTodosEstado,
    quitarDeLista,
    agregarAListaEvento,
    cerrarAsistenciaEvento,
    resolverJustificacion
  } = useApp();

  const { puede } = useAuth();

  const finalizada = evento.asistenciaFinalizada;

  const [busqueda, setBusqueda] = useState('');
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [seleccionAgregar, setSeleccionAgregar] = useState<string[]>([]);
  const [justificandoId, setJustificandoId] = useState<string | null>(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [justificacionAbiertaId, setJustificacionAbiertaId] = useState<string | null>(null);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activos = useMemo(
    () =>
      integrantes
        .filter(i => i.estado === 'Activo')
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)),
    [integrantes]
  );

  const convocados = useMemo(() => {
    if (evento.tipoConvocatoria === 'Por Cuerda' && evento.cuerdasConvocadas) {
      return activos.filter(i => evento.cuerdasConvocadas!.includes(i.cuerda));
    }
    if (evento.tipoConvocatoria === 'Personalizada') {
      const ids = evento.integrantesConvocadosIds || [];
      return activos.filter(i => ids.includes(i.id));
    }
    return activos;
  }, [activos, evento]);

  const convocadosIds = useMemo(() => convocados.map(i => i.id), [convocados]);

  const asistenciasMap = useMemo(() => {
    const map = new Map<string, { estado: EstadoAsistencia; motivo?: string }>();
    asistencias
      .filter(a => a.eventoId === evento.id)
      .forEach(a => map.set(a.integranteId, { estado: a.estado, motivo: a.motivoJustificacion }));
    return map;
  }, [asistencias, evento.id]);

  // Justificaciones pendientes de este evento, indexadas por integrante, para
  // avisar en la fila y permitir resolverlas sin salir del paso de lista.
  const justificacionesPendientes = useMemo(() => {
    const map = new Map<string, Justificacion>();
    justificaciones
      .filter(j => j.eventoId === evento.id && j.estado === 'Pendiente')
      .forEach(j => map.set(j.integranteId, j));
    return map;
  }, [justificaciones, evento.id]);

  const justificacionAbierta = justificaciones.find(j => j.id === justificacionAbiertaId) || null;

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return convocados;
    const q = busqueda.toLowerCase();
    return convocados.filter(
      i =>
        i.nombreCompleto.toLowerCase().includes(q) ||
        i.iglesia.toLowerCase().includes(q) ||
        i.cuerda.toLowerCase().includes(q)
    );
  }, [convocados, busqueda]);

  let presentes = 0;
  let ausentes = 0;
  let justificados = 0;
  convocados.forEach(i => {
    const st = asistenciasMap.get(i.id)?.estado;
    if (st === 'Presente') presentes++;
    else if (st === 'Ausente') ausentes++;
    else if (st === 'Justificado') justificados++;
  });

  const todosPresentes = convocados.length > 0 && presentes === convocados.length;

  const disponiblesParaAgregar = activos.filter(i => !convocadosIds.includes(i.id));

  const handleMarcar = (id: string, estado: EstadoAsistencia) => {
    if (finalizada) return;
    if (estado === 'Justificado') {
      setJustificandoId(id);
      setMotivoTexto(asistenciasMap.get(id)?.motivo || '');
      return;
    }
    marcarAsistencia(evento.id, id, estado);
  };

  const guardarJustificacion = () => {
    if (!justificandoId) return;
    marcarAsistencia(
      evento.id,
      justificandoId,
      'Justificado',
      motivoTexto.trim() || 'Justificación registrada en lista'
    );
    setJustificandoId(null);
    setMotivoTexto('');
  };

  const handleTodos = () => {
    if (finalizada) return;
    marcarTodosEstado(evento.id, convocadosIds, todosPresentes ? 'Ausente' : 'Presente');
  };

  const handleFinalizar = () => {
    if (confirm('¿Finalizar la lista? Quedará protegida y solo se podrán gestionar justificaciones.')) {
      cerrarAsistenciaEvento(evento.id);
      onCerrar();
    }
  };

  const handleQuitar = (id: string) => {
    setMenuAbiertoId(null);
    if (finalizada) return;
    if (confirm('¿Quitar de la lista? El miembro seguirá en Miembros y no contará como ausente.')) {
      quitarDeLista(evento.id, id, convocadosIds);
    }
  };

  const iniciarPulsacion = (id: string) => {
    if (finalizada) return;
    pressTimer.current = setTimeout(() => setMenuAbiertoId(id), 550);
  };
  const cancelarPulsacion = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const confirmarAgregar = () => {
    if (seleccionAgregar.length > 0) {
      agregarAListaEvento(evento.id, seleccionAgregar, convocadosIds);
    }
    setSeleccionAgregar([]);
    setModalAgregar(false);
  };

  const BotonFinalizar = ({ compacto }: { compacto?: boolean }) => (
    <button
      onClick={handleFinalizar}
      className={`flex items-center justify-center gap-1.5 bg-[#8B1E2B] hover:bg-[#721823] text-white font-bold rounded-xl transition-colors shadow-xs ${
        compacto ? 'px-3.5 py-1.5 text-xs' : 'w-full px-4 py-3 text-sm'
      }`}
    >
      <CheckCircle2 className={compacto ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      Finalizar
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center sm:p-4 animate-in fade-in">
      <div className="bg-[#f8fafc] w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="bg-white border-b border-slate-100 p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900 truncate whitespace-nowrap">
              {finalizada ? 'Lista finalizada' : 'Paso de lista'}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              {!finalizada && puede('finalizar_lista') && <BotonFinalizar compacto />}
              <button onClick={onCerrar} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-800 truncate">{evento.titulo}</p>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {fmtFechaHora(evento.fechaHoraInicio)}
              {evento.lugarNombre ? ` · ${evento.lugarNombre}` : ''}
            </span>
          </div>

          {finalizada && (
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
              <Lock className="w-3.5 h-3.5" />
              Lista protegida. Solo se pueden gestionar justificaciones.
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Citados</span>
              <span className="text-base font-black text-slate-800">{convocados.length}</span>
            </div>
            <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-bold block uppercase">Presentes</span>
              <span className="text-base font-black text-emerald-800">{presentes}</span>
            </div>
            <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100">
              <span className="text-[10px] text-amber-700 font-bold block uppercase">Justif.</span>
              <span className="text-base font-black text-amber-800">{justificados}</span>
            </div>
            <div className="bg-rose-50/70 p-2 rounded-xl border border-rose-100">
              <span className="text-[10px] text-rose-700 font-bold block uppercase">Ausentes</span>
              <span className="text-base font-black text-rose-800">{ausentes}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar integrante..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
              />
            </div>
            {!finalizada && puede('pasar_lista') && (
              <>
                <button
                  onClick={handleTodos}
                  className="flex items-center gap-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-colors whitespace-nowrap"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {todosPresentes ? 'Todos Ausentes' : 'Todos Presentes'}
                </button>
                <button
                  onClick={() => setModalAgregar(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-[#0077B6] font-bold text-xs rounded-xl border border-sky-200 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtrados.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">No hay integrantes en esta lista.</p>
          )}

          {filtrados.map(integrante => {
            const registro = asistenciasMap.get(integrante.id);
            const estado = registro?.estado;
            const justificacionPendiente = justificacionesPendientes.get(integrante.id);

            return (
              <div
                key={integrante.id}
                onContextMenu={e => {
                  if (!finalizada) {
                    e.preventDefault();
                    setMenuAbiertoId(integrante.id);
                  }
                }}
                onTouchStart={() => iniciarPulsacion(integrante.id)}
                onTouchEnd={cancelarPulsacion}
                onTouchMove={cancelarPulsacion}
                className={`relative bg-white rounded-2xl p-3 border transition-all flex items-center justify-between gap-3 shadow-xs ${
                  estado === 'Presente'
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : estado === 'Ausente'
                      ? 'border-rose-200 bg-rose-50/20'
                      : estado === 'Justificado'
                        ? 'border-amber-200 bg-amber-50/20'
                        : 'border-slate-200/80'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{integrante.nombreCompleto}</p>
                  <span className="text-[11px] text-slate-500">{integrante.cuerda}</span>
                  {estado === 'Justificado' && registro?.motivo && (
                    <p className="text-[10px] text-amber-700 truncate mt-0.5">{registro.motivo}</p>
                  )}
                  {justificacionPendiente && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      Justificación pendiente
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!finalizada && puede('pasar_lista') ? (
                    <>
                      <button
                        onClick={() => handleMarcar(integrante.id, 'Presente')}
                        title="Presente"
                        className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                          estado === 'Presente'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMarcar(integrante.id, 'Ausente')}
                        title="Ausente"
                        className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                          estado === 'Ausente'
                            ? 'bg-[#8B1E2B] border-[#8B1E2B] text-white'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-600'
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMarcar(integrante.id, 'Justificado')}
                        title="Justificado"
                        className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                          estado === 'Justificado'
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-600'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setMenuAbiertoId(menuAbiertoId === integrante.id ? null : integrante.id)
                        }
                        title="Opciones"
                        className="w-9 h-9 rounded-full flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-700 bg-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                          estado === 'Presente'
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                            : estado === 'Justificado'
                              ? 'text-amber-700 bg-amber-50 border-amber-100'
                              : 'text-[#8B1E2B] bg-rose-50 border-rose-100'
                        }`}
                      >
                        {estado || 'Ausente'}
                      </span>
                      {estado !== 'Presente' && estado !== 'Justificado' && puede('gestionar_justificaciones') && (
                        <button
                          onClick={() => {
                            setJustificandoId(integrante.id);
                            setMotivoTexto(registro?.motivo || '');
                          }}
                          className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-sky-50 text-[#0077B6] border border-sky-200 hover:bg-sky-100"
                        >
                          Justificar
                        </button>
                      )}
                    </>
                  )}

                  {justificacionPendiente && puede('gestionar_justificaciones') && (
                    <button
                      onClick={() => setJustificacionAbiertaId(justificacionPendiente.id)}
                      title="Ver justificación pendiente"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap"
                    >
                      <FileText className="w-3 h-3" />
                      Ver justificación
                    </button>
                  )}
                </div>

                {menuAbiertoId === integrante.id && !finalizada && (
                  <div className="absolute right-3 top-12 z-10 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    <button
                      onClick={() => handleQuitar(integrante.id)}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#8B1E2B] hover:bg-rose-50 w-full whitespace-nowrap"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Quitar de lista
                    </button>
                    <button
                      onClick={() => setMenuAbiertoId(null)}
                      className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 w-full text-left"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!finalizada && puede('finalizar_lista') && filtrados.length > 0 && (
            <div className="pt-3">
              <BotonFinalizar />
            </div>
          )}
        </div>
      </div>

      {/* Modal Agregar integrantes */}
      {modalAgregar && !finalizada && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">Agregar integrantes</h4>
              <button onClick={() => setModalAgregar(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {disponiblesParaAgregar.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">
                  Todos los miembros activos ya están en la lista.
                </p>
              )}
              {disponiblesParaAgregar.map(i => (
                <label
                  key={i.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={seleccionAgregar.includes(i.id)}
                    onChange={e =>
                      setSeleccionAgregar(prev =>
                        e.target.checked ? [...prev, i.id] : prev.filter(x => x !== i.id)
                      )
                    }
                    className="accent-[#0099DD] w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800">{i.nombreCompleto}</span>
                  <span className="text-[11px] text-slate-400 ml-auto">{i.cuerda}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setModalAgregar(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAgregar}
                className="px-4 py-2 text-xs font-bold bg-[#0099DD] hover:bg-[#0088cc] text-white rounded-xl"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Justificar */}
      {justificandoId && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Justificar inasistencia</h4>
            <p className="text-xs text-slate-500">
              {integrantes.find(i => i.id === justificandoId)?.nombreCompleto}
            </p>
            <textarea
              value={motivoTexto}
              onChange={e => setMotivoTexto(e.target.value)}
              rows={3}
              placeholder="Motivo de la justificación"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setJustificandoId(null);
                  setMotivoTexto('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={guardarJustificacion}
                className="px-4 py-2 text-xs font-bold bg-[#0099DD] hover:bg-[#0088cc] text-white rounded-xl"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver justificación pendiente (Aprobar / Rechazar sin salir de la lista) */}
      {justificacionAbierta && (
        <div className="fixed inset-0 z-70 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900">Justificación pendiente</h4>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {integrantes.find(i => i.id === justificacionAbierta.integranteId)?.nombreCompleto ||
                    'Integrante'}
                </p>
              </div>
              <button
                onClick={() => setJustificacionAbiertaId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Motivo</span>
                <p className="text-xs text-slate-700 mt-0.5">
                  {justificacionAbierta.motivo || 'Sin detalle registrado.'}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Canal: {justificacionAbierta.canalIngreso.replace('_', ' ')}</span>
                <span>{new Date(justificacionAbierta.fechaIngreso).toLocaleDateString('es-CL')}</span>
              </div>
              {justificacionAbierta.adjuntoUrl && (
                <a
                  href={justificacionAbierta.adjuntoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-[#0077B6] hover:underline inline-flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  Ver respaldo adjunto
                </a>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {puede('resolver_justificaciones') && (
                <>
                  <button
                    onClick={() => {
                      resolverJustificacion(justificacionAbierta.id, 'Rechazado');
                      setJustificacionAbiertaId(null);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-50 text-[#8B1E2B] border border-rose-200 hover:bg-rose-100"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => {
                      resolverJustificacion(justificacionAbierta.id, 'Aprobado');
                      setJustificacionAbiertaId(null);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-[#0099DD] hover:bg-[#0088cc] text-white"
                  >
                    Aprobar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
