const STORAGE_KEY = "habit-tracker";
const THEME_KEY = "habit-tracker-theme";

const form = document.querySelector("#habit-form");
const nameInput = document.querySelector("#habit-name");
const list = document.querySelector("#habit-list");
const timelineSection = document.querySelector("#timeline-section");
const timelineHours = document.querySelector("#timeline-hours");
const timelineTrack = document.querySelector("#timeline-track");
const emptyState = document.querySelector("#empty-state");
const todayLabel = document.querySelector("#today-label");
const progressLabel = document.querySelector("#progress-label");
const themeToggle = document.querySelector("#theme-toggle");
const dayKind = document.querySelector("#day-kind");
const dateInput = document.querySelector("#selected-date");
const dateHint = document.querySelector("#date-hint");
const listHeading = document.querySelector("#list-heading");
const dateToday = document.querySelector("#date-today");
const dateDisplay = document.querySelector("#date-display");
const timeStartButton = document.querySelector("#time-start");
const timeEndButton = document.querySelector("#time-end");
const timeStartValue = document.querySelector("#time-start-value");
const timeEndValue = document.querySelector("#time-end-value");
const timePicker = document.querySelector("#time-picker");
const timePickerTitle = document.querySelector("#time-picker-title");
const timePickerPreview = document.querySelector("#time-picker-preview");
const hourGrid = document.querySelector("#hour-grid");
const minuteGrid = document.querySelector("#minute-grid");
const timeError = document.querySelector("#time-error");

let events = loadEvents();
let selectedDate = todayKey();
let draftStart = initialRange().start;
let draftEnd = initialRange().end;
let pickerField = null;

buildTimePicker();

todayLabel.textContent = formatDate(selectedDate);
applyTheme(document.documentElement.classList.contains("dark"));
render();

themeToggle.addEventListener("click", () => {
  const nextDark = !document.documentElement.classList.contains("dark");
  applyTheme(nextDark);
  try {
    localStorage.setItem(THEME_KEY, nextDark ? "dark" : "light");
  } catch {
    /* uložení motivu není dostupné */
  }
});

document.querySelector("#date-prev").addEventListener("click", () => {
  setSelectedDate(shiftDate(selectedDate, -1));
});

document.querySelector("#date-next").addEventListener("click", () => {
  setSelectedDate(shiftDate(selectedDate, 1));
});

dateToday.addEventListener("click", () => {
  setSelectedDate(todayKey());
});

dateInput.addEventListener("change", () => {
  if (!isValidDateKey(dateInput.value)) {
    dateInput.value = selectedDate;
    return;
  }
  setSelectedDate(dateInput.value);
});

dateDisplay.addEventListener("click", () => {
  try {
    if (typeof dateInput.showPicker === "function") {
      dateInput.showPicker();
      return;
    }
  } catch {
    /* prohlížeč výběr data neotevřel */
  }
  dateInput.focus();
});

timeStartButton.addEventListener("click", () => openPicker("start"));
timeEndButton.addEventListener("click", () => openPicker("end"));

hourGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hour]");
  if (!button || !pickerField) return;
  const current = parseTime(currentDraft());
  setDraft(toTimeValue(Number(button.dataset.hour), current.minute));
});

minuteGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-minute]");
  if (!button || !pickerField) return;
  const current = parseTime(currentDraft());
  setDraft(toTimeValue(current.hour, Number(button.dataset.minute)));
});

document.addEventListener("click", (event) => {
  if (!pickerField) return;
  if (event.target.closest("#time-picker, #time-start, #time-end")) return;
  closePicker();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  if (!validRange(draftStart, draftEnd)) {
    showTimeError("Čas do musí být později než čas od.");
    return;
  }

  events.unshift({
    id: crypto.randomUUID(),
    name,
    date: selectedDate,
    done: false,
    start: draftStart,
    end: draftEnd,
  });

  saveEvents();
  clearTimeError();
  render();
  nameInput.value = "";
  nameInput.focus();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;

  const id = button.dataset.id;
  const item = events.find((entry) => entry.id === id);
  if (!item) return;

  if (button.dataset.action === "toggle") {
    if (!canComplete(item.date)) return;
    item.done = !item.done;
  }

  if (button.dataset.action === "delete") {
    events = events.filter((entry) => entry.id !== id);
  }

  saveEvents();
  render();
});

function loadEvents() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(stored)) return [];
    return stored.flatMap(normalizeStoredItem).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeStoredItem(item) {
  if (!item || typeof item.name !== "string" || typeof item.id !== "string") return [];

  if (isValidDateKey(item.date)) {
    return [toEvent(item.id, item.name, item.date, item.done === true, item.start, item.end)];
  }

  const doneOn = Array.isArray(item.doneOn) ? item.doneOn.filter(isValidDateKey) : [];
  if (doneOn.length === 0) {
    return [toEvent(item.id, item.name, todayKey(), false)];
  }

  return doneOn.map((date, index) => toEvent(index === 0 ? item.id : `${item.id}-${date}`, item.name, date, true));
}

function toEvent(id, name, date, done, start = "", end = "") {
  const time = validRange(start, end);
  return {
    id,
    name,
    date,
    done: canComplete(date) && done,
    start: time ? time.start : "",
    end: time ? time.end : "",
  };
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function setSelectedDate(date) {
  selectedDate = date;
  render();
}

function todayKey() {
  return toDateKey(new Date());
}

function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isValidDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function shiftDate(key, days) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function canComplete(date) {
  return date <= todayKey();
}

function isFuture(date) {
  return date > todayKey();
}

function formatDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return `${day}.${month}.${year}`;
}

function initialRange() {
  const hour = new Date().getHours();
  if (hour >= 23) return { start: "23:00", end: "23:30" };
  return { start: toTimeValue(hour, 0), end: toTimeValue(hour + 1, 0) };
}

function toTimeValue(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTime(value) {
  const [hour, minute] = value.split(":");
  return `${Number(hour)}:${minute}`;
}

function parseTime(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute, total: hour * 60 + minute };
}

function validRange(start, end) {
  const from = parseTime(start);
  const to = parseTime(end);
  if (!from || !to || to.total <= from.total) return null;
  return { start: toTimeValue(from.hour, from.minute), end: toTimeValue(to.hour, to.minute) };
}

function currentDraft() {
  return pickerField === "end" ? draftEnd : draftStart;
}

function setDraft(value) {
  if (pickerField === "end") draftEnd = value;
  else draftStart = value;
  clearTimeError();
  syncTimeControls();
}

function openPicker(field) {
  pickerField = pickerField === field ? null : field;
  syncTimeControls();
}

function closePicker() {
  pickerField = null;
  syncTimeControls();
}

function showTimeError(message) {
  timeError.textContent = message;
  timeError.classList.remove("hidden");
}

function clearTimeError() {
  timeError.textContent = "";
  timeError.classList.add("hidden");
}

function chipClass(selected) {
  const base = "rounded-lg px-1 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-600";
  return selected
    ? `${base} bg-teal-700 text-white`
    : `${base} bg-white text-slate-700 hover:bg-teal-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700`;
}

function buildTimePicker() {
  for (let hour = 0; hour < 24; hour += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.hour = String(hour);
    button.textContent = String(hour);
    hourGrid.append(button);
  }

  for (let minute = 0; minute < 60; minute += 5) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.minute = String(minute);
    button.textContent = String(minute).padStart(2, "0");
    minuteGrid.append(button);
  }
}

function syncTimeControls() {
  const active = parseTime(currentDraft());
  timeStartValue.textContent = formatTime(draftStart);
  timeEndValue.textContent = formatTime(draftEnd);
  timeStartButton.setAttribute("aria-expanded", String(pickerField === "start"));
  timeEndButton.setAttribute("aria-expanded", String(pickerField === "end"));
  timePicker.hidden = !pickerField;
  if (!pickerField || !active) return;

  timePickerTitle.textContent = pickerField === "end" ? "Do" : "Od";
  timePickerPreview.textContent = formatTime(currentDraft());
  hourGrid.querySelectorAll("[data-hour]").forEach((button) => {
    const selected = Number(button.dataset.hour) === active.hour;
    button.className = chipClass(selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  minuteGrid.querySelectorAll("[data-minute]").forEach((button) => {
    const selected = Number(button.dataset.minute) === active.minute;
    button.className = chipClass(selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function applyTheme(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
  themeToggle.setAttribute("aria-checked", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim");
}

function renderTimeline(items) {
  const timed = items
    .map((item) => {
      const start = parseTime(item.start);
      const end = parseTime(item.end);
      if (!start || !end) return null;
      return { ...item, startMin: start.total, endMin: end.total };
    })
    .filter(Boolean);

  timelineHours.replaceChildren();
  timelineTrack.replaceChildren();
  timelineSection.classList.toggle("hidden", timed.length === 0);
  if (timed.length === 0) return;

  const rangeStart = Math.floor(Math.min(...timed.map((item) => item.startMin)) / 60) * 60;
  const rangeEnd = Math.ceil(Math.max(...timed.map((item) => item.endMin)) / 60) * 60;
  const span = Math.max(rangeEnd - rangeStart, 60);
  const pxPerMin = span > 8 * 60 ? 0.65 : 1.15;
  const height = span * pxPerMin;
  timelineHours.style.height = `${height}px`;
  timelineTrack.style.height = `${height}px`;

  for (let minute = rangeStart; minute <= rangeEnd; minute += 60) {
    const top = (minute - rangeStart) * pxPerMin;
    const label = document.createElement("span");
    label.className = "timeline-hour -translate-y-1/2 pr-2 text-right text-xs tabular-nums text-slate-400";
    label.style.top = `${top}px`;
    label.textContent = formatTime(toTimeValue(Math.floor(minute / 60), minute % 60));
    timelineHours.append(label);

    const line = document.createElement("span");
    line.className = "timeline-hour";
    line.style.top = `${top}px`;
    timelineTrack.append(line);
  }

  const lanes = [];
  timed.forEach((item) => {
    const lane = lanes.findIndex((end) => end <= item.startMin);
    item.lane = lane === -1 ? lanes.length : lane;
    lanes[item.lane] = item.endMin;
  });
  const laneCount = Math.max(lanes.length, 1);

  timed.forEach((item) => {
    const block = document.createElement("li");
    const done = item.done;
    block.className = done
      ? "timeline-block rounded-xl bg-teal-700/15 px-3 py-1 text-slate-500 ring-1 ring-teal-700/30 dark:text-slate-400"
      : "timeline-block rounded-xl bg-teal-700 px-3 py-1 text-white shadow-sm";
    block.style.top = `${(item.startMin - rangeStart) * pxPerMin}px`;
    block.style.height = `${Math.max((item.endMin - item.startMin) * pxPerMin - 4, 28)}px`;
    block.style.left = `calc(${item.lane} * (100% / ${laneCount}) + 2px)`;
    block.style.width = `calc(100% / ${laneCount} - 6px)`;

    const name = document.createElement("p");
    name.className = done ? "truncate text-sm line-through" : "truncate text-sm font-medium";
    name.textContent = item.name;
    const time = document.createElement("p");
    time.className = done ? "text-xs tabular-nums" : "text-xs tabular-nums text-teal-50";
    time.textContent = `${formatTime(item.start)}–${formatTime(item.end)}`;
    block.append(name, time);
    timelineTrack.append(block);
  });

  if (selectedDate === todayKey()) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= rangeStart && nowMin <= rangeEnd) {
      const marker = document.createElement("span");
      marker.className = "timeline-now";
      marker.style.top = `${(nowMin - rangeStart) * pxPerMin}px`;
      timelineTrack.append(marker);
    }
  }
}

function render() {
  const today = todayKey();
  const future = isFuture(selectedDate);
  const visible = events
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => (a.start || "99:99").localeCompare(b.start || "99:99"));
  const doneCount = visible.filter((item) => item.done).length;

  dayKind.textContent = selectedDate === today ? "Dnes" : future ? "Budoucnost" : "Minulost";
  todayLabel.textContent = formatDate(selectedDate);
  dateDisplay.textContent = formatDate(selectedDate);
  dateDisplay.setAttribute("aria-label", `Vybrat datum, aktuálně ${formatDate(selectedDate)}`);
  dateInput.value = selectedDate;
  syncTimeControls();
  dateToday.classList.toggle("hidden", selectedDate === today);
  dateHint.textContent = future ? "Budoucí událost lze zapsat, ale jako hotovou ji označíš až v ten den." : "";
  listHeading.textContent = selectedDate === today ? "Dnešní události" : "Události";
  progressLabel.textContent = visible.length
    ? future
      ? `Naplánováno ${visible.length}`
      : `Hotovo ${doneCount} z ${visible.length}`
    : "";
  emptyState.textContent = future
    ? "V tento den zatím nic není. Můžeš sem zapsat, co teprve bude."
    : selectedDate === today
      ? "V tento den zatím nic není. Přidej událost."
      : "V tento den zatím nic není. Můžeš doplnit, co se stalo.";
  emptyState.classList.toggle("hidden", visible.length > 0);
  renderTimeline(visible);

  list.replaceChildren();
  visible.forEach((item) => {
    const allowed = canComplete(item.date);
    const row = document.createElement("li");
    row.className =
      "habit-card flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.dataset.action = "toggle";
    toggle.dataset.id = item.id;
    toggle.disabled = !allowed;
    toggle.setAttribute("aria-pressed", String(item.done));
    toggle.setAttribute(
      "aria-label",
      allowed
        ? item.done
          ? `Zrušit splnění: ${item.name}`
          : `Označit jako splněné: ${item.name}`
        : `Budoucí událost nejde označit jako hotovou: ${item.name}`,
    );
    toggle.className = item.done
      ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-700 text-white"
      : allowed
        ? "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-transparent hover:border-teal-600 dark:border-slate-600 dark:bg-slate-900"
        : "grid h-10 w-10 shrink-0 cursor-not-allowed place-items-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-transparent dark:border-slate-600 dark:bg-slate-800";
    toggle.textContent = "✓";

    const textWrap = document.createElement("div");
    textWrap.className = "min-w-0 flex-1";

    const title = document.createElement("p");
    title.className = item.done
      ? "text-base text-slate-400 line-through dark:text-slate-500"
      : "text-base font-medium text-slate-900 dark:text-slate-100";
    title.textContent = item.name;
    textWrap.append(title);

    if (item.start && item.end) {
      const time = document.createElement("p");
      time.className = "text-sm tabular-nums text-slate-500 dark:text-slate-400";
      time.textContent = `${formatTime(item.start)}–${formatTime(item.end)}`;
      textWrap.append(time);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.id = item.id;
    remove.setAttribute("aria-label", `Smazat událost: ${item.name}`);
    remove.className =
      "rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-950 dark:hover:text-rose-300";
    remove.textContent = "Smazat";

    row.append(toggle, textWrap, remove);
    list.append(row);
  });
}
