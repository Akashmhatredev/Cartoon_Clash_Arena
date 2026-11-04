#!/usr/bin/env python3
"""Pack rendered sprite frames into a Phaser JSON-hash atlas (PNG + JSON) with trimmed frames and feet pivot.

Usage:
  pip3 install pillow
  python3 pack_spritesheet.py <frames_dir> <out_dir> [--name goku] [--max 4096] [--trim] [--webp]

<frames_dir> is the output of blender_render_sprites.py (subfolders per action plus manifest.json).
Writes <out_dir>/<name>.png (or .webp) and <out_dir>/<name>.json. Frame names are "<action>/<index>".
The pivot from manifest.json is written per frame so Phaser places the feet at the sprite position (frame.customPivot).
"""
import argparse
import json
import os
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit('Pillow is required: pip3 install pillow')


def load_frames(frames_dir, manifest, trim):
    items = []
    for action, files in manifest['actions'].items():
        for i, fname in enumerate(files):
            path = os.path.join(frames_dir, action, fname)
            img = Image.open(path).convert('RGBA')
            w, h = img.size
            box = img.getbbox() if trim else None
            if box is None:
                box = (0, 0, w, h) if not trim else (0, 0, 1, 1)
            crop = img.crop(box)
            items.append({
                'name': f'{action}/{i:03d}',
                'img': crop,
                'source': (w, h),
                'offset': (box[0], box[1]),
                'size': crop.size,
            })
    return items


def shelf_pack(items, max_w, pad):
    # tallest first, shelves left to right
    items = sorted(items, key=lambda it: (-it['size'][1], -it['size'][0]))
    x = y = shelf_h = 0
    width = 0
    for it in items:
        w, h = it['size']
        if w + pad * 2 > max_w:
            sys.exit(f"frame {it['name']} is wider ({w}px) than the atlas limit {max_w}")
        if x + w + pad * 2 > max_w:
            x = 0
            y += shelf_h
            shelf_h = 0
        it['pos'] = (x + pad, y + pad)
        x += w + pad * 2
        shelf_h = max(shelf_h, h + pad * 2)
        width = max(width, x)
    height = y + shelf_h
    return items, width, height


def next_pow2(n):
    p = 1
    while p < n:
        p <<= 1
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('frames_dir')
    ap.add_argument('out_dir')
    ap.add_argument('--name', default=None, help='atlas base name (default: frames_dir folder name)')
    ap.add_argument('--max', type=int, default=4096, help='maximum atlas width/height')
    ap.add_argument('--pad', type=int, default=2, help='padding around each frame in px')
    ap.add_argument('--trim', action='store_true', help='trim transparent borders (recommended)')
    ap.add_argument('--pow2', action='store_true', help='round the atlas size up to powers of two')
    ap.add_argument('--webp', action='store_true', help='write WebP instead of PNG')
    args = ap.parse_args()

    manifest_path = os.path.join(args.frames_dir, 'manifest.json')
    with open(manifest_path, encoding='utf-8') as fh:
        manifest = json.load(fh)
    name = args.name or os.path.basename(os.path.normpath(args.frames_dir))
    items = load_frames(args.frames_dir, manifest, args.trim)
    if not items:
        sys.exit('no frames found')
    items, width, height = shelf_pack(items, args.max, args.pad)
    if height > args.max:
        sys.exit(f'atlas height {height}px exceeds --max {args.max}; render fewer frames, use --trim, or split per action')
    if args.pow2:
        width, height = next_pow2(width), next_pow2(height)

    atlas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    frames = {}
    pivot = manifest.get('pivot', {'x': 0.5, 'y': 1.0})
    for it in items:
        x, y = it['pos']
        w, h = it['size']
        atlas.paste(it['img'], (x, y))
        sw, sh = it['source']
        ox, oy = it['offset']
        frames[it['name']] = {
            'frame': {'x': x, 'y': y, 'w': w, 'h': h},
            'rotated': False,
            'trimmed': bool(args.trim),
            'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h},
            'sourceSize': {'w': sw, 'h': sh},
            'pivot': {'x': pivot['x'], 'y': pivot['y']},
        }

    os.makedirs(args.out_dir, exist_ok=True)
    ext = 'webp' if args.webp else 'png'
    image_name = f'{name}.{ext}'
    image_path = os.path.join(args.out_dir, image_name)
    if args.webp:
        atlas.save(image_path, 'WEBP', quality=92, method=6)
    else:
        atlas.save(image_path, 'PNG', optimize=True)

    data = {
        'frames': frames,
        'meta': {
            'app': 'cartoon-clash pack_spritesheet.py',
            'image': image_name,
            'format': 'RGBA8888',
            'size': {'w': width, 'h': height},
            'scale': str(manifest.get('res', 1)),
            'heightPx': manifest.get('heightPx'),
            'animations': {a: [f'{a}/{i:03d}' for i in range(len(files))] for a, files in manifest['actions'].items()},
        },
    }
    with open(os.path.join(args.out_dir, f'{name}.json'), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=1)
    size_kb = os.path.getsize(image_path) / 1024
    print(f'{image_path}: {width}x{height}, {len(frames)} frames, {size_kb:.0f} kB')


if __name__ == '__main__':
    main()
