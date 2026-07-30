# Paywall：0 元結帳的 UX 實驗，與通往真收費的接縫

這門課免費。加入購物車、結帳、收據都是真的介面，金額是真的 0 元 ——
**唯一虛構的是那個被劃掉的原價**，介面上有一行字直接講明。

做這個功能有兩個目的：一是「解鎖」這件事本身會讓人更願意開始上課；
二是把未來真要收費時的接縫先留好，不要到那天才發現整個前端得重寫。

## 現在的行為

| | 章節 | 行為 |
|---|---|---|
| 試看 | CH0–CH3（觀念篇） | 完全開放，跟以前一樣 |
| 鎖定 | CH4–CH11（體態篇） | 章節與單元顯示鎖頭，展開會彈出 paywall；播放清單裡點下去不播 |

結帳流程：header 購物車 → 抽屉（品項 + 劃掉的原價）→ 結帳頁（假表單、誠實聲明 checkbox）
→ 收據（訂單編號、NT$0）→ 全站解鎖。

解鎖狀態存在 `localStorage` 的 `bc:order`。**沒有帳號、沒有伺服器**，清掉瀏覽器資料就回到鎖定狀態。

## 設定

`course/course.config.json` 的 `paywall` 區塊。**沒有這個區塊，整個功能不存在** ——
跟 `counter` 同一個模式，別的課程沿用這個框架時預設不會有 paywall。

```jsonc
"paywall": {
  "mode": "demo",              // demo | live。不是 demo 就整個關掉（fail closed）
  "currency": "TWD",
  "freeChapters": ["CH0", "CH1", "CH2", "CH3"],
  "products": [
    {
      "id": "full",
      "name": "完整課程",
      "amount": 0,             // 實付金額（分為單位的整數在真金流才需要，demo 用元）
      "listAmount": 1880,      // 劃掉的原價。虛構的，所以一定要配 honesty 文案
      "unlocks": "*"           // "*" 或 ["CH4", "CH5"]
    }
  ]
}
```

金額刻意存成數字而不是 `"NT$1,880"` 這種顯示字串。接金流時金額要參與計算與比對，
形狀現在就對齊，以後不用改資料。

## 兩個 chokepoint

所有 UI 只問這兩個函式，**任何地方都不許自己判斷章節能不能看**。
換成真金流時，要改的就只有這兩個的實作。

```js
await paywall.ready()        // demo: 讀 localStorage
                             // live: fetch("/api/entitlement") 拿伺服器認定的權利
paywall.canAccess(chCode)    // → bool
await paywall.grant(order)   // demo: 寫 localStorage
                             // live: 不存在 —— 權利由金流 webhook 寫進 D1，前端只重新 ready()
```

`ready()` 從第一天就是 **async**，即使 demo 版根本不需要等任何東西。
事後把同步改成非同步是最痛的一種重構，這個成本現在付掉。

訂單物件也一次對齊真形狀：

```js
{ id: "BC-20260730-4F2A", at: "2026-07-30T…", items: [{ id, name, amount }],
  amount: 0, currency: "TWD", provider: "demo" }
```

## 真要收費的話，還缺什麼

**前端硬鎖擋不住任何人。** `dist/course.json` 把全部影片 URL 攤在同一個公開檔案裡，
F12 就看完了。這不是 bug，是這個站的設計 —— 它從來就是免費策展站。

所以真 paywall 的關鍵工作**不在前端**，依重要性排序：

1. **切分資料。** `src/build/build.py` 的 `main()` 目前把所有章節寫進一個 `dist/course.json`
   （見該處 `TODO(paywall)`）。要改成付費章節的 `lesson.url` / `drill.url` 抽到
   `course.paid.json`，公開的那份只留標題、時長、頻道這些用來當 teaser 的欄位。
2. **伺服器認定權利。** 新增 `functions/api/entitlement.js`（`functions/api/hits.js` 已經證明
   Pages Functions + D1 這條路走得通，`wrangler.jsonc` 裡有現成的 D1 綁定可以照抄）。
   需要一張 `entitlements(email, product_id, granted_at, order_id)` 表，和一種認人的方式 ——
   最省的是 magic link，不要自己做密碼。
3. **接金流。** 台灣的話藍新／綠界，國際的話 Stripe Checkout。前端只負責把人送去 provider
   的頁面；**權利一定要由 webhook 寫進 D1**，不能信任前端回傳的「我付好了」。
4. **改掉這裡的文案與結構化資料。** `paywall.honesty` 那行「純屬玩笑」要刪，
   JSON-LD 的 `isAccessibleForFree` 要從 `true` 改成 `false` 並加上真的 `Offer`。

第 4 點的另一半：**現在絕對不要**為了讓 paywall 看起來像真的，就在 JSON-LD 裡塞假的 `Offer`
或假價格。對使用者開玩笑和對 Google 宣告假售價是兩件事，後者會影響真實搜尋結果。
`src/build/seo.py` 產出的 `isAccessibleForFree: true` 是真話，維持原樣。

## 測試

```bash
node --test tests/            # paywall 核心邏輯，零依賴、不需要瀏覽器
node tests/e2e-paywall.cjs    # Playwright 走完整流程並截圖（需要 make serve 起在 8899）
```

單元測試只測 `src/web/js/paywall-core.js` —— 純函式、沒有 DOM、沒有 localStorage。
gating 判定、金額格式化、訂單建立、損壞的 localStorage 防禦都在那裡。
DOM 與流程交給 Playwright，不為了測 DOM 去引入 jsdom。
