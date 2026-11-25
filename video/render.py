#!/usr/bin/env python3
"""Render the stage's demo take: video/composition.html, stepped frame by frame.

The composition serves from the Vite dev server (it imports the app's own
modules), so start `npm run dev` first. Frames land in video/frames/ as PNGs and
ffmpeg encodes out/stage.mp4 (H.264, yuv420p, faststart, silent: a portfolio
page plays it muted).

  npm run dev &                       # http://localhost:5210
  ./.venv/bin/python video/render.py --smoke        # 3 s, 90 frames, look first
  ./.venv/bin/python video/render.py               # the whole take
  ./.venv/bin/python video/render.py --mux          # + out/stage.mp4
  ./.venv/bin/python video/render.py --poster      # + out/poster.jpg (a still)

Deps: playwright + chromium (reuse agent-neuron-demos/video/.venv, or any venv
with playwright installed) and ffmpeg on PATH.
"""
import argparse
import pathlib
import subprocess
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5210/video/composition.html"


def main() -> int:
    here = pathlib.Path(__file__).parent
    ap = argparse.ArgumentParser(description="Render the stage demo: composition.html, stepped through time.")
    ap.add_argument("--url", default=BASE)
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--seconds", type=float, default=None)
    ap.add_argument("--smoke", action="store_true", help="3 seconds only, to look at frames before the full take")
    ap.add_argument("--frames", default=here / "frames")
    ap.add_argument("--mux", action="store_true")
    ap.add_argument("--poster", action="store_true", help="also write out/poster.jpg from the poster time")
    ap.add_argument("--poster-at", type=float, default=5.1, help="video seconds for the poster frame")
    ap.add_argument("--out", default=here / "out" / "stage.mp4")
    args = ap.parse_args()

    frames = pathlib.Path(args.frames)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page.on("console", lambda m: print(f"[page] {m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: print(f"[page error] {e}"))
        page.goto(args.url)
        page.wait_for_function("window.READY === true", timeout=30000)
        seconds = args.seconds or (3.0 if args.smoke else page.evaluate("window.VIDEO_SECONDS"))
        total = int(round(seconds * args.fps))

        frames.mkdir(parents=True, exist_ok=True)
        for existing in frames.glob("*.png"):
            existing.unlink()
        for i in range(total):
            page.evaluate(f"window.renderFrame({i / args.fps!r})")
            page.screenshot(path=str(frames / f"{i:05d}.png"), type="png")
            if i % 120 == 0:
                print(f"  frame {i}/{total}", flush=True)
        print(f"frames: {total} PNGs -> {frames}/")
        browser.close()

    if args.mux:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ffmpeg", "-y", "-framerate", str(args.fps), "-i", str(frames / "%05d.png"),
             "-vf", "scale=1600:-2", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", "-an", str(args.out)],
            check=True,
        )
        print(f"muxed -> {args.out}")

    if args.poster:
        if not pathlib.Path(args.out).exists():
            print("no video to take a poster from: run with --mux first", file=sys.stderr)
            return 2
        poster = pathlib.Path(args.out).parent / "poster.jpg"
        # -ss AFTER -i: an input seek snaps to a keyframe and can show an earlier moment
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(args.out), "-ss", str(args.poster_at),
             "-frames:v", "1", "-q:v", "3", str(poster)],
            check=True,
        )
        print(f"poster -> {poster}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
