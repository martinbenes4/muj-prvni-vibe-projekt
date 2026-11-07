const STORAGE_KEY = "habit-tracker";
const THEME_KEY = "habit-tracker-theme";

const form = document.querySelector("#habit-form");
const nameInput = document.querySelector("#habit-name");
const list = document.querySelector("#habit-list");
const emptyState = document.querySelector("#empty-state");
const todayLabel = document.querySelector("#today-label");
const progressLabel = document.querySelector("#progress-label");
const themeToggle = document.querySelector("#theme-toggle");
const dayKind = document.querySelector("#day-kind");
const dateInput = document.querySelector("#selected-date");
const dateHint = document.querySelector("#date-hint");
const listHeading = document.querySelector("#list-heading");
const dateToday = document.querySelector("#date-today");

let events = loadEvents();
let selectedDate = todayKey();

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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;

  events.unshift({
    id: crypto.randomUUID(),
    name,
    date: selectedDate,
    done: false,
  });

  saveEvents();
  render();
  form.reset();
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
    return [toEvent(item.id, item.name, item.date, item.done === true)];
  }

  const doneOn = Array.isArray(item.doneOn) ? item.doneOn.filter(isValidDateKey) : [];
  if (doneOn.length === 0) {
    return [toEvent(item.id, item.name, todayKey(), false)];
  }

  return doneOn.map((date, index) => toEvent(index === 0 ? item.id : `${item.id}-${date}`, item.name, date, true));
}

function toEvent(id, name, date, done) {
  return {
    id,
    name,
    date,
    done: canComplete(date) && done,
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
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));
}

function applyTheme(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
  themeToggle.setAttribute("aria-checked", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim");
}

function render() {
  const today = todayKey();
  const future = isFuture(selectedDate);
  const visible = events.filter((item) => item.date === selectedDate);
  const doneCount = visible.filter((item) => item.done).length;

  dayKind.textContent = selectedDate === today ? "Dnes" : future ? "Budoucnost" : "Minulost";
  todayLabel.textContent = formatDate(selectedDate);
  dateInput.value = selectedDate;
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

    const title = document.createElement("p");
    title.className = item.done
      ? "min-w-0 flex-1 text-base text-slate-400 line-through dark:text-slate-500"
      : "min-w-0 flex-1 text-base font-medium text-slate-900 dark:text-slate-100";
    title.textContent = item.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.id = item.id;
    remove.setAttribute("aria-label", `Smazat událost: ${item.name}`);
    remove.className =
      "rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-950 dark:hover:text-rose-300";
    remove.textContent = "Smazat";

    row.append(toggle, title, remove);
    list.append(row);
  });
}
