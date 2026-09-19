'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { UsuarioApp, RolUsuario } from '@/types';
import { Permiso, tienePermiso } from '@/lib/permisos';
import { COLECCIONES, suscribirseColeccion, guardarDocumento } from '@/lib/firestoreSync';

const CLAVE_USUARIOS = 'solibook_usuarios';
const CLAVE_SESION_LOCAL = 'solibook_sesion_local';
const UID_MODO_LOCAL = 'local-sin-conexion';

interface AuthContextType {
  usuario: UsuarioApp | null;
  usuarios: UsuarioApp[];
  cargando: boolean;
  error: string;
  authDisponible: boolean;
  modoLocal: boolean;
  iniciarSesionGoogle: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
  entrarModoLocal: () => void;
  cambiarRol: (uid: string, rol: RolUsuario) => void;
  activarUsuario: (uid: string, activo: boolean) => void;
  vincularIntegrante: (uid: string, integranteId?: string) => void;
  puede: (permiso: Permiso) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([]);
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [authDisponible, setAuthDisponible] = useState(true);
  const [modoLocal, setModoLocal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Espejo sincrónico de la lista de usuarios, necesario dentro de callbacks
  // de Firebase que no ven el estado más reciente.
  const usuariosRef = useRef<UsuarioApp[]>([]);
  useEffect(() => {
    usuariosRef.current = usuarios;
  }, [usuarios]);

  // Carga inicial: usuarios registrados y sesión local de respaldo
  useEffect(() => {
    try {
      const guardados = localStorage.getItem(CLAVE_USUARIOS);
      const lista: UsuarioApp[] = guardados ? JSON.parse(guardados) : [];
      setUsuarios(lista);

      const sesionLocal = localStorage.getItem(CLAVE_SESION_LOCAL);
      if (sesionLocal) {
        const local: UsuarioApp = JSON.parse(sesionLocal);
        setUsuario(local);
        setModoLocal(true);
      }
    } catch {
      setUsuarios([]);
    }
    setIsLoaded(true);
  }, []);

  // Persistencia de usuarios (respaldo para el modo sin conexión)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(CLAVE_USUARIOS, JSON.stringify(usuarios));
    } catch {
      // Si el almacenamiento está lleno se conserva la sesión en memoria
    }
  }, [usuarios, isLoaded]);

  // Suscripción en tiempo real al directorio compartido de usuarios. Así los
  // roles, suspensiones y vínculos con miembros llegan a todos los equipos.
  // La sesión local sin conexión nunca se sube ni se pierde al sincronizar.
  useEffect(() => {
    if (!isLoaded || modoLocal) return;

    const cancelar = suscribirseColeccion<UsuarioApp>(
      COLECCIONES.usuarios,
      recibidos => {
        setUsuarios(prev => {
          const sinLocal = recibidos.filter(u => u.uid !== UID_MODO_LOCAL);
          const sesionLocal = prev.find(u => u.uid === UID_MODO_LOCAL);
          return sesionLocal ? [...sinLocal, sesionLocal] : sinLocal;
        });
      },
      () => usuariosRef.current.filter(u => u.uid !== UID_MODO_LOCAL),
      u => u.uid
    );

    return () => cancelar();
  }, [isLoaded, modoLocal, usuario?.uid]);

  // Registra al usuario autenticado en el directorio compartido. El primero
  // en entrar queda como Administrador; los siguientes ingresan como Miembro.
  const registrarUsuario = useCallback(
    (datos: { uid: string; email: string; nombre: string; fotoUrl?: string }): UsuarioApp => {
      const actuales = usuariosRef.current;
      const existente = actuales.find(u => u.uid === datos.uid);

      const perfil: UsuarioApp = existente
        ? { ...existente, ultimoAcceso: new Date().toISOString() }
        : {
            uid: datos.uid,
            email: datos.email,
            nombre: datos.nombre,
            fotoUrl: datos.fotoUrl,
            rol: actuales.length === 0 ? 'Administrador' : 'Miembro',
            activo: true,
            fechaIngreso: new Date().toISOString(),
            ultimoAcceso: new Date().toISOString()
          };

      setUsuarios(prev =>
        prev.some(u => u.uid === perfil.uid)
          ? prev.map(u => (u.uid === perfil.uid ? perfil : u))
          : [...prev, perfil]
      );

      if (perfil.uid !== UID_MODO_LOCAL) {
        void guardarDocumento(COLECCIONES.usuarios, perfil.uid, perfil);
      }

      return perfil;
    },
    []
  );

  // Sesión de Firebase con persistencia local del dispositivo
  useEffect(() => {
    let cancelarSuscripcion: (() => void) | undefined;

    const iniciar = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        // Si el navegador no permite persistencia se usa la sesión por defecto
      }

      try {
        cancelarSuscripcion = onAuthStateChanged(
          auth,
          firebaseUser => {
            setAuthDisponible(true);
            if (!firebaseUser) {
              setCargando(false);
              return;
            }
            const perfil = registrarUsuario({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              nombre: firebaseUser.displayName || firebaseUser.email || 'Usuario',
              fotoUrl: firebaseUser.photoURL || undefined
            });
            setUsuario(perfil);
            setModoLocal(false);
            localStorage.removeItem(CLAVE_SESION_LOCAL);
            setCargando(false);
          },
          err => {
            setAuthDisponible(false);
            setError(
              err?.message ||
                'No fue posible conectar con Firebase Authentication. Usa "Continuar sin conexión".'
            );
            setCargando(false);
          }
        );
      } catch {
        setAuthDisponible(false);
        setCargando(false);
      }
    };

    iniciar();
    return () => {
      if (cancelarSuscripcion) cancelarSuscripcion();
    };
  }, [registrarUsuario]);

  // Mantiene sincronizado el usuario activo cuando la lista de usuarios cambia
  // (por ejemplo al cambiarle el rol o suspenderlo desde Usuarios y Permisos).
  useEffect(() => {
    if (!usuario) return;
    const actualizado = usuarios.find(u => u.uid === usuario.uid);
    if (actualizado && actualizado !== usuario) setUsuario(actualizado);
  }, [usuarios, usuario]);

  const iniciarSesionGoogle = async () => {
    setError('');
    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (e) {
      const detalle = e as { code?: string; message?: string };
      setError(
        detalle?.code === 'auth/unauthorized-domain'
          ? 'El dominio actual no está autorizado en Firebase. Agrega el dominio de Vercel en Authentication → Settings → Dominios autorizados.'
          : detalle?.message || 'No fue posible iniciar sesión con Google.'
      );
    }
  };

  const cerrarSesion = async () => {
    try {
      if (!modoLocal) await signOut(auth);
    } catch {
      // Si Firebase no responde se limpia igualmente la sesión local
    }
    localStorage.removeItem(CLAVE_SESION_LOCAL);
    setUsuario(null);
    setModoLocal(false);
  };

  const entrarModoLocal = () => {
    const existente = usuarios.find(u => u.uid === UID_MODO_LOCAL);
    const perfil: UsuarioApp =
      existente ||
      {
        uid: UID_MODO_LOCAL,
        email: '',
        nombre: 'Sesión sin conexión',
        rol: usuarios.length === 0 ? 'Administrador' : 'Miembro',
        activo: true,
        fechaIngreso: new Date().toISOString(),
        ultimoAcceso: new Date().toISOString()
      };

    setUsuarios(prev => {
      const yaEsta = prev.some(u => u.uid === UID_MODO_LOCAL);
      return yaEsta ? prev : [...prev, perfil];
    });
    setUsuario(perfil);
    setModoLocal(true);
    localStorage.setItem(CLAVE_SESION_LOCAL, JSON.stringify(perfil));
  };

  // Nadie puede cambiar su propio rol ni suspenderse a sí mismo
  const cambiarRol = (uid: string, rol: RolUsuario) => {
    if (usuario?.uid === uid) return;
    const actual = usuariosRef.current.find(u => u.uid === uid);
    setUsuarios(prev => prev.map(u => (u.uid === uid ? { ...u, rol } : u)));
    if (actual && uid !== UID_MODO_LOCAL) {
      void guardarDocumento(COLECCIONES.usuarios, uid, { ...actual, rol });
    }
  };

  const activarUsuario = (uid: string, activo: boolean) => {
    if (usuario?.uid === uid) return;
    const actual = usuariosRef.current.find(u => u.uid === uid);
    setUsuarios(prev => prev.map(u => (u.uid === uid ? { ...u, activo } : u)));
    if (actual && uid !== UID_MODO_LOCAL) {
      void guardarDocumento(COLECCIONES.usuarios, uid, { ...actual, activo });
    }
  };

  const vincularIntegrante = (uid: string, integranteId?: string) => {
    const actual = usuariosRef.current.find(u => u.uid === uid);
    setUsuarios(prev => prev.map(u => (u.uid === uid ? { ...u, integranteId } : u)));
    if (actual && uid !== UID_MODO_LOCAL) {
      void guardarDocumento(COLECCIONES.usuarios, uid, { ...actual, integranteId });
    }
  };

  const puede = (permiso: Permiso) => {
    if (!usuario || !usuario.activo) return false;
    return tienePermiso(usuario.rol, permiso);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        usuarios,
        cargando,
        error,
        authDisponible,
        modoLocal,
        iniciarSesionGoogle,
        cerrarSesion,
        entrarModoLocal,
        cambiarRol,
        activarUsuario,
        vincularIntegrante,
        puede
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  return context;
};
