// Print the show a trace compiles to, as a maxcot score, on stdout.
//
//   node scripts/score.mjs src/traces/duet.json > duet.score
//
// The score is the same text the page shows in its Score pane, and maxcot's own
// studio opens it (paste it over a score there, or save it as .score).
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/score.mjs <trace.json>');
  process.exit(2);
}

const trace = JSON.parse(await readFile(file, 'utf8'));
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error'
});
try {
  const { parseTrace } = await server.ssrLoadModule('/src/trace.ts');
  const { compileTrace } = await server.ssrLoadModule('/src/fromtrace.ts');
  const { formatScore } = await server.ssrLoadModule('/src/show.ts');
  const show = compileTrace(parseTrace(trace));
  process.stdout.write(formatScore(show, [`${show.title} — ${show.note}`, 'a maxcot score: it plays in maxcot\'s own studio too']));
} finally {
  await server.close();
}
