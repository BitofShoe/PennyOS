#!/usr/bin/env python3
"""
Remove baked-in checkerboard / neutral matte backgrounds from Penny sprite PNGs.

Uses edge-connected flood fill: only pixels reachable from the image border
through low-chroma (gray) pixels in a luminance band are cleared to transparent.

Default: only `decor/pixel-blossoms.png` (the one asset that tolerated this well).
Use `--all` to process every PNG (heuristic; can leave halos on some art).
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

DEFAULT_TARGETS = ("decor/pixel-blossoms.png",)

# (chroma_max, lum_min, lum_max) — light checker / light gray export mistakes
# lum_min ~100 catches ~105,105,105 tiles that sit between “dark matte” and “bright” bands
LIGHT_BANDS = ((22, 100, 248),)
# Dark UI-style mattes (chibi avatars, full mood sprites) + darker checker tiles
DARK_BANDS = ((32, 8, 110),)


def _flood_transparent_mask(rgb: np.ndarray, chroma_max: int, lum_min: float, lum_max: float) -> np.ndarray:
    im = np.asarray(rgb, dtype=np.int16)
    h, w = im.shape[:2]
    mx = im.max(axis=2)
    mn = im.min(axis=2)
    lum = im.sum(axis=2) / 3.0
    chroma = mx - mn
    gray_like = (chroma < chroma_max) & (lum >= lum_min) & (lum <= lum_max)
    vis = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if gray_like[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if gray_like[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and gray_like[ny, nx] and not vis[ny, nx]:
                vis[ny, nx] = True
                q.append((ny, nx))
    return vis


def strip_background(im: Image.Image) -> Image.Image:
    """Recompute alpha from RGB only so second passes stay consistent."""
    arr = np.array(im.convert("RGBA") if im.mode == "RGBA" else im.convert("RGB"), dtype=np.uint8)
    rgb = arr[:, :, :3]
    transparent = np.zeros(rgb.shape[:2], dtype=bool)
    for chroma_max, lo, hi in LIGHT_BANDS:
        transparent |= _flood_transparent_mask(rgb, chroma_max, lo, hi)
    for chroma_max, lo, hi in DARK_BANDS:
        transparent |= _flood_transparent_mask(rgb, chroma_max, lo, hi)
    out = np.zeros((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
    out[:, :, :3] = rgb
    out[:, :, 3] = np.where(transparent, 0, 255)
    return Image.fromarray(out, "RGBA")


def main() -> None:
    parser = argparse.ArgumentParser(description="Strip baked checkerboard / gray mattes from sprite PNGs.")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process every PNG under public/sprites (default: only decor/pixel-blossoms.png).",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    sprites = root / "public" / "sprites"
    if not sprites.is_dir():
        raise SystemExit(f"Missing {sprites}")
    if args.all:
        paths = sorted(sprites.rglob("*.png"))
    else:
        paths = [sprites / rel for rel in DEFAULT_TARGETS]
        missing = [p for p in paths if not p.is_file()]
        if missing:
            raise SystemExit(f"Missing expected file(s): {missing}")
    for path in paths:
        im = Image.open(path)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA")
        out = strip_background(im)
        tmp_path = path.with_suffix(".tmp.png")
        try:
            out.save(tmp_path, format="PNG", compress_level=6)
            tmp_path.replace(path)
        except Exception:
            tmp_path.unlink(missing_ok=True)
            raise
        n_clear = int((np.array(out)[:, :, 3] == 0).sum())
        pct = 100.0 * n_clear / (out.size[0] * out.size[1])
        print(f"{path.relative_to(root)}  cleared {pct:.1f}%")
    print(f"Done. {len(paths)} files.")


if __name__ == "__main__":
    main()
