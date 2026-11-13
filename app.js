const ENDPOINT = "https://info.cld.hkjc.com/graphql/base/";

// HKJC allowlists this operation. Keep the query text byte-for-byte.
const QUERY = `fragment lotteryDrawsFragment on LotteryDraw {
    id
    year
    no
    openDate
    closeDate
    drawDate
    status
    snowballCode
    snowballName_en
    snowballName_ch
    lotteryPool {
      sell
      status
      totalInvestment
      jackpot
      unitBet
      estimatedPrize
      derivedFirstPrizeDiv
      lotteryPrizes {
        type
        winningUnit
        dividend
      }
    }
    drawResult {
      drawnNo
      xDrawnNo
    }
  }
        query marksixResult($lastNDraw: Int, $startDate: String, $endDate: String, $drawType: LotteryDrawType) {
            lotteryDraws(lastNDraw: $lastNDraw, startDate: $startDate, endDate: $endDate, drawType: $drawType) {
              ...lotteryDrawsFragment
            }
        }
    `;

const DRAW_COUNT = 5;
const OFFICIAL = {
  en: "https://bet.hkjc.com/en/marksix/results",
  zh: "https://bet.hkjc.com/ch/marksix/results",
};

const RED = new Set([1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46]);
const BLUE = new Set([3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48]);
const GREEN = new Set([5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const COPY = {
  en: {
    htmlLang: "en",
    title: "Mark Six — latest draws",
    eyebrow: "Hong Kong results",
    heading: "Mark Six",
    headingSub: "六合彩",
    lede: "A results viewer for the latest five official draws. Nothing is loaded until you ask.",
    langButton: "繁體中文",
    fetch: "Fetch latest 5 draws",
    fetching: "Fetching latest 5 draws…",
    idleTitle: "No results yet",
    idleBody:
      "Click the button to load the latest five Mark Six draws from the Hong Kong Jockey Club.",
    emptyTitle: "No draws returned",
    emptyBody:
      "The Hong Kong Jockey Club feed responded, but it did not include any draws.",
    errorTitle: "Could not load results",
    errorBody:
      "The request to the Hong Kong Jockey Club results feed failed. Check your connection and try again.",
    timeout: "The request timed out.",
    loading: "Contacting the Hong Kong Jockey Club…",
    draw: "Draw",
    date: "Draw date",
    winning: "Winning numbers",
    extra: "Extra number",
    pending: "Numbers are not published for this draw yet.",
    invalid: "This draw did not include a complete set of numbers.",
    sourceLabel: "Source",
    sourceName: "Hong Kong Jockey Club",
    drawsWord: "draws",
    disclaimer:
      "This page only displays published results. It is not affiliated with the Hong Kong Jockey Club and does not offer betting.",
    newest: "Newest first",
    fetched: "Fetched",
  },
  zh: {
    htmlLang: "zh-Hant",
    title: "六合彩 — 最近開獎",
    eyebrow: "香港賽馬會開獎結果",
    heading: "六合彩",
    headingSub: "Mark Six",
    lede: "只顯示最近五期官方攪珠結果。按下按鈕才會擷取資料。",
    langButton: "English",
    fetch: "擷取最近五期開獎",
    fetching: "正在擷取最近五期…",
    idleTitle: "尚未載入結果",
    idleBody: "按下按鈕，從香港賽馬會載入最近五期六合彩攪珠結果。",
    emptyTitle: "沒有開獎資料",
    emptyBody: "香港賽馬會的資料有回應，但沒有包含任何攪珠結果。",
    errorTitle: "無法載入結果",
    errorBody: "向香港賽馬會開獎資料的請求失敗。請檢查連線後再試一次。",
    timeout: "請求逾時。",
    loading: "正在聯絡香港賽馬會…",
    draw: "攪珠期數",
    date: "攪珠日期",
    winning: "中獎號碼",
    extra: "特別號碼",
    pending: "本期尚未公布號碼。",
    invalid: "本期沒有完整的號碼結果。",
    sourceLabel: "資料來源",
    sourceName: "香港賽馬會",
    drawsWord: "期",
    disclaimer:
      "本頁只顯示已公布的攪珠結果，與香港賽馬會並無關係，亦不提供投注。",
    newest: "由最新開始",
    fetched: "擷取時間",
  },
};

function storedLang() {
  try {
    return localStorage.getItem("m6-lang") === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

const state = {
  lang: storedLang(),
  phase: "idle",
  draws: [],
  fetchedAt: null,
  errorDetail: "",
};

const fetchButton = document.querySelector("#fetch");
const langButton = document.querySelector("#lang");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const officialLink = document.querySelector("#official");

langButton.addEventListener("click", () => {
  state.lang = state.lang === "en" ? "zh" : "en";
  try {
    localStorage.setItem("m6-lang", state.lang);
  } catch {
    // Preference simply will not persist.
  }
  render();
});

fetchButton.addEventListener("click", () => {
  loadDraws();
});

function text(tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (value != null) el.textContent = value;
  return el;
}

function ballColor(number) {
  if (RED.has(number)) return "red";
  if (BLUE.has(number)) return "blue";
  if (GREEN.has(number)) return "green";
  return "red";
}

function ballElement(number) {
  const el = document.createElement("span");
  el.className = `ball ball-${ballColor(number)}`;
  el.append(text("span", "", String(number)));
  return el;
}

function issueLabel(draw) {
  const year = String(draw.year ?? "");
  const yy = year.length >= 2 ? year.slice(-2) : year;
  const no = String(draw.no ?? "").padStart(3, "0");
  return `${yy}/${no}`;
}

function dateParts(raw) {
  const match = String(raw ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), iso: match[0] };
}

function formatDate(raw) {
  const parts = dateParts(raw);
  if (!parts) return String(raw ?? "");
  if (state.lang === "zh") return `${parts.year}年${parts.month}月${parts.day}日`;
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

function formatClock(date) {
  return new Intl.DateTimeFormat(state.lang === "zh" ? "zh-Hant-HK" : "en-HK", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function snowballName(draw) {
  const name = state.lang === "zh" ? draw.snowballName_ch : draw.snowballName_en;
  return typeof name === "string" ? name.trim() : "";
}

function resultNumbers(draw) {
  const result = draw.drawResult;
  if (!result || result.drawnNo == null || result.xDrawnNo == null) return null;
  if (!Array.isArray(result.drawnNo)) return { invalid: true };
  const nums = result.drawnNo.map((n) => Number(n));
  const extra = Number(result.xDrawnNo);
  if (nums.length !== 6 || nums.some((n) => !Number.isInteger(n))) return { invalid: true };
  const all = [...nums, extra];
  const ok = all.every((n) => Number.isInteger(n) && n >= 1 && n <= 49) && new Set(all).size === 7;
  if (!ok) return { invalid: true };
  return { nums, extra };
}

function renderMessage(title, body) {
  const box = text("div", "message");
  box.append(text("h2", "", title), text("p", "", body));
  resultsEl.append(box);
}

function renderDraw(draw, index) {
  const copy = COPY[state.lang];
  const article = document.createElement("article");
  article.className = "draw";
  article.dataset.drawId = draw.id || "";

  const top = text("div", "draw-top");
  const issue = text("div", "");
  issue.append(text("p", "kicker", copy.draw), text("h2", "", issueLabel(draw)));
  const snowball = snowballName(draw);
  if (snowball) issue.append(text("p", "tag", snowball));

  const when = text("div", "");
  when.append(text("p", "kicker", copy.date));
  const time = document.createElement("time");
  const parts = dateParts(draw.drawDate);
  if (parts) time.dateTime = parts.iso;
  time.textContent = formatDate(draw.drawDate);
  when.append(time);
  top.append(issue, when);
  article.append(top);

  const parsed = resultNumbers(draw);
  if (!parsed || parsed.invalid) {
    article.append(text("p", "note", parsed && parsed.invalid ? copy.invalid : copy.pending));
    resultsEl.append(article);
    return;
  }

  const numbers = [...parsed.nums].sort((a, b) => a - b);
  const extra = parsed.extra;
  const winId = `win-${index}`;
  const extraId = `extra-${index}`;

  const board = text("div", "board");
  const winningGroup = text("div", "group");
  const list = document.createElement("ol");
  list.className = "balls";
  list.setAttribute("aria-labelledby", winId);
  numbers.forEach((number) => {
    const item = document.createElement("li");
    item.append(ballElement(number));
    list.append(item);
  });
  const winCaption = text("p", "caption", copy.winning);
  winCaption.id = winId;
  winningGroup.append(list, winCaption);

  const extraGroup = text("div", "group extra");
  const extraWrap = text("div", "extra-wrap");
  extraWrap.append(text("p", "plus", "+"));
  extraWrap.append(ballElement(extra));
  const extraCaption = text("p", "caption", copy.extra);
  extraCaption.id = extraId;
  extraGroup.append(extraWrap, extraCaption);

  board.append(winningGroup, extraGroup);
  article.append(board);
  resultsEl.append(article);
}

function render() {
  const copy = COPY[state.lang];
  document.documentElement.lang = copy.htmlLang;
  document.title = copy.title;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key === "fetch") {
      el.textContent = state.phase === "loading" ? copy.fetching : copy.fetch;
      return;
    }
    el.textContent = copy[key];
  });

  officialLink.href = OFFICIAL[state.lang];
  officialLink.textContent = copy.sourceName;
  fetchButton.disabled = state.phase === "loading";
  statusEl.classList.toggle("is-error", state.phase === "error");
  resultsEl.replaceChildren();

  if (state.phase === "loading") {
    statusEl.textContent = copy.loading;
    for (let i = 0; i < 3; i += 1) {
      const skeleton = text("div", "skeleton");
      skeleton.setAttribute("aria-hidden", "true");
      resultsEl.append(skeleton);
    }
    return;
  }

  if (state.phase === "error") {
    const detail = state.errorDetail ? ` (${state.errorDetail})` : "";
    statusEl.textContent = copy.errorTitle;
    renderMessage(copy.errorTitle, `${copy.errorBody}${detail}`);
    return;
  }

  if (state.phase === "empty") {
    statusEl.textContent = copy.emptyTitle;
    renderMessage(copy.emptyTitle, copy.emptyBody);
    return;
  }

  if (state.phase === "ready") {
    const when = state.fetchedAt ? formatClock(state.fetchedAt) : "";
    statusEl.textContent = `${state.draws.length} ${copy.drawsWord} · ${copy.newest}${when ? ` · ${copy.fetched} ${when}` : ""}`;
    state.draws.forEach(renderDraw);
    return;
  }

  statusEl.textContent = "";
  renderMessage(copy.idleTitle, copy.idleBody);
}

async function loadDraws() {
  if (state.phase === "loading") return;
  state.phase = "loading";
  state.errorDetail = "";
  render();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        operationName: "marksixResult",
        variables: {
          lastNDraw: DRAW_COUNT,
          drawType: "All",
          startDate: null,
          endDate: null,
        },
        query: QUERY,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload.errors?.length && !payload.data?.lotteryDraws) {
      const message = payload.errors[0]?.message || COPY[state.lang].errorBody;
      throw new Error(message);
    }

    const draws = payload.data?.lotteryDraws;
    if (!Array.isArray(draws) || draws.length === 0) {
      state.draws = [];
      state.phase = "empty";
      state.fetchedAt = new Date();
      return;
    }

    state.draws = draws.slice(0, DRAW_COUNT);
    state.fetchedAt = new Date();
    state.phase = "ready";
  } catch (error) {
    state.phase = "error";
    state.draws = [];
    state.errorDetail =
      error?.name === "AbortError" ? COPY[state.lang].timeout : error?.message || "";
  } finally {
    clearTimeout(timer);
    render();
  }
}

render();
