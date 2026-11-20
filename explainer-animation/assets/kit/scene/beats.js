/* The step runner: EXK.runSteps(ctx) plays the story's steps back to back on the master timeline, and the
   per-step context `c` that beats are built from (port of the flat v3 makeCtx / IMPL / assembly loop).
   Per step: focus dimming, the step's camera frame (EXK.frame.frameFor), one text placement session per camera
   frame, the beats (pattern.beatsFor), callouts, label holds (finalizeLabels), the step end and rest (EXK.timing),
   the chrome (shell.stepChrome), the breadcrumb, lit links fading and trails promoted.
   Beats: chain, exchange, stream, card, mark, pulse, camera, shields, custom (EXK.extra.beats[kind](c, beat, t)).
   Rules: every tween is a fromTo with immediateRender:false (packet motion included: a fromTo on
   a per-hop progress proxy whose onUpdate places the packet); tweens on one element are emitted in time order
   (markers, trails and the summary's fade of them are collected and emitted at the end); every duration comes
   from EXK.timing. A camera beat never starts while a packet moves, and no beat starts during a camera move:
   both are moved later (with a console warning when a `parallel` or `at` asked for an earlier start).

   ctx = { story, tl, painter, text, camera, shell, area, timing, pattern, estate }
   -> { steps: [{id, time, rest, title, body, phase}], duration, moments }   all times absolute */
(function () {
  'use strict';
  var EXK = window.EXK, T = EXK.timing, C = EXK.THEME;
  var TAG_SAMPLE = 6;         /* stage px between samples when testing a tag against node labels */
  var TAG_NODE_PAD = 10;      /* stage px: a tag's text hides this close to a node label (more than one sample step) */
  var PROXY_GAP = 12;         /* stage px between a proxy badge and the point its link enters the frame */
  var SAY_DISTS = [14, 40, 80];
  var SAY_DISTS_CLOSE = [14, 40, 80, 130];   /* a close-up has container borders to clear, so a label below the held container may sit a little further out */
  var CARD_PX = 26, CARD_ZOOM = 1.3, CARD_GROW = 1.4;   /* card text: 26 px, up to 1.4x when the frame is closer than 1.3 */          /* stage px: a says label sits this close to its node (leader <= ~120) */

  function sameFrame(a, b) { return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5; }
  function inFrame(b, f) { return b.cx >= f.x && b.cx <= f.x + f.w && b.cy >= f.y && b.cy <= f.y + f.h; }
  function linesOf(s) { return Array.isArray(s) ? s.map(String) : String(s).split('\n'); }
  function pct(f) { return (f * 100).toFixed(3) + '%'; }
  function colorOf(name, dflt) { return name ? (C[name] || name) : dflt; }

  function runSteps(ctx) {
    var story = ctx.story, tl = ctx.tl, painter = ctx.painter, text = ctx.text, camera = ctx.camera, shell = ctx.shell;
    var area = ctx.area, estate = ctx.estate;
    var pattern = EXK.patterns[ctx.pattern] || EXK.patterns.flow;
    if (!estate || !estate.routes) throw new Error('runSteps: ctx.estate (layout + routes) is missing');
    var AREA = { w: area.w, h: area.h };
    /* frames come from the painter when it frames its own scene space (iso: projected); otherwise from EXK.frame */
    function frameOf(spec, ids) { return painter.frameFor ? painter.frameFor(spec, AREA, ids) : EXK.frame.frameFor(estate, spec, AREA); }
    var FULL = frameOf('full');
    camera.setFull(FULL);
    camera.set(FULL);
    var cur = FULL;                         /* the frame the camera is at (or heading for) as steps are built */
    var sysOf = {};
    story.systems.forEach(function (s) { sysOf[s.id] = s; });
    var stepIndex = {};
    story.steps.forEach(function (s, i) { stepIndex[s.id] = i; });

    /* painter-drawn text joins the registry (emphasis, data-ov) */
    painter.texts().forEach(function (t) { text.register(t); });

    /* painter text is an obstacle for placement (shell.reserved, read by text.plan); container tabs are also obstacles
       for moving tags (text.js tags give way); node labels are handled by the packet passing behind its node */
    var reserved = shell.reserved, dyn = [];
    function planText(frame, t, st, inv, routes, c) {
      dyn.forEach(function (r) { var i = reserved.indexOf(r); if (i >= 0) reserved.splice(i, 1); });
      var rects = painter.textRects(frame);
      dyn = rects.map(function (q) { return q.rect; });
      dyn.forEach(function (r) { reserved.push(r); });
      var s = text.plan(frame, { t0: t, step: st.id, active: inv.nodes, full: !!frame.full, routes: routes });
      rects.forEach(function (q) {
        if (q.key.indexOf('tab:') === 0) text.items.push({ key: 'obstacle:' + q.key, kind: 'obstacle', session: s, rect: q.rect, at: null, until: null });
      });
      /* a summary's shields stand before any label or tag of the session is placed: those keep clear of them */
      var sb = (st.beats || []).filter(function (b) { return pattern.kindOf(b) === 'shields'; })[0];
      s.shields = sb ? planShields(sb.shields, s) : null;
      /* labelPolicy 'touched' (iso): the painter places the step's labels and container tags; they fade with the step's extras */
      if (painter.stepText) painter.stepText(text, frame, { t: t, step: st, nodes: inv.nodes }).forEach(function (it) { c.extras.push(it); });
      return s;
    }

    /* ---- the summary's shields (P§8): where each stands, and whether the names fit beside them ---- */
    function controlsOf(spec) {
      function first(k) { return Math.min.apply(null, (k.stops || []).map(function (s) { return stepIndex[s]; }).concat([Infinity])); }
      return (story.controls || []).filter(function (k) { return spec === 'controls' || (Array.isArray(spec) && spec.indexOf(k.id) >= 0); })
        .sort(function (a, b) { return first(a) - first(b); });
    }
    /* the step numbers a control would have prevented, as a shield shows them: runs compressed (2-6), at most three
       characters (more becomes the first and a plus: 2+) */
    function stopsText(k) {
      var n = (k.stops || []).map(function (s) { return stepIndex[s] + 1; }).filter(function (x) { return x > 0; })
        .sort(function (a, b) { return a - b; }).filter(function (x, i, a) { return !i || x !== a[i - 1]; });
      if (!n.length) return '';
      var parts = [], i = 0;
      while (i < n.length) { var j = i; while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++; parts.push(j > i + 1 ? n[i] + '\u2013' + n[j] : j === i + 1 ? n[i] + '/' + n[j] : String(n[i])); i = j + 1; }
      var t = parts.join('/');
      return t.length <= 3 ? t : n[0] + '+';
    }
    function rectsMeet(a, b, pad) { return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad; }
    function overArea(a, b) { return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)); }
    /* planShields(spec, session) -> [{k, link, pt (scene), rect (stage), clean}]: each control's shield stands on its own link,
       at the sampled point (every SHIELD_STEP stage px, off its end blocks) that is clear of every block and every piece of
       text placed or reserved so far (tabs, node labels, earlier shields with SHIELD_PAD around them), inside the text
       margin, crossing as few other links as it can, nearest the middle of its link. When no point is clear, the one
       covering least. Each shield's rect is reserved as it is chosen, so shields that would land together stagger
       along their links. */
    var SHIELD_STEP = 8, SHIELD_PAD = 10, SHIELD_LEAD = 220, LEGEND_AT = 6;
    function planShields(spec, s) {
      var cam = s.cam, occ = s.occ, kz = area.w / cam.w, box = painter.shieldBox(cam), lift = painter.shieldLift || 0, lines = {}, out = [];
      Object.keys(estate.routes).forEach(function (id) {
        var el = painter.pathEl(id), L = el.getTotalLength(), n = Math.max(2, Math.ceil(L * kz / 12)), pts = [];
        for (var m = 0; m <= n; m++) pts.push(text.toStage(el.getPointAtLength(L * m / n), cam));
        lines[id] = pts;
      });
      controlsOf(spec).forEach(function (k) {
        var lk = k.on && EXK.route.findLink(estate.routes, k.on[0], k.on[1]);
        if (!lk) return;
        var r = estate.routes[lk.id], el = painter.pathEl(lk.id), L = el.getTotalLength(), n = Math.max(8, Math.ceil(L * kz / SHIELD_STEP));
        var ends = [painter.stageRect(r.a, cam), painter.stageRect(r.b, cam)], best = null;
        for (var m = 1; m < n; m++) {
          var f = m / n, q = el.getPointAtLength(L * f), on = text.toStage(q, cam);
          if (ends.some(function (e) { return e && on.x > e.x0 && on.x < e.x1 && on.y > e.y0 && on.y < e.y1; })) continue;
          var pt = { x: q.x, y: q.y - lift }, p = text.toStage(pt, cam);
          var rect = { x0: p.x - box.l, x1: p.x + box.r, y0: p.y - box.t, y1: p.y + box.b };
          if (rect.x0 < text.TXT.x0 || rect.x1 > text.TXT.x1 || rect.y0 < text.TXT.y0 || rect.y1 > text.TXT.y1) continue;
          var hard = 0, cost = Math.abs(f - 0.5) * L * kz * 0.25;
          occ.blocks.forEach(function (b) { if (rectsMeet(rect, b, 4)) hard += 1000 + overArea(rect, b); });
          occ.text.forEach(function (t) { if (rectsMeet(rect, t, SHIELD_PAD)) hard += 100000 + overArea(rect, t); });
          Object.keys(lines).forEach(function (id) {
            if (id === lk.id) return;
            lines[id].forEach(function (lp) { if (lp.x > rect.x0 - 4 && lp.x < rect.x1 + 4 && lp.y > rect.y0 - 4 && lp.y < rect.y1 + 4) cost += 25; });
          });
          cost += hard;
          if (!best || cost < best.cost) best = { cost: cost, hard: hard, pt: pt, rect: rect };
        }
        if (!best) {        /* the whole link is off the text area or under its blocks: its middle */
          var qm = el.getPointAtLength(L / 2), pm = { x: qm.x, y: qm.y - lift }, sm = text.toStage(pm, cam);
          best = { hard: 1, pt: pm, rect: { x0: sm.x - box.l, x1: sm.x + box.r, y0: sm.y - box.t, y1: sm.y + box.b } };
        }
        text.reserve({ x0: best.rect.x0 - SHIELD_PAD / 2, x1: best.rect.x1 + SHIELD_PAD / 2, y0: best.rect.y0 - SHIELD_PAD / 2, y1: best.rect.y1 + SHIELD_PAD / 2 });
        out.push({ k: k, link: lk.id, pt: best.pt, rect: best.rect, clean: !best.hard });
      });
      return out;
    }
    /* a name folded onto two lines at the word break nearest its middle */
    function fold(name) {
      var w = String(name).split(/\s+/);
      if (w.length < 2) return [name];
      var best = null;
      for (var i = 1; i < w.length; i++) {
        var a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), d = Math.max(a.length, b.length);
        if (!best || d < best.d) best = { d: d, lines: [a, b] };
      }
      return best.lines;
    }
    /* the label anchors of a shield: the middles of its rect's sides, in scene coordinates (a leader starts at the shield's
       edge, never across it) */
    function shieldAnchors(sp, cam) {
      var r = sp.rect, cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      return [[r.x1, cy], [r.x0, cy], [cx, r.y0], [cx, r.y1]].map(function (q) { return text.toScene({ x: q[0], y: q[1] }, cam); });
    }

    var marks = {}, trails = {}, traced = [], finals = [], out = [], t0 = 0;
    function earliest(map, id, t) { if (!(id in map) || t < map[id]) map[id] = t; }
    /* beats the painter does not support in version 1 are skipped with a warning (iso: camera beats, a second card) */
    function supported(st, beats) {
      var cards = 0;
      return beats.filter(function (b) {
        var kind = pattern.kindOf(b), why = null;
        if (kind === 'camera' && painter.cameraBeats === false) why = 'is not supported by the ' + ctx.style + ' painter';
        if (kind === 'card' && painter.maxCards != null && ++cards > painter.maxCards) why = 'is card ' + cards + '; the ' + ctx.style + ' painter shows ' + painter.maxCards + ' per step';
        if (why) console.warn('step "' + st.id + '": ' + kind + ' beat ' + why + '; skipped');
        return !why;
      });
    }

    story.steps.forEach(function (st, i) {
      var last = i === story.steps.length - 1;
      var beats = supported(st, pattern.beatsFor(st)), inv = pattern.involved(st, beats);
      var stepFrame = frameOf(st, inv.nodes);
      var routes = [], sets = { nodes: {}, boxes: {}, edges: {} };
      inv.nodes.forEach(function (id) {
        sets.nodes[id] = 1;
        var p = estate.B[id] && estate.B[id].parent;
        while (p && p !== 'root') { sets.boxes[p] = 1; p = estate.B[p].parent; }
      });
      inv.pairs.forEach(function (pr) {
        var lk = EXK.route.findLink(estate.routes, pr[0], pr[1]);
        if (lk && !sets.edges[lk.id]) { sets.edges[lk.id] = 1; routes.push(lk.id); }
      });
      painter.focus(st.all ? null : sets, t0, i === 0 ? T.INSTANT : T.FOCUS_DUR);

      var c = makeStep(st, i, t0, inv, routes);

      /* the step's camera: a leading camera beat is the step's move; otherwise the step's frame, if it differs */
      var k0 = 0, moved = false;
      if (beats.length && pattern.kindOf(beats[0]) === 'camera' && typeof beats[0].at !== 'number') {
        moved = c.camera(t0, beats[0].camera) > t0;
        k0 = 1;
      } else if (!sameFrame(stepFrame, cur)) {
        c.camera(t0, stepFrame);
        moved = true;
      }
      if (!moved) {
        planText(cur, t0, st, inv, routes, c);
        if (!cur.full) c.crumbs.push({ move: t0, from: t0 + T.CAMERA_MOVE + T.CRUMB_AFTER_CAMERA, parts: cur.crumb || [] });
      }
      c.motionStart = t0 + T.motionStart(moved);

      /* beats in order: after every earlier beat has ended, or PARALLEL_GAP after the previous one started, or `at`
         seconds after motion start. A camera beat waits for every earlier beat; no beat starts during a camera move. */
      var prevStart = c.motionStart, prevEnd = c.motionStart, camResume = c.motionStart;
      for (var k = k0; k < beats.length; k++) {
        var b = beats[k], kind = pattern.kindOf(b), start;
        if (typeof b.at === 'number') start = c.motionStart + b.at;      /* a card's `at` is a system id, not a time */
        else if (b.parallel) start = prevStart + T.PARALLEL_GAP;
        else start = prevEnd;
        var floor = kind === 'camera' ? prevEnd : camResume;
        if (start < floor - 1e-6) {
          if (typeof b.at === 'number' || b.parallel) c.warn(b, (kind === 'camera' ? 'would move the camera while packets move' : 'would start during a camera move') + '; moved to ' + (floor - t0).toFixed(1) + ' s into the step');
          start = floor;
        }
        var end = c.beat(b, start);
        if (kind === 'camera') camResume = end;
        prevStart = start;
        prevEnd = Math.max(prevEnd, start, end);
      }

      c.callouts();
      c.finalizeEmphasis();
      c.finalizeLabels();
      var endR = c.lastMotion - t0, firstR = c.firstMotion == null ? null : c.firstMotion - t0, labelR = c.labelEnd ? c.labelEnd - t0 : 0;
      var len = T.stepEnd({ end: endR, labelEnd: labelR, firstMotion: firstR, bodyWords: T.wordCount(st.body), final: last });
      var tEnd = t0 + len;
      shell.stepChrome(tl, i, t0, tEnd, { bodyAt: T.bodyAt(firstR == null ? endR : firstR, endR) });

      /* callouts and proxy badges fade before the step ends (the last step keeps them) */
      if (!last) c.extras.forEach(function (it) { if (!isFinite(it.until)) text.vanish(it, tEnd - T.CALLOUT_OUT_LEAD); });

      /* breadcrumb for every non-full frame the camera rests on during the step */
      c.crumbs.forEach(function (cr, n) {
        var next = c.crumbs[n + 1], until = next ? next.move : tEnd - T.CRUMB_OUT_LEAD;
        if (cr.parts.length && until >= cr.from + T.CRUMB_MIN) camera.crumb(tl, cr.from, until, cr.parts);
      });

      /* lit links fade, trails come up (not on the last step: the summary keeps its lines) */
      if (!last) {
        var tf = t0 + Math.max(endR + T.LIT_AFTER_MOTION, labelR - T.LIT_BEFORE_LABEL);
        c.lines.forEach(function (ln) { tl.fromTo(ln, { opacity: 1 }, { opacity: 0, duration: T.LIT_FADE, ease: 'power1.in', immediateRender: false }, tf); });
        c.trailIds.forEach(function (id) { earliest(trails, id, tf); });
      }

      out.push({ id: st.id, phase: st.phase, time: t0, title: st.title, body: st.body,
        rest: t0 + T.restOf({ len: len, end: endR, labelEnd: labelR, firstMotion: firstR }) });
      t0 = tEnd;
    });

    /* markers and trails: one tween each, at the earliest time asked; then anything later on them (the summary) */
    Object.keys(marks).forEach(function (id) {
      tl.fromTo(painter.marker(id), { opacity: 0 }, { opacity: 1, duration: T.MARK_IN, ease: 'power2.out', immediateRender: false }, marks[id]);
    });
    Object.keys(trails).forEach(function (id) {
      tl.fromTo(painter.trail(id), { opacity: 0 }, { opacity: painter.TRAIL_OPACITY, duration: T.TRAIL_IN, ease: 'power1.out', immediateRender: false }, trails[id]);
    });
    finals.forEach(function (fn) { fn(); });

    return { steps: out, duration: t0, moments: pattern.moments(story, out) };

    /* ---------------- the per-step context ---------------- */
    function makeStep(st, index, t0, inv, routes) {
      var c = {
        step: st, index: index, t0: t0, story: story, estate: estate, tl: tl, text: text, painter: painter, timing: T,
        color: colorOf(st.color, C.accent), motionStart: t0 + T.MOTION_START,
        firstMotion: null, lastMotion: t0, labelEnd: 0, camEnd: null,
        lines: [], trailIds: [], recs: [], crumbs: [], hops: [], extras: [], proxies: {}
      };

      c.frame = function () { return cur; };
      c.colorOf = function (name) { return colorOf(name, c.color); };
      c.warn = function (b, msg) { console.warn('step "' + st.id + '": ' + (pattern.kindOf(b) || 'beat') + ' ' + msg); };
      /* motion bookkeeping: the step's first motion (body timing) and last motion end (step end) */
      c.motion = function (a, z) {
        if (c.firstMotion == null || a < c.firstMotion) c.firstMotion = a;
        if (z > c.lastMotion) c.lastMotion = z;
      };

      /* camera(t, spec) -> when motion may resume. spec: 'full' | 'step' | {hold, grow} | a frame.
         Moves the camera (CAMERA_MOVE), opens a text session for the new frame, records the breadcrumb; proxy badges
         of the old frame go. */
      c.camera = function (t, spec) {
        var f = spec === 'full' ? FULL : spec === 'step' ? frameOf(st, inv.nodes)
          : (spec && spec.w) ? spec : frameOf(spec);
        if (sameFrame(f, cur)) return t;
        Object.keys(c.proxies).forEach(function (k) { var it = c.proxies[k]; if (!isFinite(it.until)) text.vanish(it, t); });
        c.proxies = {};
        var e = camera.camTo(t, f, T.CAMERA_MOVE);
        cur = f;
        planText(f, t, st, inv, routes, c);
        c.crumbs.push({ move: t, from: e + T.CRUMB_AFTER_CAMERA, parts: f.full ? [] : (f.crumb || []) });
        c.motion(t, e);
        c.camEnd = e;
        return Math.max(e, t + T.MOTION_START_AFTER_CAMERA);
      };

      c.link = function (from, to) { return EXK.route.findLink(estate.routes, from, to); };

      /* packet(color, tag?, mono?, glyph?) -> {el, tag, hide}: a hidden packet, a chip when it carries a tag, else the
         glyph when one is named (EXK.GLYPHS), else a dot */
      c.packet = function (color, tag, mono, glyph) {
        var el = painter.packet({ color: color, chip: !!tag, glyph: tag ? null : glyph || null });
        return { el: el, hide: [], tag: tag ? text.tag({ packet: el, label: tag, color: color, mono: !!mono }) : null };
      };
      c.show = function (pk, t) { tl.fromTo(pk.el, { opacity: 0 }, { opacity: 1, duration: T.INSTANT, immediateRender: false }, t); };
      c.hide = function (pk, t) {
        tl.fromTo(pk.el, { opacity: 1 }, { opacity: 0, duration: T.INSTANT, immediateRender: false }, t + T.PACKET_LINGER);
        if (pk.tag) emitHides(pk, t);
      };

      /* the stretches of a hop where the chip's text would touch a node label (the packet is passing behind that node) */
      function behindNodes(pk, path, Lp, s0, s1, t, dur, cam) {
        var labels = painter.textRects(cam).filter(function (q) { return q.key.indexOf('label:') === 0; }).map(function (q) { return q.rect; });
        var tg = pk.tag, kz = area.w / cam.w, n = Math.max(2, Math.ceil(Math.abs(s1 - s0) * Lp * kz / TAG_SAMPLE)), run = null;
        for (var m = 0; m <= n; m++) {
          var f = m / n, q = path.getPointAtLength(Lp * (s0 + (s1 - s0) * f));
          var p = { x: area.x + (q.x - cam.x) * kz, y: area.y + (q.y - cam.y) * kz };
          var r = { x0: p.x - tg.w / 2 - TAG_NODE_PAD, x1: p.x + tg.w / 2 + TAG_NODE_PAD, y0: p.y - tg.lift - tg.h - TAG_NODE_PAD, y1: p.y - tg.lift + TAG_NODE_PAD };
          var hit = labels.some(function (b) { return r.x0 < b.x1 && b.x0 < r.x1 && r.y0 < b.y1 && b.y0 < r.y1; });
          var tm = t + dur * T.invPacketEase(f);
          if (hit) { if (!run) run = [t + dur * T.invPacketEase(Math.max(0, f - 1 / n)), tm]; else run[1] = tm; }
          else if (run) { run[1] = tm; pk.hide.push(run); run = null; }
        }
        if (run) pk.hide.push(run);
      }
      /* the chip text's hide intervals, merged, as opacity tweens in time order; a hide that lasts until the last
         arrival lasts until the packet is gone */
      function emitHides(pk, endT) {
        var ivs = pk.hide.slice().sort(function (a, b) { return a[0] - b[0]; }), merged = [];
        ivs.forEach(function (v) {
          var lastV = merged[merged.length - 1];
          if (lastV && v[0] - T.TAG_HIDE < lastV[1] + T.TAG_HIDE) lastV[1] = Math.max(lastV[1], v[1]); else merged.push([v[0], v[1]]);
        });
        merged.forEach(function (v) {
          tl.fromTo(pk.tag.txt, { opacity: 1 }, { opacity: 0, duration: T.TAG_HIDE, ease: 'power1.in', immediateRender: false }, v[0] - T.TAG_HIDE);
          if (v[1] < endT - 1e-6) tl.fromTo(pk.tag.txt, { opacity: 0 }, { opacity: 1, duration: T.TAG_HIDE, ease: 'power1.out', immediateRender: false }, v[1]);
        });
      }

      /* proxy(nodeId, linkId, end, rg, t): the pinned badge standing in for an off-frame system, where its link enters
         the frame (one per system per frame; its links join its emphasis) */
      c.proxyWidth = function (id) { return text.pinW(sysOf[id] ? sysOf[id].short : id) + 2 * PROXY_GAP; };
      c.proxy = function (id, linkId, end, rg, t) {
        var have = c.proxies[id];
        if (have) { if (have.edges.indexOf(linkId) < 0) have.edges.push(linkId); return have; }
        var r = estate.routes[linkId], pp = EXK.frame.proxyPoint(r, cur, end), path = painter.pathEl(linkId);
        var q = path.getPointAtLength((end === 'a' ? rg.f0 : rg.f1) * path.getTotalLength());
        var s = sysOf[id] || {};
        var it = text.pin({ key: 'proxy:' + id, lines: s.short || id, anchor: { x: q.x, y: q.y }, side: pp ? pp.side : 'left', gap: PROXY_GAP,
          color: colorOf(s.tint, C.muted), edges: [linkId], at: Math.max(t - T.PROXY_LEAD, c.t0) });
        c.proxies[id] = it;
        c.extras.push(it);
        c.motion(it.at, it.at);
        return it;
      };

      /* hop(pk, from, to, t, color, o) -> arrival time. One hop at capped speed along the on-screen part of the link
         (an off-frame end is a proxy badge; the packet enters or leaves through it): the link lights as the packet
         travels it, port rings light as it crosses them, a ring on arrival (unless the end is off-frame), the hop log.
         o: {trail, noLine, noRing} */
      c.hop = function (pk, from, to, t, color, o) {
        o = o || {};
        var lk = c.link(from, to);
        if (!lk) { console.warn('step "' + st.id + '": no link ' + from + ' -> ' + to + '; hop skipped'); return t; }
        var id = lk.id, rev = lk.rev, cam = cur, route = estate.routes[id], path = painter.pathEl(id), Lp = path.getTotalLength();
        var rg = painter.onScreenRange(id, cam, 0), pw = 0;
        if (rg.aOff) pw = Math.max(pw, c.proxyWidth(route.a));
        if (rg.bOff) pw = Math.max(pw, c.proxyWidth(route.b));
        if (pw) rg = painter.onScreenRange(id, cam, pw);
        var dur = T.hopDuration((rg.f1 - rg.f0) * Lp * area.w / cam.w);
        var s0 = rev ? rg.f1 : rg.f0, s1 = rev ? rg.f0 : rg.f1;
        /* the speed cap holds across hops too: a hop that starts away from where this packet's last hop ended (it went into
           one proxy badge and comes out of another) starts PROXY_PASS later, the packet hidden in between */
        var kz = area.w / cam.w, q0 = path.getPointAtLength(s0 * Lp), q1 = path.getPointAtLength(s1 * Lp);
        if (pk.last && Math.hypot((q0.x - pk.last.x) * kz, (q0.y - pk.last.y) * kz) > T.JUMP_PX) {
          tl.fromTo(pk.el, { opacity: 1 }, { opacity: 0, duration: T.INSTANT, immediateRender: false }, t);
          t += T.PROXY_PASS;
          tl.fromTo(pk.el, { opacity: 0 }, { opacity: 1, duration: T.INSTANT, immediateRender: false }, t);
        }
        pk.last = { x: q1.x, y: q1.y };
        if (rg.aOff) c.proxy(route.a, id, 'a', rg, t);
        if (rg.bOff) c.proxy(route.b, id, 'b', rg, t);
        /* motion: a fromTo on a progress proxy; onUpdate places the packet on the path */
        var prog = { f: s0 }, el = pk.el;
        tl.fromTo(prog, { f: s0 }, { f: s1, duration: dur, ease: T.PACKET_EASE, immediateRender: false, onUpdate: function () {
          var q = path.getPointAtLength(prog.f * Lp);
          el.setAttribute('transform', 'translate(' + q.x.toFixed(2) + ',' + q.y.toFixed(2) + ')');
        } }, t);
        if (pk.tag) {
          pk.tag.hop({ path: path, f0: rg.f0, f1: rg.f1, rev: rev, t: t, dur: dur });
          behindNodes(pk, path, Lp, s0, s1, t, dur, cam);
        }
        if (!o.noLine) {
          var ln = painter.lightLink(id, color);
          tl.fromTo(ln, { opacity: 0 }, { opacity: 1, duration: T.INSTANT, immediateRender: false }, t);
          tl.fromTo(ln, { drawSVG: pct(s0) + ' ' + pct(s0) }, { drawSVG: pct(rg.f0) + ' ' + pct(rg.f1), duration: dur, ease: T.PACKET_EASE, immediateRender: false }, t);
          c.lines.push(ln);
        }
        /* port rings light while the packet crosses them (P§9) */
        (route.ports || []).forEach(function (q) {
          if (q.m == null || q.f < Math.min(s0, s1) || q.f > Math.max(s0, s1) || s0 === s1) return;
          var tp = t + dur * T.invPacketEase((q.f - s0) / (s1 - s0)), pl = painter.portLight(q.m, color);
          tl.fromTo(pl, { opacity: 0 }, { opacity: 1, duration: T.PORT_IN, ease: 'power2.out', immediateRender: false }, tp - T.PORT_IN);
          tl.fromTo(pl, { opacity: 1 }, { opacity: 0, duration: T.PORT_OUT, ease: 'power2.in', immediateRender: false }, tp + T.PORT_HOLD);
        });
        var arriveOff = rev ? rg.aOff : rg.bOff;
        if (!o.noRing && !arriveOff) c.ring(to, t + dur - T.RING_LEAD, color);
        if (o.trail) { c.trailIds.push(id); if (traced.indexOf(id) < 0) traced.push(id); }
        c.hops.push({ t: t, t1: t + dur, rid: id, from: from, to: to, rev: rev, rg: rg, path: path, Lp: Lp });
        text.logHop({ step: st.id, rid: id, t0: t, t1: t + dur, ends: [from, to] });
        c.motion(t, t + dur);
        return t + dur;
      };

      /* travel(pk, ids, t, color, o) -> {end, arr}: one packet along a path of system ids */
      c.travel = function (pk, ids, t, color, o) {
        var r = t, arr = {};
        arr[ids[0]] = t;
        for (var n = 1; n < ids.length; n++) { r = c.hop(pk, ids[n - 1], ids[n], r, color, o); arr[ids[n]] = r; }
        return { end: r, arr: arr };
      };

      /* chain(ids, t, o) -> arrival at the last id. One packet along the path. o: {tag, color, says, sayAt, trail,
         mark, mono}. `says` is shown at departure beside sayAt (default the destination) and held after arrival. */
      c.chain = function (ids, t, o) {
        o = o || {};
        var color = c.colorOf(o.color), pk = c.packet(color, o.tag, o.mono), h0 = c.hops.length;
        c.show(pk, t);
        var tr = c.travel(pk, ids, t, color, { trail: o.trail });
        c.hide(pk, tr.end);
        if (o.says != null && o.says !== '') {
          var at = o.sayAt && o.sayAt !== 'dest' ? o.sayAt : ids[ids.length - 1];
          c.say(o.says, { node: at, anchor: c.anchorFor(at, c.hops.slice(h0)), at: t, arr: tr.end, mono: o.mono, color: color });
        }
        if (o.mark) c.mark(o.mark, (tr.arr[o.mark] != null ? tr.arr[o.mark] : tr.end) - T.MARK_LEAD);
        return tr.end;
      };

      /* exchange([from, to], t, o) -> arrival of the response. Request out, response back on the same link; the
         response label replaces the request label in the same box (P§6). o: {tag, respTag, req, resp, color, respColor,
         mono, trail, mark} */
      c.exchange = function (pair, t, o) {
        var from = pair[0], to = pair[1], color = c.colorOf(o.color), rcol = o.respColor ? c.colorOf(o.respColor) : color, h0 = c.hops.length;
        var p1 = c.packet(color, o.tag, o.mono);
        c.show(p1, t);
        var a1 = c.hop(p1, from, to, t, color, { trail: o.trail });
        c.hide(p1, a1);
        if (o.mark) c.mark(o.mark, a1 - T.MARK_LEAD);
        var req = o.req != null ? o.req : '', resp = o.resp != null ? o.resp : '';
        var tOff = a1 + T.holdFor(linesOf(req).join(' ')), tRep = tOff + T.LABEL_FADE_OUT;   /* request gone, then response */
        var p2 = c.packet(rcol, o.respTag || o.tag, o.mono);
        c.show(p2, tRep);
        var a2 = c.hop(p2, to, from, tRep, rcol, { noRing: true });
        c.hide(p2, a2);
        if (req !== '') {
          var anchor = c.anchorFor(to, c.hops.slice(h0));
          var s1 = c.say(req, { node: to, anchor: anchor, at: t, until: tOff, sizeWith: resp || null, mono: o.mono, color: color });
          if (resp !== '') c.say(resp, { sameAs: s1, at: tRep, arr: a2, mono: o.mono, color: rcol });
        }
        return a2;
      };

      /* stream(path, t, o) -> last arrival. Up to STREAM_MAX plain packets STREAM_SPACING apart along the path; the
         `says` label at the sender; a tally at the receiver whose lines appear as each packet lands. o: {items, says,
         tally, mono, color, tag, glyph} */
      c.stream = function (ids, t, o) {
        var color = c.colorOf(o.color), items = (o.items || []).slice(0, T.STREAM_MAX), n = Math.max(1, items.length);
        /* plain packets: no text; each is the beat's glyph (file, push, mail, key; default a dot), or a chip when the
           stream has a tag */
        var t1 = o.says ? t + T.STREAM_SAY_LEAD : t, arrs = [], h0 = c.hops.length;
        for (var k = 0; k < n; k++) {
          var pk = c.packet(color, o.tag, o.mono, o.glyph || 'dot'), ts = t1 + k * T.STREAM_SPACING;
          c.show(pk, ts);
          var tr = c.travel(pk, ids, ts, color, { noLine: k > 0, noRing: k < n - 1 });
          c.hide(pk, tr.end);
          arrs.push(tr.end);
        }
        var end = Math.max.apply(null, arrs), hs = c.hops.slice(h0), src = ids[0], dst = ids[ids.length - 1];
        if (o.says) c.say(o.says, { node: src, anchor: c.anchorFor(src, hs), at: t, arr: end, mono: o.mono, color: color });
        if (o.tally && items.length) {
          /* heading, then one item per row, each appearing as its packet lands; under the receiver's proxy badge
             (left-aligned with it, growing downward) or, when the receiver is in view, beside it by the placer */
          var at = arrs[0] - T.TALLY_LEAD, lines = [o.tally].concat(items), lineAt = [at].concat(arrs), badge = c.proxies[dst], ty;
          if (badge) ty = text.pin({ key: 'tally:' + dst, lines: lines, below: badge, gap: PROXY_GAP, at: at, mono: true, color: color, lineAt: lineAt });
          else ty = text.tally({ lines: lines, node: dst, anchors: ['side', 'bottom', 'top'].map(function (sd) { return painter.anchor(dst, sd); }),
            forceAt: 2, at: at, mono: true, color: color, lineAt: lineAt });
          c.recs.push({ item: ty, arr: end, text: items.join(' ') });
        }
        return end;
      };

      /* card(b, t) -> when the next beat may start: a text card beside its system that holds cardHold; then:'fold'
         folds it into the system. */
      c.card = function (b, t) {
        var rows = b.rows || [], hold = T.cardHold([b.title || ''].concat(rows).join(' ')), color = c.colorOf(b.color);
        /* rows CARD_PX mono, larger when the camera is closer than the cap and so has room (the card is the subject) */
        var fs = Math.round(CARD_PX * Math.min(CARD_GROW, Math.max(1, (area.w / cur.w) / CARD_ZOOM)));
        var it = text.card({ title: b.title != null ? b.title : null, rows: rows, node: b.at, at: t, color: color, key: 'card:' + b.card, fs: fs,
          anchors: ['side', 'bottom', 'top', 'right', 'left'].map(function (sd) { return painter.anchor(b.at, sd); }) });
        c.motion(t, t);
        if (b.then === 'fold') {
          if (painter.cardFold === false) tl.fromTo(it.pres, { opacity: 1 }, { opacity: 0, duration: T.FOLD, ease: 'power2.inOut', immediateRender: false }, t + hold);   /* fades where it stands (iso) */
          else tl.fromTo(it.pres, { scale: 1, opacity: 1 }, { scale: 0.3, opacity: 0, svgOrigin: '0 0', duration: T.FOLD, ease: 'power2.inOut', immediateRender: false }, t + hold);
          it.until = t + hold;
          c.labelEnd = Math.max(c.labelEnd, t + hold + T.FOLD);
        } else {
          c.recs.push({ item: it, arr: t, text: rows.join(' '), hold: hold });
        }
        return t + hold;
      };

      /* say(lines, o) -> text item. A stationary label next to o.node (or at o.anchor), leader within about 120 stage
         px; if there is no room that close, directly above the node. Shown at o.at; held after o.arr by holdFor, or
         lastHoldFor for the step's last label (finalizeLabels), or until o.until when given.
         o: {node, anchor, at, arr, until, mono, color, sizeWith, sameAs, lineAt} */
      c.say = function (lines, o) {
        var ln = linesOf(lines), spec = { lines: ln, node: o.node, at: o.at, mono: !!o.mono, color: o.color || c.color,
          sizeWith: o.sizeWith || null, sameAs: o.sameAs || null, lineAt: o.lineAt || null, dists: area.w / cur.w > 1 ? SAY_DISTS_CLOSE : SAY_DISTS };
        if (o.anchor) spec.anchors = [o.anchor];
        else if (!o.sameAs) { spec.anchors = ['bottom', 'side', 'top', 'right', 'left'].map(function (sd) { return painter.anchor(o.node, sd); }); spec.forceAt = 2; }
        var it = text.say(spec);
        if (o.until != null) { text.vanish(it, o.until); c.labelEnd = Math.max(c.labelEnd, o.until + T.LABEL_FADE_OUT); }
        else c.recs.push({ item: it, arr: o.arr != null ? o.arr : o.at, text: ln.join(' ') });
        c.motion(o.at, o.at);
        return it;
      };

      /* the step's callouts (0-2), through the placer, once the camera has settled on the frame that shows their target */
      c.callouts = function () {
        (st.callouts || []).forEach(function (cd) {
          var b = estate.B[cd.target];
          var q = b && painter.anchor(cd.target, 'center');
          if (b && !inFrame({ cx: q.x, cy: q.y }, cur)) { console.warn('step "' + st.id + '": callout target ' + cd.target + ' is outside the frame; callout skipped'); return; }
          var at = Math.max(c.motionStart, c.camEnd || 0), anchors = null;
          if (b) anchors = ['side', 'bottom', 'top'].map(function (sd) { return painter.anchor(cd.target, sd); });
          var it = text.callout({ text: cd.text, target: cd.target, anchors: anchors || [painter.anchor(cd.target)], forceAt: anchors ? 2 : 0, at: at, color: c.color });
          c.extras.push(it);
          c.motion(at, at);
        });
      };

      /* emphasis events (P§8), once the step is built: a hop's end nodes, plus those of every hop still in flight when
         it starts (parallel flows keep both pairs at full strength) */
      c.finalizeEmphasis = function () {
        c.hops.forEach(function (h) {
          var nodes = [h.from, h.to];
          c.hops.forEach(function (q) {
            if (q !== h && q.t <= h.t + 1e-6 && q.t1 > h.t + 1e-6) { if (nodes.indexOf(q.from) < 0) nodes.push(q.from); if (nodes.indexOf(q.to) < 0) nodes.push(q.to); }
          });
          text.emphasis(h.t, h.rid, nodes);
        });
      };

      /* where a label for node id goes: the node, or, when the node is outside the frame, the on-screen end of the
         hop that touches it (where its proxy badge is) */
      c.anchorFor = function (id, hops) {
        for (var n = 0; n < hops.length; n++) {
          var h = hops[n];
          if (h.from !== id && h.to !== id) continue;
          var isA = (h.from === id) !== h.rev;            /* the node is the route's `a` end */
          if (!(isA ? h.rg.aOff : h.rg.bOff)) return null;
          var f = isA ? h.rg.f0 : h.rg.f1, q = h.path.getPointAtLength(f * h.Lp);
          return { x: q.x, y: q.y };
        }
        return null;
      };

      /* label fade-outs, once the step is built, so the last label can take the shorter hold (P§7); cards keep cardHold */
      c.finalizeLabels = function () {
        var mx = -Infinity;
        c.recs.forEach(function (r) { mx = Math.max(mx, r.arr + (r.hold != null ? r.hold : T.holdFor(r.text))); });
        c.recs.forEach(function (r) {
          var until = r.arr + (r.hold != null ? r.hold : T.holdFor(r.text));
          if (r.hold == null && until >= mx - 0.01) until = Math.max(r.arr, c.lastMotion) + T.lastHoldFor(r.text);   /* the last label outlasts the step's last motion (parallel flows land after it arrived) */
          text.vanish(r.item, until);
          c.labelEnd = Math.max(c.labelEnd, until + T.LABEL_FADE_OUT);
        });
      };

      c.mark = function (id, t) { earliest(marks, id, t); };
      c.ring = function (id, t, color) {
        var r = painter.ring(id, color);
        tl.fromTo(r, { opacity: 0 }, { opacity: 1, duration: T.RING_IN, ease: 'power2.out', immediateRender: false }, t);
        tl.fromTo(r, { opacity: 1 }, { opacity: 0, duration: T.RING_OUT, ease: 'power2.in', immediateRender: false }, t + T.RING_HOLD);
        return t + T.RING_HOLD;
      };

      /* shields(spec, t) -> end of the summary: the chain traced link by link, a shield landing on each control's link
         (planShields; number from controls[].stops), the chain fading back, then everything named at full strength (P§8).
         Names: each beside its shield, on one line or folded onto two, clear of blocks (painter.shieldTiers: iso may cover the
         empty corners of a block's projected box, never text), with a leader that crosses nothing
         (a dry run of the whole set first). When one does not fit, or there are more than LEGEND_AT controls, every shield
         carries a letter instead and the names go into one legend panel (the stated degrade rule). */
      c.shields = function (spec, t) {
        var s = text.sessions[text.sessions.length - 1];
        var plan = s.shields || planShields(spec, s);
        var traces = [];
        traced.forEach(function (id, n) {
          var ln = painter.traceLink(id), ts = t + n * T.TRACE_GAP;
          tl.fromTo(ln, { opacity: 0 }, { opacity: 1, duration: T.INSTANT, immediateRender: false }, ts);
          tl.fromTo(ln, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: T.TRACE_DRAW, ease: 'power2.inOut', immediateRender: false }, ts);
          traces.push(ln);
        });
        controlsOf(spec).forEach(function (k) {
          if (!plan.some(function (q) { return q.k === k; })) console.warn('step "' + st.id + '": control ' + k.id + ' is not on a link; shield skipped');
        });
        var names = plan.map(function (sp) { return painter.shieldName ? painter.shieldName(sp.k) : sp.k.name; }), shapes = [], misfit = null;
        var legend = plan.length > LEGEND_AT || !text.trial(function () {
          return plan.every(function (sp, n) {
            var o = { anchors: shieldAnchors(sp, s.cam), maxLead: SHIELD_LEAD, tiers: painter.shieldTiers || [[0, 1]] };
            if (text.fits(Object.assign({ lines: [names[n]] }, o))) { shapes[n] = [names[n]]; return true; }
            var two = fold(names[n]);
            if (two.length > 1 && text.fits(Object.assign({ lines: two }, o))) { shapes[n] = two; return true; }
            misfit = sp.k.id;
            return false;
          });
        });
        if (legend) console.warn('step "' + st.id + '": ' + (plan.length > LEGEND_AT ? plan.length + ' controls (more than ' + LEGEND_AT + ')' : 'the name of control ' + misfit + ' does not fit beside its shield') + '; shields are lettered and named in a legend');
        var tTrace = t + Math.max(0, traced.length - 1) * T.TRACE_GAP + T.TRACE_AFTER, tLast = tTrace, named = [], rows = [], rowAt = [];
        plan.forEach(function (sp, n) {
          var k = sp.k, r = estate.routes[sp.link], num = stopsText(k), letter = String.fromCharCode(65 + n);
          var ts = tTrace + (n === 0 ? 0 : T.SHIELD_SECOND + (n - 1) * T.SHIELD_GAP), sh = painter.shield(sp.pt, legend ? letter : num || '\u2022');
          tl.fromTo(sh.g, { opacity: 0 }, { opacity: 1, duration: T.SHIELD_IN, ease: 'power2.out', immediateRender: false }, ts);
          tl.fromTo(sh.icon, { scale: 2.2 }, { scale: 1, svgOrigin: '0 0', duration: T.SHIELD_POP, ease: 'back.out(1.6)', immediateRender: false }, ts);
          if (legend) { rows.push(letter + '  ' + names[n] + (num ? '  (' + num + ')' : '')); rowAt.push(ts + T.SHIELD_IN); }
          else c.extras.push(text.callout({ lines: shapes[n], anchors: shieldAnchors(sp, s.cam), tiers: painter.shieldTiers || [[0, 1]], maxLead: SHIELD_LEAD, shield: n,
            at: ts + T.SHIELD_IN, color: C.secure, key: 'shield:' + k.id }));
          text.emphasis(ts + T.SHIELD_IN, null, [r.a, r.b], [n]);
          named.push(r.a, r.b);
          tLast = ts;
        });
        if (legend && rows.length) c.extras.push(text.legend({ key: 'legend:controls', title: 'Controls', rows: rows, at: rowAt[0] - T.SHIELD_IN, lineAt: [rowAt[0] - T.SHIELD_IN].concat(rowAt), color: C.secure }));
        var tAll = tLast + T.SHIELD_IN + T.SUMMARY_ALL_AFTER;
        if (named.length) text.emphasis(tAll, null, named, 'all');
        var tFade = tTrace + T.SUMMARY_FADE_AFTER;
        traces.forEach(function (ln, n) {
          if (n === 0) return;
          tl.fromTo(ln, { opacity: 1 }, { opacity: 0.1, duration: T.SUMMARY_FADE, ease: 'power2.inOut', immediateRender: false }, tFade);
        });
        finals.push(function () {
          Object.keys(trails).forEach(function (id) {
            if (id === traced[0] || trails[id] > tFade) return;
            tl.fromTo(painter.trail(id), { opacity: painter.TRAIL_OPACITY }, { opacity: 0.08, duration: T.SUMMARY_FADE, ease: 'power2.inOut', immediateRender: false }, tFade);
          });
          Object.keys(marks).forEach(function (id) {
            if (marks[id] > tFade) return;
            tl.fromTo(painter.marker(id), { opacity: 1 }, { opacity: 0.2, duration: T.SUMMARY_FADE, ease: 'power2.inOut', immediateRender: false }, tFade);
          });
        });
        /* the summary has finished changing once everything named is back at full strength (the final hold counts from there) */
        var end = Math.max(tLast + T.SUMMARY_END_AFTER, named.length ? tAll + T.DIM_DUR : 0);
        c.motion(t, end);
        return end;
      };

      /* beat(b, t) -> when the next beat may start */
      c.beat = function (b, t) {
        var kind = pattern.kindOf(b);
        switch (kind) {
          case 'chain': return c.chain(b.chain, t, b);
          case 'exchange': return c.exchange(b.exchange, t, b);
          case 'stream': return c.stream(b.stream, t, b);
          case 'card': return c.card(b, t);
          case 'mark':
            c.mark(b.mark, t);
            c.motion(t, t + T.MARK_IN);
            return t + T.MARK_IN;
          case 'pulse':
            var e = c.ring(b.pulse, t, c.colorOf(b.color));
            c.motion(t, e);
            return e;
          case 'camera': return c.camera(t, b.camera);
          case 'shields': return c.shields(b.shields, t);
          case 'custom':
            var fn = EXK.extra && EXK.extra.beats && EXK.extra.beats[b.custom];
            if (typeof fn !== 'function') { c.warn(b, '"' + b.custom + '" is not registered in EXK.extra.beats (build with --extra <file>); skipped'); return t; }
            var r = fn(c, b, t);
            return typeof r === 'number' && isFinite(r) ? r : t;
          default:
            console.warn('step "' + st.id + '": beat with no known kind skipped');
            return t;
        }
      };
      return c;
    }
  }

  EXK.runSteps = runSteps;
})();
