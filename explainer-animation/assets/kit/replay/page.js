/* The replay page: masthead, player card with scrubber and break, sticky mini bar, stat cards, the
   panels, the controls cards, footer. One clock; every view is a pure function of it.

     EXK.replay.mount(story, derived)   builds the page into the template's static structure
     EXK.boot()                         validates, normalizes, derives, mounts (replaces the P0 stub)

   Exposes window.replay = { duration, events, derived, seek, play, pause, state }.
   No GSAP: plain DOM and SVG attribute updates driven by the clock. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  var R = EXK.replay = EXK.replay || {};

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function $(id) { return document.getElementById(id); }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
  var VIS = ['blind', 'logged', 'alerted'];
  var VLAB = { blind: 'Blind', logged: 'Logged', alerted: 'Alerted' };

  function mount(story, D) {
    var fmt = R.fmt, DAY = fmt.DAY;
    var meta = story.meta || {};
    var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    function reduced() { return reduceMq.matches; }

    var EV = D.events, PRE = D.pre, PH = D.phases.filter(function (p) { return p.n > 0; });
    var BREAKS = D.clock.breaks, duration = D.duration, rToT = D.clock.rToT, rOfT = D.clock.rOfT, idxAt = D.clock.idxAt;
    var steps = story.steps || [], NSTEP = steps.length, stepsBy = {}, phaseBy = {};
    steps.forEach(function (s) { stepsBy[s.id] = s; });
    D.phases.forEach(function (p) { phaseBy[p.id] = p; });
    var ATT_TOTAL = D.totals.attacker, N_TOTAL = D.totals.actions, SYS_TOTAL = D.totals.systemsTotal;
    var ILL = EXK.provenance.illustrative(story), ILL_ALL = !!(meta.source && meta.source.kind === 'illustrative');
    var NONE_PHASE = { title: '', tag: '', desc: '', hue: '#8b98ad' };
    function phaseOf(e) { return e && e.pi >= 0 ? D.phases[e.pi] : NONE_PHASE; }

    /* graph: laid out from the story, drawn into the panel */
    var G = R.layoutGraph(story, D);
    G.warnings.forEach(function (w) { if (typeof console !== 'undefined') console.warn('replay: ' + w); });
    function nameOf(id) { return G.S[id] ? G.S[id].name : id; }
    function takesPart(e, id) { return e.nodes.indexOf(id) >= 0; }
    function boundaryOf(p) { return p && p.boundaryId && G.S[p.boundaryId] ? (G.S[p.boundaryId].frameLabel || nameOf(p.boundaryId)) : ''; }

    var clock = 0, playing = false, speed = 1, lastTs = 0, raf = 0, rmTimer = 0, ci = -2;
    var openEv = -1, filterVis = 'all', nodeFilter = null, cardId = null, opener = null;

    function setClock(x) { clock = clamp(x, 0, duration); render(); }
    function frame(ts) {
      if (!playing) return;
      var dt = Math.min(0.1, Math.max(0, (ts - lastTs) / 1000)); lastTs = ts;
      setClock(clock + dt * speed);
      if (clock >= duration - 1e-6) { pause(); return; }
      raf = requestAnimationFrame(frame);
    }
    function writeHash() {
      var hs = '#t=' + clock.toFixed(1);
      try { history.replaceState(null, '', location.pathname + location.search + hs); } catch (e) { location.hash = hs; }
    }
    function play() {
      if (playing) return;
      if (clock >= duration - 1e-6) setClock(0);
      playing = true; syncPlay();
      if (reduced()) { rmStep(); return; }
      lastTs = performance.now(); raf = requestAnimationFrame(frame);
    }
    function pause() { playing = false; cancelAnimationFrame(raf); clearTimeout(rmTimer); syncPlay(); writeHash(); }
    function rmStep() {   /* reduced motion: one event at a time, no in-between animation */
      if (!playing) return;
      var nx = nextEvent();
      if (!nx) { setClock(duration); pause(); return; }
      setClock(nx.r);
      rmTimer = setTimeout(rmStep, 1500 / speed);
    }
    function jumpTo(x) { setClock(x); writeHash(); }
    function nextEvent() { for (var j = 0; j < EV.length; j++) if (EV[j].r > clock + 1e-6) return EV[j]; return null; }
    function prevEvent() { for (var j = EV.length - 1; j >= 0; j--) if (EV[j].r < clock - 1e-6) return EV[j]; return null; }
    function stepEvent(d) {
      var e = d > 0 ? nextEvent() : prevEvent();
      if (e) jumpTo(e.r); else if (d < 0) jumpTo(0); else jumpTo(duration);
    }
    function phaseIdxNow() { var k = -1; PH.forEach(function (p, j) { if (p.first <= clock + 1e-6) k = j; }); return k; }
    function stepPhase(d) {
      var k = phaseIdxNow();
      if (d > 0) { if (k + 1 < PH.length) jumpTo(PH[k + 1].first); else jumpTo(duration); }
      else { if (k >= 0 && clock > PH[k].first + 0.05) jumpTo(PH[k].first); else if (k > 0) jumpTo(PH[k - 1].first); else jumpTo(0); }
    }
    function restart() { pause(); setClock(0); writeHash(); }

    /* ======== static page parts ======== */
    var illTitle = ILL_ALL ? 'Every event, time and number on this page is invented for illustration' : 'Some of the records on this page are illustrative';
    Array.prototype.forEach.call(document.querySelectorAll('.chip.ill'), function (c) { c.hidden = !ILL.length; c.title = illTitle; });
    $('kick').textContent = 'Incident replay' + (meta.incidentRef ? ' · ' + meta.incidentRef : '') + ' · reconstructed from ' + fmt.n(N_TOTAL) + ' actions';
    (function () {
      var t = $('ttl'), title = meta.title || '', i = meta.accent ? title.indexOf(meta.accent) : -1;
      if (i < 0) t.textContent = title;
      else {
        t.appendChild(document.createTextNode(title.slice(0, i))); t.appendChild(h('em', null, meta.accent));
        t.appendChild(document.createTextNode(title.slice(i + meta.accent.length)));
      }
      document.title = 'Incident replay: ' + title + (ILL.length ? ' (illustrative)' : '');
    })();
    $('tag').textContent = meta.tagline || '';
    $('tag').hidden = !meta.tagline;
    [['span', fmt.short(D.span)], ['actions', fmt.n(N_TOTAL)], ['systems reached', D.totals.systemsReached + ' of ' + SYS_TOTAL]]
      .concat(D.firstAlertSeconds != null ? [['to first alert', fmt.short(D.firstAlertSeconds)]] : []).forEach(function (c) {
        var s = h('span', 'sc'); s.appendChild(h('b', null, c[1])); s.appendChild(document.createTextNode(c[0])); $('chips').appendChild(s);
      });
    var speedEls = [];
    [0.5, 1, 2, 4].forEach(function (s) {
      var b = h('button', null, s + 'x'); b.type = 'button'; b.setAttribute('aria-label', 'Speed ' + s + ' times'); b.setAttribute('aria-pressed', s === 1 ? 'true' : 'false');
      b.addEventListener('click', function () { speed = s; speedEls.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
      $('speeds').appendChild(b); speedEls.push(b);
    });
    function vmark(v) { return h('i', 'vg ' + v); }
    (function legend() {
      var l = $('legend');
      VIS.forEach(function (v) {
        var s = h('span'); s.appendChild(vmark(v));
        s.appendChild(document.createTextNode(v === 'blind' ? 'blind: nothing recorded' : v === 'logged' ? 'logged: nobody looked' : 'alerted')); l.appendChild(s);
      });
    })();
    $('stopl').textContent = 'cut points computed from the events';
    (function foot() {
      var f = $('foot');
      var redaction = meta.redaction && !/^none\.?$/i.test(meta.redaction) ? ' Redacted: ' + meta.redaction : '';
      if (ILL.length) f.appendChild(h('p', null, (ILL_ALL ? 'Illustrative data. This record is invented to explain how an incident of this kind unfolds; no real organisation, system, address or time is shown.'
        : 'Some of the records on this page are illustrative and are marked as such in the story file.') + redaction));
      else if (redaction) f.appendChild(h('p', null, redaction.trim()));
      f.appendChild(h('p', null, 'Marks: a hollow circle is an action nothing recorded, a half circle one that was logged but not looked at, a solid circle one that raised an alert. The hatched break is a long silence compressed on screen; the clock runs through it at speed.'));
    })();

    /* ---- scrubbers: the player card and the sticky bar are two views of the same clock ---- */
    var PADX = 10, SCR = [];
    function makeScrub(host, id, label) {
      var o = { host: host };
      var tr = h('div', 'track'), rl = h('div', 'rail'), fl = h('div', 'fill'), hd = h('div', 'shead');
      hd.id = id; hd.tabIndex = 0; hd.setAttribute('role', 'slider'); hd.setAttribute('aria-label', label); hd.setAttribute('aria-orientation', 'horizontal');
      hd.setAttribute('aria-valuemin', '0'); hd.setAttribute('aria-valuemax', String(Math.round(duration)));
      tr.appendChild(rl); tr.appendChild(fl); tr.appendChild(hd); host.appendChild(tr);
      o.track = tr; o.rail = rl; o.fill = fl; o.head = hd; SCR.push(o);
      tr.addEventListener('pointerdown', function (e) { startDrag(o, e); });
      tr.addEventListener('pointermove', function (e) { moveDrag(o, e); });
      tr.addEventListener('pointerup', function (e) { endDrag(o, e); });
      tr.addEventListener('pointercancel', function (e) { endDrag(o, e); });
      hd.addEventListener('keydown', headKey);
      return o;
    }
    function wOf(o) { return Math.max(1, o.host.clientWidth - 2 * PADX); }
    function xIn(o, x) { return PADX + x / duration * wOf(o); }
    function rIn(o, clientX) { return clamp((clientX - o.host.getBoundingClientRect().left - PADX) / wOf(o) * duration, 0, duration); }

    var scrubEl = $('scrub'), miniEl = $('smini');
    var bandEls = PH.map(function (p) {
      var b = h('div', 'band'); b.style.background = p.hue + '24'; b.style.borderLeftColor = p.hue; b.style.color = p.hue;
      b.title = p.title; b.appendChild(h('span', null, p.title)); scrubEl.appendChild(b); return b;
    });
    var brkEls = BREAKS.map(function (bk) {
      var d = h('div', 'brk'); scrubEl.appendChild(d);
      var l = h('div', 'brkl', fmt.long(bk.t1 - bk.t0) + ' later'); scrubEl.appendChild(l);
      return { el: d, lab: l, bk: bk };
    });
    var mkEls = EV.map(function (e) { var m = h('div', 'mk ' + e.visibility); m.style.display = 'none'; scrubEl.appendChild(m); return m; });
    var axEls = [];
    (function buildAxis() {
      var list = [], starts = [D.tFirst];
      BREAKS.forEach(function (b) { starts.push(b.t1); });
      starts.forEach(function (st, j) {
        var end = j < BREAKS.length ? BREAKS[j].t0 : D.tLast, step = (end - st) > 600 ? 300 : 60;
        for (var t = st; t <= end + 1e-6; t += step) list.push({ t: t, label: (j === 0 || t === st) ? fmt.axis(t) : '+' + Math.round((t - st) / 60) + 'm' });
      });
      list.forEach(function (a) { var d = h('div', 'ax', a.label); d.setAttribute('aria-hidden', 'true'); scrubEl.appendChild(d); axEls.push({ el: d, a: a }); });
    })();
    var mainS = makeScrub(scrubEl, 'head', 'Replay clock');
    var pl = h('div'); pl.id = 'pl'; scrubEl.appendChild(pl);
    var miniS = makeScrub(miniEl, 'mhead', 'Replay clock, compact player');
    var mBrk = BREAKS.map(function () { var b = h('div', 'brk'); miniEl.insertBefore(b, miniS.track); return b; });
    function layoutScrub() {
      var w = scrubEl.clientWidth; if (!w) return;
      bandEls.forEach(function (b, j) {
        var p = PH[j], l = Math.round(xIn(mainS, p.first)), r2 = Math.round(xIn(mainS, p.last));
        b.style.left = l + 'px'; b.style.width = Math.max(8, r2 - l) + 'px';
        var sp = b.firstChild; sp.textContent = p.title; if (sp.offsetWidth + 2 > b.offsetWidth) sp.textContent = p.tag;
        sp.style.display = ''; if (sp.offsetWidth + 2 > b.offsetWidth) sp.style.display = 'none';
      });
      var obst = [];
      brkEls.forEach(function (o) {
        var l = Math.round(xIn(mainS, o.bk.r0)), r2 = Math.round(xIn(mainS, o.bk.r1));
        o.el.style.left = l + 'px'; o.el.style.width = (r2 - l) + 'px';
        o.lab.style.left = Math.round((l + r2) / 2) + 'px';
        var wd = o.lab.offsetWidth, cx = (l + r2) / 2; obst.push([cx - wd / 2 - 8, cx + wd / 2 + 8]);
      });
      var axEnd = -1e9;
      axEls.forEach(function (o) {
        var x = Math.round(xIn(mainS, rOfT(o.a.t))), wd = o.el.offsetWidth;
        var ok = x > axEnd + 8 && x + wd < w && !obst.some(function (b) { return x < b[1] && x + wd > b[0]; });
        o.el.style.display = ok ? '' : 'none';
        if (ok) axEnd = x + wd;
        o.el.style.left = x + 'px';
      });
      EV.forEach(function (e, i) { mkEls[i].style.left = Math.round(xIn(mainS, e.r)) + 'px'; });
      mainS.rail.style.left = PADX + 'px'; mainS.rail.style.width = wOf(mainS) + 'px'; mainS.fill.style.left = PADX + 'px';
      miniS.rail.style.left = PADX + 'px'; miniS.rail.style.width = wOf(miniS) + 'px'; miniS.fill.style.left = PADX + 'px';
      mBrk.forEach(function (b, j) { var l = Math.round(xIn(miniS, BREAKS[j].r0)), r2 = Math.round(xIn(miniS, BREAKS[j].r1)); b.style.left = l + 'px'; b.style.width = (r2 - l) + 'px'; });
      placeHead();
    }
    function placeHead() {
      SCR.forEach(function (o) {
        var x = xIn(o, clock);
        o.head.style.transform = 'translateX(' + (x - 7).toFixed(1) + 'px)';
        o.fill.style.width = Math.max(0, x - PADX).toFixed(1) + 'px';
      });
      pl.style.left = (xIn(mainS, clock) - 1).toFixed(1) + 'px';
    }

    /* drag a playhead: every pointer move sets the clock (at most once per animation frame) */
    var dragging = null, pendR = null, dragRaf = 0, grab = 0;
    function flushDrag() { dragRaf = 0; if (pendR == null) return; var x = pendR; pendR = null; setClock(x); }
    function startDrag(o, e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      if (playing) pause();
      closeCard(false);
      dragging = o; o.track.classList.add('drag');
      try { o.track.setPointerCapture(e.pointerId); } catch (x) { /* moves are still seen while over the track */ }
      var hr = o.head.getBoundingClientRect();
      grab = e.target === o.head ? (hr.left + hr.width / 2) - e.clientX : 0;
      o.head.focus({ preventScroll: true });
      pendR = rIn(o, e.clientX + grab); flushDrag();
    }
    function moveDrag(o, e) {
      if (dragging !== o) return;
      pendR = rIn(o, e.clientX + grab);
      if (!dragRaf) dragRaf = requestAnimationFrame(flushDrag);
    }
    function endDrag(o, e) {
      if (dragging !== o) return;
      if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
      if (e && e.type === 'pointerup') pendR = rIn(o, e.clientX + grab);
      flushDrag();
      dragging = null; o.track.classList.remove('drag');
      try { o.track.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
      writeHash();
    }
    function headKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var c = e.code, used = true;
      if (c === 'ArrowRight' || c === 'ArrowUp') { if (e.shiftKey) stepPhase(1); else { pause(); jumpTo(clock + 1); } }
      else if (c === 'ArrowLeft' || c === 'ArrowDown') { if (e.shiftKey) stepPhase(-1); else { pause(); jumpTo(clock - 1); } }
      else if (c === 'PageDown') stepEvent(1);
      else if (c === 'PageUp') stepEvent(-1);
      else if (c === 'Home') restart();
      else if (c === 'End') { pause(); jumpTo(duration); }
      else if (c === 'Space' || c === 'Enter') { if (playing) pause(); else play(); }
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    }

    /* ---- the graph ---- */
    var gsvg = $('gsvg');
    gsvg.setAttribute('aria-label', 'Attack chain graph: ' + G.order.length + ' systems in trust zones');
    var gH = R.buildGraph(gsvg, G), lastLight = null;

    /* ---- stat cards, narrative, phase rows, stream, activity chart, controls ---- */
    function setStat(id, label, val, sub, cls) {
      var c = $(id); c.innerHTML = '';
      c.appendChild(h('div', 'meta', label));
      c.appendChild(h('div', 'val' + (cls ? ' ' + cls : ''), val));
      c.appendChild(h('div', 'sub', sub));
    }
    function renderStats() {
      var p = ci >= 0 ? PRE[ci] : { n: 0, att: 0, vis: [0, 0, 0], reached: 0, boundaryId: null };
      setStat('sAct', 'Attacker actions replayed', fmt.n(p.att), 'of ' + fmt.n(ATT_TOTAL) + ' total · ' + (ci + 1) + ' of ' + EV.length + ' log lines', p.att ? '' : 'zero');
      var ph = ci >= 0 ? phaseOf(EV[ci]) : null;
      setStat('sPhase', 'Active phase', ph ? ph.title : 'Not started', ph ? ph.desc : 'press Play to start the clock');
      setStat('sBlast', 'Blast radius', p.reached ? boundaryOf(p) : 'nothing yet', p.reached + ' of ' + SYS_TOTAL + ' systems reached');
    }
    function stepText(s) { return s ? (s.detail || s.body || '') : ''; }
    function renderNarr() {
      var n = $('narr'); n.innerHTML = '';
      var st = ci >= 0 ? EV[ci].stepIndex : 0;
      if (!st) {
        n.appendChild(h('div', 'meta ey', 'The incident'));
        var p0 = h('p'); p0.appendChild(h('b', null, meta.title || '')); p0.appendChild(document.createTextNode(meta.tagline || '')); n.appendChild(p0);
        return;
      }
      var s = steps[st - 1], ph = phaseBy[s.phase];
      n.appendChild(h('div', 'meta ey', 'Step ' + st + ' of ' + NSTEP + (ph ? ' · ' + ph.title : '')));
      var p = h('p'); p.appendChild(h('b', null, s.title)); p.appendChild(document.createTextNode(stepText(s))); n.appendChild(p);
    }
    /* phase rows */
    var prowEls = PH.map(function (p, j) {
      var b = h('button', 'prow2'); b.type = 'button'; b.style.setProperty('--h', p.hue);
      b.setAttribute('aria-label', 'Phase ' + (j + 1) + ': ' + p.title + '. Jump to its start.');
      var r1 = h('span', 'pr1'); r1.appendChild(h('span', 'pn', p.title)); var pc = h('span', 'pc num', '0'); r1.appendChild(pc);
      b.appendChild(r1); b.appendChild(h('span', 'pd', p.desc));
      var tr = h('span', 'tr'), fi = h('i'); tr.appendChild(fi); b.appendChild(tr);
      var t2 = h('span', 'tr2'), marks = p.events.map(function (e) {
        var m = h('b', e.visibility); m.style.left = (e.r / duration * 100).toFixed(2) + '%'; t2.appendChild(m); return m;
      });
      b.appendChild(t2);
      b.addEventListener('click', function () { jumpTo(p.first); });
      $('phases').appendChild(b);
      return { el: b, pc: pc, fill: fi, marks: marks };
    });
    function renderPhases() {
      PH.forEach(function (p, j) {
        var o = prowEls[j], cnt = 0;
        p.events.forEach(function (e, k) { var on = e.i <= ci; if (on) cnt += e.count; if (o.marks[k].classList.contains('on') !== on) o.marks[k].classList.toggle('on', on); });
        o.pc.textContent = fmt.n(cnt);
        o.el.classList.toggle('dim', clock < p.first - 1e-9);
        var a = p.first / duration * 100, e2 = clamp(Math.min(clock, p.last), p.first, p.last) / duration * 100;
        o.fill.style.left = a.toFixed(2) + '%'; o.fill.style.width = (clock < p.first ? 0 : Math.max(0.4, e2 - a)).toFixed(2) + '%';
      });
    }
    function visible(e) { return (filterVis === 'all' || e.visibility === filterVis) && (!nodeFilter || takesPart(e, nodeFilter)); }
    var lastStreamKey = '';
    function renderStream(force) {
      var key = ci + '|' + filterVis + '|' + nodeFilter + '|' + openEv;
      if (!force && key === lastStreamKey) return;
      lastStreamKey = key;
      var ol = $('stream'), keepTop = ol.scrollTop; ol.innerHTML = '';
      var shown = 0;
      for (var j = ci; j >= 0; j--) {
        var e = EV[j]; if (!visible(e)) continue;
        shown++;
        var li = h('li', j === ci ? 'cur' : ''), b = h('button', 'ln'); b.type = 'button';
        b.setAttribute('aria-label', 'Jump to ' + fmt.T(e.t) + ', ' + VLAB[e.visibility] + ', ' + nameOf(e.from) + ' to ' + nameOf(e.to) + ': ' + e.action + '. ' + (e.note || ''));
        var r1 = h('span', 'r1'); r1.appendChild(h('span', 'when', fmt.T(e.t)));
        var ph = phaseOf(e), tg = h('span', 'ptag', ph.tag); tg.style.setProperty('--h', ph.hue); r1.appendChild(tg);
        r1.appendChild(h('span', 'act', e.action));
        if (e.count > 1) r1.appendChild(h('span', 'cnt', '×' + fmt.n(e.count)));
        var vm = h('span', 'vm'); vm.appendChild(vmark(e.visibility)); vm.appendChild(document.createTextNode(e.visibility === 'alerted' ? 'alert' : e.visibility)); r1.appendChild(vm);
        b.appendChild(r1); if (e.note) b.appendChild(h('span', 'r2', '↳ ' + e.note));
        (function (ee) { b.addEventListener('click', function () { openEv = ee.i; jumpTo(ee.r); }); })(e);
        li.appendChild(b); ol.appendChild(li);
      }
      if (!shown) ol.appendChild(h('li', 'empty', ci < 0 ? 'Nothing yet. Actions appear here as the clock reaches them, newest at the top.' : 'No actions so far match this filter.'));
      ol.scrollTop = keepTop;
      $('smeta').textContent = ci < 0 ? 'representative actions, as recorded' : shown + ' shown · ' + (ci + 1) + ' of ' + EV.length + ' so far';
    }
    function renderFilters() {
      var f = $('filters'); f.innerHTML = '';
      [['all', 'All'], ['blind', 'Blind'], ['logged', 'Logged'], ['alerted', 'Alerted']].forEach(function (o) {
        var b = h('button', 'f'); b.type = 'button'; b.setAttribute('aria-pressed', filterVis === o[0] ? 'true' : 'false');
        if (o[0] !== 'all') b.appendChild(vmark(o[0]));
        b.appendChild(document.createTextNode(o[1]));
        b.addEventListener('click', function () { filterVis = o[0]; renderFilters(); renderStream(); });
        f.appendChild(b);
      });
      var chip = h('span'); chip.id = 'nodechip'; chip.hidden = !nodeFilter;
      if (nodeFilter) {
        chip.appendChild(document.createTextNode('System: ' + nameOf(nodeFilter)));
        var x = h('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove the system filter: ' + nameOf(nodeFilter));
        x.addEventListener('click', function () { setNodeFilter(null); }); chip.appendChild(x);
      }
      f.appendChild(chip);
    }
    function setNodeFilter(id) { nodeFilter = id; renderFilters(); renderStream(true); }

    /* activity chart: actions per bucket of replay time, stacked by visibility, with the break drawn where the silence is */
    var chartEl = $('chart'), barEls = [];
    (function buildChart() {
      var B = D.buckets, H = 120;
      BREAKS.forEach(function (bk) {
        var g = h('div', 'gap'); g.style.left = (bk.r0 / duration * 100) + '%'; g.style.width = ((bk.r1 - bk.r0) / duration * 100) + '%';
        g.appendChild(h('span', null, fmt.long(bk.t1 - bk.t0) + ' later')); chartEl.appendChild(g);
      });
      B.data.forEach(function (d, b) {
        var tot = B.totals[b];
        if (!tot) return;
        var bar = h('div', 'bar'), ht = Math.max(3, Math.sqrt(tot / B.max) * H);
        bar.style.left = (b * B.size / duration * 100) + '%'; bar.style.width = 'calc(' + (B.size / duration * 100) + '% - 2px)'; bar.style.height = ht.toFixed(1) + 'px';
        VIS.forEach(function (v, k) { if (d[k]) { var s = h('i', v); s.style.height = (d[k] / tot * 100).toFixed(2) + '%'; bar.appendChild(s); } });
        bar.title = fmt.n(tot) + ' actions';
        chartEl.appendChild(bar); barEls.push({ el: bar, r0: b * B.size, on: false });
      });
      var phl = h('div', 'phl'); chartEl.appendChild(phl); barEls.line = phl;
      var nb = BREAKS.length + 1;
      $('acap').textContent = (nb < NUMW.length ? NUMW[nb] : nb) + ' burst' + (nb === 1 ? '' : 's') + '; ' + fmt.n(D.totals.blind) + ' actions unrecorded';
      var cax = $('cax'), stepS = duration > 60 ? 20 : 10;
      for (var s = 0; s <= duration; s += stepS) { var sp = h('span', null, s + 's'); sp.style.left = (s / duration * 100) + '%'; cax.appendChild(sp); }
    })();

    /* controls panel */
    var ctlEls = [];
    (function buildControls() {
      var ul = $('ctls');
      if (!D.cuts.length) $('stop').hidden = true;
      D.cuts.forEach(function (c) {
        var li = h('li'), b = h('button', 'cc'); b.type = 'button';
        var nm = h('span', 'nm'); if (c.badge) nm.appendChild(h('span', 'sh', c.badge)); nm.appendChild(document.createTextNode(c.name)); b.appendChild(nm);
        b.appendChild(h('span', 'why', c.why));
        var at = h('span', 'at'); at.appendChild(document.createTextNode('stops it at attacker action ')); at.appendChild(h('b', 'num', fmt.n(c.at))); at.appendChild(document.createTextNode(' of ' + fmt.n(ATT_TOTAL))); b.appendChild(at);
        var pr = h('span', 'pr'), pi = h('i'); pi.style.width = (c.prevented / ATT_TOTAL * 100).toFixed(1) + '%'; pr.appendChild(pi); b.appendChild(pr);
        b.appendChild(h('span', 'pl2', fmt.n(c.later) + ' later actions prevented'));
        b.addEventListener('click', function () { openEv = c.ev.i; jumpTo(c.ev.r); });
        li.appendChild(b); ul.appendChild(li); ctlEls.push({ li: li, btn: b, cut: c });
      });
    })();

    /* ======== render: every view is a function of the clock ======== */
    var lastStep = -2;
    function render() {
      var nci = idxAt(clock), changed = nci !== ci;
      ci = nci;
      var t = rToT(clock), day = Math.floor(t / DAY) + 1, days = D.days;
      $('clock').textContent = fmt.T(t); $('sclock').textContent = fmt.T(t);
      $('day').textContent = 'Day ' + day + ' of ' + days;
      placeHead();
      SCR.forEach(function (o) {
        o.head.setAttribute('aria-valuenow', String(Math.round(clock * 10) / 10));
        o.head.setAttribute('aria-valuetext', fmt.T(t) + ', day ' + day + ' of ' + days + (ci >= 0 ? ', event ' + (ci + 1) + ' of ' + EV.length : ', before the first event'));
      });
      barEls.forEach(function (b) { var on = b.r0 <= clock + 1e-9; if (on !== b.on) { b.on = on; b.el.classList.toggle('past', on); } });
      barEls.line.style.left = 'calc(' + (clock / duration * 100) + '% - 1px)';
      renderPhases();
      lastLight = R.light(D, ci, clock);
      R.paintGraph(gH, lastLight);
      if (changed) {
        renderStats(); renderNarr();
        ctlEls.forEach(function (c) {
          var lit = c.cut.ev.i <= ci; c.li.classList.toggle('lit', lit);
          c.btn.setAttribute('aria-label', c.cut.name + '. Stops it at attacker action ' + c.cut.at + ' of ' + ATT_TOTAL + (lit ? '. Reached.' : '. Not reached yet.'));
        });
        var st = ci >= 0 ? EV[ci].stepIndex : 0;
        if (st !== lastStep) { lastStep = st; if (st) $('live').textContent = 'Step ' + st + ' of ' + NSTEP + ': ' + steps[st - 1].title; }
        Object.keys(gH.nodes).forEach(function (id) {
          var on = !!lastLight.nodes[id], n = G.S[id];
          gH.nodes[id].g.setAttribute('aria-label', n.name + ', ' + n.tag + (on ? '. Reached.' : '. Not reached yet.') + ' Show details and filter the stream.');
        });
      }
      renderStream();
    }
    function syncPlay() {
      var ic = playing ? '&#10074;&#10074;' : '&#9654;';
      $('playic').innerHTML = ic; $('splay').firstChild.innerHTML = ic;
      var lab = playing ? 'Pause' : (clock >= duration - 1e-6 ? 'Replay from the start' : 'Play');
      $('play').setAttribute('aria-label', lab); $('splay').setAttribute('aria-label', lab);
    }
    $('play').addEventListener('click', function () { if (playing) pause(); else play(); });
    $('splay').addEventListener('click', function () { if (playing) pause(); else play(); });
    $('restart').addEventListener('click', restart);

    /* sticky mini bar: shown when the player card has scrolled out of view */
    function syncSticky() { $('sbar').classList.toggle('on', $('player').getBoundingClientRect().bottom < 0); }
    window.addEventListener('scroll', syncSticky, { passive: true });

    /* ======== system card: a popover anchored to the node clicked ======== */
    var pop = $('pop');
    function eventsFor(id) { return EV.filter(function (e) { return takesPart(e, id); }); }
    function positionPop() {
      if (!cardId) return;
      var wr = $('chain').getBoundingClientRect(), r2 = gH.nodes[cardId].g.getBoundingClientRect();
      var W = wr.width, H = wr.height, M = 4, Gp = 12;
      var Rc = { l: r2.left - wr.left, t: r2.top - wr.top, r: r2.right - wr.left, b: r2.bottom - wr.top };
      var pw = pop.offsetWidth, ph = pop.offsetHeight, cx = (Rc.l + Rc.r) / 2, cy = (Rc.t + Rc.b) / 2;
      var cands = [[Rc.r + Gp, cy - ph / 2], [Rc.l - Gp - pw, cy - ph / 2], [cx - pw / 2, Rc.b + Gp], [cx - pw / 2, Rc.t - Gp - ph]];
      var best = null, bestOv = Infinity;
      cands.forEach(function (c) {
        var l = clamp(c[0], M, W - pw - M), t = clamp(c[1], M, H - ph - M);
        var ox = Math.max(0, Math.min(l + pw, Rc.r + 4) - Math.max(l, Rc.l - 4)), oy = Math.max(0, Math.min(t + ph, Rc.b + 4) - Math.max(t, Rc.t - 4));
        var ov = ox * oy;
        if (ov < bestOv) { bestOv = ov; best = [l, t]; }
      });
      pop.style.left = Math.round(best[0]) + 'px'; pop.style.top = Math.round(best[1]) + 'px';
    }
    function markEvents() {
      var set = {}; if (cardId) eventsFor(cardId).forEach(function (e) { set[e.i] = 1; });
      EV.forEach(function (e, i) { mkEls[i].style.display = set[i] ? '' : 'none'; });
    }
    var sysBy = {}; (story.systems || []).forEach(function (s) { sysBy[s.id] = s; });
    function cardText(s) {
      var d = s.detail;
      if (d && typeof d === 'object') return [d.what, d.did].filter(Boolean).join(' ');
      return d || s.role || '';
    }
    function renderCard() {
      pop.innerHTML = '';
      pop.classList.toggle('on', !!cardId);
      R.setSelected(gH, cardId);
      markEvents();
      if (!cardId) return;
      var id = cardId, s = sysBy[id];
      var ch = h('div', 'ch');
      ch.appendChild(h('span', 'meta', 'System'));
      var x = h('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close details');
      x.addEventListener('click', function () { closeCard(true); });
      ch.appendChild(x); pop.appendChild(ch);
      var t = h('h3', null, nameOf(id)); t.tabIndex = -1; t.id = 'cardTitle'; pop.appendChild(t);
      pop.setAttribute('aria-labelledby', 'cardTitle');
      pop.appendChild(h('p', null, cardText(s)));
      var es = eventsFor(id);
      pop.appendChild(h('p', 'meta', es.length ? 'In ' + es.length + ' of ' + EV.length + ' events (marked on the scrubber)' : 'In no events'));
    }
    function showNode(id, op) {
      if (!gH.nodes[id]) return;
      cardId = id; opener = op || gH.nodes[id].g;
      setNodeFilter(id);
      renderCard(); positionPop();
      pop.querySelector('h3').focus({ preventScroll: true });
    }
    function closeCard(restoreFocus) {
      if (!cardId) return;
      cardId = null; renderCard();
      if (restoreFocus && opener && document.body.contains(opener)) opener.focus();
      opener = null;
    }
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('pointerdown', function (e) {
      if (cardId && !(e.target.closest && e.target.closest('#pop, .node'))) closeCard(false);
    }, true);
    window.addEventListener('resize', positionPop);
    Object.keys(gH.nodes).forEach(function (id) {
      var g = gH.nodes[id].g;
      g.addEventListener('click', function (e) { e.stopPropagation(); showNode(id, g); });
      g.addEventListener('keydown', function (e) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); showNode(id, g); } });
    });

    /* ======== keyboard and hash ======== */
    function onButton(t) { return t && t.closest && t.closest('button, a, [role="button"], [role="slider"], input, select, textarea'); }
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'ArrowRight') { e.preventDefault(); if (e.shiftKey) stepPhase(1); else stepEvent(1); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); if (e.shiftKey) stepPhase(-1); else stepEvent(-1); }
      else if (e.code === 'Home') { e.preventDefault(); restart(); }
      else if (e.code === 'Escape') { if (cardId) { e.preventDefault(); closeCard(true); } }
      else if (e.code === 'Space' && !onButton(e.target)) { e.preventDefault(); if (playing) pause(); else play(); }
    });
    function hashClock() { var m = /#t=([\d.]+)/.exec(location.hash); return m ? parseFloat(m[1]) : null; }
    window.addEventListener('hashchange', function () { var x = hashClock(); if (x != null && Math.abs(x - clock) > 0.06) setClock(x); });

    var derived = {
      totals: D.totals, spanSeconds: D.span, attackSpanSeconds: D.attackSpan, firstAlertSeconds: D.firstAlertSeconds, days: D.days,
      phases: D.phases.length, steps: NSTEP, breaks: BREAKS.map(function (b) { return { r0: b.r0, r1: b.r1, gap: b.t1 - b.t0 }; }),
      cuts: D.cuts.map(function (c) { return { id: c.id, at: c.at, prevented: c.prevented, later: c.later }; })
    };
    window.replay = {
      duration: duration, events: EV, derived: derived,
      seek: function (x) { if (playing) pause(); setClock(x); writeHash(); },
      play: play, pause: pause,
      state: function () {
        var p = ci >= 0 ? PRE[ci] : { n: 0, att: 0, vis: [0, 0, 0], reached: 0, boundaryId: null };
        return {
          clock: clock, playing: playing, speed: speed, index: ci, actions: p.n, attackActions: p.att, vis: p.vis, reached: p.reached, boundary: boundaryOf(p),
          step: ci >= 0 ? EV[ci].stepIndex : 0, stepId: ci >= 0 ? EV[ci].stepId : null, phase: ci >= 0 ? EV[ci].phase : null, incidentTime: rToT(clock),
          filter: filterVis, nodeFilter: nodeFilter, card: cardId, openEvent: openEv, hash: location.hash,
          lit: Object.keys(lastLight.nodes), litLinks: Object.keys(lastLight.links), now: lastLight.now
        };
      }
    };

    renderFilters();
    layoutScrub();
    if (window.ResizeObserver) new ResizeObserver(function () { layoutScrub(); syncSticky(); }).observe(document.body);
    window.addEventListener('resize', layoutScrub);
    var h0 = hashClock();
    setClock(h0 != null ? h0 : 0);
    syncPlay(); syncSticky();
    document.body.setAttribute('data-ready', 'replay');
    return window.replay;
  }

  function fail(lines) {
    var pre = document.createElement('pre');
    pre.style.cssText = 'margin:24px;padding:16px;border:1px solid #ff5d6c;color:#e6edf7;white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace';
    pre.textContent = lines.join('\n');
    document.body.appendChild(pre);
    document.body.setAttribute('data-ready', 'invalid');
  }

  R.mount = mount;
  EXK.boot = function () {
    var raw = EXK.STORY;
    var problems = EXK.validate(raw, { style: null });
    var errors = problems.filter(function (p) { return p.level === 'error'; });
    EXK.problems = problems;
    if (errors.length) {
      var msgs = errors.map(function (p) { return EXK.formatProblem(p); });
      msgs.forEach(function (m) { console.error(m); });
      fail(['This story has problems the replay cannot show:'].concat(msgs));
      return null;
    }
    var story = EXK.normalize(raw);
    EXK.story = story;
    if (!story.events.length) { fail(['This story has no events, so there is nothing to replay.', 'Add events[] (see references/story.md) and build again.']); return null; }
    var D = R.derive(story);
    EXK.derived = D;
    return mount(story, D);
  };
})();
