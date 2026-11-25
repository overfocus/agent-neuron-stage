// Max hears: keeps the words, and answers them as data. The mind's first step,
// and the one that has nothing of its own to say.
import { input, lineOf, answer } from '../../../mind/lib.mjs';

const payload = await input();
answer({ heard: lineOf(payload) });
