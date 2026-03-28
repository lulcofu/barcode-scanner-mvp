/**
 * 主要應用程式
 * 整合條碼掃描器和測試條碼產生器
 */

class BarcodeScannerApp {
  constructor() {
    // 元素
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
    this.testBarcodesContainer = document.getElementById('testBarcodes');
    this.generateTestBtn = document.getElementById('generateTestBtn');
    this.printTestBtn = document.getElementById('printTestBtn');
    
    // 控制項
    this.scanModeSelect = document.getElementById('scanMode');
    this.minConfidenceInput = document.getElementById('minConfidence');
    this.confidenceValue = document.getElementById('confidenceValue');
    this.pyramidScalesInput = document.getElementById('pyramidScales');
    this.formatCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
    this.validateEANCheckbox = document.getElementById('validateEAN');
    this.validateCode128Checkbox = document.getElementById('validateCode128');
    this.filterDuplicatesCheckbox = document.getElementById('filterDuplicates');
    this.contentFilterInput = document.getElementById('contentFilter');
    this.addFilterBtn = document.getElementById('addFilterBtn');
    this.activeFilters = document.getElementById('activeFilters');
    
    // 統計元素
    this.fpsValue = document.getElementById('fpsValue');
    this.frameCountElem = document.getElementById('frameCount');
    this.uniqueBarcodesElem = document.getElementById('uniqueBarcodes');
    this.avgConfidenceElem = document.getElementById('avgConfidence');
    
    // 掃描器和產生器
    this.scanner = null;
    this.generator = null;
    
    // 自訂過濾器
    this.customFilters = [];
    
    // 畫布上下文（用於繪製框框）
    this.overlayCtx = null;
    
    // 視訊串流
    this.stream = null;
    
    // 結果快取
    this.lastResults = [];
    this.lastStableResults = [];
  }
  
  /**
   * 初始化應用程式
   */
  async initialize() {
    console.log('[App] 初始化應用程式');
    
    // 檢查 HTTPS 需求
    this.checkHttpsRequirement();
    
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
    
    // 設定事件監聽器
    this.setupEventListeners();
    
    // 產生測試條碼
    await this.generator.generateAll(this.testBarcodesContainer);
    
    // 設定回調
    this.scanner.onResults = (filtered, stable) => this.handleResults(filtered, stable);
    this.scanner.onStats = (stats) => this.handleStats(stats);
    this.scanner.onError = (error) => this.handleError(error);
    
    console.log('[App] 初始化完成');
  }
  
  /**
   * 隱藏 HTTPS 警告（polyfill 已在 index.html head 中載入）
   */
  checkHttpsRequirement() {
    const warningBanner = document.getElementById('httpsWarning');
    if (warningBanner) {
      warningBanner.style.display = 'none';
    }
  }
  
  /**
   * 設定事件監聽器
   */
  setupEventListeners() {
    // 控制按鈕
    this.startBtn.addEventListener('click', () => this.startCamera());
    this.stopBtn.addEventListener('click', () => this.stopCamera());
    this.clearBtn.addEventListener('click', () => this.clearResults());
    this.uploadBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    
    // 測試條碼
    this.generateTestBtn.addEventListener('click', () => this.generator.regenerate());
    this.printTestBtn.addEventListener('click', () => this.generator.printTestPage());
    
    // 控制項變更
    this.scanModeSelect.addEventListener('change', () => this.updateConfig());
    this.minConfidenceInput.addEventListener('input', () => {
      this.confidenceValue.textContent = this.minConfidenceInput.value;
      this.updateConfig();
    });
    this.pyramidScalesInput.addEventListener('change', () => this.updateConfig());
    
    // 格式選項
    this.formatCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => this.updateConfig());
    });
    
    // 驗證選項
    this.validateEANCheckbox.addEventListener('change', () => this.updateConfig());
    this.validateCode128Checkbox.addEventListener('change', () => this.updateConfig());
    this.filterDuplicatesCheckbox.addEventListener('change', () => this.updateConfig());
    
    // 自訂過濾器
    this.addFilterBtn.addEventListener('click', () => this.addContentFilter());
    this.contentFilterInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addContentFilter();
    });
  }
  
  /**
   * 開啟相機
   */
  async startCamera() {
    try {
      this.startBtn.disabled = true;
      this.scanIndicator.classList.add('active');
      
      // 取得視訊串流（逐步降級相機參數以相容更多手機）
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

      // 設定畫布
      this.overlay.width = this.video.videoWidth || 1920;
      this.overlay.height = this.video.videoHeight || 1080;
      this.overlayCtx = this.overlay.getContext('2d');

      // 初始化掃描器
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
  
  /**
   * 停止相機
   */
  stopCamera() {
    this.scanner.stopScanning();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.video.srcObject = null;
    this.stopBtn.disabled = true;
    this.scanIndicator.classList.remove('active');
    
    // 清除畫布
    if (this.overlayCtx) {
      this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    }
    
    console.log('[App] 相機已停止');
  }
  
  /**
   * 清除結果
   */
  clearResults() {
    this.scanner.clearResults();
    this.lastResults = [];
    this.lastStableResults = [];
    this.renderResults([], []);
    
    // 清除畫布
    if (this.overlayCtx) {
      this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    }
  }
  
  /**
   * 處理檔案上傳
   */
  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const image = new Image();
      image.onload = async () => {
        const results = await this.scanner.scanImage(image);
        this.handleResults(results, results);
        
        // 重置 input
        this.fileInput.value = '';
      };
      
      image.src = URL.createObjectURL(file);
      
    } catch (e) {
      console.error('[App] 圖片處理失敗:', e);
      this.handleError(e);
    }
  }
  
  /**
   * 處理掃描結果
   */
  handleResults(filtered, stable) {
    this.lastResults = filtered;
    this.lastStableResults = stable;
    
    this.renderResults(filtered, stable);
    this.drawBoundingBoxes(stable);
  }
  
  /**
   * 渲染結果
   */
  renderResults(filtered, stable) {
    // 更新計數
    this.totalScanned.textContent = `已掃描: ${this.scanner.accumulator.getAllResults().length} 個條碼`;
    this.stableCount.textContent = `穩定結果: ${stable.length} 個`;
    
    // 清空結果區域
    this.resultsContainer.innerHTML = '';
    
    if (filtered.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="empty-state">
          <span class="icon">📭</span>
          <p>尚無掃描結果</p>
          <p class="hint">請開啟相機或上傳圖片開始掃描</p>
        </div>
      `;
      return;
    }
    
    // 渲染每個結果
    for (const barcode of stable) {
      const card = this.createResultCard(barcode);
      this.resultsContainer.appendChild(card);
    }
    
    // 顯示不穩定的結果（半透明）
    for (const barcode of filtered) {
      if (!stable.some(s => s.key === barcode.key)) {
        const card = this.createResultCard(barcode, true);
        card.style.opacity = '0.5';
        this.resultsContainer.appendChild(card);
      }
    }
  }
  
  /**
   * 建立結果卡片
   */
  createResultCard(barcode, isUnstable = false) {
    const card = document.createElement('div');
    card.className = `result-card ${barcode.format}`;
    
    // 格式標籤
    const formatBadge = document.createElement('span');
    formatBadge.className = 'format-badge';
    formatBadge.textContent = barcode.format.replace('_', '-').toUpperCase();
    
    // 值
    const valueDiv = document.createElement('div');
    valueDiv.className = 'barcode-value';
    valueDiv.textContent = barcode.rawValue;
    valueDiv.title = barcode.rawValue;
    
    // 元資料
    const meta = document.createElement('div');
    meta.className = 'meta';
    
    // 信心度
    const confidence = document.createElement('div');
    confidence.className = 'confidence';
    confidence.innerHTML = `
      <span>信心度: ${barcode.confidence}</span>
      <div class="confidence-bar">
        <div class="confidence-fill" style="width: ${Math.min(barcode.confidence * 10, 100)}%"></div>
      </div>
    `;
    
    // 來源
    const source = document.createElement('span');
    source.textContent = barcode.source || 'zxing';
    
    meta.appendChild(confidence);
    meta.appendChild(source);
    
    card.appendChild(formatBadge);
    card.appendChild(valueDiv);
    card.appendChild(meta);
    
    // 點擊複製
    card.addEventListener('click', () => {
      this.copyToClipboard(barcode.rawValue);
    });
    
    return card;
  }
  
  /**
   * 繪製邊界框
   */
  drawBoundingBoxes(barcodes) {
    if (!this.overlayCtx) return;
    
    // 清除
    this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    
    // 計算縮放比例
    const scaleX = this.overlay.width / this.video.videoWidth;
    const scaleY = this.overlay.height / this.video.videoHeight;
    
    for (const barcode of barcodes) {
      if (!barcode.boundingBox) continue;
      
      const box = barcode.boundingBox;
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;
      
      // 根據格式選擇顏色
      const color = this.getFormatColor(barcode.format);
      
      // 繪製框
      this.overlayCtx.strokeStyle = color;
      this.overlayCtx.lineWidth = 3;
      this.overlayCtx.strokeRect(x, y, w, h);
      
      // 繪製標籤
      this.overlayCtx.fillStyle = color;
      this.overlayCtx.font = 'bold 14px Arial';
      const label = barcode.format.replace('_', '-').toUpperCase();
      const textWidth = this.overlayCtx.measureText(label).width;
      this.overlayCtx.fillRect(x, y - 20, textWidth + 10, 20);
      
      this.overlayCtx.fillStyle = '#fff';
      this.overlayCtx.fillText(label, x + 5, y - 5);
    }
  }
  
  /**
   * 取得格式顏色
   */
  getFormatColor(format) {
    const colors = {
      'ean_13': '#27ae60',
      'ean_8': '#3498db',
      'code_128': '#9b59b6',
      'code_39': '#e67e22',
      'qr_code': '#1abc9c',
      'data_matrix': '#e74c3c',
      'pdf_417': '#f1c40f',
      'itf': '#95a5a6'
    };
    return colors[format] || '#3498db';
  }
  
  /**
   * 處理統計
   */
  handleStats(stats) {
    this.fpsValue.textContent = stats.fps;
    this.frameCountElem.textContent = stats.frameCount;
    this.uniqueBarcodesElem.textContent = stats.uniqueBarcodes;
    this.avgConfidenceElem.textContent = stats.avgConfidence;
  }
  
  /**
   * 根據錯誤類型產生相機錯誤訊息
   */
  getCameraErrorMessage(error) {
    const name = error.name || '';

    // 權限被拒或未授權
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      if (typeof window.isSecureContext !== 'undefined' && !window.isSecureContext) {
        return '手機瀏覽器需要 HTTPS 才能授權相機。\n\n替代方案：\n• 使用 HTTPS 網址開啟\n• 使用下方「上傳圖片」掃描條碼';
      }
      return '相機權限被拒絕。\n\n請到 Chrome 設定 → 網站設定 → 相機，允許此網站使用相機後重新整理頁面。\n\n或使用下方「上傳圖片」掃描條碼。';
    }

    // 找不到相機
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '找不到相機裝置。\n請確認裝置有相機，或使用「上傳圖片」功能。';
    }

    // 相機被佔用
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '相機正被其他應用程式使用中。\n請關閉其他使用相機的 App 後重試。';
    }

    // 不支援的參數
    if (name === 'OverconstrainedError') {
      return '相機不支援所要求的設定。';
    }

    // TypeError 通常表示 API 不存在（非安全上下文）
    if (name === 'TypeError' && !window.isSecureContext) {
      return '此瀏覽器需要 HTTPS 連線才能使用相機。\n\n替代方案：\n• 使用 HTTPS 網址開啟\n• 使用下方「上傳圖片」掃描條碼';
    }

    return error.message || '無法開啟相機';
  }

  /**
   * 處理錯誤
   */
  handleError(error) {
    console.error('[App] 錯誤:', error);
    
    // 顯示錯誤訊息
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = `錯誤: ${error.message}`;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #e74c3c;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
      max-width: 400px;
      white-space: pre-wrap;
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }
  
  /**
   * 更新設定
   */
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
  
  /**
   * 解析金字塔尺度
   */
  parsePyramidScales() {
    try {
      const value = this.pyramidScalesInput.value;
      return value.split(',').map(s => parseFloat(s.trim())).filter(s => !isNaN(s));
    } catch (e) {
      return [1.0, 0.6, 0.35];
    }
  }
  
  /**
   * 取得允許的格式
   */
  getAllowedFormats() {
    const formats = [];
    this.formatCheckboxes.forEach(cb => {
      if (cb.checked) {
        formats.push(cb.value);
      }
    });
    return formats;
  }
  
  /**
   * 新增內容過濾器
   */
  addContentFilter() {
    const value = this.contentFilterInput.value.trim();
    if (!value) return;
    
    try {
      const regex = new RegExp(value);
      
      // 新增過濾器
      this.scanner.filter.addCustomFilter((barcode) => {
        return regex.test(barcode.rawValue);
      });
      
      // 顯示標籤
      const tag = document.createElement('div');
      tag.className = 'filter-tag';
      tag.innerHTML = `
        <span>${value}</span>
        <button>×</button>
      `;
      
      tag.querySelector('button').addEventListener('click', () => {
        this.activeFilters.removeChild(tag);
        // 注意：移除過濾器需要重建所有過濾器
        this.rebuildFilters();
      });
      
      this.activeFilters.appendChild(tag);
      
      // 清空輸入
      this.contentFilterInput.value = '';
      
    } catch (e) {
      this.handleError(new Error('無效的正則表達式'));
    }
  }
  
  /**
   * 重建過濾器
   */
  rebuildFilters() {
    // 清除所有自訂過濾器
    this.scanner.filter.clearCustomFilters();
    
    // 重新新增
    this.activeFilters.querySelectorAll('.filter-tag span').forEach(span => {
      const pattern = span.textContent;
      try {
        const regex = new RegExp(pattern);
        this.scanner.filter.addCustomFilter((barcode) => regex.test(barcode.rawValue));
      } catch (e) {
        // 忽略
      }
    });
  }
  
  /**
   * 複製到剪貼簿
   */
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
  
  /**
   * 顯示 Toast
   */
  showToast(message) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #2ecc71;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
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

// 匯出
if (typeof window !== 'undefined') {
  window.BarcodeScannerApp = BarcodeScannerApp;
}