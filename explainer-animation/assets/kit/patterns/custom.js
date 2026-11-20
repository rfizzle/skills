/* The `custom` pattern: the seam for scenes that are not estate-based (roadmap, funding scenarios, coverage, ...).
   A scene file registers EXK.scenes.<name> = { build(ctx), step(ctx, step, t0) -> { end, ... } } and the kit
   keeps everything else: stage, phase rail, narrative band, controls, narration and presenter modes, the master
   timeline, step sequencing and length, `rest`, the window.anim contract with `moments`, the "Illustrative" chip,
   the check hooks (window.__overlaps via data-ov), seek determinism. references/patterns.md section 3 is the author's guide.

   The functions that need no browser (scene lookup, figure ledger, count) load under Node for tests; `run` and
   the ctx it builds need the page. EXK.patterns.custom = {
     resolveScene(story, scenes) -> {name, scene}      throws a clear message when none, several or a wrong name
     makeLedger(story) -> {figure(key), note(item, t0, t1), windows(duration), shown, count(n, of)}
     count(n, of) -> {n, of, text, derived: true}
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
     emphasise(items|'all', t)    the dimming rule: items stay full, every other registered item goes to DIM_TEXT
     figure(key) -> {key, value, unit, label, source, shown(t0, t1)}   throws for a key not in story.figures
     shown(item, t0, t1)          a figure or a story record is on screen from t0 to t1 (drives the chip)
     count(n, of)                 a computed count, "9 of 12"
     block(name)                  story[name]: the story's pattern block
     moment(name, t)              publishes a named moment in window.anim.moments
     hud.banner / hud.measure / hud.legend / hud.panel     scene/hud.js
     stepIndex, isLast            of the step being built
   } */
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
    var tl = restrict(rawTl);
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
      stepIndex: 0, isLast: false
    };
    ctx.hud = EXK.makeHud({ ctx: ctx, layer: hudLayer, tl: tl, ledger: ledger });
    scene.build(ctx);

    var steps = [], t0 = 0;
    story.steps.forEach(function (st, i) {
      var last = i === story.steps.length - 1;
      ctx.stepIndex = i; ctx.isLast = last;
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
      t0 = tEnd;
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

  EXK.patterns.custom = { resolveScene: resolveScene, makeLedger: makeLedger, count: count, run: run };
})();
