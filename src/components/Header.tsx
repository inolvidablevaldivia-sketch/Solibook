'use client';

import React from 'react';
import { SoliDeoLogo } from './SoliDeoLogo';
import { useApp } from '@/context/AppContext';
import { RefreshCw, Bell, Shield, Calendar, Users, FileText, Mail, CheckCircle2, LayoutDashboard } from 'lucide-react';

interface HeaderProps {
  onAbrirNotificaciones: () => void;
  vistaActual: string;
  setVistaActual: (v: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onAbrirNotificaciones, vistaActual, setVistaActual }) => {
  const { forzarActualizacionApp, notificaciones, usuarioActivo, setUsuarioActivo } = useApp();

  const noLeidas = notificaciones.filter(n => !n.leido).length;

  const alternarRol = () => {
    if (usuarioActivo.rol === 'Administración') {
      setUsuarioActivo({ nombre: 'Directiva Ministerial', rol: 'Directiva', iniciales: 'DM' });
    } else if (usuarioActivo.rol === 'Directiva') {
      setUsuarioActivo({ nombre: 'Secretaría de Actas', rol: 'Secretaría', iniciales: 'SA' });
    } else {
      setUsuarioActivo({ nombre: 'Pastoral & Secretaría General', rol: 'Administración', iniciales: 'SG' });
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] px-4 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Marca Oficial */}
        <div 
          className="cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setVistaActual('agenda')}
        >
          <SoliDeoLogo size={34} />
        </div>

        {/* Selector de Vistas Rápido en Desktop */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs font-medium text-slate-600">
          <button
            onClick={() => setVistaActual('agenda')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              vistaActual === 'agenda' ? 'bg-white text-[#0099DD] font-semibold shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Agenda
          </button>
          <button
            onClick={() => setVistaActual('asistencia')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              vistaActual === 'asistencia' ? 'bg-white text-[#0099DD] font-semibold shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Asistencia
          </button>
          <button
            onClick={() => setVistaActual('directorio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              vistaActual === 'directorio' ? 'bg-white text-[#0099DD] font-semibold shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Miembros
          </button>
          <button
            onClick={() => setVistaActual('cartas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              vistaActual === 'cartas' ? 'bg-white text-[#0099DD] font-semibold shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Cartas
          </button>
          <button
            onClick={() => setVistaActual('actas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              vistaActual === 'actas' ? 'bg-white text-[#0099DD] font-semibold shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Actas
          </button>
          <button
            onClick={() => setVistaActual('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              vistaActual === 'dashboard' ? 'bg-[#8B1E2B] text-white font-semibold shadow-xs' : 'hover:text-[#8B1E2B]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Consola PC / Excel
          </button>
        </nav>

        {/* Acciones Superiores: PWA Refresh, Campanita, Selector de Rol */}
        <div className="flex items-center gap-2">
          {/* Botón PWA: Forzar versión fresca / Limpiar Caché */}
          <button
            onClick={() => {
              if (confirm('¿Deseas refrescar la aplicación y limpiar la memoria caché para cargar la última versión fresca?')) {
                forzarActualizacionApp();
              }
            }}
            title="Refrescar aplicación y limpiar caché PWA"
            className="p-2 text-slate-500 hover:text-[#0099DD] hover:bg-sky-50 rounded-lg transition-colors border border-slate-200/60"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Campanita de Notificaciones con Badge */}
          <button
            onClick={onAbrirNotificaciones}
            title="Notificaciones y Avisos"
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/60"
          >
            <Bell className="w-4 h-4" />
            {noLeidas > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#8B1E2B] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {noLeidas}
              </span>
            )}
          </button>

          {/* Selector interactivo de Rol / Usuario */}
          <div
            onClick={alternarRol}
            title="Haz clic para alternar rol de prueba (Admin / Directiva / Secretaría)"
            className="flex items-center gap-2 pl-2 pr-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl cursor-pointer transition-all select-none"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#8B1E2B] to-[#b91c1c] text-white text-xs font-bold flex items-center justify-center shadow-xs">
              {usuarioActivo.iniciales}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                {usuarioActivo.rol}
              </span>
              <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                <Shield className="w-2.5 h-2.5 text-emerald-500" />
                Cambiar rol
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
