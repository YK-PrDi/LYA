#!/usr/bin/env node
/**
 * pdd_listing.js — 拼多多商品自动发布脚本
 *
 * 使用方式：
 *   node pdd_listing.js                    # 从 stdin 读取 JSON 配置
 *   node pdd_listing.js --login-only       # 仅登录并保存 cookies
 *   node pdd_listing.js --dry-run          # 截图验证每步，不实际提交
 *
 * 配置通过环境变量 PDD_CONFIG 或 stdin 传入（JSON 格式）
 *
 * 进度输出格式（stdout）：
 *   PROGRESS:10:步骤描述
 *   DONE:success
 *   ERROR:错误信息
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── 工具函数 ──────────────────────────────────────────────────────────────

/** 随机延迟，模拟人类操作节奏 */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
async function humanDelay(min = 300, max = 800) { await sleep(rand(min, max)); }

/** 随机鼠标移动，打乱操作轨迹 */
async function randomMouseMove(page) {
    const x = rand(300, 900);
    const y = rand(300, 700);
    await page.mouse.move(x, y, { steps: rand(5, 15) });
    await sleep(rand(100, 300));
}

/** 模拟人类点击（先移动再点击） */
async function humanClick(el, opts = {}) {
    await el.hover();
    await sleep(rand(80, 200));
    await el.click({ force: true, ...opts });
}

/** 模拟人类输入（先清空再逐字输入） */
async function humanType(page, el, text) {
    await humanClick(el);
    await sleep(rand(150, 350));
    await el.selectText().catch(() => {});
    await el.type(text, { delay: rand(60, 140) });
}

function progress(pct, msg) {
    console.log(`PROGRESS:${pct}:${msg}`);
}

function done(msg = 'success') {
    console.log(`DONE:${msg}`);
}

function error(msg) {
    console.log(`ERROR:${msg}`);
    process.exit(1);
}

function log(msg) {
    console.log(`LOG:${msg}`);
}

/** 强制设置 React 受控输入框的值（避免追加 bug） */
async function setInputValue(page, selector, value) {
    await page.evaluate(({ sel, val }) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, { sel: selector, val: value });
}

/** 暴露隐藏的 file input，返回暴露后的 element handle */
async function exposeFileInput(page, index) {
    await page.evaluate((idx) => {
        const inputs = document.querySelectorAll('input[type="file"]');
        if (inputs[idx]) {
            inputs[idx].style.cssText = `position:fixed;top:${idx * 40 + 100}px;left:0;z-index:999999;opacity:1;width:150px;height:36px;display:block;visibility:visible;`;
            inputs[idx].setAttribute('data-exposed-idx', idx);
        }
    }, index);
    await page.waitForTimeout(300);
}

/** 上传图片到指定的图片区域（按区域索引，只计图片类型 file input）*/
async function uploadImagesToArea(page, areaIndex, imgDir) {
    if (!imgDir || !fs.existsSync(imgDir)) {
        log(`图片目录不存在，跳过：${imgDir}`);
        return 0;
    }
    const files = fs.readdirSync(imgDir)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .sort()
        .map(f => path.join(imgDir, f));
    if (files.length === 0) { log(`目录为空，跳过：${imgDir}`); return 0; }

    for (let i = 0; i < files.length; i++) {
        // 只取 accept 包含 image 的 file input
        const imgInputs = await page.$$('input[type="file"][accept*="image"]');
        if (!imgInputs[areaIndex]) { log(`找不到第 ${areaIndex} 个图片上传区`); break; }
        // 暴露该 input
        await page.evaluate((el) => {
            el.style.cssText = 'position:fixed;top:100px;left:0;z-index:999999;opacity:1;width:150px;height:36px;display:block;visibility:visible;';
        }, imgInputs[areaIndex]);
        await page.waitForTimeout(300);
        // 重新获取（DOM 可能重排）
        const refreshed = await page.$$('input[type="file"][accept*="image"]');
        if (refreshed[areaIndex]) {
            await refreshed[areaIndex].setInputFiles(files[i]);
            await page.waitForTimeout(1800);
        }
    }
    return files.length;
}

// ── 主流程 ────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const loginOnly = args.includes('--login-only');
    const dryRun = args.includes('--dry-run');

    // 读取配置
    let config = {};
    const envConfig = process.env.PDD_CONFIG;
    if (envConfig) {
        try { config = JSON.parse(envConfig); } catch (e) { error('PDD_CONFIG JSON 解析失败: ' + e.message); }
    } else if (!loginOnly) {
        // 从 stdin 读取
        const rl = readline.createInterface({ input: process.stdin });
        let raw = '';
        for await (const line of rl) raw += line;
        if (raw.trim()) {
            try { config = JSON.parse(raw); } catch (e) { error('stdin JSON 解析失败: ' + e.message); }
        }
    }

    const cookiesPath = config.cookiesPath || path.join(process.cwd(), 'pdd_cookies.json');

    // 启动浏览器（始终有界面，拼多多防检测）
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
    });

    // 加载已有 cookies
    if (fs.existsSync(cookiesPath)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await context.addCookies(cookies);
            log('已加载登录 cookies');
        } catch (e) {
            log('cookies 加载失败，将重新登录: ' + e.message);
        }
    }

    const page = await context.newPage();

    try {
        // ── STEP 0：检查登录态 ──────────────────────────────────────────
        progress(5, '检查登录状态');
        await page.goto('https://mms.pinduoduo.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // 可靠的登录态判断：已登录时后台会有导航菜单或跳转到 dashboard 路径
        const currentUrl = page.url();
        const isLoggedIn = await page.evaluate(() => {
            // 有商家后台导航元素，或 URL 包含 dashboard/home/goods 等后台路径
            return !!(
                document.querySelector('[class*="nav-menu"]') ||
                document.querySelector('[class*="sidebar-menu"]') ||
                document.querySelector('[class*="merchant"]') ||
                document.querySelector('.pdd-mms-layout') ||
                (window.location.pathname !== '/' && !window.location.href.includes('login') && !window.location.href.includes('passport'))
            );
        });

        log(`当前URL: ${currentUrl}, 登录态: ${isLoggedIn}`);

        if (!isLoggedIn || loginOnly) {
            log('需要登录，请在弹出的浏览器窗口中完成拼多多商家后台登录...');
            progress(6, '等待用户登录');
            // 确保在登录页
            if (!currentUrl.includes('login') && !currentUrl.includes('passport')) {
                await page.goto('https://mms.pinduoduo.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
            }
            // 等待用户登录成功：URL 变成后台页面（含 /home 或 /goods 或 /dashboard，且不含 login/passport）
            await page.waitForFunction(
                () => {
                    const url = window.location.href;
                    return !url.includes('login') &&
                           !url.includes('passport') &&
                           (url.includes('/home') || url.includes('/goods') || url.includes('/dashboard') ||
                            url.includes('/mms.pinduoduo.com/') && document.querySelector('[class*="nav"]'));
                },
                { timeout: 300000, polling: 1000 }
            );
            // 保存 cookies
            const cookies = await context.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            log('登录成功，cookies 已保存到: ' + cookiesPath);
            if (loginOnly) { await browser.close(); done('login_saved'); return; }
        }

        // ── STEP 1：进入发布新商品页 ────────────────────────────────────
        progress(10, '进入发布新商品页');

        /** 关闭 PDD 后台可能出现的弹窗/广告（包括图片预览） */
        async function closePddPopups() {
            try {
                // 先用 Escape 关闭任何聚焦弹窗
                await page.keyboard.press('Escape');
                await sleep(300);
                // 关闭 beast-core-modal（图片预览）
                const previewModal = await page.$('[data-testid="beast-core-modal"]');
                if (previewModal) {
                    const closeBtn = await previewModal.$('[class*="MDL_closeIcon"], [class*="close"], button');
                    if (closeBtn) { await closeBtn.click({ force: true }); await sleep(400); }
                    else { await page.keyboard.press('Escape'); await sleep(400); }
                    log('已关闭图片预览弹窗');
                }
                // 关闭其他广告/提示弹窗
                const closeBtns = await page.$$('[class*="modal"] [class*="close"], button:has-text("关闭"), button:has-text("我知道了"), [class*="modal-close"]');
                for (const btn of closeBtns) {
                    const visible = await btn.isVisible().catch(() => false);
                    if (visible) { await btn.click({ force: true }); await sleep(300); }
                }
            } catch (_) {}
        }

        // 先尝试直接进品类选择页
        await page.goto('https://mms.pinduoduo.com/goods/category', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        const currentPageUrl = page.url();
        const isOnCategoryPage = currentPageUrl.includes('category') || currentPageUrl.includes('goods_add') || currentPageUrl.includes('add_goods');
        if (!isOnCategoryPage) {
            log('跳转失败，当前页面: ' + currentPageUrl + '，尝试从商品列表点击"发布新商品"');
            await page.goto('https://mms.pinduoduo.com/goods/goods_list', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);
            const addLink = await page.$('a[href*="category"], a:has-text("发布新商品")');
            if (addLink) {
                await addLink.click();
                await page.waitForTimeout(3000);
            } else {
                error('找不到"发布新商品"入口，请检查拼多多后台页面结构');
                return;
            }
        }
        log('发布页: ' + page.url());
        // 关闭可能出现的弹窗
        await closePddPopups();
        if (dryRun) { await page.screenshot({ path: 'step1_add_page.png' }); log('截图已保存: step1_add_page.png'); }

        // ── STEP 2：选择商品类目 ────────────────────────────────────────
        progress(15, '选择商品类目');

        // 等待 header 遮罩消失（最多 10 秒），再操作品类
        await page.waitForFunction(
            () => {
                const mask = document.getElementById('mms-header__mask');
                return !mask || mask.offsetParent === null || getComputedStyle(mask).display === 'none';
            },
            { timeout: 10000 }
        ).catch(() => {
            // 超时后强制隐藏遮罩
            return page.evaluate(() => {
                const mask = document.getElementById('mms-header__mask');
                if (mask) mask.style.display = 'none';
            });
        });
        await page.waitForTimeout(500);

        const category = config.category || '';
        if (category) {
            // 品类页的分类搜索框（不是顶部全局搜索框）
            const searchInput = await page.$('input[placeholder*="搜索分类"], input[placeholder*="关键词搜索"]');
            if (searchInput) {
                const keyword = category.split('>').pop().trim();
                await searchInput.click({ force: true });
                await page.waitForTimeout(300);
                await searchInput.type(keyword, { delay: 80 });
                await page.waitForTimeout(2500);

                // 用 locator 按文字精确匹配叶子分类（has-text 匹配包含文字的最小元素）
                // 优先找精确匹配，次选含关键词的第一个可点击结果
                let clicked = false;
                try {
                    const exact = page.locator(`[class*="SPP_searchItem"], [class*="searchItem"], [class*="search-item"]`).filter({ hasText: keyword }).first();
                    await exact.click({ force: true, timeout: 3000 });
                    clicked = true;
                    log('品类点击成功: ' + keyword);
                } catch (_) {}

                if (!clicked) {
                    // fallback：找所有包含 keyword 文字的叶子节点，点第一个
                    const elHandle = await page.evaluateHandle((kw) => {
                        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                        let node;
                        while ((node = walker.nextNode())) {
                            if (node.nodeValue.trim() === kw) {
                                let el = node.parentElement;
                                while (el && el.tagName === 'SPAN') el = el.parentElement;
                                return el;
                            }
                        }
                        return null;
                    }, keyword);
                    const el = elHandle.asElement();
                    if (el) {
                        await el.click({ force: true });
                        log('品类 fallback 点击: ' + keyword);
                    } else {
                        log('未找到品类: ' + keyword);
                    }
                }
                await page.waitForTimeout(1500);
            }
            // 点击确认/下一步按钮
            const confirmBtn = await page.$('button:has-text("确认发布"), button:has-text("确认"), button:has-text("下一步")');
            if (confirmBtn) {
                await confirmBtn.click({ force: true });
                await page.waitForTimeout(2000);
            }
        }
        progress(20, '类目选择完成');

        if (dryRun) { await page.screenshot({ path: 'step2_category.png' }); log('截图已保存: step2_category.png'); }

        // ── STEP 3：上传主图 ────────────────────────────────────────────
        progress(25, '上传主图');
        if (config.mainImgDir) {
            const count = await uploadImagesToArea(page, 0, config.mainImgDir);
            log(`主图上传完成，共 ${count} 张`);
            await closePddPopups();
        }
        progress(35, '主图上传完成');

        if (dryRun) { await page.screenshot({ path: 'step3_main_imgs.png' }); log('截图已保存: step3_main_imgs.png'); }

        // ── STEP 4：填写商品标题 ────────────────────────────────────────
        progress(40, '填写商品标题');
        if (config.title) {
            const titleInput = await page.$('input[placeholder*="商品标题"], textarea[placeholder*="商品标题"]');
            if (titleInput) {
                await titleInput.click();
                await titleInput.fill('');
                await titleInput.type(config.title, { delay: 30 });
                await page.waitForTimeout(500);
            }
        }

        // ── STEP 5：填写商品属性 ────────────────────────────────────────
        progress(45, '填写商品属性');
        const reuseBtn = await page.$('button:has-text("一键复用"), [class*="reuse"]');
        if (reuseBtn) {
            await reuseBtn.click();
            await page.waitForTimeout(2000);
            log('已点击一键复用');
        }
        if (config.attributes) {
            for (const [attrName, attrValue] of Object.entries(config.attributes)) {
                const attrLabel = await page.$(`[class*="attr-label"]:has-text("${attrName}"), label:has-text("${attrName}")`);
                if (attrLabel) {
                    const attrInput = await attrLabel.$('xpath=following-sibling::*//input')
                        || await attrLabel.$('xpath=following-sibling::input');
                    if (attrInput) { await attrInput.fill(attrValue); await page.waitForTimeout(300); }
                }
            }
        }

        // ── STEP 6：上传详情图 ──────────────────────────────────────────
        progress(50, '上传详情图');
        if (config.detailImgDir) {
            const count = await uploadImagesToArea(page, 1, config.detailImgDir);
            log(`详情图上传完成，共 ${count} 张`);
            await closePddPopups();
        }
        progress(60, '详情图上传完成');

        // ── STEP 7：上传白底图（商品素材） ─────────────────────────────
        if (config.whiteImgDir && fs.existsSync(config.whiteImgDir)) {
            progress(62, '上传白底图');
            await page.evaluate(() => window.scrollBy(0, 600));
            await humanDelay(800, 1200);
            // 用文字标签找白底图上传区域，而不是依赖索引
            const whiteAreaLabel = await page.$('[class*="white"], label:has-text("白底"), label:has-text("素材"), [class*="素材"]');
            if (whiteAreaLabel) {
                const whiteFileInput = await page.evaluate(el => {
                    let p = el;
                    for (let i=0; i<5; i++) {
                        const inp = p.querySelector('input[type="file"]');
                        if (inp) return true;
                        p = p.parentElement;
                    }
                    return false;
                }, whiteAreaLabel);
                log('找到白底图上传区域: ' + whiteAreaLabel + ', 有input: ' + whiteFileInput);
            }
            const imgInputsNow = await page.$$('input[type="file"][accept*="image"]');
            log(`白底图上传前图片 input 总数: ${imgInputsNow.length}`);
            if (imgInputsNow.length >= 3) {
                const count = await uploadImagesToArea(page, 2, config.whiteImgDir);
                log(`白底图上传完成，共 ${count} 张`);
                await closePddPopups();
            } else {
                log(`只有${imgInputsNow.length}个图片 input，白底图跳过（需手动上传）`);
            }
        }

        // ── STEP 8：添加 SKU 规格 ───────────────────────────────────────
        progress(65, '添加SKU规格');
        if (config.skus && config.skus.length > 0) {
            // 先关闭可能出现的弹窗
            await closePddPopups();
            await humanDelay(500, 1000);

            // 新 PDD UI：规格类型输入框已存在（placeholder="规格类型1"）
            // 直接填写，不需要点"添加规格"按钮
            // 先滚动到规格区域
            await page.evaluate(() => {
                const el = document.getElementById('goods-spec-sku');
                if (el) el.scrollIntoView({ block: 'center' });
            });
            await humanDelay(800, 1200);

            let specNameInput = await page.$('input[placeholder*="规格类型"]');
            if (!specNameInput) {
                // 点击"添加规格类型"按钮（新 UI 文字是"+ 添加规格类型(0/2)"）
                const addSpecBtn = await page.$(
                    'button:has-text("添加规格类型"), button:has-text("添加规格"), [class*="add-spec"]'
                );
                if (addSpecBtn) {
                    log('点击添加规格类型按钮');
                    await addSpecBtn.click({ force: true });
                    await humanDelay(1000, 1500);
                    specNameInput = await page.$('input[placeholder*="规格类型"], input[placeholder*="规格名"]');
                } else {
                    log('未找到添加规格类型按钮');
                }
            }

            if (specNameInput) {
                // 规格类型是下拉选择器，需要点击后从列表里选预设类型
                // PDD 常见规格类型：款式、颜色、型号、尺码 等
                const specTypeName = config.skuSpecType || '款式';
                await specNameInput.click({ force: true });
                await humanDelay(800, 1200);
                // 等下拉列表出现，找对应选项
                try {
                    const opt = await page.waitForSelector(
                        `[class*="dropdown"] li:has-text("${specTypeName}"), [class*="option"]:has-text("${specTypeName}"), [class*="SL_item"]:has-text("${specTypeName}"), [class*="select-item"]:has-text("${specTypeName}"), li:has-text("${specTypeName}")`,
                        { timeout: 5000 }
                    );
                    await opt.click({ force: true });
                    await humanDelay(500, 800);
                    log('规格类型已选择: ' + specTypeName);
                } catch (_) {
                    // 找不到下拉，尝试直接 type
                    await specNameInput.type(specTypeName, { delay: rand(60, 120) });
                    await humanDelay(300, 500);
                    // 再试一次找下拉
                    try {
                        const opt2 = await page.waitForSelector(
                            `li:has-text("${specTypeName}"), [class*="item"]:has-text("${specTypeName}")`,
                            { timeout: 3000 }
                        );
                        await opt2.click({ force: true });
                        log('规格类型已选择(type后): ' + specTypeName);
                    } catch (_2) {
                        log('规格类型下拉未找到，已输入: ' + specTypeName);
                    }
                    await humanDelay(300, 500);
                }
            } else {
                log('未找到规格类型输入框，跳过 SKU 规格');
            }

            // 逐个填写规格值
            // PDD 规格值输入框 placeholder="请输入规格名称"
            // 每次填完后：先按 Enter 确认，再等新输入框出现，
            // 通过比对填写前后的输入框列表确认新框已就绪，避免重复写入同一框
            const specValueCount = (await page.$$('#goods-spec-sku input[placeholder="请输入规格名称"]')).length;
            log(`规格值输入框初始数量: ${specValueCount}`);

            for (let i = 0; i < config.skus.length; i++) {
                const sku = config.skus[i];
                await humanDelay(300, 600);

                // 记录当前空输入框数量（用于判断新框是否已出现）
                const beforeCount = (await page.$$('#goods-spec-sku input[placeholder="请输入规格名称"]')).length;

                // 只取第一个空的（value 为空）输入框
                const allInps = await page.$$('#goods-spec-sku input[placeholder="请输入规格名称"]');
                let inp = null;
                for (const h of allInps) {
                    const val = await h.evaluate(el => el.value);
                    if (!val || val.trim() === '') { inp = h; break; }
                }

                if (!inp) {
                    log(`第${i+1}个规格值：找不到空输入框，跳过: ${sku.name}`);
                    continue;
                }

                await inp.click({ force: true });
                await humanDelay(150, 300);
                // 清空后再输入，防止残留值
                await inp.evaluate(el => { el.value = ''; el.dispatchEvent(new Event('input', {bubbles:true})); });
                await inp.type(sku.name, { delay: rand(60, 100) });
                await humanDelay(300, 500);
                await inp.press('Enter');

                // 等待新的空输入框出现（最多 3 秒），确认 Enter 已触发新行
                let waited = 0;
                while (waited < 3000) {
                    await sleep(300);
                    waited += 300;
                    const afterCount = (await page.$$('#goods-spec-sku input[placeholder="请输入规格名称"]')).length;
                    if (afterCount > beforeCount) break;
                }
                await humanDelay(300, 500);
                log('规格值已填写: ' + sku.name);
            }

            // 填完最后一个规格值后点击页面其他区域，触发失焦让最后一行 SKU 显示
            await page.mouse.click(400, 100);
            await humanDelay(800, 1200);

            // 等待价格表格渲染
            await humanDelay(2000, 3000);
            await page.evaluate(() => window.scrollBy(0, 600));
            await humanDelay(800, 1200);
            // 关闭可能出现的弹窗
            await closePddPopups();

            // 勾选"添加图片"（先滚动到视口内再点击）
            const addImgLabel = await page.$('label:has-text("添加图片")');
            const addImgCheckbox = addImgLabel
                ? await addImgLabel.$('input[type="checkbox"]')
                : await page.$('input[type="checkbox"][class*="img"]');
            if (addImgCheckbox) {
                try {
                    await addImgCheckbox.scrollIntoViewIfNeeded();
                    await humanDelay(500, 800);
                    const checked = await addImgCheckbox.evaluate(el => el.checked);
                    if (!checked) {
                        await addImgCheckbox.evaluate(el => el.click());
                        await humanDelay(500, 800);
                    }
                    log('添加图片已勾选');
                } catch (e) {
                    log('添加图片复选框操作失败，跳过: ' + e.message.split('\n')[0]);
                }
            }
            if (dryRun) {
                const specState = await page.evaluate(() => {
                    const section = document.getElementById('goods-spec-sku');
                    if (!section) return { chips: [], inputs: [] };
                    const chips = [...section.querySelectorAll('[class*="TAG"], [class*="tag"], [class*="chip"]')]
                        .filter(el => el.offsetParent !== null && el.textContent.trim().length > 0 && el.textContent.trim().length < 40)
                        .map(el => el.textContent.trim().substring(0, 30));
                    const inputs = [...section.querySelectorAll('input')].filter(el => el.offsetParent !== null)
                        .map(el => ({ ph: el.placeholder.substring(0, 30), val: el.value }));
                    return { chips, inputs };
                });
                log('规格区域状态: ' + JSON.stringify(specState));
                await page.screenshot({ path: 'step8_sku_spec.png' });
                log('截图已保存: step8_sku_spec.png');
            }

            // ── STEP 9：上传 SKU 图片（先诊断 input 列表）───────────────
            progress(70, '上传SKU图片');
            if (dryRun) {
                const diagResult = await page.evaluate(() => {
                    const section = document.getElementById('goods-spec-sku');
                    if (!section) return [];
                    return [...section.querySelectorAll('input[type="file"]')].map((el, idx) => {
                        const row = el.closest('tr, [class*="row"], [class*="Row"], [class*="item"]');
                        const rowText = row ? row.textContent.replace(/\s+/g,' ').trim().substring(0, 40) : '';
                        const parentText = el.parentElement ? el.parentElement.textContent.replace(/\s+/g,' ').trim().substring(0, 30) : '';
                        return { idx, rowText, parentText };
                    });
                });
                log('SKU图片input诊断: ' + JSON.stringify(diagResult));
                // 同时写到文件，方便查看
                fs.writeFileSync(path.join(__dirname, 'sku_input_diag.json'), JSON.stringify(diagResult, null, 2));
                log('诊断结果已写入: sku_input_diag.json');
            }
            for (let i = 0; i < config.skus.length; i++) {
                const sku = config.skus[i];
                if (!sku.imgDir || !fs.existsSync(sku.imgDir)) continue;
                const stat = fs.statSync(sku.imgDir);
                let skuFile;
                if (stat.isFile()) {
                    skuFile = sku.imgDir;
                } else {
                    const skuFiles = fs.readdirSync(sku.imgDir)
                        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
                        .sort()
                        .map(f => path.join(sku.imgDir, f));
                    skuFile = skuFiles[0];
                }
                if (!skuFile) continue;

                // 每次重新取：上传后 input 总数会减 1（已上传的 input 被移除）
                // 所以始终取 index 8，因为前面已上传的 input 消失后，下一个就顶到 index 8
                const allImgInputs = await page.$$('#goods-spec-sku input[type="file"]');
                log(`SKU图片input总数: ${allImgInputs.length}, 目标 index: 8`);
                const inp = allImgInputs[8];
                if (!inp) { log(`SKU[${i}] 找不到图片 input (index 8)`); continue; }
                await inp.setInputFiles(skuFile);
                // 等待 loading 遮罩消失
                await page.waitForFunction(() => !document.querySelector('.init-loading, [class*="init-loading"]'), { timeout: 8000 }).catch(() => {});
                await humanDelay(800, 1200);
                log(`SKU图片已上传[${i}]: ${path.basename(skuFile)}`);
            }

            // ── STEP 9.5：发布前检测 SKU 图是否都上传成功，缺的补传 ──
            // 上传成功后该行 file input 会消失，剩余 input 应回到基础数量（8 个非 SKU 行）
            // 若仍有 index>=8 的 file input，说明对应 SKU 行漏传了，按顺序补传
            {
                const baseCount = 8; // index 0-7 为非 SKU 行（本地上传按钮 + header 等）
                let retry = 0;
                while (retry < config.skus.length) {
                    const cur = await page.$$('#goods-spec-sku input[type="file"]');
                    const missing = cur.length - baseCount; // 还剩几个 SKU 行未传
                    if (missing <= 0) { log('SKU图检测：全部已上传 ✓'); break; }
                    // 漏传的是最后 missing 个 SKU（前面成功的已消失，剩下的顶到 index 8）
                    const idx = config.skus.length - missing; // 对应 config.skus 的下标
                    const sku = config.skus[idx];
                    log(`SKU图检测：第 ${idx + 1} 个(${sku ? sku.name : '?'}) 漏传，补传中...`);
                    if (sku && sku.imgDir && fs.existsSync(sku.imgDir)) {
                        const stat = fs.statSync(sku.imgDir);
                        let skuFile = stat.isFile() ? sku.imgDir
                            : fs.readdirSync(sku.imgDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort().map(f => path.join(sku.imgDir, f))[0];
                        if (skuFile && cur[baseCount]) {
                            await cur[baseCount].setInputFiles(skuFile);
                            await page.waitForFunction(() => !document.querySelector('.init-loading, [class*="init-loading"]'), { timeout: 8000 }).catch(() => {});
                            await humanDelay(800, 1200);
                            log(`补传完成: ${path.basename(skuFile)}`);
                        }
                    }
                    retry++;
                }
                // 最终核对
                const finalCur = await page.$$('#goods-spec-sku input[type="file"]');
                const stillMissing = finalCur.length - baseCount;
                if (stillMissing > 0) {
                    log(`⚠ 警告：仍有 ${stillMissing} 个 SKU 图未上传成功，请手动检查后再提交`);
                }
            }

            await closePddPopups();

            // ── STEP 10：填写价格和库存 ─────────────────────────────────
            progress(75, '填写价格和库存');
            await randomMouseMove(page);
            await humanDelay(2000, 3000);

            // 滚动到价格区域
            await page.evaluate(() => {
                const sec = document.getElementById('goods-spec-sku');
                if (sec) sec.scrollIntoView({ block: 'center' });
                else window.scrollBy(0, 1000);
            });
            await humanDelay(800, 1200);
            if (dryRun) { await page.screenshot({ path: 'step10_before_price.png' }); log('截图已保存: step10_before_price.png'); }

            // PDD 价格表格：每行有 库存 | 拼单价 | 单买价 | 规格编码 | 商家编码
            // 每列的 placeholder 都是 "请输入"，无法靠 placeholder 区分
            // 改用：找 goods-spec-sku 内的价格表格行，按列顺序填
            const skuTableRows = await page.evaluate(() => {
                const section = document.getElementById('goods-spec-sku');
                if (!section) return [];
                // 找所有价格行（包含多个 input 的行）
                const rows = [...section.querySelectorAll('tr, [class*="sku-row"], [class*="tableRow"]')]
                    .filter(row => row.querySelectorAll('input[placeholder="请输入"]').length >= 2);
                return rows.map(row => {
                    const inputs = [...row.querySelectorAll('input[placeholder="请输入"]')];
                    return inputs.map(inp => inp.placeholder);
                });
            });
            log(`价格表格行数: ${skuTableRows.length}`);

            // 诊断：打印每个 "请输入" input 对应的列标题 + idx24 的 outerHTML
            if (dryRun) {
                const colDiag = await page.evaluate(() => {
                    const section = document.getElementById('goods-spec-sku');
                    if (!section) return [];
                    const headerCells = [...section.querySelectorAll('th, [class*="header"] td, [class*="tableHeader"] [class*="cell"]')]
                        .map(th => th.textContent.trim().replace(/\s+/g, ' ').substring(0, 20));
                    const allInps = [...section.querySelectorAll('input[placeholder="请输入"]')]
                        .filter(el => el.offsetParent !== null);
                    // 额外输出最后一个 input 的 outerHTML，帮助确认它是什么
                    const last = allInps[allInps.length - 1];
                    const lastHtml = last ? last.outerHTML.substring(0, 200) : '';
                    const lastParentHtml = last ? (last.closest('tr, [class*="row"], [class*="Row"]')?.outerHTML || '').substring(0, 300) : '';
                    return {
                        headers: headerCells,
                        lastInputHtml: lastHtml,
                        lastParentHtml,
                        inputs: allInps.map((inp, idx) => {
                            const cell = inp.closest('td, [class*="cell"], [class*="Col"]');
                            const row = inp.closest('tr, [class*="row"], [class*="Row"]');
                            const colIdx = cell && row ? [...row.children].indexOf(cell) : -1;
                            const rowLabel = row ? (row.querySelector('[class*="skuName"], [class*="spec-name"], td:first-child')?.textContent || '').trim().substring(0, 15) : '';
                            return { idx, colIdx, rowLabel };
                        })
                    };
                });
                log('列诊断idx24: ' + JSON.stringify({ lastHtml: colDiag.lastInputHtml, lastParent: colDiag.lastParentHtml?.substring(0,150) }));
            }

            // 直接按 goods-spec-sku 内的全部 "请输入" input 按顺序分组
            // 每行有5列：库存 | 拼单价 | 单买价 | 规格编码 | 商家编码
            const allPriceInputs = await page.evaluate(() => {
                const section = document.getElementById('goods-spec-sku');
                if (!section) return [];
                return [...section.querySelectorAll('input[placeholder="请输入"]')]
                    .filter(el => el.offsetParent !== null)
                    .map(el => el.placeholder);
            });
            log(`价格区域可见 "请输入" inputs: ${allPriceInputs.length} 个`);

            // 列顺序（诊断确认）：[0]=库存, [1]=拼单价, [2]=单买价, [3]=规格编码
            // header 那行的库存 input 排在最后（idx 24），不影响前面 6*4=24 个
            const COLS_PER_ROW = 4;
            const HEADER_OFFSET = 0;
            const maxGroupPrice = Math.max(...config.skus.map(s => s.groupPrice / 100));
            const batchSinglePrice = (maxGroupPrice + 1).toFixed(2);

            for (let i = 0; i < config.skus.length; i++) {
                const sku = config.skus[i];
                const groupPriceYuan = parseFloat((sku.groupPrice / 100).toFixed(2));

                await randomMouseMove(page);
                log(`处理第 ${i+1} 行 SKU: ${sku.name}`);

                const allInpHandlesRaw = await page.$$('#goods-spec-sku input[placeholder="请输入"]');
                const allInpHandles = [];
                for (const h of allInpHandlesRaw) {
                    const vis = await h.evaluate(el => el.offsetParent !== null);
                    if (vis) allInpHandles.push(h);
                }
                const rowStart = HEADER_OFFSET + i * COLS_PER_ROW;
                // [rowStart+0]=库存，[rowStart+1]=拼单价，[rowStart+2]=单买价，[rowStart+3]=规格编码
                const stockInp    = allInpHandles[rowStart];
                const groupInp    = allInpHandles[rowStart + 1];
                const singleInp   = allInpHandles[rowStart + 2];
                const itemCodeInp = allInpHandles[rowStart + 3];

                if (stockInp) { await humanType(page, stockInp, '8888'); await humanDelay(200, 400); }
                if (groupInp) { await humanType(page, groupInp, groupPriceYuan.toFixed(2)); await humanDelay(200, 400); }
                if (singleInp) { await humanType(page, singleInp, batchSinglePrice); await humanDelay(200, 400); }
                if (itemCodeInp && sku.itemCode) { await humanType(page, itemCodeInp, sku.itemCode); await humanDelay(200, 400); }

                await humanDelay(300, 600);
            }

            // 填写商品参考价（拼单价+2）— 全局一个字段
            const refPriceInput = await page.$('input[placeholder*="应大于商品最大单买价"], input[placeholder*="参考价"]');
            if (refPriceInput && config.skus.length > 0) {
                const maxGroupPrice2 = Math.max(...config.skus.map(s => s.groupPrice / 100));
                const refPrice = (maxGroupPrice2 + 3).toFixed(2); // 需大于最大单买价(maxGroupPrice+1)
                await humanType(page, refPriceInput, refPrice);
                log('商品参考价已填写: ' + refPrice);
                await humanDelay(300, 500);
            }
        }

        progress(80, '价格库存填写完成');

        // ── STEP 11：设置满件折扣 ───────────────────────────────────────
        progress(82, '设置满件折扣');
        if (config.discount) {
            const discountVal = config.discount.replace('折', '');
            // 优先用 placeholder 精确定位折扣输入框
            const discountInput = await page.$('input[placeholder*="5.0~9.9"], input[placeholder*="折扣"]')
                || await page.$('[class*="discount"] input, [class*="full-discount"] input');
            if (discountInput) {
                await humanType(page, discountInput, discountVal);
                await humanDelay(300, 500);
                log('满件折扣已填写: ' + discountVal);
            } else {
                log('未找到折扣输入框，跳过');
            }
        }

        // ── STEP 12：设置承诺发货时间 ───────────────────────────────────
        progress(85, '设置承诺发货时间');
        const deliveryOption = await page.$('label:has-text("48小时"), [class*="delivery"]:has-text("48")');
        if (deliveryOption) {
            await deliveryOption.click();
            await page.waitForTimeout(300);
        }

        if (dryRun) {
            await page.screenshot({ path: 'step_final_before_submit.png' });
            log('dry-run 模式，截图已保存，不实际提交');
            await browser.close();
            done('dry_run_complete');
            return;
        }

        // ── STEP 13：提交上架 ───────────────────────────────────────────
        progress(90, '提交上架');
        // 检查错误数
        const errorCount = await page.$eval('[class*="error-count"], [class*="errors"]', el => {
            const text = el.textContent || '';
            const match = text.match(/错误[（(](\d+)[）)]/);
            return match ? parseInt(match[1]) : -1;
        }).catch(() => -1);

        if (errorCount > 0) {
            error(`页面有 ${errorCount} 个错误，请检查后重试`);
            return;
        }

        const submitBtn = await page.$('button:has-text("提交并上架"), button:has-text("发布商品")');
        if (!submitBtn) {
            error('找不到提交按钮');
            return;
        }
        await submitBtn.evaluate(el => el.click());

        // 等待成功页面
        progress(95, '等待发布结果');
        await sleep(5000);
        const submitResultUrl = page.url();
        log('提交后当前 URL: ' + submitResultUrl);
        await page.screenshot({ path: 'submit_result.png' }).catch(() => {});
        log('提交结果截图已保存: submit_result.png');

        const isSuccess = submitResultUrl.includes('success') || submitResultUrl.includes('goods_list') || submitResultUrl.includes('goods/list');
        const successEl = await page.$('[class*="success"], [class*="Success"], h2:has-text("成功"), div:has-text("发布成功"), div:has-text("提交成功")').catch(() => null);

        if (isSuccess || successEl) {
            progress(100, '商品发布成功');
            const cookies = await context.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            done('success');
        } else {
            const errEl = await page.$('[class*="error-count"], [class*="errorCount"]').catch(() => null);
            const errText = errEl ? await errEl.textContent().catch(() => '') : '';
            log('页面错误信息: ' + errText);
            error('提交后未跳转到成功页面，当前 URL: ' + submitResultUrl + (errText ? '，错误: ' + errText : ''));
        }

    } catch (e) {
        log('发生异常: ' + e.message);
        await page.screenshot({ path: 'error_screenshot.png' }).catch(() => {});
        error(e.message);
    } finally {
        await browser.close();
    }
}

main().catch(e => error(e.message));
