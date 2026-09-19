# Solibook — Modelo Entidad-Relación (Base de Datos Relacional)

**Ministerio Vocal "Solí Deo"**  
**Motor:** PostgreSQL 16 (Supabase)  
**Fecha:** 2026-09-18  
**Estado:** Documento de Planificación (Fase 2)

---

## 1. Diagrama de Relaciones Conceptual

```text
[ usuarios_sistema ] (Auth & Roles: Admin, Directiva, Secretaría)
        │
        ├── 1:N ── [ integrantes ] (Padrón único del coro)
        │                 │
        │                 ├── 1:N ── [ asistencias ] ── N:1 ── [ eventos ]
        │                 │                                       │
        │                 └── 1:N ── [ justificaciones ]          ├── 1:1 ── [ actas ]
        │                                                         │
        ├── 1:N ── [ cartas_correspondencia ]                     └── 1:N ── [ convocatorias_evento ]
        │                 │
        │                 └── 1:N ── [ lecturas_directiva ] (Acuse de recibo)
        │
        └── 1:N ── [ notificaciones_sistema ]
```

---

## 2. Definición Detallada de Tablas

### 2.1 Tabla: `integrantes` (Directorio Central Único)
La única fuente de verdad para nombres de personas.
- `id`: UUID (Primary Key, autogenerado).
- `nombre_completo`: VARCHAR(150) NOT NULL.
- `telefono`: VARCHAR(30) (Número internacional para enlace directo a WhatsApp).
- `email`: VARCHAR(100).
- `direccion`: TEXT.
- `iglesia`: VARCHAR(120) NOT NULL (Congregación de origen).
- `cuerda`: VARCHAR(30) NOT NULL CHECK (cuerda IN ('Soprano', 'Contralto', 'Tenor', 'Bajo', 'Solista', 'Directiva', 'Otro')).
- `estado`: VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'En receso', 'Inactivo')).
- `fecha_ingreso`: DATE DEFAULT CURRENT_DATE.
- `notas`: TEXT.
- `created_at`, `updated_at`: TIMESTAMPTZ.

### 2.2 Tabla: `eventos` (Agenda y Calendario)
- `id`: UUID (Primary Key).
- `titulo`: VARCHAR(150) NOT NULL (Ej. "Ensayo General", "Aniversario Iglesia Central").
- `tipo_evento`: VARCHAR(40) NOT NULL CHECK (tipo_evento IN ('Ensayo', 'Presentación', 'Reunión', 'Administrativo', 'Otro')).
- `fecha_hora_inicio`: TIMESTAMPTZ NOT NULL.
- `fecha_hora_fin`: TIMESTAMPTZ.
- `lugar_nombre`: VARCHAR(150).
- `direccion`: TEXT (Opcional; si está vacío se omite en el mensaje de WhatsApp).
- `notas`: TEXT (Opcional; si está vacío se omite en WhatsApp).
- `tipo_convocatoria`: VARCHAR(30) NOT NULL DEFAULT 'Todos' CHECK (tipo_convocatoria IN ('Todos', 'Por Cuerda', 'Personalizada')).
- `asistencia_finalizada`: BOOLEAN DEFAULT FALSE (Indica si la lista se cerró o sigue en borrador).
- `created_by`: UUID (FK -> usuarios_sistema).

### 2.3 Tabla: `convocatorias_evento` (Quiénes fueron citados)
Permite que los eventos por cuerda o personalizados no castiguen la asistencia de los no citados.
- `id`: UUID (Primary Key).
- `evento_id`: UUID NOT NULL (FK -> eventos.id ON DELETE CASCADE).
- `integrante_id`: UUID NOT NULL (FK -> integrantes.id ON DELETE CASCADE).
- UNIQUE(`evento_id`, `integrante_id`).

### 2.4 Tabla: `asistencias` (Libro de Asistencia)
- `id`: UUID (Primary Key).
- `evento_id`: UUID NOT NULL (FK -> eventos.id ON DELETE CASCADE).
- `integrante_id`: UUID NOT NULL (FK -> integrantes.id ON DELETE CASCADE).
- `estado`: VARCHAR(20) NOT NULL CHECK (estado IN ('Presente', 'Ausente', 'Justificado')).
- `justificacion_id`: UUID (FK -> justificaciones.id NULLABLE).
- `hora_marcado`: TIMESTAMPTZ DEFAULT NOW().
- `marcado_por`: UUID (FK -> usuarios_sistema).
- UNIQUE(`evento_id`, `integrante_id`).

### 2.5 Tabla: `justificaciones`
- `id`: UUID (Primary Key).
- `integrante_id`: UUID NOT NULL (FK -> integrantes.id).
- `evento_id`: UUID NOT NULL (FK -> eventos.id).
- `motivo`: TEXT NOT NULL.
- `archivo_adjunto_url`: TEXT (Foto de justificativo o pantallazo en Storage).
- `estado`: VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado')).
- `canal_ingreso`: VARCHAR(20) NOT NULL CHECK (canal_ingreso IN ('Secretaria_Manual', 'Link_Autoservicio')).
- `aprobado_por`: UUID (FK -> usuarios_sistema NULLABLE).
- `fecha_resolucion`: TIMESTAMPTZ.

### 2.6 Tabla: `cartas_correspondencia` (Libro de Cartas)
- `id`: UUID (Primary Key).
- `tipo_flujo`: VARCHAR(20) NOT NULL CHECK (tipo_flujo IN ('Recibida', 'Emitida')).
- `folio`: VARCHAR(50) (Ej: `REC-2026-001` o correlativo formal).
- `remitente_destinatario`: VARCHAR(150) NOT NULL.
- `asunto`: VARCHAR(255) NOT NULL.
- `descripcion`: TEXT.
- `fecha_documento`: DATE NOT NULL.
- `archivo_adjunto_url`: TEXT (Foto física o PDF formal en Storage).
- `estado`: VARCHAR(30) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aceptada', 'Rechazada', 'Archivada')).
- `evento_asociado_id`: UUID (FK -> eventos.id NULLABLE, por si se derivó un evento de la carta).
- `created_at`: TIMESTAMPTZ DEFAULT NOW().

### 2.7 Tabla: `lecturas_directiva` (Acuse de Recibo Directiva)
Registra quiénes de la directiva ya revisaron una carta o justificativo.
- `id`: UUID (Primary Key).
- `recurso_tipo`: VARCHAR(30) NOT NULL CHECK (recurso_tipo IN ('Carta', 'Justificacion', 'Acta')).
- `recurso_id`: UUID NOT NULL.
- `usuario_id`: UUID NOT NULL (FK -> usuarios_sistema).
- `leido_at`: TIMESTAMPTZ DEFAULT NOW().
- UNIQUE(`recurso_tipo`, `recurso_id`, `usuario_id`).

### 2.8 Tabla: `actas` (Libro de Actas de Reunión)
- `id`: UUID (Primary Key).
- `evento_id`: UUID (FK -> eventos.id NULLABLE).
- `fecha_reunion`: DATE NOT NULL.
- `titulo`: VARCHAR(200) NOT NULL.
- `temas_tratados`: TEXT.
- `acuerdos`: TEXT NOT NULL.
- `foto_manuscrita_url`: TEXT (Foto del acta física si fue escrita a mano).
- `estado_cierre`: VARCHAR(20) DEFAULT 'Borrador' CHECK (estado_cierre IN ('Borrador', 'Cerrada', 'En_Solicitud_Edicion')).
- `version`: INT DEFAULT 1.
- `contenido_anterior_backup`: JSONB (Copia de seguridad válida por 30 días para deshacer cambios).
- `solicitud_edicion_aprobada_presidente`: BOOLEAN DEFAULT FALSE.
- `solicitud_edicion_aprobada_secretaria`: BOOLEAN DEFAULT FALSE.
- `created_at`, `updated_at`: TIMESTAMPTZ.

---

*Esquema optimizado para integridad referencial, queries de alta velocidad y cero duplicados.*
