'use client';

import React from 'react';
import { Calendar, CheckSquare, Users, Mail, FileText, LayoutDashboard } from 'lucide-react';

interface BottomNavProps {
  vistaActual: string;
  setVistaActual: (v: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ vistaActual, setVistaActual }) => {
  const tabs = [
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'asistencia', label: 'Asistencia', icon: CheckSquare },
    { id: 'directorio', label: 'Miembros', icon: Users },
    { id: 'cartas', label: 'Cartas', icon: Mail },
    { id: 'actas', label: 'Actas', icon: FileText },
    { id: 'dashboard', label: 'Consola', icon: LayoutDashboard }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] px-2 py-1.5 lg:hidden">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = vistaActual === tab.id;
          const isDashboard = tab.id === 'dashboard';

          return (
            <button
              key={tab.id}
              onClick={() => setVistaActual(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                isActive
                  ? isDashboard
                    ? 'text-[#8B1E2B] font-semibold'
                    : 'text-[#0099DD] font-semibold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-all ${
                  isActive
                    ? isDashboard
                      ? 'bg-rose-50'
                      : 'bg-sky-50'
                    : ''
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
