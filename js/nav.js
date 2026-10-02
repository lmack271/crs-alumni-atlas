/* Renders the shared top nav bar into #nav-mount on every page, from
   continents-summary.json. Marks the current page via document.body's
   data-page attribute (e.g. data-page="africa") and shows a "soon" badge
   for continents whose extended page is still a stub. */

(async function renderNav() {
  const mount = document.getElementById('nav-mount');
  if (!mount) return;

  const currentPage = document.body.dataset.page || '';
  const summary = await DataLoader.continentsSummary();

  const links = Object.entries(summary.continents).map(([slug, c]) => {
    const isCurrent = currentPage === slug;
    const badge = c.status === 'stub' ? '<span class="site-nav__badge">soon</span>' : '';
    return `<li><a href="${c.detailPage}"${isCurrent ? ' aria-current="page"' : ''}>${c.label}${badge}</a></li>`;
  }).join('');

  mount.innerHTML = `
    <nav class="site-nav" aria-label="Site">
      <a class="site-nav__brand" href="index.html">CRS Alumni Atlas</a>
      <ul class="site-nav__links">
        <li><a href="index.html"${currentPage === 'home' ? ' aria-current="page"' : ''}>Home</a></li>
        ${links}
        <li><a href="disclaimers.html"${currentPage === 'disclaimers' ? ' aria-current="page"' : ''}>Disclaimers</a></li>
      </ul>
    </nav>
  `;
})();
