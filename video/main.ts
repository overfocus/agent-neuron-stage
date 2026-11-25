// The demo take for the portfolio: two shows, one frame at a time.
//
// A frame is a step, not a seek: the host ticks one fixed 1/60 s, so the
// stage's springs, the camera's ease and the conductor's clock behave exactly
// as they do in the app. That keeps the take alive AND repeatable: Math.random
// is pinned in composition.html before any module loads, and render.py renders
// frames in order.
//
// renderFrame(t) is called with t = frame / fps, in order. The timeline below is
// in video seconds.
import '../src/stage.css';
import duetTrace from '../src/traces/duet.json';
import { compileTrace } from '../src/fromtrace.ts';
import { parseShow } from '../src/fromscore.ts';
import { formatScore, type Show } from '../src/show.ts';
import { ShowHost } from '../src/host.ts';
import { Bubbles } from '../src/bubbles.ts';
import { parseTrace } from '../src/trace.ts';
import writerScene from '../examples/writer/scene.score?raw';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const layer = document.querySelector<HTMLElement>('#bubbles')!;
const stamp = document.querySelector<HTMLElement>('#stamp')!;
const label = document.querySelector<HTMLElement>('#label')!;
const text = document.querySelector<HTMLElement>('#text')!;
const inset = document.querySelector<HTMLElement>('#inset')!;
const insetCode = document.querySelector<HTMLElement>('#inset-code')!;
const card = document.querySelector<HTMLElement>('#card')!;

const duet = compileTrace(parseTrace(duetTrace), { title: 'duet' });
const writer = parseShow(writerScene, { note: 'the answer of examples/writer' });

// ── the timeline, in video seconds ────────────────────────────────────────
interface Segment {
  from: number;
  show: Show;
  speed: number;
  stamp: string;
}
const SEGMENTS: Segment[] = [
  { from: 0, show: duet, speed: 0.7, stamp: 'duet · examples/duet · a real run' },
  { from: 12.1, show: writer, speed: 1, stamp: 'writer · examples/writer · a run answered' }
];

interface Beat {
  from: number;
  label: string;
  text: string;
}
const BEATS: Beat[] = [
  { from: 0, label: 'trace → score', text: 'A network is a cast. A run is a performance.' },
  { from: 3.4, label: 'a signal', text: 'A signal is who looks at whom. The cue speaks, and both characters turn to hear it.' },
  { from: 4.5, label: 'an answer', text: 'An answer is a line, and the face to say it with — the payload carries both.' },
  { from: 6.4, label: 'the end of an argument', text: '<em>maxHops</em> refuses the ninth line: the engine ends the scene, not a script.' },
  { from: 7.5, label: 'the second cue', text: 'Both hear it at once, and each answers from what it heard and how that felt.' },
  { from: 9.2, label: 'the compiled score', text: 'Every event became a beat: a look, a pose, a line, a refusal.' },
  { from: 12.1, label: 'a run that answers', text: 'A program can answer with a whole scene — two characters who were not there before.' },
  { from: 15.8, label: 'the cue, in the answer', text: 'Their answer is a maxcot score: blocking, lines, poses, a skin.' },
  { from: 19.4, label: 'the stage', text: 'The stage plays it without knowing a network wrote it.' },
  { from: 22.6, label: 'agent-neuron-stage', text: 'A network is a cast. A run is a performance.' }
];

const bubble = new Bubbles(layer, canvas);
const host = new ShowHost(canvas, SEGMENTS[0]!.show, {
  onLine(who, line) {
    if (!line || !who) bubble.clear();
    else bubble.say(who, line);
  },
  onCard(title) {
    card.hidden = !title;
    card.innerHTML = title ? `${escapeHtml(title)}<small>a scene a network wrote</small>` : '';
  }
});
host.speed = SEGMENTS[0]!.speed;
stamp.textContent = SEGMENTS[0]!.stamp;

let segment = 0;
let frame = -1;
const DT = 1 / 60;

function segmentAt(t: number): number {
  let found = 0;
  for (let i = 0; i < SEGMENTS.length; i++) if (t >= SEGMENTS[i]!.from) found = i;
  return found;
}

function paintOverlays(t: number): void {
  let beat = BEATS[0]!;
  for (const b of BEATS) if (t >= b.from) beat = b;
  if (label.textContent !== beat.label) label.textContent = beat.label;
  if (text.dataset.i !== String(BEATS.indexOf(beat))) {
    text.innerHTML = beat.text;
    text.dataset.i = String(BEATS.indexOf(beat));
  }
  const showScore = t >= 9.2 && t < 12.1;
  inset.hidden = !showScore;
  if (showScore && !insetCode.textContent) {
    insetCode.textContent = formatScore(SEGMENTS[0]!.show)
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('//'))
      .slice(0, 30)
      .join('\n');
  }
}

/** One frame: step the clock, then draw what the app would show. */
function renderFrame(t: number): void {
  const i = Math.round(t * 60);
  if (i !== frame + 1) throw new Error(`frames must be rendered in order (got ${i} after ${frame})`);
  frame = i;

  const next = segmentAt(t);
  if (next !== segment) {
    segment = next;
    host.load(SEGMENTS[segment]!.show);
    host.speed = SEGMENTS[segment]!.speed;
    stamp.textContent = SEGMENTS[segment]!.stamp;
    host.seek(0);
    bubble.clear();
    card.hidden = true;
    insetCode.textContent = '';
  }

  host.tick(DT);
  if (bubble.speaker) bubble.place(host.headOf(bubble.speaker));
  paintOverlays(t);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

declare global {
  interface Window {
    renderFrame: (t: number) => void;
    READY: boolean;
    VIDEO_SECONDS: number;
    FPS: number;
  }
}

window.renderFrame = renderFrame;
window.FPS = 60;
window.VIDEO_SECONDS = 25.6;
window.READY = true;
