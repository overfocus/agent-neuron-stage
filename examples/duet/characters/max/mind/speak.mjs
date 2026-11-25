// Max speaks once he has both the words and the feeling: a threshold-2 join of
// hear and feel, so the input is { payload, inputs } (SPEC 0). He answers
// { say, pose } - the line, and the face he says it with.
//
// The table below stands in for a model: a model neuron would answer the same
// two fields, and the stage would draw it the same way.
import { input, lineOf, feelingOf, answer } from '../../../mind/lib.mjs';

const wrapped = await input();
const inputs = Array.isArray(wrapped?.inputs) ? wrapped.inputs : [wrapped];
const heard = inputs.map(lineOf).find(Boolean) ?? '';
const felt = inputs.map((v) => (v && typeof v === 'object' ? v.feel : null)).find(Boolean);

const byWord = {
  late: { say: 'The tide kept me.', pose: 'deal' },
  always: { say: 'And you always keep score.', pose: 'fedup' },
  excuse: { say: 'Then nothing is.', pose: 'secret' },
  started: { say: 'I finished it, too.', pose: 'pleased' },
  moon: { say: 'It was on my way.', pose: 'thinking' },
  way: { say: 'Everything is on my way.', pose: 'dunno' }
};
const byFeeling = {
  stung: { say: 'Say what you mean.', pose: 'eyes-suspicious' },
  warm: { say: 'You came back.', pose: 'pleased' },
  steady: { say: 'Mm.', pose: 'mouth-smirk' }
};

const word = Object.keys(byWord).find((key) => heard.toLowerCase().includes(key));
const line = byWord[word] ?? byFeeling[felt] ?? byFeeling[feelingOf(heard)];
answer(line);
