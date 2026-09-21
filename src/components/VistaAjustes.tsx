'use client';

import { useState } from 'react';
import { ArrowLeft, Bell, RefreshCw, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useAjustes } from '@/context/AjustesContext';
import { comprimirImagenABase64 } from '@/lib/imageCompressor';
import { activarNotificacionesPush, retirarNotificacionesPush, EstadoPush } from '@/lib/notificacionesPush';

const mensajesPush: Record<EstadoPush, string> = {
  activo: 'Avisos activados en este dispositivo.',
  denegado: 'El navegador bloquea los avisos. Habilítalos en sus ajustes de permisos.',
  no_soportado: 'Este navegador no admite avisos. En iPhone, instala la app en la pantalla de inicio y ábrela desde allí.',
  sin_configuracion: 'Falta configurar el servicio de avisos en el despliegue.',
  error: 'No se pudo activar el dispositivo. Revisa tu conexión e inténtalo nuevamente.'
};

export function VistaAjustes({ volver }: { volver: () => void }) {
  const { usuario, modoLocal, cerrarSesion } = useAuth();
  const { ajustes, listo, error, guardar } = useAjustes();
  const { tiposEventos, forzarActualizacionApp } = useApp();
  const [nombre, setNombre] = useState<string>();
  const [foto, setFoto] = useState<string>();
  const [tipos, setTipos] = useState<Record<string, boolean>>();
  const [antelacion, setAntelacion] = useState<'anterior' | 'mismo' | 'ambos'>();
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [pushMensaje, setPushMensaje] = useState('');
  const categorias = [...new Set([...tiposEventos, 'Concierto', 'Otro', 'Cumpleaños', 'Correspondencia', 'Justificaciones', 'Actas', 'Solicitudes de eliminación'])];
  const seleccion = tipos ?? ajustes.pushTipos ?? {};
  const tarjeta = 'bg-white border border-slate-200 rounded-2xl p-5 space-y-4';
  const boton = 'px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold disabled:opacity-50';

  async function guardarCambios() {
    setOcupado(true); setMensaje('');
    try {
      await guardar({ nombrePrivado: (nombre ?? ajustes.nombrePrivado ?? '').trim(), pushTipos: seleccion, antelacion: antelacion ?? ajustes.antelacion ?? 'ambos' }, foto);
      setMensaje(modoLocal ? 'Ajustes guardados en este dispositivo.' : 'Cambios guardados.');
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudieron guardar los cambios.'); }
    finally { setOcupado(false); }
  }
  return <div className="max-w-xl mx-auto space-y-4 pb-20">
    <button onClick={volver} className="flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16} /> Volver al inicio</button>
    <h1 className="text-xl font-bold">Mi perfil y ajustes</h1>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {!listo && !error && <p role="status">Cargando ajustes…</p>}
    <fieldset disabled={!listo || ocupado} className="space-y-4 disabled:opacity-60">
      <section className={tarjeta}>
        <h2 className="font-bold flex gap-2 items-center"><UserRound size={18} /> Mi perfil</h2>
        {(foto ?? usuario?.fotoUrl) && <img src={foto ?? usuario?.fotoUrl} alt="Tu foto de perfil" className="w-20 h-20 rounded-2xl object-cover" />}
        <label className="block text-sm">Cambiar foto
          <input type="file" accept="image/*" disabled={modoLocal} className="block mt-2 max-w-full" onChange={async e => {
            const archivo = e.target.files?.[0];
            if (!archivo) return;
            setOcupado(true);
            try {
              if (!archivo.type.startsWith('image/') || archivo.size > 15 * 1024 * 1024) throw new Error('Selecciona una imagen de hasta 15 MB.');
              setFoto(await comprimirImagenABase64(archivo));
              setMensaje('Foto lista. Guarda los cambios para aplicarla.');
            } catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudo abrir la foto.'); }
            finally { setOcupado(false); }
          }} />
        </label>
        {modoLocal && <p className="text-xs text-slate-500">Inicia sesión con Google para cambiar tu foto y sincronizar los ajustes.</p>}
        <label className="block text-sm">Nombre para mostrar — solo para ti
          <input maxLength={80} value={nombre ?? ajustes.nombrePrivado ?? ''} placeholder={usuario?.nombre} onChange={e => setNombre(e.target.value)} className="mt-1 block w-full border border-slate-200 rounded-xl p-3" />
        </label>
        <p className="text-xs text-slate-500">Tu nombre oficial y los registros compartidos no cambian.</p>
        <div className="bg-slate-50 rounded-xl p-3 text-sm"><p>Cargo asignado: <strong>{usuario?.rol}</strong></p><p className="mt-1 text-slate-500">{usuario?.integranteId ? 'Cuenta vinculada a una ficha de integrante.' : 'Sin ficha vinculada. Solicita a Dirección que vincule tu cuenta.'}</p></div>
      </section>
      <section className={tarjeta}>
        <h2 className="font-bold flex gap-2 items-center"><Bell size={18} /> Mis notificaciones</h2>
        <p className="text-sm text-slate-500">Los avisos que te corresponden siguen apareciendo dentro de la app aunque desactives su push.</p>
        <div className="flex flex-wrap gap-2">
          <button className={boton} disabled={modoLocal} onClick={async () => {
            if (!usuario) return;
            setOcupado(true);
            try { setPushMensaje(mensajesPush[await activarNotificacionesPush(usuario.uid)]); }
            finally { setOcupado(false); }
          }}>Activar avisos en este dispositivo</button>
          <button className={boton} disabled={modoLocal} onClick={async () => {
            if (!usuario) return;
            setOcupado(true);
            try { await retirarNotificacionesPush(usuario.uid, true); setPushMensaje('Avisos desactivados en este dispositivo.'); }
            catch { setPushMensaje('No se pudo desactivar. Revisa la conexión e inténtalo otra vez.'); }
            finally { setOcupado(false); }
          }}>Desactivar</button>
        </div>
        {pushMensaje && <p role="status" className="text-sm">{pushMensaje}</p>}
        <p className="text-xs rounded-xl bg-amber-50 p-3 text-amber-900">Calendario y cumpleaños tienen envío programado. Correspondencia, justificaciones, solicitudes de edición de actas y eliminaciones también pueden avisarte por push, según tu cargo.</p>
        {categorias.map(tipo => <label key={tipo} className="flex items-center justify-between gap-4 text-sm py-2 border-b border-slate-100">
          <span>{tipo}<span className="block text-xs text-slate-400">También con la app cerrada</span></span>
          <input type="checkbox" className="w-5 h-5 accent-sky-600" checked={seleccion[tipo] !== false} onChange={e => setTipos({ ...seleccion, [tipo]: e.target.checked })} />
        </label>)}
        <label className="block text-sm">Recordatorios del calendario
          <select className="block w-full mt-2 border border-slate-200 p-3 rounded-xl" value={antelacion ?? ajustes.antelacion ?? 'ambos'} onChange={e => setAntelacion(e.target.value as 'anterior' | 'mismo' | 'ambos')}>
            <option value="anterior">Día anterior</option><option value="mismo">Mismo día</option><option value="ambos">Día anterior y mismo día</option>
          </select>
        </label>
        <p className="text-xs text-slate-500">La programación diaria revisa actividades de hoy y mañana a partir de las 08:00 o 09:00 de Chile, según horario de invierno/verano. No es una alarma de hora exacta; las actividades que ya comenzaron no generan push.</p>
      </section>
      <button onClick={guardarCambios} className="w-full rounded-xl bg-sky-600 text-white p-3 font-bold disabled:opacity-50">{ocupado ? 'Procesando…' : 'Guardar cambios'}</button>
    </fieldset>
    {mensaje && <p role="status" className="text-sm">{mensaje}</p>}
    <section className={tarjeta}>
      <h2 className="font-bold">Aplicación</h2>
      <button className={`${boton} flex items-center gap-2`} onClick={() => { if (confirm('¿Buscar la última versión? Se limpiará la caché y se recargará la aplicación. Guarda antes tus cambios.')) forzarActualizacionApp(); }}><RefreshCw size={16} /> Buscar actualización</button>
      <button className={`${boton} flex items-center gap-2 text-rose-700`} onClick={cerrarSesion}><LogOut size={16} /> Cerrar sesión</button>
    </section>
  </div>;
}
