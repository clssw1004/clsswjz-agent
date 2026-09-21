#!/usr/bin/env python3
"""
生成 web/ 站的 favicon / PWA 图标，以及 UI 内 logo badge 用的标记图。

素材来源（唯一真相）：clsswjz-gui 的 app logo
    ../clsswjz-gui/assets/images/app_logo.png   （1024x1024，猫 + "CLSSW" 文字的 lockup，1.5MB）

为什么不是直接把 GUI 那套图标拷过来：
  GUI 的 web 图标（flutter_launcher_icons 生成）是整个 lockup 缩到 16px，
  实测在浏览器标签页上 "CLSSW" 退化成灰噪点。这里改为只取猫头（去掉文字），
  衬在 web UI 既有的 logo badge 底色上（圆角 + --grad-brand 渐变，见
  web/src/styles/tokens.css:36 / Layout.vue 的 .logo-badge），16px 下仍可辨认。

两处产物：
  1. web/public/*.png|ico —— favicon + PWA 图标，底色烤进图里（图标无法跟主题变色）
  2. web/src/assets/logo-mark.png —— 透明底的猫头，给 UI 内 badge 当字形用；
     底色仍由 CSS 的 var(--grad-brand) 提供，这样 badge 能继续跟 20 套主题变色

用法：
    python3 scripts/generate-web-icons.py
依赖：Python 3 + Pillow（仅重新生成图标时需要，构建/运行不依赖）
"""

import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
SRC = REPO.parent / 'clsswjz-gui' / 'assets' / 'images' / 'app_logo.png'
OUT = REPO / 'web' / 'public'
# UI badge 用的字形：透明底猫头，底色交给 CSS。256px 够 42px badge 与 88px 关于页在
# 任何 DPR 下都清晰，且远小于 GUI 那张 1.5MB 的整图。
UI_MARK = REPO / 'web' / 'src' / 'assets' / 'logo-mark.png'
UI_MARK_SIZE = 256

# 猫头取景框（去掉底部 CLSSW 文字带；文字上沿在 y≈672，故截到 545 留白）
CAT_BOX = (258, 140, 772, 545)
# 灌泛判定的"背景"阈值：原图底色是 #F1F1F1→#F6F6F6 的渐变
BG_THRESHOLD = 232
# --grad-brand = linear-gradient(135deg, #2E6BE5, #5B8DEF)
GRAD_FROM, GRAD_TO = (46, 107, 229), (91, 141, 239)
# UI logo badge 圆角比例（Layout.vue 13/42、Mine.vue 17/56 均约 30%）
RADIUS_RATIO = 0.30
SS = 8  # 超采样倍数，用于圆角/边缘抗锯齿

# (文件名, 边长, 圆角比例, 猫头占比)
#   圆角为 0 = 满幅出血，交给平台自己裁（iOS squircle / Android maskable）
TARGETS = [
    ('favicon-16x16.png', 16, RADIUS_RATIO, 0.80),
    ('favicon-32x32.png', 32, RADIUS_RATIO, 0.80),
    ('icon-192.png', 192, RADIUS_RATIO, 0.80),
    ('icon-512.png', 512, RADIUS_RATIO, 0.80),
    ('apple-touch-icon.png', 180, 0, 0.72),
    ('maskable-512.png', 512, 0, 0.62),  # 占比压到安全圆内
]


def cutout_background(src: Image.Image) -> Image.Image:
    """从四角灌泛掉近白底，得到透明底的猫。

    猫被一圈粗黑描边围着，所以灌泛不会漏进猫脸内部。
    """
    w, h = src.size
    px = src.load()
    is_bg = lambda p: p[0] > BG_THRESHOLD and p[1] > BG_THRESHOLD and p[2] > BG_THRESHOLD

    seen = bytearray(w * h)
    queue = deque()
    seeds = [(x, y) for x in range(w) for y in (0, h - 1)]
    seeds += [(x, y) for y in range(h) for x in (0, w - 1)]
    for x, y in seeds:
        if is_bg(px[x, y]) and not seen[y * w + x]:
            seen[y * w + x] = 1
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_bg(px[nx, ny]):
                seen[ny * w + nx] = 1
                queue.append((nx, ny))

    mask = Image.frombytes('L', (w, h), bytes(0 if v else 255 for v in seen))
    out = src.convert('RGBA')
    out.putalpha(mask)
    return out


def square_crop(im: Image.Image, box) -> Image.Image:
    """裁剪并居中到正方形画布。"""
    c = im.crop(box)
    w, h = c.size
    side = max(w, h)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(c, ((side - w) // 2, (side - h) // 2))
    return canvas


def gradient(size: int) -> Image.Image:
    """135deg 线性渐变（低分辨率算完再放大——渐变本身是平滑的，放大无损观感）。"""
    step = 256
    small = Image.new('RGB', (step, step))
    p = small.load()
    denom = 2 * step - 2
    for y in range(step):
        for x in range(step):
            t = (x + y) / denom
            p[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(GRAD_FROM, GRAD_TO))
    return small.resize((size, size), Image.LANCZOS)


def render(cat: Image.Image, size: int, radius_ratio: float, cat_ratio: float) -> Image.Image:
    big = size * SS
    badge = gradient(big).convert('RGBA')
    if radius_ratio:
        mask = Image.new('L', (big, big), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, big - 1, big - 1], radius=int(big * radius_ratio), fill=255
        )
        badge.putalpha(mask)

    n = int(big * cat_ratio)
    head = cat.resize((n, n), Image.LANCZOS)
    badge.paste(head, ((big - n) // 2, (big - n) // 2), head)
    return badge.resize((size, size), Image.LANCZOS)


def main() -> int:
    if not SRC.exists():
        print(f'找不到素材：{SRC}', file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    cat = square_crop(cutout_background(Image.open(SRC).convert('RGB')), CAT_BOX)

    for name, size, radius, ratio in TARGETS:
        render(cat, size, radius, ratio).save(OUT / name, optimize=True)
        print(f'  {name}  {size}x{size}')

    # favicon.ico：16/32/48 三档打包（从 256 渲染图缩下去，避免 PIL 内部用低质量重采样）
    ico_src = render(cat, 256, RADIUS_RATIO, 0.80)
    ico_src.save(OUT / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    print('  favicon.ico  16+32+48')

    # UI badge 字形：透明底、铺满画布（内缩多少由 CSS 决定）
    UI_MARK.parent.mkdir(parents=True, exist_ok=True)
    cat.resize((UI_MARK_SIZE, UI_MARK_SIZE), Image.LANCZOS).save(UI_MARK, optimize=True)
    print(f'  {UI_MARK.relative_to(REPO)}  {UI_MARK_SIZE}x{UI_MARK_SIZE} (透明底)')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
