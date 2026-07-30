// paywall.js — 加入購物車 → 0 元結帳 → 解鎖的 UI 層。
// 這門課是免費的：金額真的是 0，被劃掉的原價是虛構的，介面上有一行字直接講明。
// 純邏輯在 paywall-core.js，設計與「真要收費還缺什麼」見 docs/PAYWALL.md。
import { icon } from "./icons.js";
import { esc } from "./render.js";
import * as core from "./paywall-core.js";

const $ = (s, r = document) => r.querySelector(s);

const KEY = { cart: "bc:cart", order: "bc:order" };

let PW = null;
let CART = [];
let ORDER = null;
let notify = () => {};
let lastFocus = null;

const T = (k, fallback = "") => (PW?.ui?.[k] ?? fallback);

/* --- 儲存 ---------------------------------------------------------------- */

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隱私模式寫不進去就算了，解鎖狀態只是這次瀏覽有效 */
  }
}

/* --- 對外 API ------------------------------------------------------------
   UI 只准問這裡的 canAccess()，不准自己比對章節代碼。 */

export function init(config, { onChange } = {}) {
  PW = core.normalize(config?.paywall);
  notify = onChange || (() => {});
  if (!PW) return false;

  CART = (read(KEY.cart, []) || []).filter((id) => PW.products.some((p) => p.id === id));
  ORDER = core.validateOrder(read(KEY.order, null), PW);
  mountRoot();
  syncCartButton();
  return true;
}

/** demo 版沒有什麼要等，但真 paywall 會在這裡打 /api/entitlement。
 *  介面從第一天就 await 它，以後不必回頭把整條路徑改成非同步。 */
export async function ready() {
  return !!ORDER;
}

export const enabled = () => !!PW;
export const owned = () => !!ORDER;
export const canAccess = (chCode) => core.canAccess(PW, ORDER, chCode);
export const getOrder = () => ORDER;

/** demo: 寫進 localStorage。live: 這個函式不存在——權利由金流 webhook 寫進 D1。 */
export async function grant(candidate) {
  ORDER = core.validateOrder(candidate, PW);
  write(KEY.order, ORDER);
  CART = [];
  write(KEY.cart, CART);
  syncCartButton();
  notify();
  return !!ORDER;
}

export function reset() {
  ORDER = null;
  CART = [];
  write(KEY.order, null);
  write(KEY.cart, CART);
  syncCartButton();
  notify();
}

/* --- 購物車 -------------------------------------------------------------- */

function addToCart(id) {
  if (!PW.products.some((p) => p.id === id) || CART.includes(id)) return;
  CART = [...CART, id];
  write(KEY.cart, CART);
  syncCartButton();
}

function removeFromCart(id) {
  CART = CART.filter((x) => x !== id);
  write(KEY.cart, CART);
  syncCartButton();
}

function syncCartButton() {
  const btn = $("#cartBtn");
  if (!btn) return;
  if (!PW) {
    btn.remove();
    return;
  }

  const done = owned();
  const { count } = core.cartTotals(PW, CART);
  btn.hidden = false;
  btn.classList.toggle("is-owned", done);
  btn.title = done ? T("ownedLabel", "已解鎖") : T("cartLabel", "購物車");
  btn.setAttribute("aria-label", btn.title);
  btn.innerHTML = `
    ${icon(done ? "lock-open" : "shopping-cart", 16)}
    ${count && !done ? `<span class="Cart__badge">${count}</span>` : ""}`;
}

/* --- 畫面 ---------------------------------------------------------------- */

function mountRoot() {
  if ($("#paywallRoot")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="Paywall" id="paywallRoot" hidden>
       <div class="Paywall__backdrop" data-pw-close></div>
       <div class="Paywall__panel" role="dialog" aria-modal="true" aria-labelledby="pwTitle"></div>
     </div>`,
  );
  bindRoot();
}

function priceBlock(amount, listAmount) {
  const cur = PW.currency;
  const discounted = listAmount > amount;
  return `
    <span class="Price">
      ${discounted ? `<s class="Price__list">${esc(core.formatAmount(listAmount, cur))}</s>` : ""}
      <span class="Price__now">${esc(core.formatAmount(amount, cur))}</span>
      ${
        discounted && T("discountBadge")
          ? `<span class="Label Label--danger Price__badge">${icon("tag", 11)} ${esc(T("discountBadge"))}</span>`
          : ""
      }
    </span>`;
}

function honestyNote() {
  return PW.honesty
    ? `<p class="Paywall__honesty">${icon("info", 13)} ${esc(PW.honesty)}</p>`
    : "";
}

/** 主要商品：demo 只有一個，取設定檔第一個 */
const mainProduct = () => PW.products[0];

function viewGate() {
  const p = mainProduct();
  const inCart = CART.includes(p.id);
  return `
    <header class="Paywall__head">
      <span class="Paywall__icon">${icon("lock", 20)}</span>
      <h2 class="Paywall__title" id="pwTitle">${esc(T("gateTitle", "這一章需要完整課程"))}</h2>
      ${closeBtn()}
    </header>
    <div class="Paywall__body">
      <p class="Paywall__lede">${esc(T("gateBody", ""))}</p>
      <div class="Paywall__product">
        <span class="Paywall__productName">${icon("sparkles", 14)} ${esc(p.name)}</span>
        ${priceBlock(p.amount, p.listAmount)}
      </div>
      ${honestyNote()}
    </div>
    <footer class="Paywall__foot">
      ${
        inCart
          ? `<button class="btn btn-primary" type="button" data-pw="cart">
               ${icon("shopping-cart", 14)} ${esc(T("goCheckout", "前往結帳"))}
             </button>`
          : `<button class="btn btn-primary" type="button" data-pw="add" data-id="${esc(p.id)}">
               ${icon("shopping-cart", 14)} ${esc(T("addToCart", "加入購物車"))}
             </button>`
      }
      <button class="btn" type="button" data-pw-close>${esc(T("laterLabel", "再看看"))}</button>
    </footer>`;
}

function viewCart() {
  const items = core.cartItems(PW, CART);
  const t = core.cartTotals(PW, CART);
  const cur = PW.currency;

  return `
    <header class="Paywall__head">
      <span class="Paywall__icon">${icon("shopping-cart", 20)}</span>
      <h2 class="Paywall__title" id="pwTitle">${esc(T("cartLabel", "購物車"))}</h2>
      ${closeBtn()}
    </header>
    <div class="Paywall__body">
      ${
        items.length
          ? `<ul class="CartList">
               ${items
                 .map(
                   (p) => `
                 <li class="CartItem">
                   <span class="CartItem__main">
                     <span class="CartItem__name">${esc(p.name)}</span>
                     ${p.note ? `<span class="CartItem__note">${esc(p.note)}</span>` : ""}
                   </span>
                   ${priceBlock(p.amount, p.listAmount)}
                   <button class="btn btn-invisible btn-icon" type="button"
                           data-pw="remove" data-id="${esc(p.id)}" title="移除">
                     ${icon("trash-2", 14)}
                   </button>
                 </li>`,
                 )
                 .join("")}
             </ul>
             <dl class="CartTotals">
               <div><dt>小計</dt><dd>${esc(core.formatAmount(t.listAmount, cur))}</dd></div>
               ${
                 t.discount
                   ? `<div class="CartTotals__discount">
                        <dt>${icon("tag", 12)} ${esc(T("discountBadge", "折扣"))}</dt>
                        <dd>-${esc(core.formatAmount(t.discount, cur))}</dd>
                      </div>`
                   : ""
               }
               <div class="CartTotals__due"><dt>應付</dt><dd>${esc(core.formatAmount(t.amount, cur))}</dd></div>
             </dl>
             ${honestyNote()}`
          : `<div class="Blankslate">
               ${icon("shopping-cart", 28)}
               <p class="Blankslate__heading">${esc(T("emptyCart", "購物車是空的"))}</p>
             </div>`
      }
    </div>
    <footer class="Paywall__foot">
      <button class="btn btn-primary" type="button" data-pw="checkout" ${items.length ? "" : "disabled"}>
        ${icon("credit-card", 14)} ${esc(T("goCheckout", "前往結帳"))}
      </button>
      <button class="btn" type="button" data-pw-close>${esc(T("keepBrowsing", "繼續逛"))}</button>
    </footer>`;
}

function viewCheckout() {
  const t = core.cartTotals(PW, CART);
  return `
    <header class="Paywall__head">
      <span class="Paywall__icon">${icon("credit-card", 20)}</span>
      <h2 class="Paywall__title" id="pwTitle">${esc(T("checkoutTitle", "結帳"))}</h2>
      ${closeBtn()}
    </header>
    <div class="Paywall__body">
      <form class="Checkout" id="checkoutForm" novalidate>
        <label class="Field">
          <span class="Field__label">稱呼</span>
          <input class="Field__input" name="name" type="text" autocomplete="name"
                 placeholder="怎麼稱呼你（選填）" />
        </label>
        <label class="Field">
          <span class="Field__label">Email</span>
          <input class="Field__input" name="email" type="email" autocomplete="email"
                 placeholder="不會寄任何東西給你（選填）" />
        </label>

        <fieldset class="Field Field--pay">
          <legend class="Field__label">付款方式</legend>
          <label class="Radio">
            <input type="radio" name="pay" value="none" checked />
            <span>${esc(T("payNone", "不用付款"))} · <strong>${esc(core.formatAmount(t.amount, PW.currency))}</strong></span>
          </label>
          <label class="Radio is-disabled">
            <input type="radio" name="pay" value="card" disabled />
            <span>信用卡 <span class="Radio__note">這個 demo 沒有接金流</span></span>
          </label>
        </fieldset>

        <dl class="CartTotals">
          <div><dt>小計</dt><dd>${esc(core.formatAmount(t.listAmount, PW.currency))}</dd></div>
          ${
            t.discount
              ? `<div class="CartTotals__discount">
                   <dt>${icon("tag", 12)} ${esc(T("discountBadge", "折扣"))}</dt>
                   <dd>-${esc(core.formatAmount(t.discount, PW.currency))}</dd>
                 </div>`
              : ""
          }
          <div class="CartTotals__due"><dt>應付</dt><dd>${esc(core.formatAmount(t.amount, PW.currency))}</dd></div>
        </dl>

        <label class="Check">
          <input type="checkbox" name="terms" id="pwTerms" />
          <span>${esc(T("termsLabel", ""))}</span>
        </label>
      </form>
    </div>
    <footer class="Paywall__foot">
      <button class="btn btn-primary" type="button" data-pw="pay" id="pwPay" disabled>
        ${icon("check", 14)} ${esc(T("payLabel", "完成結帳"))} ${esc(core.formatAmount(t.amount, PW.currency))}
      </button>
      <button class="btn" type="button" data-pw="cart">${esc(T("backToCart", "回購物車"))}</button>
    </footer>`;
}

function viewReceipt() {
  const o = ORDER;
  if (!o) return viewGate();
  const when = o.at ? o.at.slice(0, 10) : "";
  return `
    <header class="Paywall__head">
      <span class="Paywall__icon Paywall__icon--ok">${icon("circle-check-big", 20)}</span>
      <h2 class="Paywall__title" id="pwTitle">${esc(T("receiptTitle", "結帳完成"))}</h2>
      ${closeBtn()}
    </header>
    <div class="Paywall__body">
      <p class="Paywall__lede">${esc(T("receiptBody", ""))}</p>
      <div class="Receipt">
        <div class="Receipt__row"><span>訂單編號</span><code>${esc(o.id)}</code></div>
        ${when ? `<div class="Receipt__row"><span>日期</span><span>${esc(when)}</span></div>` : ""}
        ${o.items
          .map(
            (i) => `<div class="Receipt__row Receipt__row--item">
                      <span>${esc(i.name)}</span>
                      <span>${esc(core.formatAmount(i.amount, o.currency))}</span>
                    </div>`,
          )
          .join("")}
        <div class="Receipt__row Receipt__row--total">
          <span>實付</span><strong>${esc(core.formatAmount(o.amount, o.currency))}</strong>
        </div>
      </div>
      ${T("receiptHint") ? `<p class="Paywall__honesty">${icon("info", 13)} ${esc(T("receiptHint"))}</p>` : ""}
    </div>
    <footer class="Paywall__foot">
      <button class="btn btn-primary" type="button" data-pw="start">
        ${icon("play", 14)} ${esc(T("startLearning", "開始上課"))}
      </button>
      <button class="btn" type="button" data-pw-close>${esc(T("closeLabel", "關閉"))}</button>
    </footer>`;
}

const closeBtn = () =>
  `<button class="btn btn-invisible btn-icon Paywall__close" type="button" data-pw-close
           aria-label="關閉">${icon("x", 16)}</button>`;

const VIEWS = { gate: viewGate, cart: viewCart, checkout: viewCheckout, receipt: viewReceipt };

function open(view) {
  if (!PW) return;
  const root = $("#paywallRoot");
  if (!root) return;
  if (root.hidden) lastFocus = document.activeElement;

  root.dataset.view = view;
  $(".Paywall__panel", root).innerHTML = (VIEWS[view] || viewGate)();
  root.hidden = false;
  document.body.classList.add("has-paywall");
  // 焦點進 dialog，但別停在關閉鈕上
  const first = $(".Paywall__body input, .Paywall__foot .btn-primary", root) || $("[data-pw-close]", root);
  first?.focus();
}

export function close() {
  const root = $("#paywallRoot");
  if (!root || root.hidden) return;
  root.hidden = true;
  root.removeAttribute("data-view");
  document.body.classList.remove("has-paywall");
  lastFocus?.focus?.();
}

export const openGate = () => open("gate");
export const openCart = () => open("cart");
export const openReceipt = () => open(owned() ? "receipt" : "gate");
/** header 那顆鈕：買過看收據，沒買過看購物車 */
export const openFromHeader = () => open(owned() ? "receipt" : "cart");

/* --- 結帳 ---------------------------------------------------------------- */

async function pay(btn) {
  const candidate = core.makeOrder(PW, CART, { now: Date.now(), rand: Math.random() });
  if (!candidate) return open("cart");

  // 假的處理中：0 元也要有一點等待，不然「結帳」不像結帳
  btn.disabled = true;
  btn.classList.add("is-busy");
  btn.innerHTML = `${icon("clock", 14)} ${esc(T("payingLabel", "處理中…"))}`;
  await new Promise((r) => setTimeout(r, 700));

  await grant(candidate);
  open("receipt");
}

/* --- 事件 ---------------------------------------------------------------- */

function bindRoot() {
  const root = $("#paywallRoot");

  root.addEventListener("click", async (e) => {
    if (e.target.closest("[data-pw-close]")) return close();

    const act = e.target.closest("[data-pw]");
    if (!act) return;

    switch (act.dataset.pw) {
      case "add":
        addToCart(act.dataset.id);
        return open("cart");
      case "remove":
        removeFromCart(act.dataset.id);
        return open("cart");
      case "cart":
        return open("cart");
      case "checkout":
        return open("checkout");
      case "pay":
        return pay(act);
      case "start":
        close();
        return notify({ start: true });
    }
  });

  // 條款沒勾就不能結帳——這個 checkbox 同時是誠實告知
  root.addEventListener("change", (e) => {
    if (e.target.id !== "pwTerms") return;
    const btn = $("#pwPay", root);
    if (btn) btn.disabled = !e.target.checked;
  });

  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return close();
    if (e.key !== "Tab") return;
    // 焦點留在 dialog 裡
    const items = [...root.querySelectorAll("button:not([disabled]), input:not([disabled]), a[href]")];
    if (!items.length) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}
