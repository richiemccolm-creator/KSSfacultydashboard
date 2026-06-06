#!/usr/bin/env python3
"""Build Unit 01 lesson slides in Bebas/Barlow format (matching Unit 02/03)."""

ACCENT = '#FF3B30'
ACCENT_LT = '#FF8A82'
ACCENT_RGB = '255,59,48'


def css():
    return f"""  :root {{
    --accent:{ACCENT}; --accent-lt:{ACCENT_LT};
    --navy:#1E2A3A; --navy-mid:#2E4263; --navy-dk:#111820;
    --white:#FFFFFF; --off-white:#F4F6F9; --slate:#C8D8EA;
    --grey:#6B7A8D; --grey-lt:#D4DBE5;
  }}
  *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
  html,body{{width:100vw;height:100vh;overflow:hidden;background:var(--navy-dk);font-family:'Barlow',sans-serif}}
  .deck{{width:100vw;height:100vh;position:relative}}
  .slide{{position:absolute;inset:0;display:none;flex-direction:column}}
  .slide.active{{display:flex;animation:fadeIn .3s ease}}
  @keyframes fadeIn{{from{{opacity:0;transform:translateY(6px)}}to{{opacity:1;transform:none}}}}
  .top-bar{{height:56px;background:var(--navy-dk);display:flex;align-items:center;padding:0 28px;gap:14px;flex-shrink:0;border-bottom:3px solid var(--accent)}}
  .ad-badge{{width:36px;height:36px;background:var(--accent);border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:15px;color:var(--white);flex-shrink:0}}
  .bar-unit{{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:.1em;color:var(--white)}}
  .bar-sep{{color:var(--accent);font-size:16px}}
  .bar-lesson{{font-size:13px;color:var(--grey);font-weight:500;letter-spacing:.03em}}
  .bar-badge{{margin-left:auto;padding:5px 14px;border-radius:20px;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:.1em}}
  .b-donow{{background:var(--accent);color:var(--white)}}
  .b-li{{background:var(--navy-mid);color:var(--accent-lt);border:1.5px solid var(--accent)}}
  .b-main{{background:#0F6E56;color:#E1F5EE}}
  .b-dolast{{background:#7B6FD4;color:#EDE9FB}}
  .content{{flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative}}
  .s-title{{background:var(--navy);overflow:hidden}}
  .s-title::before{{content:'';position:absolute;top:-40%;left:-10%;width:60%;height:180%;background:radial-gradient(ellipse,rgba({ACCENT_RGB},.1) 0%,transparent 70%);pointer-events:none}}
  .title-inner{{flex:1;padding:32px 52px 24px;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:1}}
  .title-eyebrow{{font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.18em;color:var(--accent)}}
  .title-big{{font-family:'Bebas Neue',sans-serif;font-size:clamp(64px,11vw,116px);color:var(--white);line-height:.92;letter-spacing:.03em}}
  .title-big span{{color:var(--accent)}}
  .title-sub{{font-family:'Bebas Neue',sans-serif;font-size:clamp(18px,3vw,32px);color:var(--slate);letter-spacing:.08em;margin-top:8px}}
  .title-chips{{display:flex;gap:12px;flex-wrap:wrap}}
  .title-chip{{border:1.5px solid rgba({ACCENT_RGB},.35);border-radius:8px;padding:8px 18px;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.1em;color:var(--accent-lt)}}
  .s-donow{{background:var(--accent)}}
  .donow-inner{{flex:1;padding:28px 48px;display:flex;flex-direction:column;gap:18px}}
  .donow-heading{{font-family:'Bebas Neue',sans-serif;font-size:clamp(52px,9vw,88px);color:var(--white);letter-spacing:.05em;line-height:.95}}
  .donow-discuss{{background:var(--navy);border-radius:14px;padding:18px 26px}}
  .donow-discuss-label{{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.14em;color:var(--accent-lt);margin-bottom:10px}}
  .donow-q{{font-size:clamp(13px,1.7vw,17px);color:var(--slate);font-weight:500;padding-left:18px;position:relative;line-height:1.4;margin-bottom:8px}}
  .donow-q::before{{content:'→';position:absolute;left:0;color:var(--accent-lt);font-weight:700}}
  .s-lisc{{background:var(--off-white)}}
  .lisc-inner{{flex:1;padding:28px 48px;display:flex;flex-direction:column;gap:18px}}
  .lisc-heading{{font-family:'Bebas Neue',sans-serif;font-size:clamp(36px,6vw,58px);color:var(--navy);letter-spacing:.05em;line-height:1}}
  .li-block{{background:var(--navy);border-radius:14px;padding:20px 26px;border-left:8px solid var(--accent)}}
  .block-label{{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.15em;color:var(--accent);margin-bottom:8px}}
  .block-text{{font-size:clamp(14px,2vw,19px);color:var(--white);font-weight:600;line-height:1.45}}
  .sc-list{{display:flex;flex-direction:column;gap:9px}}
  .sc-row{{background:var(--white);border-radius:10px;padding:13px 18px;border-left:6px solid var(--accent);font-size:clamp(13px,1.7vw,17px);color:var(--navy);font-weight:600;line-height:1.4;display:flex;align-items:center;gap:12px}}
  .sc-check{{width:24px;height:24px;min-width:24px;border-radius:50%;border:2.5px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--accent);font-weight:700}}
  .s-dark{{background:var(--navy)}}
  .activity-inner{{flex:1;padding:24px 44px;display:flex;flex-direction:column;gap:16px;overflow:hidden}}
  .time-row{{display:flex;align-items:flex-end;gap:14px}}
  .time-num{{font-family:'Bebas Neue',sans-serif;font-size:clamp(40px,6.5vw,68px);color:var(--accent);line-height:1}}
  .time-label{{font-size:13px;color:var(--grey);font-weight:500;margin-bottom:8px}}
  .activity-title{{font-family:'Bebas Neue',sans-serif;font-size:clamp(26px,4.5vw,48px);color:var(--white);letter-spacing:.05em;line-height:1;margin-left:4px}}
  .instructions{{display:flex;flex-direction:column;gap:8px}}
  .instr-row{{display:flex;align-items:flex-start;gap:14px;background:var(--navy-mid);border-radius:10px;padding:12px 16px}}
  .instr-num{{font-family:'Bebas Neue',sans-serif;font-size:19px;color:var(--accent);line-height:1;min-width:20px;flex-shrink:0;margin-top:2px}}
  .instr-text{{font-size:clamp(13px,1.7vw,17px);color:var(--white);font-weight:500;line-height:1.45}}
  .instr-text em{{color:var(--accent-lt);font-style:italic}}
  .discuss-box{{background:var(--accent);border-radius:12px;padding:15px 20px}}
  .discuss-label{{font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:.14em;color:var(--white);margin-bottom:7px}}
  .discuss-q{{font-size:clamp(14px,1.9vw,18px);color:var(--white);font-weight:700;line-height:1.4}}
  .rule-grid{{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}}
  .rule-chip{{background:var(--navy-mid);border-radius:10px;padding:14px 10px;text-align:center;border-bottom:4px solid var(--accent)}}
  .rule-letter{{font-family:'Bebas Neue',sans-serif;font-size:clamp(28px,4vw,40px);color:var(--accent);line-height:1}}
  .rule-word{{font-size:clamp(10px,1.2vw,12px);color:var(--slate);font-weight:600;margin-top:6px;line-height:1.3}}
  .quote-box{{background:var(--navy-mid);border-radius:12px;padding:16px 20px;border-left:5px solid var(--accent)}}
  .quote-text{{font-size:clamp(14px,1.8vw,18px);color:var(--white);font-weight:600;font-style:italic;line-height:1.45}}
  .quote-cite{{font-size:12px;color:var(--grey);margin-top:8px}}
  .vocab-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}}
  .vocab-card{{background:var(--navy-mid);border-radius:12px;padding:14px 16px;border-top:4px solid var(--accent)}}
  .vocab-term{{font-family:'Bebas Neue',sans-serif;font-size:clamp(14px,1.8vw,18px);color:var(--accent-lt);letter-spacing:.04em;margin-bottom:6px}}
  .vocab-def{{font-size:clamp(11px,1.3vw,13px);color:var(--slate);line-height:1.4}}
  .vocab-new{{display:inline-block;margin-top:8px;padding:2px 8px;border-radius:4px;background:rgba({ACCENT_RGB},.2);color:var(--accent-lt);font-size:10px;font-weight:700;letter-spacing:.08em}}
  .trust-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}
  .trust-card{{background:var(--navy-mid);border-radius:12px;overflow:hidden}}
  .trust-head{{background:var(--accent);padding:12px 16px;font-family:'Bebas Neue',sans-serif;font-size:clamp(14px,1.8vw,18px);color:var(--white);letter-spacing:.05em}}
  .trust-body{{padding:12px 16px;font-size:clamp(12px,1.4vw,14px);color:var(--slate);line-height:1.5}}
  .feedback-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}
  .fb-card{{background:var(--navy-mid);border-radius:12px;padding:16px}}
  .fb-q{{font-family:'Bebas Neue',sans-serif;font-size:clamp(14px,1.7vw,17px);color:var(--accent-lt);margin-bottom:8px;letter-spacing:.04em}}
  .fb-sub{{font-size:clamp(11px,1.3vw,13px);color:var(--slate);line-height:1.45}}
  .info-box{{background:var(--navy-mid);border-radius:12px;padding:14px 18px}}
  .info-text{{font-size:clamp(13px,1.6vw,16px);color:var(--slate);line-height:1.5}}
  .info-text strong{{color:var(--accent-lt)}}
  .s-dolast{{background:#1A1040}}
  .dolast-inner{{flex:1;padding:28px 48px;display:flex;flex-direction:column;gap:18px}}
  .dolast-heading{{font-family:'Bebas Neue',sans-serif;font-size:clamp(50px,9vw,86px);color:#7B6FD4;letter-spacing:.06em;line-height:.95}}
  .dolast-heading span{{color:var(--white)}}
  .dolast-prompt{{background:rgba(123,111,212,.15);border-radius:14px;border-left:6px solid #7B6FD4;padding:20px 26px}}
  .dolast-starter{{font-family:'Bebas Neue',sans-serif;font-size:clamp(20px,3.2vw,34px);color:#BAB3F0;letter-spacing:.04em;margin-bottom:9px;line-height:1.2}}
  .dolast-text{{font-size:clamp(13px,1.7vw,17px);color:var(--slate);font-weight:500;line-height:1.5}}
  .vocab-label{{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.14em;color:#7B6FD4;margin-bottom:9px}}
  .vocab-chips{{display:flex;flex-wrap:wrap;gap:8px}}
  .vocab-chip{{background:rgba(123,111,212,.15);border:1.5px solid rgba(123,111,212,.4);border-radius:7px;padding:7px 16px;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.06em;color:#BAB3F0}}
  .next-lesson{{background:var(--navy-mid);border-radius:11px;padding:13px 20px;display:flex;align-items:center;gap:12px}}
  .next-arrow{{font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--accent)}}
  .next-text{{font-size:clamp(12px,1.5vw,15px);color:var(--slate);font-weight:500;line-height:1.4}}
  .next-text strong{{color:var(--accent-lt);font-weight:700}}
  .nav{{position:fixed;bottom:0;left:0;right:0;height:48px;background:var(--navy-dk);border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;padding:0 24px;z-index:200}}
  .nav-info{{font-size:11px;color:var(--grey);letter-spacing:.04em;font-weight:500;min-width:200px}}
  .nav-dots{{display:flex;gap:6px;align-items:center}}
  .dot{{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.15);cursor:pointer;transition:background .2s,transform .2s}}
  .dot.active{{transform:scale(1.4)}}
  .dot[data-type="donow"].active,.dot[data-type="li"].active{{background:var(--accent)}}
  .dot[data-type="main"].active{{background:#0F6E56}}
  .dot[data-type="dolast"].active{{background:#7B6FD4}}
  .dot:not([data-type]).active{{background:var(--accent)}}
  .nav-btns{{display:flex;gap:7px;align-items:center;min-width:120px;justify-content:flex-end}}
  .nav-counter{{font-family:'Bebas Neue',sans-serif;font-size:14px;color:var(--grey);letter-spacing:.08em;margin-right:4px}}
  .btn{{width:32px;height:32px;border-radius:6px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--white);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;user-select:none}}
  .btn:hover:not(:disabled){{background:rgba({ACCENT_RGB},.2);border-color:var(--accent)}}
  .btn:disabled{{opacity:.25;cursor:default}}"""


def top_bar(unit_label, lesson_label, badge_class, badge_text):
    return f"""  <div class="top-bar">
    <div class="ad-badge">AD</div>
    <span class="bar-unit">{unit_label}</span><span class="bar-sep">·</span>
    <span class="bar-lesson">{lesson_label}</span>
    <span class="bar-badge {badge_class}">{badge_text}</span>
  </div>"""


def dolast(starter, text, vocab, next_html, slide_id, time='48–50 min'):
    chips = ''.join(f'<div class="vocab-chip">{v}</div>' for v in vocab)
    return f"""<div class="slide" id="{slide_id}">
{top_bar('DO LAST', 'Write before you leave', 'b-dolast', time)}
  <div class="content s-dolast">
    <div class="dolast-inner">
      <div class="dolast-heading">DO<br><span>LAST</span></div>
      <div class="dolast-prompt">
        <div class="dolast-starter">{starter}</div>
        <div class="dolast-text">{text}</div>
      </div>
      <div>
        <div class="vocab-label">VOCABULARY — CAN YOU USE THESE IN YOUR ANSWER?</div>
        <div class="vocab-chips">{chips}</div>
      </div>
      <div class="next-lesson">
        <div class="next-arrow">→</div>
        <div class="next-text">{next_html}</div>
      </div>
    </div>
  </div>
</div>"""


def nav_js(labels, dot_types):
    import json
    return f"""<script>
const slides=document.querySelectorAll('.slide'),total=slides.length;
const dotsEl=document.getElementById('dots'),counter=document.getElementById('counter');
const prevBtn=document.getElementById('prev'),nextBtn=document.getElementById('next'),navInfo=document.getElementById('nav-info');
const dotTypes={json.dumps(dot_types)};
const labels={json.dumps(labels)};
let cur=0;
slides.forEach((_,i)=>{{const d=document.createElement('div');d.className='dot';if(dotTypes[i])d.setAttribute('data-type',dotTypes[i]);if(i===0)d.classList.add('active');d.title=labels[i];d.onclick=()=>goTo(i);dotsEl.appendChild(d);}});
function goTo(n){{slides[cur].classList.remove('active');dotsEl.children[cur].classList.remove('active');cur=Math.max(0,Math.min(n,total-1));slides[cur].classList.add('active');dotsEl.children[cur].classList.add('active');counter.textContent=`${{cur+1}} / ${{total}}`;navInfo.textContent=labels[cur];prevBtn.disabled=cur===0;nextBtn.disabled=cur===total-1;}}
function go(dir){{goTo(cur+dir);}}
document.addEventListener('keydown',e=>{{if(e.key==='ArrowRight'||e.key===' '){{e.preventDefault();go(1);}}if(e.key==='ArrowLeft'){{e.preventDefault();go(-1);}}}});
prevBtn.disabled=true;
</script>"""


def wrap(title, body, labels, dot_types, nav_title):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>
{css()}
</style>
</head>
<body>
<div class="deck" id="deck">
{body}
</div>
<div class="nav">
  <div class="nav-info" id="nav-info">{nav_title}</div>
  <div class="nav-dots" id="dots"></div>
  <div class="nav-btns">
    <span class="nav-counter" id="counter">1 / {len(labels)}</span>
    <button class="btn" id="prev" onclick="go(-1)">&#8592;</button>
    <button class="btn" id="next" onclick="go(1)">&#8594;</button>
  </div>
</div>
{nav_js(labels, dot_types)}
</body>
</html>"""


def main():
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]

    l1_body = f"""<div class="slide s-title active" id="s1">
{top_bar('UNIT 01', 'Intro to Drama &amp; Group Work', 'b-main', 'Lesson 1 of 3')}
  <div class="content s-title">
    <div class="title-inner">
      <div class="title-eyebrow">S1 Drama · Knightswood Secondary School</div>
      <div>
        <div class="title-big">WELCOME TO<br><span>DRAMA</span></div>
        <div class="title-sub">Express · Collaborate · Perform</div>
      </div>
      <div class="title-chips"><div class="title-chip">Week 1</div><div class="title-chip">50 Minutes</div><div class="title-chip">Lesson 1 of 3</div></div>
    </div>
  </div>
</div>
<div class="slide" id="s2">
{top_bar('DO NOW', 'Think about teamwork — discuss with your partner', 'b-donow', '0–8 min')}
  <div class="content s-donow">
    <div class="donow-inner">
      <div class="donow-heading">DO<br>NOW</div>
      <div class="donow-discuss" style="background:var(--navy-dk)">
        <div class="donow-discuss-label">DISCUSS WITH YOUR PARTNER</div>
        <div class="donow-q">Think about a time you had to work as part of a team. What made it go well — or not so well?</div>
        <div class="donow-q">What does a good group member do? What does a difficult group member do?</div>
        <div class="donow-q">Why might Drama be different from other subjects when it comes to working together?</div>
      </div>
      <div class="instructions">
        <div class="instr-row" style="background:rgba(17,24,32,.55)"><div class="instr-num">1</div><div class="instr-text" style="color:var(--slate)">Think quietly on your own for 2 minutes</div></div>
        <div class="instr-row" style="background:rgba(17,24,32,.55)"><div class="instr-num">2</div><div class="instr-text" style="color:var(--slate)">Share your answer with the person next to you</div></div>
        <div class="instr-row" style="background:rgba(17,24,32,.55)"><div class="instr-num">3</div><div class="instr-text" style="color:var(--slate)">Be ready to share one idea with the class</div></div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s3">
{top_bar('LESSON 1', 'What are we learning today?', 'b-li', 'LI &amp; SC')}
  <div class="content s-lisc">
    <div class="lisc-inner">
      <div class="lisc-heading">TODAY'S LESSON</div>
      <div class="li-block">
        <div class="block-label">LEARNING INTENTION</div>
        <div class="block-text">Understand the purpose of Drama and why cooperation, trust and safety matter in the Drama studio.</div>
      </div>
      <div>
        <div class="block-label" style="color:var(--navy);margin-bottom:10px;">SUCCESS CRITERIA — BY THE END OF TODAY I CAN...</div>
        <div class="sc-list">
          <div class="sc-row"><div class="sc-check">✓</div>Follow Drama rules and use safe working practices</div>
          <div class="sc-row"><div class="sc-check">✓</div>Listen and respond to others positively</div>
          <div class="sc-row"><div class="sc-check">✓</div>Contribute ideas and respect different opinions</div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s4">
{top_bar('EXPLORE', 'What is Drama?', 'b-main', '8–18 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">8–18</div><div class="time-label">minutes</div></div><div class="activity-title">What is Drama?</div></div>
      <div class="instructions">
        <div class="instr-row"><div class="instr-num">→</div><div class="instr-text">A way of communicating through performance, movement and voice</div></div>
        <div class="instr-row"><div class="instr-num">→</div><div class="instr-text">A space to explore ideas, emotions and stories safely</div></div>
        <div class="instr-row"><div class="instr-num">→</div><div class="instr-text">A collaborative art form — it needs everyone working together</div></div>
        <div class="instr-row"><div class="instr-num">→</div><div class="instr-text">A skill that builds confidence, empathy and creativity</div></div>
      </div>
      <div class="quote-box">
        <div class="quote-text">"Drama teaches you to listen, to look, to trust and to take risks — skills you need everywhere in life."</div>
        <div class="quote-cite">— Expressive Arts Faculty, Knightswood</div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s5">
{top_bar('EXPLORE', 'Ground rules for the Drama studio', 'b-main', '18–28 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">18–28</div><div class="time-label">minutes</div></div><div class="activity-title">Drama Rules &amp; Safe Practices</div></div>
      <div class="rule-grid">
        <div class="rule-chip"><div class="rule-letter">L</div><div class="rule-word">Listen when others are speaking</div></div>
        <div class="rule-chip"><div class="rule-letter">S</div><div class="rule-word">Stay in your own space</div></div>
        <div class="rule-chip"><div class="rule-letter">V</div><div class="rule-word">Voice level appropriate to the task</div></div>
        <div class="rule-chip"><div class="rule-letter">T</div><div class="rule-word">Take creative risks — mistakes are learning</div></div>
        <div class="rule-chip"><div class="rule-letter">R</div><div class="rule-word">Respond quickly to teacher instructions</div></div>
      </div>
      <div class="discuss-box">
        <div class="discuss-label">DISCUSS</div>
        <div class="discuss-q">Why does a Drama room only work when everyone feels safe enough to take risks and make mistakes?</div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s6">
{top_bar('CREATE', 'Warm-up activity', 'b-main', '28–45 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">28–45</div><div class="time-label">minutes</div></div><div class="activity-title">Name &amp; Gesture Circle</div></div>
      <div class="instructions">
        <div class="instr-row"><div class="instr-num">1</div><div class="instr-text">Stand in a circle as a class</div></div>
        <div class="instr-row"><div class="instr-num">2</div><div class="instr-text">Say your name and do a gesture that represents you</div></div>
        <div class="instr-row"><div class="instr-num">3</div><div class="instr-text">The whole group copies your name and gesture together</div></div>
        <div class="instr-row"><div class="instr-num">4</div><div class="instr-text">Move clockwise until everyone has had a turn</div></div>
        <div class="instr-row"><div class="instr-num">5</div><div class="instr-text">Final round — can you remember everyone's name and gesture?</div></div>
      </div>
      <div class="info-box">
        <div class="info-text"><strong>Focus on:</strong> eye contact · clear gesture · listening · energy — commit to the gesture!</div>
      </div>
      <div class="discuss-box" style="background:var(--navy-mid);border:1px solid rgba(255,59,48,.3)">
        <div class="discuss-label" style="color:var(--accent)">DEBRIEF</div>
        <div class="discuss-q" style="color:var(--white);font-weight:600">What did you notice about how others communicated without words?</div>
      </div>
    </div>
  </div>
</div>
{dolast(
    '"One thing I learnt today about working in a group was… because…"',
    'Write 2–3 sentences on your exit slip. Be specific — relate your answer to the success criteria. Use at least one Drama vocabulary word if you can.',
    ['body language', 'gesture', 'eye contact', 'collaboration', 'trust'],
    '<strong>Next lesson:</strong> Group Work &amp; Trust — trust exercises, levels, proxemics and status in action.',
    's7',
)}"""

    l1_labels = [
        'Lesson 1 · Welcome to Drama', 'Do Now · Teamwork discussion',
        'Learning Intention & Success Criteria', 'What is Drama? · 8–18 min',
        'Drama Rules · 18–28 min', 'Name & Gesture Circle · 28–45 min', 'Do Last · Exit task',
    ]
    (root / 'Unit01_Lesson01_Welcome_to_Drama.html').write_text(
        wrap('Unit 01 · Lesson 1 · Welcome to Drama', l1_body, l1_labels,
             ['', 'donow', 'li', 'main', 'main', 'main', 'dolast'], 'Lesson 1 · Welcome to Drama'),
        encoding='utf-8',
    )

    l2_dolast = dolast(
        '"In today\'s trust exercise, the skill I used most effectively was… because…"',
        'Write 2–3 sentences. Name at least two vocabulary words from today. What will you focus on in Lesson 3?',
        ['proxemics', 'status', 'levels', 'body language', 'trust'],
        '<strong>Next lesson:</strong> Freeze Frames — applying all your skills from Lessons 1 and 2 in a group performance.',
        's7',
    )

    l2_body = f"""<div class="slide s-title active" id="s1">
{top_bar('UNIT 01', 'Intro to Drama &amp; Group Work', 'b-main', 'Lesson 2 of 3')}
  <div class="content s-title">
    <div class="title-inner">
      <div class="title-eyebrow">S1 Drama · Knightswood Secondary School</div>
      <div>
        <div class="title-big">GROUP WORK<br><span>&amp; TRUST</span></div>
        <div class="title-sub">Building confidence together</div>
      </div>
      <div class="title-chips"><div class="title-chip">Week 1</div><div class="title-chip">50 Minutes</div><div class="title-chip">Lesson 2 of 3</div></div>
    </div>
  </div>
</div>
<div class="slide" id="s2">
{top_bar('DO NOW', 'Recall from Lesson 1', 'b-donow', '0–8 min')}
  <div class="content s-donow">
    <div class="donow-inner">
      <div class="donow-heading">RECALL</div>
      <div class="donow-discuss" style="background:var(--navy-dk)">
        <div class="donow-discuss-label">FROM LESSON 1</div>
        <div class="donow-q">Name one Drama rule and one vocabulary word. Can you write a definition for it?</div>
        <div class="donow-q">Compare with the person next to you — did you pick the same ones?</div>
        <div class="donow-q">Be ready to share with the class</div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s3">
{top_bar('LESSON 2', 'What are we learning today?', 'b-li', 'LI &amp; SC')}
  <div class="content s-lisc">
    <div class="lisc-inner">
      <div class="lisc-heading">TODAY'S LESSON</div>
      <div class="li-block">
        <div class="block-label">LEARNING INTENTION</div>
        <div class="block-text">Work effectively as part of a group — applying trust, body language, levels and proxemics in practical exercises.</div>
      </div>
      <div>
        <div class="block-label" style="color:var(--navy);margin-bottom:10px;">SUCCESS CRITERIA — SAME AS LESSON 1</div>
        <div class="sc-list">
          <div class="sc-row"><div class="sc-check">✓</div>Follow Drama rules and use safe working practices</div>
          <div class="sc-row"><div class="sc-check">✓</div>Listen and respond to others positively</div>
          <div class="sc-row"><div class="sc-check">✓</div>Contribute ideas and respect different opinions</div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s4">
{top_bar('EXPLORE', 'Vocabulary for today', 'b-main', '8–22 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">8–22</div><div class="time-label">minutes</div></div><div class="activity-title">Key Vocabulary</div></div>
      <div class="vocab-grid">
        <div class="vocab-card"><div class="vocab-term">Body Language</div><div class="vocab-def">Communicating non-verbally through the position and movement of the body.</div></div>
        <div class="vocab-card"><div class="vocab-term">Eye Contact</div><div class="vocab-def">Using direct gaze to show relationships, power or emotion between performers.</div></div>
        <div class="vocab-card"><div class="vocab-term">Posture</div><div class="vocab-def">How you stand and carry your body to represent character or status.</div></div>
        <div class="vocab-card"><div class="vocab-term">Use of Levels</div><div class="vocab-def">Using different heights on stage to show status and create visual variety.</div></div>
        <div class="vocab-card"><div class="vocab-term">Proxemics</div><div class="vocab-def">The use of space and distance between performers to communicate relationships.<span class="vocab-new">NEW TODAY</span></div></div>
        <div class="vocab-card"><div class="vocab-term">Status</div><div class="vocab-def">How much power a character has — shown through levels, eye contact and posture.<span class="vocab-new">NEW TODAY</span></div></div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s5">
{top_bar('CREATE', 'Groups of 4–5', 'b-main', '22–44 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">22–44</div><div class="time-label">minutes</div></div><div class="activity-title">Trust Exercises</div></div>
      <div class="trust-grid">
        <div class="trust-card"><div class="trust-head">Mirror Work</div><div class="trust-body">Face your partner and copy their movements exactly. Take turns to lead. No touching.</div></div>
        <div class="trust-card"><div class="trust-head">Blind Walk</div><div class="trust-body">One person closes their eyes. Their partner guides them safely around the space using voice only.</div></div>
        <div class="trust-card"><div class="trust-head">Status Walk</div><div class="trust-body">Walk around the space. Use levels, posture and eye contact to communicate high, medium or low status.</div></div>
      </div>
      <div class="info-box"><div class="info-text"><strong>Remember:</strong> safety first · listen to your partner · use Drama vocabulary in your debrief</div></div>
    </div>
  </div>
</div>
<div class="slide" id="s6">
{top_bar('SHARE', 'Watch and give feedback', 'b-main', '44–48 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">44–48</div><div class="time-label">minutes</div></div><div class="activity-title">Watch &amp; Give Feedback</div></div>
      <div class="feedback-grid">
        <div class="fb-card"><div class="fb-q">What did you see?</div><div class="fb-sub">Describe what happened. Name the activity and what each person did.</div></div>
        <div class="fb-card"><div class="fb-q">Which skills were used?</div><div class="fb-sub">Levels, proxemics, body language, eye contact, status — which did you notice most clearly?</div></div>
        <div class="fb-card"><div class="fb-q">One thing to develop</div><div class="fb-sub">Use Drama vocabulary to give one specific, constructive improvement.</div></div>
      </div>
      <div class="discuss-box"><div class="discuss-label">FEEDBACK RULES</div><div class="discuss-q">Use Drama vocabulary · Be specific · Be kind and constructive</div></div>
    </div>
  </div>
</div>
{l2_dolast}"""

    l2_labels = [
        'Lesson 2 · Group Work & Trust', 'Do Now · Recall',
        'Learning Intention & Success Criteria', 'Key Vocabulary · 8–22 min',
        'Trust Exercises · 22–44 min', 'Watch & Feedback · 44–48 min', 'Do Last · Exit task',
    ]
    (root / 'Unit01_Lesson02_Group_Work_and_Trust.html').write_text(
        wrap('Unit 01 · Lesson 2 · Group Work & Trust', l2_body, l2_labels,
             ['', 'donow', 'li', 'main', 'main', 'main', 'dolast'], 'Lesson 2 · Group Work & Trust'),
        encoding='utf-8',
    )

    l3_body = f"""<div class="slide s-title active" id="s1">
{top_bar('UNIT 01', 'Intro to Drama &amp; Group Work', 'b-main', 'Lesson 3 of 3')}
  <div class="content s-title">
    <div class="title-inner">
      <div class="title-eyebrow">S1 Drama · Knightswood Secondary School</div>
      <div>
        <div class="title-big">FREEZE<br><span>FRAMES</span></div>
        <div class="title-sub">Telling a story without words</div>
      </div>
      <div class="title-chips"><div class="title-chip">Week 2</div><div class="title-chip">50 Minutes</div><div class="title-chip">Lesson 3 of 3</div></div>
    </div>
  </div>
</div>
<div class="slide" id="s2">
{top_bar('DO NOW', 'Recall unit vocabulary', 'b-donow', '0–8 min')}
  <div class="content s-donow">
    <div class="donow-inner">
      <div class="donow-heading">RECALL</div>
      <div class="donow-discuss" style="background:var(--navy-dk)">
        <div class="donow-discuss-label">VOCABULARY CHECK</div>
        <div class="donow-q">Write a definition for: body language, proxemics, status, use of levels</div>
        <div class="donow-q">Use one word in a sentence about a performance you have seen</div>
        <div class="donow-q">Compare with your neighbour — are your definitions similar?</div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s3">
{top_bar('LESSON 3', 'What are we learning today?', 'b-li', 'LI &amp; SC')}
  <div class="content s-lisc">
    <div class="lisc-inner">
      <div class="lisc-heading">TODAY'S LESSON</div>
      <div class="li-block">
        <div class="block-label">LEARNING INTENTION</div>
        <div class="block-text">Apply body language, levels, proxemics and status to create clear freeze frames that tell a story without words.</div>
      </div>
      <div>
        <div class="block-label" style="color:var(--navy);margin-bottom:10px;">SUCCESS CRITERIA — BY THE END OF TODAY I CAN...</div>
        <div class="sc-list">
          <div class="sc-row"><div class="sc-check">✓</div>Create three freeze frames that tell a clear story</div>
          <div class="sc-row"><div class="sc-check">✓</div>Use levels, proxemics and body language deliberately in every freeze</div>
          <div class="sc-row"><div class="sc-check">✓</div>Evaluate my own and others' work using Drama vocabulary</div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s4">
{top_bar('EXPLORE', 'What is a freeze frame?', 'b-main', '8–16 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">8–16</div><div class="time-label">minutes</div></div><div class="activity-title">What is a Freeze Frame?</div></div>
      <div class="quote-box">
        <div class="quote-text">A stage picture held completely still — a frozen image that represents a moment, emotion or idea.</div>
      </div>
      <div class="instructions">
        <div class="instr-row"><div class="instr-num">→</div><div class="instr-text">Everyone in the group freezes at exactly the same moment</div></div>
        <div class="instr-row"><div class="instr-num">→</div><div class="instr-text">Your body, face and position all communicate meaning</div></div>
        <div class="instr-row"><div class="instr-num">→</div><div class="instr-text">The audience must understand the story without words</div></div>
        <div class="instr-row"><div class="instr-num">→</div><div class="instr-text">Think about levels, proxemics and body language in every freeze</div></div>
      </div>
      <div class="info-box"><div class="info-text"><strong>Remember:</strong> "Every part of your body is part of the picture. Nothing is accidental."</div></div>
    </div>
  </div>
</div>
<div class="slide" id="s5">
{top_bar('CREATE', 'Groups of 4–5', 'b-main', '16–38 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">16–38</div><div class="time-label">minutes</div></div><div class="activity-title">Create Your Freeze Frames</div></div>
      <div class="instructions">
        <div class="instr-row"><div class="instr-num">1</div><div class="instr-text"><em>Frame 1 — A problem:</em> show a clear situation using levels, proxemics and body language</div></div>
        <div class="instr-row"><div class="instr-num">2</div><div class="instr-text"><em>Frame 2 — Getting worse:</em> tension should increase; show this through your staging choices</div></div>
        <div class="instr-row"><div class="instr-num">3</div><div class="instr-text"><em>Frame 3 — A possible solution:</em> how does the mood and atmosphere change?</div></div>
      </div>
      <div class="discuss-box" style="background:var(--navy-mid);border:1px solid rgba(255,59,48,.3)">
        <div class="discuss-label" style="color:var(--accent)">PLAN &amp; PRACTISE</div>
        <div class="discuss-q" style="color:var(--white);font-weight:600">20 minutes to plan and rehearse — then we share to the class</div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s6">
{top_bar('SHARE', 'Peer feedback', 'b-main', '38–46 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="time-row"><div><div class="time-num">38–46</div><div class="time-label">minutes</div></div><div class="activity-title">Watch &amp; Peer Feedback</div></div>
      <div class="feedback-grid">
        <div class="fb-card"><div class="fb-q">Describe what you saw</div><div class="fb-sub">Name each freeze frame. What story did the group tell? Could you understand without words?</div></div>
        <div class="fb-card"><div class="fb-q">Name the techniques</div><div class="fb-sub">Levels, proxemics, body language, facial expression, status — which were used most effectively?</div></div>
        <div class="fb-card"><div class="fb-q">One thing to develop</div><div class="fb-sub">Using Drama vocabulary, give one specific, constructive suggestion.</div></div>
      </div>
    </div>
  </div>
</div>
<div class="slide" id="s7">
{top_bar('REFLECT', 'Unit 01 — all vocabulary', 'b-main', '46–48 min')}
  <div class="content s-dark">
    <div class="activity-inner">
      <div class="activity-title" style="margin-bottom:12px">Unit 01 — All 7 Vocabulary Words</div>
      <div class="vocab-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="vocab-card"><div class="vocab-term">Body Language</div></div>
        <div class="vocab-card"><div class="vocab-term">Eye Contact</div></div>
        <div class="vocab-card"><div class="vocab-term">Posture</div></div>
        <div class="vocab-card"><div class="vocab-term">Use of Levels</div></div>
        <div class="vocab-card"><div class="vocab-term">Proxemics</div></div>
        <div class="vocab-card"><div class="vocab-term">Status</div></div>
        <div class="vocab-card"><div class="vocab-term">Mood &amp; Atmosphere</div></div>
      </div>
      <div class="info-box"><div class="info-text">Use these words in your written evaluation today — at least <strong>three</strong> across your answer.</div></div>
    </div>
  </div>
</div>
{dolast(
    '"Across Unit 01, the Drama skill I have improved most is… because…"',
    'Write 2–3 sentences for your unit evaluation. Use at least three Drama vocabulary words. Hand in before you leave.',
    ['body language', 'proxemics', 'status', 'levels', 'mood & atmosphere', 'freeze frame'],
    '<strong>Unit 01 complete.</strong> Next up — Unit 02: Mime &amp; Melodrama. Communicating meaning entirely through body language and exaggerated movement.',
    's8',
)}"""

    l3_labels = [
        'Lesson 3 · Freeze Frames', 'Do Now · Vocabulary recall',
        'Learning Intention & Success Criteria', 'What is a Freeze Frame? · 8–16 min',
        'Create Freeze Frames · 16–38 min', 'Peer Feedback · 38–46 min',
        'Unit Vocabulary · 46–48 min', 'Do Last · Unit evaluation',
    ]
    (root / 'Unit01_Lesson03_Freeze_Frames.html').write_text(
        wrap('Unit 01 · Lesson 3 · Freeze Frames', l3_body, l3_labels,
             ['', 'donow', 'li', 'main', 'main', 'main', 'main', 'dolast'], 'Lesson 3 · Freeze Frames'),
        encoding='utf-8',
    )
    print('Created Unit01 lesson slides')


if __name__ == '__main__':
    main()
