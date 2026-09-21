'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from './AuthContext';
import { puedeSolicitarEliminacion, rolEliminacion, type EntradaEliminacion, type SolicitudEliminacion, type TipoEliminacion } from '@/lib/eliminaciones';

interface Valor {
  solicitudes: SolicitudEliminacion[];
  ocupado: boolean;
  directo: boolean;
  solicitar: (tipo: TipoEliminacion, id: string, titulo: string) => Promise<void>;
  resolver: (solicitudId: string, accion: 'aprobar' | 'rechazar' | 'cancelar') => Promise<void>;
  bloqueado: (tipo: TipoEliminacion, id: string) => boolean;
  advertirBloqueo: (tipo: TipoEliminacion, id: string) => boolean;
}
const Contexto = createContext<Valor | null>(null);
export function EliminacionesProvider({ children }: { children: React.ReactNode }) {
  const { usuario, modoLocal } = useAuth();
  return <Cuenta key={`${usuario?.uid}-${modoLocal}-${usuario?.rol}`} >{children}</Cuenta>;
}
function Cuenta({ children }: { children: React.ReactNode }) {
  const { usuario, modoLocal } = useAuth();
  const [solicitudes, setSolicitudes] = useState<SolicitudEliminacion[]>([]);
  const [fundador, setFundador] = useState('');
  const [fundadorListo, setFundadorListo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [errorSync, setErrorSync] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  useEffect(() => {
    if (modoLocal || !usuario?.activo || usuario.rol === 'Miembro') return;
    const cancelar = onSnapshot(collection(db, 'solicitudes_eliminacion'), snap => {
      setSolicitudes(snap.docs.map(d => ({ ...d.data(), id: d.id } as SolicitudEliminacion)));
      setErrorSync('');
    }, () => setErrorSync('No se pudieron sincronizar las solicitudes de eliminación. Revisa la conexión y las reglas de Firebase.'));
    const cancelarFundador = onSnapshot(doc(db, 'configuracion', 'estado'), snap => { setFundador(snap.data()?.fundador || ''); setFundadorListo(true); }, () => { setFundador(''); setFundadorListo(false); });
    return () => { cancelar(); cancelarFundador(); };
  }, [usuario?.uid, usuario?.rol, usuario?.activo, modoLocal]);
  const rol = rolEliminacion(usuario?.rol || '');
  const directo = rol === 'Desarrollador' || (rol === 'Director' && fundador === usuario?.uid);
  const bloqueado = (tipo: TipoEliminacion, id: string) => solicitudes.some(s => s.tipo === tipo && s.registroId === id && s.estado === 'Pendiente');
  const advertirBloqueo = (tipo: TipoEliminacion, id: string) => {
    if (!bloqueado(tipo, id)) return false;
    setMensaje('Este registro tiene una eliminación pendiente. Resuélvela o cancélala en Notificaciones antes de editar.');
    return true;
  };
  async function ejecutar(entrada: EntradaEliminacion) {
    if (enCurso.current) return;
    if (modoLocal || !auth.currentUser) { setMensaje('La eliminación requiere iniciar sesión con Google y conexión. No se borró ningún registro.'); return; }
    if (rol === 'Director' && !fundadorListo) { setMensaje('Espera a que se verifique tu cuenta con Firebase antes de eliminar.'); return; }
    enCurso.current = true; setOcupado(true); setMensaje('');
    try {
      const enviar = async (aceptarFaltaCargo = false) => {
        const respuesta = await fetch('/api/eliminaciones', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` }, body: JSON.stringify({ ...entrada, aceptarFaltaCargo }) });
        return { respuesta, datos: await respuesta.json() };
      };
      let resultado = await enviar();
      if (resultado.datos.codigo === 'falta_contraparte' && confirm(resultado.datos.error)) resultado = await enviar(true);
      if (!resultado.respuesta.ok) throw new Error(resultado.datos.error || 'No se pudo completar la operación.');
      setMensaje(resultado.datos.mensaje);
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudo completar. Revisa Notificaciones antes de reintentar.'); }
    finally { enCurso.current = false; setOcupado(false); }
  }
  async function solicitar(tipo: TipoEliminacion, id: string, titulo: string) {
    if (!puedeSolicitarEliminacion(rol, tipo)) return;
    if (bloqueado(tipo, id)) { setMensaje('Ya hay una solicitud pendiente. Revísala en Notificaciones.'); return; }
    if (!modoLocal && rol === 'Director' && !fundadorListo) { setMensaje('Espera a que se verifique tu cuenta con Firebase antes de eliminar.'); return; }
    if (confirm(directo ? `¿Eliminar definitivamente «${titulo}»? Tu cuenta puede hacerlo sin segunda autorización. Quedará registro de la acción.` : `¿Solicitar la eliminación de «${titulo}»? Si eres Director o Secretario, esta solicitud cuenta como tu firma. El registro quedará bloqueado mientras se resuelve.`)) await ejecutar({ accion: 'solicitar', tipo, registroId: id });
  }
  async function resolver(solicitudId: string, accion: 'aprobar' | 'rechazar' | 'cancelar') {
    const texto = accion === 'aprobar' ? (directo ? 'Tu cuenta puede eliminar directamente. ¿Eliminar este registro ahora?' : '¿Autorizar la eliminación? Cuando estén las firmas necesarias, se borrará definitivamente.') : accion === 'rechazar' ? '¿Rechazar? La solicitud se cerrará para todos y el registro se conservará.' : '¿Cancelar tu solicitud? El registro se conservará.';
    if (confirm(texto)) await ejecutar({ solicitudId, accion });
  }
  return <Contexto.Provider value={{ solicitudes, ocupado, directo, solicitar, resolver, bloqueado, advertirBloqueo }}>
    {children}
    {(mensaje || errorSync) && <div role="status" className="fixed bottom-20 left-3 right-3 z-[100] max-w-xl mx-auto rounded-2xl bg-slate-900 text-white p-4 shadow-xl text-sm flex items-start gap-3"><p className="flex-1">{mensaje || errorSync}</p><button aria-label="Cerrar aviso" onClick={() => { setMensaje(''); setErrorSync(''); }} className="font-bold px-2">✕</button></div>}
  </Contexto.Provider>;
}
export function useEliminaciones() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('Falta EliminacionesProvider');
  return valor;
}
