(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  var quieto = false;
  try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { quieto = false; }

  function $(s, ctx) { return (ctx || document).querySelector(s); }
  function $$(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }

  /* ---------- chat del celular ---------- */
  var DATOS = {
    cafe: { titulo: 'Café de la esquina', inicial: 'C', chat: [
      ['c', 'Hola, ¿hacen delivery?'],
      ['b', '¡Hola! Sí, hacemos delivery en el sector de 8 am a 6 pm.'],
      ['c', '¿Cuánto cuesta el desayuno completo?'],
      ['b', 'El desayuno completo cuesta $4,50. ¿Se lo envío hoy?']
    ], rapidas: [
      ['¿Abren el domingo?', 'Sí, el domingo abrimos de 8:00 a 14:00.'],
      ['¿Tienen algo sin gluten?', 'Sí: pan sin gluten y bowls de fruta. ¿Le agrego alguno a su pedido?'],
      ['Quiero hablar con el dueño', 'Claro, ya le aviso. Le escribe en unos minutos.']
    ] },
    pelu: { titulo: 'Peluquería Bella', inicial: 'B', chat: [
      ['c', '¿Tienen turno mañana?'],
      ['b', 'Sí: 10:00, 11:30 o 16:00. ¿Cuál le queda mejor?'],
      ['c', 'A las 11:30'],
      ['b', 'Listo, mañana 11:30. ¿Le recuerdo un día antes?']
    ], rapidas: [
      ['¿Cuánto cuesta el corte?', 'El corte cuesta $8 y con lavado $10. ¿Le reservo un turno?'],
      ['¿Atienden el domingo?', 'El domingo no abrimos. ¿Le sirve el sábado a las 10:00?'],
      ['Quiero hablar con alguien', 'Claro, ya le aviso a la dueña. Le escribe en unos minutos.']
    ] },
    ferre: { titulo: 'Ferretería El Tornillo', inicial: 'T', chat: [
      ['c', '¿Tienen cemento?'],
      ['b', 'Sí. El saco de 50 kg está en $8,20. ¿Cuántos necesita?'],
      ['c', 'Diez, ¿me hacen descuento?'],
      ['b', 'Eso se lo confirma el dueño. Ya le pasé su pedido.']
    ], rapidas: [
      ['¿Hacen entregas?', 'Sí, entregamos en el valle. ¿A qué sector sería?'],
      ['¿Hasta qué hora abren?', 'Abrimos de lunes a sábado, de 7:30 a 18:00.'],
      ['¿Tienen pintura blanca?', 'Sí, en galón y en caneca. ¿Para interior o exterior?']
    ] }
  };
  var MAX_VISIBLES = 6;

  var chatEl = $('#chat');
  var estadoEl = $('#estado');
  var tituloEl = $('#titulo');
  var inicialEl = $('#inicial');
  var rapidasEl = $('#rapidas');
  var rapidasZona = $('#rapidas-zona');
  var chips = $$('#negocios .chip');

  var neg = 'cafe';
  var token = 0;
  var timers = [];
  var pendiente = false;
  var typingEl = null;

  function later(fn, ms) {
    var t = token;
    var id = setTimeout(function () { if (t === token) fn(); }, ms);
    timers.push(id);
  }
  function cancelar() {
    token++;
    timers.forEach(clearTimeout);
    timers = [];
  }
  function burbuja(de, texto) {
    var d = document.createElement('div');
    d.className = 'b ' + (de === 'c' ? 'b-cliente' : 'b-bot');
    d.textContent = texto;
    chatEl.appendChild(d);
    var burb = $$('.b', chatEl);
    while (burb.length > MAX_VISIBLES) { chatEl.removeChild(burb.shift()); }
  }
  function escribiendo(on) {
    if (on && !typingEl) {
      typingEl = document.createElement('div');
      typingEl.className = 'escribiendo b-entra';
      typingEl.innerHTML = '<span class="solo-lector">escribiendo</span><span class="punto" aria-hidden="true"></span><span class="punto" aria-hidden="true"></span><span class="punto" aria-hidden="true"></span>';
      chatEl.appendChild(typingEl);
    } else if (!on && typingEl) {
      chatEl.removeChild(typingEl);
      typingEl = null;
    }
    estadoEl.textContent = on ? 'escribiendo…' : 'en línea';
  }
  function limpiarChat() {
    typingEl = null;
    while (chatEl.firstChild) chatEl.removeChild(chatEl.firstChild);
  }
  function pintarRapidas() {
    var d = DATOS[neg];
    rapidasEl.textContent = '';
    d.rapidas.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rapida';
      b.textContent = r[0];
      b.addEventListener('click', function () { preguntar(r[0], r[1], b); });
      rapidasEl.appendChild(b);
    });
    rapidasZona.hidden = false;
  }
  function cabecera() {
    var d = DATOS[neg];
    tituloEl.textContent = d.titulo;
    inicialEl.textContent = d.inicial;
    chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-neg') === neg ? 'true' : 'false'); });
  }
  function reproducir() {
    var d = DATOS[neg].chat;
    cancelar();
    limpiarChat();
    escribiendo(false);
    if (quieto) {
      d.forEach(function (m) { burbuja(m[0], m[1]); });
      return;
    }
    burbuja(d[0][0], d[0][1]);
    var i = 1;
    (function paso() {
      if (i >= d.length) {
        later(function () { reproducir(); }, 5000);
        return;
      }
      var m = d[i];
      if (m[0] === 'b') {
        escribiendo(true);
        later(function () { escribiendo(false); burbuja(m[0], m[1]); i++; paso(); }, 1100);
      } else {
        later(function () { burbuja(m[0], m[1]); i++; paso(); }, 1000);
      }
    })();
  }
  function preguntar(q, a, boton) {
    if (pendiente) return;
    var yaVistos = $$('.b', chatEl).length;
    var base = DATOS[neg].chat;
    cancelar();
    escribiendo(false);
    if (yaVistos < base.length && yaVistos < MAX_VISIBLES) {
      for (var k = yaVistos; k < base.length; k++) burbuja(base[k][0], base[k][1]);
    }
    var sig = boton.nextElementSibling || boton.previousElementSibling;
    rapidasEl.removeChild(boton);
    if (sig) sig.focus();
    burbuja('c', q);
    if (!rapidasEl.children.length) rapidasZona.hidden = true;
    if (quieto) { burbuja('b', a); return; }
    pendiente = true;
    escribiendo(true);
    var t = token;
    var id = setTimeout(function () {
      if (t !== token) return;
      escribiendo(false);
      burbuja('b', a);
      pendiente = false;
    }, 1200);
    timers.push(id);
  }
  function elegirNegocio(id) {
    if (id === neg) return;
    neg = id;
    pendiente = false;
    cabecera();
    pintarRapidas();
    reproducir();
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { elegirNegocio(c.getAttribute('data-neg')); }); });
  cabecera();
  pintarRapidas();
  reproducir();

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
    if (auto) slideTimer = setTimeout(function () { actual = (actual + 1) % slides.length; pintarSlides(); }, 5000);
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
