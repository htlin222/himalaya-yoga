#!/usr/bin/env python3
"""YouTube 搜尋與中繼資料抓取——策展 agent 唯一允許的取片來源。

為什麼不是 WebSearch / 記憶：video ID 必須來自 YouTube 的即時索引。
yt-dlp 的搜尋結果同時給出 id / 長度 / 觀看數 / 頻道 / 標題，
所以「策展」與「補中繼資料」兩步可以一次完成，而且中繼資料保證不是猜的。

用法：
    python3 tools/ytsearch.py "nadi shodhana tutorial" 12
    python3 tools/ytsearch.py --ids dQw4w9WgXcQ,abc123      # 反查既有 id
    python3 tools/ytsearch.py --json "query" 10             # 機器可讀

輸出欄位以 | 分隔：id | mm:ss | 秒 | 觀看數 | 頻道 | 標題
"""

from __future__ import annotations

import json
import subprocess
import sys

PRINT_FMT = "%(id)s\t%(duration)s\t%(view_count)s\t%(channel)s\t%(title)s"


def _run(args: list[str], timeout: int = 180) -> list[str]:
    try:
        r = subprocess.run(
            ["yt-dlp", "--no-warnings", "--ignore-errors", *args],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return []
    return [ln for ln in r.stdout.splitlines() if ln.strip()]


def _parse(lines: list[str]) -> list[dict]:
    out = []
    for ln in lines:
        parts = ln.split("\t")
        if len(parts) < 5:
            continue
        vid, dur, views, channel, title = parts[0], parts[1], parts[2], parts[3], "\t".join(parts[4:])
        try:
            secs = int(float(dur))
        except (ValueError, TypeError):
            secs = 0
        try:
            v = int(float(views))
        except (ValueError, TypeError):
            v = 0
        out.append(
            {
                "id": vid,
                "seconds": secs,
                "duration": f"{secs // 60}:{secs % 60:02d}",
                "views": v,
                "channel": channel,
                "title": title,
            }
        )
    return out


def search(query: str, n: int = 10) -> list[dict]:
    return _parse(_run(["--flat-playlist", "--print", PRINT_FMT, f"ytsearch{n}:{query}"]))


def lookup(ids: list[str]) -> list[dict]:
    urls = [f"https://www.youtube.com/watch?v={i.strip()}" for i in ids if i.strip()]
    return _parse(_run(["--skip-download", "--print", PRINT_FMT, *urls]))


def main() -> int:
    args = sys.argv[1:]
    as_json = False
    if args and args[0] == "--json":
        as_json, args = True, args[1:]
    if not args:
        print(__doc__)
        return 1

    if args[0] == "--ids":
        rows = lookup(args[1].split(","))
    else:
        rows = search(args[0], int(args[1]) if len(args) > 1 else 10)

    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        for r in rows:
            print(
                f"{r['id']}|{r['duration']}|{r['seconds']}|{r['views']}|{r['channel']}|{r['title']}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
