'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { NotificacionItem } from '@/types';
import { useAuth } from './AuthContext';

export interface AjustesPersonales {
  nombrePrivado?: string;
  pushTipos?: Record<string, boolean>;
  antelacion?: 'anterior' | 'mismo' | 'ambos';
}
interface Valor {
  avisos: NotificacionItem[];
  ajustes: AjustesPersonales;
  leidas: Record<string, boolean>;
  listo: boolean;
  error: string;
  guardar: (datos: AjustesPersonales, fotoUrl?: string) => Promise<void>;
  marcarLeida: (id: string) => Promise<void>;
}
const Contexto = createContext<Valor | null>(null);

export function AjustesProvider({ children }: { children: React.ReactNode }) {
  const { usuario, modoLocal } = useAuth();
  return <AjustesDeCuenta key={`${usuario?.uid ?? 'sin-sesion'}-${modoLocal}`} >{children}</AjustesDeCuenta>;
}

function AjustesDeCuenta({ children }: { children: React.ReactNode }) {
  const { usuario, modoLocal } = useAuth();
  const uid = usuario?.uid;
  const [estado, setEstado] = useState<{ uid?: string; ajustes: AjustesPersonales; leidas: Record<string, boolean> }>({ ajustes: {}, leidas: {} });
  const [error, setError] = useState('');
  const [errorAvisos, setErrorAvisos] = useState('');
  const [avisos, setAvisos] = useState<NotificacionItem[]>([]);
  const [uidCargado, setUidCargado] = useState<string>();
  const listo = !!uid && uidCargado === uid;
  useEffect(() => {
    if (!uid) return;
    if (modoLocal) {
      let vigente = true;
      queueMicrotask(() => {
        if (!vigente) return;
        try {
          const datos = JSON.parse(localStorage.getItem(`solibook_privado_${uid}`) || '{}');
          setEstado({ uid, ajustes: datos.ajustes || {}, leidas: datos.leidas || {} });
        } catch { setEstado({ uid, ajustes: {}, leidas: {} }); }
        setUidCargado(uid);
        setError('');
      });
      return () => { vigente = false; };
    }
    const cancelarAvisos = onSnapshot(collection(db, 'usuarios', uid, 'avisos'), snap => {
      setErrorAvisos('');
      setAvisos(snap.docs.map(d => ({ ...d.data(), id: d.id } as NotificacionItem)));
    }, () => setErrorAvisos('No se pudieron cargar tus avisos personales. Revisa la conexión y las reglas.'));
    const cancelarAjustes = onSnapshot(doc(db, 'usuarios', uid, 'privado', 'ajustes'), snap => {
      setEstado(prev => ({ uid, ajustes: snap.data() || {}, leidas: prev.uid === uid ? prev.leidas : {} }));
      setUidCargado(uid);
      setError('');
    }, () => setError('No se pudieron cargar tus ajustes. Revisa la conexión y las reglas de acceso.'));
    const cancelarLeidas = onSnapshot(doc(db, 'usuarios', uid, 'privado', 'lecturas'), snap => {
      setEstado(prev => ({ uid, ajustes: prev.uid === uid ? prev.ajustes : {}, leidas: snap.data() || {} }));
    }, () => setError('No se pudo sincronizar el estado de lectura.'));
    return () => { cancelarAjustes(); cancelarLeidas(); cancelarAvisos(); };
  }, [uid, modoLocal]);

  const guardar = async (datos: AjustesPersonales, fotoUrl?: string) => {
    if (!uid || !listo) throw new Error('Espera a que se carguen tus ajustes.');
    if (modoLocal) {
      if (fotoUrl !== undefined) throw new Error('La foto requiere iniciar sesión con Google.');
      const nuevo = { ...estado, ajustes: { ...estado.ajustes, ...datos } };
      localStorage.setItem(`solibook_privado_${uid}`, JSON.stringify(nuevo));
      setEstado(nuevo);
    } else {
      // El alias nunca se escribe en el directorio compartido de usuarios.
      const lote = writeBatch(db);
      lote.set(doc(db, 'usuarios', uid, 'privado', 'ajustes'), datos, { merge: true });
      if (fotoUrl !== undefined) lote.update(doc(db, 'usuarios', uid), { fotoUrl });
      await lote.commit();
    }
  };
  const marcarLeida = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      if (!modoLocal) await setDoc(doc(db, 'usuarios', uid, 'privado', 'lecturas'), { [id]: true }, { merge: true });
      setEstado(prev => {
        const nuevo = { ...prev, leidas: { ...prev.leidas, [id]: true } };
        if (modoLocal) localStorage.setItem(`solibook_privado_${uid}`, JSON.stringify(nuevo));
        return nuevo;
      });
    } catch { setError('No se pudo guardar la lectura. Inténtalo otra vez.'); }
  }, [uid, modoLocal]);
  return <Contexto.Provider value={{ avisos, ajustes: estado.uid === uid ? estado.ajustes : {}, leidas: estado.uid === uid ? estado.leidas : {}, listo: listo && estado.uid === uid, error: error || errorAvisos, guardar, marcarLeida }}>{children}</Contexto.Provider>;
}
export function useAjustes() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('Falta AjustesProvider');
  return valor;
}
