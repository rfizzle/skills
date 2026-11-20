/* The `flow` pattern (patterns 1 and 4: flow along a path, nested containment): story step -> beats.
   Pure: no DOM, no GSAP. The step runner (scene/beats.js) asks it for each step's beats, the ids the step is
   about (focus dimming) and the named moments (none for flow).

   EXK.patterns.flow = {
     beatsFor(step)        the step's beats; when it has none, one plain `chain` per contiguous run in `uses`
     chains(uses)          [[a, b], [b, c], [x, y]] -> [[a, b, c], [x, y]]
     kindOf(beat)          the beat's kind: the first of BEAT_KINDS present as a key (KIT-PLAN, decisions after P1)
     idsOf(beat)           the system ids a beat names (path, at, mark, sayAt, pulse)
     involved(step, beats) {nodes: [ids], pairs: [[from, to]]}: what the step is about (touch, uses, beat paths)
     moments(story, steps) named moments beyond steps (flow: none)
   } */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  EXK.patterns = EXK.patterns || {};

  var BEAT_KINDS = ['chain', 'exchange', 'stream', 'card', 'camera', 'shields', 'pulse', 'custom', 'mark'];
  var PATH_KINDS = { chain: 1, exchange: 1, stream: 1 };

  function chains(uses) {
    var out = [];
    (uses || []).forEach(function (pr) {
      var cur = out[out.length - 1];
      if (cur && cur[cur.length - 1] === pr[0]) cur.push(pr[1]);
      else out.push([pr[0], pr[1]]);
    });
    return out;
  }

  function beatsFor(step) {
    if (Array.isArray(step.beats) && step.beats.length) return step.beats;
    return chains(step.uses).map(function (c) { return { chain: c }; });
  }

  function kindOf(beat) {
    for (var i = 0; i < BEAT_KINDS.length; i++) if (beat && beat[BEAT_KINDS[i]] !== undefined) return BEAT_KINDS[i];
    return null;
  }

  function pathOf(beat) {
    var k = kindOf(beat);
    return PATH_KINDS[k] && Array.isArray(beat[k]) ? beat[k] : null;
  }

  function idsOf(beat) {
    var k = kindOf(beat), ids = [], p = pathOf(beat);
    if (p) ids = ids.concat(p);
    if (k === 'card' && typeof beat.at === 'string') ids.push(beat.at);
    if (k === 'pulse' || k === 'mark') ids.push(beat[k]);
    if (k !== 'mark' && typeof beat.mark === 'string') ids.push(beat.mark);
    if (typeof beat.sayAt === 'string' && beat.sayAt !== 'dest') ids.push(beat.sayAt);
    return ids;
  }

  function involved(step, beats) {
    var nodes = [], pairs = [], seen = {};
    function add(id) { if (id && !seen[id]) { seen[id] = 1; nodes.push(id); } }
    (step.touch || []).forEach(add);
    (step.uses || []).forEach(function (pr) { add(pr[0]); add(pr[1]); pairs.push([pr[0], pr[1]]); });
    (beats || []).forEach(function (b) {
      idsOf(b).forEach(add);
      var p = pathOf(b);
      if (p) for (var i = 1; i < p.length; i++) pairs.push([p[i - 1], p[i]]);
    });
    return { nodes: nodes, pairs: pairs };
  }

  EXK.patterns.flow = {
    BEAT_KINDS: BEAT_KINDS,
    beatsFor: beatsFor, chains: chains, kindOf: kindOf, pathOf: pathOf, idsOf: idsOf, involved: involved,
    moments: function () { return []; }
  };
})();
