// The kid feels: what the words did to her, in one word.
import { input, lineOf, feelingOf, answer } from '../../../mind/lib.mjs';

const payload = await input();
const heard = lineOf(payload);
answer({ heard, feel: feelingOf(heard) });
