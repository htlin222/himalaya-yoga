/**
 * paywall 的端對端測試：走完鎖定 → 加入購物車 → 0 元結帳 → 解鎖，並沿路截圖。
 *
 *   make serve &                                   # dist 起在 8899
 *   NODE_PATH=$(npm root -g) node tests/e2e-paywall.cjs [輸出目錄]
 *
 * 為什麼是 .cjs：playwright 裝在全域，用 require 才吃得到 NODE_PATH。
 * 這支不進 CI（需要瀏覽器），純邏輯的部分在 tests/paywall-core.test.js。
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:8899";

/** 全域安裝的 playwright 版本常常跟 ~/Library/Caches 裡的瀏覽器對不上，
 *  所以先試自帶的 chromium，失敗就退回系統 Chrome，不要叫使用者去 install。 */
async function launch() {
  try {
    return await chromium.launch();
  } catch {
    console.log("   （自帶的 chromium 不可用，改用系統 Chrome）");
    return await chromium.launch({ channel: "chrome" });
  }
}
const OUT = process.argv[2] || path.join(__dirname, "..", ".tmp", "paywall-shots");

let step = 0;
const shot = async (page, name) => {
  const file = path.join(OUT, `${String(++step).padStart(2, "0")}-${name}.png`);
  // 不停動畫的話會拍到進場中間的半透明狀態，看起來像 bug
  await page.screenshot({ path: file, animations: "disabled" });
  console.log(`   📸 ${path.basename(file)}`);
};

const ok = (msg) => console.log(`   ✓ ${msg}`);

/** 每次都從乾淨狀態開始，不然上一輪的訂單會留著 */
async function fresh(page, { theme } = {}) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.clear();
    if (t) localStorage.setItem("bc:theme", JSON.stringify(t));
  }, theme);
  await page.goto(BASE, { waitUntil: "networkidle" });
  // 首頁分頁時 #main 是 hidden，所以等「掛上」而不是「看得見」
  await page.waitForSelector('[data-chapter="CH0"]', { state: "attached" });
}

const gotoTab = (page, tab) => page.click(`.TabNav__item[data-tab="${tab}"]`);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // 本機預覽沒有 Pages Functions，瀏覽次數的 POST 必然 501——那是設計好的靜默失敗
    if ((m.location()?.url || "").includes("/api/hits")) return;
    errors.push(`console: ${m.text()}`);
  });

  console.log(`\n▸ 首頁（未結帳）`);
  await fresh(page);
  assert.equal(await page.isVisible("#cartBtn"), true, "設定檔有 paywall，購物車鈕就該出現");
  assert.equal(await page.isVisible(".PaywallCta"), true);
  ok("首頁有購物車鈕與 paywall 區塊");
  await shot(page, "home-locked");

  console.log(`\n▸ 課程內容：試看與鎖定`);
  await gotoTab(page, "course");
  await page.click('[data-chapter="CH0"] .Chapter__header');
  assert.equal(
    await page.locator('[data-chapter="CH0"] .PaywallGate').count(),
    0,
    "CH0 是試看章節，不該有招呼卡",
  );
  assert.ok(
    (await page.locator('[data-chapter="CH0"] .Unit__body').count()) > 0,
    "試看章節的單元要有內容",
  );
  ok("CH0–CH3 照常可看");

  await page.click('[data-chapter="CH4"] .Chapter__header');
  await page.waitForSelector('[data-chapter="CH4"] .PaywallGate');
  assert.equal(
    await page.locator('[data-chapter="CH4"] .Unit__body').count(),
    0,
    "硬鎖：鎖定章節根本不渲染單元內容，不是用 CSS 遮起來",
  );
  assert.ok(
    (await page.locator('[data-chapter="CH4"] .Unit.is-locked').count()) > 0,
    "鎖定章節的單元要標成 is-locked",
  );
  // 標題留著，這樣搜尋還找得到解鎖後有什麼
  assert.match(await page.textContent('[data-chapter="CH4"]'), /頭前伸/);
  ok("CH4 鎖住、只留標題當 teaser、招呼卡出現");
  await shot(page, "chapter-locked");

  console.log(`\n▸ 上課模式：鎖定的影片點了不播`);
  await gotoTab(page, "player");
  const lockedItem = page.locator(".PlaylistItem.is-locked").first();
  await lockedItem.waitFor();
  await lockedItem.click();
  await page.waitForSelector("#paywallRoot:not([hidden])");
  assert.equal(await page.locator("#ytFrame").count(), 0, "鎖定的影片不該建立 iframe");
  ok("播放清單的鎖生效，沒有嵌入播放器");
  await shot(page, "gate-from-player");

  console.log(`\n▸ 加入購物車`);
  await page.click('#paywallRoot [data-pw="add"]');
  await page.waitForSelector('#paywallRoot[data-view="cart"]');
  assert.equal(await page.textContent(".Cart__badge"), "1");
  const cartText = await page.textContent("#paywallRoot");
  assert.match(cartText, /NT\$1,880/, "劃掉的原價要看得到");
  assert.match(cartText, /NT\$0/, "應付金額是 0");
  assert.match(cartText, /原價是虛構的/, "誠實告知必須出現在購物車裡");
  ok("購物車顯示原價、0 元應付與誠實告知");
  await shot(page, "cart");

  console.log(`\n▸ 結帳`);
  await page.click('[data-pw="checkout"]');
  await page.waitForSelector("#pwPay");
  assert.equal(await page.isDisabled("#pwPay"), true, "沒勾條款不能結帳");
  await page.check("#pwTerms");
  assert.equal(await page.isDisabled("#pwPay"), false, "勾了才能結帳");
  ok("條款 checkbox 是結帳的前置條件");
  await shot(page, "checkout");

  await page.click("#pwPay");
  await page.waitForSelector('#paywallRoot[data-view="receipt"]');
  const orderId = (await page.textContent(".Receipt__row code")).trim();
  assert.match(orderId, /^BC-\d{8}-[0-9A-F]{4}$/, `訂單編號格式不對：${orderId}`);
  assert.match(await page.textContent(".Receipt__row--total"), /NT\$0/);
  ok(`收據出現，訂單編號 ${orderId}`);
  await shot(page, "receipt");

  console.log(`\n▸ 解鎖後`);
  await page.click('[data-pw="start"]');
  await page.waitForSelector("#paywallRoot", { state: "hidden" });
  assert.equal(await page.locator(".PlaylistItem.is-locked").count(), 0, "播放清單不該再有鎖");
  ok("結帳後直接進上課模式，清單全開");

  await gotoTab(page, "course");
  await page.click('[data-chapter="CH4"] .Chapter__header');
  await page.waitForSelector('[data-chapter="CH4"] .Unit');
  assert.equal(await page.locator('[data-chapter="CH4"] .PaywallGate').count(), 0);
  assert.ok((await page.locator('[data-chapter="CH4"] .Unit__body').count()) > 0, "CH4 內容要渲染出來");
  assert.equal(await page.locator(".Cart__badge").count(), 0, "買完購物車數量徽章要消失");
  ok("CH4 完整渲染、購物車徽章換成已解鎖");
  await shot(page, "chapter-unlocked");

  // 真正播一支 CH4 的影片，確認 gate 沒有殘留
  await gotoTab(page, "player");
  await page.locator(".PlaylistItem").nth(60).click();
  await page.waitForSelector("#ytFrame");
  ok("解鎖後的影片真的播得起來");

  console.log(`\n▸ 重新載入後解鎖狀態要留著`);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await gotoTab(page, "course");
  assert.equal(await page.locator(".Chapter.is-locked").count(), 0, "訂單存在 localStorage，重載後仍解鎖");
  assert.equal(await page.locator("#cartBtn.is-owned").count(), 1);
  ok("重載後仍是已解鎖");

  console.log(`\n▸ 深色主題`);
  await fresh(page, { theme: "dark" });
  await gotoTab(page, "course");
  await page.click('[data-chapter="CH4"] .Chapter__header');
  await shot(page, "chapter-locked-dark");
  await page.click('[data-chapter="CH4"] .PaywallGate [data-pw-gate]');
  await page.waitForSelector('#paywallRoot[data-view="gate"]');
  await shot(page, "gate-dark");
  await page.click('#paywallRoot [data-pw="add"]');
  await page.waitForSelector('#paywallRoot[data-view="cart"]');
  await shot(page, "cart-dark");
  ok("深色主題三個畫面都截到了");

  console.log(`\n▸ 鍵盤與 Escape`);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#paywallRoot", { state: "hidden" });
  ok("Escape 關得掉對話框");

  await browser.close();

  if (errors.length) {
    console.error(`\n✗ 頁面有 ${errors.length} 個錯誤：`);
    errors.forEach((e) => console.error(`   ${e}`));
    process.exit(1);
  }
  console.log(`\n✓ 全部通過 · 截圖在 ${OUT}\n`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
