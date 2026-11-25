// host.ts: play a show on a maxcot stage. This is the only file that touches
// the DOM-free engine's state; everything it decides (who is in the cast, what
// happens on which beat) was decided by a compiler, not here.
//
// Commands, the whole vocabulary (show.ts COMMANDS):
//   enter { id, who, x, z }   a character walks on (or is placed)
//   create 'who'              one actor, id and cast in one name
//   exit 'id'                 a character leaves
//   pose 'name', on 'id'      a pose from maxcot's 95, layered by what it moves
//   look 'id', on 'id'        the second id looks at the first (or 'none')
//   shot 'wide', on 'id'      the camera: wide, full, medium, close
//   style 'skin', palette …   a different skin draws the whole cast
//   who 'cast', on 'id'       recast an actor
//   manner { weight, idle }, on 'id'
//   set 'body.w', to 1.2, on 'id'
//   say 'line', on 'id'       the caption: the stage's own command
//   end { text }              the card: the stage's own command
import { Stage, type IdleHabit, type Manner, type Skin, type StageFraming } from 'maxcot';
import { createConductor, type CommandContext, type Conductor, type ScheduledEvent } from 'maxcot/score';
import { allSkins, skinsByName } from 'maxcot/skins';
import { hasPose } from './fromtrace.ts';
import type { Show } from './show.ts';

export interface HostHooks {
  /** A line was spoken (or, with an empty text, the caption clears). */
  onLine?(who: string, text: string): void;
  /** The end card shows, or null when it goes away. */
  onCard?(text: string | null): void;
  /** The playhead, in bars and beats, a few times a second. */
  onFrame?(bar: number, beat: number, seconds: number): void;
  /** A command this stage does not know: reported once, then ignored. */
  onUnknown?(cmd: string): void;
}

export class ShowHost {
  readonly canvas: HTMLCanvasElement;
  readonly stage: Stage;
  readonly conductor: Conductor;
  show: Show;
  /** Playback speed: the film's clock against the score's. 1 is the score's own. */
  speed = 1;
  private hooks: HostHooks;
  private baseSkin: Skin;
  private skin: Skin;
  private last = '';
  private unknown = new Set<string>();
  private frameAt = 0;

  constructor(canvas: HTMLCanvasElement, show: Show, hooks: HostHooks = {}) {
    this.canvas = canvas;
    this.show = show;
    this.hooks = hooks;
    this.baseSkin = skinsByName()[show.skin] ?? allSkins[0]!;
    this.skin = this.baseSkin;
    this.stage = new Stage(canvas, { skin: this.skin, palette: show.palette, autoplay: false });
    this.conductor = createConductor({
      bpm: show.bpm,
      beatsPerBar: show.beatsPerBar,
      events: show.events,
      tail: show.tail,
      // `on`, `palette`, `to` and `from` qualify a command; they are not commands.
      modifiers: ['at', 'on', 'to', 'from', 'palette', 'cut'],
      onCommand: (cmd, value, event, ctx) => this.exec(cmd, value, event, ctx),
      onReset: () => this.reset(),
      onSettle: () => this.settle()
    });
    this.conductor.seek(0);
  }

  // ── the show ────────────────────────────────────────────────────────────
  load(show: Show): void {
    this.conductor.pause();
    this.show = show;
    this.baseSkin = skinsByName()[show.skin] ?? allSkins[0]!;
    this.skin = this.baseSkin;
    this.conductor.songT = 0;
    this.conductor.load(show.events, { bpm: show.bpm, beatsPerBar: show.beatsPerBar, tail: show.tail });
  }

  play(): void {
    if (this.conductor.songT >= this.conductor.total - 1e-6) this.conductor.seek(0);
    this.conductor.play();
  }
  pause(): void {
    this.conductor.pause();
  }
  toggle(): void {
    if (this.conductor.playing) this.pause();
    else this.play();
  }
  seek(seconds: number): void {
    this.conductor.seek(seconds);
  }
  /** Advance by dt seconds and draw. Safe to call while paused: the actors keep settling. */
  tick(dt: number): void {
    if (this.conductor.playing) this.conductor.tick(dt * this.speed);
    this.stage.step(dt);
    this.frameAt += dt;
    if (this.frameAt > 0.1) {
      this.frameAt = 0;
      const [bar, beat] = this.conductor.barBeat(this.conductor.songT);
      this.hooks.onFrame?.(bar, beat, this.conductor.songT);
    }
  }
  get playing(): boolean {
    return this.conductor.playing;
  }
  get time(): number {
    return this.conductor.songT;
  }
  get total(): number {
    return this.conductor.total;
  }
  /** Which actor is under a canvas point, for a click. */
  pick(x: number, y: number): string | null {
    return this.stage.pick(x, y);
  }

  // ── the stage, rebuilt from the show ────────────────────────────────────
  private reset(): void {
    for (const member of [...this.stage.members]) this.stage.remove(member.id);
    for (const actor of this.show.actors) {
      this.stage.add({ id: actor.id, who: actor.who, x: actor.x, z: actor.z, pose: 'rest' });
      this.stage.get(actor.id).setManner({ weight: actor.weight, idle: actor.idle as IdleHabit });
    }
    this.last = this.show.actors[0]?.id ?? '';
    this.skin = this.baseSkin;
    this.stage.setSkin(this.skin, this.show.palette);
    this.stage.shot('wide', undefined, true);
    this.stage.dirty = true;
    this.hooks.onLine?.('', '');
    this.hooks.onCard?.(null);
  }

  /** A seek has replayed history: put the camera where the replay left it, without easing. */
  private settle(): void {
    this.stage.cut();
    this.stage.dirty = true;
  }

  private actorId(event: ScheduledEvent): string {
    const on = event.on;
    if (typeof on === 'string' && this.stage.has(on)) return on;
    return this.last;
  }

  private exec(cmd: string, value: unknown, event: ScheduledEvent, ctx: CommandContext): void {
    switch (cmd) {
      case 'enter': {
        const spec = typeof value === 'string' ? { id: value } : (value as Record<string, unknown> | null);
        if (!spec) return;
        const id = String(spec.id ?? spec.who ?? 'guest');
        const who = typeof spec.who === 'string' ? spec.who : id;
        if (!this.stage.has(id)) {
          this.stage.add({
            id,
            who,
            x: typeof spec.x === 'number' ? spec.x : undefined,
            z: typeof spec.z === 'number' ? spec.z : undefined,
            pose: 'rest'
          });
        } else {
          this.stage.cast(id, who);
        }
        this.last = id;
        if (ctx.instant) this.stage.cut();
        this.stage.dirty = true;
        return;
      }
      case 'create': {
        const id = text(value);
        if (!id || this.stage.has(id)) return;
        this.stage.add({ id, who: id, pose: 'rest' });
        this.last = id;
        this.stage.dirty = true;
        return;
      }
      case 'exit': {
        const id = text(value);
        if (id && this.stage.has(id) && this.stage.members.length > 1) this.stage.remove(id);
        this.stage.dirty = true;
        return;
      }
      case 'pose': {
        const id = this.actorId(event);
        const name = text(value);
        if (!id || !name || !hasPose(name) || !this.stage.has(id)) return;
        const actor = this.stage.get(id);
        actor.pose(name);
        if (ctx.instant) actor.snap();
        this.last = id;
        this.stage.dirty = true;
        return;
      }
      case 'look': {
        const id = this.actorId(event);
        const target = text(value);
        if (!id || !this.stage.has(id)) return;
        if (target == null || target === 'none') this.stage.look(id, null);
        else if (target === 'us') this.stage.look(id, 'us'); // out to the audience
        else if (this.stage.has(target)) this.stage.look(id, target);
        this.last = id;
        return;
      }
      case 'shot': {
        const framing = text(value) as StageFraming | undefined;
        if (!framing) return;
        this.stage.shot(framing, event.on as string | string[] | undefined, !!ctx.instant);
        return;
      }
      case 'style': {
        const name = text(value);
        const skin = name ? skinsByName()[name] : undefined;
        if (!skin) return;
        this.skin = skin;
        this.stage.setSkin(skin, typeof event.palette === 'string' ? event.palette : undefined);
        this.stage.dirty = true;
        return;
      }
      case 'who': {
        const id = this.actorId(event);
        const who = text(value);
        if (id && who && this.stage.has(id)) this.stage.cast(id, who);
        this.stage.dirty = true;
        return;
      }
      case 'manner': {
        const id = this.actorId(event);
        if (!id || !value || typeof value !== 'object' || !this.stage.has(id)) return;
        this.stage.get(id).setManner(value as Partial<Manner>);
        this.stage.dirty = true;
        return;
      }
      case 'set': {
        const id = this.actorId(event);
        const key = text(value);
        if (!id || !key || !this.stage.has(id)) return;
        this.stage.get(id).set(key, Number(event.to));
        this.stage.dirty = true;
        return;
      }
      case 'say': {
        const id = this.actorId(event);
        const line = text(value) ?? '';
        if (id) this.last = id;
        this.hooks.onLine?.(id, line);
        return;
      }
      case 'end': {
        const card = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
        this.hooks.onCard?.(typeof card.text === 'string' ? card.text : 'MAXCOT');
        return;
      }
      default: {
        if (this.unknown.has(cmd)) return;
        this.unknown.add(cmd);
        this.hooks.onUnknown?.(cmd);
      }
    }
  }
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}
