// lea's neuron: the table in glm.mjs, answering as lea.
import { speak } from './glm.mjs';

process.stdout.write(JSON.stringify(await speak('lea')));
