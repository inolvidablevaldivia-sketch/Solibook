'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Evento, Integrante } from '@/types';
import { TarjetaPerfilMiembro } from './TarjetaPerfilMiembro';
import {
  Table,
  FileSpreadsheet,
  Printer,
  Search,
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  BarChart2,
  PieChart,
  CalendarDays,
  X,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

type Periodo = 'Mes' | 'Semestre' | 'Anio' | 'Todo';

const PERIODOS: { id: Periodo; etiqueta: string }[] = [
  { id: 'Mes', etiqueta: 'Mes' },
  { id: 'Semestre', etiqueta: 'Semestre' },
  { id: 'Anio', etiqueta: 'Año' },
  { id: 'Todo', etiqueta: 'Todo' }
];

const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

interface RangoPeriodo {
  inicio: Date | null;
  fin: Date | null;
  etiqueta: string;
}

const rangoDelPeriodo = (periodo: Periodo): RangoPeriodo => {
  const hoy = new Date();
  const anio = hoy.getFullYear();

  if (periodo === 'Mes') {
    return {
      inicio: new Date(anio, hoy.getMonth(), 1),
      fin: new Date(anio, hoy.getMonth() + 1, 0, 23, 59, 59),
      etiqueta: 'Mes en curso'
    };
  }
  if (periodo === 'Semestre') {
    const primerSemestre = hoy.getMonth() <= 5;
    return {
      inicio: new Date(anio, primerSemestre ? 0 : 6, 1),
      fin: new Date(anio, primerSemestre ? 5 : 11, primerSemestre ? 30 : 31, 23, 59, 59),
      etiqueta: 'Semestre en curso'
    };
  }
  if (periodo === 'Anio') {
    return {
      inicio: new Date(anio, 0, 1),
      fin: new Date(anio, 11, 31, 23, 59, 59),
      etiqueta: 'Año en curso'
    };
  }
  return { inicio: null, fin: null, etiqueta: 'Histórico completo' };
};

const enRango = (iso: string, rango: RangoPeriodo): boolean => {
  const t = new Date(iso).getTime();
  if (rango.inicio && t < rango.inicio.getTime()) return false;
  if (rango.fin && t > rango.fin.getTime()) return false;
  return true;
};

// Un miembro está citado en un evento según su tipo de convocatoria
const fueConvocado = (ev: Evento, m: Integrante): boolean => {
  if (ev.tipoConvocatoria === 'Todos') return true;
  if (ev.tipoConvocatoria === 'Por Cuerda') return !!ev.cuerdasConvocadas?.includes(m.cuerda);
  if (ev.tipoConvocatoria === 'Personalizada') return !!ev.integrantesConvocadosIds?.includes(m.id);
  return false;
};

interface StatsMiembro {
  citaciones: number;
  presentes: number;
  justificados: number;
  ausentes: number;
  porcentaje: number; // Justificado vale 0.5
}

const calcularStats = (
  m: Integrante,
  eventosCerrados: Evento[],
  asistencias: { eventoId: string; integranteId: string; estado: string }[]
): StatsMiembro => {
  let citaciones = 0;
  let presentes = 0;
  let justificados = 0;
  let ausentes = 0;

  eventosCerrados.forEach(ev => {
    if (!fueConvocado(ev, m)) return;
    citaciones++;
    const reg = asistencias.find(a => a.eventoId === ev.id && a.integranteId === m.id);
    const st = reg?.estado;
    if (st === 'Presente') presentes++;
    else if (st === 'Justificado') justificados++;
    else ausentes++;
  });

  const porcentaje =
    citaciones > 0 ? Math.round(((presentes + justificados * 0.5) / citaciones) * 100) : 0;

  return { citaciones, presentes, justificados, ausentes, porcentaje };
};

export const VistaDashboardPC: React.FC = () => {
  const { integrantes, eventos, asistencias, marcarAsistencia } = useApp();
  const { puede } = useAuth();

  const [periodo, setPeriodo] = useState<Periodo>('Anio');
  const [subpestana, setSubpestana] = useState<'matriz' | 'estadisticas'>('estadisticas');
  const [filtroCuerda, setFiltroCuerda] = useState<string>('Todas');
  const [filtroIglesia, setFiltroIglesia] = useState<string>('Todas');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<'miembros' | 'actividades' | 'promedio' | 'alerta' | null>(null);
  const [miembroAbiertoId, setMiembroAbiertoId] = useState<string | null>(null);

  const rango = useMemo(() => rangoDelPeriodo(periodo), [periodo]);

  // Solo miembros activos participan de las estadísticas
  const activos = useMemo(() => integrantes.filter(i => i.estado === 'Activo'), [integrantes]);

  const miembrosVisibles = useMemo(() => {
    return activos
      .filter(i => {
        if (filtroCuerda !== 'Todas' && i.cuerda !== filtroCuerda) return false;
        if (filtroIglesia !== 'Todas' && i.iglesia !== filtroIglesia) return false;
        if (busqueda.trim()) {
          const q = busqueda.toLowerCase();
          return (
            i.nombreCompleto.toLowerCase().includes(q) ||
            i.iglesia.toLowerCase().includes(q) ||
            i.cuerda.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }, [activos, filtroCuerda, filtroIglesia, busqueda]);

  const listaIglesias = useMemo(
    () => Array.from(new Set(integrantes.map(i => i.iglesia))).sort(),
    [integrantes]
  );

  // Eventos dentro del período seleccionado
  const eventosDelPeriodo = useMemo(
    () =>
      eventos
        .filter(ev => enRango(ev.fechaHoraInicio, rango))
        .sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime()),
    [eventos, rango]
  );

  // Únicamente las listas finalizadas alimentan los porcentajes
  const eventosCerrados = useMemo(
    () => eventosDelPeriodo.filter(ev => ev.asistenciaFinalizada),
    [eventosDelPeriodo]
  );

  const asistenciasMap = useMemo(() => {
    const map = new Map<string, string>();
    asistencias.forEach(a => map.set(`${a.eventoId}_${a.integranteId}`, a.estado));
    return map;
  }, [asistencias]);

  // Estadísticas por miembro (sobre listas finalizadas del período)
  const statsPorIntegrante = useMemo(() => {
    const map = new Map<string, StatsMiembro>();
    integrantes.forEach(item => {
      map.set(item.id, calcularStats(item, eventosCerrados, asistencias));
    });
    return map;
  }, [integrantes, eventosCerrados, asistencias]);

  // Promedio global ponderado por cantidad de citados
  const promedioGlobal = useMemo(() => {
    let citados = 0;
    let ponderado = 0;
    let presentes = 0;
    let justificados = 0;
    let ausentes = 0;

    miembrosVisibles.forEach(m => {
      const st = statsPorIntegrante.get(m.id);
      if (!st) return;
      citados += st.citaciones;
      presentes += st.presentes;
      justificados += st.justificados;
      ausentes += st.ausentes;
      ponderado += st.presentes + st.justificados * 0.5;
    });

    return {
      citados,
      presentes,
      justificados,
      ausentes,
      porcentaje: citados > 0 ? Math.round((ponderado / citados) * 100) : null
    };
  }, [miembrosVisibles, statsPorIntegrante]);

  // Miembros bajo el umbral de asistencia
  const miembrosEnAlerta = useMemo(
    () =>
      miembrosVisibles
        .map(m => ({ miembro: m, stats: statsPorIntegrante.get(m.id)! }))
        .filter(x => x.stats && x.stats.citaciones > 0 && x.stats.porcentaje < 70)
        .sort((a, b) => a.stats.porcentaje - b.stats.porcentaje),
    [miembrosVisibles, statsPorIntegrante]
  );

  // Cumplimiento por cuerda vocal, ponderado por citados
  const statsPorCuerda = useMemo(() => {
    const cuerdas = ['Soprano', 'Contralto', 'Tenor', 'Bajo', 'Solista'];
    return cuerdas.map(c => {
      const miembros = miembrosVisibles.filter(i => i.cuerda === c);
      let citados = 0;
      let ponderado = 0;
      miembros.forEach(m => {
        const st = statsPorIntegrante.get(m.id);
        if (!st) return;
        citados += st.citaciones;
        ponderado += st.presentes + st.justificados * 0.5;
      });
      return {
        cuerda: c,
        total: miembros.length,
        porcentaje: citados > 0 ? Math.round((ponderado / citados) * 100) : null
      };
    });
  }, [miembrosVisibles, statsPorIntegrante]);

  // Serie mensual: un mes sin listas finalizadas se muestra como "—"
  const serieMensual = useMemo(() => {
    const hoy = new Date();

    const calcularMes = (anio: number, mes: number) => {
      const cerradosDelMes = eventosCerrados.filter(ev => {
        const f = new Date(ev.fechaHoraInicio);
        return f.getFullYear() === anio && f.getMonth() === mes;
      });

      let citados = 0;
      let ponderado = 0;
      miembrosVisibles.forEach(m => {
        cerradosDelMes.forEach(ev => {
          if (!fueConvocado(ev, m)) return;
          citados++;
          const st = asistenciasMap.get(`${ev.id}_${m.id}`);
          if (st === 'Presente') ponderado += 1;
          else if (st === 'Justificado') ponderado += 0.5;
        });
      });

      return {
        key: `${anio}-${String(mes + 1).padStart(2, '0')}`,
        etiqueta: NOMBRES_MES[mes],
        corta: NOMBRES_MES[mes].slice(0, 3),
        porcentaje: citados > 0 ? Math.round((ponderado / citados) * 100) : null,
        actividades: cerradosDelMes.length
      };
    };

    if (periodo === 'Mes') return [calcularMes(hoy.getFullYear(), hoy.getMonth())];

    if (periodo === 'Semestre') {
      const primerSemestre = hoy.getMonth() <= 5;
      const base = primerSemestre ? 0 : 6;
      return Array.from({ length: 6 }, (_, i) => calcularMes(hoy.getFullYear(), base + i));
    }

    if (periodo === 'Anio') {
      return Array.from({ length: 12 }, (_, i) => calcularMes(hoy.getFullYear(), i));
    }

    // Histórico: solo los meses que registran listas finalizadas
    const claves = new Set(
      eventosCerrados.map(ev => {
        const f = new Date(ev.fechaHoraInicio);
        return `${f.getFullYear()}-${f.getMonth()}`;
      })
    );
    return Array.from(claves)
      .map(k => k.split('-').map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .slice(-12)
      .map(([anio, mes]) => calcularMes(anio, mes));
  }, [periodo, eventosCerrados, miembrosVisibles, asistenciasMap]);

  // Ranking: mayor asistencia y mayor inasistencia (top 3 cada uno)
  const ranking = useMemo(() => {
    const lista = miembrosVisibles
      .map(m => ({ miembro: m, stats: statsPorIntegrante.get(m.id)! }))
      .filter(x => x.stats && x.stats.citaciones > 0);

    return {
      mejores: [...lista].sort((a, b) => b.stats.porcentaje - a.stats.porcentaje).slice(0, 3),
      alertas: [...lista].sort((a, b) => a.stats.porcentaje - b.stats.porcentaje).slice(0, 3)
    };
  }, [miembrosVisibles, statsPorIntegrante]);

  const miembroAbierto = integrantes.find(i => i.id === miembroAbiertoId) || null;

  const handleAlternarCelda = (eventoId: string, integranteId: string) => {
    if (!puede('pasar_lista')) return;
    const actual = asistenciasMap.get(`${eventoId}_${integranteId}`);
    let nuevo: 'Presente' | 'Justificado' | 'Ausente' = 'Presente';
    if (actual === 'Presente') nuevo = 'Justificado';
    else if (actual === 'Justificado') nuevo = 'Ausente';
    marcarAsistencia(eventoId, integranteId, nuevo);
  };

  // EXPORTACIONES (respetan el período seleccionado)
  const exportarAExcel = () => {
    const dataMatriz: Record<string, string | number>[] = [];
    miembrosVisibles.forEach(m => {
      const fila: Record<string, string | number> = {
        Nombre: m.nombreCompleto,
        Cuerda: m.cuerda,
        Iglesia: m.iglesia
      };
      eventosDelPeriodo.forEach(ev => {
        const fecha = new Date(ev.fechaHoraInicio).toLocaleDateString('es-CL', {
          day: '2-digit',
          month: '2-digit'
        });
        const st = asistenciasMap.get(`${ev.id}_${m.id}`);
        fila[`${fecha} (${ev.tipo})`] =
          st === 'Presente' ? 'P' : st === 'Ausente' ? 'A' : st === 'Justificado' ? 'J' : '—';
      });
      const st = statsPorIntegrante.get(m.id);
      fila['Total Convocados'] = st?.citaciones || 0;
      fila['Presentes'] = st?.presentes || 0;
      fila['Justificados'] = st?.justificados || 0;
      fila['Ausentes'] = st?.ausentes || 0;
      fila['% Cumplimiento'] = st && st.citaciones > 0 ? `${st.porcentaje}%` : '—';
      dataMatriz.push(fila);
    });

    const wb = XLSX.utils.book_new();
    const wsMatriz = XLSX.utils.json_to_sheet(dataMatriz);
    XLSX.utils.book_append_sheet(wb, wsMatriz, `Matriz ${rango.etiqueta}`.slice(0, 31));

    const dataDirectorio = miembrosVisibles.map(i => ({
      Nombre: i.nombreCompleto,
      Cuerda: i.cuerda,
      Iglesia: i.iglesia,
      Teléfono: i.telefono,
      Email: i.email,
      Dirección: i.direccion,
      Estado: i.estado,
      'Fecha Ingreso': i.fechaIngreso,
      'Fecha Nacimiento': i.fechaNacimiento || ''
    }));
    const wsDirectorio = XLSX.utils.json_to_sheet(dataDirectorio);
    XLSX.utils.book_append_sheet(wb, wsDirectorio, 'Miembros');

    const dataMeses = serieMensual.map(s => ({
      Mes: s.etiqueta,
      'Listas finalizadas': s.actividades,
      'Asistencia (%)': s.porcentaje === null ? '—' : s.porcentaje
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataMeses), 'Evolución mensual');

    XLSX.writeFile(
      wb,
      `Solibook_Metricas_${rango.etiqueta.replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`
    );
  };

  const exportarAPdfLandscape = () => {
    const doc = new jsPDF({ orientation: 'landscape', format: 'letter' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 153, 221);
    doc.text('SOLI', 15, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('BOOK', 28, 15);
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`PLANILLA OFICIAL DE ASISTENCIA · ${rango.etiqueta.toUpperCase()}`, 48, 15);
    doc.line(15, 18, 265, 18);

    let startY = 25;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('N°', 15, startY);
    doc.text('Integrante', 22, startY);
    doc.text('Cuerda', 70, startY);
    doc.text('Iglesia', 92, startY);

    let posX = 135;
    const eventosMax = eventosDelPeriodo.slice(0, 8);
    eventosMax.forEach(ev => {
      const fecha = new Date(ev.fechaHoraInicio).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit'
      });
      doc.text(fecha, posX, startY);
      posX += 12;
    });

    doc.text('Pres.', 235, startY);
    doc.text('Aus.', 245, startY);
    doc.text('% Final', 255, startY);
    doc.line(15, startY + 2, 265, startY + 2);

    startY += 7;
    doc.setFont('helvetica', 'normal');

    miembrosVisibles.forEach((m, idx) => {
      if (startY > 185) {
        doc.addPage();
        startY = 20;
      }
      doc.text(String(idx + 1).padStart(2, '0'), 15, startY);
      doc.text(m.nombreCompleto.slice(0, 24), 22, startY);
      doc.text(m.cuerda, 70, startY);
      doc.text(m.iglesia.slice(0, 20), 92, startY);

      let pX = 135;
      eventosMax.forEach(ev => {
        const st = asistenciasMap.get(`${ev.id}_${m.id}`);
        const letra = st === 'Presente' ? 'P' : st === 'Ausente' ? 'A' : st === 'Justificado' ? 'J' : '—';
        doc.text(letra, pX + 2, startY);
        pX += 12;
      });

      const st = statsPorIntegrante.get(m.id);
      doc.text(String(st?.presentes || 0), 237, startY);
      doc.text(String(st?.ausentes || 0), 247, startY);
      doc.text(st && st.citaciones > 0 ? `${st.porcentaje}%` : '—', 257, startY);
      doc.line(15, startY + 2, 265, startY + 2);
      startY += 6;
    });

    doc.line(40, 195, 90, 195);
    doc.text('Secretaría General', 50, 200);
    doc.line(170, 195, 220, 195);
    doc.text('Dirección de Ministerio', 178, 200);

    doc.save(`Solibook_Planilla_${rango.etiqueta.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
  };

  const colorPorcentaje = (p: number) =>
    p >= 80 ? 'text-emerald-700' : p >= 65 ? 'text-amber-700' : 'text-rose-700';

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Encabezado con filtro de período */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Métricas</h2>
            <p className="text-xs text-slate-400">
              Indicadores calculados sobre datos registrados · {rango.etiqueta}
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {PERIODOS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  periodo === p.id ? 'bg-white text-[#0099DD] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-[#0077B6] font-bold border border-sky-100">
            {rango.etiqueta}
          </span>
          <span className="text-slate-400">
            {eventosDelPeriodo.length} actividades · {eventosCerrados.length} listas finalizadas ·
            {` ${miembrosVisibles.length} miembros activos`}
          </span>
        </div>
      </div>

      {/* Tarjetas superiores interactivas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setDetalle('miembros')}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between text-left hover:border-sky-300 transition-colors"
        >
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Miembros Activos
            </span>
            <span className="text-2xl font-black text-slate-800">{miembrosVisibles.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0099DD] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => setDetalle('actividades')}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between text-left hover:border-sky-300 transition-colors"
        >
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Actividades
            </span>
            <span className="text-2xl font-black text-slate-800">{eventosDelPeriodo.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0077B6] flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => setDetalle('promedio')}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between text-left hover:border-sky-300 transition-colors"
        >
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Promedio Global
            </span>
            <span
              className={`text-2xl font-black ${
                promedioGlobal.porcentaje === null ? 'text-slate-300' : 'text-emerald-600'
              }`}
            >
              {promedioGlobal.porcentaje === null ? '—' : `${promedioGlobal.porcentaje}%`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => setDetalle('alerta')}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between text-left hover:border-rose-300 transition-colors"
        >
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Alerta (&lt;70% asistencia)
            </span>
            <span className="text-2xl font-black text-rose-600">{miembrosEnAlerta.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Sub-pestañas y exportaciones */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setSubpestana('estadisticas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              subpestana === 'estadisticas' ? 'bg-white text-[#0099DD] shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Reportes y Gráficos
          </button>
          <button
            onClick={() => setSubpestana('matriz')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              subpestana === 'matriz' ? 'bg-white text-[#8B1E2B] shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4" />
            Matriz del período
          </button>
        </div>

        <div className="flex items-center gap-2">
          {puede('exportar_datos') && (
          <>
          <button
            onClick={exportarAExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={exportarAPdfLandscape}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir PDF</span>
          </button>
          </>
          )}
        </div>
      </div>

      {/* SUBPESTAÑA 1: REPORTES Y GRÁFICOS */}
      {subpestana === 'estadisticas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-[#0099DD]" />
                  Asistencia por mes
                </h3>
                <p className="text-xs text-slate-400">
                  Solo listas finalizadas. Un mes sin listas cerradas se muestra como &quot;—&quot;.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                {rango.etiqueta}: {promedioGlobal.porcentaje === null ? '—' : `${promedioGlobal.porcentaje}%`}
              </span>
            </div>

            <div
              className={`grid gap-2 pt-4 items-end min-h-[160px] ${
                serieMensual.length > 7 ? 'grid-cols-7 lg:grid-cols-12' : 'grid-cols-6'
              }`}
            >
              {serieMensual.map(m => (
                <div key={m.key} className="flex flex-col items-center gap-2 h-full justify-end">
                  <span
                    className={`text-[11px] font-bold ${
                      m.porcentaje === null ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {m.porcentaje === null ? '—' : `${m.porcentaje}%`}
                  </span>
                  <div className="w-full bg-slate-100 rounded-t-xl overflow-hidden h-28 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-[#0077B6] to-[#0099DD] rounded-t-xl transition-all duration-500 hover:opacity-90"
                      style={{ height: `${m.porcentaje ?? 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">{m.corta}</span>
                  <span className="text-[9px] text-slate-400">
                    {m.actividades} {m.actividades === 1 ? 'lista' : 'listas'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-[#8B1E2B]" />
                Cumplimiento por Cuerda Vocal
              </h3>
              <p className="text-xs text-slate-400">Promedio ponderado por cantidad de citados</p>

              <div className="space-y-3 pt-2">
                {statsPorCuerda.map(c => (
                  <div key={c.cuerda} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {c.cuerda} ({c.total} miembros)
                      </span>
                      <span className={`font-bold ${c.porcentaje === null ? 'text-slate-300' : 'text-slate-800'}`}>
                        {c.porcentaje === null ? '—' : `${c.porcentaje}%`}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (c.porcentaje ?? 0) >= 85
                            ? 'bg-emerald-500'
                            : (c.porcentaje ?? 0) >= 70
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${c.porcentaje ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Mayor Asistencia
                </h3>
                <div className="space-y-1.5 mt-2">
                  {ranking.mejores.length === 0 && (
                    <p className="text-xs text-slate-400 py-2">Sin datos suficientes en el período.</p>
                  )}
                  {ranking.mejores.map(({ miembro, stats }) => (
                    <button
                      key={miembro.id}
                      onClick={() => setMiembroAbiertoId(miembro.id)}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-left hover:border-emerald-300 transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block truncate">{miembro.nombreCompleto}</span>
                        <span className="text-[10px] text-slate-400">
                          {miembro.cuerda} · {stats.citaciones} citaciones
                        </span>
                      </div>
                      <span className={`font-black text-sm ${colorPorcentaje(stats.porcentaje)}`}>
                        {stats.porcentaje}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Mayor Inasistencia
                </h3>
                <div className="space-y-1.5 mt-2">
                  {ranking.alertas.length === 0 && (
                    <p className="text-xs text-slate-400 py-2">Sin datos suficientes en el período.</p>
                  )}
                  {ranking.alertas.map(({ miembro, stats }) => (
                    <button
                      key={miembro.id}
                      onClick={() => setMiembroAbiertoId(miembro.id)}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-rose-50/50 border border-rose-100 text-xs text-left hover:border-rose-300 transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block truncate">{miembro.nombreCompleto}</span>
                        <span className="text-[10px] text-slate-400">
                          {miembro.cuerda} · {stats.citaciones} citaciones
                        </span>
                      </div>
                      <span className={`font-black text-sm ${colorPorcentaje(stats.porcentaje)}`}>
                        {stats.porcentaje}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBPESTAÑA 2: MATRIZ DEL PERÍODO */}
      {subpestana === 'matriz' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar miembro..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#0099DD]"
              />
            </div>
            <select
              value={filtroCuerda}
              onChange={e => setFiltroCuerda(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
            >
              <option value="Todas">Todas las Cuerdas</option>
              {['Soprano', 'Contralto', 'Tenor', 'Bajo', 'Solista', 'Directiva'].map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filtroIglesia}
              onChange={e => setFiltroIglesia(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
            >
              <option value="Todas">Todas las Iglesias</option>
              {listaIglesias.map(i => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                Matriz del período ({rango.etiqueta}) — clic sobre una celda para alternar P / J / A
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> P = Presente
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> J = Justificado
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> A = Ausente
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-3 sticky left-0 bg-slate-100 z-10 w-12 text-center">#</th>
                    <th className="p-3 sticky left-12 bg-slate-100 z-10 min-w-[180px]">Miembro</th>
                    <th className="p-3 min-w-[90px]">Cuerda</th>
                    <th className="p-3 min-w-[160px]">Iglesia</th>

                    {eventosDelPeriodo.map(ev => {
                      const fecha = new Date(ev.fechaHoraInicio);
                      const dia = fecha.getDate();
                      const mes = fecha.toLocaleDateString('es-CL', { month: 'short' });
                      return (
                        <th
                          key={ev.id}
                          className="p-2 text-center min-w-[65px] border-l border-slate-200/70 font-semibold"
                        >
                          <div className="text-[11px] font-bold text-slate-800">
                            {dia} {mes}
                          </div>
                          <div
                            className={`text-[9px] uppercase ${
                              ev.asistenciaFinalizada ? 'text-[#0099DD]' : 'text-slate-400'
                            }`}
                          >
                            {ev.tipo.slice(0, 3)}
                          </div>
                        </th>
                      );
                    })}

                    <th className="p-3 text-center min-w-[65px] border-l-2 border-slate-300 bg-slate-100/90">
                      Pres.
                    </th>
                    <th className="p-3 text-center min-w-[65px] bg-slate-100/90">Aus.</th>
                    <th className="p-3 text-center min-w-[80px] bg-slate-100/90">% Cumpl.</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {miembrosVisibles.length === 0 && (
                    <tr>
                      <td colSpan={eventosDelPeriodo.length + 7} className="p-8 text-center text-slate-400">
                        No hay miembros que coincidan con los filtros.
                      </td>
                    </tr>
                  )}

                  {miembrosVisibles.map((m, idx) => {
                    const stats = statsPorIntegrante.get(m.id);

                    return (
                      <tr key={m.id} className="hover:bg-sky-50/40 transition-colors">
                        <td className="p-3 sticky left-0 bg-white z-10 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td
                          onClick={() => setMiembroAbiertoId(m.id)}
                          className="p-3 sticky left-12 bg-white z-10 font-bold text-slate-900 truncate cursor-pointer hover:text-[#0099DD]"
                        >
                          {m.nombreCompleto}
                        </td>
                        <td className="p-3 text-slate-600 font-semibold">{m.cuerda}</td>
                        <td className="p-3 text-slate-500 truncate">{m.iglesia}</td>

                        {eventosDelPeriodo.map(ev => {
                          if (!fueConvocado(ev, m)) {
                            return (
                              <td
                                key={ev.id}
                                className="p-2 text-center text-slate-300 font-bold border-l border-slate-100 select-none"
                              >
                                —
                              </td>
                            );
                          }

                          const st = asistenciasMap.get(`${ev.id}_${m.id}`);

                          return (
                            <td
                              key={ev.id}
                              onClick={() => handleAlternarCelda(ev.id, m.id)}
                              className="p-1.5 text-center border-l border-slate-100 cursor-pointer select-none"
                            >
                              <div
                                className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center font-extrabold text-[11px] transition-transform hover:scale-110 ${
                                  st === 'Presente'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : st === 'Justificado'
                                      ? 'bg-amber-100 text-amber-800'
                                      : st === 'Ausente'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {st === 'Presente'
                                  ? 'P'
                                  : st === 'Justificado'
                                    ? 'J'
                                    : st === 'Ausente'
                                      ? 'A'
                                      : '·'}
                              </div>
                            </td>
                          );
                        })}

                        <td className="p-3 text-center font-bold text-emerald-700 border-l-2 border-slate-200 bg-slate-50/50">
                          {stats?.presentes || 0}
                        </td>
                        <td className="p-3 text-center font-bold text-rose-700 bg-slate-50/50">
                          {stats?.ausentes || 0}
                        </td>
                        <td className="p-3 text-center bg-slate-50/50">
                          {stats && stats.citaciones > 0 ? (
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                stats.porcentaje >= 80
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : stats.porcentaje >= 65
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {stats.porcentaje}%
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle de tarjetas */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {detalle === 'miembros' && 'Miembros activos'}
                  {detalle === 'actividades' && `Actividades del período`}
                  {detalle === 'promedio' && 'Detalle del promedio'}
                  {detalle === 'alerta' && 'Miembros bajo 70%'}
                </h3>
                <p className="text-[11px] text-slate-400">{rango.etiqueta}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {detalle === 'miembros' &&
                miembrosVisibles.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setDetalle(null);
                      setMiembroAbiertoId(m.id);
                    }}
                    className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50/40 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate">
                        {m.nombreCompleto}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {m.cuerda} · {m.iglesia}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                ))}

              {detalle === 'actividades' &&
                (eventosDelPeriodo.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Sin actividades registradas en este período.
                  </p>
                ) : (
                  eventosDelPeriodo.map(ev => (
                    <div key={ev.id} className="p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{ev.titulo}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            ev.asistenciaFinalizada
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {ev.asistenciaFinalizada ? 'Finalizada' : 'Pendiente'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ev.fechaHoraInicio).toLocaleString('es-CL', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}{' '}
                        · {ev.tipo}
                      </span>
                    </div>
                  ))
                ))}

              {detalle === 'promedio' && (
                <div className="space-y-2">
                  {promedioGlobal.citados === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Sin listas finalizadas en este período. El promedio se muestra como &quot;—&quot;.
                    </p>
                  ) : (
                    <>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Citaciones consideradas</span>
                          <span className="font-bold text-slate-800">{promedioGlobal.citados}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Presentes</span>
                          <span className="font-bold text-emerald-700">{promedioGlobal.presentes}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Justificados (valen 0,5)</span>
                          <span className="font-bold text-amber-700">{promedioGlobal.justificados}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Ausentes</span>
                          <span className="font-bold text-rose-700">{promedioGlobal.ausentes}</span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-slate-200">
                          <span className="font-semibold text-slate-700">Promedio ponderado</span>
                          <span className="font-black text-slate-900">{promedioGlobal.porcentaje}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Calculado sobre {eventosCerrados.length} listas finalizadas, ponderado por cantidad de
                        citados.
                      </p>
                    </>
                  )}
                </div>
              )}

              {detalle === 'alerta' &&
                (miembrosEnAlerta.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Ningún miembro activo está bajo el umbral en este período.
                  </p>
                ) : (
                  miembrosEnAlerta.map(({ miembro, stats }) => (
                    <button
                      key={miembro.id}
                      onClick={() => {
                        setDetalle(null);
                        setMiembroAbiertoId(miembro.id);
                      }}
                      className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border border-rose-100 bg-rose-50/40 hover:border-rose-300 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 block truncate">
                          {miembro.nombreCompleto}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {miembro.cuerda} · {stats.citaciones} citaciones
                        </span>
                      </div>
                      <span className="font-black text-sm text-rose-700 shrink-0">{stats.porcentaje}%</span>
                    </button>
                  ))
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Ficha del miembro: el mismo componente que usa el Libro de Miembros */}
      {miembroAbierto && (
        <TarjetaPerfilMiembro integrante={miembroAbierto} onCerrar={() => setMiembroAbiertoId(null)} />
      )}
    </div>
  );
};
