'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { obtenerProximoCumpleanos } from '@/lib/cumpleanos';
import {
  CalendarClock,
  Calendar,
  CheckSquare,
  BookOpen,
  LayoutDashboard,
  FileText,
  ListChecks,
  Cake,
  ChevronRight,
  Users,
  AlertCircle,
  Clock,
  Mic,
  Music,
  Send
} from 'lucide-react';

interface VistaInicioProps {
  setVistaActual: (v: string) => void;
  onIniciarAsistencia: (eventoId: string) => void;
  onAbrirAgendaFiltrada: (tipo: string) => void;
  onEnviarCalendario: () => void;
}

const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

export const VistaInicio: React.FC<VistaInicioProps> = ({
  setVistaActual,
  onIniciarAsistencia,
  onAbrirAgendaFiltrada,
  onEnviarCalendario
}) => {
  const { eventos, integrantes, asistencias, justificaciones, documentos } = useApp();
  const { puede } = useAuth();

  const activos = useMemo(() => integrantes.filter(i => i.estado === 'Activo'), [integrantes]);

  const ahora = useMemo(() => new Date(), []);

  // Próxima actividad: la más cercana desde ahora en adelante
  const proximaActividad = useMemo(() => {
    return (
      [...eventos]
        .filter(ev => new Date(ev.fechaHoraInicio).getTime() >= ahora.getTime())
        .sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime())[0] ||
      null
    );
  }, [eventos, ahora]);

  const listasSinFinalizar = useMemo(
    () =>
      [...eventos]
        .filter(ev => !ev.asistenciaFinalizada)
        .sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime()),
    [eventos]
  );

  const justificacionesPendientes = useMemo(
    () => justificaciones.filter(j => j.estado === 'Pendiente'),
    [justificaciones]
  );

  // Cumpleaños de los próximos 30 días. Comparte la misma lógica que los
  // avisos internos, incluido el caso del 29 de febrero.
  const cumpleanosProximos = useMemo(() => {
    return activos
      .map(integrante => {
        const proximo = obtenerProximoCumpleanos(integrante.fechaNacimiento);
        return proximo ? { integrante, dias: proximo.diasRestantes, fecha: proximo.fecha } : null;
      })
      .filter((item): item is { integrante: (typeof activos)[number]; dias: number; fecha: Date } =>
        item !== null && item.dias <= 30
      )
      .sort((a, b) => a.dias - b.dias);
  }, [activos]);

  // Resumen de asistencia del mes en curso, solo listas finalizadas
  const resumenMes = useMemo(() => {
    const mes = ahora.getMonth();
    const anio = ahora.getFullYear();
    const cerradas = eventos.filter(ev => {
      const f = new Date(ev.fechaHoraInicio);
      return f.getMonth() === mes && f.getFullYear() === anio && ev.asistenciaFinalizada;
    });

    let citados = 0;
    let ponderado = 0;

    cerradas.forEach(ev => {
      activos.forEach(i => {
        let convocado = false;
        if (ev.tipoConvocatoria === 'Todos') convocado = true;
        else if (ev.tipoConvocatoria === 'Por Cuerda') convocado = ev.cuerdasConvocadas?.includes(i.cuerda) || false;
        else if (ev.tipoConvocatoria === 'Personalizada')
          convocado = ev.integrantesConvocadosIds?.includes(i.id) || false;
        if (!convocado) return;

        citados++;
        const reg = asistencias.find(a => a.eventoId === ev.id && a.integranteId === i.id);
        if (reg?.estado === 'Presente') ponderado += 1;
        else if (reg?.estado === 'Justificado') ponderado += 0.5;
      });
    });

    return {
      listasCerradas: cerradas.length,
      porcentaje: citados > 0 ? Math.round((ponderado / citados) * 100) : null
    };
  }, [eventos, asistencias, activos, ahora]);

  const accesos = [
    { id: 'agenda', label: 'Agenda', icon: Calendar, descripcion: 'Calendario de actividades' },
    { id: 'asistencia', label: 'Asistencia', icon: CheckSquare, descripcion: 'Paso de lista' },
    { id: 'libros', label: 'Libros', icon: BookOpen, descripcion: 'Miembros, cartas, actas' },
    { id: 'dashboard', label: 'Métricas', icon: LayoutDashboard, descripcion: 'Indicadores y reportes' }
  ];

  const totalPendientes =
    justificacionesPendientes.length + listasSinFinalizar.length + cumpleanosProximos.length;

  return (
    <div className="space-y-4 max-w-3xl lg:max-w-6xl mx-auto pb-20">
      {/* Próxima actividad */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Inicio</h2>

        {proximaActividad ? (
          <div className="rounded-2xl p-4 bg-gradient-to-r from-[#0099DD] to-[#0077B6] text-white">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-100">
              Próxima actividad
            </span>
            <p className="text-lg font-bold leading-tight mt-1">{proximaActividad.titulo}</p>
            <div className="flex items-center justify-between mt-2 gap-2">
              <span className="text-xs text-sky-50 flex items-center gap-1.5 min-w-0">
                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {fmtFechaHora(proximaActividad.fechaHoraInicio)}
                  {proximaActividad.lugarNombre ? ` · ${proximaActividad.lugarNombre}` : ''}
                </span>
              </span>
              <button
                onClick={() => onIniciarAsistencia(proximaActividad.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-[11px] font-bold shrink-0 transition-colors"
              >
                Pasar lista
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-6 border border-dashed border-slate-200 text-center">
            <CalendarClock className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No hay actividades próximas agendadas.</p>
          </div>
        )}
        {puede('ver_agenda') && (
          // Los dos accesos viven siempre en una sola fila, también en móvil:
          // cada uno ocupa la mitad del ancho y comparten la misma altura.
          <div className="grid grid-cols-2 items-stretch gap-2.5">
            <button
              onClick={() => onAbrirAgendaFiltrada('Presentación')}
              className="group flex h-full min-h-[92px] flex-col justify-between rounded-2xl bg-gradient-to-br from-[#C52537] to-[#8B1E2B] p-3 text-left text-white shadow-lg shadow-rose-900/25 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Mic className="w-4 h-4 text-white" />
                </span>
                <ChevronRight className="w-4 h-4 text-white/75 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-2 block">
                <span className="block text-[13px] font-black leading-tight">Presentaciones</span>
                <span className="mt-0.5 block text-[10px] leading-tight text-white/80">
                  Ver en calendario
                </span>
              </span>
            </button>

            <button
              onClick={() => onAbrirAgendaFiltrada('Concierto')}
              className="group flex h-full min-h-[92px] flex-col justify-between rounded-2xl bg-gradient-to-br from-[#C88A12] to-[#9A6700] p-3 text-left text-white shadow-lg shadow-amber-900/25 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Music className="w-4 h-4 text-white" />
                </span>
                <ChevronRight className="w-4 h-4 text-white/75 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-2 block">
                <span className="block text-[13px] font-black leading-tight">Conciertos</span>
                <span className="mt-0.5 block text-[10px] leading-tight text-white/80">
                  Ver en calendario
                </span>
              </span>
            </button>
          </div>
        )}

        {/* Acceso directo: abre Agenda con el modal "Enviar calendario" listo.
            Reutiliza el mismo modal y el mismo generador de texto de Agenda. */}
        {puede('crear_evento') && (
          <button
            onClick={onEnviarCalendario}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] p-3 text-left text-white shadow-lg shadow-emerald-900/25 transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Send className="w-4 h-4 text-white" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-black leading-tight">Enviar calendario</span>
                <span className="mt-0.5 block text-[10px] leading-tight text-white/85">
                  Comparte las actividades por WhatsApp
                </span>
              </span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-white/80 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>

      {/* Resumen: solo se muestran las cifras que el rol puede conocer */}
      <div className="grid grid-cols-3 gap-2">
        {puede('ver_miembros') && (
          <button
            onClick={() => setVistaActual('directorio')}
            className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center hover:border-sky-300 hover:bg-sky-50/30 transition-colors"
            title="Ver miembros activos"
          >
            <Users className="w-4 h-4 text-[#0099DD] mx-auto mb-1" />
            <span className="text-base font-black text-slate-800 block">{activos.length}</span>
            <span className="text-[10px] text-slate-500 font-semibold">Miembros activos</span>
          </button>
        )}
        {puede('ver_documentos') && (
          <button
            onClick={() => setVistaActual('documentos')}
            className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center hover:border-sky-300 hover:bg-sky-50/30 transition-colors"
            title="Ver documentos institucionales"
          >
            <FileText className="w-4 h-4 text-slate-500 mx-auto mb-1" />
            <span className="text-base font-black text-slate-800 block">{documentos.length}</span>
            <span className="text-[10px] text-slate-500 font-semibold">Documentos</span>
          </button>
        )}
        {puede('pasar_lista') && (
          <button
            onClick={() => setVistaActual('dashboard')}
            className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center hover:border-sky-300 hover:bg-sky-50/30 transition-colors"
            title="Ver métricas de asistencia"
          >
            <CalendarClock className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
            <span className="text-base font-black text-slate-800 block">
              {resumenMes.porcentaje === null ? '—' : `${resumenMes.porcentaje}%`}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">Asistencia del mes</span>
          </button>
        )}
      </div>

      {/* Accesos directos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {accesos.map(a => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => setVistaActual(a.id)}
              className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs hover:border-sky-300 transition-colors text-left"
            >
              <Icon className="w-4 h-4 text-[#0099DD] mb-2" />
              <span className="text-xs font-bold text-slate-800 block">{a.label}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{a.descripcion}</span>
            </button>
          );
        })}
      </div>

      {/* Pendientes */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Pendientes</h3>
          {totalPendientes > 0 && (
            <span className="text-[10px] font-bold text-[#8B1E2B] bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
              {totalPendientes}
            </span>
          )}
        </div>

        {totalPendientes === 0 && (
          <p className="text-xs text-slate-400 py-2">Sin pendientes por resolver.</p>
        )}

        {/* Justificaciones por resolver */}
        {justificacionesPendientes.length > 0 && (
          <button
            onClick={() => setVistaActual('asistencia')}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/40 hover:border-amber-300 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-amber-700 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block">
                  {justificacionesPendientes.length}{' '}
                  {justificacionesPendientes.length === 1 ? 'justificación' : 'justificaciones'} por resolver
                </span>
                <span className="text-[10px] text-slate-500">Revisar y aprobar desde el paso de lista</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </button>
        )}

        {/* Listas sin finalizar */}
        {listasSinFinalizar.length > 0 && (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-2 px-3 pt-3">
              <ListChecks className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-800">
                {listasSinFinalizar.length}{' '}
                {listasSinFinalizar.length === 1 ? 'lista sin finalizar' : 'listas sin finalizar'}
              </span>
            </div>
            <div className="p-2 space-y-1">
              {listasSinFinalizar.slice(0, 4).map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onIniciarAsistencia(ev.id)}
                  className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-slate-700 block truncate">{ev.titulo}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {fmtFechaHora(ev.fechaHoraInicio)}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cumpleaños próximos */}
        {cumpleanosProximos.length > 0 && (
          <div className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Cake className="w-4 h-4 text-[#0099DD]" />
              <span className="text-xs font-bold text-slate-800">Cumpleaños próximos</span>
            </div>
            <div className="space-y-1">
              {cumpleanosProximos.slice(0, 4).map(({ integrante, dias, fecha }) => (
                <div key={integrante.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-700 truncate">{integrante.nombreCompleto}</span>
                  <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                    {fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })} ·{' '}
                    {dias === 0 ? 'hoy' : `en ${dias} d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerta de asistencia del mes */}
        {resumenMes.listasCerradas === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 text-slate-500">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-[11px]">
              Aún no hay listas finalizadas este mes, por eso la asistencia se muestra como &quot;—&quot;.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
