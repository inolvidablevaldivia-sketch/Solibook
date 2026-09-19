# Solibook — Resumen del Pedido y Listado de Requerimientos

**Documento de planificación (Fase 0 — Análisis)**
**Proyecto:** Sistema de gestión administrativa — Ministerio Vocal "Solí Deo"
**Estado del repositorio al momento de redactar:** vacío (solo `README.md`, 1 commit inicial)
**Fecha:** 2026-09-17

> Este documento **no contiene código**. Es el insumo previo a la Fase de Planificación
> (arquitectura, modelo entidad-relación y propuesta UX) que el cliente exige antes de desarrollar.

---

## 1. Super Resumen Ejecutivo

El Ministerio Vocal **"Solí Deo"** necesita una aplicación web interna que centralice su
**gestión administrativa**: saber quiénes son sus integrantes, controlar su asistencia a las
actividades, llevar registro formal de sus reuniones (actas), emitir comunicaciones oficiales
(cartas) y medir el compromiso del grupo mediante reportes de asistencia.

**No es** un sistema musical. Queda expresamente fuera de alcance todo lo técnico-artístico
(partituras, audios, material de ensayo, vocalizaciones).

La aplicación opera bajo **tres roles** con permisos diferenciados:

| Rol | Naturaleza del acceso |
|---|---|
| **Administración** | Acceso total, configuración general y auditoría |
| **Directiva** | Gestión documental: actas, aprobación de cartas, reportes |
| **Secretaría** | Operación diaria: asistencia, justificaciones, directorio |

**Condición contractual clave del cliente:** antes de escribir cualquier código de la
aplicación, se le deben presentar tres entregables de planificación:
(1) arquitectura de software recomendada, (2) modelo entidad-relación detallado,
(3) propuesta de layout/UX y estructura de navegación.

**Stack sugerido por el cliente** (no vinculante): Next.js, Supabase/PostgreSQL, Tailwind CSS.

---

## 2. Alcance

### 2.1 Dentro del alcance

- Gestión administrativa del ministerio (personas, actividades, documentos, comunicaciones).
- Comunicación interna y control operativo.
- Control de asistencia a actividades y ensayos (registro de presencia/ausencia únicamente).
- Producción de reportes e indicadores de asistencia.

### 2.2 Fuera del alcance (exclusión explícita del cliente)

- Partituras y material musical.
- Audios y grabaciones.
- Gestión del contenido de ensayos musicales (repertorio, tonalidades, pistas).
- Vocalizaciones y material técnico-vocal.

> **Aclaración necesaria (ver O-01):** se registra la *asistencia* a ensayos, pero no se gestiona
> ningún *contenido* del ensayo. Esta distinción debe quedar explícita para evitar desvío de alcance.

---

## 3. Requerimientos Funcionales (RF)

### RF-GEN — Transversales

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-GEN-01 | El sistema debe aplicar control de acceso basado en roles (RBAC) con tres niveles: Administración, Directiva y Secretaría. | Todos | **Crítica** |
| RF-GEN-02 | Las vistas y acciones disponibles deben variar según el rol del usuario autenticado. | Todos | **Crítica** |
| RF-GEN-03 | La interfaz debe ser utilizable por personas sin formación técnica. | Todos | Alta |

### RF-AUT — Autenticación y Cuentas

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-AUT-01 | El sistema debe exigir autenticación para cualquier acceso a datos. | Todos | **Crítica** |
| RF-AUT-02 | *Requerimiento implícito — no especificado por el cliente:* debe existir un mecanismo de creación y administración de cuentas de usuario. | Administración | **Crítica** |

> ⚠️ RF-AUT-02 **no fue solicitado explícitamente** en el brief original. Se registra porque sin él
> los roles definidos no pueden existir. Ver O-02.

### RF-DASH — Panel Principal (Dashboard)

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-DASH-01 | Mostrar métricas rápidas de estado del ministerio. | Todos (según rol) | Alta |
| RF-DASH-02 | Mostrar resumen de tareas y aprobaciones pendientes para el usuario. | Todos (según rol) | Alta |
| RF-DASH-03 | Mostrar actividades próximas del calendario. | Todos | Alta |
| RF-DASH-04 | Mostrar recordatorios clave. | Todos | Media |

> Las métricas concretas **no fueron definidas** por el cliente. Ver O-08.

### RF-DIR — Directorio e Integrantes

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-DIR-01 | Mantener una ficha completa por integrante con datos personales. | Secretaría (edición) | **Crítica** |
| RF-DIR-02 | Registrar datos de contacto por integrante. | Secretaría | Alta |
| RF-DIR-03 | Gestionar el estado del integrante: activo / inactivo. | Secretaría | **Crítica** |
| RF-DIR-04 | Registrar el rol del integrante dentro del ministerio. | Secretaría | Alta |
| RF-DIR-05 | Permitir consulta del directorio. | Todos (según rol) | Alta |

### RF-ASI — Control de Asistencia y Justificaciones

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-ASI-01 | Registrar asistencia de integrantes a actividades y ensayos. | Secretaría | **Crítica** |
| RF-ASI-02 | Permitir el ingreso de justificaciones de ausencias. | Secretaría | **Crítica** |
| RF-ASI-03 | Permitir la aprobación (o rechazo) de justificaciones ingresadas. | Directiva / Administración | **Crítica** |
| RF-ASI-04 | *Requerimiento implícito:* las justificaciones deben tener estados distinguibles (pendiente / aprobada / rechazada). | Directiva | **Crítica** |

> ⚠️ RF-ASI-04 no está explícito en el brief, pero "ingresar/aprobar" implica un flujo de estados.
> Es la causa más probable de defectos si no se define. Ver O-03.

### RF-CAL — Calendario de Actividades

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-CAL-01 | Mantener una agenda centralizada de actividades. | Administración / Directiva | **Crítica** |
| RF-CAL-02 | Cubrir al menos: reuniones, presentaciones y eventos administrativos. | Administración / Directiva | Alta |
| RF-CAL-03 | Las actividades del calendario deben poder asociarse al registro de asistencia. | Secretaría | **Crítica** |

### RF-ACT — Actas de Reuniones

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-ACT-01 | Permitir la redacción de actas de reunión. | Directiva | **Crítica** |
| RF-ACT-02 | Almacenar las actas redactadas. | Directiva | **Crítica** |
| RF-ACT-03 | Permitir la consulta de actas por fecha. | Todos (según rol) | Alta |

### RF-CAR — Cartas y Comunicaciones

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-CAR-01 | Generar comunicados y cartas oficiales a partir de plantillas predefinidas. | Directiva | Alta |
| RF-CAR-02 | Gestionar (listar, consultar) las comunicaciones generadas. | Directiva | Alta |
| RF-CAR-03 | Permitir la aprobación de cartas. | Directiva / Administración | Alta |
| RF-CAR-04 | *Requerimiento implícito:* debe existir un mecanismo de administración de las plantillas. | Administración | Media |

> ⚠️ RF-CAR-04 no está explícito. El brief dice "plantillas predefinidas" sin indicar quién las define
> ni si son editables. Ver O-07.

### RF-REP — Reportes y Estadísticas

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-REP-01 | Mostrar gráficos e indicadores visuales de asistencia. | Directiva / Administración | Alta |
| RF-REP-02 | Calcular porcentaje de asistencia **general** del ministerio. | Directiva / Administración | Alta |
| RF-REP-03 | Calcular porcentaje de asistencia **individual** por integrante. | Directiva / Administración | Alta |
| RF-REP-04 | *Requerimiento implícito:* el historial de asistencia de integrantes inactivos debe conservarse y seguir siendo reportable. | Directiva / Administración | **Crítica** |

> ⚠️ RF-REP-04 no fue mencionado, pero es una decisión de modelo de datos irreversible. Ver O-05.

### RF-ADM — Administración y Auditoría

| ID | Requerimiento | Rol(es) | Prioridad |
|---|---|---|---|
| RF-ADM-01 | Acceso total al sistema para el rol Administración. | Administración | **Crítica** |
| RF-ADM-02 | Configuración general del sistema. | Administración | Alta |
| RF-ADM-03 | Auditoría del sistema. | Administración | Media |

> "Auditoría" no está definido. Puede significar registro de acciones de usuarios (log) o bien un
> panel de configuración/revisión. Ver O-09.

---

## 4. Requerimientos No Funcionales (RNF)

### 4.1 Explícitos en el brief del cliente

| ID | Requerimiento | Detalle |
|---|---|---|
| RNF-UX-01 | Paleta corporativa | Celeste, blanco, burdeos y rojo (colores del ministerio) |
| RNF-UX-02 | Estilo visual | Limpio, moderno, profesional, muy ordenado, amigable |
| RNF-UX-03 | Usabilidad | Navegación clara e intuitiva, apta para usuarios no técnicos |
| RNF-ARQ-01 | Stack sugerido | Next.js + Supabase/PostgreSQL + Tailwind CSS (sugerencia, no restricción) |
| RNF-PROC-01 | Entregables previos al desarrollo | Arquitectura, modelo ER y propuesta UX/wireframes **antes** de programar |

### 4.2 Implícitos — no mencionados por el cliente, pero obligatorios de resolver

| ID | Requerimiento | Por qué importa |
|---|---|---|
| RNF-SEG-01 | Cumplimiento de la **Ley 19.628** (Chile) sobre protección de datos personales | La ficha de integrante almacena datos personales reales. Define consentimiento, acceso y retención. |
| RNF-SEG-02 | Control de acceso a nivel de datos (no solo de interfaz) | Ocultar un botón no protege el dato. En Supabase esto se resuelve con Row Level Security. |
| RNF-SEG-03 | Respaldo y plan de recuperación | Actas y registros históricos son documentos formales del ministerio. |
| RNF-DISP-01 | Comportamiento ante conectividad intermitente (modo offline) | La asistencia se toma en templos/salones, donde la conexión suele fallar. Riesgo operativo n.º 1. |
| RNF-CAP-01 | Definición de volumen esperado (n.º de integrantes y usuarios concurrentes) | Determina infraestructura, costo y si el plan gratuito de Supabase basta. |
| RNF-MANT-01 | Definición de quién mantiene el sistema y con qué conocimiento técnico | Decide entre backend gestionado (Supabase) o autoadministrado (PostgreSQL propio). |
| RNF-RET-01 | Política de retención de datos históricos | Irreversible a nivel de base de datos si no se decide al inicio. |
| RNF-I18N-01 | Idioma y zona horaria | Español (Chile); zona horaria America/Santiago para calendario y fechas de actas. |

---

## 5. Resumen de Roles y Permisos (según el brief)

| Funcionalidad | Administración | Directiva | Secretaría |
|---|:---:|:---:|:---:|
| Dashboard | ✅ total | ✅ | ✅ |
| Directorio — editar fichas | ✅ | — | ✅ |
| Directorio — consultar | ✅ | ✅ | ✅ |
| Registrar asistencia | ✅ | — | ✅ |
| Ingresar justificaciones | ✅ | — | ✅ |
| Aprobar justificaciones | ✅ | ✅ | — |
| Calendario de actividades | ✅ | ✅ | consultar |
| Actas de reunión | ✅ | ✅ | — |
| Cartas / comunicaciones | ✅ | ✅ (aprueba) | — |
| Reportes y estadísticas | ✅ | ✅ | — |
| Configuración general | ✅ | — | — |
| Auditoría | ✅ | — | — |

> Esta matriz es la **interpretación literal** del brief. No fue validada por el cliente.
> Los puntos ambiguos están marcados en la sección 6 (O-04).

---

## 6. Preguntas Abiertas — bloquean el inicio del desarrollo

| ID | Pregunta | Impacto si no se responde |
|---|---|---|
| **O-01** | ¿Se registra asistencia a ensayos sin gestionar contenido musical? | Desvío de alcance hacia lo técnico-musical |
| **O-02** | ¿Quién crea las cuentas de usuario y cómo se recupera el acceso? | Los roles no pueden existir en la práctica |
| **O-03** | ¿Qué estados tiene una justificación? ¿Puede revertirse una aprobación? | Defectos en el flujo de aprobación |
| **O-04** | ¿Puede un integrante común tener acceso de solo lectura, o solo existen los 3 roles administrativos? | Cambia el modelo de usuarios y la seguridad |
| **O-05** | ¿El historial de un integrante inactivo sigue contando en los reportes? | Decisión irreversible de base de datos |
| **O-06** | ¿"Actividad", "reunión", "evento" y "presentación" son una sola entidad con tipo, o entidades distintas? | Cuatro tablas desconectadas vs. una bien diseñada |
| **O-07** | ¿Las plantillas de cartas son fijas o editables? ¿Quién las administra? | Define si se necesita un CRUD completo de plantillas |
| **O-08** | ¿Qué métricas concretas debe mostrar el Dashboard? | Cada implementador inventa las suyas |
| **O-09** | ¿"Auditoría" es log de acciones de usuarios o panel de configuración? | Dos implementaciones completamente distintas |
| **O-10** | ¿El stack sugerido es una restricción o está abierto a propuestas? | Propuestas fuera de lo que el cliente espera mantener |
| **O-11** | ¿Funcionará con conectividad intermitente? | El módulo de asistencia fallará en el momento crítico |
| **O-12** | ¿Cuántos integrantes y cuántos usuarios concurrentes se esperan? | Sobredimensionamiento o infraestructura insuficiente |
| **O-13** | ¿Cuáles son los 3 módulos del MVP (v1)? | Siete módulos a medio terminar |
| **O-14** | ¿En qué formato se esperan los wireframes (texto, diagrama, imagen)? | Entregable distinto al esperado |
| **O-15** | ¿Existe un sistema o planilla actual que deba migrarse? | Pérdida de historial al entrar en producción |

---

## 7. Entregables Esperados de la Fase de Planificación

Según lo solicitado por el cliente, y con las adiciones recomendadas:

1. **Arquitectura de software recomendada** — stack, justificación y alternativas.
2. **Modelo Entidad-Relación** — tablas, claves primarias/foráneas y relaciones.
3. **Propuesta de Layout/UX** — estructura de navegación y wireframes conceptuales.
4. *(Recomendado)* **Matriz de permisos** rol × acción × recurso.
5. *(Recomendado)* **Máquinas de estado** de justificaciones y de cartas.
6. *(Recomendado)* **Definición de MVP** — qué entra en v1 y qué se posterga.
7. *(Recomendado)* **Registro de decisiones** sobre las preguntas abiertas de la sección 6.

---

*Documento generado en la rama `arena/01a0b251-solibook`. Sin código de aplicación.*
