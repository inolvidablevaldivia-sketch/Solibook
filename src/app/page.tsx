'use client';

import React, { useState } from 'react';
import { AppProvider } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { ModalNotificaciones } from '@/components/ModalNotificaciones';
import { VistaAgenda } from '@/components/VistaAgenda';
import { VistaAsistencia } from '@/components/VistaAsistencia';
import { VistaDirectorio } from '@/components/VistaDirectorio';
import { VistaCartas } from '@/components/VistaCartas';
import { VistaActas } from '@/components/VistaActas';
import { VistaDashboardPC } from '@/components/VistaDashboardPC';

export default function Home() {
  const [vistaActual, setVistaActual] = useState<string>('agenda');
  const [eventoParaAsistencia, setEventoParaAsistencia] = useState<string | undefined>(undefined);
  const [modalNotificacionesAbierto, setModalNotificacionesAbierto] = useState(false);
  const [solicitarNuevoEvento, setSolicitarNuevoEvento] = useState(0);

  const irAPasarLista = (eventoId: string) => {
    setEventoParaAsistencia(eventoId);
    setVistaActual('asistencia');
  };

  return (
    <AppProvider>
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased selection:bg-sky-100 selection:text-[#0077B6]">
        {/* Cabecera Fija */}
        <Header
          vistaActual={vistaActual}
          setVistaActual={setVistaActual}
          onAbrirNotificaciones={() => setModalNotificacionesAbierto(true)}
        />

        {/* Contenedor Principal */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
          {vistaActual === 'agenda' && (
            <VistaAgenda onIniciarAsistencia={irAPasarLista} solicitarNuevoEvento={solicitarNuevoEvento} />
          )}

          {vistaActual === 'asistencia' && (
            <VistaAsistencia
              eventoIdInicial={eventoParaAsistencia}
              onVolver={() => {
                setEventoParaAsistencia(undefined);
                setVistaActual('agenda');
              }}
              onCrearEvento={() => {
                setSolicitarNuevoEvento(n => n + 1);
                setVistaActual('agenda');
              }}
            />
          )}

          {vistaActual === 'directorio' && <VistaDirectorio />}

          {vistaActual === 'cartas' && (
            <VistaCartas onCrearEventoDesdeCarta={() => setVistaActual('agenda')} />
          )}

          {vistaActual === 'actas' && <VistaActas />}

          {vistaActual === 'dashboard' && <VistaDashboardPC />}
        </main>

        {/* Barra de Navegación Inferior (Móvil PWA) */}
        <BottomNav vistaActual={vistaActual} setVistaActual={setVistaActual} />

        {/* Centro de Notificaciones y Acuse de Recibo */}
        <ModalNotificaciones
          isOpen={modalNotificacionesAbierto}
          onClose={() => setModalNotificacionesAbierto(false)}
          onIrAEvento={() => setVistaActual('agenda')}
        />
      </div>
    </AppProvider>
  );
}
