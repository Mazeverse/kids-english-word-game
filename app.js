const $ = (id) => document.getElementById(id);

const screens = {
  start: $("startScreen"),
  quiz: $("quizScreen"),
  result: $("resultScreen")
};

let questions = [];
let currentIndex = 0;
let score = 0;
let streak = 0;
let wrongAnswers = [];
let locked = false;

let englishVoice = null;
let autoSpeakTimer = null;

function loadEnglishVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  englishVoice =
    voices.find(v => v.lang === "en-US" && /Google|Samantha|Microsoft|Natural/i.test(v.name)) ||
    voices.find(v => v.lang === "en-US") ||
    voices.find(v => /^en(-|_)/i.test(v.lang)) ||
    null;
}

function speakWord(word, delay = 0) {
  if (!("speechSynthesis" in window) || !word) return;

  clearTimeout(autoSpeakTimer);
  autoSpeakTimer = setTimeout(() => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (englishVoice) utterance.voice = englishVoice;

    const button = $("speakBtn");
    utterance.onstart = () => button && button.classList.add("speaking");
    utterance.onend = () => button && button.classList.remove("speaking");
    utterance.onerror = () => button && button.classList.remove("speaking");

    window.speechSynthesis.speak(utterance);
  }, delay);
}

function stopSpeaking() {
  clearTimeout(autoSpeakTimer);
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  const button = $("speakBtn");
  if (button) button.classList.remove("speaking");
}


function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getSavedWrong() {
  try {
    return JSON.parse(localStorage.getItem("kidsWordWrong") || "[]");
  } catch {
    return [];
  }
}

function saveWrongWords(items) {
  const map = new Map(getSavedWrong().map(x => [x.word, x]));
  items.forEach(x => map.set(x.word, x));
  localStorage.setItem("kidsWordWrong", JSON.stringify([...map.values()]));
  
function bindPronunciationControls() {
  const speakButton = $("speakBtn");
  if (speakButton) {
    speakButton.addEventListener("click", () => {
      const q = questions[currentIndex];
      if (q) speakWord(q.word);
    });
  }

  const toggle = $("autoSpeakToggle");
  if (toggle) {
    const savedAutoSpeak = localStorage.getItem("kidsWordAutoSpeak");
    if (savedAutoSpeak !== null) toggle.checked = savedAutoSpeak === "1";

    toggle.addEventListener("change", (event) => {
      localStorage.setItem("kidsWordAutoSpeak", event.target.checked ? "1" : "0");
      if (event.target.checked) {
        const q = questions[currentIndex];
        if (q) speakWord(q.word);
      } else {
        stopSpeaking();
      }
    });
  }
}

bindPronunciationControls();
updateSavedInfo();
}

function updateSavedInfo() {
  const count = getSavedWrong().length;
  $("savedInfo").textContent = count
    ? `현재 저장된 오답 단어: ${count}개`
    : "저장된 오답이 아직 없어요.";
  $("reviewSavedBtn").disabled = count === 0;
}

function startGame(source = WORDS) {
  const count = Math.min(10, source.length);
  questions = shuffle(source).slice(0, count);
  currentIndex = 0;
  score = 0;
  streak = 0;
  wrongAnswers = [];
  locked = false;
  showScreen("quiz");
  renderQuestion();
}

function renderQuestion() {
  locked = false;
  const q = questions[currentIndex];
  $("wordText").textContent = q.word;
  $("partText").textContent = q.part;
  $("progressText").textContent = `${currentIndex + 1} / ${questions.length}`;
  $("scoreText").textContent = `${score}점`;
  $("streakBadge").textContent = `🔥 ${streak}`;
  $("progressBar").style.width = `${((currentIndex + 1) / questions.length) * 100}%`;
  $("feedback").className = "feedback";
  $("feedback").textContent = "";
  $("quizCard").classList.remove("flash-good");
  stopSpeaking();

  const distractors = shuffle(
    WORDS.filter(x => x.word !== q.word && x.meaning !== q.meaning)
  ).slice(0, 3).map(x => x.meaning);

  const options = shuffle([q.meaning, ...distractors]);
  const choices = $("choices");
  choices.innerHTML = "";

  options.forEach(text => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = text;
    btn.addEventListener("click", () => checkAnswer(btn, text, q));
    choices.appendChild(btn);
  });

  if (!$("autoSpeakToggle") || $("autoSpeakToggle").checked) {
    speakWord(q.word, 450);
  }
}

function checkAnswer(button, selected, q) {
  if (locked) return;
  locked = true;

  const buttons = [...document.querySelectorAll(".choice")];
  buttons.forEach(b => b.disabled = true);

  if (selected === q.meaning) {
    score += 10;
    streak += 1;
    button.classList.add("correct");
    buttons.filter(b => b !== button).forEach(b => b.classList.add("dim"));
    $("feedback").className = "feedback good";
    $("feedback").textContent = streak >= 3
      ? `정답! 🔥 ${streak}연속 성공!`
      : "정답! 정말 잘했어요! ✨";
    $("quizCard").classList.add("flash-good");
    impactBurst(button);
    playTone(true);
    speakWord(q.word, 330);
  } else {
    streak = 0;
    button.classList.add("wrong");
    buttons.forEach(b => {
      if (b.textContent === q.meaning) b.classList.add("correct");
      else if (b !== button) b.classList.add("dim");
    });
    wrongAnswers.push(q);
    $("feedback").className = "feedback bad";
    $("feedback").textContent = `아쉬워요! 정답은 “${q.meaning}”이에요.`;
    playTone(false);
  }

  $("scoreText").textContent = `${score}점`;
  $("streakBadge").textContent = `🔥 ${streak}`;

  setTimeout(() => {
    currentIndex += 1;
    if (currentIndex < questions.length) renderQuestion();
    else showResult();
  }, 1250);
}

function impactBurst(button) {
  const rect = button.getBoundingClientRect();
  const emojis = ["✨","⭐","💫","🎉","🌟","⚡"];
  for (let i = 0; i < 14; i++) {
    const e = document.createElement("span");
    e.className = "spark";
    e.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    e.style.left = `${rect.left + rect.width / 2}px`;
    e.style.top = `${rect.top + rect.height / 2}px`;
    e.style.setProperty("--x", `${Math.random() * 260 - 130}px`);
    e.style.setProperty("--y", `${Math.random() * 220 - 130}px`);
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 850);
  }
}

function playTone(success) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = success ? "sine" : "square";
    osc.frequency.setValueAtTime(success ? 660 : 190, ctx.currentTime);
    if (success) osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + .18);
    gain.gain.setValueAtTime(.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .28);
    osc.start();
    osc.stop(ctx.currentTime + .3);
  } catch {}
}

function showResult() {
  const total = questions.length;
  const correct = total - wrongAnswers.length;
  $("finalScore").textContent = score;
  $("resultSummary").textContent = `${total}문제 중 ${correct}문제를 맞혔어요.`;

  if (score === total * 10) {
    $("resultEmoji").textContent = "🏆";
    $("resultTitle").textContent = "퍼펙트! 모두 맞혔어요!";
    fullConfetti();
  } else if (score >= total * 8) {
    $("resultEmoji").textContent = "🌟";
    $("resultTitle").textContent = "정말 잘했어요!";
    fullConfetti();
  } else if (score >= total * 6) {
    $("resultEmoji").textContent = "👏";
    $("resultTitle").textContent = "좋아요! 조금만 더!";
  } else {
    $("resultEmoji").textContent = "💪";
    $("resultTitle").textContent = "다시 하면 더 잘할 수 있어요!";
  }

  const list = $("wrongList");
  list.innerHTML = "";
  if (wrongAnswers.length === 0) {
    list.innerHTML = `<div class="empty-wrong">틀린 단어가 없어요. 완벽해요! 🎉</div>`;
    $("retryWrongBtn").style.display = "none";
  } else {
    $("retryWrongBtn").style.display = "block";
    wrongAnswers.forEach(item => {
      const row = document.createElement("div");
      row.className = "wrong-item";
      row.innerHTML = `<strong>${item.word}</strong><span>${item.meaning}</span>`;
      list.appendChild(row);
    });
    saveWrongWords(wrongAnswers);
  }
  showScreen("result");
}

function fullConfetti() {
  const wrap = $("celebration");
  const chars = ["🎉","✨","⭐","💜","💛","💚"];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement("span");
    el.className = "confetti";
    el.textContent = chars[Math.floor(Math.random() * chars.length)];
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDelay = `${Math.random() * .55}s`;
    el.style.animationDuration = `${.8 + Math.random() * .8}s`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }
}

if ("speechSynthesis" in window) {
  loadEnglishVoice();
  window.speechSynthesis.onvoiceschanged = loadEnglishVoice;
}

$("startBtn").addEventListener("click", () => startGame(WORDS));
$("newRoundBtn").addEventListener("click", () => startGame(WORDS));
$("retryWrongBtn").addEventListener("click", () => startGame(wrongAnswers));
$("reviewSavedBtn").addEventListener("click", () => {
  const saved = getSavedWrong();
  if (saved.length) startGame(saved);
});
$("homeBtn").addEventListener("click", () => {
  stopSpeaking();
  updateSavedInfo();
  showScreen("start");
});
$("quitBtn").addEventListener("click", () => {
  if (confirm("게임을 종료하고 처음 화면으로 돌아갈까요?")) {
    stopSpeaking();
    updateSavedInfo();
    showScreen("start");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

updateSavedInfo();
