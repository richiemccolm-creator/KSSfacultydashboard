(function () {
  var IS_EMBED = new URLSearchParams(window.location.search).get('embed') === '1';
  if (IS_EMBED) document.body.classList.add('embedded');

  var policies = window.FACULTY_POLICIES || [];
  var grid = document.getElementById('policyGrid');
  var filterRow = document.getElementById('policyFilterRow');
  var activeCat = 'all';

  function embedSuffix() {
    return IS_EMBED ? '?embed=1' : '';
  }

  function categories() {
    var cats = ['all'];
    policies.forEach(function (p) {
      if (cats.indexOf(p.category) === -1) cats.push(p.category);
    });
    return cats;
  }

  function renderFilters() {
    if (!filterRow) return;
    filterRow.innerHTML = categories().map(function (cat) {
      var label = cat === 'all' ? 'All policies' : cat;
      return '<button type="button" class="policy-filter-btn' + (cat === activeCat ? ' active' : '') + '" data-cat="' + cat + '">' + label + '</button>';
    }).join('');
    filterRow.querySelectorAll('.policy-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCat = btn.getAttribute('data-cat') || 'all';
        renderFilters();
        renderGrid();
      });
    });
  }

  function renderGrid() {
    if (!grid) return;
    var list = policies.filter(function (p) {
      return activeCat === 'all' || p.category === activeCat;
    });
    if (!list.length) {
      grid.innerHTML = '<p style="color:var(--text2);font-size:.9rem">No policies in this category yet.</p>';
      return;
    }
    grid.innerHTML = list.map(function (p) {
      return (
        '<article class="policy-card">' +
          '<div class="policy-card-cat">' + p.category + '</div>' +
          '<h2 class="policy-card-title">' + p.title + '</h2>' +
          '<p class="policy-card-summary">' + p.summary + '</p>' +
          '<div class="policy-card-meta">Updated ' + p.updated + '</div>' +
          '<a class="policy-card-link" href="' + p.href + embedSuffix() + '">Read policy &rarr;</a>' +
        '</article>'
      );
    }).join('');
  }

  renderFilters();
  renderGrid();
})();
