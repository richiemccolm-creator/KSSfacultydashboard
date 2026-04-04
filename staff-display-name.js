/**
 * Self-service display name: updates public.profiles.display_name and auth user_metadata.full_name
 * so Faculty Head cloud imports, staff lists, and Learning & Teaching labels stay aligned.
 */
(function() {
  function injectStylesOnce() {
    if (document.getElementById('staff-display-name-styles')) return;
    var s = document.createElement('style');
    s.id = 'staff-display-name-styles';
    s.textContent =
      '.sdn-root{max-width:420px}' +
      '.sdn-label{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3,#718096);margin:0 0 .35rem;display:block}' +
      '.sdn-root--dark .sdn-label{color:rgba(255,255,255,.5)}' +
      '.sdn-hint{font-size:.72rem;color:var(--text2,#4a5568);line-height:1.45;margin:0 0 .65rem}' +
      '.sdn-root--dark .sdn-hint{color:rgba(255,255,255,.45)}' +
      '.sdn-row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}' +
      '.sdn-input{flex:1;min-width:180px;font-size:.85rem;padding:.5rem .75rem;border:1px solid var(--border,#e2e8f0);border-radius:6px;background:var(--card-bg,#fff);color:var(--text,#1a202c)}' +
      '.sdn-input:focus{outline:none;border-color:var(--navy,#1e2d4a);box-shadow:0 0 0 2px rgba(30,45,74,.12)}' +
      '.sdn-root--dark .sdn-input{background:rgba(0,0,0,.22);border-color:rgba(255,255,255,.22);color:#fff}' +
      '.sdn-root--dark .sdn-input:focus{border-color:rgba(255,255,255,.45);box-shadow:0 0 0 2px rgba(255,255,255,.12)}' +
      '.sdn-root--dark .sdn-input::placeholder{color:rgba(255,255,255,.35)}' +
      '.sdn-btn{font-size:.78rem;font-weight:600;padding:.5rem 1rem;border-radius:6px;border:none;cursor:pointer;background:var(--navy,#1e2d4a);color:#fff;transition:opacity .15s}' +
      '.sdn-btn:hover{opacity:.92}' +
      '.sdn-btn:disabled{opacity:.45;cursor:not-allowed}' +
      '.sdn-root--dark .sdn-btn{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.25)}' +
      '.sdn-status{font-size:.72rem;margin:.5rem 0 0;min-height:1.1em}' +
      '.sdn-status.ok{color:var(--success,#16a34a)}' +
      '.sdn-root--dark .sdn-status.ok{color:#86efac}' +
      '.sdn-status.err{color:#b91c1c}' +
      '.sdn-root--dark .sdn-status.err{color:#fca5a5}' +
      '.sdn-loading{opacity:.55}';
    document.head.appendChild(s);
  }

  function useSupabase() {
    return window.supabase && window.supabase.auth;
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'sdn-status' + (kind === 'ok' ? ' ok' : kind === 'err' ? ' err' : '');
  }

  function notify(msg, isErr) {
    if (typeof window.toast === 'function' && !isErr) window.toast(msg);
  }

  function mount(root, options) {
    injectStylesOnce();
    options = options || {};
    var variant = options.variant === 'dark' ? 'dark' : 'light';
    if (!root || !useSupabase()) {
      if (root) {
        root.innerHTML =
          '<p class="sdn-hint" style="margin:0">Sign in with cloud sync to set your display name.</p>';
      }
      return;
    }

    root.innerHTML =
      '<div class="sdn-root sdn-root--' +
      variant +
      '">' +
      '<label class="sdn-label" for="sdn-input-' +
      mount._id +
      '">Display name</label>' +
      '<p class="sdn-hint">Shown on the Faculty Head dashboard, cloud imports, and Learning&nbsp;&amp;&nbsp;Teaching. Your sign-in email does not change.</p>' +
      '<div class="sdn-row">' +
      '<input type="text" id="sdn-input-' +
      mount._id +
      '" class="sdn-input" maxlength="120" placeholder="e.g. Jane Smith" autocomplete="name" />' +
      '<button type="button" class="sdn-btn">Save</button>' +
      '</div>' +
      '<p class="sdn-status" aria-live="polite"></p>' +
      '</div>';
    mount._id = (mount._id || 0) + 1;

    var input = root.querySelector('.sdn-input');
    var btn = root.querySelector('.sdn-btn');
    var statusEl = root.querySelector('.sdn-status');
    var inner = root.querySelector('.sdn-root');

    function load() {
      setStatus(statusEl, '', '');
      inner.classList.add('sdn-loading');
      btn.disabled = true;
      window.supabase.auth
        .getSession()
        .then(function(_a) {
          var session = _a && _a.data && _a.data.session;
          if (!session) throw new Error('Not signed in');
          return window.supabase.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle();
        })
        .then(function(r) {
          if (r.error) throw r.error;
          var dn = (r.data && r.data.display_name && String(r.data.display_name).trim()) || '';
          input.value = dn;
        })
        .catch(function() {
          input.value = '';
          setStatus(statusEl, 'Could not load profile.', 'err');
        })
        .then(function() {
          inner.classList.remove('sdn-loading');
          btn.disabled = false;
        });
    }

    function save() {
      var trimmed = (input.value && String(input.value).trim()) || '';
      setStatus(statusEl, '', '');
      btn.disabled = true;
      window.supabase.auth
        .getSession()
        .then(function(_a) {
          var session = _a && _a.data && _a.data.session;
          if (!session) throw new Error('Not signed in');
          var payload = {
            id: session.user.id,
            email: session.user.email || '',
            display_name: trimmed || null
          };
          return window.supabase
            .from('profiles')
            .upsert(payload, { onConflict: 'id' })
            .then(function(ur) {
              if (ur.error) throw ur.error;
              return window.supabase.auth.updateUser({ data: { full_name: trimmed } });
            })
            .then(function(au) {
              if (au.error) throw au.error;
            });
        })
        .then(function() {
          setStatus(statusEl, 'Saved.', 'ok');
          notify('Display name saved');
          try {
            window.dispatchEvent(new CustomEvent('staffdisplaynameupdated'));
          } catch (e) {}
        })
        .catch(function(e) {
          var msg = (e && e.message) || 'Could not save.';
          setStatus(statusEl, msg, 'err');
        })
        .then(function() {
          btn.disabled = false;
        });
    }

    btn.addEventListener('click', save);
    input.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') save();
    });
    load();
  }

  mount._id = 0;

  window.StaffDisplayName = { mount: mount };

  function autoInit() {
    document.querySelectorAll('[data-staff-display-name]').forEach(function(el) {
      var v = el.getAttribute('data-staff-display-name');
      mount(el, { variant: v === 'dark' ? 'dark' : 'light' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
