// bruno's neuron: the table in glm.mjs, answering as bruno.
import { speak } from './glm.mjs';

process.stdout.write(JSON.stringify(await speak('bruno')));
