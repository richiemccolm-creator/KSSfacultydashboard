(function (root) {
  "use strict";

  var RECENT_MAX = 10;

  var FORM_NOTES = {
    improvised: "Improvise from the given circumstances — do not script every line. Agree who wants what, then play.",
    scripted: "Write a short script from this starting point. Keep stage directions practical (entrance, pause, object).",
    monologue: "One performer speaks. Other characters may be remembered, addressed, or held as freeze-frames.",
    duologue: "Build this as a two-person scene. Status should shift at least once.",
    mime: "No spoken lines. Play the story through action, gesture, facial expression and freeze-frames.",
    dance_drama: "Movement is the main storytelling device. Find a motif (reach, recoil, lift, drop) and repeat it with change.",
    physical: "Tell it through the body: lifts, ensemble shapes, slow motion, and sudden stillness. Dialogue is optional and spare.",
    forum: "Show a clear power imbalance. Perform once, then replay so spect-actors can stop the action and try a different choice."
  };

  var STRUCTURE_NOTES = {
    linear: "Tell it beginning → middle → end. The opening image is your first beat.",
    nonlinear: "Start near the crisis, then reveal how you got there. Time does not have to run forwards.",
    episodic: "Shape this as three short episodes with a jump in time or place between them. The same want should run through all three.",
    circular: "The last image should echo the first — same place, same gesture, or the same line, now meaning something else.",
    flashback: "Begin in the present with the stake already live, then drop into a past scene that explains the choice."
  };

  var STYLE_NOTES = {
    naturalistic: "Play it as real life: ordinary speech, believable movement, no breaking the fourth wall.",
    non_naturalistic: "Step away from realism: direct address, symbolic objects, freeze-frame, or split focus are welcome.",
    stylised: "Heighten one element — rhythm of speech, repeated gesture, or a colour/prop motif — and keep it consistent.",
    physical: "Let the body carry meaning. Use levels, proximity and ensemble to show status and feeling."
  };

  var SETTING_TYPES = [
    { id: "school", label: "School" },
    { id: "home", label: "Home" },
    { id: "public", label: "Public place" },
    { id: "workplace", label: "Workplace" },
    { id: "journey", label: "Journey" },
    { id: "event", label: "Event" }
  ];

  var TIME_LABEL = {
    present: "the present day",
    past: "the past",
    future: "a near future"
  };

  function banks() {
    return root.STIMULUS_BANKS || {};
  }

  function list(key) {
    var b = banks();
    return Array.isArray(b[key]) ? b[key] : [];
  }

  function findById(arr, id) {
    if (!id) return null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].id === id) return arr[i];
    }
    return null;
  }

  function isAny(v) {
    return v == null || v === "" || v === "any";
  }

  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    var i = Math.floor((rng || Math.random)() * arr.length);
    return arr[i];
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    var r = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function has(arr, id) {
    return Array.isArray(arr) && arr.indexOf(id) >= 0;
  }

  function labelOf(axis, id) {
    var map = {
      genre: "genres",
      form: "forms",
      structure: "structures",
      style: "styles",
      cast: "casts",
      setting: "settings",
      time: "times",
      extra: "extras"
    };
    if (axis === "setting") {
      var types = SETTING_TYPES;
      var type = findById(types, id);
      if (type) return type.label;
    }
    var item = findById(list(map[axis] || axis), id);
    if (item) return item.label;
    if (axis === "cast" && id) return id + (id === "1" ? " performer" : " performers");
    return id || "Any";
  }

  function applyLocks(choices, locks) {
    var out = {};
    var keys = ["genre", "form", "structure", "style", "cast", "setting", "time", "extra"];
    var src = choices || {};
    var lock = locks || {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!isAny(lock[k])) out[k] = lock[k];
      else out[k] = isAny(src[k]) ? "" : src[k];
    }
    return out;
  }

  function settingFits(setting, genre, time) {
    if (!setting) return false;
    if (setting.genres && setting.genres.length && !has(setting.genres, genre)) return false;
    if (setting.excludeGenres && has(setting.excludeGenres, genre)) return false;
    if (time && setting.times && setting.times.length && !has(setting.times, time)) return false;
    return true;
  }

  function resolveTime(genre, requested) {
    var time = requested;
    if (genre === "historical") return "past";
    if (genre === "docudrama") {
      if (time === "future") return "present";
      return time || "present";
    }
    if (genre === "scifi" && isAny(time)) return "future";
    return time;
  }

  function filterSettings(genre, time, requestedId) {
    var all = list("settings");
    if (requestedId) {
      var locked = findById(all, requestedId);
      if (locked) return [locked];
    }
    var t = resolveTime(genre, time);
    var matched = all.filter(function (s) { return settingFits(s, genre, t); });
    if (requestedId) {
      var byType = matched.filter(function (s) { return has(s.types, requestedId); });
      if (byType.length) matched = byType;
    }
    if (genre === "historical") {
      var hist = matched.filter(function (s) {
        return has(s.genres, "historical") || has(s.times, "past");
      });
      if (hist.length) matched = hist;
    }
    if (genre === "scifi") {
      var sci = matched.filter(function (s) {
        return has(s.genres, "scifi") || has(s.times, "future");
      });
      if (sci.length) matched = sci;
    }
    if (genre === "docudrama") {
      var real = matched.filter(function (s) {
        return !has(s.genres, "scifi") && !has(s.times, "future");
      });
      if (real.length) matched = real;
    }
    return matched.length ? matched : all;
  }

  function filterSituations(genre) {
    var all = list("situations");
    var matched = all.filter(function (s) { return has(s.genres, genre); });
    return matched.length ? matched : all;
  }

  function filterArchetypes(genre) {
    var all = list("archetypes");
    var matched = all.filter(function (a) { return !a.genres || !a.genres.length || has(a.genres, genre); });
    return matched.length ? matched : all;
  }

  function uniqueNames(n, rng, used) {
    var pool = shuffle(list("names"), rng);
    var out = [];
    var seen = {};
    (used || []).forEach(function (u) { seen[u] = true; });
    for (var i = 0; i < pool.length && out.length < n; i++) {
      if (seen[pool[i]]) continue;
      seen[pool[i]] = true;
      out.push(pool[i]);
    }
    var extra = 1;
    while (out.length < n) {
      out.push("Player " + extra);
      extra += 1;
    }
    return out;
  }

  function pickRelationship(castN, rng) {
    if (castN < 2) return null;
    var rels = list("relationships").filter(function (r) { return (r.min || 2) <= castN; });
    return pick(rels, rng);
  }

  function comboKey(parts) {
    return [
      parts.situation, parts.setting, parts.form, parts.structure,
      parts.style, parts.cast, parts.extra, parts.names
    ].join("|");
  }

  function bumpCast(form, n, lockedCast) {
    if (lockedCast) return n;
    if (form === "duologue" && n < 2) return 2;
    if (form === "forum" && n < 2) return 2;
    return n;
  }

  function forumRewrite(characters) {
    if (!characters.length) return;
    characters[0].note = (characters[0].note ? characters[0].note + " " : "") +
      "Holds the power in this scene (status, keys, the list, or the last word).";
    if (characters[1]) {
      characters[1].note = (characters[1].note ? characters[1].note + " " : "") +
        "Is being shut out or controlled — the oppressed figure a spect-actor could replace.";
    }
  }

  function buildCharacters(sit, genre, castN, form, rng) {
    var roles = (sit.roles || []).slice();
    var archetypes = shuffle(filterArchetypes(genre), rng);
    var names = uniqueNames(Math.max(castN, 1), rng);
    var chars = [];
    var i;
    for (i = 0; i < castN; i++) {
      var role = roles[i];
      var arch = archetypes[i % Math.max(archetypes.length, 1)];
      if (!role && arch) role = arch.role;
      var want = sit.want;
      if (i > 0) {
        want = (arch && arch.wants && arch.wants[i % arch.wants.length]) || sit.obstacle;
      } else if (arch && arch.wants && arch.wants[0]) {
        want = sit.want;
      }
      var note = arch && arch.trait ? arch.trait : "";
      if (form === "monologue" && i > 0) {
        note = (note ? note + " " : "") + "Present in memory, freeze-frame, or as someone addressed — not the main speaker.";
      }
      if (castN === 1 && i === 0) {
        note = (note ? note + " " : "") + "Alone on stage with an inner conflict; other people exist offstage or in memory.";
      }
      chars.push({
        name: names[i],
        role: role || "ensemble member",
        want: want,
        note: note.trim()
      });
    }
    if (form === "forum") forumRewrite(chars);
    return chars;
  }

  function extraSentence(extra, characters) {
    if (!extra) return "";
    var name = characters[0] ? characters[0].name : "Someone";
    var other = characters[1] ? characters[1].name : "another person";
    if (extra.id === "secret") {
      return name + " is hiding a fact the others do not know yet — it should surface before the end.";
    }
    if (extra.id === "prop") {
      return "One object must appear and change the scene (a letter, a key, a jacket, a phone).";
    }
    if (extra.id === "deadline") {
      return "A clock is running: this must be resolved before a stated time (the bell, the bus, the start of the show).";
    }
    if (extra.id === "misunderstanding") {
      return name + " and " + other + " are working from different versions of the truth.";
    }
    return extra.note || "";
  }

  function uncap(s) {
    s = String(s || "").trim();
    if (!s) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  function scenarioText(sit, setting, time, chars, extra, form) {
    var place = setting && setting.place ? setting.place : "a charged public space";
    var when = TIME_LABEL[time] || TIME_LABEL.present;
    var lead = chars[0] ? chars[0].name : "The protagonist";
    var parts = [];
    parts.push(sit.open);
    parts.push(place + (when ? ", in " + when : "") + ".");
    parts.push(sit.setup);
    if (form === "mime" || form === "dance_drama" || form === "physical") {
      parts.push(lead + " is trying to " + uncap(sit.want) + " — show this in action, not explanation. In the way is this: " + uncap(sit.obstacle) + ".");
    } else {
      parts.push(lead + " needs to " + uncap(sit.want) + ", but " + uncap(sit.obstacle) + ".");
    }
    parts.push("If they fail, " + uncap(sit.stake) + ".");
    var extraLine = extraSentence(extra, chars);
    if (extraLine) parts.push(extraLine);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function devisingNote(form, structure, style, extra) {
    var bits = [];
    if (FORM_NOTES[form]) bits.push(FORM_NOTES[form]);
    if (STRUCTURE_NOTES[structure]) bits.push(STRUCTURE_NOTES[structure]);
    if (STYLE_NOTES[style]) bits.push(STYLE_NOTES[style]);
    if (extra && extra.note) bits.push(extra.note);
    return bits.join(" ");
  }

  function generate(rawChoices, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var avoid = opts.avoid || [];
    var locks = opts.locks || {};
    var choices = applyLocks(rawChoices || {}, locks);

    var genre = choices.genre || (pick(list("genres"), rng) || { id: "comedy" }).id;
    var form = choices.form || (pick(list("forms"), rng) || { id: "improvised" }).id;
    var structure = choices.structure || (pick(list("structures"), rng) || { id: "linear" }).id;
    var style = choices.style || (pick(list("styles"), rng) || { id: "naturalistic" }).id;
    var extra = isAny(choices.extra) ? pick(list("extras"), rng) : findById(list("extras"), choices.extra);

    var castItem = findById(list("casts"), String(choices.cast || ""));
    var castN = castItem ? castItem.n : (1 + Math.floor(rng() * 4));
    if (castN < 1) castN = 1;
    if (castN > 6) castN = 6;
    castN = bumpCast(form, castN, !isAny(locks.cast) || !isAny(choices.cast));

    var time = resolveTime(genre, choices.time || "");
    if (isAny(time)) {
      if (genre === "scifi") time = "future";
      else if (genre === "historical") time = "past";
      else time = "present";
    }

    var situations = shuffle(filterSituations(genre), rng);
    var settings = shuffle(filterSettings(genre, time, choices.setting), rng);
    if (choices.setting) {
      var lockedSet = findById(list("settings"), choices.setting);
      if (lockedSet) settings = [lockedSet].concat(settings.filter(function (s) { return s.id !== lockedSet.id; }));
    }

    var used = null;
    var attempt;
    for (attempt = 0; attempt < 40; attempt++) {
      var sit = situations[attempt % situations.length];
      var setting = settings[attempt % settings.length];
      var namesPreview = uniqueNames(castN, rng);
      var key = comboKey({
        situation: sit.id,
        setting: setting.id,
        form: form,
        structure: structure,
        style: style,
        cast: String(castN),
        extra: extra ? extra.id : "",
        names: namesPreview.join(",")
      });
      if (avoid.indexOf(key) >= 0 && attempt < 30) continue;
      used = { sit: sit, setting: setting, key: key, names: namesPreview };
      break;
    }
    if (!used) {
      used = {
        sit: situations[0] || { id: "fallback", title: "Starting point", setup: "A choice has to be made.", want: "tell the truth", obstacle: "someone is listening", stake: "a friendship", open: "A door is half open.", roles: ["the one who knows", "the one who doesn't", "the witness"] },
        setting: settings[0] || { id: "corridor", place: "A school corridor", label: "School corridor" },
        key: "fallback",
        names: uniqueNames(castN, rng)
      };
    }

    var chars = buildCharacters(used.sit, genre, castN, form, rng);
    if (used.names && used.names.length) {
      for (var c = 0; c < chars.length && c < used.names.length; c++) chars[c].name = used.names[c];
    }
    if (castN >= 2) {
      var rel = pickRelationship(castN, rng);
      if (rel && chars[0] && chars[1]) {
        chars[0].note = (chars[0].note ? chars[0].note + " " : "") + "Linked with " + chars[1].name + ": " + rel.text + ".";
      }
    }

    var tags = {
      genre: genre,
      form: form,
      structure: structure,
      style: style,
      cast: String(castN),
      setting: used.setting.id,
      time: time,
      extra: extra ? extra.id : ""
    };

    return {
      title: used.sit.title,
      tags: tags,
      labels: {
        genre: labelOf("genre", genre),
        form: labelOf("form", form),
        structure: labelOf("structure", structure),
        style: labelOf("style", style),
        cast: castN + (castN === 1 ? " performer" : " performers"),
        setting: used.setting.label || used.setting.place,
        time: labelOf("time", time),
        extra: extra ? extra.label : ""
      },
      where: used.setting.place || used.setting.label,
      when: TIME_LABEL[time] || "",
      stake: used.sit.stake,
      opening: used.sit.open,
      scenario: scenarioText(used.sit, used.setting, time, chars, extra, form),
      characters: chars,
      devising: devisingNote(form, structure, style, extra),
      combo: used.key
    };
  }

  function options() {
    var b = banks();
    return {
      genres: list("genres"),
      forms: list("forms"),
      structures: list("structures"),
      styles: list("styles"),
      casts: list("casts"),
      settings: list("settings"),
      settingTypes: SETTING_TYPES,
      times: list("times"),
      extras: list("extras")
    };
  }

  root.StimulusEngine = {
    generate: generate,
    applyLocks: applyLocks,
    labelOf: labelOf,
    options: options,
    isAny: isAny,
    RECENT_MAX: RECENT_MAX
  };
})(window);
