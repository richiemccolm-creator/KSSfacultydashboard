#!/usr/bin/env python3
"""Generate N5 CI Unit 1 lesson slide HTML files (sessions 1–10)."""
from __future__ import annotations
import html
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIT = 1
UCLASS = f"u{UNIT}"

FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=Bebas+Neue&family=Barlow:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&"
    "family=Barlow+Condensed:wght@300;400;600;700;800&family=JetBrains+Mono:wght@300;400;700&display=swap"
)


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def br_text(s: str) -> str:
    return esc(s).replace("\n", "<br>")


def slide_title(title: str, subtitle: str, bg: str = "INTRO", sid: str = "s01") -> str:
    return f"""
<div class="slide {UCLASS} slide-title" id="{sid}-title">
  <div class="grid-bg"></div>
  <div class="{UCLASS}-stripe"></div>
  <div class="{UCLASS}-num">{UNIT}</div>
  <div class="bg-text">{esc(bg)}</div>
  <div class="coords tl">UNIT 0{UNIT} / SESSION</div>
  <div class="coords tr">KNIGHTSWOOD · N5 CREATIVE INDUSTRIES</div>
  <div class="unit-badge unit-tag">UNIT 0{UNIT} / INTRODUCTION TO THE CREATIVE INDUSTRIES</div>
  <div class="main-q glitch glitch-entry" data-text="{esc(title)}">{br_text(title)}</div>
  <div class="tag-line">{esc(subtitle)} · 100 MINUTES · J17V 75</div>
  <div class="bottom-bar"></div>
</div>"""


def slide_li_sc(li: str, sc: list[str], sid: str) -> str:
    items = "".join(f"<li>{esc(s)}</li>" for s in sc)
    return f"""
<div class="slide {UCLASS} slide-content compact" id="{sid}-lisc">
  <div class="grid-bg"></div>
  <div class="coords tl">UNIT 0{UNIT} / LEARNING INTENT</div>
  <div class="label">Learning intention &amp; success criteria</div>
  <div class="li-sc-grid">
    <div class="li-sc-box">
      <div class="li-sc-head">Learning intention</div>
      <div class="li-sc-body">{esc(li)}</div>
    </div>
    <div class="li-sc-box">
      <div class="li-sc-head">Success criteria</div>
      <ul class="sc-list">{items}</ul>
    </div>
  </div>
</div>"""


def slide_section(kicker: str, heading: str, body: str, sid: str, idx: int, time: str = "") -> str:
    time_html = f'<div class="time-badge">{esc(time)}</div>' if time else ""
    return f"""
<div class="slide {UCLASS} slide-section" id="{sid}-sec{idx}">
  <div class="grid-bg"></div>
  <div class="{UCLASS}-num">{UNIT}</div>
  <div class="coords tl">UNIT 0{UNIT} / {esc(kicker.upper())}</div>
  {time_html}
  <div class="label">{esc(kicker)}</div>
  <div class="section-head glitch glitch-entry" data-text="{esc(heading)}">{br_text(heading)}</div>
  <div class="body-text" style="margin-top:3vh;max-width:75vw">{esc(body)}</div>
  <div class="bottom-bar"></div>
</div>"""


def slide_task(heading: str, task: str, steps: list[tuple[str, str]], meta: str, sid: str, idx: int, time: str = "") -> str:
    steps_html = "".join(
        f'<div class="task-step reveal" data-n="{esc(n)}">{esc(text)}</div>' for n, text in steps
    )
    time_html = f'<div class="time-badge">{esc(time)}</div>' if time else ""
    return f"""
<div class="slide {UCLASS} slide-content compact" id="{sid}-task{idx}">
  <div class="grid-bg"></div>
  <div class="coords tl">UNIT 0{UNIT} / ACTIVITY</div>
  {time_html}
  <div class="label">Task</div>
  <div class="title glitch glitch-entry" data-text="{esc(heading)}">{br_text(heading)}</div>
  <div class="task-box" style="border-color:var(--u1-accent)">
    <div class="task-text">{esc(task)}</div>
    <div class="task-steps">{steps_html}</div>
  </div>
  <div class="mono-text" style="margin-top:2vh;opacity:1;color:var(--u1-accent)">{esc(meta)}</div>
</div>"""


def slide_list(heading: str, items: list[tuple[str, str, str]], sid: str, idx: int, reveal: bool = True) -> str:
    rows = ""
    for num, title, desc in items:
        cls = " reveal" if reveal else ""
        rows += f"""
    <div class="row-item{cls}">
      <div class="row-num">{esc(num)}</div>
      <div class="row-content"><div class="row-title">{esc(title)}</div><div class="row-desc">{esc(desc)}</div></div>
    </div>"""
    anim = 'style="opacity:1;animation:none"' if reveal else ""
    return f"""
<div class="slide {UCLASS} slide-content compact" id="{sid}-list{idx}">
  <div class="grid-bg"></div>
  <div class="coords tl">UNIT 0{UNIT} / CONTENT</div>
  <div class="label">{"Click to reveal each point" if reveal else "Key points"}</div>
  <div class="title glitch glitch-entry" data-text="{esc(heading)}">{br_text(heading)}</div>
  <div class="row-list" {anim}>{rows}
  </div>
</div>"""


def slide_cols(heading: str, cols: list[tuple[str, str]], sid: str, idx: int) -> str:
    boxes = "".join(
        f'<div class="col-box"><div class="col-head">{esc(h)}</div><div class="col-body">{esc(b)}</div></div>'
        for h, b in cols
    )
    return f"""
<div class="slide {UCLASS} slide-content compact" id="{sid}-col{idx}">
  <div class="grid-bg"></div>
  <div class="coords tl">UNIT 0{UNIT} / OVERVIEW</div>
  <div class="label">Overview</div>
  <div class="title glitch glitch-entry" data-text="{esc(heading)}">{br_text(heading)}</div>
  <div class="col-grid">{boxes}</div>
</div>"""


def slide_callout(heading: str, quote: str, body: str, sid: str, idx: int) -> str:
    return f"""
<div class="slide {UCLASS} slide-content" id="{sid}-call{idx}">
  <div class="grid-bg"></div>
  <div class="v-rule"></div>
  <div class="coords tl">UNIT 0{UNIT} / KEY IDEA</div>
  <div class="label" style="margin-left:6vw">{esc(heading)}</div>
  <div class="callout-box" style="margin-left:6vw;margin-top:2vh">
    <div class="callout-text">{esc(quote)}</div>
  </div>
  <div class="body-text" style="margin-left:6vw;margin-top:2vh;max-width:75vw">{esc(body)}</div>
</div>"""


def slide_teacher(evidence: str, nab: str, action: str = "", diff: str = "", sid: str = "s01") -> str:
    action_row = f'<div class="teacher-row"><strong>Assessor:</strong> {esc(action)}</div>' if action else ""
    diff_row = f'<div class="teacher-row"><strong>Differentiation:</strong> {esc(diff)}</div>' if diff else ""
    return f"""
<div class="slide {UCLASS} slide-content compact" id="{sid}-teacher">
  <div class="grid-bg"></div>
  <div class="coords tl">UNIT 0{UNIT} / EVIDENCE</div>
  <div class="label">Evidence &amp; assessment</div>
  <div class="title glitch glitch-entry" data-text="NAB &amp; FOLIO">NAB &amp;<br>FOLIO</div>
  <div class="teacher-panel">
    <div class="teacher-row"><strong>Evidence generated:</strong> {esc(evidence)}</div>
    <div class="teacher-row"><strong>NAB criteria met:</strong> {esc(nab)}</div>
    {action_row}
    {diff_row}
  </div>
</div>"""


def slide_close(prompt: str, tag: str, sid: str) -> str:
    return f"""
<div class="slide {UCLASS} slide-title" id="{sid}-close">
  <div class="grid-bg"></div>
  <div class="{UCLASS}-stripe"></div>
  <div class="bg-text">END</div>
  <div class="coords tl">UNIT 0{UNIT} / CLOSE</div>
  <div class="label" style="position:absolute;top:6vh;left:8vw">End of session</div>
  <div class="main-q glitch glitch-entry" data-text="{esc(prompt)}">{br_text(prompt)}</div>
  <div class="tag-line">{esc(tag)}</div>
  <div class="bottom-bar"></div>
</div>"""


SESSIONS = [
    {
        "num": 1,
        "title": "Course Induction + Self-Eval #1",
        "short": "Course Induction",
        "li": "Understand what the course involves, what the year looks like, and establish a baseline for your own employability skills.",
        "sc": [
            "I can explain how the N5 Creative Industries course is structured across four units.",
            "I can describe how I am assessed (folio + NABs, no exam).",
            "I understand what a folio is and how to organise evidence from today.",
            "I have completed Self-Evaluation #1 honestly as my baseline (O3 Review 1).",
        ],
        "slides": lambda s: [
            slide_title("Course Induction\n+ Self-Eval #1", "Session 01 · Fri 15 Aug", "START", s),
            slide_li_sc(
                "Understand what the course involves, what the year looks like, and establish a baseline for your own employability skills.",
                [
                    "I can explain how the N5 Creative Industries course is structured across four units.",
                    "I can describe how I am assessed (folio + NABs, no exam).",
                    "I understand what a folio is and how to organise evidence from today.",
                    "I have completed Self-Evaluation #1 honestly as my baseline (O3 Review 1).",
                ],
                s,
            ),
            slide_task(
                "Welcome & icebreaker",
                "Introduce yourself and name one creative thing you do, watch, make or listen to.",
                [
                    ("01 /", "No wrong answers — creativity is already part of your life."),
                    ("02 /", "Listen to others and notice how wide \"creative\" really is."),
                ],
                "Pairs or whole class · 15 minutes",
                s,
                1,
                "0–15 MIN",
            ),
            slide_cols(
                "Your year at a glance",
                [
                    ("U1", "Introduction — sectors, employment, employability (Aug–Oct)"),
                    ("U2", "Skills Development — practical skills for your job role (Sep–Oct)"),
                    ("U3", "Go Viral Challenge — creative process & social media brand (Oct–Dec)"),
                    ("U4", "Creative Project — team capstone project (Jan–Feb)"),
                ],
                s,
                1,
            ),
            slide_section(
                "Course overview",
                "Assessment &\nthe Go Viral teaser",
                "Walk through the four units and the year Gantt chart. Assessment: no exam — folio evidence + NABs in open-book windows. Tease the Go Viral challenge in term 2. Get excited about what's coming.",
                s,
                1,
                "15–35 MIN",
            ),
            slide_section(
                "Discussion",
                "What IS the\nCreative Industries?",
                "Open class discussion. What do they think it includes? Collect on the board. Surface assumptions and gaps — don't correct yet. Keep it lively and challenge narrow thinking gently.",
                s,
                2,
                "35–55 MIN",
            ),
            slide_task(
                "Folio introduction",
                "Everything you produce from this point is potential NAB evidence.",
                [
                    ("01 /", "Set up folio folders — physical or digital."),
                    ("02 /", "Model what a completed, well-organised folio entry looks like."),
                    ("03 /", "Date and label all work from today onwards."),
                ],
                "Teacher models organisation · 15 minutes",
                s,
                2,
                "55–70 MIN",
            ),
            slide_task(
                "Employability Self-Evaluation #1",
                "Complete the self-evaluation form honestly — this is your baseline.",
                [
                    ("01 /", "There is no right or wrong at this stage."),
                    ("02 /", "Read each skill carefully — do not rush."),
                    ("03 /", "Peer feedback not required on Review 1."),
                    ("04 /", "Teacher countersigns before end of session."),
                ],
                "NAB O3 Review 1 of 3 · 30 minutes",
                s,
                3,
                "70–100 MIN",
            ),
            slide_teacher(
                "Self-Eval #1 → NAB O3 Review 1 of 3",
                "O3 — first review completed, signed, countersigned",
                "Countersign all self-eval forms before end of session. Note baseline observations for future comparison.",
                "Learners who struggle with written self-eval can complete verbally with teacher scribing, or use a simplified rating scale.",
                s,
            ),
            slide_close(
                "What is one creative skill\nyou want to develop\nthis year?",
                "Exit ticket — one thing you are looking forward to on this course",
                s,
            ),
        ],
    },
    {
        "num": 2,
        "title": "Marketplace Activity — Exploring the Sectors",
        "short": "Marketplace",
        "li": "Explore the range of sectors within the Creative Industries through independent, self-directed research.",
        "sc": [
            "I can name sectors I had not previously considered part of the Creative Industries.",
            "I can describe what a sector does and who works in it.",
            "I can record one thing that surprised me from my research.",
            "My recording sheet and folio reflection are dated and labelled for O1 PC(a).",
        ],
        "slides": lambda s: [
            slide_title("Marketplace Activity\nExploring the Sectors", "Session 02 · Tue 19 Aug", "SECTORS", s),
            slide_li_sc(
                "Explore the range of sectors within the Creative Industries through independent, self-directed research.",
                [
                    "I can name sectors I had not previously considered part of the Creative Industries.",
                    "I can describe what a sector does and who works in it.",
                    "I can record one thing that surprised me from my research.",
                    "My recording sheet and folio reflection are dated and labelled for O1 PC(a).",
                ],
                s,
            ),
            slide_task(
                "Setup & briefing",
                "QR code sector stations around the room — this is research, not a race.",
                [
                    ("01 /", "Each station covers a different Creative Industries sector."),
                    ("02 /", "Recording sheet prompts: what does this sector do? Who works in it? What surprised you?"),
                    ("03 /", "Encourage depth over speed."),
                ],
                "5 minutes",
                s,
                1,
                "0–5 MIN",
            ),
            slide_list(
                "While you research — teacher prompts",
                [
                    ("?", "Tell me something interesting about that sector.", "Circulate and challenge thinking."),
                    ("?", "What surprised you there?", "Push beyond surface answers."),
                    ("?", "Why is this sector bigger than people expect?", "Connect to economic scale."),
                ],
                s,
                1,
            ),
            slide_section(
                "Marketplace rotation",
                "Independent\nsector research",
                "Learners move freely around stations at their own pace, scanning QR codes and completing recording sheets. 50 minutes of intentional research time.",
                s,
                1,
                "5–55 MIN",
            ),
            slide_section(
                "Class debrief",
                "Share your\ndiscoveries",
                "Each learner names one sector they hadn't thought of as Creative Industries, and one thing that surprised them. Teacher draws out connections between sectors.",
                s,
                2,
                "55–75 MIN",
            ),
            slide_task(
                "Folio reflection",
                "Write a short paragraph in your folio.",
                [
                    ("01 /", "Which sector interests you most, and why?"),
                    ("02 /", "What do you still want to find out?"),
                    ("03 /", "Add recording sheet to folio — dated and labelled."),
                ],
                "Seeds sector choice conversations in weeks 3–4 · 25 minutes",
                s,
                2,
                "75–100 MIN",
            ),
            slide_teacher(
                "Marketplace recording sheet + folio reflection → NAB O1 PC(a)",
                "O1 PC(a) — range of Creative Industries sectors identified and explored",
                "",
                "",
                s,
            ),
            slide_close(
                "Which sector will you\ninvestigate further\nand why?",
                "Homework: note one question you still have about your favourite sector",
                s,
            ),
        ],
    },
    {
        "num": 3,
        "title": "Structure, Scale & Sectors Deep Dive",
        "short": "Sectors Deep Dive",
        "li": "Understand the structure, scale and economic significance of the Creative Industries. Understand how sectors connect and overlap.",
        "sc": [
            "I can explain the economic scale of the Creative Industries.",
            "I can sort job roles into sectors and defend tricky choices.",
            "I can explain why sector boundaries are not always clean.",
            "I have a written sector shortlist of two or three options in my folio.",
        ],
        "slides": lambda s: [
            slide_title("Structure, Scale &\nSectors Deep Dive", "Session 03 · Wed 20 Aug", "SCALE", s),
            slide_li_sc(
                "Understand the structure, scale and economic significance of the Creative Industries. Understand how sectors connect and overlap.",
                [
                    "I can explain the economic scale of the Creative Industries.",
                    "I can sort job roles into sectors and defend tricky choices.",
                    "I can explain why sector boundaries are not always clean.",
                    "I have a written sector shortlist of two or three options in my folio.",
                ],
                s,
            ),
            slide_section(
                "Starter",
                "Which sector\ngrabbed you?",
                "Which sector grabbed you most in the marketplace and why? Pair discussion then share out. Teacher picks up interesting choices and challenges assumptions gently.",
                s,
                1,
                "0–10 MIN",
            ),
            slide_list(
                "Structure & scale — key ideas",
                [
                    ("01", "Economic contribution", "Creative Industries as a major UK economic sector — GDP, workforce size."),
                    ("02", "Interconnection", "Sectors overlap — e.g. a film production draws on music, design, drama, technical theatre, media."),
                    ("03", "Real examples", "Use current productions learners will recognise."),
                ],
                s,
                1,
            ),
            slide_section(
                "Teacher input",
                "Structure &\nscale",
                "The Creative Industries as an economic sector. Use a real current example learners will recognise. Keep it relevant and challenge narrow definitions.",
                s,
                2,
                "10–35 MIN",
            ),
            slide_list(
                "Sector card sort — tricky roles",
                [
                    ("?", "Music supervisor — Netflix series", "Music or Media? Defend your choice."),
                    ("?", "Graphic novel illustrator", "Art & Design or Media?"),
                    ("?", "Stage manager", "Drama or Technical Theatre?"),
                ],
                s,
                2,
            ),
            slide_task(
                "Sector card sort",
                "Pairs sort job title cards into sectors and present their most argued-over card.",
                [
                    ("01 /", "Agree as a pair and defend your reasoning."),
                    ("02 /", "Present one tricky card to the class."),
                ],
                "Pairs · 30 minutes",
                s,
                1,
                "35–65 MIN",
            ),
            slide_section(
                "Discussion",
                "Sectors\noverlap",
                "What does the card sort tell us about how the Creative Industries actually works? Is a clean sector boundary realistic? What does that mean for employment and skills?",
                s,
                3,
                "65–80 MIN",
            ),
            slide_task(
                "Sector shortlist",
                "Narrow your sector interest to two or three options — written in folio.",
                [
                    ("01 /", "Not a final decision yet."),
                    ("02 /", "Think of one legal issue and one safety issue for your shortlisted sectors before Friday."),
                ],
                "Preview: legal parameters & H&S next session · 20 minutes",
                s,
                2,
                "80–100 MIN",
            ),
            slide_teacher(
                "Card sort (observation); sector shortlist (folio)",
                "O1 PC(a) — deepened understanding of sectors and how they interconnect",
                "",
                "",
                s,
            ),
            slide_close(
                "Are sector boundaries\nhelpful or misleading\nfor your career plans?",
                "Exit ticket — one reason sectors overlap in your chosen area",
                s,
            ),
        ],
    },
    {
        "num": 4,
        "title": "Legal Parameters, Health & Safety + Agencies",
        "short": "Legal & H&S",
        "li": "Identify and describe legal parameters, H&S legislation and supporting organisations relevant to a Creative Industries sector.",
        "sc": [
            "I can describe legal parameters for my sector in sufficient detail.",
            "I can identify H&S legislation relevant to my sector.",
            "I can describe two agencies/organisations and what each does.",
            "My folio write-up is sector-specific — not generic one-liners.",
        ],
        "slides": lambda s: [
            slide_title("Legal Parameters,\nH&S + Agencies", "Session 04 · Fri 22 Aug", "LEGAL", s),
            slide_li_sc(
                "Identify and describe legal parameters, H&S legislation and supporting organisations relevant to a Creative Industries sector.",
                [
                    "I can describe legal parameters for my sector in sufficient detail.",
                    "I can identify H&S legislation relevant to my sector.",
                    "I can describe two agencies/organisations and what each does.",
                    "My folio write-up is sector-specific — not generic one-liners.",
                ],
                s,
            ),
            slide_list(
                "True or false? — discuss",
                [
                    ("T", "A photographer owns copyright in photos they take", "Discuss — generally true for original work."),
                    ("F", "H&S law doesn't apply to self-employed workers", "False — discuss responsibilities."),
                    ("?", "A band can cover any song live without permission", "Complicated — generates discussion."),
                ],
                s,
                1,
            ),
            slide_list(
                "Legal parameters — note in your own words",
                [
                    ("01", "Copyright & IP", "Music copyright, photography licensing, stage rights, design IP."),
                    ("02", "Contracts & licensing", "Sector-relevant examples throughout."),
                    ("03", "GDPR basics", "Image rights, personal data in creative work."),
                ],
                s,
                2,
            ),
            slide_section(
                "Mini-teach",
                "Legal\nparameters",
                "Copyright, intellectual property, contracts, licensing, GDPR basics. Keep sector-relevant throughout. Learners note key points in their own words.",
                s,
                1,
                "10–30 MIN",
            ),
            slide_list(
                "Health & Safety — sector examples",
                [
                    ("01", "COSHH & manual handling", "Studios, workshops, sets."),
                    ("02", "Lone working & noise", "Location filming, live events."),
                    ("03", "Risk assessment", "Stage rigging, working at height in technical theatre."),
                ],
                s,
                3,
            ),
            slide_section(
                "Mini-teach",
                "Health &\nSafety",
                "COSHH, manual handling, lone working, noise regulations, risk assessment. Sector-specific examples. Learners note key points.",
                s,
                2,
                "30–50 MIN",
            ),
            slide_list(
                "Agencies & organisations",
                [
                    ("01", "Creative Scotland / Screen Scotland", "Funding, development, industry support."),
                    ("02", "Equity / Musicians' Union / BECTU", "Trade unions for creative workers."),
                    ("03", "Design Council", "Design sector promotion and resources."),
                ],
                s,
                4,
            ),
            slide_task(
                "Research two organisations",
                "Find two organisations specifically relevant to your shortlisted sector.",
                [
                    ("01 /", "Who are they and what do they do?"),
                    ("02 /", "Who do they support?"),
                ],
                "Devices · 20 minutes",
                s,
                1,
                "50–70 MIN",
            ),
            slide_task(
                "Written evidence — folio",
                "Complete all three sections with enough detail to show understanding.",
                [
                    ("01 /", "Legal parameters for your chosen sector."),
                    ("02 /", "H&S legislation with sector-specific relevance."),
                    ("03 /", "Two agencies with clear descriptions of what each does."),
                ],
                "Finish incomplete work Tuesday · NAB O1 PC(b)(c)(d) · 30 minutes",
                s,
                2,
                "70–100 MIN",
            ),
            slide_teacher(
                "Written legal, H&S and agencies notes → NAB O1 PC(b)(c)(d)",
                "O1 PC(b) legal; O1 PC(c) H&S; O1 PC(d) agencies",
                "Check written responses meet required depth — a single sentence per point is not sufficient.",
                "",
                s,
            ),
            slide_close(
                "What is the most\nimportant legal or\nsafety issue in your sector?",
                "Exit ticket — one agency you will use in future research",
                s,
            ),
        ],
    },
    {
        "num": 5,
        "title": "O1 Completion + Sector Confirmed + O2 Launch",
        "short": "O2 Launch",
        "li": "Complete and sign off all Outcome 1 evidence. Confirm chosen sector. Launch Outcome 2 investigation.",
        "sc": [
            "All O1 evidence is complete and peer-reviewed.",
            "I have confirmed my chosen sector with my teacher.",
            "I understand what Outcome 2 requires.",
            "I have documented at least one employment opportunity in my sector.",
        ],
        "slides": lambda s: [
            slide_title("O1 Completion +\nO2 Launch", "Session 05 · Tue 26 Aug", "O2", s),
            slide_li_sc(
                "Complete and sign off all Outcome 1 evidence. Confirm chosen sector. Launch Outcome 2 investigation.",
                [
                    "All O1 evidence is complete and peer-reviewed.",
                    "I have confirmed my chosen sector with my teacher.",
                    "I understand what Outcome 2 requires.",
                    "I have documented at least one employment opportunity in my sector.",
                ],
                s,
            ),
            slide_task(
                "O1 catch-up & peer review",
                "Complete any unfinished legal/H&S/agencies write-up. Peer-review a partner's work.",
                [
                    ("01 /", "Is there enough detail? Is H&S sector-specific?"),
                    ("02 /", "Are both agencies described clearly?"),
                    ("03 /", "Add a written peer comment."),
                ],
                "20 minutes",
                s,
                1,
                "0–20 MIN",
            ),
            slide_callout(
                "Sector choice",
                "Confirm your sector — is this where your interests genuinely lie?",
                "Teacher one-to-one conversations: employment opportunities in this sector? What do you want to do within it eventually? Teacher notes each learner's choice.",
                s,
                1,
            ),
            slide_list(
                "Outcome 2 — what you need",
                [
                    ("a", "Four employment opportunities + two freelance issues", ""),
                    ("b", "Three job roles with career paths", ""),
                    ("c", "One focus job role in depth", ""),
                    ("d", "Present findings — report, blog, podcast, presentation…", ""),
                ],
                s,
                1,
            ),
            slide_section(
                "O2 introduction",
                "Launch Outcome 2",
                "Walk through all O2 requirements. Clarify format options. Learners begin planning their approach.",
                s,
                1,
                "40–60 MIN",
            ),
            slide_section(
                "Real job ad",
                "Employability skills\nin the real world",
                "Walk through a real Creative Industries job ad. What does \"proficient in Adobe Creative Suite\" mean? What does \"strong interpersonal skills\" look like day to day? Which skills do you already have?",
                s,
                2,
                "60–80 MIN",
            ),
            slide_task(
                "Begin O2 research",
                "Start researching employment opportunities in your confirmed sector.",
                [
                    ("01 /", "Use the structured template provided."),
                    ("02 /", "Document at least one employment opportunity before end of session."),
                ],
                "Individual research · 20 minutes",
                s,
                2,
                "80–100 MIN",
            ),
            slide_teacher(
                "O1 all PCs completed and peer-reviewed; O2 PC(a) research started",
                "O1 — full completion; O2 PC(a) begins",
                "",
                "",
                s,
            ),
            slide_close(
                "What employment\nopportunity surprised\nyou most today?",
                "Continue O2 research — aim for four opportunities next session",
                s,
            ),
        ],
    },
    {
        "num": 6,
        "title": "Employment Opportunities + Freelance Issues",
        "short": "Employment Research",
        "li": "Fully investigate and document employment opportunities and freelance/self-employed issues within chosen sector.",
        "sc": [
            "I have documented at least four employment opportunities with day-to-day detail.",
            "I have identified employed/freelance status and rough salary or day rates.",
            "I have described two sector-specific freelance/self-employed issues.",
            "I can name one opportunity that genuinely surprised me.",
        ],
        "slides": lambda s: [
            slide_title("Employment +\nFreelance Issues", "Session 06 · Wed 27 Aug", "WORK", s),
            slide_li_sc(
                "Fully investigate and document employment opportunities and freelance/self-employed issues within chosen sector.",
                [
                    "I have documented at least four employment opportunities with day-to-day detail.",
                    "I have identified employed/freelance status and rough salary or day rates.",
                    "I have described two sector-specific freelance/self-employed issues.",
                    "I can name one opportunity that genuinely surprised me.",
                ],
                s,
            ),
            slide_section(
                "Starter",
                "The freelance\nreality",
                "Quick poll — employed or freelance in your sector? Reveal the reality. Why does this matter? What does it change about how you approach your career?",
                s,
                1,
                "0–10 MIN",
            ),
            slide_list(
                "Employment template — for each role",
                [
                    ("01", "Job title", "Specific role name in your sector."),
                    ("02", "Day to day", "What does it actually involve?"),
                    ("03", "Status", "Employed / freelance / both?"),
                    ("04", "Pay", "Rough salary or day rate range."),
                ],
                s,
                1,
            ),
            slide_section(
                "Research time",
                "Four employment\nopportunities",
                "Document at least four opportunities. Teacher pushes for specificity — challenge vague descriptions. Finish early? Add a fifth or sixth for stronger evidence.",
                s,
                2,
                "10–70 MIN",
            ),
            slide_task(
                "Freelance & self-employed issues",
                "Identify two significant issues facing freelance workers in your sector.",
                [
                    ("01 /", "Must be sector-specific — not generic statements."),
                    ("02 /", "Example: irregular bookings, no sick pay, own equipment costs."),
                ],
                "Written in folio · 20 minutes",
                s,
                1,
                "70–90 MIN",
            ),
            slide_section(
                "Share out",
                "One surprise\neach",
                "Each learner names one employment opportunity that genuinely surprised them. Quick round the room — builds awareness of breadth in each sector.",
                s,
                3,
                "90–100 MIN",
            ),
            slide_teacher(
                "Four employment opportunities + two freelance issues → NAB O2 PC(a)",
                "O2 PC(a) — complete",
                "",
                "",
                s,
            ),
            slide_close(
                "Would you choose\nemployed or freelance\nwork in your sector?",
                "Exit ticket — one freelance issue that matters most to you",
                s,
            ),
        ],
    },
    {
        "num": 7,
        "title": "Job Roles, Career Paths + Self-Eval #2",
        "short": "Career Paths",
        "li": "Research and document three job roles with career paths. Complete second employability self-evaluation with peer feedback.",
        "sc": [
            "I have documented three job roles with realistic named career paths.",
            "Each role description has enough day-to-day detail.",
            "I have given and received peer feedback on career paths.",
            "Self-Eval #2 is complete with peer feedback, signed and countersigned.",
        ],
        "slides": lambda s: [
            slide_title("Job Roles, Career\nPaths + Self-Eval #2", "Session 07 · Fri 29 Aug", "PATH", s),
            slide_li_sc(
                "Research and document three job roles with career paths. Complete second employability self-evaluation with peer feedback.",
                [
                    "I have documented three job roles with realistic named career paths.",
                    "Each role description has enough day-to-day detail.",
                    "I have given and received peer feedback on career paths.",
                    "Self-Eval #2 is complete with peer feedback, signed and countersigned.",
                ],
                s,
            ),
            slide_list(
                "Careers are rarely linear",
                [
                    ("01", "Runner → floor manager → AD → director", "Film & TV example."),
                    ("02", "Stage crew → DSM → stage manager → production manager", "Theatre example."),
                    ("03", "Networking & persistence", "Additional skills matter as much as promotion."),
                ],
                s,
                1,
            ),
            slide_section(
                "Example",
                "Career path\nmapping",
                "How are careers in the Creative Industries rarely linear? What role do networking, persistence and additional skills play?",
                s,
                1,
                "0–10 MIN",
            ),
            slide_task(
                "Three job roles + career paths",
                "For each role: day-to-day description + realistic path from entry to senior — named roles in sequence.",
                [
                    ("01 /", "Not just \"you could become more senior\" — name the actual roles."),
                    ("02 /", "Use the template provided."),
                ],
                "Individual research · 50 minutes · NAB O2 PC(b)",
                s,
                1,
                "10–60 MIN",
            ),
            slide_task(
                "Peer check",
                "Swap with a partner from the same or related sector if possible.",
                [
                    ("01 /", "Does this career path make sense?"),
                    ("02 /", "Is the progression realistic?"),
                    ("03 /", "One strength + one suggestion in writing."),
                ],
                "15 minutes",
                s,
                2,
                "60–75 MIN",
            ),
            slide_task(
                "Employability Self-Evaluation #2",
                "Reflect on skill development since Review 1. Peer feedback required on at least one skills area.",
                [
                    ("01 /", "Identify updated targets."),
                    ("02 /", "Classmate responds in writing to at least one area."),
                    ("03 /", "Both learner and peer sign. Teacher countersigns."),
                ],
                "NAB O3 Review 2 of 3 · 25 minutes",
                s,
                3,
                "75–100 MIN",
            ),
            slide_teacher(
                "Three job roles + career paths → O2 PC(b); Self-Eval #2 → O3 Review 2",
                "O2 PC(b) complete; O3 Review 2 complete",
                "Countersign Self-Eval #2. Confirm peer feedback is present and signed.",
                "",
                s,
            ),
            slide_close(
                "Which job role on\nyour path excites you\nmost — and why?",
                "Exit ticket — one skill you have improved since Review 1",
                s,
            ),
        ],
    },
    {
        "num": 8,
        "title": "Focus Job Role in Depth",
        "short": "Focus Job Role",
        "li": "Produce a detailed, high-quality profile of one chosen job role.",
        "sc": [
            "My profile covers employability skills required for the role.",
            "I have described key responsibilities in meaningful detail.",
            "I have listed formal and informal qualifications required.",
            "I have chosen my O2 presentation format and outlined a timeline.",
        ],
        "slides": lambda s: [
            slide_title("Focus Job Role\nin Depth", "Session 08 · Tue 2 Sep", "ROLE", s),
            slide_li_sc(
                "Produce a detailed, high-quality profile of one chosen job role.",
                [
                    "My profile covers employability skills required for the role.",
                    "I have described key responsibilities in meaningful detail.",
                    "I have listed formal and informal qualifications required.",
                    "I have chosen my O2 presentation format and outlined a timeline.",
                ],
                s,
            ),
            slide_section(
                "Starter",
                "Reading a job\nspec critically",
                "Walk through a real job spec. What does \"proficient in Adobe Creative Suite\" mean? What does \"strong interpersonal skills\" look like in practice? Essential vs desirable qualifications?",
                s,
                1,
                "0–15 MIN",
            ),
            slide_list(
                "Focus job role profile — include",
                [
                    ("01", "Employability skills", "Specific skills required for this role."),
                    ("02", "Key responsibilities", "Meaningful detail — not bullet fluff."),
                    ("03", "Qualifications", "Formal (degrees, HNC, certs) and informal (portfolio, networks)."),
                ],
                s,
                1,
            ),
            slide_callout(
                "Quality over quantity",
                "A thorough two-page profile beats a thin four-page one.",
                "Select one of your three researched roles. Teacher works individually on depth and specificity. NAB O2 PC(c).",
                s,
                1,
            ),
            slide_section(
                "Writing time",
                "Focus job role\nprofile",
                "60 minutes of focused writing. Teacher circulates and challenges surface-level responses.",
                s,
                2,
                "15–75 MIN",
            ),
            slide_task(
                "Presentation format planning",
                "How will you present your full O2 findings (PC d)?",
                [
                    ("01 /", "Written report, presentation, blog, podcast, or audio recording."),
                    ("02 /", "Format chosen, structure outlined, realistic timeline written."),
                ],
                "15 minutes",
                s,
                1,
                "75–90 MIN",
            ),
            slide_section(
                "Checkpoint",
                "Share your\nchosen role",
                "Each learner shares their chosen job role and one thing that makes it interesting to them personally. Quick round the room.",
                s,
                3,
                "90–100 MIN",
            ),
            slide_teacher(
                "Focus job role profile → NAB O2 PC(c)",
                "O2 PC(c) — complete",
                "",
                "",
                s,
            ),
            slide_close(
                "What makes your\nchosen role right\nfor you?",
                "Prepare to produce your O2 presentation next session",
                s,
            ),
        ],
    },
    {
        "num": 9,
        "title": "Presenting O2 Findings",
        "short": "Present O2",
        "li": "Organise and present the full O2 investigation findings in a chosen format.",
        "sc": [
            "My presentation organises all O2 findings clearly.",
            "My chosen format meets the quality bar — not thin or list-only.",
            "I have received structured peer feedback and noted improvements.",
            "My folio entry is labelled — what it is, which PC, date.",
        ],
        "slides": lambda s: [
            slide_title("Presenting\nO2 Findings", "Session 09 · Wed 3 Sep", "SHARE", s),
            slide_li_sc(
                "Organise and present the full O2 investigation findings in a chosen format.",
                [
                    "My presentation organises all O2 findings clearly.",
                    "My chosen format meets the quality bar — not thin or list-only.",
                    "I have received structured peer feedback and noted improvements.",
                    "My folio entry is labelled — what it is, which PC, date.",
                ],
                s,
            ),
            slide_cols(
                "Format quality — what works?",
                [
                    ("Blog", "Effective = headings, depth, sector voice. Thin = bullet lists only."),
                    ("Podcast", "Strong = clear structure, examples, personality. Weak = reading notes."),
                    ("Presentation", "Strong = says something · Weak = just lists facts."),
                ],
                s,
                1,
            ),
            slide_section(
                "Format examples",
                "Set the\nquality bar",
                "Brief examples of each format option. What makes a blog effective vs thin? What does a strong podcast sound like?",
                s,
                1,
                "0–10 MIN",
            ),
            slide_section(
                "Production time",
                "Build your\nO2 presentation",
                "65 minutes focused working time. Teacher checks structure, encourages depth, helps with format-specific challenges — audio recording, blog headings, presentation flow.",
                s,
                2,
                "10–75 MIN",
            ),
            slide_task(
                "Peer feedback",
                "Share work in progress with a partner.",
                [
                    ("01 /", "One specific strength."),
                    ("02 /", "One specific improvement suggestion."),
                    ("03 /", "Note feedback in writing and adjust if needed."),
                ],
                "15 minutes",
                s,
                1,
                "75–90 MIN",
            ),
            slide_task(
                "Folio entry",
                "Add finished or near-finished presentation to folio.",
                [
                    ("01 /", "Label clearly — what it is, which PC it evidences, date."),
                ],
                "Outcome 2 complete · NAB O2 PC(d) · 10 minutes",
                s,
                2,
                "90–100 MIN",
            ),
            slide_teacher(
                "Presented O2 findings → NAB O2 PC(d); Outcome 2 complete",
                "O2 PC(d) complete; all of Outcome 2 evidenced",
                "",
                "",
                s,
            ),
            slide_close(
                "What is the strongest\npart of your O2\ninvestigation?",
                "Exit ticket — one thing you would improve if you had more time",
                s,
            ),
        ],
    },
    {
        "num": 10,
        "title": "Folio Audit + Full O1/O2 Consolidation",
        "short": "Folio Audit",
        "li": "Confirm all O1 and O2 evidence is present, complete and of sufficient quality. Address any gaps.",
        "sc": [
            "I have traffic-lighted every O1 and O2 performance criterion.",
            "All amber and red items are addressed or scheduled.",
            "I understand how the U1 NAB window works.",
            "My folio is organised, labelled and ready for assessment.",
        ],
        "slides": lambda s: [
            slide_title("Folio Audit +\nConsolidation", "Session 10 · Fri 5 Sep", "AUDIT", s),
            slide_li_sc(
                "Confirm all O1 and O2 evidence is present, complete and of sufficient quality. Address any gaps.",
                [
                    "I have traffic-lighted every O1 and O2 performance criterion.",
                    "All amber and red items are addressed or scheduled.",
                    "I understand how the U1 NAB window works.",
                    "My folio is organised, labelled and ready for assessment.",
                ],
                s,
            ),
            slide_task(
                "Folio audit",
                "Work through the printed checklist for every O1 and O2 performance criterion.",
                [
                    ("01 /", "Evidence present? Enough detail? Signed and dated?"),
                    ("02 /", "Traffic light: green (done), amber (needs improving), red (missing)."),
                ],
                "Checklist provided · 20 minutes",
                s,
                1,
                "0–20 MIN",
            ),
            slide_section(
                "Gap fill",
                "Improvement\ntime",
                "Work on amber and red items. Teacher prioritises who needs most support. All green? Extension: evaluative paragraph on what surprised you about the Creative Industries and what it means for your future.",
                s,
                1,
                "20–65 MIN",
            ),
            slide_section(
                "Consolidation",
                "Whole-class\ndiscussion",
                "What surprised you most across the unit? What job role would you actually want? What sector feels most real and relevant now? Listen carefully — diagnostic for pitching U2.",
                s,
                2,
                "65–85 MIN",
            ),
            slide_callout(
                "NAB preview",
                "Open-book — use your folio and notes. This is not a memory test.",
                "Walk through what the assessor looks for on each PC. U1 NAB window weeks 8–9. Answer questions and reduce anxiety.",
                s,
                2,
            ),
            slide_list(
                "U1 NAB — key evidence checklist",
                [
                    ("O1a", "Sectors understood + sector identified", ""),
                    ("O1b–d", "Legal, H&S, two agencies", ""),
                    ("O2a–d", "Employment, roles, focus role, presentation", ""),
                    ("O3", "Self-Eval #1 & #2 signed", ""),
                ],
                s,
                1,
                False,
            ),
            slide_teacher(
                "All outstanding O1 and O2 evidence completed; folio organised",
                "Final sign-off on all O1 and O2 PCs",
                "",
                "",
                s,
            ),
            slide_close(
                "What are you most\nproud of in your\nUnit 1 folio?",
                "U2 Skills Development begins next — bring your sector and role focus",
                s,
            ),
        ],
    },
]


def build_html(session: dict) -> str:
    n = session["num"]
    sid = f"s{n:02d}"
    parts = session["slides"](sid)
    slides_html = "\n".join(parts)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>N5 CI — Session {n:02d} · {esc(session["title"])}</title>
<script src="app-version.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="{FONTS}" rel="stylesheet">
<link rel="stylesheet" href="n5-ci-slides-core.css">
</head>
<body class="{UCLASS}" data-unit="{UNIT}" data-session="{n}" data-session-title="{esc(session["short"])}">
<div class="cursor" id="cursor"></div>
<canvas id="particleCanvas" style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;"></canvas>
<div class="hud">
  <div class="hud-left" id="hudLeft">N5 CREATIVE INDUSTRIES</div>
  <div class="hud-progress" id="hudProgress"></div>
  <div class="hud-right" id="hudRight">01 / 00</div>
</div>
<div class="key-hint hidden" id="keyHint">SPACE / ARROWS TO NAVIGATE · CLICK TO ADVANCE</div>
<div id="deck">
{slides_html}
</div>
<script src="n5-ci-slides-deck.js"></script>
</body>
</html>
"""


def main():
    skip_hand_authored = {1}  # drama-ci-s01.html — hand-built deck (U1_S1_Session1_Slides.html)
    for session in SESSIONS:
        n = session["num"]
        if n in skip_hand_authored:
            print(f"Skip session {n:02d} (hand-authored: drama-ci-s{n:02d}.html)")
            continue
        out = os.path.join(ROOT, f"drama-ci-s{n:02d}.html")
        with open(out, "w", encoding="utf-8") as f:
            f.write(build_html(session))
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
