/* EXK namespace, small utilities, theme colours (PATTERNS.md section 4), and the P0 boot stub.
   Pure: nothing here touches the DOM at load time. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};

  var SVGNS = 'http://www.w3.org/2000/svg';

  EXK.util = {
    // el('div', {class: 'x'}, parent) / el('svg:rect', {...}); attributes are set with setAttribute
    el: function (tag, attrs, parent) {
      var svg = tag.indexOf('svg:') === 0;
      var node = svg ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
      for (var k in attrs || {}) node.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(node);
      return node;
    },
    txt: function (s) { return document.createTextNode(String(s)); },
    clamp: function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },
    words: function (s) { return String(s == null ? '' : s).trim().split(/\s+/).filter(Boolean); },
    // rough text width in px for layout before fonts load: average glyph 0.56 em
    textW: function (s, size) { return String(s).length * (size || 22) * 0.56; }
  };

  EXK.THEME = {
    bg: '#0b0f17', panel: '#121826', panel2: '#18202f', line: '#2a3447',
    text: '#e6edf7', muted: '#8b98ad',
    accent: '#4cc9f0', danger: '#ff5d6c', token: '#f5b941', identity: '#a78bfa', secure: '#3ddc97'
  };

  EXK.scenes = EXK.scenes || {};
  EXK.extra = EXK.extra || { beats: {} };
  EXK.patterns = EXK.patterns || {};

  // P0 stub: validates and normalizes EXK.STORY, exposes it, marks the stage. Later packages
  // replace this with the shell + painter pipeline (define EXK.boot again in a later file).
  EXK.boot = function () {
    var raw = EXK.STORY;
    var problems = EXK.validate(raw, { style: (EXK.BUILD && EXK.BUILD.style) || null });
    var errors = problems.filter(function (p) { return p.level === 'error'; });
    EXK.problems = problems;
    if (errors.length) {
      errors.forEach(function (p) { console.error(EXK.formatProblem(p)); });
      EXK.story = null;
    } else {
      EXK.story = EXK.normalize(raw);
    }
    if (typeof document !== 'undefined') {
      var stage = document.getElementById('stage');
      if (stage) stage.setAttribute('data-ready', errors.length ? 'invalid' : 'story');
    }
    return EXK.story;
  };
})();
