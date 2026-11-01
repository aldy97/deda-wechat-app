#!/usr/bin/env python3
"""从唯一 WXSS 色板同步 TabBar PNG 图标颜色，保留原始透明度。"""
from pathlib import Path
import re
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PALETTE = ROOT / "miniprogram/styles/palette.wxss"
ICON_DIR = ROOT / "miniprogram/static/icons/tabbar"

values = dict(re.findall(r"--([\w-]+):\s*([^;]+);", PALETTE.read_text()))


def resolve(name: str) -> str:
    value = values[name].strip()
    match = re.fullmatch(r"var\(--([\w-]+)\)", value)
    return resolve(match.group(1)) if match else value


def rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


colors = {
    "normal": rgb(resolve("color-tab-text")),
    "selected": rgb(resolve("color-tab-active")),
}

for path in ICON_DIR.glob("*.png"):
    state = "selected" if path.stem.endswith("-selected") else "normal"
    image = Image.open(path).convert("RGBA")
    pixels = [
        (*colors[state], alpha) if alpha else (0, 0, 0, 0)
        for _, _, _, alpha in image.getdata()
    ]
    image.putdata(pixels)
    image.save(path)
    token = "color-tab-active" if state == "selected" else "color-tab-text"
    print(f"已同步 {path.relative_to(ROOT)} -> {resolve(token)}")
