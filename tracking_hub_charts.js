/**
 * Chart.js helpers for Tracking & Monitoring Hub.
 * Requires Chart.js v4 from CDN.
 */
(function(global) {
  'use strict';

  var instances = {};

  function destroy(key) {
    if (instances[key]) {
      instances[key].destroy();
      delete instances[key];
    }
  }

  function destroyAll() {
    Object.keys(instances).forEach(destroy);
  }

  function scoreColor(v) {
    if (v == null) return '#94a3b8';
    if (v < 2.5) return '#b91c1c';
    if (v < 3.25) return '#b45309';
    return '#166534';
  }

  /**
   * Line chart: average score by tracking point (art + drama lines).
   */
  function renderScoreTrend(canvas, labels, artData, dramaData, onPointClick, targetValue) {
    if (!canvas || typeof Chart === 'undefined') return null;
    destroy('scoreTrend');
    var target = typeof targetValue === 'number' ? targetValue : 3;
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Art',
            data: artData,
            borderColor: '#c0622a',
            backgroundColor: '#c0622a',
            pointBackgroundColor: '#c0622a',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.25,
            spanGaps: true
          },
          {
            label: 'Drama',
            data: dramaData,
            borderColor: '#4a7fd4',
            backgroundColor: '#4a7fd4',
            pointBackgroundColor: '#4a7fd4',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.25,
            spanGaps: true
          },
          {
            label: 'Target',
            data: labels.map(function() { return target; }),
            borderColor: '#94a3b8',
            borderDash: [4, 4],
            borderWidth: 1,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: true },
        onClick: function(evt, elements) {
          if (!elements.length || typeof onPointClick !== 'function') return;
          var el = elements[0];
          if (el.datasetIndex > 1) return;
          var subject = el.datasetIndex === 0 ? 'art' : 'drama';
          var tp = labels[el.index];
          onPointClick(subject, tp);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                if (ctx.datasetIndex === 2) return 'Target: ' + target.toFixed(2);
                var v = ctx.parsed.y;
                return ctx.dataset.label + ': ' + (v != null ? v.toFixed(2) : '—');
              }
            }
          }
        },
        scales: {
          y: {
            min: 1,
            max: 4,
            ticks: { stepSize: 1, font: { size: 9 }, color: '#94a3b8' },
            grid: { color: '#f1f4f9' }
          },
          x: {
            ticks: { font: { size: 9 }, color: '#64748b' },
            grid: { display: false }
          }
        }
      }
    });
    instances.scoreTrend = chart;
    return chart;
  }

  /**
   * Compact horizontal bar chart: dimension profile for art and drama.
   */
  function renderDimensionBars(canvas, dimLabels, artAvgs, dramaAvgs) {
    if (!canvas || typeof Chart === 'undefined') return null;
    destroy('dimensionBars');
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dimLabels,
        datasets: [
          {
            label: 'Art',
            data: artAvgs,
            backgroundColor: '#c0622a',
            borderRadius: 2,
            barThickness: 5
          },
          {
            label: 'Drama',
            data: dramaAvgs,
            backgroundColor: '#4a7fd4',
            borderRadius: 2,
            barThickness: 5
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var v = ctx.parsed.x;
                return ctx.dataset.label + ': ' + (v != null ? v.toFixed(2) : '—');
              }
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: 4,
            display: false,
            grid: { display: false }
          },
          y: {
            ticks: { font: { size: 7 }, color: '#64748b', padding: 0 },
            grid: { display: false }
          }
        }
      }
    });
    instances.dimensionBars = chart;
    return chart;
  }

  /**
   * Radar chart: dimension profile for art and drama.
   */
  function renderDimensionRadar(canvas, dimLabels, artAvgs, dramaAvgs, compact) {
    if (!canvas || typeof Chart === 'undefined') return null;
    destroy('dimensionRadar');
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: dimLabels,
        datasets: [
          {
            label: 'Art',
            data: artAvgs,
            borderColor: '#c0622a',
            backgroundColor: 'rgba(192, 98, 42, 0.15)',
            borderWidth: 1.5,
            pointRadius: compact ? 1.5 : 2
          },
          {
            label: 'Drama',
            data: dramaAvgs,
            borderColor: '#4a7fd4',
            backgroundColor: 'rgba(74, 127, 212, 0.15)',
            borderWidth: 1.5,
            pointRadius: compact ? 1.5 : 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var v = ctx.parsed.r;
                return ctx.dataset.label + ': ' + (v != null ? v.toFixed(2) : '—');
              }
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 4,
            ticks: { stepSize: 1, display: false },
            grid: { color: '#f1f4f9' },
            angleLines: { color: '#f1f4f9' },
            pointLabels: {
              font: { size: compact ? 7 : 8 },
              color: '#475569',
              padding: compact ? 2 : 4
            }
          }
        }
      }
    });
    instances.dimensionRadar = chart;
    return chart;
  }

  /**
   * Doughnut chart: risk breakdown.
   */
  function renderRiskDonut(canvas, segments, onSegmentClick, compact) {
    if (!canvas || typeof Chart === 'undefined') return null;
    destroy('riskDonut');
    var labels = segments.map(function(s) { return s.label; });
    var data = segments.map(function(s) { return s.count; });
    var colors = segments.map(function(s) { return s.color; });
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: compact ? '58%' : '62%',
        onClick: function(evt, elements) {
          if (!elements.length || typeof onSegmentClick !== 'function') return;
          var idx = elements[0].index;
          onSegmentClick(segments[idx].key);
        },
        plugins: {
          legend: {
            position: compact ? 'right' : 'bottom',
            labels: {
              boxWidth: 6,
              font: { size: compact ? 7 : 8 },
              padding: compact ? 3 : 4
            }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var total = ctx.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                var pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
                return ctx.label + ': ' + ctx.parsed + ' (' + pct + '%)';
              }
            }
          }
        }
      },
      plugins: [{
        id: 'centerText',
        beforeDraw: function(ch) {
          var total = data.reduce(function(a, b) { return a + b; }, 0);
          var area = ch.chartArea;
          var cx = area ? (area.left + area.right) / 2 : ch.width / 2;
          var cy = area ? (area.top + area.bottom) / 2 : ch.height / 2;
          var c2d = ch.ctx;
          c2d.save();
          c2d.font = (compact ? '500 12px' : '500 14px') + ' Inter, sans-serif';
          c2d.fillStyle = '#0b1220';
          c2d.textAlign = 'center';
          c2d.textBaseline = 'middle';
          c2d.fillText(String(total), cx, cy - (compact ? 4 : 0));
          c2d.font = (compact ? '400 8px' : '400 9px') + ' Inter, sans-serif';
          c2d.fillStyle = '#94a3b8';
          c2d.fillText('pupils', cx, cy + (compact ? 10 : 14));
          c2d.restore();
        }
      }]
    });
    instances.riskDonut = chart;
    return chart;
  }

  /**
   * Profile drawer: pupil vs class average radar.
   */
  function renderProfileRadar(canvas, dimLabels, pupilAvgs, classAvgs) {
    if (!canvas || typeof Chart === 'undefined') return null;
    destroy('profileRadar');
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: dimLabels,
        datasets: [
          {
            label: 'Pupil',
            data: pupilAvgs,
            borderColor: '#1e2d4a',
            backgroundColor: 'rgba(30, 45, 74, 0.12)',
            borderWidth: 1.5,
            pointRadius: 2
          },
          {
            label: 'Class avg',
            data: classAvgs,
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var v = ctx.parsed.r;
                return ctx.dataset.label + ': ' + (v != null ? v.toFixed(2) : '—');
              }
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 4,
            ticks: { stepSize: 1, display: false },
            grid: { color: '#f1f4f9' },
            angleLines: { color: '#f1f4f9' },
            pointLabels: { font: { size: 8 }, color: '#475569' }
          }
        }
      }
    });
    instances.profileRadar = chart;
    return chart;
  }

  var DIM_LINE_COLORS = ['#c0622a', '#4a7fd4', '#8b5cf6', '#0d9488', '#b45309', '#64748b'];

  /**
   * Multi-line chart: one line per dimension across tracking points (profile drawer).
   */
  function renderPupilDimLines(canvas, labels, dimLabels, seriesByDim, targetValue) {
    if (!canvas || typeof Chart === 'undefined') return null;
    destroy('profileDim');
    var target = typeof targetValue === 'number' ? targetValue : 3;
    var datasets = (seriesByDim || []).map(function(vals, i) {
      return {
        label: dimLabels[i] || ('Dim ' + (i + 1)),
        data: vals,
        borderColor: DIM_LINE_COLORS[i % DIM_LINE_COLORS.length],
        backgroundColor: DIM_LINE_COLORS[i % DIM_LINE_COLORS.length],
        pointRadius: 2,
        borderWidth: 1.5,
        tension: 0.25,
        spanGaps: true
      };
    });
    datasets.push({
      label: 'Target',
      data: labels.map(function() { return target; }),
      borderColor: '#94a3b8',
      borderDash: [4, 3],
      pointRadius: 0,
      borderWidth: 1,
      fill: false
    });
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 8, font: { size: 8 }, padding: 4 }
          }
        },
        scales: {
          y: { min: 1, max: 4, ticks: { stepSize: 1, font: { size: 9 } }, grid: { color: '#f1f4f9' } },
          x: { ticks: { font: { size: 9 } }, grid: { display: false } }
        }
      }
    });
    instances.profileDim = chart;
    return chart;
  }

  /**
   * Single-line chart for pupil TP trend in drawer.
   */
  function renderPupilTpLine(canvas, labels, data) {
    if (!canvas || typeof Chart === 'undefined') return null;
    destroy('profileTp');
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Overall',
          data: data,
          borderColor: '#1e2d4a',
          backgroundColor: '#1e2d4a',
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.25,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 1, max: 4, ticks: { stepSize: 1, font: { size: 9 } }, grid: { color: '#f1f4f9' } },
          x: { ticks: { font: { size: 9 } }, grid: { display: false } }
        }
      }
    });
    instances.profileTp = chart;
    return chart;
  }

  global.TrackingHubCharts = {
    destroy: destroy,
    destroyAll: destroyAll,
    scoreColor: scoreColor,
    renderScoreTrend: renderScoreTrend,
    renderDimensionBars: renderDimensionBars,
    renderDimensionRadar: renderDimensionRadar,
    renderRiskDonut: renderRiskDonut,
    renderProfileRadar: renderProfileRadar,
    renderPupilDimLines: renderPupilDimLines,
    renderPupilTpLine: renderPupilTpLine
  };
})(window);
