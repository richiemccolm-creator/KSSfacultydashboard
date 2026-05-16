const REQUIRED_COLUMNS = ["subject", "year_level", "class_name", "teacher_email"];
const OPTIONAL_COLUMNS = ["class_code", "pupil_name", "teacher_name"];
const SUBJECT_ALIASES = {
  art: "art",
  "art&design": "art",
  "art and design": "art",
  "art_design": "art",
  drama: "drama",
  photography: "photography",
  photo: "photography"
};

let teacherCache = [];
let classIndexById = new Map();

function normalizeHeaderKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseYearLevel(value) {
  const m = /^s?([1-6])$/i.exec(String(value || "").trim());
  return m ? `S${m[1]}` : "";
}

function normalizeSubject(value) {
  const raw = String(value || "").trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9]+/g, " ").trim();
  const flat = normalized.replace(/\s+/g, " ");
  const compact = flat.replace(/\s+/g, "");
  return SUBJECT_ALIASES[flat] || SUBJECT_ALIASES[compact] || "";
}

function getCurrentAcademicYearLabel() {
  const d = new Date();
  const startYear = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

async function resolveAcademicYearLabel() {
  if (!window.DataService || typeof window.DataService.listAcademicYears !== "function") {
    return getCurrentAcademicYearLabel();
  }
  try {
    const years = await window.DataService.listAcademicYears();
    const labels = (years || []).map((r) => String(r.label || "").trim()).filter(Boolean);
    const current = getCurrentAcademicYearLabel();
    if (labels.includes(current)) return current;
    return labels[0] || current;
  } catch {
    return getCurrentAcademicYearLabel();
  }
}

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: "Pupil", last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function mapRowValue(row, keys) {
  const rowKeys = Object.keys(row || {});
  for (const key of keys) {
    for (const existing of rowKeys) {
      if (normalizeHeaderKey(existing) === normalizeHeaderKey(key)) {
        const value = row[existing];
        if (value != null && String(value).trim()) return String(value).trim();
      }
    }
  }
  return "";
}

export function normalizeRow(row) {
  return {
    subject: normalizeSubject(mapRowValue(row, ["subject", "tracker_subject", "tracker subject"])),
    year_level: parseYearLevel(mapRowValue(row, ["year_level", "year", "year group"])) || "S1",
    class_name: mapRowValue(row, ["class_name", "class", "class title"]),
    class_code: mapRowValue(row, ["class_code", "code"]),
    pupil_name: mapRowValue(row, ["pupil_name", "student_name", "student"]),
    teacher_name: mapRowValue(row, ["teacher_name", "teacher"]),
    teacher_email: mapRowValue(row, ["teacher_email", "email"]).toLowerCase()
  };
}

export async function parseXlsxRows(file) {
  if (!window.XLSX) throw new Error("XLSX library is not available");
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = workbook.Sheets[firstSheet];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map(normalizeRow);
}

export async function parseCsvRows(file) {
  if (!window.Papa) throw new Error("PapaParse library is not available");
  return new Promise((resolve, reject) => {
    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (results.errors && results.errors.length) {
          reject(new Error(results.errors[0].message || "CSV parse error"));
          return;
        }
        resolve((results.data || []).map(normalizeRow));
      },
      error(err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

function levenshtein(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  const dp = Array.from({ length: aa.length + 1 }, () => Array(bb.length + 1).fill(0));
  for (let i = 0; i <= aa.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= bb.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= aa.length; i += 1) {
    for (let j = 1; j <= bb.length; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[aa.length][bb.length];
}

export function fuzzyMatchTeacherEmail(email, teachers) {
  const target = String(email || "").toLowerCase().split("@")[0];
  if (!target) return null;
  let best = null;
  let bestDistance = Infinity;
  (teachers || []).forEach((teacher) => {
    const candidate = String(teacher.email || "").toLowerCase().split("@")[0];
    if (!candidate) return;
    const distance = levenshtein(target, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = teacher;
    }
  });
  if (!best || bestDistance > 2) return null;
  return { email: best.email, name: best.name || best.display_name || "" };
}

export async function downloadTemplate(format) {
  const sampleRows = [
    {
      subject: "drama",
      year_level: "S1",
      class_name: "S1 Drama A",
      class_code: "DRAA",
      pupil_name: "Alex Brown",
      teacher_name: "Teacher Example",
      teacher_email: "teacher@school.org"
    },
    {
      subject: "art",
      year_level: "S2",
      class_name: "S2 Art B",
      class_code: "ARTB",
      pupil_name: "Casey Murray",
      teacher_name: "Teacher Example",
      teacher_email: "teacher@school.org"
    }
  ];
  const fmt = String(format || "xlsx").toLowerCase();
  if (fmt === "csv") {
    const header = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
    const lines = [header.join(",")];
    sampleRows.forEach((row) => {
      lines.push(header.map((k) => `"${String(row[k] || "").replace(/"/g, '""')}"`).join(","));
    });
    return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  }
  if (!window.XLSX) throw new Error("XLSX library is not available");
  const instructions = [
    ["Required columns", REQUIRED_COLUMNS.join(", ")],
    ["Optional columns", OPTIONAL_COLUMNS.join(", ")],
    ["Subject values", "drama, art, photography"],
    ["Year level values", "S1 to S6"],
    ["Notes", "Upload is append-only. Existing staff data is not deleted by import."]
  ];
  const wb = window.XLSX.utils.book_new();
  const dataSheet = window.XLSX.utils.json_to_sheet(sampleRows);
  const helpSheet = window.XLSX.utils.aoa_to_sheet(instructions);
  window.XLSX.utils.book_append_sheet(wb, dataSheet, "class_import_template");
  window.XLSX.utils.book_append_sheet(wb, helpSheet, "instructions");
  const output = window.XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function mapTeacherRow(row) {
  return {
    id: String(row.teacher_id || row.user_id || row.id || "").trim(),
    name: row.display_name || row.teacherName || row.name || row.email || "Unknown",
    email: String(row.email || "").trim().toLowerCase(),
    role: row.role || row.user_role || "teacher",
    department: row.department || ""
  };
}

export async function fetchTeachers() {
  if (!window.DataService) return [];
  let rows = [];
  if (typeof window.DataService.listTeachingStaffForClassLoaderDetailed === "function") {
    const payload = await window.DataService.listTeachingStaffForClassLoaderDetailed();
    rows = (payload && payload.rows) || [];
  } else if (typeof window.DataService.listTeachingStaffForClassLoader === "function") {
    rows = await window.DataService.listTeachingStaffForClassLoader();
  }
  teacherCache = (rows || [])
    .map(mapTeacherRow)
    .filter((t) => t.id)
    .sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
  return teacherCache.slice();
}

export async function fetchAllClasses() {
  if (!window.DataService || typeof window.DataService.listTeacherSubjectClassesForLoader !== "function") {
    return [];
  }
  const teachers = await fetchTeachers();
  const yearLabel = await resolveAcademicYearLabel();
  const subjects = ["art", "drama", "photography"];
  const requests = [];
  teachers.forEach((teacher) => {
    subjects.forEach((subject) => {
      requests.push(
        window.DataService
          .listTeacherSubjectClassesForLoader({
            teacherId: teacher.id,
            subject,
            academicYearLabel: yearLabel
          })
          .then((rows) =>
            (rows || []).map((item) => ({
              id: item.class_id || "",
              class_name: item.class_name || "",
              class_code: item.class_code || "",
              year_level: String(item.year_level_label || item.year_level || "S1").toUpperCase(),
              subject: item.subject || subject,
              academic_year_label: item.academic_year_label || yearLabel,
              teacher_id: teacher.id,
              teacher_name: teacher.name,
              teacher_email: teacher.email
            }))
          )
          .catch(() => [])
      );
    });
  });
  const chunks = await Promise.all(requests);
  const flattened = chunks.flat();
  const seen = new Set();
  const result = [];
  classIndexById = new Map();
  flattened.forEach((row) => {
    const key = row.id ? `${row.id}:${row.teacher_id}` : `${row.teacher_id}:${row.subject}:${row.class_code}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(row);
    if (row.id) classIndexById.set(row.id, row);
  });
  return result;
}

function resolveTeacherFromRow(row) {
  const teacherId = String(row.teacher_id || "").trim();
  const email = String(row.teacher_email || "").trim().toLowerCase();
  if (teacherId) return teacherCache.find((t) => t.id === teacherId) || null;
  if (email) return teacherCache.find((t) => t.email === email) || null;
  return null;
}

export async function addClassManual(row) {
  if (!window.DataService || typeof window.DataService.upsertTeacherSubjectClassesForLoader !== "function") {
    throw new Error("Class management service is unavailable");
  }
  if (!teacherCache.length) await fetchTeachers();
  const subject = normalizeSubject(row.subject);
  const yearLabel = String(row.academic_year_label || "").trim() || (await resolveAcademicYearLabel());
  const teacher = resolveTeacherFromRow(row);
  if (!teacher) throw new Error("Teacher not found. Use an existing teacher email.");
  if (!subject) throw new Error("Subject must be art, drama, or photography.");
  const className = String(row.class_name || "").trim();
  if (!className) throw new Error("Class name is required.");
  const classCode = String(row.class_code || className.replace(/[^a-z0-9]+/gi, "").slice(0, 8) || "CLS1").toUpperCase();
  const yearLevel = parseYearLevel(row.year_level) || "S1";
  return window.DataService.upsertTeacherSubjectClassesForLoader({
    teacherId: teacher.id,
    subject,
    academicYearLabel: yearLabel,
    classes: [{ year_level: yearLevel, class_code: classCode, class_name: className }],
    replaceExisting: false
  });
}

export async function deleteClass(classId) {
  const id = String(classId || "").trim();
  if (!id) throw new Error("Class id is required.");
  const existing = classIndexById.get(id);
  if (!existing) throw new Error("Class was not found in current list. Refresh and try again.");
  const current = await window.DataService.listTeacherSubjectClassesForLoader({
    teacherId: existing.teacher_id,
    subject: existing.subject,
    academicYearLabel: existing.academic_year_label
  });
  const remaining = (current || [])
    .filter((r) => String(r.class_id || "") !== id)
    .map((r) => ({
      year_level: parseYearLevel(r.year_level_label || r.year_level) || "S1",
      class_code: String(r.class_code || "").trim(),
      class_name: String(r.class_name || "").trim()
    }))
    .filter((r) => r.class_code && r.class_name);
  return window.DataService.upsertTeacherSubjectClassesForLoader({
    teacherId: existing.teacher_id,
    subject: existing.subject,
    academicYearLabel: existing.academic_year_label,
    classes: remaining,
    replaceExisting: true
  });
}

export async function runBulkImport(rows) {
  if (!window.DataService || typeof window.DataService.bulkUpsertPupilsAndEnrollments !== "function") {
    throw new Error("Bulk import service is unavailable");
  }
  const yearLabel = await resolveAcademicYearLabel();
  const payloadRows = (rows || []).map((row, idx) => {
    const names = splitName(row.pupil_name);
    return {
      subject: normalizeSubject(row.subject),
      year_level: parseYearLevel(row.year_level) || "S1",
      class_code: String(
        row.class_code || row.class_name.replace(/[^a-z0-9]+/gi, "").slice(0, 8) || `CLS${idx + 1}`
      ).toUpperCase(),
      class_name: String(row.class_name || "").trim(),
      teacher_email: String(row.teacher_email || "").trim().toLowerCase(),
      first_name: names.first_name,
      last_name: names.last_name,
      preferred_name: "",
      external_id: ""
    };
  });
  const res = await window.DataService.bulkUpsertPupilsAndEnrollments({
    rows: payloadRows,
    academicYearLabel: yearLabel,
    mode: "add_only",
    overrideConflicts: false
  });
  return {
    created: Number(res.inserted_classes || res.created || res.inserted || 0),
    updated: Number(res.updated_classes || res.updated || 0),
    conflicts: Array.isArray(res.conflicts) ? res.conflicts : []
  };
}
