// otto's neuron: the table in glm.mjs, answering as otto.
import { speak } from './glm.mjs';

process.stdout.write(JSON.stringify(await speak('otto')));
