'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
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
  Clock
} from 'lucide-react';

interface VistaInicioProps {
  setVistaActual: (v: string) => void;
  onIniciarAsistencia: (eventoId: string) => void;
}

const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

export const VistaInicio: React.FC<VistaInicioProps> = ({ setVistaActual, onIniciarAsistencia }) => {
  const { eventos, integrantes, asistencias, justificaciones, documentos } = useApp();

  const activos = useMemo(() => integrantes.filter(i => i.estado === 'Activo'), [integrantes]);

  const ahora = new Date();

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

  // Cumpleaños de los próximos 30 días
  const cumpleanosProximos = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return activos
      .filter(i => i.fechaNacimiento)
      .map(i => {
        const [anioNac, mesNac, diaNac] = (i.fechaNacimiento as string).split('-').map(Number);
        let proximo = new Date(hoy.getFullYear(), (mesNac || 1) - 1, diaNac || 1);
        if (proximo.getTime() < hoy.getTime()) {
          proximo = new Date(hoy.getFullYear() + 1, (mesNac || 1) - 1, diaNac || 1);
        }
        const dias = Math.round((proximo.getTime() - hoy.getTime()) / 86400000);
        return { integrante: i, dias, fecha: proximo };
      })
      .filter(x => x.dias <= 30)
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
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
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
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center">
          <Users className="w-4 h-4 text-[#0099DD] mx-auto mb-1" />
          <span className="text-base font-black text-slate-800 block">{activos.length}</span>
          <span className="text-[10px] text-slate-500 font-semibold">Miembros activos</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center">
          <FileText className="w-4 h-4 text-slate-500 mx-auto mb-1" />
          <span className="text-base font-black text-slate-800 block">{documentos.length}</span>
          <span className="text-[10px] text-slate-500 font-semibold">Documentos</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 text-center">
          <CalendarClock className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
          <span className="text-base font-black text-slate-800 block">
            {resumenMes.porcentaje === null ? '—' : `${resumenMes.porcentaje}%`}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">Asistencia del mes</span>
        </div>
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
