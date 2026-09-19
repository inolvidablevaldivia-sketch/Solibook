'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { SoliDeoLogo } from './SoliDeoLogo';
import { ShieldCheck, Loader2, AlertTriangle, WifiOff, Ban } from 'lucide-react';

export const PantallaLogin: React.FC = () => {
  const { iniciarSesionGoogle, entrarModoLocal, cargando, error, authDisponible, usuario } = useAuth();

  // Acceso suspendido: el usuario existe pero fue desactivado por la directiva
  if (usuario && !usuario.activo) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 max-w-sm w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto">
            <Ban className="w-6 h-6 text-[#8B1E2B]" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Acceso suspendido</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tu cuenta está desactivada. Contacta a la directiva o a la secretaría del ministerio para
            restablecer el acceso.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 max-w-sm w-full space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <SoliDeoLogo size={44} showSubtitle={false} />
          <div>
            <h1 className="text-sm font-bold text-slate-900">Gestión Administrativa</h1>
            <p className="text-xs text-slate-500 mt-1">
              Ministerio Vocal Solí Deo
            </p>
          </div>
        </div>

        <button
          onClick={iniciarSesionGoogle}
          disabled={cargando}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0099DD] hover:bg-[#0088cc] disabled:opacity-60 text-white text-xs font-bold transition-colors"
        >
          {cargando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Continuar con Google
            </>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-800 leading-relaxed">{error}</p>
          </div>
        )}

        {!authDisponible && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <WifiOff className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Firebase Authentication no está disponible en este momento.
            </p>
          </div>
        )}

        <div className="pt-1 border-t border-slate-100 space-y-2">
          <button
            onClick={entrarModoLocal}
            className="w-full text-center text-[11px] font-semibold text-slate-500 hover:text-[#0099DD] transition-colors"
          >
            Continuar sin conexión
          </button>
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            La sesión queda guardada en este dispositivo. El acceso con Google requiere que el dominio
            esté autorizado en Firebase Authentication.
          </p>
        </div>
      </div>
    </div>
  );
};
