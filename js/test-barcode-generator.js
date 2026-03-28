/**
 * 測試條碼產生器
 * 使用 JsBarcode 產生各種類型的條碼
 */

class TestBarcodeGenerator {
  constructor() {
    this.container = null;
    this.barcodes = [];
    
    // 預設測試資料
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
        { value: 'CODE-128-TEST-001', name: '物流編號 A' },
        { value: 'SN-20260328-00001', name: '序號條碼' },
        { value: 'PROD-ABC-12345', name: '產品編號' }
      ],
      code_39: [
        { value: 'CODE39TEST', name: '工業條碼' },
        { value: 'ABC-123', name: '資產編號' }
      ],
      qr_code: [
        { value: 'https://example.com/product/123', name: '產品連結' },
        { value: '產品:A-001\n數量:100\n日期:2026-03-28', name: '產品資訊' },
        { value: 'WIFI:T:WPA;S:TestNetwork;P:password123;;', name: 'WiFi 設定' }
      ],
      itf: [
        { value: '123456789012', name: '包裝箱條碼' },
        { value: '0012345678905', name: '物流箱條碼' }
      ]
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
   * 初始化
   */
  async initialize() {
    try {
      await this.loadJsBarcode();
      await this.loadQRCode();
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
    
    // 產生 1D 條碼
    await this.generate1DBarcodes();
    
    // 產生 2D 條碼
    await this.generate2DBarcodes();
    
    // 產生變體（不同大小和角度）
    await this.generateVariants();
    
    return this.barcodes;
  }
  
  /**
   * 產生 1D 條碼
   */
  async generate1DBarcodes() {
    const formats1D = ['ean_13', 'ean_8', 'code_128', 'code_39', 'itf'];
    
    for (const format of formats1D) {
      const data = this.testData[format];
      if (!data) continue;
      
      for (const item of data) {
        const card = this.createBarcodeCard(format, item.value, item.name);
        this.container.appendChild(card);
        this.barcodes.push({ format, value: item.value, element: card });
      }
    }
  }
  
  /**
   * 產生 2D 條碼
   */
  async generate2DBarcodes() {
    // QR Code
    const qrData = this.testData.qr_code;
    
    for (const item of qrData) {
      const card = await this.createQRCard(item.value, item.name);
      this.container.appendChild(card);
      this.barcodes.push({ format: 'qr_code', value: item.value, element: card });
    }
  }
  
  /**
   * 產生變體（不同大小和角度）
   */
  async generateVariants() {
    // 小型變體
    const smallCard = this.createBarcodeCard('ean_13', '5901234123457', '小型條碼', { size: 'small' });
    smallCard.classList.add('small');
    this.container.appendChild(smallCard);
    this.barcodes.push({ format: 'ean_13', value: '5901234123457', element: smallCard, variant: 'small' });
    
    // 大型變體
    const largeCard = this.createBarcodeCard('code_128', 'PROD-XYZ-789012345', '大型條碼', { size: 'large' });
    largeCard.classList.add('large');
    this.container.appendChild(largeCard);
    this.barcodes.push({ format: 'code_128', value: 'PROD-XYZ-789012345', element: largeCard, variant: 'large' });
    
    // 旋轉變體（5 度）
    const rotatedCard = this.createBarcodeCard('ean_8', '96385074', '旋轉條碼', { rotate: 5 });
    rotatedCard.classList.add('rotated');
    this.container.appendChild(rotatedCard);
    this.barcodes.push({ format: 'ean_8', value: '96385074', element: rotatedCard, variant: 'rotated' });
    
    // 旋轉變體（-5 度）
    const rotatedCard2 = this.createBarcodeCard('code_39', 'TEST-123', '反向旋轉', { rotate: -8 });
    rotatedCard2.classList.add('rotated');
    rotatedCard2.style.transform = `rotate(-8deg)`;
    this.container.appendChild(rotatedCard2);
    this.barcodes.push({ format: 'code_39', value: 'TEST-123', element: rotatedCard2, variant: 'rotated' });
  }
  
  /**
   * 建立 1D 條碼卡片
   */
  createBarcodeCard(format, value, name, options = {}) {
    const card = document.createElement('div');
    card.className = 'test-barcode-card';
    if (options.size) {
      card.classList.add(options.size);
    }
    
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
        width: options.size === 'small' ? 1 : options.size === 'large' ? 3 : 2,
        height: options.size === 'small' ? 40 : options.size === 'large' ? 120 : 80,
        displayValue: true,
        fontSize: options.size === 'small' ? 10 : options.size === 'large' ? 16 : 12,
        margin: 5,
        background: '#ffffff'
      });
      
      // 旋轉
      if (options.rotate) {
        canvas.style.transform = `rotate(${options.rotate}deg)`;
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
    
    // 值
    const valueSpan = document.createElement('div');
    valueSpan.className = 'value';
    valueSpan.textContent = value.length > 15 ? value.substring(0, 15) + '...' : value;
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
   * 建立 QR Code 卡片
   */
  async createQRCard(value, name) {
    const card = document.createElement('div');
    card.className = 'test-barcode-card';
    
    // 建立 QR Code 容器
    const qrContainer = document.createElement('div');
    qrContainer.style.background = '#fff';
    qrContainer.style.padding = '10px';
    
    try {
      // 使用 QRCode.js 產生
      const qrSize = 100;
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
      qrContainer.innerHTML = '<div style="width:100px;height:100px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;">QR</div>';
    }
    
    // 格式標籤
    const formatBadge = document.createElement('span');
    formatBadge.className = 'format';
    formatBadge.textContent = 'QR CODE';
    
    // 值
    const valueSpan = document.createElement('div');
    valueSpan.className = 'value';
    valueSpan.textContent = value.length > 15 ? value.substring(0, 15) + '...' : value;
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
      // 備用方法
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
    // 移除現有 Toast
    const existing = document.querySelector('.toast-message');
    if (existing) {
      existing.remove();
    }
    
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
   * 產生隨機測試資料
   */
  generateRandomData() {
    // 隨機 EAN-13
    const randomEAN13 = () => {
      let code = '';
      for (let i = 0; i < 12; i++) {
        code += Math.floor(Math.random() * 10);
      }
      // 計算檢查碼
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
      }
      code += (10 - (sum % 10)) % 10;
      return code;
    };
    
    // 隨機 Code-128
    const randomCode128 = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
      let code = 'PROD-';
      for (let i = 0; i < 10; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    };
    
    // 隨機 QR Code
    const randomQR = () => {
      return `https://example.com/product/${Date.now()}`;
    };
    
    return {
      ean_13: randomEAN13(),
      code_128: randomCode128(),
      qr_code: randomQR()
    };
  }
  
  /**
   * 重新產生測試條碼
   */
  async regenerate() {
    if (!this.container) return;
    
    // 加入新的隨機資料
    const random = this.generateRandomData();
    
    this.testData.ean_13.push({ value: random.ean_13, name: '隨機商品' });
    this.testData.code_128.push({ value: random.code_128, name: '隨機序號' });
    
    // 限制數量
    if (this.testData.ean_13.length > 8) {
      this.testData.ean_13 = this.testData.ean_13.slice(-8);
    }
    if (this.testData.code_128.length > 6) {
      this.testData.code_128 = this.testData.code_128.slice(-6);
    }
    
    return this.generateAll(this.container);
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