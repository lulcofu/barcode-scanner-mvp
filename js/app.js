/**
 * 主要應用程式
 * SPA 架構：掃描器 / 測試條碼 兩個 Tab
 */

class BarcodeScannerApp {
  constructor() {
    // === 掃描器 Tab 元素 ===
    this.video = document.getElementById('video');
    this.overlay = document.getElementById('overlay');
    this.scanIndicator = document.getElementById('scanIndicator');
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.uploadBtn = document.getElementById('uploadBtn');
    this.fileInput = document.getElementById('fileInput');
    this.resultsContainer = document.getElementById('results');
    this.totalScanned = document.getElementById('totalScanned');
    this.stableCount = document.getElementById('stableCount');

    // 控制項
    this.scanModeSelect = document.getElementById('scanMode');
    this.minConfidenceInput = document.getElementById('minConfidence');
    this.confidenceValue = document.getElementById('confidenceValue');
    this.pyramidScalesInput = document.getElementById('pyramidScales');
    this.formatCheckboxes = document.querySelectorAll('.control-panel .checkbox-group input[type="checkbox"]');
    this.validateEANCheckbox = document.getElementById('validateEAN');
    this.validateCode128Checkbox = document.getElementById('validateCode128');
    this.filterDuplicatesCheckbox = document.getElementById('filterDuplicates');
    this.contentFilterInput = document.getElementById('contentFilter');
    this.addFilterBtn = document.getElementById('addFilterBtn');
    this.activeFilters = document.getElementById('activeFilters');

    // 統計
    this.fpsValue = document.getElementById('fpsValue');
    this.frameCountElem = document.getElementById('frameCount');
    this.uniqueBarcodesElem = document.getElementById('uniqueBarcodes');
    this.avgConfidenceElem = document.getElementById('avgConfidence');

    // === 測試條碼 Tab 元素 ===
    this.testBarcodesContainer = document.getElementById('testBarcodes');
    this.generateTestBtn = document.getElementById('generateTestBtn');
    this.printTestBtn = document.getElementById('printTestBtn');

    // 比對
    this.expectedBarcodesInput = document.getElementById('expectedBarcodes');
    this.recognizedBarcodesInput = document.getElementById('recognizedBarcodes');
    this.copyRecognizedBtn = document.getElementById('copyRecognizedBtn');
    this.clearRecognizedBtn = document.getElementById('clearRecognizedBtn');
    this.compareBtn = document.getElementById('compareBtn');
    this.clearCompareBtn = document.getElementById('clearCompareBtn');
    this.comparisonResults = document.getElementById('comparisonResults');

    // === Tab / Theme ===
    this.themeToggle = document.getElementById('themeToggle');
    this.themeIcon = document.getElementById('themeIcon');
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    this.currentTab = 'scanner';

    // === 核心 ===
    this.scanner = null;
    this.generator = null;
    this.stream = null;
    this.overlayCtx = null;
    this.lastResults = [];
    this.lastStableResults = [];

    // 已辨識條碼字串列表（跨 Tab 共享）
    this.recognizedValues = new Set();
  }

  async initialize() {
    console.log('[App] 初始化應用程式');

    // 載入主題
    this.loadTheme();

    // 隱藏 HTTPS 警告
    const warningBanner = document.getElementById('httpsWarning');
    if (warningBanner) warningBanner.style.display = 'none';

    // 初始化掃描器
    this.scanner = new BarcodeScannerCore({
      scanMode: this.scanModeSelect.value,
      minConfidence: parseInt(this.minConfidenceInput.value),
      pyramidScales: this.parsePyramidScales(),
      allowedFormats: this.getAllowedFormats(),
      validateEAN: this.validateEANCheckbox.checked,
      validateCode128: this.validateCode128Checkbox.checked,
      filterDuplicates: this.filterDuplicatesCheckbox.checked
    });

    // 初始化產生器
    this.generator = new TestBarcodeGenerator();
    await this.generator.initialize();

    this.setupEventListeners();

    await this.generator.generateAll(this.testBarcodesContainer);

    // 設定回調
    this.scanner.onResults = (filtered, stable) => this.handleResults(filtered, stable);
    this.scanner.onStats = (stats) => this.handleStats(stats);
    this.scanner.onError = (error) => this.handleError(error);

    console.log('[App] 初始化完成');
  }

  // ===== Tab 切換 =====

  switchTab(tabName) {
    this.currentTab = tabName;

    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    this.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.dataset.tabPane === tabName);
    });

    // 切到測試 Tab 時更新已辨識列表
    if (tabName === 'test') {
      this.updateRecognizedDisplay();
    }
  }

  // ===== 主題 =====

  loadTheme() {
    const saved = localStorage.getItem('barcode-scanner-theme') || 'ink-wash';
    document.documentElement.dataset.theme = saved;
    this.updateThemeLabel(saved);
  }

  toggleTheme() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'ink-wash' ? 'frozen-mist' : 'ink-wash';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('barcode-scanner-theme', next);
    this.updateThemeLabel(next);
  }

  updateThemeLabel(theme) {
    this.themeIcon.textContent = theme === 'ink-wash' ? '水墨' : '冰霧';
  }

  // ===== 事件監聽 =====

  setupEventListeners() {
    // Tab
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Theme
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // 掃描器控制
    this.startBtn.addEventListener('click', () => this.startCamera());
    this.stopBtn.addEventListener('click', () => this.stopCamera());
    this.clearBtn.addEventListener('click', () => this.clearResults());
    this.uploadBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    // 測試條碼
    this.generateTestBtn.addEventListener('click', () => this.generator.regenerate());
    this.printTestBtn.addEventListener('click', () => this.generator.printTestPage());

    // 控制項
    this.scanModeSelect.addEventListener('change', () => this.updateConfig());
    this.minConfidenceInput.addEventListener('input', () => {
      this.confidenceValue.textContent = this.minConfidenceInput.value;
      this.updateConfig();
    });
    this.pyramidScalesInput.addEventListener('change', () => this.updateConfig());
    this.formatCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => this.updateConfig());
    });
    this.validateEANCheckbox.addEventListener('change', () => this.updateConfig());
    this.validateCode128Checkbox.addEventListener('change', () => this.updateConfig());
    this.filterDuplicatesCheckbox.addEventListener('change', () => this.updateConfig());

    // 過濾器
    this.addFilterBtn.addEventListener('click', () => this.addContentFilter());
    this.contentFilterInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addContentFilter();
    });

    // 比對
    this.compareBtn.addEventListener('click', () => this.runComparison());
    this.clearCompareBtn.addEventListener('click', () => {
      this.comparisonResults.innerHTML = '';
    });
    this.copyRecognizedBtn.addEventListener('click', () => {
      this.copyToClipboard(this.recognizedBarcodesInput.value);
    });
    this.clearRecognizedBtn.addEventListener('click', () => {
      this.recognizedValues.clear();
      this.recognizedBarcodesInput.value = '';
    });
  }

  // ===== 相機 =====

  async startCamera() {
    try {
      this.startBtn.disabled = true;
      this.scanIndicator.classList.add('active');

      let stream = null;
      const constraintsList = [
        { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
        { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: 'environment' } },
        { video: true }
      ];

      let lastError = null;
      for (const constraints of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
          console.warn('[App] 相機參數不支援，嘗試降級:', err.name, err.message);
        }
      }

      if (!stream) {
        throw lastError || new Error('無法開啟相機');
      }

      this.stream = stream;
      this.video.srcObject = this.stream;
      await this.video.play();

      this.overlay.width = this.video.videoWidth || 1920;
      this.overlay.height = this.video.videoHeight || 1080;
      this.overlayCtx = this.overlay.getContext('2d');

      await this.scanner.initialize(this.video);
      await this.scanner.startScanning();

      this.stopBtn.disabled = false;
      this.startBtn.disabled = false;
      console.log('[App] 相機已啟動');

    } catch (e) {
      console.error('[App] 相機啟動失敗:', e);
      this.handleError(new Error(this.getCameraErrorMessage(e)));
      this.startBtn.disabled = false;
      this.scanIndicator.classList.remove('active');
    }
  }

  getCameraErrorMessage(error) {
    const name = error.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      if (typeof window.isSecureContext !== 'undefined' && !window.isSecureContext) {
        return '手機瀏覽器需要 HTTPS 才能授權相機。\n\n替代方案：\n• 使用 HTTPS 網址開啟\n• 使用「上傳圖片」掃描條碼';
      }
      return '相機權限被拒絕。\n請到 Chrome 設定 → 網站設定 → 相機，允許此網站使用相機後重新整理頁面。';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '找不到相機裝置。請使用「上傳圖片」功能。';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '相機正被其他應用程式使用中。';
    }
    if (name === 'TypeError' && !window.isSecureContext) {
      return '此瀏覽器需要 HTTPS 連線才能使用相機。\n請使用「上傳圖片」掃描條碼。';
    }
    return error.message || '無法開啟相機';
  }

  stopCamera() {
    this.scanner.stopScanning();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.stopBtn.disabled = true;
    this.scanIndicator.classList.remove('active');
    if (this.overlayCtx) {
      this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    }
  }

  clearResults() {
    this.scanner.clearResults();
    this.lastResults = [];
    this.lastStableResults = [];
    this.renderResults([], []);
    if (this.overlayCtx) {
      this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    }
    // 不清除 recognizedValues — 那是跨 Tab 的累積紀錄
  }

  // ===== 檔案上傳 =====

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const image = new Image();
      image.onload = async () => {
        const results = await this.scanner.scanImage(image);
        this.handleResults(results, results);
        this.fileInput.value = '';
      };
      image.src = URL.createObjectURL(file);
    } catch (e) {
      console.error('[App] 圖片處理失敗:', e);
      this.handleError(e);
    }
  }

  // ===== 結果處理 =====

  handleResults(filtered, stable) {
    this.lastResults = filtered;
    this.lastStableResults = stable;

    // 累積已辨識條碼
    for (const b of stable) {
      this.recognizedValues.add(b.rawValue);
    }

    this.renderResults(filtered, stable);
    this.drawBoundingBoxes(stable);

    // 如果測試 Tab 可見，即時更新已辨識列表
    if (this.currentTab === 'test') {
      this.updateRecognizedDisplay();
    }
  }

  renderResults(filtered, stable) {
    this.totalScanned.textContent = `已掃描: ${this.scanner.accumulator.getAllResults().length} 個條碼`;
    this.stableCount.textContent = `穩定結果: ${stable.length} 個`;

    this.resultsContainer.innerHTML = '';

    if (filtered.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="empty-state">
          <p>尚無掃描結果</p>
          <p class="hint">請開啟相機或上傳圖片開始掃描</p>
        </div>`;
      return;
    }

    for (const barcode of stable) {
      this.resultsContainer.appendChild(this.createResultCard(barcode));
    }
    for (const barcode of filtered) {
      if (!stable.some(s => s.key === barcode.key)) {
        const card = this.createResultCard(barcode);
        card.style.opacity = '0.5';
        this.resultsContainer.appendChild(card);
      }
    }
  }

  createResultCard(barcode) {
    const card = document.createElement('div');
    card.className = `result-card ${barcode.format}`;

    const formatBadge = document.createElement('span');
    formatBadge.className = 'format-badge';
    formatBadge.textContent = barcode.format.replace('_', '-').toUpperCase();

    const valueDiv = document.createElement('div');
    valueDiv.className = 'barcode-value';
    valueDiv.textContent = barcode.rawValue;
    valueDiv.title = barcode.rawValue;

    const meta = document.createElement('div');
    meta.className = 'meta';

    const confidence = document.createElement('div');
    confidence.className = 'confidence';
    confidence.innerHTML = `
      <span>信心度: ${barcode.confidence}</span>
      <div class="confidence-bar">
        <div class="confidence-fill" style="width: ${Math.min(barcode.confidence * 10, 100)}%"></div>
      </div>`;

    const source = document.createElement('span');
    source.textContent = barcode.source || 'zxing';

    meta.appendChild(confidence);
    meta.appendChild(source);
    card.appendChild(formatBadge);
    card.appendChild(valueDiv);
    card.appendChild(meta);

    card.addEventListener('click', () => this.copyToClipboard(barcode.rawValue));
    return card;
  }

  drawBoundingBoxes(barcodes) {
    if (!this.overlayCtx) return;
    this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);

    const scaleX = this.overlay.width / this.video.videoWidth;
    const scaleY = this.overlay.height / this.video.videoHeight;

    for (const barcode of barcodes) {
      if (!barcode.boundingBox) continue;
      const box = barcode.boundingBox;
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;
      const color = this.getFormatColor(barcode.format);

      this.overlayCtx.strokeStyle = color;
      this.overlayCtx.lineWidth = 3;
      this.overlayCtx.strokeRect(x, y, w, h);

      this.overlayCtx.fillStyle = color;
      this.overlayCtx.font = 'bold 14px Arial';
      const label = barcode.format.replace('_', '-').toUpperCase();
      const textWidth = this.overlayCtx.measureText(label).width;
      this.overlayCtx.fillRect(x, y - 20, textWidth + 10, 20);
      this.overlayCtx.fillStyle = '#fff';
      this.overlayCtx.fillText(label, x + 5, y - 5);
    }
  }

  getFormatColor(format) {
    const colors = {
      'ean_13': '#6b8f71', 'ean_8': '#5b8fa8',
      'code_128': '#9b7ab8', 'code_39': '#c08040',
      'qr_code': '#4ab0a0', 'data_matrix': '#a05050',
      'pdf_417': '#b89860', 'itf': '#7a7a7a'
    };
    return colors[format] || '#5b8fa8';
  }

  handleStats(stats) {
    this.fpsValue.textContent = stats.fps;
    this.frameCountElem.textContent = stats.frameCount;
    this.uniqueBarcodesElem.textContent = stats.uniqueBarcodes;
    this.avgConfidenceElem.textContent = stats.avgConfidence;
  }

  // ===== 已辨識條碼顯示 =====

  updateRecognizedDisplay() {
    const values = [...this.recognizedValues];
    this.recognizedBarcodesInput.value = values.join('\n');
  }

  // ===== 比對 =====

  runComparison() {
    const expectedText = this.expectedBarcodesInput.value.trim();
    const recognizedText = this.recognizedBarcodesInput.value.trim();

    if (!expectedText && !recognizedText) {
      this.handleError(new Error('請輸入預期條碼或已辨識條碼'));
      return;
    }

    const expected = new Set(
      expectedText.split('\n').map(s => s.trim()).filter(s => s.length > 0)
    );
    const recognized = new Set(
      recognizedText.split('\n').map(s => s.trim()).filter(s => s.length > 0)
    );

    const matched = [];
    const missing = [];
    const extra = [];

    for (const v of expected) {
      if (recognized.has(v)) {
        matched.push(v);
      } else {
        missing.push(v);
      }
    }
    for (const v of recognized) {
      if (!expected.has(v)) {
        extra.push(v);
      }
    }

    const total = expected.size || 1;
    const rate = Math.round((matched.length / total) * 100);

    let html = `
      <div class="comparison-summary">
        <div class="rate">${rate}%</div>
        <div class="rate-label">辨識率 (${matched.length}/${expected.size} 匹配)</div>
      </div>`;

    if (matched.length > 0) {
      html += `<div class="comparison-group">
        <h4 class="matched">匹配 (${matched.length})</h4>
        <ul>${matched.map(v => `<li>${this.escapeHtml(v)}</li>`).join('')}</ul>
      </div>`;
    }

    if (missing.length > 0) {
      html += `<div class="comparison-group">
        <h4 class="missing">未辨識 (${missing.length})</h4>
        <ul>${missing.map(v => `<li>${this.escapeHtml(v)}</li>`).join('')}</ul>
      </div>`;
    }

    if (extra.length > 0) {
      html += `<div class="comparison-group">
        <h4 class="extra">額外辨識 (${extra.length})</h4>
        <ul>${extra.map(v => `<li>${this.escapeHtml(v)}</li>`).join('')}</ul>
      </div>`;
    }

    this.comparisonResults.innerHTML = html;
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== 錯誤處理 =====

  handleError(error) {
    console.error('[App] 錯誤:', error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = `${error.message}`;
    errorDiv.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: var(--danger, #a05050); color: white;
      padding: 14px 18px; border-radius: 8px;
      z-index: 9999; max-width: 400px; white-space: pre-wrap;
      font-size: 0.9rem; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      errorDiv.style.transition = 'opacity 0.3s';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  // ===== 設定 =====

  updateConfig() {
    this.scanner.updateConfig({
      scanMode: this.scanModeSelect.value,
      minConfidence: parseInt(this.minConfidenceInput.value),
      pyramidScales: this.parsePyramidScales(),
      allowedFormats: this.getAllowedFormats(),
      validateEAN: this.validateEANCheckbox.checked,
      validateCode128: this.validateCode128Checkbox.checked,
      filterDuplicates: this.filterDuplicatesCheckbox.checked
    });
  }

  parsePyramidScales() {
    try {
      return this.pyramidScalesInput.value.split(',').map(s => parseFloat(s.trim())).filter(s => !isNaN(s));
    } catch (e) {
      return [1.0, 0.6, 0.35];
    }
  }

  getAllowedFormats() {
    const formats = [];
    this.formatCheckboxes.forEach(cb => {
      if (cb.checked) formats.push(cb.value);
    });
    return formats;
  }

  addContentFilter() {
    const value = this.contentFilterInput.value.trim();
    if (!value) return;
    try {
      const regex = new RegExp(value);
      this.scanner.filter.addCustomFilter((barcode) => regex.test(barcode.rawValue));

      const tag = document.createElement('div');
      tag.className = 'filter-tag';
      tag.innerHTML = `<span>${value}</span><button>\u00d7</button>`;
      tag.querySelector('button').addEventListener('click', () => {
        this.activeFilters.removeChild(tag);
        this.rebuildFilters();
      });
      this.activeFilters.appendChild(tag);
      this.contentFilterInput.value = '';
    } catch (e) {
      this.handleError(new Error('無效的正則表達式'));
    }
  }

  rebuildFilters() {
    this.scanner.filter.clearCustomFilters();
    this.activeFilters.querySelectorAll('.filter-tag span').forEach(span => {
      try {
        const regex = new RegExp(span.textContent);
        this.scanner.filter.addCustomFilter((barcode) => regex.test(barcode.rawValue));
      } catch (e) { /* skip */ }
    });
  }

  // ===== 工具 =====

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(`已複製: ${text}`);
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast(`已複製: ${text}`);
    }
  }

  showToast(message) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: var(--success, #6b8f71); color: white;
      padding: 8px 18px; border-radius: 6px; z-index: 9999; font-size: 0.9rem;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const app = new BarcodeScannerApp();
  app.initialize().then(() => {
    console.log('[App] 應用程式已啟動');
  }).catch(e => {
    console.error('[App] 啟動失敗:', e);
  });
});

if (typeof window !== 'undefined') {
  window.BarcodeScannerApp = BarcodeScannerApp;
}
