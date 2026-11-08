/**
 * Small Excel (.xlsx) writer for the faculty tracking export.
 *
 * Written here rather than loaded from a CDN so pupil data never passes through a third-party
 * library. Text is stored as plain text cells, never as formulas, so nothing a pupil or teacher
 * typed can run when the file is opened.
 *
 * build(sheets) returns a Uint8Array. A sheet is:
 *   { name, columns: [{ label, band, width, wide }], rows: [[value | { v, s }]],
 *     freezeCols, tab, headerless, filter }
 * s is a style name from STYLE below.
 */
(function(root) {
  'use strict';

  var MAX_CELL = 32767;

  // Index in cellXfs in styles().
  var STYLE = { plain: 0, header: 1, headerBand: 2, wrap: 3, title: 4, note: 5, ok: 6, bad: 7, bold: 8, warn: 9 };

  function clean(value) {
    var s = String(value)
      // Characters XML does not allow, and lone surrogates.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
      .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1');
    return s.length > MAX_CELL ? s.slice(0, MAX_CELL) : s;
  }

  function xml(value) {
    return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function colName(index) {
    var n = index + 1;
    var out = '';
    while (n > 0) {
      var r = (n - 1) % 26;
      out = String.fromCharCode(65 + r) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  function cellXml(ref, raw, defaultStyle) {
    var value = raw;
    var style = defaultStyle;
    if (raw && typeof raw === 'object' && 'v' in raw) {
      value = raw.v;
      if (raw.s && STYLE[raw.s] != null) style = STYLE[raw.s];
    }
    if (value === null || value === undefined || value === '') {
      return style ? '<c r="' + ref + '" s="' + style + '"/>' : '';
    }
    var attr = style ? ' s="' + style + '"' : '';
    if (typeof value === 'number' && isFinite(value)) {
      return '<c r="' + ref + '"' + attr + '><v>' + value + '</v></c>';
    }
    if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
    return '<c r="' + ref + '"' + attr + ' t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
  }

  function cellText(raw) {
    var value = raw && typeof raw === 'object' && 'v' in raw ? raw.v : raw;
    return value === null || value === undefined ? '' : String(value);
  }

  function columnWidths(sheet) {
    return sheet.columns.map(function(col, c) {
      if (col.width) return col.width;
      var longest = 0;
      sheet.rows.forEach(function(row) {
        var text = cellText(row[c]);
        if (text.length > longest) longest = text.length;
      });
      var label = String(col.label || '');
      // Headers wrap, so a long header needs only a little width.
      var head = Math.min(Math.ceil(label.length / 2) + 2, 16);
      return Math.max(8, head, Math.min(longest + 2, col.wide ? 60 : 30));
    });
  }

  function headerHeight(sheet, widths) {
    var lines = 1;
    sheet.columns.forEach(function(col, c) {
      var n = Math.ceil(String(col.label || '').length / Math.max(widths[c] - 1, 1));
      if (n > lines) lines = n;
    });
    return Math.min(16 * lines + 6, 96);
  }

  function sheetXml(sheet, index) {
    var widths = columnWidths(sheet);
    var colCount = Math.max(sheet.columns.length, 1);
    var rowsOut = [];
    var rowNum = 1;

    if (!sheet.headerless) {
      var head = sheet.columns.map(function(col, c) {
        return cellXml(colName(c) + rowNum, col.label, col.band ? STYLE.headerBand : STYLE.header);
      }).join('');
      rowsOut.push('<row r="1" ht="' + headerHeight(sheet, widths) + '" customHeight="1">' + head + '</row>');
      rowNum = 2;
    }

    sheet.rows.forEach(function(row) {
      var cells = '';
      for (var c = 0; c < colCount; c++) {
        var col = sheet.columns[c] || {};
        cells += cellXml(colName(c) + rowNum, row[c], col.wide ? STYLE.wrap : STYLE.plain);
      }
      rowsOut.push('<row r="' + rowNum + '">' + cells + '</row>');
      rowNum++;
    });

    var lastRow = Math.max(rowNum - 1, 1);
    var range = 'A1:' + colName(colCount - 1) + lastRow;
    var freezeRows = sheet.headerless ? 0 : 1;
    var freezeCols = sheet.freezeCols || 0;
    var pane = '';
    if (freezeRows || freezeCols) {
      var active = freezeRows && freezeCols ? 'bottomRight' : freezeRows ? 'bottomLeft' : 'topRight';
      pane = '<pane' +
        (freezeCols ? ' xSplit="' + freezeCols + '"' : '') +
        (freezeRows ? ' ySplit="' + freezeRows + '"' : '') +
        ' topLeftCell="' + colName(freezeCols) + (freezeRows + 1) + '" activePane="' + active + '" state="frozen"/>';
    }
    var hasFilter = !sheet.headerless && sheet.filter !== false && sheet.rows.length > 0;
    return {
      filterRange: hasFilter ? range : null,
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        (sheet.tab ? '<sheetPr><tabColor rgb="FF' + sheet.tab + '"/></sheetPr>' : '') +
        '<dimension ref="' + range + '"/>' +
        '<sheetViews><sheetView workbookViewId="0"' + (index === 0 ? ' tabSelected="1"' : '') +
        (sheet.headerless ? ' showGridLines="0"' : '') + '>' + pane + '</sheetView></sheetViews>' +
        '<sheetFormatPr defaultRowHeight="15"/>' +
        '<cols>' + widths.map(function(w, c) {
          return '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + w + '" customWidth="1"/>';
        }).join('') + '</cols>' +
        '<sheetData>' + rowsOut.join('') + '</sheetData>' +
        (hasFilter ? '<autoFilter ref="' + range + '"/>' : '') +
        '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
        '<pageSetup orientation="landscape" fitToHeight="0"/>' +
        '</worksheet>'
    };
  }

  function styles() {
    function fill(rgb) {
      return '<fill><patternFill patternType="solid"><fgColor rgb="FF' + rgb + '"/><bgColor indexed="64"/></patternFill></fill>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="6">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="16"/><color rgb="FF1E2D4A"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF991B1B"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF166534"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="7">' +
      '<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      fill('1E2D4A') + fill('3A5A8C') + fill('FEE2E2') + fill('DCFCE7') + fill('FEF3C7') +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="10">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="5" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="4" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  function safeSheetNames(sheets) {
    var used = {};
    return sheets.map(function(sheet) {
      var base = String(sheet.name || 'Sheet').replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Sheet';
      var name = base;
      var n = 2;
      while (used[name.toLowerCase()]) {
        var suffix = ' ' + n++;
        name = base.slice(0, 31 - suffix.length) + suffix;
      }
      used[name.toLowerCase()] = true;
      return name;
    });
  }

  // ── zip (stored, no compression, so no library is needed) ──
  var CRC_TABLE = (function() {
    var table = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files, when) {
    var encoder = new TextEncoder();
    var dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
    var dosDate = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
    var parts = [];
    var central = [];
    var offset = 0;

    function header(size) {
      var bytes = new Uint8Array(size);
      return { bytes: bytes, view: new DataView(bytes.buffer) };
    }

    files.forEach(function(file) {
      var name = encoder.encode(file.path);
      var data = encoder.encode(file.text);
      var crc = crc32(data);

      var local = header(30);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x0800, true); // names are UTF-8
      local.view.setUint16(8, 0, true); // stored
      local.view.setUint16(10, dosTime, true);
      local.view.setUint16(12, dosDate, true);
      local.view.setUint32(14, crc, true);
      local.view.setUint32(18, data.length, true);
      local.view.setUint32(22, data.length, true);
      local.view.setUint16(26, name.length, true);
      parts.push(local.bytes, name, data);

      var entry = header(46);
      entry.view.setUint32(0, 0x02014b50, true);
      entry.view.setUint16(4, 20, true);
      entry.view.setUint16(6, 20, true);
      entry.view.setUint16(8, 0x0800, true);
      entry.view.setUint16(10, 0, true);
      entry.view.setUint16(12, dosTime, true);
      entry.view.setUint16(14, dosDate, true);
      entry.view.setUint32(16, crc, true);
      entry.view.setUint32(20, data.length, true);
      entry.view.setUint32(24, data.length, true);
      entry.view.setUint16(28, name.length, true);
      entry.view.setUint32(42, offset, true);
      central.push(entry.bytes, name);

      offset += local.bytes.length + name.length + data.length;
    });

    var centralSize = central.reduce(function(sum, part) { return sum + part.length; }, 0);
    var end = header(22);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(8, files.length, true);
    end.view.setUint16(10, files.length, true);
    end.view.setUint32(12, centralSize, true);
    end.view.setUint32(16, offset, true);

    var all = parts.concat(central, [end.bytes]);
    var total = all.reduce(function(sum, part) { return sum + part.length; }, 0);
    var out = new Uint8Array(total);
    var at = 0;
    all.forEach(function(part) {
      out.set(part, at);
      at += part.length;
    });
    return out;
  }

  function definedNames(built, names) {
    var inner = built.map(function(s, i) {
      if (!s.filterRange) return '';
      var abs = s.filterRange.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2');
      return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' +
        xml(names[i].replace(/'/g, "''")) + '\'!' + abs + '</definedName>';
    }).join('');
    return inner ? '<definedNames>' + inner + '</definedNames>' : '';
  }

  function build(sheets, when) {
    if (!sheets || !sheets.length) throw new Error('Nothing to write.');
    var names = safeSheetNames(sheets);
    var built = sheets.map(sheetXml);
    var files = [{
      path: '[Content_Types].xml',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        built.map(function(_s, i) {
          return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }).join('') +
        '</Types>'
    }, {
      path: '_rels/.rels',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'
    }, {
      path: 'xl/workbook.xml',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets>' + names.map(function(name, i) {
          return '<sheet name="' + xml(name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
        }).join('') + '</sheets>' +
        definedNames(built, names) +
        '</workbook>'
    }, {
      path: 'xl/_rels/workbook.xml.rels',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        built.map(function(_s, i) {
          return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
        }).join('') +
        '<Relationship Id="rId' + (built.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'
    }, { path: 'xl/styles.xml', text: styles() }];
    built.forEach(function(s, i) {
      files.push({ path: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: s.xml });
    });
    return zip(files, when || new Date());
  }

  root.TrackerExportXlsx = { build: build, colName: colName, clean: clean, safeSheetNames: safeSheetNames };
})(typeof window !== 'undefined' ? window : globalThis);
