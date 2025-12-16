// Chart.js instances (kept global so we can destroy/re-create them cleanly)
let weeklyChart = null;
let hrChart = null;
let spo2Chart = null;

// jQuery "document ready"
$(function () {
  // Read JWT from localStorage; if missing, user is not logged in
  const token = localStorage.getItem("token");
  if (!token) return location.replace("login.html");

  // Log out: clear token and redirect to login
  $("#btnLogOut").on("click", () => {
    localStorage.removeItem("token");
    location = "login.html";
  });

  // --- Schedule settings (read frequency minutes) ---
  $("#btnSaveSchedule").on("click", saveSchedule);
  loadSchedule();

  // --- Weekly summary chart ---
  loadWeekly();

  // --- Daily charts (for a selected day) ---
  $("#dayPick")
    .val(localDateYYYYMMDD(new Date())) // default to today in YYYY-MM-DD
    .on("change", loadDay);             // reload charts when date changes
  loadDay();

  // --- Device management ---
  $("#btnRegisterDevice").on("click", registerDevice);
  $("#btnRefreshDevices").on("click", loadDevices);
  loadDevices();

  // Fetch 7-day summary from server and render weekly chart
  function loadWeekly() {
    $.ajax({
      url: "/readings/weekly-summary",
      method: "GET",
      headers: { "x-auth": token }, // auth middleware expects x-auth
      dataType: "json",
    }).done(renderWeekly).fail(showErr);
  }

  // Fetch readings for the selected day and render day charts
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

  // Load user's schedule settings (frequency) from server
  function loadSchedule() {
    $("#scheduleStatus").text("Loading…");
    $.ajax({
      url: "/customers/settings",
      method: "GET",
      headers: { "x-auth": token },
      dataType: "json",
    })
      .done((cfg) => {
        // Use server value if valid; otherwise default to 30 minutes
        $("#cfgFreq").val(Number.isFinite(cfg?.freqMins) ? cfg.freqMins : 30);
        $("#scheduleStatus").text("");
        loadDay(); // refresh daily view after loading settings
      })
      .fail(() => {
        // On failure, fall back to default UI values
        $("#cfgFreq").val(30);
        $("#scheduleStatus").text("");
      });
  }

  // Save schedule settings (frequency) to server
  function saveSchedule() {
    const freqMins = parseInt($("#cfgFreq").val(), 10);

    // Basic input validation
    if (!Number.isFinite(freqMins) || freqMins < 1)
      return alert("Frequency must be a positive number (minutes).");

    $("#scheduleStatus").text("Saving…");
    $.ajax({
      url: "/customers/settings",
      method: "PUT",
      headers: { "x-auth": token },
      contentType: "application/json",
      data: JSON.stringify({ freqMins }),
    })
      .done(() => {
        $("#scheduleStatus").text("Saved");
        // Clear status message after 1.5 seconds
        setTimeout(() => $("#scheduleStatus").text(""), 1500);
        loadDay(); // refresh daily charts based on updated schedule
      })
      .fail((jq) => {
        $("#scheduleStatus").text("");
        alert(jq.responseText || "Failed to save schedule");
      });
  }

  // Start the reminder prompt finite state machine
  startReadingPromptFSM();
});

// Generic AJAX error handler
function showErr(e) {
  console.log(e);
  alert("Request failed");
}

/* =========================
   WEEKLY CHART (7 days)
   - forces exactly 7 days
   - Avg shown as BAR (plus Min/Max bars)
========================= */
function renderWeekly(rows) {
  // Create a map keyed by date string for quick lookup: "YYYY-MM-DD" -> summary row
  const byDate = new Map((rows || []).map((r) => [r.date, r]));

  const labels = [];
  const avg = [];
  const min = [];
  const max = [];

  // Normalize today to midnight (local time) so date math is consistent
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build last 7 days: 6 days ago ... today
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateYYYYMMDD(d);

    labels.push(key);

    // If the backend didn't have data for that day, push null (Chart.js will gap it)
    const r = byDate.get(key);
    avg.push(r ? Math.round(r.avg) : null);
    min.push(r ? r.min : null);
    max.push(r ? r.max : null);
  }

  const canvas = document.getElementById("weeklyChart");

  // Destroy old instance before creating a new one (prevents overlay + memory leaks)
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

/* =========================
   DAILY CHARTS
   - separate HR + SpO2 charts
   - destroy old charts before drawing new ones
   - mark min/max points
========================= */
function renderDay(docs) {
  // Optional time-window filtering (based on cfgStart/cfgEnd inputs)
  const startMin = hhmmToMinutes($("#cfgStart").val() || "00:00");
  const endMin = hhmmToMinutes($("#cfgEnd").val() || "23:59");

  // Normalize docs into objects with Date + numeric hr/spo2, sort by timestamp
  const sorted = (docs || [])
    .map((x) => ({ ts: new Date(x.ts), hr: Number(x.hr), spo2: Number(x.spo2) }))
    .filter((x) => !isNaN(x.ts.getTime()))
    .sort((a, b) => a.ts - b.ts);

  // Keep only readings within the configured time window.
  // Handles overnight windows like 22:00 -> 06:00.
  const filtered = sorted.filter((x) => {
    const mins = x.ts.getHours() * 60 + x.ts.getMinutes();
    if (endMin >= startMin) return mins >= startMin && mins <= endMin;
    return mins >= startMin || mins <= endMin;
  });

  // X-axis labels are local-time HH:MM strings
  const labels = filtered.map((x) =>
    x.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  // Draw HR chart
  renderSeriesChart({
    canvasId: "hrChart",
    title: "Heart Rate",
    yLabel: "bpm",
    labels,
    values: filtered.map((x) => x.hr),
  });

  // Draw SpO2 chart
  renderSeriesChart({
    canvasId: "spo2Chart",
    title: "SpO₂",
    yLabel: "%",
    labels,
    values: filtered.map((x) => x.spo2),
  });
}

// Helper to render a single line chart with min/max highlighted
function renderSeriesChart({ canvasId, title, yLabel, labels, values }) {
  const canvas = document.getElementById(canvasId);

  // Destroy previous chart instance for this canvas
  if (canvasId === "hrChart" && hrChart) hrChart.destroy();
  if (canvasId === "spo2Chart" && spo2Chart) spo2Chart.destroy();

  // Find indices of min and max values (ignores non-finite values)
  const { minIdx, maxIdx } = argMinMax(values);

  // Build sparse series for min/max markers (null everywhere except the min/max point)
  const minSeries = values.map((v, i) => (i === minIdx ? v : null));
  const maxSeries = values.map((v, i) => (i === maxIdx ? v : null));

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: title, data: values, tension: 0.2, pointRadius: 2 },       // main line
        { label: "Min", data: minSeries, showLine: false, pointRadius: 6 }, // marker only
        { label: "Max", data: maxSeries, showLine: false, pointRadius: 6 }, // marker only
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
        // Hide Min/Max from legend so only the main series shows in legend
        legend: { labels: { filter: (item) => item.text === title } },
      },
    },
  });

  // Save chart instance so it can be destroyed on next refresh
  if (canvasId === "hrChart") hrChart = chart;
  if (canvasId === "spo2Chart") spo2Chart = chart;
}

/* =========================
   DEVICES
========================= */
function renderDevices(list) {
  const $wrap = $("#devicesList").empty();

  // If no devices exist, show a message
  if (!list || list.length === 0)
    return $wrap.html("<em>No devices yet. Register one above.</em>");

  // Render each device row + delete button
  list.forEach((dev) => {
    // Tolerate different naming from backend
    const particleId = dev.particleId || dev.particle_id || dev.particleID || "—";

    // escapeHtml prevents XSS if device name / id contains HTML special chars
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

  // Bind delete handlers (off() avoids stacking multiple handlers on re-render)
  $(".btn-del").off("click").on("click", function () {
    const id = $(this).data("id");
    const token = localStorage.getItem("token");

    $.ajax({ url: "/devices/" + id, method: "DELETE", headers: { "x-auth": token } })
      .done(loadDevices)
      .fail(() => alert("Delete failed"));
  });
}

// Fetch device list from server
function loadDevices() {
  const token = localStorage.getItem("token");
  $("#devicesList").html("<em>Loading…</em>");

  $.ajax({ url: "/devices", method: "GET", headers: { "x-auth": token }, dataType: "json" })
    .done(renderDevices)
    .fail(() => $("#devicesList").html("<em>Error loading devices.</em>"));
}

// Register a new device with name + Particle ID
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
    .done(() => {
      // Clear inputs after success and refresh list
      $("#deviceName").val("");
      $("#particleId").val("");
      loadDevices();
    })
    .fail((jq) => alert(jq.responseText || "Registration failed"));
}

/* =========================
   HELPERS
========================= */

// Format a Date -> "YYYY-MM-DD" in local time
function localDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Validate "HH:MM" format
function isHHMM(s) { return typeof s === "string" && /^\d{2}:\d{2}$/.test(s); }

// Convert "HH:MM" -> minutes since midnight
function hhmmToMinutes(s) {
  const [hh, mm] = (s || "00:00").split(":").map(n => parseInt(n, 10));
  return hh * 60 + mm;
}

// Return the indices of min/max finite values in an array
function argMinMax(arr) {
  let minIdx = -1, maxIdx = -1, min = Infinity, max = -Infinity;
  (arr || []).forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    if (v < min) { min = v; minIdx = i; }
    if (v > max) { max = v; maxIdx = i; }
  });
  return { minIdx, maxIdx };
}

// Basic HTML escaping to prevent injection into innerHTML/template strings
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   CHATBOT UI
========================= */

// Toggle chat panel open/closed
const chatBtn = document.getElementById("chatButton");
const chatPanel = document.getElementById("chatPanel");
const closeChat = document.getElementById("closeChat");
if (chatBtn && chatPanel) chatBtn.addEventListener("click", () => chatPanel.classList.add("open"));
if (closeChat && chatPanel) closeChat.addEventListener("click", () => chatPanel.classList.remove("open"));

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

// Append a chat bubble to the chat history
function addChatMessage(text, sender) {
  if (!chatMessages) return;
  const msg = document.createElement("div");
  msg.classList.add("chat-msg", sender);
  msg.textContent = text; // textContent avoids HTML injection
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send on button click or Enter key
if (chatSendBtn) chatSendBtn.addEventListener("click", sendChat);
if (chatInput) chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

// Send the user message to backend and display AI response
async function sendChat() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;

  addChatMessage(text, "user");
  chatInput.value = "";

  // Temporary “Thinking…” message while waiting for backend response
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

/* =========================
   READING PROMPT FSM
   - periodically shows a "take a reading" prompt
   - uses a simple finite state machine + timers
========================= */
let readingPromptTimer = null;

const ReadingPromptFSM = (function () {
  // FSM state + frequency (minutes)
  let state = "INIT";
  let freqMins = 30;

  // Selectors for prompt panel and buttons
  const PROMPT_ID = "#readingPrompt";
  const BTN_DONE = "#btnPromptDone";
  const BTN_SNOOZE = "#btnPromptSnooze";
  const BTN_DISMISS = "#btnPromptDismiss";

  function showPrompt() { $(PROMPT_ID).show(); }
  function hidePrompt() { $(PROMPT_ID).hide(); }

  // Schedule the next FSM event (DUE) in ms
  function schedule(ms) {
    clearTimeout(readingPromptTimer);
    readingPromptTimer = setTimeout(() => dispatch("DUE"), ms);
  }

  // Load user's frequency setting from backend; fallback to 30 on failure
  function loadFrequency() {
    const token = localStorage.getItem("token");
    return $.ajax({
      url: "/customers/settings",
      method: "GET",
      headers: { "x-auth": token },
      dataType: "json"
    })
      .done(cfg => {
        const f = parseInt(cfg?.freqMins, 10);
        if (Number.isFinite(f) && f >= 1 && f <= 1440) freqMins = f; // clamp to 1 day max
      })
      .fail(() => {
        freqMins = 30;
      });
  }

  // State transition handler
  function dispatch(event) {
    switch (state) {
      case "INIT":
        // Bind button clicks to FSM events
        $(BTN_DONE).off("click").on("click", () => dispatch("DONE"));
        $(BTN_SNOOZE).off("click").on("click", () => dispatch("SNOOZE"));
        $(BTN_DISMISS).off("click").on("click", () => dispatch("DISMISS"));

        // Load frequency from server, then move to READY
        loadFrequency().always(() => dispatch("READY"));
        state = "LOADING";
        break;

      case "LOADING":
        if (event === "READY") {
          hidePrompt();
          schedule(freqMins * 60 * 1000); // schedule first prompt
          state = "IDLE";
        }
        break;

      case "IDLE":
        if (event === "DUE") {
          showPrompt();
          state = "PROMPTING";
        }
        break;

      case "PROMPTING":
        // All actions hide prompt and schedule next reminder
        if (event === "DONE") {
          hidePrompt();
          schedule(freqMins * 60 * 1000);
          state = "IDLE";
        } else if (event === "SNOOZE") {
          hidePrompt();
          schedule(5 * 60 * 1000); // snooze = 5 minutes
          state = "IDLE";
        } else if (event === "DISMISS") {
          hidePrompt();
          schedule(freqMins * 60 * 1000);
          state = "IDLE";
        }
        break;

      default:
        // Safety reset
        state = "INIT";
        break;
    }
  }

  // Public API: start the FSM
  function start() { dispatch("START"); }

  // Public API: update frequency live (e.g., after saving settings)
  function setFrequency(newFreqMins) {
    const f = parseInt(newFreqMins, 10);
    if (Number.isFinite(f) && f >= 1 && f <= 1440) {
      freqMins = f;
      hidePrompt();
      schedule(freqMins * 60 * 1000);
      state = "IDLE";
    }
  }

  return { start, setFrequency };
})();

// Convenience wrapper used in your document-ready block
function startReadingPromptFSM() {
  ReadingPromptFSM.start();
}