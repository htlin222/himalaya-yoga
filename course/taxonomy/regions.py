#!/usr/bin/env python3
"""身體部位與能力維度的正規化與分組。

體態課的分面維度是肌群；瑜伽課不一樣——學習者搜尋時想的是「開髖」「後彎」
「手腕會痛」「平衡站不穩」，那是**部位 + 能力**的混合維度，不是單一肌肉。

各章策展 agent 各自命名，同一個概念會有多種寫法（髖屈肌／髂腰肌／hip flexor），
必須先統一才能拿來當篩選維度。
"""

from __future__ import annotations

import re

# 標準名 -> 別名。比對時「別名出現在字串中」即視為命中。
SYNONYMS: dict[str, list[str]] = {
    # ---- 脊椎與軀幹 ----
    "頸椎": ["頸部", "脖子", "頸椎", "Neck", "Cervical", "喉部"],
    "胸椎": ["胸椎", "上背", "Thoracic", "胸廓", "肋廓"],
    "腰椎": ["腰椎", "下背", "Lumbar", "Low Back", "腰部"],
    "薦髂關節": ["薦髂", "骶髂", "SI Joint", "Sacroiliac", "薦骨", "骶骨"],
    "核心": ["核心", "Core", "腹橫肌", "腹部深層", "腹肌", "Abdominal"],
    "骨盆底": ["骨盆底", "Pelvic Floor", "會陰", "Mula", "根鎖"],
    "橫膈": ["橫膈", "Diaphragm", "呼吸肌", "肋間肌"],
    # ---- 上肢 ----
    "肩關節": ["肩關節", "肩膀", "Shoulder", "肩袖", "旋轉肌", "三角肌"],
    "肩胛": ["肩胛", "Scapula", "前鋸肌", "菱形肌", "斜方肌"],
    "手腕": ["手腕", "腕關節", "Wrist", "腕隧道"],
    "手肘": ["手肘", "肘關節", "Elbow", "肱三頭", "肱二頭"],
    "胸口": ["胸口", "胸大肌", "Chest", "胸小肌", "前胸", "Pectoral"],
    # ---- 下肢 ----
    "髖關節": ["髖關節", "髖部", "Hip", "開髖", "髖屈肌", "髂腰肌", "腰大肌"],
    "臀部": ["臀部", "臀肌", "Glute", "臀大肌", "臀中肌", "梨狀肌"],
    "腿後側": ["腿後", "膕旁肌", "Hamstring", "腿後肌", "大腿後側"],
    "股四頭": ["股四頭", "Quadriceps", "大腿前側", "Quad"],
    "內收肌": ["內收肌", "Adductor", "鼠蹊", "大腿內側", "Groin"],
    "膝關節": ["膝關節", "膝蓋", "Knee", "半月板"],
    "腳踝": ["腳踝", "踝關節", "Ankle", "阿基里斯", "小腿", "Calf"],
    "足底": ["足底", "足弓", "Plantar", "Foot", "腳掌", "腳趾"],
    # ---- 能力與系統維度 ----
    "平衡": ["平衡", "Balance", "單腳", "本體感覺", "Proprioception"],
    "呼吸控制": ["呼吸", "Breath", "Pranayama", "吐納", "調息", "換氣"],
    "專注": ["專注", "Focus", "Drishti", "凝視", "覺知", "Concentration", "Dharana"],
    "放鬆與副交感": [
        "放鬆",
        "Relax",
        "副交感",
        "助眠",
        "Restorative",
        "修復",
        "Nidra",
        "減壓",
        "Stress",
        "安神",
    ],
    "脊椎活動度": ["脊椎活動", "Spinal Mobility", "脊柱", "Spine", "貓牛"],
    "後彎": ["後彎", "Backbend", "開胸", "Heart Opener", "輪式", "駱駝式"],
    "前彎": ["前彎", "Forward Fold", "Forward Bend", "折疊"],
    "扭轉": ["扭轉", "Twist", "旋轉脊椎"],
    "倒立": ["倒立", "Inversion", "頭立", "肩立", "手倒立", "Headstand", "Shoulderstand"],
    "手臂支撐": ["手臂支撐", "Arm Balance", "烏鴉式", "Crow", "Chaturanga", "臂力"],
}

GROUPS: dict[str, list[str]] = {
    "脊椎與軀幹": ["頸椎", "胸椎", "腰椎", "薦髂關節", "核心", "骨盆底", "橫膈", "脊椎活動度"],
    "上肢": ["肩關節", "肩胛", "手腕", "手肘", "胸口"],
    "下肢": ["髖關節", "臀部", "腿後側", "股四頭", "內收肌", "膝關節", "腳踝", "足底"],
    "動作方向": ["後彎", "前彎", "扭轉", "倒立", "手臂支撐"],
    "能力": ["平衡", "呼吸控制", "專注", "放鬆與副交感"],
}

GROUP_OF = {m: g for g, ms in GROUPS.items() for m in ms}

# 這些是泛稱或非部位描述，不納入索引——否則每個單元都會命中，篩選就失去意義
NOT_A_REGION = re.compile(r"^全身$|^整體$|^身心$|^能量$|^氣$|^脈輪$|^意識$|^情緒$")

_LOOKUP = sorted(
    [(alias, canon) for canon, aliases in SYNONYMS.items() for alias in [canon, *aliases]],
    key=lambda x: -len(x[0]),
)


def split_targets(text: str | None) -> list[str]:
    """把 '髖關節、腿後側 / 核心' 這種字串拆成片段。"""
    if not text:
        return []
    parts = re.split(r"[、,，/／;；]|\s+與\s+|\s+及\s+|\s+和\s+", text)
    return [p.strip(" 　()（）") for p in parts if p.strip(" 　()（）")]


def canonical(term: str) -> str | None:
    """把一個片段映射到標準部位／能力名；對不上則回 None。"""
    term = term.strip()
    if not term or NOT_A_REGION.search(term):
        return None
    for alias, canon in _LOOKUP:
        if alias and alias.lower() in term.lower():
            return canon
    return None


def extract(*texts: str | None) -> list[str]:
    """從任意數量的描述字串中抽出去重後的標準名（保持出現順序）。"""
    out: list[str] = []
    for text in texts:
        for part in split_targets(text):
            c = canonical(part)
            if c and c not in out:
                out.append(c)
    return out
