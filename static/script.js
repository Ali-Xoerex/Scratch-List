(() => {
  "use strict";

  /* ---------------- presentation helpers ---------------- */

  const STICKY_COLORS = [
    "var(--sticky-1)",
    "var(--sticky-2)",
    "var(--sticky-3)",
    "var(--sticky-4)",
    "var(--sticky-5)",
    "var(--sticky-6)",
  ];

  function categoryColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return STICKY_COLORS[hash % STICKY_COLORS.length];
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDeadline(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ---------------- elements ---------------- */

  const taskListEl  = document.getElementById("taskList");
  const emptyNoteEl = document.getElementById("emptyNote");
  const filtersEl   = document.getElementById("filters");
  const formEl      = document.getElementById("newTaskForm");
  const textInput   = document.getElementById("taskInput");
  const categoryInput = document.getElementById("categoryInput");
  const deadlineInput = document.getElementById("deadlineInput");
  const formHint    = document.getElementById("formHint");
  const dateStamp   = document.getElementById("dateStamp");

  if (dateStamp) {
    dateStamp.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  /* ---------------- API ---------------- */

  async function apiCreate(task) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function apiToggle(id, done) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: done }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function apiDelete(id) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
  }

  /* ---------------- client-side filtering ---------------- */

  let activeFilter = sessionStorage.getItem("filter") || "All";

  function setActiveChip() {
    filtersEl.querySelectorAll(".filter-chip").forEach((btn) => {
      btn.classList.toggle("active", (btn.dataset.category || "All") === activeFilter);
    });
  }

  function applyFilter() {
    const rows = taskListEl.querySelectorAll(".task-row");
    let visible = 0;
    rows.forEach((row) => {
      const cat = row.dataset.category || "";
      const show = activeFilter === "All" || cat === activeFilter;
      row.hidden = !show;
      if (show) visible++;
    });
    // The "no tasks at all" note is server-rendered hidden/shown;
    // "no tasks in this filter" is a client-only concept.
    if (rows.length > 0) {
      emptyNoteEl.hidden = visible > 0;
    }
  }

  filtersEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-chip");
    if (!btn) return;
    activeFilter = btn.dataset.category || "All";
    sessionStorage.setItem("filter", activeFilter);
    setActiveChip();
    applyFilter();
  });

  /* ---------------- decoration pass ----------------
     Colors and formatted dates are deterministic; the server
     only ships raw values, JS turns them into presentation.     */

  function decorate() {
    taskListEl.querySelectorAll(".category-tag").forEach((el) => {
      el.style.background = categoryColor(el.dataset.category || "");
    });

    filtersEl.querySelectorAll(".filter-chip").forEach((el) => {
      const cat = el.dataset.category || "";
      if (cat) el.style.background = categoryColor(cat);
    });

    taskListEl.querySelectorAll(".deadline-tag").forEach((el) => {
      const iso = el.dataset.deadline;
      if (!iso) return;
      el.textContent = formatDeadline(iso);
      const row = el.closest(".task-row");
      if (!row.classList.contains("done") && iso < todayIso()) {
        el.classList.add("overdue");
      }
    });
  }

  /* ---------------- task actions ---------------- */

  taskListEl.addEventListener("change", async (e) => {
    const cb = e.target.closest(".task-check");
    if (!cb) return;
    const row = cb.closest(".task-row");
    const id = row.dataset.id;
    const done = cb.checked;

    // optimistic UI
    row.classList.toggle("done", done);
    const dl = row.querySelector(".deadline-tag");
    if (dl) dl.classList.toggle("overdue", !done && dl.dataset.deadline < todayIso());

    try {
      await apiToggle(id, done);
    } catch (err) {
      cb.checked = !done;
      row.classList.toggle("done", !done);
      console.error(err);
    }
  });

  taskListEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;
    const row = btn.closest(".task-row");
    const id = row.dataset.id;

    row.style.opacity = "0.4";
    btn.disabled = true;
    try {
      await apiDelete(id);
      row.remove();
      applyFilter();
    } catch (err) {
      row.style.opacity = "";
      btn.disabled = false;
      console.error(err);
    }
  });

  /* ---------------- new task form ---------------- */

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name     = textInput.value.trim();
    const category = categoryInput.value.trim();
    const deadline = deadlineInput.value || "";

    if (!name) {
      showHint("Write something down first.");
      textInput.focus();
      return;
    }
    if (!category) {
      showHint("Every task needs a category, even a made-up one.");
      categoryInput.focus();
      return;
    }

    try {
      await apiCreate({ name, category, deadline });
      // Simplest correct option: reload so the server's sort
      // (undone first, then newest) and filters stay authoritative.
      location.reload();
    } catch (err) {
      showHint("Couldn't save — try again.");
      console.error(err);
    }
  });

  function showHint(msg) {
    formHint.textContent = msg;
  }

  /* ---------------- init ---------------- */
  decorate();
  setActiveChip();
  applyFilter();
})();