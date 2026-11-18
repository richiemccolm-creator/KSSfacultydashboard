import { jsPDF } from 'jspdf';
import type { Project, Post, Story, Conversation } from './types';
import { categories } from './types';

/*
 * StageFeed folio: a designed A4 PDF built in the browser.
 * Dark cover and back cover, warm paper inside. Instrument Serif for display,
 * Instrument Sans for reading text. Everything is drawn locally; no image or
 * text leaves the device.
 */

type RGB = readonly [number, number, number];
const W = 210, H = 297, M = 18, CW = W - 2 * M, TOP = 30, BOTTOM = H - 22;
const PT = 0.3528; // mm per point
const C = {
  paper: [248, 246, 242], ink: [24, 22, 30], ink2: [70, 66, 80], muted: [128, 123, 138], line: [224, 219, 212],
  accent: [104, 78, 196], accentSoft: [237, 232, 251], bubble: [236, 233, 228],
  night: [17, 17, 20], nightText: [238, 238, 241], nightMuted: [150, 147, 164], lilac: [183, 163, 243],
} satisfies Record<string, RGB>;

const STAGES: Record<string, string> = {
  'Inspiration': 'Where the ideas began: images, moods and sparks.',
  'Research': 'The world of the play, its period and its people.',
  'Initial Idea': 'First responses to the brief.',
  'Experimentation': 'Testing materials, colours and possibilities.',
  'Development': 'Refining the strongest ideas.',
  'Feedback': 'What others said, and what changed because of it.',
  'Final Design': 'The finished design.',
  'Evaluation': 'Looking back on the process.',
};

const clean = (v: string) => (v || '').replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/[ \t]+\n/g, '\n').trim();
const fmtDate = (d: string) => { const t = new Date(d + 'T12:00:00'); return isNaN(+t) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
const pad2 = (n: number) => String(n).padStart(2, '0');
const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

async function fontData(path: string) {
  const buf = await fetch(path).then(r => { if (!r.ok) throw new Error('Font unavailable'); return r.arrayBuffer(); });
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function loadImage(src: string) { const img = new Image(); img.src = src; return img.decode().then(() => img); }

interface Framed { data: string; w: number; h: number; png: boolean }
/** Crops (cover) or fits (contain) an image into a box, with optional rounded corners or a circle. */
async function frame(src: string, wmm: number, hmm: number, o: { fit?: 'cover' | 'contain'; r?: number; bg?: RGB; circle?: boolean } = {}): Promise<Framed | null> {
  if (!src) return null;
  let img: HTMLImageElement;
  try { img = await loadImage(src); } catch { return null; }
  let w = wmm, h = hmm;
  if (o.fit === 'contain') { const s = Math.min(wmm / img.naturalWidth, hmm / img.naturalHeight); w = img.naturalWidth * s; h = img.naturalHeight * s; }
  const k = Math.min(7, 1700 / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d')!;
  const png = !!o.circle;
  if (!png) { g.fillStyle = css(o.bg || C.paper); g.fillRect(0, 0, cw, ch); }
  g.save(); g.beginPath();
  if (o.circle) g.arc(cw / 2, ch / 2, Math.min(cw, ch) / 2, 0, Math.PI * 2);
  else if (o.r) { const r = Math.min(o.r * k, cw / 2, ch / 2); g.moveTo(r, 0); g.arcTo(cw, 0, cw, ch, r); g.arcTo(cw, ch, 0, ch, r); g.arcTo(0, ch, 0, 0, r); g.arcTo(0, 0, cw, 0, r); g.closePath(); }
  else g.rect(0, 0, cw, ch);
  g.clip();
  const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  g.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh); g.restore();
  return { data: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88), w, h, png };
}

type Font = 'Serif' | 'SerifItalic' | 'Sans' | 'SansBold';
interface TextOpts { font?: Font; size?: number; color?: RGB; x?: number; width?: number; lead?: number; after?: number; align?: 'left' | 'center' | 'right'; tags?: boolean; bar?: RGB }

class Folio {
  doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  y = TOP;
  dark = new Set<number>();
  section = new Map<number, string>();
  current = '';
  constructor(public project: Project) {}

  async fonts() {
    const files: [string, Font][] = [['InstrumentSerif-Regular', 'Serif'], ['InstrumentSerif-Italic', 'SerifItalic'], ['InstrumentSans-Regular', 'Sans'], ['InstrumentSans-Bold', 'SansBold']];
    const data = await Promise.all(files.map(([f]) => fontData(`./fonts/${f}.ttf`)));
    files.forEach(([f, name], i) => { this.doc.addFileToVFS(`${f}.ttf`, data[i]); this.doc.addFont(`${f}.ttf`, name, 'normal'); });
  }
  get page() { return this.doc.getNumberOfPages(); }
  fill(c: RGB) { this.doc.setFillColor(c[0], c[1], c[2]); }
  stroke(c: RGB) { this.doc.setDrawColor(c[0], c[1], c[2]); }
  ink(c: RGB) { this.doc.setTextColor(c[0], c[1], c[2]); }
  font(f: Font, size: number) { this.doc.setFont(f, 'normal'); this.doc.setFontSize(size); }
  opacity(v: number) { const d = this.doc as any; d.setGState(new d.GState({ opacity: v })); }

  newPage(dark = false, first = false) {
    if (!first) this.doc.addPage();
    this.fill(dark ? C.night : C.paper); this.doc.rect(0, 0, W, H, 'F');
    if (dark) this.dark.add(this.page); else this.section.set(this.page, this.current);
    this.y = TOP;
  }
  ensure(need: number) { if (this.y + need > BOTTOM) { this.newPage(); return true; } return false; }

  /** Small capitals label with tracking. */
  label(text: string, x: number, y: number, color: RGB, align: 'left' | 'right' = 'left', size = 7.5) {
    const s = text.toUpperCase(), sp = 0.55; this.font('SansBold', size); this.ink(color);
    const w = this.doc.getTextWidth(s) + sp * (s.length - 1);
    this.doc.text(s, align === 'right' ? x - w : x, y, { baseline: 'top', charSpace: sp });
    return w;
  }

  /** Flowing paragraph. Breaks onto new pages, colours #tags and @names, and can draw a side bar. */
  text(value: string, o: TextOpts = {}) {
    const v = clean(value); if (!v) return;
    const size = o.size ?? 10.5, font = o.font ?? 'Sans', x = o.x ?? M, width = o.width ?? CW, color = o.color ?? C.ink;
    const lh = size * PT * (o.lead ?? 1.42);
    this.font(font, size);
    const lines: string[] = this.doc.splitTextToSize(v, width - (o.bar ? 6 : 0));
    for (const line of lines) {
      if (this.ensure(lh)) this.font(font, size);
      const tx = x + (o.bar ? 6 : 0);
      if (o.bar) { this.fill(o.bar); this.doc.rect(x, this.y - lh * 0.12, 0.9, lh, 'F'); }
      if (o.tags && /[#@]/.test(line)) {
        let cx = tx;
        for (const part of line.split(/(\s+)/)) {
          if (!part) continue;
          this.ink(/^[#@]\w/.test(part) ? C.accent : color);
          this.doc.text(part, cx, this.y, { baseline: 'top' }); cx += this.doc.getTextWidth(part);
        }
      } else {
        this.ink(color);
        const ax = o.align === 'center' ? x + width / 2 : o.align === 'right' ? x + width : tx;
        this.doc.text(line, ax, this.y, { baseline: 'top', align: o.align ?? 'left' });
      }
      this.y += lh;
    }
    this.y += o.after ?? 3;
  }

  image(f: Framed | null, x: number, y: number) { if (f) this.doc.addImage(f.data, f.png ? 'PNG' : 'JPEG', x, y, f.w, f.h, undefined, 'FAST'); }

  star(cx: number, cy: number, r: number, c: RGB) {
    const pts: [number, number][] = [];
    for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * 0.3 : r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    this.fill(c); this.doc.lines(segs, pts[0][0], pts[0][1], [1, 1], 'F', true);
  }

  async avatar(cx: number, cy: number, r: number, ring: RGB) {
    this.fill(ring); this.doc.circle(cx, cy, r + 1.4, 'F');
    const f = await frame(this.project.avatar, r * 2, r * 2, { circle: true });
    if (f) { this.image(f, cx - r, cy - r); return; }
    this.fill(C.accent); this.doc.circle(cx, cy, r, 'F');
    const initial = clean(this.project.name).charAt(0).toUpperCase() || '✦';
    this.font('Serif', r * 1.5 / PT); this.ink([255, 255, 255]);
    this.doc.text(initial, cx, cy, { align: 'center', baseline: 'middle' });
  }

  wordmark(x: number, y: number, color: RGB, starColor: RGB, size = 11) {
    this.font('SansBold', size); this.ink(color);
    this.doc.text('stagefeed', x, y, { baseline: 'top' });
    this.star(x + this.doc.getTextWidth('stagefeed') + 2.6, y + size * PT * 0.42, size * PT * 0.42, starColor);
  }

  /** Running header and footer on every paper page; drawn last so totals are known. */
  furniture() {
    const total = this.page, p = this.project;
    for (let i = 1; i <= total; i++) {
      if (this.dark.has(i)) continue;
      this.doc.setPage(i);
      this.wordmark(M, 12, C.ink, C.accent, 8.5);
      const s = this.section.get(i); if (s) this.label(s, W - M, 12.6, C.muted, 'right', 7);
      this.stroke(C.line); this.doc.setLineWidth(0.2); this.doc.line(M, 19, W - M, 19); this.doc.line(M, H - 15, W - M, H - 15);
      this.font('Sans', 7.5); this.ink(C.muted);
      this.doc.text(clean(`${p.name}  ·  ${p.production}`), M, H - 11, { baseline: 'top' });
      this.doc.text(`${i} / ${total}`, W - M, H - 11, { baseline: 'top', align: 'right' });
    }
  }
}

async function cover(f: Folio, posts: Post[], evidence: boolean) {
  const { doc, project: p } = f;
  f.newPage(true, true);
  // Soft stage light from the top left
  f.fill(C.lilac);
  for (let i = 0; i < 7; i++) { f.opacity(0.035); doc.ellipse(40, -10, 150 - i * 18, 120 - i * 15, 'F'); }
  f.opacity(1);
  f.wordmark(M, 16, C.nightText, C.lilac, 12);
  f.label(evidence ? 'Evidence folio' : 'Visual folio', W - M, 17.4, C.nightMuted, 'right');

  // Mosaic of posts
  const pics = posts.filter(x => x.images[0]).slice(0, 6);
  let base = 66;
  if (pics.length >= 3) {
    const cols = 3, rows = pics.length >= 6 ? 2 : 1, gap = 2.5, cell = (CW - gap * (cols - 1)) / cols, ch = rows === 2 ? cell : cell * 1.25;
    const frames = await Promise.all(pics.slice(0, cols * rows).map(x => frame(x.images[0], cell, ch, { r: 2.5, bg: C.night })));
    frames.forEach((fr, i) => f.image(fr, M + (i % cols) * (cell + gap), 32 + Math.floor(i / cols) * (ch + gap)));
    base = 32 + rows * ch + (rows - 1) * gap;
  }
  const r = 19;
  await f.avatar(M + r + 1.4, base + 4, r, C.night);
  f.y = base + 4 + r + 10;

  f.text(p.name || 'Untitled', { font: 'Serif', size: 50, color: C.nightText, lead: 1.02, after: 2 });
  f.text(`@${p.username}`, { font: 'SansBold', size: 11, color: C.lilac, after: 7 });
  f.text(p.production, { font: 'SerifItalic', size: 21, color: C.nightText, lead: 1.15, after: 1 });
  if (p.mode === 'character' && p.author) f.text(`by ${p.author}`, { size: 10.5, color: C.nightMuted });

  // Details band
  const by = H - 52;
  f.stroke([60, 58, 70]); doc.setLineWidth(0.25); doc.line(M, by, W - M, by);
  const cols: [string, string][] = [
    ['Submitted by', p.pupil || '—'],
    p.mode === 'designer' ? ['Specialism', p.specialism] : ['Role', 'Character account'],
    ['Compiled', fmtDate(new Date().toISOString().slice(0, 10))],
  ];
  const cw = CW / 3;
  cols.forEach(([k, v], i) => {
    f.label(k, M + i * cw, by + 6, C.nightMuted, 'left', 6.8);
    f.font('Sans', 10.5); f.ink(C.nightText);
    doc.text(doc.splitTextToSize(clean(v), cw - 6).slice(0, 2), M + i * cw, by + 12, { baseline: 'top' });
  });
  f.font('Sans', 7.5); f.ink(C.nightMuted);
  doc.text('Every account, conversation, like and follower count in this folio is authored fiction, created in StageFeed.', M, H - 18, { baseline: 'top', maxWidth: CW });
}

async function profile(f: Folio, posts: Post[]) {
  const { doc, project: p } = f;
  f.current = 'Profile'; f.newPage();
  const r = 15;
  await f.avatar(M + r + 1.4, TOP + r + 1.4, r, C.paper);
  const tx = M + 2 * r + 10;
  f.y = TOP + 2;
  f.text(p.name, { font: 'Serif', size: 28, x: tx, width: W - M - tx, lead: 1.05, after: 1 });
  f.text(`@${p.username}`, { font: 'SansBold', size: 9.5, color: C.accent, x: tx, after: 0 });
  f.y = Math.max(f.y, TOP + 2 * r + 9);
  if (p.bio) f.text(p.bio, { font: 'SerifItalic', size: 14, color: C.ink2, lead: 1.3, after: 6 });

  // Stats
  const stats: [string, string][] = [[String(posts.length), 'Posts'], [p.followers.toLocaleString('en-GB'), 'Fictional followers'], [p.following.toLocaleString('en-GB'), 'Fictional following']];
  f.stroke(C.line); doc.setLineWidth(0.2); doc.line(M, f.y, W - M, f.y);
  const sy = f.y + 5, sw = CW / 3;
  stats.forEach(([n, l], i) => {
    f.font('Serif', 26); f.ink(C.ink); doc.text(n, M + i * sw, sy, { baseline: 'top' });
    f.label(l, M + i * sw, sy + 11, C.muted, 'left', 6.8);
    if (i) doc.line(M + i * sw - 5, sy, M + i * sw - 5, sy + 15);
  });
  f.y = sy + 20; doc.line(M, f.y, W - M, f.y); f.y += 8;

  // Profile grid
  const grid = posts.filter(x => x.images[0]);
  if (grid.length) {
    f.label('The grid', M, f.y, C.accent); f.y += 7;
    const gap = 1.6, cell = (CW - gap * 2) / 3, fit = Math.max(1, Math.floor((BOTTOM - f.y + gap) / (cell + gap)));
    const shown = grid.slice(0, fit * 3);
    const frames = await Promise.all(shown.map(x => frame(x.images[0], cell, cell, { r: 1.2 })));
    frames.forEach((fr, i) => f.image(fr, M + (i % 3) * (cell + gap), f.y + Math.floor(i / 3) * (cell + gap)));
    f.y += Math.ceil(shown.length / 3) * (cell + gap);
    if (grid.length > shown.length) { f.y += 2; f.text(`+ ${grid.length - shown.length} more posts inside`, { size: 8.5, color: C.muted }); }
  }
}

interface Entry { title: string; note: string; page: number; chapter?: string }

function contentsPages(count: number) { return Math.max(1, Math.ceil((count + 2) / 20)); }

function drawContents(f: Folio, startPage: number, entries: Entry[], designer: boolean) {
  const { doc } = f; let page = startPage, y = TOP + 26;
  doc.setPage(page);
  f.font('Serif', 34); f.ink(C.ink); doc.text('Contents', M, TOP, { baseline: 'top' });
  f.font('SerifItalic', 13); f.ink(C.muted);
  doc.text(designer ? 'The design process, stage by stage.' : 'The story so far, post by post.', M, TOP + 14, { baseline: 'top' });
  for (const e of entries) {
    if (y + 11 > BOTTOM) { page++; doc.setPage(page); y = TOP; }
    if (e.chapter) { f.font('Serif', 15); f.ink(C.accent); doc.text(e.chapter, M, y, { baseline: 'top' }); }
    const tx = M + (e.chapter ? 13 : 0);
    f.font('Serif', 15); f.ink(C.ink);
    const title = doc.splitTextToSize(clean(e.title), CW - 40 - (tx - M))[0] || '';
    doc.text(title, tx, y, { baseline: 'top' });
    f.font('Sans', 8.5); f.ink(C.muted); doc.text(clean(e.note), tx, y + 6.4, { baseline: 'top' });
    f.font('Serif', 15); f.ink(C.ink); doc.text(String(e.page), W - M, y, { baseline: 'top', align: 'right' });
    f.stroke(C.line); doc.setLineWidth(0.2); doc.line(M, y + 12.5, W - M, y + 12.5);
    y += 16;
  }
}

async function postPage(f: Folio, post: Post, n: number, evidence: boolean, chapter?: { num: number; name: string; count: number }) {
  const { doc, project: p } = f;
  f.newPage();
  if (chapter) {
    f.font('Serif', 64); f.ink(C.accent); doc.text(pad2(chapter.num), M - 1, TOP - 4, { baseline: 'top' });
    f.font('Serif', 34); f.ink(C.ink); doc.text(chapter.name, M + 34, TOP + 1, { baseline: 'top' });
    f.font('SerifItalic', 12.5); f.ink(C.muted);
    doc.text(`${STAGES[chapter.name] || 'From the process.'}  ·  ${chapter.count} post${chapter.count === 1 ? '' : 's'}`, M + 34, TOP + 15, { baseline: 'top', maxWidth: CW - 34 });
    f.y = TOP + 30; f.stroke(C.ink); doc.setLineWidth(0.5); doc.line(M, f.y, W - M, f.y); f.y += 7;
  }
  // Meta row
  f.label(`Post ${pad2(n)}  ·  ${fmtDate(post.date)}`, M, f.y, C.muted);
  if (post.category && p.mode !== 'designer') {
    const cat = clean(post.category).toUpperCase(); f.font('SansBold', 7); const w = doc.getTextWidth(cat) + 0.5 * (cat.length - 1) + 6;
    f.fill(C.accentSoft); doc.roundedRect(W - M - w, f.y - 1.6, w, 6, 3, 3, 'F'); f.label(cat, W - M - 3, f.y, C.accent, 'right', 7);
  }
  f.y += 8;

  // Images
  const imgs = post.images.filter(Boolean), maxH = chapter ? 118 : 140;
  if (imgs.length === 1) {
    const fr = await frame(imgs[0], CW, maxH, { fit: 'contain', r: 2 });
    if (fr) { f.image(fr, M + (CW - fr.w) / 2, f.y); f.y += fr.h + 8; }
  } else if (imgs.length === 2) {
    const w = (CW - 3) / 2, h = Math.min(maxH, w * 1.25);
    const frs = await Promise.all(imgs.map(s => frame(s, w, h, { r: 2 })));
    frs.forEach((fr, i) => f.image(fr, M + i * (w + 3), f.y)); f.y += h + 8;
  } else if (imgs.length > 2) {
    const thumbs = imgs.slice(1, 5), gap = 3, tw = (CW - gap * (thumbs.length - 1)) / thumbs.length, th = Math.min(tw, 38), hh = maxH - th - gap;
    const hero = await frame(imgs[0], CW, hh, { r: 2 });
    f.image(hero, M, f.y);
    const frs = await Promise.all(thumbs.map(s => frame(s, tw, th, { r: 1.6 })));
    frs.forEach((fr, i) => f.image(fr, M + i * (tw + gap), f.y + hh + gap)); f.y += maxH + 8;
  }

  // Caption
  f.text(post.caption, { font: 'Serif', size: 16, lead: 1.28, tags: true, after: 4 });
  f.label(`${post.likes.toLocaleString('en-GB')} fictional likes  ·  ${post.comments.length} comment${post.comments.length === 1 ? '' : 's'}`, M, f.y, C.muted, 'left', 6.8);
  f.y += 8;

  for (const c of post.comments) {
    f.ensure(10);
    f.text(c.author, { font: 'SansBold', size: 9, color: C.ink, bar: C.line, after: 0, lead: 1.35 });
    f.text(c.text, { size: 9.5, color: C.ink2, bar: C.line, after: 2.5, lead: 1.4 });
  }

  if (evidence && (post.thinking || post.evidence)) {
    f.y += 3;
    const panel = (title: string, body: string) => {
      if (!clean(body)) return;
      f.ensure(20);
      f.label(title, M + 6, f.y, C.accent); f.y += 6;
      f.text(body, { size: 10.5, color: C.ink, bar: C.accent, lead: 1.5, after: 6 });
    };
    panel(p.mode === 'character' ? 'Character thinking' : 'Design thinking', post.thinking);
    panel(p.mode === 'character' ? 'Script evidence' : 'Research and references', post.evidence);
  }
}

async function stories(f: Folio, list: Story[]) {
  const { doc } = f;
  f.current = 'Stories'; f.newPage();
  f.font('Serif', 34); f.ink(C.ink); doc.text('Stories & highlights', M, TOP, { baseline: 'top' });
  f.y = TOP + 18;
  const gap = 6, w = (CW - gap * 2) / 3, h = w * 16 / 9;
  for (let i = 0; i < list.length; i++) {
    const s = list[i], col = i % 3;
    if (col === 0 && i) f.y += h + 26;
    if (col === 0 && f.y + h + 22 > BOTTOM) { f.newPage(); }
    const x = M + col * (w + gap);
    const fr = await frame(s.image, w, h, { r: 3 });
    if (fr) f.image(fr, x, f.y);
    else { const c = /^#[0-9a-f]{6}$/i.test(s.color) ? [parseInt(s.color.slice(1, 3), 16), parseInt(s.color.slice(3, 5), 16), parseInt(s.color.slice(5, 7), 16)] as const : C.ink; f.fill(c); doc.roundedRect(x, f.y, w, h, 3, 3, 'F'); }
    f.label(s.highlight || 'Story', x, f.y + h + 3.5, C.accent, 'left', 6.8);
    f.font('Sans', 8.5); f.ink(C.ink2);
    doc.text((doc.splitTextToSize(clean(s.text), w) as string[]).slice(0, 3), x, f.y + h + 9, { baseline: 'top', lineHeightFactor: 1.35 });
  }
}

async function conversation(f: Folio, c: Conversation) {
  const { doc, project: p } = f;
  f.current = 'Messages'; f.newPage();
  f.fill(C.ink); doc.circle(M + 7, TOP + 7, 7, 'F');
  f.font('Serif', 16); f.ink(C.paper); doc.text((clean(c.name).charAt(0) || '?').toUpperCase(), M + 7, TOP + 7, { align: 'center', baseline: 'middle' });
  f.font('Serif', 24); f.ink(C.ink); doc.text(clean(c.name), M + 19, TOP - 0.5, { baseline: 'top' });
  f.label(`@${c.username}  ·  fictional conversation`, M + 19, TOP + 9.5, C.muted, 'left', 6.8);
  f.y = TOP + 24;
  const maxW = CW * 0.68;
  for (const m of c.messages) {
    const me = m.side === 'me', txt = clean(m.text);
    f.font('Sans', 10);
    const lines: string[] = txt ? doc.splitTextToSize(txt, maxW - 10) : [];
    const lh = 10 * PT * 1.4, bw = Math.min(maxW, Math.max(18, ...lines.map(l => doc.getTextWidth(l))) + 10), bh = lines.length * lh + 7;
    const img = m.image ? await frame(m.image, 70, 70, { fit: 'contain', r: 3 }) : null;
    f.ensure((txt ? bh : 0) + (img ? img.h + 3 : 0) + 7);
    if (img) { f.image(img, me ? W - M - img.w : M, f.y); f.y += img.h + 3; }
    if (txt) {
      const x = me ? W - M - bw : M;
      f.fill(me ? C.accent : C.bubble); doc.roundedRect(x, f.y, bw, bh, 4, 4, 'F');
      f.font('Sans', 10); f.ink(me ? [255, 255, 255] : C.ink);
      lines.forEach((l, i) => doc.text(l, x + 5, f.y + 3.5 + i * lh, { baseline: 'top' }));
      f.y += bh + 1.5;
    }
    f.font('Sans', 7); f.ink(C.muted);
    doc.text(`${me ? clean(p.name) : clean(c.name)}  ·  ${clean(m.time)}`, me ? W - M : M, f.y, { baseline: 'top', align: me ? 'right' : 'left' });
    f.y += 7;
  }
}

function backCover(f: Folio) {
  const { doc } = f;
  f.newPage(true);
  f.fill(C.lilac);
  for (let i = 0; i < 7; i++) { f.opacity(0.03); doc.ellipse(W / 2, H / 2, 120 - i * 15, 120 - i * 15, 'F'); }
  f.opacity(1);
  f.star(W / 2, H / 2 - 14, 9, C.lilac);
  f.font('SansBold', 22); f.ink(C.nightText); doc.text('stagefeed', W / 2, H / 2, { align: 'center', baseline: 'top' });
  f.font('SerifItalic', 13); f.ink(C.nightMuted); doc.text('Your characters. Your creative world.', W / 2, H / 2 + 11, { align: 'center', baseline: 'top' });
  f.font('Sans', 7.5); doc.text('A fictional social media simulation. Nothing in this folio was posted online.', W / 2, H - 22, { align: 'center', baseline: 'top' });
}

export async function exportPDF(project: Project, evidence: boolean, messages: boolean) {
  const f = new Folio(project);
  await f.fonts();
  const posts = project.posts.filter(p => !p.draft).sort((a, b) => a.date.localeCompare(b.date));
  const designer = project.mode === 'designer';

  await cover(f, posts, evidence);
  await profile(f, posts);

  // Plan the order of posts (designers: grouped by process stage)
  type Item = { post: Post; chapter?: { num: number; name: string; count: number } };
  const items: Item[] = [];
  if (designer) {
    const order = [...categories, ...new Set(posts.map(p => p.category).filter(c => c && !categories.includes(c)))];
    const groups = order.map(name => ({ name, list: posts.filter(p => p.category === name) })).filter(g => g.list.length);
    const loose = posts.filter(p => !p.category); if (loose.length) groups.push({ name: 'Other work', list: loose });
    groups.forEach((g, gi) => g.list.forEach((post, i) => items.push({ post, chapter: i === 0 ? { num: gi + 1, name: g.name, count: g.list.length } : undefined })));
  } else posts.forEach(post => items.push({ post }));

  const convos = messages ? project.conversations.filter(c => c.messages.length) : [];
  const entryCount = (designer ? items.filter(i => i.chapter).length : items.length) + (project.stories.length ? 1 : 0) + (convos.length ? 1 : 0);
  const showContents = entryCount > 1;
  const contentsStart = f.page + 1;
  if (showContents) { f.current = 'Contents'; for (let i = 0; i < contentsPages(entryCount); i++) f.newPage(); }

  const entries: Entry[] = [];
  let n = 0;
  for (const it of items) {
    n++;
    if (!designer) f.current = 'Posts';
    else if (it.chapter) f.current = `${pad2(it.chapter.num)}  ${it.chapter.name}`;
    const pg = f.page + 1;
    await postPage(f, it.post, n, evidence, it.chapter);
    if (designer) { if (it.chapter) entries.push({ chapter: pad2(it.chapter.num), title: it.chapter.name, note: `${it.chapter.count} post${it.chapter.count === 1 ? '' : 's'}`, page: pg }); }
    else entries.push({ title: clean(it.post.caption).split('\n')[0] || 'Untitled post', note: [fmtDate(it.post.date), clean(it.post.category)].filter(Boolean).join('  ·  '), page: pg });
  }

  if (project.stories.length) { const pg = f.page + 1; await stories(f, project.stories); entries.push({ title: 'Stories & highlights', note: `${project.stories.length} stor${project.stories.length === 1 ? 'y' : 'ies'}`, page: pg }); }
  if (convos.length) {
    const pg = f.page + 1;
    for (const c of convos) await conversation(f, c);
    entries.push({ title: 'Messages', note: `${convos.length} fictional conversation${convos.length === 1 ? '' : 's'}`, page: pg });
  }
  backCover(f);
  if (showContents) drawContents(f, contentsStart, entries, designer);
  f.furniture();
  f.doc.save(`${project.username || 'stagefeed'}-${evidence ? 'evidence-folio' : 'folio'}.pdf`);
}

