// The mind's small vocabulary, shared by both characters.
//
// A neuron is a program (SPEC 0): one JSON value on stdin, one on stdout. A
// character's mind is three of them, so this file holds only what all three
// need: reading the input, finding the line in it, and reading a feeling off
// the words. Nothing here knows about the stage: a character answers
// { say, pose } and the stage decides what a face is.

/** The one JSON value the engine writes on stdin, once. */
export function input() {
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (raw += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(raw.trim() ? JSON.parse(raw) : null);
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on('error', reject);
  });
}

/** stdout is the answer: one JSON value, nothing else. */
export function answer(value) {
  process.stdout.write(JSON.stringify(value));
}

/** The words in whatever arrived: a line, an answer, or a join's inputs. */
export function lineOf(payload) {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.say === 'string') return payload.say.trim();
  if (typeof payload.heard === 'string') return payload.heard.trim();
  if (typeof payload.text === 'string') return payload.text.trim();
  if (Array.isArray(payload.inputs)) {
    for (const inner of payload.inputs) {
      const line = lineOf(inner);
      if (line) return line;
    }
  }
  return '';
}

/** What the words did to the character hearing them. */
export function feelingOf(text) {
  if (/late|lost|again|forgot|never|always|excuse|not\b/i.test(text)) return 'stung';
  if (/moon|brought|stay|walk|gift|back|way/i.test(text)) return 'warm';
  return 'steady';
}
