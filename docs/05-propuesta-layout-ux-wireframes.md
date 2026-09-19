# Solibook — Propuesta de Layout / UX y Estructura de Navegación

**Ministerio Vocal "Solí Deo"**  
**Fecha:** 2026-09-18  
**Enfoque:** Mobile-First (PWA Táctil) + Consola de Escritorio (Dashboard Panorámico)  
**Estado:** Documento de Planificación (Fase 3)

---

## 1. Identidad Gráfica y Sistema de Diseño (Design System)

- **Paleta de Colores (Inspirada en el Logo Oficial):**
  - **Celeste Primario:** `#0284c7` (Botones de acción, selección activa, acentos dinámicos).
  - **Burdeos Institucional:** `#881337` (Encabezados formales, logo tipográfico, acentos de distinción).
  - **Fondo General:** `#f8fafc` (Gris perla ultra limpio; nunca blanco deslumbrante al 100% ni oscuro deprimente).
  - **Superficie de Tarjetas:** `#ffffff` puro con sombras tenues y bordes sutiles `#e2e8f0`.
  - **Texto Principal:** `#1e293b` (Gris pizarra oscuro; máxima legibilidad sin fatiga visual).
  - **Semáforo Táctil de Asistencia:**
    - Presente: Esmeralda suave `#10b981` (fondo `#ecfdf5`).
    - Justificado: Ámbar cálido `#f59e0b` (fondo `#fffbeb`).
    - Ausente: Carmesí tenue `#ef4444` (fondo `#fef2f2`).
- **Iconografía:** Lucide Icons (trazo de 1.5px, contorno fino, profesional, cero emojis).
- **Tipografía:** Inter o Geist (geométrica, moderna, neutra y legible en pantallas de 4 a 32 pulgadas).

---

## 2. Navegación Móvil (PWA en Teléfono)

### 2.1 Barra Superior (Header Fijo)
- **Izquierda:** Logo isotipo del ave celeste con texto discreto *"Solí Deo"*.
- **Derecha:**
  - Icono de Campanita (Notificaciones con badge de alertas pendientes).
  - Botón sutil de *"Refrescar versión / Actualizar app"* (para limpiar caché de PWA).
  - Avatar de usuario con iniciales.

### 2.2 Barra de Navegación Inferior (Bottom Navigation Bar)
Fija al fondo de la pantalla con 5 pestañas principales:
1. **Agenda (Icono Calendario):** Próximas actividades y acceso a pasar lista.
2. **Asistencia (Icono Checklist):** Registro rápido de la lista en curso y estado general.
3. **Actas (Icono Cuaderno/Pluma):** Libro de actas de reunión.
4. **Cartas (Icono Sobre/Correspondencia):** Correspondencia recibida y emitida.
5. **Directorio (Icono Contactos/Personas):** Padrón de integrantes y fichas.

---

## 3. Wireframes Conceptuales de las Pantallas Clave (Móvil)

### 3.1 Pantalla: Agenda de Actividades
```text
┌──────────────────────────────────────────────┐
│ [Ave] Solí Deo               (↻) (🔔 3) [JD] │
├──────────────────────────────────────────────┤
│ [📅 Agenda / Lista]   [🗓️ Calendario Mensual] │  <- Selector de vista
│                                              │
│ [Filtro: Todos ▼]    [🔍 Buscar actividad...]│
├──────────────────────────────────────────────┤
│ HOY — VIERNES 24 OCTUBRE                     │
│ ┌──────────────────────────────────────────┐ │
│ │ 🎵 Ensayo General                        │ │
│ │ ⏰ 19:30 hrs  📍 Templo Central          │ │
│ │ 👥 Convocados: Todo el ministerio (42)    │ │
│ │                                          │ │
│ │ [ Tomar Lista Ahora ]    [ Compartir Wsp]│ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ PRÓXIMO DOMINGO 26 OCTUBRE                   │
│ ┌──────────────────────────────────────────┐ │
│ │ 🏛️ Presentación Aniversario               │ │
│ │ ⏰ 18:00 hrs  📍 Templo Belén            │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│               [ + Nueva Actividad ] (Flotante)│
└──────────────────────────────────────────────┘
```

### 3.2 Pantalla: Pasar Lista (Ultra Rápida y Táctil)
```text
┌──────────────────────────────────────────────┐
│ ← Ensayo General (24 Oct)        [Finalizar] │
├──────────────────────────────────────────────┤
│ 👥 38 / 42 Registrados   [⚡ Marcar Todos P] │
│ 🔍 Buscar integrante por nombre...          │
├──────────────────────────────────────────────┤
│ Carlos Alvarado (Tenor - Igl. Central)       │
│                [ (✓ P) ]  [ (✕ A) ]  [ (📄 J) ] │ <- Botón circular
├──────────────────────────────────────────────┤
│ Daniela Morales (Soprano - Igl. Belén)       │
│                [ (✓ P) ]  [ (✕ A) ]  [ (📄 J) ] │
├──────────────────────────────────────────────┤
│ Esteban Rojas (Bajo - Igl. El Olivar)        │
│                [ (✓ P) ]  [ (✕ A) ]  [ (📄 J) ] │
│   ↳ Justificado: "Turno médico adjunto"      │
└──────────────────────────────────────────────┘
* Mantener presionado cualquier fila para editar detalles.
* Si tocas "Atrás" antes de finalizar, pregunta: "¿Guardar borrador?".
```

### 3.3 Pantalla: Campanita de Notificaciones y Acuse de Recibo
```text
┌──────────────────────────────────────────────┐
│ ← Notificaciones y Pendientes       [Filtrar]│
├──────────────────────────────────────────────┤
│ [ Todos ]  [ Justificaciones ]  [ Cartas ]   │
├──────────────────────────────────────────────┤
│ 📄 Justificación: Esteban Rojas              │
│ Evento: Ensayo 24 Oct | Motivo: Turno laboral│
│ [Ver Foto Licencia]                          │
│ Visto por: JD (Dir), MR (Sec)                │
│ [🟢 Aprobar]    [🔴 Rechazar]  [✓ Marcar Visto]│
├──────────────────────────────────────────────┤
│ ✉️ Nueva Carta Recibida                      │
│ De: Iglesia Bautista Central                 │
│ Asunto: Invitación Aniversario               │
│ [Ver PDF]  [+ Crear Evento en Agenda]        │
└──────────────────────────────────────────────┘
```

---

## 4. El "Dashboard" / Consola Panorámica para Computador (PC)

Cuando la pantalla es ancha (> 1024px), la app se transforma en la **Consola de Gestión**:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [Ave] SOLÍ DEO — Consola Administrativa Semestral      (↻ Actualizar) [JD Admin]│
├──────────────────────────────────────────────────────────────────────────────────┤
│ 📊 RESUMEN GENERAL:                                                              │
│ [ 48 Miembros Activos ] [ 88% Asistencia Promedio ] [ 18 Ensayos ] [ 4 Pendientes]│
├──────────────────────────────────────────────────────────────────────────────────┤
│ MATRIZ DE ASISTENCIA SEMESTRAL (PLANILLA EXCEL INTERACTIVA)                      │
│ Filtros: [1er Semestre 2026 ▼] [Cuerda: Todas ▼]    [ 📥 Descargar Excel ] [ 🖨️ PDF ]│
├──────────────────────────────────────────────────────────────────────────────────┤
│ #  | Integrante      | Cuerda  | 05/Mar | 12/Mar | 19/Mar | 26/Mar | ... |  % Final│
├────┼─────────────────┼─────────┼────────┼────────┼────────┼────────┼─────┼─────────┤
│ 01 | Alvarado Carlos | Tenor   |   P    |   P    |   J    |   P    | ... |   92%   │
│ 02 | Bravo Marcela   | Soprano |   P    |   P    |   P    |   P    | ... |  100%   │
│ 03 | Cortés Fernando | Bajo    |   A    |   P    |   P    |   A    | ... |   70%   │
│ 04 | Díaz Valentina  | Contral |   —    |   P    |   P    |   P    | ... |   95%   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ * Clic en celda para cambiar estado al instante (P / A / J / — no convocado).    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

*Diseño de UX cerrado: amigable, profesional, libre de saturación y optimizado para pantallas táctiles y escritorios.*
