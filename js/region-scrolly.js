/* Sub-region map tour for a single continent's deep-dive page: the same
   sticky-stage + IntersectionObserver-driven globe tour as the home page's
   Scrollytelling (reuses its .scrolly/.step/.step-panel markup and CSS
   verbatim), just scoped to one continent's sub-regions instead of the
   world's continents, plus a "jump to sub-region" <select> for anyone who
   doesn't want to scroll through them in order. While a sub-region is in
   focus, the rest of the continent's countries are shown dimmed (DIM_FILL)
   rather than colored, so which countries make up the active sub-region is
   visually obvious. */

const RegionScrolly = (() => {
  const { campColor, NOT_REP_FILL, DIM_FILL } = ColorScale;

  // Rough centroids + zoom per sub-region, keyed by continent (approximate
  // by design, same spirit as scrollytelling.js's CONTINENT_VIEW -- tuned by
  // eye via screenshots, not survey-grade). DEFAULT is each continent's
  // establishing shot shown before the first sub-region zooms in.
  const VIEWS = {
    Africa: {
      DEFAULT: { lon: 20, lat: 2, zoom: 0.95 },
      'Northern Africa': { lon: 10, lat: 27, zoom: 1.5 },
      'Western Africa': { lon: -4, lat: 12, zoom: 1.5 },
      'Central (Middle) Africa': { lon: 18, lat: 2, zoom: 1.5 },
      'Eastern Africa': { lon: 40, lat: 2, zoom: 1.3 },
      'Southern Africa': { lon: 25, lat: -23, zoom: 1.4 },
    },
    Americas: {
      DEFAULT: { lon: -80, lat: 10, zoom: 0.9 },
      'North America': { lon: -100, lat: 42, zoom: 1.05 },
      'Central America': { lon: -90, lat: 14, zoom: 2.4 },
      'Caribbean Island Nations': { lon: -74, lat: 17, zoom: 2.1 },
      'South America': { lon: -68, lat: -20, zoom: 1.1 },
    },
    Asia: {
      DEFAULT: { lon: 80, lat: 30, zoom: 0.85 },
      'Western Asia (Middle East)': { lon: 38, lat: 30, zoom: 1.6 },
      'Central Asia': { lon: 58, lat: 42, zoom: 1.9 },
      'South Asia': { lon: 72, lat: 22, zoom: 1.6 },
      'East Asia': { lon: 108, lat: 36, zoom: 1.3 },
      'Southeast Asia': { lon: 108, lat: 6, zoom: 1.4 },
    },
    Europe: {
      DEFAULT: { lon: 12, lat: 52, zoom: 1.45 },
      'Northern Europe': { lon: 8, lat: 60, zoom: 1.8 },
      'Western Europe': { lon: 0, lat: 49, zoom: 2.3 },
      'Southern Europe': { lon: 4, lat: 42, zoom: 2.0 },
      'Eastern Europe': { lon: 30, lat: 52, zoom: 1.4 },
    },
    Oceania: {
      DEFAULT: { lon: 150, lat: -18, zoom: 1.1 },
      'Australia and New Zealand': { lon: 142, lat: -30, zoom: 1.35 },
      'Melanesia': { lon: 158, lat: -10, zoom: 1.8 },
      'Micronesia': { lon: 158, lat: 8, zoom: 1.6 },
      'Polynesia': { lon: -178, lat: -15, zoom: 1.6 },
    },
  };
  let DEFAULT_VIEW = VIEWS.Africa.DEFAULT;
  let SUBREGION_VIEW = VIEWS.Africa;

  let region, activeName;
  let onGlobe = new Set();

  function tooltipHTML(c, inFocus) {
    const rep = c.camperCountAllTime > 0
      ? `<span class="tt-yes">&#9679; Represented</span><br>${c.camperCountAllTime} camper${c.camperCountAllTime === 1 ? '' : 's'} all-time`
      : `<span class="tt-no">&#9679; Not yet represented</span>`;
    const subNote = !inFocus && c.subRegion ? `<br><span class="tt-pop">${c.subRegion}</span>` : '';
    return `<strong>${c.name}</strong><br>${rep}<br><span class="tt-pop">Population ${Fmt.int(c.population)}</span>${subNote}`;
  }

  function buildMaps(activeSubregion) {
    const activeIso3 = new Set(region.subRegions[activeSubregion].countryIso3List);
    const represented = region.countries.filter(c => c.camperCountAllTime > 0);
    const maxCamp = Math.max(1, ...represented.map(c => c.camperCountAllTime));
    const colorMap = {};
    const infoMap = {};
    for (const c of region.countries) {
      const inFocus = activeIso3.has(c.iso3);
      colorMap[c.iso3] = inFocus
        ? (c.camperCountAllTime > 0 ? campColor(c.camperCountAllTime, maxCamp) : NOT_REP_FILL)
        : DIM_FILL;
      infoMap[c.iso3] = tooltipHTML(c, inFocus);
    }
    return { colorMap, infoMap };
  }

  function statTile(value, label) {
    return `<div class="stat-tile"><div class="num">${value}</div><div class="label">${label}</div></div>`;
  }

  function stepPanelHTML(name, sr) {
    const item = c => `<li>${c.name} <span style="color:rgba(242,240,234,0.6)">(${Fmt.int(c.camperCount)})</span></li>`;
    const list = rows => rows.length ? `<ol>${rows.map(item).join('')}</ol>` : '<p class="step-empty">None yet</p>';
    const most = list(sr.top3MostRepresentedAllTime);
    const least = list(sr.top3LeastRepresentedAllTime);
    return `
      <div class="step-eyebrow">${name}</div>
      <h2>${sr.representedEver.count} of ${sr.countriesInScope} countries represented</h2>
      <div class="step-stat-row">
        ${statTile(Fmt.pct(sr.representedEver.pct, 0), 'ever represented')}
        ${statTile(Fmt.pct(sr.representedPast['15'].pct, 0), 'past 15 yrs')}
        ${statTile(Fmt.pct(sr.representedPast['5'].pct, 0), 'past 5 yrs')}
      </div>
      ${sr.countryIso3List.some(iso => onGlobe.has(iso)) ? '' : '<p class="step-map-note">These island nations are too small to appear on this map.</p>'}
      <div class="step-lists">
        <div><h3>Most represented</h3>${most}</div>
        <div><h3>Least represented</h3>${least}</div>
      </div>
      <p class="step-lists-note">All-time camper counts. Least represented = fewest campers relative to population.</p>
    `;
  }

  function findStep(name) {
    return Array.from(document.querySelectorAll('#subregion-steps .step')).find(el => el.dataset.subregion === name);
  }

  function activate(name, { scrollIntoView = false } = {}) {
    if (!region.subRegions[name]) return;
    if (name !== activeName) {
      activeName = name;
      const view = SUBREGION_VIEW[name] || DEFAULT_VIEW;
      const { colorMap, infoMap } = buildMaps(name);
      Globe.setColorMap(colorMap, Globe.ROW_FILL);
      Globe.setInfoMap(infoMap);
      Globe.rotateTo(view.lon, view.lat, { duration: 900 });
      Globe.setZoom(view.zoom, { duration: 900 });

      document.querySelectorAll('#subregion-steps .step').forEach(el => {
        el.classList.toggle('is-active', el.dataset.subregion === name);
      });
      const jump = document.getElementById('subregion-jump-select');
      if (jump && jump.value !== name) jump.value = name;
    }
    if (scrollIntoView) {
      const el = findStep(name);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function init(regionData) {
    region = regionData;
    const views = VIEWS[region.continent] || VIEWS.Africa;
    DEFAULT_VIEW = views.DEFAULT;
    SUBREGION_VIEW = views;
    const section = document.getElementById('subregion-scrolly');
    const canvas = document.getElementById('region-globe');
    if (!section || !canvas) return;

    onGlobe = new Set(region.countries.filter(c => c.onGlobe).map(c => c.iso3));
    const names = Object.keys(region.subRegions).sort();
    if (!names.length) return;

    document.getElementById('subregion-steps').innerHTML = names.map(name => `
      <section class="step" data-subregion="${name}">
        <div class="step-panel" data-panel>${stepPanelHTML(name, region.subRegions[name])}</div>
      </section>
    `).join('');

    const jump = document.getElementById('subregion-jump-select');
    jump.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
    jump.addEventListener('change', () => activate(jump.value, { scrollIntoView: true }));

    const world = await DataLoader.world();
    Globe.init({
      canvasEl: canvas,
      tooltipEl: document.getElementById('region-tooltip'),
      world,
      initialRotate: [-DEFAULT_VIEW.lon, -DEFAULT_VIEW.lat, 0],
    });

    section.hidden = false;

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) activate(entry.target.dataset.subregion);
      }
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    document.querySelectorAll('#subregion-steps .step').forEach(el => observer.observe(el));

    activate(names[0]);
  }

  return { init };
})();
