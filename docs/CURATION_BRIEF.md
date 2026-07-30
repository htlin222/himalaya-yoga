# 策展工作說明（所有章節 agent 共用）

專案根目錄：`/Users/htlin/yoga-course`

## 鐵則（違反等於整章作廢）

1. **video ID 一律取自 `tools/ytsearch.py` 的實際輸出。** 不可憑記憶拼湊、不可從別處抄。
   捏造一個看起來合理的 ID 比留空更糟。
2. **中繼資料照抄搜尋結果。** 長度、觀看數、頻道、標題必須與工具輸出逐字元一致，
   不可四捨五入、不可改寫、不可翻譯標題。
3. **找不到合格影片就留空**：`"url": null` 並在同層寫 `"note"` 說明**查過哪些關鍵字、
   為什麼都不合格**。留空而沒有 `note` 會被稽核判為錯誤。整章最多留 1 個空格子。
4. **誠實比湊數重要。** 寧可留一個有 note 的空格，也不要塞一支相關但不對題的影片。

## 唯一的取片工具

```bash
cd /Users/htlin/yoga-course
python3 tools/ytsearch.py "搜尋關鍵字" 15     # 輸出 id|mm:ss|秒|觀看數|頻道|標題
python3 tools/ytsearch.py --ids ID1,ID2       # 反查既有 id（確認還在線上）
```

一支影片平均要看過 10–20 個候選才選得好。**每個單元至少跑 2–4 次不同關鍵字的搜尋**
（中文一次、英文一次，必要時換同義詞）。搜尋是廉價的，選錯片是昂貴的。

## 選片品質門檻

**優先**（依序）：

1. 有專業背景的教師頻道（瑜伽師資、物理治療師、運動科學背景）
2. 傳統體系的機構頻道（Bihar School of Yoga, Isha, Sivananda, Himalayan Institute,
   Yoga International, Ekhart Yoga, Art of Living）
3. 高品質的大型教學頻道（Yoga With Adriene, Yoga With Kassandra, Breathe and Flow,
   Fightmaster Yoga, Yoga With Bird, SarahBethYoga, Move With Nicole, Charlie Follows,
   Ally Boothroyd, Travis Eliot, Rod Stryker, Arianna Elizabeth）
4. 繁體中文／台灣香港頻道（Flow With Katie, Yoga With Zoey, 凱蒂瑜伽, 佳芸老師,
   WeiWei 薇薇, Amy Yoga, 蔡佩茹, 三個字SunGuts 的解剖學單元）

**排除**：

- 觀看數 < 3,000（極冷門的傳統技法可放寬到 1,500，但要在 `why` 說明）
- 標題殺人（「7 天學會倒立」「一週瘦 5 公斤」）、純內容農場、AI 語音拼貼
- 純音樂／純脈輪頻率音檔（528Hz 那類）——這門課要的是**有教學或引導**的影片
- 明顯的商品導購影片

**語言**：英文與繁體中文都可以，**同等品質下優先繁中**。簡體中文可接受但排在最後。
無語音的純示範影片可以當 `align` 類，但主課（`lesson`）一定要有語音講解。

**長度偏好**（不是硬性，超出只會產生警告）：

- 主課 `lesson`：8–35 分鐘的教學講解為佳；情境練習章節的主課可以是 20–60 分鐘的完整課
- 延伸影片 `drills`：`align` 3–15 分鐘、`follow` 5–45 分鐘、`modify` 2–12 分鐘、
  `deepen` 5–25 分鐘

**不可重複**：同一個單元內不可出現兩支相同的 video ID。跨單元盡量不共用，
真的最適合就共用，但全章共用次數控制在 5 次以內。

## 影片類型 `kind`（四選一，必填）

| id | 標籤 | 放什麼 |
|---|---|---|
| `align` | 正位拆解 | 單一體式／技法的正位、解剖、常見錯誤的**拆解教學** |
| `follow` | 跟練 | 可以直接跟著做完的**完整練習或引導** |
| `modify` | 替代與輔具 | 用磚、帶、椅、牆的**替代版本**，或給受限身體的調整 |
| `deepen` | 進階變化 | 更深的變化式、進階前導、力量或柔軟度的**進階發展** |

每個單元的 drills 盡量涵蓋 2 種以上的 kind，不要一整個單元全是 `follow`。

## 輸出格式

寫兩個檔案（**只寫這兩個，不要碰其他檔案**）：

### 1. `course/data/ch<N>.json` — 策展資料

```json
{
  "chapter": "CH2",
  "title": "呼吸法 Pranayama",
  "units": [
    {
      "id": "ch2-u1",
      "name": "單元名稱（用我給的，不要改）",
      "type": "breath",
      "assessment": "讀者今天就能自己做的判準，不是問題描述。至少 80 字。",
      "tight": ["常見代償或錯誤 1", "常見錯誤 2"],
      "weak": ["這個單元在練的能力 1", "能力 2"],
      "lesson": {
        "title": "照抄搜尋結果的標題",
        "channel": "照抄頻道名",
        "url": "https://www.youtube.com/watch?v=<id>",
        "duration": "12:34",
        "why": "為什麼選這支，1–3 句，要具體到內容而不是空泛稱讚"
      },
      "drills": [
        {
          "name": "中文名稱",
          "en": "English name",
          "kind": "align",
          "target": "髖關節、腿後側",
          "dose": "每側 60 秒 × 3 輪",
          "title": "照抄搜尋結果的標題",
          "channel": "照抄頻道名",
          "url": "https://www.youtube.com/watch?v=<id>",
          "duration": "5:12"
        }
      ]
    }
  ]
}
```

`assessment` 只有 `type` 是 `asana` 或 `breath` 的單元強制要求（≥80 字），
其他型別**也請盡量寫**，但可以短一點。

`assessment` 要長什麼樣：**「靠牆站，腳跟離牆 5 公分，若後腦杓需刻意後仰才碰得到牆即為陽性」**
這種可以當場執行、當場得到答案的。不要寫「注意保持核心穩定」這種無法判定的句子。

`tight` = 常見代償與錯誤，`weak` = 這個單元在練什麼能力。各 2–5 項。

### `target` 的用字要能被分面索引抓到

`target` 會餵給 `course/taxonomy/regions.py` 產生篩選標籤。**請盡量從下面這組詞彙挑**
（可以多個，用「、」分隔）：

```
頸椎 胸椎 腰椎 薦髂關節 核心 骨盆底 橫膈 脊椎活動度
肩關節 肩胛 手腕 手肘 胸口
髖關節 臀部 腿後側 股四頭 內收肌 膝關節 腳踝 足底
後彎 前彎 扭轉 倒立 手臂支撐
平衡 呼吸控制 專注 放鬆與副交感
```

### 2. `course/data/meta-ch<N>.json` — 中繼資料

**這個檔案裡的每一個 id，都必須是你在 ch<N>.json 裡實際用到的**，反之亦然（一對一）。
`seconds` / `views` / `channel` / `title` 直接抄 `ytsearch.py` 的輸出。

```json
{
  "8VwufJrUhic": {
    "status": "OK",
    "seconds": 657,
    "views": 1514693,
    "channel": "Yoga With Adriene",
    "title": "Yoga Breathing | Alternate Nostril Breathing"
  }
}
```

`duration` 欄位（`ch<N>.json`）與 `seconds`（`meta-ch<N>.json`）必須對得上：
`seconds` 657 → `duration` `"10:57"`。誤差超過 30 秒會被稽核抓到。

## 完成前自己檢查

```bash
cd /Users/htlin/yoga-course
python3 - <<'PY'
import json,re
N="<你的章節數字>"
d=json.load(open(f"course/data/ch{N}.json"))
m=json.load(open(f"course/data/meta-ch{N}.json"))
ids=[]
for u in d["units"]:
    for slot in [u.get("lesson")] + u.get("drills",[]):
        if slot and slot.get("url"):
            ids.append(re.search(r"v=([\w-]+)",slot["url"]).group(1))
print("單元數",len(d["units"]))
print("drills 數",[len(u.get("drills",[])) for u in d["units"]])
print("影片欄位",len(ids),"｜meta 覆蓋",len(set(ids)-set(m))==0,"｜多餘 meta",set(m)-set(ids))
for u in d["units"]:
    s=set()
    for x in u.get("drills",[]):
        if x.get("url"):
            v=re.search(r"v=([\w-]+)",x["url"]).group(1)
            if v in s: print("!! 單元內重複",u["id"],v)
            s.add(v)
PY
```

單元數與每單元 drills 數必須**完全等於**指派給你的數字，多一個少一個都會讓建置失敗。
