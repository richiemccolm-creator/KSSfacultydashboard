(function () {
  var content = document.querySelector('.policy-doc-content');
  if (!content) return;

  /* ── Charter values → card grid ── */
  content.querySelectorAll('.policy-section').forEach(function (section) {
    var titleEl = section.querySelector('.policy-h2');
    var body = section.querySelector('.policy-section-body');
    if (!titleEl || !body) return;
    var title = (titleEl.textContent || '').toLowerCase();
    if (title.indexOf('school charter') !== -1) {
      body.querySelectorAll('ul.policy-list').forEach(function (ul) {
        ul.classList.add('policy-charter-grid');
        Array.from(ul.querySelectorAll('li')).forEach(function (li, i) {
          li.setAttribute('data-charter-index', String(i + 1));
        });
      });
    }
    if (title.indexOf('nurture') !== -1) {
      body.querySelectorAll('ul.policy-list').forEach(function (ul) {
        ul.classList.add('policy-nurture-grid');
      });
    }
  });

  /* ── Long quotes → callout cards ── */
  content.querySelectorAll('p.policy-p').forEach(function (p) {
    var text = (p.textContent || '').trim();
    if (text.length > 120 && /^[“"\u201c]/.test(text)) {
      p.classList.add('policy-callout');
    }
    if (p.querySelector('i') && text.length > 80 && /education scotland|hgiOS/i.test(text)) {
      p.classList.add('policy-callout', 'policy-callout--cite');
    }
  });

  /* ── TOC search ── */
  var toc = document.querySelector('.policy-doc-toc');
  var searchInput = document.getElementById('policyTocSearch');
  if (toc && searchInput) {
    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim().toLowerCase();
      toc.querySelectorAll('.policy-toc-link').forEach(function (a) {
        var match = !q || (a.textContent || '').toLowerCase().indexOf(q) !== -1;
        a.style.display = match ? '' : 'none';
      });
      toc.querySelectorAll('.policy-toc-group').forEach(function (g) {
        var any = g.querySelector('.policy-toc-link:not([style*="none"])');
        g.style.display = any ? '' : 'none';
      });
    });
  }

  /* ── Expand / collapse all appendices ── */
  var expandBtn = document.getElementById('policyExpandAppendices');
  var collapseBtn = document.getElementById('policyCollapseAppendices');
  var accordions = content.querySelectorAll('details.policy-accordion');
  if (expandBtn) {
    expandBtn.addEventListener('click', function () {
      accordions.forEach(function (d) { d.open = true; });
    });
  }
  if (collapseBtn) {
    collapseBtn.addEventListener('click', function () {
      accordions.forEach(function (d) { d.open = false; });
    });
  }

  /* ── Quick jump chips ── */
  document.querySelectorAll('.policy-quick-chip').forEach(function (chip) {
    chip.addEventListener('click', function (e) {
      e.preventDefault();
      var id = chip.getAttribute('href').replace('#', '');
      var target = document.getElementById(id) || document.getElementById('section-' + id);
      if (target) {
        if (target.tagName === 'DETAILS') target.open = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ── Open appendix when linked from TOC ── */
  if (window.location.hash) {
    var hash = window.location.hash.slice(1);
    var el = document.getElementById(hash);
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
})();
