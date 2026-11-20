// Build-time view of the replay: what the page's automatic graph layout could not do cleanly, and why a story
// cannot be replayed at all. Runs the same pure kit code the page runs, in Node.
import { loadKit } from './load-kit.mjs';

// -> { refusal: string|null, warnings: string[] } for a validated, normalized story
export function replayChecks(story) {
  if (!Array.isArray(story.events) || !story.events.length) {
    return { refusal: 'this story has no events, so there is nothing to replay (the replay is built from events[]; see references/story.md, "events"). Build a film instead, or add events.', warnings: [] };
  }
  const EXK = loadKit({ bundle: 'replay' });
  const D = EXK.replay.derive(story);
  const G = EXK.replay.layoutGraph(story, D);
  const warnings = [...G.warnings];
  for (const c of D.unplaced) warnings.push(`control "${c.id}" is not on the event log: ${c.reason}; its card says so`);
  return { refusal: null, warnings };
}
