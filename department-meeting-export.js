/**
 * Export department meeting agenda table to a Word-openable .doc (HTML MIME).
 */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeFilename(title, dateStr) {
    var base = (title || 'Department-meeting').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 48);
    var d = (dateStr || '').replace(/[^\d-]/g, '');
    return (base || 'Department-meeting') + (d ? '-' + d : '');
  }

  /**
   * @param {{ title?: string, meeting_date?: string, minutes_recording_status?: string }} meeting
   * @param {Array<{agenda_item:string,details:string,time_allocated:string,minutes:string,action_items:string}>} rows
   */
  function downloadMeetingWord(meeting, rows) {
    var title = (meeting && meeting.title && meeting.title.trim()) ? meeting.title.trim() : 'Department meeting';
    var dateStr = (meeting && meeting.meeting_date) ? meeting.meeting_date : '';
    var status =
      meeting && meeting.minutes_recording_status === 'complete' ? 'Minutes complete' : 'Minutes in progress';
    var html = [];
    html.push(
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
      '<head><meta charset="utf-8"><title>' + esc(title) + '</title>',
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->',
      '<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:8px;vertical-align:top}th{background:#f0f0f0;font-weight:bold}</style>',
      '</head><body>',
      '<h1 style="font-family:Calibri;font-size:18pt">' + esc(title) + '</h1>',
      '<p><strong>Meeting date:</strong> ' + esc(dateStr || '—') + ' &nbsp;|&nbsp; <strong>Status:</strong> ' + esc(status) + '</p>',
      '<p style="font-size:9pt;color:#666">Knightswood Secondary · Expressive Arts Faculty</p>',
      '<table>',
      '<tr><th>Agenda Item</th><th>Details / Description</th><th>Time</th><th>Minutes</th><th>Action Items</th></tr>'
    );
    (rows || []).forEach(function (r) {
      html.push(
        '<tr><td>' +
          esc(r.agenda_item) +
          '</td><td>' +
          esc(r.details) +
          '</td><td>' +
          esc(r.time_allocated) +
          '</td><td>' +
          esc(r.minutes) +
          '</td><td>' +
          esc(r.action_items) +
          '</td></tr>'
      );
    });
    html.push('</table><p style="font-size:9pt;margin-top:24pt">Exported from Faculty Hub</p></body></html>');
    var blob = new Blob(['\ufeff', html.join('')], { type: 'application/msword' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safeFilename(title, dateStr) + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  global.DepartmentMeetingExport = { downloadMeetingWord: downloadMeetingWord, safeFilename: safeFilename };
})(typeof window !== 'undefined' ? window : this);
