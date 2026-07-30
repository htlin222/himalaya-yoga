// render.js — 把 course.json 的資料轉成 DOM 字串
import { icon } from "./icons.js";
import { normalize as normalizePaywall, formatAmount } from "./paywall-core.js";

/** HTML 逸出，資料雖為自產仍一律過濾 */
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/* 這些全部由 course.config.json 注入，框架本身不預設任何主題詞彙。
   用可變物件而非重新指派，import 過的模組才拿得到更新後的內容。 */
export const KIND = {};
export const GRADE = {};
export const UI = {};
let CFG = {};

export function setConfig(cfg) {
  CFG = cfg || {};
  for (const o of [KIND, GRADE, UI]) for (const k of Object.keys(o)) delete o[k];

  for (const k of CFG.kinds || []) KIND[k.id] = { label: k.label, tone: k.tone || "accent" };
  for (const g of CFG.grades || []) GRADE[g.id] = { label: g.label, tone: g.tone || "accent" };
  Object.assign(UI, CFG.ui || {});
  PW = normalizePaywall(CFG.paywall);
}

/* paywall：渲染時要知道每一章能不能看。判定本身在 paywall-core，
   這裡只拿到一個問句——誰都不准自己比對章節代碼。 */
let PW = null;
let ACCESS = () => true;

export function setAccess(fn) {
  ACCESS = typeof fn === "function" ? fn : () => true;
}

const pwT = (k, fallback = "") => PW?.ui?.[k] ?? fallback;

/** 分級／類型都用 tone 對應到樣式，id 可以隨主題自由命名 */
const toneCls = (o) => `Label--${o?.tone || "neutral"}`;
const gradeOf = (id) => GRADE[id] || Object.values(GRADE)[0] || { label: id, tone: "neutral" };

/* --- 影片 ---------------------------------------------------------------- */

/** 觀看數縮寫：1038712 -> 104 萬 */
function views(n) {
  if (!n) return "";
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)} 億次`;
  if (n >= 1e4) return `${Math.round(n / 1e4)} 萬次`;
  return `${n.toLocaleString("en-US")} 次`;
}

/** 播放鈕：主課與跟練共用同一個元件，只差尺寸 */
function playBtn(sm = false, disabled = false) {
  const cls = `PlayBtn${sm ? " PlayBtn--sm" : ""}${disabled ? " PlayBtn--disabled" : ""}`;
  return `<span class="${cls}">${icon(disabled ? "inbox" : "play", sm ? 14 : 16)}</span>`;
}

function videoCard(v) {
  if (!v || !v.url) {
    return `
      <div class="VideoCard VideoCard--missing">
        <span class="VideoCard__badge">${icon("book-open", 16)}</span>
        <span class="VideoCard__main">
          <span class="VideoCard__title">${esc(UI.missingTitle || "尚未找到合格影片")}</span>
          <span class="VideoCard__meta">${esc(v?.note || UI.missingHint || "這個主題在 YouTube 上沒有品質足夠的示範")}</span>
        </span>
        ${playBtn(false, true)}
      </div>`;
  }

  return `
    <a class="VideoCard" href="${esc(v.url)}" target="_blank" rel="noopener">
      <span class="VideoCard__badge">${icon("book-open", 16)}</span>
      <span class="VideoCard__main">
        <span class="VideoCard__title">${esc(v.title)}</span>
        <span class="VideoCard__meta">
          <span>${esc(v.channel)}</span>
          ${v.duration ? `<span>· ${esc(v.duration)}</span>` : ""}
          ${v.views ? `<span>· ${views(v.views)}</span>` : ""}
        </span>
        ${v.why ? `<span class="VideoCard__why">${esc(v.why)}</span>` : ""}
      </span>
      ${playBtn()}
    </a>`;
}

const langLabel = (l) => (CFG.languages || {})[l] || l || "其他";

/** 主課可能有多個語言版本，用小分頁切換 */
function lessonBox(u) {
  const lessons = (u.lessons || (u.lesson ? [u.lesson] : [])).filter(Boolean);
  if (!lessons.length) return videoCard(null);
  if (lessons.length === 1) return videoCard(lessons[0]);

  return `
    <div class="LessonBox">
      <div class="LessonBox__langs" role="tablist" aria-label="${esc(UI.lessonLangLabel || "主課語言")}">
        ${lessons
          .map(
            (l, i) => `
          <button class="LessonBox__lang${i === 0 ? " is-active" : ""}" type="button"
                  role="tab" aria-selected="${i === 0}" data-lesson="${i}">
            ${esc(langLabel(l.lang))}
          </button>`,
          )
          .join("")}
      </div>
      ${lessons
        .map(
          (l, i) =>
            `<div class="LessonBox__pane" data-lesson-pane="${i}"${i ? " hidden" : ""}>${videoCard(l)}</div>`,
        )
        .join("")}
    </div>`;
}

/* --- 動作清單 ------------------------------------------------------------ */

function muscleTags(list) {
  return (list || [])
    .map(
      (m) =>
        `<button class="Label Label--neutral Label--muscle" data-muscle="${esc(m)}"
                 type="button" title="${esc((UI.facetFilterHint || "篩選涉及 {name} 的內容").replace("{name}", m))}">${esc(m)}</button>`,
    )
    .join("");
}

function drill(d) {
  const inner = `
    <span class="Drill__marker" style="background:var(--fgColor-${esc((KIND[d.kind] || {}).tone || "accent")})"></span>
    <span class="Drill__main">
      <span class="Drill__name">${esc(d.name)}${d.en ? ` <span class="Drill__en">${esc(d.en)}</span>` : ""}</span>
      <span class="Drill__meta">
        ${d.target ? `<span>${esc(d.target)}</span>` : ""}
        ${d.dose ? `<span class="Drill__dose">${esc(d.dose)}</span>` : ""}
        ${d.channel ? `<span>· ${esc(d.channel)}</span>` : ""}
        ${d.duration ? `<span>· ${esc(d.duration)}</span>` : ""}
      </span>
      ${(d.facets || []).length ? `<span class="Drill__muscles">${muscleTags(d.facets)}</span>` : ""}
    </span>
    ${playBtn(true, !d.url)}`;

  const attrs = `class="Drill" data-kind="${esc(d.kind)}" data-facets="${esc((d.facets || []).join("|"))}"${d.cat ? ` data-cat="${esc(d.cat)}"` : ""}`;

  // 有連結就整列可點，跟主課卡片一致
  return d.url
    ? `<li ${attrs}><a class="Drill__link" href="${esc(d.url)}" target="_blank" rel="noopener" title="${esc(d.title || UI.watchLabel || "觀看示範")}">${inner}</a></li>`
    : `<li ${attrs}><span class="Drill__link" aria-disabled="true" title="${esc(UI.missingTitle || "尚未找到合格影片")}">${inner}</span></li>`;
}

function drillGroup(kind, list) {
  if (!list.length) return "";
  const k = KIND[kind];
  return `
    <div class="DrillGroup" data-group="${kind}">
      <h4 class="DrillGroup__title">
        <span class="Drill__marker" style="background:var(--fgColor-${esc(k.tone)})"></span>
        ${k.label}
        <span class="Counter">${list.length}</span>
      </h4>
      <ul class="DrillList">${list.map(drill).join("")}</ul>
    </div>`;
}

/* --- 實證註記 ------------------------------------------------------------ */

function evidence(ev, unitId) {
  if (!ev) return "";
  const g = gradeOf(ev.evidence_grade);

  const row = (key, val) =>
    val
      ? `<div class="Evidence__row"><span class="Evidence__key">${key}</span><span>${esc(val)}</span></div>`
      : "";

  const cites = (ev.citations || []).length
    ? `<div class="Evidence__cite">
         ${ev.citations
           .map(
             (c) =>
               `<a href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.title)}">${esc(c.journal || c.title)}${c.year ? ` ${esc(c.year)}` : ""}</a>`,
           )
           .join("")}
       </div>`
    : "";

  const rows = (UI.evidenceRows || [])
    .map((r) =>
      r.type === "flags"
        ? (ev[r.field] || []).length
          ? `<div class="Evidence__row">
               <span class="Evidence__key">${esc(r.label)}</span>
               <span class="Evidence__flags">
                 ${ev[r.field].map((f) => `<span class="Label Label--danger">${esc(f)}</span>`).join("")}
               </span>
             </div>`
          : ""
        : row(r.label, ev[r.field]),
    )
    .join("");

  return `
    <section class="Evidence" data-evidence="${esc(unitId)}">
      <button class="Evidence__header" type="button" data-toggle="evidence">
        ${icon("microscope", 14)}
        <span>${esc(UI.unitEvidenceLabel || "")}</span>
        <span class="Label ${toneCls(g)}">${g.label}</span>
        <span class="Evidence__spacer"></span>
        ${ev.url && UI.evidenceSource ? `<span class="Label Label--neutral">${esc(UI.evidenceSource)}</span>` : ""}
        <span class="Evidence__chevron">${icon("chevron-right", 14)}</span>
      </button>
      <div class="Evidence__body">
        ${rows}
        ${cites}
        ${
          ev.url
            ? `<div class="Evidence__cite"><a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(UI.evidenceSourceLink || "讀完整回答")} ${icon("external-link", 11)}</a></div>`
            : ""
        }
      </div>
    </section>`;
}

/* --- 動作類別的實證 ------------------------------------------------------ */

let DRILL_EV = {};

export function setDrillEvidence(map) {
  DRILL_EV = map || {};
}

function drillEvidence(u) {
  const cats = [...new Set((u.drills || []).map((d) => d.cat).filter(Boolean))]
    .map((id) => DRILL_EV[id])
    .filter((c) => c && c.citations?.length);
  if (!cats.length) return "";

  const totalCites = cats.reduce((n, c) => n + c.citations.length, 0);

  const block = (cat) => {
    const g = gradeOf(cat.evidence_grade);
    return `
      <details class="DrillEvCat">
        <summary>
          <span class="DrillEvCat__name">${esc(cat.name)}</span>
          <span class="Label ${toneCls(g)}">${g.label}</span>
          <span class="Counter">${cat.citations.length}</span>
        </summary>
        ${cat.summary ? `<p class="DrillEvCat__summary">${esc(cat.summary)}</p>` : ""}
        <ol class="DrillEvCat__cites">
          ${cat.citations
            .map(
              (c) => `
            <li>
              <a href="https://pubmed.ncbi.nlm.nih.gov/${esc(c.pmid)}/" target="_blank" rel="noopener">${esc(c.title)}</a>
              <span class="DrillEvCat__src">${esc(c.journal || "")}${c.year ? ` ${esc(c.year)}` : ""}${c.design ? ` · ${esc(c.design)}` : ""} · PMID ${esc(c.pmid)}</span>
              ${c.takeaway ? `<span class="DrillEvCat__take">${esc(c.takeaway)}</span>` : ""}
            </li>`,
            )
            .join("")}
        </ol>
      </details>`;
  };

  return `
    <section class="Evidence DrillEv" data-drillev="${esc(u.id)}">
      <button class="Evidence__header" type="button" data-toggle="drillev">
        ${icon("microscope", 14)}
        <span>${esc(UI.drillEvidenceLabel || "")}</span>
        <span class="Counter">${cats.length} 類 · ${totalCites} 篇</span>
        <span class="Evidence__spacer"></span>
        <span class="Label Label--neutral">PubMed</span>
        <span class="Evidence__chevron">${icon("chevron-right", 14)}</span>
      </button>
      <div class="Evidence__body DrillEv__body">${cats.map(block).join("")}</div>
    </section>`;
}

/* --- 肌群 ---------------------------------------------------------------- */

function muscles(tight, weak) {
  if (!tight?.length && !weak?.length) return "";
  const block = (mod, iconName, title, list) =>
    list?.length
      ? `<div class="MuscleBlock MuscleBlock--${mod}">
           <h4 class="MuscleBlock__title">${icon(iconName, 12)} ${title}</h4>
           <div class="MuscleBlock__list">
             ${list.map((m) => `<span class="Label Label--neutral">${esc(m)}</span>`).join("")}
           </div>
         </div>`
      : "";

  return `
    <div class="MuscleGrid">
      ${block("tight", "flame", UI.tightLabel || "", tight)}
      ${block("weak", "battery-low", UI.weakLabel || "", weak)}
    </div>`;
}

/* --- 單元 ---------------------------------------------------------------- */

export function renderUnit(u, done, locked = false) {
  // 類型一律迭代設定檔的 kinds。寫死 id 換主題會讓所有項目消失，且不會有任何錯誤訊息。
  const counts = Object.fromEntries((CFG.kinds || []).map((k) => [k.id, 0]));
  (u.drills || []).forEach((d) => {
    if (counts[d.kind] != null) counts[d.kind]++;
  });
  const total = (u.drills || []).length;

  const typeLabel = (UI.unitTypes || {})[u.type];
  const badges = [
    typeLabel
      ? `<span class="Label Label--${u.type === "foundation" ? "accent" : "neutral"}">${esc(typeLabel)}</span>`
      : "",
    total ? `<span class="Label Label--neutral">${icon("layers", 11)} ${total}</span>` : "",
    // 實證強度直接標在標題列。contested 的單元不該要展開才看得到
    u.evidence?.evidence_grade
      ? `<span class="Label ${toneCls(gradeOf(u.evidence.evidence_grade))}"
               title="${esc(UI.unitEvidenceLabel || "")}">${icon("microscope", 11)} ${gradeOf(u.evidence.evidence_grade).label}</span>`
      : "",
  ].join("");

  const groups = (CFG.kinds || [])
    .map((k) => drillGroup(k.id, (u.drills || []).filter((d) => d.kind === k.id)))
    .join("");

  // 單元自身的肌群 + 底下所有動作的肌群，供側欄篩選比對
  const allFacets = [
    ...new Set([...(u.facets || []), ...(u.drills || []).flatMap((d) => d.facets || [])]),
  ];

  // 鎖定的單元只出標題列，不渲染 body：硬鎖不是靠 CSS 遮起來，是根本不產生內容。
  // 標題與摘要留著，這樣搜尋還找得到、也看得出解鎖後有什麼。
  if (locked) {
    return `
      <article class="Unit is-locked" id="${esc(u.id)}" data-unit="${esc(u.id)}"
               data-facets="${esc(allFacets.join("|"))}" data-locked="1">
        <button class="Unit__header" type="button" data-pw-gate>
          <span class="Unit__lock" title="${esc(pwT("lockedLabel", "鎖定"))}">${icon("lock", 13)}</span>
          <span class="Unit__main">
            <span class="Unit__title">${esc(u.name)} ${badges}
              <span class="Label Label--neutral">${icon("lock", 10)} ${esc(pwT("lockedLabel", "鎖定"))}</span>
            </span>
            ${u.summary ? `<span class="Unit__summary">${esc(u.summary)}</span>` : ""}
          </span>
          <span class="Unit__chevron">${icon("chevron-right", 16)}</span>
        </button>
      </article>`;
  }

  return `
    <article class="Unit${done ? " is-done" : ""}" id="${esc(u.id)}" data-unit="${esc(u.id)}"
             data-facets="${esc(allFacets.join("|"))}">
      <button class="Unit__header" type="button" data-toggle="unit">
        <span class="Unit__check" data-action="toggle-done" role="checkbox"
              aria-checked="${done}" tabindex="0" title="標記為完成">${icon("check", 12)}</span>
        <span class="Unit__main">
          <span class="Unit__title">${esc(u.name)} ${badges}</span>
          ${u.summary ? `<span class="Unit__summary">${esc(u.summary)}</span>` : ""}
        </span>
        <span class="Unit__chevron">${icon("chevron-right", 16)}</span>
      </button>

      <div class="Unit__body">
        ${lessonBox(u)}
        ${
          u.assessment
            ? `<div class="Assessment">
                 <span class="Assessment__icon">${icon("clipboard-check", 16)}</span>
                 <span><span class="Assessment__label">${esc(UI.assessmentLabel || "")}</span>${esc(u.assessment)}</span>
               </div>`
            : ""
        }
        ${muscles(u.tight, u.weak)}
        ${evidence(u.evidence, u.id)}
        ${groups}
        ${drillEvidence(u)}
      </div>
    </article>`;
}

/* --- 立場聲明 ------------------------------------------------------------ */

export function renderStance(stance) {
  if (!stance?.length) return "";

  const card = (s, i) => {
    const g = gradeOf(s.evidence_grade);
    const findings = (s.key_findings || []).length
      ? `<details>
           <summary>看完整實證（${s.key_findings.length} 項發現）</summary>
           <ul class="StanceCard__findings">
             ${s.key_findings.map((f) => `<li>${esc(f)}</li>`).join("")}
           </ul>
           ${s.caveats ? `<ul class="StanceCard__findings"><li>${esc(s.caveats)}</li></ul>` : ""}
         </details>`
      : "";

    const cites = (s.citations || []).length
      ? `<div class="StanceCard__cites">
           ${s.citations
             .map(
               (c) =>
                 `<a href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.title)}">${esc(c.journal || c.title)}${c.year ? ` ${esc(c.year)}` : ""}</a>`,
             )
             .join("")}
         </div>`
      : "";

    return `
      <article class="StanceCard">
        <header class="StanceCard__head">
          <span class="StanceCard__n">${i + 1}</span>
          <span class="StanceCard__name">${esc(s.name)}</span>
          <span class="Label ${toneCls(g)}">${g.label}</span>
        </header>
        <div class="StanceCard__body">
          <p class="StanceCard__verdict">${esc((CFG.stance?.verdicts || {})[s.unit] || "")}</p>
          <p class="StanceCard__summary">${esc(s.summary)}</p>
          ${findings}
        </div>
        <footer class="StanceCard__foot">
          ${cites}
          ${
            s.url
              ? `<div class="StanceCard__cites" style="margin-top:6px">
                   <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(UI.evidenceSourceLink || "讀完整回答")} ${icon("external-link", 10)}</a>
                 </div>`
              : ""
          }
        </footer>
      </article>`;
  };

  return `
    <div class="StancePage__intro">
      <h2>${icon("microscope", 22)} ${esc(CFG.stance?.title || "")}</h2>
      <p>${esc(CFG.stance?.intro || "")}</p>
    </div>
    <div class="StancePage__grid">${stance.map(card).join("")}</div>
    <div class="StancePage__outro">
      <strong>${esc(CFG.stance?.outroTitle || "")}</strong>
      ${CFG.stance?.outro || ""}
    </div>`;
}

/* --- 章節 ---------------------------------------------------------------- */

/** 鎖定章節的招呼卡，擺在章節內容最上面 */
function gateCard(drillTotal, unitTotal) {
  if (!PW) return "";
  const p = PW.products[0];
  return `
    <div class="PaywallGate">
      <span class="PaywallGate__icon">${icon("lock", 16)}</span>
      <span class="PaywallGate__main">
        <p class="PaywallGate__title">${esc(pwT("gateTitle", "這一章需要完整課程"))}</p>
        <p class="PaywallGate__note">
          ${unitTotal} 個單元${drillTotal ? ` · ${drillTotal} 支跟練影片` : ""}
          ${esc(pwT("gateCardNote", ""))}
        </p>
      </span>
      <span class="Price">
        ${p.listAmount > p.amount ? `<s class="Price__list">${esc(formatAmount(p.listAmount, PW.currency))}</s>` : ""}
        <span class="Price__now">${esc(formatAmount(p.amount, PW.currency))}</span>
      </span>
      <button class="btn btn-primary" type="button" data-pw-gate>
        ${icon("shopping-cart", 14)} ${esc(pwT("addToCart", "加入購物車"))}
      </button>
    </div>`;
}

export function renderChapter(ch, doneSet) {
  const doneCount = ch.units.filter((u) => doneSet.has(u.id)).length;
  const pct = ch.units.length ? Math.round((doneCount / ch.units.length) * 100) : 0;
  const drillTotal = ch.units.reduce((n, u) => n + (u.drills?.length || 0), 0);
  const locked = !ACCESS(ch.code);

  return `
    <section class="Chapter${locked ? " is-locked" : ""}" id="${esc(ch.code)}" data-chapter="${esc(ch.code)}">
      <button class="Chapter__header" type="button" data-toggle="chapter">
        <span class="Chapter__num">${icon(locked ? "lock" : ch.icon || "circle-dot", 18)}</span>
        <span class="Chapter__titles">
          <span class="Chapter__title">
            <span class="Chapter__code">${esc(ch.code)}</span>
            ${esc(ch.title)}
          </span>
          <span class="Chapter__meta">
            ${ch.units.length} ${UI.unitNoun || "個單元"}${drillTotal ? ` · ${drillTotal} ${UI.drillNoun || "支跟練影片"}` : ""}
            ${doneCount ? ` · 已完成 ${doneCount}` : ""}
          </span>
        </span>
        ${
          locked
            ? `<span class="Chapter__lock">${icon("lock", 13)} ${esc(pwT("lockedLabel", "鎖定"))}</span>`
            : ""
        }
        <span class="Chapter__progress">
          <span class="ProgressBar ProgressBar--thin">
            <span class="ProgressBar__fill" style="width:${pct}%"></span>
          </span>
        </span>
        <span class="Chapter__chevron">${icon("chevron-right", 16)}</span>
      </button>
      <div class="Chapter__body">
        ${locked ? gateCard(drillTotal, ch.units.length) : ""}
        ${ch.units.map((u) => renderUnit(u, doneSet.has(u.id), locked)).join("")}
      </div>
    </section>`;
}

/* --- 首頁 ---------------------------------------------------------------- */

export function renderHome(course) {
  const { meta, chapters, stance } = course;

  const L = CFG.landing || {};
  const steps = (L.steps || []).map(
    (s, i) => `
    <div class="Step">
      <span class="Step__n">${icon(s.icon || "circle-dot", 18)}</span>
      <div>
        <h3 class="Step__title">${i + 1}. ${esc(s.title)}</h3>
        <p class="Step__body">${esc(s.body)}</p>
      </div>
    </div>`,
  ).join("");

  const stanceCards = (stance || []).map((s) => {
    const g = gradeOf(s.evidence_grade);
    return `
      <div class="LandingStance">
        <div class="LandingStance__head">
          <span class="Label ${toneCls(g)}">${g.label}</span>
          <strong>${esc(s.name)}</strong>
        </div>
        <p>${esc((CFG.stance?.verdicts || {})[s.unit] || "")}</p>
      </div>`;
  }).join("");

  const chapterCards = chapters.map((ch) => {
    const drills = ch.units.reduce((n, u) => n + (u.drills?.length || 0), 0);
    const locked = !ACCESS(ch.code);
    return `
      <button class="ChapterCard" type="button" data-goto-chapter="${esc(ch.code)}">
        <span class="ChapterCard__icon">${icon(locked ? "lock" : ch.icon || "circle-dot", 18)}</span>
        <span class="ChapterCard__main">
          <span class="ChapterCard__title"><span class="Chapter__code">${esc(ch.code)}</span> ${esc(ch.title)}</span>
          <span class="ChapterCard__meta">
            ${ch.units.length} ${(UI.unitNoun || "個單元").replace(/^個/, "")}${drills ? ` · ${drills} ${UI.drillNounShort || "支跟練"}` : ""}
            ${PW ? ` · ${esc(locked ? pwT("lockedLabel", "鎖定") : pwT("trialLabel", "試看"))}` : ""}
          </span>
          <span class="ChapterCard__units">${ch.units.map((u) => esc(u.name)).join("、")}</span>
        </span>
      </button>`;
  }).join("");

  // paywall 的首頁區塊：買過了就換成已解鎖的樣子
  const lockedCount = PW ? chapters.filter((ch) => !ACCESS(ch.code)).length : 0;
  const paywallCta = !PW
    ? ""
    : lockedCount
      ? `<div class="PaywallCta">
           <span class="PaywallGate__icon">${icon("lock", 16)}</span>
           <span class="PaywallCta__main">
             <p class="PaywallCta__title">${esc(pwT("ctaLockedTitle", ""))}</p>
             <p class="PaywallCta__note">${esc(pwT("ctaLockedNote", ""))}</p>
           </span>
           <span class="Price">
             ${
               PW.products[0].listAmount > PW.products[0].amount
                 ? `<s class="Price__list">${esc(formatAmount(PW.products[0].listAmount, PW.currency))}</s>`
                 : ""
             }
             <span class="Price__now">${esc(formatAmount(PW.products[0].amount, PW.currency))}</span>
           </span>
           <button class="btn btn-primary" type="button" data-pw-gate>
             ${icon("shopping-cart", 14)} ${esc(pwT("addToCart", "加入購物車"))}
           </button>
         </div>`
      : `<div class="PaywallCta">
           <span class="PaywallGate__icon">${icon("lock-open", 16)}</span>
           <span class="PaywallCta__main">
             <p class="PaywallCta__title">${esc(pwT("ctaOwnedTitle", ""))}</p>
             <p class="PaywallCta__note">${esc(pwT("ctaOwnedNote", ""))}</p>
           </span>
           <button class="btn" type="button" data-pw-receipt>
             ${icon("receipt", 14)} ${esc(pwT("viewReceipt", "看收據"))}
           </button>
         </div>`;

  return `
    <section class="Landing__section">
      <h2 class="Landing__h2">${icon("book-open", 20)} ${esc(L.howTitle || "")}</h2>
      <div class="Steps">${steps}</div>
    </section>

    <section class="Landing__section">
      <h2 class="Landing__h2">${icon("microscope", 20)} ${esc(L.stanceTitle || "")}</h2>
      <p class="Landing__lede">
${esc(L.stanceLede || "")}
      </p>
      <div class="Landing__stance">${stanceCards}</div>
      <button class="btn" type="button" data-tab-link="stance">
        ${esc(CFG.ui?.tabs?.stance || "立場")} ${icon("chevron-right", 14)}
      </button>
    </section>

    <section class="Landing__section">
      <h2 class="Landing__h2">${icon("layers", 20)} ${esc(L.chaptersTitle || "")}</h2>
      <div class="ChapterGrid">${chapterCards}</div>
    </section>

    <section class="Landing__cta">
      <div>
        <h2 class="Landing__h2">${esc(L.ctaTitle || "")}</h2>
        <p class="Landing__lede">
${esc((L.ctaLede || "").replace("{units}", meta.units).replace("{videos}", meta.video_slots))}
        </p>
      </div>
      <div class="Landing__ctaBtns">
        <button class="btn btn-primary" type="button" data-tab-link="player">
          ${icon("play", 14)} ${esc(CFG.ui?.tabs?.player || "")}
        </button>
        <button class="btn" type="button" data-tab-link="course">
          ${icon("layers", 14)} ${esc(CFG.ui?.tabs?.course || "")}
        </button>
      </div>
    </section>
    ${paywallCta}`;
}
