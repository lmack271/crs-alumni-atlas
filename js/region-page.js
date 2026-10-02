/* Generic continent deep-dive controller, keyed off `data-continent` on
   <body>. africa.html gets full behavior today (continents-summary.json's
   status:"complete" for Africa); americas/asia/europe/oceania.html render the
   "coming soon" stub state until their own {continent}.json exists --
   adding a continent later is a data change, not a template rewrite. */

(async function initRegionPage() {
  const continent = document.body.dataset.continent;
  const summary = await DataLoader.continentsSummary();
  const contData = summary.continents[continent];
  if (!contData) return;

  renderHero(contData);
  drawRegionOutline(contData.label);

  if (contData.status !== 'complete') {
    renderStub(contData);
    return;
  }

  const [region, stories] = await Promise.all([
    DataLoader.region(continent),
    DataLoader.stories(continent).catch(() => ({ stories: [] })),
  ]);

  document.getElementById('region-content').hidden = false;

  initTimeFilter(region);
  initDistribution(region);
  renderPopulationChart(region);
  renderUnderrepresented(region);
  const scrollyReady = RegionScrolly.init(region);
  renderStories(stories, region);
  // The sub-region tour unhides itself only after the world basemap loads,
  // so wait for it before counting sections.
  scrollyReady.finally(() => SectionProgress.init());
})();

function statTile(value, label) {
  return `<div class="stat-tile"><div class="num">${value}</div><div class="label">${label}</div></div>`;
}

// Adjective form of each continent's label, for "of African countries ...".
const CONTINENT_ADJECTIVE = { Africa: 'African', Americas: 'American', Asia: 'Asian', Europe: 'European', Oceania: 'Oceanian' };

function renderStatRow(label, repEver, repPast) {
  const adj = CONTINENT_ADJECTIVE[label] || label;
  return `
    <div class="stat-row">
      ${statTile(Fmt.pct(repEver.pct, 0), `of ${adj} countries represented ever at camp`)}
      ${statTile(Fmt.pct(repPast['15'].pct, 0), 'represented in past 15 yrs')}
      ${statTile(Fmt.pct(repPast['5'].pct, 0), 'represented in past 5 yrs')}
    </div>
  `;
}

// World-basemap continent codes that make up each region page's mini map.
// OUTLINE_VIEW frames the map on a lon/lat box so far-flung territories
// (French Guiana, Svalbard, Russia's Pacific coast, ...) don't shrink the
// continent to a speck; anything outside the box is clipped.
const OUTLINE_CONTINENTS = { Africa: ['Africa'], Americas: ['North America', 'South America'], Asia: ['Asia'], Europe: ['Europe'], Oceania: ['Oceania'] };
const OUTLINE_VIEW = {
  Africa: { lon0: 18, box: [[-18, -35], [52, 37]] },
  Americas: { lon0: -85, box: [[-165, -56], [-35, 72]] },
  Asia: { lon0: 95, box: [[26, -11], [150, 72]] },
  Europe: { lon0: 12, box: [[-24, 35], [42, 71]] },
  Oceania: { lon0: 150, box: [[112, -48], [180, 0]] },
};

/** Small solid silhouette of the continent next to the page title. */
async function drawRegionOutline(label) {
  const svg = document.getElementById('region-outline');
  const continents = OUTLINE_CONTINENTS[label];
  const view = OUTLINE_VIEW[label];
  if (!svg || !continents || !view || typeof d3 === 'undefined' || !d3.geoPath) return;

  const world = await DataLoader.world();
  const features = world
    .filter(f => continents.includes(f.c))
    .map(f => ({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: f.g } }));

  // Fit to the box's corners + edge midpoints (a lon/lat rectangle polygon
  // would be read as great-circle edges by d3-geo).
  const [[x0, y0], [x1, y1]] = view.box;
  const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  const frame = { type: 'MultiPoint', coordinates: [[x0, y0], [xm, y0], [x1, y0], [x1, ym], [x1, y1], [xm, y1], [x0, y1], [x0, ym]] };

  const projection = d3.geoNaturalEarth1().rotate([-view.lon0, 0]).fitWidth(100, frame);
  const [[bx0, by0], [bx1, by1]] = d3.geoPath(projection).bounds(frame);
  projection.clipExtent([[bx0, by0], [bx1, by1]]);
  const path = d3.geoPath(projection);

  svg.setAttribute('viewBox', `${bx0} ${by0} ${bx1 - bx0} ${by1 - by0}`);
  svg.style.aspectRatio = `${bx1 - bx0} / ${by1 - by0}`;
  svg.innerHTML = features.map(f => `<path d="${path(f) || ''}"/>`).join('');
}

// "By population" comparison from the underrepresentation model: the
// continent's actual camper total vs. what its share of non-U.S. world
// population would predict.
function renderPopulationLine(contData) {
  const pm = contData.populationModel;
  if (!pm || !pm.expected) return '';
  const ratio = pm.actual / pm.expected;
  const verdict = ratio < 0.8 ? 'fewer than its population share would suggest'
    : ratio > 1.25 ? 'more than its population share would suggest'
    : 'roughly in line with its population share';
  return `<p class="population-line">By population, ${contData.label} would be expected to account for about ${Fmt.int(Math.round(pm.expected))} of the ${Fmt.int(pm.totalCampers)} international campers on record. It has ${Fmt.int(pm.actual)} (${ratio.toFixed(2)}&times; expected) &mdash; ${verdict}.</p>`;
}

function renderHero(contData) {
  document.getElementById('region-hero').innerHTML = `
    <div class="region-title">
      <h1>${contData.label}</h1>
      <svg class="region-outline" id="region-outline" aria-hidden="true"></svg>
    </div>
    <p class="lede">CRS alumni records show representation from ${contData.representedEver.count} (${Fmt.pct(contData.representedEver.pct, 0)}) of the ${contData.countriesInScope} countries in ${contData.label}.</p>
    ${renderStatRow(contData.label, contData.representedEver, contData.representedPast)}
    ${renderPopulationLine(contData)}
    ${contData.status === 'complete' ? '<p class="hero-scroll-cue">Scroll further to see representation by subregion <span aria-hidden="true">&darr;</span></p>' : ''}
  `;
}

function renderStub(contData) {
  const stub = document.getElementById('region-stub');
  stub.hidden = false;
  stub.innerHTML = `
    <div class="region-stub">
      <h2>Full ${contData.label} deep-dive coming soon</h2>
      <p>The summary stats above are real (drawn from the same analysis as Africa's). The filterable charts, subregion drill-down, and narrative stories for ${contData.label} are being built next.</p>
    </div>
  `;
}

/* ---------------- camper-count bar chart + time filter ---------------- */
const TIME_WINDOWS = [
  { label: 'All time', years: null },
  { label: 'Last 40 yrs', years: 40 },
  { label: 'Last 25 yrs', years: 25 },
  { label: 'Last 15 yrs', years: 15 },
  { label: 'Last 5 yrs', years: 5 },
];
const CURRENT_YEAR = 2026;

function windowedCount(country, years) {
  if (years == null) return country.camperCountAllTime;
  return sumYearDistribution(country.yearDistribution, windowStartYear(CURRENT_YEAR, years));
}

function initTimeFilter(region) {
  const filterEl = document.getElementById('time-filter');
  filterEl.innerHTML = TIME_WINDOWS.map((w, i) =>
    `<button class="pill-btn" data-idx="${i}" aria-pressed="${i === 0}">${w.label}</button>`
  ).join('');

  function renderBars(windowIdx) {
    const years = TIME_WINDOWS[windowIdx].years;
    const rows = region.countries
      .map(c => ({ name: c.name, value: windowedCount(c, years) }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);
    document.getElementById('bar-count').textContent = `${rows.length} of ${region.countries.length} countries`;
    const mount = document.getElementById('camper-bar-chart');
    mount.innerHTML = '';
    mount.appendChild(Charts.horizontalBarChart(rows, { formatValue: Fmt.int }));
  }

  filterEl.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterEl.querySelectorAll('.pill-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      renderBars(Number(btn.dataset.idx));
    });
  });

  renderBars(0); // default: all time, matching the map colors
}

/* ---------------- per-country distribution: small multiples + expanded ---------------- */
function initDistribution(region) {
  const withHistory = region.countries
    .filter(c => c.camperCountAllTime > 0)
    .sort((a, b) => b.camperCountAllTime - a.camperCountAllTime);

  const picker = document.getElementById('country-picker');
  picker.innerHTML = withHistory.map(c => `<option value="${c.iso3}">${c.name}</option>`).join('');
  picker.addEventListener('change', () => showExpanded(picker.value, region));

  const grid = document.getElementById('sparkline-grid');
  grid.innerHTML = '';
  // With a single sending country (Oceania), the expanded chart already shows
  // everything; drop the picker, caption and card grid that would repeat it.
  if (withHistory.length === 1) {
    picker.closest('.control-row').style.display = 'none';
    const caption = picker.closest('section').querySelector('.section-caption');
    if (caption) caption.style.display = 'none';
    showExpanded(withHistory[0].iso3, region);
    return;
  }
  for (const c of withHistory) {
    const card = document.createElement('button');
    card.className = 'sparkline-card';
    card.type = 'button';
    card.innerHTML = `
      <div class="sc-name">${c.name}</div>
      <div class="sc-count">${Fmt.campers(c.camperCountAllTime)}, most recent ${c.mostRecentCampYear ?? '—'}</div>
      ${Charts.sparkline(c.yearDistribution)}
    `;
    card.addEventListener('click', () => { picker.value = c.iso3; showExpanded(c.iso3, region); });
    grid.appendChild(card);
  }

  if (withHistory.length) showExpanded(withHistory[0].iso3, region);
}

function showExpanded(iso3, region) {
  const country = region.countries.find(c => c.iso3 === iso3);
  if (!country) return;
  const mount = document.getElementById('expanded-chart-mount');
  mount.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'expanded-chart';
  box.innerHTML = `<div class="ec-head"><h3>${country.name}</h3><span>${Fmt.campers(country.camperCountAllTime)} all-time &middot; most recent ${country.mostRecentCampYear ?? '—'}</span></div>`;
  box.appendChild(Charts.distributionChart(country.yearDistribution));
  mount.appendChild(box);
}

/* ---------------- population bar chart ---------------- */
function renderPopulationChart(region) {
  const countEl = document.getElementById('population-count');
  if (countEl) countEl.textContent = region.countries.length;
  const rows = region.countries
    .slice()
    .sort((a, b) => (b.population || 0) - (a.population || 0))
    .map(c => ({ name: c.name, value: c.population || 0, colorClass: c.representedEver ? 'rep-yes' : 'rep-no' }));
  const mount = document.getElementById('population-bar-chart');
  mount.innerHTML = '';
  mount.appendChild(Charts.horizontalBarChart(rows, { formatValue: Fmt.int }));
}

/* ---------------- underrepresented list ---------------- */
function renderUnderrepresented(region) {
  const rows = region.countries
    .filter(c => c.underrepresentation && c.underrepresentation.capacityAwareGap > 0)
    .sort((a, b) => b.underrepresentation.capacityAwareGap - a.underrepresentation.capacityAwareGap)
    .slice(0, 15)
    .map(c => ({ name: c.name, value: c.underrepresentation.capacityAwareGap }));
  const mount = document.getElementById('underrep-list');
  mount.innerHTML = '';
  mount.appendChild(Charts.horizontalBarChart(rows, { formatValue: v => Fmt.num1(v) }));
}

/* ---------------- narrative stories ---------------- */
// A story with a `section` field (e.g. "time-trends") renders into
// #stories-{section} instead of the default #stories list.
function renderStories(storiesData, region) {
  const bySection = {};
  for (const s of storiesData.stories || []) {
    const mountId = s.section ? `stories-${s.section}` : 'stories';
    (bySection[mountId] = bySection[mountId] || []).push(s);
  }
  for (const [mountId, stories] of Object.entries(bySection)) {
    const mount = document.getElementById(mountId);
    if (mount) renderStoryList(mount, stories, region);
  }
  // Continents without hand-written stories (yet) hide those sections
  // entirely, so they also drop out of the section menu.
  document.querySelectorAll('[id^="stories"]').forEach(mount => {
    if (!bySection[mount.id]) mount.closest('section').hidden = true;
  });
}

function renderStoryList(mount, stories, region) {
  mount.innerHTML = stories.map(s => {
    const paragraphs = s.paragraphs.map(p => `<p>${p}</p>`).join('');
    const table = s.table ? renderTable(s.table) : '';
    return `<div class="story-card"><h3>${s.title}</h3>${paragraphs}${table}<div class="story-chart" data-chart-country="${s.chartHint ? s.chartHint.iso3 : ''}"></div></div>`;
  }).join('');

  mount.querySelectorAll('[data-chart-country]').forEach(el => {
    const iso3 = el.dataset.chartCountry;
    if (!iso3) return;
    const country = region.countries.find(c => c.iso3 === iso3);
    if (!country) return;
    el.appendChild(Charts.distributionChart(country.yearDistribution, { height: 150 }));
  });
}

function renderTable({ headers, rows }) {
  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="table-scroll"><table>${thead}${tbody}</table></div>`;
}
