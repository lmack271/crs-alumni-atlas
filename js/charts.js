/* Hand-rolled SVG/DOM chart builders for the continent deep-dive page.
   Pure functions: plain JSON arrays in, DOM nodes/HTML strings out. No
   D3 scale/shape/axis vendoring -- every mapping here is a simple linear
   position, consistent with the prototype's own hand-rolled bar styling. */

const Charts = (() => {
  const svgNS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}) {
    const node = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  /**
   * Horizontal descending bar chart, styled to match the "not yet
   * represented" list in CRS_African_Alumni_Atlas.html exactly: the bar
   * itself is the full-width row background (sized by %, name/value text
   * overlaid via flex space-between), not a separate track+fill column --
   * that's what lets it use the full row width instead of a squeezed
   * middle column. `rows`: [{ name, value, colorClass }]. `formatValue`:
   * value -> display string.
   */
  function horizontalBarChart(rows, { formatValue = String } = {}) {
    const max = Math.max(1, ...rows.map(r => r.value));
    const list = document.createElement('ul');
    list.className = 'hbar-chart';
    for (const r of rows) {
      // Strictly proportional (a 1 is exactly half a 2); CSS min-width keeps
      // the smallest nonzero bars visible as a sliver.
      const pct = 100 * (r.value / max);
      const row = document.createElement('li');
      row.className = 'hbar-row';
      row.innerHTML = `
        <span class="hbar-bar ${r.colorClass || ''}${r.value > 0 ? ' nonzero' : ''}" style="width:${pct.toFixed(2)}%"></span>
        <span class="hbar-name">${r.name}</span>
        <span class="hbar-value">${formatValue(r.value)}</span>
      `;
      list.appendChild(row);
    }
    return list;
  }

  /** Tiny inline sparkline SVG for a country's yearDistribution. */
  function sparkline(yearDistribution, { width = 140, height = 32 } = {}) {
    if (!yearDistribution || !yearDistribution.length) {
      return `<svg viewBox="0 0 ${width} ${height}"></svg>`;
    }
    const max = Math.max(1, ...yearDistribution.map(d => d.camperCount));
    const n = yearDistribution.length;
    const barW = width / n;
    const bars = yearDistribution.map((d, i) => {
      const h = (d.camperCount / max) * (height - 2);
      const x = i * barW;
      const y = height - h;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0.6, barW - 0.4).toFixed(1)}" height="${h.toFixed(1)}" fill="var(--accent)" />`;
    }).join('');
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${bars}</svg>`;
  }

  /**
   * Full-size year-by-year bar chart (expanded single-country view + story
   * charts). Returns a wrapper <div>; the SVG inside is drawn at the
   * wrapper's real pixel width (and redrawn on resize) rather than stretched
   * from a fixed viewBox, so axis text keeps its proportions and year ticks
   * stay evenly spaced. Has a y-axis with integer camper-count gridlines.
   */
  function distributionChart(yearDistribution, { height = 190 } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'dist-chart';
    if (!yearDistribution || !yearDistribution.length) return wrap;

    let drawnWidth = 0;
    new ResizeObserver(() => {
      const width = Math.round(wrap.clientWidth);
      if (!width || width === drawnWidth) return;
      drawnWidth = width;
      wrap.replaceChildren(distributionSvg(yearDistribution, width, height));
    }).observe(wrap);
    return wrap;
  }

  // Smallest "nice" step giving at most `maxTicks` intervals up to `max`.
  function niceStep(max, maxTicks, steps = [1, 2, 5, 10, 20, 25, 50, 100]) {
    return steps.find(s => max / s <= maxTicks) || steps[steps.length - 1];
  }

  function distributionSvg(yearDistribution, width, height) {
    const m = { top: 18, right: 16, bottom: 26, left: 34 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const n = yearDistribution.length;
    const band = plotW / n;

    const max = Math.max(1, ...yearDistribution.map(d => d.camperCount));
    const yStep = niceStep(max, 4);
    const yMax = Math.ceil(max / yStep) * yStep;
    const yPos = v => m.top + plotH - (v / yMax) * plotH;

    const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' });

    // y-axis: gridlines + labels, plus a small axis title above.
    for (let v = 0; v <= yMax; v += yStep) {
      const y = yPos(v).toFixed(1);
      if (v > 0) svg.appendChild(el('line', { x1: m.left, y1: y, x2: width - m.right, y2: y, class: 'dc-grid' }));
      const t = el('text', { x: m.left - 7, y, dy: '0.32em', 'text-anchor': 'end', class: 'dc-label' });
      t.textContent = v;
      svg.appendChild(t);
    }
    const title = el('text', { x: 0, y: 9, class: 'dc-label dc-axis-title' });
    title.textContent = 'Campers';
    svg.appendChild(title);
    svg.appendChild(el('line', { x1: m.left, y1: m.top, x2: m.left, y2: m.top + plotH, class: 'dc-axis' }));
    svg.appendChild(el('line', { x1: m.left, y1: m.top + plotH, x2: width - m.right, y2: m.top + plotH, class: 'dc-axis' }));

    // x-axis: ticks on round years, spaced so labels never crowd.
    const xStep = niceStep(n, Math.max(1, Math.floor(plotW / 44)), [1, 2, 5, 10, 20]);
    yearDistribution.forEach((d, i) => {
      const cx = m.left + (i + 0.5) * band;
      if (d.camperCount > 0) {
        const barW = Math.max(1, band * 0.78);
        const rect = el('rect', {
          x: (cx - barW / 2).toFixed(1), y: yPos(d.camperCount).toFixed(1),
          width: barW.toFixed(1), height: (m.top + plotH - yPos(d.camperCount)).toFixed(1),
          class: 'dc-bar',
        });
        rect.appendChild(el('title')).textContent = `${d.year}: ${d.camperCount} camper${d.camperCount === 1 ? '' : 's'}`;
        svg.appendChild(rect);
      }
      if (d.year % xStep === 0) {
        const y0 = m.top + plotH;
        svg.appendChild(el('line', { x1: cx.toFixed(1), y1: y0, x2: cx.toFixed(1), y2: y0 + 4, class: 'dc-axis' }));
        const t = el('text', { x: cx.toFixed(1), y: y0 + 16, 'text-anchor': 'middle', class: 'dc-label' });
        t.textContent = d.year;
        svg.appendChild(t);
      }
    });
    return svg;
  }

  return { horizontalBarChart, sparkline, distributionChart };
})();
