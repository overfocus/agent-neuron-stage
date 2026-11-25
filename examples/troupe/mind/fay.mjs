// fay's neuron: the table in tell.mjs, answering as fay.
import { tell } from './tell.mjs';

process.stdout.write(JSON.stringify(await tell('fay')));
