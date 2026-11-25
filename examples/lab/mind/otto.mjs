// otto's neuron: the lab table in glm.mjs. Quiet is an empty stdout - the
// engine reads it as "chose not to act", and nothing is forwarded.
import { speak } from './glm.mjs';

const reply = await speak('otto');
if (reply) process.stdout.write(JSON.stringify(reply));
