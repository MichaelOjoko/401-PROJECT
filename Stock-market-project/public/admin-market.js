// public/admin-market.js
(function () {
  AuthAPI.requireAdmin();

  const scheduleBody = document.getElementById("scheduleBody");
  const holBody = document.getElementById("holBody");

  const saveBtn = document.getElementById("saveScheduleBtn");
  const holAddBtn = document.getElementById("holAddBtn");
  const holName = document.getElementById("holName"); // maps to description
  const holDate = document.getElementById("holDate");
  const holSession = document.getElementById("holSession");

  // Modal elements
  const editModal = document.getElementById("editModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalClose = document.getElementById("modalClose");
  const modalCancel = document.getElementById("modalCancel");
  const modalSave = document.getElementById("modalSave");

  const mRegularOpen  = document.getElementById("mRegularOpen");
  const mRegularClose = document.getElementById("mRegularClose");
  const mPreOpen      = document.getElementById("mPreOpen");
  const mPreClose     = document.getElementById("mPreClose");   // mirrors regular_open
  const mAfterOpen    = document.getElementById("mAfterOpen");  // mirrors regular_close
  const mAfterClose   = document.getElementById("mAfterClose");
  const mNotes        = document.getElementById("mNotes");

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let currentEditDow = null;

  function fmtTime(v) {
    if (!v) return "";
    return String(v).slice(0, 5);
  }

  function openModalForDay(row) {
    const dow = Number(row.day_index);
    currentEditDow = dow;

    modalTitle.textContent = `Edit ${row.day_name || DAY_NAMES[dow]}`;

    mRegularOpen.value  = fmtTime(row.regular_open);
    mRegularClose.value = fmtTime(row.regular_close);

    mPreOpen.value      = fmtTime(row.pre_open);
    mPreClose.value     = fmtTime(row.regular_open);  // derived
    mAfterOpen.value    = fmtTime(row.regular_close); // derived
    mAfterClose.value   = fmtTime(row.after_close);

    mNotes.value = row.notes || "";

    // auto-sync derived fields when editing regular times
    function syncDerived() {
      mPreClose.value = mRegularOpen.value || "";
      mAfterOpen.value = mRegularClose.value || "";
    }
    syncDerived();
    mRegularOpen.oninput = syncDerived;
    mRegularClose.oninput = syncDerived;

    editModal.classList.add("show");
    editModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    editModal.classList.remove("show");
    editModal.setAttribute("aria-hidden", "true");
    currentEditDow = null;
  }

  modalClose.addEventListener("click", closeModal);
  modalCancel.addEventListener("click", closeModal);
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeModal();
  });

  function renderSchedule(rows) {
    scheduleBody.innerHTML = rows.map(r => {
      const dow = Number(r.day_index);

      return `
        <tr data-dow="${dow}">
          <td>${r.day_name || DAY_NAMES[dow]}</td>
          <td>${fmtTime(r.regular_open)} – ${fmtTime(r.regular_close)}</td>
          <td>${fmtTime(r.pre_open)} – ${fmtTime(r.regular_open)}</td>
          <td>${fmtTime(r.regular_close)} – ${fmtTime(r.after_close)}</td>
          <td>${r.notes || ""}</td>
          <td>
            <button class="edit-pill edit-day">Edit</button>
          </td>
        </tr>
      `;
    }).join("");

    scheduleBody.querySelectorAll(".edit-day").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tr = e.target.closest("tr");
        const dow = Number(tr.getAttribute("data-dow"));

        const row = rows.find(x => Number(x.day_index) === dow) || {
          day_index: dow,
          day_name: DAY_NAMES[dow],
          regular_open: null,
          regular_close: null,
          pre_open: null,
          after_close: null,
          notes: ""
        };

        openModalForDay(row);
      });
    });
  }

  // Bulk collect (for Save Changes button)
  function collectScheduleFromTable() {
    const out = [];
    scheduleBody.querySelectorAll("tr[data-dow]").forEach(tr => {
      const dow = Number(tr.getAttribute("data-dow"));
      const tds = tr.querySelectorAll("td");

      const reg = (tds[1].textContent || "").split("–").map(s => s.trim());
      const pre = (tds[2].textContent || "").split("–").map(s => s.trim());
      const aft = (tds[3].textContent || "").split("–").map(s => s.trim());
      const notes = (tds[4].textContent || "").trim();

      out.push({
        day_index: dow,
        day_name: DAY_NAMES[dow],
        regular_open: reg[0] || null,
        regular_close: reg[1] || null,
        pre_open: pre[0] || null,
        after_close: aft[1] || null,
        notes
      });
    });
    return out;
  }

  async function saveSingleDay() {
    if (currentEditDow == null) return;

    const dow = currentEditDow;

    const payload = [{
      day_index: dow,
      day_name: DAY_NAMES[dow],
      regular_open: mRegularOpen.value || null,
      regular_close: mRegularClose.value || null,
      pre_open: mPreOpen.value || null,
      after_close: mAfterClose.value || null,
      notes: mNotes.value || ""
    }];

    const res = await AuthAPI.fetch("/api/market/schedule", {
      method: "PUT",
      body: JSON.stringify({ schedule: payload }),
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) {
      alert("Failed to save this day.");
      return;
    }

    closeModal();
    await loadAll();
    alert("Day saved.");
  }

  modalSave.addEventListener("click", saveSingleDay);

  function renderHolidays(rows) {
    holBody.innerHTML = rows.map(h => `
      <tr data-date="${h.holiday_date}">
        <td>${h.holiday_date}</td>
        <td>${h.description || ""}</td>
        <td>
          ${
            h.session_type === "closed"
              ? `<span class="pill closed">Closed</span>`
              : `<span class="pill">Early Close 13:00</span>`
          }
        </td>
        <td><a href="#" class="btn-ghost hol-remove">Remove</a></td>
      </tr>
    `).join("");

    holBody.querySelectorAll(".hol-remove").forEach(a => {
      a.addEventListener("click", async (e) => {
        e.preventDefault();
        const tr = e.target.closest("tr");
        const date = tr.getAttribute("data-date");
        await AuthAPI.fetch(`/api/market/holidays/${date}`, { method: "DELETE" });
        await loadAll();
      });
    });
  }

  async function loadAll() {
    const schedRes = await AuthAPI.fetch("/api/market/schedule");
    if (schedRes.ok && schedRes.data?.data) {
      renderSchedule(schedRes.data.data);
    }

    const holRes = await AuthAPI.fetch("/api/market/holidays");
    if (holRes.ok && holRes.data?.data) {
      renderHolidays(holRes.data.data);
    }
  }

  // Bulk save (still allowed)
  saveBtn.addEventListener("click", async () => {
    const schedule = collectScheduleFromTable();
    const res = await AuthAPI.fetch("/api/market/schedule", {
      method: "PUT",
      body: JSON.stringify({ schedule }),
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) alert("Failed to save schedule");
    else alert("Schedule saved");
  });

  holAddBtn.addEventListener("click", async () => {
    const description = holName.value.trim();
    const holiday_date = holDate.value;
    const session_type = holSession.value;

    if (!description || !holiday_date) return alert("Please enter description and date.");

    const res = await AuthAPI.fetch("/api/market/holidays", {
      method: "POST",
      body: JSON.stringify({ description, holiday_date, session_type }),
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) alert("Failed to add holiday");
    holName.value = "";
    holDate.value = "";
    holSession.value = "closed";
    await loadAll();
  });

  loadAll();
})();
