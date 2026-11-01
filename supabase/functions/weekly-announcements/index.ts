/**
 * Sunday-night announcements agent.
 *
 * Reads the coming fortnight of the shared calendar and the faculty head's
 * waiting announcement notes, asks Claude to write the week's staff
 * announcements, and saves them to go live on Monday morning. Anything with a
 * missing detail ([CHECK: ...]) is saved as a draft instead, so staff never
 * see a guess. Notes that went into an announcement are marked used.
 *
 * Two ways in:
 *  - The Sunday schedule (20261101150000_announcement_agent_schedule.sql) posts
 *    {"trigger": "schedule"} with the x-agent-secret header. Every faculty head
 *    with the agent switched on gets their week written, once per week.
 *  - A signed-in faculty head posts {"preview": true} from the Announcements
 *    page. Nothing is saved; the reply shows what would be written.
 *
 * Secrets: ANTHROPIC_API_KEY, AGENT_CRON_SECRET. SUPABASE_URL,
 * SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 * Deploy with JWT verification off; the function checks callers itself.
 */
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const MODEL = "claude-opus-5-5";
const TZ = "Europe/London";
const FACULTY = "the Faculty of Art & Drama (Art & Design, Drama and Photography) at Knightswood Secondary School in Glasgow";
const TONES: Record<string, string> = {
  friendly: "warm and friendly, but still professional",
  formal: "formal and professional",
  brief: "short and direct, with no more than two sentences of body text",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Settings = { owner_id: string; publish_time: string; tone: string };
type CalendarEvent = { id: string; title: string; date: string; category: string | null; description: string | null };
type Note = { id: string; body: string; mention_from: string | null; created_at: string };
type Written = {
  title: string;
  body: string;
  prominence: "standard" | "priority" | "reminder";
  take_down_after: string;
  check: string[];
  note_ids: string[];
};
type AgentReply = { summary: string; announcements: Written[]; notes_left: { note_id: string; reason: string }[] };

// ---- Dates (all in UK time) -------------------------------------------------

function londonParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function londonToday(now = new Date()): string {
  const p = londonParts(now);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday after the given day (tomorrow when run on a Sunday). */
function nextMonday(ymd: string): string {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return addDays(ymd, ((8 - dow) % 7) || 7);
}

/** A UK wall-clock time on a given day, as a UTC timestamp. */
function londonToUtcIso(ymd: string, hhmm: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = londonParts(new Date(guess));
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - guess;
  return new Date(guess - offset).toISOString();
}

function dayLabel(ymd: string, withYear = false): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}),
  });
}

// ---- Body formatting ------------------------------------------------------
// The same small Markdown subset as announcement-ai-import.js, turned into the
// HTML the announcement editor stores.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return s;
}

function markdownToHtml(md: string): string {
  return md.replace(/\r/g, "").trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const out: string[] = [];
    let para: string[] = [];
    const flush = () => {
      if (para.length) out.push(`<p>${para.join("<br>")}</p>`);
      para = [];
    };
    for (const line of lines) {
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flush();
        out.push(h[1].length <= 2 ? `<h2>${inline(h[2])}</h2>` : `<h3>${inline(h[2])}</h3>`);
        continue;
      }
      const li = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      para.push(li ? `• ${inline(li[1])}` : inline(line));
    }
    flush();
    return out.join("");
  }).join("");
}

function plainText(html: string | null): string {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// ---- Asking Claude ----------------------------------------------------------

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "announcements", "notes_left"],
  properties: {
    summary: { type: "string" },
    announcements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "prominence", "take_down_after", "check", "note_ids"],
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          prominence: { type: "string", enum: ["standard", "priority", "reminder"] },
          take_down_after: { type: "string" },
          check: { type: "array", items: { type: "string" } },
          note_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
    notes_left: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["note_id", "reason"],
        properties: { note_id: { type: "string" }, reason: { type: "string" } },
      },
    },
  },
};

function systemPrompt(tone: string): string {
  return [
    `You write the weekly staff announcements for ${FACULTY}. They appear on the Faculty Hub home page on Monday morning, in the faculty head's voice, for faculty staff.`,
    "",
    "You get the school calendar for the coming fortnight, the faculty head's notes, and the announcements staff can already see.",
    "",
    "How to write them:",
    "- Start with one \"Week ahead\" announcement covering this week's calendar: each day that has something on, in date order, with what is happening. Leave out days with nothing on. If next week has a deadline or event staff need to prepare for, end with a short \"Coming up\" line. If nothing is on the calendar this week, leave the Week ahead announcement out.",
    "- Write a separate announcement for each separate piece of news in the notes. Combine notes only when they are about the same thing. Leave a note out if it is not something staff need to hear (a private reminder, or already covered by an announcement staff can see), and say why in notes_left.",
    "- Do not repeat an announcement staff can already see unless a note says something has changed.",
    `- UK English. The tone should be ${TONES[tone] || TONES.friendly}. Titles are 80 characters or fewer and make sense on their own. Body: short paragraphs, key detail first (what, when, where, what staff need to do).`,
    "- Use only facts from the calendar and the notes. Never invent a time, room or deadline. If an announcement needs a detail that is missing, write [CHECK: what is missing] in the text and add it to check.",
    "- Never include pupils' names or other personal details about pupils, even if a note contains them. Write around them and add a line to check saying so.",
    "- Body formatting allowed: **bold**, *italic*, ## Heading, ### Subheading, lists with \"- \", and links as [text](https://...). Nothing else.",
    "- prominence: \"priority\" only for urgent or must-read items, \"reminder\" for low-key nudges, otherwise \"standard\". The Week ahead announcement is \"standard\".",
    "- take_down_after: the last day the announcement is useful (the event or deadline day; the Friday of this week for Week ahead) as YYYY-MM-DD, or an empty string if there is none.",
    "- note_ids: the ids of the notes each announcement came from. Every note must appear either in an announcement's note_ids or in notes_left.",
    "- summary: one or two plain sentences telling the faculty head what you wrote and anything they should check.",
  ].join("\n");
}

function userPrompt(input: {
  today: string; weekOf: string; publishTime: string; events: CalendarEvent[]; notes: Note[];
  showing: { title: string; until: string; text: string }[];
}): string {
  const { today, weekOf, publishTime, events, notes, showing } = input;
  const lines: string[] = [
    `Today is ${dayLabel(today, true)}. These announcements go live on ${dayLabel(weekOf, true)} at ${publishTime}. "This week" is ${dayLabel(weekOf)} to ${dayLabel(addDays(weekOf, 4))}; "next week" starts ${dayLabel(addDays(weekOf, 7))}.`,
    "",
    `School calendar, ${weekOf} to ${addDays(weekOf, 13)}:`,
  ];
  if (events.length) {
    for (const e of events) {
      const desc = e.description ? ` - ${e.description}` : "";
      lines.push(`- ${e.date} (${dayLabel(e.date).split(" ")[0]}): ${e.title}${e.category ? ` [${e.category}]` : ""}${desc}`);
    }
  } else {
    lines.push("- Nothing on the calendar.");
  }
  lines.push("", "My notes:");
  if (notes.length) {
    for (const n of notes) {
      const from = n.mention_from ? `, not before ${n.mention_from}` : "";
      lines.push(`- [id: ${n.id}] (written ${n.created_at.slice(0, 10)}${from})`, `  ${n.body.replace(/\n/g, "\n  ")}`);
    }
  } else {
    lines.push("- No notes this week.");
  }
  lines.push("", "Announcements staff can already see (live, or scheduled before Monday's go):");
  if (showing.length) {
    for (const a of showing) lines.push(`- "${a.title}"${a.until ? ` (until ${a.until})` : ""}: ${a.text}`);
  } else {
    lines.push("- None.");
  }
  return lines.join("\n");
}

async function askClaude(system: string, user: string): Promise<AgentReply> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("The ANTHROPIC_API_KEY secret is not set on the weekly-announcements function.");
  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: REPLY_SCHEMA } },
      system,
      messages: [{ role: "user", content: user }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("The Anthropic API key is missing or wrong. Check the ANTHROPIC_API_KEY secret.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Claude is busy (rate limited). The 7pm run will try again.");
    if (err instanceof Anthropic.APIError) throw new Error(`Claude returned an error (${err.status}): ${err.message}`);
    throw err;
  }
  if (response.stop_reason === "refusal") throw new Error("Claude declined to write this week's announcements.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude's reply was cut off before it finished.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude's reply had no announcements in it.");
  return JSON.parse(text.text) as AgentReply;
}

// ---- One faculty head's week ----------------------------------------------

type Planned = Written & { html: string; status: "scheduled" | "draft"; note_ids: string[] };

async function gather(db: SupabaseClient, ownerId: string, today: string, weekOf: string, publishAt: string) {
  const [eventsRes, notesRes, annRes] = await Promise.all([
    db.from("shared_calendar_events").select("id, title, date, category, description")
      .gte("date", weekOf).lte("date", addDays(weekOf, 13)).order("date"),
    db.from("announcement_notes").select("id, body, mention_from, created_at")
      .eq("owner_id", ownerId).is("used_at", null).order("created_at"),
    db.from("announcements").select("*").order("created_at", { ascending: false }).limit(60),
  ]);
  if (eventsRes.error) throw new Error(`Could not read the calendar: ${eventsRes.error.message}`);
  if (notesRes.error) throw new Error(`Could not read your notes: ${notesRes.error.message}`);
  if (annRes.error) throw new Error(`Could not read current announcements: ${annRes.error.message}`);

  // Notes held back with "not before" join in the week they're due.
  const friday = addDays(weekOf, 4);
  const notes = (notesRes.data as Note[]).filter((n) => !n.mention_from || n.mention_from <= friday);
  const goLive = Date.parse(publishAt);
  // deno-lint-ignore no-explicit-any
  const showing = (annRes.data as any[]).filter((a) => {
    if (a.status === "draft") return false;
    const until = a.expires_at ? String(a.expires_at).slice(0, 10) : "";
    if (until && until < today) return false;
    const from = a.publish_at ? Date.parse(a.publish_at) : 0;
    return !from || from <= goLive;
  }).slice(0, 25).map((a) => ({
    title: String(a.title || ""),
    until: a.expires_at ? String(a.expires_at).slice(0, 10) : "",
    text: plainText(a.body).slice(0, 240),
  }));
  return { events: eventsRes.data as CalendarEvent[], notes, showing };
}

function plan(reply: AgentReply, notes: Note[]): Planned[] {
  const known = new Set(notes.map((n) => n.id));
  return (reply.announcements || []).filter((a) => a.title && a.title.trim()).map((a) => {
    const check = (a.check || []).filter((c) => c && c.trim());
    const needsCheck = check.length > 0 || /\[CHECK/i.test(`${a.title} ${a.body}`);
    const takeDown = /^\d{4}-\d{2}-\d{2}$/.test(a.take_down_after || "") ? a.take_down_after : "";
    return {
      ...a,
      title: a.title.trim().slice(0, 160),
      check,
      take_down_after: takeDown,
      note_ids: (a.note_ids || []).filter((id) => known.has(id)),
      html: markdownToHtml(a.body || ""),
      status: needsCheck ? "draft" : "scheduled",
    };
  });
}

const PRIORITY = { standard: "none", priority: "high", reminder: "low" } as const;

export async function runWeek(db: SupabaseClient, settings: Settings, opts: { preview: boolean; now?: Date }) {
  const today = londonToday(opts.now);
  const weekOf = nextMonday(today);
  const publishTime = String(settings.publish_time || "07:30").slice(0, 5);
  const publishAt = londonToUtcIso(weekOf, publishTime);

  let runId: string | null = null;
  if (!opts.preview) {
    const claim = await db.from("announcement_agent_runs")
      .insert({ owner_id: settings.owner_id, week_of: weekOf, status: "running" }).select("id").single();
    if (claim.error) {
      if (claim.error.code === "23505") return { weekOf, skipped: true, summary: "This week has already been written." };
      throw new Error(`Could not start the run: ${claim.error.message}`);
    }
    runId = claim.data.id;
  }

  try {
    const { events, notes, showing } = await gather(db, settings.owner_id, today, weekOf, publishAt);
    const thisWeek = events.filter((e) => e.date <= addDays(weekOf, 6));
    let reply: AgentReply;
    if (!thisWeek.length && !notes.length) {
      reply = { summary: "Nothing on the calendar this week and no notes waiting, so there were no announcements to write.", announcements: [], notes_left: [] };
    } else {
      reply = await askClaude(
        systemPrompt(settings.tone),
        userPrompt({ today, weekOf, publishTime, events, notes, showing }),
      );
    }
    const planned = plan(reply, notes);
    const notesLeft = (reply.notes_left || []).filter((n) => notes.some((x) => x.id === n.note_id));

    if (opts.preview) {
      return {
        weekOf, publishAt, preview: true, summary: reply.summary,
        announcements: planned.map((a) => ({
          title: a.title, html: a.html, prominence: a.prominence, takeDownAfter: a.take_down_after,
          check: a.check, status: a.status, noteIds: a.note_ids,
        })),
        notesLeft,
        noteCount: notes.length,
        eventCount: thisWeek.length,
      };
    }

    const ids: string[] = [];
    const byNote = new Map<string, string[]>();
    for (const a of planned) {
      const ins = await db.from("announcements").insert({
        title: a.title,
        body: a.html || null,
        priority: PRIORITY[a.prominence] || "none",
        expires_at: a.take_down_after || null,
        status: a.status === "draft" ? "draft" : "published",
        publish_at: publishAt,
      }).select("id").single();
      if (ins.error) throw new Error(`Could not save "${a.title}": ${ins.error.message}`);
      ids.push(ins.data.id);
      for (const n of a.note_ids) byNote.set(n, [...(byNote.get(n) || []), ins.data.id]);
    }
    const usedAt = new Date().toISOString();
    for (const [noteId, annIds] of byNote) {
      const upd = await db.from("announcement_notes").update({ used_at: usedAt, used_in: annIds })
        .eq("id", noteId).eq("owner_id", settings.owner_id);
      if (upd.error) throw new Error(`Saved the announcements but could not tick off your notes: ${upd.error.message}`);
    }
    const scheduled = planned.filter((a) => a.status === "scheduled").length;
    const result = {
      status: "done",
      summary: reply.summary,
      scheduled_count: scheduled,
      draft_count: planned.length - scheduled,
      announcement_ids: ids,
      note_ids: [...byNote.keys()],
      finished_at: new Date().toISOString(),
    };
    await db.from("announcement_agent_runs").update(result).eq("id", runId);
    return { weekOf, publishAt, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await db.from("announcement_agent_runs")
        .update({ status: "error", error: message, finished_at: new Date().toISOString() }).eq("id", runId);
    }
    throw err;
  }
}

// ---- Entry point ----------------------------------------------------------

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));

  try {
    // The Sunday schedule: everyone who has switched the agent on.
    const secret = Deno.env.get("AGENT_CRON_SECRET");
    const given = req.headers.get("x-agent-secret");
    if (given !== null) {
      if (!secret || given !== secret) return reply({ error: "Not allowed." }, 401);
      const { data, error } = await admin.from("announcement_agent_settings")
        .select("owner_id, publish_time, tone").eq("enabled", true);
      if (error) throw new Error(`Could not read agent settings: ${error.message}`);
      const results = [];
      for (const s of (data || []) as Settings[]) {
        try {
          results.push({ owner: s.owner_id, ...(await runWeek(admin, s, { preview: false })) });
        } catch (err) {
          results.push({ owner: s.owner_id, error: err instanceof Error ? err.message : String(err) });
        }
      }
      return reply({ results });
    }

    // A faculty head previewing from the Announcements page.
    const auth = req.headers.get("Authorization") || "";
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await asUser.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user) return reply({ error: "Sign in to the Faculty Hub to preview announcements." }, 401);
    const { data: isManager } = await asUser.rpc("is_school_manager");
    if (!isManager) return reply({ error: "Only faculty heads can use the announcements agent." }, 403);
    if (!body.preview) return reply({ error: "From the hub you can only preview. The real run happens on Sunday evening." }, 400);

    const { data: saved } = await admin.from("announcement_agent_settings")
      .select("owner_id, publish_time, tone").eq("owner_id", user.id).maybeSingle();
    const settings: Settings = {
      owner_id: user.id,
      publish_time: /^\d{2}:\d{2}/.test(body.publish_time || "") ? body.publish_time : (saved?.publish_time || "07:30"),
      tone: TONES[body.tone] ? body.tone : (saved?.tone || "friendly"),
    };
    return reply(await runWeek(admin, settings, { preview: true }));
  } catch (err) {
    console.error(err);
    return reply({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

Deno.serve(handle);
