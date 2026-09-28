/**
 * Reads announcements from Word files made with the old import template,
 * so those files still work in the "Draft with AI" upload.
 */
(function(global) {
  function norm(s) {
    return String(s == null ? '' : s).replace(/\r/g, '').trim();
  }

  function normalizePriority(v) {
    var p = String(v || '').trim().toLowerCase();
    if (p === 'low' || p === 'medium' || p === 'high') return p;
    return 'none';
  }

  function normalizeBool(v) {
    var t = String(v || '').trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'yes' || t === 'y' || t === 'on';
  }

  function asIsoDate(year, month, day) {
    var y = Number(year);
    var m = Number(month);
    var d = Number(day);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
    if (y < 100) y += 2000;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
    return String(y) + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function monthIndex(name) {
    var key = norm(name).toLowerCase().slice(0, 3);
    var map = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    return map[key] || 0;
  }

  function parseDate(value) {
    var s = norm(value);
    if (!s) return '';
    var m;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return asIsoDate(m[1], m[2], m[3]);
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (m) return asIsoDate(m[3], m[2], m[1]);
    m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/);
    if (m) {
      var monA = monthIndex(m[1]);
      if (monA) return asIsoDate(m[3], monA, m[2]);
    }
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
    if (m) {
      var monB = monthIndex(m[2]);
      if (monB) return asIsoDate(m[3], monB, m[1]);
    }
    return '';
  }

  function finalizeBlock(current, out, warnings) {
    if (!current || !norm(current.title)) return;
    var expiresRaw = norm(current.expires_at);
    var expires = parseDate(expiresRaw);
    if (expiresRaw && !expires) warnings.push('One entry had an invalid date and was imported with no expiry.');
    var priorityRaw = norm(current.priority);
    var priority = normalizePriority(priorityRaw);
    if (priorityRaw && priorityRaw !== priority) warnings.push('One entry had an unknown priority and was imported as "none".');
    out.push({
      title: norm(current.title),
      body: norm(current.body) || null,
      expires_at: expires || null,
      priority: priority,
      highlight_priority: normalizeBool(current.highlight_priority || current.highlight),
      featured_banner: normalizeBool(current.featured_banner || current.banner || current.featured)
    });
  }

  function parseBlocksFromRawText(rawText) {
    var warnings = [];
    var out = [];
    var lines = String(rawText || '').split(/\n/).map(function(line) { return line.replace(/\t/g, ' ').trimRight(); });
    var current = null;
    var currentField = '';
    var keyRe = /^(title|body|expires|expires_at|priority|highlight|highlight_priority|featured_banner|banner|featured)\s*:\s*(.*)$/i;
    var sepRe = /^-{3,}\s*$/;

    function ensureCurrent() {
      if (!current) current = { title: '', body: '', expires_at: '', priority: '', highlight_priority: '', featured_banner: '' };
    }

    lines.forEach(function(line) {
      var text = line.trim();
      if (!text) {
        if (currentField === 'body' && current) {
          current.body = (current.body ? current.body + '\n' : '') + '';
        }
        return;
      }
      if (sepRe.test(text)) {
        finalizeBlock(current, out, warnings);
        current = null;
        currentField = '';
        return;
      }
      var keyMatch = text.match(keyRe);
      if (keyMatch) {
        var key = keyMatch[1].toLowerCase();
        var val = keyMatch[2] || '';
        if (key === 'title' && current && norm(current.title)) {
          finalizeBlock(current, out, warnings);
          current = null;
        }
        ensureCurrent();
        if (key === 'expires') key = 'expires_at';
        if (key === 'highlight') key = 'highlight_priority';
        if (key === 'banner' || key === 'featured') key = 'featured_banner';
        current[key] = val;
        currentField = key;
        return;
      }
      ensureCurrent();
      if (!current.title) {
        current.title = text;
        currentField = 'title';
        return;
      }
      if (currentField === 'body' || current.body) {
        current.body = current.body ? (current.body + '\n' + text) : text;
      } else {
        current.body = text;
        currentField = 'body';
      }
    });
    finalizeBlock(current, out, warnings);
    return { announcements: out, warnings: warnings };
  }

  function tableHeaderKey(s) {
    var t = norm(s).toLowerCase();
    if (!t) return '';
    if (t.indexOf('title') >= 0) return 'title';
    if (t.indexOf('body') >= 0 || t.indexOf('message') >= 0 || t.indexOf('details') >= 0) return 'body';
    if (t.indexOf('expire') >= 0 || t.indexOf('date') >= 0) return 'expires_at';
    if (t.indexOf('priority') >= 0) return 'priority';
    if (t.indexOf('highlight') >= 0 || t.indexOf('shade') >= 0) return 'highlight_priority';
    if (t.indexOf('banner') >= 0 || t.indexOf('featured') >= 0) return 'featured_banner';
    return '';
  }

  function parseFromHtmlTables(doc) {
    var tables = Array.prototype.slice.call(doc.querySelectorAll('table'));
    var bestRows = [];
    var bestMap = null;
    tables.forEach(function(table) {
      var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
      if (rows.length < 2) return;
      var headers = Array.prototype.slice.call(rows[0].querySelectorAll('th,td')).map(function(c) { return norm(c.textContent); });
      var map = {};
      headers.forEach(function(h, idx) {
        var k = tableHeaderKey(h);
        if (k && map[k] == null) map[k] = idx;
      });
      if (map.title == null) return;
      if (!bestMap || Object.keys(map).length > Object.keys(bestMap).length) {
        bestMap = map;
        bestRows = rows.slice(1);
      }
    });
    if (!bestMap) return { announcements: [], warnings: [] };
    var warnings = [];
    var out = [];
    bestRows.forEach(function(row) {
      var cells = Array.prototype.slice.call(row.querySelectorAll('th,td')).map(function(c) { return norm(c.textContent); });
      var title = bestMap.title != null ? cells[bestMap.title] || '' : '';
      if (!title) return;
      finalizeBlock({
        title: title,
        body: bestMap.body != null ? (cells[bestMap.body] || '') : '',
        expires_at: bestMap.expires_at != null ? (cells[bestMap.expires_at] || '') : '',
        priority: bestMap.priority != null ? (cells[bestMap.priority] || '') : '',
        highlight_priority: bestMap.highlight_priority != null ? (cells[bestMap.highlight_priority] || '') : '',
        featured_banner: bestMap.featured_banner != null ? (cells[bestMap.featured_banner] || '') : ''
      }, out, warnings);
    });
    return { announcements: out, warnings: warnings };
  }

  function ensureMammoth() {
    if (!global.mammoth || typeof global.mammoth.convertToHtml !== 'function') {
      throw new Error('Word import is unavailable right now. Refresh and try again.');
    }
  }

  function parseArrayBuffer(arrayBuffer) {
    ensureMammoth();
    return global.mammoth.convertToHtml({ arrayBuffer: arrayBuffer }).then(function(result) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(result.value || '', 'text/html');
      var tableParsed = parseFromHtmlTables(doc);
      if (tableParsed.announcements.length) return tableParsed;
      var textPromise = (global.mammoth.extractRawText && typeof global.mammoth.extractRawText === 'function')
        ? global.mammoth.extractRawText({ arrayBuffer: arrayBuffer }).then(function(r) { return r.value || ''; })
        : Promise.resolve(doc.body ? (doc.body.textContent || '') : '');
      return textPromise.then(function(rawText) {
        return parseBlocksFromRawText(rawText);
      });
    });
  }

  function parseFile(file) {
    if (!file) return Promise.reject(new Error('No file selected.'));
    var name = String(file.name || '').toLowerCase();
    if (!/\.docx$/.test(name)) return Promise.reject(new Error('Please upload a .docx Word document.'));
    return file.arrayBuffer().then(parseArrayBuffer);
  }

  global.AnnouncementDocxImport = {
    parseFile: parseFile,
    parseArrayBuffer: parseArrayBuffer
  };
})(typeof window !== 'undefined' ? window : this);
