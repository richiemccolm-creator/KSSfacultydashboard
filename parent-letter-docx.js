/**
 * Build a minimal .docx (Word) parent letter focused on effort and/or behaviour only.
 * Requires JSZip (cdnjs) loaded before this script.
 */
(function (global) {
  function letterDocxEsc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function letterDocxPara(text, opts) {
    opts = opts || {};
    var bold = opts.bold ? '<w:b/>' : '';
    var size = opts.size || 22;
    var spaceAfter = opts.spaceAfter !== undefined ? opts.spaceAfter : 120;
    var spaceBefore = opts.spaceBefore || 0;
    var t = text === undefined || text === null ? '' : String(text);
    return (
      '<w:p><w:pPr><w:spacing w:before="' +
      spaceBefore +
      '" w:after="' +
      spaceAfter +
      '"/></w:pPr><w:r><w:rPr>' +
      bold +
      '<w:sz w:val="' +
      size +
      '"/><w:szCs w:val="' +
      size +
      '"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t xml:space="preserve">' +
      letterDocxEsc(t) +
      '</w:t></w:r></w:p>'
    );
  }

  /** Top margin ~2.25in (twips) to leave room for pre-printed letterhead */
  function letterGenerateDocxBlob(bodyXml) {
    var topMar = '3240';
    var docXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      bodyXml +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="' +
      topMar +
      '" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>';
    var zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    );
    zip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    zip.file('word/document.xml', docXml);
    zip.file(
      'word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    );
    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  function isEffortBehaviourLetterEligible(p) {
    if (!p || !p.avgs) return false;
    var e = p.avgs.effort;
    var b = p.avgs.behaviour;
    return (e != null && e <= 2.5) || (b != null && b <= 2.5);
  }

  function pupilFirstName(fullName) {
    var parts = String(fullName || '')
      .trim()
      .split(/\s+/);
    return parts[0] || 'your child';
  }

  function dimLabel(d) {
    return d === 'effort' ? 'Effort' : 'Behaviour';
  }

  function buildParentConcernLetterBody(p) {
    var subjLbl = p.subject === 'drama' ? 'Drama' : 'Art & Design';
    var ygLbl = (p.yg || '').toUpperCase();
    var cls = (p.cls || '—').trim() || '—';
    var teacher = (p.teacher || '').trim() || '—';
    var first = pupilFirstName(p.name);
    var focusDims = ['effort', 'behaviour'].filter(function (d) {
      return p.avgs[d] != null && p.avgs[d] <= 2.5;
    });
    var topicPhrase =
      focusDims.length === 2
        ? 'effort and behaviour'
        : focusDims[0] === 'effort'
          ? 'effort'
          : 'behaviour';

    var now = new Date();
    var dateLong = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    var body = '';
    body += letterDocxPara(dateLong, { size: 22, spaceAfter: 240 });
    body += letterDocxPara(
      'Re: ' +
        (p.name || 'Pupil') +
        ' — ' +
        cls +
        ' (' +
        ygLbl +
        ') — ' +
        subjLbl,
      { bold: true, spaceAfter: 280 }
    );
    body += letterDocxPara('Dear Parent/Carer,', { spaceAfter: 200 });

    body += letterDocxPara(
      'We are writing regarding ' +
        first +
        '’s ' +
        topicPhrase +
        ' in ' +
        subjLbl +
        '. Staff record ' +
        (focusDims.length === 2 ? 'these' : 'this') +
        ' using a 1–4 scale, where higher scores reflect the engagement and conduct we expect during lessons.',
      { spaceAfter: 200 }
    );

    if (focusDims.length) {
      body += letterDocxPara('Based on our latest tracking:', { spaceAfter: 120 });
      focusDims.forEach(function (d) {
        body += letterDocxPara(
          '• ' + dimLabel(d) + ': average ' + Number(p.avgs[d]).toFixed(1) + ' / 4',
          { spaceAfter: 72 }
        );
      });
      body += letterDocxPara('', { spaceAfter: 160 });
    }

    body += letterDocxPara(
      'We would welcome your support in reinforcing our expectations at home so that ' +
        first +
        ' can get the most from ' +
        subjLbl +
        '. ' +
        first +
        '’s class teacher for this subject is ' +
        teacher +
        '. If you would like to discuss this further, please contact the school and ask for the Expressive Arts department or your child’s pastoral head of house.',
      { spaceAfter: 220 }
    );

    body += letterDocxPara('Yours sincerely,', { spaceAfter: 320 });
    body += letterDocxPara('______________________________', { spaceAfter: 80 });
    body += letterDocxPara('Expressive Arts (Faculty)', { spaceAfter: 280 });
    body += letterDocxPara(
      'Print on school letterhead.',
      { size: 18, spaceAfter: 0, spaceBefore: 120 }
    );
    body += letterDocxPara(
      'Generated from Faculty Head Dashboard · ' + now.toLocaleString('en-GB'),
      { size: 18, spaceAfter: 0 }
    );

    return body;
  }

  function safeFilename(name) {
    var s = String(name || 'pupil').replace(/[^\w\-]+/g, '_').replace(/^_|_$/g, '');
    return (s || 'pupil').slice(0, 80);
  }

  function download(p, toastFn) {
    if (typeof JSZip === 'undefined') {
      if (toastFn) toastFn('Document library not loaded');
      return;
    }
    if (!isEffortBehaviourLetterEligible(p)) {
      if (toastFn) toastFn('Letter is only available when effort or behaviour is below expectations');
      return;
    }
    var bodyXml;
    try {
      bodyXml = buildParentConcernLetterBody(p);
    } catch (e) {
      if (toastFn) toastFn('Could not create document');
      return;
    }
    letterGenerateDocxBlob(bodyXml)
      .then(function (blob) {
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1);
        if (m.length === 1) m = '0' + m;
        var day = String(d.getDate());
        if (day.length === 1) day = '0' + day;
        a.href = url;
        a.download = 'Parent-letter_' + safeFilename(p.name) + '_' + y + '-' + m + '-' + day + '.docx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (toastFn) toastFn('Letter downloaded');
      })
      .catch(function () {
        if (toastFn) toastFn('Could not create document');
      });
  }

  global.ParentLetterDocx = {
    download: download,
    isEffortBehaviourLetterEligible: isEffortBehaviourLetterEligible,
  };
})(typeof window !== 'undefined' ? window : this);
