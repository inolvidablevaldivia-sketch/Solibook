'use client';

import React, { useMemo, useState } from 'react';
import { CalendarRange, Check, Copy, MessageCircle, Send, X } from 'lucide-react';
import { Evento } from '@/types';
import {
  fechaISODeHoy,
  filtrarEventosParaCompartir,
  formatearCalendarioParaWhatsApp
} from '@/lib/compartirAgenda';

interface ModalEnviarCalendarioProps {
  eventos: Evento[];
  tiposEventos: string[];
  onCerrar: () => void;
}

const fechaFinInicial = (): string => {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() + 3);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

export const ModalEnviarCalendario: React.FC<ModalEnviarCalendarioProps> = ({
  eventos,
  tiposEventos,
  onCerrar
}) => {
  const [desde, setDesde] = useState(fechaISODeHoy);
  const [hasta, setHasta] = useState(fechaFinInicial);
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(tiposEventos);
  const [mensaje, setMensaje] = useState('');

  const eventosSeleccionados = useMemo(
    () => filtrarEventosParaCompartir(eventos, desde, hasta, tiposSeleccionados),
    [eventos, desde, hasta, tiposSeleccionados]
  );

  const texto = useMemo(
    () => formatearCalendarioParaWhatsApp(eventosSeleccionados, desde, hasta, tiposSeleccionados),
    [eventosSeleccionados, desde, hasta, tiposSeleccionados]
  );


  const rangoInvalido = new Date(`${hasta}T23:59:59`) < new Date(`${desde}T00:00:00`);
  const sinEventos = eventosSeleccionados.length === 0 || rangoInvalido;

  const alternarTipo = (tipo: string) => {
    setTiposSeleccionados(actuales =>
      actuales.includes(tipo) ? actuales.filter(item => item !== tipo) : [...actuales, tipo]
    );
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setMensaje('Calendario copiado. Ya puedes pegarlo en WhatsApp Web o donde necesites.');
    } catch {
      setMensaje('No fue posible copiar automáticamente. Selecciona el texto de la vista previa.');
    }
  };

  const compartir = async () => {
    if (sinEventos) return;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Calendario Solí Deo', text: texto });
        setMensaje('Elige WhatsApp en el menú para enviar el calendario.');
        return;
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return;
      }
    }

    // En navegadores sin Web Share se abre WhatsApp con el texto precargado.
    // Para mensajes muy extensos se prefiere copiar, porque WhatsApp puede
    // recortar enlaces de gran tamaño.
    if (texto.length > 5000) {
      await copiar();
      setMensaje('El calendario es extenso; se copió completo para evitar recortes de WhatsApp.');
      return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
    setMensaje('WhatsApp se abrió con el calendario preparado para enviar.');
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <CalendarRange className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Enviar calendario</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Elige el período y los tipos de actividades que deseas compartir.
                </p>
              </div>
            </div>
            <button onClick={onCerrar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={event => setDesde(event.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hasta</label>
              <input
                type="date"
                value={hasta}
                min={desde}
                onChange={event => setHasta(event.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-semibold text-slate-700">Tipos de actividad</label>
              <button
                type="button"
                onClick={() => setTiposSeleccionados(tiposSeleccionados.length === tiposEventos.length ? [] : tiposEventos)}
                className="text-[11px] font-bold text-[#0077B6] hover:underline"
              >
                {tiposSeleccionados.length === tiposEventos.length ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tiposEventos.map(tipo => {
                const seleccionado = tiposSeleccionados.includes(tipo);
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => alternarTipo(tipo)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                      seleccionado
                        ? 'bg-sky-50 border-sky-300 text-[#0077B6]'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {seleccionado && <Check className="w-3.5 h-3.5" />}
                    {tipo}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800">Vista previa</span>
              <span className={`text-[11px] font-bold ${sinEventos ? 'text-amber-700' : 'text-emerald-700'}`}>
                {rangoInvalido
                  ? 'El rango de fechas no es válido'
                  : `${eventosSeleccionados.length} ${eventosSeleccionados.length === 1 ? 'actividad' : 'actividades'}`}
              </span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 p-3 max-h-[17rem] overflow-y-auto bg-white">
              {rangoInvalido ? 'La fecha final debe ser igual o posterior a la fecha inicial.' : texto}
            </pre>
          </div>

          {mensaje && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {mensaje}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={copiar}
              disabled={rangoInvalido}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar texto
            </button>
            <button
              type="button"
              onClick={compartir}
              disabled={sinEventos}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              Compartir por WhatsApp
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
