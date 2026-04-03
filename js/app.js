/**
 * 解析 Ollama NDJSON streaming 回應，提取所有 message.content 拼接
 * 處理黏接的 JSON 物件（無換行分隔）及內容中含 }{ 的情況
 */
function parseOllamaNDJSON(text) {
  let content = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue; }
    let depth = 0, inStr = false, esc = false, j = i;
    for (; j < text.length; j++) {
      const c = text[j];
      if (esc) { esc = false; continue; }
      if (c === '\\' && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      if (c === '}') { depth--; if (depth === 0) { j++; break; } }
    }
    try {
      const obj = JSON.parse(text.slice(i, j));
      if (obj.message?.content) content += obj.message.content;
    } catch (e) { /* skip */ }
    i = j;
  }
  return content;
}

// 供測試使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseOllamaNDJSON };
}

/**
 * 主要應用程式 — SPA 架構
 * 掃描器 Tab | 過濾設定 Tab | 測試條碼 Tab
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

    // 過濾設定 Tab — 格式驗證
    this.validateEANCheckbox = document.getElementById('validateEAN');
    this.validateCode128Checkbox = document.getElementById('validateCode128');
    this.filterDuplicatesCheckbox = document.getElementById('filterDuplicates');

    // 過濾設定 Tab — 正則規則
    this.ruleNameInput = document.getElementById('ruleName');
    this.rulePatternInput = document.getElementById('rulePattern');
    this.addRuleBtn = document.getElementById('addRuleBtn');
    this.regexRulesContainer = document.getElementById('regexRules');

    // 過濾設定 Tab — AI 產生
    this.aiToggleBtn = document.getElementById('aiToggleBtn');
    this.aiPanel = document.getElementById('aiPanel');
    this.aiPanelCloseBtn = document.getElementById('aiPanelCloseBtn');
    this.aiSamples = document.getElementById('aiSamples');
    this.aiGenerateBtn = document.getElementById('aiGenerateBtn');
    this.aiStatus = document.getElementById('aiStatus');
    this.aiResult = document.getElementById('aiResult');
    this.aiResultPattern = document.getElementById('aiResultPattern');
    this.aiUseBtn = document.getElementById('aiUseBtn');

    // 過濾設定 Tab — AI 設定
    this.aiApiFormat = document.getElementById('aiApiFormat');
    this.aiApiUrl = document.getElementById('aiApiUrl');
    this.aiApiToken = document.getElementById('aiApiToken');
    this.aiModel = document.getElementById('aiModel');
    this.corsWarning = document.getElementById('corsWarning');

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

    // 累計去重條碼
    this.accumulatedValues = new Set();

    // 正則規則
    this.regexRules = [];
    this.editingRuleId = null;
  }

  async initialize() {
    this.loadTheme();
    this.loadRegexRules();
    this.loadAISettings();

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
    this.updatePlaintextList();

    // 套用已儲存的規則到掃描器
    this.rebuildScannerFilters();

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

    // 掃描器
    this.startBtn.addEventListener('click', () => this.startCamera());
    this.stopBtn.addEventListener('click', () => this.stopCamera());
    this.clearBtn.addEventListener('click', () => this.clearResults());
    this.uploadBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    this.generateTestBtn.addEventListener('click', async () => {
      await this.generator.regenerate();
      this.updatePlaintextList();
    });
    this.printTestBtn.addEventListener('click', () => this.generator.printTestPage());

    // 掃描控制
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

    // 累計結果
    this.copyAccumulatedBtn.addEventListener('click', () => {
      this.copyToClipboard([...this.accumulatedValues].join('\n'));
    });
    this.clearAccumulatedBtn.addEventListener('click', () => {
      this.accumulatedValues.clear();
      this.renderAccumulatedList();
    });

    // 測試頁明文
    this.copyPlaintextBtn.addEventListener('click', () => {
      this.copyToClipboard(this.getTestBarcodeValues().join('\n'));
    });

    // 比對
    this.compareBtn.addEventListener('click', () => this.runComparison());
    this.clearCompareBtn.addEventListener('click', () => { this.comparisonResults.innerHTML = ''; });

    // ===== 正則規則 CRUD =====
    this.addRuleBtn.addEventListener('click', () => this.addRegexRule());
    this.rulePatternInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.addRegexRule(); });

    // ===== AI 產生 =====
    this.aiToggleBtn.addEventListener('click', () => { this.aiPanel.hidden = !this.aiPanel.hidden; });
    this.aiPanelCloseBtn.addEventListener('click', () => { this.aiPanel.hidden = true; });
    this.aiSamples.addEventListener('input', () => this.validateAISamples());
    this.aiGenerateBtn.addEventListener('click', () => this.generateRegexFromAI());
    this.aiUseBtn.addEventListener('click', () => this.useAIResult());

    // ===== AI 設定 =====
    document.getElementById('aiSettingsToggle').addEventListener('click', () => this.toggleAISettings());
    document.getElementById('saveAiSettings').addEventListener('click', () => this.saveAISettings());
    this.aiApiFormat.addEventListener('change', () => this.onApiFormatChange());
  }

  // ========================================
  // Camera
  // ========================================

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

  // ========================================
  // Results / Live Detect / Accumulated
  // ========================================

  handleResults(filtered, stable) {
    this.renderLiveDetect(filtered);
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

  // ========================================
  // Test Page / Comparison
  // ========================================

  getTestBarcodeValues() {
    if (!this.generator || !this.generator.barcodes) return [];
    const seen = new Set();
    const result = [];
    for (const b of this.generator.barcodes) {
      if (!seen.has(b.value)) { seen.add(b.value); result.push(b.value); }
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
    for (const v of values) html += `<div class="barcode-plaintext-item">${this.esc(v)}</div>`;
    this.barcodePlaintextBox.innerHTML = html;
  }

  runComparison() {
    const expectedValues = this.getTestBarcodeValues();
    const scannedText = this.scannedInput.value.trim();
    if (expectedValues.length === 0 && !scannedText) { this.handleError(new Error('無條碼可比對')); return; }

    const expected = new Set(expectedValues);
    const scanned = new Set(scannedText.split('\n').map(s => s.trim()).filter(s => s.length > 0));

    const matched = [], missing = [], extra = [];
    for (const v of expected) { (scanned.has(v) ? matched : missing).push(v); }
    for (const v of scanned) { if (!expected.has(v)) extra.push(v); }

    const total = expected.size || 1;
    const rate = Math.round((matched.length / total) * 100);

    let html = `<div class="comparison-summary">
      <div class="rate">${rate}%</div>
      <div class="rate-label">辨識率 (${matched.length}/${expected.size} 匹配)</div>
    </div>`;
    if (matched.length > 0)
      html += `<div class="comparison-group"><h4 class="matched">匹配 (${matched.length})</h4><ul>${matched.map(v => `<li>${this.esc(v)}</li>`).join('')}</ul></div>`;
    if (missing.length > 0)
      html += `<div class="comparison-group"><h4 class="missing">未辨識 (${missing.length})</h4><ul>${missing.map(v => `<li>${this.esc(v)}</li>`).join('')}</ul></div>`;
    if (extra.length > 0)
      html += `<div class="comparison-group"><h4 class="extra">額外辨識 (${extra.length})</h4><ul>${extra.map(v => `<li>${this.esc(v)}</li>`).join('')}</ul></div>`;
    this.comparisonResults.innerHTML = html;
  }

  // ========================================
  // Bounding Boxes / Stats / Errors
  // ========================================

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
    d.style.cssText = `position:fixed;top:16px;right:16px;background:var(--danger,#a05050);color:white;
      padding:12px 16px;border-radius:8px;z-index:9999;max-width:80vw;white-space:pre-wrap;
      font-size:0.85rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;word-break:break-all;`;
    d.textContent = error.message;
    d.title = '點擊關閉';
    d.addEventListener('click', () => d.remove());
    document.body.appendChild(d);
  }

  // ========================================
  // Scanner Config
  // ========================================

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

  // ========================================
  // 正則規則 CRUD
  // ========================================

  loadRegexRules() {
    try {
      const saved = localStorage.getItem('barcode-regex-rules');
      this.regexRules = saved ? JSON.parse(saved) : [];
    } catch (e) { this.regexRules = []; }
    this.renderRegexRules();
  }

  saveRegexRules() {
    localStorage.setItem('barcode-regex-rules', JSON.stringify(this.regexRules));
  }

  addRegexRule() {
    const name = this.ruleNameInput.value.trim();
    const pattern = this.rulePatternInput.value.trim();
    if (!pattern) { this.handleError(new Error('請輸入正則表達式')); return; }
    try { new RegExp(pattern); } catch (e) { this.handleError(new Error('無效的正則表達式: ' + e.message)); return; }

    this.regexRules.push({ id: Date.now(), name: name || pattern, pattern, enabled: true });
    this.saveRegexRules();
    this.renderRegexRules();
    this.rebuildScannerFilters();
    this.ruleNameInput.value = '';
    this.rulePatternInput.value = '';
  }

  deleteRegexRule(id) {
    this.regexRules = this.regexRules.filter(r => r.id !== id);
    this.saveRegexRules();
    this.renderRegexRules();
    this.rebuildScannerFilters();
  }

  toggleRegexRule(id) {
    const rule = this.regexRules.find(r => r.id === id);
    if (rule) rule.enabled = !rule.enabled;
    this.saveRegexRules();
    this.renderRegexRules();
    this.rebuildScannerFilters();
  }

  startEditRule(id) {
    this.editingRuleId = id;
    this.renderRegexRules();
    // 自動 focus 正則輸入欄
    const input = this.regexRulesContainer.querySelector(`[data-id="${id}"] .rule-pattern-input`);
    if (input) input.focus();
  }

  saveEditRule(id) {
    const rule = this.regexRules.find(r => r.id === id);
    if (!rule) return;
    const row = this.regexRulesContainer.querySelector(`[data-id="${id}"]`);
    const nameVal = row.querySelector('.rule-name-input').value.trim();
    const patternVal = row.querySelector('.rule-pattern-input').value.trim();

    if (!patternVal) { this.handleError(new Error('正則表達式不能為空')); return; }
    try { new RegExp(patternVal); } catch (e) { this.handleError(new Error('無效的正則表達式')); return; }

    rule.name = nameVal || patternVal;
    rule.pattern = patternVal;
    this.editingRuleId = null;
    this.saveRegexRules();
    this.renderRegexRules();
    this.rebuildScannerFilters();
  }

  cancelEditRule() {
    this.editingRuleId = null;
    this.renderRegexRules();
  }

  renderRegexRules() {
    if (this.regexRules.length === 0) {
      this.regexRulesContainer.innerHTML = '<div class="regex-rules-empty">尚無過濾規則</div>';
      return;
    }

    let html = '';
    for (const rule of this.regexRules) {
      const ck = rule.enabled ? 'checked' : '';
      const cls = rule.enabled ? '' : ' disabled';

      if (this.editingRuleId === rule.id) {
        html += `<div class="regex-rule editing" data-id="${rule.id}">
          <input type="checkbox" ${ck} class="rule-toggle">
          <input type="text" class="rule-name-input" value="${this.escAttr(rule.name)}">
          <input type="text" class="rule-pattern-input" value="${this.escAttr(rule.pattern)}">
          <button class="btn-icon rule-save" title="儲存">&#10003;</button>
          <button class="btn-icon rule-cancel" title="取消">&#10005;</button>
        </div>`;
      } else {
        html += `<div class="regex-rule${cls}" data-id="${rule.id}">
          <input type="checkbox" ${ck} class="rule-toggle">
          <span class="rule-name">${this.esc(rule.name)}</span>
          <code class="rule-pattern">${this.esc(rule.pattern)}</code>
          <button class="btn-icon rule-edit" title="編輯">&#9998;</button>
          <button class="btn-icon rule-delete" title="刪除">&#10005;</button>
        </div>`;
      }
    }
    this.regexRulesContainer.innerHTML = html;

    // 綁定事件（事件委派到每一行）
    this.regexRulesContainer.querySelectorAll('.regex-rule').forEach(row => {
      const id = parseInt(row.dataset.id);
      const toggle = row.querySelector('.rule-toggle');
      if (toggle) toggle.addEventListener('change', () => this.toggleRegexRule(id));

      const editBtn = row.querySelector('.rule-edit');
      if (editBtn) editBtn.addEventListener('click', () => this.startEditRule(id));

      const deleteBtn = row.querySelector('.rule-delete');
      if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteRegexRule(id));

      const saveBtn = row.querySelector('.rule-save');
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveEditRule(id));

      const cancelBtn = row.querySelector('.rule-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelEditRule());

      // Enter 鍵儲存
      const patternInput = row.querySelector('.rule-pattern-input');
      if (patternInput) {
        patternInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.saveEditRule(id); });
        patternInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.cancelEditRule(); });
      }
    });
  }

  /** 重建掃描器自訂過濾（OR 邏輯：符合任一啟用規則即保留） */
  rebuildScannerFilters() {
    if (!this.scanner) return;
    this.scanner.filter.clearCustomFilters();

    const enabled = this.regexRules.filter(r => r.enabled);
    if (enabled.length === 0) return; // 無規則 → 全部通過

    const regexes = [];
    for (const r of enabled) {
      try { regexes.push(new RegExp(r.pattern)); } catch (e) { /* skip invalid */ }
    }
    if (regexes.length === 0) return;

    // 單一 filter function，內部做 OR
    this.scanner.filter.addCustomFilter(b => regexes.some(rx => rx.test(b.rawValue)));
  }

  // ========================================
  // AI 正則產生
  // ========================================

  validateAISamples() {
    const lines = this.aiSamples.value.trim().split('\n').filter(l => l.trim());
    this.aiGenerateBtn.disabled = lines.length < 3;
  }

  async generateRegexFromAI() {
    const lines = this.aiSamples.value.trim().split('\n').map(l => l.trim()).filter(l => l).slice(0, 10);
    if (lines.length < 3) { this.handleError(new Error('至少需要 3 個範例字串')); return; }

    const settings = this.getAISettings();
    if (!settings.url) { this.handleError(new Error('請先在「AI 設定」填入 API 路徑')); return; }
    if (!settings.model) { this.handleError(new Error('請先在「AI 設定」填入模型名稱')); return; }
    if (!settings.token && settings.format !== 'ollama-local') { this.handleError(new Error('請先在「AI 設定」填入 API Token')); return; }

    const messages = [
      { role: 'system', content: 'You are a regex generator. Reply with ONLY the regex pattern. No explanation, no markdown, no code fences, no slashes. One line only.' },
      { role: 'user', content: lines.join('\n') }
    ];

    this.aiGenerateBtn.disabled = true;
    this.aiStatus.textContent = '產生中...';
    this.aiResult.hidden = true;

    try {
      const result = await this.callAI(messages, settings);
      // 清理 AI 回傳：取第一行、移除 code block / 引號 / /.../ 包裝
      let pattern = result.trim().split('\n')[0].trim()
        .replace(/^```[^\n]*/, '').replace(/```$/, '')
        .replace(/^`|`$/g, '')
        .replace(/^["']|["']$/g, '')
        .replace(/^\/(.+)\/[gimsuvy]*$/, '$1')
        .trim();

      try { new RegExp(pattern); } catch (e) {
        throw new Error('AI 回傳的正則式無效: ' + pattern);
      }

      this.aiResultPattern.value = pattern;
      this.aiResult.hidden = false;
      this.aiStatus.textContent = '';
    } catch (e) {
      this.aiStatus.textContent = '';
      this.handleError(new Error('AI 產生失敗: ' + e.message));
    } finally {
      this.validateAISamples();
    }
  }

  useAIResult() {
    const pattern = this.aiResultPattern.value;
    if (!pattern) return;
    this.rulePatternInput.value = pattern;
    this.aiPanel.hidden = true;
    this.ruleNameInput.focus();
  }

  async callAI(messages, settings) {
    const { format, url, token, model } = settings;
    let headers = { 'Content-Type': 'application/json' };
    let body;

    if (format === 'anthropic') {
      // Anthropic 不支援 system role in messages，需拆出
      const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
      const msgs = messages.filter(m => m.role !== 'system');
      headers['x-api-key'] = token;
      headers['anthropic-version'] = '2023-06-01';
      body = JSON.stringify({
        model, max_tokens: 200, system,
        messages: msgs
      });
    } else if (format === 'ollama-local') {
      body = JSON.stringify({
        model, stream: false,
        messages
      });
    } else {
      // openai 相容
      if (token) headers['Authorization'] = 'Bearer ' + token;
      body = JSON.stringify({
        model, max_tokens: 200,
        messages
      });
    }

    let resp;
    try {
      resp = await fetch(url, { method: 'POST', headers, body });
    } catch (e) {
      throw new Error('無法連線，請確認 API 路徑正確且服務正在運行');
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`API ${resp.status}: ${text.substring(0, 200)}`);
    }

    const text = await resp.text();
    console.log('[callAI] raw response length:', text.length);
    console.log('[callAI] raw response (first 1000):', text.substring(0, 1000));

    if (format === 'ollama-local') {
      const result = parseOllamaNDJSON(text);
      console.log('[callAI] parsed result:', JSON.stringify(result));
      if (!result && text.length > 0) {
        throw new Error('NDJSON 解析結果為空\n\nRaw (前 500 字):\n' + text.substring(0, 500));
      }
      return result;
    }

    const data = JSON.parse(text);
    if (format === 'anthropic') return data.content?.[0]?.text || '';
    return data.choices?.[0]?.message?.content || '';
  }

  // ========================================
  // AI 設定
  // ========================================

  loadAISettings() {
    try {
      const saved = localStorage.getItem('barcode-ai-settings');
      if (saved) {
        const s = JSON.parse(saved);
        this.aiApiFormat.value = s.format || 'ollama-local';
        this.aiApiUrl.value = s.url || '';
        this.aiApiToken.value = s.token || '';
        this.aiModel.value = s.model || '';
      }
    } catch (e) {}
    this.onApiFormatChange();
  }

  getAISettings() {
    return {
      format: this.aiApiFormat.value,
      url: this.aiApiUrl.value.trim(),
      token: this.aiApiToken.value.trim(),
      model: this.aiModel.value.trim()
    };
  }

  saveAISettings() {
    localStorage.setItem('barcode-ai-settings', JSON.stringify(this.getAISettings()));
    this.showToast('AI 設定已儲存');
  }

  onApiFormatChange() {
    const fmt = this.aiApiFormat.value;
    const defaults = {
      'ollama-local': 'http://localhost:11434/api/chat',
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages'
    };
    const current = this.aiApiUrl.value.trim();
    const isDefault = !current || Object.values(defaults).includes(current);
    if (isDefault) this.aiApiUrl.value = defaults[fmt] || '';

    // 動態 placeholder 與提示
    const tokenHints = {
      'ollama-local': { placeholder: '免填（本地不需驗證）', hint: '請先啟動本地 Ollama 並拉取模型' },
      openai: { placeholder: 'API Key（必填）', hint: '' },
      anthropic: { placeholder: 'API Key（必填）', hint: '' }
    };
    const h = tokenHints[fmt] || tokenHints.openai;
    this.aiApiToken.placeholder = h.placeholder;
    const tokenHintEl = document.getElementById('tokenHint');
    if (tokenHintEl) tokenHintEl.textContent = h.hint;

    // CORS 警告
    if (this.corsWarning) {
      if (fmt === 'anthropic') {
        this.corsWarning.textContent = '瀏覽器直連 Anthropic 會被 CORS 阻擋，建議使用本地 Ollama 或 OpenAI 相容 API';
        this.corsWarning.hidden = false;
      } else {
        this.corsWarning.hidden = true;
      }
    }
  }

  toggleAISettings() {
    const content = document.getElementById('aiSettingsContent');
    const arrow = document.querySelector('#aiSettingsToggle .collapse-arrow');
    content.hidden = !content.hidden;
    arrow.innerHTML = content.hidden ? '&#9654;' : '&#9660;';
  }

  // ========================================
  // Utils
  // ========================================

  esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  escAttr(str) { return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  const app = new BarcodeScannerApp();
  app.initialize().catch(e => console.error('[App] 啟動失敗:', e));
});

if (typeof window !== 'undefined') window.BarcodeScannerApp = BarcodeScannerApp;
