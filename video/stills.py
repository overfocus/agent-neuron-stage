#!/usr/bin/env python3
"""Stills: one frame per scene, for the README and for posting.

The app page is the source, not the film composition: a still here is the stage
as a reader sees it (skin, poses, cast, bubble), with the page's chrome cropped
away. Each scene is selected in the list, scrubbed to a named bar and beat, and
held long enough for the springs to settle before the shot.

  npm run dev &                                  # http://localhost:5210
  ./.venv/bin/python video/stills.py             # every scene -> media/stills/
  ./.venv/bin/python video/stills.py --only duel,eight
  ./.venv/bin/python video/stills.py --social    # also media/social/ (1200x630)

Deps: playwright + chromium (the demos repo's .venv has both) and ffmpeg.
"""
import argparse
import pathlib
import re
import subprocess
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5210/"

# scene key, the beat to hold (bar, beat), slug, what the still shows
STILLS = [
    ("one", (2, 3), "one", "a solo in graphite, the whole figure"),
    ("duel", (3, 1), "duel", "two of them in manga, one furious one cowering"),
    ("eight", (5, 1), "eight", "the whole cast in teletext, everybody cheering"),
    ("noir", (6, 1), "noir", "two and a letter, in ink"),
    ("party", (3, 2), "party", "four of them, screen-printed"),
    ("six-ways", (4, 1), "six-ways", "six of them in a rose hologram"),
    ("argument", (4, 2), "argument", "three in a red beam"),
    ("goodnight", (7, 1), "goodnight", "two at the speed of falling asleep"),
    ("unit", (3, 3), "unit", "five machines on an oscilloscope"),
    ("the-wall", (3, 1), "the-wall", "seven in stencil"),
]


def seconds(bar: int, beat: int, bpm: float, beats_per_bar: int = 4) -> float:
    return ((bar - 1) * beats_per_bar + (beat - 1)) * 60.0 / bpm


def main() -> int:
    here = pathlib.Path(__file__).parent
    root = here.parent
    ap = argparse.ArgumentParser(description="A still per scene, from the app page.")
    ap.add_argument("--url", default=BASE)
    ap.add_argument("--only", default=None, help="comma-separated scene keys")
    ap.add_argument("--out", default=root / "media" / "stills")
    ap.add_argument("--social", action="store_true", help="also write media/social/ at 1200x630")
    ap.add_argument("--width", type=int, default=1920, help="final still width (16:9)")
    args = ap.parse_args()

    wanted = {k.strip() for k in args.only.split(",")} if args.only else None
    picks = [s for s in STILLS if not wanted or s[0] in wanted]
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    social = root / "media" / "social"
    if args.social:
        social.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        # a big viewport and a 2x scale: the canvas lands near 2600px wide, so the
        # 1920px still is a downscale, never an upscale
        page = browser.new_page(viewport={"width": 1900, "height": 1120}, device_scale_factor=2)
        page.on("pageerror", lambda e: print(f"[page error] {e}"))
        page.goto(args.url)
        page.wait_for_selector("#stage")
        page.wait_for_timeout(800)
        # a still has to carry its line at 1920px: the page's bubble type is sized
        # for a laptop canvas, so it is scaled up for the capture only
        page.add_style_tag(
            content=(
                ".bubble{max-width:330px;padding:9px 13px 11px}"
                ".bubble-line{font-size:20px;line-height:1.28}"
                ".bubble-who{font-size:11px}"
            )
        )

        for key, (bar, beat), slug, what in picks:
            page.select_option("#show", f"scene:{key}")
            page.wait_for_timeout(400)
            meta = page.inner_text("#meta")
            found = re.search(r"(\d+(?:\.\d+)?)\s*bpm", meta)
            if not found:
                print(f"{slug}: no bpm in the meta line ({meta!r})", file=sys.stderr)
                return 2
            bpm = float(found.group(1))
            t = seconds(bar, beat, bpm)
            page.eval_on_selector(
                "#scrub",
                "(el, v) => { el.value = String(v); el.dispatchEvent(new Event('input')); }",
                t,
            )
            # let the springs, the camera and the bubble settle on the seek
            page.wait_for_timeout(1100)
            box = page.eval_on_selector(
                "#stage",
                "el => { const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height}; }",
            )
            clip = {"x": box["x"], "y": box["y"], "width": box["width"], "height": box["height"]}
            raw = out / f".{slug}.png"
            page.screenshot(path=str(raw), clip=clip, type="png", timeout=120_000)
            still = out / f"{slug}.jpg"
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                 "-vf", f"scale={args.width}:-2:flags=lanczos", "-q:v", "3", str(still)],
                check=True,
            )
            raw.unlink()
            if args.social:
                wide = social / f"{slug}.jpg"
                # 1.91:1 from the middle, a little high so heads survive the crop
                subprocess.run(
                    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(still),
                     "-vf", "crop=iw:iw*0.525:0:ih*0.045,scale=1200:630:flags=lanczos", "-q:v", "3", str(wide)],
                    check=True,
                )
            print(f"{slug}: {what} -> {still.relative_to(root)}", flush=True)
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
