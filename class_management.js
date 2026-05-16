import {
  parseXlsxRows,
  parseCsvRows,
  normalizeRow,
  fuzzyMatchTeacherEmail,
  downloadTemplate,
  runBulkImport,
  fetchAllClasses,
  fetchTeachers,
  addClassManual,
  deleteClass
} from "./class_management_core.js";

const state = {
  rows: [],
  filtered: [],
  teachers: [],
  importRows: [],
  unmatched: [],
  activeTab: "summary"
};

function qs(sel) {
  return document.querySelector(sel);
}

function el(tag, attrs = {}, html = "") {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  });
  if (html) node.innerHTML = html;
  return node;
}

function setBulkError(msg) {
  const node = qs("#bulk-error");
  node.textContent = msg || "";
}

function escapeHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function subjectBadgeClass(subject) {
  if (subject === "art") return "badge-art";
  if (subject === "drama") return "badge-drama";
  return "badge-photo";
}
function subjectRowClass(subject) {
  if (subject === "art") return "row-art";
  if (subject === "drama") return "row-drama";
  return "row-photo";
}

async function loadData() {
  const [teachers, classes] = await Promise.all([fetchTeachers(), fetchAllClasses()]);
  state.teachers = teachers || [];
  state.rows = classes || [];
  filterRows();
}

function filterRows() {
  const q = String(qs("#class-search").value || "").trim().toLowerCase();
  const s = String(qs("#subject-filter").value || "").trim().toLowerCase();
  state.filtered = state.rows.filter((r) => {
    if (s && String(r.subject || "").toLowerCase() !== s) return false;
    if (!q) return true;
    const hay = `${r.class_name} ${r.class_code} ${r.teacher_name} ${r.teacher_email} ${r.subject}`.toLowerCase();
    return hay.includes(q);
  });
  renderTable();
}

function renderTable() {
  const tbody = qs("#classes-tbody");
  if (!state.filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="cm-empty">No classes found.</td></tr>';
    return;
  }
  tbody.innerHTML = state.filtered
    .map((r) => {
      return `<tr class="${subjectRowClass(r.subject)}">
        <td>${escapeHtml(r.class_name || "")}</td>
        <td>${escapeHtml(r.class_code || "")}</td>
        <td>${escapeHtml(r.year_level || "")}</td>
        <td><span class="badge ${subjectBadgeClass(r.subject)}">${escapeHtml(r.subject || "")}</span></td>
        <td>${escapeHtml(r.teacher_name || r.teacher_email || "")}</td>
        <td>
          <div class="cm-row-actions">
            <button class="btn btn-xs cm-danger" data-del="${escapeHtml(r.id || "")}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  Array.from(tbody.querySelectorAll("button[data-del]")).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = String(btn.getAttribute("data-del") || "");
      if (!id) return;
      const ok = window.confirm("Delete this class from the current teacher assignment?");
      if (!ok) return;
      try {
        await deleteClass(id);
        await loadData();
      } catch (err) {
        setBulkError(String(err && err.message ? err.message : err));
      }
    });
  });
}

function classifyAndRouteRows(rawRows) {
  const normalized = (rawRows || []).map(normalizeRow).filter((r) => r.subject && r.class_name);
  normalized.forEach((r) => {
    if (!r.teacher_email && r.teacher_name) {
      const byName = state.teachers.find((t) => String(t.name || "").toLowerCase() === String(r.teacher_name || "").toLowerCase());
      if (byName) r.teacher_email = byName.email;
    }
  });
  state.unmatched = [];
  normalized.forEach((r) => {
    if (!r.teacher_email) {
      state.unmatched.push(r);
      return;
    }
    const exact = state.teachers.find((t) => t.email === r.teacher_email);
    if (exact) return;
    const fuzzy = fuzzyMatchTeacherEmail(r.teacher_email, state.teachers);
    if (fuzzy && fuzzy.email) {
      r.teacher_email = fuzzy.email;
      if (!r.teacher_name) r.teacher_name = fuzzy.name || "";
    } else {
      state.unmatched.push(r);
    }
  });
  return normalized;
}

function buildSummary(rows) {
  const bySubject = { art: 0, drama: 0, photography: 0 };
  (rows || []).forEach((r) => {
    if (bySubject[r.subject] != null) bySubject[r.subject] += 1;
  });
  return {
    total: rows.length,
    art: bySubject.art,
    drama: bySubject.drama,
    photography: bySubject.photography
  };
}

function openPreview(rows) {
  const existing = document.getElementById("cm-preview-modal");
  if (existing) existing.remove();
  const summary = buildSummary(rows);

  const modal = el("div", { class: "cm-modal is-open", id: "cm-preview-modal" });
  modal.innerHTML = `
    <div class="cm-modal-card" role="dialog" aria-modal="true" aria-label="Import preview">
      <div class="cm-modal-head">
        <h3>Preview Import</h3>
        <button class="btn btn-outline" id="cm-close-preview">Close</button>
      </div>
      <div class="cm-tabs">
        <button class="btn btn-outline cm-tab active" data-tab="summary">Summary</button>
        <button class="btn btn-outline cm-tab" data-tab="all">All Rows</button>
        <button class="btn btn-outline cm-tab" data-tab="unmatched">Unmatched</button>
      </div>
      <div class="cm-tabpanel active" data-panel="summary">
        <div class="cm-summary-grid">
          <div class="cm-kpi"><strong>${summary.total}</strong><span>Total rows</span></div>
          <div class="cm-kpi"><strong>${summary.art}</strong><span>Art</span></div>
          <div class="cm-kpi"><strong>${summary.drama}</strong><span>Drama</span></div>
          <div class="cm-kpi"><strong>${summary.photography}</strong><span>Photography</span></div>
        </div>
        <div class="cm-routing">
          <span class="badge">${rows.length - state.unmatched.length} routable</span>
          <span class="badge">${state.unmatched.length} unmatched</span>
          <span class="cm-route">Only routable rows will import.</span>
        </div>
      </div>
      <div class="cm-tabpanel" data-panel="all">
        <div class="cm-table-wrap">
          <table class="table">
            <thead><tr><th>Subject</th><th>Year</th><th>Class</th><th>Teacher Email</th><th>Match</th></tr></thead>
            <tbody>
              ${rows
                .map((r) => {
                  const bad = state.unmatched.includes(r);
                  return `<tr>
                    <td>${escapeHtml(r.subject)}</td>
                    <td>${escapeHtml(r.year_level)}</td>
                    <td>${escapeHtml(r.class_name)}</td>
                    <td>${escapeHtml(r.teacher_email || "")}</td>
                    <td class="${bad ? "cm-unmatch" : "cm-match"}">${bad ? "Needs fix" : "Matched"}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="cm-tabpanel" data-panel="unmatched">
        ${
          !state.unmatched.length
            ? '<p class="cm-empty">No unmatched rows.</p>'
            : `<div class="cm-table-wrap"><table class="table"><thead><tr><th>Class</th><th>Input email</th><th>Assign to</th></tr></thead><tbody>
                ${state.unmatched
                  .map((r, i) => {
                    return `<tr>
                      <td>${escapeHtml(r.class_name)}</td>
                      <td>${escapeHtml(r.teacher_email || "Missing")}</td>
                      <td>
                        <select class="cm-fix" data-fix="${i}">
                          <option value="">Choose teacher</option>
                          ${state.teachers
                            .map((t) => `<option value="${escapeHtml(t.email)}">${escapeHtml(t.name)} (${escapeHtml(t.email)})</option>`)
                            .join("")}
                        </select>
                      </td>
                    </tr>`;
                  })
                  .join("")}
              </tbody></table></div>`
        }
      </div>
      <div class="cm-modal-foot">
        <div class="cm-foot-msg">${state.unmatched.length ? "Fix unmatched rows before import." : "Ready to import."}</div>
        <button class="btn" id="cm-confirm-import" ${state.unmatched.length ? "disabled" : ""}>Confirm Import</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  qs("#cm-close-preview").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  Array.from(modal.querySelectorAll(".cm-tab")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = String(btn.getAttribute("data-tab") || "summary");
      state.activeTab = tab;
      Array.from(modal.querySelectorAll(".cm-tab")).forEach((b) => b.classList.toggle("active", b === btn));
      Array.from(modal.querySelectorAll(".cm-tabpanel")).forEach((p) => {
        p.classList.toggle("active", String(p.getAttribute("data-panel")) === tab);
      });
    });
  });

  Array.from(modal.querySelectorAll("select[data-fix]")).forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.getAttribute("data-fix"));
      const picked = String(sel.value || "").toLowerCase();
      if (!picked) return;
      const row = state.unmatched[idx];
      if (!row) return;
      row.teacher_email = picked;
      const teacher = state.teachers.find((t) => t.email === picked);
      if (teacher && !row.teacher_name) row.teacher_name = teacher.name;
      state.unmatched = state.unmatched.filter((item) => item !== row);
      const updatedRows = state.importRows.slice();
      modal.remove();
      openPreview(updatedRows);
    });
  });

  qs("#cm-confirm-import").addEventListener("click", async () => {
    const rowsToImport = state.importRows.filter((r) => !state.unmatched.includes(r));
    if (!rowsToImport.length) {
      setBulkError("No routable rows to import.");
      modal.remove();
      return;
    }
    try {
      const result = await runBulkImport(rowsToImport);
      modal.remove();
      setBulkError("");
      window.alert(
        `Import complete.\nCreated: ${result.created}\nUpdated: ${result.updated}\nConflicts: ${result.conflicts.length}`
      );
      await loadData();
    } catch (err) {
      setBulkError(String(err && err.message ? err.message : err));
    }
  });
}

async function handleFile(file) {
  setBulkError("");
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    setBulkError("File too large. Maximum supported file size is 5MB.");
    return;
  }
  const name = String(file.name || "").toLowerCase();
  let rows = [];
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) rows = await parseXlsxRows(file);
  else if (name.endsWith(".csv")) rows = await parseCsvRows(file);
  else throw new Error("Unsupported file type. Use CSV or XLSX.");

  if (!rows.length) throw new Error("No rows found in the selected file.");
  state.importRows = classifyAndRouteRows(rows);
  openPreview(state.importRows);
}

function ensureDrawer() {
  let drawer = document.getElementById("cm-manual-drawer");
  if (drawer) return drawer;
  drawer = el("aside", { class: "cm-drawer", id: "cm-manual-drawer" });
  drawer.innerHTML = `
    <div class="cm-drawer-head">
      <h3>Add Class Manually</h3>
      <button class="btn btn-outline" id="cm-drawer-close">Close</button>
    </div>
    <div class="cm-drawer-body">
      <label>Subject
        <select id="cm-add-subject">
          <option value="art">Art</option>
          <option value="drama">Drama</option>
          <option value="photography">Photography</option>
        </select>
      </label>
      <label>Year level
        <select id="cm-add-year">
          <option>S1</option><option>S2</option><option>S3</option>
          <option>S4</option><option>S5</option><option>S6</option>
        </select>
      </label>
      <label>Class name<input id="cm-add-name" type="text" placeholder="S1 Drama A" /></label>
      <label>Class code<input id="cm-add-code" type="text" placeholder="DRAA" /></label>
      <label>Teacher email<input id="cm-add-email" type="email" placeholder="teacher@school.org" /></label>
      <p class="cm-meta">Teacher email must belong to an existing teaching account.</p>
      <p id="cm-add-error" class="cm-error"></p>
    </div>
    <div class="cm-drawer-foot">
      <button class="btn btn-outline" id="cm-drawer-cancel">Cancel</button>
      <button class="btn" id="cm-drawer-save">Save Class</button>
    </div>`;
  document.body.appendChild(drawer);

  function closeDrawer() {
    drawer.classList.remove("is-open");
    qs("#cm-add-error").textContent = "";
  }

  qs("#cm-drawer-close").addEventListener("click", closeDrawer);
  qs("#cm-drawer-cancel").addEventListener("click", closeDrawer);
  qs("#cm-drawer-save").addEventListener("click", async () => {
    qs("#cm-add-error").textContent = "";
    try {
      await addClassManual({
        subject: qs("#cm-add-subject").value,
        year_level: qs("#cm-add-year").value,
        class_name: qs("#cm-add-name").value,
        class_code: qs("#cm-add-code").value,
        teacher_email: qs("#cm-add-email").value
      });
      closeDrawer();
      await loadData();
    } catch (err) {
      qs("#cm-add-error").textContent = String(err && err.message ? err.message : err);
    }
  });
  return drawer;
}

function wireActions() {
  qs("#class-search").addEventListener("input", filterRows);
  qs("#subject-filter").addEventListener("change", filterRows);
  qs("#refresh-classes").addEventListener("click", () => loadData().catch((e) => setBulkError(String(e.message || e))));

  qs("#download-template-csv").addEventListener("click", async () => {
    const blob = await downloadTemplate("csv");
    saveBlob(blob, "class_import_template.csv");
  });
  qs("#download-template-xlsx").addEventListener("click", async () => {
    const blob = await downloadTemplate("xlsx");
    saveBlob(blob, "class_import_template.xlsx");
  });
  qs("#open-manual-add").addEventListener("click", () => {
    const drawer = ensureDrawer();
    drawer.classList.add("is-open");
  });

  const fileInput = qs("#bulk-file");
  fileInput.addEventListener("change", async (e) => {
    try {
      const file = e.target.files ? e.target.files[0] : null;
      await handleFile(file);
    } catch (err) {
      setBulkError(String(err && err.message ? err.message : err));
    } finally {
      fileInput.value = "";
    }
  });
}

document.addEventListener("logout", () => {
  (window.doSignOut || function fallback() {
    if (window.clearSupabaseAuth) window.clearSupabaseAuth();
    window.location.href = "login.html?signout=1";
  })();
});

document.addEventListener("DOMContentLoaded", async () => {
  wireActions();
  try {
    await loadData();
  } catch (err) {
    setBulkError(String(err && err.message ? err.message : err));
  }
});
