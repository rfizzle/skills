/* Which records are illustrative, and when the "Illustrative" chip must show. Pure. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};

  function isIll(r) { return !!(r && r.source && r.source.kind === 'illustrative'); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  // -> [{path, id}] for every record whose source.kind is illustrative
  function illustrative(story) {
    var out = [];
    function add(path, r) { if (isIll(r)) out.push({ path: path, id: r.id === undefined ? null : r.id }); }
    add('meta', story.meta);
    var keys = ['zones', 'systems', 'links', 'phases', 'steps', 'controls', 'events',
      'runs', 'states', 'objects', 'horizons', 'lanes', 'initiatives', 'risks', 'dependencies', 'layers', 'coverage'];
    Object.keys(story).forEach(function (k) {   /* a custom scene's own blocks */
      if (k.charAt(0) !== '_' && keys.indexOf(k) < 0 && Array.isArray(story[k])) keys.push(k);
    });
    keys.forEach(function (k) {
      arr(story[k]).forEach(function (r, i) { add(k + '[' + i + ']', r); });
    });
    var f = story.figures || {};
    Object.keys(f).forEach(function (k) { if (k.charAt(0) !== '_') add('figures.' + k, f[k]); });
    return out;
  }

  // Is anything the step shows illustrative? The step, the systems it touches, the zones around
  // them, the links it uses, its events, and (on a summary step) the controls.
  function stepShowsIllustrative(story, step) {
    if (isIll(step)) return true;
    var sys = {}, zones = {};
    arr(story.systems).forEach(function (s) { sys[s.id] = s; });
    arr(story.zones).forEach(function (z) { zones[z.id] = z; });
    var touched = arr(step.touch).slice();
    arr(step.uses).forEach(function (p) { touched.push(p[0], p[1]); });
    for (var i = 0; i < touched.length; i++) {
      var s = sys[touched[i]];
      if (!s) continue;
      if (isIll(s)) return true;
      var z = zones[s.zone], guard = 0;
      while (z && guard++ < 50) { if (isIll(z)) return true; z = zones[z.parent]; }
    }
    var hit = arr(step.uses).some(function (p) {
      return arr(story.links).some(function (l) {
        return isIll(l) && ((l.from === p[0] && l.to === p[1]) || (l.from === p[1] && l.to === p[0]));
      });
    });
    if (hit) return true;
    if (arr(story.events).some(function (e) { return e.step === step.id && isIll(e); })) return true;
    var summary = step.all || arr(step.beats).some(function (b) { return b && b.shields !== undefined; });
    if (summary && arr(story.controls).some(isIll)) return true;
    return false;
  }

  // steps: [{id, time, end?}] as published by the timeline; duration closes the last window.
  // -> [{from, to}] merged windows (seconds) in which the chip must be visible.
  function chipWindows(story, steps, duration) {
    var out = [];
    if (!steps || !steps.length) return out;
    var byId = {};
    arr(story.steps).forEach(function (s) { byId[s.id] = s; });
    function push(a, b) {
      if (b <= a) return;
      var last = out[out.length - 1];
      if (last && a <= last.to + 1e-9) last.to = Math.max(last.to, b);
      else out.push({ from: a, to: b });
    }
    var endAll = duration !== undefined ? duration : (steps[steps.length - 1].end !== undefined ? steps[steps.length - 1].end : steps[steps.length - 1].time);
    if (isIll(story.meta)) { push(steps[0].time, endAll); return out; }
    steps.forEach(function (st, i) {
      var rec = byId[st.id];
      if (!rec || !stepShowsIllustrative(story, rec)) return;
      var end = st.end !== undefined ? st.end : (i + 1 < steps.length ? steps[i + 1].time : endAll);
      push(st.time, end);
    });
    return out;
  }

  // The custom pattern: the scene reports when each figure and record is on screen, [{from, to, source}] (seconds;
  // to may be Infinity). -> [{from, to}] merged windows clipped to [0, duration] in which an illustrative one is
  // visible. Windows closer together than `gap` merge so the chip does not flicker between them.
  function shownWindows(shown, duration, gap) {
    var g = gap === undefined ? 0.8 : gap, out = [];
    arr(shown).filter(function (s) { return isIll(s); }).map(function (s) {
      return { from: Math.max(0, s.from), to: Math.min(duration, s.to) };
    }).filter(function (w) { return w.to > w.from; }).sort(function (a, b) { return a.from - b.from; }).forEach(function (w) {
      var last = out[out.length - 1];
      if (last && w.from <= last.to + g) last.to = Math.max(last.to, w.to);
      else out.push({ from: w.from, to: w.to });
    });
    return out;
  }

  EXK.provenance = { illustrative: illustrative, chipWindows: chipWindows, shownWindows: shownWindows };
})();
