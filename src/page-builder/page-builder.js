/**
 * Modular Page Builder Admin Logic (Visual Version) v2.0
 * - GitHub Direct Write
 * - Footer Editing
 * - Anti-Flash (Debounced Input)
 * - Component Spacing Controls
 */
// 產品選擇彈窗元件
const ProductSelectorModal = {
    callback: null,
    selectedIds: [],

    init: function () {
        if (document.getElementById('product-selector-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'product-selector-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:none; align-items:center; justify-content:center;';

        modal.innerHTML = `
            <div style="background:white; width:90%; max-width:600px; max-height:80vh; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                <div style="padding:15px 20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:18px;">選擇商品</h3>
                    <button id="psm-close" style="background:none; border:none; font-size:20px; cursor:pointer;">&times;</button>
                </div>
                <div style="padding:15px; border-bottom:1px solid #eee;">
                    <input type="text" id="psm-search" placeholder="搜尋商品名稱..." style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; font-size:14px;">
                </div>
                <div id="psm-list" style="flex:1; overflow-y:auto; padding:0;">
                    <!-- 商品列表 -->
                </div>
                <div style="padding:15px 20px; border-top:1px solid #eee; text-align:right; background:#fafafa; border-radius:0 0 12px 12px;">
                    <button id="psm-cancel" style="padding:8px 20px; border:1px solid #ddd; background:white; border-radius:6px; margin-right:10px; cursor:pointer;">取消</button>
                    <button id="psm-confirm" style="padding:8px 20px; border:none; background:#333; color:white; border-radius:6px; cursor:pointer;">確認選擇</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('psm-close').onclick = () => this.close();
        document.getElementById('psm-cancel').onclick = () => this.close();
        document.getElementById('psm-confirm').onclick = () => this.confirm();

        document.getElementById('psm-search').addEventListener('input', (e) => this.renderList(e.target.value));
    },

    open: function (currentIds, callback) {
        this.init();
        this.selectedIds = [...(currentIds || [])]; // 複製一份
        this.callback = callback;

        const modal = document.getElementById('product-selector-modal');
        modal.style.display = 'flex';
        document.getElementById('psm-search').value = '';
        this.renderList();
    },

    close: function () {
        document.getElementById('product-selector-modal').style.display = 'none';
        this.callback = null;
    },

    confirm: function () {
        if (this.callback) this.callback(this.selectedIds);
        this.close();
    },

    toggleSelection: function (id) {
        const idx = this.selectedIds.indexOf(String(id));
        if (idx >= 0) {
            this.selectedIds.splice(idx, 1);
        } else {
            this.selectedIds.push(String(id));
        }
        this.renderList(document.getElementById('psm-search').value);
    },

    renderList: function (filter = '') {
        const container = document.getElementById('psm-list');
        // 擴展商品來源：支援 KOL 後台的 kolProducts 和 availableProducts
        let allProducts = [];
        if (typeof kolProducts !== 'undefined' && kolProducts.length > 0) {
            allProducts = kolProducts;
        } else if (typeof availableProducts !== 'undefined' && availableProducts.length > 0) {
            allProducts = availableProducts;
        } else if (typeof products !== 'undefined' && products.length > 0) {
            allProducts = products;
        } else if (typeof currentProducts !== 'undefined' && currentProducts.length > 0) {
            allProducts = currentProducts;
        }
        console.log('📋 商品選擇器商品來源:', allProducts.length, '項');

        const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

        if (filtered.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">找不到任何商品</div>';
            return;
        }

        container.innerHTML = filtered.map(p => {
            const isSelected = this.selectedIds.includes(String(p.id));
            const img = (p.image || '').split(',')[0];
            return `
                <div class="psm-item" onclick="ProductSelectorModal.toggleSelection('${p.id}')" 
                     style="padding:10px 20px; border-bottom:1px solid #f5f5f5; display:flex; align-items:center; cursor:pointer; background:${isSelected ? '#f0f9ff' : 'white'};">
                    <div style="width:20px; margin-right:10px; font-size:18px; color:${isSelected ? '#007bff' : '#ddd'};">
                        ${isSelected ? '☑' : '☐'}
                    </div>
                    <img src="${img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; margin-right:15px; background:#eee;">
                    <div style="flex:1;">
                        <div style="font-weight:500; font-size:14px;">${p.name}</div>
                        <div style="color:#888; font-size:12px;">$${p.price}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
};

const PageBuilder = {
    layout: [],
    footer: null,
    editingIndex: null,
    editingFooter: false,
    previewMode: 'desktop',
    debounceTimer: null,
    storeId: null, // 新增：支援 KOL 賣場 ID

    // Touch Drag State
    touchDragItem: null,
    touchDragIndex: null,
    touchStartY: 0,
    touchCurrentY: 0,
    touchPlaceholder: null,

    // GitHub 設定 (與後端保持一致)
    LAYOUT_URL: 'https://raw.githubusercontent.com/vvstudiocode/korea/main/layout.json',

    init: async function (storeIdOpt = null) {
        console.log('🎨 Visual PageBuilder v2.0 Initialized', storeIdOpt ? `for Store: ${storeIdOpt}` : 'Global');
        this.storeId = storeIdOpt; // 設定賣場 ID

        // 如果有指定賣場，更新 URL
        if (this.storeId) {
            this.LAYOUT_URL = `https://raw.githubusercontent.com/vvstudiocode/korea/main/layout_${this.storeId}.json`;
        } else {
            this.LAYOUT_URL = 'https://raw.githubusercontent.com/vvstudiocode/korea/main/layout.json';
        }

        // 確保商品資料已載入 (用於預覽)
        // 支援多種變數名稱：products (前端/admin), kolProducts (KOL後台), currentProducts (admin)
        let hasProducts = false;
        if (typeof products !== 'undefined' && products.length > 0) hasProducts = true;
        if (typeof kolProducts !== 'undefined' && kolProducts.length > 0) hasProducts = true;
        if (typeof currentProducts !== 'undefined' && currentProducts.length > 0) hasProducts = true;
        if (typeof availableProducts !== 'undefined' && availableProducts.length > 0) hasProducts = true;

        if (!hasProducts) {
            // 嘗試載入商品
            if (typeof loadProducts === 'function') {
                await loadProducts();
            } else if (typeof loadMyProducts === 'function') {
                await loadMyProducts(); // KOL 後台
            } else if (typeof fetchProducts === 'function') {
                await fetchProducts(); // Admin 後台
            }
        }

        await this.loadLayout();

        // 監聯視窗縮放
        window.addEventListener('resize', () => {
            if (document.getElementById('builderSection').style.display !== 'none') {
                this.updatePreviewScale();
            }
        });
    },

    loadLayout: async function () {
        showLoadingOverlay();
        try {
            // 優先從 GitHub Raw 讀取
            let layoutData = null;
            try {
                const response = await fetch(this.LAYOUT_URL + '?_=' + Date.now());
                if (response.ok) {
                    layoutData = await response.json();
                    console.log('✅ Layout loaded from GitHub');
                } else {
                    console.warn('⚠️ Layout fetch failed:', response.status);

                    // Fallback: 如果是 KOL 商店且找不到專屬排版，則初始化為簡易版 (僅商品列表)
                    if (this.storeId && response.status === 404) {
                        console.log('✨ Initializing simple default layout for KOL...');
                        layoutData = {
                            footer: { enabled: true, text: `© ${new Date().getFullYear()} ${this.storeId} Store` },
                            layout: [
                                {
                                    type: 'product_list',
                                    uuid: 'default-product-list-' + Date.now(),
                                    title: '',
                                    sourceType: 'auto',
                                    category: '全部',
                                    limit: 999,
                                    marginTop: 0,
                                    marginBottom: 30
                                }
                            ]
                        };
                        console.log('✅ Default Simple Layout created');
                    }
                }
            } catch (err) {
                console.error('GitHub fetch error:', err);
            }

            // 如果還是沒有資料，使用硬編碼預設值
            if (!layoutData) {
                console.log('⚠️ Using hardcoded default layout');
                layoutData = this.getDefaultLayout();
            }

            // Fallback: 從 GAS 讀取 (如果 GitHub 和硬編碼預設都失敗，或者 GAS 有更新的資料)
            // 注意：這裡的邏輯是，如果 GitHub 成功載入，就不會再嘗試 GAS。
            // 如果 GitHub 失敗（包括 404 且沒有預設），才會嘗試 GAS。
            // 如果 GitHub 失敗且硬編碼預設被使用，GAS 也不會被嘗試。
            // 根據需求，可能需要調整 GAS 載入的優先級。
            // 目前的修改是讓硬編碼預設優先於 GAS 載入。
            if (!layoutData.sections || layoutData.sections.length === 0) { // 檢查是否真的有內容
                const data = await callApi('getSiteSettings');
                if (data.success && data.data.settings.homepage_layout) {
                    console.log('✅ Layout loaded from GAS');
                    this.layout = JSON.parse(data.data.settings.homepage_layout);
                    this.footer = null;
                    this.global = {
                        backgroundColor: '#ffffff',
                        fontFamily: 'Noto Sans TC',
                        fontSize: '16px'
                    };
                }
            } else {
                this.layout = layoutData.sections || [];
                this.footer = layoutData.footer || null;
                // 初始化全域設定 (如果有的話)
                this.global = layoutData.global || {
                    backgroundColor: '#ffffff',
                    fontFamily: 'Noto Sans TC',
                    fontSize: '16px'
                };
            }

            this.editingGlobal = false; // 新增全域編輯狀態旗標

            this.renderComponentsList();
            this.renderPreview();
        } catch (err) {
            console.error('Failed to load layout:', err);
            showToast('載入排版失敗', 'error');
        } finally {
            hideLoadingOverlay();
        }
    },

    getDefaultLayout: function () {
        return {
            sections: [
                {
                    type: "hero",
                    title: "歡迎光臨我的賣場",
                    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
                    imageMobile: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
                    buttonText: "立即選購",
                    marginTop: 0,
                    marginBottom: 20
                },
                {
                    type: "products",
                    title: "精選商品",
                    category: "全部",
                    limit: 4,
                    marginTop: 0,
                    marginBottom: 20
                }
            ],
            footer: {
                notices: [{ title: "購買須知", content: "本店為代購性質..." }],
                socialLinks: {},
                copyright: "© 2024 All Rights Reserved."
            }
        };
    },

    handleTouchStart: function (e, item, index) {
        if (e.cancelable && e.target.closest('.comp-drag-handle')) {
            e.preventDefault();
        }

        this.touchDragItem = item;
        this.touchDragIndex = index;
        this.touchStartY = e.touches[0].clientY;

        item.classList.add('dragging');
        item.style.position = 'relative';
        item.style.zIndex = '1000';
        item.style.transition = 'none';
    },

    handleTouchMove: function (e) {
        if (!this.touchDragItem) return;
        if (e.cancelable) e.preventDefault();

        const touch = e.touches[0];
        const deltaY = touch.clientY - this.touchStartY;

        this.touchDragItem.style.transform = `translateY(${deltaY}px)`;
    },

    handleTouchEnd: function (e) {
        if (!this.touchDragItem) return;

        const touch = e.changedTouches[0];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        // Hide dragged item momentarily to find element below
        const prevDisplay = this.touchDragItem.style.display;
        this.touchDragItem.style.display = 'none';
        const elemBelow = document.elementFromPoint(clientX, clientY);
        this.touchDragItem.style.display = prevDisplay;

        // Reset styles
        this.touchDragItem.style.transform = '';
        this.touchDragItem.style.position = '';
        this.touchDragItem.style.zIndex = '';
        this.touchDragItem.classList.remove('dragging');
        this.touchDragItem.style.transition = '';

        if (elemBelow) {
            const targetItem = elemBelow.closest('.comp-item');
            if (targetItem && targetItem.dataset.index !== undefined) {
                const toIndex = parseInt(targetItem.dataset.index);
                // Ensure valid index and strictly different
                if (!isNaN(toIndex) && toIndex !== this.touchDragIndex) {
                    this.reorderComponents(this.touchDragIndex, toIndex);
                }
            }
        }

        this.touchDragItem = null;
        this.touchDragIndex = null;
    },

    renderComponentsList: function () {
        const list = document.getElementById('builderComponentsList');
        if (!list) return;

        list.innerHTML = '';

        // 判斷是否為 KOL 模式 (有 storeId)
        const isKolMode = !!this.storeId;

        // 1. 全域設定區塊
        const globalDiv = document.createElement('div');
        // KOL 模式下允許編輯全域設定 (背景、字體)
        globalDiv.className = `comp-item global-item ${this.editingGlobal ? 'active' : ''}`;

        const globalClickAction = 'onclick="PageBuilder.toggleGlobalEdit()"';
        const globalCursor = 'pointer';
        const globalOpacity = '';

        globalDiv.innerHTML = `
            <div class="comp-item-header" style="background: #e3f2fd; border-bottom: 2px solid #2196f3; ${globalOpacity}">
                <div class="comp-drag-handle" style="visibility:hidden;"></div>
                <div class="comp-info" ${globalClickAction} style="cursor:${globalCursor}; flex: 1;">
                    <span class="comp-name" style="font-weight:bold; color:#0d47a1; margin-left: 0;">全域設定</span>
                </div>
                <div class="comp-actions">
                    <!-- edit btn removed -->
                </div>
            </div>
            <div class="comp-edit-panel">
                <div class="edit-form-inner" id="edit-form-global"></div>
            </div>
        `;

        if (this.editingGlobal) {
            this.renderGlobalForm(globalDiv.querySelector('#edit-form-global'));
        }

        list.appendChild(globalDiv);

        // 渲染區塊列表
        this.layout.forEach((comp, index) => {
            const div = document.createElement('div');
            // KOL 模式下添加 disabled 樣式，並不允許 active
            div.className = `comp-item ${(!isKolMode && this.editingIndex === index && !this.editingFooter) ? 'active' : ''} ${isKolMode ? 'disabled-item' : ''}`;
            div.dataset.index = index;

            const info = this.getComponentTypeInfo(comp.type);
            const itemClickAction = isKolMode ? '' : `onclick="PageBuilder.toggleEdit(${index})"`;
            const itemCursor = isKolMode ? 'default' : 'pointer';
            const itemOpacity = isKolMode ? 'opacity: 0.6;' : '';

            // KOL 模式下不顯示刪除按鈕和拖滑鼠標
            const deleteBtn = isKolMode ? '' : `<button class="comp-btn delete" onclick="PageBuilder.removeComponent(${index})">刪除</button>`;
            const dragHandleStyle = isKolMode ? 'visibility: hidden;' : 'touch-action: none;';
            const dragHandleContent = isKolMode ? '' : '☰';

            div.innerHTML = `
                <div class="comp-item-header" style="${itemOpacity}">
                    <div class="comp-drag-handle" title="拖拽排序" style="${dragHandleStyle}">${dragHandleContent}</div>
                    <div class="comp-info" ${itemClickAction} style="cursor:${itemCursor}; flex: 1;">
                        <span class="comp-name">${comp.title || info.name}</span>
                        <span class="comp-type-tag">${info.name}</span>
                        ${isKolMode ? '<span style="font-size:11px; color:#999; margin-left:5px;">(唯讀)</span>' : ''}
                    </div>
                    <div class="comp-actions">
                        ${deleteBtn}
                    </div>
                </div>
                <div class="comp-edit-panel">
                    <div class="edit-form-inner" id="edit-form-${index}"></div>
                </div>
            `;

            if (!isKolMode && this.editingIndex === index && !this.editingFooter) {
                this.renderInlineForm(div.querySelector(`#edit-form-${index}`), comp, index);
            }

            if (!isKolMode) {
                div.addEventListener('mouseenter', () => this.highlightPreview(index));
                div.addEventListener('mouseleave', () => this.clearHighlight());

                const handle = div.querySelector('.comp-drag-handle');
                handle.draggable = true;
                handle.addEventListener('dragstart', (e) => {
                    div.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', index);
                });
                handle.addEventListener('dragend', () => div.classList.remove('dragging'));
                div.addEventListener('dragover', (e) => e.preventDefault());
                div.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIndex = index;
                    this.reorderComponents(fromIndex, toIndex);
                });

                // Mobile Touch Support
                handle.addEventListener('touchstart', (e) => this.handleTouchStart(e, div, index), { passive: false });
                handle.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
                handle.addEventListener('touchend', (e) => this.handleTouchEnd(e));
            }

            list.appendChild(div);
        });

        // 在所有自訂元件之後，加入「新增區塊」按鈕 (僅非 KOL 模式顯示)
        if (!isKolMode) {
            const addBtnContainer = document.createElement('div');
            addBtnContainer.style.cssText = 'padding: 5px 0; display: flex; justify-content: center; margin-bottom: 10px;';
            addBtnContainer.innerHTML = `
                <button class="add-block-btn" onclick="openModal('addCompModal')" title="新增區塊">＋ 區塊</button>
            `;
            list.appendChild(addBtnContainer);
        }

        // 渲染頁尾區塊 (固定在最下方)
        const footerDiv = document.createElement('div');
        footerDiv.className = `comp-item footer-item ${this.editingFooter ? 'active' : ''}`;
        footerDiv.innerHTML = `
            <div class="comp-item-header" style="background: #f5f5f5; border-bottom: 2px solid #6c757d;">
                <div class="comp-drag-handle" style="visibility:hidden;"></div>
                <div class="comp-info" onclick="PageBuilder.toggleFooterEdit()" style="cursor:pointer; flex: 1;">
                    <span class="comp-name" style="font-weight:bold; color:#495057; margin-left: 0;">頁尾區塊</span>
                </div>
                <div class="comp-actions">
                    <!-- edit btn removed -->
                </div>
            </div>
            <div class="comp-edit-panel">
                <div class="edit-form-inner" id="edit-form-footer"></div>
            </div>
        `;

        if (this.editingFooter) {
            this.renderFooterForm(footerDiv.querySelector('#edit-form-footer'));
        }

        list.appendChild(footerDiv);
    },

    toggleEdit: function (index) {
        this.editingFooter = false;
        if (this.editingIndex === index) {
            this.editingIndex = null;
        } else {
            this.editingIndex = index;
            setTimeout(() => {
                const el = document.querySelector(`.comp-item[data-index="${index}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
        this.renderComponentsList();
        this.highlightPreview(index);
    },

    toggleFooterEdit: function () {
        this.editingIndex = null;
        this.editingFooter = !this.editingFooter;
        this.renderComponentsList();
    },


    renderInlineForm: function (container, comp, index) {
        container.innerHTML = '';

        // 通用間距設定 (放在開頭)
        this.addInnerField(container, '上方間距 (px)', 'marginTop', comp.marginTop || 0, 'range');
        this.addInnerField(container, '下方間距 (px)', 'marginBottom', comp.marginBottom || 0, 'range');

        // 通用: 文字對齊 (除了 image_carousel 自有設定外)
        if (['hero', 'info_section', 'announcement', 'products', 'product_list', 'text_combination'].includes(comp.type)) {
            this.addInnerField(container, '文字對齊', 'textAlign', comp.textAlign || 'center', 'select', ['left', 'center', 'right']);
        }

        // 分隔線
        const hr = document.createElement('hr');
        hr.style.cssText = 'margin: 15px 0; border: none; border-top: 1px solid #eee;';
        container.appendChild(hr);

        if (comp.type === 'hero') {
            this.addInnerField(container, '標題', 'title', comp.title);
            this.addInnerField(container, '副標題/文字', 'subtitle', comp.subtitle, 'textarea');

            const imgLabel = document.createElement('div');
            imgLabel.innerHTML = '<strong>圖片設定</strong>';
            imgLabel.style.margin = '15px 0 10px 0';
            container.appendChild(imgLabel);

            this.addInnerField(container, '電腦版圖片 URL', 'image', comp.image);
            this.addInnerField(container, '手機版圖片 URL', 'imageMobile', comp.imageMobile);

            this.addInnerField(container, '按鈕文字', 'buttonText', comp.buttonText);
            this.addInnerField(container, '跳轉連結', 'buttonLink', comp.buttonLink);
        } else if (comp.type === 'text_combination') {
            this.addInnerField(container, '標題', 'title', comp.title);
            this.addInnerField(container, '副標題', 'subtitle', comp.subtitle);
            this.addInnerField(container, '內文', 'content', comp.content, 'textarea');
            this.addInnerField(container, '按鈕文字', 'buttonText', comp.buttonText);
            this.addInnerField(container, '跳轉連結', 'buttonLink', comp.buttonLink);
        } else if (comp.type === 'custom_code') {
            this.addInnerField(container, '程式碼內容 (HTML/CSS/JS)', 'htmlContent', comp.htmlContent, 'textarea');
            const tip = document.createElement('div');
            tip.style.cssText = 'color:#666; font-size:12px; margin-top:5px;';
            tip.textContent = '注意：請確保程式碼語法正確。支援 <script> 與 <style> 標籤。';
            container.appendChild(tip);
        } else if (comp.type === 'single_image') {
            this.addInnerField(container, '連結 URL', 'link', comp.link);
            this.addInnerField(container, '全寬模式 (忽略寬度設定)', 'fullWidth', comp.fullWidth, 'checkbox');
            this.addInnerField(container, 'ALT 替代文字', 'alt', comp.alt);

            const hr = document.createElement('hr');
            hr.style.cssText = 'margin:15px 0; border:none; border-top:1px dashed #eee;';
            container.appendChild(hr);

            const desktopLabel = document.createElement('div');
            desktopLabel.innerHTML = '<strong>電腦版設定</strong>';
            desktopLabel.style.marginBottom = '10px';
            container.appendChild(desktopLabel);

            this.addInnerField(container, '圖片 URL', 'imageDesktop', comp.imageDesktop);
            this.addInnerField(container, '寬度 (例如 1200px 或 80%)', 'widthDesktop', comp.widthDesktop || '100%');

            const mobileLabel = document.createElement('div');
            mobileLabel.innerHTML = '<strong>手機版設定</strong>';
            mobileLabel.style.marginTop = '15px';
            mobileLabel.style.marginBottom = '10px';
            container.appendChild(mobileLabel);

            this.addInnerField(container, '圖片 URL', 'imageMobile', comp.imageMobile);
            this.addInnerField(container, '寬度 (例如 100%)', 'widthMobile', comp.widthMobile || '100%');

        } else if (comp.type === 'image_carousel') {
            // 圖片輪播設定
            this.addInnerField(container, '全寬模式', 'fullWidth', comp.fullWidth, 'checkbox');

            // 輪播速度
            this.addInnerField(container, '自動輪播速度 (秒, 0為不輪播)', 'speed', comp.speed || 3, 'number');

            // 比例設定
            const ratioOptions = ['original', '21:9', '16:9', '4:3', '1:1', '3:4'];
            const ratioWrapper = document.createElement('div');
            ratioWrapper.style.display = 'flex';
            ratioWrapper.style.gap = '10px';
            container.appendChild(ratioWrapper);

            const desktopRatioDiv = document.createElement('div');
            desktopRatioDiv.style.flex = 1;
            this.addInnerField(desktopRatioDiv, '桌面比例', 'ratioDesktop', comp.ratioDesktop || '21:9', 'select', ratioOptions);
            ratioWrapper.appendChild(desktopRatioDiv);

            const mobileRatioDiv = document.createElement('div');
            mobileRatioDiv.style.flex = 1;
            this.addInnerField(mobileRatioDiv, '手機比例', 'ratioMobile', comp.ratioMobile || '16:9', 'select', ratioOptions);
            ratioWrapper.appendChild(mobileRatioDiv);

            // 圖片管理
            const imagesWrapper = document.createElement('div');
            imagesWrapper.innerHTML = '<label style="display:block;margin:15px 0 5px;font-size:14px;color:#555;">輪播圖片</label>';

            const imagesList = document.createElement('div');
            imagesList.style.cssText = 'background:#f9f9f9; padding:10px; border-radius:8px; border:1px solid #eee;';

            (comp.images || []).forEach((img, idx) => {
                const item = document.createElement('div');
                item.style.cssText = 'background:white; padding:10px; border:1px solid #ddd; border-radius:4px; margin-bottom:10px; display:flex; gap:10px; align-items:start;';
                item.innerHTML = `
                    <div style="flex:1;">
                        <label style="font-size:11px; color:#666;">電腦版圖片</label>
                        <input type="text" placeholder="電腦版圖片 URL" value="${img.src || ''}" 
                               oninput="PageBuilder.updateCarouselImage(${index}, ${idx}, 'src', this.value)"
                               style="width:100%; padding:6px; font-size:13px; margin-bottom:5px; border:1px solid #eee;">
                        
                        <label style="font-size:11px; color:#666;">手機版圖片</label>
                        <input type="text" placeholder="手機版圖片 URL (選填, 預設同電腦版)" value="${img.srcMobile || ''}" 
                               oninput="PageBuilder.updateCarouselImage(${index}, ${idx}, 'srcMobile', this.value)"
                               style="width:100%; padding:6px; font-size:13px; margin-bottom:5px; border:1px solid #eee;">

                        <label style="font-size:11px; color:#666;">連結</label>
                        <input type="text" placeholder="連結 URL (選填)" value="${img.link || ''}" 
                               oninput="PageBuilder.updateCarouselImage(${index}, ${idx}, 'link', this.value)"
                               style="width:100%; padding:6px; font-size:13px; border:1px solid #eee;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <img src="${img.src || ''}" style="width:40px; height:40px; object-fit:cover; background:#eee; border-radius:4px;">
                        <button onclick="PageBuilder.removeCarouselImage(${index}, ${idx})" style="background:#dc3545; color:white; border:none; border-radius:4px; padding:2px 5px; font-size:12px; cursor:pointer;">刪除</button>
                    </div>
                `;
                imagesList.appendChild(item);
            });

            const addBtn = document.createElement('button');
            addBtn.textContent = '+ 新增圖片';
            addBtn.style.cssText = 'width:100%; padding:8px; background:white; border:1px dashed #999; border-radius:4px; margin-top:5px; cursor:pointer; font-size:13px;';
            addBtn.onclick = () => {
                if (!this.layout[index].images) this.layout[index].images = [];
                this.layout[index].images.push({ src: '', srcMobile: '', link: '' });
                this.renderInlineForm(container, this.layout[index], index);
                // this.renderPreview();
            };
            imagesList.appendChild(addBtn);
            imagesWrapper.appendChild(imagesList);
            container.appendChild(imagesWrapper);

        } else if (comp.type === 'info_section') {
            this.addInnerField(container, '標題', 'title', comp.title);
            this.addInnerField(container, '副標題/文字', 'subtitle', comp.subtitle, 'textarea');

            const imgLabel = document.createElement('div');
            imgLabel.innerHTML = '<strong>圖片設定</strong>';
            imgLabel.style.margin = '15px 0 10px 0';
            container.appendChild(imgLabel);

            this.addInnerField(container, '電腦版圖片 URL', 'image', comp.image);
            this.addInnerField(container, '手機版圖片 URL', 'imageMobile', comp.imageMobile);

            // Layout & Ratio
            const layoutOptions = document.createElement('div');
            layoutOptions.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';

            const layoutDiv = document.createElement('div');
            layoutDiv.style.flex = 1;
            this.addInnerField(layoutDiv, '圖片位置', 'layout', comp.layout || 'left', 'select', ['left', 'right']);
            layoutOptions.appendChild(layoutDiv);

            const ratioDiv = document.createElement('div');
            ratioDiv.style.flex = 1;
            this.addInnerField(ratioDiv, '圖片比例', 'ratio', comp.ratio || '1:1', 'select', ['1:1', '4:3', '3:4', '16:9', 'original']);
            layoutOptions.appendChild(ratioDiv);

            container.appendChild(layoutOptions);

            this.addInnerField(container, '按鈕文字', 'buttonText', comp.buttonText);
            this.addInnerField(container, '跳轉連結', 'buttonLink', comp.buttonLink);
        } else if (comp.type === 'product_list' || comp.type === 'products') {
            const isProducts = comp.type === 'products'; // 只有輪播圖支援手動選品

            // 標題輸入
            this.addInnerField(container, '區塊標題', 'title', comp.title);

            // 商品來源選擇 (僅限輪播圖)
            if (isProducts) {
                const sourceWrapper = document.createElement('div');
                sourceWrapper.style.marginBottom = '15px';
                sourceWrapper.innerHTML = '<label style="display:block;margin-bottom:5px;font-size:14px;color:#555;">商品來源</label>';

                const select = document.createElement('select');
                select.style.cssText = 'width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;';
                select.innerHTML = `
                    <option value="category" ${(!comp.sourceType || comp.sourceType === 'category') ? 'selected' : ''}>分類篩選</option>
                    <option value="manual" ${comp.sourceType === 'manual' ? 'selected' : ''}>手動選擇</option>
                `;

                select.onchange = (e) => {
                    this.layout[index].sourceType = e.target.value;
                    if (e.target.value === 'manual' && !this.layout[index].productIds) {
                        this.layout[index].productIds = [];
                    }
                    this.renderInlineForm(container, this.layout[index], index);
                    this.renderPreview();
                };

                sourceWrapper.appendChild(select);
                container.appendChild(sourceWrapper);
            }

            const sourceType = comp.sourceType || 'category';

            if (sourceType === 'category' || !isProducts) {
                // 分類選擇
                const catWrapper = document.createElement('div');
                catWrapper.style.marginBottom = '15px';
                catWrapper.innerHTML = '<label style="display:block;margin-bottom:5px;font-size:14px;color:#555;">選擇分類</label>';

                const catSelect = document.createElement('select');
                catSelect.style.cssText = 'width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;';

                const allProducts = typeof products !== 'undefined' ? products : (typeof currentProducts !== 'undefined' ? currentProducts : []);
                const categories = ['全部', ...new Set(allProducts.map(p => p.category).filter(Boolean))];

                catSelect.innerHTML = categories.map(c =>
                    `<option value="${c}" ${comp.category === c ? 'selected' : ''}>${c}</option>`
                ).join('');

                catSelect.onchange = (e) => {
                    this.layout[index].category = e.target.value;
                    this.renderPreview();
                };

                catWrapper.appendChild(catSelect);
                container.appendChild(catWrapper);

                this.addInnerField(container, '顯示數量', 'limit', comp.limit || 4, 'number');
            } else {
                // 手動選擇 (Modal)
                const manualWrapper = document.createElement('div');
                manualWrapper.style.marginBottom = '15px';
                manualWrapper.style.padding = '15px';
                manualWrapper.style.background = '#f9f9f9';
                manualWrapper.style.borderRadius = '8px';
                manualWrapper.style.border = '1px solid #eee';

                // 支援 KOL 後台的商品來源
                let allProducts = [];
                if (typeof kolProducts !== 'undefined' && kolProducts.length > 0) {
                    allProducts = kolProducts;
                } else if (typeof availableProducts !== 'undefined' && availableProducts.length > 0) {
                    allProducts = availableProducts;
                } else if (typeof products !== 'undefined' && products.length > 0) {
                    allProducts = products;
                } else if (typeof currentProducts !== 'undefined' && currentProducts.length > 0) {
                    allProducts = currentProducts;
                }
                const selectedCount = (comp.productIds || []).length;

                manualWrapper.innerHTML = `
                    <div style="font-size:13px; color:#555; margin-bottom:10px;">目前已選擇 ${selectedCount} 項商品</div>
                    <button class="btn-select-products" style="width:100%; padding:10px; background:white; border:1px dashed #999; border-radius:6px; cursor:pointer; color:#555;">
                        + 選擇商品 (開啟視窗)
                    </button>
                    <div class="selected-items-preview" style="margin-top:10px; max-height:200px; overflow-y:auto;"></div>
                `;

                setTimeout(() => {
                    const btn = manualWrapper.querySelector('.btn-select-products');
                    if (btn) {
                        btn.onclick = () => {
                            ProductSelectorModal.open(comp.productIds, (newIds) => {
                                this.layout[index].productIds = newIds;
                                this.renderInlineForm(container, this.layout[index], index);
                                this.renderPreview();
                            });
                        };
                    }
                }, 0);

                const previewContainer = manualWrapper.querySelector('.selected-items-preview');
                if (selectedCount > 0) {
                    comp.productIds.forEach((pid, pidIdx) => {
                        const product = allProducts.find(p => String(p.id) === String(pid));
                        if (product) {
                            const item = document.createElement('div');
                            item.style.cssText = 'display:flex; align-items:center; gap:10px; background:white; padding:8px; border:1px solid #eee; margin-bottom:5px; border-radius:4px;';
                            item.innerHTML = `
                                <img src="${(product.image || '').split(',')[0]}" style="width:30px;height:30px;object-fit:cover;border-radius:4px; background:#eee;">
                                <div style="flex:1; overflow:hidden;">
                                    <div style="font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${product.name}</div>
                                </div>
                                <button style="background:none; border:none; color:#999; cursor:pointer; font-size:16px;">×</button>
                            `;
                            item.querySelector('button').onclick = () => {
                                this.layout[index].productIds.splice(pidIdx, 1);
                                this.renderInlineForm(container, this.layout[index], index);
                                this.renderPreview();
                            };
                            previewContainer.appendChild(item);
                        }
                    });
                }

                container.appendChild(manualWrapper);
            }
        } else if (comp.type === 'announcement') {
            this.addInnerField(container, '公告內容', 'text', comp.text);

            // Extra Product Settings (Ratio, Columns)
            if (isProducts || comp.type === 'product_list') {
                const settingsWrapper = document.createElement('div');
                settingsWrapper.style.marginTop = '15px';
                settingsWrapper.style.padding = '10px';
                settingsWrapper.style.background = '#f8f8f8';
                settingsWrapper.style.borderRadius = '6px';

                settingsWrapper.innerHTML = '<div style="font-size:12px; font-weight:bold; color:#555; margin-bottom:10px;">外觀設定</div>';

                // Ratio
                const ratioDiv = document.createElement('div');
                this.addInnerField(ratioDiv, '圖片比例', 'ratio', comp.ratio || '1:1', 'select', ['1:1', '3:4', '4:3']);
                settingsWrapper.appendChild(ratioDiv);

                // Columns (Desktop / Mobile)
                const colWrapper = document.createElement('div');
                colWrapper.style.cssText = 'display:flex; gap:10px; margin-top:10px;';

                const dtCol = document.createElement('div');
                dtCol.style.flex = 1;
                this.addInnerField(dtCol, '桌面欄數', 'itemsDesktop', comp.itemsDesktop || 4, 'number');
                colWrapper.appendChild(dtCol);

                const mbCol = document.createElement('div');
                mbCol.style.flex = 1;
                this.addInnerField(mbCol, '手機欄數', 'itemsMobile', comp.itemsMobile || 2, 'number');
                colWrapper.appendChild(mbCol);

                settingsWrapper.appendChild(colWrapper);
                container.appendChild(settingsWrapper);
            }

            // 背景透明選項
            const bgWrapper = document.createElement('div');
            bgWrapper.className = 'form-group';
            bgWrapper.style.marginBottom = '12px';
            const transparent = comp.bgTransparent === true;

            bgWrapper.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                    <input type="checkbox" ${transparent ? 'checked' : ''}>
                    背景透明
                </label>
            `;

            bgWrapper.querySelector('input').onchange = (e) => {
                this.layout[index].bgTransparent = e.target.checked;
                this.renderInlineForm(container, this.layout[index], index);
                this.renderPreview();
            };
            container.appendChild(bgWrapper);

            if (!transparent) {
                this.addInnerField(container, '背景顏色', 'bgColor', comp.bgColor || '#f3f4f6', 'color');
            }

        } else if (comp.type === 'categories') {
            this.addInnerField(container, '區塊標題', 'title', comp.title);
            // 分類導覽目前是自動抓取的，不需要編輯具體分類
        }

        // 新增：每個區塊編輯器底部都加上確認按鈕
        this.addUpdateBtn(container);
    },

    renderFooterForm: function (container) {
        container.innerHTML = '';

        if (!this.footer) {
            this.footer = {
                socialLinks: { line: '', instagram: '', threads: '' },
                copyright: '2025 OMO Select. All rights reserved.',
                notices: []
            };
        }

        // 社群連結
        const socialSection = document.createElement('div');
        socialSection.innerHTML = '<h4 style="margin:0 0 10px 0; font-size:14px; color:#555;">社群連結</h4>';
        container.appendChild(socialSection);

        this.addFooterField(container, 'Line 連結', 'socialLinks.line', this.footer.socialLinks?.line || '');
        this.addFooterField(container, 'Instagram 連結', 'socialLinks.instagram', this.footer.socialLinks?.instagram || '');
        this.addFooterField(container, 'Threads 連結', 'socialLinks.threads', this.footer.socialLinks?.threads || '');

        // 版權聲明
        const copyrightSection = document.createElement('div');
        copyrightSection.innerHTML = '<h4 style="margin:20px 0 10px 0; font-size:14px; color:#555;">版權聲明</h4>';
        container.appendChild(copyrightSection);

        this.addFooterField(container, '版權文字', 'copyright', this.footer.copyright || '');

        // 購買須知
        const noticesSection = document.createElement('div');
        noticesSection.innerHTML = `
            <h4 style="margin:20px 0 10px 0; font-size:14px; color:#555;">
                購買須知 
                <button type="button" class="btn-small" onclick="PageBuilder.addNotice()" style="margin-left:10px;">+ 新增區塊</button>
            </h4>
        `;
        container.appendChild(noticesSection);

        const noticesContainer = document.createElement('div');
        noticesContainer.id = 'footer-notices-container';
        container.appendChild(noticesContainer);

        (this.footer.notices || []).forEach((notice, idx) => {
            this.renderNoticeItem(noticesContainer, notice, idx);
        });

        // 新增：頁尾編輯器底部加上確認按鈕
        this.addUpdateBtn(container);
    },

    renderNoticeItem: function (container, notice, idx) {
        const div = document.createElement('div');
        div.className = 'notice-item';
        div.style.cssText = 'background:#f8f9fa; padding:10px; border-radius:6px; margin-bottom:10px;';
        div.innerHTML = `
            <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:12px;">標題</label>
                <input type="text" value="${notice.title || ''}" 
                       oninput="PageBuilder.updateNotice(${idx}, 'title', this.value)"
                       style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;">
            </div>
            <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:12px;">內容（換行分段）</label>
                <textarea rows="3" 
                          oninput="PageBuilder.updateNotice(${idx}, 'content', this.value)"
                          style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; resize:vertical;">${notice.content || ''}</textarea>
            </div>
            <button type="button" class="btn-small delete" onclick="PageBuilder.removeNotice(${idx})" 
                    style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:12px;">
                刪除此區塊
            </button>
        `;
        container.appendChild(div);
    },

    addNotice: function () {
        if (!this.footer.notices) this.footer.notices = [];
        this.footer.notices.push({ title: '新區塊標題', content: '區塊內容...' });
        this.renderComponentsList();
        this.debouncedPreviewUpdate();
    },

    removeNotice: function (idx) {
        if (confirm('確定刪除此購買須知區塊？')) {
            this.footer.notices.splice(idx, 1);
            this.renderComponentsList();
            this.debouncedPreviewUpdate();
        }
    },

    updateNotice: function (idx, field, value) {
        if (this.footer.notices && this.footer.notices[idx]) {
            this.footer.notices[idx][field] = value;
            this.debouncedPreviewUpdate();
        }
    },

    addFooterField: function (container, label, path, value) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.style.marginBottom = '8px';
        div.innerHTML = `<label style="font-size:11px; color:#555; margin-bottom:2px; display:block;">${label}</label>`;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.style.cssText = 'width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:13px;';
        input.oninput = (e) => {
            this.setFooterValue(path, e.target.value);
            this.debouncedPreviewUpdate();
        };

        div.appendChild(input);
        container.appendChild(div);
    },

    setFooterValue: function (path, value) {
        const parts = path.split('.');
        let obj = this.footer;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    },

    highlightPreview: function (index) {
        this.clearHighlight();
        if (index === null) return;
        const previewRoot = document.getElementById('pageBuilderPreviewRoot');
        if (!previewRoot) return;

        const sections = previewRoot.querySelectorAll('.page-section');
        if (sections[index]) {
            sections[index].classList.add('preview-highlight');
            sections[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    clearHighlight: function () {
        document.querySelectorAll('.preview-highlight').forEach(el => el.classList.remove('preview-highlight'));
    },

    getComponentTypeInfo: function (type) {
        const types = {
            'hero': { name: '首頁大圖', icon: '' },
            'image_carousel': { name: '圖片輪播', icon: '' },
            'text_combination': { name: '文字組合', icon: '' },
            'custom_code': { name: '自訂程式碼', icon: '' },
            'categories': { name: '分類導覽', icon: '' },
            'products': { name: '商品輪播', icon: '' },
            'product_list': { name: '商品列表', icon: '' },
            'info_section': { name: '圖文介紹', icon: '' },
            'announcement': { name: '公告欄', icon: '' },
            'single_image': { name: '單張圖片', icon: '' }
        };
        return types[type] || { name: '未定類別', icon: '' };
    },

    toggleGlobalEdit: function () {
        this.editingGlobal = !this.editingGlobal;
        this.editingIndex = null;
        this.editingFooter = false;
        this.renderComponentsList();
    },

    renderGlobalForm: function (container) {
        if (!this.global) {
            this.global = {
                backgroundColor: '#ffffff',
                fontFamily: 'Noto Sans TC',
                fontSize: '16px'
            };
        }

        // 背景顏色
        this.addGlobalField(container, '網站背景顏色', 'backgroundColor', this.global.backgroundColor, 'color');

        // 字體大小
        this.addGlobalField(container, '預設字體大小 (px)', 'fontSize', this.global.fontSize || '16px', 'select', ['14px', '15px', '16px', '18px', '20px']);

        // 字型
        this.addGlobalField(container, '網站字型', 'fontFamily', this.global.fontFamily || 'Noto Sans TC', 'select', [
            'Noto Sans TC',
            'Microsoft JhengHei',
            'Helvetica Neue',
            'Arial',
            'Times New Roman'
        ]);

        // 新增確認修改按鈕
        this.addUpdateBtn(container);
    },

    // 專用於全域設定的欄位建立函數
    addGlobalField: function (container, label, key, value, type = 'text', options = []) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.style.marginBottom = '8px';
        div.innerHTML = `<label style="font-size:11px; color:#555; margin-bottom:2px; display:block;">${label}</label>`;

        let input;
        if (type === 'select') {
            input = document.createElement('select');
            input.style.cssText = 'width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;';
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === value) o.selected = true;
                input.appendChild(o);
            });
        } else if (type === 'color') {
            input = document.createElement('input');
            input.type = 'color';
            input.style.cssText = 'width:100%; height:40px; padding:0; border:1px solid #ddd; border-radius:4px; cursor:pointer;';
        } else {
            input = document.createElement('input');
            input.type = type;
            input.style.cssText = 'width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;';
        }

        input.value = value || '';
        input.dataset.key = key;

        // 更新全域設定
        input.onchange = (e) => {
            this.global[key] = e.target.value;
            this.debouncedPreviewUpdate();
        };

        div.appendChild(input);
        container.appendChild(div);
    },

    addComponent: function (type) {
        const newComp = { type: type, marginTop: 0, marginBottom: 20 };
        if (type === 'hero') {
            newComp.title = '新橫幅';
            newComp.image = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800';
            newComp.imageMobile = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
            newComp.buttonText = '查看更多';
        } else if (type === 'single_image') {
            newComp.imageDesktop = 'https://via.placeholder.com/1200x400?text=Desktop+Image';
            newComp.imageMobile = 'https://via.placeholder.com/600x600?text=Mobile+Image';
            newComp.link = '';
            newComp.fullWidth = true;
            newComp.widthDesktop = '100%';
            newComp.widthMobile = '100%';
            newComp.alt = '圖片說明';
        } else if (type === 'products') {
            newComp.title = '精選商品';
            newComp.category = '全部';
            newComp.limit = 4;
        } else if (type === 'product_list') {
            newComp.title = '商品列表';
            newComp.category = '全部';
            newComp.limit = 8;
            newComp.itemsDesktop = 4;
            newComp.itemsMobile = 2;
        } else if (type === 'announcement') {
            newComp.text = '新公告內容';
            newComp.bgColor = '#f3f4f6';
        } else if (type === 'info_section') {
            newComp.title = '新圖文介紹';
            newComp.subtitle = '在這裡輸入介紹文字...';
            newComp.image = 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600';
            newComp.imageMobile = 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600';
        } else if (type === 'image_carousel') {
            newComp.title = '新圖片輪播';
            newComp.images = [
                { src: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800', srcMobile: '', link: '' },
                { src: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800', srcMobile: '', link: '' }
            ];
            newComp.fullWidth = true;
            newComp.ratioDesktop = '21:9';
            newComp.ratioMobile = '16:9';
            newComp.speed = 3; // 預設 3 秒
        } else if (type === 'text_combination') {
            newComp.title = 'Paragraph Title';
            newComp.subtitle = 'Subtitle';
            newComp.content = 'Input your text contents to promote your product, or tell the story about your shop.';
            newComp.buttonText = 'Enter';
            newComp.textAlign = 'center';
        } else if (type === 'custom_code') {
            newComp.title = 'HTML/JS 程式碼';
            newComp.htmlContent = '<!-- 在此輸入 HTML, CSS, 或 JS -->\n<div style="padding:20px; text-align:center;">自訂程式碼區塊</div>';
        } else if (type === 'categories') {
            newComp.title = '商品分類';
        }

        this.layout.push(newComp);
        this.editingIndex = this.layout.length - 1;
        this.editingFooter = false;
        this.renderComponentsList();
        this.renderPreview();
    },

    removeComponent: function (index) {
        if (confirm('確定要刪除此區塊嗎？')) {
            if (this.editingIndex === index) this.editingIndex = null;
            this.layout.splice(index, 1);
            this.renderComponentsList();
            this.renderPreview();
        }
    },

    reorderComponents: function (from, to) {
        if (from === to) return;
        const item = this.layout.splice(from, 1)[0];
        this.layout.splice(to, 0, item);
        if (this.editingIndex === from) this.editingIndex = to;
        else if (from < this.editingIndex && to >= this.editingIndex) this.editingIndex--;
        else if (from > this.editingIndex && to <= this.editingIndex) this.editingIndex++;

        this.renderComponentsList();
        this.renderPreview();
    },

    addInnerField: function (container, label, key, value, type = 'text', options = []) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.style.marginBottom = '8px';
        div.innerHTML = `<label style="font-size:11px; color:#555; margin-bottom:2px; display:block;">${label}</label>`;

        let input;
        if (type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 3;
            input.style.cssText = 'width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; resize:vertical;';
        } else if (type === 'select') {
            input = document.createElement('select');
            input.style.cssText = 'width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;';
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === value) o.selected = true;
                input.appendChild(o);
            });
        } else if (type === 'range') {
            // 間距滑桿
            const rangeWrapper = document.createElement('div');
            rangeWrapper.style.cssText = 'display:flex; align-items:center; gap:10px;';

            input = document.createElement('input');
            input.type = 'range';
            input.min = 0;
            input.max = 100;
            input.value = value || 0;
            input.style.cssText = 'flex:1;';

            const valueDisplay = document.createElement('span');
            valueDisplay.textContent = (value || 0) + 'px';
            valueDisplay.style.cssText = 'min-width:45px; text-align:right; font-size:12px; color:#666;';

            input.oninput = (e) => {
                const val = parseInt(e.target.value);
                valueDisplay.textContent = val + 'px';
                this.layout[this.editingIndex][key] = val;
                this.debouncedPreviewUpdate();
            };

            rangeWrapper.appendChild(input);
            rangeWrapper.appendChild(valueDisplay);
            div.appendChild(rangeWrapper);
            container.appendChild(div);
            div.appendChild(rangeWrapper);
            container.appendChild(div);
            return; // 提前返回，不需要後續處理
        } else if (type === 'checkbox') {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; align-items:center; gap:10px;';

            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!value;
            input.style.cssText = 'width:20px; height:20px;';

            input.onchange = (e) => {
                this.layout[this.editingIndex][key] = e.target.checked;
            };

            wrapper.appendChild(input);
            const labelSpan = document.createElement('span');
            labelSpan.textContent = '啟用';
            wrapper.appendChild(labelSpan);

            div.appendChild(wrapper);
            container.appendChild(div);
            return;
        } else {
            input = document.createElement('input');
            input.type = type;
            input.style.cssText = 'width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;';
        }

        input.value = value || '';
        input.dataset.key = key;

        // 取消自動預覽更新，改為手動
        input.oninput = (e) => {
            // 確保 editingIndex 有效才更新
            if (this.editingIndex !== null && this.layout[this.editingIndex]) {
                this.layout[this.editingIndex][key] = type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
            }
            // this.debouncedPreviewUpdate(); // Disabled
        };

        div.appendChild(input);
        container.appendChild(div);
    },

    // 新增確認修改按鈕的 Helper (用於 Inline Form 底部)
    addUpdateBtn: function (container) {
        const btnDiv = document.createElement('div');
        btnDiv.style.cssText = 'margin-top: 20px; text-align: right; border-top: 1px solid #eee; padding-top: 15px;';

        const btn = document.createElement('button');
        btn.textContent = '確認修改 (重新預覽)';
        btn.className = 'save-btn'; // 重用 save-btn 樣式
        btn.style.cssText = 'padding: 8px 15px; font-size: 14px; background: #666; width: auto;';

        btn.onclick = () => {
            this.renderPreview();
            this.highlightPreview(this.editingIndex);
            showToast('預覽已更新');
        };

        btnDiv.appendChild(btn);
        container.appendChild(btnDiv);
    },

    // 防閃爍：延遲更新預覽 (保留函數但現在主要由按鈕觸發)
    debouncedPreviewUpdate: function () {
        // Auto-preview disabled as per user request
        // clearTimeout(this.debounceTimer);
        // this.debounceTimer = setTimeout(() => this.renderPreview(), 300);
    },

    saveLayout: async function () {
        const btn = document.getElementById('saveLayoutBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '儲存中...';
        showLoadingOverlay(); // Show Global Loading

        try {
            // Sync KOL store info to global settings to prevent data loss or mismatch
            if (typeof kolStoreInfo !== 'undefined' && this.storeId) {
                if (!this.global) this.global = {};
                // Ensure we protect the title and logo determined by KOL settings
                if (kolStoreInfo.storeName) this.global.title = kolStoreInfo.storeName;
                if (kolStoreInfo.logoUrl) this.global.logo = kolStoreInfo.logoUrl;
            }

            const layoutData = {
                version: '1.0',
                lastUpdated: new Date().toISOString(),
                sections: this.layout,
                footer: this.footer,
                global: this.global || { backgroundColor: '#ffffff', fontFamily: 'Noto Sans TC', fontSize: '16px' }
            };

            console.log('💾 Saving layout to GitHub:', layoutData);

            // 透過 GAS API 寫入 GitHub
            const data = await callApi('saveLayoutToGitHub', {
                content: JSON.stringify(layoutData, null, 2),
                storeId: this.storeId
            });

            if (data.success) {
                showToast('首頁排版儲存成功！', 'success');
                // 同時更新 localStorage 快取
                localStorage.setItem('omo_cached_layout', JSON.stringify(layoutData));
            } else {
                // Fallback: 儲存到 GAS 網站設定
                console.warn('GitHub save failed, falling back to GAS...');
                const fallbackData = await callApi('saveSiteSettings', {
                    settings: { homepage_layout: JSON.stringify(this.layout) }
                });
                if (fallbackData.success) {
                    showToast('排版已儲存（備用方式）', 'success');
                } else {
                    showToast('儲存失敗：' + (data.error || fallbackData.error), 'error');
                }
            }
        } catch (err) {
            console.error('Save error:', err);
            showToast('通訊請求失敗', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
            hideLoadingOverlay(); // Hide Global Loading
        }
    },

    updateCarouselImage: function (compIndex, imgIndex, field, value) {
        if (this.layout[compIndex] && this.layout[compIndex].images && this.layout[compIndex].images[imgIndex]) {
            this.layout[compIndex].images[imgIndex][field] = value;
            // this.debouncedPreviewUpdate();
        }
    },

    removeCarouselImage: function (compIndex, imgIndex) {
        if (confirm('確定刪除此圖片？')) {
            this.layout[compIndex].images.splice(imgIndex, 1);
            const container = document.querySelector(`#edit-form-${compIndex}`);
            if (container) this.renderInlineForm(container, this.layout[compIndex], compIndex);
            // this.updatePreview();
        }
    },

    setPreviewMode: function (mode) {
        this.previewMode = mode;
        const container = document.getElementById('pageBuilderPreviewRoot');

        document.getElementById('view-desktop').classList.toggle('active', mode === 'desktop');
        document.getElementById('view-mobile').classList.toggle('active', mode === 'mobile');

        container.className = 'preview-container ' + mode;
        this.renderPreview();
    },

    renderPreview: async function () {
        const container = document.getElementById('pageBuilderPreviewRoot');
        if (!container) return;

        if (typeof PageRenderer !== 'undefined') {
            // 等待主要內容渲染完成
            await PageRenderer.render(container, this.layout);

            // 渲染頁尾預覽區塊 (確保在最後)
            if (this.footer) {
                this.renderFooterPreview(container);
            }

            // 讓預覽渲染完後也跑一次縮放
            setTimeout(() => this.updatePreviewScale(), 100);
        }
    },

    // 在預覽區顯示頁尾
    renderFooterPreview: function (container) {
        // 移除舊的頁尾預覽
        const existingFooter = container.querySelector('.preview-footer');
        if (existingFooter) existingFooter.remove();

        const footerSection = document.createElement('div');
        footerSection.className = 'preview-footer';
        footerSection.style.cssText = 'background:#f8f4f0; padding:30px 20px; margin-top:30px; border-top:1px solid #eee;';

        // 渲染購買須知
        let noticesHTML = '';
        if (this.footer.notices && this.footer.notices.length > 0) {
            noticesHTML = '<ul style="list-style:none; padding:0; margin:0 0 20px 0; font-size:13px; color:#555;">' +
                this.footer.notices.map(n => `<li style="margin-bottom:8px;"><strong>${n.title}</strong><br>${(n.content || '').replace(/\n/g, '<br>')}</li>`).join('') +
                '</ul>';
        }

        // 渲染社群連結
        let socialHTML = '';
        if (this.footer.socialLinks) {
            const links = this.footer.socialLinks;
            socialHTML = '<div style="display:flex; justify-content:center; gap:15px; margin-bottom:10px;">' +
                (links.line ? '<span style="font-size:20px;">📱</span>' : '') +
                (links.instagram ? '<span style="font-size:20px;">📸</span>' : '') +
                (links.threads ? '<span style="font-size:20px;">🧵</span>' : '') +
                '</div>';
        }

        // 渲染版權
        const copyrightHTML = this.footer.copyright ?
            `<div style="text-align:center; font-size:12px; color:#999;">${this.footer.copyright}</div>` : '';

        footerSection.innerHTML = noticesHTML + socialHTML + copyrightHTML;

        // 確保 footer 真的在最後面 (以防萬一)
        container.appendChild(footerSection);
    },

    updatePreviewScale: function () {
        if (this.previewMode !== 'desktop') {
            const container = document.getElementById('pageBuilderPreviewRoot');
            if (container) {
                container.style.transform = '';
                container.style.width = '';
            }
            return;
        }

        const viewport = document.getElementById('previewViewport');
        const container = document.getElementById('pageBuilderPreviewRoot');
        if (!viewport || !container) return;

        const availableWidth = viewport.clientWidth - 40; // 減去 padding
        const targetWidth = 1200;

        if (availableWidth < targetWidth) {
            const scale = availableWidth / targetWidth;
            container.style.transform = `scale(${scale})`;
            container.style.width = `${targetWidth}px`;
        } else {
            container.style.transform = '';
            container.style.width = '100%';
        }
    }
};
