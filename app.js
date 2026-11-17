const STORAGE_KEY = "cf763_shield_academy_v1";

let ALL_TERMS = [];
let FILTERED_TERMS = [];
let CURRENT_PAGE = 1;
const PAGE_SIZE = 36;

let STATE = {
  furigana: true,
  speed: 1,
  mastered: {}, // id -> true
  learning: {}, // id -> true (needs review)
  starred: {},  // id -> true
  wrong: {},    // id -> count
};

let ACTIVE_CAT = "all";
let CURRENT_AUDIO = null;
let PLAY_ALL_ACTIVE = false;

// Flashcard state
let FC_LIST = [];
let FC_IDX = 0;
let FC_FLIPPED = false;

// Quiz state
let QUIZ_Q = [];
let QUIZ_IDX = 0;
let QUIZ_SCORE = 0;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      STATE = { ...STATE, ...parsed };
    }
  } catch (e) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  } catch (e) {}
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyFuriganaUI() {
  const toggle = document.getElementById("furiganaToggle");
  toggle.checked = STATE.furigana;
  document.body.classList.toggle("hide-furigana", !STATE.furigana);
}

// Microsoft Neural Voice Audio Player (pre-generated edge-tts MP3 + Edge Natural TTS fallback)
function stopAudio() {
  if (CURRENT_AUDIO) {
    CURRENT_AUDIO.pause();
    CURRENT_AUDIO = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  document.querySelectorAll(".active-playing").forEach((el) => el.classList.remove("active-playing"));
  document.querySelectorAll(".btn-audio.playing").forEach((el) => el.classList.remove("playing"));
}

function speakWithMicrosoftFallback(text, onEnd) {
  if (!("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = STATE.speed;
  const voices = window.speechSynthesis.getVoices();
  const msVoice =
    voices.find((v) => v.lang.startsWith("ja") && v.name.includes("Microsoft") && v.name.includes("Natural")) ||
    voices.find((v) => v.lang.startsWith("ja") && v.name.includes("Microsoft")) ||
    voices.find((v) => v.lang.startsWith("ja"));
  if (msVoice) u.voice = msVoice;
  u.onend = () => { if (onEnd) onEnd(); };
  u.onerror = () => { if (onEnd) onEnd(); };
  window.speechSynthesis.speak(u);
}

function playTermAudio(term, btnEl, cardEl, onEnd) {
  stopAudio();
  if (btnEl) btnEl.classList.add("playing");
  if (cardEl) cardEl.classList.add("active-playing");

  const audio = new Audio(`audio/${term.id}.mp3`);
  audio.playbackRate = STATE.speed;
  CURRENT_AUDIO = audio;

  const cleanup = () => {
    if (btnEl) btnEl.classList.remove("playing");
    if (cardEl) cardEl.classList.remove("active-playing");
    if (CURRENT_AUDIO === audio) CURRENT_AUDIO = null;
    if (onEnd) onEnd();
  };

  audio.onended = cleanup;
  audio.onerror = () => {
    speakWithMicrosoftFallback(term.jp, cleanup);
  };
  audio.play().catch(() => {
    speakWithMicrosoftFallback(term.jp, cleanup);
  });
}

function patternBadgeClass(pattern) {
  if (pattern === "音讀") return "badge-on";
  if (pattern === "訓讀") return "badge-kun";
  if (pattern === "kana") return "badge";
  return "badge-sp";
}

function renderBreakdownHtml(breakdown) {
  if (!breakdown || !breakdown.length) return "";
  return breakdown
    .map((b) => {
      const label = b.type === "on" ? "音" : b.type === "kun" ? "訓" : "特";
      return `<span class="k-chip ${b.type}" title="${label}讀"><strong>${escapeHtml(b.kanji)}</strong> ${escapeHtml(b.reading)} <small>(${label})</small></span>`;
    })
    .join("");
}

function renderTermCard(term) {
  const isStar = !!STATE.starred[term.id];
  const isMaster = !!STATE.mastered[term.id];
  const subParts = [];
  if (term.zh_cn && term.zh_cn !== term.zh_tw) subParts.push(`陸：${escapeHtml(term.zh_cn)}`);
  if (term.en) subParts.push(`EN：${escapeHtml(term.en)}`);

  const card = document.createElement("article");
  card.className = "term-card";
  card.dataset.id = term.id;
  card.innerHTML = `
    <div class="term-top">
      <div class="term-badges">
        <span class="badge badge-cat">${escapeHtml(term.category)}</span>
        <span class="badge ${patternBadgeClass(term.pattern)}">${escapeHtml(term.pattern === "kana" ? "外來語/假名" : term.pattern)}</span>
        ${term.priority >= 3 ? '<span class="badge badge-high">⭐ 高頻必背</span>' : ""}
        ${isMaster ? '<span class="badge btn-success">✅ 已記住</span>' : ""}
      </div>
      <button class="star-btn ${isStar ? "starred" : ""}" title="收藏到複習清單">${isStar ? "🔖" : "☆"}</button>
    </div>
    <div class="term-jp-row">
      <div class="term-jp">${term.ruby}</div>
      <button class="btn btn-audio btn-sm speak-btn" type="button" title="微軟真人發音">🔊 朗讀</button>
    </div>
    <div class="term-zh">${escapeHtml(term.zh_tw)}</div>
    ${subParts.length ? `<div class="term-sub">${subParts.map((s) => `<span>${s}</span>`).join("")}</div>` : ""}
    ${term.breakdown && term.breakdown.length ? `<div class="breakdown-row">${renderBreakdownHtml(term.breakdown)}</div>` : ""}
    ${term.note ? `<div class="term-note">${escapeHtml(term.note)}</div>` : ""}
  `;

  const speakBtn = card.querySelector(".speak-btn");
  speakBtn.addEventListener("click", () => {
    PLAY_ALL_ACTIVE = false;
    updatePlayAllButtons();
    playTermAudio(term, speakBtn, card);
  });

  const starBtn = card.querySelector(".star-btn");
  starBtn.addEventListener("click", () => {
    if (STATE.starred[term.id]) delete STATE.starred[term.id];
    else STATE.starred[term.id] = true;
    saveState();
    starBtn.classList.toggle("starred", !!STATE.starred[term.id]);
    starBtn.textContent = STATE.starred[term.id] ? "🔖" : "☆";
    updateStats();
  });

  return card;
}

function updateStats() {
  document.getElementById("statTotal").textContent = ALL_TERMS.length;
  document.getElementById("statMastered").textContent = Object.keys(STATE.mastered).length;
  const reviewIds = getReviewIds();
  document.getElementById("statLearning").textContent = Object.keys(STATE.learning).length;
  document.getElementById("statStarred").textContent = Object.keys(STATE.starred).length;
  document.getElementById("reviewBadge").textContent = reviewIds.length;
}

function getReviewIds() {
  const set = new Set([
    ...Object.keys(STATE.learning),
    ...Object.keys(STATE.starred),
    ...Object.keys(STATE.wrong),
  ]);
  return Array.from(set);
}

function buildCategoriesUI() {
  const counts = {};
  ALL_TERMS.forEach((t) => { counts[t.category] = (counts[t.category] || 0) + 1; });
  const cats = Object.keys(counts).sort();

  const pills = document.getElementById("categoryPills");
  pills.innerHTML = `<button class="cat-pill active" data-cat="all">全部分類 (${ALL_TERMS.length})</button>` +
    cats.map((c) => `<button class="cat-pill" data-cat="${escapeHtml(c)}">${escapeHtml(c)} (${counts[c]})</button>`).join("");

  pills.querySelectorAll(".cat-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      pills.querySelectorAll(".cat-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      ACTIVE_CAT = btn.dataset.cat;
      CURRENT_PAGE = 1;
      applyFilters();
    });
  });

  const optsHtml = `<option value="all">全部分類</option>` + cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  document.getElementById("fcCategory").innerHTML = optsHtml;
  document.getElementById("quizCategory").innerHTML = optsHtml;
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const pat = document.getElementById("patternFilter").value;
  const highOnly = document.getElementById("highFreqOnly").checked;
  const starOnly = document.getElementById("starredOnly").checked;

  FILTERED_TERMS = ALL_TERMS.filter((t) => {
    if (ACTIVE_CAT !== "all" && t.category !== ACTIVE_CAT) return false;
    if (pat !== "all" && t.pattern !== pat) return false;
    if (highOnly && t.priority < 3) return false;
    if (starOnly && !STATE.starred[t.id]) return false;
    if (q) {
      const hay = `${t.jp} ${t.kana} ${t.zh_tw} ${t.zh_cn} ${t.en} ${t.note}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  renderBrowsePage();
}

function renderBrowsePage() {
  const total = FILTERED_TERMS.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (CURRENT_PAGE > totalPages) CURRENT_PAGE = totalPages;

  const start = (CURRENT_PAGE - 1) * PAGE_SIZE;
  const slice = FILTERED_TERMS.slice(start, start + PAGE_SIZE);

  document.getElementById("resultCount").textContent = `顯示 ${total} 筆中的第 ${total ? start + 1 : 0}–${start + slice.length} 筆（第 ${CURRENT_PAGE}/${totalPages} 頁）`;

  const grid = document.getElementById("termsGrid");
  grid.innerHTML = "";
  slice.forEach((t) => grid.appendChild(renderTermCard(t)));

  const pag = document.getElementById("pagination");
  pag.innerHTML = "";
  if (totalPages > 1) {
    const addBtn = (label, page, disabled, active) => {
      const b = document.createElement("button");
      b.className = `btn ${active ? "btn-primary" : "btn-ghost"} btn-sm`;
      b.textContent = label;
      b.disabled = disabled;
      b.addEventListener("click", () => {
        CURRENT_PAGE = page;
        renderBrowsePage();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      pag.appendChild(b);
    };
    addBtn("« 上一頁", CURRENT_PAGE - 1, CURRENT_PAGE === 1, false);
    const from = Math.max(1, CURRENT_PAGE - 3);
    const to = Math.min(totalPages, CURRENT_PAGE + 3);
    for (let p = from; p <= to; p++) addBtn(String(p), p, false, p === CURRENT_PAGE);
    addBtn("下一頁 »", CURRENT_PAGE + 1, CURRENT_PAGE === totalPages, false);
  }
}

function updatePlayAllButtons() {
  document.getElementById("playAllBtn").classList.toggle("hidden", PLAY_ALL_ACTIVE);
  document.getElementById("stopPlayAllBtn").classList.toggle("hidden", !PLAY_ALL_ACTIVE);
}

function playSequence(termsList, gridEl) {
  PLAY_ALL_ACTIVE = true;
  updatePlayAllButtons();
  let idx = 0;

  function next() {
    if (!PLAY_ALL_ACTIVE || idx >= termsList.length) {
      PLAY_ALL_ACTIVE = false;
      updatePlayAllButtons();
      stopAudio();
      return;
    }
    const term = termsList[idx];
    const cardEl = gridEl.querySelector(`[data-id="${term.id}"]`);
    const btnEl = cardEl ? cardEl.querySelector(".speak-btn") : null;
    if (cardEl) cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    idx++;
    playTermAudio(term, btnEl, cardEl, () => {
      if (PLAY_ALL_ACTIVE) setTimeout(next, 550);
    });
  }
  next();
}

// ==================== FLASHCARDS ====================
function loadFlashcardDeck() {
  const cat = document.getElementById("fcCategory").value;
  const flt = document.getElementById("fcFilter").value;
  FC_LIST = ALL_TERMS.filter((t) => {
    if (cat !== "all" && t.category !== cat) return false;
    if (flt === "high" && t.priority < 3) return false;
    if (flt === "review" && !STATE.learning[t.id] && !STATE.wrong[t.id]) return false;
    if (flt === "starred" && !STATE.starred[t.id]) return false;
    return true;
  });
  FC_IDX = 0;
  FC_FLIPPED = false;
  renderFlashcard();
}

function renderFlashcard() {
  const counter = document.getElementById("fcCounter");
  const front = document.querySelector(".flashcard-front");
  const back = document.querySelector(".flashcard-back");

  if (!FC_LIST.length) {
    counter.textContent = "0 / 0";
    document.getElementById("fcJp").textContent = "此篩選條件目前沒有詞條";
    front.classList.remove("hidden");
    back.classList.add("hidden");
    return;
  }

  const term = FC_LIST[FC_IDX];
  counter.textContent = `${FC_IDX + 1} / ${FC_LIST.length}`;
  document.getElementById("fcCatBadge").textContent = term.category;
  document.getElementById("fcCatBadgeBack").textContent = term.category;
  const patBadge = document.getElementById("fcPatternBadge");
  patBadge.textContent = term.pattern === "kana" ? "外來語/假名" : term.pattern;
  patBadge.className = `badge ${patternBadgeClass(term.pattern)}`;

  document.getElementById("fcJp").innerHTML = term.ruby;
  document.getElementById("fcJpBack").innerHTML = term.ruby;
  document.getElementById("fcZh").textContent = term.zh_tw;
  const subs = [];
  if (term.zh_cn && term.zh_cn !== term.zh_tw) subs.push(`大陸用語：${term.zh_cn}`);
  if (term.en) subs.push(`English：${term.en}`);
  document.getElementById("fcSubLangs").textContent = subs.join(" ｜ ");
  document.getElementById("fcBreakdown").innerHTML = renderBreakdownHtml(term.breakdown);
  const noteEl = document.getElementById("fcNote");
  noteEl.textContent = term.note || "（無補充備註）";
  noteEl.classList.toggle("hidden", !term.note);

  front.classList.toggle("hidden", FC_FLIPPED);
  back.classList.toggle("hidden", !FC_FLIPPED);

  if (!FC_FLIPPED && document.getElementById("fcAutoAudio").checked) {
    playTermAudio(term);
  }
}

function flipFlashcard() {
  if (!FC_LIST.length) return;
  FC_FLIPPED = !FC_FLIPPED;
  renderFlashcard();
}

function rateFlashcard(rate) {
  if (!FC_LIST.length) return;
  const term = FC_LIST[FC_IDX];
  if (rate === "good") {
    STATE.mastered[term.id] = true;
    delete STATE.learning[term.id];
    delete STATE.wrong[term.id];
  } else {
    STATE.learning[term.id] = true;
    delete STATE.mastered[term.id];
  }
  saveState();
  updateStats();
  FC_IDX = (FC_IDX + 1) % FC_LIST.length;
  FC_FLIPPED = false;
  renderFlashcard();
}

// ==================== QUIZ ====================
function startQuiz() {
  const cat = document.getElementById("quizCategory").value;
  const pool = ALL_TERMS.filter((t) => cat === "all" || t.category === cat);
  if (pool.length < 4) {
    document.getElementById("quizBox").innerHTML = `<div class="quiz-empty">此分類詞條不足 4 筆，請選擇「全部分類」。</div>`;
    return;
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
  QUIZ_Q = shuffled.map((target) => {
    const distractors = [...pool]
      .filter((x) => x.id !== target.id && x.zh_tw !== target.zh_tw)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const opts = [target, ...distractors].sort(() => Math.random() - 0.5);
    return { target, opts };
  });
  QUIZ_IDX = 0;
  QUIZ_SCORE = 0;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const box = document.getElementById("quizBox");
  if (QUIZ_IDX >= QUIZ_Q.length) {
    box.innerHTML = `
      <div style="text-align:center;padding:1.5rem 0;">
        <h2>🎉 測驗完成！</h2>
        <p style="font-size:1.35rem;margin:0.75rem 0;">得分：<strong>${QUIZ_SCORE} / ${QUIZ_Q.length}</strong></p>
        <p style="color:var(--muted);margin-bottom:1.25rem;">答錯的題目已自動收入「複習與錯題本」。</p>
        <button class="btn btn-primary" id="retryQuizBtn">再測一次</button>
      </div>
    `;
    document.getElementById("retryQuizBtn").addEventListener("click", startQuiz);
    return;
  }

  const q = QUIZ_Q[QUIZ_IDX];
  const type = document.getElementById("quizType").value;
  let promptHtml = "";
  if (type === "listening") {
    promptHtml = `<button class="btn btn-audio" id="quizSpeakBtn" style="font-size:1.1rem;padding:0.75rem 1.4rem;">🔊 點擊播放微軟真人發音</button>`;
  } else if (type === "kanji2zh") {
    promptHtml = q.target.ruby;
  } else {
    promptHtml = escapeHtml(q.target.zh_tw);
  }

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:0.88rem;">
      <span>第 ${QUIZ_IDX + 1} / ${QUIZ_Q.length} 題（${escapeHtml(q.target.category)}）</span>
      <span>目前得分：${QUIZ_SCORE}</span>
    </div>
    <div class="quiz-prompt">${promptHtml}</div>
    <div class="quiz-options">
      ${q.opts.map((o, i) => `
        <button class="quiz-opt" data-idx="${i}">
          ${type === "zh2jp" ? o.ruby : escapeHtml(o.zh_tw)}
        </button>
      `).join("")}
    </div>
    <div id="quizFeedback" style="margin-top:1rem;text-align:center;"></div>
  `;

  if (type === "listening") {
    document.getElementById("quizSpeakBtn").addEventListener("click", () => playTermAudio(q.target));
    playTermAudio(q.target);
  }

  const optBtns = box.querySelectorAll(".quiz-opt");
  optBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      optBtns.forEach((b) => (b.disabled = true));
      const chosen = q.opts[Number(btn.dataset.idx)];
      const ok = chosen.id === q.target.id;
      if (ok) {
        QUIZ_SCORE++;
        btn.classList.add("correct");
      } else {
        btn.classList.add("wrong");
        const rightIdx = q.opts.findIndex((o) => o.id === q.target.id);
        if (rightIdx >= 0) optBtns[rightIdx].classList.add("correct");
        STATE.wrong[q.target.id] = (STATE.wrong[q.target.id] || 0) + 1;
        saveState();
        updateStats();
      }
      playTermAudio(q.target);
      const fb = document.getElementById("quizFeedback");
      fb.innerHTML = `
        <div style="margin-bottom:0.75rem;">
          <strong>${ok ? "✅ 答對了！" : "❌ 答錯了"}</strong>
          <div style="margin-top:0.35rem;">${q.target.ruby} ＝ <strong>${escapeHtml(q.target.zh_tw)}</strong></div>
        </div>
        <button class="btn btn-primary" id="quizNextBtn">${QUIZ_IDX + 1 < QUIZ_Q.length ? "下一題 ➡" : "查看結果"}</button>
      `;
      document.getElementById("quizNextBtn").addEventListener("click", () => {
        QUIZ_IDX++;
        renderQuizQuestion();
      });
    });
  });
}

// ==================== REVIEW ====================
function renderReviewTab() {
  const counts = {};
  const masteredCounts = {};
  ALL_TERMS.forEach((t) => {
    counts[t.category] = (counts[t.category] || 0) + 1;
    if (STATE.mastered[t.id]) masteredCounts[t.category] = (masteredCounts[t.category] || 0) + 1;
  });

  const progEl = document.getElementById("categoryProgress");
  progEl.innerHTML = Object.keys(counts)
    .sort()
    .map((c) => {
      const m = masteredCounts[c] || 0;
      const tot = counts[c];
      const pct = Math.round((m / tot) * 100);
      return `
        <div class="prog-card">
          <div style="display:flex;justify-content:space-between;font-size:0.84rem;font-weight:700;">
            <span>${escapeHtml(c)}</span>
            <span>${m}/${tot} (${pct}%)</span>
          </div>
          <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    })
    .join("");

  const ids = new Set(getReviewIds());
  const list = ALL_TERMS.filter((t) => ids.has(t.id));
  const grid = document.getElementById("reviewGrid");
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<div class="quiz-empty" style="grid-column:1/-1;">目前沒有錯題或待複習詞條！你可以在詞庫點擊 ☆ 收藏，或在閃卡/測驗標記不熟的單字。</div>`;
    return;
  }
  list.forEach((t) => grid.appendChild(renderTermCard(t)));
}

// ==================== INIT ====================
async function init() {
  loadState();
  applyFuriganaUI();
  document.getElementById("speedSelect").value = String(STATE.speed || 1);

  const res = await fetch("data/terms.json");
  ALL_TERMS = await res.json();

  buildCategoriesUI();
  updateStats();
  applyFilters();
  loadFlashcardDeck();

  // Furigana toggle
  document.getElementById("furiganaToggle").addEventListener("change", (e) => {
    STATE.furigana = e.target.checked;
    saveState();
    applyFuriganaUI();
  });

  // Speed
  document.getElementById("speedSelect").addEventListener("change", (e) => {
    STATE.speed = Number(e.target.value);
    saveState();
  });

  // Mode Tabs
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      PLAY_ALL_ACTIVE = false;
      updatePlayAllButtons();
      stopAudio();
      document.querySelectorAll(".mode-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".mode-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const mode = tab.dataset.mode;
      document.getElementById(`mode-${mode}`).classList.add("active");
      if (mode === "review") renderReviewTab();
    });
  });

  // Browse Filters
  ["searchInput", "patternFilter", "highFreqOnly", "starredOnly"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      CURRENT_PAGE = 1;
      applyFilters();
    });
    document.getElementById(id).addEventListener("change", () => {
      CURRENT_PAGE = 1;
      applyFilters();
    });
  });

  document.getElementById("playAllBtn").addEventListener("click", () => {
    const start = (CURRENT_PAGE - 1) * PAGE_SIZE;
    const slice = FILTERED_TERMS.slice(start, start + PAGE_SIZE);
    playSequence(slice, document.getElementById("termsGrid"));
  });

  document.getElementById("stopPlayAllBtn").addEventListener("click", () => {
    PLAY_ALL_ACTIVE = false;
    updatePlayAllButtons();
    stopAudio();
  });

  // Flashcards
  document.getElementById("fcCategory").addEventListener("change", loadFlashcardDeck);
  document.getElementById("fcFilter").addEventListener("change", loadFlashcardDeck);
  document.getElementById("fcFlipBtn").addEventListener("click", flipFlashcard);
  document.getElementById("fcSpeakBtn").addEventListener("click", () => FC_LIST[FC_IDX] && playTermAudio(FC_LIST[FC_IDX]));
  document.getElementById("fcSpeakBtnBack").addEventListener("click", () => FC_LIST[FC_IDX] && playTermAudio(FC_LIST[FC_IDX]));
  document.querySelectorAll("[data-rate]").forEach((b) => b.addEventListener("click", () => rateFlashcard(b.dataset.rate)));
  document.getElementById("fcPrevBtn").addEventListener("click", () => {
    if (!FC_LIST.length) return;
    FC_IDX = (FC_IDX - 1 + FC_LIST.length) % FC_LIST.length;
    FC_FLIPPED = false;
    renderFlashcard();
  });
  document.getElementById("fcNextBtn").addEventListener("click", () => {
    if (!FC_LIST.length) return;
    FC_IDX = (FC_IDX + 1) % FC_LIST.length;
    FC_FLIPPED = false;
    renderFlashcard();
  });
  document.getElementById("fcShuffleBtn").addEventListener("click", () => {
    FC_LIST.sort(() => Math.random() - 0.5);
    FC_IDX = 0;
    FC_FLIPPED = false;
    renderFlashcard();
  });

  // Quiz
  document.getElementById("startQuizBtn").addEventListener("click", startQuiz);

  // Review
  document.getElementById("playReviewBtn").addEventListener("click", () => {
    const ids = new Set(getReviewIds());
    const list = ALL_TERMS.filter((t) => ids.has(t.id));
    if (list.length) playSequence(list, document.getElementById("reviewGrid"));
  });
  document.getElementById("clearWrongBtn").addEventListener("click", () => {
    STATE.wrong = {};
    STATE.learning = {};
    saveState();
    updateStats();
    renderReviewTab();
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key.toLowerCase() === "f") {
      STATE.furigana = !STATE.furigana;
      saveState();
      applyFuriganaUI();
    } else if (document.getElementById("mode-flashcards").classList.contains("active")) {
      if (e.code === "Space") { e.preventDefault(); flipFlashcard(); }
      else if (e.key.toLowerCase() === "r" && FC_LIST[FC_IDX]) playTermAudio(FC_LIST[FC_IDX]);
      else if (e.key === "1") rateFlashcard("again");
      else if (e.key === "2") rateFlashcard("hard");
      else if (e.key === "3") rateFlashcard("good");
    }
  });
}

init();
