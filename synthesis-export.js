/**
 * Export year-end synthesis plan as a Word-compatible document.
 */
(function() {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildWordHtml(plan) {
    var evidence = plan.evidence_snapshot || {};
    var summary = evidence.summary || {};
    var sy = plan.school_year || '';
    var planFor = plan.plan_for_year || '';
    var date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><meta charset="utf-8"><title>Faculty Improvement Plan ' + esc(planFor) + '</title>';
    html += '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->';
    html += '<style>';
    html += 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a202c;line-height:1.5;margin:2cm;}';
    html += 'h1{font-size:20pt;color:#1e2d4a;margin:0 0 6pt 0;}';
    html += 'h2{font-size:14pt;color:#1e2d4a;margin:18pt 0 8pt 0;border-bottom:1pt solid #cbd5e0;padding-bottom:4pt;}';
    html += 'h3{font-size:12pt;color:#0d9488;margin:12pt 0 4pt 0;}';
    html += '.meta{font-size:10pt;color:#4a5568;margin-bottom:16pt;}';
    html += '.box{background:#f8fafc;border:1pt solid #e2e8f0;padding:10pt;margin:8pt 0;}';
    html += '.strength{background:#f0fdf4;border-left:3pt solid #22c55e;padding:8pt 10pt;margin:6pt 0;}';
    html += '.priority{margin:10pt 0;padding:10pt;border:1pt solid #e2e8f0;}';
    html += '.tag{font-size:9pt;color:#0d9488;font-weight:bold;text-transform:uppercase;}';
    html += 'ul{margin:4pt 0 4pt 18pt;} li{margin:2pt 0;}';
    html += '</style></head><body>';

    html += '<h1>Faculty Improvement Plan</h1>';
    html += '<p class="meta"><strong>Knightswood Secondary School</strong> · Expressive Arts Faculty<br>';
    html += 'Evaluated year: <strong>' + esc(sy) + '</strong> · Plan for: <strong>' + esc(planFor) + '</strong><br>';
    html += 'Generated: ' + esc(date) + '</p>';

    html += '<h2>Evidence summary</h2><div class="box">';
    html += esc(summary.surveyCount || 0) + ' survey upload(s)';
    if (summary.surveyResponses) html += ' · ' + summary.surveyResponses + ' responses';
    html += ' · ' + (summary.focusGroupCount || 0) + ' focus groups';
    html += ' · ' + (summary.observationCount || 0) + ' exported observations';
    html += ' · DIP tracker ' + (summary.dipTrackerPercent != null ? summary.dipTrackerPercent : '—') + '% complete';
    html += summary.dipEvalComplete ? ' · DIP self-evaluation recorded' : '';
    html += '</div>';

    var sourceDetails = evidence.sourceDetails;
    if (sourceDetails && (sourceDetails.themeSummary || []).length) {
      html += '<h2>Cross-source themes</h2><div class="box"><ul>';
      sourceDetails.themeSummary.forEach(function(t) {
        html += '<li><strong>' + esc(t.themeLabel) + '</strong> — ' + esc((t.sources || []).join(', '));
        if (t.sources.length >= 2) html += ' (triangulated)';
        html += '</li>';
      });
      html += '</ul></div>';
    }

    if ((plan.strengths || []).length) {
      html += '<h2>Strengths to sustain</h2>';
      (plan.strengths || []).forEach(function(s) {
        html += '<div class="strength">' + esc(s.text || s) + '</div>';
      });
    }

    if (plan.manual_notes) {
      html += '<h2>Faculty Head observations</h2>';
      html += '<div class="box">' + esc(plan.manual_notes).replace(/\n/g, '<br>') + '</div>';
    }

    var narrative = plan.next_year_plan && plan.next_year_plan.narrative;
    if (narrative) {
      html += '<h2>Plan introduction</h2>';
      html += '<div class="box">' + esc(narrative).replace(/\n/g, '<br>') + '</div>';
    }

    var accepted = plan.accepted_priorities || [];
    if (accepted.length) {
      html += '<h2>Priorities for ' + esc(planFor) + '</h2>';
      accepted.forEach(function(p, i) {
        html += '<div class="priority">';
        html += '<h3>Priority ' + (i + 1) + ': ' + esc(p.title || p.themeLabel || 'Improvement') + '</h3>';
        if (p.sources && p.sources.length) {
          html += '<p class="tag">Sources: ' + esc(p.sources.join(', ')) + '</p>';
        }
        html += '<p>' + esc(p.text || p.rationale || '') + '</p>';
        if (p.actions && p.actions.length) {
          html += '<p><strong>Actions:</strong></p><ul>';
          p.actions.forEach(function(a) { html += '<li>' + esc(a) + '</li>'; });
          html += '</ul>';
        }
        html += '</div>';
      });
    }

    var triangulated = (plan.suggested_priorities || []).filter(function(s) {
      return s.triangulated && s.status === 'pending';
    });
    if (triangulated.length) {
      html += '<h2>Triangulated suggestions (pending review)</h2>';
      triangulated.forEach(function(s) {
        html += '<div class="priority"><p class="tag">' + esc((s.sources || []).join(' · ')) + '</p>';
        html += '<p><strong>' + esc(s.themeLabel || s.theme) + '</strong> — ' + esc(s.text) + '</p></div>';
      });
    }

    if (evidence.dipEval) {
      html += '<h2>DIP self-evaluation snapshot</h2><div class="box">';
      if (evidence.dipEval.period) html += '<p><strong>Period:</strong> ' + esc(evidence.dipEval.period) + '</p>';
      if (evidence.dipEval.overall) html += '<p><strong>Overall:</strong> ' + esc(evidence.dipEval.overall) + '</p>';
      if (evidence.dipEval.next) html += '<p><strong>Next steps:</strong> ' + esc(evidence.dipEval.next) + '</p>';
      html += '</div>';
    }

    html += '</body></html>';
    return html;
  }

  window.SynthesisExport = {
    buildWordHtml: buildWordHtml,

    downloadWord: function(plan) {
      plan = plan || {};
      var html = buildWordHtml(plan);
      var planFor = (plan.plan_for_year || 'plan').replace(/\s+/g, '_');
      var blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Faculty_Improvement_Plan_' + planFor + '.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
    }
  };
})();
