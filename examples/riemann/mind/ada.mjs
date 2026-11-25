// ada's neuron: the table in glm.mjs, answering as ada.
import { speak } from './glm.mjs';

process.stdout.write(JSON.stringify(await speak('ada')));
