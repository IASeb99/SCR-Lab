(function () {
  'use strict';
  var NEGOCIO = 'solarte';
  var TARJETA_POR_DEFECTO = 'Esto le llegaría a la dueña de SolArte:';
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.SOLARTE_CONFIG || {};
  var WA_OK = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//;

  var negocio = null;
  var wa = '';
  var hilo = null;
  var enCurso = false;
  var ultimoFoco = null;

  function esWa(u) { return typeof u === 'string' && WA_OK.test(u); }

  function fijarWa(enlace) {
    var u = esWa(cfg.whatsapp_enlace) ? cfg.whatsapp_enlace : (esWa(enlace) ? enlace : '');
    wa = u;
    ['wa-cab', 'wa-pie'].forEach(function (id) {
      var a = $(id);
      if (!a) return;
      if (u) { a.href = u; a.hidden = false; } else { a.hidden = true; }
    });
  }

  function idConversacion() {
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    var s = '';
    for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2);
    return 'sa' + s;
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
    var c = $('chat-msgs');
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
    return d;
  }

  function avisar(texto, opc) {
    opc = opc || {};
    $('aviso-txt').textContent = texto;
    $('aviso-enlace').hidden = !opc.entrar;
    $('aviso-wa').hidden = !(opc.wa && wa);
    if (opc.wa && wa) $('aviso-wa').href = wa;
    $('aviso-reiniciar').hidden = !opc.reiniciar;
    $('chat-aviso').hidden = false;
  }
  function quitarAviso() { $('chat-aviso').hidden = true; }

  function bloquear(si) {
    $('chat-texto').disabled = si;
    $('chat-enviar').disabled = si;
  }

  function pintar() {
    $('chat-msgs').textContent = '';
    if (!hilo) return;
    hilo.mensajes.forEach(function (m) { burbuja(m.texto, m.de); });
    var t = $('chat-tarjeta');
    t.textContent = '';
    if (hilo.tarjeta) {
      var b = document.createElement('b');
      b.textContent = (negocio && negocio.tarjeta) || TARJETA_POR_DEFECTO;
      t.appendChild(b);
      t.appendChild(document.createTextNode(hilo.tarjeta));
      t.hidden = false;
    } else { t.hidden = true; }
    $('chat-restantes').textContent = hilo.restantes === null ? '' : 'Mensajes que quedan: ' + hilo.restantes;
  }

  function nuevoHilo() {
    hilo = { cid: idConversacion(), mensajes: [{ de: 'bot', texto: negocio.saludo }], tarjeta: null, restantes: null, pausado: false };
    quitarAviso();
    $('chat-error').textContent = '';
    bloquear(false);
    pintar();
  }

  function cargarNegocio() {
    return api('/demo/negocios').then(function (r) {
      if (r.estado === 200 && r.cuerpo && Array.isArray(r.cuerpo.negocios)) {
        fijarWa(r.cuerpo.whatsapp);
        var n = null;
        r.cuerpo.negocios.forEach(function (x) { if (x && x.id === NEGOCIO) n = x; });
        if (!n) return { fallo: 'No se pudo abrir el chat. Intente otra vez en un momento.' };
        negocio = n;
        if (n.titulo) $('chat-titulo').textContent = n.titulo;
        return {};
      }
      if (r.estado === 401) return { fallo: 'Su sesión venció.', entrar: true };
      if (r.estado === 429) return { fallo: r.cuerpo.mensaje || 'Demasiados intentos. Espere unos minutos.' };
      if (r.estado === 503) {
        fijarWa(r.cuerpo && r.cuerpo.whatsapp);
        return { fallo: r.cuerpo.mensaje || 'La demo descansó por hoy.', wa: true };
      }
      return { fallo: 'No se pudo abrir el chat. Intente otra vez en un momento.' };
    }).catch(function () { return { fallo: 'No se pudo abrir el chat. Revise su conexión e intente otra vez.' }; });
  }

  function abrir() {
    ultimoFoco = document.activeElement;
    $('chat').hidden = false;
    document.body.classList.add('chat-abierto');
    if (negocio && hilo) { $('chat-texto').focus(); return; }
    if (negocio) { nuevoHilo(); $('chat-texto').focus(); return; }
    $('chat-msgs').textContent = '';
    burbuja('Abriendo el chat…', 'bot pensando');
    bloquear(true);
    cargarNegocio().then(function (r) {
      $('chat-msgs').textContent = '';
      if (r.fallo) {
        avisar(r.fallo, { entrar: r.entrar, wa: r.wa });
        return;
      }
      nuevoHilo();
      $('chat-texto').focus();
    });
  }

  function cerrar() {
    $('chat').hidden = true;
    document.body.classList.remove('chat-abierto');
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function enviar(ev) {
    ev.preventDefault();
    if (!negocio || !hilo || enCurso) return;
    var campo = $('chat-texto');
    var texto = campo.value.trim();
    if (!texto) return;
    if (hilo.pausado) {
      $('chat-error').textContent = 'El bot pasó la conversación a una persona y quedó en pausa, como en WhatsApp real. Toque «Empezar de nuevo».';
      return;
    }
    enCurso = true;
    bloquear(true);
    $('chat-error').textContent = '';
    var h = hilo;
    h.mensajes.push({ de: 'yo', texto: texto });
    burbuja(texto, 'yo');
    var espera = burbuja('Escribiendo…', 'bot pensando');
    var recuperar = function (msg) {
      espera.remove();
      h.mensajes.pop();
      pintar();
      campo.value = texto;
      $('chat-error').textContent = msg;
    };
    api('/demo/mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio: NEGOCIO, conversacionId: h.cid, texto: texto })
    }).then(function (r) {
      var c = r.cuerpo || {};
      if (r.estado === 200 && Array.isArray(c.respuestas)) {
        espera.remove();
        campo.value = '';
        c.respuestas.forEach(function (t) { if (typeof t === 'string') h.mensajes.push({ de: 'bot', texto: t }); });
        if (c.tarjeta && typeof c.tarjeta.resumen === 'string') h.tarjeta = c.tarjeta.resumen;
        h.restantes = typeof c.restantes === 'number' ? c.restantes : h.restantes;
        h.pausado = !!c.pausado;
        pintar();
        if (h.pausado) $('chat-error').textContent = 'El bot pasó la conversación a una persona y quedó en pausa, como en WhatsApp real.';
        if (h.restantes === 0) { avisar('Llegó al límite de mensajes de esta conversación.', { reiniciar: true }); }
      } else if (r.estado === 401) {
        recuperar('');
        avisar('Su sesión venció.', { entrar: true });
        bloquear(true);
      } else if (r.estado === 429) {
        recuperar('');
        h.restantes = 0;
        avisar('Llegó al límite de 12 mensajes de esta conversación.', { reiniciar: true });
        bloquear(true);
      } else if (r.estado === 503) {
        fijarWa(c.whatsapp);
        recuperar('');
        avisar('La demo descansó por hoy.', { wa: true });
        bloquear(true);
      } else {
        recuperar('No se pudo enviar, intente otra vez.');
      }
    }).catch(function () {
      recuperar('No se pudo enviar, intente otra vez.');
    }).then(function () {
      enCurso = false;
      if ($('chat-aviso').hidden) { bloquear(false); campo.focus(); }
    });
  }

  function reiniciar() {
    if (!negocio) { abrir(); return; }
    nuevoHilo();
    $('chat-texto').focus();
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-abrir-chat]'), function (b) {
    b.addEventListener('click', abrir);
  });
  $('chat-cerrar').addEventListener('click', cerrar);
  $('chat-form').addEventListener('submit', enviar);
  $('chat-reiniciar').addEventListener('click', function () {
    if (!negocio) { $('chat-msgs').textContent = ''; abrir(); return; }
    reiniciar();
  });
  $('aviso-reiniciar').addEventListener('click', reiniciar);
  $('chat').addEventListener('click', function (e) { if (e.target === $('chat')) cerrar(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('chat').hidden) cerrar(); });

  fijarWa('');
  cargarNegocio().then(function () { /* el WhatsApp se fija solo si la sesión es válida */ });
})();
