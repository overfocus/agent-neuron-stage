// ed's neuron: the table in tell.mjs, answering as ed.
import { tell } from './tell.mjs';

process.stdout.write(JSON.stringify(await tell('ed')));
