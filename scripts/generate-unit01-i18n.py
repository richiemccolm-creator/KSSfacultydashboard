#!/usr/bin/env python3
"""Generate drama-slides-unit01_1.i18n.js from HTML keys + translation table."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "drama-slides-unit01_1.html"
OUT = ROOT / "drama-slides-unit01_1.i18n.js"
LANGS = ("ar", "fa", "zh", "ur", "pl")


def extract_defaults(html: str) -> dict[str, str]:
    defaults: dict[str, str] = {}
    for m in re.finditer(r'data-i18n="([^"]+)"[^>]*>(.*?)</', html, re.DOTALL):
        key, raw = m.group(1), m.group(2).strip()
        if key.startswith("<") or not key:
            continue
        if key not in defaults:
            defaults[key] = raw
    for m in re.finditer(r'data-i18n-html="([^"]+)"[^>]*>(.*?)</', html, re.DOTALL):
        key, raw = m.group(1), m.group(2).strip()
        if key not in defaults:
            defaults[key] = raw
    return defaults


def load_translations() -> dict[str, dict[str, str]]:
    data_path = ROOT / "drama-slides-unit01_1.translations.json"
    return json.loads(data_path.read_text(encoding="utf-8"))


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    defaults = extract_defaults(html)
    translations = load_translations()
    missing = [k for k in defaults if k not in translations and not k.startswith("ui.")]
    if missing:
        raise SystemExit(f"Missing translations for {len(missing)} keys: {missing[:10]}...")

    lines = [
        "/** Translations for drama-slides-unit01_1.html — regenerate via scripts/generate-unit01-i18n.py */",
        "window.DRAMA_SLIDES_I18N = window.DRAMA_SLIDES_I18N || {};",
        "(function (T) {",
        "  Object.keys(T).forEach(function (key) {",
        "    window.DRAMA_SLIDES_I18N[key] = T[key];",
        "  });",
        "})({",
    ]
    for key in sorted(translations.keys()):
        entry = translations[key]
        lines.append(f"  {json.dumps(key, ensure_ascii=False)}: {{")
        for lang in LANGS:
            lines.append(f"    {lang}: {json.dumps(entry[lang], ensure_ascii=False)},")
        lines.append("  },")
    lines.append("});")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.name} with {len(translations)} keys ({len(defaults)} in HTML)")


if __name__ == "__main__":
    main()
