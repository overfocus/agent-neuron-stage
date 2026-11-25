// The lab: seven scientists, one question, nobody taking turns.
//
// A character reads the line that reached it, decides whether it wants the
// floor at all (a die, plus the words that always get it going), and if it
// does, asks the cheap model for a line and answers. It also takes a step: the
// step is the character's own, never a number the model chose.
//
// The model is GLM through the ollama daemon this machine is signed in to
// (`glm-5.3-flash:cloud`). `think: false` matters: with thinking on, the model
// spends the token budget reasoning and answers with nothing.
//
// A quiet answer is an empty stdout and exit 0 - that is how the engine is told
// the neuron chose not to act, and a quiet neuron forwards nothing, so the room
// goes quiet where the conversation dies out.
const ENDPOINT = 'http://127.0.0.1:11434/api/chat';
const MODEL = process.env.LAB_MODEL || 'glm-5.3-flash:cloud';
const DEADLINE = 18000;
/** How often a scientist takes the floor when nothing they care about was said. */
const FLOOR = 0.8;

const SETTING =
  'You are in a lab at 2am with six other scientists, arguing about the Riemann hypothesis. ' +
  'Nobody is taking turns: you may interrupt, answer, doubt the last speaker, ask a question, or change ' +
  'the subject to something you care about. One sentence, at most 18 words (under 120 characters). ' +
  'Stay in character. No quotation marks, no emoji, no stage directions, no lists. ' +
  'A claim about who proved what must be true; never invent a year. Vary what you talk about: the zeros, ' +
  'the primes, a paper, a doubt, the machine in front of you. Do not repeat the figure the last speaker used.';

/** Things that happen at 2am, to keep two runs from being the same conversation. */
const MOODS = [
  'You are tired and blunt.',
  'You are pleased with yourself.',
  'You are not really listening to the last speaker.',
  'You are distracted by the instrument you are working on.',
  'You think the last speaker is wrong, and you say so.',
  'You want to change the subject to something you care about.',
  'You are curious about something nobody has mentioned.',
  'You have just remembered a paper that disagrees.',
  'You are trying to be patient and failing.'
];

/**
 * Each character: the voice, the words that always get it talking, the poses it
 * may wear, the hand that draws it, and the pace it takes (a step in body units,
 * from where it stands, with a little jitter so two turns never land the same).
 */
const VOICES = {
  ada: {
    skin: 'print',
    step: { dx: 0.5, dz: -0.2 },
    grab: ['proof', 'true', 'evidence', 'prove', 'believe'],
    poses: ['thinking', 'dunno', 'deal'],
    signature: 'thinking',
    temperature: 0.9,
    system:
      'You are Ada, an analytic number theorist. Precision is a moral position to you: you separate what is ' +
      'known from what is wanted, and you will not let "probably" stand where a proof is owed. Your sentences ' +
      'are short and declarative, and you correct the loose word in the line before you answer it.'
  },
  rosa: {
    skin: 'manga',
    step: { dx: -0.6, dz: 0.2 },
    grab: ['trillion', 'zeros', 'compute', 'bound', 'data'],
    poses: ['deal', 'thinking', 'pleased'],
    signature: 'deal',
    temperature: 0.85,
    system:
      'You are Rosa, a computational number theorist. You trust counts and bounds and nothing else: you quote ' +
      'how many zeros have been checked, and you are bored by philosophy when a run could settle it.'
  },
  bruno: {
    skin: 'riso',
    step: { dx: -0.7, dz: -0.2 },
    grab: ['listen', 'chord', 'beautiful', 'music', 'harmony'],
    poses: ['feel-happy', 'pleased', 'feel-surprised'],
    signature: 'feel-happy',
    temperature: 1.0,
    system:
      'You are Bruno, a romantic who loves the zeros more than the proofs. You hear them as a chord, you speak ' +
      'in images, and you overclaim cheerfully. You say "listen" before your point and you are never ' +
      'embarrassed by enthusiasm.'
  },
  iris: {
    skin: 'sketch',
    step: { dx: -0.5, dz: -0.6 },
    grab: ['hardy', 'history', 'proved', 'riemann', 'turing', 'century'],
    poses: ['letter', 'thinking', 'at-ease'],
    signature: 'letter',
    temperature: 0.85,
    system:
      'You are Iris, a historian of mathematics. You date every claim - 1859, Hardy, Turing - and you enjoy ' +
      'correcting the record. You speak in a slightly formal register and always anchor the argument in who ' +
      'proved what.'
  },
  otto: {
    skin: 'felttip',
    step: { dx: 0.4, dz: -0.5 },
    grab: ['spectrum', 'gUE', 'eigenvalue', 'physics', 'matrix', 'random'],
    poses: ['feel-surprised', 'thinking', 'deal'],
    signature: 'feel-surprised',
    temperature: 0.95,
    system:
      'You are Otto, a physicist who wandered into number theory. You see random matrices, spectra and ' +
      'quantum chaos in the zeros, and you reach for analogy before proof - while admitting an analogy is ' +
      'not a proof.'
  },
  lea: {
    skin: 'inkpunch',
    step: { dx: 0.6, dz: -0.4 },
    grab: ['model', 'axiom', 'define', 'formal', 'independent', 'meaning'],
    poses: ['dunno', 'eyes-suspicious', 'thinking'],
    signature: 'dunno',
    temperature: 0.85,
    system:
      'You are Lea, a formalist. You ask what "true" is supposed to mean here, you mention independence and ' +
      'models, and you are dry about it. You are not troubled that nobody has proved it; you are troubled by ' +
      'the question being asked badly.'
  },
  jules: {
    skin: 'ballpoint',
    step: { dx: -0.3, dz: 0.3 },
    grab: ['care', 'pay', 'break', 'useful', 'point'],
    poses: ['shrug', 'fedup', 'dunno'],
    signature: 'shrug',
    temperature: 0.95,
    system:
      'You are Jules, the outsider in this lab: not a number theorist and unembarrassed about it. You ask ' +
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

/** The words in whatever reached us: the cue line, or another scientist's answer. */
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

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** A step with a little jitter, so a second turn never lands exactly on the first. */
function stepOf(voice) {
  const jitter = () => Math.round((Math.random() - 0.5) * 0.3 * 100) / 100;
  return { dx: Math.round((voice.step.dx + jitter()) * 100) / 100, dz: Math.round((voice.step.dz + jitter()) * 100) / 100, over: 2 };
}

/**
 * Be this character: read what reached it and decide.
 *
 * Returns the answer, or null when the character lets the line go by - the
 * engine reads an empty stdout as `quiet`, and a quiet neuron forwards nothing,
 * so the branch of the conversation that dies here really does die.
 */
export async function speak(who) {
  const voice = VOICES[who];
  if (!voice) throw new Error(`no voice for ${who}`);
  const wrapped = await read();
  const inputs = Array.isArray(wrapped?.inputs) ? wrapped.inputs : [wrapped];
  const heard = inputs.map(lineOf).find(Boolean) ?? '';
  const grabbed = voice.grab.some((word) => heard.toLowerCase().includes(word));
  if (!grabbed && Math.random() > FLOOR) return null;
  const mood = pick(MOODS);
  const system = `${voice.system}\n${SETTING}\nTonight: ${mood}\nReply with JSON only: {"say": "...", "pose": "..."} where pose is exactly one of: ${voice.poses.join(', ')}.`;
  const user = heard
    ? `Someone in the room just said: "${heard}"\nYou are ${who}. Say something.`
    : `The lab is quiet. Open your mouth as ${who}.`;
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
  // The cloud model refuses too many turns at once (429): a busy room has to
  // wait its turn at the model even when nobody is waiting at the table.
  let content = '';
  let last = '';
  let say = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      content = await call(body);
      last = '';
    } catch (error) {
      last = error.message;
      if (!/429|too many concurrent/.test(last) || attempt === 3) break;
    }
    say = clean(asJson(content)?.say, who);
    if (say) break;
    // a 429, or a reply with no line in it: wait, and ask again
    if (attempt < 3) await new Promise((done) => setTimeout(done, 500 * attempt));
  }
  if (last) throw new Error(`${who} could not speak: ${last}`);
  if (!say) throw new Error(`${who} got no line back: ${String(content).slice(0, 200)}`);
  const answer = asJson(content);
  const pose = voice.poses.includes(answer?.pose) ? answer.pose : voice.signature;
  return { say, pose, skin: voice.skin, move: stepOf(voice) };
}
