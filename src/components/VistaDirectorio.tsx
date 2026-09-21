'use client';

import { useEliminaciones } from '@/context/EliminacionesContext';
import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Integrante, Cuerda, EstadoIntegrante } from '@/types';
import { TarjetaPerfilMiembro, calcularEstadisticasMiembro } from './TarjetaPerfilMiembro';
import { usePulsacionLarga } from '@/lib/usePulsacionLarga';
import {
  Search,
  Plus,
  X,
  Edit2,
  Trash2,
  UserX,
  ChevronRight,
  Users
} from 'lucide-react';

interface FilaMiembroProps {
  item: Integrante;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  porcentaje: number;
  citaciones: number;
  onAbrirFicha: (item: Integrante) => void;
  onEditar: (item: Integrante) => void;
  onMarcarInactivo: (item: Integrante) => void;
  onEliminar: (item: Integrante) => void;
}

// Fila compacta del listado de miembros. El toque simple abre la ficha y la
// pulsación larga despliega el menú de opciones.
const FilaMiembro: React.FC<FilaMiembroProps> = ({
  item,
  puedeEditar,
  puedeEliminar,
  porcentaje,
  citaciones,
  onAbrirFicha,
  onEditar,
  onMarcarInactivo,
  onEliminar
}) => {
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Solo despliega el menú contextual si el rol tiene alguna acción disponible
  const pulsacion = usePulsacionLarga(() => {
    if (puedeEditar || puedeEliminar) setMenuAbierto(true);
  }, 500);

  const iniciales = item.nombreCompleto
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');

  const handleClick = () => {
    if (pulsacion.fuePulsacionLarga()) {
      pulsacion.reiniciar();
      return;
    }
    onAbrirFicha(item);
  };

  return (
    <div className="relative">
      <button
        {...pulsacion.manejadores}
        onClick={handleClick}
        className="accion-mantener w-full flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-slate-200/80 hover:border-sky-300 transition-colors text-left"
      >
        {item.fotoUrl ? (
          <img
            src={item.fotoUrl}
            alt={item.nombreCompleto}
            className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center font-bold text-[11px] text-[#0099DD] shrink-0">
            {iniciales || 'SD'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 truncate leading-tight">{item.nombreCompleto}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-bold text-[#0077B6] bg-sky-100/60 px-1.5 rounded">
              {item.cuerda}
            </span>
            <span className="text-[10px] text-slate-400 truncate">{item.iglesia}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span
            className={`text-xs font-black block leading-none ${
              citaciones === 0
                ? 'text-slate-300'
                : porcentaje >= 80
                  ? 'text-emerald-700'
                  : porcentaje >= 65
                    ? 'text-amber-700'
                    : 'text-rose-700'
            }`}
          >
            {citaciones > 0 ? `${porcentaje}%` : '—'}
          </span>
          <span
            className={`text-[10px] font-semibold ${
              item.estado === 'Activo' ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            {item.estado}
          </span>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
      </button>

      {menuAbierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuAbierto(false)} />
          <div className="absolute right-2 top-11 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[190px]">
            {puedeEditar && (
            <button
              onClick={() => {
                setMenuAbierto(false);
                onEditar(item);
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 w-full"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Editar
            </button>
            )}
            {puedeEditar && (
            <button
              onClick={() => {
                setMenuAbierto(false);
                onMarcarInactivo(item);
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 w-full border-t border-slate-100"
            >
              <UserX className="w-3.5 h-3.5" />
              Marcar como Inactivo
            </button>
            )}
            {puedeEliminar && (
            <button
              onClick={() => {
                setMenuAbierto(false);
                onEliminar(item);
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#8B1E2B] hover:bg-rose-50 w-full border-t border-slate-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const TablaMiembros: React.FC<{
  integrantes: Integrante[];
  eventos: ReturnType<typeof useApp>['eventos'];
  asistencias: ReturnType<typeof useApp>['asistencias'];
  puedeEditar: boolean;
  puedeEliminar: boolean;
  onAbrirFicha: (integrante: Integrante) => void;
  onEditar: (integrante: Integrante) => void;
  onMarcarInactivo: (integrante: Integrante) => void;
  onEliminar: (integrante: Integrante) => void;
}> = ({
  integrantes,
  eventos,
  asistencias,
  puedeEditar,
  puedeEliminar,
  onAbrirFicha,
  onEditar,
  onMarcarInactivo,
  onEliminar
}) => {
  const fechaCorta = (fecha?: string) =>
    fecha
      ? new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
      : '—';

  return (
    <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">Directorio en tabla</span>
        <span className="text-[11px] text-slate-500">Selecciona una fila para abrir la ficha completa</span>
      </div>
      <div className="overflow-x-auto max-h-[calc(100vh-275px)]">
        <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
            <tr className="border-b border-slate-200">
              <th className="p-3 min-w-[200px]">Miembro</th>
              <th className="p-3 min-w-[100px]">Cuerda</th>
              <th className="p-3 min-w-[165px]">Iglesia</th>
              <th className="p-3 min-w-[130px]">Teléfono</th>
              <th className="p-3 min-w-[190px]">Correo</th>
              <th className="p-3 text-center min-w-[90px]">Cumpleaños</th>
              <th className="p-3 text-center min-w-[100px]">Asistencia</th>
              <th className="p-3 text-center min-w-[95px]">Estado</th>
              {(puedeEditar || puedeEliminar) && <th className="p-3 text-right min-w-[160px]">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {integrantes.map(item => {
              const stats = calcularEstadisticasMiembro(item, eventos, asistencias);
              const asistencia = stats.total > 0 ? `${stats.porcentaje}%` : '—';
              return (
                <tr
                  key={item.id}
                  onClick={() => onAbrirFicha(item)}
                  className="hover:bg-sky-50/50 transition-colors cursor-pointer"
                >
                  <td className="p-3 font-bold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      {item.fotoUrl ? (
                        <img src={item.fotoUrl} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-200" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-100 text-[#0077B6] flex items-center justify-center text-[10px] font-black">
                          {item.nombreCompleto.split(' ').filter(Boolean).slice(0, 2).map(palabra => palabra[0]).join('')}
                        </div>
                      )}
                      <span>{item.nombreCompleto}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-sky-100/70 text-[#0077B6]">{item.cuerda}</span>
                  </td>
                  <td className="p-3 text-slate-600">{item.iglesia}</td>
                  <td className="p-3 text-slate-600">{item.telefono || '—'}</td>
                  <td className="p-3 text-slate-600">{item.email || '—'}</td>
                  <td className="p-3 text-center font-semibold text-slate-600">{fechaCorta(item.fechaNacimiento)}</td>
                  <td className={`p-3 text-center font-black ${
                    stats.total === 0 ? 'text-slate-300' : stats.porcentaje >= 80 ? 'text-emerald-700' : stats.porcentaje >= 65 ? 'text-amber-700' : 'text-rose-700'
                  }`}>
                    {asistencia}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.estado}
                    </span>
                  </td>
                  {(puedeEditar || puedeEliminar) && (
                    <td className="p-3 text-right" onClick={event => event.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {puedeEditar && (
                          <button
                            onClick={() => onEditar(item)}
                            className="px-2 py-1.5 text-[10px] font-bold text-[#0077B6] bg-sky-50 hover:bg-sky-100 rounded-lg"
                          >
                            Editar
                          </button>
                        )}
                        {puedeEditar && item.estado === 'Activo' && (
                          <button
                            onClick={() => onMarcarInactivo(item)}
                            className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                            title="Marcar como inactivo"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {puedeEliminar && (
                          <button
                            onClick={() => onEliminar(item)}
                            className="p-1.5 text-slate-400 hover:text-[#8B1E2B] hover:bg-rose-50 rounded-lg"
                            title="Eliminar miembro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const VistaDirectorio: React.FC = () => {
  const { solicitar, advertirBloqueo, solicitudes } = useEliminaciones();
  const {
    integrantes,
    agregarIntegrante,
    actualizarIntegrante,
    eventos,
    asistencias
  } = useApp();
  const { puede } = useAuth();

  const [busqueda, setBusqueda] = useState('');
  const [filtroCuerda, setFiltroCuerda] = useState<string>('Todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('Activos');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editando, setEditando] = useState<Integrante | null>(null);
  const [perfilSeleccionadoId, setPerfilSeleccionadoId] = useState<string | null>(null);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [iglesia, setIglesia] = useState('Iglesia Bautista Central');
  const [cuerda, setCuerda] = useState<Cuerda>('Tenor');
  const [estado, setEstado] = useState<EstadoIntegrante>('Activo');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [notas, setNotas] = useState('');

  const cuerdasDisponibles: Cuerda[] = ['Soprano', 'Contralto', 'Tenor', 'Bajo', 'Solista', 'Directiva'];

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

  const perfilSeleccionado = integrantes.find(i => i.id === perfilSeleccionadoId) || null;

  const abrirParaEditar = (item: Integrante) => {
    if (advertirBloqueo('integrantes', item.id)) return;
    setPerfilSeleccionadoId(null);
    setEditando(item);
    setNombre(item.nombreCompleto);
    setTelefono(item.telefono);
    setEmail(item.email);
    setDireccion(item.direccion);
    setIglesia(item.iglesia);
    setCuerda(item.cuerda);
    setEstado(item.estado);
    setFechaNacimiento(item.fechaNacimiento || '');
    setNotas(item.notas || '');
    setModalNuevo(true);
  };

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !iglesia.trim()) return;

    const datos = {
      nombreCompleto: nombre,
      telefono,
      email,
      direccion,
      iglesia,
      cuerda,
      estado,
      fechaNacimiento: fechaNacimiento || undefined,
      notas
    };

    if (editando) {
      actualizarIntegrante(editando.id, datos);
    } else {
      agregarIntegrante({
        ...datos,
        fechaIngreso: new Date().toISOString().split('T')[0]
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
    setFechaNacimiento('');
    setNotas('');
  };

  const marcarComoInactivo = (item: Integrante) => {
    if (advertirBloqueo('integrantes', item.id)) return;
    actualizarIntegrante(item.id, { estado: 'Inactivo' });
  };

  const confirmarEliminar = (item: Integrante) => { void solicitar('integrantes', item.id, item.nombreCompleto); };

  return (
    <div className="space-y-3 max-w-3xl lg:max-w-7xl mx-auto pb-16">
      {solicitudes.filter(s => s.tipo === 'integrantes' && s.estado === 'Pendiente').map(s => <p key={s.id} className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">{s.titulo}: eliminación pendiente. La ficha está protegida; resuelve la solicitud en Notificaciones.</p>)}
      {/* Barra de Filtros y Acciones */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Miembros</h2>
            <p className="text-xs text-slate-400 truncate">
              {integrantesFiltrados.length} integrantes · mantén presionada una fila para ver opciones
            </p>
          </div>

          {puede('crear_miembro') && (
            <button
              onClick={() => {
                setEditando(null);
                limpiarForm();
                setModalNuevo(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0099DD] hover:bg-[#0088cc] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo</span>
            </button>
          )}
        </div>

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
              <option key={c} value={c}>
                {c}
              </option>
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

      {integrantesFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <Users className="w-6 h-6 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">No hay integrantes que coincidan con el filtro.</p>
        </div>
      ) : (
        <>
          {/* Móvil: filas grandes y táctiles. */}
          <div className="space-y-1.5 lg:hidden">
            {integrantesFiltrados.map(item => {
              const stats = calcularEstadisticasMiembro(item, eventos, asistencias);
              return (
                <FilaMiembro
                  key={item.id}
                  item={item}
                  puedeEditar={puede('editar_miembro')}
                  puedeEliminar={puede('eliminar_miembro')}
                  porcentaje={stats.porcentaje}
                  citaciones={stats.total}
                  onAbrirFicha={i => setPerfilSeleccionadoId(i.id)}
                  onEditar={abrirParaEditar}
                  onMarcarInactivo={marcarComoInactivo}
                  onEliminar={confirmarEliminar}
                />
              );
            })}
          </div>

          {/* Escritorio: directorio tipo planilla para aprovechar el ancho. */}
          <TablaMiembros
            integrantes={integrantesFiltrados}
            eventos={eventos}
            asistencias={asistencias}
            puedeEditar={puede('editar_miembro')}
            puedeEliminar={puede('eliminar_miembro')}
            onAbrirFicha={i => setPerfilSeleccionadoId(i.id)}
            onEditar={abrirParaEditar}
            onMarcarInactivo={marcarComoInactivo}
            onEliminar={confirmarEliminar}
          />
        </>
      )}

      {/* Ficha del miembro (componente compartido con Métricas) */}
      {perfilSeleccionado && (
        <TarjetaPerfilMiembro
          integrante={perfilSeleccionado}
          onCerrar={() => setPerfilSeleccionadoId(null)}
          onEditar={puede('editar_miembro') ? abrirParaEditar : undefined}
        />
      )}

      {/* Modal Nuevo / Editar Miembro */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
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
                      <option key={c} value={c}>
                        {c}
                      </option>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={e => setFechaNacimiento(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas</label>
                <textarea
                  rows={2}
                  placeholder="Observaciones internas"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
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
