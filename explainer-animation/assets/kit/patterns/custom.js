/* The `custom` pattern: the seam for scenes that are not estate-based (roadmap, funding scenarios, coverage, ...).
   A scene file registers EXK.scenes.<name> = { build(ctx), step(ctx, step, t0) -> { end, ... } } and the kit
   keeps everything else: stage, phase rail, narrative band, controls, narration and presenter modes, the master
   timeline, step sequencing and length, `rest`, the window.anim contract with `moments`, the "Illustrative" chip,
   the check hooks (window.__overlaps via data-ov), seek determinism. references/patterns.md section 3 is the author's guide.

   The functions that need no browser (scene lookup, figure ledger, count, the caption clock, the legend layout, the measure
   start value) load under Node for tests; `run` and the ctx it builds need the page. EXK.patterns.custom = {
     resolveScene(story, scenes) -> {name, scene}      throws a clear message when none, several or a wrong name
     makeLedger(story) -> {figure(key), note(item, t0, t1), windows(duration), shown, count(n, of)}
     count(n, of) -> {n, of, text, derived: true}
     captionClock(T) -> {say(text, t, last), clear(t), check(what, t), readyAt()}   when a caption's text may change (the hold), pure
     captionRestFailures(log, rests) -> [step index]   steps whose rest time shows a caption panel with no caption text, pure
     legendLayout({widths, width, direction, gap, rowH, top, bottom, padX}) -> {pos, lines, height}   where legend items go
     measureStart(spec, figure) -> {n, of, fig}      the starting value of hud.measure: a figure, a ctx.count, or a number
     run(opts) -> {steps, duration, moments, chip}      opts: {story, style, shell, tl}
   }
   ctx (what a scene gets) = {
     story, style, timing, THEME, area {x,y,w,h}, shell
     tl                 the master timeline, restricted: fromTo (always immediateRender:false) and addLabel; to/from/set throw
     layers.world       <g> in the diagram area's svg (area px: 0,0 is the area's top-left, 1920x720)
     layers.hud         <g> in the text layer (stage px: 1920x1080); drawn above the world
     el(tag, attrs, parent)       svg element
     text.add(parent, str, attrs, key) -> item   an svg <text> that is registered (data-ov, emphasis); item.el,
                        item.also(els) (dim these with it), item.keep() (never dimmed)
     text.register({key, el|els, dim: [extra els]}) -> item
     group(el|els, key) -> item   a non-text group that emphasis dims. The elements move into <g><g>: emphasis tweens the
                        outer <g> (item.outer), the scene tweens item.el (the inner <g>) and nothing fights. item.also, item.keep
     emphasise(items|'all', t)    the dimming rule: items stay full, every other registered item goes to DIM_TEXT; items may
                        mix text items and groups, and nest in arrays
     figure(key) -> {key, value, unit, label, source, shown(t0, t1)}   throws for a key not in story.figures
     shown(item, t0, t1)          a figure or a story record is on screen from t0 to t1 (drives the chip)
     count(n, of)                 a computed count, "9 of 12"
     block(name)                  story[name]: the story's pattern block
     moment(name, t)              publishes a named moment in window.anim.moments
     hud.banner / hud.measure / hud.legend / hud.panel / hud.caption     scene/hud.js
     atStepEnd(fn)      fn({t, rest, index}) runs once the step's length is known; t is the start of the next step. A mark or pill
                        that stays "until the step ends" fades out at t, never before rest. Not called for the last step
     stepIndex, isLast, stepStart   of the step being built
   }
   Rest rule: a step's last caption stays on screen through the step's rest (stills and the last frame of each clip are taken
   there) and is cleared at the start of the next step or replaced by its first caption; a hide or clear asked for before rest waits
   for the step end. run() throws at boot when a caption panel is on screen with no caption text at some step's rest. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  EXK.patterns = EXK.patterns || {};
  EXK.scenes = EXK.scenes || {};

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* ---- which scene runs ---- */
  function resolveScene(story, scenes) {
    var names = Object.keys(scenes || {}), want = story && story.meta && story.meta.scene;
    var how = 'the scene file must set EXK.scenes.<name> = { build(ctx), step(ctx, step, t0) }';
    if (!names.length) throw new Error('--pattern custom: no scene is registered; ' + how);
    var name = want;
    if (want === undefined || want === null || want === '') {
      if (names.length > 1) throw new Error('--pattern custom: several scenes are registered (' + names.join(', ') + '); set meta.scene in the story to the one to run');
      name = names[0];
    } else if (!own(scenes, want)) {
      throw new Error('--pattern custom: meta.scene is "' + want + '" but the scene file registers ' + names.map(function (n) { return '"' + n + '"'; }).join(', ') + '; ' + how);
    }
    var sc = scenes[name];
    if (!sc || typeof sc.build !== 'function' || typeof sc.step !== 'function') {
      throw new Error('EXK.scenes.' + name + ' needs build(ctx) and step(ctx, step, t0) functions');
    }
    return { name: name, scene: sc };
  }

  /* ---- counts are computed, never typed ---- */
  function count(n, of) {
    if (!(typeof n === 'number' && isFinite(n) && n >= 0 && Math.floor(n) === n)) throw new Error('ctx.count(' + n + ', ' + of + '): n must be a whole number, 0 or more; compute it from the data');
    if (!(typeof of === 'number' && isFinite(of) && of >= n && Math.floor(of) === of)) throw new Error('ctx.count(' + n + ', ' + of + '): "of" must be a whole number, at least n; compute it from the data');
    return { n: n, of: of, text: n + ' of ' + of, derived: true };
  }

  /* ---- text that changes over time: when it may change ----
     A caption shows one text (a heading and a sentence) at a time. A replacement may start only when the text on screen has
     been readable standing still for its hold (ctx.timing: holdFor, or lastHoldFor for the last one of a step); the old text
     fades out first and the new one fades in after it, so the two are never visible together (the overlap check samples
     mid-fade). say(text, t, last) -> {outAt, outDur, inAt, inDur, visible, hold, readyAt}; outAt is null when nothing
     was showing. clear(t) -> {outAt, outDur} or null. Calls come in time order; too early is an error naming the time. */
  var CAP_OUT = 0.25, CAP_IN = 0.35;
  function captionClock(T) {
    var shown = null, readyAt = -Infinity, outEnd = -Infinity, lastT = -Infinity;
    function check(what, t) {
      if (typeof t !== 'number' || !isFinite(t)) throw new Error('caption.' + what + ': t must be a time in seconds');
      if (t < lastT - 1e-9) throw new Error('caption.' + what + ': called at ' + t + ' s after ' + lastT + ' s; call it in time order');
      if (shown !== null && t < readyAt - 1e-9) {
        throw new Error('caption.' + what + ': at ' + t.toFixed(2) + ' s would remove "' + shown + '" before it has been readable standing still for its hold; the earliest is ' + readyAt.toFixed(2) + ' s (use the readyAt a say returned)');
      }
    }
    function order(what, t) { check(what, t); lastT = t; }
    return {
      say: function (text, t, last) {
        order('say', t);
        var out = shown !== null, inAt = out ? t + CAP_OUT : Math.max(t, outEnd);
        var hold = last ? T.lastHoldFor(text) : T.holdFor(text);
        if (out) outEnd = t + CAP_OUT;
        shown = text; readyAt = inAt + CAP_IN + hold;
        return { outAt: out ? t : null, outDur: CAP_OUT, inAt: inAt, inDur: CAP_IN, visible: inAt + CAP_IN, hold: hold, readyAt: readyAt };
      },
      clear: function (t) {
        order('clear', t);
        if (shown === null) return null;
        shown = null; outEnd = t + CAP_OUT; readyAt = -Infinity;
        return { outAt: t, outDur: CAP_OUT };
      },
      check: check,
      readyAt: function () { return shown === null ? -Infinity : readyAt; }
    };
  }

  /* ---- the rest rule, as a pure check ----
     log: what one caption did, in the order it was asked: {kind:'panel', on, t}, {kind:'say', start, visible} (start: when the
     old text began to go, or when the new one began to come; visible: when the new one is fully in), {kind:'clear', start}.
     rests: the rest time of each step. A step fails when the panel is on at its rest and the text is not fully in. */
  function captionRestFailures(log, rests) {
    var bad = [];
    rests.forEach(function (r, i) {
      var on = false, text = null;
      log.forEach(function (e) {
        if (e.kind === 'panel') { if (e.t <= r + 1e-9) on = e.on; }
        else if (e.start <= r + 1e-9 && (text === null || e.start >= text.start)) text = e;
      });
      if (on && !(text && text.kind === 'say' && text.visible <= r + 1e-9)) bad.push(i);
    });
    return bad;
  }

  /* ---- where legend items go: one per line (column) or left to right, wrapping when the next does not fit (row) ---- */
  function legendLayout(o) {
    var widths = o.widths, row = o.direction === 'row', gap = o.gap == null ? 40 : o.gap, rowH = o.rowH || 44, padX = o.padX == null ? 18 : o.padX;
    var top = o.top || 0, bottom = o.bottom || 0, maxX = o.width - padX, x = padX, line = 0, pos = [];
    widths.forEach(function (w, i) {
      if (i > 0) {
        if (!row) { line++; x = padX; }
        else if (x + w > maxX + 1e-9) { line++; x = padX; }
      }
      pos.push({ x: x, line: line, y: top + line * rowH });
      x += w + gap;
    });
    return { pos: pos, lines: widths.length ? line + 1 : 0, height: top + (widths.length ? line + 1 : 0) * rowH + bottom };
  }

  /* ---- the starting value of a hud.measure: a figure key, a ctx.figure handle, a ctx.count, or a number computed in the scene ---- */
  function measureStart(spec, figure) {
    var fig = null, v = spec.value, n, of = spec.of, noOf = spec.of === false;
    if (spec.key !== undefined) fig = figure(spec.key);
    else if (isObj(v) && typeof v.n === 'number' && v.derived) { n = v.n; of = v.of; }
    else if (isObj(v) && isObj(v.source) && 'value' in v) fig = v;
    else n = v;
    if (fig) n = fig.value;
    if (typeof n !== 'number' || !isFinite(n)) throw new Error('hud.measure needs key (a figure), or value: a ctx.figure(key), a ctx.count(n, of) or a number computed from the data');
    return { n: n, of: noOf || of === undefined ? null : of, fig: fig };
  }

  /* ---- figures and the windows in which illustrative things are on screen ---- */
  function makeLedger(story) {
    var figs = (story && story.figures) || {}, handles = {}, entries = [];
    function keys() { return Object.keys(figs).filter(function (k) { return k.charAt(0) !== '_'; }); }
    function note(item, t0, t1) {
      var src = item && item.source;
      if (!isObj(src)) throw new Error('ctx.shown: needs a figure from ctx.figure(key) or a story record with a source');
      if (typeof t0 !== 'number' || isNaN(t0) || typeof t1 !== 'number' || isNaN(t1)) throw new Error('ctx.shown: t0 and t1 must be times in seconds (t1 may be Infinity)');
      var e = { from: t0, to: t1, source: src, id: item.key !== undefined ? item.key : (item.id !== undefined ? item.id : null) };
      entries.push(e);
      return e;
    }
    function figure(key) {
      if (!own(figs, key) || String(key).charAt(0) === '_' || !isObj(figs[key])) {
        throw new Error('ctx.figure("' + key + '"): no such key in story.figures (known: ' + (keys().join(', ') || 'none') + '). Add it to the story with a source; never type the number into the scene');
      }
      if (!handles[key]) {
        var f = figs[key];
        handles[key] = { key: key, value: f.value, unit: f.unit, label: f.label, source: f.source };
        handles[key].shown = function (t0, t1) { note(handles[key], t0, t1); return handles[key]; };
      }
      return handles[key];
    }
    function windows(duration, gap) { return EXK.provenance.shownWindows(entries, duration, gap); }
    return { figure: figure, note: note, windows: windows, entries: entries, count: count };
  }

  /* ---- the restricted master timeline ---- */
  function restrict(tl) {
    function refuse(name) { return function () { throw new Error('ctx.tl.' + name + '(...) breaks seek determinism; use ctx.tl.fromTo(target, from, to, position)'); }; }
    return {
      fromTo: function (target, from, to, pos) {
        var vars = {};
        for (var k in to) vars[k] = to[k];
        vars.immediateRender = false;
        return tl.fromTo(target, from, vars, pos);
      },
      addLabel: function (name, pos) { return tl.addLabel(name, pos); },
      to: refuse('to'), from: refuse('from'), set: refuse('set'), call: refuse('call'), add: refuse('add')
    };
  }

  /* ---- run: build the scene's ctx, call build once, then step for each story step ---- */
  function run(o) {
    var story = o.story, rawTl = o.tl, shell = o.shell, T = EXK.timing, C = EXK.THEME, U = EXK.util;
    var found = resolveScene(story, EXK.scenes), scene = found.scene;
    var ledger = makeLedger(story), moments = [], momentNames = {};
    var svg = U.el('svg:svg', { viewBox: '0 0 ' + shell.area.w + ' ' + shell.area.h, width: shell.area.w, height: shell.area.h }, shell.layers.world);
    var world = U.el('svg:g', { 'data-layer': 'world' }, svg);
    var hudLayer = U.el('svg:g', { 'data-layer': 'hud' }, shell.layers.text);
    if (shell.fade) shell.fade.style.opacity = 0;       /* the edge fades belong to the camera; there is none here */
    var tl = restrict(rawTl), captions = [], stepEnds = [];
    var text = EXK.makeText({ story: story, tl: rawTl, painter: { labelPolicy: 'always' }, area: shell.area, layer: shell.layers.text, reserved: shell.reserved });

    /* scene text: registered with the text layer (data-ov, so overlap checks see it) and with the dimming rule */
    var reg = [], lastEmph = -Infinity;
    function register(spec) {
      var els = spec.els || [spec.el];
      var it = text.register({ key: spec.key, els: els, kind: 'scene' });
      it.dimEls = els.concat(spec.dim || []);
      it.cur = 1;
      it.el = els[0];
      it.also = function (more) { it.dimEls = it.dimEls.concat(more); return it; };
      it.keep = function () { it.fixed = true; return it; };      /* never dimmed: a heading that belongs to the stage, not to a step */
      reg.push(it);
      return it;
    }
    function add(parent, str, attrs, key) {
      var a = { 'class': 'sans', fill: C.text };
      for (var k in attrs) a[k] = attrs[k];
      var e = U.el('svg:text', a, parent);
      e.textContent = str;
      return register({ key: key || ('text:' + str), el: e });
    }
    /* group(el|els, key): a non-text thing that emphasis can dim. The elements move into outer > inner: emphasis tweens
       the outer <g>, the scene tweens item.el (the inner <g>) as it likes; the two channels never fight. */
    function group(els, key) {
      if (typeof key !== 'string' || !key) throw new Error('ctx.group(els, key): key must be a non-empty string');
      var list = flat(els && els.length !== undefined && !els.nodeType ? Array.prototype.slice.call(els) : els, []);
      if (!list.length) throw new Error('ctx.group("' + key + '"): no elements');
      var parent = list[0].parentNode;
      if (!parent) throw new Error('ctx.group("' + key + '"): the elements must already be in the document');
      list.forEach(function (e) { if (e.parentNode !== parent) throw new Error('ctx.group("' + key + '"): the elements must share one parent'); });
      var outer = U.el('svg:g', { 'data-group': key }), inner = U.el('svg:g', {}, outer);
      parent.insertBefore(outer, list[0]);
      list.forEach(function (e) { inner.appendChild(e); });
      var it = { key: key, kind: 'group', el: inner, outer: outer, dimEls: [outer], cur: 1 };
      it.also = function (more) { it.dimEls = it.dimEls.concat(more); return it; };
      it.keep = function () { it.fixed = true; return it; };
      reg.push(it);
      return it;
    }
    function flat(list, out) {
      (Array.isArray(list) ? list : [list]).forEach(function (x) { if (Array.isArray(x)) flat(x, out); else if (x) out.push(x); });
      return out;
    }
    function emphasise(items, t) {
      if (t < lastEmph - 1e-9) throw new Error('ctx.emphasise: called at ' + t + ' s after ' + lastEmph + ' s; call it in time order');
      lastEmph = t;
      var on = items === 'all' ? null : flat(items, []);
      reg.forEach(function (it) {
        if (it.fixed) return;
        var tgt = (on === null || on.indexOf(it) >= 0) ? 1 : T.DIM_TEXT;
        if (tgt === it.cur) return;
        tl.fromTo(it.dimEls, { opacity: it.cur }, { opacity: tgt, duration: T.DIM_DUR, ease: T.DIM_EASE }, t);
        it.cur = tgt;
      });
    }

    var ctx = {
      story: story, style: o.style, shell: shell, area: shell.area, timing: T, THEME: C, tl: tl,
      layers: { world: world, hud: hudLayer },
      el: function (tag, attrs, parent) { return U.el('svg:' + tag, attrs, parent); },
      text: { layer: shell.layers.text, add: add, register: register },
      group: group,
      emphasise: emphasise,
      figure: ledger.figure,
      shown: function (item, t0, t1) { ledger.note(item, t0, t1); return item; },
      count: count,
      block: function (name) {
        if (story[name] === undefined) throw new Error('ctx.block("' + name + '"): the story has no "' + name + '" block at its top level');
        return story[name];
      },
      moment: function (name, t) {
        if (!name || momentNames[name]) throw new Error('ctx.moment: "' + name + '" is ' + (name ? 'already published' : 'not a name'));
        if (typeof t !== 'number' || !isFinite(t)) throw new Error('ctx.moment("' + name + '"): t must be a time in seconds');
        momentNames[name] = true;
        moments.push({ id: name, time: t });
      },
      atStepEnd: function (fn) {
        if (typeof fn !== 'function') throw new Error('ctx.atStepEnd(fn): fn must be a function taking {t, rest, index}');
        stepEnds.push(fn);
      },
      stepIndex: 0, isLast: false, stepStart: 0
    };
    ctx.hud = EXK.makeHud({ ctx: ctx, layer: hudLayer, tl: tl, ledger: ledger, captions: captions });
    scene.build(ctx);

    var steps = [], t0 = 0;
    story.steps.forEach(function (st, i) {
      var last = i === story.steps.length - 1;
      ctx.stepIndex = i; ctx.isLast = last; ctx.stepStart = t0;
      var res = scene.step(ctx, st, t0);
      if (!res || typeof res.end !== 'number' || !isFinite(res.end) || res.end < 0) {
        throw new Error('scene step "' + st.id + '": step(ctx, step, t0) must return { end } with end the seconds from the step start to its last motion');
      }
      var first = typeof res.firstMotion === 'number' ? res.firstMotion : null;
      var labelEnd = typeof res.hold === 'number' ? res.end + res.hold + T.LABEL_FADE_OUT : (res.labelEnd || 0);
      var len = T.stepEnd({ end: res.end, labelEnd: labelEnd, firstMotion: first, bodyWords: T.wordCount(st.body), final: last });
      var tEnd = t0 + len;
      shell.stepChrome(rawTl, i, t0, tEnd, { bodyAt: T.bodyAt(first == null ? res.end : first, res.end) });
      var rest = typeof res.rest === 'number' && isFinite(res.rest) ? Math.min(res.rest, len - T.REST_MARGIN)
        : T.restOf({ len: len, end: res.end, labelEnd: labelEnd, firstMotion: first });
      steps.push({ id: st.id, phase: st.phase, time: t0, rest: t0 + rest, title: st.title, body: st.body });
      var over = { index: i, t0: t0, rest: t0 + rest, t: tEnd, last: last };
      captions.forEach(function (c) { c.endStep(over); });
      var fns = stepEnds.splice(0);
      if (!last) fns.forEach(function (fn) { fn(over); });
      t0 = tEnd;
    });
    captions.forEach(function (c) {
      var bad = captionRestFailures(c.log, steps.map(function (s) { return s.rest; }));
      if (bad.length) {
        throw new Error('scene "' + found.name + '": the caption panel is on screen with no caption at the rest frame of step ' + bad.map(function (i) { return (i + 1) + ' "' + steps[i].id + '"'; }).join(', ') +
          '. Stills and clip endings are taken at rest: say a caption in every step (give the step a hold that reaches its rest), or hide the panel');
      }
    });
    text.finish();
    var duration = Math.max(t0, rawTl.duration());

    /* the chip: the windows the scene reported; a scene that reported none while the story carries illustrative
       figures or records keeps the chip up for the whole scene (never silently off) */
    var chip = ledger.windows(duration);
    if (!ledger.entries.length) {
      var hidden = EXK.provenance.illustrative(story).filter(function (p) { return !/^(meta|steps|phases)/.test(p.path); });
      if (hidden.length) {
        console.warn('scene "' + found.name + '" reported no figure windows (ctx.figure(key).shown(t0, t1)); the "Illustrative" chip stays up for the whole scene');
        chip = [{ from: 0, to: duration }];
      }
    }
    return { steps: steps, duration: duration, moments: moments, chip: chip, scene: found.name };
  }

  EXK.patterns.custom = { resolveScene: resolveScene, makeLedger: makeLedger, count: count, captionClock: captionClock, captionRestFailures: captionRestFailures, legendLayout: legendLayout, measureStart: measureStart, run: run };
})();
