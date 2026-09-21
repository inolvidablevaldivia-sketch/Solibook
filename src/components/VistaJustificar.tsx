'use client';

import { useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { comprimirImagenABase64 } from '@/lib/imageCompressor';
import { eventoJustificable, fechaActividadChile, MAX_EVENTOS_JUSTIFICACION, MAX_FOTO_JUSTIFICACION, puedeJustificarPorOtros } from '@/lib/justificaciones';
import type { Integrante } from '@/types';

export function VistaJustificar({ volver }: { volver: () => void }) {
  const { usuario, modoLocal } = useAuth();
  const { integrantes } = useApp();
  const [elegido, setElegido] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const gestion = puedeJustificarPorOtros(usuario?.rol || '');
  const id = gestion ? elegido ?? usuario?.integranteId ?? '' : usuario?.integranteId;
  const integrante = integrantes.find(i => i.id === id && i.estado === 'Activo');
  return <div className="max-w-2xl mx-auto pb-24 space-y-4">
    <button disabled={ocupado} onClick={volver} className="flex gap-2 items-center text-sm text-slate-500 disabled:opacity-50"><ArrowLeft size={16} /> Volver al inicio</button>
    <div><h1 className="text-xl font-bold">Justificar inasistencia</h1><p className="text-sm text-slate-500 mt-1">Selecciona las actividades a las que no podrás asistir. Tu solicitud quedará pendiente de revisión.</p></div>
    {modoLocal ? <p role="alert" className="p-4 rounded-xl bg-amber-50 text-amber-900">Para enviar una justificación debes iniciar sesión con Google y tener conexión. No se enviarán solicitudes desde el modo local.</p> : <>
      {gestion && <label className="block bg-white border border-slate-200 rounded-2xl p-4 text-sm font-semibold">Integrante
        <select disabled={ocupado} value={id} onChange={e => setElegido(e.target.value)} className="block mt-2 w-full rounded-xl border border-slate-200 p-3">
          <option value="">Selecciona a quién justificas</option>
          {integrantes.filter(i => i.estado === 'Activo').map(i => <option key={i.id} value={i.id}>{i.nombreCompleto}</option>)}
        </select>
      </label>}
      {integrante ? <FormularioJustificar key={integrante.id} integrante={integrante} alOcuparse={setOcupado} /> : <p role="status" className="bg-sky-50 text-sky-900 rounded-xl p-4 text-sm">{gestion ? 'Selecciona un integrante activo para ver sus próximas actividades.' : 'No se encontró una ficha activa vinculada a tu cuenta. Si acabas de entrar, espera a que cargue; si persiste, solicita a Dirección que revise el vínculo.'}</p>}
    </>}
  </div>;
}

function FormularioJustificar({ integrante, alOcuparse }: { integrante: Integrante; alOcuparse: (ocupado: boolean) => void }) {
  const { eventos, justificaciones } = useApp();
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  const [mesElegido, setMesElegido] = useState<string>();
  const [diaElegido, setDiaElegido] = useState<string>();
  const [motivo, setMotivo] = useState('');
  const [foto, setFoto] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const cubiertos = new Set(justificaciones.filter(j => j.integranteId === integrante.id && j.estado !== 'Rechazado').map(j => j.eventoId));
  const futuras = eventos.filter(e => eventoJustificable(e, integrante)).sort((a, b) => Date.parse(a.fechaHoraInicio) - Date.parse(b.fechaHoraInicio));
  const disponibles = futuras.filter(e => !cubiertos.has(e.id));
  const ids = seleccion ?? (disponibles[0] ? [disponibles[0].id] : []);
  const fechaInicial = disponibles[0] ? fechaActividadChile(disponibles[0].fechaHoraInicio) : fechaActividadChile(new Date().toISOString());
  const mes = mesElegido ?? fechaInicial.slice(0, 7);
  const dia = diaElegido ?? fechaInicial;
  const [anio, numeroMes] = mes.split('-').map(Number);
  const cantidadDias = new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate();
  const desplazamiento = (new Date(Date.UTC(anio, numeroMes - 1, 1)).getUTCDay() + 6) % 7;
  const tituloMes = new Date(Date.UTC(anio, numeroMes - 1, 1, 12)).toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const porDia = futuras.filter(e => fechaActividadChile(e.fechaHoraInicio) === dia);
  function cambiarMes(delta: number) {
    const fecha = new Date(Date.UTC(anio, numeroMes - 1 + delta, 1));
    setMesElegido(fecha.toISOString().slice(0, 7));
    setDiaElegido(fecha.toISOString().slice(0, 10));
  }
  function alternar(id: string) {
    setMensaje(''); setError('');
    if (ids.includes(id)) setSeleccion(ids.filter(i => i !== id));
    else if (ids.length >= MAX_EVENTOS_JUSTIFICACION) setError(`Puedes seleccionar hasta ${MAX_EVENTOS_JUSTIFICACION} actividades por envío.`);
    else setSeleccion([...ids, id]);
  }
  function bloquear(valor: boolean) { setOcupado(valor); alOcuparse(valor); }
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setError(''); setMensaje('');
    if (!ids.length || !motivo.trim()) { setError('Selecciona al menos una actividad y escribe el motivo.'); return; }
    if (ids.some(id => !disponibles.some(evento => evento.id === id))) { setError('Una actividad cambió, ya comenzó o tiene una justificación. Revisa tu selección.'); return; }
    bloquear(true);
    try {
      const usuario = auth.currentUser;
      if (!usuario) throw new Error('Vuelve a iniciar sesión para enviar.');
      const respuesta = await fetch('/api/justificaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await usuario.getIdToken()}` },
        body: JSON.stringify({ integranteId: integrante.id, eventoIds: ids, motivo, ...(foto ? { adjuntoUrl: foto } : {}) })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo enviar la justificación.');
      setMensaje(`${datos.enviadas} solicitud(es) enviada(s) para revisión.${datos.omitidas ? ` ${datos.omitidas} actividad(es) ya tenían una justificación pendiente o aprobada.` : ''}`);
      setSeleccion([]); setMotivo(''); setFoto(undefined);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar. Tu selección y el motivo se conservaron para reintentar.'); }
    finally { bloquear(false); }
  }
  return <form onSubmit={enviar} className="space-y-4">
    <fieldset disabled={ocupado} className="space-y-4 disabled:opacity-60">
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold flex gap-2 items-center"><CalendarDays size={18} /> Actividades de {integrante.nombreCompleto}</h2>
        <p className="text-xs text-slate-500">Solo futuras donde esté citado. La próxima disponible se selecciona al abrir; puedes quitarla o agregar otras fechas. Horario de Chile.</p>
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Mes anterior" onClick={() => cambiarMes(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft size={20} /></button>
          <span className="font-semibold capitalize">{tituloMes}</span>
          <button type="button" aria-label="Mes siguiente" onClick={() => cambiarMes(1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight size={20} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs" aria-label="Calendario de actividades">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <span key={d} className="py-2 text-slate-400">{d}</span>)}
          {Array.from({ length: desplazamiento }, (_, i) => <span key={`vacio-${i}`} />)}
          {Array.from({ length: cantidadDias }, (_, i) => {
            const fecha = `${mes}-${String(i + 1).padStart(2, '0')}`;
            const actividades = futuras.filter(e => fechaActividadChile(e.fechaHoraInicio) === fecha);
            const marcados = actividades.filter(e => ids.includes(e.id)).length;
            return <button key={fecha} type="button" disabled={!actividades.length} aria-label={`${fecha}: ${actividades.length} actividades, ${marcados} seleccionadas`} aria-pressed={dia === fecha} onClick={() => setDiaElegido(fecha)} className={`min-h-11 rounded-xl border ${dia === fecha ? 'border-sky-600 bg-sky-50' : 'border-transparent'} ${marcados ? 'font-bold text-sky-700' : ''} disabled:text-slate-300`}>
              {i + 1}<span className="block text-[9px] h-3">{marcados ? '✓' : actividades.length ? '●' : ''}</span>
            </button>;
          })}
        </div>
        <p className="text-xs text-slate-500">{dia} · {porDia.length} actividad(es)</p>
        {porDia.map(evento => <label key={evento.id} className="flex gap-3 items-start border border-slate-200 rounded-xl p-3 text-sm">
          <input type="checkbox" checked={ids.includes(evento.id)} disabled={cubiertos.has(evento.id)} onChange={() => alternar(evento.id)} className="mt-1 w-4 h-4 accent-sky-600" />
          <span><strong>{evento.titulo}</strong><span className="block text-xs text-slate-500">{new Date(evento.fechaHoraInicio).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' })} · {evento.lugarNombre}</span>{cubiertos.has(evento.id) && <span className="text-xs text-amber-700">Ya tiene una justificación pendiente o aprobada.</span>}</span>
        </label>)}
        {!disponibles.length && <p className="text-sm text-slate-500">No hay actividades futuras disponibles para justificar.</p>}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <h3 className="text-sm font-semibold">Seleccionadas: {ids.length}</h3>
          {ids.map(id => {
            const evento = eventos.find(e => e.id === id);
            return <div key={id} className="flex justify-between gap-3 text-xs bg-sky-50 rounded-lg p-2"><span>{evento ? `${fechaActividadChile(evento.fechaHoraInicio)} · ${evento.titulo}` : 'Actividad eliminada'}</span><button type="button" onClick={() => alternar(id)} className="text-rose-700 font-semibold">Quitar</button></div>;
          })}
        </div>
      </section>
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <label className="block text-sm font-semibold">Motivo
          <textarea required maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} rows={4} placeholder="Cuéntanos por qué no podrás asistir…" className="mt-2 w-full border border-slate-200 rounded-xl p-3 font-normal" />
        </label>
        <label className="block text-sm font-semibold">Adjuntar foto (opcional)
          <input type="file" accept="image/*" className="block mt-2 max-w-full text-xs" onChange={async e => {
            const archivo = e.target.files?.[0]; e.target.value = '';
            if (!archivo) return;
            bloquear(true); setError('');
            try {
              if (!archivo.type.startsWith('image/') || archivo.size > 15 * 1024 * 1024) throw new Error('Selecciona una imagen de hasta 15 MB.');
              const comprimida = await comprimirImagenABase64(archivo, 1000, 0.65);
              if (comprimida.length > MAX_FOTO_JUSTIFICACION) throw new Error('La foto sigue siendo demasiado grande. Prueba una foto de menor tamaño.');
              setFoto(comprimida);
            } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir esa foto. Prueba con JPG o PNG.'); }
            finally { bloquear(false); }
          }} />
        </label>
        {foto && <div><img src={foto} alt="Foto adjunta a la justificación" className="max-h-48 rounded-xl" /><button type="button" className="text-xs text-rose-700 mt-2" onClick={() => setFoto(undefined)}>Quitar foto</button></div>}
        <p className="text-xs text-slate-500">El mismo motivo y foto se enviarán para cada actividad seleccionada. Dirección o Secretaría revisará cada solicitud.</p>
      </section>
      <button type="submit" disabled={!ids.length} className="w-full bg-sky-600 text-white rounded-xl p-3 font-bold flex gap-2 items-center justify-center disabled:opacity-50"><Send size={16} />{ocupado ? 'Procesando…' : 'Enviar justificación'}</button>
    </fieldset>
    {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-800 p-3 text-sm">{error}</p>}
    {mensaje && <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 p-3 text-sm">{mensaje}</p>}
    {justificaciones.filter(j => j.integranteId === integrante.id).length > 0 && <section className="space-y-2"><h2 className="text-sm font-bold">Solicitudes registradas</h2>{justificaciones.filter(j => j.integranteId === integrante.id).sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso)).slice(0, 20).map(j => <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-3 text-sm"><strong>{eventos.find(e => e.id === j.eventoId)?.titulo || 'Actividad'}</strong><span className="block text-xs text-slate-500">{j.estado} · {j.motivo}</span></div>)}</section>}
  </form>;
}
