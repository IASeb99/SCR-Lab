(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  var quieto = false;
  try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { quieto = false; }

  function $(s, ctx) { return (ctx || document).querySelector(s); }
  function $$(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }

  /* ---------- botones de WhatsApp: solo si whatsapp_enlace tiene valor ---------- */
  (function () {
    var enlace = String((window.SCR_WEB && window.SCR_WEB.whatsapp_enlace) || '').trim();
    if (!enlace) return;
    $$('a[data-wa]').forEach(function (b) {
      var t = b.getAttribute('data-wa');
      b.href = enlace + (t ? (enlace.indexOf('?') < 0 ? '?' : '&') + 'text=' + encodeURIComponent(t) : '');
      b.hidden = false;
    });
  })();

  /* ---------- chat del hero: demo en vivo o conversación fija ---------- */
  var CFG = window.SCR_DEMO || {};
  var BASE = String(CFG.base || '').replace(/\/+$/, '');
  var NEG = {
    solarte: {
      titulo: 'Atención de SolArte · demo en vivo', inicial: 'S', para: 'la dueña de SolArte',
      saludo: 'Hola, soy el asistente de SolArte. Pregúnteme por las clases o por los precios.'
    },
    dental: {
      titulo: 'Atención del consultorio · demo en vivo', inicial: 'C', para: 'el dentista del consultorio',
      saludo: 'Hola, soy el asistente de ' + (CFG.consultorio || 'el consultorio') + '. ¿Quiere agendar una cita o saber los horarios?'
    }
  };
  var MAX_VISIBLES = 12;
  var DESCANSO = 'La demo descansó por hoy. Pídale al vendedor que se la muestre otra vez mañana.';

  var chatEl = $('#chat');
  var estadoEl = $('#estado');
  var tituloEl = $('#titulo');
  var inicialEl = $('#inicial');
  var chips = $$('#negocios .chip');
  var chipsEl = $('#negocios');
  var formEl = $('#form');
  var textoEl = $('#texto');
  var enviarEl = $('#enviar');
  var avisoIa = $('#aviso-ia');
  var pieEl = $('#demo-pie');
  var pieTxt = $('#demo-pie-txt');
  var reiniciarEl = $('#reiniciar');
  var anuncioEl = $('#anuncio');

  var neg = 'solarte';
  var vivo = false;
  var token = 0;
  var timers = [];
  var ocupado = false;
  var typingEl = null;
  var convId = '';
  var enviados = 0;

  function later(fn, ms) {
    var t = token;
    timers.push(setTimeout(function () { if (t === token) fn(); }, ms));
  }
  function cancelar() { token++; timers.forEach(clearTimeout); timers = []; }
  function anunciar(texto) { anuncioEl.textContent = ''; setTimeout(function () { anuncioEl.textContent = texto; }, 50); }
  function nuevoId() {
    var a = '';
    try {
      var u = new Uint8Array(12);
      window.crypto.getRandomValues(u);
      for (var i = 0; i < u.length; i++) a += ('0' + u[i].toString(16)).slice(-2);
    } catch (e) { a = String(Date.now()) + Math.random().toString(16).slice(2); }
    return a;
  }
  function burbuja(de, texto) {
    var d = document.createElement('div');
    d.className = 'b ' + (de === 'c' ? 'b-cliente' : 'b-bot');
    d.textContent = texto;
    chatEl.appendChild(d);
    var burb = $$('.b', chatEl);
    while (burb.length > MAX_VISIBLES) { chatEl.removeChild(burb.shift()); }
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  function tarjeta(resumen) {
    var d = document.createElement('div');
    d.className = 'tarjeta tarjeta-aviso b-entra';
    var p = document.createElement('span'); p.className = 'para'; p.textContent = 'PARA USTED';
    var t = document.createElement('strong'); t.textContent = 'Esto le llegaría a ' + NEG[neg].para;
    var r = document.createElement('span'); r.className = 'aviso-p'; r.textContent = resumen;
    d.appendChild(p); d.appendChild(t); d.appendChild(r);
    chatEl.appendChild(d);
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  function escribiendo(on) {
    if (on && !typingEl) {
      typingEl = document.createElement('div');
      typingEl.className = 'escribiendo b-entra';
      typingEl.setAttribute('aria-hidden', 'true');
      typingEl.innerHTML = '<span class="punto"></span><span class="punto"></span><span class="punto"></span>';
      chatEl.appendChild(typingEl);
      chatEl.scrollTop = chatEl.scrollHeight;
    } else if (!on && typingEl) {
      if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      typingEl = null;
    }
    estadoEl.textContent = on ? 'escribiendo…' : 'en línea';
  }
  function limpiarChat() {
    typingEl = null;
    while (chatEl.firstChild) chatEl.removeChild(chatEl.firstChild);
  }
  function cabecera() {
    var d = NEG[neg];
    tituloEl.textContent = d.titulo;
    inicialEl.textContent = d.inicial;
    chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-neg') === neg ? 'true' : 'false'); });
  }
  function pie(texto, conReiniciar) {
    pieTxt.textContent = texto;
    reiniciarEl.hidden = !conReiniciar;
    pieEl.hidden = false;
  }
  function cerrarEntrada(motivo) {
    formEl.hidden = true;
    pie(motivo, true);
  }

  /* conversación fija (demo apagado) */
  function mostrarFija() {
    vivo = false;
    cancelar();
    limpiarChat();
    escribiendo(false);
    chipsEl.hidden = true;
    formEl.hidden = true;
    avisoIa.hidden = true;
    neg = 'solarte';
    cabecera();
    tituloEl.textContent = 'Atención de SolArte';
    pie('Así contestamos. Con su propio negocio se vería igual.', false);
    fetch('/assets/conversacion-solarte.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('x'); return r.json(); })
      .then(function (j) { reproducirFija(j.mensajes || []); })
      .catch(function () { pie('La demo descansó por hoy. Pídale al vendedor que se la muestre otra vez mañana.', false); });
  }
  function reproducirFija(d) {
    if (!d.length) return;
    if (quieto) { d.forEach(function (m) { burbuja(m.de, m.texto); }); return; }
    burbuja(d[0].de, d[0].texto);
    var i = 1;
    (function paso() {
      if (i >= d.length) return;
      var m = d[i];
      if (m.de === 'b') {
        escribiendo(true);
        later(function () { escribiendo(false); burbuja(m.de, m.texto); i++; paso(); }, 1200);
      } else {
        later(function () { burbuja(m.de, m.texto); i++; paso(); }, 1400);
      }
    })();
  }

  /* demo en vivo */
  function iniciarVivo() {
    vivo = true;
    cancelar();
    limpiarChat();
    escribiendo(false);
    ocupado = false;
    enviados = 0;
    convId = nuevoId();
    chipsEl.hidden = false;
    formEl.hidden = false;
    avisoIa.hidden = false;
    pieEl.hidden = true;
    enviarEl.disabled = false;
    textoEl.disabled = false;
    cabecera();
    burbuja('b', NEG[neg].saludo);
  }
  function llamar(ruta, opciones) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctl) ctl.abort(); }, 45000);
    var o = opciones || {};
    if (ctl) o.signal = ctl.signal;
    return fetch(BASE + ruta, o).then(function (r) { clearTimeout(tm); return r; }, function (e) { clearTimeout(tm); throw e; });
  }
  function respuestaTexto(x) { return typeof x === 'string' ? x : (x && x.texto) || ''; }
  function enviar(texto) {
    if (ocupado || !texto) return;
    ocupado = true;
    enviarEl.disabled = true;
    burbuja('c', texto);
    anunciar('Usted: ' + texto);
    escribiendo(true);
    var cab = { 'Content-Type': 'application/json' };
    if (CFG.clave) cab['X-Demo-Clave'] = CFG.clave;
    var miConv = convId;
    llamar('/demo/mensaje', { method: 'POST', headers: cab, body: JSON.stringify({ negocio: neg, conversacionId: convId, texto: texto }) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; });
      })
      .then(function (x) {
        if (miConv !== convId) return;
        escribiendo(false);
        if (x.s === 200 && x.j && x.j.ok) {
          enviados++;
          (x.j.respuestas || []).forEach(function (t) { var s = respuestaTexto(t); if (s) { burbuja('b', s); anunciar('Respuesta: ' + s); } });
          if (x.j.tarjeta && x.j.tarjeta.resumen) tarjeta(x.j.tarjeta.resumen);
          if (typeof x.j.restantes === 'number' && x.j.restantes <= 0) { cerrarEntrada('Llegó al límite de mensajes de esta demo. Puede empezar de nuevo.'); return; }
        } else if (x.s === 429 || x.s === 503) {
          burbuja('b', (x.j && x.j.mensaje) || DESCANSO);
          cerrarEntrada(DESCANSO);
          return;
        } else if (x.s === 401) {
          burbuja('b', 'La demo no está disponible en este momento.');
          cerrarEntrada('La demo no está disponible por ahora. Pídale al vendedor que se la muestre otra vez mañana.');
          return;
        } else {
          burbuja('b', 'No pude responder ahora. Intente de nuevo.');
        }
        ocupado = false;
        enviarEl.disabled = false;
        textoEl.focus();
      })
      .catch(function () {
        if (miConv !== convId) return;
        escribiendo(false);
        burbuja('b', 'No pude conectar. Intente de nuevo en un momento.');
        ocupado = false;
        enviarEl.disabled = false;
      });
  }
  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = textoEl.value.replace(/\s+/g, ' ').trim();
    if (!t) return;
    textoEl.value = '';
    enviar(t);
  });
  reiniciarEl.addEventListener('click', function () { iniciarVivo(); textoEl.focus(); });
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var id = c.getAttribute('data-neg');
      if (id === neg || !vivo) return;
      neg = id;
      iniciarVivo();
    });
  });

  if (!BASE) {
    mostrarFija();
  } else {
    estadoEl.textContent = 'conectando…';
    llamar('/demo/estado', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.abierto) iniciarVivo(); else mostrarFija(); })
      .catch(function () { mostrarFija(); });
  }

  /* ---------- Así trabaja por usted ---------- */
  var slides = $$('#diapos .slide');
  var segs = $$('#segmentos .seg');
  var pausaBtn = $('#pausa');
  var icoPausa = $('#ico-pausa');
  var icoPlay = $('#ico-play');
  var actual = 0;
  var auto = !quieto;
  var slideTimer = null;

  function pintarSlides() {
    slides.forEach(function (s, i) { s.hidden = i !== actual; });
    segs.forEach(function (b, i) {
      b.classList.toggle('hecho', i < actual || (i === actual && !auto));
      b.classList.toggle('activo', i === actual && auto);
      if (i === actual) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    pausaBtn.setAttribute('aria-label', auto ? 'Pausar los pasos' : 'Reproducir los pasos');
    icoPausa.hidden = !auto;
    icoPlay.hidden = auto;
    clearTimeout(slideTimer);
    if (auto) slideTimer = setTimeout(function () { actual = (actual + 1) % slides.length; pintarSlides(); }, 10000);
  }
  function ir(i) { actual = (i + slides.length) % slides.length; auto = false; pintarSlides(); }
  $('#anterior').addEventListener('click', function () { ir(actual - 1); });
  $('#siguiente').addEventListener('click', function () { ir(actual + 1); });
  pausaBtn.addEventListener('click', function () { auto = !auto && !quieto; pintarSlides(); });
  segs.forEach(function (b, i) { b.addEventListener('click', function () { ir(i); }); });
  if (quieto) pausaBtn.hidden = true;
  pintarSlides();

  /* ---------- servicios (pestañas) ---------- */
  var tabs = $$('#tabs [role="tab"]');
  function elegirTab(i, enfocar) {
    tabs.forEach(function (t, j) {
      var on = j === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = document.getElementById(t.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    if (enfocar) tabs[i].focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { elegirTab(i, false); });
    t.addEventListener('keydown', function (e) {
      var n = tabs.length, j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % n;
      else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      if (j !== null) { e.preventDefault(); elegirTab(j, true); }
    });
  });

  /* ---------- preguntas frecuentes ---------- */
  var qs = $$('.faq-q');
  qs.forEach(function (q) {
    q.addEventListener('click', function () {
      var abrir = q.getAttribute('aria-expanded') !== 'true';
      qs.forEach(function (o) {
        var on = o === q && abrir;
        o.setAttribute('aria-expanded', on ? 'true' : 'false');
        o.querySelector('.signo').textContent = on ? '−' : '+';
        document.getElementById(o.getAttribute('aria-controls')).hidden = !on;
      });
    });
  });

  /* ---------- aparecer al bajar (respaldo) ---------- */
  var soportaView = false;
  try { soportaView = window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'); } catch (e) { soportaView = false; }
  if (!soportaView) {
    var rev = $$('.revela');
    if (quieto || !('IntersectionObserver' in window)) {
      rev.forEach(function (el) { el.classList.add('visto'); });
    } else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } });
      }, { threshold: 0.15 });
      rev.forEach(function (el) { io.observe(el); });
    }
  }
})();
