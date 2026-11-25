// di's neuron: the table in tell.mjs, answering as di.
import { tell } from './tell.mjs';

process.stdout.write(JSON.stringify(await tell('di')));
