# 韓國代購網站 - 模組化專案結構

此專案根據 **Unix 哲學 17 條守則** 進行重構，採用模組化架構提升可維護性。

## 專案結構

```
sharon/
├── src/                    # 🆕 模組化原始碼
│   ├── core/               # 共用核心模組
│   │   ├── api.js          # API 呼叫封裝
│   │   ├── storage.js      # LocalStorage 封裝
│   │   ├── toast.js        # Toast 通知系統
│   │   └── utils.js        # 工具函數
│   │
│   ├── store/              # 前端購物應用
│   │   ├── modules/
│   │   │   ├── products.js      # 商品管理
│   │   │   ├── cart.js          # 購物車
│   │   │   ├── checkout.js      # 結帳流程
│   │   │   ├── modal.js         # 模態框
│   │   │   ├── product-detail.js # 商品詳情
│   │   │   └── kol-store.js     # KOL 商店模式
│   │   └── app.js          # 主入口
│   │
│   └── admin/              # 管理後台
│       └── modules/
│           ├── auth.js     # 認證
│           ├── api.js      # API 封裝
│           ├── dashboard.js # 儀表板
│           ├── orders.js   # 訂單管理
│           └── utils.js    # 工具函數
│
├── assets/                 # 🆕 資源檔案
│   ├── images/
│   │   ├── logo.png
│   │   └── icons/          # 社群媒體圖示
│   └── brands/             # 品牌圖片（標準化命名）
│       ├── vt-pdrn/
│       ├── cle-de-peau/
│       └── ...
│
├── config/                 # 🆕 設定檔
│   ├── layout.json
│   └── layout_LUMI.json
│
├── docs/                   # 🆕 說明文件
│   └── README.md
│
├── _legacy/                # 🆕 舊版檔案歸檔區
│
└── [原有檔案]              # 保持不動，待測試完成後歸檔
```

## 模組載入順序

### 前端購物應用

```html
<!-- 1. 核心模組 -->
<script src="src/core/api.js"></script>
<script src="src/core/storage.js"></script>
<script src="src/core/toast.js"></script>
<script src="src/core/utils.js"></script>

<!-- 2. 功能模組 -->
<script src="src/store/modules/products.js"></script>
<script src="src/store/modules/cart.js"></script>
<script src="src/store/modules/modal.js"></script>
<script src="src/store/modules/product-detail.js"></script>
<script src="src/store/modules/checkout.js"></script>
<script src="src/store/modules/kol-store.js"></script>

<!-- 3. 主入口 -->
<script src="src/store/app.js"></script>
```

### 管理後台

```html
<!-- 1. 核心模組 -->
<script src="src/admin/modules/utils.js"></script>
<script src="src/admin/modules/auth.js"></script>
<script src="src/admin/modules/api.js"></script>

<!-- 2. 功能模組 -->
<script src="src/admin/modules/dashboard.js"></script>
<script src="src/admin/modules/orders.js"></script>

<!-- 3. 主入口 (如有) -->
<script src="src/admin/admin.js"></script>
```

## Unix 哲學守則對應

| 守則 | 實踐方式 |
|------|----------|
| #1 模組化 | 拆分大型 JS 檔案為小型專注模組 |
| #2 清晰性 | 統一命名規則，加入詳細註解 |
| #3 組合性 | 模組間透過標準介面組合 |
| #4 分離性 | UI 邏輯與業務邏輯分離 |
| #5 簡單性 | 每個模組只做一件事 |
| #7 透明性 | 完整的 console.log 追蹤 |
| #10 最小驚訝 | 保持相容舊版函數名稱 |
| #12 修復規則 | 統一錯誤處理，提早失敗 |
| #17 擴展性 | 預留 KOL 商店、多語言等擴展點 |

## 品牌資料夾對照表

| 原名稱 | 新名稱 (assets/brands/) |
|--------|-------------------------|
| VT PDRN | vt-pdrn |
| VT PDRN FACE | vt-pdrn-face |
| CLE DE PEAU BEAUTE | cle-de-peau |
| matin kim | matin-kim |
| hetrasMango | hetras-mango |
| monclosplumping | monclos-plumping |
| olOngredients | olongredients |

## 相容性

所有模組都掛載到 `window` 物件，並保留舊版函數名稱以確保相容性：

```javascript
// 新版
Cart.add(product, 1, {});

// 相容舊版
addToCart(product, 1, {});
```
