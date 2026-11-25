// Print a show as a maxcot score, on stdout.
//
//   node scripts/score.mjs src/traces/duet.json > duet.score
//   node scripts/score.mjs - < a-score.json > a-score.score
//
// It reads a trace (compiles it) or a score document (plays it as it is), so
// the text is the same the page's Score pane shows, and maxcot's own studio
// opens it. `-` reads standard input, which is how a network's answer becomes
// a file: see scripts/writer-scene.sh.
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/score.mjs <trace.json|score.json|->');
  process.exit(2);
}

const read = async () => {
  if (file !== '-') return readFile(file, 'utf8');
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const text = await read();
const document = JSON.parse(text);
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error'
});
try {
  const { formatScore } = await server.ssrLoadModule('/src/show.ts');
  let show;
  if (document && document.format === 'agent-neuron-trace') {
    const { parseTrace } = await server.ssrLoadModule('/src/trace.ts');
    const { compileTrace } = await server.ssrLoadModule('/src/fromtrace.ts');
    show = compileTrace(parseTrace(document));
  } else {
    const { parseShow } = await server.ssrLoadModule('/src/fromscore.ts');
    show = parseShow(text);
  }
  process.stdout.write(
    formatScore(show, [`${show.title} — ${show.note}`, 'a maxcot score: it plays in maxcot\'s own studio too'])
  );
} finally {
  await server.close();
}
