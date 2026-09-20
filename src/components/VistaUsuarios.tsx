'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { RolUsuario } from '@/types';
import { ROLES, DESCRIPCION_ROL, MATRIZ_PERMISOS, ETIQUETA_PERMISO } from '@/lib/permisos';
import { Users, ShieldCheck, UserX, UserCheck, Link2, Ban, LogOut } from 'lucide-react';

export const VistaUsuarios: React.FC = () => {
  const { integrantes } = useApp();
  const {
    usuario,
    usuarios,
    cambiarRol,
    activarUsuario,
    vincularIntegrante,
    cerrarSesion,
    modoLocal,
    puedeAdministrarCuenta
  } = useAuth();

  const esUnoMismo = (uid: string) => usuario?.uid === uid;

  return (
    <div className="space-y-3 max-w-3xl mx-auto pb-16">
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0099DD]" />
            Usuarios y Permisos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {usuarios.length} {usuarios.length === 1 ? 'usuario registrado' : 'usuarios registrados'}
            {modoLocal ? ' · sesión local' : ''}
          </p>
        </div>
        <button
          onClick={cerrarSesion}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-[#8B1E2B] border border-slate-200 rounded-xl transition-colors shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          Salir
        </button>
      </div>

      {/* Listado de usuarios */}
      <div className="space-y-2">
        {usuarios.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <Users className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Aún no hay usuarios registrados.</p>
          </div>
        )}

        {usuarios.map(u => {
          const propio = esUnoMismo(u.uid);
          return (
            <div
              key={u.uid}
              className={`bg-white rounded-2xl border p-3.5 space-y-3 ${
                u.activo ? 'border-slate-200/80' : 'border-rose-200 bg-rose-50/20'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  {u.fotoUrl ? (
                    <img
                      src={u.fotoUrl}
                      alt={u.nombre}
                      className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {u.nombre}
                      {propio && (
                        <span className="ml-1.5 text-[10px] font-semibold text-[#0077B6] bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded">
                          Tú
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {u.email || 'Sin correo registrado'}
                    </p>
                  </div>
                </div>

                {!u.activo && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#8B1E2B] bg-rose-100 px-2 py-0.5 rounded-lg shrink-0">
                    <Ban className="w-3 h-3" />
                    Suspendido
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Rol
                  </label>
                  <select
                    value={u.rol}
                    disabled={propio || !puedeAdministrarCuenta(u.uid)}
                    onChange={e => cambiarRol(u.uid, e.target.value as RolUsuario)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Ficha de miembro vinculada
                  </label>
                  <select
                    value={u.integranteId || ''}
                    disabled={!puedeAdministrarCuenta(u.uid)}
                    onChange={e => vincularIntegrante(u.uid, e.target.value || undefined)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">Sin vincular</option>
                    {integrantes
                      .slice()
                      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
                      .map(i => (
                        <option key={i.id} value={i.id}>
                          {i.nombreCompleto}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 leading-relaxed pr-2">
                  {DESCRIPCION_ROL[u.rol]}
                </p>
                <button
                  disabled={propio || !puedeAdministrarCuenta(u.uid)}
                  onClick={() => activarUsuario(u.uid, !u.activo)}
                  title={
                    propio
                      ? 'No puedes suspender tu propia cuenta'
                      : !puedeAdministrarCuenta(u.uid)
                        ? 'Solo el Desarrollador administra cuentas de nivel Director o Desarrollador'
                        : undefined
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-colors shrink-0 ${
                    propio || !puedeAdministrarCuenta(u.uid)
                      ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                      : u.activo
                        ? 'text-[#8B1E2B] border-rose-200 hover:bg-rose-50'
                        : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  {u.activo ? (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      Suspender
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      Reactivar
                    </>
                  )}
                </button>
              </div>

              {u.integranteId && (
                <p className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Link2 className="w-3 h-3" />
                  Vinculado a{' '}
                  {integrantes.find(i => i.id === u.integranteId)?.nombreCompleto || 'ficha eliminada'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Matriz de permisos por rol */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Matriz de permisos</h3>
          <p className="text-xs text-slate-400 mt-0.5">Permisos incluidos en cada rol</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="p-3 min-w-[200px]">Permiso</th>
                {ROLES.map(r => (
                  <th key={r} className="p-3 text-center min-w-[90px]">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(Object.keys(ETIQUETA_PERMISO) as (keyof typeof ETIQUETA_PERMISO)[]).map(permiso => (
                <tr key={permiso} className="hover:bg-slate-50/60">
                  <td className="p-3 font-semibold text-slate-700">{ETIQUETA_PERMISO[permiso]}</td>
                  {ROLES.map(r => (
                    <td key={r} className="p-3 text-center">
                      {MATRIZ_PERMISOS[r].includes(permiso) ? (
                        <span className="text-emerald-600 font-bold">Sí</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
