/* fetch() + cache for the site's JSON data files, plus small formatting/
   stat helpers shared by home.js and region-page.js. Plain globals (no
   module system) to match the zero-build-step approach used throughout. */

const DataLoader = (() => {
  const cache = new Map();

  function load(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(path).then(r => {
        if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
        return r.json();
      }));
    }
    return cache.get(path);
  }

  return {
    continentsSummary: () => load('data/continents-summary.json'),
    world: () => load('data/world-110m.json'),
    region: continent => load(`data/${continent}.json`),
    stories: continent => load(`data/${continent}-stories.json`),
  };
})();

const Fmt = {
  int: n => (n ?? 0).toLocaleString('en-US'),
  pct: (p, digits = 1) => `${((p ?? 0) * 100).toFixed(digits)}%`,
  num1: n => (n ?? 0).toFixed(1),
  campers: n => `${(n ?? 0).toLocaleString('en-US')} camper${n === 1 ? '' : 's'}`,
};

/** Sum a country's yearDistribution within [startYear, endYear] inclusive. */
function sumYearDistribution(yearDistribution, startYear, endYear = Infinity) {
  if (!yearDistribution) return 0;
  return yearDistribution.reduce(
    (sum, d) => (d.year >= startYear && d.year <= endYear ? sum + d.camperCount : sum),
    0
  );
}

/** Windowed camper-count label -> start year, given CURRENT_YEAR baked into the data. */
function windowStartYear(currentYear, nYears) {
  return currentYear - nYears + 1;
}
