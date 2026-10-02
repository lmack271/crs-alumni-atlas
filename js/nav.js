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

  // Home page: the nav scrolls away with the hero, so bring it back (pinned
  // to the top of the viewport) once the reader reaches the bottom of the page.
  if (currentPage === 'home') {
    const nav = mount.querySelector('.site-nav');
    const BOTTOM_SLACK = 80; // px from the very bottom that still counts as "at the bottom"
    const update = () => {
      const doc = document.documentElement;
      const atBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - BOTTOM_SLACK;
      const pastNav = window.scrollY > mount.offsetHeight;
      const reveal = atBottom && pastNav;
      if (reveal === nav.classList.contains('site-nav--revealed')) return;
      // Hold the nav's space in the flow so pinning it doesn't shift the page.
      mount.style.minHeight = reveal ? `${nav.offsetHeight}px` : '';
      nav.classList.toggle('site-nav--revealed', reveal);
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
})();
