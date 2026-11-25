// ann's neuron: the table in tell.mjs, answering as ann.
import { tell } from './tell.mjs';

process.stdout.write(JSON.stringify(await tell('ann')));
