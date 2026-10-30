import { test, expect } from "@playwright/test";

// Stress tests for Mini Whiteboards (toolkit/whiteboard.html + toolkit/whiteboard-join.html).
// The real teacher and pupil pages run against a fake Supabase that copies the behaviour of the
// wb_* functions in supabase/migrations/2026*whiteboard*.sql, with adjustable lag and dropped
// requests so we can see what a class on patchy school wifi sees.

const SUPABASE = "https://dfecneakkmwccnemptvd.supabase.co";
const STORAGE_KEY = "sb-dfecneakkmwccnemptvd-auth-token";
const HOST_ID = "00000000-0000-4000-8000-00000000a001";
const HOST_EMAIL = "teacher@example.test";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 6;
  const user = { id: HOST_ID, aud: "authenticated", role: "authenticated", email: HOST_EMAIL, app_metadata: {}, user_metadata: {} };
  const access_token = b64url({ alg: "HS256", typ: "JWT" }) + "." +
    b64url({ sub: HOST_ID, email: HOST_EMAIL, role: "authenticated", aud: "authenticated", exp }) + ".sig";
  return { access_token, refresh_token: "fake-refresh", token_type: "bearer", expires_in: 3600 * 6, expires_at: exp, user };
}

class FakeDb {
  constructor() {
    this.sessions = [];
    this.players = [];
    this.boards = [];
    // Fault injection, per request kind: { lag: [min, max] ms, drop: 0-1 }
    this.faults = {};
    this.log = [];
    this.readWaiters = [];
  }

  // Resolves once a request of this kind has read the database (its reply is still on its way)
  nextRead(kind) {
    return new Promise((resolve) => this.readWaiters.push({ kind, resolve }));
  }

  fault(kind) {
    return this.faults[kind] || this.faults["*"] || { lag: [20, 60], drop: 0 };
  }

  err(message, code = "P0001") {
    const e = new Error(message);
    e.pg = { code, message, details: null, hint: null };
    return e;
  }

  board(sessionId, playerId) {
    return this.boards.find((b) => b.session_id === sessionId && b.player_id === playerId);
  }

  // Close copy of wb_sanitize_strokes: counts, sticker/shape items, clamping
  sanitize(list) {
    if (!Array.isArray(list)) return [];
    if (list.length > 250) throw this.err("Too many strokes — wipe the board and keep the answer simpler");
    // The live database rejects at about 8,000 numbers (checked against Supabase)
    const nums = list.reduce((t, s) => t + ((s && s.p && s.p.length) || 0), 0);
    if (nums + list.length * 4 > 8000) throw this.err("Drawing is too large — wipe the board and keep the answer simpler");
    const out = [];
    let shape = false;
    for (const s of list) {
      if (!s || typeof s !== "object") continue;
      if (s.a != null) { if (!shape) { shape = true; out.push({ a: Math.max(300, Math.min(2500, Math.round(s.a))) }); } continue; }
      if (s.e) { out.push({ e: s.e, w: s.w, p: s.p.slice(0, 2) }); continue; }
      if (!Array.isArray(s.p) || s.p.length < 2 || s.p.length > 400 || s.p.length % 2) continue;
      out.push({ c: String(s.c).toUpperCase(), w: Math.max(1, Math.min(28, parseInt(s.w, 10) || 4)), p: s.p.map((n) => Math.max(0, Math.min(1000, Math.round(n)))) });
    }
    return out;
  }

  rpc(name, a, uid) {
    if (name === "wb_join_session") {
      const s = this.sessions.filter((x) => x.pin === a.p_pin && x.status !== "closed").pop();
      if (!s) throw this.err("No live whiteboards found for that PIN");
      let p = this.players.find((x) => x.session_id === s.id && x.token === a.p_token);
      if (p) p.nickname = a.p_nickname.trim();
      else {
        if (this.players.some((x) => x.session_id === s.id && x.nickname.toLowerCase() === a.p_nickname.trim().toLowerCase())) {
          throw this.err("That name is already taken");
        }
        p = { id: uuid(), session_id: s.id, nickname: a.p_nickname.trim(), token: a.p_token, joined_at: Date.now() };
        this.players.push(p);
      }
      let b = this.board(s.id, p.id);
      if (!b) { b = { session_id: s.id, player_id: p.id, strokes: [], rev: 0 }; this.boards.push(b); }
      return { session_id: s.id, player_id: p.id, nickname: p.nickname, token: p.token, status: s.status, title: s.title,
        prompt: s.prompt, anonymous: s.anonymous, locked: s.locked, round: s.round, strokes: b.strokes, rev: b.rev };
    }
    if (name === "wb_get_session_state") {
      const s = this.sessions.filter((x) => x.pin === a.p_pin && x.status !== "closed").pop();
      if (!s) throw this.err("Session not found");
      const p = this.players.find((x) => x.session_id === s.id && x.token === a.p_token);
      const b = p && this.board(s.id, p.id);
      return { session_id: s.id, title: s.title, prompt: s.prompt, status: s.status, anonymous: s.anonymous, locked: s.locked,
        round: s.round, player_count: this.players.filter((x) => x.session_id === s.id).length,
        nickname: p ? p.nickname : null, strokes: b ? b.strokes : [], rev: b ? b.rev : 0 };
    }
    if (name === "wb_submit_strokes") {
      const p = this.players.filter((x) => x.token === a.p_token).pop();
      if (!p) throw this.err("Player not found");
      const s = this.sessions.find((x) => x.id === p.session_id);
      if (s.status === "closed") return { ok: false, reason: "closed", round: s.round };
      if (s.locked) return { ok: false, reason: "locked", round: s.round };
      const b = this.board(s.id, p.id);
      if (a.p_round !== s.round) return { ok: false, reason: "round", round: s.round, strokes: b.strokes, rev: b.rev };
      b.strokes = this.sanitize(a.p_strokes);
      b.rev += 1;
      return { ok: true, rev: b.rev, round: s.round };
    }
    if (name === "wb_wipe_boards") {
      const s = this.sessions.find((x) => x.id === a.p_session_id);
      if (!s || s.host_id !== uid) throw this.err("Not allowed");
      s.round += 1;
      s.locked = false;
      this.boards.filter((b) => b.session_id === s.id).forEach((b) => { b.strokes = []; b.rev += 1; });
      return { ok: true, round: s.round };
    }
    if (name === "wb_list_host_state") {
      const s = this.sessions.find((x) => x.id === a.p_session_id);
      if (!s || s.host_id !== uid) throw this.err("Not allowed");
      const known = a.p_known || {};
      const boards = this.players.filter((p) => p.session_id === s.id).sort((x, y) => x.joined_at - y.joined_at).map((p) => {
        const b = this.board(s.id, p.id) || { strokes: [], rev: 0 };
        return { id: p.id, nickname: p.nickname, joined_at: new Date(p.joined_at).toISOString(), rev: b.rev,
          has_ink: b.strokes.length > 0, strokes: (known[p.id] == null ? -1 : known[p.id]) < b.rev ? b.strokes : null };
      });
      return { session_id: s.id, title: s.title, prompt: s.prompt, status: s.status, pin: s.pin, anonymous: s.anonymous,
        locked: s.locked, round: s.round, player_count: boards.length, boards };
    }
    throw this.err("Unknown function " + name, "PGRST202");
  }

  async handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors() });
    const kind = path.startsWith("/rest/v1/rpc/") ? path.slice(13) : path.split("/").slice(0, 4).join("/") + ":" + method;
    const f = this.fault(kind);
    // Half the lag on the way up, half on the way back, so a slow reply can carry stale data
    const lag = f.lag[0] + Math.random() * (f.lag[1] - f.lag[0]);
    await sleep(lag / 2);
    if (f.drop && Math.random() < f.drop) {
      this.log.push({ kind, dropped: true });
      return route.abort("failed").catch(() => {});
    }
    let body = {};
    try { body = req.postDataJSON() || {}; } catch (e) {}
    const auth = req.headers()["authorization"] || "";
    const uid = auth.includes(".") && !auth.includes("anon") ? (() => {
      try { return JSON.parse(Buffer.from(auth.split(" ")[1].split(".")[1], "base64url").toString()).sub; } catch (e) { return null; }
    })() : null;
    const wantsObject = /vnd\.pgrst\.object/.test(req.headers()["accept"] || "");
    const send = (status, data) => {
      const body = JSON.stringify(data);
      return sleep(lag / 2).then(() => route.fulfill({ status, headers: { ...cors(), "content-type": "application/json" }, body })).catch(() => {});
    };
    try {
      if (path.startsWith("/rest/v1/rpc/")) {
        const data = JSON.parse(JSON.stringify(this.rpc(kind, body, uid)));
        this.log.push({ kind, at: Date.now(), args: body, data });
        this.readWaiters = this.readWaiters.filter((w) => (w.kind === kind ? (w.resolve(), false) : true));
        return send(200, data);
      }
      if (path === "/rest/v1/allowed_emails") {
        const row = { email: HOST_EMAIL, is_admin: false, role: "teacher" };
        return send(200, wantsObject ? row : [row]);
      }
      if (path === "/rest/v1/whiteboard_sessions" && method === "POST") {
        const row = { id: uuid(), created_at: new Date().toISOString(), ...body };
        if (this.sessions.some((s) => s.pin === row.pin && s.status !== "closed")) return send(409, { code: "23505", message: "duplicate pin" });
        this.sessions.push(row);
        return send(201, wantsObject ? row : [row]);
      }
      if (path === "/rest/v1/whiteboard_sessions" && method === "PATCH") {
        const id = (url.searchParams.get("id") || "").replace(/^eq\./, "");
        const s = this.sessions.find((x) => x.id === id);
        if (s && s.host_id === uid) Object.assign(s, body);
        this.log.push({ kind: "patch", at: Date.now(), body });
        return send(204, null);
      }
      if (path.startsWith("/auth/v1/user")) return send(200, fakeSession().user);
      return send(200, []);
    } catch (e) {
      this.log.push({ kind, at: Date.now(), error: e.message });
      return send(400, e.pg || { message: e.message });
    }
  }

  get session() { return this.sessions[this.sessions.length - 1]; }
  boardOf(nick) {
    const p = this.players.find((x) => x.session_id === this.session.id && x.nickname === nick);
    return p && this.board(this.session.id, p.id);
  }
  inkOf(nick) {
    const b = this.boardOf(nick);
    return b ? b.strokes.filter((s) => s.p && !s.e && s.a == null).length : 0;
  }
}

function cors() {
  return { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
}

async function wire(context, db) {
  await context.route(SUPABASE + "/**", (route) => db.handle(route));
  // The deploy-version probe would reload the page part way through a test
  await context.route("**/faculty-hub.html", (route) => route.fulfill({ status: 404, body: "" }));
}

async function openTeacher(browser, db, { hideAnswers = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await wire(context, db);
  await context.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify(session));
  }, [STORAGE_KEY, fakeSession()]);
  const page = await context.newPage();
  page.on("pageerror", (e) => db.log.push({ kind: "teacher-pageerror", error: e.message }));
  await page.goto("/toolkit/whiteboard.html");
  await page.locator("#btnLaunch").waitFor();
  if (!hideAnswers) await page.locator("#edHide").uncheck();
  await page.locator("#btnLaunch").click();
  await page.locator("#hostPin").waitFor();
  return { context, page, pin: (await page.locator("#hostPin").textContent()).trim() };
}

async function openPupil(browser, db, pin, nick, viewport = { width: 820, height: 1180 }) {
  const context = await browser.newContext({ viewport, hasTouch: false });
  await wire(context, db);
  const page = await context.newPage();
  page.on("pageerror", (e) => db.log.push({ kind: "pupil-pageerror", nick, error: e.message }));
  await page.goto("/toolkit/whiteboard-join.html?c=" + pin);
  await page.locator("#nick").fill(nick);
  await page.locator("#btnJoin").click();
  await page.locator("#viewPlay:not([hidden])").waitFor();
  await page.waitForTimeout(150);
  return { context, page, nick };
}

// Draw one line across the pupil's board, from fractions (x0,y0) to (x1,y1)
async function drawLine(pupil, x0, y0, x1, y1, steps = 12) {
  const box = await pupil.page.locator("#board").boundingBox();
  const px = (f) => box.x + box.width * f;
  const py = (f) => box.y + box.height * f;
  await pupil.page.mouse.move(px(x0), py(y0));
  await pupil.page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await pupil.page.mouse.move(px(x0 + ((x1 - x0) * i) / steps), py(y0 + ((y1 - y0) * i) / steps));
  }
  await pupil.page.mouse.up();
}

async function waitFor(fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(100);
  }
  return false;
}

test.describe("Mini Whiteboards under stress", () => {
  // Each test opens many browsers, so run them one after another
  test.describe.configure({ mode: "default" });
  test.setTimeout(120_000);

  test("a line drawn while the last save is still on its way still reaches the teacher", async ({ browser }) => {
    const db = new FakeDb();
    const teacher = await openTeacher(browser, db);
    const pupil = await openPupil(browser, db, teacher.pin, "Ava");
    db.faults.wb_submit_strokes = { lag: [900, 1100], drop: 0 };
    await drawLine(pupil, 0.1, 0.2, 0.8, 0.2);
    await pupil.page.waitForTimeout(650); // first save is now in flight
    await drawLine(pupil, 0.1, 0.5, 0.8, 0.5);
    await waitFor(() => db.inkOf("Ava") === 2, 6000);
    expect(db.inkOf("Ava")).toBe(2);
    await pupil.context.close();
    await teacher.context.close();
  });

  test("lines held back by a lock are saved once the teacher unlocks", async ({ browser }) => {
    const db = new FakeDb();
    const teacher = await openTeacher(browser, db);
    const pupil = await openPupil(browser, db, teacher.pin, "Ben");
    db.faults.wb_submit_strokes = { lag: [400, 500], drop: 0 };
    await drawLine(pupil, 0.1, 0.2, 0.8, 0.2);
    db.session.locked = true; // teacher locks just as the save is sent
    await pupil.page.waitForTimeout(1500);
    expect(db.inkOf("Ben")).toBe(0);
    db.session.locked = false;
    await waitFor(() => db.inkOf("Ben") === 1, 6000);
    expect(db.inkOf("Ben")).toBe(1);
    await pupil.context.close();
    await teacher.context.close();
  });

  test("pupils are told when the teacher ends the session", async ({ browser }) => {
    const db = new FakeDb();
    const teacher = await openTeacher(browser, db);
    const pupil = await openPupil(browser, db, teacher.pin, "Cal");
    await teacher.page.locator("#btnEnd").click();
    await expect(pupil.page.locator("#lockMsg")).toBeVisible({ timeout: 6000 });
    await expect(pupil.page.locator("#lockMsg")).toContainText("ended");
    await pupil.context.close();
    await teacher.context.close();
  });

  test("a line being drawn when the teacher wipes does not carry onto the new round", async ({ browser }) => {
    const db = new FakeDb();
    const teacher = await openTeacher(browser, db);
    const pupil = await openPupil(browser, db, teacher.pin, "Dee");
    const box = await pupil.page.locator("#board").boundingBox();
    await pupil.page.mouse.move(box.x + 50, box.y + 50);
    await pupil.page.mouse.down();
    await pupil.page.mouse.move(box.x + 150, box.y + 80);
    teacher.page.once("dialog", (d) => d.accept());
    await teacher.page.locator("#btnWipe").click();
    await waitFor(() => db.session.round === 2);
    await pupil.page.waitForTimeout(2200); // the pupil's next check sees round 2
    await pupil.page.mouse.move(box.x + 250, box.y + 120);
    await pupil.page.mouse.up();
    await pupil.page.waitForTimeout(1500);
    expect(db.inkOf("Dee")).toBe(0);
    await pupil.context.close();
    await teacher.context.close();
  });

  test("the teacher's buttons don't flick back while a slow check is answering", async ({ browser }) => {
    const db = new FakeDb();
    const teacher = await openTeacher(browser, db);
    const pupil = await openPupil(browser, db, teacher.pin, "Eli");
    db.faults.wb_list_host_state = { lag: [700, 900], drop: 0 };
    await teacher.page.waitForTimeout(1500);
    await teacher.page.evaluate(() => {
      window.__lockTexts = [];
      const obs = new MutationObserver(() => {
        const b = document.getElementById("btnLock");
        if (b && window.__lockTexts[window.__lockTexts.length - 1] !== b.textContent) window.__lockTexts.push(b.textContent);
      });
      obs.observe(document.querySelector(".top"), { subtree: true, childList: true, characterData: true });
    });
    await db.nextRead("wb_list_host_state");
    await teacher.page.locator("#btnLock").click();
    await teacher.page.waitForTimeout(3500);
    const texts = await teacher.page.evaluate(() => window.__lockTexts);
    expect(texts).toEqual(["Unlock"]);
    await pupil.context.close();
    await teacher.context.close();
  });

  test("wiping doesn't flash the old answers back on the wall", async ({ browser }) => {
    const db = new FakeDb();
    const teacher = await openTeacher(browser, db);
    const pupil = await openPupil(browser, db, teacher.pin, "Fin");
    await drawLine(pupil, 0.1, 0.3, 0.9, 0.3);
    await waitFor(() => db.inkOf("Fin") === 1);
    await expect(teacher.page.locator(".tile-board.answered")).toHaveCount(1, { timeout: 5000 });
    db.faults.wb_list_host_state = { lag: [800, 1000], drop: 0 };
    await teacher.page.evaluate(() => {
      window.__answeredSeen = 0;
      const obs = new MutationObserver(() => {
        window.__answeredSeen = Math.max(window.__answeredSeen, document.querySelectorAll(".tile-board.answered").length);
      });
      obs.observe(document.getElementById("hostWall"), { subtree: true, attributes: true, childList: true });
    });
    // Make the next check carry the old answer: wait until it has read the board, then wipe
    teacher.page.once("dialog", (d) => d.accept());
    await db.nextRead("wb_list_host_state");
    await teacher.page.locator("#btnWipe").click();
    await waitFor(() => db.session.round === 2);
    await teacher.page.waitForTimeout(100);
    await teacher.page.evaluate(() => { window.__answeredSeen = 0; });
    await teacher.page.waitForTimeout(3000);
    expect(await teacher.page.evaluate(() => window.__answeredSeen)).toBe(0);
    await pupil.context.close();
    await teacher.context.close();
  });

  test("a launch straight after the page opens isn't thrown away", async ({ browser }) => {
    const db = new FakeDb();
    // The sign-in check answers after the page's own script has started, as on a cached school laptop
    db.faults["/rest/v1/allowed_emails:GET"] = { lag: [500, 600], drop: 0 };
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await wire(context, db);
    await context.addInitScript(([key, session]) => {
      localStorage.setItem(key, JSON.stringify(session));
      window.addEventListener("auth-guard-ready", () => { window.__authAt = performance.now(); });
    }, [STORAGE_KEY, fakeSession()]);
    const page = await context.newPage();
    await page.goto("/toolkit/whiteboard.html");
    await page.locator("#btnLaunch").waitFor();
    const authAt = await page.evaluate(() => window.__authAt || 0);
    expect(authAt, "sign-in check finished well before the 2.5 s fallback").toBeLessThan(2000);
    await page.locator("#btnLaunch").click();
    await page.locator("#hostPin").waitFor();
    const launchedAt = await page.evaluate(() => performance.now());
    expect(launchedAt, "launched before the 2.5 s fallback fires").toBeLessThan(2300);
    await page.waitForTimeout(3000); // past the 2.5 s auth fallback
    await expect(page.locator("#hostPin")).toBeVisible();
    const teacher = { context };
    await teacher.context.close();
  });

  test("a full class on patchy wifi: every board reaches the wall", async ({ browser }) => {
    const db = new FakeDb();
    const teacher = await openTeacher(browser, db);
    const N = 24;
    const pupils = [];
    for (let i = 0; i < N; i++) {
      pupils.push(await openPupil(browser, db, teacher.pin, "Pupil " + (i + 1), i % 3 ? { width: 820, height: 1180 } : { width: 390, height: 844 }));
    }
    db.faults["*"] = { lag: [80, 1400], drop: 0.12 };
    const LINES = 6;
    await Promise.all(pupils.map(async (p, i) => {
      for (let k = 0; k < LINES; k++) {
        const y = 0.1 + k * 0.13;
        await drawLine(p, 0.1, y, 0.85, y + 0.03, 8);
        await p.page.waitForTimeout(100 + ((i * 37 + k * 53) % 400));
      }
    }));
    db.faults["*"] = { lag: [40, 120], drop: 0 };
    const allIn = await waitFor(() => pupils.every((p) => db.inkOf(p.nick) === LINES), 30000);
    const missing = pupils.filter((p) => db.inkOf(p.nick) !== LINES).map((p) => p.nick + "=" + db.inkOf(p.nick));
    expect(missing, "boards missing lines on the server").toEqual([]);
    expect(allIn).toBe(true);
    await expect(teacher.page.locator(".tile-board.answered")).toHaveCount(N, { timeout: 8000 });
    await expect(teacher.page.locator("#hostInkCount")).toHaveText(String(N));
    const errors = db.log.filter((l) => /pageerror/.test(l.kind));
    expect(errors).toEqual([]);
    await Promise.all(pupils.map((p) => p.context.close()));
    await teacher.context.close();
  });
});
