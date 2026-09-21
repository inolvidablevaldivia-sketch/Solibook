'use client';
import { useAuth } from '@/context/AuthContext';
import { useEliminaciones } from '@/context/EliminacionesContext';
import { rolEliminacion } from '@/lib/eliminaciones';

export function SolicitudesEliminacion() {
  const { usuario } = useAuth();
  const { solicitudes, resolver, ocupado, directo } = useEliminaciones();
  const rol = rolEliminacion(usuario?.rol || '');
  const revisa = ['Director', 'Secretario'].includes(rol) || directo;
  const visibles = solicitudes.filter(s => revisa || s.solicitanteUid === usuario?.uid);
  const pendientes = visibles.filter(s => s.estado === 'Pendiente');
  const cerradas = visibles.filter(s => s.estado !== 'Pendiente').sort((a, b) => (b.cerradaEn || '').localeCompare(a.cerradaEn || ''));
  if (!visibles.length) return null;
  return <section className="space-y-3 pb-3">
    <h4 className="text-xs font-bold text-rose-800 uppercase">Solicitudes de eliminación ({pendientes.length} pendientes)</h4>
    {pendientes.map(s => <div key={s.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
      <p className="font-bold text-slate-800">{s.titulo}</p><p>{s.tipo} · Solicitada por {s.solicitanteNombre}</p>
      <p>Dirección: {s.firmas.Director?.nombre || 'sin firma'} · Secretaría: {s.firmas.Secretario?.nombre || 'sin firma'}</p>
      <p className="text-slate-500">No caduca. Un rechazo la cierra para todos.</p>
      <div className="flex flex-wrap gap-2">
        {revisa && <><button disabled={ocupado} onClick={() => resolver(s.id, 'aprobar')} className="bg-emerald-700 text-white rounded-lg p-2 disabled:opacity-40">{directo ? 'Eliminar directamente' : 'Autorizar'}</button><button disabled={ocupado} onClick={() => resolver(s.id, 'rechazar')} className="bg-rose-700 text-white rounded-lg p-2 disabled:opacity-40">Rechazar</button></>}
        {s.solicitanteUid === usuario?.uid && <button disabled={ocupado} onClick={() => resolver(s.id, 'cancelar')} className="border border-slate-300 rounded-lg p-2 disabled:opacity-40">Cancelar solicitud</button>}
      </div>
    </div>)}
    {!!cerradas.length && <details className="text-xs"><summary className="cursor-pointer text-slate-500">Historial de solicitudes resueltas ({cerradas.length})</summary><div className="mt-2 space-y-2">{cerradas.map(s => <div key={s.id} className="bg-slate-50 border rounded-xl p-3"><p className="font-semibold">{s.titulo} · {s.estado}</p><p>Solicitada por {s.solicitanteNombre} · {s.cerradaEn && new Date(s.cerradaEn).toLocaleString('es-CL')}</p><p>Resuelta por {s.resueltaPorNombre || s.resueltaPor || '—'}</p><p>Dirección: {s.firmas.Director?.nombre || '—'} · Secretaría: {s.firmas.Secretario?.nombre || '—'}</p>{s.excepcion && <p>{s.excepcion}</p>}</div>)}</div></details>}
  </section>;
}
