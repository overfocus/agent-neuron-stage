// The kid hears: keeps the words she just heard.
import { input, lineOf, answer } from '../../../mind/lib.mjs';

const payload = await input();
answer({ heard: lineOf(payload) });
