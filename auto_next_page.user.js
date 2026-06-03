// ==UserScript==
// @name         自动点击下一页
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  自动识别并点击页面上的"下一页"按钮，支持自定义间隔时间和最大页数
// @author       You
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 安全检查：确保 document.body 存在
    if (!document.body) {
        console.error('[自动翻页] document.body 不存在，脚本退出');
        return;
    }

    // ==================== 配置区域 ====================
    const CONFIG = {
        // 翻页间隔时间（毫秒）
        delay: 3000,

        // 最大翻页次数（0表示无限）
        maxPages: 0,

        // 是否启用自动翻页
        enabled: true
    };

    // ==================== 核心功能 ====================

    let currentPage = 1;
    let isRunning = false;
    let timer = null;

    // 创建控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'auto-next-page-panel';
        panel.innerHTML = `
            <style>
                #auto-next-page-panel {
                    position: fixed;
                    top: 100px;
                    right: 20px;
                    width: 200px;
                    background: white;
                    border: 2px solid #4CAF50;
                    border-radius: 8px;
                    padding: 15px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 99999;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                }
                #auto-next-page-panel h3 {
                    margin: 0 0 10px 0;
                    color: #333;
                    font-size: 16px;
                }
                #auto-next-page-panel .status {
                    margin: 8px 0;
                    padding: 5px;
                    border-radius: 4px;
                    text-align: center;
                    font-weight: bold;
                }
                #auto-next-page-panel .status.running {
                    background: #e8f5e9;
                    color: #2e7d32;
                }
                #auto-next-page-panel .status.stopped {
                    background: #ffebee;
                    color: #c62828;
                }
                #auto-next-page-panel button {
                    width: 100%;
                    padding: 8px;
                    margin: 5px 0;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.3s;
                }
                #auto-next-page-panel .btn-start {
                    background: #4CAF50;
                    color: white;
                }
                #auto-next-page-panel .btn-start:hover {
                    background: #45a049;
                }
                #auto-next-page-panel .btn-stop {
                    background: #f44336;
                    color: white;
                }
                #auto-next-page-panel .btn-stop:hover {
                    background: #da190b;
                }
                #auto-next-page-panel input {
                    width: 100%;
                    padding: 5px;
                    margin: 5px 0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                #auto-next-page-panel .info {
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
            <h3>🔄 自动翻页</h3>
            <div class="status stopped" id="anp-status">已停止</div>
            <div>
                <label>间隔(秒):</label>
                <input type="number" id="anp-delay" value="${CONFIG.delay / 1000}" min="1" max="60" step="0.5">
            </div>
            <div>
                <label>最大页数(0=无限):</label>
                <input type="number" id="anp-max" value="${CONFIG.maxPages}" min="0" max="1000">
            </div>
            <button class="btn-start" id="anp-start">▶ 开始</button>
            <button class="btn-stop" id="anp-stop" style="display:none">⏹ 停止</button>
            <div class="info">
                当前页: <span id="anp-current">1</span><br>
                已翻页: <span id="anp-count">0</span>
            </div>
        `;

        document.body.appendChild(panel);

        // 绑定事件
        document.getElementById('anp-start').addEventListener('click', start);
        document.getElementById('anp-stop').addEventListener('click', stop);
    }

    // 检查元素内是否有箭头图标（Font Awesome, Material Icons, Glyphicon, Ant Design, SVG 等）
    function hasArrowIcon(el) {
        const iconSelectors = [
            // Ant Design
            '.anticon-right', '.anticon-arrow-right', '.anticon-double-right', '.anticon-caret-right',
            // Font Awesome
            '.fa-chevron-right', '.fa-arrow-right', '.fa-angle-right', '.fa-caret-right',
            '.fa-chevron-circle-right', '.fas.fa-forward',
            // Glyphicon
            '.glyphicon-chevron-right', '.glyphicon-arrow-right',
            // Material Icons
            '.material-icons',
            // Element UI
            '.el-icon-arrow-right', '.el-icon-right', '.el-icon-d-arrow-right',
            // Generic
            '.icon-next', '.icon-arrow-right', '.pagination-next i', '.next i',
            // SVG
            'svg[class*="arrow"]', 'svg[class*="chevron"]', 'svg[class*="right"]',
            'svg[data-icon="right"]', 'svg[data-icon="arrow-right"]'
        ];
        for (let sel of iconSelectors) {
            try {
                if (el.querySelector(sel)) return true;
            } catch (e) {}
        }
        return false;
    }

    // 检查文本是否就是一个箭头符号
    function isArrowOnlyText(text) {
        const arrows = ['›', '»', '→', '>', '≫', '▶', '▸', '⏩', '⇥', 'next'];
        const t = text.trim().toLowerCase();
        return arrows.some(a => t === a || t === a + ';');
    }

    // 查找下一页按钮
    function findNextButton() {
        // 检查是否是跳页/省略号按钮（应跳过）
        function isJumpOrSkip(el) {
            const cls = (el.className || '').toLowerCase();
            if (cls.includes('jump') || cls.includes('skip')) return true;
            const txt = (el.textContent || '').trim();
            // 省略号文本，如 ••• 或 ...
            if (/^[•.…]{2,}$/.test(txt)) return true;
            return false;
        }

        // ========== 方法1: 遍历所有可点击元素，通过文本/图标匹配 ==========
        const clickableEls = document.querySelectorAll('a, button, span[role="button"], div[role="button"]');
        for (let el of clickableEls) {
            if (isCurrentPage(el) || !isElementVisible(el) || isJumpOrSkip(el)) continue;

            const fullText = (el.textContent || '').trim();
            const fullTextLower = fullText.toLowerCase();
            const title = (el.getAttribute('title') || '').trim().toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();

            // 1a: 文本关键词匹配（includes，中文/英文）
            const textKeys = ['下一页', '下一頁', '下页', '后页', 'next page'];
            if (textKeys.some(k => fullTextLower.includes(k) || title.includes(k) || ariaLabel.includes(k))) {
                return el;
            }

            // 1b: 箭头符号精确匹配（文本短且就是箭头本身）
            if (isArrowOnlyText(fullText)) {
                return el;
            }

            // 1c: 元素内含箭头图标 + 无实质文本 = 下一页按钮
            if (fullText.length <= 5 && hasArrowIcon(el)) {
                return el;
            }
        }

        // ========== 方法2: CSS选择器直接匹配 ==========
        // 关键: 必须排除 jump-next / jump / skip / prev 等干扰项
        const cssSelectors = [
            // Ant Design (antd) - 精确匹配 next，排除 jump-next
            'li.ant-pagination-next:not(.ant-pagination-disabled) button',
            'li.ant-pagination-next:not(.ant-pagination-disabled) a',
            'li.ant-pagination-next:not(.ant-pagination-disabled)',
            '.ant-pagination-next:not(.ant-pagination-disabled)',
            '.ant-pagination-next .ant-pagination-item-link',
            // Element UI
            '.el-pagination__next:not(.disabled)',
            '.btn-next:not(.disabled)',
            // Bootstrap / 通用分页
            '.pagination-next:not(.disabled):not([disabled])',
            '.page-item.next:not(.disabled)',
            '.page-link[aria-label*="Next" i]',
            // DataTables
            '.paginate_button.next:not(.disabled)',
            // 常见命名
            '.next:not(.disabled):not([disabled])',
            '.page-next:not(.disabled):not([disabled])',
            '#nextPage:not(.disabled):not([disabled])',
            '#next_page:not(.disabled):not([disabled])',
            '.next-page:not(.disabled):not([disabled])',
            '.pager__item--next:not(.disabled)',
            // 属性选择器
            'a[rel="next"]:not([disabled])',
            '[aria-label="Next"]:not([disabled])',
            '[aria-label="next"]:not([disabled])',
            '[aria-label="下一页"]:not([disabled])',
            // class 子串匹配（兜底，必须排除 jump/skip/prev）
            'button[class*="next" i]:not([class*="jump" i]):not([class*="skip" i]):not([class*="disabled" i]):not([disabled])',
            'a[class*="next" i]:not([class*="jump" i]):not([class*="skip" i]):not([class*="prev" i]):not([class*="disabled" i])',
            'li[class*="next" i]:not([class*="jump" i]):not([class*="skip" i]):not([class*="disabled" i]) a'
        ];
        for (let sel of cssSelectors) {
            try {
                const btn = document.querySelector(sel);
                if (btn && isElementVisible(btn)) return btn;
            } catch (e) {}
        }

        // ========== 方法3: 在分页容器中找"下一页" ==========
        const paginationSelectors = [
            // Ant Design
            '.ant-pagination',
            'ul.ant-pagination',
            // Element UI
            '.el-pagination',
            '.el-pager',
            // Bootstrap / 通用
            '.pagination', '.page-nav', '.paging', '.pager',
            '.paginate', '.pagination-container', '.page-navigation',
            // 语义化
            'nav[aria-label*="page" i]', 'nav[aria-label*="Page" i]',
            'nav[aria-label*="分页" i]',
            // 子串兜底
            'div[class*="pagin" i]', 'ul[class*="pagin" i]',
            'div[class*="page-nav" i]', 'div[class*="pager" i]'
        ];
        for (let sel of paginationSelectors) {
            try {
                const areas = document.querySelectorAll(sel);
                for (let area of areas) {
                    const links = area.querySelectorAll('a:not(.disabled):not([disabled]), button:not(.disabled):not([disabled])');
                    const visibleLinks = Array.from(links).filter(l => isElementVisible(l) && !isCurrentPage(l) && !isJumpOrSkip(l));
                    if (visibleLinks.length === 0) continue;

                    // 优先找带 next 语义的（排除 jump）
                    for (let link of visibleLinks) {
                        const cls = (link.className || '').toLowerCase();
                        const txt = (link.textContent || '').trim().toLowerCase();
                        const lbl = (link.getAttribute('aria-label') || '').toLowerCase();
                        if ((cls.includes('next') && !cls.includes('jump')) ||
                            txt.includes('下一页') || isArrowOnlyText(txt) ||
                            (lbl.includes('next') && !lbl.includes('jump'))) {
                            return link;
                        }
                    }
                    // 回退：从后往前找，跳过省略号按钮
                    for (let i = visibleLinks.length - 1; i >= 0; i--) {
                        const txt = (visibleLinks[i].textContent || '').trim();
                        if (!/^[•.…\d]+$/.test(txt)) {
                            return visibleLinks[i];
                        }
                    }
                    // 全跳过了就用最后一个
                    return visibleLinks[visibleLinks.length - 1];
                }
            } catch (e) {}
        }

        // ========== 方法4: 全页范围，找最后一个可能是"下一页"的链接 ==========
        // 有些网站分页不在容器里，散落在外层
        const allVisibleLinks = Array.from(document.querySelectorAll('a'))
            .filter(l => isElementVisible(l) && !isCurrentPage(l) && !isJumpOrSkip(l));

        // 优先找有 next/下一页 语义的（排除 jump）
        for (let link of allVisibleLinks) {
            const cls = (link.className || '').toLowerCase();
            const txt = (link.textContent || '').trim().toLowerCase();
            if ((cls.includes('next') && !cls.includes('jump')) || txt.includes('下一页')) {
                return link;
            }
        }
        // 再找纯箭头的
        for (let link of allVisibleLinks) {
            if (isArrowOnlyText(link.textContent || '') || hasArrowIcon(link)) {
                return link;
            }
        }

        return null;
    }

    // 检查元素是否可见
    function isElementVisible(element) {
        if (!element || !element.offsetParent) {
            // offsetParent 为 null 可能表示 display:none 或元素不在DOM中
            // 但对于 position:fixed 的元素 offsetParent 也是 null，所以额外检查
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
            // 如果 computedStyle 没问题但 offsetParent 为 null，可能是 fixed 定位，视为可见
            return true;
        }
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
    }

    // 检查是否是当前页
    function isCurrentPage(element) {
        return element.classList.contains('active') ||
               element.classList.contains('current') ||
               element.getAttribute('aria-current') === 'page' ||
               element.classList.contains('disabled') ||
               element.hasAttribute('disabled');
    }

    // 点击下一页
    function clickNext() {
        const nextBtn = findNextButton();

        if (!nextBtn) {
            console.log('[自动翻页] 未找到下一页按钮，翻页结束');
            updateStatus('未找到下一页', 'stopped');
            stop();
            return false;
        }

        console.log('[自动翻页] 点击下一页:', nextBtn.textContent.trim() || nextBtn.title || nextBtn.tagName);
        nextBtn.click();
        return true;
    }

    // 更新状态显示
    function updateStatus(text, type) {
        const statusEl = document.getElementById('anp-status');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = 'status ' + type;
        }
    }

    // 更新统计
    function updateStats() {
        const currentEl = document.getElementById('anp-current');
        const countEl = document.getElementById('anp-count');
        if (currentEl) currentEl.textContent = currentPage;
        if (countEl) countEl.textContent = currentPage - 1;
    }

    // 开始自动翻页
    function start() {
        if (isRunning) return;

        // 获取用户设置的参数
        const delayInput = document.getElementById('anp-delay');
        const maxInput = document.getElementById('anp-max');

        if (delayInput) {
            const val = parseFloat(delayInput.value);
            if (!isNaN(val) && val > 0) {
                CONFIG.delay = val * 1000;
            }
        }
        if (maxInput) {
            const val = parseInt(maxInput.value);
            if (!isNaN(val) && val >= 0) {
                CONFIG.maxPages = val;
            }
        }

        isRunning = true;
        currentPage = 1;

        // 更新UI
        updateStatus('运行中...', 'running');
        const startBtn = document.getElementById('anp-start');
        const stopBtn = document.getElementById('anp-stop');
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';

        console.log('[自动翻页] 已启动，间隔:', CONFIG.delay, 'ms');

        // 执行第一次翻页
        doNextPage();
    }

    // 执行翻页
    function doNextPage() {
        if (!isRunning) return;

        // 检查最大页数限制
        if (CONFIG.maxPages > 0 && currentPage >= CONFIG.maxPages) {
            console.log('[自动翻页] 已达到最大页数限制');
            updateStatus('已达最大页数', 'stopped');
            stop();
            return;
        }

        // 点击下一页
        if (clickNext()) {
            currentPage++;
            updateStats();

            // 设置下一次点击的定时器
            timer = setTimeout(() => {
                // 等待页面加载完成后再翻下一页
                waitForPageLoad().then(() => {
                    doNextPage();
                });
            }, CONFIG.delay);
        }
    }

    // 等待页面加载
    function waitForPageLoad() {
        return new Promise((resolve) => {
            // 给页面足够时间完成DOM更新
            setTimeout(() => {
                resolve();
            }, 1000);
        });
    }

    // 停止自动翻页
    function stop() {
        isRunning = false;
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        // 更新UI
        updateStatus('已停止', 'stopped');
        const startBtn = document.getElementById('anp-start');
        const stopBtn = document.getElementById('anp-stop');
        if (startBtn) startBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'none';

        console.log('[自动翻页] 已停止');
    }

    // 初始化
    function init() {
        console.log('[自动翻页] 脚本已加载');
        createControlPanel();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
