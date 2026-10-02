/* Scroll-position indicator for a continent deep-dive page, so a reader can
   see how many sections the page has and which one they're in. Built from
   every visible element carrying a `data-progress-label` attribute (in
   document order). Every width gets a slim strip pinned to the top of the
   viewport; wide screens also get a fixed dot rail on the right edge
   (hover/focus reveals section names; dots are clickable), which is left
   off narrower screens where it would sit on top of content. The strip shows
   the current section name + count, a continuous
   scroll-progress line, and a dropdown menu of all sections. The strip only
   appears once the site nav has scrolled away. Both are driven by update(). */

const SectionProgress = (() => {
  // A section becomes "current" once its top crosses this fraction of the
  // viewport height -- same idea as region-scrolly.js's -45% rootMargin.
  const ACTIVE_LINE = 0.4;
  const ANNOUNCE_MS = 1600;

  function init() {
    const sections = Array.from(document.querySelectorAll('[data-progress-label]'))
      .filter(el => el.id && !el.closest('[hidden]'));
    if (sections.length < 2) return;

    const rail = document.createElement('nav');
    rail.className = 'section-rail';
    rail.setAttribute('aria-label', 'Page sections');
    rail.innerHTML = `
      <ol>${sections.map(el => `
        <li><a href="#${el.id}"><span class="sr-dot"></span><span class="sr-label">${el.dataset.progressLabel}</span></a></li>`).join('')}
      </ol>
      <div class="sr-count" aria-hidden="true"></div>
    `;

    const bar = document.createElement('nav');
    bar.className = 'section-bar';
    bar.setAttribute('aria-label', 'Page sections');
    bar.innerHTML = `
      <button type="button" class="sb-toggle" aria-expanded="false" aria-controls="sb-menu">
        <span class="sb-count"></span><span class="sb-current"></span><span class="sb-caret" aria-hidden="true">&#9662;</span>
      </button>
      <ol class="sb-menu" id="sb-menu" hidden>${sections.map((el, i) => `
        <li><a href="#${el.id}"><span class="sb-num">${i + 1}</span>${el.dataset.progressLabel}</a></li>`).join('')}
      </ol>
      <div class="sb-track" aria-hidden="true"><div class="sb-fill"></div></div>
    `;

    document.body.append(rail, bar);

    const items = [...rail.querySelectorAll('li'), ...bar.querySelectorAll('.sb-menu li')];
    const railItems = Array.from(rail.querySelectorAll('li'));
    const fill = bar.querySelector('.sb-fill');
    const count = rail.querySelector('.sr-count');
    const toggle = bar.querySelector('.sb-toggle');
    const menu = bar.querySelector('.sb-menu');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Publish the collapsed strip's height so CSS can keep pinned content
    // (the sub-region map) and section jumps clear of it.
    function measureBar() {
      const h = bar.offsetHeight - (menu.hidden ? 0 : menu.offsetHeight);
      document.documentElement.style.setProperty('--section-bar-h', `${h}px`);
    }
    measureBar();
    window.addEventListener('resize', measureBar);

    function setMenu(open) {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', () => setMenu(menu.hidden));
    document.addEventListener('click', e => { if (!bar.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

    for (const list of [rail, menu]) {
      list.querySelectorAll('a').forEach((a, i) => {
        a.addEventListener('click', e => {
          e.preventDefault();
          setMenu(false);
          sections[i].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        });
      });
    }

    let activeIdx = -1;
    let announceTimer;

    function update() {
      const nav = document.querySelector('.site-nav');
      const navGone = !nav || nav.getBoundingClientRect().bottom <= 0;
      bar.classList.toggle('is-visible', navGone);

      // Switch the rail to its dark style while it sits over a dark section
      // (the sub-region globe tour), so it doesn't glare against the map.
      const railMid = rail.getBoundingClientRect();
      const midY = railMid.top + railMid.height / 2;
      rail.classList.toggle('on-dark', Array.from(document.querySelectorAll('.scrolly:not([hidden])')).some(el => {
        const r = el.getBoundingClientRect();
        return r.top <= midY && r.bottom >= midY;
      }));
      if (!navGone) setMenu(false);

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.width = `${scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0}%`;

      const line = window.innerHeight * ACTIVE_LINE;
      const tops = sections.map(el => el.getBoundingClientRect().top);
      let idx = 0;
      tops.forEach((t, i) => { if (t <= line) idx = i; });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) idx = sections.length - 1;

      if (idx !== activeIdx) {
        items.forEach((li, j) => {
          const i = j % sections.length;
          li.classList.toggle('is-done', i < idx);
          li.classList.toggle('is-active', i === idx);
          const a = li.querySelector('a');
          if (i === idx) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
        count.textContent = `${idx + 1} / ${sections.length}`;
        bar.querySelector('.sb-count').textContent = `${idx + 1} / ${sections.length}`;
        bar.querySelector('.sb-current').textContent = sections[idx].dataset.progressLabel;
        // Briefly show the new section's name (skipped on first paint).
        if (activeIdx !== -1) {
          railItems.forEach(li => li.classList.remove('is-announcing'));
          railItems[idx].classList.add('is-announcing');
          clearTimeout(announceTimer);
          announceTimer = setTimeout(() => railItems[idx].classList.remove('is-announcing'), ANNOUNCE_MS);
        }
        activeIdx = idx;
      }
    }

    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; update(); });
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }

  return { init };
})();
