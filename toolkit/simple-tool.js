/**
 * Shared helpers for the small offline Classroom Toolkit pages (picker, groups, seats, noise, dice,
 * scoreboard, mystery, qr): embed handling, the Toolkit back link, background stars, toast,
 * fullscreen, confetti, localStorage and the shared class list.
 */
(function () {
  var NAMES_KEY = "tk_class_names_v1";

  function $(id) { return document.getElementById(id); }
  function isEmbedded() {
    try {
      var q = new URLSearchParams(location.search);
      return q.get("embed") === "1" || q.get("embed") === "true" || sessionStorage.getItem("fh-embed") === "1";
    } catch (e) { return false; }
  }
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var toastT;
  function toast(msg) {
    var el = $("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove("show"); }, 2000);
  }

  function confetti(n) {
    if (reduceMotion) return;
    var wrap = $("confetti");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "confetti"; wrap.className = "confetti"; wrap.setAttribute("aria-hidden", "true");
      document.body.appendChild(wrap);
    }
    var colours = ["#3B6CFF", "#8658F5", "#D843B2", "#F4A62A", "#35C796", "#2EC5E8"];
    var html = "";
    for (var i = 0; i < (n || 70); i++) {
      html += '<i style="--x:' + (Math.random() * 100).toFixed(1) + "%;--c:" + colours[i % colours.length] +
        ";--r:" + Math.round(Math.random() * 360) + "deg;--fall:" + (1.6 + Math.random() * 1.6).toFixed(2) +
        "s;animation-delay:" + (Math.random() * 0.4).toFixed(2) + 's"></i>';
    }
    wrap.innerHTML = html;
    setTimeout(function () { wrap.innerHTML = ""; }, 3600);
  }

  function buildShell() {
    if (isEmbedded()) document.body.classList.add("embedded");
    var a = $("backLink");
    if (a && isEmbedded()) a.href = "../classroom_toolkit.html?embed=1";

    if (!document.querySelector(".fx")) {
      var fx = document.createElement("div");
      fx.className = "fx"; fx.setAttribute("aria-hidden", "true");
      fx.innerHTML = '<div class="fx-mesh"></div><div class="fx-grid"></div><div class="fx-stars"></div><div class="fx-vignette"></div>';
      document.body.insertBefore(fx, document.body.firstChild);
      if (!reduceMotion) {
        var html = "";
        for (var i = 0; i < 32; i++) {
          html += '<span class="fx-star" style="left:' + (Math.random() * 100) + "%;top:" + (Math.random() * 100) +
            "%;--dur:" + (2.2 + Math.random() * 3.5).toFixed(2) + "s;--delay:" + (Math.random() * 5).toFixed(2) +
            "s;--bright:" + (0.35 + Math.random() * 0.55).toFixed(2) + '"></span>';
        }
        fx.querySelector(".fx-stars").innerHTML = html;
      }
    }

    var fs = $("btnFs");
    if (fs) fs.addEventListener("click", toggleFullscreen);
    document.addEventListener("keydown", function (e) {
      if (isTyping(e)) return;
      if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleFullscreen(); }
    });
  }

  function toggleFullscreen() {
    var d = document, el = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { toast("Fullscreen isn't available here"); }
  }

  function isTyping(e) {
    var t = e.target;
    if (!t) return false;
    var tag = (t.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable;
  }

  /* —— Class list —— */
  function parseNames(text) {
    var seen = {};
    return String(text || "").split(/[\n\r\t,;]+/).map(function (s) {
      return s.replace(/\s+/g, " ").trim();
    }).filter(function (s) {
      var k = s.toLowerCase();
      if (!s || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }
  function loadNames() {
    var v = load(NAMES_KEY, []);
    return Array.isArray(v) ? v.filter(function (s) { return typeof s === "string" && s; }) : [];
  }
  function saveNames(list) { save(NAMES_KEY, list); }

  /**
   * Renders the "Class list" drawer into `mount` and calls onChange(names) whenever it is saved.
   * The list is shared by Name Picker, Group Randomiser and Seating Shuffler.
   */
  function namesPanel(mount, onChange) {
    var names = loadNames();
    mount.innerHTML =
      '<details class="names-drawer panel"' + (names.length ? "" : " open") + '>' +
        '<summary><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' +
        'Class list <span class="count" data-count></span></summary>' +
        '<div class="names-body">' +
          '<label class="sr-only" for="namesInput">Names, one per line</label>' +
          '<textarea class="input" id="namesInput" placeholder="Paste names here, one per line (or separated by commas). You can copy a column straight from a register or spreadsheet."></textarea>' +
          '<div class="names-foot">' +
            '<p class="hint">Saved on this device and shared with Name Picker, Group Randomiser and Seating Shuffler.</p>' +
            '<button type="button" class="btn btn-ghost" data-clear>Clear</button>' +
            '<button type="button" class="btn btn-primary" data-save>Save list</button>' +
          '</div>' +
        '</div>' +
      '</details>';
    var details = mount.querySelector("details");
    var ta = mount.querySelector("textarea");
    var count = mount.querySelector("[data-count]");
    function sync() {
      ta.value = names.join("\n");
      count.textContent = names.length + (names.length === 1 ? " name" : " names");
    }
    mount.querySelector("[data-save]").addEventListener("click", function () {
      names = parseNames(ta.value);
      saveNames(names);
      sync();
      if (names.length) details.open = false;
      toast(names.length ? "Saved " + names.length + " names" : "Class list cleared");
      onChange(names.slice());
    });
    mount.querySelector("[data-clear]").addEventListener("click", function () {
      ta.value = "";
      ta.focus();
    });
    sync();
    return {
      get: function () { return names.slice(); },
      open: function () { details.open = true; ta.focus(); }
    };
  }

  window.SimpleTool = {
    $: $, load: load, save: save, escapeHtml: escapeHtml, shuffle: shuffle, toast: toast,
    confetti: confetti, isTyping: isTyping, reduceMotion: reduceMotion,
    parseNames: parseNames, loadNames: loadNames, namesPanel: namesPanel
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildShell);
  else buildShell();
})();
