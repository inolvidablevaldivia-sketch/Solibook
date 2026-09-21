'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Home,
  Calendar,
  CheckSquare,
  BookOpen,
  LayoutDashboard,
  Building2,
  LucideIcon
} from 'lucide-react';

interface BottomNavProps {
  vistaActual: string;
  setVistaActual: (v: string) => void;
}

interface TabDefinicion {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const BottomNav: React.FC<BottomNavProps> = ({ vistaActual, setVistaActual }) => {
  // Mismo filtro que la cabecera de escritorio: nadie ve una solapa que no puede
  // usar. «Cuentas» aparece para quien puede gestionlas y también para quien sólo
  // puede mirarlas (el Vocal).
  const { puede } = useAuth();
  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'asistencia', label: 'Asistencia', icon: CheckSquare },
    { id: 'libros', label: 'Libros', icon: BookOpen },
    { id: 'dashboard', label: 'Métricas', icon: LayoutDashboard },
    { id: 'usuarios', label: 'Cuentas', icon: Building2 }
  ].filter(tab =>
    tab.id === 'inicio' ||
    (tab.id === 'agenda' && puede('ver_agenda')) ||
    (tab.id === 'asistencia' && (puede('pasar_lista') || puede('finalizar_lista'))) ||
    (tab.id === 'libros' &&
      (puede('ver_miembros') || puede('ver_cartas') || puede('ver_actas') || puede('ver_documentos'))) ||
    (tab.id === 'dashboard' && puede('ver_metricas')) ||
    (tab.id === 'usuarios' && (puede('gestionar_usuarios') || puede('ver_cuentas')))
  ) as TabDefinicion[];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] px-2 py-1.5 lg:hidden">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = vistaActual === tab.id;
          const isMetricas = tab.id === 'dashboard';

          return (
            <button
              key={tab.id}
              onClick={() => setVistaActual(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                isActive
                  ? isMetricas
                    ? 'text-[#8B1E2B] font-semibold'
                    : 'text-[#0099DD] font-semibold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-all ${
                  isActive ? (isMetricas ? 'bg-rose-50' : 'bg-sky-50') : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2px]' : 'stroke-[1.5px]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
