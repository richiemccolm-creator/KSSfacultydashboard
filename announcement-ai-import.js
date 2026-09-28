/**
 * Draft announcements with an AI assistant (ChatGPT, Claude, Copilot...).
 * buildPrompt() turns the faculty head's notes into a prompt that asks for a
 * fixed plain-text format; parse() reads the assistant's reply back into
 * announcement objects the Announcements page can save or open in its editor.
 */
(function (global) {
  'use strict';

  var MARKER = '=== ANNOUNCEMENT ===';
  var TONES = {
    friendly: 'warm and friendly, but still professional',
    formal: 'formal and professional',
    brief: 'short and direct, with no more than two sentences of body text'
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function buildPrompt(opts) {
    opts = opts || {};
    var today = opts.today || new Date();
    var todayText = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var tone = TONES[opts.tone] || TONES.friendly;
    var notes = String(opts.notes || '').trim() || '(No notes given. Ask me what I need to tell staff before writing anything.)';
    return [
      'You are helping the Faculty Head of Art & Drama (Art & Design, Drama and Photography) at Knightswood Secondary School in Glasgow write announcements for faculty staff. They appear on the home page of our Faculty Hub website.',
      '',
      'Today is ' + todayText + ' (' + ymd(today) + ').',
      '',
      'Turn my notes below into announcements.',
      '- Write one announcement per separate piece of news. Do not combine unrelated items.',
      '- Use UK English. The tone should be ' + tone + '.',
      '- Titles: 80 characters or fewer, and they should make sense on their own.',
      '- Body: short paragraphs. Put the key detail (what, when, where, what staff need to do) first.',
      '- Only use facts from my notes. If something important is missing (a date, time, room or deadline), write [CHECK: what is missing] in the text instead of guessing.',
      '- Formatting allowed in the body: **bold**, *italic*, ## Heading, ### Subheading, lists with "- ", and links as [text](https://...). Nothing else.',
      '',
      'Reply with ONLY the announcements, in exactly this format, with no introduction and no code block:',
      '',
      MARKER,
      'Title: <title>',
      'Prominence: <standard | priority | reminder>',
      'Home banner: <yes | no>',
      'Post on: <YYYY-MM-DD HH:MM, or blank to decide later>',
      'Take down after: <YYYY-MM-DD, or blank>',
      'Body:',
      '<body text, as many lines as needed>',
      '',
      'Guidance for the fields:',
      '- Prominence: "priority" only for urgent or must-read items, "reminder" for low-key nudges, otherwise "standard".',
      '- Home banner: "yes" for at most one announcement, the single most important one. Otherwise "no".',
      '- Post on: only fill in if my notes say when staff should see it. Use 24-hour time; 08:00 if no time is given.',
      '- Take down after: the day after the event or deadline has passed, if there is one.',
      '',
      'My notes:',
      '"""',
      notes,
      '"""'
    ].join('\n');
  }

  // ---- Reading the reply --------------------------------------------------

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inline(text) {
    var s = escapeHtml(text);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return s;
  }

  // The small Markdown subset from the prompt, turned into the HTML the
  // announcement editor stores (headings, paragraphs, bold, italic, links).
  function markdownToHtml(md) {
    var blocks = String(md || '').replace(/\r/g, '').trim().split(/\n\s*\n/);
    return blocks.map(function (block) {
      var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) return '';
      var out = [];
      var para = [];
      function flush() {
        if (para.length) out.push('<p>' + para.join('<br>') + '</p>');
        para = [];
      }
      lines.forEach(function (line) {
        var h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
          flush();
          out.push(h[1].length <= 2 ? '<h2>' + inline(h[2]) + '</h2>' : '<h3>' + inline(h[2]) + '</h3>');
          return;
        }
        var li = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
        para.push(li ? '• ' + inline(li[1]) : inline(line));
      });
      flush();
      return out.join('');
    }).join('');
  }

  function parseProminence(v) {
    var t = String(v || '').toLowerCase();
    if (/priority|urgent|high/.test(t)) return 'high';
    if (/reminder|low/.test(t)) return 'low';
    return 'none';
  }

  function parseYes(v) {
    return /^\s*(yes|y|true)\b/i.test(String(v || ''));
  }

  function parseDate(v) {
    var m = String(v || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return '';
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getMonth() !== Number(m[2]) - 1) return '';
    return ymd(d);
  }

  function parseDateTime(v) {
    var day = parseDate(v);
    if (!day) return null;
    var t = String(v).match(/(\d{1,2}):(\d{2})/);
    var hh = t ? Math.min(23, Number(t[1])) : 8;
    var mm = t ? Math.min(59, Number(t[2])) : 0;
    var d = new Date(day + 'T' + pad(hh) + ':' + pad(mm));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  var FIELD_RE = /^\s*\**\s*(title|prominence|priority|home banner|banner|post on|publish|take down after|expires|body)\s*\**\s*:\s*\**\s*(.*)$/i;

  function parseBlock(block) {
    var fields = {};
    var bodyLines = null;
    block.split('\n').forEach(function (line) {
      if (bodyLines) { bodyLines.push(line); return; }
      var m = line.match(FIELD_RE);
      if (!m) return;
      var key = m[1].toLowerCase();
      if (key === 'body') { bodyLines = m[2] ? [m[2]] : []; return; }
      fields[key] = m[2].replace(/\*+$/, '').trim();
    });
    var title = String(fields.title || '').replace(/^["“]|["”]$/g, '').trim();
    if (!title) return null;
    var bodyMd = (bodyLines || []).join('\n').trim();
    var postOn = fields['post on'] || fields.publish || '';
    return {
      title: title.slice(0, 160),
      body: markdownToHtml(bodyMd),
      priority: parseProminence(fields.prominence || fields.priority),
      featured_banner: parseYes(fields['home banner'] || fields.banner),
      publish_at: parseDateTime(postOn),
      expires_at: parseDate(fields['take down after'] || fields.expires) || null,
      needs_check: /\[CHECK\b/i.test(title + ' ' + bodyMd)
    };
  }

  function parse(text) {
    var clean = String(text || '')
      .replace(/\r/g, '')
      .replace(/^```[a-z]*\s*$/gim, '');
    var parts = clean.split(/^\s*=+\s*ANNOUNCEMENT\s*=+\s*$/im);
    // Without markers, treat each "Title:" line as the start of a new block.
    if (parts.length < 2) parts = clean.split(/^(?=\s*\**\s*title\s*\**\s*:)/im);
    var items = parts.map(parseBlock).filter(Boolean);
    // Only one banner can show; keep the first the assistant marked.
    var seenBanner = false;
    items.forEach(function (it) {
      if (it.featured_banner && seenBanner) it.featured_banner = false;
      if (it.featured_banner) seenBanner = true;
    });
    return items;
  }

  global.AnnouncementAIImport = {
    buildPrompt: buildPrompt,
    parse: parse,
    markdownToHtml: markdownToHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
