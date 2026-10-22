// Muestra las preguntas que el chatbot no pudo responder con las FAQ (para ampliarlas).
// Uso: https://TU-DOMINIO/api/preguntas?clave=TU_ADMIN_KEY   (agregá &formato=json para ver el JSON)
// Variables: ADMIN_KEY (obligatoria), UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN.
// Sin Upstash, las preguntas igual quedan en los logs de Vercel con el prefijo [PREGUNTA] (retención corta).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BUSCAR_DIRS = [path.resolve(__dirname, ".."), process.cwd(), __dirname];
for (const dir of BUSCAR_DIRS) {
  try {
    const envFile = path.join(dir, ".env");
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[k]) process.env[k] = v;
        }
      }
      break;
    }
  } catch (e) {}
}

const fallos = new Map();

function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const K = process.env.ADMIN_KEY;
  if (!K) return res.status(503).send("Falta configurar ADMIN_KEY.");

  const ip = String(req.headers["x-real-ip"] || (req.headers["x-forwarded-for"] || "").split(",")[0] || "?").trim();
  const n = fallos.get(ip) || { c: 0, v: Date.now() + 3600000 };
  if (n.v < Date.now()) { n.c = 0; n.v = Date.now() + 3600000; }
  if (n.c >= 10) return res.status(429).send("Demasiados intentos.");

  const dado = Buffer.from(String(req.query.clave || req.headers["x-admin-key"] || "")), real = Buffer.from(K);
  if (dado.length !== real.length || !crypto.timingSafeEqual(dado, real)) {
    n.c++; fallos.set(ip, n); if (fallos.size > 1000) fallos.clear();
    return res.status(401).send("No autorizado.");
  }

  const U = process.env.UPSTASH_REDIS_REST_URL, T = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!U || !T) return res.status(200).send("Upstash no está configurado. Buscá [PREGUNTA] en los logs de Vercel.");
  let items = [];
  try {
    const r = await fetch(U + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + T, "Content-Type": "application/json" }, body: JSON.stringify([["LRANGE", "chat:preguntas", 0, 299]]) });
    const d = await r.json();
    items = (d[0].result || []).map(function (x) { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return res.status(502).send("No se pudo leer el registro."); }

  // Agrupa preguntas repetidas
  const grupos = {};
  items.forEach(function (it) {
    const k = it.q.toLowerCase();
    if (!grupos[k]) grupos[k] = { q: it.q, n: 0, e: {}, ultima: it.f };
    grupos[k].n++; grupos[k].e[it.e] = 1;
  });
  const lista = Object.keys(grupos).map(function (k) { return grupos[k]; }).sort(function (a, b) { return b.n - a.n; });

  if (req.query.formato === "json") return res.status(200).json(lista);
  const filas = lista.map(function (g) { return "<tr><td>" + g.n + "</td><td>" + esc(g.q) + "</td><td>" + esc(Object.keys(g.e).join(", ")) + "</td><td>" + esc(g.ultima) + "</td></tr>"; }).join("");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preguntas sin respuesta</title>' +
    '<style>body{font-family:system-ui,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f0f0f0}</style>' +
    "<h1>Preguntas sin respuesta (" + items.length + ")</h1><p>e = faq_sin_dato (FAQ sin información), sin_dato (la IA no supo), ia (la respondió la IA), error_ia (falló la IA).</p>" +
    "<table><tr><th>Veces</th><th>Pregunta</th><th>Estado</th><th>Última vez</th></tr>" + filas + "</table>");
};
