/**
 * Capture staff-tour screenshots with seeded demo data for mini-tutorials.
 * Usage: node docs/staff-tour/capture-screenshots.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'screenshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = urlPath === '/' ? '/faculty-hub.html' : urlPath;
        const filePath = path.join(ROOT, rel.replace(/^\//, ''));
        if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

const AUTH_STUB = `
window.__authReady = true;
window.__authGuardIsAdmin = false;
window.__authGuardRole = 'teacher';
window.__authGuardIsFacultyHead = false;
window.__authGuardCanManageSchool = false;
window.__authGuardCanViewSchoolWideTracking = false;
try { window.dispatchEvent(new CustomEvent('auth-guard-ready')); } catch (e) {}
`;

async function seedPlanner(page) {
  await page.waitForFunction(() => {
    const PS = window.PlannerService;
    return !!(PS && typeof PS.collectTimetable === 'function' && PS.getState && PS.getState().timetable);
  }, null, { timeout: 25000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const PS = window.PlannerService;
    const id = () => PS.id();
    const periodTimes = {
      1: { start: '08:50', end: '09:40' },
      2: { start: '09:40', end: '10:30' },
      3: { start: '10:45', end: '11:35' },
      4: { start: '11:35', end: '12:25' },
      5: { start: '13:10', end: '14:00' },
      6: { start: '14:00', end: '14:50' },
    };
    const slots = [
      { id: id(), day: 'monday', period: 1, subject: 'drama', className: '1A Drama', room: 'Drama Studio', color: '#7c3aed' },
      { id: id(), day: 'monday', period: 3, subject: 'drama', className: '2B Drama', room: 'Drama Studio', color: '#7c3aed' },
      { id: id(), day: 'monday', period: 5, subject: 'drama', className: '3C Drama', room: 'Drama Studio', color: '#7c3aed' },
      { id: id(), day: 'tuesday', period: 2, subject: 'drama', className: '1A Drama', room: 'Drama Studio', color: '#7c3aed' },
      { id: id(), day: 'tuesday', period: 4, subject: 'drama', className: 'N5 CI', room: 'Drama Studio', color: '#2563eb' },
      { id: id(), day: 'wednesday', period: 1, subject: 'drama', className: '2B Drama', room: 'Drama Studio', color: '#7c3aed' },
      { id: id(), day: 'wednesday', period: 3, subject: 'drama', className: 'Higher Drama', room: 'Drama Studio', color: '#0f766e' },
      { id: id(), day: 'thursday', period: 2, subject: 'drama', className: '1A Drama', room: 'Drama Studio', color: '#7c3aed' },
      { id: id(), day: 'thursday', period: 5, subject: 'drama', className: '3C Drama', room: 'Drama Studio', color: '#7c3aed' },
      { id: id(), day: 'friday', period: 3, subject: 'drama', className: '2B Drama', room: 'Drama Studio', color: '#7c3aed' },
      { id: id(), day: 'friday', period: 4, subject: 'drama', className: 'N5 CI', room: 'Drama Studio', color: '#2563eb' },
    ];
    PS.collectTimetable(slots, periodTimes);
    if (PS.setAcademicYearLabel) PS.setAcademicYearLabel('2026–27');

    const monday = (() => {
      const d = new Date();
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      d.setDate(d.getDate() + diff);
      return PS.getDateStr(d);
    })();

    [
      { slotKey: 'monday-1', title: 'S1 · Ensemble warm-up & freeze frames', status: 'planned' },
      { slotKey: 'monday-3', title: 'S2 · Status & improvisation', status: 'planned' },
      { slotKey: 'monday-5', title: 'S3 · Script work — intentions', status: 'draft' },
      { slotKey: 'tuesday-2', title: 'S1 · Character cards', status: 'planned' },
      { slotKey: 'tuesday-4', title: 'N5 CI · Industry roles research', status: 'planned' },
    ].forEach((L) => {
      PS.upsertLesson({
        date: monday,
        slotKey: L.slotKey,
        subject: 'drama',
        title: L.title,
        body: '<h3>Learning intention</h3><p>Develop ensemble skills and clear stage communication.</p><h3>Activity</h3><p>Warm-up → modelled task → pupil application → plenary.</p>',
        notes: 'Demo lesson for staff tour — fictional class data.',
        status: L.status,
        resources: [{ label: 'Unit slides', url: '#' }],
        todos: [{ id: id(), text: 'Print stimulus cards', done: false }],
        updatedAt: new Date().toISOString(),
      });
    });

    [
      {
        title: 'BGE Warm-up · Voice & focus',
        subject: 'drama',
        status: 'planned',
        body: '<p>Circle warm-up, name game, focus countdown.</p>',
        notes: 'Reusable starter · 8–10 mins',
      },
      {
        title: 'Status improvisation block',
        subject: 'drama',
        status: 'planned',
        body: '<p>High/low status pairs → audience feedback → freeze.</p>',
        notes: 'S2 / S3 flexible',
      },
      {
        title: 'Exit ticket · What changed in my character?',
        subject: 'drama',
        status: 'draft',
        body: '<p>3 prompt exit ticket linked to Toolkit.</p>',
        notes: 'Plenary',
      },
    ].forEach((t) => {
      PS.saveTemplate({
        id: id(),
        title: t.title,
        subject: t.subject,
        status: t.status,
        body: t.body,
        notes: t.notes,
        resources: [],
        updatedAt: new Date().toISOString(),
      });
    });
  });
}

async function clickPlannerTab(page, tab) {
  const sel = `[data-tab="${tab}"]`;
  await page.click(sel);
  await page.waitForTimeout(500);
}

async function seedTracker(page) {
  await page.waitForFunction(() => typeof window.nav === 'function' && typeof window.addClass === 'function', null, { timeout: 25000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    nav('setup-s1');
    const demo = [
      {
        name: '1A Drama',
        pupils: ['Ava Campbell', 'Noah Fraser', 'Isla Murray', 'Finn Reid', 'Maisie Quinn', 'Callum Shaw', 'Eilidh Brooks', 'Harris Dunn'],
      },
      {
        name: '1B Drama',
        pupils: ['Sofia Kerr', 'Archie Holt', 'Niamh Craig', 'Owen Blair'],
      },
    ];
    demo.forEach((c) => {
      const inp = document.getElementById('nc-s1');
      if (!inp) return;
      inp.value = c.name;
      addClass('s1');
      c.pupils.forEach((n) => {
        const key = 'np-s1-' + c.name.replace(/\s/g, '_');
        const pInp = document.getElementById(key);
        if (!pInp) return;
        pInp.value = n;
        addPupil('s1', c.name);
      });
    });
  });
}

const shots = [
  // Overview
  { name: '01-home', path: '/faculty-hub.html', wait: 2200 },
  { name: '12-hub-sidebar', path: '/faculty-hub.html', wait: 1800, clipSidebar: true },

  // Teacher Planner mini-tutorial
  {
    name: 'p01-timetable-edit',
    path: '/teacher_planner.html',
    wait: 1800,
    prep: async (page) => {
      await seedPlanner(page);
      await clickPlannerTab(page, 'timetable');
      const edit = page.locator('#editTimetableBtn, #editTimetableBtnInline').first();
      if (await edit.count()) await edit.click();
      await page.waitForTimeout(600);
    },
  },
  {
    name: 'p02-timetable-view',
    path: '/teacher_planner.html',
    wait: 1600,
    prep: async (page) => {
      await seedPlanner(page);
      await clickPlannerTab(page, 'timetable');
      // toggle away and back to force display render with seeded slots
      await clickPlannerTab(page, 'week');
      await clickPlannerTab(page, 'timetable');
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'p03-week',
    path: '/teacher_planner.html',
    wait: 1600,
    prep: async (page) => {
      await seedPlanner(page);
      await page.evaluate(() => {
        const PS = window.PlannerService;
        const d = new Date();
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        d.setDate(d.getDate() + diff);
        if (PS.setCurrentWeekStart) PS.setCurrentWeekStart(d);
      });
      await clickPlannerTab(page, 'week');
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'p04-bank',
    path: '/teacher_planner.html',
    wait: 1600,
    prep: async (page) => {
      await seedPlanner(page);
      await clickPlannerTab(page, 'bank');
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'p05-today',
    path: '/teacher_planner.html',
    wait: 1600,
    prep: async (page) => {
      await seedPlanner(page);
      await clickPlannerTab(page, 'today');
      await page.waitForTimeout(400);
    },
  },

  // Classroom Toolkit mini-tutorial
  {
    name: 'k01-toolkit-favs',
    path: '/classroom_toolkit.html',
    wait: 1800,
    beforeGoto: async (context) => {
      // set on context via init script each time — handled in capture loop
    },
    initScript: () => {
      try {
        localStorage.setItem('tk_favs', JSON.stringify(['timer', 'quiz', 'exit', 'lights', 'busters']));
      } catch (e) {}
    },
  },
  {
    name: 'k02-timer',
    path: '/toolkit/timer.html',
    wait: 1800,
    initScript: () => {
      try {
        localStorage.setItem('tk_big_timer_v1', JSON.stringify({
          total: 180,
          ring: true,
          label: 'Group rehearsal · freeze frames',
        }));
      } catch (e) {}
    },
    prep: async (page) => {
      await page.evaluate(() => {
        const label = document.getElementById('activityLabel');
        if (label) label.value = 'Group rehearsal · freeze frames';
        // Prefer 3m preset look
        const preset = document.querySelector('[data-mins="3"], button[data-sec="180"]');
        if (preset) preset.click();
      });
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'k03-quiz-host',
    path: '/toolkit/quiz.html',
    wait: 2000,
    prep: async (page) => {
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        const btn = document.querySelector('[data-host], #btnEditorHost, button.btn-primary');
        const hostBtns = Array.from(document.querySelectorAll('button')).filter((b) => /Host/i.test(b.textContent || ''));
        if (hostBtns[0]) hostBtns[0].click();
        else if (btn) btn.click();
      });
      await page.waitForTimeout(1200);
    },
  },
  {
    name: 'k04-quiz-home',
    path: '/toolkit/quiz.html',
    wait: 1800,
  },
  {
    name: 'k05-exit',
    path: '/toolkit/exit.html',
    wait: 1800,
    initScript: () => {
      try {
        localStorage.setItem('tk_exit_tickets_v1', JSON.stringify([
          {
            id: 'demo-drama-reflect',
            title: 'Drama reflection (demo)',
            prompts: [
              'One skill I used well today',
              'One thing I will improve next lesson',
              'A peer who helped my group — and how',
            ],
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'demo-vocab',
            title: 'Vocab check-out',
            prompts: ['New word I can explain', 'Where I used it in performance'],
            updatedAt: new Date().toISOString(),
          },
        ]));
      } catch (e) {}
    },
  },
  {
    name: 'k06-lights',
    path: '/toolkit/lights.html',
    wait: 1800,
  },
  {
    name: 'k07-busters',
    path: '/toolkit/quiz-busters.html',
    wait: 1800,
  },
  {
    name: 'k08-headsup',
    path: '/toolkit/heads-up.html',
    wait: 1800,
  },

  // Tracker classes (bonus mini-tutorial — related “set up classes”)
  {
    name: 't01-setup-filled',
    path: '/drama-tracker.html',
    wait: 1800,
    prep: async (page) => {
      await seedTracker(page);
      await page.waitForTimeout(400);
    },
  },
  {
    name: 't02-scores-filled',
    path: '/drama-tracker.html',
    wait: 1800,
    prep: async (page) => {
      await seedTracker(page);
      await page.evaluate(() => {
        nav('tracker-s1');
        if (typeof setCls === 'function') setCls('s1', '1A Drama');
        // Score first few pupils with varied 2–4 values via visible buttons
        const rows = Array.from(document.querySelectorAll('.pupil-score-row, .score-row, tr, .p-row')).slice(0, 8);
        const btns = Array.from(document.querySelectorAll('button.sc-btn.s3, button.sc-btn.s4'));
        btns.slice(0, 24).forEach((b, i) => {
          if (i % 3 === 0) b.click();
        });
        Array.from(document.querySelectorAll('button.sc-btn.s2')).slice(0, 8).forEach((b) => b.click());
      });
      await page.waitForTimeout(600);
    },
  },

  // Keep a few supporting shots
  { name: '03-tracking-landing', path: '/tracking_monitoring_landing.html', wait: 1600 },
  { name: '06-tasks', path: '/teacher_tasks.html', wait: 1800 },
  { name: '07-toolkit', path: '/classroom_toolkit.html', wait: 1600, initScript: () => {
    try { localStorage.setItem('tk_favs', JSON.stringify(['timer', 'quiz', 'exit', 'lights', 'busters'])); } catch (e) {}
  }},
  { name: '11-report-builder', path: '/BGE_Drama_Report_Builder.html', wait: 1600 },
  { name: '22-letter-generator', path: '/letter_generator.html', wait: 1600 },
];

async function capture() {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, base } = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  await context.route('**/auth-guard.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: AUTH_STUB });
  });
  await context.route('**/allowlist-check.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `window.checkAllowlist=function(){return Promise.resolve({allowed:true,isAdmin:false,role:'teacher',isFacultyHead:false,canManageSchool:false,canViewSchoolWideTracking:false});};`,
    });
  });
  await context.route('**/*.supabase.co/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], error: null }) });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  for (const shot of shots) {
    console.log('Capturing', shot.name, '←', shot.path);
    if (shot.initScript) {
      await context.addInitScript(shot.initScript);
    }
    await page.goto(base + shot.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(shot.wait || 1500);
    if (shot.prep) await shot.prep(page);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      document.querySelectorAll('.toast, .toast-msg, [class*="toast"]').forEach((el) => {
        el.style.display = 'none';
      });
    });

    const file = path.join(OUT, `${shot.name}.png`);
    if (shot.clipSidebar) {
      const box = await page.evaluate(() => {
        const el = document.querySelector('.sidebar, aside.sidebar, #sidebar');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: Math.min(r.width, 320), height: Math.min(r.height, 900) };
      });
      if (box && box.width > 40) await page.screenshot({ path: file, clip: box });
      else await page.screenshot({ path: file, fullPage: false });
    } else {
      await page.screenshot({ path: file, fullPage: false });
    }
    console.log('  →', path.relative(ROOT, file));
  }

  await browser.close();
  server.close();
  console.log('Done.');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
