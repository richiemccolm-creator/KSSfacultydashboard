/**
 * Shared language switcher for drama lesson slide decks.
 * Requires drama-slides-i18n.css. Optional per-deck: drama-slides-{id}.i18n.js
 *
 * Mark translatable copy with data-i18n="key" (text) or data-i18n-html="key" (HTML).
 * English defaults live in the HTML; other languages in window.DRAMA_SLIDES_I18N.
 */
(function (w, d) {
  'use strict';

  var STORAGE_KEY = 'drama_slides_lang';
  var currentLang = 'en';

  var LANGUAGES = [
    { code: 'en', label: 'English', native: 'English', dir: 'ltr' },
    { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' },
    { code: 'fa', label: 'Persian', native: 'فارسی', dir: 'rtl' },
    { code: 'zh', label: 'Mandarin', native: '中文', dir: 'ltr' },
    { code: 'ur', label: 'Urdu', native: 'اردو', dir: 'rtl' },
    { code: 'pl', label: 'Polish', native: 'Polski', dir: 'ltr' }
  ];

  var UI_STRINGS = {
    'ui.lang.label': {
      ar: 'اللغة', fa: 'زبان', zh: '语言', ur: 'زبان', pl: 'Język'
    },
    'ui.lang.choose': {
      ar: 'اختر اللغة', fa: 'انتخاب زبان', zh: '选择语言', ur: 'زبان منتخب کریں', pl: 'Wybierz język'
    },
    'ui.nav.back': {
      ar: '← العودة إلى مركز الدراما', fa: '← بازگشت به مرکز دراما', zh: '← 返回戏剧中心', ur: '← ڈراما hub پر واپس', pl: '← Wróć do centrum dramy'
    },
    'ui.nav.previous': {
      ar: '← السابق', fa: '← قبلی', zh: '← 上一页', ur: '← پچھلا', pl: '← Wstecz'
    },
    'ui.nav.next': {
      ar: 'التالي →', fa: 'بعدی →', zh: '下一页 →', ur: 'اگلا →', pl: 'Dalej →'
    },
    'ui.nav.end': {
      ar: 'النهاية', fa: 'پایان', zh: '结束', ur: 'اختتام', pl: 'Koniec'
    },
    'ui.nav.reveal': {
      ar: 'إظهار ({n})', fa: 'نمایش ({n})', zh: '显示 ({n})', ur: 'ظاہر کریں ({n})', pl: 'Pokaż ({n})'
    },
    'ui.nav.slide-of': {
      ar: 'الشريحة {current} من {total}', fa: 'اسلاید {current} از {total}', zh: '第 {current} 页，共 {total} 页', ur: 'سلائیڈ {current} / {total}', pl: 'Slajd {current} z {total}'
    },
    'ui.nav.items-to-reveal': {
      ar: '{n} عنصر للإظهار', fa: '{n} مورد برای نمایش', zh: '还有 {n} 项待显示', ur: '{n} آئٹمز ظاہر کرنے ہیں', pl: '{n} elementów do pokazania'
    },
    'ui.nav.press-continue': {
      ar: 'اضغط → للمتابعة', fa: '→ را برای ادامه فشار دهید', zh: '按 → 继续', ur: '→ دبائیں جاری رکھنے کے لیے', pl: 'Naciśnij →, aby kontynuować'
    },
    'ui.nav.hint-fullscreen': {
      ar: 'F ملء الشاشة', fa: 'F تمام صفحه', zh: 'F 全屏', ur: 'F فل سکرین', pl: 'F pełny ekran'
    },
    'ui.hint.reveal': {
      ar: 'مسافة أو → للإظهار', fa: 'فاصله یا → برای نمایش', zh: '空格或 → 显示', ur: 'Space یا → ظاہر کریں', pl: 'Spacja lub →, aby pokazać'
    }
  };

  var defaults = {};
  var bar = null;
  var select = null;

  function langMeta(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return LANGUAGES[0];
  }

  function allStrings() {
    var deck = w.DRAMA_SLIDES_I18N || {};
    var merged = {};
    var key;
    for (key in UI_STRINGS) {
      if (Object.prototype.hasOwnProperty.call(UI_STRINGS, key)) merged[key] = UI_STRINGS[key];
    }
    for (key in deck) {
      if (Object.prototype.hasOwnProperty.call(deck, key)) merged[key] = deck[key];
    }
    return merged;
  }

  function interpolate(template, vars) {
    if (!template) return '';
    return String(template).replace(/\{(\w+)\}/g, function (_, name) {
      return vars && vars[name] != null ? vars[name] : '';
    });
  }

  function deckTranslation(key, lang) {
    var packs = w.DRAMA_SLIDE_TRANSLATIONS;
    if (!packs) return '';
    var enPack = (packs.en && packs.en.t) || {};
    if (lang === 'en') return enPack[key];
    var pack = packs[lang];
    var langPack = (pack && pack.t) || {};
    if (langPack[key] !== undefined && langPack[key] !== null && langPack[key] !== '') {
      return langPack[key];
    }
    return enPack[key];
  }

  function deckDir(lang) {
    var packs = w.DRAMA_SLIDE_TRANSLATIONS;
    if (!packs) return '';
    var pack = packs[lang];
    if (pack && pack.dir) return pack.dir;
    return langMeta(lang).dir || 'ltr';
  }

  function t(key, vars) {
    if (currentLang === 'en') {
      if (defaults[key]) return interpolate(defaults[key], vars);
      return '';
    }
    var fromDeck = deckTranslation(key, currentLang);
    if (fromDeck) return interpolate(fromDeck, vars);
    var strings = allStrings();
    var entry = strings[key];
    if (!entry) return defaults[key] ? interpolate(defaults[key], vars) : '';
    var text = entry[currentLang] || entry.en || defaults[key] || '';
    return interpolate(text, vars);
  }

  function cacheDefaults() {
    d.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key && !defaults[key]) {
        defaults[key] = el.children.length ? el.innerHTML : el.textContent;
      }
    });
    d.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (key && !defaults[key]) defaults[key] = el.innerHTML;
    });
    d.querySelectorAll('[data-t]').forEach(function (el) {
      var key = el.getAttribute('data-t');
      if (key && !defaults[key]) {
        defaults[key] = el.children.length ? el.innerHTML : el.textContent;
      }
    });
    var uiDefaults = {
      'ui.nav.back': '← Back to Drama Hub',
      'ui.nav.previous': '← Previous',
      'ui.nav.next': 'Next →',
      'ui.nav.end': 'End',
      'ui.nav.reveal': 'Reveal ({n})',
      'ui.nav.hint-fullscreen': 'F for fullscreen',
      'ui.hint.reveal': 'Space or → to reveal'
    };
    for (var k in uiDefaults) {
      if (!defaults[k]) defaults[k] = uiDefaults[k];
    }
  }

  function setElementText(el, text) {
    if (/<[a-z][\s\S]*>/i.test(text)) el.innerHTML = text;
    else el.textContent = text;
  }

  function applyLanguage(lang) {
    currentLang = lang || 'en';
    try { w.localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) {}

    var meta = langMeta(currentLang);
    var dir = deckDir(currentLang) || meta.dir || 'ltr';
    d.documentElement.lang = currentLang === 'zh' ? 'zh-Hans' : currentLang;
    d.documentElement.dir = dir;
    d.body.classList.toggle('slides-rtl', dir === 'rtl');
    d.body.classList.toggle('rtl', dir === 'rtl');

    d.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      if (currentLang === 'en') {
        setElementText(el, defaults[key] || el.textContent);
      } else {
        var translated = t(key);
        if (translated) setElementText(el, translated);
      }
    });

    d.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (!key) return;
      if (currentLang === 'en') {
        el.innerHTML = defaults[key] || el.innerHTML;
      } else {
        var html = t(key);
        if (html) el.innerHTML = html;
      }
    });

    d.querySelectorAll('[data-t]').forEach(function (el) {
      var key = el.getAttribute('data-t');
      if (!key) return;
      if (currentLang === 'en') {
        setElementText(el, defaults[key] || el.textContent);
      } else {
        var translated = t(key);
        if (translated) setElementText(el, translated);
      }
    });

    if (select && select.value !== currentLang) select.value = currentLang;

    w.dispatchEvent(new CustomEvent('drama-slides-lang-change', {
      detail: { lang: currentLang }
    }));
  }

  function createLanguageBar() {
    if (bar || !d.getElementById('deck')) return;

    bar = d.createElement('div');
    bar.className = 'slides-lang-bar';
    bar.id = 'slides-lang-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Slide language');

    var label = d.createElement('label');
    label.className = 'slides-lang-label';
    label.setAttribute('for', 'slides-lang-select');
    label.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">' +
      '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' +
      '</svg><span data-i18n="ui.lang.label">Language</span>';

    select = d.createElement('select');
    select.id = 'slides-lang-select';
    select.className = 'slides-lang-select';
    select.setAttribute('aria-label', 'Choose slide language');

    LANGUAGES.forEach(function (lang) {
      var opt = d.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.native + (lang.code !== 'en' ? ' · ' + lang.label : '');
      select.appendChild(opt);
    });

    select.addEventListener('change', function () {
      applyLanguage(select.value);
    });

    bar.appendChild(label);
    bar.appendChild(select);

    var deck = d.getElementById('deck');
    var viewport = deck.querySelector('.slide-viewport');
    if (viewport) {
      deck.insertBefore(bar, viewport);
    } else if (deck.parentNode) {
      deck.parentNode.insertBefore(bar, deck);
    } else {
      deck.insertBefore(bar, deck.firstChild);
    }

    defaults['ui.lang.label'] = 'Language';
    UI_STRINGS['ui.lang.label'].en = 'Language';
  }

  function readStoredLang() {
    try {
      var stored = w.localStorage.getItem(STORAGE_KEY);
      if (stored && langMeta(stored)) return stored;
    } catch (e) {}
    return 'en';
  }

  function init() {
    cacheDefaults();
    createLanguageBar();
    applyLanguage(readStoredLang());
  }

  /** Re-apply after inline deck translations load (drama-u*.html). */
  function refresh() {
    cacheDefaults();
    applyLanguage(currentLang || readStoredLang());
  }

  w.DramaSlidesI18n = {
    init: init,
    refresh: refresh,
    t: t,
    apply: applyLanguage,
    getLang: function () { return currentLang; },
    languages: LANGUAGES
  };

  if (w.DRAMA_SLIDE_DEFER_I18N) return;

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
