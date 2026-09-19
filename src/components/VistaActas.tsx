'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Acta } from '@/types';
import {
  FileText,
  Plus,
  Lock,
  Unlock,
  Copy,
  Printer,
  History,
  CheckCircle2,
  AlertTriangle,
  X,
  Check,
  ShieldCheck
} from 'lucide-react';
import jsPDF from 'jspdf';

export const VistaActas: React.FC = () => {
  const {
    actas,
    agregarActa,
    solicitarEdicionActa,
    aprobarEdicionActa,
    guardarEdicionActa,
    deshacerEdicionActa,
    usuarioActivo
  } = useApp();
  const { puede } = useAuth();

  const [modalNueva, setModalNueva] = useState(false);
  const [modalEdicion, setModalEdicion] = useState<Acta | null>(null);
  const [copiadoToast, setCopiadoToast] = useState(false);

  // Formulario Nueva Acta
  const [titulo, setTitulo] = useState(`Acta N° 0${actas.length + 1} — Reunión Ministerial`);
  const [fechaReunion, setFechaReunion] = useState(new Date().toISOString().split('T')[0]);
  const [temasTratados, setTemasTratados] = useState('');
  const [acuerdos, setAcuerdos] = useState('');

  // Formulario Edición
  const [editTemas, setEditTemas] = useState('');
  const [editAcuerdos, setEditAcuerdos] = useState('');

  const copiarAcuerdos = (acta: Acta) => {
    const texto = `*MINISTERIO VOCAL SOLÍ DEO*\n*${acta.titulo.toUpperCase()}*\nFecha: ${acta.fechaReunion}\n━━━━━━━━━━━━━━━━━━\n*ACUERDOS ADOPTADOS:*\n${acta.acuerdos}\n━━━━━━━━━━━━━━━━━━\n_Secretaría General Solí Deo_`;
    navigator.clipboard.writeText(texto);
    setCopiadoToast(true);
    setTimeout(() => setCopiadoToast(false), 2500);
  };

  const handleCrearActa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !acuerdos) return;

    agregarActa({
      titulo,
      fechaReunion,
      temasTratados,
      acuerdos,
      estado: 'Cerrada', // Cierre formal directo
      version: 1,
      aprobadoPresidente: true,
      aprobadoSecretaria: true
    });

    setModalNueva(false);
    setTemasTratados('');
    setAcuerdos('');
  };

  const abrirEdicion = (acta: Acta) => {
    setModalEdicion(acta);
    setEditTemas(acta.temasTratados);
    setEditAcuerdos(acta.acuerdos);
  };

  const handleGuardarCambios = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalEdicion) {
      guardarEdicionActa(modalEdicion.id, editTemas, editAcuerdos);
      setModalEdicion(null);
    }
  };

  const imprimirActaPdf = (acta: Acta) => {
    const doc = new jsPDF();

    // Membrete
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 153, 221);
    doc.text('SOLI', 20, 25);

    doc.setFont('times', 'italic');
    doc.setFontSize(20);
    doc.setTextColor(139, 30, 43);
    doc.text('Deo', 36, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('LIBRO OFICIAL DE ACTAS DE REUNIÓN', 20, 31);
    doc.line(20, 34, 190, 34);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(acta.titulo, 20, 45);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Fecha de Celebración: ${acta.fechaReunion}`, 20, 52);
    doc.text(`Versión: v${acta.version} (Cierre Formal Verificado)`, 130, 52);

    // Temas Tratados
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 119, 182);
    doc.text('I. TEMAS TRATADOS', 20, 65);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    const splitTemas = doc.splitTextToSize(acta.temasTratados || 'Sin temas descriptivos.', 170);
    doc.text(splitTemas, 20, 73);

    const alturaY = 75 + (splitTemas.length * 5);

    // Acuerdos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(139, 30, 43);
    doc.text('II. ACUERDOS Y RESOLUCIONES', 20, alturaY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    const splitAcuerdos = doc.splitTextToSize(acta.acuerdos, 170);
    doc.text(splitAcuerdos, 20, alturaY + 13);

    // Firmas al pie
    doc.line(30, 240, 80, 240);
    doc.text('Secretaría de Actas', 37, 246);
    doc.setFontSize(8);
    doc.text('Firma y Timbre', 43, 250);

    doc.line(130, 240, 180, 240);
    doc.setFontSize(10);
    doc.text('Presidencia / Dirección', 133, 246);
    doc.setFontSize(8);
    doc.text('Firma y Timbre', 143, 250);

    doc.save(`${acta.titulo.replace(/\s+/g, '_')}_SoliDeo.pdf`);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* Toast Copiado */}
      {copiadoToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>¡Acuerdos del acta copiados para compartir!</span>
        </div>
      )}

      {/* Cabecera */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Libro Oficial de Actas</h2>
          <p className="text-xs text-slate-400">
            Registro de reuniones y acuerdos con protocolo de doble firma y resguardo de 30 días
          </p>
        </div>

        {puede('gestionar_actas') && (
          <button
            onClick={() => setModalNueva(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8B1E2B] hover:bg-[#721823] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Acta</span>
          </button>
        )}
      </div>

      {/* Lista de Actas */}
      <div className="space-y-3">
        {actas.map(acta => {
          const estaCerrada = acta.estado === 'Cerrada';
          const enEdicion = acta.estado === 'En_Solicitud_Edicion';

          return (
            <div
              key={acta.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${estaCerrada ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                    {estaCerrada ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{acta.titulo}</span>
                      <span className="text-[10px] font-semibold text-slate-400">v{acta.version}</span>
                      {estaCerrada && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.2 rounded-md">
                          Cerrada & Aprobada
                        </span>
                      )}
                      {enEdicion && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.2 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Esperando Doble Firma
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">Fecha: {acta.fechaReunion}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copiarAcuerdos(acta)}
                    title="Copiar acuerdos al portapapeles"
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => imprimirActaPdf(acta)}
                    title="Descargar PDF formal con firmas"
                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-2">
                {acta.temasTratados && (
                  <div>
                    <span className="font-bold text-slate-700 block text-[11px]">Temas Tratados:</span>
                    <p className="text-slate-600 whitespace-pre-wrap mt-0.5">{acta.temasTratados}</p>
                  </div>
                )}
                <div>
                  <span className="font-bold text-[#8B1E2B] block text-[11px]">Acuerdos Adoptados:</span>
                  <p className="text-slate-800 whitespace-pre-wrap mt-0.5 font-medium">{acta.acuerdos}</p>
                </div>
              </div>

              {/* Protocolo de Doble Firma (Presidente + Secretaría) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Doble Autorización:</span>
                  <span className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                    acta.aprobadoPresidente ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {acta.aprobadoPresidente ? '✓ Presidente' : '○ Presidente'}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                    acta.aprobadoSecretaria ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {acta.aprobadoSecretaria ? '✓ Secretaría' : '○ Secretaría'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Si el acta está cerrada y se quiere modificar */}
                  {estaCerrada && (
                    <button
                      onClick={() => {
                        if (confirm('El acta está cerrada bajo protocolo. ¿Deseas solicitar autorización conjunta (Presidente + Secretaria) para editarla?')) {
                          solicitarEdicionActa(acta.id);
                        }
                      }}
                      className="text-[11px] text-slate-500 hover:text-amber-700 font-semibold underline"
                    >
                      Solicitar Apertura para Editar
                    </button>
                  )}

                  {/* Si está en proceso de solicitud de edición */}
                  {enEdicion && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => aprobarEdicionActa(acta.id, 'Presidente')}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold"
                      >
                        Autorizar como Presidente
                      </button>
                      <button
                        onClick={() => aprobarEdicionActa(acta.id, 'Secretaria')}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold"
                      >
                        Autorizar como Secretaria
                      </button>
                      {acta.aprobadoPresidente && acta.aprobadoSecretaria && (
                        <button
                          onClick={() => abrirEdicion(acta)}
                          className="px-2.5 py-1 bg-[#8B1E2B] text-white rounded-lg text-xs font-bold"
                        >
                          Proceder a Editar
                        </button>
                      )}
                    </div>
                  )}

                  {/* Botón Deshacer Edición (Historial de 30 días) */}
                  {acta.backupAnterior && (
                    <button
                      onClick={() => {
                        if (confirm('¿Deseas restaurar la versión anterior guardada antes de la última modificación?')) {
                          deshacerEdicionActa(acta.id);
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] text-rose-600 font-semibold hover:underline"
                    >
                      <History className="w-3.5 h-3.5" />
                      Deshacer última edición (Backup)
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nueva Acta */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCrearActa} className="p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Redactar Nueva Acta</h3>
                <button type="button" onClick={() => setModalNueva(false)} className="p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Título del Acta *</label>
                  <input
                    type="text"
                    required
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#8B1E2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={fechaReunion}
                    onChange={e => setFechaReunion(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temas Tratados</label>
                <textarea
                  rows={3}
                  placeholder="1. Evaluación del coro... 2. Nuevas presentaciones..."
                  value={temasTratados}
                  onChange={e => setTemasTratados(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Acuerdos Adoptados *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="• Se acuerda iniciar ensayos a las 19:30 puntual..."
                  value={acuerdos}
                  onChange={e => setAcuerdos(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#8B1E2B]"
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
                  Aprobar y Cerrar Acta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Acta con Autorización */}
      {modalEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleGuardarCambios} className="p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Editar {modalEdicion.titulo}</h3>
                  <p className="text-[11px] text-amber-700">Edición autorizada conjuntamente</p>
                </div>
                <button type="button" onClick={() => setModalEdicion(null)} className="p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temas Tratados</label>
                <textarea
                  rows={3}
                  value={editTemas}
                  onChange={e => setEditTemas(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Acuerdos Adoptados</label>
                <textarea
                  rows={4}
                  value={editAcuerdos}
                  onChange={e => setEditAcuerdos(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#8B1E2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEdicion(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#8B1E2B] hover:bg-[#721823] text-white rounded-xl shadow-xs"
                >
                  Guardar Nueva Versión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
