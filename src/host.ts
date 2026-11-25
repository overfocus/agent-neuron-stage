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
import { Stage, kit, paint, type IdleHabit, type Manner, type Skin, type StageFraming } from 'maxcot';
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
  /** The skin that draws each actor, when a scene mixes looks (see paintMixed). */
  private actorSkin = new Map<string, string>();
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
    this.actorSkin = new Map(show.actors.filter((a) => a.style).map((a) => [a.id, a.style!]));
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
    if (this.actorSkin.size) this.paintMixed();
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
  /** Does the cast need more than one skin? (A scene that names an actor's look.) */
  get mixed(): boolean {
    return this.actorSkin.size > 0;
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

  /**
   * An actor's body box in canvas pixels, from the frame the stage last drew:
   * its top edge is the top of the head, which is where a bubble hangs.
   *
   * The stage draws its members far to near (z descending) and hands the
   * scenes in that order, so this mirrors that one rule; a test pins it.
   */
  actorBox(id: string): { x: number; y: number; w: number; h: number } | null {
    const S = this.stage.S;
    if (!S) return null;
    const scenes = S.actors ?? [S];
    const ordered = this.stage.members.slice().sort((a, b) => b.z - a.z);
    const i = ordered.findIndex((m) => m.id === id);
    if (i < 0) return null;
    const box = scenes[i]?.body;
    return box ? { x: box.x, y: box.y, w: box.w, h: box.h } : null;
  }

  /** The top centre of an actor's head: the anchor of a speech bubble. */
  headOf(id: string): { x: number; y: number } | null {
    const box = this.actorBox(id);
    return box ? { x: box.x + box.w / 2, y: box.y } : null;
  }

  // ── the stage, rebuilt from the show ────────────────────────────────────
  private reset(): void {
    for (const member of [...this.stage.members]) this.stage.remove(member.id);
    for (const actor of this.show.actors) {
      this.stage.add({ id: actor.id, who: actor.who, x: actor.x, z: actor.z, pose: 'rest' });
      this.stage.get(actor.id).setManner({ weight: actor.weight, idle: actor.idle as IdleHabit });
    }
    this.last = this.show.actors[0]?.id ?? '';
    this.actorSkin = new Map(this.show.actors.filter((a) => a.style).map((a) => [a.id, a.style!]));
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

  /**
   * A cast with more than one skin. maxcot's Stage paints the merged cast in a
   * single skin (stage.ts: paint(merged, this.skin)), which is what makes
   * whole-frame effects possible and per-character looks impossible. So: after
   * the stage has built each actor's scene, paint that scene with the actor's
   * own skin into a box-sized scratch canvas and composite it back. The box is
   * the actor's own body plus a margin — some skins paint the whole frame, and
   * an unclipped composite erases the cast that came before it (spikes/003).
   */
  private paintMixed(): void {
    const S = this.stage.S;
    if (!S) return;
    const scenes = S.actors ?? [S];
    const ctx = this.stage.ctx as unknown as CanvasRenderingContext2D;
    const w = this.stage.canvas.width;
    const h = this.stage.canvas.height;
    const t = this.stage.time;
    // the ground is the show's own skin: the stage, one look; the cast, many
    const g = this.skin.ground;
    const view = { w, h, t, palette: this.stage.palette, seed: Math.floor(t * (this.skin.fps || 12)), key: this.stage.key };
    ctx.save();
    if (g && g.draw) g.draw(ctx, w, h, t, kit, view);
    else {
      ctx.fillStyle = (g && g.css) || '#f3f2ec';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
    const ids = this.stage.members.slice().sort((a, b) => b.z - a.z).map((m) => m.id);
    const skins = skinsByName();
    scenes.forEach((scene, i) => {
      const id = ids[i];
      const skin = (id && this.actorSkin.has(id) ? skins[this.actorSkin.get(id)!] : undefined) ?? this.skin;
      const pad = scene.unit * 0.55;
      const box = {
        x: Math.max(0, Math.floor(scene.body.x - pad)),
        y: Math.max(0, Math.floor(scene.body.y - pad * 0.8))
      };
      const bw = Math.min(w - box.x, Math.ceil(scene.body.w + pad * 2));
      const bh = Math.min(h - box.y, Math.ceil(scene.body.h + pad * 1.6));
      if (bw <= 0 || bh <= 0) return;
      // a box-sized buffer from maxcot's own pool: the same canvas factory the
      // stage uses, so this works in a browser, a worker and the Node tests
      const buf = kit.buffer(`mixed:${this.stage.key}`, bw, bh);
      const sctx = buf.ctx as unknown as CanvasRenderingContext2D;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, bw, bh);
      sctx.setTransform(1, 0, 0, 1, -box.x, -box.y);
      paint(sctx as never, scene, skin, { t, palette: this.stage.palette, key: `${this.stage.key}:${id ?? i}`, ground: false });
      ctx.drawImage(buf.canvas as never, box.x, box.y);
    });
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
        // `style` with `on` is one character's look: the stage keeps painting the
        // cast in its own skin, and paintMixed draws this actor over it.
        const who = typeof event.on === 'string' ? event.on : undefined;
        if (who && this.stage.has(who)) {
          this.actorSkin.set(who, skin.name);
          this.stage.dirty = true;
          return;
        }
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
        const actor = this.stage.get(id);
        actor.set(key, Number(event.to));
        // a seek must land on the design the score describes, not mid-morph
        if (ctx.instant) actor.snap();
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
