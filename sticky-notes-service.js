/**
 * Private sticky notes — personal reminders for the signed-in staff member.
 * Stored as stickyNotesV1 in pupil_data (synced via DataService).
 */
(function() {
  var DATA_KEY = 'stickyNotesV1';
  var COLORS = ['yellow', 'mint', 'sky', 'peach', 'rose'];
  var MAX_NOTES = 24;
  var MAX_TEXT = 500;

  var state = { notes: [] };

  function rid() {
    return 'n' + Math.random().toString(36).substr(2, 11);
  }

  function isValidColor(c) {
    return COLORS.indexOf(c) >= 0;
  }

  function normalizeNote(n, i) {
    n = n || {};
    var text = typeof n.text === 'string' ? n.text : '';
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
    var now = new Date().toISOString();
    return {
      id: n.id || rid(),
      text: text,
      color: isValidColor(n.color) ? n.color : 'yellow',
      pinned: !!n.pinned,
      sort: typeof n.sort === 'number' ? n.sort : (typeof i === 'number' ? i : 0),
      createdAt: n.createdAt || now,
      updatedAt: n.updatedAt || n.createdAt || now
    };
  }

  function ensureState(raw) {
    if (!raw || typeof raw !== 'object') raw = {};
    var notes = Array.isArray(raw.notes) ? raw.notes : [];
    state.notes = notes.map(normalizeNote).slice(0, MAX_NOTES);
    return state;
  }

  function sortNotes(list) {
    return list.slice().sort(function(a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if ((a.sort || 0) !== (b.sort || 0)) return (a.sort || 0) - (b.sort || 0);
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  }

  function findIndex(id) {
    return state.notes.findIndex(function(n) { return n.id === id; });
  }

  window.StickyNotesService = {
    DATA_KEY: DATA_KEY,
    COLORS: COLORS.slice(),
    MAX_NOTES: MAX_NOTES,
    MAX_TEXT: MAX_TEXT,

    load: function() {
      var self = this;
      return (window.DataService && DataService.get
        ? DataService.get(DATA_KEY)
        : Promise.resolve(null)
      ).then(function(raw) {
        ensureState(raw);
        return self.getState();
      });
    },

    save: function() {
      var payload = { notes: state.notes };
      return window.DataService ? DataService.set(DATA_KEY, payload) : Promise.resolve();
    },

    getState: function() {
      return { notes: sortNotes(state.notes) };
    },

    getNotes: function() {
      return sortNotes(state.notes);
    },

    addNote: function(partial) {
      partial = partial || {};
      if (state.notes.length >= MAX_NOTES) {
        return Promise.reject(new Error('Note limit reached (' + MAX_NOTES + ')'));
      }
      var maxSort = state.notes.reduce(function(m, n) {
        return Math.max(m, n.sort || 0);
      }, -1);
      var note = normalizeNote({
        text: partial.text || '',
        color: partial.color || COLORS[Math.floor(Math.random() * COLORS.length)],
        pinned: !!partial.pinned,
        sort: maxSort + 1
      });
      state.notes.push(note);
      return this.save().then(function() { return note; });
    },

    updateNote: function(id, updates) {
      var idx = findIndex(id);
      if (idx < 0) return Promise.resolve(null);
      var cur = state.notes[idx];
      var merged = Object.assign({}, cur, updates || {}, {
        updatedAt: new Date().toISOString()
      });
      state.notes[idx] = normalizeNote(merged, idx);
      return this.save().then(function() { return state.notes[idx]; });
    },

    setText: function(id, text) {
      return this.updateNote(id, { text: text });
    },

    setColor: function(id, color) {
      if (!isValidColor(color)) return Promise.resolve(null);
      return this.updateNote(id, { color: color });
    },

    togglePin: function(id) {
      var idx = findIndex(id);
      if (idx < 0) return Promise.resolve(null);
      return this.updateNote(id, { pinned: !state.notes[idx].pinned });
    },

    deleteNote: function(id) {
      state.notes = state.notes.filter(function(n) { return n.id !== id; });
      return this.save();
    }
  };
})();
