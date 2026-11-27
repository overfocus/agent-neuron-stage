// spike 004: the rooms. A room is its tiles (rows of text, grid.ts), its named
// places (a mark is where a score can send someone: `move: { to: 'B' }`), and
// its props (scenery from props.ts, standing on tiles and closing them to a path).
import type { Cell } from './grid.ts';

export type PropKind = 'column' | 'pine' | 'deadtree' | 'lantern' | 'mirror' | 'mask' | 'blacksun' | 'ouroboros' | 'table';

export interface Prop {
  kind: PropKind;
  at: Cell;
  /** Does it close its tile to a path? Default: yes, unless it floats. */
  block?: boolean;
  /** Turn about the vertical, in quarter turns. */
  turn?: number;
}

export interface Room {
  name: string;
  rows: string[];
  marks: Record<string, Cell>;
  props: Prop[];
  /** The light: a bright day for the lab, a low sun that leaves the east in dusk for the shadow. */
  light: 'day' | 'dusk';
}

/** The first room: a dais, a wall with a gap, a pool, a step up. */
export const LAB: Room = {
  name: 'the lab',
  light: 'day',
  marks: {},
  props: [],
  rows: [
    '..............',
    '..............',
    '...1111.......',
    '...1221...##..',
    '...1111....#..',
    '...........#..',
    '..~~~......#..',
    '..~~~.........',
    '.........1....',
    '##.####..12...',
    '.........123..',
    '..............'
  ]
};

/**
 * The shadow: the seven stations of the Porch's Jung piece
 * (kevinferron.com/porch/jung-shadow) laid out as one walk, 36 × 28.
 * West of the river is lit (grass, stone, lamps), east of it is dusk (earth,
 * a black pool), and the only way across is the bridge.
 *
 *   A the mask         a raised stage, where the face is worn
 *   B what the light leaves out   a garden between two hedges
 *   C seen in others   a plaza with a crowd and two mirrors
 *   D the other side   the west end of the bridge
 *   E meeting it       a pass one tile wide between two walls
 *   F the blackening   the shore of the black pool
 *   G whole, not perfect   a raised ring of stone, two steps up, under a serpent
 */
export const SHADOW: Room = {
  name: 'the shadow',
  light: 'dusk',
  marks: {
    A: [6, 3],
    B: [6, 10],
    C: [7, 20],
    D: [16, 13],
    E: [27, 5],
    F: [23, 16],
    G: [28, 24]
  },
  props: [
    // the theatre: four columns, and the mask on its stand
    { kind: 'column', at: [2, 1] },
    { kind: 'column', at: [11, 1] },
    { kind: 'column', at: [2, 6] },
    { kind: 'column', at: [11, 6] },
    { kind: 'mask', at: [9, 2] },
    // the lit side: pines and lamps
    { kind: 'pine', at: [14, 2] },
    { kind: 'pine', at: [15, 6] },
    { kind: 'pine', at: [0, 8] },
    { kind: 'pine', at: [14, 10] },
    { kind: 'pine', at: [0, 15] },
    { kind: 'pine', at: [15, 21] },
    { kind: 'pine', at: [1, 26] },
    { kind: 'pine', at: [9, 27] },
    { kind: 'lantern', at: [13, 13] },
    { kind: 'lantern', at: [1, 12] },
    { kind: 'lantern', at: [13, 17] },
    { kind: 'lantern', at: [2, 24] },
    // the plaza's two mirrors, facing in
    { kind: 'mirror', at: [3, 17], turn: 1 },
    { kind: 'mirror', at: [12, 23], turn: 3 },
    // the dark side: dead trees, a black sun over the pool, the ring's serpent
    { kind: 'deadtree', at: [20, 10] },
    { kind: 'deadtree', at: [34, 10] },
    { kind: 'deadtree', at: [21, 21] },
    { kind: 'deadtree', at: [34, 18] },
    { kind: 'deadtree', at: [33, 1] },
    { kind: 'blacksun', at: [27, 16], block: false },
    { kind: 'ouroboros', at: [28, 24], block: false }
  ],
  rows: [
    ',,,,,,,,,,,,,,,,,~~:::::::::::::::::',
    ',,..........,,,,,~~:::::::::::::::::',
    ',,.12222221.,,,,,~~:::::::::::::::::',
    ',,.12222221.,,,,,~~:::###########:::',
    ',,.11111111.,,,,,~~:::###########:::',
    ',,..........,,,,,~~:::::::::::::::::',
    ',,..........,,,,,~~:::###########:::',
    ',,,,,,,,,,,,,,,,,~~:::###########:::',
    ',,,,,,,,,,,,,,,,,~~:::::::::::::::::',
    ',^^,^^^^^^^^^,,,,~~:::::::::::::::::',
    ',,,,,,,,,,,,,,,,,~~:::::::::::::::::',
    ',^^^^^^^^^,^^,,,,~~:::::::::::::::::',
    ',,,,,,,,,,,,,,,,,~~:::::::::::::::::',
    ',,,,,,,,,,,,,,,,bbb:::::********::::',
    ',,,,,,,,,,,,,===bbb:::::********::::',
    ',,,,,,,,,,,,,,=,,~~:::::********::::',
    ',,............=,,~~:::::********::::',
    ',,............=,,~~:::::********::::',
    ',,............=,,~~:::::********::::',
    ',,............,,,~~:::::********::::',
    ',,............,,,~~:::::::::::::::::',
    ',,............,,,~~:::::::::11::::::',
    ',,............,,,~~::::::11111111:::',
    ',,............,,,~~::::::11222211:::',
    ',,............,,,~~::::::11222211:::',
    ',,............,,,~~::::::11222211:::',
    ',,,,,,,,,,,,,,,,,~~::::::11111111:::',
    ',,,,,,,,,,,,,,,,,~~:::::::::::::::::'
  ]
};

/**
 * Life (round three): the same room with nobody's script in it, and two tables
 * of food on the lit side. The marks are what a character may long for
 * (`place=A` in its network file); the tables are where hunger goes.
 */
export const LIFE: Room = {
  ...SHADOW,
  name: 'life',
  props: [...SHADOW.props, { kind: 'table', at: [8, 18] }, { kind: 'table', at: [12, 8] }]
};

/** Where food is, in LIFE: the tables. */
export const FOOD: Cell[] = [[8, 18], [12, 8]];
