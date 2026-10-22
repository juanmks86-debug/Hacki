# Hacki - Asistente Virtual del Ecosistema de Eventos Emprendedores
### Municipalidad de San Salvador de Jujuy

Hacki es un asistente virtual flotante (widget) que responde consultas ciudadanas sobre ferias, capacitaciones, talleres, sedes municipales y trámites para emprendedores locales.

Funciona en dos niveles:
1. **Nivel 1 (Gratis e instantáneo):** Resuelve de inmediato en el navegador consultando la cartelera de eventos (`public/eventos.json`) y preguntas frecuentes (`public/faq.json`).
2. **Nivel 2 (Inteligencia Artificial):** Si la consulta no tiene coincidencia exacta en las FAQ, consulta a un modelo de IA (Groq / OpenAI compatible) alimentado estrictamente con `conocimiento_ecosistema.md`, `faq.json` y `eventos.json`.

---

## Estructura del Proyecto

| Archivo / Carpeta | Descripción |
|---|---|
| `public/widget.js` | Widget cliente (burbuja arrastrable, selector de avatar dinámico, reconocimiento y síntesis de voz, modo oscuro). |
| `public/avatars/` | Sprites e imágenes de Hacki para cada estado (`default`, `thinking`, `active`, `offline`, `busy`, `voice`). |
| `public/eventos.json` | Cartelera de eventos, ferias, talleres, sedes, horarios y enlaces directos de inscripción. |
| `public/faq.json` | Preguntas frecuentes oficiales categorizadas con enlaces directos. |
| `conocimiento_ecosistema.md` | Base de conocimiento integral sobre sedes (Club de Emprendedores, CPVs, NIDOs), marco municipal y trámites. |
| `api/chat.js` | Endpoint serverless: Rate limiting, prompt guarding y consulta al LLM. |
| `api/preguntas.js` | Panel de auditoría protegido con clave para revisar consultas no resueltas. |
| `public/index.html` | Página de prueba local. |
| `vercel.json` | Configuración de empaquetado para Vercel y cabeceras de seguridad. |
| `.env` | Variables de entorno locales (clave `IA_KEY`, etc.). |

---

## Configuración de la API Key de la IA

Para que Hacki responda preguntas abiertas mediante IA:

### 1. Pruebas Locales:
Creá o editá el archivo `.env` en la raíz del proyecto y colocá tu clave:
```ini
IA_KEY=gsk_tu_clave_de_groq_aqui
IA_URL=https://api.groq.com/openai/v1/chat/completions
IA_MODELO=llama-3.3-70b-versatile,openai/gpt-oss-20b,llama-3.1-8b-instant
```
> [!TIP]
> Podés obtener una clave gratuita y de alta velocidad en [Groq Cloud Console](https://console.groq.com/keys).

### 2. Despliegue en Vercel:
En tu proyecto de Vercel ve a **Settings > Environment Variables** y cargá:
- `IA_KEY`: Tu clave de API (ej. de Groq).
- `ALLOWED_ORIGINS` (opcional): Sitios web autorizados a incrustar el chat (ej. `https://munissj.gob.ar`).
- `ADMIN_KEY` (opcional): Clave secreta para acceder al panel de `/api/preguntas`.

---

## Cómo incrustar el Widget en cualquier página web

Agregá este script antes de la etiqueta de cierre `</body>`:

```html
<script src="https://TU-DOMINIO.vercel.app/widget.js" data-color="#0066ff" defer></script>
```

### Atributos opcionales:
- `data-nombre`: Nombre del asistente (por defecto `Hacki`).
- `data-color`: Color principal de la interfaz (ej. `#0066ff`).
- `data-posicion`: `izquierda` o `derecha` (por defecto `derecha`).
- `data-faq`: Ruta alternativa a `faq.json`.
- `data-eventos`: Ruta alternativa a `eventos.json`.
