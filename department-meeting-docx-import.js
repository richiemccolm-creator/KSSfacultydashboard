/**
 * Parse the official DM Word template into agenda rows + optional metadata.
 */
(function(global) {
  function norm(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function headerKind(cellText) {
    var t = norm(cellText).toLowerCase();
    if (!t) return '';
    if (t.indexOf('agenda') >= 0 && t.indexOf('item') >= 0) return 'agenda_item';
    if (t.indexOf('details') >= 0 || t.indexOf('description') >= 0) return 'details';
    if (t.indexOf('time') >= 0) return 'time_allocated';
    if (t.indexOf('minute') >= 0) return 'minutes';
    if (t.indexOf('action') >= 0) return 'action_items';
    return '';
  }

  function parseTemplateTable(doc) {
    var tables = Array.prototype.slice.call(doc.querySelectorAll('table'));
    var best = null;
    tables.forEach(function(table) {
      var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
      if (!rows.length) return;
      var firstCells = Array.prototype.slice.call(rows[0].querySelectorAll('th,td')).map(function(c) {
        return norm(c.textContent);
      });
      if (firstCells.length < 3) return;
      var map = {};
      firstCells.forEach(function(text, idx) {
        var k = headerKind(text);
        if (k && map[k] == null) map[k] = idx;
      });
      var score = 0;
      if (map.agenda_item != null) score += 2;
      if (map.details != null) score += 2;
      if (map.time_allocated != null) score += 2;
      if (map.minutes != null) score += 1;
      if (map.action_items != null) score += 1;
      if (score < 6) return;
      if (!best || score > best.score) {
        best = { table: table, map: map, score: score, rowCount: rows.length };
      }
    });
    if (!best) {
      throw new Error('Template mismatch: could not find the DM agenda table.');
    }

    var bodyRows = Array.prototype.slice.call(best.table.querySelectorAll('tr')).slice(1);
    var parsed = [];
    bodyRows.forEach(function(tr) {
      var cells = Array.prototype.slice.call(tr.querySelectorAll('th,td')).map(function(c) {
        return norm(c.textContent);
      });
      if (!cells.length) return;
      var agenda = cells[best.map.agenda_item] || '';
      var details = cells[best.map.details] || '';
      var time = cells[best.map.time_allocated] || '';
      var minutes = best.map.minutes != null ? (cells[best.map.minutes] || '') : '';
      var actions = best.map.action_items != null ? (cells[best.map.action_items] || '') : '';
      if (!agenda && !details && !time && !minutes && !actions) return;
      parsed.push({
        agenda_item: agenda,
        details: details,
        time_allocated: time,
        minutes: minutes,
        action_items: actions
      });
    });

    if (!parsed.length) {
      throw new Error('Template mismatch: no agenda rows were found in the table.');
    }
    return parsed;
  }

  function asIsoDate(year, month, day) {
    var y = Number(year);
    var m = Number(month);
    var d = Number(day);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
    if (y < 100) y += 2000;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== m - 1 ||
      dt.getUTCDate() !== d
    ) {
      return '';
    }
    var mm = String(m).padStart(2, '0');
    var dd = String(d).padStart(2, '0');
    return String(y) + '-' + mm + '-' + dd;
  }

  function monthIndex(name) {
    var key = norm(name).toLowerCase().slice(0, 3);
    var map = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };
    return map[key] || 0;
  }

  function parseDateFromText(text) {
    var s = norm(text);
    if (!s) return '';

    var m;
    m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (m) return asIsoDate(m[1], m[2], m[3]);

    m = s.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
    if (m) return asIsoDate(m[3], m[2], m[1]);

    m = s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b/);
    if (m) {
      var monA = monthIndex(m[1]);
      if (monA) return asIsoDate(m[3], monA, m[2]);
    }

    m = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
    if (m) {
      var monB = monthIndex(m[2]);
      if (monB) return asIsoDate(m[3], monB, m[1]);
    }
    return '';
  }

  function firstNonEmpty(lines) {
    for (var i = 0; i < lines.length; i++) {
      if (lines[i]) return lines[i];
    }
    return '';
  }

  function extractMetadata(doc, rawText) {
    var lines = String(rawText || '').split(/\r?\n/).map(norm).filter(Boolean);
    var title = '';
    var meetingDate = '';

    var heading = doc.querySelector('h1,h2,h3');
    if (heading) title = norm(heading.textContent);

    if (!title) {
      for (var i = 0; i < lines.length; i++) {
        if (/department\s*meeting/i.test(lines[i])) {
          title = lines[i];
          break;
        }
      }
    }
    if (!title) title = firstNonEmpty(lines.slice(0, 6));

    for (var j = 0; j < lines.length; j++) {
      var ln = lines[j];
      if (/meeting\s*date|date/i.test(ln)) {
        meetingDate = parseDateFromText(ln);
        if (meetingDate) break;
      }
    }
    if (!meetingDate) {
      for (var k = 0; k < lines.length; k++) {
        meetingDate = parseDateFromText(lines[k]);
        if (meetingDate) break;
      }
    }

    return {
      title: title || '',
      meeting_date: meetingDate || ''
    };
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
      var rows = parseTemplateTable(doc);
      var textPromise = (global.mammoth.extractRawText && typeof global.mammoth.extractRawText === 'function')
        ? global.mammoth.extractRawText({ arrayBuffer: arrayBuffer }).then(function(r) { return r.value || ''; }).catch(function() { return doc.body ? (doc.body.textContent || '') : ''; })
        : Promise.resolve(doc.body ? (doc.body.textContent || '') : '');
      return textPromise.then(function(rawText) {
        var meta = extractMetadata(doc, rawText);
        return {
          rows: rows,
          title: meta.title,
          meeting_date: meta.meeting_date
        };
      });
    });
  }

  function parseFile(file) {
    if (!file) return Promise.reject(new Error('No file selected.'));
    var name = String(file.name || '').toLowerCase();
    if (!/\.docx$/.test(name)) {
      return Promise.reject(new Error('Please upload a .docx Word document.'));
    }
    return file.arrayBuffer().then(parseArrayBuffer);
  }

  global.DepartmentMeetingDocxImport = {
    parseFile: parseFile,
    parseArrayBuffer: parseArrayBuffer
  };
})(typeof window !== 'undefined' ? window : this);
