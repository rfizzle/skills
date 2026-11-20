/* The stage shell: 1920x1080 stage scaled to fit, the chrome (phase rail, narrative band, controls bar,
   mini-map slot, breadcrumb slot, edge fades, "Illustrative" chip), narration and presenter modes, keys,
   ?capture=1, the window.anim contract, and EXK.boot (replaces the P0 stub in 00-ns.js).
   PATTERNS.md section 3 and 5. The page template (assets/page.html) holds the chrome's HTML and CSS. */
(function () {
  'use strict';
  var EXK = window.EXK, T = EXK.timing, C = EXK.THEME;
  var NARR_MODES = ['full', 'caption', 'off'];
  var AREA = { x: 0, y: 100, w: 1920, h: 720 };       /* the diagram area, in stage px */
  var DOT_OFF = '#2a3447', DOT_DONE = '#8b98ad';

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---- mountShell({story, search?}) -> shell ----
     shell.stage, .viewport, .area {x,y,w,h,el}, .layers {world, text}, .rail, .band, .minimap, .crumb, .fade,
     .reserved [stage rects text must keep clear of], .state {narr, present, capture},
     .stepChrome(tl, i, t0, tEnd, {bodyAt}), .mountChip(tl, steps, duration), .onTick(fn) */
  function mountShell(opts) {
    var story = opts.story, search = opts.search != null ? opts.search : location.search;
    var QS = new URLSearchParams(search);
    var shell = { story: story, reserved: [], ticks: [] };
    var stage = shell.stage = $('stage'), viewport = shell.viewport = $('viewport');
    shell.state = {
      capture: QS.get('capture') === '1',
      narr: NARR_MODES.indexOf(QS.get('narration')) >= 0 ? QS.get('narration') : 'full',
      present: QS.get('present') === '1'
    };
    if (shell.state.capture) document.body.classList.add('capture');

    function fit() {
      var r = viewport.getBoundingClientRect();
      var s = Math.min(r.width / 1920, r.height / 1080);
      stage.style.transform = 'scale(' + s + ')';
      stage.style.left = ((r.width - 1920 * s) / 2) + 'px';
      stage.style.top = ((r.height - 1080 * s) / 2) + 'px';
    }
    window.addEventListener('resize', fit);
    fit();
    shell.fit = fit;
    shell.applyNarr = function () { stage.className = 'nm-' + shell.state.narr; };
    shell.applyNarr();

    shell.area = { x: AREA.x, y: AREA.y, w: AREA.w, h: AREA.h, el: $('area') };
    shell.layers = { world: $('area'), text: $('txt') };
    shell.rail = $('rail'); shell.band = $('band'); shell.minimap = $('mm'); shell.crumb = $('crumb'); shell.fade = $('fade');

    /* ---- phase rail and narrative band: built from the story; tweens come from stepChrome ---- */
    var steps = story.steps, phases = story.phases.length ? story.phases : phasesFromSteps(steps);
    var phEls = {}, dotEls = [], ttEls = [], bdEls = [];
    phases.forEach(function (p) {
      var d = document.createElement('div'); d.className = 'ph';
      var n = document.createElement('div'); n.className = 'pn'; n.textContent = p.title; d.appendChild(n);
      var dd = document.createElement('div'); dd.className = 'pd'; d.appendChild(dd);
      shell.rail.appendChild(d); phEls[p.id] = { box: d, name: n, dots: dd };
    });
    steps.forEach(function (st, i) {
      var ph = phEls[st.phase];
      var dot = document.createElement('i'); if (ph) ph.dots.appendChild(dot); dotEls.push(dot);
      var tt = document.createElement('div'); tt.className = 'tt';
      var num = document.createElement('b'); num.textContent = (i + 1) + ' / ' + steps.length; tt.appendChild(num);
      tt.appendChild(document.createTextNode(st.title)); shell.band.appendChild(tt); ttEls.push(tt);
      var bd = document.createElement('div'); bd.className = 'bd'; bd.textContent = st.body; shell.band.appendChild(bd); bdEls.push(bd);
    });
    shell.phases = phases;

    /* Title, body, phase highlight and step dot for step i, which runs t0 .. tEnd (absolute seconds).
       o.bodyAt: seconds after t0 at which the body appears (timing.bodyAt). All tweens are fromTo with
       immediateRender:false, so any seek order gives the same frame. */
    shell.stepChrome = function (tl, i, t0, tEnd, o) {
      o = o || {};
      var st = steps[i], prev = steps[i - 1], next = steps[i + 1], ph = phEls[st.phase];
      var bodyAt = o.bodyAt != null ? o.bodyAt : T.BODY_DELAY + T.MOTION_START;
      tl.fromTo(ttEls[i], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: T.TITLE_FADE_IN, ease: 'power3.out', immediateRender: false }, t0 + T.TITLE_AT);
      tl.fromTo(bdEls[i], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: T.BODY_FADE_IN, ease: 'power3.out', immediateRender: false }, t0 + bodyAt);
      if (next) {
        var out = tEnd - T.CHROME_OUT_LEAD;
        tl.fromTo(ttEls[i], { opacity: 1 }, { opacity: 0, duration: T.CHROME_FADE_OUT, ease: 'power1.in', immediateRender: false }, out);
        tl.fromTo(bdEls[i], { opacity: 1 }, { opacity: 0, duration: T.CHROME_FADE_OUT, ease: 'power1.in', immediateRender: false }, out);
      }
      if (ph) {
        if (!prev || prev.phase !== st.phase) {
          tl.fromTo(ph.name, { color: C.muted }, { color: C.text, duration: 0.4, immediateRender: false }, t0);
          tl.fromTo(ph.box, { borderBottomColor: C.line }, { borderBottomColor: C.accent, duration: 0.4, immediateRender: false }, t0);
        }
        if (next && next.phase !== st.phase) {
          tl.fromTo(ph.name, { color: C.text }, { color: C.muted, duration: 0.4, immediateRender: false }, tEnd);
          tl.fromTo(ph.box, { borderBottomColor: C.accent }, { borderBottomColor: C.line, duration: 0.4, immediateRender: false }, tEnd);
        }
      }
      tl.fromTo(dotEls[i], { backgroundColor: DOT_OFF, scale: 1 }, { backgroundColor: C.accent, scale: 1.4, duration: 0.3, immediateRender: false }, t0);
      tl.fromTo(dotEls[i], { backgroundColor: C.accent, scale: 1.4 }, { backgroundColor: DOT_DONE, scale: 1, duration: 0.3, immediateRender: false }, next ? tEnd : tEnd - 0.5);
    };

    /* The "Illustrative" chip: shown on the master timeline in the windows provenance.chipWindows gives.
       steps: [{id, time}]. Returns the windows. It sits in the narrative band at the right end of the title row
       (page.html .chip), outside the diagram area, so no layout or text can collide with it. */
    shell.mountChip = function (tl, stepList, duration) {
      var wins = EXK.provenance.chipWindows(story, stepList, duration);
      if (!wins.length) return wins;
      var chip = document.createElement('div');
      chip.id = 'chip'; chip.className = 'chip'; chip.setAttribute('data-ov', 'chip'); chip.textContent = 'Illustrative';
      stage.appendChild(chip);
      wins.forEach(function (w) {
        var fin = 0.4, fout = 0.4;
        tl.fromTo(chip, { opacity: 0 }, { opacity: 1, duration: fin, immediateRender: false }, w.from);
        if (w.to < duration - 1e-6) tl.fromTo(chip, { opacity: 1 }, { opacity: 0, duration: fout, immediateRender: false }, w.to - fout);
      });
      return wins;
    };

    shell.onTick = function (fn) { shell.ticks.push(fn); };
    shell.setNarr = function (m) { shell.state.narr = m; shell.applyNarr(); if (shell.ui) shell.ui.bNarr.textContent = 'Narration: ' + m; };
    return shell;
  }

  function phasesFromSteps(steps) {
    var seen = {}, out = [];
    steps.forEach(function (s) { if (s.phase && !seen[s.phase]) { seen[s.phase] = 1; out.push({ id: s.phase, title: s.phase }); } });
    return out;
  }

  /* ---- publishAnim(tl, steps, phases, moments, hooks?) -> window.anim ----
     steps: [{id, time, rest, title, body, phase}] absolute seconds. moments: [{id, time}] (named, beyond steps).
     hooks: {onTick: [fn(t)]}. Wires controls, keys, presenter guard; seeks to 0; autoplays unless ?capture=1.
     window.anim = {duration, fps:30, steps, phases, moments, seek(t, {camera}), play, pause} */
  function publishAnim(tl, stepList, phaseList, moments, hooks) {
    var shell = EXK.shell, S = shell.state, duration = tl.duration();
    hooks = hooks || {};
    var steps = stepList.map(function (s, i) {
      var next = stepList[i + 1], rest = s.rest;
      if (!isFinite(rest)) {
        rest = (next ? next.time : duration) - 0.7;
        console.warn('step "' + s.id + '" has no rest; falling back to 0.7 s before its end');
      }
      return { id: s.id, time: s.time, rest: rest, title: s.title, body: s.body, phase: s.phase, caption: s.title };
    });
    var phases = phaseList.map(function (p) {
      return { id: p.id, title: p.title, firstStep: steps.findIndex(function (s) { return s.phase === p.id; }) };
    });
    var ui = shell.ui = {
      bPlay: $('bPlay'), range: $('range'), clock: $('clock'), bNarr: $('bNarr'), bPres: $('bPres'), pp: $('pp'), ticks: $('ticks')
    };
    var guard = 0;     /* presenter mode: index of the step currently allowed to play out */

    function stepIndexAt(t) { var idx = 0; steps.forEach(function (s, i) { if (t >= s.time - 1e-6) idx = i; }); return idx; }
    function guardFor(t) { return stepIndexAt(t + 0.05); }
    function isPlaying() { return !tl.paused() && tl.time() < duration - 1e-6; }
    function render() { hooks.onTick && hooks.onTick.forEach(function (f) { f(tl.time()); }); shell.ticks.forEach(function (f) { f(tl.time()); }); }
    function syncUI() {
      var t = tl.time();
      ui.range.value = Math.round(t / duration * 1000);
      ui.clock.textContent = t.toFixed(1) + ' / ' + duration.toFixed(1) + ' s';
      ui.bPlay.textContent = isPlaying() ? 'Pause' : (t >= duration - 1e-6 ? 'Replay' : 'Play');
      var i = stepIndexAt(t);
      ui.pp.style.display = (S.present && tl.paused() && i + 1 < steps.length && t >= steps[i + 1].time - 0.05) ? 'block' : 'none';
    }
    function onTick() {
      render();
      if (S.present && !tl.paused() && guard + 1 < steps.length && tl.time() >= steps[guard + 1].time - 0.02) {
        tl.pause(); tl.time(steps[guard + 1].time - 0.02, true); render();
      }
      syncUI();
    }
    function seek(t, o) {
      tl.pause(); tl.time(clamp(t, 0, duration), false); guard = guardFor(tl.time());
      if (shell.cameraOverride) shell.cameraOverride(o && o.camera ? o.camera : null);
      render(); syncUI();
    }
    function play() { if (shell.cameraOverride) shell.cameraOverride(null); if (tl.time() >= duration - 1e-6) tl.time(0, true); guard = guardFor(tl.time()); tl.play(); syncUI(); }
    function pause() { tl.pause(); syncUI(); }
    function goStep(i) {
      var was = isPlaying() || S.present;
      if (i < 0) i = 0;
      var t = i >= steps.length ? duration : steps[i].time + 0.0001;
      guard = i >= steps.length ? steps.length - 1 : i;
      tl.time(t, false);
      if (was) tl.play(); else tl.pause();
      render(); syncUI();
    }
    function prevStep() { var t = tl.time(), i = stepIndexAt(t); goStep(t - steps[i].time > 0.6 ? i : i - 1); }
    function nextStep() { goStep(stepIndexAt(tl.time()) + 1); }
    function setPresent(on) { S.present = on; ui.bPres.textContent = 'Present: ' + (on ? 'on' : 'off'); syncUI(); }
    function cycleNarr() { shell.setNarr(NARR_MODES[(NARR_MODES.indexOf(S.narr) + 1) % 3]); }

    window.anim = { duration: duration, fps: 30, phases: phases, steps: steps, moments: moments || [], seek: seek, play: play, pause: pause };

    steps.forEach(function (s) {
      var left = 'calc(8px + (100% - 16px) * ' + (s.time / duration) + ')';
      var i = document.createElement('i'); i.style.left = left; ui.ticks.appendChild(i);
      var u = document.createElement('u'); u.style.left = left; u.textContent = s.id; ui.ticks.appendChild(u);
    });
    ui.bPlay.addEventListener('click', function () { isPlaying() ? pause() : play(); });
    $('bPrev').addEventListener('click', prevStep);
    $('bNext').addEventListener('click', nextStep);
    ui.bNarr.addEventListener('click', cycleNarr);
    ui.bPres.addEventListener('click', function () { setPresent(!S.present); });
    ui.range.addEventListener('input', function () { seek(ui.range.value / 1000 * duration); });
    $('speed').addEventListener('change', function (e) { tl.timeScale(parseFloat(e.target.value)); });
    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') && e.code === 'Space') e.target.blur();
      if (e.code === 'Space') { e.preventDefault(); isPlaying() ? pause() : play(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); prevStep(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); nextStep(); }
      else if (e.code === 'Home') { e.preventDefault(); seek(0); play(); }
      else if (e.code === 'KeyN') cycleNarr();
      else if (e.code === 'KeyP') setPresent(!S.present);
    });

    tl.eventCallback('onUpdate', onTick);
    tl.eventCallback('onComplete', function () { syncUI(); });
    shell.setNarr(S.narr); setPresent(S.present);
    tl.time(0, false);
    render(); syncUI();
    if (!S.capture) { guard = 0; tl.play(); } else tl.pause();
    syncUI();
    return window.anim;
  }

  /* ---- EXK.boot: validate and normalise the story, mount the shell, build the scene, publish ----
     Needs (supplied by later packages, or by --extra in tests):
       EXK.painters[style](ctx) -> painter                                     (the painter interface, KIT-PLAN section 1)
       EXK.runSteps(ctx) -> {steps: [{id,time,rest,title,body,phase}], duration, moments}   (the step runner)
     ctx = {story, style, pattern, tl, shell, area, estate, painter, text, camera, timing: EXK.timing, THEME} */
  function boot() {
    var raw = EXK.STORY, build = EXK.BUILD || {};
    var problems = EXK.validate(raw, { style: build.style || null });
    EXK.problems = problems;
    var errors = problems.filter(function (p) { return p.level === 'error'; });
    var stage = $('stage');
    if (errors.length) {
      errors.forEach(function (p) { console.error(EXK.formatProblem(p)); });
      EXK.story = null;
      if (stage) stage.setAttribute('data-ready', 'invalid');
      return null;
    }
    var story = EXK.story = EXK.normalize(raw);
    var style = build.style, pattern = build.pattern || 'flow';
    var makePainter = EXK.painters && EXK.painters[style];
    if (!makePainter || typeof EXK.runSteps !== 'function') {
      console.error('boot: no ' + (!makePainter ? 'painter for style "' + style + '"' : 'step runner (EXK.runSteps)') + ' in this build');
      if (stage) stage.setAttribute('data-ready', 'story');
      return story;
    }
    var shell = EXK.shell = mountShell({ story: story });
    var tl = gsap.timeline({ paused: true });
    var ctx = { story: story, style: style, pattern: pattern, tl: tl, shell: shell, area: shell.area, timing: T, THEME: C };
    /* the estate model: layout in ground units, routes, merged port markers (KIT-PLAN section 1, P2) */
    var estate = null;
    if (EXK.layout && EXK.route) {
      estate = EXK.layout.layoutEstate(story, EXK.layout.SIZES[style] ? style : 'flat');
      estate.routes = EXK.route.routeLinks(estate, story);
      estate.ports = EXK.route.markers(estate.routes, 36);
    }
    ctx.estate = estate;
    var painter = ctx.painter = makePainter(ctx);
    painter.build(estate, story, shell.layers);
    var text = ctx.text = EXK.makeText({ story: story, tl: tl, painter: painter, area: shell.area, layer: shell.layers.text, reserved: shell.reserved });
    var camera = ctx.camera = EXK.makeCamera(tl, painter, text, shell.area, { shell: shell, minimap: shell.minimap, fade: shell.fade, crumb: shell.crumb });
    var out = EXK.runSteps(ctx);
    text.finish();
    var duration = Math.max(out.duration, tl.duration());
    tl.set({}, {}, duration);     /* the timeline lasts exactly the scene */
    shell.mountChip(tl, out.steps, duration);
    publishAnim(tl, out.steps, shell.phases, out.moments || [], { onTick: [camera.render] });
    if (stage) stage.setAttribute('data-ready', 'scene');
    return story;
  }

  EXK.painters = EXK.painters || {};
  EXK.mountShell = mountShell;
  EXK.publishAnim = publishAnim;
  EXK.boot = boot;
})();
