'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Carta, EstadoCarta } from '@/types';
import {
  Mail,
  Plus,
  Search,
  Calendar,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Printer,
  CalendarPlus,
  X
} from 'lucide-react';
import jsPDF from 'jspdf';

interface VistaCartasProps {
  onCrearEventoDesdeCarta?: () => void;
}

export const VistaCartas: React.FC<VistaCartasProps> = ({ onCrearEventoDesdeCarta }) => {
  const { cartas, agregarCarta, marcarCartaLeida, actualizarEstadoCarta, usuarioActivo } = useApp();
  const { puede } = useAuth();

  const [filtroFlujo, setFiltroFlujo] = useState<'Todas' | 'Recibida' | 'Emitida'>('Todas');
  const [modalNueva, setModalNueva] = useState(false);
  const [cartaDetalle, setCartaDetalle] = useState<Carta | null>(null);

  // Formulario
  const [tipoFlujo, setTipoFlujo] = useState<'Recibida' | 'Emitida'>('Recibida');
  const [folio, setFolio] = useState(`REC-${new Date().getFullYear()}-0${cartas.length + 1}`);
  const [remitenteDestinatario, setRemitenteDestinatario] = useState('');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaDocumento, setFechaDocumento] = useState(new Date().toISOString().split('T')[0]);

  const cartasFiltradas = cartas.filter(c => {
    if (filtroFlujo === 'Todas') return true;
    return c.tipoFlujo === filtroFlujo;
  });

  const handleCrearCarta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitenteDestinatario || !asunto) return;

    agregarCarta({
      tipoFlujo,
      folio: folio || `DOC-${Date.now()}`,
      remitenteDestinatario,
      asunto,
      descripcion,
      fechaDocumento,
      estado: 'Pendiente',
      vistoPor: [usuarioActivo.iniciales]
    });

    setModalNueva(false);
    setRemitenteDestinatario('');
    setAsunto('');
    setDescripcion('');
  };

  // Generador de PDF Membretado Formal de Solí Deo
  const imprimirPdfFormal = (carta: Carta) => {
    const doc = new jsPDF();

    // Membrete
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 153, 221); // #0099DD
    doc.text('SOLI', 20, 25);

    doc.setFont('times', 'italic');
    doc.setFontSize(22);
    doc.setTextColor(139, 30, 43); // #8B1E2B
    doc.text('Deo', 37, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('MINISTERIO VOCAL — GESTIÓN ADMINISTRATIVA', 20, 31);
    doc.line(20, 34, 190, 34);

    // Datos del documento
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Folio: ${carta.folio}`, 20, 45);
    doc.text(`Fecha: ${carta.fechaDocumento}`, 140, 45);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`${carta.tipoFlujo === 'Recibida' ? 'De (Remitente):' : 'Para (Destinatario):'} ${carta.remitenteDestinatario}`, 20, 54);

    doc.setFontSize(12);
    doc.text(`Asunto: ${carta.asunto}`, 20, 64);

    // Cuerpo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);

    const splitTexto = doc.splitTextToSize(carta.descripcion, 170);
    doc.text(splitTexto, 20, 75);

    // Pie de firmas
    doc.line(30, 240, 80, 240);
    doc.text('Secretaría General', 37, 246);
    doc.setFontSize(8);
    doc.text('Ministerio Vocal Solí Deo', 35, 250);

    doc.line(130, 240, 180, 240);
    doc.setFontSize(11);
    doc.text('Dirección / Presidencia', 133, 246);
    doc.setFontSize(8);
    doc.text('Ministerio Vocal Solí Deo', 135, 250);

    doc.save(`${carta.folio}_SoliDeo.pdf`);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* Cabecera */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Libro de Correspondencia</h2>
          <p className="text-xs text-slate-400">Control de cartas recibidas, invitaciones y cartas oficiales emitidas</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros */}
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs">
            {(['Todas', 'Recibida', 'Emitida'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltroFlujo(f)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroFlujo === f ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {puede('gestionar_cartas') && (
            <button
              onClick={() => setModalNueva(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8B1E2B] hover:bg-[#721823] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Carta</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista de Cartas */}
      <div className="space-y-3">
        {cartasFiltradas.map(carta => {
          const yaLeido = carta.vistoPor.includes(usuarioActivo.iniciales);

          return (
            <div
              key={carta.id}
              onClick={() => setCartaDetalle(carta)}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-sky-300 transition-all cursor-pointer space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                    carta.tipoFlujo === 'Recibida'
                      ? 'bg-sky-50 text-[#0099DD]'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {carta.tipoFlujo === 'Recibida' ? (
                      <ArrowDownLeft className="w-5 h-5 stroke-[2]" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 stroke-[2]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">{carta.folio}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md ${
                        carta.estado === 'Aceptada' ? 'bg-emerald-100 text-emerald-800' :
                        carta.estado === 'Declinada' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {carta.estado}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5">{carta.asunto}</h3>
                  </div>
                </div>

                <span className="text-[11px] text-slate-400 font-medium">
                  {carta.fechaDocumento}
                </span>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 pl-11">
                {carta.descripcion}
              </p>

              {/* Barra de Acuse y Acciones */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 pl-11 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <span>Visto por directiva:</span>
                  <div className="flex items-center gap-1">
                    {carta.vistoPor.map((v, i) => (
                      <span key={i} className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold text-[10px]">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {!yaLeido && (
                    <button
                      onClick={() => marcarCartaLeida(carta.id, usuarioActivo.iniciales)}
                      className="flex items-center gap-1 text-[11px] text-[#0099DD] font-semibold hover:underline"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Dar Acuse (Leído)
                    </button>
                  )}
                  <button
                    onClick={() => imprimirPdfFormal(carta)}
                    title="Descargar PDF Membretado Oficial"
                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Registrar Carta */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCrearCarta} className="p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Registrar Correspondencia</h3>
                <button type="button" onClick={() => setModalNueva(false)} className="p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Flujo</label>
                  <select
                    value={tipoFlujo}
                    onChange={e => {
                      const v = e.target.value as 'Recibida' | 'Emitida';
                      setTipoFlujo(v);
                      setFolio(`${v === 'Recibida' ? 'REC' : 'EMI'}-${new Date().getFullYear()}-0${cartas.length + 1}`);
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none"
                  >
                    <option value="Recibida">Carta Recibida (Entrante)</option>
                    <option value="Emitida">Carta Emitida (Oficial)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Folio / Número</label>
                  <input
                    type="text"
                    value={folio}
                    onChange={e => setFolio(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {tipoFlujo === 'Recibida' ? 'Remitente (Quién envía) *' : 'Destinatario (A quién va dirigida) *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pastoral Juvenil, Iglesia Central..."
                  value={remitenteDestinatario}
                  onChange={e => setRemitenteDestinatario(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Asunto de la Carta *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Invitación Aniversario 2026..."
                  value={asunto}
                  onChange={e => setAsunto(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fechaDocumento}
                  onChange={e => setFechaDocumento(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contenido / Transcripción</label>
                <textarea
                  rows={4}
                  placeholder="Escribir o transcribir el texto de la carta..."
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNueva(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#8B1E2B] hover:bg-[#721823] text-white rounded-xl shadow-xs"
                >
                  Guardar en Libro de Cartas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle Carta con Botón de Crear Evento */}
      {cartaDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400">{cartaDetalle.folio}</span>
                  <h3 className="text-base font-bold text-slate-900">{cartaDetalle.asunto}</h3>
                  <p className="text-xs text-slate-500">
                    {cartaDetalle.tipoFlujo === 'Recibida' ? 'De: ' : 'Para: '} {cartaDetalle.remitenteDestinatario}
                  </p>
                </div>
                <button onClick={() => setCartaDetalle(null)} className="p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {cartaDetalle.descripcion}
              </div>

              {/* Botón Integrado: Si es una invitación, crear evento en Agenda */}
              {cartaDetalle.tipoFlujo === 'Recibida' && (
                <div className="bg-sky-50 border border-sky-100 p-3 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-[#0077B6] font-medium">
                    <CalendarPlus className="w-4 h-4 shrink-0" />
                    <span>¿Esta carta es una invitación a cantar o reunión?</span>
                  </div>
                  {onCrearEventoDesdeCarta && (
                    <button
                      onClick={() => {
                        setCartaDetalle(null);
                        onCrearEventoDesdeCarta();
                      }}
                      className="px-3 py-1 bg-[#0099DD] hover:bg-[#0088cc] text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      Crear Evento
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => imprimirPdfFormal(cartaDetalle)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  Descargar PDF Membretado
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      actualizarEstadoCarta(cartaDetalle.id, 'Aceptada');
                      setCartaDetalle(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => {
                      actualizarEstadoCarta(cartaDetalle.id, 'Declinada');
                      setCartaDetalle(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
                  >
                    Declinar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
