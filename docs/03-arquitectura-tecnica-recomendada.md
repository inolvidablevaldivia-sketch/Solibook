# Solibook — Arquitectura de Software y Stack Tecnológico Recomendado

**Ministerio Vocal "Solí Deo"**  
**Fecha:** 2026-09-18  
**Tipo de Aplicación:** PWA (Progressive Web App) Mobile-First + Consola Desktop  
**Restricción de Presupuesto:** Nivel gratuito 100% permanente (Free-Tier), producción profesional.  
**Estado:** Documento de Planificación (Fase 1)

---

## 1. La Gran Decisión de Arquitectura: ¿Flutter Web vs. Stack Web Moderno (Next.js / Vite PWA)?

El informe de lecciones aprendidas de tu app anterior es oro puro:
- Flutter Web con CanvasKit/WASM es potente, pero en web pura sufre de:
  - Descarga inicial pesada (~15-25 MB de binarios CanvasKit/Skwasm).
  - Tiempo de arranque lento en celulares de gama media/baja con 3G/4G inestable.
  - El renderizado tipo "canvas" a veces complica la selección de texto fluida en tablas grandes y la impresión limpia de PDFs nativos del navegador.
- **Veredicto Recomendado para Solibook:**
  - **Frontend:** **Next.js (App Router) o React + Vite PWA con Tailwind CSS**.
  - **Razón:** Carga en milisegundos (< 1.5 segundos en 3G), renderizado HTML/CSS semántico nativo (perfecto para la "Súper Grilla" tipo Excel, para imprimir con `window.print()` sin pelear con Canvas, y accesibilidad táctil 100% natural).
  - PWA nativa con `@serwist/next` o `vite-plugin-pwa` (Workbox moderno) configurando *Network-First* con *fallback offline* y botón de *skipWaiting* para limpiar caché.

---

## 2. El Stack Tecnológico 100% Gratuito y de Nivel Profesional

| Capa | Tecnología Seleccionada | Justificación y Nivel Gratuito (Free-Tier) |
|---|---|---|
| **Frontend / PWA** | **Next.js 15 / React 19 + Tailwind CSS** | Rápido, responsive extremo, componentes estilizados sin sobrecarga. Hospedado gratis en **Vercel** o **Cloudflare Pages**. |
| **Diseño / Iconos** | **Lucide Icons (trazo 1.5px)** | Cero emojis. Iconos de línea fina, ultra profesionales, sobrios y consistentes. |
| **Base de Datos & Auth** | **Supabase (PostgreSQL 16)** | Nivel gratuito generoso (500 MB de base de datos relacional con backups automáticos, 50,000 usuarios activos al mes). Auth con Google OAuth integrado sin configuraciones engorrosas de tokens en cliente. Row Level Security (RLS) para permisos reales en la base de datos. |
| **Almacenamiento de Archivos** | **Supabase Storage** (1 GB gratis) | Buckets dedicados (`cartas`, `actas`, `justificativos`). Compresión en cliente antes de subir (vía canvas/browser-image-compression a ~200 KB por imagen). |
| **Modo Offline & Cache** | **IndexedDB + TanStack Query (Persister)** | Estrategia de sincronización transparente: si no hay conexión, las lecturas y borradores se guardan en IndexedDB local del navegador y se suben al recuperar señal. |
| **Exportación Excel & PDF** | **SheetJS (xlsx) + `@react-pdf/renderer`** | Generación en cliente sin consumir servidor: descarga de Excel real con pestañas y generación de PDF formal con el logo vectorial de Solí Deo. |
| **IA (Transcripción Futura - V2)**| **Google Gemini 2.5 Flash vía Google AI Studio** | 15 peticiones por minuto 100% gratis con prompts estructurados para extracción JSON de actas y fotos. |

---

## 3. Matriz de Lecciones Aprendidas Aplicada a Solibook

Basado en tu experiencia previa con obsolescencias:

1. **Google Auth con FedCM (Obligatorio 2025/2026):**
   - Supabase Auth maneja nativamente los flujos modernos de Google Identity Services compatibles con FedCM y el bloqueo de cookies de terceros en Chrome y Safari.
2. **Cero Secretos en el Cliente:**
   - La `anon_key` de Supabase es pública por diseño y está blindada por las políticas de **Row Level Security (RLS)** de PostgreSQL. Las claves maestras (`service_role`) jamás tocan el código del cliente.
3. **Caché agresivo de PWA solucionado:**
   - Implementación de un botón en la barra superior/configuraciones: `window.location.reload(true)` y desregistro forzado del Service Worker para garantizar que la última versión baje al instante.
4. **Almacenamiento y CORS:**
   - Subida directa a Storage con políticas CORS habilitadas desde el panel, almacenando únicamente URLs públicas o firmadas, nunca rutas locales que se rompen al reiniciar el dispositivo.

---

*Arquitectura aprobada para proceder al Modelo de Base de Datos y Wireframes.*
