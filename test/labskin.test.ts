import { describe, expect, it } from 'vitest';
import type { Scene } from 'maxcot';
import { laboratory, plainRoom, roomOf, setRoom } from '../src/labskin.ts';

/** The one thing a room needs from a scene: a camera. */
function sceneWith(cam: { cx: number; cy: number; unit: number }): Scene {
  return { cam } as unknown as Scene;
}

describe('the lab room is drawn where the cast stands', () => {
  it('puts one actor s feet exactly on the floor the stage put them on', () => {
    const cam = { cx: 500, cy: 300, unit: 90 };
    const room = roomOf(sceneWith(cam), { x: -2, z: 1.6 });
    const feet = room.at(-2, 1.6);
    expect(feet.x).toBeCloseTo(cam.cx, 6);
    expect(feet.y).toBeCloseTo(cam.cy, 6);
  });

  it('agrees with a second actor, whose depth changes its size and its line', () => {
    // the stage: x is placed on one scale, y by depth, and a body shrinks with z
    const unit = 66;
    const x0 = 0.5;
    const at = (x: number, z: number) => ({
      cx: 480 + (x - x0) * unit,
      cy: 280 - z * unit * 0.12,
      unit: unit / (1 + z * 0.25)
    });
    const near = { x: 3.2, z: -1.2 };
    const far = { x: -4.4, z: 3.8 };
    const room = roomOf(sceneWith(at(near.x, near.z)), near);
    const other = at(far.x, far.z);
    const seen = room.at(far.x, far.z);
    expect(seen.x).toBeCloseTo(other.cx, 6);
    expect(seen.y).toBeCloseTo(other.cy, 6);
    expect(seen.unit).toBeCloseTo(other.unit, 6);
  });

  it('a room with no camera still stands a plausible one, and the room reads it', () => {
    const plain = plainRoom(1000, 500);
    expect(plain.at(0, 0).x).toBeCloseTo(500, 6);
    expect(plain.at(0, 0).unit).toBeGreaterThan(0);
    // near is low on the page, far is high: the floor goes back
    expect(plain.at(0, 3).y).toBeLessThan(plain.at(0, -2).y);
    setRoom(plain);
    setRoom(null);
    expect(laboratory().name).toBe('laboratory');
    expect(laboratory().ground?.draw).toBeTypeOf('function');
  });
});
