const STORAGE_KEY = "habit-tracker";
const THEME_KEY = "habit-tracker-theme";
const TIME_KEY = "habit-tracker-times";
const SUPABASE_URL = "https://ugkeyyvxxhisovreogad.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVna2V5eXZ4eGhpc292cmVvZ2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNDYwMTcsImV4cCI6MjEwOTYyMjAxN30.IYKuHD5XTNZE84m3UMTWugmcOJPpkhB_jqakaa5To3k";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const form = document.querySelector("#habit-form");
const nameInput = document.querySelector("#habit-name");
const list = document.querySelector("#habit-list");
const timelineSection = document.querySelector("#timeline-section");
const timelineClock = document.querySelector("#timeline-clock");
const timelineHours = document.querySelector("#timeline-hours");
const timelineTrack = document.querySelector("#timeline-track");
const timelineUntimed = document.querySelector("#timeline-untimed");
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
const timeClear = document.querySelector("#time-clear");
const sportInput = document.querySelector("#habit-sport");
const sportList = document.querySelector("#sport-suggestions");
const strengthWrap = document.querySelector("#strength-wrap");
const strengthRows = document.querySelector("#strength-rows");
const strengthAdd = document.querySelector("#strength-add");
const distanceWrap = document.querySelector("#distance-wrap");
const distanceInput = document.querySelector("#habit-distance");
const metricError = document.querySelector("#metric-error");
const SPORT_CATALOG = window.SPORT_CATALOG || [];
const STRENGTH_CATALOG = window.STRENGTH_CATALOG || [];
const MAX_EXERCISES = 10;
const EXERCISE_SLOTS = Array.from({ length: MAX_EXERCISES }, (_, index) => String(index + 1).padStart(2, "0"));
const HABIT_COLUMNS = [
  "id",
  "name",
  "date",
  "completed",
  "cas_od",
  "cas_do",
  "sport",
  "sport_2",
  "pocet_opakovani",
  "vzdalenost",
  ...EXERCISE_SLOTS.flatMap((slot) => [`sport_typ_${slot}`, `pocet_opakovani_${slot}`]),
].join(",");
const authOpen = document.querySelector("#auth-open");
const authLogout = document.querySelector("#auth-logout");
const authEmail = document.querySelector("#auth-email");
const authModal = document.querySelector("#auth-modal");
const authForm = document.querySelector("#auth-form");
const authEmailInput = document.querySelector("#auth-email-input");
const authPasswordInput = document.querySelector("#auth-password-input");
const authMessage = document.querySelector("#auth-message");
const authRegister = document.querySelector("#auth-register");
const authGoogle = document.querySelector("#auth-google");
const appShell = document.querySelector("#app-shell");
const syncStatus = document.querySelector("#sync-status");

let events = [];
let session = null;
let appliedUserId;
let syncMessage = "";
let saveVersion = 0;
let timesNeedUpload = false;
let selectedDate = todayKey();
let draftStart = initialRange().start;
let draftEnd = initialRange().end;
let pickerField = null;
let sportField;
let strengthRowSeq = 0;

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

sportField = createSuggestField({
  input: sportInput,
  list: sportList,
  catalog: () => SPORT_CATALOG.map((sport) => sport.name),
  optionPrefix: "sport-option",
  onInput: () => {
    clearMetricError();
    syncMeasureFields();
  },
  onChoose: (name) => {
    clearMetricError();
    syncMeasureFields();
    const measure = findSport(name)?.measure;
    if (measure === "reps") strengthRows.querySelector("[data-role=kind]")?.focus();
    if (measure === "distance") distanceInput.focus();
  },
});

strengthAdd.addEventListener("click", () => {
  if (strengthRows.children.length >= MAX_EXERCISES) return;
  const row = addStrengthRow();
  syncStrengthAdd();
  row.querySelector("[data-role=kind]").focus();
});

document.addEventListener("click", (event) => {
  if (pickerField && !event.target.closest("#time-picker, #time-start, #time-end")) closePicker();
  if (!event.target.closest("#habit-sport, #sport-suggestions")) sportField.close();
  if (!event.target.closest("[data-role=kind], [data-role=suggestions]")) closeStrengthSuggestions();
});

timeClear.addEventListener("click", () => {
  draftStart = "";
  draftEnd = "";
  closePicker();
  clearTimeError();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name && !sportInput.value.trim()) {
    showMetricError("Vyplň název, nebo vyber sport.");
    return;
  }
  const hasStart = Boolean(parseTime(draftStart));
  const hasEnd = Boolean(parseTime(draftEnd));
  if ((hasStart || hasEnd) && !validRange(draftStart, draftEnd)) {
    showTimeError("Čas do musí být později než čas od.");
    return;
  }
  const details = readDraftDetails();
  if (!details) return;

  events.unshift(toEvent(crypto.randomUUID(), name, selectedDate, false, draftStart, draftEnd, details));

  saveEvents();
  clearTimeError();
  clearMetricError();
  render();
  nameInput.value = "";
  sportInput.value = "";
  distanceInput.value = "";
  sportField.close();
  clearStrengthRows();
  syncMeasureFields();
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

authOpen.addEventListener("click", () => {
  signInWithGoogle();
});
authLogout.addEventListener("click", () => {
  if (supabaseClient) supabaseClient.auth.signOut();
});
authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  signIn();
});
authRegister.addEventListener("click", () => {
  signUp();
});
authGoogle.addEventListener("click", () => {
  signInWithGoogle();
});

function loadLocalEvents() {
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

function toEvent(id, name, date, done, start = "", end = "", details = emptyDetails()) {
  const time = validRange(start, end);
  const clean = normalizeDetails(details);
  return {
    id,
    name,
    date,
    done: canComplete(date) && done,
    start: time ? time.start : "",
    end: time ? time.end : "",
    sport: clean.sport,
    sport2: clean.sport2,
    reps: clean.reps,
    distance: clean.distance,
    exercises: clean.exercises,
  };
}

function saveEvents() {
  if (!session || !supabaseClient) return;
  rememberTimes(events);
  persistRemoteEvents();
}

function readTimeCache() {
  try {
    const stored = JSON.parse(localStorage.getItem(TIME_KEY));
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function rememberTimes(items) {
  const cache = readTimeCache();
  items.forEach((item) => {
    if (item.start && item.end) cache[item.id] = { start: item.start, end: item.end };
  });
  localStorage.setItem(TIME_KEY, JSON.stringify(cache));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function emptyDetails() {
  return { sport: "", sport2: "", reps: null, distance: null, exercises: [] };
}

function normalizeDetails(details) {
  const source = details || {};
  const sport = String(source.sport || "").trim().slice(0, 80);
  const exercises = cleanExercises(source).slice(0, MAX_EXERCISES);
  const sport2 = exercises.length ? encodeExercises(exercises) : "";
  const reps = exercises.length === 1 ? exercises[0].reps : null;
  let ignoredReps = null;
  if (source.reps != null && source.reps !== "") {
    const amount = Number(source.reps);
    if (Number.isInteger(amount) && amount >= 1 && amount <= 9999) ignoredReps = amount;
  }
  let distance = null;
  if (source.distance != null && source.distance !== "") {
    const amount = Math.round(Number(source.distance) * 10) / 10;
    if (amount >= 0.1 && amount <= 999) distance = amount;
  }
  return { sport, sport2, reps: exercises.length ? reps : ignoredReps, distance, exercises };
}

function detailsFromSuffix(suffix, name) {
  if (suffix === "s") return normalizeDetails({ sport: name });
  const reps = String(suffix || "").match(/^r:(\d+)$/);
  if (reps) return normalizeDetails({ reps: Number(reps[1]) });
  const distance = String(suffix || "").match(/^d:(\d+(?:\.\d+)?)$/);
  if (distance) return normalizeDetails({ distance: Number(distance[1]) });
  return emptyDetails();
}

function splitStoredName(stored) {
  const text = String(stored);
  const parts = text.split("\u001f");
  if (parts.length === 3 && validRange(parts[1], parts[2])) {
    return { name: parts[0], start: parts[1], end: parts[2], details: emptyDetails() };
  }
  const match = text.match(/^(.*)\|([0-9]{1,2}):([0-5][0-9])-([0-9]{1,2}):([0-5][0-9])\|(r:\d+|d:\d+(?:\.\d+)?|s)?$/);
  if (match) {
    const start = toTimeValue(Number(match[2]), Number(match[3]));
    const end = toTimeValue(Number(match[4]), Number(match[5]));
    if (validRange(start, end)) {
      return { name: match[1], start, end, details: detailsFromSuffix(match[6], match[1]) };
    }
  }
  return { name: text, start: "", end: "", details: emptyDetails() };
}

function clockValue(value) {
  const match = String(value || "").match(/(\d{1,2}):([0-5]\d)/);
  if (!match) return "";
  const hour = Number(match[1]);
  if (hour > 23) return "";
  return toTimeValue(hour, Number(match[2]));
}

function exercisesFromRow(row) {
  const slotted = EXERCISE_SLOTS.map((slot) => ({
    name: row[`sport_typ_${slot}`],
    reps: row[`pocet_opakovani_${slot}`],
  })).filter((item) => String(item.name || "").trim() || (item.reps != null && item.reps !== ""));
  if (slotted.length) return slotted;
  return parseExercises(row.sport_2, row.pocet_opakovani);
}

function slotsAreEmpty(row) {
  return EXERCISE_SLOTS.every((slot) => {
    const name = String(row[`sport_typ_${slot}`] || "").trim();
    const reps = row[`pocet_opakovani_${slot}`];
    return !name && (reps == null || reps === "");
  });
}

function detailsFromColumns(row) {
  return normalizeDetails({
    sport: row.sport,
    exercises: exercisesFromRow(row),
    distance: row.vzdalenost,
  });
}

function plainName(event) {
  return splitStoredName(event.name).name.trim();
}

function mergedDetails(columnDetails, legacyDetails) {
  return normalizeDetails({
    sport: columnDetails.sport || legacyDetails.sport,
    exercises: columnDetails.exercises.length ? columnDetails.exercises : legacyDetails.exercises,
    distance: columnDetails.distance == null ? legacyDetails.distance : columnDetails.distance,
  });
}

function sameText(sent, stored) {
  return (sent || null) === (stored || null);
}

function sameNumber(sent, stored) {
  if (sent == null && (stored == null || stored === "")) return true;
  return Number(sent) === Number(stored);
}

function sameTime(sent, stored) {
  return clockValue(sent) === clockValue(stored);
}

function cloudErrorText(error) {
  const code = error?.code || "";
  const message = String(error?.message || "");
  if (code === "23502") return "Tabulka vyžaduje hodnotu ve sloupci, který zůstává prázdný.";
  if (code === "42501" && /column/i.test(message)) return "K novým sloupcům chybí oprávnění pro zápis.";
  if (code === "42501") return "Databáze zápis této aktivity odmítla.";
  if (code === "22P02" || code === "22007") return "Některá hodnota neodpovídá typu sloupce.";
  if (code === "PGRST204" && /sport_typ_|pocet_opakovani_/i.test(message)) {
    return "V tabulce habits chybí sloupce sport_typ_01 až sport_typ_10 a pocet_opakovani_01 až pocet_opakovani_10.";
  }
  if (code === "PGRST204") return "Supabase ještě nevidí nové sloupce. V nastavení API obnov schéma.";
  return "Uložení do cloudu se nepovedlo.";
}

async function loadRemoteEvents() {
  const times = readTimeCache();
  const { data, error } = await supabaseClient
    .from("habits")
    .select(HABIT_COLUMNS)
    .eq("user_id", session.user.id);
  if (error) {
    syncMessage = "Návyky se z cloudu nepodařilo načíst.";
    return [];
  }
  syncMessage = "";
  timesNeedUpload = false;
  return (data || [])
    .map((row) => {
      const date = String(row.date || "").slice(0, 10);
      const parsed = splitStoredName(row.name);
      const cached = times[row.id] || {};
      const columnTime = validRange(clockValue(row.cas_od), clockValue(row.cas_do));
      const columnDetails = detailsFromColumns(row);
      const details = mergedDetails(columnDetails, parsed.details);
      const start = columnTime ? columnTime.start : parsed.start || cached.start || "";
      const end = columnTime ? columnTime.end : parsed.end || cached.end || "";
      if (!columnTime && validRange(start, end)) timesNeedUpload = true;
      if (!columnDetails.sport && details.sport) timesNeedUpload = true;
      if (slotsAreEmpty(row) && details.exercises.length) timesNeedUpload = true;
      if (columnDetails.distance == null && details.distance != null) timesNeedUpload = true;
      const packed = parsed.start || parsed.details.sport || parsed.details.reps != null || parsed.details.distance != null;
      const name = packed ? parsed.name : String(row.name || "");
      if (!isValidDateKey(date) || (!name.trim() && !details.sport && !details.exercises.length)) return null;
      return toEvent(String(row.id), name.trim(), date, row.completed === true, start, end, details);
    })
    .filter(Boolean);
}

function toHabitRow(event, userId) {
  const time = validRange(event.start, event.end);
  const details = normalizeDetails(event);
  const row = {
    id: event.id,
    user_id: userId,
    name: plainName(event),
    date: event.date,
    completed: Boolean(event.done),
    cas_od: time ? time.start : null,
    cas_do: time ? time.end : null,
    sport: details.sport || null,
    sport_2: null,
    pocet_opakovani: null,
    vzdalenost: details.distance,
  };
  EXERCISE_SLOTS.forEach((slot, index) => {
    const exercise = details.exercises[index];
    row[`sport_typ_${slot}`] = exercise ? exercise.name : null;
    row[`pocet_opakovani_${slot}`] = exercise ? exercise.reps : null;
  });
  return row;
}

function sameExerciseSlots(sent, stored) {
  return EXERCISE_SLOTS.every(
    (slot) =>
      sameText(sent[`sport_typ_${slot}`], stored[`sport_typ_${slot}`]) &&
      sameNumber(sent[`pocet_opakovani_${slot}`], stored[`pocet_opakovani_${slot}`]),
  );
}

async function persistRemoteEvents() {
  const version = ++saveVersion;
  const userId = session.user.id;
  events.forEach((event) => {
    if (!isUuid(event.id)) event.id = crypto.randomUUID();
  });
  const rows = events.map((event) => toHabitRow(event, userId));
  rememberTimes(events);

  if (rows.length) {
    const { data, error } = await supabaseClient
      .from("habits")
      .upsert(rows, { onConflict: "id" })
      .select(HABIT_COLUMNS);
    if (version !== saveVersion) return;
    if (error) {
      syncMessage = cloudErrorText(error);
      updateAuthUi();
      return;
    }
    const storedById = new Map((data || []).map((row) => [row.id, row]));
    const missing = rows.some((row) => {
      const stored = storedById.get(row.id);
      if (!stored) return false;
      return !sameText(row.sport, stored.sport) || !sameExerciseSlots(row, stored) || !sameNumber(row.vzdalenost, stored.vzdalenost) || !sameTime(row.cas_od, stored.cas_od) || !sameTime(row.cas_do, stored.cas_do);
    });
    if (missing) {
      syncMessage = "Aktivita se uložila, ale nové sloupce zůstaly prázdné.";
      updateAuthUi();
      return;
    }
  }

  let removal = supabaseClient.from("habits").delete().eq("user_id", userId);
  if (rows.length) removal = removal.not("id", "in", `(${rows.map((row) => row.id).join(",")})`);
  const { error: deleteError } = await removal;
  if (version !== saveVersion) return;
  syncMessage = deleteError ? cloudErrorText(deleteError) : "";
  updateAuthUi();
}

function closeAuthModal() {
  authForm.reset();
}

function authCredentials() {
  return {
    email: authEmailInput.value.trim(),
    password: authPasswordInput.value,
  };
}

function showAuthMessage(text, isError) {
  authMessage.textContent = text;
  authMessage.className = isError
    ? "mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
    : "mt-3 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:bg-teal-950 dark:text-teal-200";
}

function authErrorText(error, fallback) {
  const code = error?.code || "";
  if (code === "email_not_confirmed") {
    return "Účet ještě není potvrzený. Otevři odkaz v e-mailu a pak se přihlas.";
  }
  if (code === "email_address_invalid") return "Tenhle e-mail nejde použít. Zkus jinou adresu.";
  if (code === "weak_password") return "Heslo je příliš slabé. Zkus delší a méně obvyklé.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "E-mail se teď nepodařilo odeslat. Zkus to za chvíli.";
  }
  if (code === "user_already_exists") return "Účet s tímto e-mailem už existuje. Přihlas se.";
  return fallback;
}

async function signInWithGoogle() {
  if (!supabaseClient) {
    showAuthMessage("Přihlášení se teď nepodařilo načíst.", true);
    return;
  }
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });
  if (error) showAuthMessage("Přihlášení přes Google se nepovedlo.", true);
}

function showOAuthReturnError() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (!params.get("error")) return;
  const description = (params.get("error_description") || "").toLowerCase();
  const expired = description.includes("expired") || params.get("error_code") === "otp_expired";
  showAuthMessage(
    expired ? "Odkaz v e-mailu vypršel. Zkus účet založit znovu." : "Přihlášení se nepovedlo. Zkus to znovu.",
    true,
  );
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

async function signIn() {
  if (!supabaseClient) {
    showAuthMessage("Přihlášení se teď nepodařilo načíst.", true);
    return;
  }
  const { error } = await supabaseClient.auth.signInWithPassword(authCredentials());
  if (error) {
    showAuthMessage(authErrorText(error, "E-mail nebo heslo nesedí."), true);
    return;
  }
  closeAuthModal();
}

async function signUp() {
  if (!supabaseClient) {
    showAuthMessage("Registrace se teď nepodařila načíst.", true);
    return;
  }
  if (!authForm.reportValidity()) return;
  const { data, error } = await supabaseClient.auth.signUp({
    ...authCredentials(),
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });
  if (error) {
    showAuthMessage(authErrorText(error, "Účet se nepodařilo vytvořit. Zkus jiný e-mail nebo delší heslo."), true);
    return;
  }
  const identities = data.user?.identities;
  if (data.user && Array.isArray(identities) && identities.length === 0) {
    showAuthMessage("Účet s tímto e-mailem už existuje. Přihlas se.", true);
    return;
  }
  if (!data.session) {
    showAuthMessage("Účet je založený. Než půjde aplikaci použít, potvrď ho odkazem v e-mailu a pak se přihlas.", false);
    return;
  }
  closeAuthModal();
}

function updateAuthUi() {
  const signedIn = Boolean(session);
  authOpen.classList.toggle("hidden", signedIn);
  authLogout.classList.toggle("hidden", !signedIn);
  authEmail.classList.toggle("hidden", !signedIn);
  authEmail.textContent = signedIn ? session.user.email || "" : "";
  authModal.classList.toggle("hidden", signedIn);
  appShell.classList.toggle("hidden", !signedIn);
  syncStatus.textContent = syncMessage;
  syncStatus.classList.toggle("hidden", !syncMessage);
}

async function useSession(nextSession) {
  const nextId = nextSession?.user?.id || null;
  if (appliedUserId === nextId) {
    session = nextSession;
    updateAuthUi();
    return;
  }
  appliedUserId = nextId;
  session = nextSession;
  events = nextSession ? await loadRemoteEvents() : [];
  updateAuthUi();
  render();
  if (timesNeedUpload) {
    timesNeedUpload = false;
    saveEvents();
  }
}

async function reloadRemoteEvents() {
  if (!session || !supabaseClient) return;
  const next = await loadRemoteEvents();
  if (!session) return;
  events = next;
  render();
  if (timesNeedUpload) {
    timesNeedUpload = false;
    saveEvents();
  }
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

function formatKm(amount) {
  return String(Math.round(amount * 10) / 10).replace(".", ",");
}

function displayTitle(item) {
  return item.name || item.sport || "Aktivita";
}

function formatDetail(item) {
  const parts = [];
  const title = displayTitle(item);
  if (item.start && item.end) parts.push(`${formatTime(item.start)}–${formatTime(item.end)}`);
  if (item.sport && item.sport !== title) parts.push(item.sport);
  if (item.exercises?.length) {
    parts.push(item.exercises.map((entry) => `${entry.name} ${entry.reps} opakování`).join(", "));
  } else if (item.reps) {
    parts.push(`${item.reps} opakování`);
  }
  if (item.distance) parts.push(`${formatKm(item.distance)} km`);
  return parts.join(" · ");
}

function parseExercises(sport2, reps) {
  const text = String(sport2 || "").trim();
  if (!text) return [];
  if (text.includes("×")) {
    return text
      .split(";")
      .map((part) => {
        const match = part.trim().match(/^(.*)×(\d+)$/);
        if (!match) return null;
        return { name: match[1].trim(), reps: Number(match[2]) };
      })
      .filter(Boolean);
  }
  if (reps != null && reps !== "") return [{ name: text, reps }];
  return [];
}

function encodeExercises(exercises) {
  return exercises.map((item) => `${item.name}×${item.reps}`).join("; ");
}

function cleanExercises(source) {
  const raw = Array.isArray(source.exercises) && source.exercises.length ? source.exercises : parseExercises(source.sport2, source.reps);
  return raw
    .map((item) => {
      const name = String(item?.name || "").trim().slice(0, 80);
      const reps = Number(item?.reps);
      if (!name || !Number.isInteger(reps) || reps < 1 || reps > 9999) return null;
      return { name, reps };
    })
    .filter(Boolean);
}

function foldSport(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findSport(value) {
  const key = foldSport(value);
  if (!key) return null;
  return SPORT_CATALOG.find((sport) => foldSport(sport.name) === key) || null;
}

function findCatalogName(catalog, value) {
  const key = foldSport(value);
  if (!key) return "";
  return catalog.find((name) => foldSport(name) === key) || "";
}

function filterCatalog(catalog, query) {
  const key = foldSport(query);
  if (!key) return [];
  return catalog
    .filter((name) => foldSport(name).includes(key))
    .sort((a, b) => {
      const aStart = foldSport(a).startsWith(key) ? 0 : 1;
      const bStart = foldSport(b).startsWith(key) ? 0 : 1;
      return aStart - bStart || a.localeCompare(b, "cs");
    })
    .slice(0, 8);
}

function createSuggestField({ input, list, catalog, optionPrefix, onInput, onChoose }) {
  let highlight = 0;

  function close() {
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function render() {
    const options = filterCatalog(catalog(), input.value);
    list.replaceChildren();
    if (!options.length) {
      close();
      return;
    }
    highlight = Math.min(highlight, options.length - 1);
    options.forEach((name, index) => {
      const option = document.createElement("li");
      option.id = `${optionPrefix}-${index}`;
      option.dataset.value = name;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === highlight));
      option.className =
        index === highlight
          ? "cursor-pointer bg-teal-700 px-4 py-2 text-sm font-medium text-white"
          : "cursor-pointer px-4 py-2 text-sm text-slate-800 dark:text-slate-100";
      option.textContent = name;
      list.append(option);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", `${optionPrefix}-${highlight}`);
  }

  function choose(name) {
    input.value = name;
    highlight = 0;
    close();
    if (onChoose) onChoose(name);
  }

  input.addEventListener("input", () => {
    highlight = 0;
    if (onInput) onInput();
    render();
  });
  input.addEventListener("focus", () => render());
  input.addEventListener("keydown", (event) => {
    const options = filterCatalog(catalog(), input.value);
    if (list.hidden || !options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlight = (highlight + 1) % options.length;
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlight = (highlight - 1 + options.length) % options.length;
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(options[highlight]);
    } else if (event.key === "Escape") {
      close();
    }
  });
  list.addEventListener("mousedown", (event) => {
    const option = event.target.closest("[data-value]");
    if (!option) return;
    event.preventDefault();
    choose(option.dataset.value);
  });

  return { close };
}

function fieldClass() {
  return "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none ring-teal-600 placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
}

function addStrengthRow() {
  const index = strengthRowSeq;
  strengthRowSeq += 1;
  const row = document.createElement("div");
  row.className = "strength-row grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end";

  const kindWrap = document.createElement("div");
  kindWrap.className = "relative";
  const kindLabel = document.createElement("label");
  kindLabel.className = "mb-1 block text-sm text-slate-500 dark:text-slate-400";
  kindLabel.textContent = "Druh posilování";
  kindLabel.htmlFor = `strength-kind-${index}`;
  const kindInput = document.createElement("input");
  kindInput.id = `strength-kind-${index}`;
  kindInput.dataset.role = "kind";
  kindInput.type = "text";
  kindInput.maxLength = 80;
  kindInput.placeholder = "Začni psát, třeba kliky nebo činky";
  kindInput.className = fieldClass();
  kindInput.setAttribute("role", "combobox");
  kindInput.setAttribute("aria-autocomplete", "list");
  kindInput.setAttribute("aria-expanded", "false");
  kindInput.autocomplete = "off";
  const list = document.createElement("ul");
  list.dataset.role = "suggestions";
  list.hidden = true;
  list.className = "absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700";
  list.setAttribute("role", "listbox");
  kindInput.setAttribute("aria-controls", `strength-suggestions-${index}`);
  list.id = `strength-suggestions-${index}`;
  kindWrap.append(kindLabel, kindInput, list);

  const repsWrap = document.createElement("div");
  const repsLabel = document.createElement("label");
  repsLabel.className = "mb-1 block text-sm text-slate-500 dark:text-slate-400";
  repsLabel.textContent = "Počet opakování";
  repsLabel.htmlFor = `strength-reps-${index}`;
  const repsInput = document.createElement("input");
  repsInput.id = `strength-reps-${index}`;
  repsInput.dataset.role = "reps";
  repsInput.type = "text";
  repsInput.inputMode = "numeric";
  repsInput.maxLength = 4;
  repsInput.placeholder = "20";
  repsInput.className = fieldClass();
  repsWrap.append(repsLabel, repsInput);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-950 dark:hover:text-rose-300";
  remove.textContent = "Odebrat";

  row.append(kindWrap, repsWrap, remove);
  strengthRows.append(row);
  const field = createSuggestField({
    input: kindInput,
    list,
    catalog: () => STRENGTH_CATALOG,
    optionPrefix: `strength-option-${index}`,
    onInput: () => clearMetricError(),
    onChoose: () => repsInput.focus(),
  });
  row._field = field;
  remove.addEventListener("click", () => {
    field.close();
    if (strengthRows.children.length === 1) {
      kindInput.value = "";
      repsInput.value = "";
      return;
    }
    row.remove();
    syncStrengthAdd();
  });
  syncStrengthAdd();
  return row;
}

function syncStrengthAdd() {
  strengthAdd.classList.toggle("hidden", strengthRows.children.length >= MAX_EXERCISES);
}

function closeStrengthSuggestions() {
  strengthRows.querySelectorAll(".strength-row").forEach((row) => row._field?.close());
}

function clearStrengthRows() {
  closeStrengthSuggestions();
  strengthRows.replaceChildren();
  strengthRowSeq = 0;
  syncStrengthAdd();
}

function syncMeasureFields() {
  const measure = findSport(sportInput.value)?.measure || "";
  const strength = measure === "reps";
  strengthWrap.classList.toggle("hidden", !strength);
  strengthWrap.classList.toggle("flex", strength);
  distanceWrap.classList.toggle("hidden", measure !== "distance");
  if (strength && !strengthRows.children.length) addStrengthRow();
  if (!strength) clearStrengthRows();
  if (measure !== "distance") distanceInput.value = "";
}

function readDraftDetails() {
  const match = findSport(sportInput.value);
  const measure = match?.measure || "";
  const distanceRaw = measure === "distance" ? distanceInput.value.trim().replace(",", ".") : "";
  const exercises = [];
  if (measure === "reps") {
    const rows = [...strengthRows.querySelectorAll(".strength-row")];
    for (const row of rows) {
      const kindRaw = row.querySelector("[data-role=kind]").value.trim();
      const repsRaw = row.querySelector("[data-role=reps]").value.trim();
      if (!kindRaw && !repsRaw) continue;
      const kind = findCatalogName(STRENGTH_CATALOG, kindRaw) || kindRaw;
      if (!kind) {
        showMetricError("Vyber druh posilování, třeba kliky.");
        return null;
      }
      const value = Number(repsRaw);
      if (!/^\d+$/.test(repsRaw) || !Number.isInteger(value) || value < 1 || value > 9999) {
        showMetricError(`U cviku ${kind} zadej počet opakování, třeba 20.`);
        return null;
      }
      exercises.push({ name: kind, reps: value });
    }
    if (exercises.length > MAX_EXERCISES) {
      showMetricError("Do jednoho záznamu jde přidat nejvýš 10 cviků.");
      return null;
    }
    if (!exercises.length) {
      showMetricError("Přidej aspoň jeden druh posilování, třeba kliky.");
      return null;
    }
  }
  if (measure === "distance") {
    const value = Number(distanceRaw);
    if (!Number.isFinite(value) || value < 0.1 || value > 999) {
      showMetricError("Zadej vzdálenost v kilometrech, třeba 5,2.");
      return null;
    }
  }
  return normalizeDetails({
    sport: match ? match.name : sportInput.value,
    exercises,
    distance: distanceRaw ? Number(distanceRaw) : null,
  });
}

function showMetricError(message) {
  metricError.textContent = message;
  metricError.classList.remove("hidden");
}

function clearMetricError() {
  metricError.textContent = "";
  metricError.classList.add("hidden");
}

function formatTime(value) {
  const parsed = parseTime(value);
  if (!parsed) return "—";
  return `${parsed.hour}:${String(parsed.minute).padStart(2, "0")}`;
}

function parseTime(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23) return null;
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
  if (pickerField === field) {
    pickerField = null;
    syncTimeControls();
    return;
  }
  pickerField = field;
  const range = initialRange();
  if (field === "start" && !parseTime(draftStart)) draftStart = range.start;
  if (field === "end" && !parseTime(draftEnd)) draftEnd = range.end;
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
  const untimed = items.filter((item) => !validRange(item.start, item.end));

  timelineHours.replaceChildren();
  timelineTrack.replaceChildren();
  timelineUntimed.replaceChildren();
  timelineSection.classList.toggle("hidden", timed.length === 0 && untimed.length === 0);
  timelineClock.classList.toggle("hidden", timed.length === 0);
  timelineUntimed.classList.toggle("hidden", untimed.length === 0);
  timelineUntimed.classList.toggle("mt-3", timed.length > 0);

  if (timed.length > 0) {
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
      name.textContent = displayTitle(item);
      const time = document.createElement("p");
      time.className = done ? "text-xs tabular-nums" : "text-xs tabular-nums text-teal-50";
      time.textContent = formatDetail(item);
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

  untimed.forEach((item) => {
    const row = document.createElement("li");
    row.className = item.done
      ? "rounded-xl bg-teal-700/15 px-3 py-2 text-sm text-slate-500 line-through ring-1 ring-teal-700/30 dark:text-slate-400"
      : "rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100";
    row.textContent = formatDetail(item) ? `${displayTitle(item)} · ${formatDetail(item)}` : displayTitle(item);
    timelineUntimed.append(row);
  });
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
  dateHint.textContent = future ? "Budoucí aktivitu lze zapsat, ale jako hotovou ji označíš až v ten den." : "";
  listHeading.textContent = selectedDate === today ? "Dnešní aktivity" : "Aktivity";
  progressLabel.textContent = visible.length
    ? future
      ? `Naplánováno ${visible.length}`
      : `Hotovo ${doneCount} z ${visible.length}`
    : "";
  emptyState.textContent = future
    ? "V tento den zatím nic není. Můžeš sem zapsat, co teprve bude."
    : selectedDate === today
      ? "V tento den zatím nic není. Přidej aktivitu."
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
          ? `Zrušit splnění: ${displayTitle(item)}`
          : `Označit jako splněné: ${displayTitle(item)}`
        : `Budoucí aktivitu nejde označit jako hotovou: ${displayTitle(item)}`,
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
    title.textContent = displayTitle(item);
    textWrap.append(title);

    const detail = formatDetail(item);
    if (detail) {
      const time = document.createElement("p");
      time.className = "text-sm text-slate-500 dark:text-slate-400";
      time.textContent = detail;
      textWrap.append(time);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.id = item.id;
    remove.setAttribute("aria-label", `Smazat aktivitu: ${displayTitle(item)}`);
    remove.className =
      "rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-950 dark:hover:text-rose-300";
    remove.textContent = "Smazat";

    row.append(toggle, textWrap, remove);
    list.append(row);
  });
}

if (supabaseClient) {
  showOAuthReturnError();
  supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
    useSession(nextSession);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reloadRemoteEvents();
  });
} else {
  syncMessage = "Přihlášení se nepodařilo načíst. Bez účtu aplikaci nelze používat.";
  updateAuthUi();
}
