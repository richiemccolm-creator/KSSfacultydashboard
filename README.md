# HGIOS 4 Inspection Toolkit

An offline-first web application for Faculty Heads to gather and organise inspection evidence against the **How Good is Our School? 4** (HGIOS 4) framework from Education Scotland.

## Features

- **Dashboard** – Overview of all 14 Quality Indicators with completion status and progress
- **QI Detail Pages** – Enter evidence, rate levels, and add notes for each Quality Indicator
- **Auto-save** – Data is saved automatically to your browser
- **Export** – Download your data as a JSON file for backup
- **Import** – Restore data from a JSON file (Replace all or Merge)
- **Print Report** – Generate an inspection-ready report (print or save as PDF)

## Faculty Hub integration

When opened from **Faculty Hub → Admin → HGIOS 4 Toolkit** (`?embed=1`):

- Matches Faculty Hub styling (navy, General Sans / Inter).
- **Cloud sync** to Supabase (`hgios4_toolkit` table) when signed in as Faculty Head / admin.
- **Faculty Hub evidence** panel shows live status from Triangulation, Class Visits, DIP, Department Meetings, and more — with **Open in Hub** links.

Apply the migration `supabase/migrations/20260527100000_hgios4_toolkit.sql` before using cloud sync.

## Quick Start (standalone)

1. **Copy the folder** to your computer (e.g. Desktop, Documents, or a USB drive).
2. **Open `index.html`** in your web browser (Chrome, Firefox, Safari, or Edge).
3. Start entering your school details and evidence.

Standalone mode works offline with browser storage; use Faculty Hub for cloud sync and live evidence links.

## Moving Between Computers

1. On your current computer: click **Export / Import** → **Export to JSON**.
2. Copy the downloaded file to your other computer (USB drive, email, cloud storage).
3. On the new computer: open the toolkit folder and `index.html`.
4. Click **Export / Import** → **Select File to Import** → choose your JSON file.
5. Choose **Replace all** (replace everything) or **Merge** (combine with existing data).

## Usage Workflow

1. **First use:** Enter your school name and faculty/department.
2. **Daily use:** Click each Quality Indicator to add evidence, rate levels, and notes. Data saves automatically.
3. **Before inspection:** Review the Dashboard, then go to **Print Report** and use **Print / Save as PDF** to create a document for the inspection team.

## Quality Indicators (HGIOS 4)

### 1. Leadership and Management
- QI 1.1 Self-Evaluation for Self-Improvement
- QI 1.2 Leadership of Learning
- QI 1.3 Leadership of Change
- QI 1.4 Leadership and Management of Staff
- QI 1.5 Management of Resources to Promote Equity

### 2. Learning Provision
- QI 2.1 Safeguarding and Child Protection
- QI 2.2 Curriculum
- QI 2.3 Learning, Teaching and Assessment (Core)
- QI 2.4 Personalised Support
- QI 2.5 Family Learning

### 3. Successes and Achievements
- QI 3.1 Ensuring Wellbeing, Equality and Inclusion
- QI 3.2 Raising Attainment and Achievement
- QI 3.3 Increasing Creativity and Employability
- QI 3.4 Performance

## Technical Notes

- **Storage:** Data is stored in your browser (LocalStorage or IndexedDB). It stays on your computer.
- **Offline:** The toolkit works entirely offline. No server or internet needed.
- **File protocol:** If you open `index.html` directly (`file://`), data may not persist if you move the folder. Use **Export** before moving, then **Import** in the new location.
- **Alternative:** For more reliable storage, run a simple local server in the toolkit folder:
  - `npx serve .` (Node.js)
  - `python -m http.server 8000` (Python)
  Then open `http://localhost:8000` in your browser.

## File References

The toolkit lets you record **file references** (e.g. document names) for each QI. Keep your actual files (PDFs, meeting notes) in a separate folder and reference them by name. This keeps the toolkit lightweight and portable.

## Licence

This toolkit is for educational use. HGIOS 4 is © Crown copyright, Education Scotland.
