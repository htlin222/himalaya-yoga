#!/usr/bin/env python3
"""練習類別定義與比對。

五百多支延伸影片其實只有數十種練習原型。單一動作（例如「下犬式」）沒有專屬文獻，
但它所屬的類別（「站姿與負重體式」）有。文獻掛在類別上才站得住腳。

比對規則：patterns 內任一關鍵字出現在 名稱 / 英文名 / 目標 / 影片標題 即命中。
由上而下比對，先命中者勝——所以特異的類別要排在通用類別前面。
"""

from __future__ import annotations

import re

# (id, 顯示名稱, kind, 比對關鍵字)
CATEGORIES: list[tuple[str, str, str, list[str]]] = [
    # ---- 呼吸法：特異者優先 ----
    ("bhastrika", "風箱式呼吸（強力換氣）", "align", ["Bhastrika", "風箱", "Bellows"]),
    ("kapalbhati", "頭顱發光呼吸（腹部幫浦）", "align", ["Kapalbhati", "頭顱發光", "Skull Shining"]),
    (
        "nadi-shodhana",
        "鼻孔交替呼吸",
        "align",
        ["Nadi Shodhana", "Anulom", "鼻孔交替", "Alternate Nostril"],
    ),
    ("ujjayi", "海洋式呼吸", "align", ["Ujjayi", "海洋", "喉式呼吸", "Ocean Breath"]),
    ("bhramari", "蜂鳴式呼吸", "align", ["Bhramari", "蜂鳴", "Humming Bee"]),
    ("sheetali", "清涼呼吸法", "align", ["Sheetali", "Sitali", "Sheetkari", "清涼", "Cooling Breath"]),
    (
        "slow-breathing",
        "慢速與延長吐氣呼吸法",
        "align",
        ["延長吐氣", "腹式呼吸", "橫膈呼吸", "Diaphragmatic", "Coherent", "Slow Breathing", "4-7-8"],
    ),
    ("mantra-chant", "唱誦與嗡音", "follow", ["Mantra", "唱誦", "嗡音", "Chant", "OM", "Udgeet", "Bija"]),
    ("breath-retention", "止息與屏息", "deepen", ["Kumbhaka", "止息", "屏息", "Retention"]),
    # ---- 能量鎖與淨化 ----
    ("bandha", "能量鎖 Bandha", "align", ["Bandha", "能量鎖", "Mula", "Uddiyana", "Jalandhara", "收束"]),
    ("mudra", "手印 Mudra", "align", ["Mudra", "手印", "Chin ", "Gyan"]),
    ("kriya", "淨化法 Kriya", "align", ["Kriya", "Neti", "Trataka", "淨化法", "洗鼻", "凝視法"]),
    # ---- 冥想 ----
    ("yoga-nidra", "瑜伽睡眠 Yoga Nidra", "follow", ["Nidra", "瑜伽睡眠", "身體掃描", "Body Scan"]),
    (
        "meditation",
        "靜坐與正念冥想",
        "follow",
        ["冥想", "Meditation", "正念", "Mindfulness", "靜坐", "Dhyana", "觀息"],
    ),
    ("visualization", "觀想與引導想像", "follow", ["觀想", "Visualization", "引導想像", "Guided Imagery"]),
    # ---- 體式：依動作方向分類，特異者優先 ----
    (
        "inversion",
        "倒立體式",
        "deepen",
        ["倒立", "Inversion", "頭立", "肩立", "Headstand", "Shoulderstand", "Sirsasana", "Sarvangasana", "犁式", "Halasana"],
    ),
    (
        "arm-balance",
        "手臂支撐體式",
        "deepen",
        ["手臂支撐", "Arm Balance", "烏鴉", "Crow", "Bakasana", "Chaturanga", "側棒", "Handstand", "手倒立"],
    ),
    (
        "backbend",
        "後彎體式",
        "align",
        ["後彎", "Backbend", "眼鏡蛇", "Cobra", "上犬", "駱駝", "Camel", "輪式", "Wheel", "Urdhva", "弓式", "Bow", "橋式", "Bridge", "開胸"],
    ),
    (
        "forward-fold",
        "前彎體式",
        "align",
        ["前彎", "Forward Fold", "Forward Bend", "Paschimottanasana", "站姿前彎", "Uttanasana", "折疊"],
    ),
    ("twist", "扭轉體式", "align", ["扭轉", "Twist", "Matsyendrasana", "Marichyasana", "旋轉"]),
    (
        "hip-opening",
        "開髖體式",
        "align",
        ["開髖", "Hip Open", "鴿式", "Pigeon", "蝴蝶", "Baddha Konasana", "青蛙", "Frog", "束角", "劈腿", "Hanumanasana"],
    ),
    (
        "standing-pose",
        "站姿與負重體式",
        "align",
        ["站姿", "Standing", "戰士", "Warrior", "Virabhadrasana", "三角", "Trikonasana", "山式", "Tadasana", "椅式", "Utkatasana", "下犬", "Downward"],
    ),
    (
        "balance-pose",
        "平衡體式",
        "align",
        ["平衡", "Balance", "樹式", "Tree", "Vrksasana", "單腳", "鷹式", "Garudasana", "舞王", "Natarajasana"],
    ),
    (
        "core-strength",
        "核心與穩定訓練",
        "deepen",
        ["核心訓練", "Core Strength", "棒式", "Plank", "船式", "Navasana", "Boat", "腹部訓練"],
    ),
    (
        "restorative",
        "修復與陰瑜伽",
        "follow",
        ["修復", "Restorative", "陰瑜伽", "Yin", "大休息", "Savasana", "攤屍", "支撐", "抱枕", "Bolster"],
    ),
    (
        "sun-salutation",
        "拜日式與串連流動",
        "follow",
        ["拜日", "Sun Salutation", "Surya Namaskar", "拜月", "Moon Salutation", "Chandra", "串連", "Vinyasa", "Flow"],
    ),
    (
        "joint-mobility",
        "關節活動度與暖身",
        "align",
        ["暖身", "Warm-Up", "Warm Up", "活動度", "Mobility", "貓牛", "Cat Cow", "Pawanmuktasana", "關節運動", "手腕保健"],
    ),
    (
        "prop-modification",
        "輔具與替代式",
        "modify",
        ["輔具", "Prop", "磚", "Block", "伸展帶", "Strap", "椅子", "Chair", "牆", "Wall", "替代", "Modification", "Beginner"],
    ),
    (
        "stretch-flexibility",
        "靜態伸展與柔軟度",
        "align",
        ["伸展", "Stretch", "柔軟度", "Flexibility", "拉筋"],
    ),
]


def _match(cat_patterns: list[str], haystack: str) -> bool:
    for p in cat_patterns:
        if (
            re.search(p, haystack, re.I)
            if any(c in p for c in ".*+?[]")
            else p.lower() in haystack.lower()
        ):
            return True
    return False


def classify(drill: dict) -> str | None:
    """回傳練習所屬的類別 id。"""
    hay = " ".join(str(drill.get(k) or "") for k in ("name", "en", "target", "title"))
    kind = drill.get("kind")
    # 先在同 kind 內找，避免通用關鍵字跨類別誤抓
    for cid, _, ck, pats in CATEGORIES:
        if ck == kind and _match(pats, hay):
            return cid
    for cid, _, ck, pats in CATEGORIES:
        if ck != kind and _match(pats, hay):
            return cid
    return None


NAMES = {cid: name for cid, name, _, _ in CATEGORIES}
KINDS = {cid: kind for cid, _, kind, _ in CATEGORIES}
