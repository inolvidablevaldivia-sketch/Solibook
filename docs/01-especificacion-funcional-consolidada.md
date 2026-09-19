# Solibook — Especificación Funcional Completa y Consolidada

**Ministerio Vocal "Solí Deo"**  
**Tipo de Aplicación:** PWA (Progressive Web App) Mobile-First  
**Fecha de Consolidación:** 2026-09-18  
**Estado:** Definición Conceptual Aprobada (Fase previa a código)

---

## 1. Identidad Visual y Estética

- **Colores Institucionales (extraídos del logo oficial):**
  - **Celeste / Cyan Cielo (#0088cc aprox.):** Acento principal, botones de acción primaria, estados activos, convocatorias.
  - **Burdeos / Carmesí Vino (#8b1e2b aprox.):** Encabezados institucionales, barras de navegación noble, distinciones formales.
  - **Blanco Puro y Gris Perla muy tenue:** Fondos limpios para descanso visual, tarjetas despejadas.
  - **Gris Carbón suave (nunca #000 puro):** Tipografía para alta legibilidad sin fatiga.
- **Estilo:** Corporativo, elegante, profesional, limpio.
- **Regla Estricta:** Cero emojis en la interfaz. Toda la iconografía es estilizada, minimalista (trazo fino ~1.5px, tipo Lucide/Phosphor).

---

## 2. Los 4 Libros de Secretaría + 1 Directorio

La aplicación se concibe como un **archivador digital de secretaría**:

### 2.1 Directorio Central de Personas (Padrón Único)
- **Campos por integrante:**
  - Nombre completo.
  - Teléfono / WhatsApp.
  - Correo electrónico.
  - Dirección / Comuna.
  - Iglesia de procedencia.
  - Cuerda / Clasificación vocal (Soprano, Contralto, Tenor, Bajo, Solista, etc.).
  - Estado: Activo / En receso / Inactivo.
- **Regla de oro de integridad:** Los integrantes solo se crean aquí. Ninguna otra pantalla permite escribir nombres "al vuelo"; en cualquier otro módulo se seleccionan con autocompletado desde esta base de datos para evitar duplicados.
- **Filtros y Búsqueda:**
  - Buscador instantáneo por texto.
  - Ordenar por: Alfabético, Iglesia, Cuerda/Voz, Estado.
  - Mantener presionado (long-press): Abre menú para editar datos o pasar a inactivo.

### 2.2 Libro de Asistencia
- **Comportamiento visual:** Scroll de integrantes activos (los inactivos quedan ocultos automáticamente).
- **Selector táctil compacto por persona:** 3 botones circulares de icono:
  - **✓ Presente (P):** Verde suave / celeste.
  - **✕ Ausente (A):** Rojo vino tenue.
  - **📄 Justificado (J):** Ámbar / naranja. Permite ver o adjuntar justificación.
- **Botón rápido:** *"Marcar todos Presentes"* para pasar lista en menos de 30 segundos.
- **Gestión de Convocatorias (No castigar estadísticas):**
  - Al crear la actividad se define quiénes están citados:
    - *Opción A:* Todo el ministerio (por defecto).
    - *Opción B:* Por cuerda/grupo (Tenores, Bajos, Contraltos, Sopranos, Solistas, Directiva) con selección múltiple.
    - *Opción C:* Citación personalizada con selector individual y botón *"Seleccionar todos / Deseleccionar todos"*.
  - En cualquier opción, botón de *"Agregar integrante individual extra"* con buscador predictivo.
  - **Regla de cálculo:** Quien no fue convocado a un evento NO cuenta como inasistencia. Su porcentaje se calcula solo sobre las convocatorias reales.
- **Resiliencia en el teléfono:**
  - Auto-guardado inmediato (Draft): si entra una llamada o se cambia de app, no se pierde ningún toque.
  - Al volver, avisa que hay una lista en progreso.
  - Al presionar volver atrás sin finalizar: pide confirmación *"¿Deseas salir? Tu progreso se guardará como borrador"*.
  - Historial editable manteniendo presionado sobre cualquier registro pasado.

### 2.3 Libro de Correspondencia (Cartas Recibidas y Emitidas)
- **Registro de correspondencia entrante:**
  - Remitente / Entidad (ej. Iglesia, Organización).
  - Fecha de recepción.
  - Asunto / Motivo.
  - Fotografía de la carta física o archivo PDF adjunto (almacenado en la nube, nunca en el teléfono).
  - Estados visuales:
    - 🟡 Pendiente de respuesta
    - 🟢 Aceptada
    - 🔴 Declinada / Archivada
- **Acción directa de calendario:** Si la carta es una invitación a cantar o citación, incluye un botón directo al final: *"Crear evento en Agenda"*, que precarga los datos en la misma tarjeta de nuevo evento.
- **Acuse de recibo de directiva:** Botón *"Marcar como Leído / Enterado"* para que cada miembro de la directiva deje constancia de que revisó la carta. La directiva ve quiénes ya lo revisaron.
- **Correspondencia saliente / Cartas oficiales:** Descarga e impresión directa en PDF formal membretado con el logo institucional de Solí Deo.

### 2.4 Libro de Actas de Reunión
- **Registro dual:** Soporta fotografía del acta manuscrita física (subida a la nube) y campo de texto estructurado (Temas tratados y Acuerdos tomados).
- **Herramienta de copiado:** Botón *"Copiar texto"* al pie del acta para compartirlo con un toque.
- **Flujo de Seguridad con Doble Autorización (Presidente + Secretaría):**
  - **Cierre del Acta:** Una vez finalizada la reunión, se presiona *"Aprobar y Cerrar Acta"*. El acta queda bloqueada contra toques accidentales.
  - **Solicitud de Edición:** Si se requiere modificar un acta cerrada, la solicitud debe ser autorizada por **ambos** (Presidente y Secretaria) mediante notificación en la app.
  - **Historial y rollback de 30 días:** La versión previa no editada permanece respaldada durante 30 días. Si es necesario, existe la opción *"Deshacer edición"* que también requiere la doble aprobación de ambos.
- **Impresión / PDF:** Descarga directa en formato formal con membrete y pie de firmas.

### 2.5 Agenda y Calendario de Actividades
- **Vistas conmutables:** Selector en cabecera para alternar entre:
  - **Vista Agenda (Timeline vertical):** Vista por defecto para móviles. Tarjetas limpias con Título, Fecha y Hora. Espacio despejado.
  - **Vista Calendario Mensual:** Panorámica rápida de todo el mes.
- **Detalle bajo demanda:** Al tocar cualquier fecha/tarjeta se abre el panel inferior con los detalles completos (Lugar, Dirección, Citados, Notas) y el botón directo de *"Pasar Asistencia"*.
- **Filtros rápidos:** Filtro por tipo de evento (*Todos, Ensayos, Presentaciones, Reuniones, Otros*) y rango de fechas.
- **Botón "Compartir para WhatsApp":** Genera al portapapeles una lista limpia y elegante.
  - **Regla estricta:** Solo incluye los campos que realmente tengan información (si no hay nota, no se muestra nada; si no hay dirección, se omite).

---

## 3. Centro de Notificaciones y Acuse de Recibo (La Campanita)

- **Filtros internos de avisos:**
  - *Justificaciones* (avisos de integrantes que enviaron justificativo).
  - *Calendario* (recordatorios de eventos próximos).
  - *Cartas* (nuevas correspondencias recibidas).
  - *Generales / Sistema* (solicitudes de edición de actas).
- **Semáforo visual de Justificaciones:**
  - 🟢 Verde: Aprobado
  - 🟡 Naranja: Pendiente
  - 🔴 Rojo: Rechazado
- **Revisión rápida:** Posibilidad de aprobar o rechazar directamente desde la tarjeta de notificación.
- **Acuse de recibo de Directiva:** Indicador visual de quiénes de la directiva ya vieron el justificativo o la carta.
- **Doble canal de ingreso de Justificaciones:**
  - *Por Secretaría:* Manual, adjuntando pantallazo o motivo directo.
  - *Por Link de Auto-servicio:* Enlace simple para integrantes (sin login complejo) donde seleccionan su nombre, la fecha de la actividad, redactan su motivo y suben foto/licencia médica.

---

## 4. Estadísticas y Reportes

- **Métricas generales e individuales:**
  - Ranking de mayor asistencia (reconocimiento al compromiso).
  - Ranking de mayor inasistencia (alerta para acompañamiento pastoral/directivo).
  - Porcentaje de cumplimiento general del coro por período (mes, trimestre, año).
- **Filtros avanzados:** Por rango de fechas, por cuerda vocal, por iglesia de origen.
- **Justicia estadística:** Solo se computan actividades donde el miembro fue efectivamente convocado.

---

## 5. Arquitectura Técnica y Configuración PWA

- **Plataforma:** PWA (Progressive Web App) optimizada para teléfonos móviles (instalable con icono oficial del logo en pantalla de inicio).
- **Autenticación:**
  - Acceso mediante Cuenta de Google (Google OAuth) con sesión permanente en el dispositivo.
  - Para pruebas iniciales: acceso rápido directo antes de habilitar las credenciales finales de Google.
- **Almacenamiento de Archivos (Fotos y PDFs):**
  - Servicio de almacenamiento en la nube (Storage de Supabase o S3 compatible).
  - Compresión automática en cliente antes de subir (archivos ligeros de ~200-300 KB).
  - **Cero saturación de los teléfonos** de la directiva.
- **Gestión de Caché PWA (Requerimiento Crítico):**
  - Panel de Configuración con botón explícito: **"Actualizar Aplicación / Recargar versión fresca"**.
  - Este botón limpia cachés del navegador, desencadena `skipWaiting` en el Service Worker y recarga la versión más reciente del servidor para evitar que queden pantallas congeladas con versiones antiguas.

---

*Especificación técnica y conceptual cerrada y lista para los entregables de planificación formal.*
