// Max feels: what the words did to him. One word, so speak can pick a face.
import { input, lineOf, feelingOf, answer } from '../../../mind/lib.mjs';

const payload = await input();
const heard = lineOf(payload);
answer({ heard, feel: feelingOf(heard) });
