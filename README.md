# Hacki - chatbot de la carrera de Ciencia de Datos e IA (IES N° 6, Perico)

Hacki es un chat flotante que responde preguntas sobre la Tecnicatura Superior en Ciencia de Datos e Inteligencia Artificial.
Primero busca la respuesta en las preguntas frecuentes (gratis e instantáneo) y, si no la encuentra, consulta a un modelo de IA que
responde **solo** con la información de este repositorio.

## Cómo está armado

| Archivo | Para qué sirve |
|---|---|
| `public/widget.js` | El chat que se ve en pantalla (burbuja arrastrable, avatar con estados dinámicos, sonidos, voz, modo oscuro). |
| `public/avatars/` | Sprites e imágenes de Hacki según el estado (pensando, activo, desconectado, voz, etc.). |
| `public/faq.json` | **Las preguntas y respuestas.** Es la única fuente: la leen el chat y la IA. |
| `conocimiento_carrera.md` | Información completa de la carrera. La IA la usa cuando la FAQ no alcanza. |
| `api/chat.js` | Servidor del chat: valida el pedido, limita el uso y consulta a la IA. |
| `api/preguntas.js` | Lista (protegida con clave) las preguntas que Hacki no supo responder. |
| `public/index.html` | Página de prueba. |
| `vercel.json` | Configuración de Vercel (archivos que usa la función y cabeceras de seguridad). |

## Cómo actualizar las respuestas

Editá `public/faq.json`. Cada entrada tiene este formato:

```json
{
 "q": "¿Quién es el coordinador de la carrera?",
 "a": "El coordinador de la carrera es Torres Federico.",
 "kw": "coordinador coordinadora coordina autoridad responsable",
 "s": 15
}
```

- `q`: la pregunta tal como se muestra en los botones sugeridos.
- `a`: la respuesta. Los links (`https://...` o dominios `.edu.ar`) se vuelven clickeables.
- `kw`: palabras clave sueltas, en minúscula y sin tildes, separadas por espacios. Es lo que usa Hacki para reconocer la pregunta
  (tolera errores de tipeo). Agregá sinónimos.
- `s` (opcional): si lo ponés, la pregunta se ofrece como sugerencia; los números chicos aparecen primero.
- `sd` (opcional, poné `1`): marca una respuesta que todavía no tiene el dato completo, así queda registrado cuántas personas la piden.

Reglas del formato JSON: comillas dobles siempre, una coma entre entradas (y ninguna después de la última) y los saltos de línea
dentro de una respuesta se escriben `\n`. Después de editar, abrí `https://TU-DOMINIO/faq.json` en el navegador: si se ve el texto, el
formato está bien. Los cambios tardan hasta 5 minutos en verse.

Si cambia un dato importante (costos, fechas, coordinador), actualizalo también en `conocimiento_carrera.md` para que la IA no use el valor viejo.

## Cómo ponerlo en otra página

Pegá esto antes de `</body>`:

```html
<script src="https://andresito-seven.vercel.app/widget.js" data-color="#0066ff" defer></script>
```

Atributos opcionales:

| Atributo | Qué hace | Ejemplo |
|---|---|---|
| `data-color` | Color principal | `#0066ff` |
| `data-nombre` | Nombre del asistente | `Hacki` |
| `data-posicion` | Posición inicial de la burbuja | `izquierda` |
| `data-icono` | Imagen propia para la burbuja | `https://.../logo.png` |
| `data-api` | Dirección de `api/chat` si es otra | `https://.../api/chat` |
| `data-faq` | Dirección del `faq.json` si es otro | `https://.../faq.json` |

Para que funcione en un sitio que no sea el de Vercel, agregá su dirección (por ejemplo `https://www.dominio-del-instituto.edu.ar`)
en la variable `ALLOWED_ORIGINS` de Vercel y hacé un Redeploy.

## Despliegue en Vercel

1. Importá el repositorio. **Root Directory vacío** (si dice `public`, la carpeta `api` no se despliega y el chat da error 404).
2. En *Settings > Environment Variables* cargá:

| Variable | Obligatoria | Qué es |
|---|---|---|
| `IA_KEY` | Sí | Clave de la IA (Groq u otro proveedor compatible con OpenAI). |
| `IA_MODELO` | No | Uno o varios modelos separados por coma; si el primero no existe, prueba el siguiente. |
| `IA_URL` | No | Endpoint del proveedor. Por defecto, Groq. |
| `ALLOWED_ORIGINS` | No | Sitios externos autorizados, separados por coma. |
| `LIMITE_IP_HORA` / `LIMITE_DIA` | No | Mensajes por IP por hora (20) y totales por día (500). |
| `ADMIN_KEY` | Para `/api/preguntas` | Clave larga para ver las preguntas sin respuesta. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Recomendadas | Base gratuita (Upstash) para límites confiables y para guardar las preguntas sin respuesta. |

3. Hacé un Redeploy después de cambiar variables.
4. Verificación: `https://TU-DOMINIO/api/chat` debe mostrar `{"error":"Método no permitido."}` y, en *Logs*, la línea `[INFO] base de conocimiento: ...`
   debe mostrar números mayores a cero (si dice 0, la función no está leyendo los archivos).

## Mejorar con el uso

Entrá a `https://TU-DOMINIO/api/preguntas?clave=TU_ADMIN_KEY`: muestra las preguntas que no tuvieron respuesta en la FAQ, agrupadas por
cantidad. Pasá las más repetidas a `public/faq.json`. Se guardan sin IP y con correos, teléfonos, números largos y links reemplazados.
No se detectan nombres propios.

## Mantenimiento

- **La clave de la IA puede vencer.** Si el chat deja de usar la IA, revisá la fecha de vencimiento en el panel del proveedor y generá otra clave.
- **Los modelos gratuitos cambian de nombre.** Si en *Logs* aparece `IA respondió 404`, actualizá `IA_MODELO` con un modelo vigente.
- **Seguridad:** la clave vive solo en variables de entorno, el chat limita el uso por IP, valida el origen y no guarda datos personales.
  Activá la verificación en dos pasos en GitHub y Vercel: quien controle el repositorio controla el código que corre en las páginas donde se inserte el chat.
