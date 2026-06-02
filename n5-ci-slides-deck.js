/**
 * N5 Creative Industries lesson deck — single session per page.
 * Expects: body.u1–u4 with data-unit, data-session, data-session-title
 */
(function () {
  var unitAccents = { 1: '#00AAFF', 2: '#AAFF00', 3: '#CC44FF', 4: '#FF9900' };
  var unitRGB = { 1: [0, 170, 255], 2: [170, 255, 0], 3: [204, 68, 255], 4: [255, 153, 0] };
  var unitNames = {
    1: 'INTRODUCTION',
    2: 'SKILLS DEVELOPMENT',
    3: 'CREATIVE PROCESS',
    4: 'CREATIVE PROJECT'
  };

  var currentUnit = parseInt(document.body.getAttribute('data-unit') || '1', 10);
  var sessionNum = document.body.getAttribute('data-session') || '';
  var sessionTitle = document.body.getAttribute('data-session-title') || '';

  var cursor = document.getElementById('cursor');
  if (cursor) {
    cursor.style.background = unitAccents[currentUnit] || unitAccents[1];
    document.addEventListener('mousemove', function (e) {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
  }

  var slides = Array.from(document.querySelectorAll('#deck .slide'));
  var current = 0;
  var isAnimating = false;

  var hudLeft = document.getElementById('hudLeft');
  var hudRight = document.getElementById('hudRight');
  var hudProgress = document.getElementById('hudProgress');
  var keyHint = document.getElementById('keyHint');

  var revealMap = {};
  var revealState = {};
  var revealCounter = document.createElement('div');
  revealCounter.className = 'reveal-counter';
  document.body.appendChild(revealCounter);

  slides.forEach(function (slide) {
    var reveals = Array.from(slide.querySelectorAll('.reveal,.reveal-stat'));
    if (reveals.length) {
      revealMap[slide.id] = reveals.map(function (el) { return [el]; });
      revealState[slide.id] = 0;
    }
  });

  function buildProgressDots() {
    if (!hudProgress) return;
    hudProgress.innerHTML = '';
    slides.forEach(function (_, i) {
      var dot = document.createElement('div');
      dot.className = 'hud-dot' + (i === 0 ? ' active' : '');
      dot.style.cursor = 'pointer';
      dot.onclick = function () { goTo(i); };
      hudProgress.appendChild(dot);
    });
  }

  function updateHUD() {
    if (hudLeft) {
      var label = 'N5 CREATIVE INDUSTRIES / U' + currentUnit + ' · SESSION ' + sessionNum;
      if (sessionTitle) label += ' / ' + sessionTitle.toUpperCase();
      hudLeft.textContent = label;
      hudLeft.classList.add('visible');
    }
    if (hudRight) {
      hudRight.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    }
    document.querySelectorAll('.hud-dot').forEach(function (d, i) {
      d.classList.toggle('active', i === current);
    });
  }

  function triggerEntryGlitch(slide) {
    slide.querySelectorAll('.glitch').forEach(function (el) {
      el.classList.remove('glitch-entry', 'glitch-ambient');
      void el.offsetWidth;
      el.classList.add('glitch-entry');
      el.addEventListener('animationend', function () { el.classList.remove('glitch-entry'); }, { once: true });
    });
  }

  function updateRevealPips(sid) {
    revealCounter.innerHTML = '';
    if (!revealMap[sid]) return;
    var t = revealMap[sid].length;
    var d = revealState[sid] || 0;
    for (var i = 0; i < t; i++) {
      var p = document.createElement('div');
      p.className = 'reveal-pip' + (i < d ? ' done' : '');
      revealCounter.appendChild(p);
    }
  }

  function resetReveal(sid) {
    if (!revealMap[sid]) return;
    revealState[sid] = 0;
    revealMap[sid].flat().forEach(function (el) { if (el) el.classList.remove('shown'); });
    updateRevealPips(sid);
  }

  function showNextReveal(sid) {
    var steps = revealMap[sid];
    if (!steps) return;
    var step = revealState[sid];
    if (step >= steps.length) return;
    steps[step].forEach(function (el) { if (el) el.classList.add('shown'); });
    revealState[sid]++;
    updateRevealPips(sid);
  }

  function hasUnrevealedItems(sid) {
    return revealMap[sid] && revealState[sid] < revealMap[sid].length;
  }

  function animateSkillBars(slide) {
    slide.querySelectorAll('.skill-bar-fill').forEach(function (bar) {
      var w = bar.getAttribute('data-width') || '0%';
      bar.style.width = '0%';
      requestAnimationFrame(function () {
        setTimeout(function () { bar.style.width = w; }, 200);
      });
    });
  }

  function activateSlide(idx) {
    var slide = slides[idx];
    slide.classList.add('active', 'slide-enter');
    slide.addEventListener('animationend', function () {
      slide.classList.remove('slide-enter');
      triggerEntryGlitch(slide);
      updateRevealPips(slide.id);
      animateSkillBars(slide);
    }, { once: true });
  }

  function goTo(idx) {
    if (idx === current || isAnimating || idx < 0 || idx >= slides.length) return;
    isAnimating = true;
    var outSlide = slides[current];
    var inSlide = slides[idx];
    outSlide.classList.add('slide-exit');
    outSlide.addEventListener('animationend', function () {
      outSlide.classList.remove('active', 'slide-exit');
      resetReveal(outSlide.id);
      inSlide.classList.add('active', 'slide-enter');
      inSlide.addEventListener('animationend', function () {
        inSlide.classList.remove('slide-enter');
        isAnimating = false;
      }, { once: true });
      current = idx;
      updateHUD();
      triggerEntryGlitch(inSlide);
      resetReveal(inSlide.id);
      updateRevealPips(inSlide.id);
      animateSkillBars(inSlide);
    }, { once: true });
  }

  function next() {
    var sid = slides[current] && slides[current].id;
    if (hasUnrevealedItems(sid)) { showNextReveal(sid); return; }
    if (current < slides.length - 1) goTo(current + 1);
  }

  function prev() {
    var sid = slides[current] && slides[current].id;
    if (revealMap[sid] && revealState[sid] > 0) { resetReveal(sid); return; }
    if (current > 0) goTo(current - 1);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
    if (e.key === 'Escape') toggleFullscreen();
    if (e.key >= '1' && e.key <= '9') goTo(parseInt(e.key, 10) - 1);
  });

  var touchStartX = 0;
  document.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; });
  document.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
  });

  var deck = document.getElementById('deck');
  if (deck) deck.addEventListener('click', function () { next(); });

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {});
    else document.exitFullscreen();
  }

  function scheduleAmbientGlitch() {
    setTimeout(function () {
      if (slides[current]) {
        var els = Array.from(slides[current].querySelectorAll('.glitch'));
        if (els.length) {
          var el = els[Math.floor(Math.random() * els.length)];
          el.classList.remove('glitch-entry', 'glitch-ambient');
          void el.offsetWidth;
          el.classList.add('glitch-ambient');
          el.addEventListener('animationend', function () { el.classList.remove('glitch-ambient'); }, { once: true });
        }
      }
      scheduleAmbientGlitch();
    }, 6000 + Math.random() * 6000);
  }

  // Particles
  var canvas = document.getElementById('particleCanvas');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var WHITE_HEX = [240, 238, 232];
    var particles = [];
    var mouse = { x: -9999, y: -9999 };

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', function () { resizeCanvas(); initParticles(); });
    document.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });

    function Particle() { this.reset(true); }
    Particle.prototype.reset = function (randomY) {
      this.x = Math.random() * canvas.width;
      this.y = randomY ? Math.random() * canvas.height : canvas.height + 10;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = -(Math.random() * 0.25 + 0.08);
      this.size = Math.random() * 1.5 + 0.4;
      this.isAccent = Math.random() < 0.12;
      this.baseAlpha = Math.random() * 0.25 + 0.06;
      this.alpha = this.baseAlpha;
      this.pulse = Math.random() * Math.PI * 2;
      this.pulseSpeed = Math.random() * 0.008 + 0.003;
    };
    Particle.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      this.pulse += this.pulseSpeed;
      this.alpha = this.baseAlpha + Math.sin(this.pulse) * 0.04;
      var dx = this.x - mouse.x;
      var dy = this.y - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        var f = (120 - dist) / 120;
        this.x += (dx / dist) * f * 0.6;
        this.y += (dy / dist) * f * 0.6;
      }
      if (this.y < -20 || this.x < -20 || this.x > canvas.width + 20) this.reset(false);
    };
    Particle.prototype.draw = function () {
      var rgb = this.isAccent ? unitRGB[currentUnit] : WHITE_HEX;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + this.alpha + ')';
      ctx.fill();
    };

    function initParticles() {
      particles = Array.from({ length: 90 }, function () { return new Particle(); });
    }
    initParticles();

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(function (p) { p.update(); p.draw(); });
      requestAnimationFrame(animateParticles);
    }
    animateParticles();
  }

  if (slides.length) {
    buildProgressDots();
    activateSlide(0);
    updateHUD();
    if (keyHint) setTimeout(function () { keyHint.classList.remove('hidden'); }, 800);
    scheduleAmbientGlitch();
  }
})();
