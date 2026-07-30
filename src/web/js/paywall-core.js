// paywall-core.js — paywall 的純邏輯：沒有 DOM、沒有 localStorage、沒有時鐘。
// 所有不確定的東西（現在幾點、隨機數）都由呼叫端傳進來，這支才測得動。
// 設計說明與「真要收費還缺什麼」見 docs/PAYWALL.md。

export const PROVIDER_DEMO = "demo";

const SYMBOL = { TWD: "NT$", USD: "$", EUR: "€", JPY: "¥", CNY: "¥", HKD: "HK$" };

/**
 * 正規化設定。回傳 null 代表這個站沒有 paywall——UI 就完全不出現。
 * mode 不是 demo 也一律回 null：live 還沒實作，fail closed 比半開著安全。
 */
export function normalize(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.mode !== PROVIDER_DEMO) return null;

  const products = (Array.isArray(raw.products) ? raw.products : [])
    .filter((p) => p && typeof p.id === "string" && p.id)
    .map((p) => ({
      id: p.id,
      name: String(p.name ?? p.id),
      note: p.note ? String(p.note) : "",
      amount: Number(p.amount) || 0,
      listAmount: Number(p.listAmount) || 0,
      unlocks: p.unlocks === "*" ? "*" : (Array.isArray(p.unlocks) ? p.unlocks.map(String) : []),
    }));

  // 沒東西可賣就沒有 paywall，不要留一個空購物車在那裡
  if (!products.length) return null;

  return {
    mode: raw.mode,
    currency: String(raw.currency || "TWD"),
    orderPrefix: String(raw.orderPrefix || "ORD"),
    honesty: raw.honesty ? String(raw.honesty) : "",
    freeChapters: (Array.isArray(raw.freeChapters) ? raw.freeChapters : []).map(String),
    products,
    ui: raw.ui && typeof raw.ui === "object" ? raw.ui : {},
  };
}

/* --- 能不能看 ------------------------------------------------------------ */

export function isFreeChapter(pw, code) {
  return !pw || pw.freeChapters.includes(code);
}

/** 訂單解鎖了哪些章節。回傳 "*" 代表全部，否則是章節代碼陣列。 */
export function unlockedChapters(pw, order) {
  if (!pw || !order) return [];
  const bought = new Set((order.items || []).map((i) => i && i.id));
  const codes = [];
  for (const p of pw.products) {
    if (!bought.has(p.id)) continue;
    if (p.unlocks === "*") return "*";
    codes.push(...p.unlocks);
  }
  return codes;
}

/**
 * 唯一的 gating 判定。UI 的每一處都必須問這個函式，不准自己比對章節代碼——
 * 以後換成伺服器認定權利時，要改的就只有這裡。
 */
export function canAccess(pw, order, code) {
  if (!pw) return true;
  if (isFreeChapter(pw, code)) return true;
  const unlocked = unlockedChapters(pw, order);
  return unlocked === "*" || unlocked.includes(code);
}

/** 還被鎖著的章節，用來寫「還有 8 章沒解鎖」這種文案 */
export function lockedChapters(pw, order, codes) {
  return (codes || []).filter((c) => !canAccess(pw, order, c));
}

/* --- 金額 ---------------------------------------------------------------- */

export function formatAmount(amount, currency = "TWD") {
  const n = Number(amount) || 0;
  const sym = SYMBOL[currency] || `${currency} `;
  return `${sym}${n.toLocaleString("en-US")}`;
}

/* --- 購物車 -------------------------------------------------------------- */

/** 購物車存的是 product id 陣列；這裡按設定檔順序還原成品項，並丟掉不認識的 id */
export function cartItems(pw, cart) {
  if (!pw) return [];
  const ids = new Set(Array.isArray(cart) ? cart : []);
  return pw.products.filter((p) => ids.has(p.id));
}

export function cartTotals(pw, cart) {
  const items = cartItems(pw, cart);
  const amount = items.reduce((n, p) => n + p.amount, 0);
  // 沒填原價的品項就用實付當原價，折扣才不會憑空多出來
  const listAmount = items.reduce((n, p) => n + (p.listAmount || p.amount), 0);
  return { count: items.length, amount, listAmount, discount: listAmount - amount };
}

/* --- 訂單 ---------------------------------------------------------------- */

/** 訂單編號：PREFIX-YYYYMMDD-XXXX。now 與 rand 由外部給，所以測得出來。 */
export function makeOrderId(pw, now, rand) {
  const d = new Date(now);
  const ymd =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;
  const suffix = Math.floor(rand * 0x10000)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  return `${pw?.orderPrefix || "ORD"}-${ymd}-${suffix}`;
}

/** 形狀刻意對齊真訂單，接金流時不用改資料結構。空購物車回 null。 */
export function makeOrder(pw, cart, { now, rand }) {
  const items = cartItems(pw, cart);
  if (!items.length) return null;
  const { amount } = cartTotals(pw, cart);
  return {
    id: makeOrderId(pw, now, rand),
    at: new Date(now).toISOString(),
    items: items.map((p) => ({ id: p.id, name: p.name, amount: p.amount })),
    amount,
    currency: pw.currency,
    provider: PROVIDER_DEMO,
  };
}

/**
 * 從 localStorage 讀回來的訂單要當成不可信輸入：使用者可以亂改，
 * 設定檔也可能在他買完之後把品項改掉。認不出品項就不承認這張訂單。
 */
export function validateOrder(raw, pw) {
  if (!pw || !raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (!Array.isArray(raw.items)) return null;

  const known = new Map(pw.products.map((p) => [p.id, p]));
  const items = raw.items
    .filter((i) => i && known.has(i.id))
    .map((i) => ({ id: i.id, name: known.get(i.id).name, amount: known.get(i.id).amount }));
  if (!items.length) return null;

  return {
    id: raw.id,
    at: typeof raw.at === "string" ? raw.at : "",
    items,
    amount: items.reduce((n, i) => n + i.amount, 0),
    currency: pw.currency,
    provider: typeof raw.provider === "string" ? raw.provider : PROVIDER_DEMO,
  };
}
