# Neighborhood Garage

Mobile-first, static peer-to-peer tool-sharing demo, built with dependency-free ES modules and CSS. Requires Node 20+ to build/test; Python 3 for the included local server command. No installation step or API keys needed.

## Run

```sh
npm run dev
# Open http://localhost:5173
npm test
npm run build
# Static output: dist/
```

Do not open index.html through file://; JavaScript modules require an HTTP server.

## Deploy to https://smkimbal.github.io/NeighborhoodGarage/

1. Put this directory's contents at the root of the `smkimbal/NeighborhoodGarage` GitHub repository. For an existing repository, merge deliberately rather than overwriting unrelated work.
2. In GitHub repository Settings → Pages, select **GitHub Actions** as the source.
3. Commit and push to `main`. The included `.github/workflows/deploy.yml` tests, builds and deploys `dist/`.
4. Check the Actions deployment job and open the URL above after it completes.

For a new repository:

```sh
git init
git add .
git commit -m "Build Neighborhood Garage demo"
git branch -M main
git remote add origin https://github.com/smkimbal/NeighborhoodGarage.git
git push -u origin main
```

All assets use relative paths and page navigation uses hash routes, so the `/NeighborhoodGarage/` prefix and reloads work without rewrite rules. No external fonts, maps, image services, runtime dependencies or CDNs are required. This package was built locally; it was not pushed to GitHub or published by this session.

## Try the complete demo

1. Explore tools, search, choose a category/radius, or open the schematic map. Optional location permission filters distances from your coordinates; seeded tools are in Chicago, so outside Chicago you may see no results.
2. Reserve a neighbor's tool. $120 initial sample credits apply to the rental and deposit; the remainder is simulated payment.
3. Open My rentals, simulate the barcode scan or enter the displayed code, and confirm pickup.
4. Return with a photo and a simulated wear assessment. Scan/enter the code or select agreed location drop-off.
5. Open My garage to act as the demo owner. Approve to issue deposit credits once, or dispute to retain the deposit. Demo allows role switching explicitly; live must enforce owner identity server-side.
6. Leave a review on a completed rental. View credits and badges in Profile.
7. Lend a tool: upload a photo, simulate autofill, correct the fields, set prices and publish. The original image is retained; background removal and AI recognition are simulated, not performed.
8. Messages are local demo conversations and sync between browser tabs. They do not contact real neighbors.

## Architecture and limitations

- src/app.js: responsive pages, semantic controls, native dialog flows and escaped user text.
- src/engine.js: interchangeable DemoEngine / LiveEngine, escrow math, tracking barcode and persistence.
- src/style.css: flexible header, mobile grid, touch targets and focus states.
- backend/: PostgreSQL schema and secure live API contract.
- config.js: public backend URL only; no secrets.
- Demo Mode switch persists separately from demo state. Live mode fails closed if no API is configured. It never silently falls back to demo data.
- Seeded catalog uses tool/category icons, not product photographs. User uploads show actual photos. The map is an interactive schematic, not a street map or navigation service.
- Barcode is Code 39, supporting NG + numeric IDs. The demo supplies simulated scan and manual entry; live camera decoding is not implemented.
- LocalStorage has browser quota limits; uploads are resized to 900 pixels. If storage is full, the UI shows the write error. Demo records may contain photos and chat; do not enter sensitive real data. Clear the `ng-demo-v1` key in browser storage to reset.
- Demo is a single-user sandbox. It is not a transactional, concurrent, fraud-resistant wallet. Production requires the backend controls documented in backend/README.md.
- Estimated owner earnings use a 5% platform fee deducted from the rental, not the deposit. No actual coverage, banking, cash redemption or insurance is provided.
- Live backend, auth, true realtime delivery, payment processor, genuine vision/background removal and insurance integration are scaffolds only. These services are not deployable on GitHub Pages itself.

## Verification

`npm test` checks quote math, legal lifecycle transitions, persistence, incorrect tracking codes, duplicate reservations/refunds/reviews, dispute holds and unconfigured live mode. A browser smoke test is provided for mobile overflow and checkout/return/approval/listing flows, but was NOT executed successfully in this environment: no browser binary was available and downloading Chromium failed. See tests/browser-smoke.cjs (requires Playwright and Chromium installed separately). Run the dev server, then `node tests/browser-smoke.cjs`. Rendered layout and browser interactions still require verification.
