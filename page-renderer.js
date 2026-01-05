/**
 * Modular Page Renderer (Visual Version) v2.1
 * - GitHub Direct Access for faster loading
 * - Footer section rendering
 * - Dynamic spacing support
 * - KOL Store Mode support
 */
const PageRenderer = {
    // GitHub Raw URL for layout config
    LAYOUT_URL: 'https://raw.githubusercontent.com/vvstudiocode/korea/main/layout.json',

    // KOL 商店 ID (由 app.js 傳入)
    currentStoreId: null,

    init: async function (storeId = null) {
        console.log('🚀 PageRenderer v2.1 Initialized' + (storeId ? ` (Store: ${storeId})` : ''));

        // 儲存 storeId 供其他方法使用
        this.currentStoreId = storeId;

        const container = document.getElementById('pageBuilderRoot');
        if (!container) return;

        // 1. 立即從快取讀取並渲染 (防止閃爍)
        const cachedLayout = localStorage.getItem('omo_cached_layout');
        if (cachedLayout) {
            try {
                const parsed = JSON.parse(cachedLayout);
                this.render(container, parsed.sections || parsed);
                this.renderFooter(parsed.footer);
                this.applyGlobalSettings(parsed.global);
            } catch (e) { console.error('Cache parse error', e); }
        } else {
            // 如果沒快取，顯示載入狀態
            container.innerHTML = '<div class="section-container" style="padding: 100px 0; text-align: center; opacity: 0.5;">載入自訂排版中...</div>';
        }

        // 2. 非同步從 GitHub 獲取最新排版
        const layout = await this.fetchLayout();
        if (layout) {
            // 更新快取
            localStorage.setItem('omo_cached_layout', JSON.stringify(layout));
            // 重新渲染最新內容
            this.render(container, layout.sections || layout);
            this.renderFooter(layout.footer);
            this.applyGlobalSettings(layout.global);
        }

        // 3. 移除 Loading 動畫
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 500); // 稍微延遲讓體驗更平順
        }
    },


    fetchLayout: async function () {
        // 預設排版 (fallback)
        const FALLBACK_LAYOUT = {
            sections: [
                {
                    type: 'hero',
                    title: 'Welcome to OMO Select',
                    subtitle: 'Discover the best Korean products',
                    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200'
                },
                { type: 'categories' },
                {
                    type: 'products',
                    title: '輪播圖',
                    category: '全部',
                    limit: 8
                },
                {
                    type: 'product_list',
                    title: '最新商品',
                    category: '全部',
                    limit: 20
                }
            ],
            footer: null
        };

        try {
            // 優先從 GitHub Raw 直接讀取 (加上時間戳避免快取)
            const response = await fetch(this.LAYOUT_URL + '?_=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Layout loaded from GitHub');
                return data;
            }
        } catch (err) {
            console.warn('⚠️ GitHub fetch failed, trying GAS API...');
        }

        // Fallback: 嘗試從 GAS API 讀取
        try {
            const apiUrl = typeof GAS_API_URL !== 'undefined' ? GAS_API_URL : '';
            if (apiUrl) {
                const response = await fetch(`${apiUrl}?action=getSiteSettings`);
                const result = await response.json();
                if (result.success && result.data.settings && result.data.settings.homepage_layout) {
                    const sections = JSON.parse(result.data.settings.homepage_layout);
                    return { sections: sections, footer: null };
                }
            }
        } catch (err) {
            console.warn('⚠️ GAS API also failed, using fallback layout.');
        }

        return FALLBACK_LAYOUT;
    },

    render: async function (container, layout) {
        if (!container || !layout) return;
        container.innerHTML = '';

        // 支援傳入 sections 陣列或完整 layout 物件
        const sections = Array.isArray(layout) ? layout : (layout.sections || layout);

        for (const [index, comp] of sections.entries()) {
            const section = document.createElement('section');
            section.className = `page-section section-${comp.type}`;
            section.setAttribute('data-comp-index', index);

            // 套用動態間距
            if (comp.marginTop) section.style.marginTop = comp.marginTop + 'px';
            if (comp.marginBottom) section.style.marginBottom = comp.marginBottom + 'px';

            switch (comp.type) {
                case 'hero':
                    section.innerHTML = this.templateHero(comp);
                    break;
                case 'categories':
                    section.innerHTML = this.templateCategories(comp);
                    break;
                case 'products':
                case 'product_list':
                    await this.renderProducts(section, comp);
                    break;
                case 'info_section':
                    section.innerHTML = this.templateInfoSection(comp);
                    break;
                case 'announcement':
                    section.innerHTML = this.templateAnnouncement(comp);
                    break;
                case 'image_carousel':
                    this.renderImageCarousel(section, comp);
                    break;
                case 'single_image':
                    section.innerHTML = this.templateSingleImage(comp);
                    break;
                case 'text_combination':
                    section.innerHTML = this.templateTextCombination(comp);
                    break;
                case 'custom_code':
                    const content = comp.htmlContent || '';

                    // 檢查是否為完整 HTML 文件 (包含 doctype, html, head 或 body 標籤)
                    // 使用簡單的正規表達式或檢查字串
                    const isFullPage = /<!DOCTYPE|<html|<head|<body/i.test(content);

                    if (isFullPage) {
                        // 使用 IFrame 渲染完整頁面以避免樣式衝突與確保結構正確
                        const iframe = document.createElement('iframe');
                        iframe.style.cssText = 'width:100%; border:none; display:block; visibility:hidden;'; // 預設隱藏，調整完高度再顯示

                        // 為了讓 IFrame 自動調整高度，我們需要在載入後計算
                        iframe.onload = function () {
                            const doc = iframe.contentWindow.document;
                            const updateHeight = () => {
                                // 嘗試取得內容高度
                                const height = Math.max(
                                    doc.body.scrollHeight,
                                    doc.body.offsetHeight,
                                    doc.documentElement.scrollHeight
                                );
                                iframe.style.height = height + 'px';
                                iframe.style.visibility = 'visible';
                            };

                            // 稍微延遲並多次檢查，因為有些內容 (如圖片, tailwind) 可能需要時間渲染
                            updateHeight();
                            setTimeout(updateHeight, 100);
                            setTimeout(updateHeight, 500);
                            setTimeout(updateHeight, 1000);

                            // 監聽 iframe 內的 resize (如果支援)
                            if (iframe.contentWindow.ResizeObserver) {
                                const ro = new iframe.contentWindow.ResizeObserver(updateHeight);
                                ro.observe(doc.body);
                            }
                        };

                        section.appendChild(iframe);

                        // 寫入內容
                        // 寫入內容 (延遲執行以確保 IFrame 已被加入 DOM)
                        setTimeout(() => {
                            try {
                                const doc = iframe.contentDocument || iframe.contentWindow.document;
                                doc.open();
                                doc.write(content);
                                doc.close();
                            } catch (e) {
                                console.error('IFrame Write Error:', e);
                            }
                        }, 10);

                    } else {
                        // 一般片段：使用原有邏輯
                        section.innerHTML = content;

                        // 依序執行 script 以確保依賴關係 (如 tailwind) 正確載入
                        const scripts = Array.from(section.querySelectorAll('script'));

                        const runScripts = (index) => {
                            if (index >= scripts.length) return;

                            const oldScript = scripts[index];
                            const newScript = document.createElement('script');

                            // 複製屬性
                            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));

                            if (oldScript.src) {
                                // 外部腳本：等待載入完成後再執行下一個
                                newScript.onload = () => runScripts(index + 1);
                                newScript.onerror = () => {
                                    console.error('Script load failed:', oldScript.src);
                                    runScripts(index + 1);
                                };
                                oldScript.parentNode.replaceChild(newScript, oldScript);
                            } else {
                                // 內聯腳本：直接執行並接續下一個
                                newScript.textContent = oldScript.textContent;
                                oldScript.parentNode.replaceChild(newScript, oldScript);
                                runScripts(index + 1);
                            }
                        };

                        if (scripts.length > 0) {
                            runScripts(0);
                        }
                    }
                    break;
            }
            container.appendChild(section);
        }

        // 重新觀察新加入的元素 (動畫)
        if (typeof observeElements === 'function') observeElements();
    },

    // 渲染頁尾區塊
    renderFooter: function (footerData) {
        const footer = document.querySelector('.site-footer');
        if (!footer || !footerData) return;

        // 渲染購買須知
        const footerSection = footer.querySelector('.footer-section ul');
        if (footerSection && footerData.notices && footerData.notices.length > 0) {
            footerSection.innerHTML = footerData.notices.map(notice => `
                <li class="section-header"><strong>${notice.title}</strong></li>
                ${notice.content.split('\n').map(line => `<li>${line}</li>`).join('')}
            `).join('');
        }

        // 渲染社群連結
        const socialIcons = footer.querySelector('.social-icons');
        if (socialIcons && footerData.socialLinks) {
            const links = footerData.socialLinks;
            socialIcons.innerHTML = `
                ${links.line ? `<a href="${links.line}" target="_blank" rel="noopener noreferrer">
                    <img src="https://raw.githubusercontent.com/vvstudiocode/korea/main/line.png" alt="Line" loading="lazy">
                </a>` : ''}
                ${links.instagram ? `<a href="${links.instagram}" target="_blank" rel="noopener noreferrer">
                    <img src="https://raw.githubusercontent.com/vvstudiocode/korea/main/instagram.png" alt="Instagram" loading="lazy">
                </a>` : ''}
                ${links.threads ? `<a href="${links.threads}" target="_blank" rel="noopener noreferrer">
                    <img src="https://raw.githubusercontent.com/vvstudiocode/korea/main/threads.png" alt="Threads" loading="lazy">
                </a>` : ''}
            `;
        }

        // 渲染版權聲明
        const copyright = footer.querySelector('.footer-copyright');
        if (copyright && footerData.copyright) {
            // 保留社群連結 div，只更新文字
            const socialDiv = copyright.querySelector('.social-icons');
            const socialHTML = socialDiv ? socialDiv.outerHTML : '';
            copyright.innerHTML = socialHTML + '\n' + footerData.copyright;
        }
    },

    applyGlobalSettings: function (global) {
        if (!global) return;

        // 設定 CSS 變數或直接改 Body 樣式
        document.documentElement.style.setProperty('--site-bg-color', global.backgroundColor || '#ffffff');
        document.documentElement.style.setProperty('--site-font-family', global.fontFamily || 'Noto Sans TC');
        document.documentElement.style.setProperty('--site-base-font-size', global.fontSize || '16px');

        // 直接套用到 body (或主要容器)
        document.body.style.backgroundColor = global.backgroundColor || '#ffffff';
        document.body.style.fontFamily = global.fontFamily || 'Noto Sans TC';
        document.body.style.fontSize = global.fontSize || '16px';
    },

    templateAnnouncement: function (comp) {
        const bgStyle = comp.bgTransparent ? 'background: transparent; border-bottom:1px solid #eee;' : `background-color: ${comp.bgColor || '#f3f4f6'};`;
        return `
            <div class="announcement-bar" style="${bgStyle} text-align: ${comp.textAlign || 'center'}">
                <div class="announcement-content">
                    ✨ ${comp.text || '歡迎光臨 OMO Select！'} ✨
                </div>
            </div>
        `;
    },

    templateSingleImage: function (comp) {
        const fullWidth = comp.fullWidth;
        // 如果全寬，則寬度設為 100%，否則使用使用者設定的寬度
        const widthDesktop = fullWidth ? '100%' : (comp.widthDesktop || '100%');
        const widthMobile = fullWidth ? '100%' : (comp.widthMobile || '100%');

        // 容器樣式：如果不是全寬，則限制最大寬度並置中
        const containerStyle = fullWidth ?
            'width: 100%;' :
            'max-width: 1200px; margin: 0 auto; padding: 0 20px;';

        const linkStart = comp.link ? `<a href="${comp.link}" style="display:block;">` : '';
        const linkEnd = comp.link ? '</a>' : '';
        const altText = comp.alt || '';

        // 使用唯一的 class name 防止衝突
        const uid = 'img-' + Math.random().toString(36).substr(2, 9);

        return `
            <div class="single-image-section ${uid}" style="${containerStyle} text-align: ${comp.textAlign || 'center'}; position:relative;">
                ${linkStart}
                    <!-- Desktop Image -->
                    <img src="${comp.imageDesktop}" alt="${altText}" class="img-desktop" loading="lazy" style="width: ${widthDesktop}; height: auto; max-width: 100%; margin: 0 auto;">
                    
                    <!-- Mobile Image -->
                    <img src="${comp.imageMobile || comp.imageDesktop}" alt="${altText}" class="img-mobile" loading="lazy" style="width: ${widthMobile}; height: auto; max-width: 100%; margin: 0 auto;">
                ${linkEnd}
                <style>
                    .${uid} .img-desktop { display: block; }
                    .${uid} .img-mobile { display: none; }
                    @media (max-width: 768px) {
                        .${uid} .img-desktop { display: none; }
                        .${uid} .img-mobile { display: block; }
                    }
                </style>
            </div>
        `;
    },

    templateHero: function (comp) {
        const align = comp.textAlign || 'center';
        const alignItems = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
        const imgDesktop = comp.image || '';
        const imgMobile = comp.imageMobile || imgDesktop;
        const uid = 'hero-' + Math.random().toString(36).substr(2, 9);

        return `
            <div class="hero-banner ${uid}">
                <div class="hero-bg-desktop" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.4)), url('${imgDesktop}')"></div>
                <div class="hero-bg-mobile" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.4)), url('${imgMobile}')"></div>
                <div class="hero-content" style="text-align: ${align}; align-items: ${alignItems}">
                    <h1>${comp.title || ''}</h1>
                    <p>${comp.subtitle || ''}</p>
                    ${comp.buttonText ? `<a href="${comp.buttonLink || '#'}" class="cta-button">${comp.buttonText}</a>` : ''}
                </div>
                <style>
                    .${uid} { position: relative; overflow: hidden; }
                    .${uid} .hero-bg-desktop, .${uid} .hero-bg-mobile {
                        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                        background-size: cover; background-position: center; z-index: -1;
                        transition: opacity 0.3s;
                    }
                    .${uid} .hero-bg-desktop { display: block; }
                    .${uid} .hero-bg-mobile { display: none; }
                    @media (max-width: 768px) {
                        .${uid} .hero-bg-desktop { display: none; }
                        .${uid} .hero-bg-mobile { display: block; }
                    }
                </style>
            </div>
        `;
    },

    templateCategories: function (comp) {
        // 抓取現有分類 (假設全域有 categories 或從商店資料拿)
        const categories = ['全部', '美妝保養', '流行服飾', '生活用品', '零食食品'];
        const items = categories.map(cat => `
            <div class="category-pill" onclick="filterByCategory('${cat}')">
                <span>${cat}</span>
            </div>
        `).join('');

        return `
            <div class="section-container">
                ${comp.title ? `<div class="section-header" style="text-align:${comp.textAlign || 'left'}"><h2>${comp.title}</h2></div>` : ''}
                <div class="category-scroll">
                    ${items}
                </div>
            </div>
        `;
    },

    templateProductList: function (comp) {
        return `
            <div class="section-container">
                <div class="section-header" style="text-align:${comp.textAlign || 'left'}; justify-content:${comp.textAlign === 'center' ? 'center' : (comp.textAlign === 'right' ? 'flex-end' : 'space-between')}">
                    <h2>${comp.title || '輪播圖'}</h2>
                    <a href="#" class="view-all">查看全部 →</a>
                </div>
                <div class="products-grid" id="grid-${Math.random().toString(36).substr(2, 9)}">
                    <div class="loading-spinner">載入中...</div>
                </div>
            </div>
        `;
    },

    templateInfoSection: function (comp) {
        const isRight = comp.layout === 'right';
        const ratio = comp.ratio || '1:1';
        const imgDesktop = comp.image || '';
        const imgMobile = comp.imageMobile || imgDesktop;
        const uid = 'info-' + Math.random().toString(36).substr(2, 9);
        const ratioStyle = ratio === 'original' ? 'auto' : ratio.replace(':', '/');

        return `
            <div class="section-container ${uid}">
                <div class="info-grid-flex" style="display:flex; flex-direction: ${isRight ? 'row-reverse' : 'row'}; align-items:center; gap:4rem;">
                    <div class="info-image" style="flex:1;">
                        <div class="info-img-desktop" style="width:100%; aspect-ratio:${ratioStyle}; background:url('${imgDesktop}') center/cover no-repeat; border-radius:12px;"></div>
                        <div class="info-img-mobile" style="width:100%; aspect-ratio:${ratioStyle}; background:url('${imgMobile}') center/cover no-repeat; border-radius:12px;"></div>
                    </div>
                    <div class="info-text" style="flex:1; text-align: ${comp.textAlign || 'left'}; padding: 20px;">
                        <h3>${comp.title || ''}</h3>
                        <p style="white-space: pre-wrap;">${comp.subtitle || ''}</p>
                        ${comp.buttonText ? `<a href="${comp.buttonLink || '#'}" class="text-link">${comp.buttonText}</a>` : ''}
                    </div>
                </div>
                <style>
                    .${uid} .info-img-desktop { display: block; }
                    .${uid} .info-img-mobile { display: none; }
                    @media (max-width: 768px) {
                        .info-grid-flex { flex-direction: column !important; gap: 2rem !important; }
                        .${uid} .info-img-desktop { display: none; }
                        .${uid} .info-img-mobile { display: block; }
                    }
                </style>
            </div>
        `;
    },

    templateTextCombination: function (comp) {
        const align = comp.textAlign || 'center';
        return `
            <div class="section-container">
                <div class="text-combo-container" style="max-width:800px; margin:0 auto; text-align:${align}; padding: 20px 0;">
                    ${comp.title ? `<h2 style="font-size:2rem; margin-bottom:1rem; font-family:'Playfair Display', serif;">${comp.title}</h2>` : ''}
                    ${comp.subtitle ? `<div style="font-size:1rem; color:#888; margin-bottom:1.5rem; letter-spacing:1px; text-transform:uppercase;">${comp.subtitle}</div>` : ''}
                    ${comp.content ? `<div style="font-size:1.1rem; line-height:1.8; color:#444; margin-bottom:2rem; white-space:pre-wrap;">${comp.content}</div>` : ''}
                    ${comp.buttonText ? `
                        <a href="${comp.buttonLink || '#'}" class="product-btn" style="display:inline-block; width:auto; padding:10px 40px; border-radius:0;">
                            ${comp.buttonText}
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderImageCarousel: function (section, comp) {
        const fullWidth = comp.fullWidth;
        const ratioDesktop = comp.ratioDesktop || '21:9';
        const ratioMobile = comp.ratioMobile || '16:9';
        const speed = comp.speed !== undefined ? comp.speed : 3;
        const uniqueId = 'carousel-' + Math.random().toString(36).substr(2, 9);

        let containerStyle = fullWidth ? 'width:100%;' : 'max-width:1200px; margin:0 auto; padding:0 20px;';

        section.innerHTML = `
            <div class="image-carousel-container" style="${containerStyle}">
                <div id="${uniqueId}" class="swiper-wrapper no-scrollbar" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; -webkit-overflow-scrolling:touch;">
                    ${(comp.images || []).map(img => `
                        <a href="${img.link || '#'}" class="carousel-slide" style="flex:0 0 100%; scroll-snap-align:start; position:relative; display:block;">
                            <div class="ratio-box-desktop" style="display:block;">
                                <div style="aspect-ratio:${ratioDesktop.replace(':', '/')}; background:url('${img.src}') center/cover no-repeat;"></div>
                            </div>
                            <div class="ratio-box-mobile" style="display:none;">
                                <div style="aspect-ratio:${ratioMobile.replace(':', '/')}; background:url('${img.srcMobile || img.src}') center/cover no-repeat;"></div>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </div>
            <style>
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @media (max-width: 768px) {
                    .ratio-box-desktop { display: none !important; }
                    .ratio-box-mobile { display: block !important; }
                }
            </style>
            <script>
                (function() {
                    const container = document.getElementById('${uniqueId}');
                    if(!container) return;
                    const speed = ${speed} * 1000;
                    if(speed <= 0) return;

                    let scrolled = 0;
                    let direction = 1;
                    
                    setInterval(() => {
                        if(container.matches(':hover')) return; // 滑鼠懸停時暫停
                        
                        const itemWidth = container.offsetWidth;
                        const maxScroll = container.scrollWidth - container.clientWidth;
                        
                        // 計算目前是第幾張 (round)
                        let currentSlide = Math.round(container.scrollLeft / itemWidth);
                        let nextSlide = currentSlide + 1;
                        
                        if (nextSlide * itemWidth > maxScroll + 10) { // +10 for buffer
                            nextSlide = 0; // 回到第一張
                        }
                        
                        container.scrollTo({
                            left: nextSlide * itemWidth,
                            behavior: 'smooth'
                        });
                    }, speed);
                })();
            </script>
        `;

        // Execute the script manually since innerHTML scripts don't run automatically
        const script = section.querySelector('script');
        if (script) {
            const newScript = document.createElement('script');
            newScript.textContent = script.textContent;
            section.appendChild(newScript);
        }
    },

    renderProducts: async function (section, comp) {
        // 決定是否使用輪播（products 類型用輪播，product_list 用 grid）
        const useCarousel = comp.type === 'products';
        const itemsDesktop = comp.itemsDesktop || 4;
        const itemsMobile = comp.itemsMobile || 2;
        const ratio = comp.ratio || '1:1';

        section.innerHTML = `
            <div class="section-container">
                ${comp.title ? `<h2 class="section-title" style="text-align:${comp.textAlign || 'center'}">${comp.title}</h2>` : ''}
                ${useCarousel ? `
                    <div class="products-carousel-wrapper">
                        <button class="carousel-nav prev" onclick="PageRenderer.scrollCarousel(this, -1)">‹</button>
                    <div class="products-carousel" style="grid-auto-columns: calc(100% / ${itemsDesktop} - 20px);">
                            <div class="loading-spinner">商品載入中，請稍等</div>
                        </div>
                        <button class="carousel-nav next" onclick="PageRenderer.scrollCarousel(this, 1)">›</button>
                    </div>
                ` : `
                    <div class="products-grid" style="grid-template-columns: repeat(${itemsDesktop}, 1fr);">
                        <div class="loading-spinner">商品載入中，請稍等</div>
                    </div>
                `}
                <style>
                    @media (max-width: 768px) {
                        .products-carousel { grid-auto-columns: calc(100% / ${itemsMobile} - 10px) !important; }
                        .products-grid { grid-template-columns: repeat(${itemsMobile}, 1fr) !important; }
                    }
                    .product-card .card-img-box { aspect-ratio: ${ratio.replace(':', '/')} !important; }
                </style>
            </div>
        `;

        const container = useCarousel
            ? section.querySelector('.products-carousel')
            : section.querySelector('.products-grid');
        if (!container) return;

        try {
            // 兼容性處理：在後台使用 currentProducts，在前端使用 products
            let allProducts = typeof products !== 'undefined' ? products : (typeof currentProducts !== 'undefined' ? currentProducts : []);

            // 確保資料已加載
            if (allProducts.length === 0) {
                if (typeof loadProducts === 'function') {
                    await loadProducts();
                    allProducts = products;
                } else if (typeof fetchProducts === 'function') {
                    await fetchProducts(); // 管理後台的函數
                    allProducts = typeof currentProducts !== 'undefined' ? currentProducts : [];
                }
            }

            let filtered = [];

            // 根據來源類型篩選商品
            if (comp.sourceType === 'manual' && comp.productIds && comp.productIds.length > 0) {
                // 手動選擇：依照 ID 列表順序找出商品
                comp.productIds.forEach(pid => {
                    const found = allProducts.find(p => String(p.id) === String(pid));
                    if (found) filtered.push(found);
                });
            } else {
                // 分類篩選 (預設)
                filtered = allProducts;
                if (comp.category && comp.category !== '全部') {
                    filtered = allProducts.filter(p => p.category === comp.category);
                }
                // 只有自動篩選才需要限制數量，手動選擇則顯示全部已選
                const limit = parseInt(comp.limit) || 4;
                filtered = filtered.slice(0, limit);
            }

            container.innerHTML = '';
            if (filtered.length === 0) {
                const msg = comp.sourceType === 'manual' ? '尚未選擇展示商品' : '此分類暫無商品';
                container.innerHTML = `<div class="empty-msg">${msg}</div>`;
                return;
            }

            filtered.forEach(p => {
                // 確保 p.id 存在且 p.image 是字串
                if (!p.id) p.id = 'PID-' + Math.random().toString(36).substr(2, 5);
                const card = this.createFallbackProductCard(p);
                container.appendChild(card);
            });

            // 為輪播添加觸控滑動支援
            if (useCarousel) {
                this.initCarouselTouch(container);
            }
        } catch (err) {
            console.error('Failed to load products for section:', err);
            container.innerHTML = '<div class="error-msg">載入失敗</div>';
        }
    },

    // 輪播滑動功能
    scrollCarousel: function (btn, direction) {
        const wrapper = btn.closest('.products-carousel-wrapper');
        const carousel = wrapper.querySelector('.products-carousel');
        const scrollAmount = 300; // 每次滾動的距離
        carousel.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    },

    // 觸控滑動支援
    initCarouselTouch: function (carousel) {
        let isDown = false;
        let startX;
        let scrollLeft;

        carousel.addEventListener('mousedown', (e) => {
            isDown = true;
            carousel.style.cursor = 'grabbing';
            startX = e.pageX - carousel.offsetLeft;
            scrollLeft = carousel.scrollLeft;
        });

        carousel.addEventListener('mouseleave', () => {
            isDown = false;
            carousel.style.cursor = 'grab';
        });

        carousel.addEventListener('mouseup', () => {
            isDown = false;
            carousel.style.cursor = 'grab';
        });

        carousel.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - carousel.offsetLeft;
            const walk = (x - startX) * 2;
            carousel.scrollLeft = scrollLeft - walk;
        });
    },

    createFallbackProductCard: function (p) {
        const card = document.createElement('div');
        card.className = 'product-card system-card';
        card.style.cssText = 'display:block; width:100%; text-align:center; cursor:pointer; background:transparent;';
        card.setAttribute('data-id', p.id);
        card.onclick = () => { if (typeof showProductDetail === 'function') showProductDetail(p.id); };

        try {
            // 圖片網址處理
            let imageUrl = 'https://via.placeholder.com/400?text=No+Image';
            const rawImg = p.image || p.prodImage || p.img || '';
            const imgStr = String(rawImg).trim();
            if (imgStr && imgStr !== '' && imgStr !== 'undefined' && imgStr !== 'null') {
                imageUrl = imgStr.split(',')[0].trim();
            }

            const hasOptions = p.options && (typeof p.options === 'string' ? p.options !== '{}' : Object.keys(p.options).length > 0);

            // 判斷庫存狀態
            // 判斷庫存狀態
            // 若有規格，檢查是否所有規格都已售完；否則檢查主庫存
            let isSoldOut = false;
            if (hasOptions && p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                const hasVariantStock = p.variants.some(v => Number(v.stock) > 0);
                isSoldOut = !hasVariantStock;
            } else {
                const stockVal = Number(p.stock !== undefined ? p.stock : 999);
                isSoldOut = stockVal <= 0;
            }

            let btnText;
            if (isSoldOut) {
                btnText = '已售完';
            } else {
                btnText = hasOptions ? '選擇規格' : '加入購物車';
            }

            // 使用 DOM 建立元素避免 HTML 跳脫問題
            const imgBox = document.createElement('div');
            imgBox.className = 'card-img-box';
            imgBox.style.cssText = 'width:100%; aspect-ratio:1/1; background:#f5f5f5; border-radius:12px; overflow:hidden; margin-bottom:15px; position:relative;';

            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = p.name || '';
            img.loading = 'lazy';
            img.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
            img.onerror = function () {
                this.style.display = 'none';
                this.parentElement.innerHTML = '<div style="padding:80px 10px; color:#999;">⚠️ 圖片載入失敗</div>';
            };
            imgBox.appendChild(img);

            const infoBox = document.createElement('div');
            infoBox.className = 'card-info-box';
            infoBox.style.cssText = 'padding:0; width:100%;';

            const title = document.createElement('h3');
            title.style.cssText = 'font-size:1.1rem; font-weight:500; margin-bottom:8px; height:2.8em; line-height:1.4; overflow:hidden; color:#333; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;';
            title.textContent = p.name || '';

            const price = document.createElement('div');
            price.style.cssText = 'font-weight:700; font-size:1.1rem; margin-bottom:12px; color:#333;';
            price.textContent = 'NT$ ' + (p.price || 0);

            const btn = document.createElement('button');
            if (isSoldOut) {
                btn.className = 'card-add-btn sold-out';
                btn.style.cssText = 'width:100%; padding:12px; background:#ccc; color:#fff; border:none; border-radius:30px; cursor:not-allowed; font-weight:500;';
                btn.disabled = true;
            } else {
                btn.className = 'card-add-btn';
                btn.style.cssText = 'width:100%; padding:12px; background:#D68C94; color:white; border:none; border-radius:30px; cursor:pointer; font-weight:500; transition: background 0.3s;';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (hasOptions) {
                        if (typeof showProductDetail === 'function') showProductDetail(p.id);
                    } else {
                        if (typeof addToCartById === 'function') addToCartById(p.id);
                    }
                };
            }
            btn.textContent = btnText;

            infoBox.appendChild(title);
            infoBox.appendChild(price);
            infoBox.appendChild(btn);

            card.appendChild(imgBox);
            card.appendChild(infoBox);

        } catch (e) {
            console.error('Render Card Error:', e);
            card.innerHTML = `<div style="padding:20px; border:1px solid red; color:red;">商品渲染錯誤: ${p ? p.name : 'Unknown'}</div>`;
        }

        return card;
    }
};
