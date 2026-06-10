/**
 * Insight / ASGC attainment charts for the Improvement Plan section.
 * Requires Chart.js v4 and window.DIP_INSIGHT_DATA (insight-data.js).
 */
(function(global) {
  'use strict';

  var instances = {};
  var activeTab = 'all';

  function destroy(key) {
    if (instances[key]) {
      instances[key].destroy();
      delete instances[key];
    }
  }

  function destroyAll() {
    Object.keys(instances).forEach(destroy);
  }

  function data() {
    return global.DIP_INSIGHT_DATA || null;
  }

  function getBenchmarksForTab(tab) {
    var d = data();
    if (!d) return [];
    var ids = (d.subjects[tab] || d.subjects.all).benchmarkIds;
    return d.benchmarks.filter(function(b) { return ids.indexOf(b.id) !== -1; });
  }

  function getCoursesForTab(tab) {
    var d = data();
    if (!d || !d.courses) return [];
    if (tab === 'all') return d.courses.slice();
    if (tab === 'art') return d.courses.filter(function(c) { return c.name.indexOf('Art') !== -1; });
    if (tab === 'drama') return d.courses.filter(function(c) { return c.name === 'Drama'; });
    if (tab === 'photo') return d.courses.filter(function(c) { return c.name === 'Photography'; });
    return d.courses.slice();
  }

  function findCourse(level, name, year) {
    var d = data();
    if (!d) return null;
    return d.courses.find(function(c) {
      return c.year === year && c.level === level && c.name === name;
    }) || null;
  }

  function pctAB(c) {
    return c ? c.grades.A + c.grades.B : null;
  }

  function pctAC(c) {
    return c ? c.grades.A + c.grades.B + c.grades.C : null;
  }

  function fmtPct(v) {
    if (v == null || isNaN(v)) return '—';
    return (Math.round(v * 10) / 10) + '%';
  }

  function fmtDelta(from, to) {
    if (from == null || to == null) return '';
    var d = to - from;
    var sign = d >= 0 ? '+' : '';
    return sign + (Math.round(d * 10) / 10) + 'pp since 2023';
  }

  function renderKpis() {
    var el = document.getElementById('dip-insight-kpis');
    if (!el) return;

    var hd23 = findCourse('Higher', 'Drama', 2023);
    var hd25 = findCourse('Higher', 'Drama', 2025);
    var ph23 = findCourse('Higher', 'Photography', 2023);
    var ph25 = findCourse('Higher', 'Photography', 2025);
    var n5art25 = data().benchmarks.find(function(b) { return b.id === 't15'; });
    var n5School25 = n5art25 && n5art25.series.school.find(function(s) { return s.year === 2025; });
    var n5Nat25 = n5art25 && n5art25.series.national.find(function(s) { return s.year === 2025; });

    var kpis = [
      {
        label: 'Higher Drama A–C',
        value: fmtPct(pctAC(hd25)),
        sub: fmtDelta(pctAC(hd23), pctAC(hd25)),
        tone: 'drama'
      },
      {
        label: 'Higher Photography A–B',
        value: fmtPct(pctAB(ph25)),
        sub: fmtDelta(pctAB(ph23), pctAB(ph25)),
        tone: 'photo'
      },
      {
        label: 'N5 Art vs National',
        value: n5School25 && n5Nat25
          ? ((n5School25.gradeAC - n5Nat25.gradeAC >= 0 ? '+' : '') +
            (Math.round((n5School25.gradeAC - n5Nat25.gradeAC) * 10) / 10) + 'pp')
          : '—',
        sub: 'A–C gap closed in 2025',
        tone: 'art'
      },
      {
        label: 'Higher Drama entries',
        value: hd25 ? String(hd25.entries) : '—',
        sub: hd23 ? ('Up from ' + hd23.entries + ' in 2023') : '',
        tone: 'drama'
      }
    ];

    el.innerHTML = kpis.map(function(k) {
      return '<div class="dip-insight-kpi dip-insight-kpi-' + k.tone + '">' +
        '<div class="dip-insight-kpi-value">' + k.value + '</div>' +
        '<div class="dip-insight-kpi-label">' + k.label + '</div>' +
        (k.sub ? '<div class="dip-insight-kpi-sub">' + k.sub + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function renderCallouts() {
    var el = document.getElementById('dip-insight-callouts');
    if (!el) return;

    var ph23 = findCourse('Higher', 'Photography', 2023);
    var ph25 = findCourse('Higher', 'Photography', 2025);
    var hd23 = findCourse('Higher', 'Drama', 2023);
    var hd25 = findCourse('Higher', 'Drama', 2025);
    var ahDesign25 = findCourse('Advanced Higher', 'Art and Design (Design)', 2025);

    var items = [
      {
        title: 'Priority 04 — Higher Drama',
        text: 'No Award fell from ' + (hd23 ? hd23.grades.noAward : '—') + '% to ' +
          (hd25 ? hd25.grades.noAward : '—') + '%; A–C rose to ' + fmtPct(pctAC(hd25)) +
          '. Written paper preparation remains a focus.'
      },
      {
        title: 'Photography turnaround',
        text: 'Higher Photography A–B moved from ' + fmtPct(pctAB(ph23)) + ' to ' +
          fmtPct(pctAB(ph25)) + ' with zero No Awards in 2025 — strong evidence for creative space investment.'
      },
      {
        title: 'N5 Art & Design',
        text: 'School A–C now matches national benchmarks after a three-year closing of the gap — sustained pedagogy and assessment consistency.'
      }
    ];

    if (ahDesign25 && ahDesign25.entries <= 10) {
      items.push({
        title: 'AH Design (small cohort)',
        text: 'Advanced Higher Design A–C at ' + fmtPct(pctAC(ahDesign25)) + ' (' +
          ahDesign25.entries + ' entries) — moderation and exemplars remain a priority.'
      });
    }

    el.innerHTML = items.map(function(it) {
      return '<div class="dip-insight-callout">' +
        '<div class="dip-insight-callout-title">' + it.title + '</div>' +
        '<div class="dip-insight-callout-text">' + it.text + '</div></div>';
    }).join('');
  }

  function renderTrendChart(tab) {
    var canvas = document.getElementById('dip-insight-trend-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    destroy('trend');

    var benchmarks = getBenchmarksForTab(tab);
    var years = [2023, 2024, 2025];
    var schoolData = years.map(function(y) {
      var vals = benchmarks.map(function(b) {
        var pt = b.series.school.find(function(s) { return s.year === y; });
        return pt ? pt.gradeAC : null;
      }).filter(function(v) { return v != null; });
      if (!vals.length) return null;
      return Math.round(vals.reduce(function(a, b) { return a + b; }, 0) / vals.length * 10) / 10;
    });

    var natData = years.map(function(y) {
      var vals = benchmarks.map(function(b) {
        var pt = b.series.national.find(function(s) { return s.year === y; });
        return pt ? pt.gradeAC : null;
      }).filter(function(v) { return v != null; });
      if (!vals.length) return null;
      return Math.round(vals.reduce(function(a, b) { return a + b; }, 0) / vals.length * 10) / 10;
    });

    instances.trend = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [
          {
            label: 'Knightswood (avg A–C)',
            data: schoolData,
            borderColor: '#1e2d4a',
            backgroundColor: '#1e2d4a',
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            tension: 0.25,
            spanGaps: true
          },
          {
            label: 'National (avg A–C)',
            data: natData,
            borderColor: '#94a3b8',
            borderDash: [5, 4],
            pointRadius: 4,
            borderWidth: 2,
            tension: 0.25,
            spanGaps: true,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y + '%'; }
            }
          }
        },
        scales: {
          y: {
            min: 40,
            max: 100,
            ticks: { callback: function(v) { return v + '%'; }, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,.06)' }
          },
          x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } }
        }
      }
    });
  }

  function renderBenchmarkChart(tab) {
    var canvas = document.getElementById('dip-insight-benchmark-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    destroy('benchmark');

    var benchmarks = getBenchmarksForTab(tab);
    var labels = benchmarks.map(function(b) {
      return b.label.replace('Advanced Higher ', 'AH ').replace('National 5 ', 'N5 ');
    });

    function seriesFor(key) {
      return benchmarks.map(function(b) {
        var pt = b.series[key].find(function(s) { return s.year === 2025; });
        return pt ? pt.gradeAC : null;
      });
    }

    instances.benchmark = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Knightswood',
            data: seriesFor('school'),
            backgroundColor: '#1e2d4a',
            borderRadius: 4
          },
          {
            label: 'Glasgow City',
            data: seriesFor('glasgow'),
            backgroundColor: '#4a7fd4',
            borderRadius: 4
          },
          {
            label: 'National',
            data: seriesFor('national'),
            backgroundColor: '#cbd5e1',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y + '% A–C'; }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: function(v) { return v + '%'; }, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,.06)' }
          },
          x: {
            ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 25 },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderGradeChart(tab) {
    var canvas = document.getElementById('dip-insight-grade-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    destroy('grade');

    var courses = getCoursesForTab(tab).filter(function(c) { return c.year === 2025; });
    var labels = courses.map(function(c) {
      var short = c.level.replace('Advanced Higher', 'AH').replace('National 5', 'N5');
      var name = c.name.replace('Art and Design (Design)', 'Design').replace('Art and Design', 'Art');
      return short + ' ' + name;
    });

    var gradeKeys = [
      { key: 'A', color: '#166534', label: 'A' },
      { key: 'B', color: '#4a7fd4', label: 'B' },
      { key: 'C', color: '#f59e0b', label: 'C' },
      { key: 'D', color: '#c0622a', label: 'D' },
      { key: 'noAward', color: '#b91c1c', label: 'No Award' }
    ];

    instances.grade = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: gradeKeys.map(function(g) {
          return {
            label: g.label,
            data: courses.map(function(c) { return c.grades[g.key]; }),
            backgroundColor: g.color,
            stack: 'grades'
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              footer: function(items) {
                var idx = items[0] && items[0].dataIndex;
                if (idx == null || !courses[idx]) return '';
                return 'Entries: ' + courses[idx].entries;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 20 }, grid: { display: false } },
          y: {
            stacked: true,
            max: 100,
            ticks: { callback: function(v) { return v + '%'; }, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,.06)' }
          }
        }
      }
    });
  }

  function setActiveTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.dip-insight-tab').forEach(function(btn) {
      var on = btn.getAttribute('data-insight-tab') === tab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderTrendChart(tab);
    renderBenchmarkChart(tab);
    renderGradeChart(tab);
  }

  function bindTabs() {
    document.querySelectorAll('.dip-insight-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setActiveTab(btn.getAttribute('data-insight-tab') || 'all');
      });
    });
  }

  function render() {
    if (!data()) return;
    renderKpis();
    renderCallouts();
    setActiveTab(activeTab);
  }

  function init() {
    if (!document.getElementById('dip-insight-section')) return;
    bindTabs();
    render();
  }

  global.dipRenderInsightCharts = function() {
    requestAnimationFrame(function() {
      render();
    });
  };

  global.dipInsightChartsInit = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
