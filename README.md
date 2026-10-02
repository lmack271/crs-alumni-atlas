# CRS Alumni Atlas — site

Static site, zero build step, zero CDN dependency (matches
`CRS_African_Alumni_Atlas.html`'s approach — vendored D3/versor, plain
`<script>` tags, no bundler). Deployable as-is to GitHub Pages by pointing it
at this `docs/` directory.

## Running locally

The pages `fetch()` JSON from `data/`, which does not work over a plain
`file://` URL (browsers block it as cross-origin). Serve the directory over
HTTP instead:

```
cd docs
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Regenerating the data

The JSON in `data/` is generated from the analysis spreadsheets/CSVs one
directory up. To refresh it after the underlying analysis changes:

```
cd ..
python3 regional_representation_stats.py   # rebuilds CRS_Regional_Representation_Stats.xlsx
                                            # (Continent Summary, Sub-Region Summary, per-continent Countries sheets)
python3 export_site_data.py                # rebuilds docs/data/continents-summary.json + docs/data/africa.json
```

`docs/data/world-110m.json` and `docs/data/africa-stories.json` are not part
of this refresh: the world basemap is static (re-run `extract_world_geometry.py`
only if the prototype's basemap is intentionally replaced), and the stories
are hand-authored narrative content, not a script output.

## Status

Every continent (Africa, the Americas, Asia, Europe, Oceania) has a full
deep-dive page built from the same template (`africa.html` is the source the
others were copied from; only `<title>` and `data-continent` differ).
`export_site_data.py` writes `docs/data/{continent}.json` for each. Narrative
stories are hand-authored in `docs/data/{continent}-stories.json`; only Africa
has one so far, and pages without a stories file hide the story sections.
Sub-region globe views per continent live in `js/region-scrolly.js` (`VIEWS`).
