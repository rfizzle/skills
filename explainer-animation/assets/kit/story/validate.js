/* Story validation and normalisation. Pure: no DOM, no GSAP, no knowledge of painters.
   validate(story, {style, pattern}) -> [{level, rule, path, message, fix}]   level: 'error' | 'warning'; rule: stable kebab-case id of the kind of problem
   A story is a custom-pattern story when pattern is 'custom' or meta.scene is set: every record of every
   top-level array it carries (beyond the core ones) must have a source, like the named pattern blocks.
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
    stream: ['items', 'says', 'tally', 'mono', 'color', 'tag', 'glyph'],
    card: ['title', 'rows', 'color', 'then'],
    camera: [], shields: [], pulse: ['color'], mark: []
  };
  var BEAT_COMMON = ['at', 'parallel'];
  var GLYPHS = ['dot', 'file', 'push', 'mail', 'key'];      /* a stream packet's glyph (paint/flat.js, paint/iso.js) */
  var ROUTE_KEYS = ['exit', 'corridor', 'lane', 'via'];     /* link.route hints; link.route.iso takes the same keys (iso style only) */
  var PATTERN_BLOCKS = ['runs', 'states', 'objects', 'horizons', 'lanes', 'initiatives', 'risks', 'dependencies', 'layers', 'coverage'];
  var CORE_ARRAYS = ['zones', 'systems', 'links', 'phases', 'steps', 'controls', 'events'];
  var MAX_TITLE = 6, MAX_BODY = 30, MAX_CALLOUT = 6, MAX_CALLOUTS = 2, MAX_ITEMS = 4;
  /* Character caps per text field (warnings), from what fits the 1920x1080 film frame at the kit's sizes: the narrative band is
     1420 px wide and holds three lines of 32 px body text (about 85 characters a line, 260 characters in all); the title is
     one line of 46 px bold in about 1340 px (24 px a character); says, callouts and card rows are 26 px labels placed beside a
     block (about 14 px a character, so 32 characters are about 440 px, a quarter of the diagram area); a moving tag is a 22 px
     pill (12 px a character). Caps leave about 10% for a wider system font. A `says` line is one line of the label (the text
     may hold \n). references/rules.md section B lists them. */
  var CAPS = { title: 48, body: 240, callout: 32, says: 32, req: 32, resp: 32, row: 30, cardTitle: 30, tag: 16, tally: 16 };
  var STARTERS = ['now', 'here', 'next'];
  /* typed counts in text: what is exempt (references/rules.md section B lists the same) */
  var NUM_WORDS = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'twenty', 'thirty', 'forty', 'fifty', 'hundred'];
  var UNITS = ('second seconds sec secs ms millisecond milliseconds minute minutes min mins hour hours hr hrs day days week weeks month months year years ' +
    'am pm utc gmt percent kb mb gb tb kib mib gib byte bytes bit bits px hz khz mhz ghz bps kbps mbps gbps usd eur gbp times').split(' ');
  var NOT_NOUNS = ('and or of to in on at for the a an is are was were be been with by from as than but then so if when while that this these those which who ' +
    'it its not no nor per via into over under after before is has have had can could will would may might must should more less most least other another ' +
    'each every all some any both either neither only just also still again later earlier first last next').split(' ');
  var LABELS = ('step steps phase stage tier level version release rev round option scene slide page figure fig number no http https tls ssl status code error ' +
    'cve rfc iso aes sha rsa port ports ipv top q v').split(' ');
  var NOT_X = ['509', '86', '64', '11'];     /* x509, x86, x64, x11 are names, not multipliers */

  function words(t) { return String(t).split(/\s+/).filter(Boolean); }
  /* a quantity that looks like a count of things in the story, or null: digits and a noun ("3 passages"), a number word and a
     noun ("three tokens"), "N of M", "x4" or "4x". Not counted: versions, addresses, times and decimals (a dot or colon joins the
     digits), ports and HTTP codes (a label word before, or 100-599 before a capitalised word), years (1900-2100), paths and
     identifiers (anything joined to letters, slashes, underscores or =), durations and sizes (a unit noun), text in double quotes. */
  function typedCount(text) {
    var t = String(text).replace(/"[^"]*"|\u201c[^\u201d]*\u201d/g, ' ').split(/\s+/).filter(function (w) { return !/[\/\\@_=]/.test(w); }).join(' ');
    var m, re;
    re = /(^|[\s(\[])(\d[\d,]*)\s+of\s+(\d[\d,]*)(?![\d.:])/g;
    if ((m = re.exec(t))) return m[2] + ' of ' + m[3];
    re = /(^|[\s(\[])(\d[\d,]*)\s+([A-Za-z][A-Za-z']*)/g;
    while ((m = re.exec(t))) {
      var n = parseInt(m[2].replace(/,/g, ''), 10), noun = m[3].toLowerCase(), before = t.slice(0, m.index + m[1].length).trim().split(/\s+/).pop().toLowerCase();
      if (/[.:]$/.test(m[2]) || UNITS.indexOf(noun) >= 0 || NOT_NOUNS.indexOf(noun) >= 0 || LABELS.indexOf(before.replace(/[^a-z]/g, '')) >= 0) continue;
      if (n >= 1900 && n <= 2100) continue;
      if (n >= 100 && n <= 599 && /^[A-Z]/.test(m[3])) continue;
      return m[2] + ' ' + m[3];
    }
    re = new RegExp('(^|[\\s(\\[-])(' + NUM_WORDS.join('|') + ')(?:\\s+(of\\s+(?:\\d+|the|our|these|those|them|its|their|' + NUM_WORDS.join('|') + ')\\b)|\\s+([a-z][a-z\']*))', 'gi');
    while ((m = re.exec(t))) {
      if (m[3]) return m[2] + ' ' + m[3];
      var nw = m[4].toLowerCase();
      if (UNITS.indexOf(nw) >= 0 || NOT_NOUNS.indexOf(nw) >= 0) continue;
      return m[2] + ' ' + m[4];
    }
    re = /(^|\s)(?:[x\u00d7]\s?(\d{1,3})|(\d{1,3})\s?[x\u00d7])(?=$|[\s.,;:)!?])/gi;
    while ((m = re.exec(t))) if (NOT_X.indexOf(m[2] || m[3]) < 0) return m[0].trim();
    return null;
  }

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
    function err(rule, path, message, fix) { out.push({ level: 'error', rule: rule, path: path, message: message, fix: fix }); }
    function warn(rule, path, message, fix) { out.push({ level: 'warning', rule: rule, path: path, message: message, fix: fix }); }
    /* caption rules on one piece of film text (warnings): length cap, typed counts, a first word that points at the screen,
       balanced backticks. `o`: cap (character cap per line), what (field name), first (check the first word), lit (exempt from
       the count rule: _literal on the record), mono (machine text: no count rule). */
    function textWarn(path, value, o) {
      list(Array.isArray(value) ? value : [value]).forEach(function (v, i) {
        if (!str(v)) return;
        var p = Array.isArray(value) ? path + '[' + i + ']' : path;
        String(v).split('\n').forEach(function (line) {
          if (o.cap && line.length > o.cap) warn('caption-line-too-long', p, 'has a line of ' + line.length + ' characters (a ' + o.what + ' line fits ' + o.cap + ' in the film frame)', 'cut it to ' + o.cap + ' characters or fewer' + (o.what === 'body' ? ' and move the rest to detail' : ' (split a says over two lines with \\n)'));
        });
        if (o.first) {
          var w = words(v)[0].replace(/[^A-Za-z]/g, '').toLowerCase();
          if (STARTERS.indexOf(w) >= 0) warn('caption-starts-at-screen', p, 'starts with "' + words(v)[0] + '", which points at the screen instead of saying what happens', 'start with the subject ("The attacker ...") and say what happens');
        }
        if ((String(v).split('`').length - 1) % 2) warn('caption-unbalanced-backtick', p, 'has an unbalanced backtick (backticks are drawn as written)', 'remove the backtick, or close it');
        if (!o.lit && !o.mono) {
          var c = typedCount(v);
          if (c) warn('caption-typed-count', p, 'contains "' + c + '", which looks like a typed count of things in the story', 'remove the number or say it without one; counts are computed, never typed. If the number is part of a name, put it in double quotes or set "_literal": true on this step, beat or callout');
        }
      });
    }

    if (!isObj(story)) {
      err('story-not-object', 'story', 'is not an object', 'make the file a JSON object with meta, zones, systems, links, phases, steps');
      return out;
    }

    var zoneIds = {}, systemIds = {}, phaseIds = {}, stepIds = {}, controlIds = {}, linkSet = {};

    function checkSource(path, rec) {
      var s = rec.source;
      if (!isObj(s)) {
        err('missing-source', path + '.source', 'is missing', 'add "source": {"kind": "provided"|"derived"|"illustrative"}, with "ref" when provided');
        return;
      }
      if (SOURCE_KINDS.indexOf(s.kind) < 0) {
        err('source-kind-invalid', path + '.source.kind', 'is ' + (s.kind === undefined ? 'missing' : q(s.kind)) + ', not one of provided, derived, illustrative',
          'set kind to provided, derived or illustrative');
        return;
      }
      if (s.kind === 'provided' && !str(s.ref)) {
        err('source-ref-missing', path + '.source.ref', 'is missing on a provided record', 'add ref naming where the fact came from, specific enough to find it again');
      }
    }

    function collect(arr, path, into, what) {
      list(arr).forEach(function (r, i) {
        var p = path + '[' + i + ']';
        if (!isObj(r)) { err('record-not-object', p, 'is not an object', 'make it an object with an id'); return; }
        if (!str(r.id)) { err('id-missing', p + '.id', 'is missing', 'give the ' + what + ' a unique id'); return; }
        if (into[r.id]) err('id-duplicate', p + '.id', 'duplicates ' + q(r.id), 'rename one of the ' + what + 's so ids are unique');
        into[r.id] = true;
      });
    }

    // arrays that must be arrays
    ['zones', 'systems', 'links', 'phases', 'steps', 'controls', 'events'].forEach(function (k) {
      if (story[k] !== undefined && !Array.isArray(story[k])) err('block-not-array', k, 'is not an array', 'make ' + k + ' a JSON array');
    });
    if (!Array.isArray(story.steps) || story.steps.length === 0) {
      err('steps-empty', 'steps', 'is missing or empty', 'add at least one step');
    }

    // meta
    var m = story.meta;
    if (!isObj(m)) {
      err('meta-missing', 'meta', 'is missing', 'add meta with id, title, kind, audience, redaction and source');
    } else {
      ['id', 'title', 'redaction'].forEach(function (k) {
        if (!str(m[k])) err('meta-field-missing', 'meta.' + k, 'is missing', 'set meta.' + k + ' to a non-empty string');
      });
      if (KINDS.indexOf(m.kind) < 0) err('meta-kind-invalid', 'meta.kind', 'is ' + (m.kind === undefined ? 'missing' : q(m.kind)) + ', not one of ' + KINDS.join(', '), 'set kind to one of ' + KINDS.join(', '));
      if (AUDIENCES.indexOf(m.audience) < 0) err('meta-audience-invalid', 'meta.audience', 'is ' + (m.audience === undefined ? 'missing' : q(m.audience)) + ', not one of ' + AUDIENCES.join(', '), 'set audience to technical or executive');
      checkSource('meta', m);
      if (m.startsAt !== undefined && (!str(m.startsAt) || isNaN(Date.parse(m.startsAt)))) warn('meta-starts-at-invalid', 'meta.startsAt', 'is not an ISO 8601 date and time', 'write it as "2026-03-09T14:02:00Z" (the time of the first event), or remove it and the replay banner shows the span instead');
      if (m.scene !== undefined && !str(m.scene)) err('meta-scene-invalid', 'meta.scene', 'is not a scene name', 'set meta.scene to the name the scene file registers as EXK.scenes.<name>, or remove it');
    }
    var custom = opts.pattern === 'custom' || (isObj(m) && str(m.scene));

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
      if (!str(z.name)) err('zone-name-missing', p + '.name', 'is missing', 'give the zone a display name');
      if (z.parent !== undefined && !zoneIds[z.parent]) err('zone-parent-unknown', p + '.parent', 'refers to unknown zone ' + q(z.parent), 'use an id from zones[] or remove parent');
      if (z.parent !== undefined && z.parent === z.id) err('zone-parent-self', p + '.parent', 'is the zone itself', 'point parent at the enclosing zone');
      checkSource(p, z);
    });

    // systems
    list(story.systems).forEach(function (s, i) {
      if (!isObj(s)) return;
      var p = 'systems[' + i + ']';
      if (!str(s.name)) err('system-name-missing', p + '.name', 'is missing', 'give the system a display name');
      if (!str(s.role)) err('system-role-missing', p + '.role', 'is missing', 'add role, one plain-language line');
      if (!zoneIds[s.zone]) err('system-zone-unknown', p + '.zone', s.zone === undefined ? 'is missing' : 'refers to unknown zone ' + q(s.zone), 'use an id from zones[]');
      checkSource(p, s);
    });

    // links
    list(story.links).forEach(function (l, i) {
      if (!isObj(l)) { err('link-not-object', 'links[' + i + ']', 'is not an object', 'make it {"from": id, "to": id, "source": {...}}'); return; }
      var p = 'links[' + i + ']';
      var ok = true;
      ['from', 'to'].forEach(function (k) {
        if (!systemIds[l[k]]) { ok = false; err('link-end-unknown', p + '.' + k, l[k] === undefined ? 'is missing' : 'refers to unknown system ' + q(l[k]), 'use an id from systems[]'); }
      });
      if (ok) { linkSet[l.from + '\n' + l.to] = true; linkSet[l.to + '\n' + l.from] = true; }
      /* route hints: exit, corridor, lane, via; route.iso holds the same keys and replaces them for --style iso */
      function routeKeys(rp, r, nested) {
        if (!isObj(r)) { err('route-not-object', rp, 'is not an object', 'write route hints as {"exit", "corridor", "lane", "via"}'); return; }
        Object.keys(r).forEach(function (k) {
          if (k.charAt(0) === '_' || ROUTE_KEYS.indexOf(k) >= 0) return;
          if (k === 'iso' && !nested) { routeKeys(rp + '.iso', r.iso, true); return; }
          err('route-hint-unknown', rp + '.' + k, 'is not a route hint', 'use ' + ROUTE_KEYS.join(', ') + (nested ? '' : ', or iso: {...} for the iso style'));
        });
      }
      if (l.route !== undefined) routeKeys(p + '.route', l.route, false);
      checkSource(p, l);
    });
    function isLink(a, b) { return !!linkSet[a + '\n' + b]; }
    function pairProblem(rule, path, pair, what) {
      if (!Array.isArray(pair) || pair.length !== 2) { err('pair-malformed', path, 'is not a [from, to] pair', 'write it as ["from-id", "to-id"]'); return; }
      var bad = false;
      pair.forEach(function (id, k) {
        if (!systemIds[id]) { bad = true; err('pair-system-unknown', path + '[' + k + ']', 'refers to unknown system ' + q(id), 'use an id from systems[]'); }
      });
      if (!bad && !isLink(pair[0], pair[1])) {
        err(rule, path, '[' + pair[0] + ', ' + pair[1] + '] is not a link', 'add a link between them to links[], or ' + what);
      }
    }

    // phases
    list(story.phases).forEach(function (ph, i) {
      if (!isObj(ph)) return;
      var p = 'phases[' + i + ']';
      if (!str(ph.title)) err('phase-title-missing', p + '.title', 'is missing', 'give the phase a title');
      checkSource(p, ph);
    });

    // controls
    list(story.controls).forEach(function (c, i) {
      if (!isObj(c)) return;
      var p = 'controls[' + i + ']';
      if (!str(c.name)) err('control-name-missing', p + '.name', 'is missing', 'name the control');
      pairProblem('control-on-not-link', p + '.on', c.on, 'point on at a pair that is a link');
      checkSource(p, c);
    });

    // figures
    if (story.figures !== undefined) {
      if (!isObj(story.figures)) err('figures-not-object', 'figures', 'is not an object', 'make figures {"key": {"value", "unit", "label", "source"}}');
      else Object.keys(story.figures).forEach(function (k) {
        if (k.charAt(0) === '_') return;
        var f = story.figures[k], p = 'figures.' + k;
        if (!isObj(f)) { err('figure-not-object', p, 'is not an object', 'make it {"value", "unit", "label", "source"}'); return; }
        if (f.value === undefined) err('figure-value-missing', p + '.value', 'is missing', 'set the value');
        if (f.unit === 'count') {
          err('figure-typed-count', p, 'is a count typed into the story (counts are computed, never typed)',
            'remove it and let the kit derive the count from events, systems and steps, or change the unit if it is a measurement');
        }
        checkSource(p, f);
      });
    }

    // events
    list(story.events).forEach(function (e, i) {
      var p = 'events[' + i + ']';
      if (!isObj(e)) { err('event-not-object', p, 'is not an object', 'make it an event object'); return; }
      if (!str(e.step)) err('event-missing-step', p + '.step', 'is missing', 'set step to the id of the step this event belongs to');
      else if (!stepIds[e.step]) err('event-step-unknown', p + '.step', 'refers to unknown step ' + q(e.step), 'use an id from steps[]');
      ['from', 'to'].forEach(function (k) {
        if (!str(e[k])) err('event-system-missing', p + '.' + k, 'is missing', 'set ' + k + ' to a system id');
        else if (!systemIds[e[k]]) err('event-system-unknown', p + '.' + k, 'refers to unknown system ' + q(e[k]), 'use an id from systems[]');
      });
      if (VISIBILITY.indexOf(e.visibility) < 0) err('event-visibility-invalid', p + '.visibility', (e.visibility === undefined ? 'is missing' : 'is ' + q(e.visibility)) + ', not one of ' + VISIBILITY.join(', '), 'set visibility to ' + VISIBILITY.join(', ') + ' (pick one)');
      if (ACTORS.indexOf(e.actor) < 0) err('event-actor-invalid', p + '.actor', (e.actor === undefined ? 'is missing' : 'is ' + q(e.actor)) + ', not one of ' + ACTORS.join(', '), 'set actor to ' + ACTORS.join(', ') + ' (pick one)');
      if (e.t !== undefined && typeof e.t !== 'number') err('event-time-invalid', p + '.t', 'is not a number', 'use seconds from the first event');
      checkSource(p, e);
    });

    // pattern blocks: validated only for source (a custom story: every extra top-level array of records)
    var blocks = PATTERN_BLOCKS.slice();
    if (custom) Object.keys(story).forEach(function (k) {
      if (k.charAt(0) !== '_' && CORE_ARRAYS.indexOf(k) < 0 && blocks.indexOf(k) < 0 && Array.isArray(story[k])) blocks.push(k);
    });
    blocks.forEach(function (k) {
      if (Array.isArray(story[k])) story[k].forEach(function (r, i) {
        if (isObj(r)) checkSource(k + '[' + i + ']', r);
      });
    });

    // steps
    list(story.steps).forEach(function (s, i) {
      if (!isObj(s)) { err('step-not-object', 'steps[' + i + ']', 'is not an object', 'make it a step object'); return; }
      var p = 'steps[' + i + ']';
      if (!str(s.title)) err('step-title-missing', p + '.title', 'is missing', 'give the step a title of ' + MAX_TITLE + ' words or fewer');
      else if (wc(s.title) > MAX_TITLE) err('title-too-long', p + '.title', 'has ' + wc(s.title) + ' words (limit ' + MAX_TITLE + ')', 'shorten the title to ' + MAX_TITLE + ' words or fewer');
      if (!str(s.body)) err('step-body-missing', p + '.body', 'is missing', 'write a body of ' + MAX_BODY + ' words or fewer');
      else if (wc(s.body) > MAX_BODY) err('body-too-long', p + '.body', 'has ' + wc(s.body) + ' words (limit ' + MAX_BODY + ')', 'cut the body to ' + MAX_BODY + ' words or fewer and move the rest to detail');
      var lit = s._literal === true;
      textWarn(p + '.title', s.title, { cap: CAPS.title, what: 'title', first: true, lit: lit });
      textWarn(p + '.body', s.body, { cap: CAPS.body, what: 'body', first: true, lit: lit });
      if (s.phase !== undefined && !phaseIds[s.phase]) err('step-phase-unknown', p + '.phase', 'refers to unknown phase ' + q(s.phase), 'use an id from phases[]');
      if (s.touch !== undefined && !Array.isArray(s.touch)) err('step-touch-not-array', p + '.touch', 'is not an array', 'make touch a list of system ids');
      list(s.touch).forEach(function (id, k) {
        if (!systemIds[id]) err('touch-unknown-id', p + '.touch[' + k + ']', 'refers to unknown system ' + q(id), 'use an id from systems[]');
      });
      if (s.uses !== undefined && !Array.isArray(s.uses)) err('step-uses-not-array', p + '.uses', 'is not an array', 'make uses a list of [from, to] pairs');
      list(s.uses).forEach(function (pair, k) {
        pairProblem('uses-not-link', p + '.uses[' + k + ']', pair, 'fix the pair');
      });
      // frame
      if (s.frame !== undefined && s.frame !== 'full') {
        if (!isObj(s.frame) || !Array.isArray(s.frame.hold)) {
          err('frame-invalid', p + '.frame', 'is not "full" or {"hold": [ids]}', 'write "full" or {"hold": ["id", ...], "grow": "down"}');
        } else {
          s.frame.hold.forEach(function (id, k) {
            if (!holdable(id)) err('frame-hold-unknown', p + '.frame.hold[' + k + ']', 'refers to unknown zone or system ' + q(id), 'use an id from zones[] or systems[]');
          });
          if (s.frame.zoom !== undefined && !(typeof s.frame.zoom === 'number' && s.frame.zoom > 0)) err('frame-zoom-invalid', p + '.frame.zoom', 'is not a positive number', 'write the stage px per ground unit, e.g. 2, or remove it (close-ups are capped at 1.3 without it)');
          if (style === 'iso' && s.frame.grow !== undefined) warn('frame-grow-unsupported-iso', p + '.frame.grow', 'is not supported in iso and is ignored', 'remove grow or build with --style flat');
        }
      }
      // callouts
      if (s.callouts !== undefined) {
        if (!Array.isArray(s.callouts)) err('callouts-not-array', p + '.callouts', 'is not an array', 'make callouts a list of {"target", "text"}');
        else {
          if (s.callouts.length > MAX_CALLOUTS) err('callouts-too-many', p + '.callouts', 'has ' + s.callouts.length + ' entries (limit ' + MAX_CALLOUTS + ')', 'keep at most ' + MAX_CALLOUTS + ' callouts per step');
          s.callouts.forEach(function (c, k) {
            var cp = p + '.callouts[' + k + ']';
            if (!isObj(c)) { err('callout-not-object', cp, 'is not an object', 'make it {"target": id, "text": "..."}'); return; }
            if (!holdable(c.target)) err('callout-target-unknown', cp + '.target', c.target === undefined ? 'is missing' : 'refers to unknown zone or system ' + q(c.target), 'use an id from zones[] or systems[]');
            if (!str(c.text)) err('callout-text-missing', cp + '.text', 'is missing', 'write callout text of ' + MAX_CALLOUT + ' words or fewer');
            else if (wc(c.text) > MAX_CALLOUT) err('callout-text-too-long', cp + '.text', 'has ' + wc(c.text) + ' words (limit ' + MAX_CALLOUT + ')', 'shorten it to ' + MAX_CALLOUT + ' words or fewer');
            textWarn(cp + '.text', c.text, { cap: CAPS.callout, what: 'callout', lit: lit || c._literal === true });
          });
        }
      }
      checkSource(p, s);
      // beats
      if (s.beats !== undefined) {
        if (!Array.isArray(s.beats)) { err('beats-not-array', p + '.beats', 'is not an array', 'make beats a list of beat objects'); return; }
        var cards = 0;
        s.beats.forEach(function (b, k) {
          var bp = p + '.beats[' + k + ']';
          if (!isObj(b)) { err('beat-not-object', bp, 'is not an object', 'make it an object with one beat kind: ' + BEAT_KINDS.join(', ')); return; }
          var kinds = BEAT_KINDS.filter(function (n) { return b[n] !== undefined; });
          if (kinds.length === 0) { err('beat-no-kind', bp, 'has no known beat kind', 'use one of ' + BEAT_KINDS.join(', ') + ' as a key'); return; }
          var kind = kinds[0], v = b[kind];
          if (kind !== 'custom') {
            var allowed = [kind].concat(BEAT_FIELDS[kind], BEAT_COMMON);
            if (kind === 'card') allowed.push('at');
            Object.keys(b).forEach(function (key) {
              if (key.charAt(0) === '_' || allowed.indexOf(key) >= 0) return;
              err('beat-unknown-key', bp + '.' + key, 'is not a field of a ' + kind + ' beat', 'remove it; a ' + kind + ' beat takes ' + allowed.join(', '));
            });
          }
          if (kind !== 'card' && b.at !== undefined && typeof b.at !== 'number') err('beat-at-invalid', bp + '.at', 'is not a number', 'give at as seconds after the step\'s motion start');
          function sys(path, id) { if (!systemIds[id]) err('beat-system-unknown', path, 'refers to unknown system ' + q(id), 'use an id from systems[]'); return !!systemIds[id]; }
          function pair(rule, path, a, c) { if (sys(path + '[0]', a) & sys(path + '[1]', c) && !isLink(a, c)) err(rule, path, '[' + a + ', ' + c + '] is not a link', 'add the link to links[] or pick a linked pair'); }
          if (kind === 'chain') {
            if (!Array.isArray(v) || v.length < 2) err('chain-too-short', bp + '.chain', 'needs a list of at least 2 system ids', 'write "chain": ["from-id", "next-id", ...]');
            else for (var j = 0; j + 1 < v.length; j++) pair('chain-not-link', bp + '.chain[' + j + ']', v[j], v[j + 1]);
          } else if (kind === 'exchange') {
            if (!Array.isArray(v) || v.length !== 2) err('exchange-malformed', bp + '.exchange', 'needs exactly [from, to]', 'write "exchange": ["from-id", "to-id"]');
            else pair('exchange-not-link', bp + '.exchange', v[0], v[1]);
          } else if (kind === 'stream') {
            if (!Array.isArray(v) || v.length < 2) err('stream-too-short', bp + '.stream', 'needs a path of at least 2 system ids', 'write "stream": ["from-id", "next-id", ...]');
            else for (var jj = 0; jj + 1 < v.length; jj++) pair('stream-not-link', bp + '.stream[' + jj + ']', v[jj], v[jj + 1]);
            if (Array.isArray(b.items) && b.items.length > MAX_ITEMS) err('stream-too-many-items', bp + '.items', 'has ' + b.items.length + ' items (limit ' + MAX_ITEMS + ')', 'keep at most ' + MAX_ITEMS + ' items');
            if (b.glyph !== undefined && GLYPHS.indexOf(b.glyph) < 0) err('stream-glyph-invalid', bp + '.glyph', 'is not a packet glyph', 'use one of ' + GLYPHS.join(', ') + ' (default dot)');
          } else if (kind === 'card') {
            cards++;
            if (!str(v)) err('card-id-invalid', bp + '.card', 'is not a card id', 'give the card an id string');
            if (!systemIds[b.at]) err('card-at-unknown', bp + '.at', b.at === undefined ? 'is missing' : 'refers to unknown system ' + q(b.at), 'set at to an id from systems[]');
          } else if (kind === 'mark') {
            sys(bp + '.mark', v);
          } else if (kind === 'pulse') {
            sys(bp + '.pulse', v);
          } else if (kind === 'camera') {
            if (style === 'iso') warn('camera-beat-iso', bp + '.camera', 'is not supported with --style iso and is skipped', 'remove the camera beat or build with --style flat');
            if (v === 'step' || v === 'full') { /* ok */ }
            else if (isObj(v) && Array.isArray(v.hold)) {
              if (v.zoom !== undefined && !(typeof v.zoom === 'number' && v.zoom > 0)) err('camera-zoom-invalid', bp + '.camera.zoom', 'is not a positive number', 'write the stage px per ground unit, e.g. 2, or remove it (close-ups are capped at 1.3 without it)');
              v.hold.forEach(function (id, n) { if (!holdable(id)) err('camera-hold-unknown', bp + '.camera.hold[' + n + ']', 'refers to unknown zone or system ' + q(id), 'use an id from zones[] or systems[]'); });
            } else err('camera-invalid', bp + '.camera', 'is not "step", "full" or {"hold": [ids]}', 'write "step", "full" or {"hold": ["id", ...]}');
          } else if (kind === 'shields') {
            if (v === 'controls') { /* all */ }
            else if (Array.isArray(v)) v.forEach(function (id, n) { if (!controlIds[id]) err('shields-control-unknown', bp + '.shields[' + n + ']', 'refers to unknown control ' + q(id), 'use an id from controls[]'); });
            else err('shields-invalid', bp + '.shields', 'is not "controls" or a list of control ids', 'write "controls" or ["control-id", ...]');
          } else if (kind === 'custom') {
            if (!str(v)) err('custom-name-invalid', bp + '.custom', 'is not a kind name', 'name the custom beat kind registered in EXK.extra.beats');
          }
          // fields that name systems in any beat
          if (b.mark !== undefined && kind !== 'mark') sys(bp + '.mark', b.mark);
          if (b.sayAt !== undefined && b.sayAt !== 'dest') sys(bp + '.sayAt', b.sayAt);
          var bl = lit || b._literal === true, mono = b.mono === true;
          if (kind === 'chain' || kind === 'stream') textWarn(bp + '.says', b.says, { cap: CAPS.says, what: 'says', lit: bl, mono: mono });
          if (kind === 'exchange') { textWarn(bp + '.req', b.req, { cap: CAPS.req, what: 'req', lit: bl, mono: mono }); textWarn(bp + '.resp', b.resp, { cap: CAPS.resp, what: 'resp', lit: bl, mono: mono }); textWarn(bp + '.respTag', b.respTag, { cap: CAPS.tag, what: 'tag', lit: bl }); }
          if (kind === 'card') { textWarn(bp + '.title', b.title, { cap: CAPS.cardTitle, what: 'card title', lit: bl, mono: mono }); textWarn(bp + '.rows', b.rows, { cap: CAPS.row, what: 'card row', lit: bl, mono: mono }); }
          if (kind === 'stream') textWarn(bp + '.tally', b.tally, { cap: CAPS.tally, what: 'tally', lit: bl });
          if (b.tag !== undefined) textWarn(bp + '.tag', b.tag, { cap: CAPS.tag, what: 'tag', lit: bl });
          if (b.tag !== undefined && wc(b.tag) > 2) err('beat-tag-too-long', bp + '.tag', 'has ' + wc(b.tag) + ' words (limit 2)', 'move the text to says and keep the tag to 1-2 words');
        });
        if (style === 'iso' && cards > 1) warn('card-beats-iso-skipped', p + '.beats', 'has ' + cards + ' card beats; iso shows the first and skips the rest', 'keep one card or build with --style flat');
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
