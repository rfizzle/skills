// One place where the four check scripts collect findings and print them.
//
//   const rep = createReport({ check: 'check-story', path: file, json: args.includes('--json') });
//   rep.add({ rule, severity, step?, record?, path?, message, fix?, human?, stream? })
//   rep.say(text, stream?)      human-only line (a note, a heading, a pass line); dropped under --json
//   rep.exit(code)              prints the JSON array (with --json) and exits
//
// Human mode: `human` is printed at once to `stream` ('out' = stdout, the default; 'err' = stderr), so the
// output stays exactly what each script printed before the flag existed. A finding with no `human` text
// prints nothing in human mode. `defer: true` holds the human lines until exit() (check-replay).
// JSON mode: stdout is one array of findings and nothing else, in the order they were added:
//   { check, rule, severity: 'error'|'warning'|'info', step?, record?, path?, message, fix }
// A consumer filtering on severity "error" gets an empty result exactly when the exit code is 0.
export const SEVERITIES = ['error', 'warning', 'info'];

export function createReport({ check, path, json = false, defer = false }) {
  const findings = [];
  const held = [];
  const emit = (text, stream) => {
    if (defer) held.push([text, stream]);
    else if (stream === 'err') console.error(text);
    else console.log(text);
  };
  return {
    json,
    findings,
    add(f) {
      if (!SEVERITIES.includes(f.severity)) throw new Error(`unknown severity ${f.severity}`);
      const o = { check, rule: f.rule, severity: f.severity };
      if (f.step !== undefined) o.step = f.step;
      if (f.record !== undefined) o.record = f.record;
      const p = f.path !== undefined ? f.path : path;
      if (p !== undefined) o.path = p;
      o.message = f.message;
      o.fix = f.fix || '';
      findings.push(o);
      if (!json && f.human != null) emit(f.human, f.stream);
      return o;
    },
    say(text, stream) { if (!json) emit(text, stream); },
    errors() { return findings.filter((f) => f.severity === 'error').length; },
    exit(code) {
      if (json) process.stdout.write(JSON.stringify(findings, null, 2) + '\n');
      else for (const [text, stream] of held) (stream === 'err' ? console.error : console.log)(text);
      process.exit(code);
    }
  };
}

// 'steps[3].title' -> 'steps[3]'; 'meta.title' -> 'meta'; 'story' -> 'story'
export function recordOf(p) {
  const m = /^([A-Za-z_]+(?:\[\d+\])?)/.exec(p);
  return m ? m[1] : p;
}
