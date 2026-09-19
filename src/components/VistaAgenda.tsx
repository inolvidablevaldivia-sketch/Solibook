'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Evento, TipoConvocatoria, Cuerda } from '@/types';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Share2,
  Plus,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Filter,
  FileCheck,
  X,
  Check,
  Trash2,
  Repeat,
  CheckSquare,
  Square,
  CalendarDays,
  Edit2,
  ListPlus
} from 'lucide-react';

interface VistaAgendaProps {
  onIniciarAsistencia: (eventoId: string) => void;
}

export const VistaAgenda: React.FC<VistaAgendaProps> = ({ onIniciarAsistencia }) => {
  const {
    eventos,
    tiposEventos,
    agregarTipoEvento,
    agregarEvento,
    agregarEventosLote,
    actualizarEvento,
    eliminarEvento,
    integrantes
  } = useApp();

  const [modoVista, setModoVista] = useState<'lista' | 'calendario'>('lista');
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null);
  const [eventosDelDiaModal, setEventosDelDiaModal] = useState<{ fecha: string; eventos: Evento[] } | null>(null);
  const [modalNuevoEvento, setModalNuevoEvento] = useState(false);
  const [modalEditarEvento, setModalEditarEvento] = useState<Evento | null>(null);
  const [modalArmarListaPendiente, setModalArmarListaPendiente] = useState<Evento | null>(null);
  const [copiadoToast, setCopiadoToast] = useState(false);

  // Navegación de Mes y Año para Calendario y Lista
  const [fechaActualNavegacion, setFechaActualNavegacion] = useState(new Date(2026, 8, 1)); // Septiembre 2026

  // Formulario nuevo evento
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<string>('Ensayo');
  const [mostrarCrearTipo, setMostrarCrearTipo] = useState(false);
  const [textoNuevoTipo, setTextoNuevoTipo] = useState('');
  const [nuevaHora, setNuevaHora] = useState('19:30');
  const [nuevoLugar, setNuevoLugar] = useState('Templo Central');
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [nuevasNotas, setNuevasNotas] = useState('');
  const [nuevaConvocatoria, setNuevaConvocatoria] = useState<TipoConvocatoria>('Todos');
  const [cuerdasElegidas, setCuerdasElegidas] = useState<Cuerda[]>([]);
  const [miembrosElegidosIds, setMiembrosElegidosIds] = useState<string[]>([]);
  const [dejarListaPendiente, setDejarListaPendiente] = useState(false);

  // Opciones Periódicas / Rango
  const [esPeriodico, setEsPeriodico] = useState(false);
  const [fechaUnica, setFechaUnica] = useState(new Date().toISOString().split('T')[0]);
  const [fechaRangoInicio, setFechaRangoInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaRangoFin, setFechaRangoFin] = useState('');
  const [diasSemanaElegidos, setDiasSemanaElegidos] = useState<number[]>([5]);

  // Formulario Editar Evento
  const [editTitulo, setEditTitulo] = useState('');
  const [editHora, setEditHora] = useState('');
  const [editLugar, setEditLugar] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editAlcance, setEditAlcance] = useState<'soloEste' | 'futuros'>('soloEste');

  const diasSemana = [
    { num: 1, label: 'L', full: 'Lunes' },
    { num: 2, label: 'M', full: 'Martes' },
    { num: 3, label: 'M', full: 'Miércoles' },
    { num: 4, label: 'J', full: 'Jueves' },
    { num: 5, label: 'V', full: 'Viernes' },
    { num: 6, label: 'S', full: 'Sábado' },
    { num: 0, label: 'D', full: 'Domingo' }
  ];

  const cuerdasDisponibles: Cuerda[] = ['Soprano', 'Contralto', 'Tenor', 'Bajo', 'Solista', 'Directiva'];

  const integrantesActivos = [...integrantes]
    .filter(i => i.estado === 'Activo')
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

  // Navegar mes anterior / siguiente
  const mesAnterior = () => {
    setFechaActualNavegacion(new Date(fechaActualNavegacion.getFullYear(), fechaActualNavegacion.getMonth() - 1, 1));
  };

  const mesSiguiente = () => {
    setFechaActualNavegacion(new Date(fechaActualNavegacion.getFullYear(), fechaActualNavegacion.getMonth() + 1, 1));
  };

  const mesNombre = fechaActualNavegacion.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const anioActual = fechaActualNavegacion.getFullYear();
  const mesActual = fechaActualNavegacion.getMonth();

  // Filtrado de eventos del mes actual en vista calendario y en lista según filtro
  const eventosFiltrados = eventos
    .filter(ev => {
      if (filtroTipo !== 'Todos' && ev.tipo !== filtroTipo) return false;
      const f = new Date(ev.fechaHoraInicio);
      return f.getFullYear() === anioActual && f.getMonth() === mesActual;
    })
    .sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime());

  // Generador de Días del Mes para el Calendario
  const totalDiasMes = new Date(anioActual, mesActual + 1, 0).getDate();
  const primerDiaSemana = new Date(anioActual, mesActual, 1).getDay(); // 0 = Dom
  // Ajuste para semana comenzando en Lunes (0 = Lun ... 6 = Dom)
  const desfaseLunes = (primerDiaSemana + 6) % 7;

  // Generador de Texto para WhatsApp (Regla: solo campos existentes)
  const copiarParaWhatsApp = (ev: Evento) => {
    const fechaObj = new Date(ev.fechaHoraInicio);
    const opcionesFecha: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const fechaTexto = fechaObj.toLocaleDateString('es-CL', opcionesFecha);
    const horaTexto = fechaObj.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    let texto = `*MINISTERIO VOCAL SOLÍ DEO*\n`;
    texto += `*${ev.titulo.toUpperCase()}*\n`;
    texto += `━━━━━━━━━━━━━━━━━━\n`;
    texto += `📅 Fecha: ${fechaTexto}\n`;
    texto += `⏰ Hora: ${horaTexto} hrs\n`;
    texto += `📍 Lugar: ${ev.lugarNombre}\n`;

    if (ev.direccion && ev.direccion.trim() !== '') {
      texto += `🗺️ Dirección: ${ev.direccion}\n`;
    }

    if (ev.tipoConvocatoria === 'Todos') {
      texto += `👥 Convocados: Todo el ministerio\n`;
    } else if (ev.tipoConvocatoria === 'Por Cuerda' && ev.cuerdasConvocadas) {
      texto += `👥 Convocados: ${ev.cuerdasConvocadas.join(', ')}\n`;
    } else if (ev.tipoConvocatoria === 'Personalizada') {
      if (ev.integrantesConvocadosIds && ev.integrantesConvocadosIds.length > 0) {
        texto += `👥 Convocados: Citación especial (${ev.integrantesConvocadosIds.length} integrantes)\n`;
      } else {
        texto += `👥 Convocados: Citación especial (Lista pendiente de confirmación)\n`;
      }
    }

    if (ev.notas && ev.notas.trim() !== '') {
      texto += `📝 Nota: ${ev.notas}\n`;
    }

    texto += `━━━━━━━━━━━━━━━━━━\n`;
    texto += `_Favor confirmar asistencia o gestionar justificativo en Solibook._`;

    navigator.clipboard.writeText(texto);
    setCopiadoToast(true);
    setTimeout(() => setCopiadoToast(false), 3000);
  };

  const handleCrearEvento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo) return;

    let tipoFinal = nuevoTipo;
    if (mostrarCrearTipo && textoNuevoTipo.trim()) {
      tipoFinal = textoNuevoTipo.trim();
      agregarTipoEvento(tipoFinal);
    }

    const convocadosIdsFinal = nuevaConvocatoria === 'Personalizada' && !dejarListaPendiente ? miembrosElegidosIds : undefined;

    if (!esPeriodico) {
      if (!fechaUnica) return;
      const fechaHora = `${fechaUnica}T${nuevaHora || '19:30'}:00`;
      agregarEvento({
        titulo: nuevoTitulo,
        tipo: tipoFinal,
        fechaHoraInicio: fechaHora,
        lugarNombre: nuevoLugar,
        direccion: nuevaDireccion,
        notas: nuevasNotas,
        tipoConvocatoria: nuevaConvocatoria,
        cuerdasConvocadas: nuevaConvocatoria === 'Por Cuerda' ? cuerdasElegidas : undefined,
        integrantesConvocadosIds: convocadosIdsFinal,
        asistenciaFinalizada: false
      });
    } else {
      if (!fechaRangoInicio || !fechaRangoFin || diasSemanaElegidos.length === 0) {
        alert('Por favor selecciona la fecha de inicio, fecha de fin y al menos un día de la semana.');
        return;
      }

      const inicio = new Date(fechaRangoInicio + 'T00:00:00');
      const fin = new Date(fechaRangoFin + 'T23:59:59');

      if (fin < inicio) {
        alert('La fecha de fin no puede ser anterior a la fecha de inicio.');
        return;
      }

      const grupoId = `grupo-${Date.now()}`;
      const listaGenerada: Omit<Evento, 'id'>[] = [];
      const cursor = new Date(inicio);

      while (cursor <= fin) {
        const diaSemana = cursor.getDay();
        if (diasSemanaElegidos.includes(diaSemana)) {
          const anio = cursor.getFullYear();
          const mes = String(cursor.getMonth() + 1).padStart(2, '0');
          const dia = String(cursor.getDate()).padStart(2, '0');
          const fechaStr = `${anio}-${mes}-${dia}T${nuevaHora || '19:30'}:00`;

          listaGenerada.push({
            titulo: nuevoTitulo,
            tipo: tipoFinal,
            fechaHoraInicio: fechaStr,
            lugarNombre: nuevoLugar,
            direccion: nuevaDireccion,
            notas: nuevasNotas,
            tipoConvocatoria: nuevaConvocatoria,
            cuerdasConvocadas: nuevaConvocatoria === 'Por Cuerda' ? cuerdasElegidas : undefined,
            integrantesConvocadosIds: convocadosIdsFinal,
            asistenciaFinalizada: false,
            grupoRecurrenciaId: grupoId
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      if (listaGenerada.length === 0) {
        alert('No coincidió ningún día con las fechas y días de semana seleccionados.');
        return;
      }

      agregarEventosLote(listaGenerada);
      alert(`¡Se programaron con éxito ${listaGenerada.length} actividades en la agenda!`);
    }

    setModalNuevoEvento(false);
    setNuevoTitulo('');
    setNuevaDireccion('');
    setNuevasNotas('');
    setEsPeriodico(false);
    setMiembrosElegidosIds([]);
    setDejarListaPendiente(false);
    setMostrarCrearTipo(false);
    setTextoNuevoTipo('');
  };

  // Abrir formulario para un día específico (vía clic en día vacío o con eventos)
  const handleDiaCalendarioClick = (dia: number) => {
    const eventosDia = eventosFiltrados.filter(ev => {
      const f = new Date(ev.fechaHoraInicio);
      return f.getDate() === dia;
    });

    if (eventosDia.length === 0) {
      // Día vacío: abrir directamente el modal para programar una actividad en esa fecha
      const mesStr = String(mesActual + 1).padStart(2, '0');
      const diaStr = String(dia).padStart(2, '0');
      setFechaUnica(`${anioActual}-${mesStr}-${diaStr}`);
      setEsPeriodico(false);
      setModalNuevoEvento(true);
    } else if (eventosDia.length === 1) {
      setEventoSeleccionado(eventosDia[0]);
    } else {
      setEventosDelDiaModal({
        fecha: `${dia} de ${mesNombre}`,
        eventos: eventosDia
      });
    }
  };

  // Abrir Modal de Edición
  const abrirEditar = (ev: Evento) => {
    setModalEditarEvento(ev);
    setEditTitulo(ev.titulo);
    setEditHora(new Date(ev.fechaHoraInicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
    setEditLugar(ev.lugarNombre);
    setEditDireccion(ev.direccion || '');
    setEditNotas(ev.notas || '');
    setEditAlcance('soloEste');
  };

  const handleGuardarEdicion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarEvento) return;

    const fechaBase = modalEditarEvento.fechaHoraInicio.split('T')[0];
    const nuevaFechaHora = `${fechaBase}T${editHora || '19:30'}:00`;

    actualizarEvento(
      modalEditarEvento.id,
      {
        titulo: editTitulo,
        fechaHoraInicio: nuevaFechaHora,
        lugarNombre: editLugar,
        direccion: editDireccion,
        notas: editNotas
      },
      editAlcance === 'futuros'
    );

    setModalEditarEvento(null);
    setEventoSeleccionado(null);
    alert(editAlcance === 'futuros' ? '¡Se actualizaron este evento y todos los futuros de la serie!' : '¡Evento actualizado con éxito!');
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* Toast de Confirmación Copiado */}
      {copiadoToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>¡Texto para WhatsApp copiado al portapapeles!</span>
        </div>
      )}

      {/* Barra de Filtros, Navegación de Mes y Acciones */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Navegación de Meses y Años (Pasado y Futuro) */}
          <div className="flex items-center gap-2">
            <button
              onClick={mesAnterior}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-bold text-slate-900 capitalize min-w-[150px] text-center">
              {mesNombre}
            </h2>
            <button
              onClick={mesSiguiente}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Alternar Lista/Calendario + Botón Nueva Actividad */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs">
              <button
                onClick={() => setModoVista('lista')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  modoVista === 'lista' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500'
                }`}
              >
                Lista
              </button>
              <button
                onClick={() => setModoVista('calendario')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  modoVista === 'calendario' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500'
                }`}
              >
                Calendario
              </button>
            </div>

            <button
              onClick={() => {
                setFechaUnica(new Date().toISOString().split('T')[0]);
                setEsPeriodico(false);
                setModalNuevoEvento(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8B1E2B] hover:bg-[#721823] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva Actividad</span>
            </button>
          </div>
        </div>

        {/* Filtros de Tipo */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium pt-1 border-t border-slate-100">
          {['Todos', ...tiposEventos].map(tipo => (
            <button
              key={tipo}
              onClick={() => setFiltroTipo(tipo)}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                filtroTipo === tipo
                  ? 'bg-[#0099DD] text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>
      </div>

      {/* VISTA AGENDA (Lista Cronológica) */}
      {modoVista === 'lista' ? (
        <div className="space-y-3">
          {eventosFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-300">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No hay actividades en {mesNombre}</p>
              <p className="text-xs text-slate-400 mt-1">Crea una nueva actividad usando el botón superior.</p>
            </div>
          ) : (
            eventosFiltrados.map(ev => {
              const fecha = new Date(ev.fechaHoraInicio);
              const diaSemana = fecha.toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase();
              const diaNumero = fecha.getDate();
              const mes = fecha.toLocaleDateString('es-CL', { month: 'short' }).toUpperCase();
              const hora = fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
              const tieneListaPendiente = ev.tipoConvocatoria === 'Personalizada' && (!ev.integrantesConvocadosIds || ev.integrantesConvocadosIds.length === 0);

              return (
                <div
                  key={ev.id}
                  onClick={() => setEventoSeleccionado(ev)}
                  className="group bg-white hover:bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-sky-300 transition-all cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-b from-sky-50 to-white border border-sky-100 flex flex-col items-center justify-center shrink-0 text-center">
                      <span className="text-[10px] font-bold text-[#0099DD] tracking-wider leading-none">
                        {diaSemana}
                      </span>
                      <span className="text-lg font-extrabold text-slate-800 leading-tight">
                        {diaNumero}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase leading-none">
                        {mes}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          ev.tipo === 'Ensayo' ? 'bg-sky-100/70 text-[#0077B6]' :
                          ev.tipo === 'Presentación' ? 'bg-rose-100/70 text-[#8B1E2B]' :
                          'bg-amber-100/70 text-amber-900'
                        }`}>
                          {ev.tipo}
                        </span>
                        {ev.grupoRecurrenciaId && (
                          <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                            <Repeat className="w-2.5 h-2.5" />
                            Periódico
                          </span>
                        )}
                        {tieneListaPendiente && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold border border-amber-200">
                            Lista de citados pendiente
                          </span>
                        )}
                        {ev.asistenciaFinalizada && (
                          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            Lista Cerrada
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mt-1 group-hover:text-[#0099DD] transition-colors">
                        {ev.titulo}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {hora} hrs
                        </span>
                        <span className="flex items-center gap-1 truncate max-w-[180px] sm:max-w-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {ev.lugarNombre}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => copiarParaWhatsApp(ev)}
                      title="Copiar texto formateado para WhatsApp"
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onIniciarAsistencia(ev.id)}
                      className="px-3 py-1.5 bg-[#0099DD] hover:bg-[#0088cc] text-white text-xs font-semibold rounded-xl transition-colors shadow-xs hidden sm:flex items-center gap-1"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      Pasar Lista
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* VISTA CALENDARIO MENSUAL */
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="text-center mb-4">
            <h3 className="text-sm font-bold text-slate-800 capitalize">{mesNombre}</h3>
            <p className="text-xs text-slate-400">
              Haz clic en cualquier día con punto para ver actividades, o en un día vacío para agregar una
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="font-bold text-slate-400 py-1">{d}</div>
            ))}

            {/* Espacios vacíos antes del primer día del mes */}
            {Array.from({ length: desfaseLunes }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2 min-h-[56px] border border-transparent" />
            ))}

            {/* Días del mes actual */}
            {Array.from({ length: totalDiasMes }, (_, i) => {
              const dia = i + 1;
              const eventosDia = eventosFiltrados.filter(ev => {
                const f = new Date(ev.fechaHoraInicio);
                return f.getDate() === dia;
              });
              const cantidad = eventosDia.length;

              return (
                <div
                  key={dia}
                  onClick={() => handleDiaCalendarioClick(dia)}
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center min-h-[56px] transition-all cursor-pointer ${
                    cantidad > 0
                      ? 'bg-sky-50/70 border-sky-300 text-[#0077B6] font-bold shadow-xs hover:scale-105'
                      : 'border-slate-100 hover:bg-slate-100/70 text-slate-700'
                  }`}
                  title={cantidad === 0 ? 'Clic para programar actividad este día' : `${cantidad} actividades`}
                >
                  <span>{dia}</span>
                  {cantidad > 0 ? (
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: Math.min(cantidad, 3) }).map((_, dotIdx) => (
                        <span key={dotIdx} className="w-1.5 h-1.5 rounded-full bg-[#0099DD]" />
                      ))}
                      {cantidad > 3 && <span className="text-[9px] text-[#0099DD] font-bold">+</span>}
                    </div>
                  ) : (
                    <span className="text-[9px] text-slate-300 opacity-0 hover:opacity-100 mt-1 font-semibold">+</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DETALLES DEL EVENTO */}
      {eventoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0099DD] bg-sky-50 px-2 py-0.5 rounded-md">
                      {eventoSeleccionado.tipo}
                    </span>
                    {eventoSeleccionado.grupoRecurrenciaId && (
                      <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-semibold flex items-center gap-0.5">
                        <Repeat className="w-3 h-3" />
                        Programación Periódica
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {eventoSeleccionado.titulo}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirEditar(eventoSeleccionado)}
                    className="p-1.5 text-slate-400 hover:text-[#0099DD] hover:bg-sky-50 rounded-lg transition-colors"
                    title="Editar detalles del evento"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEventoSeleccionado(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-800">
                    {new Date(eventoSeleccionado.fechaHoraInicio).toLocaleDateString('es-CL', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>
                    {new Date(eventoSeleccionado.fechaHoraInicio).toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })} hrs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{eventoSeleccionado.lugarNombre}</span>
                </div>
                {eventoSeleccionado.direccion && (
                  <div className="pl-6 text-[11px] text-slate-500">
                    {eventoSeleccionado.direccion}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>
                      Convocatoria:{' '}
                      <strong>
                        {eventoSeleccionado.tipoConvocatoria === 'Todos'
                          ? 'Todo el ministerio'
                          : eventoSeleccionado.tipoConvocatoria === 'Por Cuerda'
                          ? eventoSeleccionado.cuerdasConvocadas?.join(', ')
                          : eventoSeleccionado.integrantesConvocadosIds && eventoSeleccionado.integrantesConvocadosIds.length > 0
                          ? `Personalizada (${eventoSeleccionado.integrantesConvocadosIds.length} citados)`
                          : 'Personalizada (Lista pendiente)'}
                      </strong>
                    </span>
                  </div>
                  {eventoSeleccionado.tipoConvocatoria === 'Personalizada' && (
                    <button
                      onClick={() => setModalArmarListaPendiente(eventoSeleccionado)}
                      className="text-[11px] text-[#0099DD] font-bold hover:underline flex items-center gap-1"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      Armar Lista
                    </button>
                  )}
                </div>
                {eventoSeleccionado.notas && (
                  <div className="pt-2 border-t border-slate-200/60 text-slate-700 italic">
                    "{eventoSeleccionado.notas}"
                  </div>
                )}
              </div>

              {/* Botones de acción principales */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => copiarParaWhatsApp(eventoSeleccionado)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  Copiar Wsp
                </button>
                <button
                  onClick={() => {
                    const id = eventoSeleccionado.id;
                    setEventoSeleccionado(null);
                    onIniciarAsistencia(id);
                  }}
                  className="flex-1 py-2.5 bg-[#0099DD] hover:bg-[#0088cc] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <FileCheck className="w-4 h-4" />
                  Pasar Lista
                </button>
              </div>

              {/* Opciones de Eliminación (Solo este día o todos los futuros) */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    if (confirm('¿Eliminar solo esta actividad agendada para este día?')) {
                      eliminarEvento(eventoSeleccionado.id, false);
                      setEventoSeleccionado(null);
                    }
                  }}
                  className="text-rose-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Borrar solo este día
                </button>

                {eventoSeleccionado.grupoRecurrenciaId && (
                  <button
                    onClick={() => {
                      if (confirm('¿Deseas borrar TODOS los eventos FUTUROS de este grupo? Los eventos que ya pasaron permanecerán intactos en el historial.')) {
                        eliminarEvento(eventoSeleccionado.id, true);
                        setEventoSeleccionado(null);
                      }
                    }}
                    className="text-purple-700 hover:underline font-bold flex items-center gap-1"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    Borrar todos los futuros
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MÚLTIPLES EVENTOS EN EL MISMO DÍA */}
      {eventosDelDiaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-sm overflow-hidden p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Actividades del Día</h3>
                <p className="text-xs text-slate-500">{eventosDelDiaModal.fecha}</p>
              </div>
              <button onClick={() => setEventosDelDiaModal(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {eventosDelDiaModal.eventos.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => {
                    setEventosDelDiaModal(null);
                    setEventoSeleccionado(ev);
                  }}
                  className="p-3 bg-slate-50 hover:bg-sky-50 border border-slate-200/70 hover:border-sky-300 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-[#0099DD] uppercase">{ev.tipo}</span>
                    <h4 className="text-xs font-bold text-slate-800 mt-0.5">{ev.titulo}</h4>
                    <span className="text-[10px] text-slate-500">
                      {new Date(ev.fechaHoraInicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs • {ev.lugarNombre}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR EVENTO (SOLO ESTE O FUTUROS) */}
      {modalEditarEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden">
            <form onSubmit={handleGuardarEdicion} className="p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-base font-bold text-slate-900">Editar Actividad</h3>
                <button type="button" onClick={() => setModalEditarEvento(null)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={editTitulo}
                  onChange={e => setEditTitulo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hora</label>
                  <input
                    type="time"
                    value={editHora}
                    onChange={e => setEditHora(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lugar</label>
                  <input
                    type="text"
                    value={editLugar}
                    onChange={e => setEditLugar(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección (opcional)</label>
                <input
                  type="text"
                  value={editDireccion}
                  onChange={e => setEditDireccion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              {/* Alcance de edición: ¿Solo este día o todos los futuros del grupo? */}
              {modalEditarEvento.grupoRecurrenciaId && (
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-2">
                  <span className="text-xs font-bold text-purple-900 block">Alcance de los cambios:</span>
                  <div className="space-y-1.5 text-xs text-purple-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="alcance"
                        value="soloEste"
                        checked={editAlcance === 'soloEste'}
                        onChange={() => setEditAlcance('soloEste')}
                      />
                      <span>Editar solo este día</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="alcance"
                        value="futuros"
                        checked={editAlcance === 'futuros'}
                        onChange={() => setEditAlcance('futuros')}
                      />
                      <span>Editar este día y todos los futuros programados</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEditarEvento(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#0099DD] hover:bg-[#0088cc] text-white rounded-xl shadow-xs"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ARMAR LISTA DE CONVOCATORIA PENDIENTE */}
      {modalArmarListaPendiente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Armar Lista de Convocatoria</h3>
                <p className="text-xs text-slate-500">{modalArmarListaPendiente.titulo}</p>
              </div>
              <button onClick={() => setModalArmarListaPendiente(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200/70">
              {integrantesActivos.map(i => {
                const listActual = modalArmarListaPendiente.integrantesConvocadosIds || [];
                const marcado = listActual.includes(i.id);
                return (
                  <div
                    key={i.id}
                    onClick={() => {
                      const nuevoArray = marcado
                        ? listActual.filter(id => id !== i.id)
                        : [...listActual, i.id];
                      setModalArmarListaPendiente({
                        ...modalArmarListaPendiente,
                        integrantesConvocadosIds: nuevoArray
                      });
                    }}
                    className="flex items-center justify-between p-2 hover:bg-white rounded-lg cursor-pointer text-xs"
                  >
                    <span className="font-medium text-slate-800">{i.nombreCompleto}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{i.cuerda}</span>
                    {marcado ? (
                      <CheckSquare className="w-4 h-4 text-[#0099DD]" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalArmarListaPendiente(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  actualizarEvento(modalArmarListaPendiente.id, {
                    integrantesConvocadosIds: modalArmarListaPendiente.integrantesConvocadosIds
                  });
                  setEventoSeleccionado(modalArmarListaPendiente);
                  setModalArmarListaPendiente(null);
                  alert('¡Lista de convocatoria guardada con éxito!');
                }}
                className="px-4 py-2 text-xs font-semibold bg-[#0099DD] hover:bg-[#0088cc] text-white rounded-xl shadow-xs"
              >
                Guardar Lista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR EVENTO / PROGRAMACIÓN PERIÓDICA */}
      {modalNuevoEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCrearEvento} className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Programar Nueva Actividad</h3>
                <button
                  type="button"
                  onClick={() => setModalNuevoEvento(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título de la Actividad *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ensayo General, Presentación..."
                  value={nuevoTitulo}
                  onChange={e => setNuevoTitulo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Tipo de Evento</label>
                    <button
                      type="button"
                      onClick={() => setMostrarCrearTipo(!mostrarCrearTipo)}
                      className="text-[10px] text-[#0099DD] font-bold hover:underline"
                    >
                      {mostrarCrearTipo ? 'Seleccionar existente' : '+ Nuevo tipo'}
                    </button>
                  </div>

                  {!mostrarCrearTipo ? (
                    <select
                      value={nuevoTipo}
                      onChange={e => setNuevoTipo(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none"
                    >
                      {tiposEventos.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Nombre del nuevo tipo..."
                      value={textoNuevoTipo}
                      onChange={e => setTextoNuevoTipo(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-sky-300 bg-sky-50/50 rounded-xl focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hora</label>
                  <input
                    type="time"
                    value={nuevaHora}
                    onChange={e => setNuevaHora(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* SELECTOR DE MODALIDAD: FECHA ÚNICA VS PERIÓDICO */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Frecuencia de la Actividad</span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setEsPeriodico(false)}
                      className={`px-2.5 py-1 rounded font-semibold transition-all ${
                        !esPeriodico ? 'bg-[#0099DD] text-white' : 'text-slate-500'
                      }`}
                    >
                      Día Único
                    </button>
                    <button
                      type="button"
                      onClick={() => setEsPeriodico(true)}
                      className={`px-2.5 py-1 rounded font-semibold transition-all ${
                        esPeriodico ? 'bg-[#0099DD] text-white' : 'text-slate-500'
                      }`}
                    >
                      Periódico (Rango)
                    </button>
                  </div>
                </div>

                {!esPeriodico ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fecha del Evento *</label>
                    <input
                      type="date"
                      required
                      value={fechaUnica}
                      onChange={e => setFechaUnica(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Repetir cada semana los días:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {diasSemana.map(d => {
                          const esta = diasSemanaElegidos.includes(d.num);
                          return (
                            <button
                              key={d.num}
                              type="button"
                              onClick={() => {
                                if (esta) {
                                  setDiasSemanaElegidos(diasSemanaElegidos.filter(n => n !== d.num));
                                } else {
                                  setDiasSemanaElegidos([...diasSemanaElegidos, d.num]);
                                }
                              }}
                              title={d.full}
                              className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
                                esta
                                  ? 'bg-[#0099DD] text-white shadow-xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Desde fecha:</label>
                        <input
                          type="date"
                          required
                          value={fechaRangoInicio}
                          onChange={e => setFechaRangoInicio(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Hasta fecha (ej. 2027):</label>
                        <input
                          type="date"
                          required
                          value={fechaRangoFin}
                          onChange={e => setFechaRangoFin(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lugar / Templo</label>
                  <input
                    type="text"
                    value={nuevoLugar}
                    onChange={e => setNuevoLugar(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dirección (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Calle, número..."
                    value={nuevaDireccion}
                    onChange={e => setNuevaDireccion(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Convocatoria (Todos, Por Cuerda, Personalizada con lista o Pendiente) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700">Convocatoria (¿Quiénes son citados?)</label>
                <div className="flex items-center gap-2 text-xs">
                  {(['Todos', 'Por Cuerda', 'Personalizada'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNuevaConvocatoria(c)}
                      className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                        nuevaConvocatoria === c
                          ? 'bg-[#0099DD] text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {nuevaConvocatoria === 'Por Cuerda' && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {cuerdasDisponibles.map(cuerda => {
                      const seleccionada = cuerdasElegidas.includes(cuerda);
                      return (
                        <button
                          key={cuerda}
                          type="button"
                          onClick={() => {
                            if (seleccionada) {
                              setCuerdasElegidas(cuerdasElegidas.filter(c => c !== cuerda));
                            } else {
                              setCuerdasElegidas([...cuerdasElegidas, cuerda]);
                            }
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                            seleccionada
                              ? 'bg-sky-50 border-[#0099DD] text-[#0077B6] font-semibold'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {cuerda}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* CITACIÓN PERSONALIZADA CON OPCIÓN DE LISTA PENDIENTE */}
                {nuevaConvocatoria === 'Personalizada' && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-800">
                        <input
                          type="checkbox"
                          checked={dejarListaPendiente}
                          onChange={e => setDejarListaPendiente(e.target.checked)}
                          className="rounded text-[#0099DD]"
                        />
                        <span>Dejar lista pendiente para armarla más adelante</span>
                      </label>
                    </div>

                    {!dejarListaPendiente && (
                      <>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                          <span className="font-semibold text-slate-700">
                            Citados ({miembrosElegidosIds.length} seleccionados)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (miembrosElegidosIds.length === integrantesActivos.length) {
                                setMiembrosElegidosIds([]);
                              } else {
                                setMiembrosElegidosIds(integrantesActivos.map(i => i.id));
                              }
                            }}
                            className="text-[11px] text-[#0099DD] font-bold hover:underline"
                          >
                            {miembrosElegidosIds.length === integrantesActivos.length
                              ? 'Deseleccionar todos'
                              : 'Seleccionar todos'}
                          </button>
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-slate-200/70">
                          {integrantesActivos.map(i => {
                            const marcado = miembrosElegidosIds.includes(i.id);
                            return (
                              <div
                                key={i.id}
                                onClick={() => {
                                  if (marcado) {
                                    setMiembrosElegidosIds(miembrosElegidosIds.filter(id => id !== i.id));
                                  } else {
                                    setMiembrosElegidosIds([...miembrosElegidosIds, i.id]);
                                  }
                                }}
                                className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs"
                              >
                                <span className="font-medium text-slate-800">{i.nombreCompleto}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{i.cuerda}</span>
                                {marcado ? (
                                  <CheckSquare className="w-4 h-4 text-[#0099DD]" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas adicionales (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Llevar uniforme, carpeta..."
                  value={nuevasNotas}
                  onChange={e => setNuevasNotas(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevoEvento(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#8B1E2B] hover:bg-[#721823] text-white rounded-xl shadow-xs"
                >
                  Guardar y Programar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
