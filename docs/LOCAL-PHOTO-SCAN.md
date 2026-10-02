# Garage photos and local identification

Garage thumbnails fit the complete photo in a centered frame. Tap/click the photo
or title to open a larger image, description, condition, price, deposit and listing
status. Zoom in to inspect the photo, scroll to pan, or choose Fit photo. Editing,
QR, availability and removal controls remain separate from the preview button.

Listing identification runs on the device using free open-source components:

- TensorFlow.js / MobileNet for broad tool types. Model weights download on first use.
- Tesseract.js 7 for readable brand and model/part-number labels. The worker,
  LSTM WASM variants and English language data are deployed with the website.
- Native BarcodeDetector where supported, with bundled ZXing as the fallback for
  QR and product barcodes. Decoded URLs are treated as text; they are never opened.

Add the original tool photo and optionally a close-up of the label/barcode, then
choose **Identify on this device**. The scan drafts a title and functional
description, with readable brand/model identifiers where supported. Draft text
goes into the existing title/description fields. No database migration is needed.
Previously edited text is preserved; the result panel offers explicit buttons to
accept a replacement title/description. Review every suggestion before publishing.

Recognition sends no scan photo or barcode to a recognition or product-lookup
API and has no per-scan provider fee. Publishing still uploads the main listing
photo to existing private Supabase storage; the optional label photo is not saved.
The background-cleaned listing image and original condition baseline keep their
existing storage behavior.

Brand recognition uses a bounded list of printed manufacturer names and matching
manufacturer QR domains. Explicitly labeled model/part numbers are transcribed.
A numeric UPC/EAN alone is an identifier, not sufficient evidence of a brand or
product without a catalog. No catalog service is enabled. Conflicting or weak
reads are left unfilled. Condition, accessories, price and deposit are owner inputs.

The main app uses lazy chunks so OCR/vision libraries load when needed. The build
copies its OCR resources into assets/vision for both deployment targets. All files
remain below Cloudflare's individual asset limit.

## Verification, October 2, 2026 (UTC)

- All 26 unit/service checks pass, covering label-derived descriptions, ambiguous/low-confidence evidence,
  numeric barcode safety, draft preservation, and actual ZXing QR/UPC decoding.
- The browser walkthrough uses mocked Auth/database/payment transport, not real
  users or payments. It checks centered images, mobile taps, desktop clicks, zoom,
  listing edits and the existing rental/chat journey at responsive widths.
- A real browser OCR worker reads tests/fixtures/tool-label.png using self-hosted
  resources and produces DEWALT / DCD771 plus a drill description. Remote visual
  model requests are intentionally blocked in that step to test label fallback.
- Network assertions confirm that the scan invokes no remote identification Edge
  Function and uploads no scan photo. Existing form edits survive a repeated scan.
- The production build and Wrangler dry run passed using only dist-production.
  The largest asset is about 3.9 MB, below the 25 MiB individual asset limit.

Run the optional browser walkthrough after a production build:

```sh
NG_TEST_DIST=dist-production node tests/walkthrough.browser.mjs
```

Use CHROMIUM_PATH for an installed Chromium executable if Playwright's bundled
browser is unavailable. The tests use CPU rendering with that override.

Component documentation:
- https://github.com/naptha/tesseract.js
- https://github.com/zxing-js/library
