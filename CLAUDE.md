# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based multi-barcode scanner MVP written in vanilla HTML/CSS/JS (Traditional Chinese UI). Supports 1D barcodes (EAN-13, EAN-8, Code-128, Code-39, ITF) and 2D codes (QR Code, Data Matrix, PDF-417) with multi-scale pyramid scanning and multi-frame accumulation for improved accuracy.

## Development

No build system or package manager. All dependencies are loaded via CDN `<script>` tags in `index.html`. To run locally, serve the directory with any static file server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Camera features require HTTPS or localhost. The app detects this and shows a warning banner.

## Architecture

Three-layer design, all using vanilla JS classes exported on `window`:

1. **`js/app.js`** (`BarcodeScannerApp`) — UI controller. Binds DOM elements, handles camera start/stop, file upload, renders result cards, draws bounding box overlays on canvas, manages filter UI.

2. **`js/barcode-scanner.js`** — Core scanning engine with three classes:
   - `BarcodeScannerCore` — Main controller. Manages scan loop via `requestAnimationFrame`, implements three scan modes (`single`, `pyramid`, `roi`). Pyramid mode scans at multiple scales (default 1.0, 0.6, 0.35) and maps coordinates back. ROI mode splits the frame into a 3x3 grid. Uses ZXing-js (`BrowserMultiFormatReader`) as primary decoder and native `BarcodeDetector` API as fallback.
   - `MultiFrameAccumulator` — Tracks barcode detections across frames using a `Map` keyed by `format:rawValue`. Increments confidence on repeated detections and expires entries after `maxAge` ms.
   - `BarcodeDataFilter` — Pipeline filter: type whitelist → format validation (EAN checksum, Code-128 min length) → custom regex filters → priority sort → deduplication.

3. **`js/test-barcode-generator.js`** (`TestBarcodeGenerator`) — Generates test barcode images in-browser using JsBarcode (1D) and QRCode.js (2D) with size/rotation variants for scanner testing.

## Key External Dependencies (CDN)

- `@zxing/browser` — Barcode decoding engine
- `JsBarcode` (3.11.6) — 1D barcode image generation for tests
- `qrcodejs` (1.0.0) — QR code image generation for tests

## Conventions

- All code comments and console log messages are in Traditional Chinese
- Barcode format identifiers use snake_case internally (e.g., `ean_13`, `code_128`, `qr_code`)
- Results are keyed as `format:rawValue` strings throughout the accumulator and deduplication logic
