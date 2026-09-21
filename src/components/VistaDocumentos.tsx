'use client';

import { RegistroEliminable } from './RegistroEliminable';
import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { CategoriaDocumento } from '@/types';
import { esEnlaceValido, normalizarEnlace, detectarServicio, pareceEnlacePrivado } from '@/lib/enlaces';
import {
  FileText,
  Plus,
  X,
  ExternalLink,
  AlertTriangle,
  Link2,
  Landmark,
  Receipt,
  FileSignature,
  ScrollText,
  FolderOpen
} from 'lucide-react';

const CATEGORIAS: CategoriaDocumento[] = [
  'Constitución',
  'Tributario',
  'Bancario',
  'Contrato',
  'Reglamento',
  'Otro'
];

const ICONO_CATEGORIA: Record<CategoriaDocumento, React.ElementType> = {
  'Constitución': ScrollText,
  'Tributario': Receipt,
  'Bancario': Landmark,
  'Contrato': FileSignature,
  'Reglamento': FileText,
  'Otro': FolderOpen
};

export const VistaDocumentos: React.FC = () => {
  const { documentos, agregarDocumento } = useApp();
  const { puede } = useAuth();

  const [modalNuevo, setModalNuevo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDocumento>('Constitución');
  const [descripcion, setDescripcion] = useState('');
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');

  // Documentos agrupados por categoría, respetando el orden del catálogo
  const agrupados = useMemo(() => {
    return CATEGORIAS.map(cat => ({
      categoria: cat,
      items: documentos.filter(d => d.categoria === cat)
    })).filter(g => g.items.length > 0);
  }, [documentos]);

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setError('Indica un título para el documento.');
      return;
    }
    if (!esEnlaceValido(enlace)) {
      setError('El enlace no es válido. Debe comenzar con http:// o https://');
      return;
    }
    agregarDocumento({
      titulo: titulo.trim(),
      categoria,
      descripcion: descripcion.trim() || undefined,
      enlaceUrl: normalizarEnlace(enlace),
      fechaCarga: new Date().toISOString()
    });
    setTitulo('');
    setCategoria('Constitución');
    setDescripcion('');
    setEnlace('');
    setError('');
    setModalNuevo(false);
  };


  return (
    <div className="space-y-3 max-w-3xl mx-auto pb-16">
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Documentos</h2>
          <p className="text-xs text-slate-400 truncate">
            Constitución, situación tributaria, cuentas bancarias, contratos y reglamentos
          </p>
        </div>
        {puede('gestionar_documentos') && (
          <button
            onClick={() => setModalNuevo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0099DD] hover:bg-[#0088cc] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo</span>
          </button>
        )}
      </div>

      {documentos.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <FolderOpen className="w-6 h-6 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">
            Aún no hay documentos institucionales registrados.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Se guarda únicamente el enlace de Google Drive, sin subir archivos.
          </p>
        </div>
      )}

      {agrupados.map(grupo => {
        const Icono = ICONO_CATEGORIA[grupo.categoria];
        return (
          <div key={grupo.categoria} className="space-y-1.5">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 px-1">
              <Icono className="w-3.5 h-3.5 text-[#0099DD]" />
              {grupo.categoria}
              <span className="text-slate-300">({grupo.items.length})</span>
            </h3>

            {grupo.items.map(doc => (
              <RegistroEliminable key={doc.id} tipo="documentos" registroId={doc.id} titulo={doc.titulo}>
              <div
                className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200/80 hover:border-sky-300 transition-colors"
              >
                <a
                  href={doc.enlaceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 group"
                >
                  <p className="text-xs font-bold text-slate-800 truncate group-hover:text-[#0099DD] inline-flex items-center gap-1">
                    <span className="truncate">{doc.titulo}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </p>
                  {doc.descripcion && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{doc.descripcion}</p>
                  )}
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {detectarServicio(doc.enlaceUrl)} · {new Date(doc.fechaCarga).toLocaleDateString('es-CL')}
                  </span>
                </a>

              </div>
              </RegistroEliminable>
            ))}
          </div>
        );
      })}

      {/* Modal Nuevo documento */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto">
            <form onSubmit={guardar} className="p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Nuevo documento</h3>
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Personalidad jurídica"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                <select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value as CategoriaDocumento)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none"
                >
                  {CATEGORIAS.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  placeholder="Detalle breve del documento"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Enlace de Google Drive *</label>
                <input
                  type="text"
                  required
                  placeholder="https://drive.google.com/..."
                  value={enlace}
                  onChange={e => setEnlace(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
                {pareceEnlacePrivado(enlace) && (
                  <p className="flex items-start gap-1.5 text-[10px] text-amber-700 mt-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    Enlace con sesión personal. Compártelo como &quot;cualquiera con el enlace&quot;.
                  </p>
                )}
              </div>

              {error && (
                <p className="flex items-center gap-1.5 text-[11px] text-[#8B1E2B]">
                  <AlertTriangle className="w-3 h-3" />
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0099DD] hover:bg-[#0088cc] text-white rounded-xl shadow-xs"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Guardar enlace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
