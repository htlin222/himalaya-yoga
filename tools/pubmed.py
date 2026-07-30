#!/usr/bin/env python3
"""PubMed E-utilities 查詢——實證查核唯一允許的 PMID 來源。

鐵則：PMID 與標題一律取自 API 回傳值，不可憑記憶填寫。
`make verify` 會重打 esummary 比對每一筆，對不上就是捏造。

用法：
    python3 tools/pubmed.py search "yoga chronic low back pain systematic review" 8
    python3 tools/pubmed.py get 31629406,29694674
    python3 tools/pubmed.py --json search "slow breathing heart rate variability" 10
"""

from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request

BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
UA = "himalaya-yoga-curation/1.0 (https://github.com/htlin222/himalaya-yoga)"


def _get(url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception:
            if attempt == retries - 1:
                return {}
            time.sleep(1.5 * (attempt + 1))
    return {}


def search(term: str, n: int = 10) -> list[str]:
    q = urllib.parse.urlencode(
        {"db": "pubmed", "retmode": "json", "retmax": n, "term": term, "sort": "relevance"}
    )
    data = _get(f"{BASE}/esearch.fcgi?{q}")
    return data.get("esearchresult", {}).get("idlist", [])


def summary(pmids: list[str]) -> list[dict]:
    if not pmids:
        return []
    q = urllib.parse.urlencode({"db": "pubmed", "retmode": "json", "id": ",".join(pmids)})
    data = _get(f"{BASE}/esummary.fcgi?{q}").get("result", {})
    out = []
    for pid in data.get("uids", []):
        rec = data.get(pid, {})
        pubtypes = [t for t in rec.get("pubtype", [])]
        out.append(
            {
                "pmid": pid,
                "title": rec.get("title", "").rstrip("."),
                "journal": rec.get("source", ""),
                "year": (rec.get("pubdate", "") or "")[:4],
                "pubtype": pubtypes,
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pid}/",
            }
        )
    return out


def main() -> int:
    args = sys.argv[1:]
    as_json = False
    if args and args[0] == "--json":
        as_json, args = True, args[1:]
    if not args:
        print(__doc__)
        return 1

    cmd = args[0]
    if cmd == "search":
        pmids = search(args[1], int(args[2]) if len(args) > 2 else 10)
        rows = summary(pmids)
    elif cmd == "get":
        rows = summary(args[1].split(","))
    else:
        print(__doc__)
        return 1

    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        for r in rows:
            types = "/".join(t for t in r["pubtype"] if t != "Journal Article") or "article"
            print(f"{r['pmid']} | {r['year']} | {types} | {r['journal']} | {r['title']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
