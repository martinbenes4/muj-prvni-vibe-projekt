const STORAGE_KEY = "habit-tracker";

const form = document.querySelector("#habit-form");
const nameInput = document.querySelector("#habit-name");
const list = document.querySelector("#habit-list");
const emptyState = document.querySelector("#empty-state");
const todayLabel = document.querySelector("#today-label");
const progressLabel = document.querySelector("#progress-label");

let habits = loadHabits();

todayLabel.textContent = formatToday();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;

  habits.unshift({
    id: crypto.randomUUID(),
    name,
    doneOn: [],
  });

  saveHabits();
  render();
  form.reset();
  nameInput.focus();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const habit = habits.find((item) => item.id === id);
  if (!habit) return;

  if (button.dataset.action === "toggle") {
    const today = todayKey();
    habit.doneOn = habit.doneOn.includes(today)
      ? habit.doneOn.filter((day) => day !== today)
      : [...habit.doneOn, today];
  }

  if (button.dataset.action === "delete") {
    habits = habits.filter((item) => item.id !== id);
  }

  saveHabits();
  render();
});

function loadHabits() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((habit) => habit && typeof habit.name === "string" && typeof habit.id === "string")
      .map((habit) => ({
        id: habit.id,
        name: habit.name,
        doneOn: Array.isArray(habit.doneOn) ? habit.doneOn.filter((day) => typeof day === "string") : [],
      }));
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatToday() {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function isDoneToday(habit) {
  return Array.isArray(habit.doneOn) && habit.doneOn.includes(todayKey());
}

function render() {
  list.replaceChildren();
  const doneCount = habits.filter(isDoneToday).length;

  progressLabel.textContent = habits.length
    ? `Splněno ${doneCount} z ${habits.length}`
    : "";
  emptyState.classList.toggle("hidden", habits.length > 0);

  habits.forEach((habit) => {
    const done = isDoneToday(habit);
    const item = document.createElement("li");
    item.className =
      "habit-card flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.dataset.action = "toggle";
    toggle.dataset.id = habit.id;
    toggle.setAttribute("aria-pressed", String(done));
    toggle.setAttribute("aria-label", done ? `Zrušit splnění: ${habit.name}` : `Označit jako splněné: ${habit.name}`);
    toggle.className = done
      ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-700 text-white"
      : "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-transparent hover:border-teal-600";
    toggle.textContent = "✓";

    const title = document.createElement("p");
    title.className = done
      ? "min-w-0 flex-1 text-base text-slate-400 line-through"
      : "min-w-0 flex-1 text-base font-medium text-slate-900";
    title.textContent = habit.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.id = habit.id;
    remove.setAttribute("aria-label", `Smazat návyk: ${habit.name}`);
    remove.className =
      "rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700";
    remove.textContent = "Smazat";

    item.append(toggle, title, remove);
    list.append(item);
  });
}
