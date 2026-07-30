#!/usr/bin/env python3
"""把各章 agent 產出的 meta-ch*.json 合併成 build 需要的 video-meta.json，並交叉稽核。

框架讀的是單一 `course/data/video-meta.json`；策展 agent 各自寫 `meta-ch<N>.json`。
這支腳本負責合併，順便做四件 `make audit` 不會做的事：

1. 找出「策展資料用到、但沒有中繼資料」的影片（會讓 metaCoverage 不足）
2. 找出「有中繼資料、但沒有任何單元用到」的孤兒（agent 換片沒清乾淨）
3. 回報跨章節重複使用的影片（audit 只看單元層級）
4. 回報宣稱長度與實際秒數的誤差

用法：
    python3 tools/merge_meta.py            # 合併並報告
    python3 tools/merge_meta.py --check    # 只報告，不寫檔
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

DATA = Path("course/data")
VID = re.compile(r"(?:v=|youtu\.be/|embed/)([\w-]{11})")


def vid_of(url: str | None) -> str | None:
    if not url:
        return None
    m = VID.search(url)
    return m.group(1) if m else None


def mmss_to_sec(text: str | None) -> int | None:
    if not text or not re.fullmatch(r"\d+:\d{2}", text.strip()):
        return None
    m, s = text.strip().split(":")
    return int(m) * 60 + int(s)


def iter_slots():
    """走訪所有章節資料，yield (章節檔名, unit id, 欄位種類, slot dict)。"""
    for path in sorted(DATA.glob("ch*.json")):
        blob = json.loads(path.read_text())
        chapters = blob.get("chapters") or [blob]
        for ch in chapters:
            for unit in ch.get("units", []):
                lesson = unit.get("lesson")
                if lesson:
                    yield path.name, unit["id"], "lesson", lesson
                for d in unit.get("drills", []):
                    yield path.name, unit["id"], "drill", d
    alt = DATA / "alt-lessons-en.json"
    if alt.exists():
        for lesson in json.loads(alt.read_text()).get("lessons", []):
            yield alt.name, lesson.get("unit", "?"), "alt", lesson


def main() -> int:
    check_only = "--check" in sys.argv

    merged: dict[str, dict] = {}
    sources: dict[str, list[str]] = defaultdict(list)
    for path in sorted(DATA.glob("meta-ch*.json")):
        for vid, meta in json.loads(path.read_text()).items():
            sources[vid].append(path.name)
            if vid not in merged:
                merged[vid] = meta

    used: dict[str, list[str]] = defaultdict(list)
    drift: list[str] = []
    missing_note: list[str] = []
    for fname, uid, kind, slot in iter_slots():
        vid = vid_of(slot.get("url"))
        if not vid:
            if not (slot.get("note") or "").strip():
                missing_note.append(f"{fname} · {uid} · {kind} 留空但沒有 note")
            continue
        used[vid].append(f"{uid}/{kind}")
        claimed = mmss_to_sec(slot.get("duration"))
        actual = (merged.get(vid) or {}).get("seconds")
        if claimed is not None and isinstance(actual, int) and abs(claimed - actual) > 30:
            drift.append(f"{uid} {vid} 宣稱 {slot['duration']} 實際 {actual}s（差 {abs(claimed - actual)}s）")

    no_meta = sorted(set(used) - set(merged))
    orphans = sorted(set(merged) - set(used))
    shared = {v: u for v, u in used.items() if len({x.split("/")[0] for x in u}) > 1}

    print(f"影片欄位（含 alt）：{sum(len(v) for v in used.values())}")
    print(f"去重後影片：{len(used)}")
    print(f"中繼資料筆數：{len(merged)}")
    print(f"跨單元共用：{len(shared)} 支")
    if shared:
        for v, u in sorted(shared.items(), key=lambda x: -len(x[1]))[:12]:
            print(f"    {v} × {len(u)} → {', '.join(sorted({x.split('/')[0] for x in u}))}")
    if no_meta:
        print(f"\n✗ 缺中繼資料 {len(no_meta)} 支：{', '.join(no_meta[:20])}")
    if orphans:
        print(f"\n⚠ 孤兒中繼資料 {len(orphans)} 筆（沒有任何單元使用）：{', '.join(orphans[:20])}")
    if drift:
        print(f"\n⚠ 長度誤差 > 30 秒 {len(drift)} 筆：")
        for d in drift[:20]:
            print(f"    {d}")
    if missing_note:
        print(f"\n✗ 留空未說明 {len(missing_note)} 筆：")
        for m in missing_note[:20]:
            print(f"    {m}")

    if not check_only:
        # 孤兒不寫進去：video-meta.json 應該精確對應實際用到的影片
        out = {v: merged[v] for v in sorted(used) if v in merged}
        (DATA / "video-meta.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        )
        print(f"\n→ course/data/video-meta.json（{len(out)} 筆）")

    return 1 if (no_meta or missing_note) else 0


if __name__ == "__main__":
    raise SystemExit(main())
