// paywall-core 的單元測試。零依賴、不需要瀏覽器：node --test tests/
//
// 這裡只測純邏輯——誰能看哪一章、金額怎麼算、損壞的 localStorage 怎麼擋。
// DOM 與整個結帳流程交給 tests/e2e-paywall.cjs（Playwright），不為了測 DOM 引入 jsdom。
import { test } from "node:test";
import assert from "node:assert/strict";

import * as core from "../src/web/js/paywall-core.js";

const CFG = {
  mode: "demo",
  currency: "TWD",
  orderPrefix: "BC",
  freeChapters: ["CH0", "CH1"],
  honesty: "這門課免費",
  products: [
    { id: "full", name: "完整課程", amount: 0, listAmount: 1880, unlocks: "*" },
    { id: "neck", name: "頸椎包", amount: 0, listAmount: 380, unlocks: ["CH4"] },
  ],
};

const pw = () => core.normalize(CFG);
const orderFor = (...ids) => core.makeOrder(pw(), ids, { now: Date.UTC(2026, 6, 30), rand: 0 });

/* --- normalize：關掉比半開著安全 ------------------------------------------ */

test("normalize：沒有設定就沒有 paywall", () => {
  assert.equal(core.normalize(undefined), null);
  assert.equal(core.normalize(null), null);
  assert.equal(core.normalize("demo"), null);
});

test("normalize：mode 不是 demo 一律關掉（fail closed）", () => {
  assert.equal(core.normalize({ ...CFG, mode: "live" }), null);
  assert.equal(core.normalize({ ...CFG, mode: "" }), null);
  assert.equal(core.normalize({ ...CFG, mode: undefined }), null);
});

test("normalize：沒有東西可賣就不要留一個空購物車", () => {
  assert.equal(core.normalize({ ...CFG, products: [] }), null);
  assert.equal(core.normalize({ ...CFG, products: undefined }), null);
  // 沒有 id 的品項不算品項
  assert.equal(core.normalize({ ...CFG, products: [{ name: "壞資料" }] }), null);
});

test("normalize：欄位有預設值，unlocks 保留兩種形式", () => {
  const p = core.normalize({ mode: "demo", products: [{ id: "x", amount: 0 }] });
  assert.equal(p.currency, "TWD");
  assert.equal(p.orderPrefix, "ORD");
  assert.deepEqual(p.freeChapters, []);
  assert.equal(p.products[0].name, "x", "沒給 name 就用 id 當名字");
  assert.deepEqual(p.products[0].unlocks, [], "沒給 unlocks 就是什麼都不解鎖");

  const full = pw();
  assert.equal(full.products[0].unlocks, "*");
  assert.deepEqual(full.products[1].unlocks, ["CH4"]);
});

/* --- canAccess：唯一的 gating 判定 ---------------------------------------- */

test("canAccess：沒有 paywall 時全部開放", () => {
  assert.equal(core.canAccess(null, null, "CH9"), true);
});

test("canAccess：試看章節永遠開著，其餘沒訂單就鎖住", () => {
  const p = pw();
  assert.equal(core.canAccess(p, null, "CH0"), true);
  assert.equal(core.canAccess(p, null, "CH1"), true);
  assert.equal(core.canAccess(p, null, "CH4"), false);
  assert.equal(core.canAccess(p, null, "CH11"), false);
});

test("canAccess：unlocks 是 \"*\" 的訂單解鎖全部", () => {
  const p = pw();
  const order = orderFor("full");
  assert.equal(core.canAccess(p, order, "CH4"), true);
  assert.equal(core.canAccess(p, order, "CH11"), true);
  assert.equal(core.canAccess(p, order, "隨便一個沒出現過的代碼"), true);
});

test("canAccess：只買單章包就只解鎖那一章", () => {
  const p = pw();
  const order = orderFor("neck");
  assert.equal(core.canAccess(p, order, "CH4"), true);
  assert.equal(core.canAccess(p, order, "CH5"), false);
});

test("lockedChapters：算得出還鎖著幾章", () => {
  const p = pw();
  const codes = ["CH0", "CH1", "CH4", "CH5"];
  assert.deepEqual(core.lockedChapters(p, null, codes), ["CH4", "CH5"]);
  assert.deepEqual(core.lockedChapters(p, orderFor("neck"), codes), ["CH5"]);
  assert.deepEqual(core.lockedChapters(p, orderFor("full"), codes), []);
});

/* --- 金額 ---------------------------------------------------------------- */

test("formatAmount：認得的幣別給符號，不認得的就把代碼寫出來", () => {
  assert.equal(core.formatAmount(0, "TWD"), "NT$0");
  assert.equal(core.formatAmount(1880, "TWD"), "NT$1,880");
  assert.equal(core.formatAmount(1880, "USD"), "$1,880");
  assert.equal(core.formatAmount(500, "JPY"), "¥500");
  assert.equal(core.formatAmount(5, "XYZ"), "XYZ 5");
  assert.equal(core.formatAmount(undefined, "TWD"), "NT$0", "沒給金額當 0，不要顯示 NaN");
  assert.equal(core.formatAmount("壞資料", "TWD"), "NT$0");
});

/* --- 購物車 -------------------------------------------------------------- */

test("cartItems：丟掉不認識的 id、去重，並照設定檔順序排", () => {
  const p = pw();
  assert.deepEqual(
    core.cartItems(p, ["neck", "不存在", "full", "full"]).map((x) => x.id),
    ["full", "neck"],
  );
  assert.deepEqual(core.cartItems(p, []), []);
  assert.deepEqual(core.cartItems(p, "壞資料"), []);
  assert.deepEqual(core.cartItems(null, ["full"]), []);
});

test("cartTotals：折扣是原價減實付，沒填原價就不會憑空生出折扣", () => {
  const p = pw();
  assert.deepEqual(core.cartTotals(p, ["full"]), {
    count: 1,
    amount: 0,
    listAmount: 1880,
    discount: 1880,
  });
  assert.deepEqual(core.cartTotals(p, ["full", "neck"]), {
    count: 2,
    amount: 0,
    listAmount: 2260,
    discount: 2260,
  });

  const noList = core.normalize({ mode: "demo", products: [{ id: "x", amount: 250 }] });
  assert.deepEqual(core.cartTotals(noList, ["x"]), {
    count: 1,
    amount: 250,
    listAmount: 250,
    discount: 0,
  });
});

/* --- 訂單 ---------------------------------------------------------------- */

test("makeOrderId：now 與 rand 由外部給，所以完全可預測", () => {
  const p = pw();
  const noon = new Date(2026, 6, 30, 12).getTime(); // 當地時間，跨時區也還是 7/30
  assert.equal(core.makeOrderId(p, noon, 0), "BC-20260730-0000");
  assert.equal(core.makeOrderId(p, noon, 0.5), "BC-20260730-8000");
  assert.match(core.makeOrderId(p, noon, Math.random()), /^BC-20260730-[0-9A-F]{4}$/);
  assert.match(core.makeOrderId(null, noon, 0), /^ORD-/, "沒設前綴時退回 ORD");
});

test("makeOrder：空購物車不成單，成單的形狀對齊真訂單", () => {
  const p = pw();
  assert.equal(core.makeOrder(p, [], { now: 0, rand: 0 }), null);
  assert.equal(core.makeOrder(p, ["不存在"], { now: 0, rand: 0 }), null);

  const o = orderFor("full");
  assert.deepEqual(Object.keys(o).sort(), ["amount", "at", "currency", "id", "items", "provider"]);
  assert.equal(o.amount, 0);
  assert.equal(o.currency, "TWD");
  assert.equal(o.provider, "demo");
  assert.deepEqual(o.items, [{ id: "full", name: "完整課程", amount: 0 }]);
  assert.equal(o.at, "2026-07-30T00:00:00.000Z");
});

/* --- validateOrder：localStorage 是不可信輸入 ----------------------------- */

test("validateOrder：明顯壞掉的資料一律不承認", () => {
  const p = pw();
  for (const bad of [null, undefined, 0, "", "full", [], {}, { id: "" }, { id: "x" }]) {
    assert.equal(core.validateOrder(bad, p), null, `${JSON.stringify(bad)} 不該被承認`);
  }
  assert.equal(core.validateOrder({ id: "x", items: "壞資料" }, p), null);
  assert.equal(core.validateOrder(orderFor("full"), null), null, "沒有 paywall 就沒有訂單");
});

test("validateOrder：認不出品項就不承認（設定檔改過或使用者亂塞）", () => {
  const p = pw();
  assert.equal(core.validateOrder({ id: "BC-1", items: [{ id: "已下架" }] }, p), null);
  // 混了一個假品項，只留認得的那個
  const ok = core.validateOrder({ id: "BC-1", items: [{ id: "已下架" }, { id: "neck" }] }, p);
  assert.deepEqual(
    ok.items.map((i) => i.id),
    ["neck"],
  );
});

test("validateOrder：品項名稱與金額一律以設定檔為準，不信存下來的值", () => {
  const p = pw();
  const tampered = {
    id: "BC-1",
    at: "2026-07-30T00:00:00.000Z",
    items: [{ id: "full", name: "我自己改的名字", amount: -9999 }],
    amount: -9999,
    currency: "JPY",
    provider: "stripe",
  };
  const o = core.validateOrder(tampered, p);
  assert.equal(o.items[0].name, "完整課程");
  assert.equal(o.items[0].amount, 0);
  assert.equal(o.amount, 0);
  assert.equal(o.currency, "TWD");
  assert.equal(o.provider, "stripe", "provider 留著原值，以後接真金流要分得出來源");
});

test("validateOrder：改過 freeChapters 之後舊訂單還是有效", () => {
  const p = core.normalize({ ...CFG, freeChapters: [] });
  const o = core.validateOrder(orderFor("full"), p);
  assert.equal(core.canAccess(p, o, "CH0"), true);
  assert.equal(core.canAccess(p, o, "CH9"), true);
});
