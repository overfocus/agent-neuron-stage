// One voice at a table. A character reads what reached its neuron, asks the
// cheap model for a line and a face, and answers the two fields the stage
// draws. Seven characters, seven files that name themselves here.
//
// The model is GLM through the ollama daemon this machine is signed in to
// (`glm-5.3-flash:cloud`), so the conversation costs a cloud flash call and
// nothing else. `think: false` matters: with thinking on, the model spends the
// token budget reasoning and answers with an empty string.
//
// The engine hands a program its input on stdin and nothing else: no neuron id,
// no cast, no stage. So "who am I" is which file the network runs.
const ENDPOINT = 'http://127.0.0.1:11434/api/chat';
const MODEL = process.env.RIEMANN_MODEL || 'glm-5.3-flash:cloud';
const DEADLINE = 18000;

const SETTING =
  'You are at a dinner table with six other mathematicians, arguing about the Riemann hypothesis. ' +
  'Answer the last line you are given in ONE sentence, at most 16 words (under 110 characters). Stay in character. ' +
  'No quotation marks, no emoji, no stage directions, no lists. A claim about who proved what must be true; never invent a year, and leave a date out when unsure. If you quote how many zeros are verified, say ten trillion.';

/** Each character: the voice, the poses it may wear, the hand that draws it. */
const VOICES = {
  ada: {
    skin: 'sketch',
    step: { dx: -0.1, dz: 0.3 },
    poses: ['thinking', 'dunno', 'deal'],
    signature: 'thinking',
    temperature: 0.55,
    system:
      'You are Ada, an analytic number theorist. Precision is a moral position to you: you separate what is ' +
      'known from what is wanted, and you will not let "probably" stand where a proof is owed. Your sentences ' +
      'are short and declarative, and you correct the loose word in the line before you answer it.'
  },
  rosa: {
    skin: 'pixel',
    step: { dx: -0.45, dz: 0.15 },
    poses: ['deal', 'thinking', 'pleased'],
    signature: 'deal',
    temperature: 0.5,
    system:
      'You are Rosa, a computational number theorist. You trust counts and bounds and nothing else: you quote ' +
      'how many zeros have been checked, and you are bored by philosophy when a run could settle it.'
  },
  bruno: {
    skin: 'riso',
    step: { dx: -0.5, dz: -0.15 },
    poses: ['feel-happy', 'pleased', 'feel-surprised'],
    signature: 'feel-happy',
    temperature: 0.9,
    system:
      'You are Bruno, a romantic who loves the zeros more than the proofs. You hear them as a chord, you speak ' +
      'in images, and you overclaim cheerfully. You say "listen" before your point and you are never ' +
      'embarrassed by enthusiasm.'
  },
  iris: {
    skin: 'inkpunch',
    step: { dx: -0.35, dz: -0.3 },
    poses: ['letter', 'thinking', 'at-ease'],
    signature: 'letter',
    temperature: 0.6,
    system:
      'You are Iris, a historian of mathematics. You date every claim - 1859, Hardy and Littlewood, Turing - ' +
      'and you enjoy correcting the record. You speak in a slightly formal register and always anchor the ' +
      'argument in who proved what.'
  },
  otto: {
    skin: 'manga',
    step: { dx: 0.3, dz: -0.25 },
    poses: ['feel-surprised', 'thinking', 'deal'],
    signature: 'feel-surprised',
    temperature: 0.8,
    system:
      'You are Otto, a physicist who wandered into number theory. You see random matrices, spectra and ' +
      'quantum chaos in the zeros, and you reach for analogy before proof - while admitting an analogy is ' +
      'not a proof.'
  },
  lea: {
    skin: 'felttip',
    step: { dx: 0.4, dz: 0.1 },
    poses: ['dunno', 'eyes-suspicious', 'thinking'],
    signature: 'dunno',
    temperature: 0.55,
    system:
      'You are Lea, a formalist. You ask what "true" is supposed to mean here, you mention independence and ' +
      'models, and you are dry about it. You are not troubled that nobody has proved it; you are troubled by ' +
      'the question being asked badly.'
  },
  jules: {
    skin: 'stencil',
    step: { dx: 0.55, dz: -0.2 },
    poses: ['shrug', 'fedup', 'dunno'],
    signature: 'shrug',
    temperature: 0.75,
    system:
      'You are Jules, the outsider at the table: not a number theorist and unembarrassed about it. You ask ' +
      'what the hypothesis pays for, what breaks if it fails, and why anyone outside this room should care. ' +
      'Plain words, a little impatient.'
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

/** The words in whatever reached us: the cue line, or another character's answer. */
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

/** A line fit for a bubble: one sentence, no quotes, no name tag. */
function clean(text, name) {
  if (typeof text !== 'string') return '';
  let s = text.replace(/\s+/g, ' ').trim();
  s = s.replace(new RegExp(`^${name}\\s*[:—-]\\s*`, 'i'), '');
  s = s.replace(/^["'“”]+|["'“”]+$/g, '').trim();
  return s.length > 200 ? s.slice(0, 199).trimEnd() + '…' : s;
}

/** The model's answer as JSON, whether or not it wrapped it in a fence. */
function asJson(text) {
  if (typeof text !== 'string') return null;
  const bare = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(bare);
  } catch {
    const start = bare.indexOf('{');
    const end = bare.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(bare.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function call(body) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEADLINE)
  });
  if (!response.ok) throw new Error(`the model answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  return data?.message?.content ?? '';
}

/** Be this character: read what reached us, and answer with a line and a face. */
export async function speak(who) {
  const voice = VOICES[who];
  if (!voice) throw new Error(`no voice for ${who}`);
  const wrapped = await read();
  const inputs = Array.isArray(wrapped?.inputs) ? wrapped.inputs : [wrapped];
  const heard = inputs.map(lineOf).find(Boolean) ?? '';
  const system = `${voice.system}\n${SETTING}\nReply with JSON only: {"say": "...", "pose": "..."} where pose is exactly one of: ${voice.poses.join(', ')}.`;
  const user = heard
    ? `The last line at the table: "${heard}"\nAnswer it as ${who}.`
    : `Open the conversation as ${who}.`;
  const body = {
    model: MODEL,
    stream: false,
    think: false,
    format: 'json',
    options: { temperature: voice.temperature, num_predict: 120 },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  let content;
  try {
    content = await call(body);
  } catch (first) {
    // One retry: a cloud call can drop, and a table should not lose its turn.
    try {
      content = await call(body);
    } catch (second) {
      throw new Error(`${who} could not speak: ${second.message} (first: ${first.message})`);
    }
  }
  const answer = asJson(content);
  const say = clean(answer?.say, who);
  if (!say) throw new Error(`${who} got no line back: ${String(content).slice(0, 200)}`);
  const pose = voice.poses.includes(answer?.pose) ? answer.pose : voice.signature;
  const reply = { say, pose, skin: voice.skin };
  // the step is the character's, not the model's: a fixed half-pace in, never a
  // number the model chose
  if (voice.step) reply.move = { ...voice.step, over: 1.5 };
  return reply;
}
