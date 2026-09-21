'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { diasRestantes, estadoVigente, fichaDesdeCuenta, sugerirFicha } from '@/lib/ingresos';
import type { Cuerda, UsuarioApp } from '@/types';
import { Inbox, UserCheck, UserX, Link2, Clock, ChevronDown } from 'lucide-react';

const CUERDAS: Cuerda[] = ['Soprano', 'Contralto', 'Tenor', 'Bajo', 'Solista', 'Directiva'];

/**
 * Ingresos que llegaron con su cuenta de Google y todavía no fueron aceptados.
 * Mientras Dirección o Secretaría no decidan, la persona no ve nada del
 * ministerio; por eso esta pantalla es la única que tienen a mano quien acepta.
 * Aceptar nunca es un clic a ciegas: se muestra la ficha que ya existe (si la
 * hay) y se puede crear una con los datos de la cuenta, para que nadie quede
 * fuera del libro y de las estadísticas.
 */
export const SeccionIngresos: React.FC = () => {
  const { usuarios, puedeAceptarIngresos, aceptarIngreso, rechazarIngreso } = useAuth();
  const { integrantes } = useApp();

  const [abierto, setAbierto] = useState('');
  const [cuerda, setCuerda] = useState<Cuerda>('Directiva');
  const [iglesia, setIglesia] = useState('');
  // Ficha elegida por ingreso; si está vacía se crea una ficha nueva.
  const [elegida, setElegida] = useState<Record<string, string>>({});

  if (!puedeAceptarIngresos) return null;

  const pendientes = usuarios.filter(u => estadoVigente(u) === 'Pendiente');
  const vencidos = usuarios.filter(u => estadoVigente(u) === 'Sin respuesta');
  const enlazados = new Set(usuarios.map(u => u.integranteId).filter(Boolean) as string[]);
  const fichasLibres = integrantes
    .filter(i => !enlazados.has(i.id))
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

  if (pendientes.length === 0 && vencidos.length === 0) return null;

  const ficha = (cuenta: UsuarioApp) => sugerirFicha(cuenta, integrantes.filter(i => !enlazados.has(i.id)));

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-amber-100 bg-amber-50/60 flex items-start gap-2.5">
        <Inbox className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Ingresos por aceptar {pendientes.length > 0 && <span className="text-amber-700">({pendientes.length})</span>}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Se necesitan Dirección o Secretaría para aceptar a quien llega con su cuenta. Sin aceptar, la persona no
            ve la agenda. Si en 30 días nadie responde, el pedido queda como «sin respuesta».
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {pendientes.map(u => {
          const sugerida = ficha(u);
          const seleccion = elegida[u.uid] ?? sugerida?.id ?? '';
          const dias = diasRestantes(u);
          const abiertoAqui = abierto === u.uid;
          return (
            <div key={u.uid} className="p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{u.nombre}</p>
                  <p className="text-[10px] text-slate-400 truncate">{u.email || 'sin correo'}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    pidió acceso {u.fechaIngreso ? new Date(u.fechaIngreso).toLocaleDateString('es-CL') : 'hoy'} ·{' '}
                    {dias > 0 ? `quedan ${dias} días` : 'vence hoy'}
                  </p>
                </div>
                <button
                  onClick={() => setAbierto(abiertoAqui ? '' : u.uid)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"
                >
                  Resolver
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abiertoAqui ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {sugerida && (
                <p className="flex items-center gap-1 text-[11px] text-emerald-700">
                  <Link2 className="w-3 h-3" />
                  Ya existe la ficha de {sugerida.nombreCompleto} ({sugerida.cuerda}) — se le vinculará la cuenta.
                </p>
              )}

              {abiertoAqui && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      Ficha del integrante
                    </label>
                    <select
                      value={seleccion}
                      onChange={e => setElegida(prev => ({ ...prev, [u.uid]: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">Crear ficha nueva con estos datos</option>
                      {fichasLibres.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.nombreCompleto} — {i.cuerda}
                        </option>
                      ))}
                      {sugerida && seleccion === sugerida.id && !fichasLibres.some(i => i.id === sugerida.id) && (
                        <option value={sugerida.id}>{sugerida.nombreCompleto} — sugerida</option>
                      )}
                    </select>
                  </div>

                  {seleccion === '' && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={cuerda}
                        onChange={e => setCuerda(e.target.value as Cuerda)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      >
                        {CUERDAS.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <input
                        value={iglesia}
                        onChange={e => setIglesia(e.target.value)}
                        placeholder="Iglesia (opcional)"
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const nueva = seleccion === '' ? fichaDesdeCuenta(u, { cuerda, iglesia }) : undefined;
                        aceptarIngreso(u.uid, { integranteId: seleccion || undefined, nuevaFicha: nueva });
                        setAbierto('');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {seleccion ? 'Aceptar y vincular ficha' : 'Aceptar y crear ficha'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Rechazar el ingreso de ${u.nombre}? La cuenta quedará suspendida.`)) {
                          rechazarIngreso(u.uid);
                          setAbierto('');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-700 text-[11px] font-bold rounded-lg hover:bg-rose-50"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Rechazar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {vencidos.length > 0 && (
          <div className="p-3.5 bg-slate-50/70">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Sin respuesta</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {vencidos.map(v => v.nombre).join(', ')} {vencidos.length === 1 ? 'dejó pasar' : 'dejaron pasar'} los 30
              días. No se borró nada: si vuelven a entrar, el pedido reaparece aquí para retomarlo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
