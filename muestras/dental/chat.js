(function () {
  'use strict';
  var ID = 'dental';
  var cfg = window.CONFIG_MUESTRA || {};
  var $ = function (i) { return document.getElementById(i); };
  var negocio = null;
  var wa = '';
  var hilo = null;
  var enCurso = false;

  function enlaceWa(v) {
    return typeof v === 'string' && /^https:\/\/wa\.me\/\d+/.test(v) ? v : '';
  }
  function ponerWa(v) {
    var propio = enlaceWa(cfg.whatsapp_enlace);
    wa = propio || enlaceWa(v) || wa;
    var a = $('wa-cab');
    if (wa) { a.href = wa; a.hidden = false; } else { a.hidden = true; }
  }
  function nuevoId() {
    var b = new Uint8Array(16), s = '', i;
    (window.crypto || window.msCrypto).getRandomValues(b);
    for (i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return s;
  }
  function api(ruta, opc) {
    return fetch(ruta, opc).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { estado: r.status, cuerpo: j }; });
    });
  }
  function burbuja(texto, clase) {
    var d = document.createElement('div');
    d.className = 'm ' + clase;
    d.textContent = texto;
    $('msgs').appendChild(d);
    $('msgs').scrollTop = $('msgs').scrollHeight;
    return d;
  }
  function tarjeta(resumen) {
    var t = $('tarjeta');
    t.textContent = '';
    if (!resumen) { t.hidden = true; return; }
    var b = document.createElement('b');
    b.textContent = (negocio && negocio.tarjeta) || 'Esto le llegaría al dentista:';
    t.appendChild(b);
    t.appendChild(document.createTextNode(resumen));
    t.hidden = false;
  }
  function estado(txt) { $('estado').textContent = txt || ''; }
  function fin(texto, opciones) {
    $('fin-txt').textContent = texto;
    $('fin-wa').hidden = !(opciones.wa && wa);
    if (wa) $('fin-wa').href = wa;
    $('fin-entrar').hidden = !opciones.entrar;
    $('fin-nuevo').hidden = !opciones.nuevo;
    $('fin').hidden = false;
    $('form').hidden = true;
  }
  function sinFin() {
    $('fin').hidden = true;
    $('form').hidden = false;
  }
  function pintar() {
    $('msgs').textContent = '';
    hilo.mensajes.forEach(function (m) { burbuja(m.texto, m.de); });
    tarjeta(hilo.tarjeta);
  }
  function empezar() {
    hilo = {
      cid: nuevoId(),
      mensajes: [{ de: 'bot', texto: (negocio && negocio.saludo) || 'Hola, ¿en qué le ayudo?' }],
      tarjeta: null, pausado: false
    };
    estado(''); sinFin(); pintar();
    $('texto').disabled = false; $('enviar').disabled = false;
  }
  function cargar() {
    return api('/demo/negocios').then(function (r) {
      if (r.estado === 200 && r.cuerpo && Array.isArray(r.cuerpo.negocios)) {
        negocio = null;
        r.cuerpo.negocios.forEach(function (n) { if (n && n.id === ID) negocio = n; });
        ponerWa(r.cuerpo.whatsapp);
        if (negocio) { $('chat-titulo').textContent = negocio.titulo || 'Bot del consultorio · demo en vivo'; }
        return negocio ? 'ok' : 'error';
      }
      if (r.estado === 401) return '401';
      if (r.estado === 503) { ponerWa(r.cuerpo && r.cuerpo.whatsapp); return '503'; }
      return 'error';
    }).catch(function () { return 'error'; });
  }

  function abrir() {
    $('chat').hidden = false;
    document.body.style.overflow = 'hidden';
    if (negocio && hilo) { $('texto').focus(); return; }
    $('msgs').textContent = '';
    burbuja('Abriendo el chat…', 'bot pensando');
    cargar().then(function (res) {
      if (res === 'ok') { empezar(); $('texto').focus(); return; }
      $('msgs').textContent = '';
      $('form').hidden = true;
      if (res === '401') fin('Su sesión venció. Entre de nuevo para seguir.', { entrar: true });
      else if (res === '503') fin('La demo descansó por hoy. Pídale al vendedor que se la muestre otra vez mañana.', { wa: true });
      else fin('No se pudo abrir el chat. Intente otra vez en un momento.', { nuevo: true });
    });
  }
  function cerrar() {
    $('chat').hidden = true;
    document.body.style.overflow = '';
  }

  $('form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var campo = $('texto');
    var texto = campo.value.trim();
    if (!texto || enCurso || !hilo) return;
    if (hilo.pausado) { estado('El bot pasó la conversación a una persona y quedó en pausa. Toque «Empezar de nuevo».'); return; }
    enCurso = true; $('enviar').disabled = true; estado('');
    hilo.mensajes.push({ de: 'yo', texto: texto });
    burbuja(texto, 'yo');
    campo.value = '';
    var espera = burbuja('Escribiendo…', 'bot pensando');
    var h = hilo;
    api('/demo/mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio: ID, conversacionId: h.cid, texto: texto })
    }).then(function (r) {
      espera.remove();
      if (r.estado === 200 && Array.isArray(r.cuerpo.respuestas)) {
        r.cuerpo.respuestas.forEach(function (t) { h.mensajes.push({ de: 'bot', texto: String(t) }); });
        if (r.cuerpo.tarjeta && r.cuerpo.tarjeta.resumen) h.tarjeta = r.cuerpo.tarjeta.resumen;
        h.pausado = !!r.cuerpo.pausado;
        if (h === hilo) pintar();
        if (h.pausado) estado('El bot pasó la conversación a una persona y quedó en pausa, como en WhatsApp real.');
        return;
      }
      h.mensajes.pop();
      if (r.estado === 401) { fin('Su sesión venció. Entre de nuevo para seguir.', { entrar: true }); return; }
      if (r.estado === 429) { fin('Llegó al límite de mensajes de esta conversación.', { nuevo: true }); return; }
      if (r.estado === 503) { ponerWa(r.cuerpo && r.cuerpo.whatsapp); fin('La demo descansó por hoy. Pídale al vendedor que se la muestre otra vez mañana.', { wa: true }); return; }
      campo.value = texto;
      pintar();
      estado('No se pudo enviar, intente otra vez.');
    }).catch(function () {
      espera.remove();
      h.mensajes.pop();
      campo.value = texto;
      pintar();
      estado('No se pudo enviar, intente otra vez.');
    }).then(function () {
      enCurso = false; $('enviar').disabled = false;
    });
  });

  $('reiniciar').addEventListener('click', function () { if (negocio) { empezar(); $('texto').focus(); } else { abrir(); } });
  $('fin-nuevo').addEventListener('click', function () {
    if (negocio) { empezar(); $('texto').focus(); return; }
    $('fin').hidden = true;
    cargar().then(function (res) {
      if (res === 'ok') { empezar(); $('texto').focus(); }
      else fin('No se pudo abrir el chat. Intente otra vez en un momento.', { nuevo: true });
    });
  });
  $('chat-cerrar').addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('chat').hidden) cerrar(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-abrir-chat]'), function (b) {
    b.addEventListener('click', abrir);
  });

  ponerWa('');
  cargar().then(function (res) { if (res === 'ok') empezar(); });
})();
