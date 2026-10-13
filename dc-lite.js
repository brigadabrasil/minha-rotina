/* dc-lite: runtime leve que roda as telas .dc.html do Minha Rotina fora do Claude. */
(function () {
  'use strict';
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var BOOL = { disabled: 1, checked: 1, selected: 1, hidden: 1, open: 1, required: 1, readonly: 1, multiple: 1, autoplay: 1, controls: 1, muted: 1, loop: 1 };
  var PERSIST = ['pics', 'done', 'hk'];
  var KEY = 'mr:' + location.pathname.split('/').pop();

  /* Um áudio por vez: tocar um pausa os outros; trocar de mestre/música ou fechar o player para o som. */
(function () {
  if (window.__mrMedia2) return; window.__mrMedia2 = 1; window.__mrMedia = 1;
  var playing = [];
  function list() { return Array.prototype.slice.call(document.querySelectorAll('audio,video')).concat(playing); }
  function stop(m) { try { if (!m.paused) m.pause(); } catch (e) {} }
  function stopAll(except) { list().forEach(function (m) { if (m !== except) stop(m); }); }
  window.mrStopAll = stopAll;
  function onPlay(e) { var t = e.target; if (!t || !/^(AUDIO|VIDEO)$/.test(t.tagName)) return; stopAll(t); if (playing.indexOf(t) < 0) playing.push(t); }
  document.addEventListener('play', onPlay, true);
  document.addEventListener('playing', onPlay, true);
  function onTap(e) { var t = e.target; if (t && t.closest && t.closest('[data-stop-audio]')) stopAll(); }
  document.addEventListener('pointerdown', onTap, true);
  document.addEventListener('click', onTap, true);
  setInterval(function () {
    var vis = list().filter(function (m) { return !m.paused; });
    vis.forEach(function (m) { if (!m.isConnected || !m.getClientRects().length) stop(m); });
    playing = list().filter(function (m) { return !m.paused; }).filter(function (m, i, a) { return a.indexOf(m) === i; });
    if (playing.length > 1) playing.slice(0, -1).forEach(stop);
  }, 200);
})();

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p) {
    if (typeof p === 'function') p = p(this.state || {}, this.props);
    this.state = Object.assign({}, this.state || {}, p || {});
    save(this.state);
    schedule();
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  window.DCLogic = DCLogic;

  /* Dados pequenos (feitos, hábitos) ficam no localStorage; fotos ficam no IndexedDB, que aguenta muito mais. */
  var BIG = { pics: 1 }, idbP = null, lastBig = {};
  function idb() {
    if (idbP) return idbP;
    idbP = new Promise(function (ok, no) {
      try { var rq = indexedDB.open('minha-rotina', 1); rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); }; rq.onsuccess = function () { ok(rq.result); }; rq.onerror = function () { no(rq.error); }; } catch (e) { no(e); }
    });
    return idbP;
  }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (ok) { var rq = db.transaction('kv').objectStore('kv').get(k); rq.onsuccess = function () { ok(rq.result); }; rq.onerror = function () { ok(undefined); }; }); }); }
  function idbPut(k, v) { return idb().then(function (db) { return new Promise(function (ok, no) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function () { ok(); }; t.onerror = function () { no(t.error); }; }); }); }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(st) {
    var o = {};
    PERSIST.forEach(function (k) {
      if (st[k] === undefined) return;
      if (BIG[k]) { if (lastBig[k] !== st[k]) { lastBig[k] = st[k]; idbPut(KEY + ':' + k, st[k]).catch(function (e) { console.error('Não foi possível gravar ' + k, e); }); } }
      else o[k] = st[k];
    });
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function loadBig(comp) {
    Object.keys(BIG).forEach(function (k) {
      idbGet(KEY + ':' + k).then(function (v) {
        var cur = comp.state[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object') v = Object.assign({}, cur, v);
        if (v !== undefined) { comp.state = Object.assign({}, comp.state, (function () { var x = {}; x[k] = v; return x; })()); }
        if (comp.state[k] !== undefined) { lastBig[k] = undefined; save(comp.state); }
        schedule();
      }).catch(function () {});
    });
  }

  function lit(p) {
    if (p === 'true') return { v: true }; if (p === 'false') return { v: false };
    if (p === 'null') return { v: null }; if (p === 'undefined') return { v: undefined };
    if (/^-?\d+(\.\d+)?$/.test(p)) return { v: +p };
    if (/^(['"]).*\1$/.test(p)) return { v: p.slice(1, -1) };
    return null;
  }
  function look(path, scope) {
    var l = lit(path); if (l) return l.v;
    var parts = path.split('.'), head = parts[0], base;
    for (var i = scope.length - 1; i >= 0; i--) { var s = scope[i]; if (s && typeof s === 'object' && head in s) { base = s[head]; break; } }
    for (var j = 1; j < parts.length; j++) { if (base == null) return undefined; base = base[parts[j]]; }
    return base;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = look(p, scope); return v == null ? '' : String(v); });
  }
  function evName(attr, el) {
    var n = attr.slice(2).toLowerCase();
    if (n === 'change') { var t = (el.getAttribute('type') || '').toLowerCase(); var tag = el.localName; if ((tag === 'input' && t !== 'checkbox' && t !== 'radio' && t !== 'file') || tag === 'textarea') return 'input'; }
    if (n === 'doubleclick') return 'dblclick';
    return n;
  }

  function render(node, scope, out) {
    if (node.nodeType === 3) {
      var d = node.data;
      out.push(document.createTextNode(d.indexOf('{{') >= 0 ? interp(d, scope) : d));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-for') {
      var lm = WHOLE.exec(node.getAttribute('list') || ''), list = lm ? look(lm[1], scope) : null, as = node.getAttribute('as') || 'item';
      if (list && list.length) for (var i = 0; i < list.length; i++) {
        var sc = {}; sc[as] = list[i]; sc.$index = i;
        var ns = scope.concat([sc]);
        for (var c = node.firstChild; c; c = c.nextSibling) render(c, ns, out);
      }
      return;
    }
    if (tag === 'sc-if') {
      var vm = WHOLE.exec(node.getAttribute('value') || ''), val = vm ? look(vm[1], scope) : node.getAttribute('value');
      if (val) for (var k = node.firstChild; k; k = k.nextSibling) render(k, scope, out);
      return;
    }
    var el = node.cloneNode(false), attrs = Array.prototype.slice.call(node.attributes);
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, raw = attrs[a].value;
      if (name.indexOf('hint-') === 0) { el.removeAttribute(name); continue; }
      if (raw.indexOf('{{') < 0) continue;
      if (name === 'dc-src') { el.removeAttribute(name); name = 'src'; }
      var m = WHOLE.exec(raw);
      if (m) {
        var v = look(m[1], scope);
        if (/^on[a-z]+$/i.test(name)) {
          el.removeAttribute(name);
          if (typeof v === 'function') { (el.__dc = el.__dc || {})[evName(name, node)] = v; }
          continue;
        }
        var ln = name.toLowerCase();
        if (ln === 'value' && (tag === 'input' || tag === 'select' || tag === 'textarea')) { el.__val = v == null ? '' : String(v); el.setAttribute(name, el.__val); continue; }
        if (BOOL[ln]) { if (v) el.setAttribute(name, ''); else el.removeAttribute(name); if (ln === 'checked') el.__chk = !!v; continue; }
        if (ln.indexOf('aria-') === 0 || ln.indexOf('data-') === 0) { if (v == null) el.removeAttribute(name); else el.setAttribute(name, String(v)); continue; }
        if (v == null || v === false) { el.removeAttribute(name); continue; }
        el.setAttribute(name, v === true ? '' : String(v));
      } else {
        el.setAttribute(name, interp(raw, scope));
      }
    }
    var kids = [];
    for (var ch = node.firstChild; ch; ch = ch.nextSibling) render(ch, scope, kids);
    for (var q = 0; q < kids.length; q++) el.appendChild(kids[q]);
    out.push(el);
  }

  function hush(node) { if (node && node.nodeType === 1) { var ms = /^(audio|video)$/.test(node.localName) ? [node] : node.querySelectorAll('audio,video'); for (var i = 0; i < ms.length; i++) try { ms[i].pause(); } catch (e) {} } }
  function sameAttrs(o, n) {
    if (/^(audio|video)$/.test(o.localName) && o.getAttribute('src') !== n.getAttribute('src')) hush(o);
    var na = n.attributes, oa = o.attributes, i;
    for (i = oa.length - 1; i >= 0; i--) { var nm = oa[i].name; if (!n.hasAttribute(nm)) o.removeAttribute(nm); }
    for (i = 0; i < na.length; i++) { if (o.getAttribute(na[i].name) !== na[i].value) o.setAttribute(na[i].name, na[i].value); }
  }
  function morphNode(o, n) {
    if (o.nodeType === 3) { if (o.data !== n.data) o.data = n.data; return; }
    sameAttrs(o, n);
    o.__dc = n.__dc;
    if (n.__val !== undefined && o.value !== n.__val && document.activeElement !== o) o.value = n.__val;
    if (n.__chk !== undefined && o.checked !== n.__chk) o.checked = n.__chk;
    morphChildren(o, Array.prototype.slice.call(n.childNodes));
  }
  function same(o, n) {
    return o.nodeType === n.nodeType && (o.nodeType !== 1 || (o.localName === n.localName && o.namespaceURI === n.namespaceURI));
  }
  function morphChildren(parent, list) {
    var olds = parent.childNodes, i;
    for (i = 0; i < list.length; i++) {
      var o = olds[i], n = list[i];
      if (!o) parent.appendChild(n);
      else if (same(o, n)) morphNode(o, n);
      else { hush(o); parent.replaceChild(n, o); }
    }
    while (parent.childNodes.length > list.length) { hush(parent.lastChild); parent.removeChild(parent.lastChild); }
  }

  var root, tpl = [], comp, pending = false, rendering = false;
  function schedule() { if (pending) return; pending = true; Promise.resolve().then(update); }
  function update() {
    pending = false; if (rendering) { schedule(); return; }
    rendering = true;
    try {
      var vals = comp.renderVals() || {}, out = [];
      for (var i = 0; i < tpl.length; i++) render(tpl[i], [vals], out);
      morphChildren(root, out);
    } catch (e) { console.error(e); }
    rendering = false;
  }

  function dispatch(e) {
    var stopped = false, sp = e.stopPropagation;
    e.stopPropagation = function () { stopped = true; sp.call(e); };
    for (var el = e.target; el && el !== document; el = el.parentNode) {
      var h = el.__dc && el.__dc[e.type];
      if (h) { try { h.call(el, e); } catch (err) { console.error(err); } if (stopped) break; }
    }
  }

  function boot() {
    var x = document.querySelector('x-dc');
    if (!x) return;
    var helmet = x.querySelector('helmet');
    if (helmet) { while (helmet.firstChild) document.head.appendChild(helmet.firstChild); helmet.parentNode.removeChild(helmet); }
    while (x.firstChild) tpl.push(x.removeChild(x.firstChild));
    root = x;
    var sEl = document.querySelector('script[data-dc-script]');
    var Comp = new Function('DCLogic', sEl.textContent + '\n;return Component;')(DCLogic);
    comp = new Comp({});
    comp.state = Object.assign({}, comp.state || {}, load());
    loadBig(comp);
    ['click', 'input', 'change', 'submit', 'keydown', 'keyup', 'focus', 'blur', 'dblclick', 'pointerdown', 'pointerup'].forEach(function (t) { document.addEventListener(t, dispatch, t === 'focus' || t === 'blur'); });
    update();
    x.style.display = 'block';
    x.style.visibility = 'visible';
    if (typeof comp.componentDidMount === 'function') try { comp.componentDidMount(); } catch (e) { console.error(e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
