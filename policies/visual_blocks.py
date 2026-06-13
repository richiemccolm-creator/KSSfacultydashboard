"""Hand-built HTML visual components for policy pages (no Word image extraction)."""
import re
import html as html_mod

PPR_BLOCKS = {
    'whole-school-structure': '''
<div class="policy-key-box"><span class="policy-key-box-label">At a glance</span>Each pupil belongs to a house with a PT Pastoral Care lead and a linked Depute Headteacher.</div>
<table class="policy-table policy-table--compact">
<thead><tr><th>House</th><th>PT Pastoral Care</th><th>DHT / phase</th></tr></thead>
<tbody>
<tr><td>Arran</td><td>Ms McLelland / Ms Di Rollo</td><td>BGE Arran and Tiree — Ms Docherty</td></tr>
<tr><td>Tiree</td><td>Mrs Gray</td><td>BGE Bute and Skye — Mrs Seagrave</td></tr>
<tr><td>Bute</td><td>Mr Deveney</td><td>BGE Harris and Islay — Mrs McCreaner</td></tr>
<tr><td>Skye</td><td>Mr Shields</td><td>SP Harris, Skye and Islay — Mr Oakes</td></tr>
<tr><td>Harris</td><td>Mrs Schimmel</td><td>SO Arran, Bute and Tiree — Mr Hood</td></tr>
<tr><td>Islay</td><td>Mrs Adams</td><td>—</td></tr>
</tbody>
</table>''',
    'meeting-learners-needs-through-staged-intervention': '''
<div class="policy-key-box"><span class="policy-key-box-label">At a glance</span>Know pupils&apos; needs · complete the staged intervention triangle · use Pupil Plans · review at transitions.</div>
<div class="policy-tier-stack">
  <div class="policy-tier policy-tier--1"><strong>Universal</strong><span>Quality learning &amp; teaching for all pupils in every class.</span></div>
  <div class="policy-tier policy-tier--2"><strong>Targeted</strong><span>Additional in-class support — strategies from Pupil Plans and staged intervention triangle.</span></div>
  <div class="policy-tier policy-tier--3"><strong>Enhanced / specialist</strong><span>PT pastoral care, DHT, Kiim, and external partners as required.</span></div>
</div>
<p class="policy-official-note">Full staged intervention triangle and transition templates are in <strong>Appendix 1 &amp; 2</strong> of the official document.</p>
<div class="policy-step-grid">
  <div class="policy-step"><span>1</span>Refocus &amp; rephrase</div>
  <div class="policy-step"><span>2</span>Break down task</div>
  <div class="policy-step"><span>3</span>Charter reminder</div>
  <div class="policy-step"><span>4</span>1:1 chat</div>
  <div class="policy-step"><span>5</span>Thinking space</div>
  <div class="policy-step"><span>6</span>Restorative conversation</div>
  <div class="policy-step"><span>7</span>Seemis referral</div>
</div>''',
    'key-classroom-strategies-1-phone-policy': '''
<div class="policy-key-box"><span class="policy-key-box-label">Phone policy — essentials</span>Phones off · in bags · bags stored at front/back or under desks · check your department specifics.</div>
<div class="policy-rule-cards">
  <div class="policy-rule-card"><strong>Every lesson</strong><p>Switch off · store in bag · bag at front/back or under desk. No bag? Phone on teacher&apos;s desk.</p></div>
  <div class="policy-rule-card policy-rule-card--amber"><strong>First reminder</strong><p>Phone stored as directed — no further action if pupil complies.</p></div>
  <div class="policy-rule-card policy-rule-card--amber"><strong>Second use</strong><p>Phone on teacher&apos;s desk for the remainder of the period.</p></div>
  <div class="policy-rule-card policy-rule-card--red"><strong>Non-cooperation</strong><p>Inform pupil that PT may confiscate for the day · phone to school office at first opportunity.</p></div>
  <div class="policy-rule-card policy-rule-card--red"><strong>Corridors / social areas</strong><p>Phone to school office immediately if used during class time.</p></div>
</div>
<div class="policy-strategy-strip">
  <div class="policy-strategy-item"><strong>2</strong>Target setting</div>
  <div class="policy-strategy-item"><strong>3</strong>30-second intervention</div>
  <div class="policy-strategy-item"><strong>4</strong>Thinking space</div>
</div>''',
    'seemis-referrals': '''
<div class="policy-key-box"><span class="policy-key-box-label">Before you refer</span>Use classroom strategies first. Referrals may be shared with pupils and parents.</div>
<div class="policy-checklist">
  <div class="policy-checklist-item"><span>1</span>Identify behaviour not in line with the charter — use charter language</div>
  <div class="policy-checklist-item"><span>2</span>Outline classroom interventions used — be objective</div>
  <div class="policy-checklist-item"><span>3</span>Outline the pupil&apos;s response</div>
  <div class="policy-checklist-item"><span>4</span>Include any other relevant information</div>
</div>''',
}

TRACKING_BLOCKS = {
    '3-moderation-and-quality-assurance': '''
<div class="policy-cycle">
  <div class="policy-cycle-step"><span>1</span><strong>Plan</strong> learning, teaching &amp; assessment</div>
  <div class="policy-cycle-step"><span>2</span><strong>Gather</strong> evidence from everyday learning</div>
  <div class="policy-cycle-step"><span>3</span><strong>Evaluate</strong> using Benchmarks &amp; dialogue</div>
  <div class="policy-cycle-step"><span>4</span><strong>Moderate</strong> with colleagues</div>
  <div class="policy-cycle-step"><span>5</span><strong>Share</strong> standards in tracking &amp; reporting</div>
</div>''',
    '4-progress-and-engagement-ratings': '''
<div class="policy-key-box"><span class="policy-key-box-label">Progress ratings</span>Based on secure evidence of the pupil&apos;s current working level — not age, predictions, or a single test.</div>
<div class="policy-rating-grid">
  <div class="policy-rating-card policy-rating-card--1"><strong>Below expectations</strong><p>Small steps forward toward personal targets. Rarely used — note for new EAL learners.</p></div>
  <div class="policy-rating-card policy-rating-card--2"><strong>Occasionally meets</strong><p>Occasionally working at the stated level — may be inconsistent.</p></div>
  <div class="policy-rating-card policy-rating-card--3"><strong>Sometimes meets</strong><p>Attainment at the stated level across several pieces of work.</p></div>
  <div class="policy-rating-card policy-rating-card--4"><strong>Meeting expectations</strong><p>Strong understanding and required skills demonstrated consistently at the level.</p></div>
</div>
<h3 class="policy-subhead">Engagement ratings (Effort · Behaviour · Home learning)</h3>
<p class="policy-p">Rate patterns <strong>over time</strong>, not isolated incidents. Select for every pupil at each tracking update.</p>
<div class="policy-engage-grid">
  <div class="policy-engage-col"><h4>Effort</h4><ul><li>Rarely puts in effort</li><li>Some effort, capable of more</li><li>Usually conscientious</li><li>Always conscientious</li></ul></div>
  <div class="policy-engage-col"><h4>Behaviour</h4><ul><li>Serious concerns</li><li>Some improvements required</li><li>Usually behaves well</li><li>Always behaves well</li></ul></div>
  <div class="policy-engage-col"><h4>Home learning</h4><ul><li>Rarely completed</li><li>Sometimes completed</li><li>Usually completed</li><li>Always completed</li></ul></div>
</div>''',
    '4-reporting-structure': '''
<div class="policy-rule-cards policy-rule-cards--two">
  <div class="policy-rule-card"><strong>Interim report</strong><p>Snapshot of progress and engagement · no narrative comments.</p></div>
  <div class="policy-rule-card"><strong>Full written report</strong><p>One per session · strengths, development areas, and clear next steps for parents.</p></div>
</div>''',
    '6-roles-and-responsibilities': '''
<div class="policy-engage-grid policy-engage-grid--roles">
  <div class="policy-engage-col"><h4>Class teachers</h4><ul><li>Track using professional judgement</li><li>Complete ratings accurately</li><li>Engage in learner conversations</li></ul></div>
  <div class="policy-engage-col"><h4>Faculty / PT</h4><ul><li>Moderate standards within faculty</li><li>Support consistency of judgements</li><li>Quality assure tracking entries</li></ul></div>
  <div class="policy-engage-col"><h4>Pastoral care &amp; SLT</h4><ul><li>Monitor cohort progress</li><li>Support interventions &amp; options</li><li>Review policy annually (May–June)</li></ul></div>
</div>''',
}

# Paragraphs to strip after injecting structured content (broken Word conversion)
PPR_STRIP_PATTERNS = [
    r'<p class="policy-p">Arran:.*?</p>\s*',
    r'<p class="policy-p">Tiree:.*?</p>\s*',
    r'<p class="policy-p">Bute:.*?</p>\s*',
    r'<p class="policy-p">Skye:.*?</p>\s*',
    r'<p class="policy-p">Harris:.*?</p>\s*',
    r'<p class="policy-p">Islay:.*?</p>\s*',
    r'<p class="policy-p">Department</p>\s*<p class="policy-p">Strategies</p>\s*',
]


def strip_figures(html):
    return re.sub(r'<figure class="policy-figure">.*?</figure>\s*', '', html, flags=re.S)


def strip_table_placeholders(html):
    return re.sub(r'<!--TABLEPH\d+-->\s*', '', html)


def dedupe_paragraphs(html):
    out = []
    prev = None
    pos = 0
    for m in re.finditer(r'<p class="policy-p">.*?</p>', html, re.S):
        out.append(html[pos:m.start()])
        text = re.sub(r'<[^>]+>', '', m.group(0)).strip()
        if text != prev:
            out.append(m.group(0))
            prev = text
        pos = m.end()
    out.append(html[pos:])
    return ''.join(out)


def inject_block(html, section_slug, block_html):
    needle = f'id="section-{section_slug}"'
    idx = html.find(needle)
    if idx == -1:
        return html
    body_start = html.find('<div class="policy-section-body">', idx)
    if body_start == -1:
        return html
    insert_at = body_start + len('<div class="policy-section-body">')
    return html[:insert_at] + block_html + html[insert_at:]


def apply_visual_enhancements(html, policy_id):
    html = strip_figures(html)
    html = strip_table_placeholders(html)

    blocks = PPR_BLOCKS if policy_id == 'ppr' else TRACKING_BLOCKS if policy_id == 'tracking' else {}
    for slug, block in blocks.items():
        html = inject_block(html, slug, block)

    if policy_id == 'ppr':
        for pat in PPR_STRIP_PATTERNS:
            html = re.sub(pat, '', html, flags=re.S)
        html = dedupe_paragraphs(html)

    return html
