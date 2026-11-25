// iris's neuron: the table in glm.mjs, answering as iris.
import { speak } from './glm.mjs';

process.stdout.write(JSON.stringify(await speak('iris')));
