/* Story validation and normalisation. Pure: no DOM, no GSAP, no knowledge of painters.
   validate(story, {style}) -> [{level, path, message, fix}]   level: 'error' | 'warning'
   formatProblem(p) -> 'path: message. Fix: fix.'              one line
   normalize(story) -> deep copy with defaults filled and `_` keys removed */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};

  var SOURCE_KINDS = ['provided', 'derived', 'illustrative'];
  var KINDS = ['incident', 'architecture', 'plan'];
  var AUDIENCES = ['technical', 'executive'];
  var VISIBILITY = ['blind', 'logged', 'alerted'];
  var ACTORS = ['attacker', 'defender', 'system'];
  // Order matters: a beat's kind is the first of these present as a key; `mark` beside another
  // kind key is that beat's field.
  var BEAT_KINDS = ['chain', 'exchange', 'stream', 'card', 'camera', 'shields', 'pulse', 'custom', 'mark'];
  var BEAT_FIELDS = {
    chain: ['tag', 'color', 'says', 'sayAt', 'trail', 'mark', 'mono'],
    exchange: ['tag', 'req', 'resp', 'respTag', 'respColor', 'mono', 'trail', 'color', 'mark'],
    stream: ['items', 'says', 'tally', 'mono', 'color', 'tag'],
    card: ['title', 'rows', 'color', 'then'],
    camera: [], shields: [], pulse: ['color'], mark: []
  };
  var BEAT_COMMON = ['at', 'parallel'];
  var ROUTE_KEYS = ['exit', 'corridor', 'lane', 'via'];     /* link.route hints; link.route.iso takes the same keys (iso style only) */
  var PATTERN_BLOCKS = ['runs', 'states', 'objects', 'horizons', 'lanes', 'initiatives', 'risks', 'layers', 'coverage'];
  var MAX_TITLE = 6, MAX_BODY = 30, MAX_CALLOUT = 6, MAX_CALLOUTS = 2, MAX_ITEMS = 4;

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function wc(s) { return String(s == null ? '' : s).trim().split(/\s+/).filter(Boolean).length; }
  function str(v) { return typeof v === 'string' && v.trim() !== ''; }
  function list(v) { return Array.isArray(v) ? v : []; }
  function q(s) { return '"' + s + '"'; }

  function formatProblem(p) {
    return p.path + ': ' + p.message + '. Fix: ' + p.fix + '.';
  }

  function validate(story, opts) {
    opts = opts || {};
    var style = opts.style || null;
    var out = [];
    function err(path, message, fix) { out.push({ level: 'error', path: path, message: message, fix: fix }); }
    function warn(path, message, fix) { out.push({ level: 'warning', path: path, message: message, fix: fix }); }

    if (!isObj(story)) {
      err('story', 'is not an object', 'make the file a JSON object with meta, zones, systems, links, phases, steps');
      return out;
    }

    var zoneIds = {}, systemIds = {}, phaseIds = {}, stepIds = {}, controlIds = {}, linkSet = {};

    function checkSource(path, rec) {
      var s = rec.source;
      if (!isObj(s)) {
        err(path + '.source', 'is missing', 'add "source": {"kind": "provided"|"derived"|"illustrative"}, with "ref" when provided');
        return;
      }
      if (SOURCE_KINDS.indexOf(s.kind) < 0) {
        err(path + '.source.kind', 'is ' + (s.kind === undefined ? 'missing' : q(s.kind)) + ', not one of provided, derived, illustrative',
          'set kind to provided, derived or illustrative');
        return;
      }
      if (s.kind === 'provided' && !str(s.ref)) {
        err(path + '.source.ref', 'is missing on a provided record', 'add ref naming where the fact came from, specific enough to find it again');
      }
    }

    function collect(arr, path, into, what) {
      list(arr).forEach(function (r, i) {
        var p = path + '[' + i + ']';
        if (!isObj(r)) { err(p, 'is not an object', 'make it an object with an id'); return; }
        if (!str(r.id)) { err(p + '.id', 'is missing', 'give the ' + what + ' a unique id'); return; }
        if (into[r.id]) err(p + '.id', 'duplicates ' + q(r.id), 'rename one of the ' + what + 's so ids are unique');
        into[r.id] = true;
      });
    }

    // arrays that must be arrays
    ['zones', 'systems', 'links', 'phases', 'steps', 'controls', 'events'].forEach(function (k) {
      if (story[k] !== undefined && !Array.isArray(story[k])) err(k, 'is not an array', 'make ' + k + ' a JSON array');
    });
    if (!Array.isArray(story.steps) || story.steps.length === 0) {
      err('steps', 'is missing or empty', 'add at least one step');
    }

    // meta
    var m = story.meta;
    if (!isObj(m)) {
      err('meta', 'is missing', 'add meta with id, title, kind, audience, redaction and source');
    } else {
      ['id', 'title', 'redaction'].forEach(function (k) {
        if (!str(m[k])) err('meta.' + k, 'is missing', 'set meta.' + k + ' to a non-empty string');
      });
      if (KINDS.indexOf(m.kind) < 0) err('meta.kind', 'is ' + (m.kind === undefined ? 'missing' : q(m.kind)) + ', not one of ' + KINDS.join(', '), 'set kind to one of ' + KINDS.join(', '));
      if (AUDIENCES.indexOf(m.audience) < 0) err('meta.audience', 'is ' + (m.audience === undefined ? 'missing' : q(m.audience)) + ', not one of ' + AUDIENCES.join(', '), 'set audience to technical or executive');
      checkSource('meta', m);
    }

    collect(story.zones, 'zones', zoneIds, 'zone');
    collect(story.systems, 'systems', systemIds, 'system');
    collect(story.phases, 'phases', phaseIds, 'phase');
    collect(story.steps, 'steps', stepIds, 'step');
    collect(story.controls, 'controls', controlIds, 'control');

    function holdable(id) { return !!(zoneIds[id] || systemIds[id]); }

    // zones
    list(story.zones).forEach(function (z, i) {
      if (!isObj(z)) return;
      var p = 'zones[' + i + ']';
      if (!str(z.name)) err(p + '.name', 'is missing', 'give the zone a display name');
      if (z.parent !== undefined && !zoneIds[z.parent]) err(p + '.parent', 'refers to unknown zone ' + q(z.parent), 'use an id from zones[] or remove parent');
      if (z.parent !== undefined && z.parent === z.id) err(p + '.parent', 'is the zone itself', 'point parent at the enclosing zone');
      checkSource(p, z);
    });

    // systems
    list(story.systems).forEach(function (s, i) {
      if (!isObj(s)) return;
      var p = 'systems[' + i + ']';
      if (!str(s.name)) err(p + '.name', 'is missing', 'give the system a display name');
      if (!str(s.role)) err(p + '.role', 'is missing', 'add role, one plain-language line');
      if (!zoneIds[s.zone]) err(p + '.zone', s.zone === undefined ? 'is missing' : 'refers to unknown zone ' + q(s.zone), 'use an id from zones[]');
      checkSource(p, s);
    });

    // links
    list(story.links).forEach(function (l, i) {
      if (!isObj(l)) { err('links[' + i + ']', 'is not an object', 'make it {"from": id, "to": id, "source": {...}}'); return; }
      var p = 'links[' + i + ']';
      var ok = true;
      ['from', 'to'].forEach(function (k) {
        if (!systemIds[l[k]]) { ok = false; err(p + '.' + k, l[k] === undefined ? 'is missing' : 'refers to unknown system ' + q(l[k]), 'use an id from systems[]'); }
      });
      if (ok) { linkSet[l.from + '\n' + l.to] = true; linkSet[l.to + '\n' + l.from] = true; }
      /* route hints: exit, corridor, lane, via; route.iso holds the same keys and replaces them for --style iso */
      function routeKeys(rp, r, nested) {
        if (!isObj(r)) { err(rp, 'is not an object', 'write route hints as {"exit", "corridor", "lane", "via"}'); return; }
        Object.keys(r).forEach(function (k) {
          if (k.charAt(0) === '_' || ROUTE_KEYS.indexOf(k) >= 0) return;
          if (k === 'iso' && !nested) { routeKeys(rp + '.iso', r.iso, true); return; }
          err(rp + '.' + k, 'is not a route hint', 'use ' + ROUTE_KEYS.join(', ') + (nested ? '' : ', or iso: {...} for the iso style'));
        });
      }
      if (l.route !== undefined) routeKeys(p + '.route', l.route, false);
      checkSource(p, l);
    });
    function isLink(a, b) { return !!linkSet[a + '\n' + b]; }
    function pairProblem(path, pair, what) {
      if (!Array.isArray(pair) || pair.length !== 2) { err(path, 'is not a [from, to] pair', 'write it as ["from-id", "to-id"]'); return; }
      var bad = false;
      pair.forEach(function (id, k) {
        if (!systemIds[id]) { bad = true; err(path + '[' + k + ']', 'refers to unknown system ' + q(id), 'use an id from systems[]'); }
      });
      if (!bad && !isLink(pair[0], pair[1])) {
        err(path, '[' + pair[0] + ', ' + pair[1] + '] is not a link', 'add a link between them to links[], or ' + what);
      }
    }

    // phases
    list(story.phases).forEach(function (ph, i) {
      if (!isObj(ph)) return;
      var p = 'phases[' + i + ']';
      if (!str(ph.title)) err(p + '.title', 'is missing', 'give the phase a title');
      checkSource(p, ph);
    });

    // controls
    list(story.controls).forEach(function (c, i) {
      if (!isObj(c)) return;
      var p = 'controls[' + i + ']';
      if (!str(c.name)) err(p + '.name', 'is missing', 'name the control');
      pairProblem(p + '.on', c.on, 'point on at a pair that is a link');
      checkSource(p, c);
    });

    // figures
    if (story.figures !== undefined) {
      if (!isObj(story.figures)) err('figures', 'is not an object', 'make figures {"key": {"value", "unit", "label", "source"}}');
      else Object.keys(story.figures).forEach(function (k) {
        if (k.charAt(0) === '_') return;
        var f = story.figures[k], p = 'figures.' + k;
        if (!isObj(f)) { err(p, 'is not an object', 'make it {"value", "unit", "label", "source"}'); return; }
        if (f.value === undefined) err(p + '.value', 'is missing', 'set the value');
        if (f.unit === 'count') {
          err(p, 'is a count typed into the story (counts are computed, never typed)',
            'remove it and let the kit derive the count from events, systems and steps, or change the unit if it is a measurement');
        }
        checkSource(p, f);
      });
    }

    // events
    list(story.events).forEach(function (e, i) {
      var p = 'events[' + i + ']';
      if (!isObj(e)) { err(p, 'is not an object', 'make it an event object'); return; }
      if (!str(e.step)) err(p + '.step', 'is missing', 'set step to the id of the step this event belongs to');
      else if (!stepIds[e.step]) err(p + '.step', 'refers to unknown step ' + q(e.step), 'use an id from steps[]');
      ['from', 'to'].forEach(function (k) {
        if (!str(e[k])) err(p + '.' + k, 'is missing', 'set ' + k + ' to a system id');
        else if (!systemIds[e[k]]) err(p + '.' + k, 'refers to unknown system ' + q(e[k]), 'use an id from systems[]');
      });
      if (VISIBILITY.indexOf(e.visibility) < 0) err(p + '.visibility', (e.visibility === undefined ? 'is missing' : 'is ' + q(e.visibility)) + ', not one of ' + VISIBILITY.join(', '), 'set visibility to ' + VISIBILITY.join(', ') + ' (pick one)');
      if (ACTORS.indexOf(e.actor) < 0) err(p + '.actor', (e.actor === undefined ? 'is missing' : 'is ' + q(e.actor)) + ', not one of ' + ACTORS.join(', '), 'set actor to ' + ACTORS.join(', ') + ' (pick one)');
      if (e.t !== undefined && typeof e.t !== 'number') err(p + '.t', 'is not a number', 'use seconds from the first event');
      checkSource(p, e);
    });

    // pattern blocks: validated only for source
    PATTERN_BLOCKS.forEach(function (k) {
      if (Array.isArray(story[k])) story[k].forEach(function (r, i) {
        if (isObj(r)) checkSource(k + '[' + i + ']', r);
      });
    });

    // steps
    list(story.steps).forEach(function (s, i) {
      if (!isObj(s)) { err('steps[' + i + ']', 'is not an object', 'make it a step object'); return; }
      var p = 'steps[' + i + ']';
      if (!str(s.title)) err(p + '.title', 'is missing', 'give the step a title of ' + MAX_TITLE + ' words or fewer');
      else if (wc(s.title) > MAX_TITLE) err(p + '.title', 'has ' + wc(s.title) + ' words (limit ' + MAX_TITLE + ')', 'shorten the title to ' + MAX_TITLE + ' words or fewer');
      if (!str(s.body)) err(p + '.body', 'is missing', 'write a body of ' + MAX_BODY + ' words or fewer');
      else if (wc(s.body) > MAX_BODY) err(p + '.body', 'has ' + wc(s.body) + ' words (limit ' + MAX_BODY + ')', 'cut the body to ' + MAX_BODY + ' words or fewer and move the rest to detail');
      if (s.phase !== undefined && !phaseIds[s.phase]) err(p + '.phase', 'refers to unknown phase ' + q(s.phase), 'use an id from phases[]');
      if (s.touch !== undefined && !Array.isArray(s.touch)) err(p + '.touch', 'is not an array', 'make touch a list of system ids');
      list(s.touch).forEach(function (id, k) {
        if (!systemIds[id]) err(p + '.touch[' + k + ']', 'refers to unknown system ' + q(id), 'use an id from systems[]');
      });
      if (s.uses !== undefined && !Array.isArray(s.uses)) err(p + '.uses', 'is not an array', 'make uses a list of [from, to] pairs');
      list(s.uses).forEach(function (pair, k) {
        pairProblem(p + '.uses[' + k + ']', pair, 'fix the pair');
      });
      // frame
      if (s.frame !== undefined && s.frame !== 'full') {
        if (!isObj(s.frame) || !Array.isArray(s.frame.hold)) {
          err(p + '.frame', 'is not "full" or {"hold": [ids]}', 'write "full" or {"hold": ["id", ...], "grow": "down"}');
        } else {
          s.frame.hold.forEach(function (id, k) {
            if (!holdable(id)) err(p + '.frame.hold[' + k + ']', 'refers to unknown zone or system ' + q(id), 'use an id from zones[] or systems[]');
          });
          if (s.frame.zoom !== undefined && !(typeof s.frame.zoom === 'number' && s.frame.zoom > 0)) err(p + '.frame.zoom', 'is not a positive number', 'write the stage px per ground unit, e.g. 2, or remove it (close-ups are capped at 1.3 without it)');
          if (style === 'iso' && s.frame.grow !== undefined) warn(p + '.frame.grow', 'is not supported in iso and is ignored', 'remove grow or build with --style flat');
        }
      }
      // callouts
      if (s.callouts !== undefined) {
        if (!Array.isArray(s.callouts)) err(p + '.callouts', 'is not an array', 'make callouts a list of {"target", "text"}');
        else {
          if (s.callouts.length > MAX_CALLOUTS) err(p + '.callouts', 'has ' + s.callouts.length + ' entries (limit ' + MAX_CALLOUTS + ')', 'keep at most ' + MAX_CALLOUTS + ' callouts per step');
          s.callouts.forEach(function (c, k) {
            var cp = p + '.callouts[' + k + ']';
            if (!isObj(c)) { err(cp, 'is not an object', 'make it {"target": id, "text": "..."}'); return; }
            if (!holdable(c.target)) err(cp + '.target', c.target === undefined ? 'is missing' : 'refers to unknown zone or system ' + q(c.target), 'use an id from zones[] or systems[]');
            if (!str(c.text)) err(cp + '.text', 'is missing', 'write callout text of ' + MAX_CALLOUT + ' words or fewer');
            else if (wc(c.text) > MAX_CALLOUT) err(cp + '.text', 'has ' + wc(c.text) + ' words (limit ' + MAX_CALLOUT + ')', 'shorten it to ' + MAX_CALLOUT + ' words or fewer');
          });
        }
      }
      checkSource(p, s);
      // beats
      if (s.beats !== undefined) {
        if (!Array.isArray(s.beats)) { err(p + '.beats', 'is not an array', 'make beats a list of beat objects'); return; }
        var cards = 0;
        s.beats.forEach(function (b, k) {
          var bp = p + '.beats[' + k + ']';
          if (!isObj(b)) { err(bp, 'is not an object', 'make it an object with one beat kind: ' + BEAT_KINDS.join(', ')); return; }
          var kinds = BEAT_KINDS.filter(function (n) { return b[n] !== undefined; });
          if (kinds.length === 0) { err(bp, 'has no known beat kind', 'use one of ' + BEAT_KINDS.join(', ') + ' as a key'); return; }
          var kind = kinds[0], v = b[kind];
          if (kind !== 'custom') {
            var allowed = [kind].concat(BEAT_FIELDS[kind], BEAT_COMMON);
            if (kind === 'card') allowed.push('at');
            Object.keys(b).forEach(function (key) {
              if (key.charAt(0) === '_' || allowed.indexOf(key) >= 0) return;
              err(bp + '.' + key, 'is not a field of a ' + kind + ' beat', 'remove it; a ' + kind + ' beat takes ' + allowed.join(', '));
            });
          }
          if (kind !== 'card' && b.at !== undefined && typeof b.at !== 'number') err(bp + '.at', 'is not a number', 'give at as seconds after the step\'s motion start');
          function sys(path, id) { if (!systemIds[id]) err(path, 'refers to unknown system ' + q(id), 'use an id from systems[]'); return !!systemIds[id]; }
          function pair(path, a, c) { if (sys(path + '[0]', a) & sys(path + '[1]', c) && !isLink(a, c)) err(path, '[' + a + ', ' + c + '] is not a link', 'add the link to links[] or pick a linked pair'); }
          if (kind === 'chain') {
            if (!Array.isArray(v) || v.length < 2) err(bp + '.chain', 'needs a list of at least 2 system ids', 'write "chain": ["from-id", "next-id", ...]');
            else for (var j = 0; j + 1 < v.length; j++) pair(bp + '.chain[' + j + ']', v[j], v[j + 1]);
          } else if (kind === 'exchange') {
            if (!Array.isArray(v) || v.length !== 2) err(bp + '.exchange', 'needs exactly [from, to]', 'write "exchange": ["from-id", "to-id"]');
            else pair(bp + '.exchange', v[0], v[1]);
          } else if (kind === 'stream') {
            if (!Array.isArray(v) || v.length < 2) err(bp + '.stream', 'needs a path of at least 2 system ids', 'write "stream": ["from-id", "next-id", ...]');
            else for (var jj = 0; jj + 1 < v.length; jj++) pair(bp + '.stream[' + jj + ']', v[jj], v[jj + 1]);
            if (Array.isArray(b.items) && b.items.length > MAX_ITEMS) err(bp + '.items', 'has ' + b.items.length + ' items (limit ' + MAX_ITEMS + ')', 'keep at most ' + MAX_ITEMS + ' items');
          } else if (kind === 'card') {
            cards++;
            if (!str(v)) err(bp + '.card', 'is not a card id', 'give the card an id string');
            if (!systemIds[b.at]) err(bp + '.at', b.at === undefined ? 'is missing' : 'refers to unknown system ' + q(b.at), 'set at to an id from systems[]');
          } else if (kind === 'mark') {
            sys(bp + '.mark', v);
          } else if (kind === 'pulse') {
            sys(bp + '.pulse', v);
          } else if (kind === 'camera') {
            if (style === 'iso') warn(bp + '.camera', 'is not supported with --style iso and is skipped', 'remove the camera beat or build with --style flat');
            if (v === 'step' || v === 'full') { /* ok */ }
            else if (isObj(v) && Array.isArray(v.hold)) {
              if (v.zoom !== undefined && !(typeof v.zoom === 'number' && v.zoom > 0)) err(bp + '.camera.zoom', 'is not a positive number', 'write the stage px per ground unit, e.g. 2, or remove it (close-ups are capped at 1.3 without it)');
              v.hold.forEach(function (id, n) { if (!holdable(id)) err(bp + '.camera.hold[' + n + ']', 'refers to unknown zone or system ' + q(id), 'use an id from zones[] or systems[]'); });
            } else err(bp + '.camera', 'is not "step", "full" or {"hold": [ids]}', 'write "step", "full" or {"hold": ["id", ...]}');
          } else if (kind === 'shields') {
            if (v === 'controls') { /* all */ }
            else if (Array.isArray(v)) v.forEach(function (id, n) { if (!controlIds[id]) err(bp + '.shields[' + n + ']', 'refers to unknown control ' + q(id), 'use an id from controls[]'); });
            else err(bp + '.shields', 'is not "controls" or a list of control ids', 'write "controls" or ["control-id", ...]');
          } else if (kind === 'custom') {
            if (!str(v)) err(bp + '.custom', 'is not a kind name', 'name the custom beat kind registered in EXK.extra.beats');
          }
          // fields that name systems in any beat
          if (b.mark !== undefined && kind !== 'mark') sys(bp + '.mark', b.mark);
          if (b.sayAt !== undefined && b.sayAt !== 'dest') sys(bp + '.sayAt', b.sayAt);
          if (b.tag !== undefined && wc(b.tag) > 2) err(bp + '.tag', 'has ' + wc(b.tag) + ' words (limit 2)', 'move the text to says and keep the tag to 1-2 words');
        });
        if (style === 'iso' && cards > 1) warn(p + '.beats', 'has ' + cards + ' card beats; iso shows the first and skips the rest', 'keep one card or build with --style flat');
      }
    });

    return out;
  }

  function stripComments(v) {
    if (Array.isArray(v)) return v.map(stripComments);
    if (isObj(v)) {
      var o = {};
      Object.keys(v).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = stripComments(v[k]); });
      return o;
    }
    return v;
  }

  // Contiguous runs of `uses` become chains: [a,b],[b,c] -> [a,b,c]; a pair that does not
  // continue the previous one starts a new chain.
  function chainsFromUses(uses) {
    var chains = [];
    list(uses).forEach(function (pr) {
      var cur = chains[chains.length - 1];
      if (cur && cur[cur.length - 1] === pr[0]) cur.push(pr[1]);
      else chains.push([pr[0], pr[1]]);
    });
    return chains;
  }

  function normalize(story) {
    var s = stripComments(story);
    ['zones', 'systems', 'links', 'phases', 'steps', 'controls', 'events'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    if (!isObj(s.figures)) s.figures = {};
    s.zones.forEach(function (z) { if (z.short === undefined) z.short = z.name; });
    s.systems.forEach(function (x) { if (x.short === undefined) x.short = x.name; });
    s.steps.forEach(function (st) {
      if (!Array.isArray(st.touch)) st.touch = [];
      if (!Array.isArray(st.uses)) st.uses = [];
      if (!Array.isArray(st.callouts)) st.callouts = [];
      if (st.frame === undefined) st.frame = (st.all || st.touch.length === 0) ? 'full' : { hold: st.touch.slice() };
      if (st.beats === undefined) st.beats = chainsFromUses(st.uses).map(function (c) { return { chain: c }; });
    });
    return s;
  }

  EXK.validate = validate;
  EXK.normalize = normalize;
  EXK.formatProblem = formatProblem;
})();
