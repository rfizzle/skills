/* TEST ONLY: a stub painter and a stub step runner for the P3 scene core (shell, camera, text, timing).
   Loaded with `build.mjs ... --extra scripts/testdata/stub/stub.js`. Draws the story's systems as rectangles in a row
   and its links as straight paths, then runs each step: optional camera move, node labels, one packet along the step's
   first link with a tag, a stationary label at the destination, and (step 2 onwards) a callout and a card.
   It is the shape a real painter (paint/flat.js) and step runner (beats.js) have to fill. */
(function () {
  'use strict';
  var EXK = window.EXK, T = EXK.timing, C = EXK.THEME, NS = 'http://www.w3.org/2000/svg';
  var NW = 240, NH = 132;
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  EXK.painters.flat = function (ctx) {
    var area = ctx.area, nodes = {}, paths = {}, root = null, packets = null;
    var painter = {
      labelPolicy: 'always',
      build: function (estate, story, layers) {
        root = el('svg', { viewBox: '0 0 1920 720', width: 1920, height: 720 }, layers.world);
        var edges = el('g', { 'data-layer': 'edges' }, root);
        packets = el('g', { 'data-layer': 'packets' }, root);
        var nodeLayer = el('g', { 'data-layer': 'nodes' }, root);
        root.insertBefore(nodeLayer, packets);
        var n = story.systems.length;
        story.systems.forEach(function (s, i) {
          var cx = 240 + i * (1440 / Math.max(1, n - 1)), cy = 360;
          nodes[s.id] = { x: cx - NW / 2, y: cy - NH / 2, w: NW, h: NH, cx: cx, cy: cy };
          var g = el('g', { class: 'node' }, nodeLayer);
          el('rect', { 'data-block': s.id, x: cx - NW / 2, y: cy - NH / 2, width: NW, height: NH, rx: 16, fill: C.panel, stroke: C.line, 'stroke-width': 3 }, g);
        });
        story.links.forEach(function (l) {
          var a = nodes[l.from], b = nodes[l.to];
          paths[l.from + '>' + l.to] = el('path', { d: 'M' + a.cx + ',' + a.cy + ' L' + b.cx + ',' + b.cy, fill: 'none', stroke: C.line, 'stroke-width': 6 }, edges);
        });
      },
      applyCamera: function (cam) { root.setAttribute('viewBox', [cam.x, cam.y, cam.w, cam.h].map(function (v) { return v.toFixed(2); }).join(' ')); },
      pathEl: function (id) { return paths[id]; },
      onScreenRange: function () { return { f0: 0, f1: 1, aOff: false, bOff: false }; },
      anchor: function (id, side) {
        var b = nodes[id];
        return side === 'side' ? { x: b.x + b.w, y: b.y } : side === 'right' ? { x: b.x + b.w, y: b.cy } : side === 'left' ? { x: b.x, y: b.cy } : side === 'bottom' ? { x: b.cx, y: b.y + b.h } : side === 'center' ? { x: b.cx, y: b.cy } : { x: b.cx, y: b.y };
      },
      stageRect: function (id, cam) {
        var b = nodes[id], k = area.w / cam.w;
        if (!b) return null;     /* zones: the text layer asks for them too; the stub draws none */
        return { x0: area.x + (b.x - cam.x) * k, y0: area.y + (b.y - cam.y) * k, x1: area.x + (b.x + b.w - cam.x) * k, y1: area.y + (b.y + b.h - cam.y) * k };
      },
      packet: function (spec) {
        var g = el('g', { opacity: 0 }, packets);
        el('circle', { r: 16, fill: spec.color, stroke: C.bg, 'stroke-width': 4 }, g);
        return g;
      },
      focus: function () {}
    };
    return painter;
  };

  EXK.runSteps = function (ctx) {
    var story = ctx.story, tl = ctx.tl, text = ctx.text, camera = ctx.camera, painter = ctx.painter, shell = ctx.shell, area = ctx.area;
    var FULL = { x: 0, y: 0, w: 1920, h: 720 }, ZOOM = { x: 480, y: 90, w: 1440, h: 540 };
    var nameOf = {};
    story.systems.forEach(function (s) { nameOf[s.id] = s.short; });
    camera.set(FULL);
    var out = [], t0 = 0;
    story.steps.forEach(function (st, i) {
      var last = i === story.steps.length - 1, beat = st.beats[0] || {}, chain = beat.chain || st.uses[0];
      var from = chain[0], to = chain[1], rid = from + '>' + to, color = C[beat.color] || C.accent;
      var frame = i === 0 ? FULL : ZOOM, moved = i > 0;
      if (moved) camera.camTo(t0, frame, 1.6);
      var r0 = T.motionStart(moved), t = t0 + r0;
      text.plan(frame, { t0: t0, step: st.id, active: st.touch, routes: [rid] });
      var labels = [from, to].map(function (id) { return text.label(id, nameOf[id], { at: t0, until: Infinity }); });
      var callouts = [];
      if (i > 0) callouts.push(text.callout({ text: 'Asks for the records', target: from, at: t0 + 1.0, color: C.secure }));
      /* one packet along the link, a tag on it, a stationary label at the destination */
      var path = painter.pathEl(rid), rg = painter.onScreenRange(rid, frame, 0);
      var dur = T.hopDuration((rg.f1 - rg.f0) * path.getTotalLength() * area.w / frame.w);
      var pk = painter.packet({ color: color });
      tl.fromTo(pk, { opacity: 0 }, { opacity: 1, duration: 0.01, immediateRender: false }, t);
      tl.to(pk, { motionPath: { path: path, start: rg.f0, end: rg.f1 }, duration: dur, ease: T.PACKET_EASE }, t);
      tl.fromTo(pk, { opacity: 1 }, { opacity: 0, duration: 0.01, immediateRender: false }, t + dur + 0.15);
      text.tag({ packet: pk, label: beat.tag || 'READ', color: color }).hop({ path: path, f0: rg.f0, f1: rg.f1, rev: false, t: t, dur: dur });
      var says = beat.says || 'SELECT * FROM orders';
      var sayUntil = t + dur + T.lastHoldFor(says);
      text.say({ lines: says, node: to, at: t, until: sayUntil, color: color, mono: true });
      var labelEnd = sayUntil + T.LABEL_FADE_OUT;
      if (i > 0) {
        var cardText = 'Records returned: 3 rows', cardAt = t + dur + 0.4, cardUntil = cardAt + T.cardHold(cardText);
        text.card({ title: 'Result', rows: ['3 rows returned'], node: from, at: cardAt, until: cardUntil, color: C.secure });
        labelEnd = Math.max(labelEnd, cardUntil + T.LABEL_FADE_OUT);
      }
      text.emphasis(t, rid, [from, to]);
      text.logHop({ step: st.id, rid: rid, t0: t, t1: t + dur, ends: [from, to] });
      /* the step's length and rest, from the timing rules */
      var end = r0 + dur, len = T.stepEnd({ end: end, labelEnd: labelEnd - t0, firstMotion: r0, bodyWords: T.wordCount(st.body), final: last });
      var tEnd = t0 + len;
      if (!last) {
        labels.concat(callouts).forEach(function (it) { text.vanish(it, tEnd - T.CALLOUT_OUT_LEAD, 0.4); });
      }
      shell.stepChrome(tl, i, t0, tEnd, { bodyAt: T.bodyAt(r0, end) });
      out.push({ id: st.id, phase: st.phase, time: t0, rest: t0 + T.restOf({ len: len, end: end, labelEnd: labelEnd - t0, firstMotion: r0 }), title: st.title, body: st.body });
      t0 = tEnd;
    });
    return { steps: out, duration: t0, moments: [] };
  };
})();
