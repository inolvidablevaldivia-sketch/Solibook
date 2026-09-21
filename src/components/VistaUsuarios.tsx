'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { RolUsuario } from '@/types';
import { ROLES, ROLES_SUPERIORES, DESCRIPCION_ROL, MATRIZ_PERMISOS, ETIQUETA_PERMISO } from '@/lib/permisos';
import { LISTA_ATRIBUTOS, atribucionVigente, etiquetaAtributo, esAtributoDelicado } from '@/lib/atributos';
import { puedeOfrecerCargo } from '@/lib/traspasos';
import { estadoVigente } from '@/lib/ingresos';
import { SeccionIngresos } from './SeccionIngresos';
import { Users, ShieldCheck, UserX, UserCheck, Link2, Ban, LogOut, Wrench, Crown, X, Sparkles } from 'lucide-react';

export const VistaUsuarios: React.FC = () => {
  const { integrantes, cantidadDatosDemoEnUso } = useApp();
  const {
    usuario,
    usuarios,
    cambiarRol,
    activarUsuario,
    vincularIntegrante,
    cerrarSesion,
    modoLocal,
    puede,
    puedeAdministrarCuenta,
    esSuperAdmin,
    esFundador,
    otorgarAtribucion,
    revocarAtribucion,
    ofrecerCargo
  } = useAuth();

  // `ver_cuentas` deja mirar el padrón de cuentas sin tocar nada: es lo que
  // necesita un Vocal para saber quién está activo, sin poder cambiar cargos.
  const soloLectura = !puede('gestionar_usuarios');
  const puedeOfrecer = puedeOfrecerCargo(usuario ?? undefined, esFundador);

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

      <SeccionIngresos />

      {soloLectura && (
        <p className="text-[11px] text-slate-500 bg-white border border-slate-200/80 rounded-2xl p-3">
          Puedes ver las cuentas y sus cargos, no cambiarlas. Para nombrar un cargo o conceder una atribución
          escribe a Dirección.
        </p>
      )}

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
          const pendientes = estadoVigente(u) === 'Pendiente';
          const vigentes = (u.atribuciones || []).filter(a => atribucionVigente(a));
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
                      // Director y Desarrollador solo los nombra quien opera con
                      // permisos de Desarrollador (incluido el Director fundador).
                      <option key={r} value={r} disabled={!esSuperAdmin && ROLES_SUPERIORES.includes(r) && r !== u.rol}>
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
                        ? 'Solo el Desarrollador o el Director fundador administran cuentas de nivel Director o Desarrollador'
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

              {u.aceptadoPor && (
                <p className="text-[10px] text-slate-400">
                  Aceptado por {u.aceptadoPor.nombre} ({u.aceptadoPor.rol}) ·{' '}
                  {u.aceptadoPor.fecha ? new Date(u.aceptadoPor.fecha).toLocaleDateString('es-CL') : 'sin fecha'}
                </p>
              )}

              {/* Atribuciones: lo que el cargo no da y se suma a pedido expreso. */}
              <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <Sparkles className="w-3 h-3" /> Atribuciones
                </p>
                {vigentes.length === 0 ? (
                  <p className="text-[10px] text-slate-400">Ninguna: actúa sólo con lo que da su cargo.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {vigentes.map(a => (
                      <span
                        key={a.atributo}
                        title={`${a.otorgadoPor?.nombre || 'sin constancia'} · ${a.motivo || 'sin motivo anotado'}`}
                        className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 border border-violet-200 text-violet-800 rounded-lg text-[10px] font-semibold"
                      >
                        {etiquetaAtributo(a.atributo)}
                        {a.hasta ? ` · hasta ${a.hasta}` : ''}
                        {!soloLectura && !propio && (
                          <button
                            onClick={() => revocarAtribucion(u.uid, a.atributo)}
                            title="Retirar la atribución"
                            className="text-violet-500 hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {!soloLectura && !propio && !pendientes && (
                  <select
                    value=""
                    onChange={e => {
                      const atributo = e.target.value;
                      if (!atributo) return;
                      const aviso = otorgarAtribucion(u.uid, atributo, { motivo: `Concedida por ${usuario?.nombre || 'la directiva'}` });
                      if (aviso) alert(aviso);
                    }}
                    className="w-full px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-xl bg-white text-slate-600"
                  >
                    <option value="">Sumar una atribución…</option>
                    {LISTA_ATRIBUTOS.map(a => (
                      <option key={a} value={a} disabled={!esSuperAdmin && esAtributoDelicado(a)}>
                        {etiquetaAtributo(a)}
                        {!esSuperAdmin && esAtributoDelicado(a) ? ' · solo fundador o Desarrollador' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Traspaso de Dirección: se ofrece, el otro acepta en 24 horas. */}
              {puedeOfrecer && !propio && u.activo && !pendientes && (
                <button
                  onClick={() => {
                    if (confirm(`¿Ofrecerle la Dirección a ${u.nombre}? Queda como Director si acepta dentro de 24 horas; tú pasas a Miembro ordinario.`)) {
                      void ofrecerCargo(u.uid).then(mensaje => { if (mensaje) alert(mensaje); });
                    }
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-900"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Ofrecerle la Dirección
                </button>
              )}
              {u.ofertaDirector?.estado === 'Pendiente' && (
                <p className="text-[10px] text-amber-700">
                  Oferta de Dirección enviada a {u.nombre}: {u.ofertaDirector.expiraEn ? `vence el ${new Date(u.ofertaDirector.expiraEn).toLocaleString('es-CL')}` : 'pendiente'}.
                </p>
              )}
              {u.ultimoTraspaso && (
                <p className="text-[10px] text-slate-400">
                  Última constancia de traspaso: {u.ultimoTraspaso.desdeNombre} → {u.ultimoTraspaso.haciaNombre} ·{' '}
                  {new Date(u.ultimoTraspaso.aceptadaEn || 0).toLocaleDateString('es-CL')}
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

      {/* Mantenimiento: la app ya no trae datos de ejemplo, pero los equipos
          que sincronizaron la demostración antigua necesitan retirarla. */}
      {puede('gestionar_usuarios') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-500" />
              Mantenimiento
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Datos de demostración</p>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              La limpieza masiva anterior se retiró para no saltarse las autorizaciones.
              Para eliminar registros de ejemplo, usa Eliminar desde el libro correspondiente;
              se aplican las mismas firmas y excepciones que a los demás registros.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {cantidadDatosDemoEnUso > 0 && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">
                  {cantidadDatosDemoEnUso} en pantalla
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
