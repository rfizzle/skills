/* The annotation layer, in stage space: every text item is anchored to a scene point and drawn at a fixed
   stage size (labels, says, callouts 26 px, tags 22 px) whatever the camera scale (PATTERNS.md section 10).
   Placement is a free-space test against an occupancy model fed by painter.stageRect (port of the iso
   placer); every item is registered with a data-ov key; emphasis (section 8) is a list of events turned
   into fromTo tweens in time order; moving tags give way to text (section 6); hooks __overlaps, __hops,
   __layout. Knows nothing about how the painter draws a node. */
(function () {
  'use strict';
  var EXK = window.EXK, T = EXK.timing, C = EXK.THEME;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var LABEL_PX = 26, TAG_PX = 22, TAG_H = 34, TAG_UP = 22, TAG_PAD = 14;
  var SAY_LEADER_MAX = 160;              /* stage px: __overlaps reports a say leader longer than this */
  var MARGIN = 56;                       /* text stays this far inside the diagram area (the edge fade) */
  var SAMPLE_PX = 6;                     /* path sampling step for the tag test, stage px */
  var TAG_LEAD = 0.45, TAG_LAG = 0.2, TAG_FADE = 0.25;   /* a tag fades out this long before it would touch text */

  function svg(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function overlap(a, b, pad) {
    pad = pad || 0;
    return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
  }
  function inside(r, o) { return r.x0 >= o.x0 && r.x1 <= o.x1 && r.y0 >= o.y0 && r.y1 <= o.y1; }
  function opacityOf(e) {
    var op = 1, n = e;
    while (n && n.nodeType === 1) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; if (n === document.body) break; }
    return op;
  }

  /* makeText({story, tl, painter, area, layer, reserved}) -> text
     Anchor sides asked of painter.anchor(id, side): 'top' (node labels), 'side' (says, callouts, cards: the block's top-right
     corner, so a leader never has to cross the node label), and for painters that want them 'left', 'right', 'bottom', 'center'.
     The calls later packages use:
       text.plan(cam, {t0, step, active:[ids], full, routes:[linkIds]})   start a placement session (one per step)
       text.label(id, lines, {at, until})                    node label in free space, key 'label:<id>'
       text.say(spec)  text.callout(spec)  text.card(spec)  stationary text beside an anchor, returns an item
       text.tag({packet, label, color}) -> {hop({path,f0,f1,rev,t,dur})}   moving tag that gives way
       text.register(spec)                                    a painter-drawn text element joins emphasis + data-ov
       text.appear(item, t, dur) / text.vanish(item, t, dur)  presence tweens
       text.emphasis(t, edgeId, nodeIds, shields)             a hop starts / a shield lands (section 8)
       text.logHop({step, rid, t0, t1, ends})                 for window.__hops
       text.sync(cam)  text.finish()                          called by the camera and by boot */
  function makeText(o) {
    var tl = o.tl, painter = o.painter, area = o.area, layer = o.layer, reserved = o.reserved || [], story = o.story;
    var TXT = { x0: area.x + MARGIN, y0: area.y + MARGIN, x1: area.x + area.w - MARGIN, y1: area.y + area.h - MARGIN };
    var systems = (story.systems || []).map(function (s) { return s.id; });
    var parentOf = {};
    (story.zones || []).forEach(function (z) { parentOf[z.id] = z.parent || null; });
    (story.systems || []).forEach(function (s) { parentOf[s.id] = s.zone || null; });
    var items = [], sessions = [], session = null, tags = [], hopLog = [], emph = [], lastCam = null, lastKey = '';
    /* stage px from the packet's centre up to the tag's bottom edge; a painter may set its own (flat centres the tag on
       the packet, as the flat reference's chip, because its container tabs sit just above the link row) */
    var TAG_LIFT = painter.tagLift != null ? painter.tagLift : TAG_UP;

    /* ---- geometry ---- */
    function toStage(p, cam) { var k = area.w / cam.w; return { x: area.x + (p.x - cam.x) * k, y: area.y + (p.y - cam.y) * k }; }
    function ancestors(id) { var a = [], p = parentOf[id]; while (p) { a.push(p); p = parentOf[p]; } return a; }

    var probe = null;
    function measure(s, px, mono, weight) {
      if (!probe) { probe = svg('text', { opacity: 0, visibility: 'hidden' }, layer); }
      probe.setAttribute('class', mono ? 'mono' : 'sans'); probe.setAttribute('font-size', px); probe.setAttribute('font-weight', weight || 600);
      probe.textContent = s;
      var w = probe.getBBox().width;
      return w > 0 ? w : String(s).length * px * (mono ? 0.62 : 0.6);
    }
    function linesOf(l) { return Array.isArray(l) ? l : String(l).split('\n'); }
    /* a line is a string, or an array of segments {s, at} that appear one by one (a tally growing as packets land) */
    function plainOf(l) { return Array.isArray(l) ? l.map(function (x) { return x.s; }).join('') : l; }
    function widest(lines, px, mono, weight) { return Math.max.apply(null, lines.map(function (s) { return measure(plainOf(s), px, mono, weight); })); }

    /* ---- occupancy ---- */
    function makeOcc(cam, full, routes, active) {
      var occ = { text: reserved.slice(), blocks: [], act: [], lane: [], line: [], leaders: [], borders: [], cam: cam };
      /* container borders in view of a close-up: stationary text stays clear of them (a label sits inside the container or below it,
         never on the line). Not in the full view, where borders are everywhere and the hand spots of the reference sit on them. */
      (full ? [] : story.zones || []).forEach(function (z) {
        var r = painter.stageRect(z.id, cam);
        if (!r) return;
        var T2 = 7;
        occ.borders.push({ x0: r.x0 - T2, x1: r.x1 + T2, y0: r.y0 - T2, y1: r.y0 + T2 }, { x0: r.x0 - T2, x1: r.x1 + T2, y0: r.y1 - T2, y1: r.y1 + T2 },
          { x0: r.x0 - T2, x1: r.x0 + T2, y0: r.y0, y1: r.y1 }, { x0: r.x1 - T2, x1: r.x1 + T2, y0: r.y0, y1: r.y1 });
      });
      systems.forEach(function (id) {
        var r = painter.stageRect(id, cam);
        if (!r) return;
        occ.blocks.push(r);
        if (full || !active || active.indexOf(id) >= 0) occ.act.push(r);
      });
      (routes || []).forEach(function (rid) {
        var el = painter.pathEl(rid), L = el.getTotalLength(), k = area.w / cam.w, n = Math.max(2, Math.ceil(L * k / 14));
        for (var m = 0; m <= n; m++) {
          var q = el.getPointAtLength(L * m / n), p = toStage(q, cam);
          occ.line.push({ x0: p.x - 7, x1: p.x + 7, y0: p.y - 7, y1: p.y + 7 });
          occ.lane.push({ x0: p.x - 96, x1: p.x + 96, y0: p.y - 26, y1: p.y + 26 });
        }
      });
      occ.free = function (r, strict, noLane, withLine) {
        return inside(r, TXT) && occ.text.every(function (t) { return !overlap(r, t, 6); }) &&
          occ.leaders.every(function (b) { return !overlap(r, b, 4); }) &&
          (!strict || (occ.borders.every(function (b) { return !overlap(r, b, 0); }) && occ.act.every(function (b) { return !overlap(r, b, 2); }) &&
            (noLane || occ.lane.every(function (b) { return !overlap(r, b, 0); })))) &&
          (!withLine || !strict || occ.line.every(function (b) { return !overlap(r, b, 0); }));
      };
      occ.add = function (r) { occ.text.push(r); };
      return occ;
    }
    /* a leader line must not run through other text, nor across any block (its own included: it starts on the block's edge) */
    function leaderClear(a, r, occ) {
      var n = { x: Math.min(r.x1, Math.max(r.x0, a.x)), y: Math.min(r.y1, Math.max(r.y0, a.y)) };
      for (var k = 1; k <= 14; k++) {
        var f = k / 15, p = { x: a.x + (n.x - a.x) * f, y: a.y + (n.y - a.y) * f };
        if (f * Math.hypot(n.x - a.x, n.y - a.y) < 10) continue;
        if (occ.text.some(function (t) { return p.x > t.x0 - 2 && p.x < t.x1 + 2 && p.y > t.y0 - 2 && p.y < t.y1 + 2; })) return false;
        if (occ.blocks.some(function (b) { return p.x > b.x0 + 4 && p.x < b.x1 - 4 && p.y > b.y0 + 4 && p.y < b.y1 - 4; })) return false;
      }
      return true;
    }
    var DIRS = [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1], [0.5, -1], [-0.5, -1], [1, -0.5], [-1, -0.5], [1, 0.5], [-1, 0.5], [0.5, 1], [-0.5, 1]];
    /* first free candidate around the anchor (above, right, left, below, then diagonals; near, then far) */
    function place(a, w, h, occ, dists, force, noLane0, m0, m1) {
      for (var mode = m0 || 0; mode <= (m1 == null ? 4 : m1); mode++) for (var di = 0; di < (dists || DIST).length; di++) for (var u = 0; u < DIRS.length; u++) {
        var d = (dists || DIST)[di], ux = DIRS[u][0], uy = DIRS[u][1];
        var strict = mode < 2, lead = mode === 0 || mode === 2, noLane = noLane0 || mode === 4;   /* prefer clear of blocks and with a clear leader; then drop the leader; then the blocks; the lane last */
        var cx = a.x + ux * (w / 2 + d), cy = a.y + uy * (h / 2 + d), r = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
        if (occ.free(r, strict, noLane) && (!lead || leaderClear(a, r, occ))) { occ.add(r); return { dx: cx - a.x, dy: cy - a.y, w: w, h: h, rect: r }; }
      }
      if (!force) return null;
      var fy = a.y - (h / 2 + 14), fr = { x0: a.x - w / 2, x1: a.x + w / 2, y0: fy - h / 2, y1: fy + h / 2 };
      occ.add(fr); return { dx: 0, dy: fy - a.y, w: w, h: h, rect: fr, forced: true };
    }
    var DIST = [14, 40, 80, 130, 190, 260, 340];

    /* ---- sessions: one per step, with the camera it is planned for ---- */
    function plan(cam, opts) {
      opts = opts || {};
      var c = { x: cam.x, y: cam.y, w: cam.w, h: cam.h };
      session = { t0: opts.t0 || 0, step: opts.step || null, cam: c, full: !!opts.full, active: opts.active || null, routes: opts.routes || [], end: Infinity };
      if (sessions.length) sessions[sessions.length - 1].end = session.t0;
      session.occ = makeOcc(c, session.full, session.routes, session.active);
      sessions.push(session);
      return session;
    }
    function need() { if (!session) throw new Error('text.plan(cam, ...) must be called before placing text'); return session; }

    /* ---- items ---- */
    function newItem(key, kind, anchor, extra) {
      var g = svg('g', { class: 'ti', 'data-key': key }, layer);
      var it = { key: key, kind: kind, anchor: anchor, g: g, session: session, rect: null };
      lastKey = '';
      for (var k in extra || {}) it[k] = extra[k];
      items.push(it);
      return it;
    }
    function fixedTransform(it, cam) {
      if (!it.anchor) return;
      var p = toStage(it.anchor, cam);
      it.g.setAttribute('transform', 'translate(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ')');
    }
    function drawPill(it, lines, box, o) {
      var fs = o.fs || LABEL_PX, mono = !!o.mono, col = o.color || C.accent, lh = Math.round(fs * (o.lh || 1.28));
      var px = o.pad ? o.pad.x : 18, py = o.pad ? o.pad.y : 11;
      var pres = svg('g', {}, it.g), em = svg('g', { 'data-ov': it.key }, pres);
      if (o.leader) {
        var nx = Math.min(box.x + box.w, Math.max(box.x, 0)), ny = Math.min(box.y + box.h, Math.max(box.y, 0));
        svg('line', { 'data-ld': o.kind || 'text', x1: 0, y1: 0, x2: nx, y2: ny, stroke: col, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-dasharray': '3 9' }, pres);
        svg('circle', { cx: 0, cy: 0, r: 7, fill: col, stroke: C.bg, 'stroke-width': 3 }, pres);
        pres.insertBefore(pres.lastChild, em); pres.insertBefore(pres.lastChild, em);   /* leader and dot under the box */
      }
      svg('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 14, fill: C.panel, stroke: col, 'stroke-width': 3.5 }, em);
      lines.forEach(function (s, i) {
        var head = i === 0 && o.title, mn = mono && !head;
        /* a card's rows sit on tinted bars; its title is in the card's colour (the step's subject) */
        if (o.rowBars && !head) svg('rect', { x: box.x + px - 10, y: box.y + py + lh * i + 3, width: box.w - 2 * px + 20, height: lh - 6, rx: 8, fill: col, 'fill-opacity': 0.2 }, em);
        var tx = svg('text', { x: box.x + px, y: box.y + py + lh * i + lh / 2, dy: '.35em', class: mn ? 'mono' : 'sans',
          fill: head ? (o.titleColor || C.text) : (i && o.title && !o.rowBars ? C.muted : C.text),
          'font-size': fs, 'font-weight': mn ? 400 : (head ? 700 : 600) }, em);
        if (Array.isArray(s)) {
          s.forEach(function (seg) {
            var ts = svg('tspan', {}, tx); ts.textContent = seg.s;
            if (seg.at != null) {
              ts.setAttribute('fill-opacity', 0);
              tl.fromTo(ts, { attr: { 'fill-opacity': 0 } }, { attr: { 'fill-opacity': 1 }, duration: T.LABEL_FADE_IN, ease: 'power3.out', immediateRender: false }, seg.at);
            }
          });
        } else tx.textContent = s;
        /* lineAt[i]: this line appears at that time (a tally that grows as packets land) */
        if (o.lineAt && o.lineAt[i] != null) {
          tx.setAttribute('opacity', 0);
          tl.fromTo(tx, { opacity: 0 }, { opacity: 1, duration: T.LABEL_FADE_IN, ease: 'power3.out', immediateRender: false }, o.lineAt[i]);
        }
      });
      it.pres = pres; it.els = [em];
    }
    /* spec.anchors: scene points tried in order (each within spec.dists); spec.forceAt: the index of the anchor to force
       at when none has room (directly above it). spec.sizeWith: other lines the box must also fit (a request label
       sized for its response). spec.sameAs: an earlier item whose box this one takes (the response replaces the
       request in the same place). spec.lineAt: per-line appearance times. */
    function pill(kind, key, spec, defaults) {
      var s = need(), lines = linesOf(spec.lines != null ? spec.lines : spec.text), fs = spec.fs || LABEL_PX, mono = !!spec.mono;
      var sizing = spec.sizeWith ? lines.concat(linesOf(spec.sizeWith)) : lines;
      var nl = Math.max(lines.length, spec.sizeWith ? linesOf(spec.sizeWith).length : 0);
      var pad = spec.pad || { x: 18, y: 11 }, lhf = spec.lh || 1.28;
      var w = Math.round(widest(sizing, fs, mono, mono ? 400 : 600) + 2 * pad.x), h = nl * Math.round(fs * lhf) + 2 * pad.y;
      var anchor, a, p = null, prev = spec.sameAs;
      if (prev && prev.box) {
        anchor = prev.anchor; w = prev.box.w; h = prev.box.h;
        p = { dx: prev.box.x + w / 2, dy: prev.box.y + h / 2, rect: prev.rect, forced: prev.forced };
        a = toStage(anchor, prev.session.cam);
      } else {
        var anchors = spec.anchors || [spec.anchor || painter.anchor(spec.node || spec.target, spec.side || 'side')];
        var dists = spec.dists || defaults.dists;
        /* every anchor with a clear leader and clear of blocks, then every anchor clear of blocks, before any anchor in the loose modes */
        (painter.placeTiers || [[0, 0], [1, 1], [2, 4]]).forEach(function (tier) {     /* a painter may order the modes (iso: a clear leader first) */
          for (var ai = 0; ai < anchors.length && !p; ai++) {
            anchor = anchors[ai]; a = toStage(anchor, s.cam);
            p = place(a, w, h, s.occ, dists, false, !!spec.noLane, tier[0], tier[1]);
          }
        });
        if (!p && spec.force !== false) {
          anchor = anchors[spec.forceAt || 0]; a = toStage(anchor, s.cam);
          p = place(a, w, h, s.occ, dists, true, !!spec.noLane);
        }
      }
      var it = newItem(key, kind, anchor, { target: spec.target || null, edges: spec.edges || null, shield: spec.shield,
        at: spec.at != null ? spec.at : null, until: spec.until != null ? spec.until : Infinity, forced: !!(p && p.forced), dropped: !p });
      if (!p) { it.g.setAttribute('display', 'none'); it.els = []; return it; }
      it.rect = p.rect;
      var box = it.box = { x: p.dx - w / 2, y: p.dy - h / 2, w: w, h: h };
      var near = Math.hypot(Math.max(box.x, -(box.x + box.w), 0), Math.max(box.y, -(box.y + box.h), 0));
      drawPill(it, lines, box, { fs: fs, mono: mono, color: spec.color, title: spec.title, leader: near > 12, kind: kind, lineAt: spec.lineAt,
        pad: pad, lh: lhf, rowBars: spec.rowBars, titleColor: spec.titleColor });
      if (near > 12 && !prev) {         /* the leader line is an obstacle for text placed after this */
        var n = { x: Math.min(p.rect.x1, Math.max(p.rect.x0, a.x)), y: Math.min(p.rect.y1, Math.max(p.rect.y0, a.y)) }, steps = Math.ceil(Math.hypot(n.x - a.x, n.y - a.y) / 8);
        for (var q = 0; q <= steps; q++) { var lx = a.x + (n.x - a.x) * q / steps, ly = a.y + (n.y - a.y) * q / steps; s.occ.leaders.push({ x0: lx - 3, x1: lx + 3, y0: ly - 3, y1: ly + 3 }); }
      }
      fixedTransform(it, s.cam);
      if (spec.at != null) { it.pres.setAttribute('opacity', 0); appear(it, spec.at); }
      if (spec.until != null && isFinite(spec.until)) vanish(it, spec.until);
      return it;
    }
    var keyN = {};
    function uniq(base) { keyN[base] = (keyN[base] || 0) + 1; return keyN[base] > 1 ? base + '#' + keyN[base] : base; }

    /* say: the stationary label for what a packet carries. spec: {lines, node|anchor, side, at, until, mono, color} */
    function say(spec) { return pill('say', uniq(spec.key || 'say:' + (spec.node || '') + ':' + linesOf(spec.lines)[0]), spec, { dists: DIST }); }
    /* callout: 0-2 per step, anchored to a node or link. spec: {text, target|anchor, at, until, color} */
    function callout(spec) { return pill('call', uniq(spec.key || 'call:' + (spec.target || '')), spec, { dists: DIST }); }
    /* tally: lines (strings or segment arrays) beside the receiving end of a stream; spec as say */
    function tally(spec) { return pill('tally', uniq(spec.key || 'tally:' + (spec.node || '')), spec, { dists: DIST }); }
    /* card: a text card (a finding, a credential). spec: {title, rows:[..], node, at, until, color} */
    function card(spec) {
      var lines = (spec.title != null ? [spec.title] : []).concat(spec.rows || []);
      return pill('card', uniq(spec.key || 'card:' + (spec.node || '')), Object.assign({ dists: [40, 90, 150, 230, 320], pad: { x: 30, y: 20 }, lh: 1.5,
        rowBars: true, mono: true, titleColor: spec.color }, spec, { lines: lines, title: spec.title != null }), { dists: [40, 90, 150, 230, 320] });
    }

    /* pin: a pill at a fixed place beside a scene point, no placer, no leader (a proxy badge for an off-frame system).
       spec: {key, lines, anchor, side: 'left'|'right'|'top'|'bottom' (where the pill sits), gap, color, mono, at, until,
       edges, node}. The pill's rect joins the session's occupancy. */
    function pinW(lines, fs, mono) { var ln = linesOf(lines); return Math.round(widest(ln, fs || LABEL_PX, !!mono, mono ? 400 : 600) + 36); }
    function pin(spec) {
      var s = need(), lines = linesOf(spec.lines), fs = spec.fs || LABEL_PX, mono = !!spec.mono, gap = spec.gap || 0;
      var w = pinW(lines, fs, mono), h = lines.length * Math.round(fs * 1.28) + 22, anchor = spec.below ? spec.below.anchor : spec.anchor, a = toStage(anchor, s.cam);
      var dx = spec.side === 'left' ? -(gap + w / 2) : spec.side === 'right' ? gap + w / 2 : 0;
      var dy = spec.side === 'top' ? -(gap + h / 2) : spec.side === 'bottom' ? gap + h / 2 : 0;
      /* below: directly under an earlier pin, left-aligned with it (a tally under its proxy badge) */
      if (spec.below) { dx = spec.below.box.x + w / 2; dy = spec.below.box.y + spec.below.box.h + gap + h / 2; }
      var it = newItem(uniq(spec.key || 'pin:' + plainOf(lines[0])), 'pin', anchor, { edges: spec.edges || null, node: null,
        at: spec.at != null ? spec.at : null, until: spec.until != null ? spec.until : Infinity });
      it.rect = { x0: a.x + dx - w / 2, x1: a.x + dx + w / 2, y0: a.y + dy - h / 2, y1: a.y + dy + h / 2 };
      it.box = { x: dx - w / 2, y: dy - h / 2, w: w, h: h };
      s.occ.add(it.rect);
      drawPill(it, lines, it.box, { fs: fs, mono: mono, color: spec.color, kind: 'pin', lineAt: spec.lineAt });
      fixedTransform(it, s.cam);
      if (spec.at != null) { it.pres.setAttribute('opacity', 0); appear(it, spec.at); }
      if (spec.until != null && isFinite(spec.until)) vanish(it, spec.until);
      return it;
    }

    /* node label: sits above its block when that is free, otherwise beside or below it */
    function label(id, lines, o) {
      o = o || {};
      var s = need(), cam = s.cam, ln = linesOf(lines), fs = o.fs || LABEL_PX, lh = Math.round(fs * 1.15);
      var w = widest(ln, fs, false, 650) + 8, h = (ln.length - 1) * lh + Math.round(fs * 1.15);
      var br = painter.stageRect(id, cam), A = painter.anchor(id, 'top'), a = toStage(A, cam);
      var cx = (br.x0 + br.x1) / 2, cy = (br.y0 + br.y1) / 2, above = br.y0 - 8 - h / 2, below = br.y1 + 8 + h / 2;
      var cands = [[cx, above], [cx - w / 2 - 18, above], [cx + w / 2 + 18, above], [br.x0 - 12 - w / 2, cy], [br.x1 + 12 + w / 2, cy], [cx, below],
        [cx, above - 44], [cx - w / 2 - 18, above - 44], [cx + w / 2 + 18, above - 44], [cx, below + 44]];
      var pick = null;
      for (var si = 0; si < 2 && !pick; si++) for (var ci = 0; ci < cands.length && !pick; ci++) {
        var r = { x0: cands[ci][0] - w / 2, x1: cands[ci][0] + w / 2, y0: cands[ci][1] - h / 2, y1: cands[ci][1] + h / 2 };
        if (s.occ.free(r, si === 0, true, true)) { s.occ.add(r); pick = { r: r, cx: cands[ci][0], cy: cands[ci][1] }; }
      }
      var forced = false;
      if (!pick) {
        var fr = { x0: cx - w / 2, x1: cx + w / 2, y0: above - h / 2, y1: above + h / 2 }; s.occ.add(fr);
        pick = { r: fr, cx: cx, cy: above }; forced = true;
      }
      var it = newItem(uniq('label:' + id), 'label', A, { node: id, at: o.at != null ? o.at : null, until: o.until != null ? o.until : Infinity, forced: forced });
      it.key = it.key.replace(/#\d+$/, '');       /* data-ov stays 'label:<nodeId>' for the hop assertion; duplicates are per-step items */
      it.g.setAttribute('data-key', it.key);
      it.rect = pick.r;
      var pres = svg('g', {}, it.g), em = svg('g', { 'data-ov': it.key }, pres);
      var dx = pick.cx - a.x, dy = pick.cy - a.y;
      svg('rect', { x: dx - w / 2, y: dy - h / 2, width: w, height: h, fill: 'none' }, em);
      ln.forEach(function (str, i) {
        var tx = svg('text', { x: dx, y: dy - h / 2 + Math.round(fs * 0.9) + i * lh, 'text-anchor': 'middle', class: 'sans', fill: i ? C.muted : C.text, 'font-size': i ? Math.round(fs * 0.85) : fs,
          'font-weight': 650, stroke: C.bg, 'stroke-width': 6, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, em);
        tx.textContent = str;
      });
      it.pres = pres; it.els = [em];
      fixedTransform(it, cam);
      if (o.at != null) { pres.setAttribute('opacity', 0); appear(it, o.at); }
      if (o.until != null && isFinite(o.until)) vanish(it, o.until);
      return it;
    }

    /* a text element drawn by the painter joins the registry: gets its data-ov key and emphasis */
    function register(spec) {
      var els = spec.els || [spec.el];
      els.forEach(function (e) { if (!e.getAttribute('data-ov')) e.setAttribute('data-ov', spec.key); });
      var it = { key: spec.key, kind: spec.kind || 'text', anchor: null, g: null, session: session, rect: spec.rect || null, els: els,
        node: spec.node, tab: spec.tab, target: spec.target, edges: spec.edges, shield: spec.shield,
        at: spec.at != null ? spec.at : null, until: spec.until != null ? spec.until : Infinity };
      items.push(it);
      return it;
    }

    function appear(it, t, dur) {
      tl.fromTo(it.pres, { opacity: 0 }, { opacity: 1, duration: dur || T.LABEL_FADE_IN, ease: 'power3.out', immediateRender: false }, t);
      it.at = t;
    }
    function vanish(it, t, dur) {
      tl.fromTo(it.pres, { opacity: 1 }, { opacity: 0, duration: dur || T.LABEL_FADE_OUT, ease: 'power1.in', immediateRender: false }, t);
      it.until = t;
    }

    /* ---- moving tags: a short word on a packet, counter-scaled, fading while it would cover text ---- */
    function tag(spec) {
      var s = need(), lab = String(spec.label), mono = !!spec.mono, col = spec.color || C.accent;
      var w = Math.round(measure(lab, TAG_PX, mono, 650) + 28);
      /* a chip: outline and tint stay; only the text (data-ov) gives way when it would cover other text */
      var g = svg('g', {}, spec.packet);
      svg('rect', { x: -w / 2, y: -TAG_H, width: w, height: TAG_H, rx: 12, fill: C.panel, stroke: col, 'stroke-width': 2.5 }, g);
      svg('rect', { x: -w / 2, y: -TAG_H, width: w, height: TAG_H, rx: 12, fill: col, 'fill-opacity': 0.18 }, g);
      var gt = svg('g', {}, g);       /* gives way (buildTags); the text itself carries data-ov, so a runner may fade it too */
      var tx = svg('text', { 'data-ov': 'pkt:' + lab, x: 0, y: -TAG_H / 2, dy: '.35em', 'text-anchor': 'middle', class: mono ? 'mono' : 'sans', fill: C.text, 'font-size': TAG_PX, 'font-weight': 650 }, gt);
      tx.textContent = lab;
      var tg = { el: g, gt: gt, txt: tx, w: w, h: TAG_H, lift: TAG_LIFT, hops: [], session: s };
      lastKey = '';
      tags.push(tg);
      var it = { key: 'pkt:' + lab, kind: 'tag', anchor: null, g: null, session: s, els: [g] };
      /* a hop of the packet along a path: sampled now (in the session's camera) to find where it would cover text */
      tg.hop = function (h) {
        var L = h.path.getTotalLength(), f0 = h.f0 == null ? 0 : h.f0, f1 = h.f1 == null ? 1 : h.f1, k = area.w / s.cam.w;
        var n = Math.max(2, Math.ceil(Math.abs(f1 - f0) * L * k / SAMPLE_PX)), pts = [];
        for (var m = 0; m <= n; m++) {
          var f = m / n, pf = h.rev ? f1 - (f1 - f0) * f : f0 + (f1 - f0) * f, q = h.path.getPointAtLength(L * pf);
          pts.push({ f: f, p: toStage(q, s.cam) });
        }
        tg.hops.push({ t: h.t, dur: h.dur, pts: pts });
      };
      return tg;
    }

    /* ---- emphasis (section 8): events collected while steps are built, turned into fromTo tweens in time order ---- */
    function emphasis(t, edgeId, nodeIds, shields) {
      var tabs = {}, nodes = {};
      (nodeIds || []).forEach(function (n) { nodes[n] = 1; ancestors(n).forEach(function (a) { tabs[a] = 1; }); });
      emph.push({ t: t, edge: edgeId, nodes: nodes, tabs: shields ? {} : tabs, shields: shields || [] });
    }
    function active(it, ev) {
      if (it.node) return !!ev.nodes[it.node];
      if (it.tab) return !!ev.tabs[it.tab];
      if (it.shield != null) return ev.shields === 'all' || ev.shields.indexOf(it.shield) >= 0;
      if (it.target) return !!ev.nodes[it.target] || ev.edge === it.target;
      if (it.edges) return it.edges.indexOf(ev.edge) >= 0;
      if (it.at == null) return true;
      if (ev.t < it.at - 0.01) return null;                       /* not shown yet: leave it as it is */
      return ev.t < it.until - 0.01;                              /* flow labels and tallies: the hops they were shown for */
    }
    function buildEmphasis() {
      emph.sort(function (a, b) { return a.t - b.t; });
      items.forEach(function (it) {
        if (!it.els || it.kind === 'tag') return;
        var cur = 1;
        emph.forEach(function (ev) {
          var on = active(it, ev);
          if (on === null) return;
          var tgt = on ? 1 : T.DIM_TEXT;
          if (tgt === cur) return;
          var fresh = it.at != null && ev.t <= it.at + 0.01 && tgt === 1;     /* a label arriving with its own hop: no fade from dim */
          tl.fromTo(it.els, { opacity: cur }, { opacity: tgt, duration: fresh ? 0.001 : T.DIM_DUR, ease: T.DIM_EASE, immediateRender: false }, ev.t);
          cur = tgt;
        });
      });
    }

    /* ---- tags give way: the stretches of each hop where the tag box would touch text visible at that moment ---- */
    function buildTags() {
      tags.forEach(function (tg) {
        var ivs = [];
        tg.hops.forEach(function (h) {
          var s = tg.session, hits = [], prev = null, g0 = null, rects = [];
          items.forEach(function (it) {
            if (it.session !== s || !it.rect || it.kind === 'tag') return;
            rects.push({ r: it.rect, a: it.at == null ? s.t0 : it.at, b: it.until == null ? s.end : Math.min(it.until, s.end) });
          });
          h.pts.forEach(function (q) {
            var tm = h.t + h.dur * T.invPacketEase(q.f);
            var r = { x0: q.p.x - tg.w / 2, x1: q.p.x + tg.w / 2, y0: q.p.y - TAG_LIFT - TAG_H, y1: q.p.y - TAG_LIFT };
            if (rects.some(function (z) { return tm >= z.a - 0.5 && tm <= z.b + 0.5 && overlap(r, z.r, TAG_PAD); })) hits.push({ f: q.f, tm: tm });
          });
          function close() { if (g0) ivs.push([g0.tm - TAG_LEAD, prev.tm + TAG_LAG]); }
          hits.forEach(function (q) { if (g0 && q.f - prev.f > 0.03) { close(); g0 = null; } if (!g0) g0 = q; prev = q; });
          close();
        });
        ivs.sort(function (a, b) { return a[0] - b[0]; });
        var merged = [];
        ivs.forEach(function (v) {
          var last = merged[merged.length - 1];
          if (last && v[0] < last[1] + TAG_FADE) last[1] = Math.max(last[1], v[1]); else merged.push([v[0], v[1]]);
        });
        merged.forEach(function (v) {
          tl.fromTo(tg.gt, { opacity: 1 }, { opacity: 0, duration: TAG_FADE, ease: 'power1.in', immediateRender: false }, v[0]);
          tl.fromTo(tg.gt, { opacity: 0 }, { opacity: 1, duration: TAG_FADE, ease: 'power1.out', immediateRender: false }, v[1]);
        });
        tg.gaps = merged;
      });
    }

    /* ---- camera sync: anchored items follow their scene point; tags are counter-scaled to stay 22 px ---- */
    function sync(cam) {
      var key = cam.x + '|' + cam.y + '|' + cam.w;
      if (key === lastKey) return;
      lastKey = key; lastCam = cam;
      items.forEach(function (it) { fixedTransform(it, cam); });
      var k = area.w / cam.w;
      tags.forEach(function (tg) { tg.el.setAttribute('transform', 'translate(0,' + (-TAG_LIFT / k).toFixed(3) + ') scale(' + (1 / k).toFixed(5) + ')'); });
    }

    function finish() { buildEmphasis(); buildTags(); }

    var text = {
      layer: layer, plan: plan, label: label, say: say, callout: callout, card: card, tally: tally, pin: pin, pinW: pinW, tag: tag, register: register,
      appear: appear, vanish: vanish, emphasis: emphasis, sync: sync, finish: finish,
      logHop: function (h) { hopLog.push({ step: h.step, t0: h.t0, t1: h.t1, mid: (h.t0 + h.t1) / 2, rid: h.rid, ends: h.ends }); },
      items: items, sessions: sessions, tags: tags,
      toStage: toStage, TXT: TXT
    };

    /* ---- hooks read by scripts/render-check.mjs ---- */
    window.__hops = function () { return hopLog.map(function (h) { return { step: h.step, t0: h.t0, t1: h.t1, mid: h.mid, rid: h.rid, ends: h.ends.slice() }; }); };
    window.__layout = function () {
      return {
        steps: sessions.map(function (s) {
          var its = items.filter(function (i) { return i.session === s; });
          return { id: s.step, zoom: +(area.w / s.cam.w).toFixed(2), items: its.length,
            forced: its.filter(function (i) { return i.forced; }).map(function (i) { return i.key; }),
            dropped: its.filter(function (i) { return i.dropped; }).map(function (i) { return i.key; }) };
        }),
        tags: tags.map(function (tg) { return { w: tg.w, gaps: (tg.gaps || []).map(function (v) { return [+v[0].toFixed(2), +v[1].toFixed(2)]; }) }; })
      };
    };
    /* pairs of currently visible text-bearing elements whose on-screen boxes intersect; dimmed text and moving tags count;
       leader lines are tested against other text and against blocks (elements marked data-block) */
    window.__overlaps = function () {
      var list = [];
      document.querySelectorAll('[data-ov]').forEach(function (e) {
        if (opacityOf(e) < 0.05) return;
        var r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
        list.push({ k: e.getAttribute('data-ov'), el: e, r: r, pk: e.closest('[data-layer="packets"] > *') });
      });
      var out = [];
      var blocks = Array.prototype.map.call(document.querySelectorAll('[data-block]'), function (e) { return e.getBoundingClientRect(); });
      document.querySelectorAll('line[data-ld]').forEach(function (ln) {
        if (opacityOf(ln) < 0.05) return;
        var m = ln.getScreenCTM(), pt = function (x, y) { return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; };
        var a = pt(+ln.getAttribute('x1'), +ln.getAttribute('y1')), b = pt(+ln.getAttribute('x2'), +ln.getAttribute('y2'));
        var own = ln.parentElement.querySelector('[data-ov]'), len = Math.hypot(b.x - a.x, b.y - a.y), ok = own && own.getAttribute('data-ov');
        /* a stationary label sits next to what it describes: its leader is at most SAY_LEADER_MAX stage px */
        var stg = document.getElementById('stage'), sc = stg ? stg.getBoundingClientRect().width / 1920 || 1 : 1;
        if (ln.getAttribute('data-ld') === 'say' && len / sc > SAY_LEADER_MAX) out.push(['leader:' + ok, 'too long: ' + Math.round(len / sc) + 'px']);
        var inr = function (p, r, g) { return p.x > r.left + g && p.x < r.right - g && p.y > r.top + g && p.y < r.bottom - g; };
        for (var k = 1; k <= 24; k++) {
          var f = k / 25, p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
          if (f * len < 10) continue;
          list.forEach(function (it) { if (it.el !== own && !it.pk && inr(p, it.r, -1)) out.push(['leader:' + ok, it.k]); });
          blocks.forEach(function (r, bi) {
            if (inr(p, r, 4)) out.push(['leader:' + ok, 'block' + bi]);
          });
        }
      });
      out = out.filter(function (q, i) { return out.findIndex(function (w) { return w[0] === q[0] && w[1] === q[1]; }) === i; });
      for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
        var a2 = list[i].r, b2 = list[j].r;
        if (list[i].pk && list[i].pk === list[j].pk) continue;      /* the parts of one packet */
        if (a2.left < b2.right && b2.left < a2.right && a2.top < b2.bottom && b2.top < a2.bottom) out.push([list[i].k, list[j].k]);
      }
      return out;
    };
    return text;
  }

  EXK.makeText = makeText;
})();
