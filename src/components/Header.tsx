'use client';

import React from 'react';
import { useAjustes } from '@/context/AjustesContext';
import { SoliDeoLogo } from './SoliDeoLogo';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import {
  Bell,
  Shield,
  Calendar,
  CheckSquare,
  BookOpen,
  Home,
  LayoutDashboard,
  Building2
} from 'lucide-react';

interface HeaderProps {
  onAbrirNotificaciones: () => void;
  vistaActual: string;
  setVistaActual: (v: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onAbrirNotificaciones, vistaActual, setVistaActual }) => {
  const { notificaciones } = useApp();
  const { usuario, puede } = useAuth();

  const { ajustes } = useAjustes();
  const noLeidas = notificaciones.filter(n => !n.leido).length;

  // Cada solapa aparece sólo si el cargo (o la atribución sumada) la habilita.
  // Así un Miembro no ve «Asistencia» para chocar después con un acceso negado.
  const navegacion = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'asistencia', label: 'Asistencia', icon: CheckSquare },
    { id: 'libros', label: 'Libros', icon: BookOpen },
    { id: 'dashboard', label: 'Métricas', icon: LayoutDashboard }
  ].filter(item =>
    item.id === 'inicio' ||
    (item.id === 'agenda' && puede('ver_agenda')) ||
    (item.id === 'asistencia' && (puede('pasar_lista') || puede('finalizar_lista'))) ||
    (item.id === 'libros' &&
      (puede('ver_miembros') || puede('ver_cartas') || puede('ver_actas') || puede('ver_documentos'))) ||
    (item.id === 'dashboard' && puede('ver_metricas'))
  );

  const iniciales = (usuario?.nombre || 'SD')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] px-4 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Marca Oficial */}
        <div
          className="cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setVistaActual('inicio')}
        >
          <SoliDeoLogo size={34} />
        </div>

        {/* Selector de Vistas Rápido en Desktop */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs font-medium text-slate-600">
          {navegacion.map(item => {
            const Icon = item.icon;
            const activo = vistaActual === item.id;
            const esMetricas = item.id === 'dashboard';
            return (
              <button
                key={item.id}
                onClick={() => setVistaActual(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activo
                    ? esMetricas
                      ? 'bg-white text-[#8B1E2B] font-semibold shadow-xs'
                      : 'bg-white text-[#0099DD] font-semibold shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}

          {(puede('gestionar_usuarios') || puede('ver_cuentas')) && (
            <button
              onClick={() => setVistaActual('usuarios')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                vistaActual === 'usuarios'
                  ? 'bg-white text-[#0077B6] font-semibold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              {puede('gestionar_usuarios') ? 'Usuarios' : 'Cuentas'}
            </button>
          )}
        </nav>

        {/* Acciones Superiores */}
        <div className="flex items-center gap-2">
          {/* Campanita de Notificaciones con Badge */}
          <button
            onClick={onAbrirNotificaciones}
            title="Notificaciones y Avisos"
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/60"
          >
            <Bell className="w-4 h-4" />
            {noLeidas > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#8B1E2B] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {noLeidas}
              </span>
            )}
          </button>

          {/* Usuario autenticado */}
          <button onClick={() => setVistaActual('ajustes')} title="Mi perfil y ajustes" aria-label="Mi perfil y ajustes" className="flex items-center gap-2 pl-2 pr-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-xl select-none">
            {usuario?.fotoUrl ? (
              <img
                src={usuario.fotoUrl}
                alt={usuario.nombre}
                className="w-7 h-7 rounded-lg object-cover border border-slate-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#8B1E2B] to-[#b91c1c] text-white text-xs font-bold flex items-center justify-center">
                {iniciales || 'SD'}
              </div>
            )}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                {usuario?.rol || 'Sin sesión'}
              </span>
              <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                <Shield className="w-2.5 h-2.5 text-emerald-500" />
                {ajustes.nombrePrivado || usuario?.nombre || 'No autenticado'}
              </span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
