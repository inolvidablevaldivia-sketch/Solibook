'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useEliminaciones } from '@/context/EliminacionesContext';
import { auth } from '@/lib/firebase';
import { COLECCIONES_MANTENIMIENTO, tituloDeRegistro, type AccionMantenimiento, type ColeccionMantenimiento } from '@/lib/mantenimiento';
import { AlertTriangle, Search, Trash2, Wrench } from 'lucide-react';

const ETIQUETA_COLECCION: Record<ColeccionMantenimiento, string> = {
  integrantes: 'Integrantes',
  eventos: 'Eventos',
  asistencias: 'Asistencias',
  cartas: 'Cartas',
  actas: 'Actas',
  justificaciones: 'Justificaciones',
  documentos: 'Documentos',
  documentos_evento: 'Documentos de actividad',
  notificaciones: 'Notificaciones',
  usuarios: 'Usuarios'
};

interface FilaMantenimiento {
  id: string;
  titulo: string;
  detalle: string;
  accion: AccionMantenimiento;
  coleccion?: ColeccionMantenimiento;
  solicitudId?: string;
}

export const VistaMantenimiento: React.FC = () => {
  const { esSuperAdmin, modoLocal, usuarios } = useAuth();
  const {
    integrantes,
    eventos,
    asistencias,
    cartas,
    actas,
    justificaciones,
    documentos,
    documentosEvento,
    notificaciones
  } = useApp();
  const { solicitudes } = useEliminaciones();

  const [coleccion, setColeccion] = useState<ColeccionMantenimiento | 'solicitudes' | 'huerfanas' | 'dispositivos'>('integrantes');
  const [busqueda, setBusqueda] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [pendiente, setPendiente] = useState<FilaMantenimiento | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const idsExistentes = useMemo(() => {
    const ids = new Set<string>();
    integrantes.forEach(i => ids.add(i.id));
    eventos.forEach(e => ids.add(e.id));
    asistencias.forEach(a => ids.add(a.id));
    cartas.forEach(c => ids.add(c.id));
    actas.forEach(a => ids.add(a.id));
    justificaciones.forEach(j => ids.add(j.id));
    documentos.forEach(d => ids.add(d.id));
    documentosEvento.forEach(d => ids.add(d.id));
    usuarios.forEach(u => ids.add(u.uid));
    solicitudes.forEach(s => ids.add(s.id));
    return ids;
  }, [integrantes, eventos, asistencias, cartas, actas, justificaciones, documentos, documentosEvento, usuarios, solicitudes]);

  const filas = useMemo((): FilaMantenimiento[] => {
    if (coleccion === 'solicitudes') {
      return solicitudes.map(s => ({
        id: s.id,
        titulo: s.titulo || s.id,
        detalle: `${s.tipo} · ${s.estado} · ${s.solicitanteNombre}`,
        accion: 'descartar_solicitud',
        solicitudId: s.id
      }));
    }
    if (coleccion === 'huerfanas') {
      return notificaciones
        .filter(n => n.accionId && !idsExistentes.has(n.accionId))
        .map(n => ({
          id: n.id,
          titulo: n.titulo || n.id,
          detalle: `accionId: ${n.accionId}`,
          accion: 'limpiar_notificaciones_huerfanas'
        }));
    }
    if (coleccion === 'dispositivos') {
      return [{
        id: 'dispositivos-inactivos',
        titulo: 'dispositivos inactivos',
        detalle: 'Tokens de cuentas suspendidas, rechazadas o inexistentes',
        accion: 'limpiar_dispositivos'
      }];
    }
    const origen: { id: string; datos: Record<string, unknown>; detalle: string }[] = (() => {
      switch (coleccion) {
        case 'integrantes': return integrantes.map(i => ({ id: i.id, datos: i as unknown as Record<string, unknown>, detalle: i.email || i.cuerda }));
        case 'eventos': return eventos.map(e => ({ id: e.id, datos: e as unknown as Record<string, unknown>, detalle: e.fechaHoraInicio }));
        case 'asistencias': return asistencias.map(a => ({ id: a.id, datos: a as unknown as Record<string, unknown>, detalle: `${a.estado} · ${a.eventoId}` }));
        case 'cartas': return cartas.map(c => ({ id: c.id, datos: c as unknown as Record<string, unknown>, detalle: c.folio }));
        case 'actas': return actas.map(a => ({ id: a.id, datos: a as unknown as Record<string, unknown>, detalle: a.estado }));
        case 'justificaciones': return justificaciones.map(j => ({ id: j.id, datos: j as unknown as Record<string, unknown>, detalle: j.estado }));
        case 'documentos': return documentos.map(d => ({ id: d.id, datos: d as unknown as Record<string, unknown>, detalle: d.categoria }));
        case 'documentos_evento': return documentosEvento.map(d => ({ id: d.id, datos: d as unknown as Record<string, unknown>, detalle: d.eventoId }));
        case 'notificaciones': return notificaciones.map(n => ({ id: n.id, datos: n as unknown as Record<string, unknown>, detalle: n.tipo }));
        case 'usuarios': return usuarios.map(u => ({ id: u.uid, datos: { ...u, nombreCompleto: u.nombre } as unknown as Record<string, unknown>, detalle: `${u.rol} · ${u.email}` }));
      }
    })();
    return origen.map(item => ({
      id: item.id,
      titulo: tituloDeRegistro(item.datos, item.id),
      detalle: item.detalle,
      accion: 'eliminar_registro',
      coleccion
    }));
  }, [coleccion, integrantes, eventos, asistencias, cartas, actas, justificaciones, documentos, documentosEvento, notificaciones, usuarios, solicitudes, idsExistentes]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(f => f.titulo.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.detalle.toLowerCase().includes(q));
  }, [filas, busqueda]);

  if (!esSuperAdmin) {
    return (
      <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
        <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-900">Sección restringida</p>
        <p className="text-xs text-slate-500 mt-1.5">Sólo la cuenta fundadora y el Desarrollador ven este panel. El servidor es quien autoriza cada acción.</p>
      </div>
    );
  }

  const ejecutar = async () => {
    if (!pendiente) return;
    setError('');
    setMensaje('');
    if (modoLocal || !auth.currentUser) {
      setError('Esta herramienta requiere iniciar sesión con Google y conexión.');
      return;
    }
    setOcupado(true);
    try {
      const respuesta = await fetch('/api/mantenimiento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          accion: pendiente.accion,
          coleccion: pendiente.coleccion,
          registroId: pendiente.id,
          solicitudId: pendiente.solicitudId,
          confirmacion
        })
      });
      const datos = (await respuesta.json()) as { error?: string; mensaje?: string };
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar.');
      setMensaje(datos.mensaje || 'Listo.');
      setPendiente(null);
      setConfirmacion('');
      setMarcados(prev => {
        const siguiente = new Set(prev);
        siguiente.delete(pendiente.id);
        return siguiente;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setOcupado(false);
    }
  };

  const pestanas: { id: typeof coleccion; etiqueta: string }[] = [
    ...COLECCIONES_MANTENIMIENTO.map(id => ({ id, etiqueta: ETIQUETA_COLECCION[id] })),
    { id: 'solicitudes', etiqueta: 'Solicitudes de borrado' },
    { id: 'huerfanas', etiqueta: 'Notificaciones huérfanas' },
    { id: 'dispositivos', etiqueta: 'Dispositivos' }
  ];

  return (
    <div className="hidden lg:block space-y-3 max-w-5xl mx-auto pb-16">
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-slate-500" />
          Mantenimiento del fundador
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Borrado limpio, registro por registro. No crea solicitudes, historial ni avisos. El servidor comprueba que seas la cuenta fundadora o Desarrollador; esta pantalla sólo muestra las herramientas. No hay «borrar todo»: hay miembros y eventos reales.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pestanas.map(p => (
          <button
            key={p.id}
            onClick={() => { setColeccion(p.id); setBusqueda(''); setMarcados(new Set()); }}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-colors ${
              coleccion === p.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por título, id o detalle…"
          className="w-full pl-9 pr-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
        />
      </div>

      {mensaje && <p role="status" className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl p-3">{mensaje}</p>}
      {error && <p role="alert" className="text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</p>}

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        {filtradas.length === 0 ? (
          <p className="text-xs text-slate-400 p-6 text-center">No hay registros en esta lista.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtradas.map(fila => (
              <li key={fila.id} className="flex items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={marcados.has(fila.id)}
                  onChange={e => {
                    setMarcados(prev => {
                      const siguiente = new Set(prev);
                      if (e.target.checked) siguiente.add(fila.id);
                      else siguiente.delete(fila.id);
                      return siguiente;
                    });
                  }}
                  className="accent-[#8B1E2B] w-4 h-4 shrink-0"
                  aria-label={`Seleccionar ${fila.titulo}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{fila.titulo}</p>
                  <p className="text-[10px] text-slate-400 truncate">{fila.id} · {fila.detalle}</p>
                </div>
                <button
                  type="button"
                  disabled={!marcados.has(fila.id) || ocupado}
                  onClick={() => { setPendiente(fila); setConfirmacion(''); setError(''); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {fila.accion === 'eliminar_registro' ? 'Eliminar' : fila.accion === 'descartar_solicitud' ? 'Descartar' : 'Limpiar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendiente && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Confirmar escribiendo el título</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para continuar, teclea exactamente: <strong className="text-slate-800">{pendiente.titulo}</strong>
            </p>
            <input
              autoFocus
              value={confirmacion}
              onChange={e => setConfirmacion(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#8B1E2B]"
              placeholder="Título del registro"
            />
            <div className="flex justify-end gap-2">
              <button type="button" disabled={ocupado} onClick={() => setPendiente(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button
                type="button"
                disabled={ocupado || confirmacion.trim() !== pendiente.titulo.trim()}
                onClick={() => void ejecutar()}
                className="px-4 py-2 text-xs font-bold bg-[#8B1E2B] hover:bg-[#721823] text-white rounded-xl disabled:opacity-40"
              >
                {ocupado ? 'Procesando…' : 'Confirmar borrado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
