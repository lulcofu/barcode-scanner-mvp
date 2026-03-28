# 多條碼掃描器 MVP

🔬 一個支援多種條碼類型、多尺度掃描的前端條碼辨識工具。

## 功能特色

### 核心功能

- **多條碼同時辨識** — 一次掃描多個條碼
- **金字塔多尺度掃描** — 處理不同大小的條碼
- **ROI 區域定位** — 精準定位條碼區域
- **多幀累積** — 提升辨識準確率
- **即時過濾** — 格式驗證、業務規則過濾

### 支援條碼類型

| 類型 | 說明 |
|------|------|
| EAN-13 | 國際商品條碼 |
| EAN-8 | 小型商品條碼 |
| Code-128 | 物流/序號條碼 |
| Code-39 | 工業標準條碼 |
| QR Code | 二維條碼 |
| Data Matrix | 工業二維碼 |
| PDF-417 | 大容量二維碼 |
| ITF | 包裝箱條碼 |

## 使用方式

### 1. 開啟相機掃描

```javascript
const scanner = new BarcodeScannerCore({
  scanMode: 'pyramid',        // 'single' | 'pyramid' | 'roi'
  minConfidence: 3,           // 最小信心度
  pyramidScales: [1.0, 0.6, 0.35],
  allowedFormats: ['ean_13', 'code_128', 'qr_code']
});

await scanner.initialize(videoElement);
await scanner.startScanning();

scanner.onResults = (filtered, stable) => {
  console.log('過濾結果:', filtered);
  console.log('穩定結果:', stable);
};
```

### 2. 上傳圖片掃描

```javascript
const imageElement = new Image();
imageElement.src = 'path/to/image.png';
await imageElement.decode();

const results = await scanner.scanImage(imageElement);
```

### 3. 資料過濾

```javascript
const filter = new BarcodeDataFilter({
  allowedFormats: ['ean_13', 'code_128'],
  validateEAN: true,
  validateCode128: true
});

// 新增自訂過濾規則
filter.addCustomFilter((barcode) => {
  return barcode.rawValue.startsWith('PROD-');
});

const results = filter.process(barcodes, accumulator);
```

## 掃描模式比較

| 模式 | 速度 | 準確率 | 小條碼 | 多條碼 | 適用場景 |
|------|------|--------|--------|--------|---------|
| **單次全圖** | 快 | 低 | ❌ | ⚠️ | 簡單場景 |
| **金字塔掃描** | 中 | 高 | ✅ | ✅ | 通用（推薦） |
| **ROI 定位** | 中 | 高 | ✅ | ✅ | 精確場景 |

## 測試頁面

專案包含測試頁面，可產生各種類型、大小、角度的測試條碼：

- 不同大小的條碼
- 旋轉角度的條碼
- 1D 和 2D 條碼混合
- 隨機產生測試資料

## 技術架構

```
┌─────────────────────────────────────────────────────────────┐
│                     應用層 (app.js)                          │
│  • UI 控制                                                   │
│  • 事件處理                                                  │
│  • 結果渲染                                                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   掃描核心 (barcode-scanner.js)              │
│  • BarcodeScannerCore — 主控制器                            │
│  • MultiFrameAccumulator — 多幀累積器                        │
│  • BarcodeDataFilter — 資料過濾器                           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     解碼引擎                                 │
│  • ZXing-js (BrowserMultiFormatReader)                      │
│  • Barcode Detector API (原生)                              │
└─────────────────────────────────────────────────────────────┘
```

## 檔案結構

```
barcode-scanner-mvp/
├── index.html           # 主頁面
├── css/
│   └── style.css        # 樣式
├── js/
│   ├── barcode-scanner.js    # 核心掃描邏輯
│   ├── test-barcode-generator.js  # 測試條碼產生器
│   └── app.js           # 應用程式
├── README.md            # 說明文件
└── .gitignore           # Git 忽略檔案
```

## 適用場景

### 倉儲盤點
- 快速掃描多個商品
- 混合 1D/2D 條碼
- EAN-13 檢查碼驗證

### 生產線檢驗
- 高精度條碼辨識
- 小型條碼支援
- 序號格式驗證

### 零售價格查詢
- 商品條碼優先
- 過濾非商品條碼
- QR 行銷碼辨識

## 瀏覽器支援

| 瀏覽器 | 版本 | 支援度 |
|--------|------|--------|
| Chrome | 88+ | ✅ 完整支援 |
| Firefox | 75+ | ✅ 完整支援 |
| Safari | 14+ | ⚠️ 需要 HTTPS |
| Edge | 88+ | ✅ 完整支援 |

## 效能優化

- **金字塔掃描** — 只掃描需要的尺度
- **Web Worker** — 可選的背景解碼
- **快取機制** — 避免重複解碼
- **ROI 動態定位** — 減少掃描區域

## 授權

MIT License

---

_建立日期：2026-03-28_
_作者：Mantle 🔬_