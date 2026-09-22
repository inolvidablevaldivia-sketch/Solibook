'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import type { EstadoJustificacion } from '@/types';
import { CheckCircle, FileText, Filter, Search, XCircle } from 'lucide-react';

const fmtFecha = (iso?: string) => {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const VistaJustificaciones: React.FC = () => {
  const { justificaciones, integrantes, eventos, resolverJustificacion } = useApp();
  const { puede } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'Todas' | EstadoJustificacion>('Todas');
  const [filtroEvento, setFiltroEvento] = useState('');
  const [filtroFicha, setFiltroFicha] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const puedeVer = puede('ver_justificaciones');
  const puedeResolver = puede('resolver_justificaciones');

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const inicio = desde ? Date.parse(`${desde}T00:00:00`) : undefined;
    const fin = hasta ? Date.parse(`${hasta}T23:59:59`) : undefined;
    return justificaciones
      .filter(j => {
        if (filtroEstado !== 'Todas' && j.estado !== filtroEstado) return false;
        if (filtroEvento && j.eventoId !== filtroEvento) return false;
        if (filtroFicha && j.integranteId !== filtroFicha) return false;
        const fecha = Date.parse(j.fechaIngreso);
        if (inicio && Number.isFinite(fecha) && fecha < inicio) return false;
        if (fin && Number.isFinite(fecha) && fecha > fin) return false;
        if (!q) return true;
        const integrante = integrantes.find(i => i.id === j.integranteId)?.nombreCompleto || '';
        const evento = eventos.find(e => e.id === j.eventoId)?.titulo || '';
        return (
          j.motivo.toLowerCase().includes(q) ||
          integrante.toLowerCase().includes(q) ||
          evento.toLowerCase().includes(q) ||
          (j.creadoPorNombre || '').toLowerCase().includes(q) ||
          (j.resueltaPorNombre || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.estado === 'Pendiente' && b.estado !== 'Pendiente') return -1;
        if (a.estado !== 'Pendiente' && b.estado === 'Pendiente') return 1;
        return (Date.parse(b.fechaIngreso) || 0) - (Date.parse(a.fechaIngreso) || 0);
      });
  }, [justificaciones, integrantes, eventos, busqueda, filtroEstado, filtroEvento, filtroFicha, desde, hasta]);

  if (!puedeVer) {
    return (
      <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
        <FileText className="w-6 h-6 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-900">Sección restringida</p>
        <p className="text-xs text-slate-500 mt-1.5">Tu cargo no incluye el padrón de justificaciones.</p>
      </div>
    );
  }

  const pendientes = filas.filter(j => j.estado === 'Pendiente');
  const historial = filas.filter(j => j.estado !== 'Pendiente');

  const Tabla = ({ items, titulo }: { items: typeof filas; titulo: string }) => (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">{titulo}</h3>
        <p className="text-[11px] text-slate-400">{items.length} registro{items.length === 1 ? '' : 's'}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 p-6 text-center">No hay justificaciones en este grupo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold">
              <tr className="border-b border-slate-200">
                <th className="p-3">Integrante</th>
                <th className="p-3">Actividad</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Adjunto</th>
                <th className="p-3">Quién la envió</th>
                <th className="p-3">Quién la resolvió</th>
                <th className="p-3">Estado</th>
                {puedeResolver && <th className="p-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(j => {
                const integrante = integrantes.find(i => i.id === j.integranteId);
                const evento = eventos.find(e => e.id === j.eventoId);
                return (
                  <tr key={j.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-slate-800">{integrante?.nombreCompleto || j.integranteId}</td>
                    <td className="p-3 text-slate-600">
                      <span className="block font-semibold text-slate-800">{evento?.titulo || 'Actividad'}</span>
                      <span className="text-[10px] text-slate-400">{evento ? fmtFecha(evento.fechaHoraInicio) : ''}</span>
                    </td>
                    <td className="p-3 text-slate-600 max-w-[220px]"><span className="line-clamp-3">{j.motivo}</span></td>
                    <td className="p-3">
                      {j.adjuntoUrl ? (
                        <a href={j.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-[#0077B6] hover:underline">
                          Ver adjunto
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">
                      {j.creadoPorNombre || 'Integrante'}
                      <span className="block text-[10px] text-slate-400">{fmtFecha(j.fechaIngreso)}</span>
                    </td>
                    <td className="p-3 text-slate-600">
                      {j.resueltaPorNombre || '—'}
                      <span className="block text-[10px] text-slate-400">{j.fechaResolucion ? fmtFecha(j.fechaResolucion) : ''}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                        j.estado === 'Pendiente'
                          ? 'bg-amber-50 text-amber-800 border-amber-100'
                          : j.estado === 'Aprobado'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                            : 'bg-rose-50 text-rose-800 border-rose-100'
                      }`}>
                        {j.estado}
                      </span>
                    </td>
                    {puedeResolver && (
                      <td className="p-3 text-right">
                        {j.estado === 'Pendiente' ? (
                          <span className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => resolverJustificacion(j.id, 'Aprobado')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Aprobar
                            </button>
                            <button
                              type="button"
                              onClick={() => resolverJustificacion(j.id, 'Rechazado')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
                            >
                              <XCircle className="w-3 h-3" />
                              Rechazar
                            </button>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3 max-w-6xl mx-auto pb-16">
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600" />
            Padrón de justificaciones
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Pendientes primero, después el historial. Aprobar deja la asistencia en Justificado; rechazar, en Ausente.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar motivo, ficha o quien envió…"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
            />
          </div>
          <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)} className="px-3 py-2 bg-slate-50 text-xs border border-slate-200 rounded-xl">
            <option value="">Todas las actividades</option>
            {[...eventos].sort((a, b) => a.titulo.localeCompare(b.titulo)).map(e => (
              <option key={e.id} value={e.id}>{e.titulo}</option>
            ))}
          </select>
          <select value={filtroFicha} onChange={e => setFiltroFicha(e.target.value)} className="px-3 py-2 bg-slate-50 text-xs border border-slate-200 rounded-xl">
            <option value="">Todas las fichas</option>
            {[...integrantes].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)).map(i => (
              <option key={i.id} value={i.id}>{i.nombreCompleto}</option>
            ))}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)} className="px-3 py-2 bg-slate-50 text-xs border border-slate-200 rounded-xl">
            <option value="Todas">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Aprobado">Aprobado</option>
            <option value="Rechazado">Rechazado</option>
          </select>
          <label className="flex items-center gap-2 text-[11px] text-slate-500 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            Desde
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="bg-transparent text-xs flex-1 focus:outline-none" />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-500 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            Hasta
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="bg-transparent text-xs flex-1 focus:outline-none" />
          </label>
        </div>
        <p className="flex items-center gap-1 text-[10px] text-slate-400">
          <Filter className="w-3 h-3" />
          {filas.length} coincidencia{filas.length === 1 ? '' : 's'}
        </p>
      </div>

      <Tabla items={pendientes} titulo="Pendientes" />
      <Tabla items={historial} titulo="Historial" />
    </div>
  );
};
