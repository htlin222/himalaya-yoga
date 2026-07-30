# 實證查核工作說明（所有實證 agent 共用）

專案根目錄：`/Users/htlin/yoga-course`

## 為什麼要做這件事

這門課教的是一套有幾千年歷史的傳統技術，市場上充滿未經查證的療效宣稱。
這一層的目的是把「**傳統怎麼說**」與「**文獻怎麼說**」分開陳述，
兩者不一致時，**照實寫出不一致**。

一門承認自己限制的課，比一門承諾一切的課可信得多。

## 鐵則

1. **PMID 一律取自 `tools/pubmed.py` 的 API 回傳值**，不可憑記憶填寫、不可自行拼湊。
   `title` / `journal` / `year` 也一律照抄 API 輸出，不要改寫、不要翻譯。
   `make verify` 會重打 esummary 逐筆比對，對不上就是捏造，整批作廢。
2. **證據等級照實填**。查出來對這門課不利就照寫，不要美化。
   坊間說法沒有證據支持時，`traditional_claim` 與 `what_evidence_shows` 要明確衝突。
3. **不要過度宣稱**。單篇小樣本 RCT 不等於「證據充分」。
   分級標準見下。

## 工具

```bash
cd /Users/htlin/yoga-course
python3 tools/pubmed.py search "yoga insomnia randomized controlled trial" 10
python3 tools/pubmed.py get 36398843,32870936
python3 tools/pubmed.py --json search "..." 10        # 機器可讀
```

輸出欄位：`PMID | 年份 | 文獻類型 | 期刊 | 標題`

**搜尋策略**：每個主題至少搜 2–4 組不同關鍵字。優先找
`systematic review`、`meta-analysis`、`Cochrane`、`randomized controlled trial`。
在查詢字串裡直接加這些詞很有效，例如
`"yoga hypertension systematic review meta-analysis"`。

## 證據分級（`evidence_grade`，只能用這五個）

| id | 什麼時候用 |
|---|---|
| `strong` | 多篇高品質系統性回顧／統合分析結論一致，效果量明確 |
| `moderate` | 有系統性回顧或多篇 RCT 支持，但效果量中等、異質性高或偏誤風險中等 |
| `limited` | 只有少數小樣本研究、初步證據、或結論方向一致但品質低 |
| `traditional` | **這是傳統框架，沒有可對應的實證問題**——不是「證據不足」而是「不屬於可驗證命題」。脈輪、prana、能量流動屬於這一類 |
| `contested` | 研究結論彼此衝突，或主流說法被較高品質的證據反駁 |

`traditional` 這個等級是這門課特別加的。用它的時候，`what_evidence_shows`
要寫清楚**為什麼這不是一個可以用實驗檢驗的命題**，而不是假裝有研究在爭論。

## 類別層級（`course/data/drill-evidence-*.json`）

個別動作沒有專屬文獻（「下犬式」沒有自己的 RCT，「站姿與負重體式」才有）。
類別 id 必須來自 `course/taxonomy/practices.py` 的 `CATEGORIES`。

```json
{
  "categories": [
    {
      "id": "slow-breathing",
      "name": "慢速與延長吐氣呼吸法",
      "evidence_grade": "moderate",
      "summary": "2–4 句。要寫實際效果與限制，含效果量或關鍵數字更好。不要只寫『有幫助』。",
      "citations": [
        {
          "pmid": "照抄 API",
          "title": "照抄 API",
          "journal": "照抄 API",
          "year": 2023,
          "design": "meta-analysis",
          "takeaway": "這篇的關鍵發現，一句話，含效果量最好"
        }
      ]
    }
  ]
}
```

`design` 可用值：`meta-analysis` / `systematic-review` / `rct` / `cohort` /
`cross-sectional` / `case-series` / `case-report` / `narrative-review` /
`physiological-study`。

**每個類別至少 2 篇引用。**

## 單元層級（`course/data/oe-*.json`）

```json
{
  "conditions": [
    {
      "unit": "ch2-u1",
      "name": "橫膈呼吸與慢速呼吸",
      "evidence_grade": "moderate",
      "summary": "整體結論，3–5 句。",
      "mechanism": "已知或推測的生理機轉。不確定就寫不確定。",
      "traditional_claim": "傳統瑜伽文獻／坊間怎麼說這個技法。照實轉述，不要先反駁。",
      "what_evidence_shows": "現代文獻實際測到什麼。與上一欄不一致時，明白寫出不一致。",
      "red_flags": ["出現這些狀況要停止練習並就醫", "第二條"],
      "caveats": "這門課必須誠實告知讀者的限制。",
      "citations": [{ "pmid": "", "title": "", "journal": "", "year": 2020, "design": "", "takeaway": "" }]
    }
  ]
}
```

`unit` 必須對得上實際存在的單元 id。每個單元至少 2 篇引用，重要主題 3–5 篇。

`red_flags` 是陣列，寫**具體可辨識的症狀**（「練習中出現胸痛、視野缺損或單側肢體無力」），
不要寫「感覺不舒服就停」這種無法判定的句子。

## 完成前自己檢查

```bash
cd /Users/htlin/yoga-course
python3 - <<'PY'
import json,glob,subprocess
for f in glob.glob("course/data/drill-evidence-*.json")+glob.glob("course/data/oe-*.json"):
    d=json.load(open(f))
    rows=d.get("categories") or d.get("conditions") or []
    ok={"strong","moderate","limited","traditional","contested"}
    for r in rows:
        assert r["evidence_grade"] in ok, (f, r.get("id") or r.get("unit"), r["evidence_grade"])
        assert len(r.get("citations",[]))>=2, (f, r.get("id") or r.get("unit"), "引用不足")
        for c in r["citations"]:
            assert str(c["pmid"]).isdigit(), (f,c)
    print(f, len(rows), "筆 OK")
PY
```

再抽驗幾筆 PMID 是否真的存在且標題相符：

```bash
python3 tools/pubmed.py get <你寫進去的幾個 PMID>
```
