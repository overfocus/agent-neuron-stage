// The network pane: a trace is a cast and a set of links, so the page draws
// them before (or beside) the film. Positions are the ones the stage uses;
// the mind badge is only drawn when the page knows what the minds are.
import { describe, expect, it } from 'vitest';
import { netOf } from '../src/netchart.ts';
import { parseTrace } from '../src/trace.ts';
import labJson from '../src/traces/lab.json';

const lab = parseTrace(labJson);

describe('netOf', () => {
  it('draws one node per neuron, where the trace puts it', () => {
    const net = netOf(lab);
    expect(net.nodes.map((n) => n.id).sort()).toEqual(lab.neurons.map((n) => n.id).sort());
    for (const node of net.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(1);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(1);
    }
    // every neuron in this trace carries a place of its own
    expect(net.nodes.every((n) => n.placed)).toBe(true);
  });

  it('puts the near end of the room low on the page and the far end high', () => {
    const net = netOf(lab);
    const near = net.nodes.find((n) => n.id === 'ada')!; // z -1.2
    const far = net.nodes.find((n) => n.id === 'otto')!; // z 3.7
    expect(near.y).toBeGreaterThan(far.y);
    // across the room: ada stands left of bruno, in the chart as on the stage
    expect(net.nodes.find((n) => n.id === 'ada')!.x).toBeLessThan(net.nodes.find((n) => n.id === 'bruno')!.x);
    expect(Math.max(...net.nodes.map((n) => n.x)) - Math.min(...net.nodes.map((n) => n.x))).toBeGreaterThan(0.8);
  });

  it('draws every link, both ways round where the network has both', () => {
    const net = netOf(lab);
    expect(net.edges).toHaveLength(lab.links.length);
    expect(net.edges).toContainEqual({ from: 'ada', to: 'bruno' });
    expect(net.edges).toContainEqual({ from: 'bruno', to: 'ada' });
  });

  it('shows the mind only when the page knows what it is', () => {
    expect(netOf(lab).mind).toBeUndefined();
    const net = netOf(lab, { via: 'glm-5.3-flash:cloud' });
    expect(net.mind?.label).toBe('glm-5.3-flash:cloud');
    // every neuron that is not the question talks to it; the source does not
    expect(net.mind?.to.sort()).toEqual(lab.neurons.filter((n) => n.id !== 'cue').map((n) => n.id).sort());
    expect(net.mind?.to).not.toContain('cue');
  });

  it('falls back to the link layout for a trace without places', () => {
    const net = netOf(
      parseTrace({
        format: 'agent-neuron-trace',
        version: 1,
        demo: 'plain',
        neurons: [
          { id: 'cue', kind: 'source' },
          { id: 'a', kind: 'run' },
          { id: 'b', kind: 'run' }
        ],
        links: [
          { from: 'cue', to: 'a' },
          { from: 'a', to: 'b' }
        ],
        events: []
      })
    );
    expect(net.nodes.every((n) => !n.placed)).toBe(true);
    expect(new Set(net.nodes.map((n) => n.x)).size).toBeGreaterThan(1);
  });
});
