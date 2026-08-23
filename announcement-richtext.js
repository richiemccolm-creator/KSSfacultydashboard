/**
 * Faculty announcement formatting: headings, bold, italic, and links.
 * Stores a small HTML subset in announcements.body.
 * Existing plain-text announcements keep rendering as before.
 */
(function (global) {
  var HUB_FILE = 'faculty-hub.html';
  var LOOKS_LIKE_HTML = /<\/?(h[1-6]|p|br|strong|b|em|i|a|ul|ol|li|div|span)\b/i;
  var mountCount = 0;
  var linksBound = false;

  var HUB_PAGES = [
    { group: 'Faculty Hub', items: [
      { id: 'home', label: 'Home' },
      { id: 'academic-calendar', label: 'Academic Calendar' },
      { id: 'embed-faculty-timetable', label: 'Faculty Timetable' },
      { id: 'embed-learning-teaching', label: 'Learning & Teaching' },
      { id: 'embed-policies', label: 'Policies' },
      { id: 'embed-tracking-monitoring-hub', label: 'Tracking & Monitoring' },
      { id: 'home-announcements-all', label: 'All announcements' }
    ]},
    { group: 'Planning & assessment', items: [
      { id: 'drama-tracker', label: 'Drama Tracker' },
      { id: 'ad-tracker', label: 'Art Tracker' },
      { id: 'photo-tracker', label: 'Photography Tracker' },
      { id: 'embed-teacher-planner', label: 'Teacher Planner' },
      { id: 'embed-teacher-tasks', label: 'My tasks' },
      { id: 'embed-classroom-toolkit', label: 'Classroom Toolkit' }
    ]},
    { group: 'Faculty', items: [
      { id: 'embed-procurement', label: 'Procurement' },
      { id: 'embed-department-meetings', label: 'Department meetings' }
    ]},
    { group: 'Improvement', items: [
      { id: 'dip-main', label: 'Improvement Plan 25–26' },
      { id: 'dip-main-2627', label: 'Improvement Plan 26–27' },
      { id: 'dip-action-plan-2627', label: 'Action Plan 26–27' },
      { id: 'embed-dip-tracker', label: 'DIP Mission Tracker' },
      { id: 'embed-qs-attainment', label: 'QS Attainment' }
    ]},
    { group: 'Drama', items: [
      { id: 'drama-teaching-hub', label: 'Lesson Slides' },
      { id: 'drama-s1', label: 'S1 Curriculum' },
      { id: 'drama-s2', label: 'S2 Curriculum' },
      { id: 'drama-s3', label: 'S3 Curriculum' },
      { id: 'drama-s4', label: 'S4 Curriculum' },
      { id: 'drama-s56', label: 'S5/6 Curriculum' },
      { id: 'drama-ah-deadlines', label: 'AH Key Dates & Deadlines' },
      { id: 'drama-n5-ci', label: 'N5 Creative Industries' },
      { id: 'drama-assessment', label: 'Assessment & Tracking' },
      { id: 'drama-map', label: 'Curriculum Map' },
      { id: 'drama-report-builder', label: 'BGE Drama Report Builder' },
      { id: 'drama-moderation', label: 'Moderation' }
    ]},
    { group: 'Art & Design', items: [
      { id: 'ad-s1', label: 'S1 Curriculum' },
      { id: 'ad-s2', label: 'S2 Curriculum' },
      { id: 'ad-s3', label: 'S3 Curriculum' },
      { id: 'ad-s4', label: 'S4 Curriculum' },
      { id: 'ad-s56', label: 'S5/6 Curriculum' },
      { id: 'ad-assessment', label: 'Assessment & Tracking' },
      { id: 'ad-map', label: 'Curriculum Map' },
      { id: 'ad-report-builder', label: 'BGE Art & Design Report Builder' },
      { id: 'ad-moderation', label: 'Moderation' }
    ]},
    { group: 'Photography', items: [
      { id: 'photo-npa-s3', label: 'NPA Photography S3' },
      { id: 'photo-npa-s4', label: 'NPA Photography S4' },
      { id: 'photo-higher', label: 'Higher Photography' },
      { id: 'photo-assessment', label: 'Assessment & Tracking' },
      { id: 'photo-moderation', label: 'Moderation' }
    ]}
  ];

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sanitizeHref(href) {
    var s = String(href || '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
    if (!s || s.indexOf('..') !== -1) return '';
    if (/^(javascript|vbscript|data):/i.test(s)) return '';
    if (/^https:\/\//i.test(s) || /^http:\/\//i.test(s)) return s;
    if (/^mailto:[^\s>]+$/i.test(s)) return s;
    if (/^(?:[\w.-]+\/)*[\w.-]+\.html(?:\?[^#\s]*)?(?:#[\w.-]*)?$/i.test(s)) return s;
    return '';
  }

  function isExternalHref(href) {
    return /^(https?:\/\/|mailto:)/i.test(href || '');
  }

  function hubHref(panelId) {
    var id = String(panelId || 'home').trim() || 'home';
    if (id === 'home') return HUB_FILE;
    return HUB_FILE + '?panel=' + encodeURIComponent(id);
  }

  function parseHubPanel(href) {
    if (!href) return '';
    try {
      var base = (global.location && global.location.href) ? global.location.href : 'https://local.invalid/' + HUB_FILE;
      var u = new URL(href, base);
      var parts = u.pathname.split('/');
      var file = String(parts[parts.length - 1] || '').toLowerCase();
      if (file !== HUB_FILE && file !== 'faculty-hub') return '';
      return u.searchParams.get('panel') || 'home';
    } catch (err) {
      return '';
    }
  }

  function walk(node, out) {
    if (!node) return;
    if (node.nodeType === 3) {
      out.push(escapeHtml(node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;
    var lower = String(node.tagName || '').toLowerCase();
    if (lower === 'script' || lower === 'style' || lower === 'iframe' || lower === 'object' || lower === 'embed' || lower === 'link' || lower === 'meta') return;
    if (lower === 'b') lower = 'strong';
    if (lower === 'i') lower = 'em';
    if (lower === 'h1') lower = 'h2';
    if (lower === 'h4' || lower === 'h5' || lower === 'h6') lower = 'h3';
    if (lower === 'br') {
      out.push('<br>');
      return;
    }

    var i;
    var kids = node.childNodes;

    if (lower === 'span' || lower === 'font' || lower === 'u') {
      for (i = 0; i < kids.length; i++) walk(kids[i], out);
      return;
    }

    if (lower === 'ul' || lower === 'ol') {
      for (i = 0; i < kids.length; i++) walk(kids[i], out);
      return;
    }

    if (lower === 'li') {
      for (i = 0; i < kids.length; i++) walk(kids[i], out);
      out.push('<br>');
      return;
    }

    if (lower === 'div') {
      var innerDiv = [];
      for (i = 0; i < kids.length; i++) walk(kids[i], innerDiv);
      var divHtml = innerDiv.join('').replace(/^(<br>)+|(<br>)+$/g, '');
      if (!divHtml) {
        out.push('<br>');
        return;
      }
      out.push('<p>' + divHtml + '</p>');
      return;
    }

    if (lower === 'a') {
      var href = sanitizeHref(node.getAttribute('href'));
      if (!href) {
        for (i = 0; i < kids.length; i++) walk(kids[i], out);
        return;
      }
      var extra = isExternalHref(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
      out.push('<a href="' + escapeHtml(href) + '"' + extra + '>');
      for (i = 0; i < kids.length; i++) walk(kids[i], out);
      out.push('</a>');
      return;
    }

    if (lower === 'h2' || lower === 'h3' || lower === 'p' || lower === 'strong' || lower === 'em') {
      out.push('<' + lower + '>');
      for (i = 0; i < kids.length; i++) walk(kids[i], out);
      out.push('</' + lower + '>');
      return;
    }

    for (i = 0; i < kids.length; i++) walk(kids[i], out);
  }

  function sanitizeHtml(html) {
    var raw = String(html == null ? '' : html);
    if (!raw.trim()) return '';
    var doc;
    try {
      doc = new DOMParser().parseFromString(raw, 'text/html');
    } catch (err) {
      return escapeHtml(raw).replace(/\n/g, '<br>');
    }
    var out = [];
    var children = doc.body ? doc.body.childNodes : [];
    var i;
    for (i = 0; i < children.length; i++) walk(children[i], out);
    var result = out.join('')
      .replace(/<p>\s*(<br>\s*)*<\/p>/gi, '')
      .replace(/(<br>\s*){3,}/g, '<br><br>')
      .replace(/^(<br>)+|(<br>)+$/g, '')
      .trim();
    if (!stripTags(result).trim()) return '';
    return result;
  }

  function stripTags(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function plainText(html) {
    if (html == null) return '';
    var raw = String(html);
    if (!LOOKS_LIKE_HTML.test(raw)) return raw.replace(/\s+/g, ' ').trim();
    return stripTags(sanitizeHtml(raw));
  }

  function render(html) {
    var raw = String(html == null ? '' : html).trim();
    if (!raw) return '';
    if (LOOKS_LIKE_HTML.test(raw)) return sanitizeHtml(raw);
    return escapeHtml(raw).replace(/\n/g, '<br>');
  }

  function hubSelectHtml() {
    return HUB_PAGES.map(function (group) {
      return '<optgroup label="' + escapeHtml(group.group) + '">' +
        group.items.map(function (item) {
          return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</option>';
        }).join('') +
        '</optgroup>';
    }).join('');
  }

  function currentBlockTag(editor) {
    var sel = global.getSelection && global.getSelection();
    if (!sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) return '';
    var node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    var block = node && node.closest ? node.closest('h2,h3,p,div') : null;
    return block && editor.contains(block) ? String(block.tagName || '').toLowerCase() : '';
  }

  function formatBlock(tag) {
    try { document.execCommand('formatBlock', false, tag); } catch (e1) { /* ignore */ }
    try { document.execCommand('formatBlock', false, '<' + tag + '>'); } catch (e2) { /* ignore */ }
  }

  function saveRange(editor) {
    var sel = global.getSelection && global.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== editor) return null;
    return range;
  }

  function restoreRange(range) {
    if (!range) return;
    var sel = global.getSelection && global.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function selectedText(range) {
    if (!range || range.collapsed) return '';
    return String(range.toString() || '').trim();
  }

  function normalizeWebUrl(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/^mailto:/i.test(s)) return sanitizeHref(s);
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return sanitizeHref(s);
  }

  function mount(textarea, opts) {
    if (!textarea || !global.document) return null;
    if (textarea._annRt) return textarea._annRt;
    opts = opts || {};
    mountCount += 1;
    var uid = String(mountCount);
    var placeholder = opts.placeholder || 'Write the announcement. Add a heading, emphasis, or a link.';

    var wrap = document.createElement('div');
    wrap.className = 'ann-rt-wrap';
    textarea.parentNode.insertBefore(wrap, textarea);
    wrap.appendChild(textarea);
    textarea.classList.add('ann-rt-src');
    textarea.setAttribute('tabindex', '-1');
    textarea.setAttribute('aria-hidden', 'true');

    var bar = document.createElement('div');
    bar.className = 'ann-rt-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Announcement formatting');
    bar.innerHTML =
      '<button type="button" data-cmd="bold" title="Bold"><strong>B</strong></button>' +
      '<button type="button" data-cmd="italic" title="Italic"><em>I</em></button>' +
      '<button type="button" data-cmd="h2" title="Heading">Heading</button>' +
      '<button type="button" data-cmd="h3" title="Subheading">Subheading</button>' +
      '<button type="button" data-cmd="link" title="Insert a link">Link</button>';

    var editor = document.createElement('div');
    editor.className = 'ann-rt-editor';
    editor.setAttribute('contenteditable', 'true');
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('aria-label', 'Announcement body');
    editor.setAttribute('data-placeholder', placeholder);

    var hint = document.createElement('p');
    hint.className = 'ann-rt-hint';
    hint.textContent = 'Headings, bold, italic, and links. Link to a Faculty Hub page or any website.';

    var linkBox = document.createElement('div');
    linkBox.className = 'ann-rt-link';
    linkBox.hidden = true;
    linkBox.innerHTML =
      '<div><label for="ann-rt-text-' + uid + '">Link text</label>' +
      '<input id="ann-rt-text-' + uid + '" class="ann-rt-link-text" type="text" placeholder="e.g. Open the Teacher Planner"></div>' +
      '<div><span class="ann-rt-legend">Goes to</span>' +
      '<div class="ann-rt-types">' +
      '<label><input type="radio" name="ann-rt-type-' + uid + '" value="hub" checked> Faculty Hub page</label>' +
      '<label><input type="radio" name="ann-rt-type-' + uid + '" value="web"> Website</label>' +
      '</div></div>' +
      '<div class="ann-rt-hub"><label for="ann-rt-hub-' + uid + '">Faculty Hub page</label>' +
      '<select id="ann-rt-hub-' + uid + '">' + hubSelectHtml() + '</select></div>' +
      '<div class="ann-rt-web" hidden><label for="ann-rt-url-' + uid + '">Website</label>' +
      '<input id="ann-rt-url-' + uid + '" class="ann-rt-link-url" type="url" placeholder="https://"></div>' +
      '<div class="ann-rt-link-actions">' +
      '<button type="button" class="ann-rt-link-insert">Insert link</button>' +
      '<button type="button" class="ann-rt-link-cancel">Cancel</button>' +
      '</div>';

    wrap.appendChild(bar);
    wrap.appendChild(editor);
    wrap.appendChild(linkBox);
    wrap.appendChild(hint);

    var savedRange = null;
    var textInput = linkBox.querySelector('.ann-rt-link-text');
    var urlInput = linkBox.querySelector('.ann-rt-link-url');
    var hubSelect = linkBox.querySelector('select');
    var hubRow = linkBox.querySelector('.ann-rt-hub');
    var webRow = linkBox.querySelector('.ann-rt-web');

    function syncTextarea() {
      var html = sanitizeHtml(editor.innerHTML);
      textarea.value = html;
      wrap.classList.toggle('is-empty', !plainText(html) && !plainText(editor.innerHTML));
    }

    function setHTML(html) {
      var safe = sanitizeHtml(html || '');
      editor.innerHTML = safe;
      textarea.value = safe;
      wrap.classList.toggle('is-empty', !plainText(safe));
    }

    function getHTML() {
      return sanitizeHtml(editor.innerHTML);
    }

    function updateType() {
      var hubOn = !!(linkBox.querySelector('input[value="hub"]') && linkBox.querySelector('input[value="hub"]').checked);
      hubRow.hidden = !hubOn;
      webRow.hidden = hubOn;
    }

    function closeLink() {
      linkBox.hidden = true;
    }

    function openLink() {
      savedRange = saveRange(editor);
      textInput.value = selectedText(savedRange);
      urlInput.value = '';
      var hubRadio = linkBox.querySelector('input[value="hub"]');
      if (hubRadio) hubRadio.checked = true;
      updateType();
      linkBox.hidden = false;
      setTimeout(function () { textInput.focus(); }, 0);
    }

    function insertLink() {
      var label = String(textInput.value || '').trim();
      var hubOn = !!(linkBox.querySelector('input[value="hub"]') && linkBox.querySelector('input[value="hub"]').checked);
      var href = hubOn ? hubHref(hubSelect.value) : normalizeWebUrl(urlInput.value);
      if (!href) {
        if (hubOn) href = hubHref('home');
        else return;
      }
      if (!label) {
        label = hubOn
          ? (hubSelect.options[hubSelect.selectedIndex] ? hubSelect.options[hubSelect.selectedIndex].text : 'Open in Faculty Hub')
          : href;
      }
      editor.focus();
      restoreRange(savedRange);
      document.execCommand('insertHTML', false, sanitizeHtml('<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a>'));
      closeLink();
      syncTextarea();
    }

    bar.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) e.preventDefault();
    });
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-cmd]');
      if (!btn) return;
      var cmd = btn.getAttribute('data-cmd');
      editor.focus();
      if (cmd === 'bold' || cmd === 'italic') {
        document.execCommand(cmd, false, null);
      } else if (cmd === 'h2' || cmd === 'h3') {
        formatBlock(currentBlockTag(editor) === cmd ? 'p' : cmd);
      } else if (cmd === 'link') {
        openLink();
        return;
      }
      syncTextarea();
    });

    editor.addEventListener('input', syncTextarea);
    editor.addEventListener('blur', function () {
      if (!plainText(editor.innerHTML)) editor.innerHTML = '';
      syncTextarea();
    });
    editor.addEventListener('paste', function (e) {
      if (!e.clipboardData) return;
      var pastedHtml = e.clipboardData.getData('text/html');
      var pastedText = e.clipboardData.getData('text/plain');
      e.preventDefault();
      if (pastedHtml && LOOKS_LIKE_HTML.test(pastedHtml)) {
        document.execCommand('insertHTML', false, sanitizeHtml(pastedHtml));
      } else {
        document.execCommand('insertText', false, pastedText || '');
      }
      syncTextarea();
    });
    textarea.addEventListener('focus', function () { editor.focus(); });

    linkBox.querySelector('.ann-rt-link-insert').addEventListener('click', insertLink);
    linkBox.querySelector('.ann-rt-link-cancel').addEventListener('click', closeLink);
    linkBox.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'ann-rt-type-' + uid) updateType();
    });
    linkBox.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLink();
        editor.focus();
      }
      if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        insertLink();
      }
    });

    setHTML(textarea.value || '');
    textarea._annRt = {
      setHTML: setHTML,
      getHTML: getHTML,
      focus: function () { editor.focus(); }
    };
    return textarea._annRt;
  }

  function read(el) {
    if (!el) return '';
    if (el._annRt) return el._annRt.getHTML();
    return sanitizeHtml(el.value || '');
  }

  function write(el, html) {
    if (!el) return;
    if (el._annRt) {
      el._annRt.setHTML(html || '');
      return;
    }
    el.value = html || '';
  }

  function onHubPage() {
    try {
      var file = String((global.location && global.location.pathname) || '').split('/').pop().toLowerCase();
      return file === HUB_FILE || file === 'faculty-hub';
    } catch (err) {
      return false;
    }
  }

  function bindHubLinks(root) {
    if (!global.document) return;
    if (!root || !root.addEventListener) root = global.document;
    if (root === global.document) {
      if (linksBound) return;
      linksBound = true;
    }
    root.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.ann-rich a, .ann-rt-editor a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var panel = parseHubPanel(href);
      if (!panel || !onHubPage() || typeof global.showPanel !== 'function') return;
      e.preventDefault();
      global.showPanel(panel);
    });
  }

  if (global.document && global.document.readyState !== 'loading') bindHubLinks(global.document);
  else if (global.document) global.document.addEventListener('DOMContentLoaded', function () { bindHubLinks(global.document); });

  global.AnnouncementRichText = {
    sanitize: sanitizeHtml,
    render: render,
    plainText: plainText,
    mount: mount,
    read: read,
    write: write,
    hubHref: hubHref,
    parseHubPanel: parseHubPanel,
    bindHubLinks: bindHubLinks
  };
})(typeof window !== 'undefined' ? window : this);
