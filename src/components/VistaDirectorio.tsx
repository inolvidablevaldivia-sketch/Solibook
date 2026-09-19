'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Integrante, Cuerda, EstadoIntegrante } from '@/types';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Church,
  X,
  Edit2,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Percent
} from 'lucide-react';

export const VistaDirectorio: React.FC = () => {
  const { integrantes, agregarIntegrante, actualizarIntegrante, eventos, asistencias } = useApp();

  const [busqueda, setBusqueda] = useState('');
  const [filtroCuerda, setFiltroCuerda] = useState<string>('Todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('Activos');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editando, setEditando] = useState<Integrante | null>(null);

  // Perfil del miembro seleccionado para ver estadísticas individuales
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<Integrante | null>(null);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [iglesia, setIglesia] = useState('Iglesia Bautista Central');
  const [cuerda, setCuerda] = useState<Cuerda>('Tenor');
  const [estado, setEstado] = useState<EstadoIntegrante>('Activo');
  const [notas, setNotas] = useState('');

  const cuerdasDisponibles: Cuerda[] = ['Soprano', 'Contralto', 'Tenor', 'Bajo', 'Solista', 'Directiva'];

  // Lista ordenada alfabéticamente por defecto
  const integrantesFiltrados = useMemo(() => {
    return integrantes
      .filter(i => {
        if (filtroEstado === 'Activos' && i.estado !== 'Activo') return false;
        if (filtroEstado === 'Inactivos' && i.estado !== 'Inactivo') return false;
        if (filtroCuerda !== 'Todas' && i.cuerda !== filtroCuerda) return false;

        if (!busqueda.trim()) return true;
        const q = busqueda.toLowerCase();
        return (
          i.nombreCompleto.toLowerCase().includes(q) ||
          i.iglesia.toLowerCase().includes(q) ||
          i.telefono.includes(q)
        );
      })
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }, [integrantes, filtroEstado, filtroCuerda, busqueda]);

  // Cálculo individual para el perfil
  const getEstadisticasMiembro = (miembroId: string) => {
    const miembro = integrantes.find(i => i.id === miembroId);
    if (!miembro) return { total: 0, presentes: 0, justificados: 0, ausentes: 0, porcentaje: 100, historial: [] };

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

      if (fueConvocado) {
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
      }
    });

    const porcentaje = total > 0 ? Math.round(((presentes + (justificados * 0.5)) / total) * 100) : 100;
    return { total, presentes, justificados, ausentes, porcentaje, historial };
  };

  const abrirParaEditar = (item: Integrante, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditando(item);
    setNombre(item.nombreCompleto);
    setTelefono(item.telefono);
    setEmail(item.email);
    setDireccion(item.direccion);
    setIglesia(item.iglesia);
    setCuerda(item.cuerda);
    setEstado(item.estado);
    setNotas(item.notas || '');
    setModalNuevo(true);
  };

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !iglesia.trim()) return;

    if (editando) {
      actualizarIntegrante(editando.id, {
        nombreCompleto: nombre,
        telefono,
        email,
        direccion,
        iglesia,
        cuerda,
        estado,
        notas
      });
    } else {
      agregarIntegrante({
        nombreCompleto: nombre,
        telefono,
        email,
        direccion,
        iglesia,
        cuerda,
        estado,
        fechaIngreso: new Date().toISOString().split('T')[0],
        notas
      });
    }

    setModalNuevo(false);
    setEditando(null);
    limpiarForm();
  };

  const limpiarForm = () => {
    setNombre('');
    setTelefono('');
    setEmail('');
    setDireccion('');
    setNotas('');
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-16">
      {/* Barra de Filtros y Acciones */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Directorio de Miembros</h2>
            <p className="text-xs text-slate-400">
              Listado oficial ordenado alfabéticamente ({integrantesFiltrados.length} integrantes)
            </p>
          </div>

          <button
            onClick={() => {
              setEditando(null);
              limpiarForm();
              setModalNuevo(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0099DD] hover:bg-[#0088cc] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Miembro</span>
          </button>
        </div>

        {/* Buscador y Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, iglesia..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
            />
          </div>

          <select
            value={filtroCuerda}
            onChange={e => setFiltroCuerda(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="Todas">Todas las Cuerdas</option>
            {cuerdasDisponibles.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="Activos">Solo Activos</option>
            <option value="Todos">Todos los Estados</option>
            <option value="Inactivos">Inactivos / Receso</option>
          </select>
        </div>
      </div>

      {/* Tarjetas de Miembros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {integrantesFiltrados.map(item => {
          const stats = getEstadisticasMiembro(item.id);

          return (
            <div
              key={item.id}
              onClick={() => setPerfilSeleccionado(item)}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between space-y-3 cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center font-bold text-xs text-[#0099DD] shrink-0">
                    {item.cuerda.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-[#0099DD] transition-colors truncate">
                      {item.nombreCompleto}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold text-[#0077B6] bg-sky-100/60 px-2 py-0.2 rounded-md">
                        {item.cuerda}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-md ${
                        item.estado === 'Activo'
                          ? 'bg-emerald-100/60 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.estado}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => abrirParaEditar(item, e)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Editar datos"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Barra de progreso de asistencia individual rápida */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  Asistencia:
                </span>
                <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                  stats.porcentaje >= 80 ? 'bg-emerald-100 text-emerald-800' :
                  stats.porcentaje >= 65 ? 'bg-amber-100 text-amber-800' :
                  'bg-rose-100 text-rose-800'
                }`}>
                  {stats.porcentaje}% ({stats.presentes}/{stats.total})
                </span>
              </div>

              {/* Datos Personales */}
              <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Church className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{item.iglesia}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a
                    href={`tel:${item.telefono}`}
                    onClick={e => e.stopPropagation()}
                    className="text-[#0099DD] hover:underline"
                  >
                    {item.telefono}
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL PERFIL COMPLETO Y ESTADÍSTICAS DEL MIEMBRO */}
      {perfilSeleccionado && (() => {
        const stats = getEstadisticasMiembro(perfilSeleccionado.id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-5 space-y-4">
                {/* Cabecera del perfil */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-50 to-sky-100 border border-sky-200 text-[#0099DD] flex items-center justify-center font-bold text-base">
                      {perfilSeleccionado.cuerda.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {perfilSeleccionado.nombreCompleto}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-semibold text-[#0077B6]">{perfilSeleccionado.cuerda}</span>
                        <span>•</span>
                        <span>{perfilSeleccionado.iglesia}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setPerfilSeleccionado(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Métricas Visuales de Desempeño */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Citado</span>
                    <span className="text-base font-black text-slate-800">{stats.total}</span>
                  </div>
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 font-bold block uppercase">Presentes</span>
                    <span className="text-base font-black text-emerald-800">{stats.presentes}</span>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-[10px] text-amber-700 font-bold block uppercase">Justif.</span>
                    <span className="text-base font-black text-amber-800">{stats.justificados}</span>
                  </div>
                  <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-rose-700 font-bold block uppercase">Ausentes</span>
                    <span className="text-base font-black text-rose-800">{stats.ausentes}</span>
                  </div>
                </div>

                {/* Barra Porcentual */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Porcentaje de Cumplimiento:</span>
                    <span className={`font-black text-sm ${
                      stats.porcentaje >= 80 ? 'text-emerald-700' :
                      stats.porcentaje >= 65 ? 'text-amber-700' : 'text-rose-700'
                    }`}>
                      {stats.porcentaje}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        stats.porcentaje >= 80 ? 'bg-emerald-500' :
                        stats.porcentaje >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${stats.porcentaje}%` }}
                    />
                  </div>
                </div>

                {/* Ficha de Contacto */}
                <div className="space-y-2 text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-200/80">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Información de Contacto
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Teléfono / WhatsApp</span>
                      <a href={`tel:${perfilSeleccionado.telefono}`} className="text-[#0099DD] font-semibold">
                        {perfilSeleccionado.telefono}
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Email</span>
                      <span className="truncate block font-medium">{perfilSeleccionado.email || 'No registrado'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">Dirección</span>
                      <span>{perfilSeleccionado.direccion || 'Sin dirección registrada'}</span>
                    </div>
                    {perfilSeleccionado.notas && (
                      <div className="col-span-2 pt-1 border-t border-slate-100 italic text-slate-500">
                        "{perfilSeleccionado.notas}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Historial de Asistencia Reciente */}
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2">
                    Historial de Actividades Citadas
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {stats.historial.map((h, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <span className="font-bold text-slate-800 block">{h.titulo}</span>
                          <span className="text-[10px] text-slate-400">{h.fecha} • {h.tipo}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          h.estado === 'Presente' ? 'bg-emerald-100 text-emerald-800' :
                          h.estado === 'Justificado' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {h.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botón Cerrar */}
                <div className="pt-2 text-right">
                  <button
                    onClick={() => setPerfilSeleccionado(null)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
                  >
                    Cerrar Perfil
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Nuevo / Editar Miembro */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleGuardar} className="p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {editando ? 'Editar Miembro' : 'Nuevo Miembro'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Alvarado"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cuerda / Voz</label>
                  <select
                    value={cuerda}
                    onChange={e => setCuerda(e.target.value as Cuerda)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none"
                  >
                    {cuerdasDisponibles.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                  <select
                    value={estado}
                    onChange={e => setEstado(e.target.value as EstadoIntegrante)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none"
                  >
                    <option value="Activo">Activo</option>
                    <option value="En receso">En receso</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Iglesia de Procedencia *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Iglesia Bautista Central..."
                  value={iglesia}
                  onChange={e => setIglesia(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+56 9 ..."
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección / Comuna</label>
                <input
                  type="text"
                  placeholder="Calle, número, comuna..."
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

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
                  className="px-4 py-2 text-xs font-semibold bg-[#0099DD] hover:bg-[#0088cc] text-white rounded-xl shadow-xs"
                >
                  Guardar Miembro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
