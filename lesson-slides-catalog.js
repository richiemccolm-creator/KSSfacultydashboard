/**
 * Lesson slides catalog for Teacher Planner.
 * Reads subject manifests (Drama today; Art/Photo reserved) and exposes
 * filterable units/lessons plus launch URL helpers.
 */
(function () {
  var SUBJECTS = [
    { id: 'drama', label: 'Drama' },
    { id: 'art', label: 'Art & Design' },
    { id: 'photography', label: 'Photography' }
  ];

  function slidesUrl(file) {
    if (!file) return '';
    var url = String(file);
    if (window.withAppVersion) url = window.withAppVersion(url);
    return url;
  }

  function getManifestUnits(subject) {
    if (subject === 'drama') {
      return (window.DRAMA_CURRICULUM && window.DRAMA_CURRICULUM.units) || {};
    }
    // Future: ART_CURRICULUM / PHOTO_CURRICULUM
    return {};
  }

  function subjectHasCatalog(subject) {
    var units = getManifestUnits(subject);
    return Object.keys(units).some(function (key) {
      var lessons = units[key] && units[key].lessons;
      return Array.isArray(lessons) && lessons.length > 0;
    });
  }

  function listUnits(subject, opts) {
    opts = opts || {};
    var readyOnly = opts.readyOnly !== false;
    var units = getManifestUnits(subject);
    var keys = Object.keys(units);
    keys.sort(function (a, b) {
      var ua = units[a] || {};
      var ub = units[b] || {};
      var ya = String(ua.year || '');
      var yb = String(ub.year || '');
      if (ya !== yb) {
        if (ya === 'Senior') return 1;
        if (yb === 'Senior') return -1;
        return ya.localeCompare(yb);
      }
      return String(a).localeCompare(String(b), undefined, { numeric: true });
    });
    return keys.map(function (key) {
      var u = units[key];
      var lessons = Array.isArray(u.lessons) ? u.lessons : [];
      var readyCount = lessons.filter(function (l) {
        return l && l.status === 'ready' && l.slides;
      }).length;
      var lessonCount = lessons.length;
      if (readyOnly && readyCount === 0) return null;
      var labelParts = [];
      if (u.unitLabel) labelParts.push(u.unitLabel);
      else if (u.id) labelParts.push('Unit ' + u.id);
      if (u.year) labelParts.push(u.year);
      var prefix = labelParts.length ? (labelParts.join(' · ') + ' — ') : '';
      return {
        id: u.id || key,
        key: key,
        title: u.title || ('Unit ' + key),
        label: prefix + (u.title || ('Unit ' + key)),
        year: u.year || '',
        course: u.course || '',
        lessonCount: lessonCount,
        readyCount: readyCount
      };
    }).filter(Boolean);
  }

  function listLessons(subject, unitKey, opts) {
    opts = opts || {};
    var readyOnly = opts.readyOnly !== false;
    var units = getManifestUnits(subject);
    var u = units[unitKey];
    if (!u) return [];
    var lessons = Array.isArray(u.lessons) ? u.lessons : [];
    return lessons.map(function (lesson, idx) {
      var ready = !!(lesson && lesson.status === 'ready' && lesson.slides);
      if (readyOnly && !ready) return null;
      return {
        id: String(lesson.id || (idx + 1)),
        title: lesson.title || ('Lesson ' + (idx + 1)),
        slides: lesson.slides || '',
        status: lesson.status || 'planned',
        ready: ready,
        isHub: !!lesson.isHub,
        session: lesson.session || null,
        unitId: u.id || unitKey,
        unitTitle: u.title || '',
        unitLabel: u.unitLabel || '',
        year: u.year || '',
        course: u.course || '',
        subject: subject
      };
    }).filter(Boolean);
  }

  function attachmentFromPick(subject, unitKey, lesson) {
    if (!lesson || !lesson.slides) return null;
    return {
      slidesSubject: subject || 'drama',
      slidesUnitId: String(unitKey || lesson.unitId || ''),
      slidesLessonId: String(lesson.id || ''),
      slidesFile: String(lesson.slides),
      slidesTitle: String(lesson.title || 'Lesson slides'),
      slidesIsHub: !!lesson.isHub
    };
  }

  function resourceLabel(title) {
    var t = String(title || 'Lesson slides').trim();
    if (/^lesson slides/i.test(t)) return t;
    return 'Lesson slides: ' + t;
  }

  function isSlidesResource(r, slidesFile) {
    if (!r) return false;
    var label = String(r.label || '');
    var url = String(r.url || '');
    if (/^lesson slides/i.test(label)) return true;
    if (slidesFile && url.indexOf(String(slidesFile)) !== -1) return true;
    return false;
  }

  function syncResourcesWithSlides(resources, attachment) {
    var list = Array.isArray(resources) ? resources.slice() : [];
    var prevFile = attachment && attachment.slidesFile ? attachment.slidesFile : '';
    list = list.filter(function (r) { return !isSlidesResource(r, prevFile); });
    if (attachment && attachment.slidesFile) {
      list.unshift({
        label: resourceLabel(attachment.slidesTitle),
        url: slidesUrl(attachment.slidesFile)
      });
    }
    return list;
  }

  function getAttachmentFromLesson(lesson) {
    if (!lesson) return null;
    if (lesson.slidesFile) {
      return {
        slidesSubject: lesson.slidesSubject || 'drama',
        slidesUnitId: lesson.slidesUnitId || '',
        slidesLessonId: lesson.slidesLessonId || '',
        slidesFile: lesson.slidesFile,
        slidesTitle: lesson.slidesTitle || 'Lesson slides',
        slidesIsHub: !!lesson.slidesIsHub
      };
    }
    var resources = lesson.resources;
    if (!Array.isArray(resources)) return null;
    for (var i = 0; i < resources.length; i++) {
      var r = resources[i];
      if (!r || !r.url) continue;
      if (!isSlidesResource(r)) continue;
      var file = String(r.url).split('?')[0].replace(/^\.\//, '');
      var parts = file.split('/');
      file = parts[parts.length - 1] || file;
      if (!/\.html?$/i.test(file)) continue;
      var title = String(r.label || '').replace(/^lesson slides:\s*/i, '').trim() || 'Lesson slides';
      return {
        slidesSubject: lesson.subject || 'drama',
        slidesUnitId: '',
        slidesLessonId: '',
        slidesFile: file,
        slidesTitle: title,
        slidesIsHub: /ah_drama_hub/i.test(file)
      };
    }
    return null;
  }

  function launch(attachment) {
    if (!attachment || !attachment.slidesFile) return false;
    var url = slidesUrl(attachment.slidesFile);
    window.open(url, '_blank', 'noopener');
    return true;
  }

  window.LessonSlidesCatalog = {
    SUBJECTS: SUBJECTS,
    slidesUrl: slidesUrl,
    subjectHasCatalog: subjectHasCatalog,
    listUnits: listUnits,
    listLessons: listLessons,
    attachmentFromPick: attachmentFromPick,
    syncResourcesWithSlides: syncResourcesWithSlides,
    getAttachmentFromLesson: getAttachmentFromLesson,
    resourceLabel: resourceLabel,
    launch: launch
  };
})();
