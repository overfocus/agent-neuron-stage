// The kid speaks once she has both the words and the feeling (a threshold-2
// join: { payload, inputs }), and answers { say, pose }.
import { input, lineOf, feelingOf, answer } from '../../../mind/lib.mjs';

const wrapped = await input();
const inputs = Array.isArray(wrapped?.inputs) ? wrapped.inputs : [wrapped];
const heard = inputs.map(lineOf).find(Boolean) ?? '';
const felt = inputs.map((v) => (v && typeof v === 'object' ? v.feel : null)).find(Boolean);

const byWord = {
  late: { say: 'You always say that.', pose: 'feel-sulking' },
  tide: { say: 'The tide is not an excuse.', pose: 'feel-angry' },
  score: { say: 'You started it.', pose: 'feel-furious' },
  moon: { say: 'I carried it all the way back.', pose: 'feel-proud' },
  way: { say: 'It is never on your way.', pose: 'feel-sulking' },
  back: { say: 'Back is not the same as here.', pose: 'feel-sad' }
};
const byFeeling = {
  stung: { say: 'That is not fair.', pose: 'feel-sulking' },
  warm: { say: 'You noticed.', pose: 'feel-happy' },
  steady: { say: 'I am listening.', pose: 'thinking' }
};

const word = Object.keys(byWord).find((key) => heard.toLowerCase().includes(key));
const line = byWord[word] ?? byFeeling[felt] ?? byFeeling[feelingOf(heard)];
answer(line);
