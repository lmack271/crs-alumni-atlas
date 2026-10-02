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
})();
