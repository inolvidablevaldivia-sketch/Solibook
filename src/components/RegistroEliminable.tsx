'use client';
import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useEliminaciones } from '@/context/EliminacionesContext';
import { usePulsacionLarga } from '@/lib/usePulsacionLarga';
import { puedeSolicitarEliminacion, type TipoEliminacion } from '@/lib/eliminaciones';

export function RegistroEliminable({ tipo, registroId, titulo, children }: { tipo: TipoEliminacion; registroId: string; titulo: string; children: React.ReactNode }) {
  const { usuario } = useAuth();
  const { solicitar, bloqueado, ocupado } = useEliminaciones();
  const [menu, setMenu] = useState(false);
  const permitido = puedeSolicitarEliminacion(usuario?.rol || '', tipo);
  const pulsacion = usePulsacionLarga(() => { if (permitido) setMenu(true); });
  const pendiente = bloqueado(tipo, registroId);
  return <div
    className="relative accion-mantener"
    {...pulsacion.manejadores}
    onClickCapture={e => {
      if (pulsacion.fuePulsacionLarga()) { e.preventDefault(); e.stopPropagation(); pulsacion.reiniciar(); }
    }}
  >
    {children}
    {(permitido || pendiente) && <div className="flex items-center justify-between gap-2 mt-1 px-2 text-xs">
      <span className={pendiente ? 'text-amber-800' : 'text-slate-400'}>{pendiente ? 'Eliminación pendiente · registro protegido' : 'Mantén presionado para más opciones'}</span>
      {permitido && <button type="button" aria-label={`Opciones de ${titulo}`} aria-expanded={menu} onClick={() => setMenu(!menu)} className="rounded-lg p-1 hover:bg-slate-100"><MoreHorizontal size={18} /></button>}
    </div>}
    {menu && <div className="border border-slate-200 bg-white rounded-xl p-2 mt-1 shadow-sm flex gap-2">
      <button type="button" disabled={ocupado || pendiente} onClick={() => { setMenu(false); void solicitar(tipo, registroId, titulo); }} className="flex items-center gap-2 text-xs font-semibold text-rose-700 p-2 disabled:opacity-40"><Trash2 size={16} />Eliminar</button>
      <button type="button" onClick={() => setMenu(false)} className="p-2 text-xs text-slate-500">Cerrar</button>
    </div>}
  </div>;
}
