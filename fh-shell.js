function fhCanManage() {
  return !!window.__authGuardCanManageSchool || !!window.__authGuardIsAdmin || !!window.__authGuardIsFacultyHead;
}

function fhEnforceManagerAccess() {
  if (!fhCanManage()) {
    window.location.replace('faculty-hub.html');
  }
}

function fhToggleSidebar() {
  var sb = document.getElementById('fhSidebar');
  if (!sb) return;
  sb.classList.toggle('open');
}

function fhMarkActiveNav() {
  var page = document.body.getAttribute('data-fh-page') || '';
  document.querySelectorAll('.fh-nav a[data-page]').forEach(function(a) {
    a.classList.toggle('active', a.getAttribute('data-page') === page);
  });
}

function fhInitShell() {
  fhMarkActiveNav();
  window.addEventListener('auth-guard-ready', fhEnforceManagerAccess);
  var attempts = 0;
  function wait() {
    if (window.__authReady || attempts >= 24) {
      fhEnforceManagerAccess();
      return;
    }
    attempts += 1;
    setTimeout(wait, 250);
  }
  wait();
}

function fhShowToast(msg) {
  var el = document.getElementById('fhToast');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 2800);
}
