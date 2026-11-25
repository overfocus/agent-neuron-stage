// One table, six characters: each character's file is three lines that name it
// here (mind/ann.mjs, mind/bo.mjs, ...). The engine gives a program no identity
// of its own - the payload is just the cue line or another character's answer -
// so who a program is, is which file the network runs.
//
// A character answers { say, pose, skin, look } - the line, the face, and the
// hand that draws it. The stage has no opinion about any of the four: it draws
// what it is given (src/fromtrace.ts reads the cue, src/host.ts paints a cast in
// more than one skin).
//
// The table stands in for a model. A model neuron would answer the same fields,
// and the stage would draw it the same way.

const ME = {
  ann: {
    skin: 'riso',
    pose: 'feel-happy',
    word: 'pink',
    claim: 'Pink first. Then blue, if there is time.',
    retort: 'Pink is not a colour, it is a decision.'
  },
  bo: {
    skin: 'manga',
    pose: 'feel-angry',
    word: 'screentone',
    claim: 'Screentone and speed lines. That is a picture.',
    retort: 'Screentone is a thousand greys. Try it.'
  },
  cy: {
    skin: 'inkpunch',
    pose: 'thinking',
    word: 'black',
    claim: 'One bottle of black ink. It has never failed me.',
    retort: 'Black is the only colour that is honest.'
  },
  di: {
    skin: 'gigposter',
    pose: 'feel-proud',
    word: 'burst',
    claim: 'Three spot inks and a burst behind the lot of you.',
    retort: 'A burst is an argument, and I win it.'
  },
  ed: {
    skin: 'neon',
    pose: 'feel-surprised',
    word: 'light',
    claim: 'Light. No paper, no ink, no arguing.',
    retort: 'You cannot print light. That is the point of it.'
  },
  fay: {
    skin: 'sketch',
    pose: 'at-ease',
    word: 'pencil',
    claim: 'A soft pencil, and I am not arguing with anyone.',
    retort: 'Then let the pencil settle it.'
  }
};

/** The one JSON value the engine writes on stdin. */
function read() {
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (raw += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(raw.trim() ? JSON.parse(raw) : null);
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on('error', reject);
  });
}

/** The words in whatever reached us: a cue line, or another character's answer. */
function lineOf(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const o = value;
  if (typeof o.say === 'string') return o.say;
  if (typeof o.payload === 'string') return o.payload;
  if (typeof o.heard === 'string') return o.heard;
  if (Array.isArray(o.inputs)) return o.inputs.map(lineOf).filter(Boolean).join(' ');
  return '';
}

/** Be this character: read what reached us, answer with a line, a face and a hand. */
export async function tell(who) {
  const wrapped = await read();
  const inputs = Array.isArray(wrapped?.inputs) ? wrapped.inputs : [wrapped];
  const heard = inputs.map(lineOf).find(Boolean) ?? '';
  const mine = ME[who] ?? ME.ann;
  const lower = heard.toLowerCase();

  // A character opens with its claim; it retorts when the thing it cares about
  // has just been said, which is how the ring turns into an argument.
  const said = mine.word && lower.includes(mine.word) && heard !== mine.claim ? mine.retort : mine.claim;
  return { say: said, pose: mine.pose, skin: mine.skin };
}
