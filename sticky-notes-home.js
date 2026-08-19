/**
 * Home dashboard widget — private sticky notes (remind myself).
 * Hide preference is local to this browser so notes can be covered quickly.
 */
(function() {
  var HIDDEN_KEY = 'stickyNotesHiddenV1';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function isHidden() {
    try {
      return localStorage.getItem(HIDDEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setHidden(hidden) {
    try {
      if (hidden) localStorage.setItem(HIDDEN_KEY, '1');
      else localStorage.removeItem(HIDDEN_KEY);
    } catch (e) {}
  }

  function colorDotsHtml(activeColor) {
    var colors = (window.StickyNotesService && StickyNotesService.COLORS) || ['yellow', 'mint', 'sky', 'peach', 'rose'];
    return colors.map(function(c) {
      return '<button type="button" class="home-sticky-color' + (c === activeColor ? ' is-active' : '') +
        '" data-color="' + esc(c) + '" aria-label="' + esc(c) + ' note" title="' + esc(c) + '"></button>';
    }).join('');
  }

  function noteCardHtml(note) {
    return (
      '<article class="home-sticky-note color-' + esc(note.color) + (note.pinned ? ' is-pinned' : '') + '" data-note-id="' + esc(note.id) + '">' +
        '<div class="home-sticky-note-bar">' +
          '<div class="home-sticky-colors">' + colorDotsHtml(note.color) + '</div>' +
          '<div class="home-sticky-actions">' +
            '<button type="button" class="home-sticky-pin' + (note.pinned ? ' is-on' : '') + '" aria-label="' +
              (note.pinned ? 'Unpin note' : 'Pin note') + '" title="' + (note.pinned ? 'Unpin' : 'Pin') + '">' +
              '<i class="ti ti-pinned" aria-hidden="true"></i></button>' +
            '<button type="button" class="home-sticky-delete" aria-label="Delete note" title="Delete">' +
              '<i class="ti ti-x" aria-hidden="true"></i></button>' +
          '</div>' +
        '</div>' +
        '<textarea class="home-sticky-text" rows="4" maxlength="' +
          ((window.StickyNotesService && StickyNotesService.MAX_TEXT) || 500) +
          '" placeholder="Remind myself…" aria-label="Sticky note text">' +
          esc(note.text) +
        '</textarea>' +
      '</article>'
    );
  }

  function fitTextarea(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(80, ta.scrollHeight) + 'px';
  }

  function bindNote(card) {
    var id = card.getAttribute('data-note-id');
    if (!id || !window.StickyNotesService) return;

    var textarea = card.querySelector('.home-sticky-text');
    var saveTimer = null;

    function scheduleSave() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function() {
        StickyNotesService.setText(id, textarea.value).catch(function() {});
      }, 400);
    }

    if (textarea) {
      fitTextarea(textarea);
      textarea.addEventListener('input', function() {
        fitTextarea(textarea);
        scheduleSave();
      });
      textarea.addEventListener('blur', function() {
        if (saveTimer) clearTimeout(saveTimer);
        StickyNotesService.setText(id, textarea.value).catch(function() {});
      });
    }

    card.querySelectorAll('.home-sticky-color').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var color = btn.getAttribute('data-color');
        StickyNotesService.setColor(id, color).then(function() {
          window.StickyNotesHome.render({ force: true });
        }).catch(function() {});
      });
    });

    var pinBtn = card.querySelector('.home-sticky-pin');
    if (pinBtn) {
      pinBtn.addEventListener('click', function(e) {
        e.preventDefault();
        StickyNotesService.togglePin(id).then(function() {
          window.StickyNotesHome.render({ force: true });
        }).catch(function() {});
      });
    }

    var delBtn = card.querySelector('.home-sticky-delete');
    if (delBtn) {
      delBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var text = (textarea && textarea.value || '').trim();
        if (text && !confirm('Delete this sticky note?')) return;
        StickyNotesService.deleteNote(id).then(function() {
          window.StickyNotesHome.render({ force: true });
        }).catch(function() {});
      });
    }
  }

  function bindChrome(el) {
    var hideBtn = el.querySelector('.home-sticky-hide');
    var showBtn = el.querySelector('.home-sticky-show');
    var addBtn = el.querySelector('.home-sticky-add');

    if (hideBtn) {
      hideBtn.onclick = function() {
        setHidden(true);
        window.StickyNotesHome.render({ force: true });
      };
    }
    if (showBtn) {
      showBtn.onclick = function() {
        setHidden(false);
        window.StickyNotesHome.render({ force: true });
      };
    }
    if (addBtn) {
      addBtn.onclick = function() {
        if (addBtn.disabled || !window.StickyNotesService) return;
        StickyNotesService.addNote({ text: '' }).then(function() {
          window.StickyNotesHome.render({ force: true });
          var cards = el.querySelectorAll('.home-sticky-note');
          var last = cards[cards.length - 1];
          if (last) {
            var ta = last.querySelector('.home-sticky-text');
            if (ta) ta.focus();
          }
        }).catch(function(err) {
          alert((err && err.message) || 'Could not add note.');
        });
      };
    }
  }

  function renderHiddenShell(el, noteCount) {
    var countLabel = noteCount === 1 ? '1 note hidden' : noteCount + ' notes hidden';
    el.classList.add('is-hidden');
    el.innerHTML =
      '<div class="home-sticky-board-head home-sticky-board-head--collapsed">' +
        '<div>' +
          '<div class="home-sticky-title">Sticky notes</div>' +
          '<div class="home-sticky-sub">' + esc(countLabel) + '. Tap Show when you are alone</div>' +
        '</div>' +
        '<button type="button" class="home-sticky-show" aria-expanded="false" title="Show sticky notes">' +
          '<i class="ti ti-eye" aria-hidden="true"></i> Show' +
        '</button>' +
      '</div>';
    bindChrome(el);
  }

  function renderVisibleShell(el) {
    el.classList.remove('is-hidden');
    el.innerHTML =
      '<div class="home-sticky-board-head">' +
        '<div>' +
          '<div class="home-sticky-title">Sticky notes</div>' +
          '<div class="home-sticky-sub">Private reminders. Hide these if someone is nearby</div>' +
        '</div>' +
        '<div class="home-sticky-head-actions">' +
          '<button type="button" class="home-sticky-hide" aria-expanded="true" title="Hide sticky notes from view">' +
            '<i class="ti ti-eye-off" aria-hidden="true"></i> Hide' +
          '</button>' +
          '<button type="button" class="home-sticky-add">' +
            '<i class="ti ti-plus" aria-hidden="true"></i> Add note' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="home-sticky-board" aria-label="Your sticky notes"></div>';
    bindChrome(el);
    return el.querySelector('.home-sticky-board');
  }

  window.StickyNotesHome = {
    render: function(opts) {
      opts = opts || {};
      var el = document.getElementById('homeStickyNotes');
      if (!el || !window.StickyNotesService) return;

      // Don't wipe a note the user is currently typing into (dashboard refresh).
      if (!opts.force) {
        var active = document.activeElement;
        if (active && el.contains(active) && active.classList && active.classList.contains('home-sticky-text')) {
          return;
        }
      }

      StickyNotesService.load().then(function() {
        var notes = StickyNotesService.getNotes();
        var atLimit = notes.length >= StickyNotesService.MAX_NOTES;
        var hidden = isHidden();

        if (hidden) {
          // Notes are not rendered at all while hidden — nothing to shoulder-surf.
          renderHiddenShell(el, notes.length);
          return;
        }

        var board = renderVisibleShell(el);
        var addBtn = el.querySelector('.home-sticky-add');
        if (addBtn) {
          addBtn.disabled = atLimit;
          addBtn.title = atLimit ? 'Maximum of ' + StickyNotesService.MAX_NOTES + ' notes' : 'Add a sticky note';
        }

        if (notes.length === 0) {
          board.innerHTML =
            '<div class="home-sticky-empty">' +
              'No sticky notes yet. Add one for a quick reminder to yourself.' +
            '</div>';
          return;
        }

        board.innerHTML = notes.map(noteCardHtml).join('');
        board.querySelectorAll('.home-sticky-note').forEach(bindNote);
      }).catch(function() {
        el.classList.remove('is-hidden');
        el.innerHTML = '<div class="home-dash-empty">Could not load sticky notes.</div>';
      });
    }
  };
})();
