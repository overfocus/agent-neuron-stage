// cy's neuron: the table in tell.mjs, answering as cy.
import { tell } from './tell.mjs';

process.stdout.write(JSON.stringify(await tell('cy')));
