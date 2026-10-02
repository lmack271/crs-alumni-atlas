/* Drives Globe (rotation/zoom/coloring) from scroll position via
   IntersectionObserver over `.step[data-continent]` sections -- no
   scroll-jacking, `preventDefault` is never called, so native scroll stays
   fully keyboard/screen-reader/reduced-motion friendly. The
   `rootMargin: "-45% 0px -45% 0px"` shrinks the observer's effective
   viewport to a thin band at vertical center, so with each `.step` at
   100vh tall, at most one step is ever "active" at a time. */

const Scrollytelling = (() => {
  const { campColor, NOT_REP_FILL } = ColorScale;

  // Rough centroids for orthographic rotation targeting, and a per-continent
  // zoom multiplier so small/narrow continents (Europe) don't render as a
  // sliver of a full-Earth view next to a huge one (Asia). Approximate by
  // design -- these only need to look right, not survey-grade.
  const CONTINENT_VIEW = {
    // zoom lowered from 1.25: at the full-bleed globe size, 1.25 cropped
    // Africa's north (Mediterranean coast) and south (South Africa) edges
    // against the viewport frame -- this pulls more of the sphere into view.
    africa: { lon: 20, lat: 2, zoom: 0.95 },
    americas: { lon: -75, lat: 8, zoom: 1.05 },
    // recentered west (95->65) and zoomed out so the Middle East (incl.
    // Israel, one of Asia's top-represented countries) clears the
    // left-side text panel entirely, while Japan/the Far East still fits
    // on the right edge.
    asia: { lon: 55, lat: 24, zoom: 0.85 },
    europe: { lon: 15, lat: 52, zoom: 1.55 },
    oceania: { lon: 138, lat: -22, zoom: 1.25 },
  };

  function tooltipHTML(c) {
    const rep = c.camperCountAllTime > 0
      ? `<span class="tt-yes">&#9679; Represented</span><br>${c.camperCountAllTime} camper${c.camperCountAllTime === 1 ? '' : 's'} all-time`
      : `<span class="tt-no">&#9679; Not yet represented</span>`;
    return `<strong>${c.name}</strong><br>${rep}<br><span class="tt-pop">Population ${Fmt.int(c.population)}</span>`;
  }

  function buildMaps(continentData) {
    const represented = continentData.countries.filter(c => c.camperCountAllTime > 0);
    const maxCamp = Math.max(1, ...represented.map(c => c.camperCountAllTime));
    const colorMap = {};
    const infoMap = {};
    for (const c of continentData.countries) {
      colorMap[c.iso3] = c.camperCountAllTime > 0 ? campColor(c.camperCountAllTime, maxCamp) : NOT_REP_FILL;
      infoMap[c.iso3] = tooltipHTML(c);
    }
    return { colorMap, infoMap };
  }

  function activate(step, summary) {
    const slug = step.dataset.continent;
    const data = summary.continents[slug];
    if (!data) return;
    const view = CONTINENT_VIEW[slug] || { lon: 0, lat: 0, zoom: 1 };
    const { colorMap, infoMap } = buildMaps(data);
    Globe.setColorMap(colorMap, Globe.ROW_FILL);
    Globe.setInfoMap(infoMap);
    Globe.rotateTo(view.lon, view.lat, { duration: 900 });
    Globe.setZoom(view.zoom, { duration: 900 });
  }

  function init(summary) {
    const steps = Array.from(document.querySelectorAll('.step[data-continent]'));
    if (!steps.length) return;

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.classList.toggle('is-active', entry.isIntersecting);
        if (entry.isIntersecting) activate(entry.target, summary);
      }
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    steps.forEach(step => observer.observe(step));
  }

  return { init };
})();
