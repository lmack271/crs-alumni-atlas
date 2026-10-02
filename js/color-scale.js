/* Sequential blue camper-count scale + sqrt-normalized interpolation,
   ported from the prototype's campColor()/lerpColor()
   (CRS_African_Alumni_Atlas.html). Shared by scrollytelling.js (home page,
   continent-level) and region-scrolly.js (region page, sub-region-level)
   so the two globe tours use one color scale rather than two copies. */

const ColorScale = (() => {
  const SEQ_BLUE = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];

  function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), b2 = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${b2})`;
  }

  function campColor(camp, maxCamp) {
    const norm = 0.10 + 0.90 * Math.sqrt(camp / maxCamp);
    const scaled = norm * (SEQ_BLUE.length - 1);
    const i = Math.min(SEQ_BLUE.length - 2, Math.floor(scaled));
    return lerpColor(SEQ_BLUE[i], SEQ_BLUE[i + 1], scaled - i);
  }

  const NOT_REP_FILL = '#726d5f';
  // Muted/desaturated version of NOT_REP_FILL's neighborhood, for countries
  // that are part of the continent but outside the sub-region currently in
  // focus -- present on the map, but visually receded.
  const DIM_FILL = 'rgba(114, 109, 95, 0.32)';

  return { campColor, NOT_REP_FILL, DIM_FILL };
})();
