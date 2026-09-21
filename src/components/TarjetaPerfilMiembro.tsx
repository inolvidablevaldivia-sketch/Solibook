'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Integrante, DocumentoAdjunto } from '@/types';
import { comprimirImagenABase64 } from '@/lib/imageCompressor';
import { esEnlaceValido, normalizarEnlace, detectarServicio, pareceEnlacePrivado } from '@/lib/enlaces';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Church,
  Cake,
  Camera,
  Link2,
  Trash2,
  Plus,
  FileText,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ShieldCheck
} from 'lucide-react';

// Estadísticas individuales de un miembro. Se expone para que Métricas use
// exactamente el mismo cálculo que la ficha abierta desde Miembros.
export const calcularEstadisticasMiembro = (
  miembro: Integrante,
  eventos: { id: string; titulo: string; tipo: string; fechaHoraInicio: string; tipoConvocatoria: string; cuerdasConvocadas?: Integrante['cuerda'][]; integrantesConvocadosIds?: string[]; asistenciaFinalizada: boolean }[],
  asistencias: { eventoId: string; integranteId: string; estado: string; motivoJustificacion?: string }[]
) => {
  let total = 0;
  let presentes = 0;
  let justificados = 0;
  let ausentes = 0;
  const historial: { fecha: string; titulo: string; tipo: string; estado: string; motivo?: string }[] = [];

  eventos.forEach(ev => {
    let fueConvocado = false;
    if (ev.tipoConvocatoria === 'Todos') fueConvocado = true;
    else if (ev.tipoConvocatoria === 'Por Cuerda' && ev.cuerdasConvocadas?.includes(miembro.cuerda)) fueConvocado = true;
    else if (ev.tipoConvocatoria === 'Personalizada' && ev.integrantesConvocadosIds?.includes(miembro.id)) fueConvocado = true;

    if (!fueConvocado) return;

    total++;
    const registro = asistencias.find(a => a.eventoId === ev.id && a.integranteId === miembro.id);
    const st = registro ? registro.estado : 'Sin Registro';
    if (st === 'Presente') presentes++;
    else if (st === 'Justificado') justificados++;
    else if (st === 'Ausente') ausentes++;

    historial.push({
      fecha: new Date(ev.fechaHoraInicio).toLocaleDateString('es-CL'),
      titulo: ev.titulo,
      tipo: ev.tipo,
      estado: st,
      motivo: registro?.motivoJustificacion
    });
  });

  // Justificado cuenta como 0.5 en el porcentaje de cumplimiento
  const porcentaje = total > 0 ? Math.round(((presentes + justificados * 0.5) / total) * 100) : 0;

  return { total, presentes, justificados, ausentes, porcentaje, historial };
};

interface TarjetaPerfilMiembroProps {
  integrante: Integrante;
  onCerrar: () => void;
  onEditar?: (integrante: Integrante) => void;
}

// Ficha única de miembro: se usa tanto desde el Libro de Miembros como desde
// Métricas, para que la información mostrada sea idéntica en ambos lugares.
export const TarjetaPerfilMiembro: React.FC<TarjetaPerfilMiembroProps> = ({
  integrante,
  onCerrar,
  onEditar
}) => {
  const { eventos, asistencias, actualizarIntegrante, agregarDocumentoMiembro, eliminarDocumentoMiembro } =
    useApp();
  const { usuarios, vincularIntegrante, puedeAceptarIngresos } = useAuth();

  const [modalDocumento, setModalDocumento] = useState(false);
  const [tituloDoc, setTituloDoc] = useState('');
  const [enlaceDoc, setEnlaceDoc] = useState('');
  const [notaDoc, setNotaDoc] = useState('');
  const [errorDoc, setErrorDoc] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const inputFotoRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(
    () => calcularEstadisticasMiembro(integrante, eventos, asistencias),
    [integrante, eventos, asistencias]
  );

  const documentos: DocumentoAdjunto[] = integrante.documentos || [];
  const cuentaVinculada = usuarios.find(u => u.integranteId === integrante.id);
  // Sólo cuentas que hoy no tienen ficha: una ficha, una cuenta.
  const cuentasLibres = usuarios.filter(u => !u.integranteId && u.uid !== cuentaVinculada?.uid);

  const iniciales = integrante.nombreCompleto
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');

  const cambiarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const base64 = await comprimirImagenABase64(archivo, 400, 0.6);
      actualizarIntegrante(integrante.id, { fotoUrl: base64 });
    } catch {
      // Si la compresión falla se conserva la foto anterior
    } finally {
      setSubiendoFoto(false);
      if (inputFotoRef.current) inputFotoRef.current.value = '';
    }
  };

  const guardarDocumento = () => {
    if (!tituloDoc.trim()) {
      setErrorDoc('Indica un título para el documento.');
      return;
    }
    if (!esEnlaceValido(enlaceDoc)) {
      setErrorDoc('El enlace no es válido. Debe comenzar con http:// o https://');
      return;
    }
    agregarDocumentoMiembro(integrante.id, {
      titulo: tituloDoc.trim(),
      enlaceUrl: normalizarEnlace(enlaceDoc),
      nota: notaDoc.trim() || undefined,
      fechaCarga: new Date().toISOString()
    });
    setTituloDoc('');
    setEnlaceDoc('');
    setNotaDoc('');
    setErrorDoc('');
    setModalDocumento(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Cabecera con foto */}
        <div className="p-5 border-b border-slate-100 flex items-start gap-4">
          <div className="relative shrink-0">
            {integrante.fotoUrl ? (
              <img
                src={integrante.fotoUrl}
                alt={integrante.nombreCompleto}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center font-bold text-sm text-[#0099DD]">
                {iniciales || 'SD'}
              </div>
            )}
            <button
              onClick={() => inputFotoRef.current?.click()}
              title="Cambiar foto"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0099DD] text-white flex items-center justify-center border-2 border-white hover:bg-[#0088cc] transition-colors"
            >
              {subiendoFoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            </button>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              onChange={cambiarFoto}
              className="hidden"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-tight">{integrante.nombreCompleto}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[10px] font-bold text-[#0077B6] bg-sky-100/60 px-2 py-0.5 rounded-md">
                {integrante.cuerda}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                  integrante.estado === 'Activo'
                    ? 'bg-emerald-100/60 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {integrante.estado}
              </span>
              <span className="text-[10px] text-slate-400">
                Ingreso: {new Date(integrante.fechaIngreso).toLocaleDateString('es-CL')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onEditar && (
              <button
                onClick={() => onEditar(integrante)}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Editar
              </button>
            )}
            <button onClick={onCerrar} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Fecha de nacimiento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-3">
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Cake className="w-3 h-3" />
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={integrante.fechaNacimiento || ''}
                onChange={e =>
                  actualizarIntegrante(integrante.id, { fechaNacimiento: e.target.value || undefined })
                }
                className="mt-1.5 w-full bg-white px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#0099DD]"
              />
            </div>

            <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Cumplimiento
              </span>
              <div className="flex items-end gap-2 mt-1">
                <span
                  className={`text-xl font-black leading-none ${
                    stats.porcentaje >= 80
                      ? 'text-emerald-700'
                      : stats.porcentaje >= 65
                        ? 'text-amber-700'
                        : 'text-rose-700'
                  }`}
                >
                  {stats.total > 0 ? `${stats.porcentaje}%` : '—'}
                </span>
                <span className="text-[10px] text-slate-500 mb-0.5">{stats.total} citaciones</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full ${
                    stats.porcentaje >= 80
                      ? 'bg-emerald-500'
                      : stats.porcentaje >= 65
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${stats.porcentaje}%` }}
                />
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-2 text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-200/80">
            <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Información de Contacto
            </h4>
            <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
              <div className="flex items-start gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[10px]">Teléfono</span>
                  {integrante.telefono ? (
                    <a href={`tel:${integrante.telefono}`} className="text-[#0099DD] font-semibold">
                      {integrante.telefono}
                    </a>
                  ) : (
                    <span>No registrado</span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[10px]">Email</span>
                  <span className="truncate block font-medium">{integrante.email || 'No registrado'}</span>
                </div>
              </div>
              {/* Cuenta de acceso. La ficha existe aunque nadie tenga correo:
                  sirve para las estadísticas y un día se vincula. */}
              <div className="col-span-2 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-1.5 min-w-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px]">Cuenta de la app</span>
                    {cuentaVinculada ? (
                      <span className="truncate block font-medium">
                        {cuentaVinculada.nombre}
                        {cuentaVinculada.estadoIngreso && cuentaVinculada.estadoIngreso !== 'Aceptado'
                          ? ` · ${cuentaVinculada.estadoIngreso.toLowerCase()}` : ''}
                      </span>
                    ) : (
                      <span className="font-medium text-slate-400">Sin cuenta (ficha creada a mano)</span>
                    )}
                  </div>
                </div>
                {puedeAceptarIngresos && (
                  <select
                    value=""
                    onChange={e => {
                      if (!e.target.value) return;
                      if (e.target.value === 'quitar') vincularIntegrante(cuentaVinculada!.uid, undefined);
                      else if (confirm(`¿Vincular la cuenta de ${cuentasLibres.find(u => u.uid === e.target.value)?.nombre} a esta ficha? Quedará como su cuenta de acceso.`)) {
                        vincularIntegrante(e.target.value, integrante.id);
                      }
                    }}
                    className="px-2 py-1 text-[10px] border border-slate-200 rounded-lg bg-white text-slate-600 max-w-[45%]"
                  >
                    <option value="">{cuentaVinculada ? 'Cambiar vínculo…' : 'Vincular una cuenta…'}</option>
                    {cuentasLibres.map(u => (
                      <option key={u.uid} value={u.uid}>
                        {u.nombre}
                        {u.email ? ` · ${u.email}` : ''}
                      </option>
                    ))}
                    {cuentaVinculada && <option value="quitar">Dejar la ficha sin cuenta</option>}
                  </select>
                )}
              </div>
              <div className="col-span-2 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[10px]">Dirección</span>
                  <span>{integrante.direccion || 'Sin dirección registrada'}</span>
                </div>
              </div>
              <div className="col-span-2 flex items-start gap-1.5">
                <Church className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[10px]">Iglesia</span>
                  <span>{integrante.iglesia}</span>
                </div>
              </div>
              {integrante.notas && (
                <div className="col-span-2 pt-1 border-t border-slate-100 italic text-slate-500">
                  &quot;{integrante.notas}&quot;
                </div>
              )}
            </div>
          </div>

          {/* Historial reciente */}
          <div>
            <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2">
              Historial de Actividades Citadas
            </h4>
            {stats.historial.length === 0 ? (
              <p className="text-xs text-slate-400">Sin citaciones registradas.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {stats.historial.slice(0, 20).map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 block truncate">{h.titulo}</span>
                      <span className="text-[10px] text-slate-400">
                        {h.fecha} · {h.tipo}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        h.estado === 'Presente'
                          ? 'bg-emerald-100 text-emerald-800'
                          : h.estado === 'Justificado'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {h.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentos de respaldo (al final de la ficha) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Documentos
              </h4>
              <button
                onClick={() => setModalDocumento(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#0077B6] bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Agregar documento
              </button>
            </div>

            {documentos.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center">
                Sin documentos de respaldo. Agrega el enlace de Drive del documento.
              </p>
            ) : (
              <div className="space-y-1.5">
                {documentos.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="min-w-0">
                      <a
                        href={doc.enlaceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-slate-800 hover:text-[#0099DD] inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{doc.titulo}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {detectarServicio(doc.enlaceUrl)}
                        {doc.nota ? ` · ${doc.nota}` : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => eliminarDocumentoMiembro(integrante.id, doc.id)}
                      title="Eliminar documento"
                      className="p-1.5 text-slate-400 hover:text-[#8B1E2B] rounded-lg hover:bg-rose-50 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Agregar documento */}
      {modalDocumento && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Agregar documento</h4>
              <button onClick={() => setModalDocumento(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Título *</label>
              <input
                type="text"
                value={tituloDoc}
                onChange={e => setTituloDoc(e.target.value)}
                placeholder="Ej. Cédula de identidad"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Enlace de Google Drive *</label>
              <input
                type="text"
                value={enlaceDoc}
                onChange={e => setEnlaceDoc(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
              />
              {pareceEnlacePrivado(enlaceDoc) && (
                <p className="flex items-start gap-1.5 text-[10px] text-amber-700 mt-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  Enlace con sesión personal. Compártelo como &quot;cualquiera con el enlace&quot; para que otros puedan abrirlo.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nota (opcional)</label>
              <input
                type="text"
                value={notaDoc}
                onChange={e => setNotaDoc(e.target.value)}
                placeholder="Observación breve"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
              />
            </div>

            {errorDoc && (
              <p className="flex items-center gap-1.5 text-[11px] text-[#8B1E2B]">
                <AlertTriangle className="w-3 h-3" />
                {errorDoc}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setModalDocumento(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={guardarDocumento}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0099DD] hover:bg-[#0088cc] text-white rounded-xl"
              >
                <Link2 className="w-3.5 h-3.5" />
                Guardar enlace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
