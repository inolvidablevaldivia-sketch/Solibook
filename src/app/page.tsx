'use client';

import React, { useState, useEffect } from 'react';
import { AppProvider } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { ModalNotificaciones } from '@/components/ModalNotificaciones';
import { PantallaLogin } from '@/components/PantallaLogin';
import { VistaInicio } from '@/components/VistaInicio';
import { VistaAgenda } from '@/components/VistaAgenda';
import { VistaAsistencia } from '@/components/VistaAsistencia';
import { VistaLibros } from '@/components/VistaLibros';
import { VistaDirectorio } from '@/components/VistaDirectorio';
import { VistaCartas } from '@/components/VistaCartas';
import { VistaActas } from '@/components/VistaActas';
import { VistaDocumentos } from '@/components/VistaDocumentos';
import { VistaUsuarios } from '@/components/VistaUsuarios';
import { VistaDashboardPC } from '@/components/VistaDashboardPC';
import { Loader2, Lock } from 'lucide-react';

const AppShell: React.FC = () => {
  const { usuario, cargando, puede } = useAuth();

  const [vistaActual, setVistaActual] = useState<string>('inicio');
  const [eventoParaAsistencia, setEventoParaAsistencia] = useState<string | undefined>(undefined);
  const [modalNotificacionesAbierto, setModalNotificacionesAbierto] = useState(false);
  const [solicitarNuevoEvento, setSolicitarNuevoEvento] = useState(0);

  const irAPasarLista = (eventoId: string) => {
    setEventoParaAsistencia(eventoId);
    setVistaActual('asistencia');
  };

  // Cada vista exige su permiso; si el rol no lo tiene se muestra un aviso.
  const permisoDeVista: Record<string, () => boolean> = {
    agenda: () => puede('ver_agenda'),
    asistencia: () => puede('ver_agenda'),
    libros: () => puede('ver_miembros') || puede('ver_cartas') || puede('ver_actas') || puede('ver_documentos'),
    directorio: () => puede('ver_miembros'),
    cartas: () => puede('ver_cartas'),
    actas: () => puede('ver_actas'),
    documentos: () => puede('ver_documentos'),
    dashboard: () => puede('ver_metricas'),
    usuarios: () => puede('gestionar_usuarios')
  };

  // Al cambiar de rol, si la vista abierta deja de estar permitida se vuelve al inicio
  useEffect(() => {
    const validador = permisoDeVista[vistaActual];
    if (validador && !validador()) setVistaActual('inicio');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.rol, usuario?.activo, vistaActual]);

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-[#0099DD]" />
          <span className="text-xs font-semibold">Cargando Solibook...</span>
        </div>
      </div>
    );
  }

  // Sin sesión, o con la cuenta suspendida, se muestra la pantalla de acceso
  if (!usuario || !usuario.activo) {
    return <PantallaLogin />;
  }

  const validadorActual = permisoDeVista[vistaActual];
  const tieneAcceso = !validadorActual || validadorActual();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased selection:bg-sky-100 selection:text-[#0077B6]">
      {/* Cabecera Fija */}
      <Header
        vistaActual={vistaActual}
        setVistaActual={setVistaActual}
        onAbrirNotificaciones={() => setModalNotificacionesAbierto(true)}
      />

      {/* Contenedor Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        {!tieneAcceso ? (
          <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-5 h-5 text-slate-400" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Sección restringida</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Tu rol actual no tiene permiso para acceder a esta sección. Solicita el acceso a la
              directiva del ministerio.
            </p>
            <button
              onClick={() => setVistaActual('inicio')}
              className="mt-4 px-4 py-2 rounded-xl bg-[#0099DD] hover:bg-[#0088cc] text-white text-xs font-bold transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        ) : (
          <>
            {vistaActual === 'inicio' && (
              <VistaInicio setVistaActual={setVistaActual} onIniciarAsistencia={irAPasarLista} />
            )}

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

            {vistaActual === 'libros' && (
              <VistaLibros onCrearEventoDesdeCarta={() => setVistaActual('agenda')} />
            )}

            {vistaActual === 'dashboard' && <VistaDashboardPC />}

            {/* Vistas alcanzables desde dentro de Libros y desde el Header */}
            {vistaActual === 'directorio' && <VistaDirectorio />}
            {vistaActual === 'cartas' && (
              <VistaCartas onCrearEventoDesdeCarta={() => setVistaActual('agenda')} />
            )}
            {vistaActual === 'actas' && <VistaActas />}
            {vistaActual === 'documentos' && <VistaDocumentos />}
            {vistaActual === 'usuarios' && <VistaUsuarios />}
          </>
        )}
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
  );
};

export default function Home() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </AuthProvider>
  );
}
