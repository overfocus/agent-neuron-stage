// The writer: a neuron whose answer is a whole scene.
//
// It reads the brief (who walks in, what they carry) and answers a maxcot score
// document - characters, blocking, lines, a style change, a card. The stage
// reads that answer like any other score, so nothing on the stage knows a
// network wrote it. Deterministic: the same brief is the same scene.
const raw = await new Promise((resolve) => {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (text += chunk));
  process.stdin.on('end', () => resolve(text));
});

const brief = JSON.parse(raw || '{}') ?? {};
const who = String(brief.who ?? 'a stranger');
const about = String(brief.about ?? 'nothing at all');
const title = String(brief.title ?? 'a scene from a brief');

const scene = {
  title,
  bpm: 92,
  tail: 3.2,
  events: [
    // the two who were not there before
    { at: [1, 1], enter: { id: 'her', who: 'girl', x: -1.25 } },
    { at: [1, 2], enter: { id: 'him', who: 'oldman', x: 1.25 } },
    { at: [1, 3], pose: 'at-ease', on: 'her', },
    { at: [1, 3.5], pose: 'thinking', on: 'him' },
    // the question
    { at: [2, 1], shot: 'wide', on: ['her', 'him'] },
    { at: [2, 1], look: 'him', on: 'her' },
    { at: [2, 1], say: `So you are ${who}.`, on: 'her' },
    { at: [2, 2.5], look: 'her', on: 'him' },
    { at: [2, 2.5], pose: 'mouth-smirk', on: 'him' },
    { at: [2, 2.5], say: `I am. And this is ${about}.`, on: 'him' },
    // the turn
    { at: [3, 1], style: 'riso' },
    { at: [3, 1], pose: 'letter', on: 'her' },
    { at: [3, 1], shot: 'full', on: 'her' },
    { at: [3, 1.5], say: 'Then read it.', on: 'her' },
    { at: [4, 1], pose: 'pleased', on: 'him' },
    { at: [4, 1], look: 'her', on: 'him' },
    { at: [4, 1.5], say: 'It says what we already knew.', on: 'him' },
    // and out
    { at: [5, 1], shot: 'wide' },
    { at: [5, 1], look: 'us', on: 'him' },
    { at: [6, 1], end: { card: 'logo', text: title.toUpperCase() } }
  ]
};

process.stdout.write(JSON.stringify(scene));
