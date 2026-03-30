/**
 * 測試條碼產生器
 * 使用 JsBarcode 產生各種類型的條碼
 */

class TestBarcodeGenerator {
  constructor() {
    this.container = null;
    this.barcodes = [];
    
    // 預設測試資料（所有明文 ≤ 20 字元）
    this.testData = {
      ean_13: [
        { value: '4711234567890', name: '台灣商品' },
        { value: '9780201379624', name: 'ISBN 書籍' },
        { value: '5901234123457', name: '波蘭商品' },
        { value: '4006381333931', name: '德國商品' }
      ],
      ean_8: [
        { value: '12345670', name: '小型商品 A' },
        { value: '96385074', name: '小型商品 B' }
      ],
      code_128: [
        { value: 'CODE128-TEST-001', name: '物流編號 A' },
        { value: 'SN-20260328-0001', name: '序號條碼' },
        { value: 'PROD-ABC-12345', name: '產品編號' }
      ],
      code_39: [
        { value: 'CODE39TEST', name: '工業條碼' },
        { value: 'ABC-123', name: '資產編號' }
      ],
      qr_code: [
        { value: 'QR-PROD-001', name: '產品編碼' },
        { value: 'QR-INV-A001-0328', name: '庫存資訊' },
        { value: 'QR-WIFI-TEST-01', name: 'WiFi 設定' }
      ],
      data_matrix: [
        { value: 'DM-ASSET-00001', name: '資產標籤' },
        { value: 'DM-LOT-20260331', name: '批次標籤' }
      ],
      itf: [
        { value: '123456789012', name: '包裝箱條碼' },
        { value: '0012345678905', name: '物流箱條碼' }
      ]
    };
    
    // 變體設定
    this.variants = {
      sizes: ['xs', 'sm', 'md', 'lg', 'xl'],
      rotations: [-45, -30, -15, -8, -5, 0, 5, 8, 15, 30, 45]
    };
  }
  
  /**
   * 載入 JsBarcode 函式庫
   */
  async loadJsBarcode() {
    if (window.JsBarcode) return true;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
      script.onload = () => {
        console.log('[Generator] JsBarcode 載入成功');
        resolve(true);
      };
      script.onerror = () => {
        console.error('[Generator] JsBarcode 載入失敗');
        reject(new Error('JsBarcode 載入失敗'));
      };
      document.head.appendChild(script);
    });
  }
  
  /**
   * 載入 QR Code 產生器
   */
  async loadQRCode() {
    if (window.QRCode) return true;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      script.onload = () => {
        console.log('[Generator] QRCode 載入成功');
        resolve(true);
      };
      script.onerror = () => {
        console.error('[Generator] QRCode 載入失敗');
        reject(new Error('QRCode 載入失敗'));
      };
      document.head.appendChild(script);
    });
  }
  
  /**
   * 載入 bwip-js（Data Matrix 產生器）
   */
  async loadBwipJs() {
    if (window.bwipjs) return true;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/bwip-js@3.4.6/dist/bwip-js-min.js';
      script.onload = () => {
        console.log('[Generator] bwip-js 載入成功');
        resolve(true);
      };
      script.onerror = () => {
        console.warn('[Generator] bwip-js 載入失敗，Data Matrix 將不可用');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 初始化
   */
  async initialize() {
    try {
      await this.loadJsBarcode();
      await this.loadQRCode();
      await this.loadBwipJs();
      console.log('[Generator] 初始化完成');
      return true;
    } catch (e) {
      console.error('[Generator] 初始化失敗:', e);
      return false;
    }
  }
  
  /**
   * 產生所有測試條碼
   */
  async generateAll(container) {
    this.container = container;
    container.innerHTML = '';
    this.barcodes = [];
    
    // 產生基礎條碼
    await this.generateBaseBarcodes();
    
    // 產生變體（不同大小和角度）
    await this.generateVariants();
    
    return this.barcodes;
  }
  
  /**
   * 產生基礎條碼（各格式）
   */
  async generateBaseBarcodes() {
    const formats1D = ['ean_13', 'ean_8', 'code_128', 'code_39', 'itf'];
    
    for (const format of formats1D) {
      const data = this.testData[format];
      if (!data) continue;
      
      // 每種格式取前 2 個
      for (let i = 0; i < Math.min(2, data.length); i++) {
        const item = data[i];
        const card = this.createBarcodeCard(format, item.value, item.name);
        this.container.appendChild(card);
        this.barcodes.push({ format, value: item.value, element: card });
      }
    }
    
    // QR Code
    const qrData = this.testData.qr_code;
    for (let i = 0; i < Math.min(2, qrData.length); i++) {
      const item = qrData[i];
      const card = await this.createQRCard(item.value, item.name);
      this.container.appendChild(card);
      this.barcodes.push({ format: 'qr_code', value: item.value, element: card });
    }

    // Data Matrix
    if (window.bwipjs) {
      const dmData = this.testData.data_matrix;
      for (let i = 0; i < Math.min(2, dmData.length); i++) {
        const item = dmData[i];
        const card = await this.createDataMatrixCard(item.value, item.name);
        this.container.appendChild(card);
        this.barcodes.push({ format: 'data_matrix', value: item.value, element: card });
      }
    }
  }
  
  /**
   * 產生變體（不同大小和角度）
   */
  async generateVariants() {
    const formats = ['ean_13', 'code_128', 'ean_8', 'code_39', 'itf'];
    
    // 隨機產生多種變體
    const variantConfigs = [
      // 超小型 + 各角度
      { size: 'xs', rotate: -30, format: 'ean_13' },
      { size: 'xs', rotate: 0, format: 'code_128' },
      { size: 'xs', rotate: 15, format: 'ean_8' },
      
      // 小型 + 各角度
      { size: 'sm', rotate: -15, format: 'code_39' },
      { size: 'sm', rotate: 5, format: 'ean_13' },
      { size: 'sm', rotate: -8, format: 'itf' },
      
      // 中型 + 各角度
      { size: 'md', rotate: 8, format: 'code_128' },
      { size: 'md', rotate: -5, format: 'ean_13' },
      { size: 'md', rotate: 30, format: 'ean_8' },
      
      // 大型 + 各角度
      { size: 'lg', rotate: -8, format: 'code_39' },
      { size: 'lg', rotate: 15, format: 'ean_13' },
      
      // 超大型 + 各角度
      { size: 'xl', rotate: -5, format: 'code_128' },
      { size: 'xl', rotate: 0, format: 'ean_13' },
      
      // 極端角度
      { size: 'md', rotate: 45, format: 'code_128' },
      { size: 'sm', rotate: -45, format: 'ean_8' },
    ];
    
    for (const config of variantConfigs) {
      const value = this.getRandomValue(config.format);
      const card = this.createBarcodeCard(config.format, value, `變體 ${config.size}/${config.rotate}°`, {
        size: config.size,
        rotate: config.rotate
      });
      
      card.classList.add(`size-${config.size}`);
      if (config.rotate !== 0) {
        card.classList.add('rotated');
      }
      
      this.container.appendChild(card);
      this.barcodes.push({ 
        format: config.format, 
        value: value, 
        element: card, 
        variant: `${config.size}/${config.rotate}°` 
      });
    }
    
    // QR Code 變體（不同大小，值 ≤ 20 字元）
    const qrVariants = [
      { size: 'sm', value: 'QR-SM-' + Date.now().toString(36) },
      { size: 'lg', value: 'QR-LG-' + Date.now().toString(36) },
    ];

    for (const v of qrVariants) {
      const val = v.value.substring(0, 20);
      const card = await this.createQRCard(val, `QR ${v.size}`, { size: v.size });
      card.classList.add(`size-${v.size}`);
      this.container.appendChild(card);
      this.barcodes.push({ format: 'qr_code', value: val, element: card, variant: v.size });
    }

    // Data Matrix 變體
    if (window.bwipjs) {
      const dmVariants = [
        { size: 'sm', value: this.getRandomValue('data_matrix') },
        { size: 'md', value: this.getRandomValue('data_matrix') },
      ];
      for (const v of dmVariants) {
        const card = await this.createDataMatrixCard(v.value, `DM ${v.size}`, { size: v.size });
        card.classList.add(`size-${v.size}`);
        this.container.appendChild(card);
        this.barcodes.push({ format: 'data_matrix', value: v.value, element: card, variant: v.size });
      }
    }
  }
  
  /**
   * 取得隨機值
   */
  getRandomValue(format) {
    switch (format) {
      case 'ean_13':
        return this.generateRandomEAN13();
      case 'ean_8':
        return this.generateRandomEAN8();
      case 'code_128':
        return this.generateRandomCode128();
      case 'code_39':
        return this.generateRandomCode39();
      case 'itf':
        return this.generateRandomITF();
      case 'data_matrix':
        return this.generateRandomDataMatrix();
      default:
        return this.generateRandomCode128();
    }
  }
  
  /**
   * 產生隨機 EAN-13
   */
  generateRandomEAN13() {
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += Math.floor(Math.random() * 10);
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }
    code += (10 - (sum % 10)) % 10;
    return code;
  }
  
  /**
   * 產生隨機 EAN-8
   */
  generateRandomEAN8() {
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += Math.floor(Math.random() * 10);
    }
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
    }
    code += (10 - (sum % 10)) % 10;
    return code;
  }
  
  /**
   * 產生隨機 Code-128
   */
  generateRandomCode128() {
    const prefixes = ['PROD', 'SN', 'LOT', 'BATCH', 'INV', 'ORD'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = prefix + '-';
    const maxLen = 20 - code.length;
    const len = Math.min(maxLen, 6 + Math.floor(Math.random() * 8));
    for (let i = 0; i < len; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  
  /**
   * 產生隨機 Code-39
   */
  generateRandomCode39() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.';
    let code = '';
    for (let i = 0; i < 6 + Math.floor(Math.random() * 6); i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  
  /**
   * 產生隨機 ITF
   */
  generateRandomITF() {
    let code = '';
    const length = 12 + Math.floor(Math.random() * 3) * 2; // ITF 偶數長度，max 16
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10);
    }
    return code;
  }

  /**
   * 產生隨機 Data Matrix 值（≤ 20 字元）
   */
  generateRandomDataMatrix() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'DM-';
    const len = 6 + Math.floor(Math.random() * 11); // 6-16，總長 9-19
    for (let i = 0; i < len; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  
  /**
   * 建立 1D 條碼卡片
   */
  createBarcodeCard(format, value, name, options = {}) {
    const card = document.createElement('div');
    card.className = 'test-barcode-card';
    
    // 大小設定
    const sizeConfig = {
      'xs': { width: 0.8, height: 25, fontSize: 8 },
      'sm': { width: 1.2, height: 40, fontSize: 10 },
      'md': { width: 2, height: 60, fontSize: 12 },
      'lg': { width: 2.5, height: 80, fontSize: 14 },
      'xl': { width: 3, height: 100, fontSize: 16 }
    };
    
    const size = sizeConfig[options.size] || sizeConfig['md'];
    
    // 建立畫布
    const canvas = document.createElement('canvas');
    canvas.className = 'barcode-canvas';
    
    try {
      // 使用 JsBarcode 產生條碼
      const formatMap = {
        'ean_13': 'EAN13',
        'ean_8': 'EAN8',
        'code_128': 'CODE128',
        'code_39': 'CODE39',
        'itf': 'ITF'
      };
      
      JsBarcode(canvas, value, {
        format: formatMap[format] || format,
        width: size.width,
        height: size.height,
        displayValue: true,
        fontSize: size.fontSize,
        margin: 5,
        background: '#ffffff'
      });
      
      // 旋轉
      if (options.rotate && options.rotate !== 0) {
        card.style.transform = `rotate(${options.rotate}deg)`;
        card.classList.add('rotated');
      }
      
    } catch (e) {
      console.error(`[Generator] 產生 ${format} 條碼失敗:`, e);
      canvas.width = 200;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 200, 100);
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.fillText('產生失敗', 100, 50);
    }
    
    // 格式標籤
    const formatBadge = document.createElement('span');
    formatBadge.className = 'format';
    formatBadge.textContent = format.replace('_', '-').toUpperCase();
    
    // 變體標籤
    if (options.size || options.rotate) {
      const variantBadge = document.createElement('span');
      variantBadge.className = 'variant';
      variantBadge.textContent = `${options.size || 'md'}${options.rotate ? '/' + options.rotate + '°' : ''}`;
      formatBadge.textContent += ` (${variantBadge.textContent})`;
    }
    
    // 值
    const valueSpan = document.createElement('div');
    valueSpan.className = 'value';
    valueSpan.textContent = value.length > 20 ? value.substring(0, 20) + '...' : value;
    valueSpan.title = value;
    
    card.appendChild(canvas);
    card.appendChild(formatBadge);
    card.appendChild(valueSpan);
    
    // 點擊複製
    card.addEventListener('click', () => {
      this.copyToClipboard(value);
      this.showToast(`已複製: ${value}`);
    });
    
    return card;
  }
  
  /**
   * 建立 Data Matrix 卡片（使用 bwip-js）
   */
  async createDataMatrixCard(value, name, options = {}) {
    const card = document.createElement('div');
    card.className = 'test-barcode-card';

    const sizeConfig = { 'xs': 2, 'sm': 3, 'md': 4, 'lg': 5, 'xl': 6 };
    const scale = sizeConfig[options.size] || 4;

    const canvas = document.createElement('canvas');
    canvas.className = 'barcode-canvas';

    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'datamatrix',
        text: value,
        scale: scale,
        padding: 5,
      });
    } catch (e) {
      console.error('[Generator] Data Matrix 產生失敗:', e);
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.fillText('DM Error', 50, 50);
    }

    if (options.rotate && options.rotate !== 0) {
      card.style.transform = `rotate(${options.rotate}deg)`;
      card.classList.add('rotated');
    }

    const formatBadge = document.createElement('span');
    formatBadge.className = 'format';
    formatBadge.textContent = 'DATA MATRIX';
    if (options.size) formatBadge.textContent += ` (${options.size})`;

    const valueSpan = document.createElement('div');
    valueSpan.className = 'value';
    valueSpan.textContent = value.length > 20 ? value.substring(0, 20) + '...' : value;
    valueSpan.title = value;

    card.appendChild(canvas);
    card.appendChild(formatBadge);
    card.appendChild(valueSpan);

    card.addEventListener('click', () => {
      this.copyToClipboard(value);
      this.showToast(`已複製: ${value}`);
    });

    return card;
  }

  /**
   * 建立 QR Code 卡片
   */
  async createQRCard(value, name, options = {}) {
    const card = document.createElement('div');
    card.className = 'test-barcode-card';
    
    // 大小設定
    const sizeConfig = {
      'xs': 60,
      'sm': 80,
      'md': 100,
      'lg': 130,
      'xl': 160
    };
    
    const qrSize = sizeConfig[options.size] || 100;
    
    // 建立 QR Code 容器
    const qrContainer = document.createElement('div');
    qrContainer.style.background = '#fff';
    qrContainer.style.padding = '10px';
    qrContainer.style.display = 'inline-block';
    
    try {
      // 使用 QRCode.js 產生
      new QRCode(qrContainer, {
        text: value,
        width: qrSize,
        height: qrSize,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      
    } catch (e) {
      console.error('[Generator] 產生 QR Code 失敗:', e);
      qrContainer.innerHTML = `<div style="width:${qrSize}px;height:${qrSize}px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;">QR</div>`;
    }
    
    // 格式標籤
    const formatBadge = document.createElement('span');
    formatBadge.className = 'format';
    formatBadge.textContent = 'QR CODE';
    if (options.size) {
      formatBadge.textContent += ` (${options.size})`;
    }
    
    // 值
    const valueSpan = document.createElement('div');
    valueSpan.className = 'value';
    valueSpan.textContent = value.length > 20 ? value.substring(0, 20) + '...' : value;
    valueSpan.title = value;
    
    card.appendChild(qrContainer);
    card.appendChild(formatBadge);
    card.appendChild(valueSpan);
    
    // 點擊複製
    card.addEventListener('click', () => {
      this.copyToClipboard(value);
      this.showToast(`已複製: ${value}`);
    });
    
    return card;
  }
  
  /**
   * 複製到剪貼簿
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  }
  
  /**
   * 顯示 Toast 訊息
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
      background: #333;
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
  
  /**
   * 重新產生測試條碼（完全隨機）
   */
  async regenerate() {
    if (!this.container) return;
    
    // 清空現有資料
    this.container.innerHTML = '';
    this.barcodes = [];
    
    // 產生新的隨機基礎條碼
    const baseFormats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'itf'];
    
    for (const format of baseFormats) {
      // 每種格式產生 1-2 個隨機條碼
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const value = this.getRandomValue(format);
        const card = this.createBarcodeCard(format, value, `隨機 ${format.toUpperCase()}`);
        this.container.appendChild(card);
        this.barcodes.push({ format, value, element: card });
      }
    }
    
    // 產生隨機 QR Code（值 ≤ 20 字元）
    for (let i = 0; i < 2; i++) {
      const qrValue = ('QR-' + Date.now().toString(36) + i).substring(0, 20);
      const card = await this.createQRCard(qrValue, '隨機 QR');
      this.container.appendChild(card);
      this.barcodes.push({ format: 'qr_code', value: qrValue, element: card });
    }

    // 產生隨機 Data Matrix
    if (window.bwipjs) {
      for (let i = 0; i < 2; i++) {
        const dmValue = this.getRandomValue('data_matrix');
        const card = await this.createDataMatrixCard(dmValue, '隨機 DM');
        this.container.appendChild(card);
        this.barcodes.push({ format: 'data_matrix', value: dmValue, element: card });
      }
    }

    // 產生隨機變體
    await this.generateVariants();
    
    return this.barcodes;
  }
  
  /**
   * 列印測試頁
   */
  printTestPage() {
    window.print();
  }
}

// 匯出
if (typeof window !== 'undefined') {
  window.TestBarcodeGenerator = TestBarcodeGenerator;
}