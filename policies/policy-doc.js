(function () {
  var IS_EMBED = new URLSearchParams(window.location.search).get('embed') === '1';
  var backUrl = '../policies.html' + (IS_EMBED ? '?embed=1' : '');

  function goBackToPolicies(e) {
    if (e) e.preventDefault();
    window.location.href = backUrl;
  }

  ['policyBackLink', 'policyHeaderBackBtn', 'policyBackBtn'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'A') el.href = backUrl;
    el.addEventListener('click', goBackToPolicies);
  });

  var links = document.querySelectorAll('.policy-toc-link');
  var sections = [];
  links.forEach(function (a) {
    var id = (a.getAttribute('href') || '').replace('#', '');
    var el = document.getElementById(id)
      || document.getElementById('section-' + id)
      || document.querySelector('[data-anchor="' + id + '"]');
    if (el) sections.push({ link: a, el: el });
  });

  function updateActive() {
    if (!sections.length) return;
    var y = window.scrollY + (IS_EMBED ? 120 : 100);
    var current = sections[0];
    sections.forEach(function (s) {
      if (s.el.offsetTop <= y) current = s;
    });
    links.forEach(function (a) { a.classList.remove('active'); });
    if (current) current.link.classList.add('active');
  }

  if (sections.length) {
    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
  }
})();
