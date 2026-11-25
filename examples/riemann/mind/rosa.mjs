// rosa's neuron: the table in glm.mjs, answering as rosa.
import { speak } from './glm.mjs';

process.stdout.write(JSON.stringify(await speak('rosa')));
