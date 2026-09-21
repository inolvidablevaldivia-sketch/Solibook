'use client';

import { useRef, useCallback, useEffect } from 'react';

// Hook reutilizable de pulsación larga para menús contextuales en móvil.
// Se apoya en eventos táctiles y de ratón, cancela al desplazar y evita el
// menú nativo del navegador y la selección de texto cuando la pulsación
// se sostiene.
//
// Importante: el contenedor que reciba estos manejadores debe llevar la
// clase CSS `.accion-mantener` (globals.css), que además bloquea la
// selección y el touch-callout a nivel de estilo, por si el timer no
// alcanza a dispararse antes que el navegador inicie la selección.
export const usePulsacionLarga = (onPulsacionLarga: () => void, duracionMs: number = 500) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disparadoRef = useRef(false);
  const toqueInicialRef = useRef<{ x: number; y: number } | null>(null);
  const umbralMovimiento = 10; // píxeles

  const cancelar = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    toqueInicialRef.current = null;
  }, []);

  const iniciar = useCallback((clientX?: number, clientY?: number) => {
    cancelar();
    disparadoRef.current = false;
    if (typeof clientX === 'number' && typeof clientY === 'number') {
      toqueInicialRef.current = { x: clientX, y: clientY };
    } else {
      toqueInicialRef.current = null;
    }
    timerRef.current = setTimeout(() => {
      disparadoRef.current = true;
      onPulsacionLarga();
    }, duracionMs);
  }, [cancelar, onPulsacionLarga, duracionMs]);

  const mover = useCallback((clientX?: number, clientY?: number) => {
    const ini = toqueInicialRef.current;
    if (ini && typeof clientX === 'number' && typeof clientY === 'number') {
      if (Math.abs(clientX - ini.x) > umbralMovimiento || Math.abs(clientY - ini.y) > umbralMovimiento) {
        cancelar();
        return;
      }
    }
    // Si no hay coordenadas táctiles (ratón), cancelar siempre al mover.
    if (!ini) cancelar();
  }, [cancelar]);

  useEffect(() => cancelar, [cancelar]);

  const manejadores = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      iniciar(t?.clientX, t?.clientY);
    },
    onTouchEnd: cancelar,
    onTouchCancel: cancelar,
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      mover(t?.clientX, t?.clientY);
    },
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      iniciar(e.clientX, e.clientY);
    },
    onMouseUp: cancelar,
    onMouseLeave: cancelar,
    onMouseMove: (e: React.MouseEvent) => mover(e.clientX, e.clientY),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    // Anular menú contextual nativo: la pulsación larga lo reemplaza.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    // Evitar que el navegador empiece a seleccionar texto mientras se
    // mantiene presionado.
    onSelectCapture: (e: React.SyntheticEvent) => {
      if (disparadoRef.current || timerRef.current) {
        // Prevenir la selección cuando hay un timer activo o ya hubo
        // pulsación larga. Sin esto, en Android aparece la manija de
        // selección de texto superpuesta al menú.
        e.preventDefault();
        const sel = window.getSelection?.();
        if (sel && sel.rangeCount > 0) sel.removeAllRanges();
      }
    }
  };

  return {
    manejadores,
    // Permite al consumidor saber si la pulsación ya se resolvió como larga,
    // para no ejecutar además la acción del toque simple.
    fuePulsacionLarga: () => disparadoRef.current,
    reiniciar: () => {
      disparadoRef.current = false;
      cancelar();
    }
  };
};
