/**
 * 主要應用程式 — SPA 架構
 * 掃描器 Tab: 相機 → 即時辨識 → 統計 → 累計明文 → 過濾
 * 測試條碼 Tab: 條碼圖 → 明文列表 → 比對工具
 */

class BarcodeScannerApp {
  constructor() {
    // 掃描器
    this.video = document.getElementById('video');
    this.overlay = document.getElementById('overlay');
    this.scanIndicator = document.getElementById('scanIndicator');
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.uploadBtn = document.getElementById('uploadBtn');
    this.fileInput = document.getElementById('fileInput');

    // 控制項
    this.scanModeSelect = document.getElementById('scanMode');
    this.minConfidenceInput = document.getElementById('minConfidence');
    this.confidenceValue = document.getElementById('confidenceValue');
    this.pyramidScalesInput = document.getElementById('pyramidScales');
    this.formatCheckboxes = document.querySelectorAll('.control-panel .checkbox-group input[type="checkbox"]');
    this.enableRotationCheckbox = document.getElementById('enableRotation');
    this.enableEnhancementCheckbox = document.getElementById('enableEnhancement');
    this.validateEANCheckbox = document.getElementById('validateEAN');
    this.validateCode128Checkbox = document.getElementById('validateCode128');
    this.filterDuplicatesCheckbox = document.getElementById('filterDuplicates');
    this.contentFilterInput = document.getElementById('contentFilter');
    this.addFilterBtn = document.getElementById('addFilterBtn');
    this.activeFilters = document.getElementById('activeFilters');

    // 即時辨識
    this.liveDetectBox = document.getElementById('liveDetectBox');
    this.liveCount = document.getElementById('liveCount');

    // 統計
    this.fpsValue = document.getElementById('fpsValue');
    this.frameCountElem = document.getElementById('frameCount');
    this.uniqueBarcodesElem = document.getElementById('uniqueBarcodes');
    this.avgConfidenceElem = document.getElementById('avgConfidence');

    // 累計結果
    this.accumulatedList = document.getElementById('accumulatedList');
    this.accumulatedCount = document.getElementById('accumulatedCount');
    this.copyAccumulatedBtn = document.getElementById('copyAccumulatedBtn');
    this.clearAccumulatedBtn = document.getElementById('clearAccumulatedBtn');

    // 測試條碼 Tab
    this.testBarcodesContainer = document.getElementById('testBarcodes');
    this.generateTestBtn = document.getElementById('generateTestBtn');
    this.printTestBtn = document.getElementById('printTestBtn');
    this.barcodePlaintextBox = document.getElementById('barcodePlaintextBox');
    this.copyPlaintextBtn = document.getElementById('copyPlaintextBtn');

    // 比對
    this.scannedInput = document.getElementById('scannedInput');
    this.compareBtn = document.getElementById('compareBtn');
    this.clearCompareBtn = document.getElementById('clearCompareBtn');
    this.comparisonResults = document.getElementById('comparisonResults');

    // Tab / Theme
    this.themeToggle = document.getElementById('themeToggle');
    this.themeIcon = document.getElementById('themeIcon');
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    this.currentTab = 'scanner';

    // 核心
    this.scanner = null;
    this.generator = null;
    this.stream = null;
    this.overlayCtx = null;

    // 累計去重條碼（Set 保持插入順序）
    this.accumulatedValues = new Set();
  }

  async initialize() {
    this.loadTheme();

    this.scanner = new BarcodeScannerCore({
      scanMode: this.scanModeSelect.value,
      minConfidence: parseInt(this.minConfidenceInput.value),
      pyramidScales: this.parsePyramidScales(),
      allowedFormats: this.getAllowedFormats(),
      enableRotation: this.enableRotationCheckbox.checked,
      enableEnhancement: this.enableEnhancementCheckbox.checked,
      validateEAN: this.validateEANCheckbox.checked,
      validateCode128: this.validateCode128Checkbox.checked,
      filterDuplicates: this.filterDuplicatesCheckbox.checked
    });

    this.generator = new TestBarcodeGenerator();
    await this.generator.initialize();
    this.setupEventListeners();
    await this.generator.generateAll(this.testBarcodesContainer);

    // 產生後立刻更新測試頁明文列表
    this.updatePlaintextList();

    this.scanner.onResults = (filtered, stable) => this.handleResults(filtered, stable);
    this.scanner.onStats = (stats) => this.handleStats(stats);
    this.scanner.onError = (error) => this.handleError(error);
  }

  // ===== Tab =====

  switchTab(tabName) {
    this.currentTab = tabName;
    this.tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    this.tabPanes.forEach(p => p.classList.toggle('active', p.dataset.tabPane === tabName));
  }

  // ===== Theme =====

  loadTheme() {
    const saved = localStorage.getItem('barcode-scanner-theme') || 'ink-wash';
    document.documentElement.dataset.theme = saved;
    this.updateThemeLabel(saved);
  }

  toggleTheme() {
    const next = document.documentElement.dataset.theme === 'ink-wash' ? 'frozen-mist' : 'ink-wash';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('barcode-scanner-theme', next);
    this.updateThemeLabel(next);
  }

  updateThemeLabel(t) {
    this.themeIcon.textContent = t === 'ink-wash' ? '水墨' : '冰霧';
  }

  // ===== Events =====

  setupEventListeners() {
    this.tabButtons.forEach(b => b.addEventListener('click', () => this.switchTab(b.dataset.tab)));
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    this.startBtn.addEventListener('click', () => this.startCamera());
    this.stopBtn.addEventListener('click', () => this.stopCamera());
    this.clearBtn.addEventListener('click', () => this.clearResults());
    this.uploadBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    // 重新產生條碼後更新明文列表
    this.generateTestBtn.addEventListener('click', async () => {
      await this.generator.regenerate();
      this.updatePlaintextList();
    });
    this.printTestBtn.addEventListener('click', () => this.generator.printTestPage());

    this.scanModeSelect.addEventListener('change', () => this.updateConfig());
    this.minConfidenceInput.addEventListener('input', () => {
      this.confidenceValue.textContent = this.minConfidenceInput.value;
      this.updateConfig();
    });
    this.pyramidScalesInput.addEventListener('change', () => this.updateConfig());
    this.formatCheckboxes.forEach(cb => cb.addEventListener('change', () => this.updateConfig()));
    this.enableRotationCheckbox.addEventListener('change', () => this.updateConfig());
    this.enableEnhancementCheckbox.addEventListener('change', () => this.updateConfig());
    this.validateEANCheckbox.addEventListener('change', () => this.updateConfig());
    this.validateCode128Checkbox.addEventListener('change', () => this.updateConfig());
    this.filterDuplicatesCheckbox.addEventListener('change', () => this.updateConfig());

    this.addFilterBtn.addEventListener('click', () => this.addContentFilter());
    this.contentFilterInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.addContentFilter(); });

    // 累計結果
    this.copyAccumulatedBtn.addEventListener('click', () => {
      const text = [...this.accumulatedValues].join('\n');
      this.copyToClipboard(text);
    });
    this.clearAccumulatedBtn.addEventListener('click', () => {
      this.accumulatedValues.clear();
      this.renderAccumulatedList();
    });

    // 測試頁明文複製
    this.copyPlaintextBtn.addEventListener('click', () => {
      const values = this.getTestBarcodeValues();
      this.copyToClipboard(values.join('\n'));
    });

    // 比對
    this.compareBtn.addEventListener('click', () => this.runComparison());
    this.clearCompareBtn.addEventListener('click', () => { this.comparisonResults.innerHTML = ''; });
  }

  // ===== Camera =====

  async startCamera() {
    try {
      this.startBtn.disabled = true;
      this.scanIndicator.classList.add('active');

      let stream = null;
      const attempts = [
        { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
        { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: 'environment' } },
        { video: true }
      ];
      let lastErr = null;
      for (const c of attempts) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; }
        catch (e) { lastErr = e; }
      }
      if (!stream) throw lastErr || new Error('無法開啟相機');

      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      this.overlay.width = this.video.videoWidth || 1920;
      this.overlay.height = this.video.videoHeight || 1080;
      this.overlayCtx = this.overlay.getContext('2d');

      await this.scanner.initialize(this.video);
      await this.scanner.startScanning();
      this.stopBtn.disabled = false;
      this.startBtn.disabled = false;
    } catch (e) {
      this.handleError(new Error(this.getCameraErrorMessage(e)));
      this.startBtn.disabled = false;
      this.scanIndicator.classList.remove('active');
    }
  }

  getCameraErrorMessage(err) {
    const n = err.name || '';
    if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
      return !window.isSecureContext
        ? '手機需要 HTTPS 才能授權相機。\n請用 HTTPS 或「上傳圖片」。'
        : '相機權限被拒絕。\n請到瀏覽器設定允許相機後重新整理。';
    }
    if (n === 'NotFoundError') return '找不到相機裝置。';
    if (n === 'NotReadableError') return '相機被其他應用佔用。';
    if (n === 'TypeError' && !window.isSecureContext) return '需要 HTTPS 才能使用相機。';
    return err.message || '無法開啟相機';
  }

  stopCamera() {
    this.scanner.stopScanning();
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.video.srcObject = null;
    this.stopBtn.disabled = true;
    this.scanIndicator.classList.remove('active');
    if (this.overlayCtx) this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  clearResults() {
    this.scanner.clearResults();
    this.accumulatedValues.clear();
    this.renderAccumulatedList();
    this.renderLiveDetect([]);
    if (this.overlayCtx) this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const image = new Image();
    image.onload = async () => {
      const results = await this.scanner.scanImage(image);
      this.handleResults(results, results);
      this.fileInput.value = '';
    };
    image.src = URL.createObjectURL(file);
  }

  // ===== Results =====

  handleResults(filtered, stable) {
    // 即時辨識 — 顯示當前幀偵測到的
    this.renderLiveDetect(filtered);

    // 累計去重
    let changed = false;
    for (const b of stable) {
      if (!this.accumulatedValues.has(b.rawValue)) {
        this.accumulatedValues.add(b.rawValue);
        changed = true;
      }
    }
    if (changed) this.renderAccumulatedList();

    this.drawBoundingBoxes(stable);
  }

  // ===== Live Detect (即時辨識，固定高度) =====

  renderLiveDetect(barcodes) {
    this.liveCount.textContent = barcodes.length + ' 個';
    if (barcodes.length === 0) {
      this.liveDetectBox.innerHTML = '<span class="live-detect-empty">等待掃描...</span>';
      return;
    }
    let html = '';
    for (const b of barcodes) {
      const fmt = (b.format || '').replace('_', '-').toUpperCase();
      const val = b.rawValue.length > 30 ? b.rawValue.substring(0, 30) + '…' : b.rawValue;
      html += `<span class="live-detect-item"><span class="ldi-format">${fmt}</span><span class="ldi-value">${this.esc(val)}</span></span>`;
    }
    this.liveDetectBox.innerHTML = html;
  }

  // ===== Accumulated List (累計明文) =====

  renderAccumulatedList() {
    const vals = [...this.accumulatedValues];
    this.accumulatedCount.textContent = vals.length;
    if (vals.length === 0) {
      this.accumulatedList.innerHTML = '<span class="empty-hint">尚無累計結果</span>';
      return;
    }
    let html = '';
    for (const v of vals) {
      html += `<div class="accumulated-item">${this.esc(v)}</div>`;
    }
    this.accumulatedList.innerHTML = html;
  }

  // ===== Test Page Plaintext =====

  getTestBarcodeValues() {
    if (!this.generator || !this.generator.barcodes) return [];
    const seen = new Set();
    const result = [];
    for (const b of this.generator.barcodes) {
      if (!seen.has(b.value)) {
        seen.add(b.value);
        result.push(b.value);
      }
    }
    return result;
  }

  updatePlaintextList() {
    const values = this.getTestBarcodeValues();
    if (values.length === 0) {
      this.barcodePlaintextBox.innerHTML = '<span class="empty-hint">尚未產生條碼</span>';
      return;
    }
    let html = '';
    for (const v of values) {
      html += `<div class="barcode-plaintext-item">${this.esc(v)}</div>`;
    }
    this.barcodePlaintextBox.innerHTML = html;
  }

  // ===== Comparison =====

  runComparison() {
    const expectedValues = this.getTestBarcodeValues();
    const scannedText = this.scannedInput.value.trim();

    if (expectedValues.length === 0 && !scannedText) {
      this.handleError(new Error('無條碼可比對'));
      return;
    }

    const expected = new Set(expectedValues);
    const scanned = new Set(
      scannedText.split('\n').map(s => s.trim()).filter(s => s.length > 0)
    );

    const matched = [], missing = [], extra = [];
    for (const v of expected) { (scanned.has(v) ? matched : missing).push(v); }
    for (const v of scanned) { if (!expected.has(v)) extra.push(v); }

    const total = expected.size || 1;
    const rate = Math.round((matched.length / total) * 100);

    let html = `<div class="comparison-summary">
      <div class="rate">${rate}%</div>
      <div class="rate-label">辨識率 (${matched.length}/${expected.size} 匹配)</div>
    </div>`;

    if (matched.length > 0) {
      html += `<div class="comparison-group"><h4 class="matched">匹配 (${matched.length})</h4>
        <ul>${matched.map(v => `<li>${this.esc(v)}</li>`).join('')}</ul></div>`;
    }
    if (missing.length > 0) {
      html += `<div class="comparison-group"><h4 class="missing">未辨識 (${missing.length})</h4>
        <ul>${missing.map(v => `<li>${this.esc(v)}</li>`).join('')}</ul></div>`;
    }
    if (extra.length > 0) {
      html += `<div class="comparison-group"><h4 class="extra">額外辨識 (${extra.length})</h4>
        <ul>${extra.map(v => `<li>${this.esc(v)}</li>`).join('')}</ul></div>`;
    }
    this.comparisonResults.innerHTML = html;
  }

  // ===== Bounding Boxes =====

  drawBoundingBoxes(barcodes) {
    if (!this.overlayCtx) return;
    this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    const sx = this.overlay.width / this.video.videoWidth;
    const sy = this.overlay.height / this.video.videoHeight;
    const colors = {
      'ean_13':'#6b8f71','ean_8':'#5b8fa8','code_128':'#9b7ab8','code_39':'#c08040',
      'qr_code':'#4ab0a0','data_matrix':'#a05050','pdf_417':'#b89860','itf':'#7a7a7a'
    };
    for (const b of barcodes) {
      if (!b.boundingBox) continue;
      const bx = b.boundingBox;
      const x = bx.x*sx, y = bx.y*sy, w = bx.width*sx, h = bx.height*sy;
      const c = colors[b.format] || '#5b8fa8';
      this.overlayCtx.strokeStyle = c; this.overlayCtx.lineWidth = 3;
      this.overlayCtx.strokeRect(x, y, w, h);
      this.overlayCtx.fillStyle = c; this.overlayCtx.font = 'bold 13px Arial';
      const lbl = b.format.replace('_','-').toUpperCase();
      this.overlayCtx.fillRect(x, y-18, this.overlayCtx.measureText(lbl).width+8, 18);
      this.overlayCtx.fillStyle = '#fff'; this.overlayCtx.fillText(lbl, x+4, y-4);
    }
  }

  handleStats(stats) {
    this.fpsValue.textContent = stats.fps;
    this.frameCountElem.textContent = stats.frameCount;
    this.uniqueBarcodesElem.textContent = stats.uniqueBarcodes;
    this.avgConfidenceElem.textContent = stats.avgConfidence;
  }

  handleError(error) {
    const d = document.createElement('div');
    d.textContent = error.message;
    d.style.cssText = `position:fixed;top:16px;right:16px;background:var(--danger,#a05050);color:white;
      padding:12px 16px;border-radius:8px;z-index:9999;max-width:360px;white-space:pre-wrap;
      font-size:0.85rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
    document.body.appendChild(d);
    setTimeout(() => { d.style.opacity='0'; d.style.transition='opacity 0.3s'; setTimeout(()=>d.remove(),300); }, 4000);
  }

  // ===== Config =====

  updateConfig() {
    this.scanner.updateConfig({
      scanMode: this.scanModeSelect.value,
      minConfidence: parseInt(this.minConfidenceInput.value),
      pyramidScales: this.parsePyramidScales(),
      allowedFormats: this.getAllowedFormats(),
      enableRotation: this.enableRotationCheckbox.checked,
      enableEnhancement: this.enableEnhancementCheckbox.checked,
      validateEAN: this.validateEANCheckbox.checked,
      validateCode128: this.validateCode128Checkbox.checked,
      filterDuplicates: this.filterDuplicatesCheckbox.checked
    });
  }

  parsePyramidScales() {
    try { return this.pyramidScalesInput.value.split(',').map(s => parseFloat(s.trim())).filter(s => !isNaN(s)); }
    catch(e) { return [1.0, 0.6, 0.35]; }
  }

  getAllowedFormats() {
    const f = [];
    this.formatCheckboxes.forEach(cb => { if (cb.checked) f.push(cb.value); });
    return f;
  }

  addContentFilter() {
    const v = this.contentFilterInput.value.trim();
    if (!v) return;
    try {
      const rx = new RegExp(v);
      this.scanner.filter.addCustomFilter(b => rx.test(b.rawValue));
      const tag = document.createElement('div');
      tag.className = 'filter-tag';
      tag.innerHTML = `<span>${v}</span><button>\u00d7</button>`;
      tag.querySelector('button').addEventListener('click', () => {
        this.activeFilters.removeChild(tag);
        this.rebuildFilters();
      });
      this.activeFilters.appendChild(tag);
      this.contentFilterInput.value = '';
    } catch(e) { this.handleError(new Error('無效的正則表達式')); }
  }

  rebuildFilters() {
    this.scanner.filter.clearCustomFilters();
    this.activeFilters.querySelectorAll('.filter-tag span').forEach(s => {
      try { const rx = new RegExp(s.textContent); this.scanner.filter.addCustomFilter(b => rx.test(b.rawValue)); }
      catch(e) {}
    });
  }

  // ===== Utils =====

  esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  async copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); }
    catch(e) {
      const ta = document.createElement('textarea'); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    }
    this.showToast('已複製');
  }

  showToast(msg) {
    const old = document.querySelector('.toast-msg'); if (old) old.remove();
    const t = document.createElement('div'); t.className = 'toast-msg'; t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
      background:var(--success,#6b8f71);color:white;padding:6px 16px;border-radius:6px;
      z-index:9999;font-size:0.85rem;`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),300); }, 1800);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new BarcodeScannerApp();
  app.initialize().catch(e => console.error('[App] 啟動失敗:', e));
});

if (typeof window !== 'undefined') window.BarcodeScannerApp = BarcodeScannerApp;
