(() => {
  "use strict";

  /* ---------------- state (in-memory only — no persistence) ---------------- */

  const STICKY_COLORS = [
    "var(--sticky-1)",
    "var(--sticky-2)",
    "var(--sticky-3)",
    "var(--sticky-4)",
    "var(--sticky-5)",
    "var(--sticky-6)",
  ];

  let nextId = 1;
  const makeTask = (text, category, deadline, done = false) => ({
    id: nextId++,
    text,
    category,
    deadline: deadline || null,
    done,
  });

  let tasks = [
    makeTask("Water the tomatoes", "Home", null),
    makeTask("Finish Q3 report", "Work", isoDateFromToday(-1)),
    makeTask("Call the dentist", "Health", isoDateFromToday(2)),
    makeTask("Pack for the trip", "Home", isoDateFromToday(5)),
    makeTask("Review Sam's pull request", "Work", isoDateFromToday(0)),
    makeTask("Buy a birthday card", "Errands", null, true),
  ];

  let activeFilter = "All";

  /* ---------------- helpers ---------------- */

  function isoDateFromToday(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function categoryColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return STICKY_COLORS[hash % STICKY_COLORS.length];
  }

  function formatDeadline(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function isOverdue(task) {
    return !task.done && task.deadline && task.deadline < todayIso();
  }

  function allCategories() {
    return [...new Set(tasks.map((t) => t.category))].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  /* ---------------- elements ---------------- */

  const taskListEl = document.getElementById("taskList");
  const emptyNoteEl = document.getElementById("emptyNote");
  const filtersEl = document.getElementById("filters");
  const formEl = document.getElementById("newTaskForm");
  const textInput = document.getElementById("taskInput");
  const categoryInput = document.getElementById("categoryInput");
  const deadlineInput = document.getElementById("deadlineInput");
  const categoryOptions = document.getElementById("categoryOptions");
  const formHint = document.getElementById("formHint");
  const dateStamp = document.getElementById("dateStamp");

  dateStamp.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  /* ---------------- rendering ---------------- */

  function render() {
    renderFilters();
    renderCategoryOptions();
    renderTasks();
  }

  function renderFilters() {
    const cats = allCategories();
    if (!cats.includes(activeFilter) && activeFilter !== "All") {
      activeFilter = "All";
    }

    filtersEl.innerHTML = "";
    filtersEl.appendChild(makeFilterChip("All"));
    cats.forEach((c) => filtersEl.appendChild(makeFilterChip(c)));
  }

  function makeFilterChip(label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-chip" + (label === activeFilter ? " active" : "");
    btn.textContent = label;
    if (label !== "All") {
      btn.style.background = categoryColor(label);
    }
    btn.addEventListener("click", () => {
      activeFilter = label;
      render();
    });
    return btn;
  }

  function renderCategoryOptions() {
    categoryOptions.innerHTML = "";
    allCategories().forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      categoryOptions.appendChild(opt);
    });
  }

  function renderTasks() {
    const visible = tasks.filter(
      (t) => activeFilter === "All" || t.category === activeFilter
    );

    taskListEl.innerHTML = "";
    emptyNoteEl.hidden = visible.length > 0;

    visible
      .slice()
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      })
      .forEach((task) => taskListEl.appendChild(renderTaskRow(task)));
  }

  function renderTaskRow(task) {
    const li = document.createElement("li");
    li.className = "task-row" + (task.done ? " done" : "");

    // checkbox
    const checkWrap = document.createElement("span");
    checkWrap.className = "check-box";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = task.done;
    input.setAttribute("aria-label", `Mark "${task.text}" as done`);
    input.addEventListener("change", () => {
      task.done = input.checked;
      renderTasks();
    });
    const box = document.createElement("span");
    box.className = "box";
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    tick.setAttribute("viewBox", "0 0 30 30");
    tick.innerHTML =
      '<path d="M6 15.5 L12.5 21 L24 8" />';
    checkWrap.append(input, box, tick);

    // text
    const textEl = document.createElement("span");
    textEl.className = "task-text";
    textEl.textContent = task.text;

    // category tag
    const catEl = document.createElement("span");
    catEl.className = "category-tag";
    catEl.style.background = categoryColor(task.category);
    catEl.textContent = task.category;

    li.append(checkWrap, textEl, catEl);

    // deadline
    if (task.deadline) {
      const dl = document.createElement("span");
      dl.className = "deadline-tag" + (isOverdue(task) ? " overdue" : "");
      dl.textContent = formatDeadline(task.deadline);
      li.appendChild(dl);
    }

    // delete
    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "✕";
    del.setAttribute("aria-label", `Delete "${task.text}"`);
    del.addEventListener("click", () => {
      tasks = tasks.filter((t) => t.id !== task.id);
      render();
    });
    li.appendChild(del);

    return li;
  }

  /* ---------------- form handling ---------------- */

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    const category = categoryInput.value.trim();
    const deadline = deadlineInput.value || null;

    if (!text) {
      showHint("Write something down first.");
      textInput.focus();
      return;
    }
    if (!category) {
      showHint("Every task needs a category, even a made-up one.");
      categoryInput.focus();
      return;
    }

    tasks.push(makeTask(text, category, deadline));
    textInput.value = "";
    categoryInput.value = "";
    deadlineInput.value = "";
    showHint("");
    render();
    textInput.focus();
  });

  function showHint(msg) {
    formHint.textContent = msg;
  }

  /* ---------------- go ---------------- */

  render();
})();
