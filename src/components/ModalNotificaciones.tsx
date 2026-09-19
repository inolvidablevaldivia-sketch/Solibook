'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Bell,
  X,
  FileText,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  PlusCircle,
  Clock
} from 'lucide-react';

interface ModalNotificacionesProps {
  isOpen: boolean;
  onClose: () => void;
  onIrAEvento?: (eventoId: string) => void;
}

export const ModalNotificaciones: React.FC<ModalNotificacionesProps> = ({ isOpen, onClose, onIrAEvento }) => {
  const {
    notificaciones,
    marcarNotificacionLeida,
    justificaciones,
    resolverJustificacion,
    cartas,
    marcarCartaLeida,
    usuarioActivo
  } = useApp();

  const [filtro, setFiltro] = useState<'Todos' | 'Justificaciones' | 'Cartas' | 'Actas'>('Todos');

  if (!isOpen) return null;

  const notificacionesFiltradas = notificaciones.filter(n => {
    if (filtro === 'Todos') return true;
    if (filtro === 'Justificaciones') return n.tipo === 'Justificacion';
    if (filtro === 'Cartas') return n.tipo === 'Carta';
    if (filtro === 'Actas') return n.tipo === 'Acta';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 text-[#0099DD]">
              <Bell className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Centro de Avisos y Acuse</h3>
              <p className="text-xs text-slate-500">Justificaciones, cartas recibidas y actas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros Tipo Píldora */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-100 bg-white overflow-x-auto text-xs">
          {(['Todos', 'Justificaciones', 'Cartas', 'Actas'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1 rounded-full font-medium transition-all ${
                filtro === f
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Lista de Contenido */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {/* Sección Dinámica: Justificaciones Pendientes */}
          {(filtro === 'Todos' || filtro === 'Justificaciones') && justificaciones.filter(j => j.estado === 'Pendiente').length > 0 && (
            <div className="pb-3">
              <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Justificaciones por Resolver
              </h4>
              <div className="space-y-2">
                {justificaciones.filter(j => j.estado === 'Pendiente').map(j => (
                  <div key={j.id} className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-slate-800">Justificativo de Inasistencia</span>
                        <p className="text-xs text-slate-600 mt-0.5">"{j.motivo}"</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-200/60 text-amber-900">
                        Pendiente
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-amber-200/40 text-[11px]">
                      <span className="text-slate-500">
                        Visto por: {j.vistoPor.length > 0 ? j.vistoPor.join(', ') : 'Nadie aún'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => resolverJustificacion(j.id, 'Aprobado')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Aprobar
                        </button>
                        <button
                          onClick={() => resolverJustificacion(j.id, 'Rechazado')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sección Dinámica: Cartas Recibidas Pendientes */}
          {(filtro === 'Todos' || filtro === 'Cartas') && cartas.filter(c => c.estado === 'Pendiente').length > 0 && (
            <div className="pt-3 pb-3">
              <h4 className="text-[11px] font-bold text-sky-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Correspondencia Recibida (Acuse de Recibo)
              </h4>
              <div className="space-y-2">
                {cartas.filter(c => c.estado === 'Pendiente').map(c => {
                  const yaVisto = c.vistoPor.includes(usuarioActivo.iniciales);
                  return (
                    <div key={c.id} className="p-3 bg-sky-50/50 border border-sky-200/70 rounded-xl space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800">{c.asunto}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">De: {c.remitenteDestinatario} ({c.folio})</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-sky-100 text-sky-800">
                          {c.fechaDocumento}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{c.descripcion}</p>

                      <div className="flex items-center justify-between pt-1 border-t border-sky-200/40 text-[11px]">
                        <span className="text-slate-500 text-[10px]">
                          Visto por: {c.vistoPor.length > 0 ? c.vistoPor.join(', ') : 'Sin lecturas'}
                        </span>
                        <div className="flex items-center gap-1">
                          {!yaVisto && (
                            <button
                              onClick={() => marcarCartaLeida(c.id, usuarioActivo.iniciales)}
                              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium transition-colors"
                            >
                              <Eye className="w-3 h-3 text-[#0099DD]" />
                              Dar Acuse (Leído)
                            </button>
                          )}
                          {onIrAEvento && (
                            <button
                              onClick={() => {
                                onClose();
                                onIrAEvento('crear');
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-[#0099DD] hover:bg-[#0088cc] text-white rounded-lg font-medium transition-colors"
                            >
                              <PlusCircle className="w-3 h-3" />
                              Crear Evento
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historial de Avisos y Notificaciones */}
          <div className="pt-3 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Historial de Notificaciones
            </h4>
            {notificacionesFiltradas.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">No hay avisos en esta categoría</p>
            ) : (
              notificacionesFiltradas.map(n => (
                <div
                  key={n.id}
                  onClick={() => marcarNotificacionLeida(n.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    n.leido
                      ? 'bg-slate-50/60 border-slate-200/60 opacity-70'
                      : 'bg-white border-sky-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                      {n.tipo === 'Justificacion' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                      {n.tipo === 'Carta' && <Mail className="w-3.5 h-3.5 text-[#0099DD]" />}
                      {n.tipo === 'Acta' && <FileText className="w-3.5 h-3.5 text-[#8B1E2B]" />}
                      {n.tipo === 'Calendario' && <Calendar className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">{n.titulo}</span>
                        <span className="text-[10px] text-slate-400">{n.fecha}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{n.mensaje}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
