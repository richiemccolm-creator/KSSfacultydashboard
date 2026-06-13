#!/usr/bin/env python3
"""Generate structured policy HTML pages from textutil docx conversion output."""
import re
import html
import subprocess
import zipfile
from pathlib import Path

from visual_blocks import apply_visual_enhancements

ROOT = Path(__file__).resolve().parent
RAW = ROOT / '_raw'

SECTION_ICONS = {
    'charter': '🏫', 'nurture': '🌱', 'vision': '🎯', 'restorative': '🤝',
    'phone': '📱', 'classroom': '📋', 'seemis': '📝', 'staged': '🔺',
    'monitoring': '👁', 'whole school': '🏠', 'gcc': '🏛', 'department': '🎭',
    'purpose': '🎯', 'tracking': '📊', 'moderation': '✓', 'progress': '📈',
    'reporting': '📄', 'learner': '💬', 'roles': '👥', 'intervention': '🛟',
    'review': '🔄', 'calendar': '📅', 'appendix': '📎',
}

PPR_QUICK = [
    ('our-school-charter', 'School charter'),
    ('key-classroom-strategies-1-phone-policy', 'Phone policy'),
    ('meeting-learners-needs-through-staged-intervention', 'Staged intervention'),
    ('seemis-referrals', 'Seemis'),
]

TRACKING_QUICK = [
    ('bge-reporting-calendar', 'Reporting calendar'),
    ('4-progress-and-engagement-ratings', 'Progress ratings'),
    ('6-roles-and-responsibilities', 'Roles'),
]

DOCX_SOURCES = {
    'ppr': '/Users/richardmccolm/Downloads/PPR Policy - updated 14th Feb 2025.docx',
    'tracking': '/Users/richardmccolm/Downloads/2. Knightswood Tracking Policy Sept 2025.docx',
}

PPR_SECTIONS = [
    'Our School Charter',
    'Nurture',
    'All Behaviour is Communication and Restorative Approaches',
    'VISION',
    'WHY IS THIS IMPORTANT?',
    'Restorative Conversations',
    'Glasgow City Council\u2019s Promoting Positive Behaviour Policy',
    'Whole School Structure',
    'Department strategies',
    'Meeting Learners\u2019 Needs Through Staged Intervention',
    'Meeting Learners\u2019 Needs through Staged Intervention',
    'PPR in the classroom',
    'Key Classroom Strategies: 1. Phone Policy',
    'Phone policy: Scottish Government Guidance',
    'Key Classroom Strategies: 2. Target Setting; 3. Thirty second intervention; 4. Thinking Space',
    'Seemis referrals',
    'Monitoring and support',
    'Wider School Support',
] + [f'Appendix {i}:' for i in range(1, 17)]

TRACKING_CALENDAR = '''
<h2 class="policy-h2" id="bge-reporting-calendar">BGE Reporting Calendar 2025–26</h2>
<table class="policy-table">
  <thead><tr><th>W/B begin</th><th>Thu</th><th>Fri</th><th>Notes (BGE)</th></tr></thead>
  <tbody>
    <tr><td>15 Sep 2025</td><td></td><td>S3 IR</td><td>S3 Interim Report completed</td></tr>
    <tr><td>27 Oct 2025</td><td>S2 IR</td><td></td><td>S2 Interim completed</td></tr>
    <tr><td>08 Dec 2025</td><td></td><td>S3</td><td>S3 Full reporting window open 21 Nov — QA by 12 Dec</td></tr>
    <tr><td>16 Feb 2026</td><td></td><td>S1 IR</td><td>S1 Interim report completed by 20 Feb</td></tr>
    <tr><td>09 Mar 2026</td><td></td><td>S2</td><td>S2 Full report window open 20 Feb — QA by 13 Mar</td></tr>
    <tr><td>08 Jun 2026</td><td></td><td>S1</td><td>S1 Full report window open 26 May — QA by 12 Jun</td></tr>
  </tbody>
</table>
'''

TRACKING_SECTIONS = [
    '1. PURPOSE',
    '2. TRACKING PUPILS: LEVELS AND PROFESSIONAL JUDGEMENT',
    '3. MODERATION AND QUALITY ASSURANCE',
    '4. PROGRESS AND ENGAGEMENT RATINGS',
    '4. REPORTING STRUCTURE',
    '5. LEARNER CONVERSATIONS AND PUPIL OWNERSHIP',
    '6. ROLES AND RESPONSIBILITIES',
    '7. USING TRACKING TO SUPPORT INTERVENTIONS',
    '8. REVIEW AND EVALUATION',
]


def slugify(text):
    t = html.unescape(re.sub(r'<[^>]+>', '', text))
    t = re.sub(r'page\s+\d+.*$', '', t, flags=re.I)
    t = re.sub(r'pages\s+[\d\-]+.*$', '', t, flags=re.I)
    t = re.sub(r'[^\w\s-]', '', t.lower())
    t = re.sub(r'\s+', '-', t.strip())
    t = re.sub(r'-+', '-', t)
    return t or 'section'


def strip_tags(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def normalize_text(s):
    s = strip_tags(s)
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s*page\s+\d+.*$', '', s, flags=re.I)
    return s.strip()


def is_noise_para(text):
    if not text or len(text) < 2:
        return True
    if text.lower() in ('contents', 'table of contents', 'kss'):
        return True
    if re.match(r'^page \d', text, re.I):
        return True
    if re.match(r'^appendix \d', text, re.I) and 'page' in text.lower():
        return True
    if re.match(r'^(w/begin|thu|fri|notes \(bge\))$', text, re.I):
        return True
    if 'learning together' in text.lower() and 'working together' in text.lower():
        return True
    if re.match(r'^KNIGHTSWOOD SECONDARY SCHOOL Tracking', text):
        return True
    if re.search(r'page\s*\d', text, re.I) and re.match(r'^(appendix|key classroom|department strategies|ppr in|seemis|monitoring|phone policy)', text, re.I):
        return True
    if re.match(r'^\d+\.\s+[A-Z][A-Z\s/&:()\-]+\d+$', text):
        return True
    if len(text) < 80 and re.search(r'[a-z]page\s*\d', text, re.I):
        return True
    return False


def clean_section_title(text):
    t = re.sub(r'\s+', ' ', text).strip()
    t = re.sub(r'page\s+\d+.*$', '', t, flags=re.I)
    t = re.sub(r'(\D)\d+(\s*&\s*\d+)*$', r'\1', t).strip()
    return t


def has_toc_page_suffix(text):
    raw = re.sub(r'\s+', ' ', text).strip()
    return clean_section_title(raw) != raw


def heading_match(text, known=None):
    if is_noise_para(text) or len(text) > 110 or has_toc_page_suffix(text):
        return None
    norm = clean_section_title(text)
    if not norm:
        return None
    if known:
        for k in known:
            kn = clean_section_title(k)
            if norm.lower() == kn.lower():
                return kn
            if norm.lower().startswith(kn.lower()[: min(24, len(kn))]) and len(norm) <= len(kn) + 15:
                return kn
    if re.match(r'^\d+\.\s+[A-Z][A-Z\s/&]+$', norm) and len(norm) < 90:
        return norm
    if re.match(r'^Appendix \d+:', norm, re.I):
        return norm
    if norm in ('VISION', 'WHY IS THIS IMPORTANT?', 'Nurture', 'Whole School Structure'):
        return norm
    if re.match(r'^Key Classroom Strategies:', norm, re.I):
        return norm
    if re.match(r'^Phone policy:', norm, re.I):
        return norm
    return None


def clean_inline_html(fragment):
    fragment = re.sub(r'\sclass="[^"]*"', '', fragment)
    fragment = re.sub(r'\sstyle="[^"]*"', '', fragment)
    fragment = re.sub(r'<span>\s*</span>', '', fragment)
    fragment = re.sub(r'<b>\s*</b>', '', fragment)
    fragment = re.sub(r'\s+', ' ', fragment)
    return fragment.strip()


def extract_tables(html):
    tables = []

    def repl(match):
        tables.append(match.group(0))
        return f'<!--TABLEPH{len(tables) - 1}-->'

    stripped = re.sub(r'<table[\s\S]*?</table>', repl, html, flags=re.I)
    return stripped, tables


def format_table(table_html):
    cleaned = clean_inline_html(table_html)
    cleaned = re.sub(r'<table', '<table class="policy-table"', cleaned, count=1, flags=re.I)
    cleaned = re.sub(r'cellspacing="[^"]*"', '', cleaned)
    cleaned = re.sub(r'cellpadding="[^"]*"', '', cleaned)
    cleaned = re.sub(r'valign="[^"]*"', '', cleaned)
    return cleaned


def process_body(raw_html, known_headings=None, skip_contents=True, skip_until_label=None):
    raw_html, tables = extract_tables(raw_html)
    toc = []
    used_slugs = set()
    out = []
    in_contents = False
    cover_seen = False
    content_started = skip_until_label is None

    parts = re.split(r'(?=<(?:p|ul|ol|h[1-6]|!--TABLEPH))', raw_html, flags=re.I)
    for part in parts:
        if not part.strip():
            continue

        table_ph = re.match(r'^<!--TABLEPH(\d+)-->', part.strip())
        if table_ph:
            if not content_started:
                continue
            idx = int(table_ph.group(1))
            out.append(format_table(tables[idx]))
            continue

        tag_m = re.match(r'^<(p|ul|ol)', part, re.I)
        if not tag_m:
            continue
        tag = tag_m.group(1).lower()
        text = normalize_text(part)

        if skip_contents and text.lower() in ('contents', 'table of contents'):
            in_contents = True
            continue
        if in_contents:
            if re.search(r'page\s+\d', text, re.I) or re.search(r'\t\d', text):
                continue
            matched = heading_match(text, known_headings)
            if matched:
                in_contents = False
            else:
                continue

        if is_noise_para(text):
            continue

        if re.search(r'Tracking, Monitoring, and Reporting Policy', text):
            if cover_seen:
                continue
            cover_seen = True
            continue

        heading_label = heading_match(text, known_headings) if tag == 'p' else None
        if heading_label:
            if skip_until_label and not content_started:
                if heading_label.lower() != skip_until_label.lower():
                    continue
                content_started = True
            slug = slugify(heading_label)
            if slug in used_slugs:
                continue
            used_slugs.add(slug)
            toc.append({'id': slug, 'label': heading_label})
            title = html.escape(heading_label)
            out.append(f'<h2 class="policy-h2" id="{slug}">{title}</h2>')
            continue

        if not content_started:
            continue

        cleaned = clean_inline_html(part)
        if tag in ('ul', 'ol'):
            cleaned = re.sub(rf'<{tag}', f'<{tag} class="policy-list"', cleaned, count=1, flags=re.I)
        else:
            cleaned = re.sub(r'^<p', '<p class="policy-p"', cleaned, count=1, flags=re.I)
        out.append(cleaned)

    return '\n'.join(out), toc


def section_icon(label):
    lower = label.lower()
    for key, icon in SECTION_ICONS.items():
        if key in lower:
            return icon
    return '📄'


def wrap_sections(body_html):
    pattern = re.compile(
        r'<h2 class="policy-h2" id="([^"]+)">(.*?)</h2>',
        re.S | re.I,
    )
    matches = list(pattern.finditer(body_html))
    if not matches:
        return body_html

    result = []
    pos = 0
    for i, m in enumerate(matches):
        if m.start() > pos:
            chunk = body_html[pos:m.start()].strip()
            if chunk:
                result.append(chunk)

        slug = m.group(1)
        title = strip_tags(m.group(2))
        title = clean_section_title(title)
        content_end = matches[i + 1].start() if i + 1 < len(matches) else len(body_html)
        content = body_html[m.end():content_end].strip()
        safe_title = html.escape(title)
        icon = section_icon(title)

        if title.lower().startswith('appendix'):
            result.append(
                f'<details class="policy-accordion" id="{slug}">'
                f'<summary class="policy-accordion-summary">{safe_title}</summary>'
                f'<div class="policy-accordion-body">{content}</div></details>'
            )
        else:
            result.append(
                f'<section class="policy-section" id="section-{slug}" data-anchor="{slug}">'
                f'<div class="policy-section-head">'
                f'<span class="policy-section-icon" aria-hidden="true">{icon}</span>'
                f'<h2 class="policy-h2" id="{slug}">{safe_title}</h2></div>'
                f'<div class="policy-section-body">{content}</div></section>'
            )
        pos = content_end

    return '\n'.join(result)


def wrap_calendar_block(html_block):
    return (
        '<section class="policy-section policy-section--highlight" id="section-bge-reporting-calendar" data-anchor="bge-reporting-calendar">'
        '<div class="policy-section-head">'
        '<span class="policy-section-icon" aria-hidden="true">📅</span>'
        '<h2 class="policy-h2" id="bge-reporting-calendar">BGE Reporting Calendar 2025–26</h2></div>'
        '<div class="policy-section-body">'
        + re.sub(r'<h2[^>]*>.*?</h2>', '', html_block, count=1, flags=re.S)
        + '</div></section>'
    )


def render_toc_html(toc):
    main = [t for t in toc if not t['label'].lower().startswith('appendix')]
    appendices = [t for t in toc if t['label'].lower().startswith('appendix')]
    parts = ['<input type="search" class="policy-toc-search" id="policyTocSearch" placeholder="Search sections…" aria-label="Search sections">']
    if main:
        parts.append('<div class="policy-toc-group"><div class="policy-toc-group-label">Sections</div>')
        parts.extend(f'<a class="policy-toc-link" href="#{t["id"]}">{html.escape(t["label"])}</a>' for t in main)
        parts.append('</div>')
    if appendices:
        parts.append('<div class="policy-toc-group policy-toc-group--appendix"><div class="policy-toc-group-label">Appendices</div>')
        parts.extend(f'<a class="policy-toc-link" href="#{t["id"]}">{html.escape(t["label"])}</a>' for t in appendices)
        parts.append('</div>')
        parts.append(
            '<div class="policy-toc-tools">'
            '<button type="button" id="policyExpandAppendices">Expand all</button>'
            '<button type="button" id="policyCollapseAppendices">Collapse all</button>'
            '</div>'
        )
    return '\n'.join(parts)


def render_quick_jumps(quick_links, toc_ids):
    valid = [(sid, label) for sid, label in quick_links if sid in toc_ids]
    if not valid:
        return ''
    chips = ''.join(
        f'<a class="policy-quick-chip" href="#{sid}">{html.escape(label)}</a>'
        for sid, label in valid
    )
    return f'<div class="policy-quick-jumps">{chips}</div>'


def extract_docx_images(docx_path, out_dir):
    """Deprecated — images removed; kept as no-op for compatibility."""
    pass


def ensure_raw_bodies():
    RAW.mkdir(exist_ok=True)
    mapping = {
        'ppr-body.html': DOCX_SOURCES['ppr'],
        'tracking-body.html': DOCX_SOURCES['tracking'],
    }
    for out_name, docx in mapping.items():
        out_path = RAW / out_name
        docx_path = Path(docx)
        if docx_path.exists() and (not out_path.exists() or docx_path.stat().st_mtime > out_path.stat().st_mtime):
            subprocess.run(
                ['textutil', '-convert', 'html', '-output', str(out_path.with_suffix('.tmp.html')), str(docx_path)],
                check=True,
            )
            tmp = out_path.with_suffix('.tmp.html')
            body = tmp.read_text(encoding='utf-8', errors='replace')
            m = re.search(r'<body[^>]*>(.*)</body>', body, re.S | re.I)
            out_path.write_text(m.group(1) if m else body, encoding='utf-8')
            tmp.unlink(missing_ok=True)


def render_policy_page(meta, body_html, toc, quick_links=None):
    toc_html = render_toc_html(toc)
    toc_ids = {t['id'] for t in toc}
    quick_html = render_quick_jumps(quick_links or [], toc_ids)
    download = meta.get('download', '')
    download_btn = (
        f'<a class="policy-btn policy-btn-ghost" href="{download}" download>Download official document</a>'
        if download else ''
    )
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{html.escape(meta["title"])} — Knightswood Secondary School</title>
<script src="../app-version.js"></script>
<script>if(window.ensureAppVersionInUrl)window.ensureAppVersionInUrl();</script>
<script src="../config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../supabase-init.js"></script>
<script src="../allowlist-check.js"></script>
<script src="../auth-guard.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="policies.css">
</head>
<body class="policy-doc-page">
<script>
(function(){{
  if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embedded');
}})();
</script>
<nav class="policy-embed-bar" aria-label="Policy navigation">
  <button type="button" class="policy-embed-back" id="policyBackBtn">&larr; Back to all policies</button>
</nav>
<header class="policy-doc-header">
  <div class="policy-doc-header-inner">
    <button type="button" class="policy-back-btn" id="policyHeaderBackBtn">&larr; Back to all policies</button>
    <a href="../policies.html" class="policy-back" id="policyBackLink">&larr; Back to all policies</a>
    <div class="policy-doc-meta">
      <span class="policy-doc-cat">{html.escape(meta["category"])}</span>
      <span class="policy-doc-updated">Updated {html.escape(meta["updated"])}</span>
    </div>
    <h1 class="policy-doc-title">{html.escape(meta["title"])}</h1>
    <p class="policy-doc-summary">{html.escape(meta["summary"])}</p>
    {quick_html}
    <div class="policy-doc-actions">
      {download_btn}
      <button type="button" class="policy-btn policy-btn-ghost" onclick="window.print()">Print</button>
    </div>
  </div>
</header>
<div class="policy-doc-layout">
  <nav class="policy-doc-toc" aria-label="On this page">
    <div class="policy-doc-toc-title">On this page</div>
    {toc_html}
  </nav>
  <article class="policy-doc-content">
    {body_html}
  </article>
</div>
<script src="policy-doc.js"></script>
<script src="policy-interactive.js"></script>
</body>
</html>'''


def main():
    ensure_raw_bodies()
    configs = [
        {
            'id': 'ppr',
            'file': 'ppr-policy.html',
            'raw': RAW / 'ppr-body.html',
            'headings': PPR_SECTIONS,
            'skip_until': 'Our School Charter',
            'quick': PPR_QUICK,
            'docx': DOCX_SOURCES['ppr'],
            'meta': {
                'title': 'Promoting Positive Relationships (PPR)',
                'category': 'Whole school',
                'updated': '14 Feb 2025',
                'summary': 'School charter, restorative approaches, phone policy, classroom strategies, staged intervention and Seemis referrals.',
                'download': 'pdf/ppr-policy-2025-02.docx',
            },
        },
        {
            'id': 'tracking',
            'file': 'tracking-bge-policy.html',
            'raw': RAW / 'tracking-body.html',
            'headings': TRACKING_SECTIONS,
            'skip_until': None,
            'quick': TRACKING_QUICK,
            'docx': DOCX_SOURCES['tracking'],
            'meta': {
                'title': 'Tracking, Monitoring & Reporting (BGE)',
                'category': 'Assessment',
                'updated': 'Sept 2025',
                'summary': 'BGE reporting calendar, progress ratings, moderation, learner conversations and staff responsibilities.',
                'download': 'pdf/tracking-bge-2025-09.docx',
            },
        },
    ]

    for cfg in configs:
        raw = cfg['raw'].read_text(encoding='utf-8')
        body, toc = process_body(
            raw,
            cfg['headings'],
            skip_until_label=cfg.get('skip_until'),
        )
        body = wrap_sections(body)
        if cfg['id'] == 'tracking':
            toc.insert(0, {'id': 'bge-reporting-calendar', 'label': 'BGE Reporting Calendar 2025–26'})
            body = wrap_calendar_block(TRACKING_CALENDAR) + body
        body = apply_visual_enhancements(body, cfg['id'])
        page = render_policy_page(cfg['meta'], body, toc, cfg.get('quick'))
        out_path = ROOT / cfg['file']
        out_path.write_text(page, encoding='utf-8')
        print(f'Wrote {out_path.name}: {len(toc)} sections, {len(body)} chars')


if __name__ == '__main__':
    main()
