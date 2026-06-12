/**
 * Injects SDS meta-skills chips into drama lesson deck LI/SC slides (Unit01–03).
 */
(function () {
  var titleMatch = document.title.match(/Unit\s*0?(\d+)/i);
  if (!titleMatch || !window.DRAMA_UNIT_META) return;
  var uid = titleMatch[1].length === 1 ? '0' + titleMatch[1] : titleMatch[1];
  var meta = window.DRAMA_UNIT_META[uid];
  if (!meta || !meta.meta_skills || !meta.meta_skills.length) return;

  var lisc = document.querySelector('.s-lisc .lisc-inner');
  if (!lisc || lisc.querySelector('.meta-skills-inject')) return;

  var chips = meta.meta_skills.map(function (skill) {
    var colour = typeof getMetaSkillColour === 'function' ? getMetaSkillColour(skill) : '#94A3B8';
    return '<div class="title-chip" style="border-color:' + colour + '55;color:' + colour + '">' + skill + '</div>';
  }).join('');

  var wrap = document.createElement('div');
  wrap.className = 'meta-skills-inject';
  wrap.style.marginTop = '12px';
  wrap.innerHTML = '<div class="block-label" style="font-family:\'Bebas Neue\',sans-serif;font-size:12px;letter-spacing:.15em;color:var(--accent);margin-bottom:8px">SDS Meta-Skills</div><div class="title-chips">' + chips + '</div>';
  lisc.appendChild(wrap);
})();
