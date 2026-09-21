'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { UsuarioApp, RolUsuario, CupoFirma, Integrante } from '@/types';
import { Permiso, normalizarRol, ROLES_SUPERIORES } from '@/lib/permisos';
import { puedeOcuparCupo, esAtributo, esAtributoDelicado } from '@/lib/atributos';
import { puedeIngresar, puedeGestionarIngresos, estadoVigente, mensajeEspera, puede as puedeCuenta } from '@/lib/ingresos';
import { textoOferta } from '@/lib/traspasos';
import { COLECCIONES, suscribirseColeccion, guardarDocumento } from '@/lib/firestoreSync';
import { retirarNotificacionesPush } from '@/lib/notificacionesPush';

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
  /** La sesión actual pertenece a la cuenta fundadora (configuracion/estado.fundador). */
  esFundador: boolean;
  /** La sesión actual opera con permisos de Desarrollador (rol Desarrollador o Director fundador). */
  esSuperAdmin: boolean;
  /**
   * Rol con el que se evalúan los permisos de administración: el Director
   * fundador actúa como 'Desarrollador' sin que cambie el rol guardado, que
   * la interfaz sigue mostrando como "Director".
   */
  rolEfectivo: () => RolUsuario;
  iniciarSesionGoogle: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
  entrarModoLocal: () => void;
  cambiarRol: (uid: string, rol: RolUsuario) => void;
  activarUsuario: (uid: string, activo: boolean) => void;
  vincularIntegrante: (uid: string, integranteId?: string) => void;
  puede: (permiso: Permiso) => boolean;
  puedeAdministrarCuenta: (uid: string) => boolean;
  /** Si la cuenta puede firmar tal cupo (actas y solicitudes de borrado). */
  puedeCupo: (cupo: CupoFirma) => boolean;
  /** La sesión está a la espera de que Dirección o Secretaría la acepte. */
  enEspera: boolean;
  /** Mensaje y oferta de traspaso pendientes para esta cuenta. */
  esperaMensaje: string;
  ofertaPendiente: UsuarioApp['ofertaDirector'];
  puedeAceptarIngresos: boolean;
  /** Aceptar un ingreso nuevo, opcionalmente vinculándolo a una ficha. */
  aceptarIngreso: (uid: string, opciones?: { integranteId?: string; nuevaFicha?: Omit<Integrante, 'id'> }) => void;
  rechazarIngreso: (uid: string) => void;
  otorgarAtribucion: (uid: string, atributo: string, opciones?: { hasta?: string; motivo?: string }) => string;
  revocarAtribucion: (uid: string, atributo: string) => void;
  /** Ofrecer el propio cargo de Director con ventana de respuesta. */
  ofrecerCargo: (uidDestino: string) => Promise<string>;
  /** Responder la oferta recibida: aceptarla o rechazarla. */
  responderOferta: (aceptar: boolean) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Aplica la migración de roles antiguos (Administrador→Director,
// Secretaria→Secretario) a cualquier usuario leído de la nube o del respaldo.
const normalizarUsuario = (u: UsuarioApp): UsuarioApp => ({
  ...u,
  rol: normalizarRol(u.rol),
  // Las cuentas anteriores al flujo de aprobación ya estaban aceptadas.
  estadoIngreso: u.estadoIngreso || 'Aceptado'
});

// La primera persona que entra a la aplicación reclama la cuenta fundadora.
// El reclamo vive en "configuracion/estado" dentro de una transacción, así dos
// dispositivos no pueden proclamarse fundadores a la vez.
const reclamarFundador = async (uid: string): Promise<boolean> => {
  try {
    const estadoRef = doc(db, 'configuracion', 'estado');
    return await runTransaction(db, async transaccion => {
      const estado = await transaccion.get(estadoRef);
      if (estado.exists()) return estado.data()?.fundador === uid;
      transaccion.set(estadoRef, { fundador: uid, creadoEn: new Date().toISOString() });
      return true;
    });
  } catch (error) {
    console.warn('[Sync] No se pudo verificar la cuenta fundadora:', error);
    return false;
  }
};

/** Qué ve una cuenta que todavía no fue aceptada, con la oferta si la hay. */
const textoEspera = (cuenta: UsuarioApp | null): string => {
  if (!cuenta) return '';
  const base = mensajeEspera(estadoVigente(cuenta));
  if (cuenta.ofertaDirector?.estado === 'Pendiente') return `${base} ${textoOferta(cuenta.ofertaDirector)}`;
  return base;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([]);
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [authDisponible, setAuthDisponible] = useState(true);
  const [modoLocal, setModoLocal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  // UID de la cuenta fundadora según el servidor (configuracion/estado),
  // junto con la sesión para la que se leyó. Hasta que llega el documento (o
  // si no se pudo leer) nadie recibe la excepción de fundador.
  const [fundador, setFundador] = useState<{ sesion: string; uid: string }>({ sesion: '', uid: '' });

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
      setUsuarios(lista.map(normalizarUsuario));

      const sesionLocal = localStorage.getItem(CLAVE_SESION_LOCAL);
      if (sesionLocal) {
        const local: UsuarioApp = normalizarUsuario(JSON.parse(sesionLocal));
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
  // Cada cuenta se registra sola al iniciar sesión, por eso no hay siembra.
  useEffect(() => {
    if (!isLoaded || modoLocal) return;

    const cancelar = suscribirseColeccion<UsuarioApp>(
      COLECCIONES.usuarios,
      recibidos => {
        setUsuarios(prev => {
          const sinLocal = recibidos.map(normalizarUsuario).filter(u => u.uid !== UID_MODO_LOCAL);
          const sesionLocal = prev.find(u => u.uid === UID_MODO_LOCAL);
          return sesionLocal ? [...sinLocal, sesionLocal] : sinLocal;
        });
      },
      () => [],
      u => u.uid
    );

    return () => cancelar();
  }, [isLoaded, modoLocal, usuario?.uid]);

  // Quién es la cuenta fundadora lo dice siempre el servidor: se escucha el
  // mismo documento que consultan las reglas de Firestore y el endpoint de
  // eliminaciones, así el cliente nunca decide por sí solo esa excepción.
  const sesionUid = usuario?.uid;
  useEffect(() => {
    if (!isLoaded || modoLocal || !sesionUid || sesionUid === UID_MODO_LOCAL) return;
    const cancelar = onSnapshot(
      doc(db, 'configuracion', 'estado'),
      snap => {
        const valor = snap.data()?.fundador;
        setFundador({ sesion: sesionUid, uid: typeof valor === 'string' ? valor : '' });
      },
      () => setFundador({ sesion: sesionUid, uid: '' })
    );
    return () => cancelar();
  }, [isLoaded, modoLocal, sesionUid]);

  // Registra al usuario autenticado. La persona fundadora queda como Director
  // (verificado contra el servidor); los nuevos ingresan como Miembro.
  const registrarUsuario = useCallback(
    (datos: { uid: string; email: string; nombre: string; fotoUrl?: string }): UsuarioApp => {
      const ahora = new Date().toISOString();
      const existente = usuariosRef.current.find(u => u.uid === datos.uid);

      const perfil: UsuarioApp = existente
        ? { ...normalizarUsuario(existente), ultimoAcceso: ahora }
        : {
            uid: datos.uid,
            email: datos.email,
            nombre: datos.nombre,
            fotoUrl: datos.fotoUrl,
            rol: 'Miembro', // provisional hasta verificar el reclamo de fundador
            activo: true,
            // Toda cuenta nueva queda a la espera: Dirección o Secretaría la
            // acepta, la rechaza, o el pedido caduca a los 30 días.
            estadoIngreso: 'Pendiente',
            fechaIngreso: ahora,
            ultimoAcceso: ahora
          };

      setUsuarios(prev =>
        prev.some(u => u.uid === perfil.uid)
          ? prev.map(u => (u.uid === perfil.uid ? perfil : u))
          : [...prev, perfil]
      );

      if (perfil.uid === UID_MODO_LOCAL) return perfil;

      if (existente) {
        // Escribe el rol ya normalizado: migra los valores antiguos al vuelo.
        void guardarDocumento(COLECCIONES.usuarios, perfil.uid, perfil);
      } else {
        // Cuenta nueva: primero el reclamo transaccional de fundador, luego el
        // registro (las reglas exigen ese orden para otorgar el rol Director).
        void reclamarFundador(perfil.uid).then(esFundador => {
          const definitivo: UsuarioApp = {
            ...perfil,
            rol: esFundador ? 'Director' : 'Miembro',
            estadoIngreso: esFundador ? 'Aceptado' : 'Pendiente'
          };
          setUsuarios(prev => prev.map(u => (u.uid === definitivo.uid ? definitivo : u)));
          void guardarDocumento(COLECCIONES.usuarios, definitivo.uid, definitivo);
        });
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
      if (!modoLocal && usuario?.uid) void retirarNotificacionesPush(usuario.uid);
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
        rol: usuarios.length === 0 ? 'Director' : 'Miembro',
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

  // La cuenta fundadora es la que reclamó configuracion/estado.fundador. Solo
  // cuenta con sesión real (no en modo local) y mientras el servidor lo
  // confirme; si el documento no llega, no hay excepción.
  const esFundador =
    !!usuario && !modoLocal && fundador.sesion === usuario.uid && fundador.uid !== '' && fundador.uid === usuario.uid;

  // Rol con el que se deciden los permisos de administración. El Director
  // fundador opera como Desarrollador (igual que en gestionarEliminacion.ts y
  // en las reglas de Firestore), pero su rol guardado sigue siendo 'Director'
  // y así lo muestra la interfaz. Un Director no fundador no gana nada.
  const rolEfectivo = (): RolUsuario => {
    const rol = normalizarRol(usuario?.rol);
    return rol === 'Director' && esFundador ? 'Desarrollador' : rol;
  };

  const esSuperAdmin = !!usuario && rolEfectivo() === 'Desarrollador';

  // Quién puede tocar qué cuenta: el Desarrollador (o el Director fundador)
  // puede con cualquiera; el Director administra todas las cuentas EXCEPTO
  // las de nivel superior (Director y Desarrollador); el resto de los roles
  // no administra cuentas.
  const puedeAdministrarCuenta = (uid: string): boolean => {
    if (!usuario || uid === UID_MODO_LOCAL) return false;
    const rolPropio = rolEfectivo();
    if (rolPropio === 'Desarrollador') return true;
    if (rolPropio !== 'Director') return false;
    const objetivo = usuariosRef.current.find(u => u.uid === uid);
    if (!objetivo) return false;
    return !ROLES_SUPERIORES.includes(normalizarRol(objetivo.rol));
  };

  // Nadie puede cambiar su propio rol ni suspenderse a sí mismo
  const cambiarRol = (uid: string, rol: RolUsuario) => {
    if (usuario?.uid === uid) return;
    if (!puedeAdministrarCuenta(uid)) return;
    // Solo el Desarrollador (o el Director fundador) puede nombrar cuentas de
    // nivel superior; un Director no fundador sigue sin poder nombrar Directores.
    if (rolEfectivo() !== 'Desarrollador' && ROLES_SUPERIORES.includes(rol)) return;
    const actual = usuariosRef.current.find(u => u.uid === uid);
    setUsuarios(prev => prev.map(u => (u.uid === uid ? { ...u, rol } : u)));
    if (actual) {
      void guardarDocumento(COLECCIONES.usuarios, uid, { ...actual, rol });
    }
  };

  const activarUsuario = (uid: string, activo: boolean) => {
    if (usuario?.uid === uid) return;
    if (!puedeAdministrarCuenta(uid)) return;
    const actual = usuariosRef.current.find(u => u.uid === uid);
    setUsuarios(prev => prev.map(u => (u.uid === uid ? { ...u, activo } : u)));
    if (actual) {
      void guardarDocumento(COLECCIONES.usuarios, uid, { ...actual, activo });
    }
  };

  const puedeAceptarIngresos =
    !!usuario && usuario.activo && puedeGestionarIngresos(usuario.rol, usuario.atribuciones);

  /**
   * Una ficha, una cuenta. Si la ficha ya estaba vinculada a otra cuenta, el
   * vínculo se traspasa y queda escrito en el registro de cada una: así se
   * resuelve el caso de quien cambia de correo sin borrar la historia.
   */
  const vincularIntegrante = (uid: string, integranteId?: string) => {
    if (!puedeAdministrarCuenta(uid) && !puedeAceptarIngresos) return;
    const actual = usuariosRef.current.find(u => u.uid === uid);
    const anterior = integranteId
      ? usuariosRef.current.find(u => u.uid !== uid && u.integranteId === integranteId)
      : undefined;
    setUsuarios(prev =>
      prev.map(u => {
        if (u.uid === uid) return { ...u, integranteId };
        if (anterior && u.uid === anterior.uid) return { ...u, integranteId: undefined };
        return u;
      })
    );
    if (actual) void guardarDocumento(COLECCIONES.usuarios, uid, { ...actual, integranteId });
    if (anterior) void guardarDocumento(COLECCIONES.usuarios, anterior.uid, { ...anterior, integranteId: undefined });
  };

  // ─────────────────── Ingresos nuevos: aceptar o rechazar ───────────────────
  const marcarIngreso = (uid: string, cambios: Partial<UsuarioApp>) => {
    if (!puedeAceptarIngresos && rolEfectivo() !== 'Desarrollador') return;
    const actual = usuariosRef.current.find(u => u.uid === uid);
    if (!actual) return;
    const siguiente = { ...actual, ...cambios };
    setUsuarios(prev => prev.map(u => (u.uid === uid ? siguiente : u)));
    void guardarDocumento(COLECCIONES.usuarios, uid, siguiente);
  };

  /**
   * Aceptar a quien llega: se deja constancia de quién aceptó y se resuelve su
   * ficha. O se vincula a una existente (la que Secretaría creó a mano) o se crea
   * una con los datos de la cuenta, para que nadie quede «sin ficha»: sin ficha
   * no hay estadísticas ni asistencia.
   */
  const aceptarIngreso = (uid: string, opciones: { integranteId?: string; nuevaFicha?: Omit<Integrante, 'id'> } = {}) => {
    let integranteId = opciones.integranteId;
    if (!integranteId && opciones.nuevaFicha && usuario) {
      integranteId = `int-${Date.now()}`;
      const autor = { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, fecha: new Date().toISOString() };
      void guardarDocumento(COLECCIONES.integrantes, integranteId, {
        ...opciones.nuevaFicha,
        id: integranteId,
        creadoPor: autor,
        editadoPor: autor
      });
    }
    marcarIngreso(uid, {
      estadoIngreso: 'Aceptado',
      rol: 'Miembro',
      ...(integranteId ? { integranteId } : {}),
      ...(usuario ? { aceptadoPor: { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, fecha: new Date().toISOString() } } : {})
    });
  };

  const rechazarIngreso = (uid: string) => {
    marcarIngreso(uid, { estadoIngreso: 'Rechazado', activo: false });
  };

  // ─────────────────────── Atribuciones sobre la cuenta ───────────────────────
  // Las delicadas (cupos de firma y borrados) sólo las concede quien opera con
  // permisos de Desarrollador: el fundador o un Desarrollador. Un Director
  // puede activar las simples, que son de registro diario.
  const puedeConcederAtribuciones = (delicada: boolean): boolean => {
    if (!delicada) return puede('gestionar_usuarios');
    return rolEfectivo() === 'Desarrollador';
  };

  const otorgarAtribucion = (uid: string, atributo: string, opciones: { hasta?: string; motivo?: string } = {}): string => {
    if (!esAtributo(atributo)) return 'Esa atribución no existe.';
    const actual = usuariosRef.current.find(u => u.uid === uid);
    if (!actual) return 'La cuenta ya no está disponible.';
    if (!puedeConcederAtribuciones(esAtributoDelicado(atributo))) return 'Tu cargo no puede conceder esa atribución.';
    const vigentes = (actual.atribuciones || []).filter(a => a.atributo !== atributo);
    const siguiente: UsuarioApp = {
      ...actual,
      atribuciones: [
        ...vigentes,
        {
          atributo,
          otorgadoPor: { uid: usuario?.uid || '', nombre: usuario?.nombre || '', rol: usuario?.rol || '', fecha: new Date().toISOString() },
          ...(opciones.motivo ? { motivo: opciones.motivo } : {}),
          ...(opciones.hasta ? { hasta: opciones.hasta } : {})
        }
      ]
    };
    setUsuarios(prev => prev.map(u => (u.uid === uid ? siguiente : u)));
    void guardarDocumento(COLECCIONES.usuarios, uid, siguiente);
    return '';
  };

  const revocarAtribucion = (uid: string, atributo: string): string => {
    const actual = usuariosRef.current.find(u => u.uid === uid);
    if (!actual) return 'La cuenta ya no está disponible.';
    if (!puedeConcederAtribuciones(esAtributoDelicado(atributo))) return 'Tu cargo no puede retirar esa atribución.';
    const siguiente: UsuarioApp = {
      ...actual,
      atribuciones: (actual.atribuciones || []).filter(a => a.atributo !== atributo)
    };
    setUsuarios(prev => prev.map(u => (u.uid === uid ? siguiente : u)));
    void guardarDocumento(COLECCIONES.usuarios, uid, siguiente);
    return '';
  };

  // ─────────────────── Traspaso del cargo de Director (24 h) ───────────────────
  const ofrecerCargo = async (uidDestino: string): Promise<string> => {
    try {
      const respuesta = await fetch('/api/cargos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion: 'ofrecer', destinoUid: uidDestino })
      });
      const datos = (await respuesta.json()) as { error?: string; mensaje?: string };
      return datos.error || datos.mensaje || 'Oferta enviada.';
    } catch {
      return 'No se pudo enviar la oferta. Revisa la conexión.';
    }
  };

  const responderOferta = async (aceptar: boolean): Promise<string> => {
    try {
      const respuesta = await fetch('/api/cargos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion: aceptar ? 'aceptar' : 'rechazar' })
      });
      const datos = (await respuesta.json()) as { error?: string; mensaje?: string };
      return datos.error || datos.mensaje || '';
    } catch {
      return 'No se pudo responder la oferta. Revisa la conexión.';
    }
  };

  const puede = (permiso: Permiso) =>
    modoLocal || puedeCuenta(usuario, permiso);

  const puedeCupo = (cupo: CupoFirma): boolean =>
    !!usuario && usuario.activo && puedeIngresar(usuario) && puedeOcuparCupo(usuario.rol, cupo, usuario.atribuciones);

  const enEspera = !!usuario && !modoLocal && !puedeIngresar(usuario);
  const esperaMensaje = enEspera ? textoEspera(usuario) : '';
  const ofertaPendiente = usuario?.ofertaDirector;

  return (
    <AuthContext.Provider
      value={{
        usuario,
        usuarios,
        cargando,
        error,
        authDisponible,
        modoLocal,
        esFundador,
        esSuperAdmin,
        rolEfectivo,
        puedeCupo,
        enEspera,
        esperaMensaje,
        ofertaPendiente,
        puedeAceptarIngresos,
        aceptarIngreso,
        rechazarIngreso,
        otorgarAtribucion,
        revocarAtribucion,
        ofrecerCargo,
        responderOferta,
        iniciarSesionGoogle,
        cerrarSesion,
        entrarModoLocal,
        cambiarRol,
        activarUsuario,
        vincularIntegrante,
        puede,
        puedeAdministrarCuenta
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
