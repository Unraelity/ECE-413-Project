let weeklyChart = null;
let hrChart = null;
let spo2Chart = null;

$(function () {
  const token = localStorage.getItem("token");
  if (!token) return location.replace("login.html");

  $("#btnLogOut").on("click", () => {
    localStorage.removeItem("token");
    location = "login.html";
  });

  // schedule
  $("#btnSaveSchedule").on("click", saveSchedule);
  loadSchedule();

  // weekly
  loadWeekly();

  // daily
  $("#dayPick")
    .val(localDateYYYYMMDD(new Date()))
    .on("change", loadDay);
  loadDay();

  // devices
  $("#btnRegisterDevice").on("click", registerDevice);
  $("#btnRefreshDevices").on("click", loadDevices);
  loadDevices();

  function loadWeekly() {
    $.ajax({
      url: "/readings/weekly-summary",
      method: "GET",
      headers: { "x-auth": token },
      dataType: "json",
    }).done(renderWeekly).fail(showErr);
  }

  function loadDay() {
    const day = $("#dayPick").val();
    if (!day) return;

    $.ajax({
      url: "/readings?day=" + encodeURIComponent(day),
      method: "GET",
      headers: { "x-auth": token },
      dataType: "json",
    }).done(renderDay).fail(showErr);
  }

  function loadSchedule() {
    $("#scheduleStatus").text("Loading…");
    $.ajax({
      url: "/customers/settings",
      method: "GET",
      headers: { "x-auth": token },
      dataType: "json",
    })
      .done((cfg) => {
        $("#cfgStart").val(cfg?.startTime || "06:00");
        $("#cfgEnd").val(cfg?.endTime || "22:00");
        $("#cfgFreq").val(Number.isFinite(cfg?.freqMins) ? cfg.freqMins : 30);
        $("#scheduleStatus").text("");
        loadDay();
      })
      .fail(() => {
        $("#cfgStart").val("06:00");
        $("#cfgEnd").val("22:00");
        $("#cfgFreq").val(30);
        $("#scheduleStatus").text("");
      });
  }

  function saveSchedule() {
    const startTime = $("#cfgStart").val();
    const endTime = $("#cfgEnd").val();
    const freqMins = parseInt($("#cfgFreq").val(), 10);

    if (!isHHMM(startTime) || !isHHMM(endTime)) return alert("Start/End must be HH:MM.");
    if (!Number.isFinite(freqMins) || freqMins < 1) return alert("Frequency must be a positive number (minutes).");

    $("#scheduleStatus").text("Saving…");
    $.ajax({
      url: "/customers/settings",
      method: "PUT",
      headers: { "x-auth": token },
      contentType: "application/json",
      data: JSON.stringify({ startTime, endTime, freqMins }),
    })
      .done(() => {
        $("#scheduleStatus").text("Saved");
        setTimeout(() => $("#scheduleStatus").text(""), 1500);
        loadDay();
      })
      .fail((jq) => {
        $("#scheduleStatus").text("");
        alert(jq.responseText || "Failed to save schedule");
      });
  }
});

function showErr(e) {
  console.log(e);
  alert("Request failed");
}

// weekly: force 7 days, Avg is a BAR now
function renderWeekly(rows) {
  const byDate = new Map((rows || []).map((r) => [r.date, r]));

  const labels = [];
  const avg = [];
  const min = [];
  const max = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateYYYYMMDD(d);

    labels.push(key);
    const r = byDate.get(key);
    avg.push(r ? Math.round(r.avg) : null);
    min.push(r ? r.min : null);
    max.push(r ? r.max : null);
  }

  const canvas = document.getElementById("weeklyChart");
  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Avg HR", data: avg },
        { label: "Min HR", data: min },
        { label: "Max HR", data: max },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { beginAtZero: true, title: { display: true, text: "Heart Rate (bpm)" } },
      },
      plugins: { legend: { position: "top" } },
    },
  });
}

// daily: separate charts + destroy old charts + mark min/max points
function renderDay(docs) {
  const startMin = hhmmToMinutes($("#cfgStart").val() || "00:00");
  const endMin = hhmmToMinutes($("#cfgEnd").val() || "23:59");

  const sorted = (docs || [])
    .map((x) => ({ ts: new Date(x.ts), hr: Number(x.hr), spo2: Number(x.spo2) }))
    .filter((x) => !isNaN(x.ts.getTime()))
    .sort((a, b) => a.ts - b.ts);

  const filtered = sorted.filter((x) => {
    const mins = x.ts.getHours() * 60 + x.ts.getMinutes();
    if (endMin >= startMin) return mins >= startMin && mins <= endMin;
    return mins >= startMin || mins <= endMin; // crossing midnight
  });

  const labels = filtered.map((x) =>
    x.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  renderSeriesChart({
    canvasId: "hrChart",
    title: "Heart Rate",
    yLabel: "bpm",
    labels,
    values: filtered.map((x) => x.hr),
  });

  renderSeriesChart({
    canvasId: "spo2Chart",
    title: "SpO₂",
    yLabel: "%",
    labels,
    values: filtered.map((x) => x.spo2),
  });
}

function renderSeriesChart({ canvasId, title, yLabel, labels, values }) {
  const canvas = document.getElementById(canvasId);

  if (canvasId === "hrChart" && hrChart) hrChart.destroy();
  if (canvasId === "spo2Chart" && spo2Chart) spo2Chart.destroy();

  const { minIdx, maxIdx } = argMinMax(values);
  const minSeries = values.map((v, i) => (i === minIdx ? v : null));
  const maxSeries = values.map((v, i) => (i === maxIdx ? v : null));

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: title, data: values, tension: 0.2, pointRadius: 2 },
        { label: "Min", data: minSeries, showLine: false, pointRadius: 6 },
        { label: "Max", data: maxSeries, showLine: false, pointRadius: 6 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { title: { display: true, text: "Time of day" } },
        y: { title: { display: true, text: yLabel } },
      },
      plugins: {
        legend: { labels: { filter: (item) => item.text === title } },
      },
    },
  });

  if (canvasId === "hrChart") hrChart = chart;
  if (canvasId === "spo2Chart") spo2Chart = chart;
}

// devices
function renderDevices(list) {
  const $wrap = $("#devicesList").empty();
  if (!list || list.length === 0) return $wrap.html("<em>No devices yet. Register one above.</em>");

  list.forEach((dev) => {
    const particleId = dev.particleId || dev.particle_id || dev.particleID || "—";
    $wrap.append($(`
      <div class="device-row">
        <div class="device-meta">
          <span class="device-name">${escapeHtml(dev.name)}</span>
          <div class="api-line small">
            <span class="muted">Particle ID:</span>
            <span class="code-badge">${escapeHtml(particleId)}</span>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-del" data-id="${dev._id}">Delete</button>
      </div>
    `));
  });

  $(".btn-del").off("click").on("click", function () {
    const id = $(this).data("id");
    const token = localStorage.getItem("token");
    $.ajax({ url: "/devices/" + id, method: "DELETE", headers: { "x-auth": token } })
      .done(loadDevices)
      .fail(() => alert("Delete failed"));
  });
}

function loadDevices() {
  const token = localStorage.getItem("token");
  $("#devicesList").html("<em>Loading…</em>");
  $.ajax({ url: "/devices", method: "GET", headers: { "x-auth": token }, dataType: "json" })
    .done(renderDevices)
    .fail(() => $("#devicesList").html("<em>Error loading devices.</em>"));
}

function registerDevice() {
  const token = localStorage.getItem("token");
  const name = $("#deviceName").val().trim();
  const particleId = $("#particleId").val().trim();
  if (!name) return alert("Enter a device name");

  $.ajax({
    url: "/devices",
    method: "POST",
    headers: { "x-auth": token },
    contentType: "application/json",
    data: JSON.stringify({ name, particleId }),
  })
    .done(() => { $("#deviceName").val(""); $("#particleId").val(""); loadDevices(); })
    .fail((jq) => alert(jq.responseText || "Registration failed"));
}

// helpers
function localDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function isHHMM(s) { return typeof s === "string" && /^\d{2}:\d{2}$/.test(s); }
function hhmmToMinutes(s) { const [hh, mm] = (s || "00:00").split(":").map(n => parseInt(n, 10)); return hh * 60 + mm; }
function argMinMax(arr) {
  let minIdx = -1, maxIdx = -1, min = Infinity, max = -Infinity;
  (arr || []).forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    if (v < min) { min = v; minIdx = i; }
    if (v > max) { max = v; maxIdx = i; }
  });
  return { minIdx, maxIdx };
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// chatbot
const chatBtn = document.getElementById("chatButton");
const chatPanel = document.getElementById("chatPanel");
const closeChat = document.getElementById("closeChat");
if (chatBtn && chatPanel) chatBtn.addEventListener("click", () => chatPanel.classList.add("open"));
if (closeChat && chatPanel) closeChat.addEventListener("click", () => chatPanel.classList.remove("open"));

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

function addChatMessage(text, sender) {
  if (!chatMessages) return;
  const msg = document.createElement("div");
  msg.classList.add("chat-msg", sender);
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (chatSendBtn) chatSendBtn.addEventListener("click", sendChat);
if (chatInput) chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

async function sendChat() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;

  addChatMessage(text, "user");
  chatInput.value = "";

  const thinkingMsg = document.createElement("div");
  thinkingMsg.classList.add("chat-msg", "bot");
  thinkingMsg.textContent = "Thinking...";
  if (chatMessages) chatMessages.appendChild(thinkingMsg);

  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth": token },
      body: JSON.stringify({ question: text }),
    });
    const data = await res.json();
    thinkingMsg.remove();
    addChatMessage(data?.reply || "No response from AI.", "bot");
  } catch {
    thinkingMsg.remove();
    addChatMessage("Error contacting AI server.", "bot");
  }
}