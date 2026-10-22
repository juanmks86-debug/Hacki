/* Hacki - chatbot de la carrera. Se integra con:
   <script src="https://TU-DOMINIO/widget.js" data-color="#0066ff" defer></script>
   Atributos opcionales: data-nombre, data-posicion="izquierda", data-icono, data-api, data-faq. Ver README.md */
(function () {
  var script = document.currentScript;
  var color = script.dataset.color || "#0066ff";
  var izq = script.dataset.posicion === "izquierda";
  var icono = script.dataset.icono || ""; // URL opcional de una imagen para el ícono de la burbuja
  var nombre = script.dataset.nombre || "Hacki";
  var origen = new URL(script.src).origin;
  var api = script.dataset.api || origen + "/api/chat";
  var faqUrl = script.dataset.faq || origen + "/faq.json";
  var historial = [], vozActiva = false, preguntadas = {}, rec = null, ocupado = false, FAQ = [];

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function escribir(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ---- Búsqueda en las FAQ (tolerante a errores de tipeo) ----
  function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " "); }
  var VACIAS = " que hay entre como para cual cuale por una uno los las del con mas esta esto ano carre cuant ";
  function stem(w) { return w.slice(0, 5); }
  function utiles(s) { return norm(s).split(/\s+/).filter(function (w) { return w.length > 2 && VACIAS.indexOf(" " + stem(w) + " ") < 0 && !cerca(w, "carrera"); }); }
  function lev(a, b) {
    var p = [], i, j;
    for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) {
      var prev = p[0]; p[0] = i;
      for (j = 1; j <= b.length; j++) { var t = p[j]; p[j] = Math.min(p[j] + 1, p[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
    }
    return p[b.length];
  }
  function cerca(a, b) {
    if (stem(a) === stem(b)) return true;
    if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 2) return false;
    return lev(a, b) <= (Math.max(a.length, b.length) >= 9 ? 2 : 1);
  }
  function prepararFAQ(lista) {
    FAQ = lista.filter(function (f) { return f && typeof f.q === "string" && typeof f.a === "string"; })
      .map(function (f, i) { f.i = i; f.pal = utiles(f.kw || f.q); return f; });
  }
  function buscar(t) {
    var nt = norm(t).replace(/\s+/g, " ").trim();
    for (var i = 0; i < FAQ.length; i++) if (norm(FAQ[i].q).replace(/\s+/g, " ").trim() === nt) return FAQ[i];
    var qs = utiles(t), mejor = null, max = 0;
    FAQ.forEach(function (f) {
      var p = qs.filter(function (w) { return f.pal.some(function (k) { return cerca(w, k); }); }).length;
      if (p > max) { max = p; mejor = f; }
    });
    if (max === 0 || (max === 1 && qs.length > 1) || (max >= 2 && max / qs.length < 0.5)) return null;
    return mejor;
  }
  var AYUDA = " Preguntame por materias, duración, horarios, requisitos de ingreso o salida laboral.";
  function charla(t) {
    var n = norm(t).replace(/\s+/g, " ").trim();
    if (!n) return null;
    if (n.replace(/\b(hola|holis|buenas|buenos|dias|tardes|noches|buen|dia|hey|que|tal|como|estas|andas|todo|bien)\b/g, "").trim() === "") return "¡Hola! Soy " + nombre + ", el asistente de la carrera." + AYUDA;
    if (/^(muchas )?gracias\b|^(genial|perfecto|ok|dale|listo|excelente)$/.test(n)) return "¡De nada! Si tenés otra duda sobre la carrera, preguntame.";
    if (/^(chau|adios|hasta luego|nos vemos)\b/.test(n)) return "¡Hasta luego! Cualquier duda sobre la carrera, acá estoy.";
    return null;
  }

  // ---- Interfaz y Sprite de Avatares ----
  var host = document.createElement("div");
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    "<style>:host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}" +
    "button:focus-visible,input:focus-visible{outline:2px solid #ffb300;outline-offset:2px}" +
    ".b{position:fixed;left:0;top:0;width:58px;height:58px;border-radius:50%;border:0;padding:0;background:linear-gradient(145deg," + color + ",#111a 140%);background-color:" + color + ";color:#fff;cursor:grab;box-shadow:0 6px 16px #0004;z-index:2147483647;touch-action:none;user-select:none;-webkit-user-select:none;display:flex;align-items:center;justify-content:center;transition:transform .15s}" +
    ".b.s{transition:left .25s ease,top .25s ease,transform .15s}.b:hover{transform:scale(1.07)}.b.d{cursor:grabbing;transform:scale(1.12);box-shadow:0 10px 24px #0006}.b.oc{display:none}" +
    ".b.n::after{content:'';position:absolute;inset:-5px;border-radius:50%;border:2px solid " + color + ";animation:ring 1.8s ease-out infinite;pointer-events:none}@keyframes ring{0%{transform:scale(.9);opacity:.8}100%{transform:scale(1.35);opacity:0}}" +
    
    /* Estilos para el Sprite de avatares */
    ".avatar-sprite{width:100%;height:100%;border-radius:50%;background-image:url('" + origen + "/avatars/sprite.png');background-size:600% 100%;background-repeat:no-repeat;pointer-events:none;transition:background-position 0.25s ease}" +
    ".avatar-sprite.default{background-position:0% 0%}" +
    ".avatar-sprite.thinking{background-position:20% 0%}" +
    ".avatar-sprite.active{background-position:40% 0%}" +
    ".avatar-sprite.offline{background-position:60% 0%}" +
    ".avatar-sprite.busy{background-position:80% 0%}" +
    ".avatar-sprite.voice{background-position:100% 0%}" +
    
    ".tip{position:fixed;left:0;top:0;background:#fff;color:#111;border-radius:14px;box-shadow:0 6px 22px #0004;padding:10px 30px 10px 12px;font-size:13px;line-height:1.35;cursor:pointer;opacity:0;pointer-events:none;transform:translateY(6px);transition:opacity .25s,transform .25s;z-index:2147483646}" +
    ".tip.v{opacity:1;pointer-events:auto;transform:none}.tip button{position:absolute;top:2px;right:4px;border:0;background:none;color:#777;font-size:14px;cursor:pointer;padding:4px}" +
    ".p{position:fixed;left:0;top:0;background:#fff;color:#111;border-radius:16px;box-shadow:0 10px 36px #0006;display:none;flex-direction:column;overflow:hidden;z-index:2147483647}.p.o{display:flex;animation:ent .22s ease-out}@keyframes ent{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}" +
    ".h{background:linear-gradient(135deg," + color + ",#0007 220%);background-color:" + color + ";color:#fff;padding:10px 12px;display:flex;align-items:center;gap:10px}" +
    ".av{width:38px;height:38px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden}" +
    ".ti{flex:1;min-width:0;display:flex;flex-direction:column}.ti b{font-size:15px;line-height:1.2}.ti small{font-size:11px;opacity:.9;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ti i{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block}" +
    ".ac{display:flex}.ac button{background:none;border:0;color:#fff;font-size:17px;cursor:pointer;padding:5px 6px;border-radius:8px}.ac button:hover{background:#fff2}#v[aria-pressed=false]{opacity:.55}" +
    ".m{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f3f4f7;scroll-behavior:smooth}" +
    ".g{max-width:85%;padding:9px 13px;border-radius:16px;font-size:14px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;animation:pop .18s ease-out}@keyframes pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
    ".u{align-self:flex-end;background:" + color + ";color:#fff;border-bottom-right-radius:5px}.a{align-self:flex-start;background:#fff;border:1px solid #e1e3e8;border-bottom-left-radius:5px}.g a{color:inherit;text-decoration:underline}" +
    ".nt{align-self:center;text-align:center;font-size:11px;line-height:1.35;color:#6b7280;max-width:92%}" +
    ".t{display:flex;gap:4px;align-items:center;padding:13px}.t i{width:6px;height:6px;border-radius:50%;background:#888;animation:z 1s infinite}.t i:nth-child(2){animation-delay:.15s}.t i:nth-child(3){animation-delay:.3s}@keyframes z{0%,80%,100%{opacity:.3}40%{opacity:1}}" +
    ".c{align-self:flex-start;display:flex;flex-wrap:wrap;gap:6px}.c button{border:1px solid " + color + ";background:#fff;color:" + color + ";border-radius:14px;padding:6px 11px;font-size:12px;cursor:pointer;transition:background .15s}.c button:hover{background:" + color + "18}" +
    ".st{font-size:12px;color:#444;padding:6px 12px;background:#fff;border-top:1px solid #e1e3e8}.st:empty{display:none}" +
    ".f{display:flex;gap:6px;padding:10px;border-top:1px solid #e1e3e8;background:#fff}.f input{flex:1;min-width:0;padding:9px 12px;border:1px solid #ccc;border-radius:20px;font-size:16px;background:#fff;color:#111}" +
    ".f button{border:0;border-radius:50%;width:40px;height:40px;background:" + color + ";color:#fff;cursor:pointer;font-size:16px}.f button.on{background:#d93025;animation:y 1s infinite}@keyframes y{50%{opacity:.6}}" +
    "@media (prefers-color-scheme:dark){.p,.tip{background:#1c1d22;color:#eceef2}.m{background:#15161a}.a{background:#25272e;border-color:#353842;color:#eceef2}.f,.st{background:#1c1d22;border-color:#353842;color:#c9ccd3}.f input{background:#25272e;color:#eceef2;border-color:#3b3e48}.c button{background:#1c1d22;color:#9ec1ff;border-color:#9ec1ff}.nt{color:#9aa0ab}}" +
    "@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}</style>" +
    '<button class="b n" aria-expanded="false"><div class="avatar-sprite default"></div></button>' +
    '<div class="tip" role="status"><span id="tt"></span><button id="tx" aria-label="Cerrar sugerencia">✕</button></div>' +
    '<div class="p" role="dialog"><div class="h"><div class="av"><div class="avatar-sprite default"></div></div><div class="ti"><b id="nom"></b><small><i></i>Asistente de la carrera</small></div><span class="ac">' +
    '<button id="snd" aria-label="Sonidos del chat">🔔</button>' +
    '<button id="v" title="Leer respuestas en voz alta" aria-label="Leer respuestas en voz alta" aria-pressed="false">🗣</button>' +
    '<button id="r" title="Nueva conversación" aria-label="Nueva conversación">↺</button>' +
    '<button id="x" title="Cerrar" aria-label="Cerrar chat">✕</button></span></div>' +
    '<div class="m" role="log" aria-live="polite" aria-relevant="additions"></div><div class="st" role="status"></div>' +
    '<div class="f"><input aria-label="Escribí tu pregunta" placeholder="Escribí tu pregunta..." maxlength="300" autocomplete="off">' +
    '<button id="mic" title="Hablar" aria-label="Preguntar con la voz" aria-pressed="false">🎤</button><button id="s" aria-label="Enviar pregunta">➤</button></div></div>';

  var $ = function (s) { return root.querySelector(s); };
  var panel = $(".p"), msgs = $(".m"), input = $("input"), st = $(".st"), bub = $(".b"), tip = $(".tip");
  $("#nom").textContent = nombre;
  $("#tt").textContent = "👋 ¡Hola! Soy " + nombre + ". ¿Te ayudo con la carrera?";
  panel.setAttribute("aria-label", "Chat con " + nombre);
  bub.setAttribute("aria-label", "Abrir chat con " + nombre);
  if (leer("chatbot_visto")) bub.classList.remove("n");
  function estado(t) { st.textContent = t || ""; }

  // ---- Función para cambiar dinámicamente el estado del sprite ----
  var avatarTimer = null;
  function cambiarEstadoSprite(estadoKey, duracionMs) {
    clearTimeout(avatarTimer);
    var avatares = root.querySelectorAll(".avatar-sprite");
    for (var i = 0; i < avatares.length; i++) {
      avatares[i].className = "avatar-sprite " + (estadoKey || "default");
    }
    if (duracionMs) {
      avatarTimer = setTimeout(function () {
        cambiarEstadoSprite("default");
      }, duracionMs);
    }
  }

  // ---- Sonidos (generados con Web Audio, sin archivos) ----
  var AC = null, sonidoOn = leer("chatbot_sonido") !== "0";
  var SONIDOS = {
    abrir: [[523, 0, .12], [784, .09, .2]], cerrar: [[659, 0, .1], [440, .08, .18]],
    enviar: [[660, 0, .07]], recibir: [[880, 0, .1], [1175, .08, .18]],
    mic: [[740, 0, .08], [988, .07, .12]], micFin: [[988, 0, .08], [740, .07, .12]],
    error: [[330, 0, .12], [247, .1, .2]], soltar: [[420, 0, .06]], reset: [[587, 0, .07], [440, .06, .12]]
  };
  function audio() {
    if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
    if (AC.state === "suspended") AC.resume();
    return AC;
  }
  function sonar(nombreSonido) {
    if (!sonidoOn || document.hidden) return;
    var a = audio(), notas = SONIDOS[nombreSonido];
    if (!a || !notas) return;
    var t0 = a.currentTime;
    notas.forEach(function (n) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = n[0];
      g.gain.setValueAtTime(0.0001, t0 + n[1]);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + n[1] + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
      o.connect(g); g.connect(a.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + 0.03);
    });
  }
  function pintarSonido() {
    var b = $("#snd"); b.textContent = sonidoOn ? "🔔" : "🔕";
    b.setAttribute("aria-pressed", sonidoOn ? "true" : "false"); b.title = sonidoOn ? "Silenciar sonidos" : "Activar sonidos";
  }
  pintarSonido();
  $("#snd").onclick = function () { sonidoOn = !sonidoOn; escribir("chatbot_sonido", sonidoOn ? "1" : "0"); pintarSonido(); sonar("recibir"); };

  // ---- Mensajes ----
  var URLRE = /(https?:\/\/[^\s)]+|\b(?:[a-z0-9-]+\.)+(?:edu|gob)\.ar\b)/gi;
  function contenido(el, txt) { 
    el.textContent = ""; var ult = 0, m; URLRE.lastIndex = 0;
    while ((m = URLRE.exec(txt))) {
      var u = m[0].replace(/[.,;:!?]+$/, "");
      if (m.index > ult) el.appendChild(document.createTextNode(txt.slice(ult, m.index)));
      var a = document.createElement("a"); a.href = /^https?:/i.test(u) ? u : "https://" + u;
      a.textContent = u; a.target = "_blank"; a.rel = "noopener noreferrer"; el.appendChild(a);
      ult = m.index + u.length; URLRE.lastIndex = ult;
    }
    if (ult < txt.length) el.appendChild(document.createTextNode(txt.slice(ult)));
  }
  function agregar(txt, cls) {
    var d = document.createElement("div");
    d.className = cls === "nt" ? "nt" : "g " + cls;
    if (cls === "a") contenido(d, txt); else d.textContent = txt;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  function escribiendo() {
    var d = document.createElement("div");
    d.className = "g a t"; d.setAttribute("role", "status"); d.setAttribute("aria-label", "Escribiendo…");
    d.innerHTML = "<i></i><i></i><i></i>";
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  function quitarChips() { Array.prototype.forEach.call(msgs.querySelectorAll(".c"), function (c) { c.remove(); }); }
  function chips(lista) {
    quitarChips();
    if (!lista.length) return;
    var c = document.createElement("div"); c.className = "c";
    lista.forEach(function (f) {
      var b = document.createElement("button"); b.textContent = f.q;
      b.onclick = function () { input.value = f.q; enviar(); };
      c.appendChild(b);
    });
    msgs.appendChild(c); msgs.scrollTop = msgs.scrollHeight;
  }
  function sugerencias(n) { 
    return FAQ.filter(function (f) { return f.s && !preguntadas[f.i]; }).sort(function (a, b) { return a.s - b.s; }).slice(0, n || 3);
  }
  function bienvenida() {
    agregar("¡Hola! Soy " + nombre + " 👋, tu chatbot de JujuyTech. ¿En qué te puedo ayudar?", "a");
    agregar("Mis respuestas son orientativas: para trámites consultá en tu Municipio. Las preguntas que no sé responder se guardan sin datos personales para mejorar.", "nt");
    chips(sugerencias(4));
  }
  bienvenida();
  fetch(faqUrl, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (l) {
    prepararFAQ(Array.isArray(l) ? l : []);
    if (!msgs.querySelector(".u")) chips(sugerencias(4)); 
  });

  function responder(el, txt, guardarHist, sonido) {
    el.className = "g a"; el.removeAttribute("role"); el.removeAttribute("aria-label");
    contenido(el, txt);
    if (guardarHist) historial.push({ role: "assistant", content: txt });
    sonar(sonido || "recibir"); hablar(txt);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function pausa(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function enviar() {
    var t = input.value.trim();
    if (!t || ocupado) return;
    ocupado = true;
    input.value = ""; quitarChips(); agregar(t, "u"); sonar("enviar");
    
    // Cambia el avatar a estado pensando
    cambiarEstadoSprite("thinking");

    try {
      var sal = charla(t);
      if (sal) { 
        var e0 = agregar(sal, "a"); sonar("recibir"); hablar(sal); 
        cambiarEstadoSprite("active", 2500);
        chips(sugerencias()); return; 
      }
      var hit = buscar(t);
      historial.push({ role: "user", content: t });
      var el = escribiendo();
      if (hit) {
        await pausa(300);
        preguntadas[hit.i] = 1;
        responder(el, hit.a, true);
        cambiarEstadoSprite("active", 2500);

        if (hit.sd) fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrar: true, messages: [{ role: "user", content: t }] }) }).catch(function () {});
        chips(sugerencias());
        return;
      }
      try { 
        var r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: historial.slice(-6) }) });
        var d = await r.json();
        if (!d.reply) { var err = new Error(d.error); err.limite = r.status === 429; throw err; }
        responder(el, d.reply, true);
        cambiarEstadoSprite("active", 3500);
      } catch (e) {
        historial.pop();
        responder(el, e && e.limite ? e.message : "No tengo ese dato. Probá con alguna de estas preguntas o consultá en la secretaría del IES N° 6 de Perico.", false, "error");
        cambiarEstadoSprite("offline", 3500);
      }
      chips(sugerencias());
    } finally { ocupado = false; }
  }

  function hablar(txt) {
    if (!vozActiva || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(txt); u.lang = "es-AR"; speechSynthesis.speak(u);
  }

  // ---- Burbuja arrastrable ----
  var TAM = 58, M = 20, drag = null, arrastro = false;
  
  // Si el usuario especificó un data-icono tradicional, se respeta, sino usa el sprite por defecto
  if (icono) { 
    var im = document.createElement("img"); im.alt = ""; im.src = icono; bub.textContent = ""; bub.appendChild(im); 
  }

  function limitar(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function movil() { return window.innerWidth <= 520; }
  var pos = { lado: izq ? "l" : "r", y: 1 };
  try { var g = JSON.parse(leer("chatbot_pos")); if (g && (g.lado === "l" || g.lado === "r") && typeof g.y === "number") pos = { lado: g.lado, y: limitar(g.y, 0, 1) }; } catch (e) {}
  function aplicarPos() {
    var W = window.innerWidth, H = window.innerHeight;
    bub.style.left = (pos.lado === "l" ? M : W - TAM - M) + "px";
    bub.style.top = limitar(M + pos.y * (H - TAM - 2 * M), 0, H - TAM) + "px";
    bub.classList.toggle("oc", panel.classList.contains("o") && movil());
    posPanel(); posTip();
  }
  function posPanel() {
    var W = window.innerWidth, vv = window.visualViewport;
    if (movil()) { 
      var H2 = vv ? vv.height : window.innerHeight;
      panel.style.left = "8px"; panel.style.top = ((vv ? vv.offsetTop : 0) + 8) + "px";
      panel.style.width = (W - 16) + "px"; panel.style.height = (H2 - 16) + "px";
      return;
    }
    var H = window.innerHeight, pw = Math.min(370, W - 20), ph = Math.min(540, H - 110);
    var bl = parseFloat(bub.style.left), bt = parseFloat(bub.style.top);
    var l = (bl + TAM / 2 > W / 2) ? bl + TAM - pw : bl;
    var t = (bt - ph - 12 >= 10) ? bt - ph - 12 : bt + TAM + 12;
    panel.style.width = pw + "px"; panel.style.height = ph + "px";
    panel.style.left = limitar(l, 10, W - pw - 10) + "px";
    panel.style.top = Math.max(10, Math.min(t, H - ph - 10)) + "px";
  }
  
  var tipTimer = null;
  function posTip() {
    var W = window.innerWidth, tw = Math.min(240, W - 20);
    tip.style.width = tw + "px";
    var bl = parseFloat(bub.style.left), bt = parseFloat(bub.style.top), th = tip.offsetHeight || 52;
    tip.style.left = limitar((bl + TAM / 2 > W / 2) ? bl + TAM - tw : bl, 10, W - tw - 10) + "px";
    tip.style.top = (bt - th - 10 >= 10 ? bt - th - 10 : bt + TAM + 10) + "px";
  }
  function ocultarTip() { tip.classList.remove("v"); clearTimeout(tipTimer); }
  $("#tx").onclick = function (e) { e.stopPropagation(); ocultarTip(); };
  tip.onclick = function () { ocultarTip(); abrir(); };
  setTimeout(function () {
    var visto = null; try { visto = sessionStorage.getItem("chatbot_tip"); } catch (e) {}
    if (visto || panel.classList.contains("o")) return;
    posTip(); tip.classList.add("v"); tipTimer = setTimeout(ocultarTip, 12000);
    try { sessionStorage.setItem("chatbot_tip", "1"); } catch (e) {}
  }, 5000);

  bub.addEventListener("pointerdown", function (e) {
    if (e.button > 0) return;
    drag = { x: e.clientX, y: e.clientY, l: parseFloat(bub.style.left), t: parseFloat(bub.style.top), mov: false };
    bub.setPointerCapture(e.pointerId);
  });
  bub.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.mov) { if (Math.hypot(dx, dy) < 6) return; drag.mov = true; bub.classList.add("d"); bub.classList.remove("s"); ocultarTip(); }
    bub.style.left = limitar(drag.l + dx, 0, window.innerWidth - TAM) + "px";
    bub.style.top = limitar(drag.t + dy, 0, window.innerHeight - TAM) + "px";
    posPanel();
  });
  function soltar() {
    if (!drag) return;
    var mov = drag.mov; drag = null; bub.classList.remove("d");
    if (!mov) return;
    arrastro = true; setTimeout(function () { arrastro = false; }, 0);
    var W = window.innerWidth, H = window.innerHeight;
    pos.lado = (parseFloat(bub.style.left) + TAM / 2 < W / 2) ? "l" : "r";
    pos.y = limitar((parseFloat(bub.style.top) - M) / (H - TAM - 2 * M), 0, 1);
    bub.classList.add("s"); aplicarPos(); sonar("soltar");
    escribir("chatbot_pos", JSON.stringify(pos));
  }
  bub.addEventListener("pointerup", soltar);
  bub.addEventListener("pointercancel", soltar);
  window.addEventListener("resize", aplicarPos);
  if (window.visualViewport) { visualViewport.addEventListener("resize", posPanel); visualViewport.addEventListener("scroll", posPanel); }
  aplicarPos();

  function abrir() {
    ocultarTip(); bub.classList.remove("n"); escribir("chatbot_visto", "1");
    panel.classList.add("o"); bub.setAttribute("aria-expanded", "true");
    bub.classList.toggle("oc", movil()); posPanel(); input.focus(); sonar("abrir");
  }
  function cerrar() {
    panel.classList.remove("o"); bub.setAttribute("aria-expanded", "false"); bub.classList.remove("oc");
    if (rec) rec.abort();
    if (window.speechSynthesis) speechSynthesis.cancel();
    sonar("cerrar"); bub.focus();
  }
  bub.onclick = function () {
    if (arrastro) return; 
    if (panel.classList.contains("o")) cerrar(); else abrir();
  };
  $("#x").onclick = cerrar;
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrar(); });
  $("#s").onclick = enviar;
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") enviar(); });

  $("#r").onclick = function () {
    historial = []; preguntadas = {}; msgs.textContent = ""; estado("");
    cambiarEstadoSprite("default");
    if (window.speechSynthesis) speechSynthesis.cancel();
    sonar("reset"); bienvenida(); input.focus();
  };

  // ---- Micrófono con avisos de estado ----
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function micEstado(on) { $("#mic").classList.toggle("on", on); $("#mic").setAttribute("aria-pressed", on ? "true" : "false"); }
  var ERRORES = {
    "not-allowed": "El navegador bloqueó el micrófono. Permitilo desde el candado de la barra de direcciones.",
    "service-not-allowed": "El navegador bloqueó el micrófono. Permitilo desde la configuración del sitio.",
    "no-speech": "No te escuché. Probá de nuevo.",
    "audio-capture": "No encontré un micrófono conectado.",
    "network": "Sin conexión: el reconocimiento de voz la necesita."
  };
  if (SR) $("#mic").onclick = function () {
    if (rec) { rec.stop(); return; }
    if (window.speechSynthesis) speechSynthesis.cancel();
    var texto = "", fallo = false, r = new SR();
    rec = r; r.lang = "es-AR"; r.interimResults = false;
    
    r.onstart = function () { 
      micEstado(true); sonar("mic"); 
      cambiarEstadoSprite("voice");
      estado("🎤 Escuchando… hablá ahora (tocá de nuevo para parar)"); 
    };
    r.onresult = function (e) { texto = e.results[0][0].transcript; };
    r.onerror = function (e) {
      if (e.error === "aborted") return;
      fallo = true; sonar("error"); estado(ERRORES[e.error] || "No pude usar el micrófono.");
      cambiarEstadoSprite("offline", 3000);
      setTimeout(function () { if (!rec) estado(""); }, 6000);
    };
    r.onend = function () {
      rec = null; micEstado(false);
      cambiarEstadoSprite("default");
      if (!fallo) { estado(""); sonar("micFin"); }
      if (texto) { input.value = texto; enviar(); }
    };
    try { r.start(); } catch (e) { rec = null; micEstado(false); cambiarEstadoSprite("offline", 3000); estado("No pude iniciar el micrófono."); }
  }; else $("#mic").style.display = "none";

  if (window.speechSynthesis) $("#v").onclick = function () {
    vozActiva = !vozActiva; $("#v").setAttribute("aria-pressed", vozActiva ? "true" : "false");
    if (!vozActiva) speechSynthesis.cancel(); else sonar("recibir");
  }; else $("#v").style.display = "none";
})();