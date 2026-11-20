// Unit tests for scene/timing.js: the numbers of references/rules.md (pacing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './lib/load-kit.mjs';

const T = loadKit().timing;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('timing.js is pure and loads under vm', () => {
  assert.equal(typeof T.hopDuration, 'function');
  assert.equal(T.SPEED_CEILING, 320);
  assert.ok(T.SPEED_CAP < T.SPEED_CEILING);
});

test('hop duration: at least 1.6 s, from the on-screen length at the peak speed', () => {
  assert.equal(T.hopDuration(0), 1.6);
  assert.equal(T.hopDuration(100), 1.6);
  assert.equal(T.hopDuration(320), 1.6);          // the rule's own example: 320 px is a 1 s hop, floored at 1.6 s
  near(T.hopDuration(600), 600 / (1 - 0.15) / 315);   // 2.2409 s
  near(T.hopDuration(960), 960 / (1 - 0.15) / 315);   // 3.5854 s
  assert.equal(T.hopDuration(10, 2.4), 2.4);          // a caller's own minimum
});

test('the speed cap holds at every instant of a hop, whatever the length', () => {
  for (const len of [50, 320, 480, 777, 1200, 2400]) {
    const d = T.hopDuration(len);
    let peak = 0, prev = 0;
    for (let i = 1; i <= 2000; i++) {
      const p = T.PACKET_EASE(i / 2000);
      peak = Math.max(peak, (p - prev) * len / (d / 2000));
      prev = p;
    }
    assert.ok(peak <= T.SPEED_CEILING, `len ${len}: peak ${peak.toFixed(1)}`);
  }
  near(T.PACKET_EASE(0), 0); near(T.PACKET_EASE(1), 1); near(T.PACKET_EASE(0.5), 0.5);
  near(T.PACKET_EASE(T.invPacketEase(0.3)), 0.3, 1e-9);
});

test('label hold: max(2.5 s, words x 0.4 s); the last label of a step max(1.4 s, words x 0.35 s)', () => {
  assert.equal(T.holdFor('s3:ListBuckets'), 2.5);
  assert.equal(T.holdFor('one two three four five six'), 2.5);            // 6 x 0.4 = 2.4
  near(T.holdFor('one two three four five six seven eight'), 3.2);        // 8 x 0.4
  assert.equal(T.lastHoldFor('s3:ListBuckets'), 1.4);
  near(T.lastHoldFor('a b c d e f g h'), 2.8);                            // 8 x 0.35
  assert.equal(T.lastHoldFor('a b c'), 1.4);                              // 1.05 floors at 1.4
  assert.equal(T.holdFor('two\nlines here'), 2.5);                        // newlines count as spaces
});

test('card hold: max(2.5 s, words x 0.35 s) after it appears', () => {
  assert.equal(T.cardHold('role: node-role'), 2.5);
  near(T.cardHold('a b c d e f g h i j k l'), 4.2);                       // 12 x 0.35
});

test('motion starts 1.0 s into a step, 1.8 s after a camera move; the body follows the first motion by 0.8 s', () => {
  assert.equal(T.motionStart(false), 1.0);
  assert.equal(T.motionStart(true), 1.8);
  near(T.bodyAt(1.0, 9), 1.8);
  near(T.bodyAt(5, 3), 3.8);                                              // a step that ends before its motion would start
});

test('step end: the latest of motion end + 1.0, last label hold end + 0.3, body shown + words / 3.5', () => {
  // motion-bound: end 8 s, no label, a short body
  near(T.stepEnd({ end: 8, labelEnd: 0, firstMotion: 1, bodyWords: 10 }), 9.0);
  // label-bound: labelEnd includes the label's 0.35 s fade, so the rule uses labelEnd - 0.35 + 0.3
  near(T.stepEnd({ end: 8, labelEnd: 11, firstMotion: 1, bodyWords: 10 }), 10.95);
  // body-bound: 28 words at 3.5 words/s = 8 s after the body is shown (1.8 + 0.7)
  near(T.stepEnd({ end: 3, labelEnd: 4, firstMotion: 1, bodyWords: 28 }), 1.8 + 0.7 + 8);
  // the final step ends 3 s after its last motion
  near(T.stepEnd({ end: 8, labelEnd: 9, firstMotion: 1, bodyWords: 10, final: true }), 11.0);
  assert.equal(T.stepEnd({ end: 20, labelEnd: 5, firstMotion: 1, bodyWords: 5, final: true }), 23);
});

test('rest: after the motion and the body, before anything starts to fade', () => {
  const o = { end: 8, labelEnd: 11, firstMotion: 1, bodyWords: 10 };
  const len = T.stepEnd(o);                                               // 10.95
  const rest = T.restOf({ len, end: o.end, labelEnd: o.labelEnd, firstMotion: o.firstMotion });
  near(rest, len - T.REST_MARGIN);                                        // 10.4: the chrome starts to fade at len - 0.5, before the label (10.6)
  near(T.restOf({ len: 14, end: 8, labelEnd: 11, firstMotion: 1 }), 11 - 0.35 - 0.05);   // label-bound: just before the last label fades
  assert.ok(rest >= o.end && rest <= len - T.REST_MARGIN);
  // no labels: bounded by the chrome fade-out instead
  const len2 = T.stepEnd({ end: 8, firstMotion: 1, bodyWords: 10 });
  const rest2 = T.restOf({ len: len2, end: 8, firstMotion: 1 });
  near(rest2, len2 - T.REST_MARGIN);
  assert.ok(rest2 >= 8);
  // always at or after the motion end, even when a label would have faded first
  assert.ok(T.restOf({ len: 12, end: 9, labelEnd: 6, firstMotion: 1 }) >= 9);
});

test('emphasis and pacing constants are named once', () => {
  assert.equal(T.DIM_TEXT, 0.45); assert.equal(T.DIM_DUR, 0.4);
  assert.equal(T.STREAM_MAX, 4); assert.equal(T.STREAM_GAP, 0.9); assert.equal(T.PARALLEL_GAP, 1.5);
  assert.equal(T.CAMERA_MIN, 1.2); assert.equal(T.FINAL_HOLD, 3.0); assert.equal(T.BODY_WPS, 3.5);
});
