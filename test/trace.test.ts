import { describe, expect, it } from 'vitest';
import { eventType, parseTrace, payloadLine } from '../src/trace.ts';
import alertsJson from '../src/traces/alerts.json';

const minimal = {
  format: 'agent-neuron-trace',
  version: 1,
  demo: 'made up',
  neurons: [
    { id: 'a', kind: 'source', description: 'says things' },
    { id: 'b', kind: 'run', description: 'hears them', options: { threshold: 1 } }
  ],
  links: [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'nowhere' }
  ],
  events: [{ t: 0, type: 'signal', id: '1', from: 'a', to: ['b'], trace: '1', hops: 0, payload: { type: 'text', text: 'hi' } }]
};

describe('parseTrace', () => {
  it('reads a trace and keeps its cast, links and events', () => {
    const trace = parseTrace(minimal);
    expect(trace.demo).toBe('made up');
    expect(trace.neurons.map((n) => n.id)).toEqual(['a', 'b']);
    expect(trace.events).toHaveLength(1);
  });

  it('drops a link to a neuron the header does not declare', () => {
    expect(parseTrace(minimal).links).toEqual([{ from: 'a', to: 'b' }]);
  });

  it('refuses a document that is not a trace', () => {
    expect(() => parseTrace({ version: 1 })).toThrow(/not an agent-neuron trace/);
    expect(() => parseTrace([])).toThrow(/one JSON object/);
    expect(() => parseTrace({ format: 'agent-neuron-trace', version: 2, neurons: [] })).toThrow(/version 1/);
  });

  it('treats an event with no type as a signal (the library wrote them that way)', () => {
    const trace = parseTrace({ ...minimal, events: [{ t: 5, from: 'a', to: ['b'] }] });
    expect(trace.events[0]!.type).toBe('signal');
    expect(eventType(trace.events[0]!)).toBe('signal');
  });

  it('knows the event types it draws and leaves the rest alone', () => {
    expect(eventType({ t: 0, type: 'answer', to: [] })).toBe('answer');
    expect(eventType({ t: 0, type: 'quantum', to: [] })).toBe('other');
  });

  it('reads a line off a text payload, a JSON string, or the say field of an object', () => {
    expect(payloadLine({ type: 'text', text: 'a line' })).toBe('a line');
    expect(payloadLine({ type: 'json', data: 'a line' })).toBe('a line');
    expect(payloadLine({ type: 'json', data: { say: 'a line', pose: 'deal' } })).toBe('a line');
    expect(payloadLine({ type: 'json', data: { pose: 'deal' } })).toBeUndefined();
    expect(payloadLine({ type: 'json', preview: 'long…', truncated: true })).toBeUndefined();
  });

  it('reads a recorded trace from agent-neuron as it is', () => {
    const trace = parseTrace(alertsJson);
    expect(trace.neurons).toHaveLength(6);
    expect(trace.neurons.find((n) => n.id === 'hypothesis')?.options?.threshold).toBe(2);
    expect(trace.events.length).toBeGreaterThan(200);
    expect(trace.events.every((e) => Number.isFinite(e.t))).toBe(true);
  });
});
