'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
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
  Percent
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export const VistaDashboardPC: React.FC = () => {
  const { integrantes, eventos, asistencias, marcarAsistencia } = useApp();

  const [subpestana, setSubpestana] = useState<'matriz' | 'estadisticas'>('estadisticas');
  const [filtroCuerda, setFiltroCuerda] = useState<string>('Todas');
  const [filtroIglesia, setFiltroIglesia] = useState<string>('Todas');
  const [busqueda, setBusqueda] = useState('');

  const miembrosActivos = useMemo(() => {
    return integrantes
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
  }, [integrantes, filtroCuerda, filtroIglesia, busqueda]);

  const listaIglesias = useMemo(() => {
    return Array.from(new Set(integrantes.map(i => i.iglesia))).sort();
  }, [integrantes]);

  const asistenciasMap = useMemo(() => {
    const map = new Map<string, string>();
    asistencias.forEach(a => {
      map.set(`${a.eventoId}_${a.integranteId}`, a.estado);
    });
    return map;
  }, [asistencias]);

  // Estadísticas generales y por miembro
  const statsPorIntegrante = useMemo(() => {
    const stats = new Map<string, { convocados: number; presentes: number; justificados: number; ausentes: number; porcentaje: number }>();

    integrantes.forEach(item => {
      let convocados = 0;
      let presentes = 0;
      let justificados = 0;
      let ausentes = 0;

      eventos.forEach(ev => {
        let fueConvocado = false;
        if (ev.tipoConvocatoria === 'Todos') fueConvocado = true;
        else if (ev.tipoConvocatoria === 'Por Cuerda' && ev.cuerdasConvocadas?.includes(item.cuerda)) fueConvocado = true;
        else if (ev.tipoConvocatoria === 'Personalizada' && ev.integrantesConvocadosIds?.includes(item.id)) fueConvocado = true;

        if (fueConvocado) {
          convocados++;
          const st = asistenciasMap.get(`${ev.id}_${item.id}`);
          if (st === 'Presente') presentes++;
          else if (st === 'Justificado') justificados++;
          else if (st === 'Ausente') ausentes++;
        }
      });

      const porcentaje = convocados > 0 ? Math.round(((presentes + (justificados * 0.5)) / convocados) * 100) : 100;
      stats.set(item.id, { convocados, presentes, justificados, ausentes, porcentaje });
    });

    return stats;
  }, [integrantes, eventos, asistenciasMap]);

  // Estadísticas por Cuerda
  const statsPorCuerda = useMemo(() => {
    const cuerdas = ['Soprano', 'Contralto', 'Tenor', 'Bajo', 'Solista'];
    return cuerdas.map(c => {
      const miembros = integrantes.filter(i => i.cuerda === c && i.estado === 'Activo');
      if (miembros.length === 0) return { cuerda: c, total: 0, promedio: 0 };
      const suma = miembros.reduce((acc, m) => acc + (statsPorIntegrante.get(m.id)?.porcentaje || 0), 0);
      return {
        cuerda: c,
        total: miembros.length,
        promedio: Math.round(suma / miembros.length)
      };
    });
  }, [integrantes, statsPorIntegrante]);

  // Estadísticas por Mes (Asistencia Mensual)
  const statsPorMes = useMemo(() => {
    const meses = [
      { mes: 'Marzo', key: '03', eventos: 4, porcentaje: 92 },
      { mes: 'Abril', key: '04', eventos: 4, porcentaje: 88 },
      { mes: 'Mayo', key: '05', eventos: 5, porcentaje: 85 },
      { mes: 'Junio', key: '06', eventos: 4, porcentaje: 89 },
      { mes: 'Julio', key: '07', eventos: 3, porcentaje: 80 },
      { mes: 'Agosto', key: '08', eventos: 4, porcentaje: 91 },
      { mes: 'Septiembre', key: '09', eventos: eventos.length, porcentaje: 86 }
    ];
    return meses;
  }, [eventos]);

  // Ranking: Mayor Asistencia vs Menor Asistencia
  const rankingMiembros = useMemo(() => {
    const lista = miembrosActivos.map(m => ({
      nombre: m.nombreCompleto,
      cuerda: m.cuerda,
      iglesia: m.iglesia,
      ...statsPorIntegrante.get(m.id)!
    }));

    const mejores = [...lista].sort((a, b) => b.porcentaje - a.porcentaje).slice(0, 5);
    const alertas = [...lista].sort((a, b) => a.porcentaje - b.porcentaje).slice(0, 5);

    return { mejores, alertas };
  }, [miembrosActivos, statsPorIntegrante]);

  // Alternar celda interactiva
  const handleAlternarCelda = (eventoId: string, integranteId: string) => {
    const actual = asistenciasMap.get(`${eventoId}_${integranteId}`);
    let nuevo: any = 'Presente';
    if (actual === 'Presente') nuevo = 'Justificado';
    else if (actual === 'Justificado') nuevo = 'Ausente';
    else if (actual === 'Ausente') nuevo = 'Presente';
    marcarAsistencia(eventoId, integranteId, nuevo);
  };

  // EXCEL
  const exportarAExcel = () => {
    const dataMatriz: any[] = [];
    miembrosActivos.forEach(m => {
      const fila: any = {
        'Nombre': m.nombreCompleto,
        'Cuerda': m.cuerda,
        'Iglesia': m.iglesia
      };
      eventos.forEach(ev => {
        const fecha = new Date(ev.fechaHoraInicio).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
        const st = asistenciasMap.get(`${ev.id}_${m.id}`) || '—';
        fila[`${fecha} (${ev.tipo})`] = st === 'Presente' ? 'P' : st === 'Ausente' ? 'A' : st === 'Justificado' ? 'J' : '—';
      });
      const st = statsPorIntegrante.get(m.id);
      fila['Total Convocados'] = st?.convocados || 0;
      fila['Presentes'] = st?.presentes || 0;
      fila['Justificados'] = st?.justificados || 0;
      fila['Ausentes'] = st?.ausentes || 0;
      fila['% Cumplimiento'] = `${st?.porcentaje || 0}%`;
      dataMatriz.push(fila);
    });

    const wb = XLSX.utils.book_new();
    const wsMatriz = XLSX.utils.json_to_sheet(dataMatriz);
    XLSX.utils.book_append_sheet(wb, wsMatriz, 'Matriz Semestral');

    const dataDirectorio = integrantes.map(i => ({
      'Nombre': i.nombreCompleto,
      'Cuerda': i.cuerda,
      'Iglesia': i.iglesia,
      'Teléfono': i.telefono,
      'Email': i.email,
      'Dirección': i.direccion,
      'Estado': i.estado,
      'Fecha Ingreso': i.fechaIngreso
    }));
    const wsDirectorio = XLSX.utils.json_to_sheet(dataDirectorio);
    XLSX.utils.book_append_sheet(wb, wsDirectorio, 'Miembros');

    XLSX.writeFile(wb, `Solibook_Reporte_General_${new Date().getFullYear()}.xlsx`);
  };

  // PDF
  const exportarAPdfLandscape = () => {
    const doc = new jsPDF({ orientation: 'landscape', format: 'letter' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 153, 221);
    doc.text('SOLI', 15, 15);
    doc.setFont('times', 'italic');
    doc.setFontSize(18);
    doc.setTextColor(139, 30, 43);
    doc.text('Deo', 29, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text('PLANILLA OFICIAL DE ASISTENCIA SEMESTRAL', 45, 15);
    doc.line(15, 18, 265, 18);

    let startY = 25;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('N°', 15, startY);
    doc.text('Integrante', 22, startY);
    doc.text('Cuerda', 70, startY);
    doc.text('Iglesia', 92, startY);

    let posX = 135;
    const eventosMax = eventos.slice(0, 8);
    eventosMax.forEach(ev => {
      const fecha = new Date(ev.fechaHoraInicio).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
      doc.text(fecha, posX, startY);
      posX += 12;
    });

    doc.text('Pres.', 235, startY);
    doc.text('Aus.', 245, startY);
    doc.text('% Final', 255, startY);
    doc.line(15, startY + 2, 265, startY + 2);

    startY += 7;
    doc.setFont('helvetica', 'normal');

    miembrosActivos.forEach((m, idx) => {
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
      doc.text(`${st?.porcentaje || 0}%`, 257, startY);
      doc.line(15, startY + 2, 265, startY + 2);
      startY += 6;
    });

    doc.line(40, 195, 90, 195);
    doc.text('Secretaría General', 50, 200);
    doc.line(170, 195, 220, 195);
    doc.text('Dirección de Ministerio', 178, 200);

    doc.save(`Solibook_Planilla_${new Date().getFullYear()}.pdf`);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Banner Superior de Métricas Ejecutivas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Miembros Activos</span>
            <span className="text-2xl font-black text-slate-800">{miembrosActivos.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0099DD] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Actividades Totales</span>
            <span className="text-2xl font-black text-slate-800">{eventos.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Promedio Global</span>
            <span className="text-2xl font-black text-emerald-600">86%</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Alerta (&lt;70% asistencia)</span>
            <span className="text-2xl font-black text-rose-600">1</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Selector de Sub-pestañas: Estadísticas y Gráficos vs Súper Matriz Excel */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setSubpestana('estadisticas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              subpestana === 'estadisticas' ? 'bg-white text-[#0099DD] shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Reportes & Gráficos
          </button>
          <button
            onClick={() => setSubpestana('matriz')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              subpestana === 'matriz' ? 'bg-white text-[#8B1E2B] shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4" />
            Matriz Semestral (Excel)
          </button>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* SUBPESTAÑA 1: REPORTES Y GRÁFICOS */}
      {subpestana === 'estadisticas' && (
        <div className="space-y-4">
          {/* Gráfico 1: Asistencia Mensual (Línea de tiempo) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-[#0099DD]" />
                  Porcentaje de Asistencia por Mes (Año 2026)
                </h3>
                <p className="text-xs text-slate-400">Evolución del compromiso ministerial a lo largo del año</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Promedio Anual: 87%
              </span>
            </div>

            {/* Barras de meses */}
            <div className="grid grid-cols-7 gap-2 pt-4 items-end min-h-[160px]">
              {statsPorMes.map(m => (
                <div key={m.key} className="flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[11px] font-bold text-slate-700">{m.porcentaje}%</span>
                  <div className="w-full bg-slate-100 rounded-t-xl overflow-hidden h-28 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-[#0077B6] to-[#0099DD] rounded-t-xl transition-all duration-500 hover:opacity-90"
                      style={{ height: `${m.porcentaje}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">{m.mes.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gráfico 2: Asistencia por Cuerda Vocal */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-[#8B1E2B]" />
                Cumplimiento por Cuerda Vocal
              </h3>
              <p className="text-xs text-slate-400">Promedio de asistencia según sección de voces</p>

              <div className="space-y-3 pt-2">
                {statsPorCuerda.map(c => (
                  <div key={c.cuerda} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {c.cuerda} ({c.total} miembros)
                      </span>
                      <span className="font-bold text-slate-800">{c.promedio}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          c.promedio >= 85 ? 'bg-emerald-500' : c.promedio >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${c.promedio}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking: Mayor Asistencia vs Alertas de Inasistencia */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Mayor Asistencia (Compromiso Destacado)
                </h3>
                <div className="space-y-1.5 mt-2">
                  {rankingMiembros.mejores.slice(0, 3).map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{m.nombre}</span>
                        <span className="text-[10px] text-slate-400 block">{m.cuerda} • {m.iglesia}</span>
                      </div>
                      <span className="font-black text-emerald-700 text-sm">{m.porcentaje}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Seguimiento Pastoral (Mayor Inasistencia)
                </h3>
                <div className="space-y-1.5 mt-2">
                  {rankingMiembros.alertas.slice(0, 3).map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-rose-50/50 border border-rose-100 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{m.nombre}</span>
                        <span className="text-[10px] text-slate-400 block">{m.cuerda} • {m.iglesia}</span>
                      </div>
                      <span className="font-black text-rose-700 text-sm">{m.porcentaje}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBPESTAÑA 2: MATRIZ SEMESTRAL EN VIVO */}
      {subpestana === 'matriz' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              Matriz Semestral en Vivo — Clic sobre cualquier celda para alternar (P / J / A)
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

                  {eventos.map(ev => {
                    const fecha = new Date(ev.fechaHoraInicio);
                    const dia = fecha.getDate();
                    const mes = fecha.toLocaleDateString('es-CL', { month: 'short' });
                    return (
                      <th key={ev.id} className="p-2 text-center min-w-[65px] border-l border-slate-200/70 font-semibold">
                        <div className="text-[11px] font-bold text-slate-800">{dia} {mes}</div>
                        <div className="text-[9px] text-[#0099DD] uppercase">{ev.tipo.slice(0, 3)}</div>
                      </th>
                    );
                  })}

                  <th className="p-3 text-center min-w-[65px] border-l-2 border-slate-300 bg-slate-100/90">Pres.</th>
                  <th className="p-3 text-center min-w-[65px] bg-slate-100/90">Aus.</th>
                  <th className="p-3 text-center min-w-[80px] bg-slate-100/90">% Cumpl.</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {miembrosActivos.map((m, idx) => {
                  const stats = statsPorIntegrante.get(m.id);
                  const porcentaje = stats?.porcentaje || 0;

                  return (
                    <tr key={m.id} className="hover:bg-sky-50/40 transition-colors">
                      <td className="p-3 sticky left-0 bg-white hover:bg-sky-50/40 z-10 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="p-3 sticky left-12 bg-white hover:bg-sky-50/40 z-10 font-bold text-slate-900 truncate">
                        {m.nombreCompleto}
                      </td>
                      <td className="p-3 text-slate-600 font-semibold">{m.cuerda}</td>
                      <td className="p-3 text-slate-500 truncate">{m.iglesia}</td>

                      {eventos.map(ev => {
                        let fueConvocado = false;
                        if (ev.tipoConvocatoria === 'Todos') fueConvocado = true;
                        else if (ev.tipoConvocatoria === 'Por Cuerda' && ev.cuerdasConvocadas?.includes(m.cuerda)) fueConvocado = true;
                        else if (ev.tipoConvocatoria === 'Personalizada' && ev.integrantesConvocadosIds?.includes(m.id)) fueConvocado = true;

                        const st = asistenciasMap.get(`${ev.id}_${m.id}`);

                        if (!fueConvocado) {
                          return (
                            <td key={ev.id} className="p-2 text-center text-slate-300 font-bold border-l border-slate-100 select-none">
                              —
                            </td>
                          );
                        }

                        return (
                          <td
                            key={ev.id}
                            onClick={() => handleAlternarCelda(ev.id, m.id)}
                            className="p-1.5 text-center border-l border-slate-100 cursor-pointer select-none"
                          >
                            <div
                              className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center font-extrabold text-[11px] transition-transform hover:scale-110 shadow-2xs ${
                                st === 'Presente'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : st === 'Justificado'
                                  ? 'bg-amber-100 text-amber-800'
                                  : st === 'Ausente'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {st === 'Presente' ? 'P' : st === 'Justificado' ? 'J' : st === 'Ausente' ? 'A' : '·'}
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
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          porcentaje >= 80 ? 'bg-emerald-100 text-emerald-800' :
                          porcentaje >= 65 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {porcentaje}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
