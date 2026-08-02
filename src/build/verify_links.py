#!/usr/bin/env python3
"""獨立驗證 course.json 內所有 YouTube 連結是否真的存在且可播放。

不信任任何上游宣稱，一律重打 YouTube oEmbed 端點。
被刪除／設為私人／地區封鎖的影片會回 401/403/404。
用法：
    python3 verify_links.py            # 驗證並列出失效連結
    python3 verify_links.py --prune    # 額外把失效連結的 url 改成 null 並註記原因
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COURSE = Path(os.environ.get("DIST") or ROOT / "dist").resolve() / "course.json"
OEMBED = "https://www.youtube.com/oembed?url={}&format=json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"


def check(url: str) -> tuple[str, bool, str]:
    """回傳 (url, ok, 說明)。ok=True 代表影片存在且可嵌入。"""
    endpoint = OEMBED.format(urllib.parse.quote(url, safe=""))
    req = urllib.request.Request(endpoint, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            meta = json.loads(res.read())
            return url, True, f"{meta.get('author_name', '?')} — {meta.get('title', '?')}"
    except urllib.error.HTTPError as e:
        reason = {
            401: "影片不允許嵌入或已設為私人",
            403: "受限制",
            404: "影片已刪除或網址錯誤",
        }.get(e.code, f"HTTP {e.code}")
        return url, False, reason
    except Exception as e:  # 逾時、DNS、TLS
        return url, False, f"連線失敗：{type(e).__name__}"


def walk(course: dict):
    """走訪所有影片節點，yield (章節碼, 單元 id, 標籤, 影片 dict)。"""
    for ch in course["chapters"]:
        for u in ch["units"]:
            # lessons 含各語言版本；沒有 lessons 時退回單一 lesson
            for les in u.get("lessons") or ([u["lesson"]] if u.get("lesson") else []):
                yield ch["code"], u["id"], f"主課 {les.get('lang', '')}".strip(), les
            for d in u.get("drills") or []:
                yield ch["code"], u["id"], d.get("name", "?"), d


def ref_urls(course: dict) -> dict[str, list[str]]:
    """傳承出處連結 -> 引用它的單元。

    fragment（#page=3）不會送到伺服器，去重時先剝掉，不然同一份 PDF 會被打好幾次。
    """
    out: dict[str, list[str]] = {}
    for ch in course["chapters"]:
        for u in ch["units"]:
            for ref in u.get("traditionRefs") or []:
                if url := ref.get("url"):
                    out.setdefault(url.split("#", 1)[0], []).append(f"{ch['code']} {u['id']}")
    return out


def check_ref(url: str) -> tuple[str, bool, str]:
    """出處連結能取到 200 就算活著。有些站不吃 HEAD，所以用 GET 但只讀開頭。"""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            res.read(2048)
            ctype = (res.headers.get("Content-Type") or "?").split(";")[0]
            return url, res.status == 200, f"HTTP {res.status} · {ctype}"
    except urllib.error.HTTPError as e:
        return url, False, f"HTTP {e.code}"
    except Exception as e:
        return url, False, f"連線失敗：{type(e).__name__}"


def verify_refs(course: dict) -> int:
    """驗證傳承立場的出處連結，回傳失效數。

    這些連結是「傳承怎麼說」唯一能被讀者核對的憑據，官網改版就會靜默失效，
    所以跟影片連結一樣要重打，不能只信寫進資料時那一次。
    """
    refs = ref_urls(course)
    if not refs:
        return 0

    print(f"\n檢查 {len(refs)} 個傳承出處連結…\n")
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(check_ref, sorted(refs)))

    dead = 0
    for url, ok, msg in results:
        cites = refs[url]
        print(f"   {'✓' if ok else '✗'} {url}")
        print(f"      {msg} · 被 {len(cites)} 處引用（{', '.join(sorted(set(cites))[:3])}…）")
        if not ok:
            dead += 1

    print(f"\n出處連結有效 {len(refs) - dead} / {len(refs)}")
    return dead


def main() -> int:
    prune = "--prune" in sys.argv
    course = json.loads(COURSE.read_text())

    nodes = list(walk(course))
    urls = sorted({v["url"] for *_, v in nodes if v.get("url")})
    print(f"檢查 {len(urls)} 個不重複連結（涵蓋 {len(nodes)} 個影片欄位）…\n")

    with ThreadPoolExecutor(max_workers=12) as pool:
        results = dict((u, (ok, msg)) for u, ok, msg in pool.map(check, urls))

    dead = {u: msg for u, (ok, msg) in results.items() if not ok}

    if dead:
        print(f"✗ {len(dead)} 個連結失效：\n")
        for code, uid, label, v in nodes:
            if v.get("url") in dead:
                print(f"   {code} {uid} · {label}")
                print(f"      {v['url']} — {dead[v['url']]}")
                if prune:
                    v["note"] = f"原連結已失效（{dead[v['url']]}），待補"
                    v["url"] = None
        if prune:
            COURSE.write_text(json.dumps(course, ensure_ascii=False, indent=1))
            print(f"\n→ 已將 {len(dead)} 個失效連結標記為 null 並寫回 course.json")
    else:
        print("✓ 全部連結有效")

    alive = len(urls) - len(dead)
    print(f"\n有效 {alive} / {len(urls)}（{alive / len(urls) * 100:.1f}%）")

    bad_refs = verify_refs(course)
    return 1 if (dead and not prune) or bad_refs else 0


if __name__ == "__main__":
    sys.exit(main())
