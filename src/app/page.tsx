'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EliminacionesProvider } from '@/context/EliminacionesContext';
import { AppProvider } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AjustesProvider } from '@/context/AjustesContext';
import { VistaAjustes } from '@/components/VistaAjustes';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { ModalNotificaciones } from '@/components/ModalNotificaciones';
import { PantallaLogin } from '@/components/PantallaLogin';
import { VistaJustificar } from '@/components/VistaJustificar';
import { VistaInicio } from '@/components/VistaInicio';
import { VistaAgenda, NavegacionInicialAgenda } from '@/components/VistaAgenda';
import { VistaAsistencia } from '@/components/VistaAsistencia';
import { VistaLibros } from '@/components/VistaLibros';
import { VistaDirectorio } from '@/components/VistaDirectorio';
import { VistaCartas } from '@/components/VistaCartas';
import { VistaActas } from '@/components/VistaActas';
import { VistaDocumentos } from '@/components/VistaDocumentos';
import { VistaUsuarios } from '@/components/VistaUsuarios';
import { VistaDashboardPC } from '@/components/VistaDashboardPC';
import { Loader2, Lock, LogOut, Inbox, ShieldCheck } from 'lucide-react';
import { puedeResponder } from '@/lib/traspasos';
import { instalarEscuchaPushEnPrimerPlano } from '@/lib/notificacionesPush';

const AppShell: React.FC = () => {
  const { usuario, cargando, puede, enEspera, esperaMensaje, ofertaPendiente, responderOferta, cerrarSesion } = useAuth();

  const [vistaActual, setVistaActual] = useState<string>('inicio');
  const [eventoParaAsistencia, setEventoParaAsistencia] = useState<string | undefined>(undefined);
  const [modalNotificacionesAbierto, setModalNotificacionesAbierto] = useState(false);
  const [solicitarNuevoEvento, setSolicitarNuevoEvento] = useState(0);
  const [navegacionAgenda, setNavegacionAgenda] = useState<NavegacionInicialAgenda | undefined>(undefined);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const historialInicializado = useRef(false);
  const permitirSalida = useRef(false);

  const navegarA = useCallback((vista: string) => {
    if (vista === vistaActual) return;
    setVistaActual(vista);
    if (typeof window !== 'undefined') {
      window.history.pushState({ solibook: true, vista }, '', window.location.href);
    }
  }, [vistaActual]);

  // Una entrada de seguridad permite interceptar "Atrás" desde Inicio y pedir
  // confirmación antes de abandonar la PWA. Las vistas internas usan historial
  // real, por lo que Atrás sigue funcionando como navegación normal.
  useEffect(() => {
    if (!historialInicializado.current) {
      window.history.replaceState({ solibook: true, limiteSalida: true }, '', window.location.href);
      window.history.pushState({ solibook: true, vista: 'inicio' }, '', window.location.href);
      historialInicializado.current = true;
    }

    const manejarAtras = (event: PopStateEvent) => {
      const estado = event.state as { solibook?: boolean; vista?: string; limiteSalida?: boolean } | null;
      if (estado?.limiteSalida) {
        if (permitirSalida.current) return;
        setVistaActual('inicio');
        setConfirmarSalida(true);
        window.setTimeout(() => window.history.go(1), 0);
        return;
      }
      if (estado?.solibook && estado.vista) setVistaActual(estado.vista);
    };

    window.addEventListener('popstate', manejarAtras);
    return () => window.removeEventListener('popstate', manejarAtras);
  }, []);

  useEffect(() => {
    if (usuario?.uid) void instalarEscuchaPushEnPrimerPlano();
  }, [usuario?.uid]);

  const irAPasarLista = (eventoId: string) => {
    setEventoParaAsistencia(eventoId);
    navegarA('asistencia');
  };

  useEffect(() => {
    if (!usuario?.activo) return;
    const destino = new URLSearchParams(window.location.search).get('vista');
    if (destino !== 'agenda' && destino !== 'notificaciones') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('vista');
    window.history.replaceState(window.history.state, '', url);
    queueMicrotask(() => {
      if (destino === 'agenda') navegarA('agenda');
      else setModalNotificacionesAbierto(true);
    });
  }, [usuario?.activo, navegarA]);

  // Cada intención de navegación hacia Agenda recibe un identificador propio
  // (contador de sesión) para que Agenda sepa que es una orden nueva.
  const contadorNavegacionAgenda = useRef(0);
  const nuevaIntencionAgenda = () => {
    contadorNavegacionAgenda.current += 1;
    return contadorNavegacionAgenda.current;
  };

  const abrirAgendaFiltrada = (tipo: string) => {
    setNavegacionAgenda({ id: nuevaIntencionAgenda(), tipo });
    navegarA('agenda');
  };

  // Acceso directo de Inicio: entra a Agenda con el modal "Enviar calendario"
  // ya abierto. No cambia el filtro ni duplica el modal: Agenda reutiliza su
  // propio componente y su generador de texto para WhatsApp.
  const abrirEnviarCalendario = () => {
    setNavegacionAgenda({ id: nuevaIntencionAgenda(), abrirEnviarCalendario: true });
    navegarA('agenda');
  };

  // Cada vista exige su permiso; si el rol no lo tiene se muestra un aviso.
  const permisoDeVista: Record<string, () => boolean> = {
    agenda: () => puede('ver_agenda'),
    // Pasar lista es una tarea de gestión: quien no tiene el cupo no ve la
    // solapa, para que nadie marque asistencia «por si acaso».
    asistencia: () => puede('pasar_lista') || puede('finalizar_lista'),
    libros: () => puede('ver_miembros') || puede('ver_cartas') || puede('ver_actas') || puede('ver_documentos'),
    directorio: () => puede('ver_miembros'),
    cartas: () => puede('ver_cartas'),
    actas: () => puede('ver_actas'),
    documentos: () => puede('ver_documentos'),
    dashboard: () => puede('ver_metricas'),
    usuarios: () => puede('gestionar_usuarios') || puede('ver_cuentas')
  };

  // Al cambiar de rol, si la vista abierta deja de estar permitida se vuelve al inicio
  useEffect(() => {
    const validador = permisoDeVista[vistaActual];
    if (validador && !validador()) queueMicrotask(() => navegarA('inicio'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.rol, usuario?.activo, vistaActual, navegarA]);

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

  // Una cuenta que aún no fue aceptada no lee nada del ministerio: sólo espera.
  if (enEspera) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-5">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-5 h-5 text-amber-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Tu cuenta está en revisión</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{esperaMensaje}</p>
          <button
            onClick={cerrarSesion}
            className="mt-5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const validadorActual = permisoDeVista[vistaActual];
  const tieneAcceso = !validadorActual || validadorActual();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased selection:bg-sky-100 selection:text-[#0077B6]">
      {/* La Dirección fundada se ofrece una sola vez y vence en 24 horas: se
          avisa arriba de todo para que no pase desapercibida. */}
      {ofertaPendiente?.estado === 'Pendiente' && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-emerald-900 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
              Te ofrecen el cargo de Dirección. Tienes 24 horas para responder.
            </p>
            {puedeResponder(ofertaPendiente, usuario.uid) && (
              <span className="flex items-center gap-2">
                <button
                  onClick={() => responderOferta(true)}
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => responderOferta(false)}
                  className="px-3 py-1 bg-white border border-emerald-200 text-emerald-800 text-[11px] font-bold rounded-lg"
                >
                  Rechazar
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Cabecera Fija */}
      <Header
        vistaActual={vistaActual}
        setVistaActual={navegarA}
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
              onClick={() => navegarA('inicio')}
              className="mt-4 px-4 py-2 rounded-xl bg-[#0099DD] hover:bg-[#0088cc] text-white text-xs font-bold transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        ) : (
          <>
            {vistaActual === 'justificar' && <VistaJustificar volver={() => navegarA('inicio')} />}
            {vistaActual === 'ajustes' && <VistaAjustes key={usuario.uid} volver={() => navegarA('inicio')} />}
            {vistaActual === 'inicio' && (
              <VistaInicio
                setVistaActual={navegarA}
                onIniciarAsistencia={irAPasarLista}
                onAbrirAgendaFiltrada={abrirAgendaFiltrada}
                onEnviarCalendario={abrirEnviarCalendario}
              />
            )}

            {vistaActual === 'agenda' && (
              <VistaAgenda
                onIniciarAsistencia={irAPasarLista}
                solicitarNuevoEvento={solicitarNuevoEvento}
                navegacionInicial={navegacionAgenda}
              />
            )}

            {vistaActual === 'asistencia' && (
              <VistaAsistencia
                eventoIdInicial={eventoParaAsistencia}
                onVolver={() => {
                  setEventoParaAsistencia(undefined);
                  navegarA('agenda');
                }}
                onCrearEvento={() => {
                  setSolicitarNuevoEvento(n => n + 1);
                  navegarA('agenda');
                }}
              />
            )}

            {vistaActual === 'libros' && (
              <VistaLibros onCrearEventoDesdeCarta={() => navegarA('agenda')} />
            )}

            {vistaActual === 'dashboard' && <VistaDashboardPC />}

            {/* Vistas alcanzables desde dentro de Libros y desde el Header */}
            {vistaActual === 'directorio' && <VistaDirectorio />}
            {vistaActual === 'cartas' && (
              <VistaCartas onCrearEventoDesdeCarta={() => navegarA('agenda')} />
            )}
            {vistaActual === 'actas' && <VistaActas />}
            {vistaActual === 'documentos' && <VistaDocumentos />}
            {vistaActual === 'usuarios' && <VistaUsuarios />}
          </>
        )}
      </main>

      {confirmarSalida && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#8B1E2B] flex items-center justify-center mb-3">
              <LogOut className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">¿Quieres salir de Solibook?</h2>
            <p className="text-xs text-slate-500 leading-relaxed mt-1.5">
              Puedes cancelar para seguir usando la aplicación.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmarSalida(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setConfirmarSalida(false);
                  permitirSalida.current = true;
                  window.history.go(-2);
                  window.setTimeout(() => {
                    window.close();
                    // Si el navegador no permite cerrar una PWA/tabs desde
                    // JavaScript, se restaura la protección para el siguiente Atrás.
                    permitirSalida.current = false;
                  }, 250);
                }}
                className="px-4 py-2 text-xs font-bold bg-[#8B1E2B] hover:bg-[#721823] text-white rounded-xl"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Navegación Inferior (Móvil PWA) */}
      <BottomNav vistaActual={vistaActual} setVistaActual={navegarA} />

      {/* Centro de Notificaciones y Acuse de Recibo */}
      <ModalNotificaciones
        onAbrirAjustes={() => { setModalNotificacionesAbierto(false); navegarA('ajustes'); }}
        isOpen={modalNotificacionesAbierto}
        onClose={() => setModalNotificacionesAbierto(false)}
        onIrAEvento={() => navegarA('agenda')}
      />
    </div>
  );
};

export default function Home() {
  return (
    <AuthProvider>
      <AjustesProvider>
      <EliminacionesProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
      </EliminacionesProvider>
      </AjustesProvider>
    </AuthProvider>
  );
}
