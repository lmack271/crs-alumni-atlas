/* Home page bootstrap: loads the world basemap + all-continent summary
   stats, fills in each scroll step's panel, and wires up Globe +
   Scrollytelling. */

function renderStepPanel(data) {
  const item = c => `<li>${c.name} <span style="color:var(--muted)">(${Fmt.int(c.camperCount)})</span></li>`;
  const list = rows => rows.length ? `<ol>${rows.map(item).join('')}</ol>` : '<p class="step-empty">None yet</p>';
  const most = list(data.top3MostRepresentedAllTime);
  const least = list(data.top3LeastRepresentedAllTime);

  return `
    <div class="step-eyebrow">${data.label}</div>
    <h2>${data.representedEver.count} of ${data.countriesInScope} countries represented</h2>
    <div class="step-stat-row">
      <div class="stat-tile"><div class="num">${Fmt.pct(data.representedEver.pct, 0)}</div><div class="label">ever represented</div></div>
      <div class="stat-tile"><div class="num">${Fmt.pct(data.representedPast['15'].pct, 0)}</div><div class="label">past 15 yrs</div></div>
      <div class="stat-tile"><div class="num">${Fmt.pct(data.representedPast['5'].pct, 0)}</div><div class="label">past 5 yrs</div></div>
    </div>
    <div class="step-lists">
      <div><h3>Most represented</h3>${most}</div>
      <div><h3>Least represented</h3>${least}</div>
    </div>
    <p class="step-lists-note">All-time camper counts. Least represented = fewest campers relative to population.</p>
    <a class="btn" href="${data.detailPage}">Explore this region &rarr;</a>
  `;
}

/* End-of-page region picker: one card per continent with a small map of
   its outline linking to the region page. Each map is an azimuthal
   equal-area projection centered on the region and fitted to a hand-picked
   lon/lat frame rather than to the countries themselves, so Russia doesn't
   swallow the Europe map and Fiji's antimeridian crossing doesn't stretch
   Oceania's. Neighboring land is drawn faintly for context; the region's
   own countries carry the same camper-count colors as the globe, which
   fade in on hover (always shown on touch screens -- see home.css). */
const REGION_FRAMES = {
  africa: { center: [18, 2], frame: [[-19, -36], [52, 38]] },
  americas: { center: [-78, 8], frame: [[-128, -56], [-34, 66]] },
  asia: { center: [88, 26], frame: [[28, -10], [146, 54]] },
  europe: { center: [14, 53], frame: [[-24, 35], [44, 71]] },
  oceania: { center: [152, -24], frame: [[112, -47], [181, -2]] },
};

function renderRegionPicker(summary, world) {
  const mount = document.getElementById('region-cards');
  if (!mount) return;
  const W = 240, H = 180, PAD = 10;
  const { campColor, NOT_REP_FILL } = ColorScale;
  const features = world.map(f => ({ iso: f.a3, geo: { type: 'MultiPolygon', coordinates: f.g } }));

  mount.innerHTML = Object.entries(REGION_FRAMES).map(([slug, view]) => {
    const data = summary.continents[slug];
    if (!data) return '';
    const byIso = new Map(data.countries.map(c => [c.iso3, c]));
    const maxCamp = Math.max(1, ...data.countries.map(c => c.camperCountAllTime));

    const [[x0, y0], [x1, y1]] = view.frame;
    const frame = { type: 'MultiPoint', coordinates: [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [view.center[0], y0], [view.center[0], y1], [x0, view.center[1]], [x1, view.center[1]]] };
    const projection = d3.geoAzimuthalEqualArea().rotate([-view.center[0], -view.center[1]]).fitExtent([[PAD, PAD], [W - PAD, H - PAD]], frame);
    const path = d3.geoPath(projection);

    let context = '', outline = '', choropleth = '';
    for (const f of features) {
      const d = path(f.geo);
      if (!d) continue;
      const c = byIso.get(f.iso);
      if (!c) { context += `<path d="${d}"/>`; continue; }
      outline += `<path d="${d}"/>`;
      const fill = c.camperCountAllTime > 0 ? campColor(c.camperCountAllTime, maxCamp) : NOT_REP_FILL;
      choropleth += `<path d="${d}" fill="${fill}"/>`;
    }

    return `
      <a class="region-card" href="${data.detailPage}">
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <g class="rc-context">${context}</g>
          <g class="rc-outline">${outline}</g>
          <g class="rc-choropleth">${choropleth}</g>
        </svg>
        <span class="rc-name">${data.label}</span>
        <span class="rc-stat">${data.representedEver.count} of ${data.countriesInScope} countries represented</span>
        <span class="rc-cta">Explore &rarr;</span>
      </a>`;
  }).join('');
}

(async function initHome() {
  const [summary, world] = await Promise.all([DataLoader.continentsSummary(), DataLoader.world()]);

  document.querySelectorAll('.step[data-continent]').forEach(step => {
    const data = summary.continents[step.dataset.continent];
    const panel = step.querySelector('[data-panel]');
    if (data && panel) panel.innerHTML = renderStepPanel(data);
  });

  Globe.init({
    canvasEl: document.getElementById('globe'),
    tooltipEl: document.getElementById('tooltip'),
    world,
    initialRotate: [-20, -2, 0],
  });

  Scrollytelling.init(summary);
  renderRegionPicker(summary, world);
})();
