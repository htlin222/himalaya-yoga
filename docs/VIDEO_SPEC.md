# 影片策展規格（所有搜尋 agent 共用）

## 任務本質

為體態矯正課程的每個單元，挑選 **YouTube 上現存最佳的示範影片**。你不是在生成內容，
你是在策展 —— 每一條連結都必須是真實存在、且你已確認過的影片。

## 語言

繁體中文或英文皆可。同等品質下優先繁中。

## 頻道品質門檻（由高到低優先）

**英文 — 物理治療 / 運動科學背景**
- E3 Rehab、Precision Movement、Bob & Brad、Squat University、Tom Merrick
- Upright Health、Conor Harris、Movement by David、GMB Fitness、Low Back Ability

**繁中 / 華語 — 具專業背景**
- 三個字 SunGuts、好痛痛、史考特醫師、Hunter 物理治療、阿舜、Peeta 葛格
- 一分鐘健身教室、KFIT 健身俱樂部、筋肉媽媽

**排除**
- 純內容農場、無專業背景的健身網紅、標題殺人（「7 天矯正駝背」）
- 播放數 < 5,000 的影片（除非是稀有動作且頻道專業）
- 已下架 / 私人 / 地區封鎖的影片

## 選片準則

1. **示範清楚** — 看得到完整動作，有正面/側面角度更佳
2. **有講解重點** — 說明常見錯誤、代償、感受部位
3. **長度適中** — 跟練影片 1–8 分鐘；主課單元教學影片 5–20 分鐘
4. **單一動作優先** — Part 2 的跟練影片盡量一支對一個動作，不要用 30 分鐘合輯充數

## 驗證要求（重要）

每一個 YouTube URL 都必須實際驗證存在。做法：
- 用 WebSearch 找到影片後，用 WebFetch 打開 `https://www.youtube.com/watch?v=<id>` 確認
  標題與頻道，且頁面不是「Video unavailable」
- 影片 ID 是 11 碼。**絕對不要憑記憶或推測拼湊 video ID** —— 捏造的連結比缺漏更糟
- 若某個動作實在找不到合格影片，把 `url` 設為 `null` 並在 `note` 說明，不要硬塞

## 輸出格式

寫入你被指定的 JSON 檔案路徑。結構：

```json
{
  "chapter": "CH5",
  "title": "胸椎",
  "units": [
    {
      "id": "ch5-u1",
      "name": "駝背",
      "type": "posture",
      "assessment": "靠牆站立，後腦杓、上背、臀部三點貼牆，若後腦杓需刻意後仰才能貼牆即為陽性",
      "tight": ["胸大肌", "胸小肌", "上斜方肌", "枕下肌群"],
      "weak": ["中/下斜方肌", "菱形肌", "頸深屈肌"],
      "lesson": {
        "title": "影片標題",
        "channel": "頻道名",
        "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
        "duration": "12:34",
        "why": "一句話說明為何選這支"
      },
      "drills": [
        {
          "name": "胸小肌按摩球放鬆",
          "en": "Pec Minor Ball Release",
          "kind": "release",
          "target": "胸小肌",
          "dose": "每側 60 秒",
          "title": "影片標題",
          "channel": "頻道名",
          "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
          "duration": "3:21"
        }
      ]
    }
  ]
}
```

`kind` 三選一：`release`(🔵放鬆) / `stretch`(🟢拉伸) / `train`(🔴訓練)

## 動作設計原則

你要自己設計每個單元的動作清單（名稱、目標肌群、劑量），再去找對應影片。原則：

- **放鬆** 針對「緊繃側」肌群 — 滾筒、按摩球、徒手放鬆
- **拉伸** 針對同樣的緊繃側，但用主動/被動伸展
- **訓練** 針對「無力側」肌群 — 由簡入難，最後一兩個動作要接近功能性/整合性

動作之間不要重複。跨單元可以有少量重疊（例如胸小肌放鬆同時出現在圓肩與駝背），
但同一單元內不可重複。
