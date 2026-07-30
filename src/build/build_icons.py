#!/usr/bin/env python3
"""下載 Lucide 圖示並打包成內嵌 SVG sprite（public/js/icons.js）。

網站不吃任何外部請求，圖示在建置時就打包進 JS。
要新增圖示：把名稱加進 ICONS，重跑本腳本。
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

LUCIDE_VERSION = "0.469.0"
CDN = f"https://unpkg.com/lucide-static@{LUCIDE_VERSION}/icons/{{}}.svg"
OUT = Path(__file__).resolve().parents[2] / "src" / "web" / "js" / "icons.js"

ICONS = [
    # 介面
    "activity",
    "search",
    "x",
    "sun",
    "moon",
    "chevron-right",
    "chevron-left",
    "check",
    "play",
    "external-link",
    "layers",
    "rotate-ccw",
    "inbox",
    "info",
    "clock",
    "star",
    "users",
    "graduation-cap",
    "microscope",
    "eye",
    "grip-vertical",
    "message-circle",
    "github",
    # paywall
    "lock",
    "lock-open",
    "shopping-cart",
    "receipt",
    "credit-card",
    "tag",
    "sparkles",
    "circle-check-big",
    "trash-2",
    # 單元內容
    "clipboard-check",
    "triangle-alert",
    "flame",
    "battery-low",
    "dumbbell",
    "move-vertical",
    "circle-dot",
    "zap",
    "target",
    "shield-check",
    "accessibility",
    "scan-line",
    "book-open",
    "compass",
    "armchair",
    "hand",
    "scroll-text",
    "flower",
    "heart-pulse",
    "waves",
    "anchor",
    # 章節
    "user-round",  # CH4 頸椎
    "bone",  # CH5 胸椎
    "shirt",  # CH7 肩胛骨
    "diamond",  # CH8 骨盆
    "move-diagonal",  # CH10 膝蓋
    "footprints",  # CH11 足踝
    "wind",  # CH3 呼吸
]


def fetch(name: str) -> tuple[str, str | None]:
    try:
        with urllib.request.urlopen(CDN.format(name), timeout=20) as res:
            svg = res.read().decode()
        inner = re.search(r"<svg[^>]*>(.*?)</svg>", svg, re.S).group(1)
        return name, re.sub(r"\s+", " ", inner).strip()
    except (urllib.error.HTTPError, AttributeError):
        return name, None


def main() -> int:
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = dict(pool.map(fetch, sorted(set(ICONS))))

    missing = [n for n, v in results.items() if v is None]
    if missing:
        print(f"✗ 取不到 {len(missing)} 個圖示：{', '.join(missing)}", file=sys.stderr)
        return 1

    names = sorted(results)
    sprite = "".join(f'<symbol id="i-{n}" viewBox="0 0 24 24">{results[n]}</symbol>' for n in names)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(f"""\
// icons.js — 由 build_icons.py 產生，請勿手動編輯
// Lucide v{LUCIDE_VERSION}（ISC License）· https://lucide.dev/icons/
export const ICON_SPRITE =
  {json.dumps(sprite, ensure_ascii=False)};

export const ICON_NAMES = {json.dumps(names, ensure_ascii=False, indent=2)};

/** 注入 sprite 到 document，只需呼叫一次 */
export function mountIcons() {{
  if (document.getElementById("lucide-sprite")) return;
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("id", "lucide-sprite");
  el.setAttribute("aria-hidden", "true");
  el.style.display = "none";
  el.innerHTML = ICON_SPRITE;
  document.body.prepend(el);
}}

/** 產生一個 <svg><use></svg> 字串 */
export function icon(name, size = 16, cls = "") {{
  return `<svg class="${{cls}}" width="${{size}}" height="${{size}}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-${{name}}"/></svg>`;
}}
""")
    print(
        f"→ {OUT.relative_to(Path(__file__).resolve().parents[2])}  {len(names)} 個圖示，{OUT.stat().st_size / 1024:.1f} KB"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
