'use client';

import { useRef, useCallback, useEffect } from 'react';

// Hook reutilizable de pulsación larga para menús contextuales en móvil.
// Se apoya en eventos táctiles y de ratón, cancela al desplazar y evita el
// menú nativo del navegador cuando la pulsación se sostiene.
export const usePulsacionLarga = (onPulsacionLarga: () => void, duracionMs: number = 500) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disparadoRef = useRef(false);

  const cancelar = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const iniciar = useCallback(() => {
    cancelar();
    disparadoRef.current = false;
    timerRef.current = setTimeout(() => {
      disparadoRef.current = true;
      onPulsacionLarga();
    }, duracionMs);
  }, [cancelar, onPulsacionLarga, duracionMs]);

  useEffect(() => cancelar, [cancelar]);

  // Manejadores de eventos válidos para un elemento del DOM. No se altera el
  // comportamiento táctil por defecto, de modo que el toque simple siga
  // generando el evento de clic.
  const manejadores = {
    onTouchStart: () => iniciar(),
    onTouchEnd: cancelar,
    onTouchMove: cancelar,
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      iniciar();
    },
    onMouseUp: cancelar,
    onMouseLeave: cancelar,
    onMouseMove: cancelar,
    // Sí se anula el menú contextual nativo: la pulsación larga lo reemplaza.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault()
  };

  return {
    manejadores,
    // Permite al consumidor saber si la pulsación ya se resolvió como larga,
    // para no ejecutar además la acción del toque simple.
    fuePulsacionLarga: () => disparadoRef.current,
    reiniciar: () => {
      disparadoRef.current = false;
    }
  };
};
