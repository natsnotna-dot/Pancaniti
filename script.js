/* =====================================
   PANCANITI - MAIN JAVASCRIPT (script.js lengkap)
===================================== */
var gentle = false, gateOk = false; // Gentle Mode & gerbang mood
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const BASE_TITLE = "Pancaniti — Grow at your own pace";

const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = () => dateKey();

const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const fmt = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
};

function lastDays(n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    return { key: dateKey(d), label: d.toLocaleDateString("id-ID", { weekday: "short" }).replace(".", "") };
  });
}

/* ===== TEMA WARNA ===== */
const themeInfo = {
  sage: "Hijau sage: menenangkan dan dikaitkan dengan rasa seimbang.",
  ocean: "Biru: membantu rasa tenang dan konsentrasi.",
  lavender: "Lavender: lembut, membantu rileks saat belajar kreatif.",
  warm: "Krem hangat: nyaman untuk membaca lama, tidak menyilaukan.",
  night: "Mode malam: kontras rendah, mengurangi silau saat gelap."
};
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $$("#themeSwitch button").forEach((b) => b.classList.toggle("active", b.dataset.theme === t));
  $("#themeNote").textContent = themeInfo[t];
  write("pancanitiTheme", t);
}
$$("#themeSwitch button").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.theme)));
setTheme(read("pancanitiTheme", "sage"));

/* ===== TUGAS ===== */
let dailyTasks = read("pancanitiDailyTasks", {});
const getTasks = () => (dailyTasks[todayKey()] ||= []);
const saveTasks = () => write("pancanitiDailyTasks", dailyTasks);

function renderTasks() {
  const list = $("#taskList"), tasks = getTasks();
  list.innerHTML = "";
  if (!tasks.length) list.innerHTML = `<p class="task-empty">Belum ada tugas. Tambahkan satu langkah kecil 🌱</p>`;
  tasks.forEach((t) => {
    const item = document.createElement("div");
    item.className = `study-task-item ${t.completed ? "is-completed" : ""}`;
    const label = document.createElement("label");
    label.className = "study-task-label";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = t.completed;
    cb.addEventListener("change", () => { t.completed = !t.completed; saveTasks(); renderTasks(); });
    const txt = document.createElement("span"); txt.textContent = t.text;
    label.append(cb, txt);
    const del = document.createElement("button");
    del.className = "task-delete"; del.type = "button"; del.textContent = "×"; del.setAttribute("aria-label", "Hapus tugas");
    del.addEventListener("click", () => { dailyTasks[todayKey()] = getTasks().filter((x) => x.id !== t.id); saveTasks(); renderTasks(); });
    item.append(label, del);
    list.appendChild(item);
  });
  const done = tasks.filter((t) => t.completed).length;
  $("#taskProgressMini").textContent = `${done} dari ${tasks.length} selesai`;
  $("#taskPercent").textContent = `${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`;
}
$("#taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#taskInput").value.trim();
  if (v) { getTasks().push({ id: Date.now() + Math.random(), text: v, completed: false }); saveTasks(); renderTasks(); }
  $("#taskInput").value = "";
});
$("#taskDate").textContent = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/* ===== DATA FOKUS & DISTRAKSI ===== */
let studyData = read("pancanitiStudyTime", {});
let distractData = read("pancanitiDistract", {}); // { tanggal: { count, reasons: {alasan: jumlah} } }

const reasons = {
  "Notifikasi HP": "Taruh HP di ruangan lain atau aktifkan mode jangan ganggu selama sesi.",
  "Media sosial": "Pasang pemblokir situs saat belajar dan beri dirimu 5 menit media sosial setelah sesi.",
  "Ngantuk": "Cek jam tidurmu (remaja butuh 8–10 jam). Coba cuci muka, atau tidur siang 20 menit.",
  "Lapar / haus": "Siapkan air dan camilan ringan sebelum mulai agar sesi tidak terputus.",
  "Berisik": "Pakai suara noise di bagian Suara, atau pindah ke tempat yang lebih sepi.",
  "Pikiran melayang": "Tulis pikiran yang muncul di kertas, lalu kembali fokus. Coba sesi lebih pendek.",
  "Capek / stres": "Istirahatlah dulu. Tarik napas 4 detik, buang 4 detik, lalu lanjut dengan tugas paling ringan.",
  "Bosan / mager": "Ubah metode ke Active Recall atau jelaskan materi dengan Feynman agar lebih aktif.",
  "Pindah tab / aplikasi": "Tutup tab yang tidak perlu dan simpan materi di satu jendela saja."
};

function logDistraction(reason) {
  if (gentle) return; // Gentle Mode: tidak dicatat sebagai distraksi
  const d = (distractData[todayKey()] ||= { count: 0, reasons: {} });
  d.count++;
  d.reasons[reason] = (d.reasons[reason] || 0) + 1;
  write("pancanitiDistract", distractData);
  renderStats();
}
function recordStudy(sec) {
  if (sec <= 0) return;
  studyData[todayKey()] = (Number(studyData[todayKey()]) || 0) + sec;
  write("pancanitiStudyTime", studyData);
  renderStats();
}

/* ===== TIMER ===== */
let timerMode = "focus", timerDuration = 25 * 60, remaining = timerDuration;
let timerInterval = null, endsAt = null, running = false, lastRec = null;

function beep() {
  try {
    const c = getCtx(), o = c.createOscillator(), g = c.createGain();
    o.frequency.value = 660; g.gain.value = 0.1;
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.4);
  } catch {}
}
function updateDisplay() {
  const t = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  $("#timerDisplay").textContent = t;
  document.title = running ? `${t} — Pancaniti` : BASE_TITLE;
}
function stopTimer() {
  clearInterval(timerInterval); timerInterval = null;
  running = false; endsAt = null; lastRec = null;
}
const idleText = () => timerMode === "focus" ? "Saatnya fokus pada satu hal." : "Istirahat sejenak, kamu pantas mendapatkannya.";

function finishTimer() {
  stopTimer(); remaining = 0; updateDisplay(); beep();
  $("#timerStatus").textContent = timerMode === "focus"
    ? "Sesi selesai! Lihat jauh 20 detik, minum air, lalu istirahat. 🌷"
    : "Istirahat selesai. Siap kembali?";
  $("#startTimer").textContent = "Mulai lagi"; gentle = false; tone();
}
function startTimer() {
  if (running) return;
  if (timerMode === "focus" && remaining >= timerDuration && !gateOk) { moodGate(); return; }
  gateOk = false;
  if (remaining <= 0) remaining = timerDuration;
  running = true; endsAt = Date.now() + remaining * 1000; lastRec = Date.now();
  $("#startTimer").textContent = "Jeda";
  $("#timerStatus").textContent = gentle ? "Nggak apa-apa pelan-pelan. Yang penting kamu di sini." : timerMode === "focus" ? "Fokus… satu hal saja." : "Santai dulu ya.";
  timerInterval = setInterval(() => {
    const now = Date.now();
    if (timerMode === "focus") {
      const el = Math.floor((now - lastRec) / 1000);
      if (el > 0) { recordStudy(el); lastRec += el * 1000; }
    }
    remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
    updateDisplay();
    if (remaining <= 0) finishTimer();
  }, 250);
}
function resetTimerUI() {
  gentle = false; stopTimer(); remaining = timerDuration;
  $("#startTimer").textContent = "Mulai"; $("#timerStatus").textContent = idleText(); updateDisplay();
}
$("#startTimer").addEventListener("click", () => {
  if (running) { stopTimer(); $("#startTimer").textContent = "Lanjutkan"; $("#timerStatus").textContent = "Timer dijeda."; updateDisplay(); }
  else startTimer();
});
$("#resetTimer").addEventListener("click", resetTimerUI);
$$(".timer-tab").forEach((b) => b.addEventListener("click", () => {
  $$(".timer-tab").forEach((x) => x.classList.toggle("active", x === b));
  timerMode = b.dataset.mode; timerDuration = Number(b.dataset.minutes) * 60; resetTimerUI();
}));

/* Distraksi manual + otomatis (pindah tab) */
Object.keys(reasons).filter((r) => r !== "Pindah tab / aplikasi").forEach((r) => {
  const c = document.createElement("button");
  c.className = "chip"; c.type = "button"; c.textContent = r;
  c.addEventListener("click", () => { logDistraction(r); $("#reasonPanel").hidden = true; });
  $("#reasonChips").appendChild(c);
});
$("#distractBtn").addEventListener("click", () => { $("#reasonPanel").hidden = !$("#reasonPanel").hidden; });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && timerMode === "focus") logDistraction("Pindah tab / aplikasi");
});
updateDisplay();

/* ===== STATISTIK ===== */
function drawBars(el, days, val, label) {
  const max = Math.max(...days.map(val), 1);
  el.innerHTML = days.map((d) => {
    const v = val(d);
    return `<div class="bar-col"><em>${v ? label(v) : "–"}</em>
      <div class="bar-track"><div class="bar" style="height:${v ? Math.max(4, (v / max) * 100) : 2}%"></div></div>
      <em>${d.label}</em></div>`;
  }).join("");
}
function renderStats() {
  const days = lastDays(7), tk = todayKey();
  const todaySec = Number(studyData[tk]) || 0;
  const weekSec = days.reduce((s, d) => s + (Number(studyData[d.key]) || 0), 0);
  const todayD = distractData[tk]?.count || 0;
  $("#todayStudyTime").textContent = fmt(todaySec);
  $("#weeklyStudyTime").textContent = fmt(weekSec);
  $("#todayDistract").textContent = todayD;
  $("#distractRate").textContent = todaySec >= 300 ? (todayD / (todaySec / 3600)).toFixed(1) : "–";

  drawBars($("#focusChart"), days, (d) => Number(studyData[d.key]) || 0, fmt);
  drawBars($("#distractChart"), days, (d) => distractData[d.key]?.count || 0, (v) => v + "x");

  const tally = {};
  days.forEach((d) => Object.entries(distractData[d.key]?.reasons || {}).forEach(([r, n]) => (tally[r] = (tally[r] || 0) + n)));
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[1] || 1;
  $("#reasonStats").innerHTML = sorted.length
    ? sorted.map(([r, n]) => `<div class="reason-row"><span>${r}</span><div class="bar-line"><div style="width:${(n / top) * 100}%"></div></div><b>${n}</b></div>`).join("")
    : `<p class="muted">Belum ada data distraksi.</p>`;
  if (sorted.length) $("#insight").textContent = `💡 Penyebab utama: ${sorted[0][0]}. ${reasons[sorted[0][0]]}`;
}

/* ===== SUARA FOKUS (Web Audio API) ===== */
let ac, master;
function getCtx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function noiseSource(type) {
  const c = getCtx(), len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === "white") d[i] = w * 0.5;
    else if (type === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else { // pink noise (Paul Kellet)
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  }
  const s = c.createBufferSource(); s.buffer = buf; s.loop = true; return s;
}
const filter = (type, freq) => { const f = getCtx().createBiquadFilter(); f.type = type; f.frequency.value = freq; return f; };

const sounds = {
  rain:   { icon: "🌧️", name: "Hujan", info: "pink noise + filter",
    make() { const s = noiseSource("pink"), f = filter("highpass", 600), g = getCtx().createGain(); g.gain.value = 0.8; s.connect(f); f.connect(g); g.connect(master); s.start(); return [s]; } },
  ocean:  { icon: "🌊", name: "Ombak", info: "gelombang 0,1 Hz",
    make() { const c = getCtx(), s = noiseSource("brown"), f = filter("lowpass", 900), g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
      g.gain.value = 0.5; lfo.frequency.value = 0.1; depth.gain.value = 0.4;
      lfo.connect(depth); depth.connect(g.gain); s.connect(f); f.connect(g); g.connect(master); s.start(); lfo.start(); return [s, lfo]; } },
  brown:  { icon: "🟤", name: "Brown noise", info: "dalam, hangat",
    make() { const s = noiseSource("brown"), g = getCtx().createGain(); g.gain.value = 0.9; s.connect(g); g.connect(master); s.start(); return [s]; } },
  pink:   { icon: "🌸", name: "Pink noise", info: "seimbang, alami",
    make() { const s = noiseSource("pink"), g = getCtx().createGain(); g.gain.value = 0.9; s.connect(g); g.connect(master); s.start(); return [s]; } },
  white:  { icon: "⚪", name: "White noise", info: "menutup bising",
    make() { const s = noiseSource("white"), g = getCtx().createGain(); g.gain.value = 0.6; s.connect(g); g.connect(master); s.start(); return [s]; } },
  alpha:  { icon: "🎧", name: "Binaural alfa 10 Hz", info: "pakai headphone",
    make() { const c = getCtx(), out = [];
      [[200, -1], [210, 1]].forEach(([hz, pan]) => { const o = c.createOscillator(), p = c.createStereoPanner(), g = c.createGain();
        o.frequency.value = hz; p.pan.value = pan; g.gain.value = 0.12; o.connect(p); p.connect(g); g.connect(master); o.start(); out.push(o); });
      return out; } }
};
const active = {};
Object.entries(sounds).forEach(([id, s]) => {
  const b = document.createElement("button");
  b.className = "sound-btn"; b.type = "button"; b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<span>${s.icon}</span>${s.name}<small>${s.info}</small>`;
  b.addEventListener("click", () => {
    if (active[id]) { active[id].forEach((n) => { try { n.stop(); } catch {} }); delete active[id]; }
    else active[id] = s.make();
    b.classList.toggle("on", !!active[id]);
    b.setAttribute("aria-pressed", String(!!active[id]));
  });
  $("#soundGrid").appendChild(b);
});
$("#volume").addEventListener("input", (e) => { getCtx(); master.gain.value = e.target.value / 100; });

/* ===== JADWAL MINGGUAN ===== */
const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const dayOrder = [1, 2, 3, 4, 5, 6, 0];
let schedule = read("pancanitiSchedule", []);
dayOrder.forEach((i) => { const o = document.createElement("option"); o.value = i; o.textContent = dayNames[i]; $("#schedDay").appendChild(o); });
$("#schedDay").value = new Date().getDay();

function renderSchedule() {
  const grid = $("#weekGrid"); grid.innerHTML = "";
  dayOrder.forEach((di) => {
    const col = document.createElement("div");
    col.className = "day-col" + (di === new Date().getDay() ? " today" : "");
    col.innerHTML = `<h4>${dayNames[di]}</h4>`;
    schedule.filter((s) => s.day === di).sort((a, b) => a.time.localeCompare(b.time)).forEach((s) => {
      const el = document.createElement("div"); el.className = "slot";
      const t = document.createElement("div"); const b = document.createElement("b"); b.textContent = s.time;
      t.append(b, document.createTextNode(s.subject));
      const x = document.createElement("button"); x.textContent = "×"; x.setAttribute("aria-label", "Hapus jadwal");
      x.addEventListener("click", () => { schedule = schedule.filter((i) => i.id !== s.id); write("pancanitiSchedule", schedule); renderSchedule(); });
      el.append(t, x); col.appendChild(el);
    });
    grid.appendChild(col);
  });
}
$("#schedForm").addEventListener("submit", (e) => {
  e.preventDefault();
  schedule.push({ id: Date.now(), subject: $("#schedSubject").value.trim(), day: Number($("#schedDay").value), time: $("#schedTime").value });
  write("pancanitiSchedule", schedule); $("#schedSubject").value = ""; renderSchedule();
});

/* ===== KENYAMANAN TEMPAT BELAJAR ===== */
const comfort = [
  ["Cahaya cukup", "Lampu putih netral ±4000–5000 K, dari samping agar tidak silau di layar"],
  ["Suhu 22–25°C", "Terlalu panas membuat mengantuk"],
  ["Bising rendah", "Di bawah ±50 dB, atau pakai suara penutup"],
  ["HP dijauhkan", "Mode senyap dan di luar jangkauan tangan"],
  ["Postur baik", "Layar sejajar mata, punggung tegak, kaki menapak"],
  ["Air minum siap", "Satu botol di meja"],
  ["Meja rapi", "Hanya bahan untuk satu tugas"]
];
let comfortState = read("pancanitiComfort", []);
function renderComfort() {
  $("#comfortList").innerHTML = "";
  comfort.forEach(([t, d], i) => {
    const l = document.createElement("label"); l.className = "comfort-item";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = comfortState.includes(i);
    cb.addEventListener("change", () => {
      comfortState = cb.checked ? [...comfortState, i] : comfortState.filter((x) => x !== i);
      write("pancanitiComfort", comfortState); updateComfort();
    });
    const s = document.createElement("span"); s.innerHTML = `<b>${t}</b><small>${d}</small>`;
    l.append(cb, s); $("#comfortList").appendChild(l);
  });
  updateComfort();
}
function updateComfort() {
  const p = Math.round((comfortState.length / comfort.length) * 100);
  $("#comfortFill").style.width = p + "%";
  $("#comfortText").textContent = `Skor kenyamanan: ${p}%. ` + (p === 100 ? "Tempat belajarmu sudah ideal! 🎉" : p >= 60 ? "Hampir ideal, tinggal sedikit lagi." : "Perbaiki beberapa hal agar lebih fokus.");
}

/* ===== KUTIPAN TOKOH =====
   Mau ganti kutipan? Edit daftar baseQuotes di bawah ini (format: text, author),
   atau tambah lewat form di halaman (tersimpan di browser, tanpa login). */
const baseQuotes = [
  { text: "Hidup itu seperti naik sepeda. Untuk menjaga keseimbangan, kamu harus terus bergerak.", author: "Albert Einstein" },
  { text: "Aku tidak punya bakat khusus. Aku hanya sangat penasaran.", author: "Albert Einstein" },
  { text: "Ing ngarsa sung tuladha, ing madya mangun karsa, tut wuri handayani.", author: "Ki Hajar Dewantara" },
  { text: "Pendidikan adalah senjata paling ampuh yang bisa kamu gunakan untuk mengubah dunia.", author: "Nelson Mandela" },
  { text: "Satu anak, satu guru, satu buku, dan satu pena dapat mengubah dunia.", author: "Malala Yousafzai" },
  { text: "Tidak ada gunanya IQ tinggi namun malas dan tidak punya disiplin.", author: "B.J. Habibie" }
];
let customQuotes = read("pancanitiQuotes", []);
let quoteIndex = 0;
const allQuotes = () => [...baseQuotes, ...customQuotes];

function showQuote(i) {
  const list = allQuotes();
  quoteIndex = (i + list.length) % list.length;
  const q = list[quoteIndex], card = $(".quote-card");
  card.classList.add("fade");
  setTimeout(() => {
    $("#quoteText").textContent = q.text;
    $("#quoteAuthor").textContent = q.author;
    card.classList.remove("fade");
  }, 200);
  $("#quoteDelete").hidden = quoteIndex < baseQuotes.length; // hanya kutipan buatanmu yang bisa dihapus
}
$("#quoteNext").addEventListener("click", () => showQuote(quoteIndex + 1));
$("#quotePrev").addEventListener("click", () => showQuote(quoteIndex - 1));
$("#quoteDelete").addEventListener("click", () => {
  customQuotes.splice(quoteIndex - baseQuotes.length, 1);
  write("pancanitiQuotes", customQuotes); showQuote(0);
});
$("#quoteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  customQuotes.push({ text: $("#quoteInput").value.trim(), author: $("#quoteWho").value.trim() });
  write("pancanitiQuotes", customQuotes);
  $("#quoteForm").reset();
  showQuote(allQuotes().length - 1);
});
showQuote(Math.floor(Math.random() * allQuotes().length));

/* ===== INISIALISASI ===== */
renderTasks(); renderStats(); renderSchedule(); renderComfort();

/* =====================================================================
   BAGIAN BARU: sesi terpandu, pengingat istirahat, belajar bareng
===================================================================== */
/* =====================================
   SESI TERPANDU, PENGINGAT ISTIRAHAT, BELAJAR BARENG
   Dimuat SETELAH script.js (memakai read, write, recordStudy, dateKey, todayKey,
   running, timerMode, studyData, schedule/renderSchedule dari sana)
===================================== */
(() => {
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mmss = (s) => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

/* ---------- Analisis teks sederhana ---------- */
const STOP = new Set("yang dan di ke dari untuk pada dengan adalah ini itu atau dalam juga akan dapat oleh karena sebagai tidak lebih saat bisa para suatu serta hal telah sudah mereka kita kami anda secara tetapi sehingga dimana bahwa antara setiap banyak the and that for with this are from which have their".split(" "));
function kw(t, n = 8) {
  const f = {};
  (t.toLowerCase().match(/[a-z]{5,}/g) || []).forEach((w) => { if (!STOP.has(w)) f[w] = (f[w] || 0) + 1; });
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
}
const sents = (t) => (t.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
function chunks(t) {
  const out = []; let cur = "";
  for (const s of sents(t)) { cur += (cur ? " " : "") + s; if (cur.length >= 500) { out.push(cur); cur = ""; } }
  if (cur) out.push(cur);
  return out;
}
function compare(ans, src) {
  const k = kw(src, 8), a = ans.toLowerCase();
  const hit = k.filter((w) => a.includes(w.slice(0, Math.max(4, w.length - 2))));
  return { hit, miss: k.filter((w) => !hit.includes(w)), pct: k.length ? Math.round((hit.length / k.length) * 100) : 100 };
}
function cloze(src) {
  const k = kw(src, 12), used = new Set(), qs = [];
  for (const s of sents(src)) {
    if (s.length < 35 || qs.length >= 3) continue;
    const w = k.find((x) => !used.has(x) && s.toLowerCase().includes(x));
    if (!w) continue;
    used.add(w); qs.push({ q: s.replace(new RegExp(w, "i"), "_____"), a: w });
  }
  return qs;
}

/* ---------- Sesi terpandu ---------- */
const FLOW = { pomodoro: ["read", "break"], feynman: ["read", "explain"], active: ["read", "recall", "quiz"], spaced: ["read", "recall", "quiz"], review: ["quiz"] };
const NAME = { pomodoro: "Pomodoro", feynman: "Feynman", active: "Active Recall", spaced: "Spaced Repetition", review: "Ulasan" };
let S = null, tick = null;
const body = () => $("#sesiBody");
const mark = (text, miss) => { let h = esc(text); miss.forEach((w) => { h = h.replace(new RegExp(w, "gi"), (m) => `<mark>${m}</mark>`); }); return h; };

function start(m, title, text, card) {
  const ch = chunks(text);
  if (!ch.length) return;
  S = { m, title, text, ch, i: 0, s: 0, reading: false, card };
  $("#sesi").hidden = false; document.body.style.overflow = "hidden";
  render();
}
function closeSesi() { clearInterval(tick); if (S) S.reading = false; S = null; $("#sesi").hidden = true; document.body.style.overflow = ""; renderDue(); }
const next = () => { if (++S.s >= FLOW[S.m].length) { S.s = 0; S.i++; } S.i >= S.ch.length ? finish() : render(); };
const again = () => { S.s = 0; render(); };

function render() {
  clearInterval(tick); S.reading = false;
  const n = FLOW[S.m].length;
  $("#sesiBar").style.width = ((S.i * n + S.s) / (S.ch.length * n)) * 100 + "%";
  $("#sesiTitle").textContent = `${NAME[S.m]} · bagian ${S.i + 1}/${S.ch.length}`;
  STEPS[FLOW[S.m][S.s]](body(), S.ch[S.i]);
}

function feedback(b, ans, src, reveal) {
  const r = compare(ans, src), ok = r.pct >= 50;
  b.querySelector("#res").innerHTML = `
    <div class="insight"><b>${r.pct}% istilah kunci tercakup.</b>
    ${r.miss.length ? `Belum disebut: ${r.miss.map(esc).join(", ")}.` : "Semua istilah kunci tersebut."}
    ${ok ? " Pemahamanmu sudah cukup kuat, lanjut ya." : " Sebaiknya baca bagian ini sekali lagi, lalu coba lagi."}</div>
    ${reveal ? `<div class="sesi-text">${mark(src, r.miss)}</div>` : ""}
    <div class="actions">${ok ? "" : `<button class="secondary-button" id="rd">Baca lagi</button>`}<button class="${ok ? "primary" : "secondary"}-button" id="go">${ok ? "Lanjut" : "Lanjut saja"}</button></div>`;
  b.querySelector("#go").onclick = next;
  if (!ok) b.querySelector("#rd").onclick = again;
}

const STEPS = {
  read(b, c) {
    S.reading = true;
    const pom = S.m === "pomodoro", t0 = Date.now();
    b.innerHTML = `<p class="muted">${pom ? "Fokus baca bagian ini. Target 25 menit, boleh selesai lebih cepat." : "Baca pelan-pelan. Setelah ini catatan akan ditutup."}</p>
      <div class="sesi-clock" id="sc"></div><div class="sesi-text">${esc(c)}</div>
      <button class="primary-button" id="go">Sudah selesai baca</button>`;
    const upd = () => { const e = (Date.now() - t0) / 1000; $("#sc").textContent = pom ? mmss(1500 - e) : mmss(e); };
    upd(); tick = setInterval(upd, 1000);
    b.querySelector("#go").onclick = () => { recordStudy(Math.round((Date.now() - t0) / 1000)); next(); };
  },
  break(b) {
    const t0 = Date.now(), total = (S.i + 1) % 4 === 0 ? 900 : 300;
    b.innerHTML = `<div class="breath"></div><p id="bt" class="center"><b>Tarik napas…</b></p>
      <p class="muted center">Lihat objek jauh 20 detik, minum air, regangkan bahu.${total === 900 ? " Ini istirahat panjang setelah 4 bagian." : ""}</p>
      <div class="sesi-clock" id="sc"></div><button class="primary-button" id="go">Lanjut</button>`;
    const upd = () => { const e = (Date.now() - t0) / 1000; $("#sc").textContent = mmss(total - e); $("#bt").innerHTML = `<b>${Math.floor(e) % 8 < 4 ? "Tarik napas…" : "Hembuskan…"}</b>`; };
    upd(); tick = setInterval(upd, 1000);
    b.querySelector("#go").onclick = next;
  },
  explain(b, c) {
    b.innerHTML = `<p>Jelaskan bagian tadi dengan bahasamu sendiri, seolah mengajar adik kelas.</p>
      <textarea id="ans" rows="6" placeholder="Menurutku, intinya adalah…"></textarea>
      <button class="primary-button" id="chk">Periksa penjelasanku</button><div id="res"></div>`;
    b.querySelector("#chk").onclick = () => { if (b.querySelector("#ans").value.trim().length > 15) feedback(b, b.querySelector("#ans").value, c, false); };
  },
  recall(b, c) {
    b.innerHTML = `<p>Catatan ditutup. Tulis semua yang kamu ingat dari bagian tadi.</p>
      <textarea id="ans" rows="6" placeholder="Yang aku ingat…"></textarea>
      <button class="primary-button" id="chk">Periksa ingatanku</button><div id="res"></div>`;
    b.querySelector("#chk").onclick = () => { if (b.querySelector("#ans").value.trim().length > 15) feedback(b, b.querySelector("#ans").value, c, true); };
  },
  quiz(b, c) {
    const qs = cloze(c);
    if (!qs.length || gentle) return next();
    b.innerHTML = `<p>Kuis isian singkat. Lengkapi kata yang hilang.</p>` +
      qs.map((q, i) => `<div class="quiz-q"><p>${i + 1}. ${esc(q.q)}</p><input type="text" data-i="${i}" autocomplete="off"></div>`).join("") +
      `<button class="primary-button" id="chk">Periksa</button><div id="res"></div>`;
    b.querySelector("#chk").onclick = () => {
      let score = 0;
      b.querySelectorAll("input[data-i]").forEach((inp) => {
        const q = qs[inp.dataset.i], ok = inp.value.trim().toLowerCase() === q.a;
        if (ok) score++; inp.classList.toggle("good", ok); inp.classList.toggle("bad", !ok);
        inp.insertAdjacentHTML("afterend", ok ? "" : `<small class="muted"> Jawaban: ${esc(q.a)}</small>`);
      });
      const pass = score >= Math.ceil(qs.length * 0.6);
      b.querySelector("#res").innerHTML = `<div class="insight"><b>Skor ${score}/${qs.length}.</b> ${pass ? "Bagus, ingatanmu sudah cukup kuat." : "Belum kuat, baca bagian ini sekali lagi."}</div>
        <div class="actions">${pass ? "" : `<button class="secondary-button" id="rd">Baca lagi</button>`}<button class="${pass ? "primary" : "secondary"}-button" id="go">${pass ? "Lanjut" : "Lanjut saja"}</button></div>`;
      b.querySelector("#go").onclick = next;
      if (!pass) b.querySelector("#rd").onclick = again;
      b.querySelector("#chk").disabled = true;
    };
  }
};

/* ---------- Kartu ulasan (spaced repetition) ---------- */
const cards = () => read("pancanitiCards", []);
function finish() {
  S.reading = false; $("#sesiBar").style.width = "100%";
  let extra = "";
  if (S.m === "spaced") {
    const base = new Date(), rv = [1, 3, 7, 14].map((n) => { const d = new Date(base); d.setDate(d.getDate() + n); return { d: dateKey(d), done: false }; });
    write("pancanitiCards", [...cards(), { id: Date.now(), title: S.title, text: S.text, rv }]);
    extra = `<p class="insight">Jadwal ulasan dibuat: hari ke-1, 3, 7, dan 14. Saat jatuh tempo, muncul di bagian "Ulasan jatuh tempo".</p>`;
  }
  if (S.m === "review") {
    const all = cards(), c = all.find((x) => x.id === S.card);
    if (c) { const r = c.rv.find((x) => !x.done && x.d <= todayKey()); if (r) r.done = true; write("pancanitiCards", all); }
  }
  body().innerHTML = `<h3 class="center">Sesi selesai 🎉</h3><p class="center muted">Kamu menyelesaikan ${S.ch.length} bagian. Waktu baca sudah masuk ke statistikmu.</p>${extra}<div class="actions"><button class="primary-button" id="go">Selesai</button></div>`;
  body().querySelector("#go").onclick = closeSesi;
}
function renderDue() {
  const t = todayKey(), box = $("#dueList"); box.innerHTML = "";
  cards().forEach((c) => {
    const nx = c.rv.find((r) => !r.done);
    if (!nx) return;
    const el = document.createElement("button");
    el.className = "chip"; el.type = "button";
    if (nx.d <= t) { el.textContent = `🔁 Ulangi: ${c.title}`; el.onclick = () => start("review", c.title, c.text, c.id); }
    else { el.disabled = true; el.textContent = `${c.title}: ${nx.d}`; }
    box.appendChild(el);
  });
  if (!box.children.length) box.innerHTML = `<p class="muted">Belum ada. Selesaikan sesi Spaced Repetition untuk membuat jadwal ulasan.</p>`;
}

/* ---------- Pemicu sesi ---------- */
$("#matFile").addEventListener("change", (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("#matText").value = String(r.result); if (!$("#matTitle").value) $("#matTitle").value = f.name.replace(/\.\w+$/, ""); };
  r.readAsText(f);
});
document.querySelectorAll(".method-card").forEach((c) => c.addEventListener("click", () => {
  const text = $("#matText").value.trim();
  if (text.length < 120) { $("#matNote").textContent = "Tempel materi yang lebih panjang dulu (minimal beberapa kalimat)."; $("#matText").focus(); return; }
  $("#matNote").textContent = "";
  start(c.dataset.method, $("#matTitle").value.trim() || text.slice(0, 30), text);
}));
$("#sesiClose").addEventListener("click", closeSesi);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S) closeSesi(); });
renderDue();

/* ---------- Pengingat istirahat (gelembung kecil, tidak menutupi layar) ---------- */
function bubble(t, p, btns) {
  document.querySelector(".bubble")?.remove();
  const d = document.createElement("div");
  d.className = "bubble"; d.setAttribute("role", "status");
  d.innerHTML = `<h3>${t}</h3><p>${p}</p><div class="actions"></div>`;
  btns.forEach(([l, f, pri]) => {
    const b = document.createElement("button");
    b.className = pri ? "primary-button" : "secondary-button"; b.textContent = l;
    b.onclick = () => { d.remove(); f && f(); };
    d.lastChild.appendChild(b);
  });
  document.body.appendChild(d);
}
/* Batas bisa diubah. 90 menit mengikuti siklus ultradian (kewaspadaan turun setelah ±90 menit). */
const LIMIT_EYE = 20 * 60, LIMIT_BREAK = 90 * 60, LIMIT_DAY = 6 * 3600, IDLE_RESET = 5 * 60;
let cont = 0, eye = 0, idle = 0, dayWarned = false;
setInterval(() => {
  const focusing = (running && timerMode === "focus") || (S && S.reading);
  if (focusing) { cont += 5; eye += 5; idle = 0; }
  else if ((idle += 5) >= IDLE_RESET) { cont = 0; eye = 0; }
  if (eye >= LIMIT_EYE) {
    eye = 0;
    if (cont < LIMIT_BREAK) bubble("👀 20-20-20", "Lihat objek sejauh ±6 meter selama 20 detik, lalu lanjut.", [["Oke", null, true]]);
  }
  if (cont >= LIMIT_BREAK) {
    cont = LIMIT_BREAK - 600;
    bubble("🌿 Waktunya istirahat", "Kamu sudah fokus sekitar 90 menit tanpa jeda. Otak butuh istirahat supaya tidak burnout. Minum air dan bergeraklah sebentar.", [
      ["Istirahat 15 menit", () => { if (S) closeSesi(); document.querySelector('.timer-tab[data-mode="long"]').click(); location.hash = "#belajar"; }, true],
      ["10 menit lagi", null]
    ]);
  }
  if (!dayWarned && (Number(studyData[todayKey()]) || 0) >= LIMIT_DAY) {
    dayWarned = true;
    bubble("🌙 Sudah banyak belajar hari ini", "Kamu sudah fokus lebih dari 6 jam. Kualitas tidur ikut menentukan hasil belajar besok, jadi sisakan tenaga.", [["Mengerti", null, true]]);
  }
}, 5000);

/* ---------- Belajar bareng via tautan (tanpa server) ---------- */
function live(n, s, d) {
  const el = $("#roomLive"); el.hidden = false;
  let joined = false;
  el.innerHTML = `<h3>${esc(n)}</h3><div class="sesi-clock" id="rc"></div><p class="muted" id="rs"></p><button class="primary-button" id="rj">Ikut sesi ini</button>`;
  $("#rj").onclick = () => { joined = true; $("#rj").disabled = true; $("#rj").textContent = "Kamu ikut ✓"; };
  const upd = () => {
    const now = Date.now(), e = s + d * 60000;
    if (now < s) { $("#rc").textContent = mmss((s - now) / 1000); $("#rs").textContent = "Menunggu mulai. Siapkan materimu."; }
    else if (now < e) { $("#rc").textContent = mmss((e - now) / 1000); $("#rs").textContent = "Sesi berjalan. Semua yang membuka tautan ini melihat waktu yang sama."; if (joined && !document.hidden) recordStudy(1); }
    else { $("#rc").textContent = "00:00"; $("#rs").textContent = "Sesi selesai. Istirahat dulu 🌷"; }
  };
  upd(); setInterval(upd, 1000);
}
$("#roomForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = $("#roomName").value.trim() || "Sesi bareng", d = Number($("#roomMin").value), s = Date.now() + 120000;
  const url = location.href.split("#")[0] + "#" + new URLSearchParams({ room: n, s, d });
  $("#roomLink").value = url; $("#roomShare").hidden = false;
  try { navigator.clipboard.writeText(url); } catch {}
  live(n, s, d);
});
const rp = new URLSearchParams(location.hash.slice(1));
if (rp.get("room") && Number(rp.get("s")) && Number(rp.get("d"))) {
  live(rp.get("room"), Number(rp.get("s")), Number(rp.get("d")));
  setTimeout(() => $("#komunitas").scrollIntoView(), 100);
}
})();

/* =====================================================================
   TAMBAHAN: onboarding profil, mode 1 menit, check-in mood, rescue mode
===================================================================== */
let userProfile = read("userProfile", null);
let moodLog = read("pancanitiMood", {});
let rescueLog = read("pancanitiRescue", []);
const MOOD = [["😊", "semangat", 5], ["🙂", "oke", 4], ["😐", "netral", 3], ["😔", "lelah", 2], ["😰", "cemas", 1]];
const escH = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const clk = (s) => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
function pop(html) {
  const o = document.createElement("div"); o.className = "pop";
  o.innerHTML = `<div class="pop-card" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(o); o.close = () => o.remove(); return o;
}
function setFocus(min) { // pakai tab "Fokus N" khusus agar tab bawaan tidak berubah
  let t = $("#tabCustom");
  if (!t) {
    t = document.createElement("button"); t.id = "tabCustom"; t.className = "timer-tab"; t.dataset.mode = "focus";
    $(".timer-tabs").prepend(t);
    t.addEventListener("click", () => { $$(".timer-tab").forEach((x) => x.classList.toggle("active", x === t)); timerMode = "focus"; timerDuration = Number(t.dataset.minutes) * 60; resetTimerUI(); });
  }
  t.dataset.minutes = min; t.textContent = `Fokus ${min}`;
  $$(".timer-tab").forEach((x) => x.classList.toggle("active", x === t));
  timerMode = "focus"; timerDuration = min * 60; resetTimerUI();
}
const peakNow = () => { const h = new Date().getHours(); return h >= 5 && h < 11 ? "pagi" : h >= 11 && h < 15 ? "siang" : h >= 15 && h < 18 ? "sore" : "malam"; };

/* ----- 1. Onboarding & profil ----- */
const QS = [
  { k: "lastFocus", q: "Kapan terakhir kamu berhasil fokus >15 menit?", o: ["hari ini", "minggu ini", "bulan ini", "sudah lama sekali"] },
  { k: "blockers", multi: 1, q: "Apa yang biasanya bikin kamu berhenti belajar?", o: ["notifikasi", "bosan", "capek", "bingung", "cemas", "tidak tahu mulai dari mana"] },
  { k: "peakTime", q: "Jam berapa energimu paling tinggi?", o: ["pagi", "siang", "sore", "malam", "tidak tahu"] },
  { k: "socialPref", q: "Kamu lebih suka belajar sendiri atau bareng?", o: ["sendiri", "bareng", "campur"] },
  { k: "copingStyle", q: "Kalau materi terasa berat, kamu biasanya…", o: ["berhenti", "ganti materi", "pecah jadi kecil", "tanya orang"] }
];
function onboarding() {
  const ans = { blockers: [] }; let i = 0;
  const m = pop(`<div class="progress-track"><div class="progress-fill" id="obBar"></div></div><div id="obBody"></div>`);
  const adv = () => { if (++i >= QS.length) { userProfile = ans; write("userProfile", ans); m.close(); applyProfile(); } else show(); };
  function show() {
    const q = QS[i], b = m.querySelector("#obBody");
    m.querySelector("#obBar").style.width = (i / QS.length) * 100 + "%";
    b.innerHTML = `<h3 style="margin-top:16px">${q.q}</h3>${q.multi ? `<p class="tiny">Boleh pilih lebih dari satu.</p>` : ""}<div class="chips ob-opts"></div>${q.multi ? `<div class="actions"><button class="primary-button" id="obNext">Lanjut</button></div>` : ""}`;
    const box = b.querySelector(".ob-opts");
    q.o.forEach((o) => {
      const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.textContent = o;
      c.onclick = () => q.multi ? c.classList.toggle("on") : (ans[q.k] = o, adv());
      box.appendChild(c);
    });
    if (q.multi) b.querySelector("#obNext").onclick = () => { ans.blockers = [...box.querySelectorAll(".on")].map((x) => x.textContent); adv(); };
  }
  show();
}
function applyProfile() {
  const p = userProfile; if (!p) return;
  if (p.blockers.includes("bosan") || p.lastFocus === "sudah lama sekali") setFocus(15);
  const tip = {
    pagi: "Energimu paling tinggi di pagi hari. Taruh materi tersulit sebelum jam 10:00.",
    siang: "Energimu puncak di siang hari. Jadwalkan materi berat sekitar jam 11:00–14:00.",
    sore: "Sorenya energimu paling bagus. Coba sesi berat jam 15:00–17:00.",
    malam: "Kamu paling fokus malam hari. Selesaikan sesi berat sebelum jam 22:00 supaya tidurmu tetap cukup."
  }[p.peakTime] || "Belum tahu jam terbaikmu? Catat mood sebelum tiap sesi, nanti polanya kelihatan.";
  let n = $("#profNote");
  if (!n) { n = document.createElement("p"); n.id = "profNote"; n.className = "insight"; $(".timer-card").appendChild(n); }
  n.textContent = "💡 " + tip + (p.blockers.includes("bosan") ? " Kamu mudah bosan, jadi sesi diset 15 menit." : "") +
    (p.blockers.includes("notifikasi") ? " Notifikasi sering mengganggumu: aktifkan mode jangan ganggu." : "") +
    (p.socialPref === "bareng" ? " Kamu suka belajar bareng: coba buat sesi di bagian Bareng." : "");
}
function tone() { if (userProfile?.copingStyle === "berhenti") $("#timerStatus").textContent += " Kamu bertahan sampai akhir, itu hebat. 🌱"; }

/* ----- 3. Check-in mood + Gentle Mode ----- */
function moodGate() {
  const m = pop(`<h3>Gimana perasaanmu sekarang?</h3><div class="mood-row">${MOOD.map(([e, l]) => `<button type="button" class="mood" data-e="${e}"><span>${e}</span><small>${l}</small></button>`).join("")}</div><div class="actions"><button class="secondary-button" id="mSkip">Lewati</button></div>`);
  const go = () => { m.close(); gateOk = true; startTimer(); };
  m.querySelector("#mSkip").onclick = go;
  m.querySelectorAll(".mood").forEach((b) => b.onclick = () => {
    const e = b.dataset.e;
    (moodLog[todayKey()] ||= []).push({ time: Date.now(), mood: e });
    write("pancanitiMood", moodLog); updateMood();
    if (e === "😔" || e === "😰") { m.close(); setFocus(10); gentle = true; gateOk = true; startTimer(); }
    else if (e === "😊" && userProfile?.peakTime === peakNow()) {
      m.querySelector(".pop-card").innerHTML = `<h3>Energimu lagi di puncak! 🔥</h3><p class="muted">Ini jam terbaikmu. Mau coba Deep Mode 50 menit?</p><div class="actions"><button class="secondary-button" id="dN">Normal</button><button class="primary-button" id="dD">Deep 50 menit</button></div>`;
      m.querySelector("#dN").onclick = go;
      m.querySelector("#dD").onclick = () => { m.close(); setFocus(50); gateOk = true; startTimer(); };
    } else go();
  });
}
function updateMood() {
  let el = $("#moodAvg");
  if (!el) { el = document.createElement("p"); el.id = "moodAvg"; el.className = "insight"; $(".stat-row").after(el); }
  const v = lastDays(7).flatMap((d) => moodLog[d.key] || []).map((x) => MOOD.find((m) => m[0] === x.mood)[2]);
  if (!v.length) { el.textContent = "Mood minggu ini: belum ada catatan. Kamu akan ditanya sebelum timer fokus mulai."; return; }
  const a = v.reduce((s, x) => s + x, 0) / v.length, e = MOOD.reduce((b, m) => Math.abs(m[2] - a) < Math.abs(b[2] - a) ? m : b);
  el.textContent = `Mood minggu ini: ${e[0]} (rata-rata ${e[1]}, dari ${v.length} catatan)`;
}

/* ----- 2. Mulai 1 menit (tangga 1 → 5 → 15 → 25 menit) ----- */
function oneMin() {
  const mat = $("#matText").value.trim();
  const LAD = [60, 240, 600, 600], OFFER = ["Mau lanjut 4 menit lagi?", "Mau lanjut 10 menit lagi?", "Mau lanjut 10 menit lagi (jadi 25 menit)?"];
  let i = 0, total = 0, iv; const m = pop(`<div id="omB"></div>`), B = () => m.querySelector("#omB");
  const msg = () => `Kamu baru saja belajar ${Math.max(1, Math.round(total / 60))} menit. Itu sudah lebih dari 0. 🌱`;
  const end = (sec, full) => {
    clearInterval(iv); sec = Math.round(sec); recordStudy(sec); total += sec;
    if (full && i < 3) {
      B().innerHTML = `<h3>${OFFER[i]}</h3><p class="muted">${msg()}</p><div class="actions"><button class="secondary-button" id="omN">Cukup</button><button class="primary-button" id="omY">Ya, lanjut</button></div>`;
      B().querySelector("#omN").onclick = () => fin(); B().querySelector("#omY").onclick = () => { i++; run(); };
    } else fin();
  };
  const fin = () => { B().innerHTML = `<h3 class="center">Selesai 🎉</h3><p class="center muted">${msg()}</p><div class="actions"><button class="primary-button" id="omC">Tutup</button></div>`; B().querySelector("#omC").onclick = () => m.close(); };
  function run() {
    const len = LAD[i], t0 = Date.now();
    B().innerHTML = `<h3>${i === 0 ? "Cuma 1 menit. Itu saja." : "Lanjut " + Math.round(len / 60) + " menit"}</h3><div class="sesi-clock" id="omT"></div>` +
      (i === 0 ? (mat ? `<div class="sesi-text">${escH(mat.slice(0, 600))}</div>` : `<p class="muted">Tulis apa saja yang kamu ingat tentang topik ini:</p><textarea rows="4"></textarea>`) : `<p class="muted center">Pelan-pelan saja. Kamu sudah mulai, itu bagian tersulit.</p>`) +
      `<div class="actions"><button class="secondary-button" id="omX">Cukup</button></div>`;
    B().querySelector("#omX").onclick = () => end((Date.now() - t0) / 1000, false);
    const upd = () => { const e = (Date.now() - t0) / 1000; B().querySelector("#omT").textContent = clk(len - e); if (e >= len) end(len, true); };
    upd(); iv = setInterval(upd, 500);
  }
  run();
}
$("#oneMin").onclick = oneMin;

/* ----- 4. Rescue mode "Aku stuck" ----- */
const fab = document.createElement("button");
fab.className = "rescue-fab"; fab.type = "button"; fab.hidden = true; fab.textContent = "🆘 Aku stuck";
document.body.appendChild(fab);
setInterval(() => { fab.hidden = !(running || !$("#sesi").hidden); }, 1000);
const logRescue = (choice) => { rescueLog.push({ t: Date.now(), day: todayKey(), choice }); write("pancanitiRescue", rescueLog); };
fab.onclick = () => {
  const m = pop(`<h3>Nggak apa-apa. Kita cari jalan keluarnya 🌿</h3><div class="stack"><button class="secondary-button" data-r="pecah">✂️ Pecah tugas ini jadi 3 langkah kecil</button><button class="secondary-button" data-r="metode">🔀 Ganti metode belajar</button><button class="secondary-button" data-r="rehat">🌬️ Istirahat 2 menit dulu</button><button class="secondary-button" data-r="tutup">Kembali</button></div>`);
  const card = m.querySelector(".pop-card");
  m.querySelectorAll("[data-r]").forEach((b) => b.onclick = () => {
    const r = b.dataset.r; if (r === "tutup") return m.close();
    logRescue(r);
    if (r === "pecah") {
      const t = getTasks().find((x) => !x.completed)?.text || $("#matTitle").value.trim() || "materi ini";
      const steps = [`Baca 1 paragraf: ${t}`, "Tulis 1 kalimat ringkasan", "Cek 1 istilah kunci"];
      steps.forEach((s) => getTasks().push({ id: Date.now() + Math.random(), text: s, completed: false }));
      saveTasks(); renderTasks();
      card.innerHTML = `<h3>3 langkah kecil</h3><ol style="padding-left:20px;margin:10px 0">${steps.map((s) => `<li>${escH(s)}</li>`).join("")}</ol><p class="muted">Sudah masuk ke daftar tugasmu. Mulai dari yang pertama saja.</p><div class="actions"><button class="primary-button" id="rOk">Oke</button></div>`;
      card.querySelector("#rOk").onclick = () => m.close();
    } else if (r === "metode") {
      card.innerHTML = `<h3>Pilih cara lain</h3><div class="stack">${[["pomodoro", "🍅 Pomodoro"], ["feynman", "💬 Feynman"], ["active", "🧠 Active Recall"], ["spaced", "🌼 Spaced Repetition"]].map(([k, l]) => `<button class="secondary-button" data-m="${k}">${l}</button>`).join("")}</div>`;
      card.querySelectorAll("[data-m]").forEach((x) => x.onclick = () => {
        m.close(); if (!$("#sesi").hidden) $("#sesiClose").click();
        $(`.method-card[data-method="${x.dataset.m}"]`).click();
        if ($("#matText").value.trim().length < 120) location.hash = "#metode";
      });
    } else {
      const t0 = Date.now();
      card.innerHTML = `<div class="breath box"></div><p id="rb" class="center"><b>Tarik napas…</b></p><div class="sesi-clock" id="rt"></div><p class="muted center">Napas kotak: tarik 4, tahan 4, buang 4, tahan 4.</p><div class="actions"><button class="primary-button" id="rOk">Sudah siap</button></div>`;
      const upd = () => { const e = (Date.now() - t0) / 1000; card.querySelector("#rt").textContent = clk(120 - e); card.querySelector("#rb").innerHTML = `<b>${["Tarik napas…", "Tahan…", "Hembuskan…", "Tahan…"][Math.floor(e / 4) % 4]}</b>`; if (e >= 120) { clearInterval(iv); m.close(); } };
      const iv = setInterval(upd, 500); upd();
      card.querySelector("#rOk").onclick = () => { clearInterval(iv); m.close(); };
    }
  });
};

/* ----- Inisialisasi tambahan ----- */
applyProfile(); updateMood();
if (!userProfile) onboarding();