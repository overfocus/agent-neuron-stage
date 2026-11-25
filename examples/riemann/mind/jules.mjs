// jules's neuron: the table in glm.mjs, answering as jules.
import { speak } from './glm.mjs';

process.stdout.write(JSON.stringify(await speak('jules')));
