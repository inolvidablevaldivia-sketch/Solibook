# Solibook — Módulo Consola de Gestión / Vista Planilla (Desktop & Exportación)

**Ministerio Vocal "Solí Deo"**  
**Fecha de Adición:** 2026-09-18  
**Complemento a:** `docs/01-especificacion-funcional-consolidada.md`  
**Estado:** Definición Conceptual Aprobada

---

## 1. Concepto y Propósito

La aplicación opera con un principio de **doble experiencia complementaria**:

1. **En el Teléfono (PWA Móvil):** La "navaja suiza" de campo. Ágil, botones táctiles grandes, pasar lista en 15 segundos, sacar fotos a cartas, autorizaciones rápidas de directiva.
2. **En el Computador / Pantalla Grande (Consola / Vista Planilla):** El "cuartel general" de fin de mes o semestre. Pantalla ancha para ver 50 o 100 integrantes con todas las fechas del semestre en una sola tabla densa, auditoría global y carga masiva.

Ambas vistas leen y escriben sobre la **misma base de datos única y en tiempo real**. Si la secretaria pasa lista en el teléfono durante el ensayo, aparece al segundo en la planilla del PC.

---

## 2. La "Súper Grilla" de Asistencia Semestral (Estilo Excel Interactivo)

### 2.1 Estructura Visual de la Tabla
- **Columna Izquierda Fija (Sticky / Congelada):**
  - Número de fila (#).
  - Nombre del integrante.
  - Cuerda / Clasificación vocal (Soprano, Tenor, etc.).
  - Iglesia de origen.
  *(Esta columna no se mueve cuando haces scroll horizontal a través de las fechas).*

- **Columnas Centrales Dinámicas (Fechas del Semestre):**
  - Cada columna representa un evento o ensayo realizado (`05/Mar`, `12/Mar`, `19/Mar`, etc.).
  - Encabezado de columna con etiqueta del tipo de evento (Ensayo, Presentación, Reunión).
  - Cada celda muestra un indicador ultracompacto:
    - `P` (verde suave): Presente.
    - `A` (rojo suave): Ausente.
    - `J` (ámbar): Justificado.
    - `—` (gris tenue): No fue convocado a esta fecha (no afecta sus métricas).

- **Columnas Derechas Fijas (Totales y Métricas en Tiempo Real):**
  - Total Convocados.
  - Asistencias Reales.
  - Justificados.
  - Inasistencias Injustificadas.
  - **% Cumplimiento Final:** Con barra de progreso o badge de color (Verde si >80%, Ámbar 60-79%, Rojo <60%).

### 2.2 Funciones de Edición Rápida (Edición Masiva en PC)
- **Edición tipo hoja de cálculo:** Puedes hacer clic sobre cualquier celda para alternar el estado (`P` -> `A` -> `J`) o teclear directamente con atajos de teclado sin abrir ventanas emergentes.
- **Agregar datos en bloque:** Capacidad de seleccionar una columna completa de una fecha y marcar "Presente" a todos con un clic, cambiando solo las excepciones.

---

## 3. Carga y Edición Masiva de Integrantes (Directorio)

Para cuando a principio de año o semestre ingresan 20 o 30 personas nuevas:
- **Vista Tabla de Integrantes:** Permite ver a todos los miembros en filas de tabla.
- **Edición en línea (Inline Edit):** Modificar teléfono, dirección o iglesia directamente en la celda sin tener que abrir la ficha individual de cada uno.
- **Importación / Pegado masivo:** Posibilidad de cargar un archivo Excel/CSV o pegar una lista de nombres desde el portapapeles para ingresar a todo el coro de una sola vez.

---

## 4. Sistema de Exportación e Impresión Oficial

La consola de escritorio incluye un botón principal de **"Exportar / Imprimir Reporte"** con las siguientes opciones:

### 4.1 Exportar a Excel (.xlsx / .csv)
- Genera un archivo nativo de Excel con:
  - Pestaña 1: **Matriz de Asistencia del Período** (la cuadrícula completa con nombres en filas y fechas en columnas con fórmulas de porcentajes automáticas).
  - Pestaña 2: **Padrón Oficial de Integrantes** con todos los datos de contacto, iglesias y estados.
  - Pestaña 3: **Resumen Estadístico** (totales por cuerda, por iglesia y promedios generales).
- El archivo viene limpio, listo para archivar en Google Drive o enviar por correo a la directiva general.

### 4.2 Exportar a PDF Formal Semestral (Listo para Imprimir)
- Diseñado en formato horizontal (Landscape) tamaño Carta u Oficio.
- Membretado oficial arriba con el logo de Solí Deo (ave celeste y tipografía burdeos).
- Tabla tipográfica de alta legibilidad optimizada para papel.
- Espacio al pie para firmas de:
  - *Secretaría del Ministerio*
  - *Dirección General*

---

## 5. Filtros Globales de la Consola

En la parte superior de la pantalla, una barra de herramientas sobria permite filtrar toda la sábana de datos:
- **Período:** Selector rápido (*Primer Semestre 2026, Segundo Semestre 2026, Año Completo, Rango personalizado*).
- **Tipo de Actividad:** Filtrar solo Ensayos, solo Presentaciones o Todas.
- **Filtrar por Cuerda:** Aislar por ejemplo solo la fila de "Bajos" o "Sopranos".
- **Filtrar por Iglesia:** Ver la asistencia agrupada por congregación de origen.

---

*Complemento funcional consolidado para diseño de arquitectura y base de datos.*
