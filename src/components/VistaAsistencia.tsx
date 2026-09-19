'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { EstadoAsistencia, Integrante } from '@/types';
import {
  Check,
  X,
  FileText,
  Search,
  CheckCheck,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Save,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';

interface VistaAsistenciaProps {
  eventoIdInicial?: string;
  onVolver?: () => void;
}

export const VistaAsistencia: React.FC<VistaAsistenciaProps> = ({ eventoIdInicial, onVolver }) => {
  const {
    eventos,
    integrantes,
    asistencias,
    marcarAsistencia,
    marcarTodosPresentes,
    cerrarAsistenciaEvento
  } = useApp();

  // Seleccionar el evento activo o el primero disponible
  const [eventoId, setEventoId] = useState<string>(eventoIdInicial || eventos[0]?.id || '');
  const [busqueda, setBusqueda] = useState('');
  const [justificandoId, setJustificandoId] = useState<string | null>(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [toastGuardado, setToastGuardado] = useState(false);

  const eventoActual = eventos.find(e => e.id === eventoId);

  // Filtrar integrantes convocados y activos
  const integrantesConvocados = useMemo(() => {
    // Solo miembros activos (los inactivos se ocultan de la lista de campo)
    const activos = integrantes.filter(i => i.estado === 'Activo');

    if (!eventoActual) return activos;

    if (eventoActual.tipoConvocatoria === 'Por Cuerda' && eventoActual.cuerdasConvocadas) {
      return activos.filter(i => eventoActual.cuerdasConvocadas!.includes(i.cuerda));
    }

    if (eventoActual.tipoConvocatoria === 'Personalizada' && eventoActual.integrantesConvocadosIds) {
      return activos.filter(i => eventoActual.integrantesConvocadosIds!.includes(i.id));
    }

    return activos; // Por defecto 'Todos'
  }, [integrantes, eventoActual]);

  const integrantesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return integrantesConvocados;
    const q = busqueda.toLowerCase();
    return integrantesConvocados.filter(i =>
      i.nombreCompleto.toLowerCase().includes(q) ||
      i.iglesia.toLowerCase().includes(q) ||
      i.cuerda.toLowerCase().includes(q)
    );
  }, [integrantesConvocados, busqueda]);

  // Mapa de asistencias del evento actual
  const asistenciasMap = useMemo(() => {
    const map = new Map<string, { estado: EstadoAsistencia; motivo?: string }>();
    asistencias
      .filter(a => a.eventoId === eventoId)
      .forEach(a => map.set(a.integranteId, { estado: a.estado, motivo: a.motivoJustificacion }));
    return map;
  }, [asistencias, eventoId]);

  // Contadores
  const totalConvocados = integrantesConvocados.length;
  let conteoPresentes = 0;
  let conteoAusentes = 0;
  let conteoJustificados = 0;

  integrantesConvocados.forEach(i => {
    const st = asistenciasMap.get(i.id)?.estado;
    if (st === 'Presente') conteoPresentes++;
    else if (st === 'Ausente') conteoAusentes++;
    else if (st === 'Justificado') conteoJustificados++;
  });

  const totalMarcados = conteoPresentes + conteoAusentes + conteoJustificados;

  const handleMarcar = (integranteId: string, estado: EstadoAsistencia) => {
    if (estado === 'Justificado') {
      setJustificandoId(integranteId);
      setMotivoTexto(asistenciasMap.get(integranteId)?.motivo || '');
      return;
    }
    marcarAsistencia(eventoId, integranteId, estado);
    mostrarAutoGuardado();
  };

  const guardarJustificacion = () => {
    if (justificandoId) {
      marcarAsistencia(eventoId, justificandoId, 'Justificado', motivoTexto || 'Justificación registrada en lista');
      setJustificandoId(null);
      setMotivoTexto('');
      mostrarAutoGuardado();
    }
  };

  const handleTodosPresentes = () => {
    marcarTodosPresentes(eventoId, integrantesConvocados.map(i => i.id));
    mostrarAutoGuardado();
  };

  const mostrarAutoGuardado = () => {
    setToastGuardado(true);
    setTimeout(() => setToastGuardado(false), 2000);
  };

  const handleFinalizar = () => {
    if (confirm('¿Deseas dar por cerrada la asistencia de esta actividad? Quedará registrada formalmente.')) {
      cerrarAsistenciaEvento(eventoId);
      alert('¡Lista de asistencia cerrada con éxito!');
    }
  };

  const handleVolverConSeguro = () => {
    if (totalMarcados > 0 && !eventoActual?.asistenciaFinalizada) {
      if (confirm('Tienes una lista en progreso. Tu avance está auto-guardado como borrador. ¿Deseas volver a la agenda?')) {
        if (onVolver) onVolver();
      }
    } else {
      if (onVolver) onVolver();
    }
  };

  return (
    <div className="space-y-3 max-w-3xl mx-auto pb-16">
      {/* Toast Sutil de Auto-Guardado en Tiempo Real */}
      <div className={`fixed bottom-20 right-4 z-40 bg-slate-900/90 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transition-all duration-300 ${
        toastGuardado ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}>
        <Save className="w-3.5 h-3.5 text-emerald-400" />
        <span>Guardado local inmediato</span>
      </div>

      {/* Cabecera del Evento Activo */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onVolver && (
              <button
                onClick={handleVolverConSeguro}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Volver"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0099DD] bg-sky-50 px-2 py-0.5 rounded-md">
                Paso de Lista en Vivo
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                {eventoActual ? eventoActual.titulo : 'Seleccionar Actividad'}
              </h2>
            </div>
          </div>

          {/* Selector de Evento si hay varios */}
          <select
            value={eventoId}
            onChange={e => setEventoId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl font-medium focus:outline-none max-w-[160px] truncate"
          >
            {eventos.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.titulo} ({new Date(ev.fechaHoraInicio).toLocaleDateString('es-CL')})
              </option>
            ))}
          </select>
        </div>

        {/* Resumen de Métricas Táctiles */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Citados</span>
            <span className="text-base font-black text-slate-800">{totalConvocados}</span>
          </div>
          <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
            <span className="text-[10px] text-emerald-700 font-bold block uppercase">Presentes</span>
            <span className="text-base font-black text-emerald-800">{conteoPresentes}</span>
          </div>
          <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100">
            <span className="text-[10px] text-amber-700 font-bold block uppercase">Justif.</span>
            <span className="text-base font-black text-amber-800">{conteoJustificados}</span>
          </div>
          <div className="bg-rose-50/70 p-2 rounded-xl border border-rose-100">
            <span className="text-[10px] text-rose-700 font-bold block uppercase">Ausentes</span>
            <span className="text-base font-black text-rose-800">{conteoAusentes}</span>
          </div>
        </div>

        {/* Barra de Acciones Rápidas */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={handleTodosPresentes}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar Todos Presentes (15s)
          </button>

          <button
            onClick={handleFinalizar}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-[#8B1E2B] hover:bg-[#721823] text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Finalizar Lista
          </button>
        </div>
      </div>

      {/* Buscador predictivo rápido */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar por nombre, cuerda o iglesia..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD] shadow-xs"
        />
      </div>

      {/* Lista Táctil de Integrantes (Scroll fluido con 3 iconos circulares) */}
      <div className="space-y-2">
        {integrantesFiltrados.map((integrante, idx) => {
          const registro = asistenciasMap.get(integrante.id);
          const estado = registro?.estado;

          return (
            <div
              key={integrante.id}
              className={`bg-white rounded-2xl p-3 border transition-all flex items-center justify-between gap-3 shadow-xs ${
                estado === 'Presente'
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : estado === 'Justificado'
                  ? 'border-amber-200 bg-amber-50/20'
                  : estado === 'Ausente'
                  ? 'border-rose-200 bg-rose-50/20'
                  : 'border-slate-200/80'
              }`}
            >
              {/* Información del Integrante */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none ${
                  estado === 'Presente' ? 'bg-emerald-100 text-emerald-800' :
                  estado === 'Justificado' ? 'bg-amber-100 text-amber-800' :
                  estado === 'Ausente' ? 'bg-rose-100 text-rose-800' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {integrante.cuerda.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-800 block truncate leading-tight">
                    {integrante.nombreCompleto}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 truncate">
                    <span className="font-semibold text-slate-600">{integrante.cuerda}</span>
                    <span>•</span>
                    <span className="truncate">{integrante.iglesia}</span>
                  </div>

                  {registro?.motivo && (
                    <span className="text-[10px] text-amber-700 italic block mt-0.5 truncate">
                      ↳ {registro.motivo}
                    </span>
                  )}
                </div>
              </div>

              {/* Selector Táctil Ultracompacto: [P] [A] [J] */}
              <div className="flex items-center gap-1.5 shrink-0 select-none">
                {/* Botón PRESENTE (P) */}
                <button
                  onClick={() => handleMarcar(integrante.id, 'Presente')}
                  title="Presente"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    estado === 'Presente'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs scale-105'
                      : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </button>

                {/* Botón AUSENTE (A) */}
                <button
                  onClick={() => handleMarcar(integrante.id, 'Ausente')}
                  title="Ausente"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    estado === 'Ausente'
                      ? 'bg-rose-600 text-white font-bold shadow-xs scale-105'
                      : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700'
                  }`}
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>

                {/* Botón JUSTIFICADO (J) */}
                <button
                  onClick={() => handleMarcar(integrante.id, 'Justificado')}
                  title="Justificado"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    estado === 'Justificado'
                      ? 'bg-amber-500 text-white font-bold shadow-xs scale-105'
                      : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <FileText className="w-4 h-4 stroke-[2]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Rápido de Justificación */}
      {justificandoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Registrar Justificación</h3>
              <button onClick={() => setJustificandoId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Integrante: <strong>{integrantes.find(i => i.id === justificandoId)?.nombreCompleto}</strong>
            </p>

            <textarea
              rows={3}
              placeholder="Motivo (ej. Turno de trabajo, salud, viaje familiar)..."
              value={motivoTexto}
              onChange={e => setMotivoTexto(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setJustificandoId(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={guardarJustificacion}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
