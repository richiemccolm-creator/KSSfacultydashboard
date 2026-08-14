/**
 * Classroom Toolkit cloud library — per-user JSON blobs in Supabase.
 * Falls back to localStorage-only when signed out or the migration is missing.
 */
(function () {
  var SAVE_MS = 500;
  var timers = {};

  var STORE = {
    QUIZ_BUSTERS: "tk_quiz_busters_boards_v2",
    QUIZ_BUILDER: "tk_quiz_builder_v1",
    HEADS_UP: "tk_heads_up_packs_v1",
    EXIT: "tk_exit_tickets_v1",
    FAVS: "tk_favs",
    TIMER: "tk_big_timer_v1"
  };

  function useSupabase() {
    return !!(window.supabase && window.supabase.rpc);
  }

  function getSession() {
    if (!window.supabase || !window.supabase.auth) return Promise.resolve(null);
    return window.supabase.auth.getSession().then(function (r) {
      return r && r.data && r.data.session ? r.data.session : null;
    }).catch(function () { return null; });
  }

  function stamp(item) {
    if (!item || typeof item !== "object") return 0;
    var v = item.updatedAt != null ? item.updatedAt : item.updated_at;
    if (v == null || v === "") return 0;
    if (typeof v === "number" && isFinite(v)) return v;
    var t = Date.parse(String(v));
    return isNaN(t) ? 0 : t;
  }

  function mergeById(localList, cloudList) {
    var map = {};
    function consider(item) {
      if (!item || item.id == null || item.id === "") return;
      var prev = map[item.id];
      if (!prev) {
        map[item.id] = item;
        return;
      }
      if (stamp(item) >= stamp(prev)) map[item.id] = item;
    }
    (cloudList || []).forEach(consider);
    (localList || []).forEach(consider);
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function unionStrings(a, b) {
    var out = [];
    (a || []).concat(b || []).forEach(function (id) {
      if (id != null && id !== "" && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  function asList(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && Array.isArray(data.items)) return data.items;
    return [];
  }

  window.ClassroomToolkitLibrary = {
    STORE: STORE,

    mergeById: mergeById,

    load: function (storeKey) {
      if (!useSupabase()) return Promise.resolve(null);
      return getSession().then(function (session) {
        if (!session) return null;
        return window.supabase.rpc("classroom_toolkit_load_library", {
          p_store_key: storeKey
        }).then(function (res) {
          if (res.error) throw res.error;
          return res.data == null ? null : res.data;
        });
      });
    },

    save: function (storeKey, data) {
      if (!useSupabase()) return Promise.resolve(null);
      return getSession().then(function (session) {
        if (!session) return null;
        return window.supabase.rpc("classroom_toolkit_upsert_library", {
          p_store_key: storeKey,
          p_data: data == null ? [] : data
        }).then(function (res) {
          if (res.error) throw res.error;
          return res.data || null;
        });
      });
    },

    saveSoon: function (storeKey, dataOrFn) {
      var self = this;
      clearTimeout(timers[storeKey]);
      timers[storeKey] = setTimeout(function () {
        var payload = typeof dataOrFn === "function" ? dataOrFn() : dataOrFn;
        self.save(storeKey, payload).catch(function (err) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn("Classroom Toolkit cloud save skipped:", err && err.message ? err.message : err);
          }
        });
      }, SAVE_MS);
    },

    syncList: function (storeKey, localList) {
      var self = this;
      var local = Array.isArray(localList) ? localList : [];
      return this.load(storeKey).then(function (cloud) {
        if (cloud == null) {
          if (local.length) {
            return self.save(storeKey, local).then(function () { return local; });
          }
          return local;
        }
        var merged = mergeById(local, asList(cloud));
        return self.save(storeKey, merged).then(function () { return merged; });
      });
    },

    syncStringList: function (storeKey, localList) {
      var self = this;
      var local = Array.isArray(localList) ? localList : [];
      return this.load(storeKey).then(function (cloud) {
        if (cloud == null) {
          if (local.length) {
            return self.save(storeKey, local).then(function () { return local; });
          }
          return local;
        }
        var merged = unionStrings(local, Array.isArray(cloud) ? cloud : []);
        return self.save(storeKey, merged).then(function () { return merged; });
      });
    },

    syncValue: function (storeKey, localValue) {
      var self = this;
      return this.load(storeKey).then(function (cloud) {
        if (cloud == null) {
          if (localValue != null) {
            return self.save(storeKey, localValue).then(function () { return localValue; });
          }
          return localValue;
        }
        return cloud;
      });
    }
  };
})();
