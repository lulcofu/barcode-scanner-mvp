/**
 * 多條碼掃描器核心類別
 * 支援金字塔多尺度掃描、ROI 定位、多幀累積
 */

class BarcodeScannerCore {
  constructor(config = {}) {
    this.config = {
      // 影像設定
      targetResolution: config.targetResolution || 1280,
      scanInterval: config.scanInterval || 150,
      
      // 金字塔掃描
      pyramidScales: config.pyramidScales || [1.0, 0.6, 0.35],
      
      // 多幀累積
      minConfidence: config.minConfidence || 3,
      maxAge: config.maxAge || 10000,
      
      // 辨識增強
      enableRotation: config.enableRotation || false,
      enableEnhancement: config.enableEnhancement || false,
      rotationAngles: config.rotationAngles || [-10, -5, 5, 10],

      // 條碼類型白名單
      allowedFormats: config.allowedFormats || [
        'ean_13', 'ean_8', 'code_128', 'code_39',
        'qr_code', 'data_matrix', 'pdf_417', 'itf'
      ],

      // 驗證設定
      validateEAN: config.validateEAN !== false,
      validateCode128: config.validateCode128 !== false,
      filterDuplicates: config.filterDuplicates !== false,
      
      ...config
    };
    
    // 累積器
    this.accumulator = new MultiFrameAccumulator({
      minConfidence: this.config.minConfidence,
      maxAge: this.config.maxAge
    });
    
    // 過濾器
    this.filter = new BarcodeDataFilter(this.config);
    
    // 狀態
    this.isScanning = false;
    this.videoElement = null;
    this.codeReader = null;
    this.lastScanTime = 0;
    this.frameCount = 0;
    
    // 效能統計
    this.stats = {
      fps: 0,
      frameCount: 0,
      uniqueBarcodes: 0,
      avgConfidence: 0,
      lastFpsTime: Date.now(),
      framesSinceLastFps: 0
    };
    
    // 回調
    this.onResults = null;
    this.onStats = null;
    this.onError = null;
  }
  
  /**
   * 初始化掃描器
   * @param {HTMLVideoElement} videoElement - 視訊元素
   */
  async initialize(videoElement) {
    this.videoElement = videoElement;
    
    // 初始化 ZXing（不在 ZXing 層限制格式，由 BarcodeDataFilter 過濾）
    try {
      this.codeReader = new ZXing.BrowserMultiFormatReader();
      console.log('[Scanner] ZXing-js 初始化成功');
    } catch (e) {
      console.error('[Scanner] ZXing-js 初始化失敗:', e);
      throw e;
    }
    
    // 檢查原生 Barcode Detector API
    if ('BarcodeDetector' in window) {
      try {
        const supportedFormats = await BarcodeDetector.getSupportedFormats();
        console.log('[Scanner] 原生 BarcodeDetector 支援格式:', supportedFormats);
        this.nativeFormats = supportedFormats;
      } catch (e) {
        console.warn('[Scanner] BarcodeDetector API 不可用:', e);
      }
    }
    
    console.log('[Scanner] 初始化完成');
    console.log('[Scanner] 金字塔尺度:', this.config.pyramidScales);
    console.log('[Scanner] 最小信心度:', this.config.minConfidence);
  }
  
  /**
   * 開始掃描
   */
  async startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.frameCount = 0;
    this.accumulator.clear();
    
    console.log('[Scanner] 開始掃描');
    
    // 啟動掃描迴圈
    this.scanLoop();
  }
  
  /**
   * 停止掃描
   */
  stopScanning() {
    this.isScanning = false;
    console.log('[Scanner] 停止掃描');
  }
  
  /**
   * 清除結果
   */
  clearResults() {
    this.accumulator.clear();
    this.frameCount = 0;
    
    if (this.onResults) {
      this.onResults([], []);
    }
    
    console.log('[Scanner] 結果已清除');
  }
  
  /**
   * 掃描迴圈
   */
  async scanLoop() {
    if (!this.isScanning || !this.videoElement) return;
    
    const now = Date.now();
    const elapsed = now - this.lastScanTime;
    
    if (elapsed >= this.config.scanInterval) {
      this.lastScanTime = now;
      await this.scanFrame();
    }
    
    // 更新 FPS
    this.stats.framesSinceLastFps++;
    if (now - this.stats.lastFpsTime >= 1000) {
      this.stats.fps = this.stats.framesSinceLastFps;
      this.stats.framesSinceLastFps = 0;
      this.stats.lastFpsTime = now;
      
      if (this.onStats) {
        this.onStats(this.stats);
      }
    }
    
    requestAnimationFrame(() => this.scanLoop());
  }
  
  /**
   * 掃描單幀
   */
  async scanFrame() {
    if (!this.videoElement || this.videoElement.readyState < 2) return;
    
    this.frameCount++;
    this.stats.frameCount = this.frameCount;
    
    try {
      // 建立畫布
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');

      // 設定解析度
      const scale = Math.min(1, this.config.targetResolution / Math.max(
        this.videoElement.videoWidth,
        this.videoElement.videoHeight
      ));

      canvas.width = this.videoElement.videoWidth * scale;
      canvas.height = this.videoElement.videoHeight * scale;

      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

      // 影像增強（僅處理一次基底畫布）
      if (this.config.enableEnhancement) {
        canvas = this.enhanceImage(canvas);
        ctx = canvas.getContext('2d');
      }

      // 根據掃描模式選擇方法
      let results = [];
      
      switch (this.config.scanMode) {
        case 'pyramid':
          results = await this.pyramidScan(canvas, ctx);
          break;
        case 'roi':
          results = await this.roiScan(canvas, ctx);
          break;
        case 'single':
        default:
          results = await this.singleScan(canvas, ctx);
          break;
      }
      
      // 加入累積器
      this.accumulator.addFrameResults(results);
      
      // 取得穩定結果
      const stableResults = this.accumulator.getStableResults();
      
      // 過濾結果
      const filteredResults = this.filter.process(results, this.accumulator);
      
      // 更新統計
      this.stats.uniqueBarcodes = this.accumulator.getAllResults().length;
      
      const avgConf = stableResults.length > 0
        ? stableResults.reduce((sum, r) => sum + r.confidence, 0) / stableResults.length
        : 0;
      this.stats.avgConfidence = Math.round(avgConf * 10) / 10;
      
      // 回調
      if (this.onResults) {
        this.onResults(filteredResults, stableResults);
      }
      
    } catch (e) {
      console.error('[Scanner] 掃描錯誤:', e);
      if (this.onError) {
        this.onError(e);
      }
    }
  }
  
  /**
   * 單次全圖掃描
   */
  async singleScan(canvas, ctx) {
    return await this.detectBarcodes(canvas);
  }
  
  /**
   * 金字塔多尺度掃描
   */
  async pyramidScan(canvas, ctx) {
    const allResults = [];
    
    for (const scale of this.config.pyramidScales) {
      try {
        // 縮放影像
        const scaledCanvas = document.createElement('canvas');
        const scaledCtx = scaledCanvas.getContext('2d');
        
        scaledCanvas.width = canvas.width * scale;
        scaledCanvas.height = canvas.height * scale;
        
        scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        
        // 偵測條碼
        const results = await this.detectBarcodes(scaledCanvas);
        
        // 座標映射回原始尺寸
        for (const result of results) {
          const mapped = {
            ...result,
            boundingBox: result.boundingBox ? this.scaleBoundingBox(result.boundingBox, 1 / scale) : null,
            detectedAtScale: scale
          };
          allResults.push(mapped);
        }
        
      } catch (e) {
        console.warn(`[Scanner] 金字塔尺度 ${scale} 掃描失敗:`, e);
      }
    }
    
    // 去重
    return this.deduplicateResults(allResults);
  }
  
  /**
   * ROI 區域掃描（進階版：先找出可能區域）
   */
  async roiScan(canvas, ctx) {
    // 簡化版：分割成多個區域
    const allResults = [];
    const gridSize = 3;
    const cellWidth = canvas.width / gridSize;
    const cellHeight = canvas.height / gridSize;
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        try {
          // 建立區域畫布
          const roiCanvas = document.createElement('canvas');
          const roiCtx = roiCanvas.getContext('2d');
          
          roiCanvas.width = cellWidth;
          roiCanvas.height = cellHeight;
          
          // 裁切區域
          roiCtx.drawImage(
            canvas,
            col * cellWidth, row * cellHeight,
            cellWidth, cellHeight,
            0, 0,
            cellWidth, cellHeight
          );
          
          // 偵測
          const results = await this.detectBarcodes(roiCanvas);
          
          // 座標映射
          for (const result of results) {
            const mapped = {
              ...result,
              boundingBox: result.boundingBox ? {
                x: result.boundingBox.x + col * cellWidth,
                y: result.boundingBox.y + row * cellHeight,
                width: result.boundingBox.width,
                height: result.boundingBox.height
              } : null
            };
            allResults.push(mapped);
          }
          
        } catch (e) {
          // 忽略單一區域錯誤
        }
      }
    }
    
    // 加上全圖掃描
    const fullResults = await this.detectBarcodes(canvas);
    allResults.push(...fullResults);
    
    return this.deduplicateResults(allResults);
  }
  
  /**
   * 使用 ZXing 偵測條碼（支援多角度旋轉）
   */
  async detectBarcodes(canvas) {
    try {
      const results = [];

      // 原始方向解碼
      const baseResult = this.tryZXingDecode(canvas);
      if (baseResult) results.push(baseResult);

      // 多角度旋轉掃描
      if (this.config.enableRotation) {
        for (const angle of this.config.rotationAngles) {
          const rotated = this.rotateCanvas(canvas, angle);
          const result = this.tryZXingDecode(rotated);
          if (result) {
            result.boundingBox = null; // 旋轉後 bbox 無意義
            result.detectedAtAngle = angle;
            // 避免與已有結果重複
            const exists = results.some(r =>
              r.format === result.format && r.rawValue === result.rawValue
            );
            if (!exists) results.push(result);
          }
        }
      }

      // 嘗試使用原生 API（如果支援）
      if ('BarcodeDetector' in window && this.nativeFormats) {
        try {
          const detector = new BarcodeDetector({ formats: this.config.allowedFormats });
          const nativeResults = await detector.detect(canvas);

          for (const result of nativeResults) {
            const converted = {
              format: this.normalizeFormat(result.format),
              rawValue: result.rawValue,
              boundingBox: result.boundingBox,
              confidence: 1,
              source: 'native'
            };

            const exists = results.some(r =>
              r.format === converted.format && r.rawValue === converted.rawValue
            );

            if (!exists) {
              results.push(converted);
            }
          }
        } catch (e) {
          // 忽略原生 API 錯誤
        }
      }

      return results;

    } catch (e) {
      console.warn('[Scanner] 偵測錯誤:', e);
      return [];
    }
  }

  /**
   * 嘗試 ZXing 解碼（單次）
   */
  tryZXingDecode(canvas) {
    try {
      const decoded = this.codeReader.decodeFromCanvas(canvas);
      if (decoded) {
        return this.convertZXingResult(decoded, canvas);
      }
    } catch (e) {
      if (e.name && e.name !== 'NotFoundException' && e.type !== 'NotFoundException') {
        console.warn('[Scanner] ZXing 解碼錯誤:', e.name || e.type);
      }
    }
    return null;
  }

  /**
   * 旋轉畫布
   */
  rotateCanvas(canvas, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const w = canvas.width, h = canvas.height;
    const newW = Math.ceil(w * cos + h * sin);
    const newH = Math.ceil(w * sin + h * cos);

    const rotated = document.createElement('canvas');
    rotated.width = newW;
    rotated.height = newH;
    const ctx = rotated.getContext('2d');

    ctx.translate(newW / 2, newH / 2);
    ctx.rotate(rad);
    ctx.drawImage(canvas, -w / 2, -h / 2);

    return rotated;
  }

  /**
   * 影像增強：灰階 + 對比度提升 + 銳化
   */
  enhanceImage(canvas) {
    const w = canvas.width, h = canvas.height;
    const enhanced = document.createElement('canvas');
    enhanced.width = w;
    enhanced.height = h;
    const ctx = enhanced.getContext('2d');

    // 灰階 + 對比度（優先使用 canvas filter，GPU 加速）
    try {
      ctx.filter = 'grayscale(1) contrast(1.5)';
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
    } catch (e) {
      ctx.drawImage(canvas, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const val = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
        d[i] = d[i + 1] = d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // 銳化 3×3 kernel（僅在解析度合理時執行，避免影響效能）
    if (w * h <= 600000) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const src = new Uint8ClampedArray(imgData.data);
      const dst = imgData.data;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const val =
              -src[((y - 1) * w + x) * 4 + c]
              - src[(y * w + x - 1) * 4 + c]
              + 5 * src[idx + c]
              - src[(y * w + x + 1) * 4 + c]
              - src[((y + 1) * w + x) * 4 + c];
            dst[idx + c] = Math.max(0, Math.min(255, val));
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    return enhanced;
  }
  
  /**
   * 轉換 ZXing 結果格式
   */
  convertZXingResult(result, canvas) {
    return {
      format: this.normalizeFormat(result.getBarcodeFormat()),
      rawValue: result.getText(),
      boundingBox: this.extractBoundingBox(result, canvas),
      confidence: 1,
      source: 'zxing'
    };
  }
  
  /**
   * 正規化格式名稱（支援 ZXing 數字列舉和字串）
   */
  normalizeFormat(format) {
    // ZXing BarcodeFormat 數字列舉對應
    const numericMap = {
      0: 'aztec', 1: 'codabar', 2: 'code_39', 3: 'code_93',
      4: 'code_128', 5: 'data_matrix', 6: 'ean_8', 7: 'ean_13',
      8: 'itf', 9: 'maxicode', 10: 'pdf_417', 11: 'qr_code',
      12: 'rss_14', 13: 'rss_expanded', 14: 'upc_a', 15: 'upc_e'
    };

    if (typeof format === 'number') {
      return numericMap[format] || ('unknown_' + format);
    }

    const stringMap = {
      'EAN_13': 'ean_13', 'EAN_8': 'ean_8',
      'CODE_128': 'code_128', 'CODE_39': 'code_39',
      'QR_CODE': 'qr_code', 'DATA_MATRIX': 'data_matrix',
      'PDF_417': 'pdf_417', 'ITF': 'itf',
      'UPC_A': 'upc_a', 'UPC_E': 'upc_e',
      'CODE_93': 'code_93', 'CODABAR': 'codabar',
      'MAXICODE': 'maxicode', 'RSS_14': 'rss_14',
      'RSS_EXPANDED': 'rss_expanded'
    };

    const str = String(format).toUpperCase();
    return stringMap[str] || str.toLowerCase();
  }
  
  /**
   * 提取邊界框
   */
  extractBoundingBox(result, canvas) {
    try {
      const points = result.getResultPoints();
      if (points && points.length >= 2) {
        const xs = points.map(p => (typeof p.getX === 'function') ? p.getX() : p.x);
        const ys = points.map(p => (typeof p.getY === 'function') ? p.getY() : p.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        };
      }
    } catch (e) {
      // 忽略錯誤
    }
    
    return null;
  }
  
  /**
   * 縮放邊界框
   */
  scaleBoundingBox(box, factor) {
    if (!box) return null;
    return {
      x: box.x * factor,
      y: box.y * factor,
      width: box.width * factor,
      height: box.height * factor
    };
  }
  
  /**
   * 去重結果
   */
  deduplicateResults(results) {
    const seen = new Map();
    
    for (const result of results) {
      const key = `${result.format}:${result.rawValue}`;
      
      if (!seen.has(key) || seen.get(key).confidence < result.confidence) {
        seen.set(key, result);
      }
    }
    
    return [...seen.values()];
  }
  
  /**
   * 掃描圖片檔案
   */
  async scanImage(imageElement) {
    try {
      // 建立畫布
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = imageElement.naturalWidth || imageElement.width;
      canvas.height = imageElement.naturalHeight || imageElement.height;
      
      ctx.drawImage(imageElement, 0, 0);
      
      // 金字塔掃描
      const results = await this.pyramidScan(canvas, ctx);
      
      // 加入累積器
      this.accumulator.addFrameResults(results);
      
      // 過濾結果
      return this.filter.process(results, this.accumulator);
      
    } catch (e) {
      console.error('[Scanner] 圖片掃描錯誤:', e);
      return [];
    }
  }
  
  /**
   * 更新設定
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.accumulator.config.minConfidence = this.config.minConfidence;
    this.accumulator.config.maxAge = this.config.maxAge;

    console.log('[Scanner] 設定已更新:', newConfig);
  }
}

/**
 * 多幀累積器
 */
class MultiFrameAccumulator {
  constructor(config = {}) {
    this.config = {
      minConfidence: config.minConfidence || 3,
      maxAge: config.maxAge || 10000
    };
    
    this.detectedCodes = new Map();
    this.frameCount = 0;
  }
  
  addFrameResults(results) {
    this.frameCount++;
    const now = Date.now();
    
    for (const result of results) {
      const key = `${result.format}:${result.rawValue}`;
      
      if (this.detectedCodes.has(key)) {
        const existing = this.detectedCodes.get(key);
        existing.confidence++;
        existing.lastSeen = now;
        existing.positions.push(result.boundingBox);
      } else {
        this.detectedCodes.set(key, {
          ...result,
          key,
          confidence: 1,
          firstSeen: now,
          lastSeen: now,
          positions: [result.boundingBox]
        });
      }
    }
    
    this.cleanup(now);
  }
  
  getStableResults() {
    return [...this.detectedCodes.values()]
      .filter(r => r.confidence >= this.config.minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }
  
  getAllResults() {
    return [...this.detectedCodes.values()]
      .sort((a, b) => b.confidence - a.confidence);
  }
  
  clear() {
    this.detectedCodes.clear();
    this.frameCount = 0;
  }
  
  cleanup(now) {
    for (const [key, value] of this.detectedCodes) {
      if (now - value.lastSeen > this.config.maxAge) {
        this.detectedCodes.delete(key);
      }
    }
  }
}

/**
 * 條碼資料過濾器
 */
class BarcodeDataFilter {
  constructor(config = {}) {
    this.config = {
      allowedFormats: config.allowedFormats || [
        'ean_13', 'ean_8', 'code_128', 'code_39',
        'qr_code', 'data_matrix', 'pdf_417', 'itf'
      ],
      validateEAN: config.validateEAN !== false,
      validateCode128: config.validateCode128 !== false,
      filterDuplicates: config.filterDuplicates !== false,
      priority: {
        ean_13: 1,
        code_128: 2,
        qr_code: 3,
        data_matrix: 4,
        code_39: 5,
        ean_8: 6,
        pdf_417: 7,
        itf: 8
      },
      customFilters: []
    };
  }
  
  process(barcodes, accumulator) {
    let results = [...barcodes];
    
    // 階段 1：類型過濾
    results = this.filterByType(results);
    
    // 階段 2：格式驗證
    results = this.validateFormat(results);
    
    // 階段 3：自訂過濾
    results = this.applyCustomFilters(results);
    
    // 階段 4：排序
    results = this.sortByPriority(results);
    
    // 階段 5：去重
    if (this.config.filterDuplicates) {
      results = this.deduplicate(results);
    }
    
    return results;
  }
  
  filterByType(barcodes) {
    return barcodes.filter(b => 
      this.config.allowedFormats.includes(b.format)
    );
  }
  
  validateFormat(barcodes) {
    return barcodes.filter(b => {
      // EAN-13 檢查碼驗證
      if (this.config.validateEAN && b.format === 'ean_13') {
        if (!this.validateEAN13(b.rawValue)) {
          console.warn(`[Filter] EAN-13 檢查碼錯誤: ${b.rawValue}`);
          return false;
        }
      }
      
      // EAN-8 檢查碼驗證
      if (this.config.validateEAN && b.format === 'ean_8') {
        if (!this.validateEAN8(b.rawValue)) {
          console.warn(`[Filter] EAN-8 檢查碼錯誤: ${b.rawValue}`);
          return false;
        }
      }
      
      // Code-128 最小長度
      if (this.config.validateCode128 && b.format === 'code_128') {
        if (b.rawValue.length < 4) {
          console.warn(`[Filter] Code-128 長度不足: ${b.rawValue}`);
          return false;
        }
      }
      
      return true;
    });
  }
  
  validateEAN13(code) {
    if (!/^\d{13}$/.test(code)) return false;
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return parseInt(code[12]) === checkDigit;
  }
  
  validateEAN8(code) {
    if (!/^\d{8}$/.test(code)) return false;
    
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return parseInt(code[7]) === checkDigit;
  }
  
  applyCustomFilters(barcodes) {
    return barcodes.filter(b => {
      return this.config.customFilters.every(filter => {
        try {
          return filter(b);
        } catch (e) {
          return true;
        }
      });
    });
  }
  
  addCustomFilter(filterFn) {
    this.config.customFilters.push(filterFn);
  }
  
  clearCustomFilters() {
    this.config.customFilters = [];
  }
  
  sortByPriority(barcodes) {
    return barcodes.sort((a, b) => {
      const pa = this.config.priority[a.format] || 99;
      const pb = this.config.priority[b.format] || 99;
      return pa - pb;
    });
  }
  
  deduplicate(barcodes) {
    const seen = new Set();
    return barcodes.filter(b => {
      const key = `${b.format}:${b.rawValue}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// 匯出
if (typeof window !== 'undefined') {
  window.BarcodeScannerCore = BarcodeScannerCore;
  window.MultiFrameAccumulator = MultiFrameAccumulator;
  window.BarcodeDataFilter = BarcodeDataFilter;
}