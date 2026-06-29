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

/** 模拟人类点击（先移动再点击；hover 失败不阻断） */
async function humanClick(el, opts = {}) {
    await el.hover({ timeout: 2000 }).catch(() => {});
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
        // 优先取 accept 含 image 的 file input；v2 表单的上传框 file input 可能不带 accept，
        // 兜底用所有 input[type=file]。
        let sel = 'input[type="file"][accept*="image"]';
        let imgInputs = await page.$$(sel);
        if (imgInputs.length === 0) { sel = 'input[type="file"]'; imgInputs = await page.$$(sel); }
        if (!imgInputs[areaIndex]) { log(`找不到第 ${areaIndex} 个图片上传区`); break; }
        // 暴露该 input
        await page.evaluate((el) => {
            el.style.cssText = 'position:fixed;top:100px;left:0;z-index:999999;opacity:1;width:150px;height:36px;display:block;visibility:visible;';
        }, imgInputs[areaIndex]);
        await page.waitForTimeout(300);
        // 重新获取（DOM 可能重排）
        const refreshed = await page.$$(sel);
        if (refreshed[areaIndex]) {
            await refreshed[areaIndex].setInputFiles(files[i]);
            await page.waitForTimeout(1800);
        }
    }
    return files.length;
}

// ── 填写单个属性（beast-core 下拉为主，文本框兜底）──────────────────────
// 返回 true 表示已填/已选中，false 表示未匹配跳过
async function fillAttribute(page, attrName, attrValue) {
    // 1. 用属性名标签定位该属性行（精确文字），找到行内的下拉 input
    const label = page.locator(`label:has-text("${attrName}")`).first();
    if (await label.count() === 0) return false;
    try { await label.scrollIntoViewIfNeeded({ timeout: 3000 }); } catch (_) {}

    // 行容器：标签往上 2-3 层通常含控件；用 xpath 找最近的、包含 select input 的祖先
    const row = label.locator(
        'xpath=ancestor-or-self::*[.//input[@data-testid="beast-core-select-htmlInput"]][1]'
    );
    const hasSelect = await row.count() > 0
        && await row.locator('input[data-testid="beast-core-select-htmlInput"]').count() > 0;

    if (hasSelect) {
        const selInput = row.locator('input[data-testid="beast-core-select-htmlInput"]').first();
        await selInput.click();
        await page.waitForTimeout(600);
        // 2. 多选支持：值按 、，/ 拆分，逐个在浮层里模糊匹配选中（不关闭浮层连续点）
        const vals = attrValue.split(/[、,，/]/).map(s => s.trim()).filter(Boolean);
        let any = false;
        for (const v of vals) {
            const hit = await pickPortalOption(page, v);
            if (hit) { any = true; await page.waitForTimeout(250); }
        }
        // 选完关闭浮层：先点该属性标签让下拉失焦收起，Escape 兜底
        try {
            await label.click({ timeout: 1500, force: true });
        } catch (_) {}
        await page.keyboard.press('Escape').catch(() => {});
        // 若浮层仍在，点页面空白区域强制收起
        try {
            const portal = page.locator('[data-testid="beast-core-portal"]');
            if (await portal.count() > 0 && await portal.last().isVisible().catch(() => false)) {
                await page.mouse.click(5, 5);
            }
        } catch (_) {}
        await page.waitForTimeout(400);
        return any;
    }

    // 3. 文本框兜底
    const textInput = row.count && await row.count() > 0
        ? row.locator('input:not([type="file"])').first()
        : label.locator('xpath=following::input[1]');
    if (await textInput.count() > 0) {
        await textInput.fill(attrValue);
        await page.waitForTimeout(300);
        return true;
    }
    return false;
}

// 读取某属性当前已填的值（一键复用后用来判断是否已有内容）。返回去空白的字符串，空表示未填。
async function attrCurrentValue(page, attrName) {
    try {
        const label = page.locator(`label:has-text("${attrName}")`).first();
        if (await label.count() === 0) return '';
        const row = label.locator('xpath=ancestor-or-self::*[.//input or .//*[@data-testid="beast-core-select-htmlInput"]][1]');
        if (await row.count() === 0) return '';
        // 多选/单选下拉：已选项通常渲染成 tag/标签文本；文本框则取 input value
        const tagTxt = await row.evaluate(el => {
            // beast-core 选中项标签
            const tags = [...el.querySelectorAll('[class*="tag"], [class*="Tag"], [class*="selected"], [class*="Selected"]')]
                .map(t => (t.textContent || '').trim()).filter(Boolean);
            if (tags.length) return tags.join('、');
            const inp = el.querySelector('input:not([type="file"])');
            return inp && inp.value ? inp.value.trim() : '';
        }).catch(() => '');
        return (tagTxt || '').replace(/\s+/g, '');
    } catch (_) { return ''; }
}

// 在 beast-core 选项浮层里按双向包含模糊匹配点击选项；虚拟列表会滚动查找
async function pickPortalOption(page, val) {
    const portal = page.locator('[data-testid="beast-core-portal"]').last();
    if (await portal.count() === 0) return false;
    const v = val.trim();

    for (let scroll = 0; scroll < 12; scroll++) {
        const opts = portal.locator('li[role="option"]');
        const n = await opts.count();
        for (let i = 0; i < n; i++) {
            const t = (await opts.nth(i).innerText()).trim();
            if (t && (t.includes(v) || v.includes(t))) {
                await opts.nth(i).click();
                return true;
            }
        }
        // 虚拟列表：滚动浮层加载更多
        const scroller = portal.locator('ul[role="listbox"] > div').first();
        if (await scroller.count() === 0) break;
        const before = await scroller.evaluate(el => el.scrollTop).catch(() => 0);
        await scroller.evaluate(el => { el.scrollTop += 200; }).catch(() => {});
        await page.waitForTimeout(250);
        const after = await scroller.evaluate(el => el.scrollTop).catch(() => 0);
        if (after === before) break; // 滚到底了
    }
    return false;
}

/**
 * 检测拼多多上架页版本（不同店铺/账号布局不同）。返回 'new' | 'legacy'。
 * 判据（页面特征，宽松取信号）：
 *  - 出现「选择分类」按钮 / 单页表单里直接有商品标题输入 → 新版(new)
 *  - 没有上述、而是类目前置页（「搜索发品」tab 进类目树后才到表单）→ 旧版(legacy)
 * 判不准时默认 'new'（当前主用版本），并打日志便于排查。
 */
async function detectListingVersion(page) {
    try {
        const url = page.url();
        const sig = await page.evaluate(() => {
            const txt = document.body ? document.body.innerText : '';
            const has = (s) => txt.indexOf(s) >= 0;
            const hasCatSearch = !!document.querySelector('input[placeholder*="搜索分类"], input[placeholder*="关键词搜索分类"]');
            const hasTitleInput = !!document.querySelector('input[placeholder*="商品标题"], textarea[placeholder*="商品标题"]');
            const hasConfirmCatBtn = !![...document.querySelectorAll('button,a,span,div')]
                .find(el => (el.textContent || '').replace(/\s+/g, '') === '确认发布该类商品' && el.offsetParent !== null);
            const hasSelectCategoryBtn = !![...document.querySelectorAll('button,a,span,div')]
                .find(el => (el.textContent || '').replace(/\s+/g, '') === '选择分类' && el.offsetParent !== null);
            return { hasCatSearch, hasTitleInput, hasConfirmCatBtn, hasSelectCategoryBtn,
                     hasNextStep: has('完善商品信息'),
                     hasRecommendCat: has('推荐分类') || has('智能推荐') || has('为你推荐'),
                     hasUploadMain: !!document.querySelector('.uploadImgEnter, input[type="file"]') };
        });
        log('版本检测信号: ' + JSON.stringify(sig) + ' url=' + url);
        // 注意：v2 与 v3 初始 URL 都是 /goods/category，不能只靠 URL 区分，必须看页面元素。
        // 版本二：分类前置——进入即为「分类搜索页」（有分类搜索框 或「确认发布该类商品」按钮，且还没标题框）。
        if ((sig.hasCatSearch || sig.hasConfirmCatBtn) && !sig.hasTitleInput) {
            return 'v2';
        }
        // 版本三：先传主图→后台推荐分类。进入即为「主图上传页」：在 /goods/category 但呈现上传区，
        // 且没有分类搜索框/确认按钮/标题框（「推荐分类」是传图后才出现，初始检测不到，故不依赖它）。
        if (/\/goods\/category/.test(url)
            && sig.hasUploadMain && !sig.hasCatSearch && !sig.hasConfirmCatBtn && !sig.hasTitleInput) {
            return 'v3';
        }
        // v3 兜底：已传主图、出现推荐分类信号、仍无标题框。
        if (sig.hasUploadMain && sig.hasRecommendCat && !sig.hasTitleInput) return 'v3';
        // 版本一：单页表单（先主图/标题，分类是表单内「选择分类」弹框 + 「完善商品信息」下一步）
        return 'v1';
    } catch (e) {
        log('版本检测失败，默认 v1: ' + e.message.split('\n')[0]);
        return 'v1';
    }
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
    // 持久化用户目录：cookie + localStorage + IndexedDB 全部留存，显著延长拼多多登录态。
    // 优先用 config 指定，否则放在 cookiesPath 同目录下的 pdd_browser_profile/。
    const userDataDir = config.userDataDir || path.join(path.dirname(cookiesPath), 'pdd_browser_profile');
    try { fs.mkdirSync(userDataDir, { recursive: true }); } catch (_) {}

    // 启动持久化上下文（始终有界面，拼多多防检测）。登录态由用户目录自动持久化，无需手动存/灌 cookie。
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
    });

    // 兼容旧版：若存在旧的 pdd_cookies.json 且持久化目录还没登录态，迁移一次（仅首次有效）
    if (fs.existsSync(cookiesPath)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await context.addCookies(cookies);
            log('已从旧 pdd_cookies.json 迁移登录 cookies（之后由持久化目录维护）');
        } catch (e) {
            log('旧 cookies 迁移失败（忽略，将走登录）: ' + e.message);
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
            if (loginOnly) { await context.close(); done('login_saved'); return; }
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

        // ── STEP 1.4：检测上架页版本（不同店铺/账号页面布局不同）。先判版本再决定后续填充流程。──
        //   v1 = 单页表单（主图→标题→「选择分类」弹框→「下一步,完善商品信息」）
        //   v2 = 分类前置（进入即 /goods/category：先搜分类→「确认发布该类商品」进表单）
        //   v3 = 先传主图→后台自动推荐分类→点「取消」→手动选分类→「下一步,完善商品信息」（主图不重传）
        // config.listingVersion 可强制指定（'v1'/'v2'/'v3'），否则自动检测。
        const listingVersion = (config.listingVersion && /^v[123]$/.test(config.listingVersion))
            ? config.listingVersion
            : await detectListingVersion(page);
        log('上架页版本判定: ' + listingVersion + (config.listingVersion ? '（配置强制）' : '（自动检测）'));

        // ── 版本三（v3）：先传主图 → 取消后台自动推荐分类 → 手动选分类 → 下一步进表单（主图不重传）──
        let v3Done = false;
        if (listingVersion === 'v3') {
            try {
                // 1) 先传主图
                if (config.mainImgDir) {
                    const n = await uploadImagesToArea(page, 0, config.mainImgDir);
                    log(`v3 主图上传完成，共 ${n} 张`);
                    await page.waitForTimeout(2000);
                    await closePddPopups();
                }
                // 2) 后台自动推荐分类 → 点「取消」以便手动选准确分类
                try {
                    const cancelBtn = page.locator('button:has-text("取消"), [class*="btn"]:has-text("取消")').first();
                    await cancelBtn.click({ force: true, timeout: 4000 });
                    log('v3 已点「取消」自动推荐分类');
                    await page.waitForTimeout(1200);
                } catch (_) { log('v3 未出现自动推荐分类「取消」按钮（跳过）'); }
                // 3) 手动选商品分类（复用 v2 的分类搜索弹框逻辑：搜词→点 .c-name 末级）
                if (config.category) {
                    const keyword = config.category.split('>').pop().trim();
                    // 打开分类选择（若有「选择分类」入口先点开）
                    try {
                        const selEntry = page.locator('text=选择分类, [class*="select"]:has-text("选择分类")').first();
                        await selEntry.click({ force: true, timeout: 3000 });
                        await page.waitForTimeout(800);
                    } catch (_) {}
                    const catInput = await page.$('input[placeholder*="搜索分类"], input[placeholder*="请输入"], input[placeholder*="类目"]');
                    if (catInput) {
                        await catInput.click({ force: true });
                        await catInput.type(keyword, { delay: 80 });
                        // 显式等搜索结果项出现（含关键词的 .c-name 或结果项），最多 6s，比死等更稳
                        await page.waitForFunction((kw) => {
                            const els = [...document.querySelectorAll('.c-name, li, [class*="item"], [class*="option"], [class*="result"]')];
                            return els.some(el => el.offsetParent !== null && (el.textContent || '').replace(/\s+/g, '').includes(kw));
                        }, keyword, { timeout: 6000 }).catch(() => {});
                        await page.waitForTimeout(500);
                    }
                    let picked = false;
                    try {
                        const ok = await page.evaluate((kw) => {
                            // 末级名优先在 .c-name，找不到则扫所有结果项元素
                            let names = [...document.querySelectorAll('.c-name')];
                            if (!names.length) {
                                names = [...document.querySelectorAll('li,[class*="item"],[class*="option"],[class*="result"],[class*="cell"],[class*="cat"]')]
                                    .filter(el => el.offsetParent !== null && (el.textContent || '').trim().length > 0 && (el.textContent || '').trim().length < 60);
                            }
                            const norm = s => (s || '').trim().replace(/\s+/g, '');
                            // 先精确末级匹配，再退化到包含匹配
                            let hit = names.find(el => norm(el.textContent).endsWith(kw));
                            if (!hit) hit = names.find(el => norm(el.textContent).includes(kw));
                            if (!hit) return false;
                            let t = hit;
                            for (let i = 0; i < 5 && t.parentElement; i++) {
                                const c = (t.className || '') + '';
                                if (t.tagName === 'LI' || /item|option|result|cell|row|cat/i.test(c)) break;
                                t = t.parentElement;
                            }
                            (t || hit).click();
                            return true;
                        }, keyword);
                        picked = ok;
                    } catch (_) {}
                    if (!picked) { try { await page.locator('.c-name', { hasText: keyword }).first().click({ force: true, timeout: 2000 }); picked = true; } catch (_) {} }
                    if (!picked) {
                        // 兜底：文本节点精确匹配
                        const elH = await page.evaluateHandle((kw) => {
                            const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                            let n; while ((n = w.nextNode())) { if (n.nodeValue.trim() === kw) { let e=n.parentElement; while(e&&e.tagName==='SPAN')e=e.parentElement; return e; } }
                            return null;
                        }, keyword);
                        const el = elH.asElement();
                        if (el) { await el.click({ force: true }); picked = true; }
                    }
                    log('v3 分类点选: ' + keyword + (picked ? ' 成功' : ' 未命中'));
                    if (dryRun) { await page.screenshot({ path: 'step_v3_cat_picked.png' }); log('截图: step_v3_cat_picked.png'); }
                    await page.waitForTimeout(1000);
                }
                // 4) 点「下一步，完善商品信息」进表单
                let entered = false;
                for (let a = 0; a < 3 && !entered; a++) {
                    try {
                        const nextBtn = page.locator('button:has-text("完善商品信息"), button:has-text("下一步"), [class*="btn"]:has-text("下一步")').first();
                        await nextBtn.click({ force: true, timeout: 4000 }).catch(async () => {
                            await page.evaluate(() => {
                                const b = [...document.querySelectorAll('button,a,[role=button]')].find(e => /完善商品信息|下一步/.test(e.textContent || '') && e.offsetParent !== null);
                                if (b) b.click();
                            });
                        });
                        entered = await page.waitForFunction(() =>
                            !!document.querySelector('input[placeholder*="标题"], textarea[placeholder*="标题"]') ||
                            !!document.querySelector('[data-testid="beast-core-select-htmlInput"]'),
                            { timeout: 10000 }).then(() => true).catch(() => false);
                        if (!entered) log(`v3 点下一步后未进表单，重试 ${a + 1}`);
                    } catch (e) { log(`v3 下一步重试 ${a + 1}: ${e.message.split('\n')[0]}`); await page.waitForTimeout(1500); }
                }
                if (!entered) error('v3 未能进入完善商品信息表单：请确认分类已选中、「下一步,完善商品信息」可点');
                log('v3 已进入完善商品信息表单（主图已在前面上传，不重传）');
                await closePddPopups();
                v3Done = true;
            } catch (e) {
                error('v3 流程失败：' + e.message.split('\n')[0]);
            }
            if (dryRun) { await page.screenshot({ path: 'step_v3_form.png' }); log('截图: step_v3_form.png'); }
        }

        // ── 版本二（v2）：分类前置。进入即为分类搜索页(/goods/category)：先搜分类→点「确认发布该类商品」进表单 ──
        let v2CategoryDone = false;
        if (listingVersion === 'v2' && (config.category || '')) {
            const keyword = config.category.split('>').pop().trim();
            try {
                let catInput = await page.$('input[placeholder*="关键词搜索分类"], input[placeholder*="搜索分类"]');
                if (catInput) {
                    await catInput.click({ force: true });
                    await page.waitForTimeout(300);
                    await catInput.type(keyword, { delay: 80 });
                    // 显式等搜索结果项出现（含关键词），最多 6s
                    await page.waitForFunction((kw) => {
                        const els = [...document.querySelectorAll('.c-name, li, [class*="item"], [class*="option"], [class*="result"]')];
                        return els.some(el => el.offsetParent !== null && (el.textContent || '').replace(/\s+/g, '').includes(kw));
                    }, keyword, { timeout: 6000 }).catch(() => {});
                    await page.waitForTimeout(500);
                    // 点选末级分类。结果项是「完整路径 ... > 花洒喷头」整条可点；点「以关键词结尾的整条结果项」。
                    // 末级名在 <div class="c-name">花洒喷头</div>，点它或其可点击父项都能选中。
                    let picked = false;
                    // 方式1：JS 里找文字以关键词结尾的 .c-name，点其可点击祖先（整条结果项）
                    try {
                        const ok = await page.evaluate((kw) => {
                            const names = [...document.querySelectorAll('.c-name')];
                            const hit = names.find(el => (el.textContent || '').trim().replace(/\s+/g, '').endsWith(kw));
                            if (!hit) return false;
                            // 向上找可点击的结果项容器（li / 含 item/option/result/cell 的 div），找不到就点 .c-name 本身
                            let t = hit;
                            for (let i = 0; i < 5 && t.parentElement; i++) {
                                const c = (t.className || '') + '';
                                if (t.tagName === 'LI' || /item|option|result|cell|row|cat/i.test(c)) break;
                                t = t.parentElement;
                            }
                            (t || hit).click();
                            return true;
                        }, keyword);
                        picked = ok;
                    } catch (_) {}
                    // 方式2：locator 兜底——含关键词的 .c-name 直接点
                    if (!picked) {
                        try { await page.locator('.c-name', { hasText: keyword }).first().click({ force: true, timeout: 2000 }); picked = true; } catch (_) {}
                    }
                    if (!picked) {
                        // 兜底2：文本节点精确匹配
                        const elH = await page.evaluateHandle((kw) => {
                            const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                            let n; while ((n = w.nextNode())) { if (n.nodeValue.trim() === kw) { let e=n.parentElement; while(e&&e.tagName==='SPAN')e=e.parentElement; return e; } }
                            return null;
                        }, keyword);
                        const el = elH.asElement();
                        if (el) { await el.click({ force: true }); picked = true; }
                    }
                    log('v2 分类点选: ' + keyword + (picked ? ' 成功' : ' 未命中'));
                    await page.waitForTimeout(1200);
                    if (dryRun) { await page.screenshot({ path: 'step_v2_cat_picked.png' }); log('截图: step_v2_cat_picked.png（核对末级分类是否高亮选中、确认按钮是否变亮）'); }
                } else {
                    log('⚠ v2 未找到分类搜索框');
                }
                // 「确认发布该类商品」按钮：用精确 data-e2e-id 定位（文字匹配会命中内层 span 点不动）。
                // 末级分类选中后按钮才从 disabled 变可用，先等它可用再点。
                const confirmSel = 'button[data-e2e-id="e2e-publish-button"]';
                await page.waitForSelector(confirmSel, { timeout: 8000 }).catch(() => {});
                // 等按钮不再 disabled（最多 6s）
                await page.waitForFunction((sel) => {
                    const b = document.querySelector(sel);
                    return b && !b.disabled && !b.className.includes('disabled');
                }, confirmSel, { timeout: 6000 }).catch(() => {});
                let entered = false;
                for (let a = 0; a < 3 && !entered; a++) {
                    try {
                        // 优先 Playwright 点击；失败则 JS 原生 click 兜底
                        const btn = page.locator(confirmSel).first();
                        await btn.click({ force: true, timeout: 4000 }).catch(async () => {
                            await page.evaluate((sel) => { const b = document.querySelector(sel); if (b) b.click(); }, confirmSel);
                        });
                        // 进表单标志：商品标题框/图片上传区出现，或确认按钮消失。不看 URL。最多等 10s。
                        entered = await page.waitForFunction(() => {
                            const hasTitle = !!document.querySelector('input[placeholder*="标题"], textarea[placeholder*="标题"]');
                            const hasUpload = !!document.querySelector('.uploadImgEnter, input[type="file"]');
                            const confirmGone = !document.querySelector('button[data-e2e-id="e2e-publish-button"]');
                            return hasTitle || hasUpload || confirmGone;
                        }, { timeout: 10000 }).then(() => true).catch(() => false);
                        if (!entered) log(`v2 点确认后未进表单，重试 ${a + 1}`);
                    } catch (e) { log(`v2 确认按钮点击重试 ${a + 1}: ${e.message.split('\n')[0]}`); await page.waitForTimeout(1500); }
                }
                if (!entered) error('v2 未能进入商品表单：「确认发布该类商品」点击后页面未跳转，请确认末级品类「' + keyword + '」已选中（按钮需选中末级才激活）');
                log('v2 已进入商品表单');
                await page.waitForTimeout(2000);
                await closePddPopups();
                v2CategoryDone = true;
            } catch (e) {
                error('v2 分类前置步骤失败：' + e.message.split('\n')[0] + '（请确认末级品类「' + keyword + '」与拼多多一致）');
            }
            if (dryRun) { await page.screenshot({ path: 'step_v2_category.png' }); log('截图: step_v2_category.png'); }
        }

        // ── STEP 1.5：拼多多改版后，发布新商品可能先出现「以图发品 / 搜索发品」选择（也可能没有，容错处理）──
        try {
            const entryClicked = await page.evaluate(() => {
                const labels = [...document.querySelectorAll('.search-tab-label, [class*="search-tab-label"], [class*="tab-label"]')];
                for (const el of labels) {
                    if ((el.textContent || '').replace(/\s+/g, '') === '搜索发品') {
                        let t = el;
                        while (t && t.offsetParent === null && t.parentElement) t = t.parentElement;
                        (t || el).click();
                        return true;
                    }
                }
                for (const el of document.querySelectorAll('div,span,button,a')) {
                    if (el.tagName !== 'INPUT' && (el.textContent || '').replace(/\s+/g, '') === '搜索发品') {
                        el.click(); return true;
                    }
                }
                return false;
            });
            if (entryClicked) { log('STEP1.5: 已点击「搜索发品」'); await page.waitForTimeout(2000); }
            else log('STEP1.5: 未出现「搜索发品」选择（新版直接进表单，跳过）');
        } catch (e) { log('STEP1.5: 处理发品方式选择跳过: ' + e.message.split('\n')[0]); }

        await closePddPopups();
        // 等待 header 遮罩消失，避免误点
        await page.waitForFunction(
            () => { const m = document.getElementById('mms-header__mask'); return !m || m.offsetParent === null || getComputedStyle(m).display === 'none'; },
            { timeout: 10000 }
        ).catch(() => page.evaluate(() => { const m = document.getElementById('mms-header__mask'); if (m) m.style.display = 'none'; }));
        await page.waitForTimeout(500);
        if (dryRun) { await page.screenshot({ path: 'step1_add_page.png' }); log('截图已保存: step1_add_page.png'); }

        // ── STEP 2：上传主图（v3 已在前置步骤传过，跳过不重传）────────────────────────
        progress(15, '上传主图');
        if (config.mainImgDir && !v3Done) {
            const count = await uploadImagesToArea(page, 0, config.mainImgDir);
            log(`主图上传完成，共 ${count} 张`);
            await closePddPopups();
        } else if (v3Done) {
            log('v3：主图已在前置步骤上传，跳过');
        }
        progress(25, '主图上传完成');
        if (dryRun) { await page.screenshot({ path: 'step2_main_imgs.png' }); log('截图已保存: step2_main_imgs.png'); }

        // ── STEP 3：填写商品标题 ────────────────────────────────────────
        progress(30, '填写商品标题');
        if (config.title) {
            // v2 标题框 placeholder 是「商品标题组成：商品描述+规格...」，放宽匹配；等它出现再填
            const titleSel = 'input[placeholder*="商品标题"], textarea[placeholder*="商品标题"], input[placeholder*="标题"], textarea[placeholder*="标题"]';
            let titleInput = await page.$(titleSel);
            if (!titleInput) {
                await page.waitForSelector(titleSel, { timeout: 8000 }).catch(() => {});
                titleInput = await page.$(titleSel);
            }
            if (titleInput) {
                await titleInput.click();
                await titleInput.fill('');
                await titleInput.type(config.title, { delay: 30 });
                await page.waitForTimeout(500);
                log('标题已填写');
            } else {
                log('⚠ 未找到商品标题输入框');
            }
        }

        // ── STEP 4：选择商品分类（版本一：表单内点「选择分类」→ 弹框搜索 → 点选末级 → 确认）──
        //    版本二已在前置分类页选过(v2CategoryDone)，跳过本步。
        progress(38, '选择商品分类');
        const category = config.category || '';
        if (category && !v2CategoryDone && !v3Done) {
            const keyword = category.split('>').pop().trim();
            // 1) 点开「选择分类」按钮
            let opened = false;
            try {
                const selBtn = page.locator('button:has-text("选择分类"), [class*="select"]:has-text("选择分类"), a:has-text("选择分类"), span:has-text("选择分类")').first();
                await selBtn.click({ force: true, timeout: 5000 });
                opened = true;
                log('STEP4: 已点击「选择分类」');
            } catch (_) {
                log('STEP4: 未找到「选择分类」按钮，尝试直接在分类搜索框输入');
            }
            await page.waitForTimeout(1200);
            await closePddPopups();

            // 2) 在弹框/分类区找搜索输入框（排除顶部全局搜索框）
            let catInput = await page.$('input[placeholder*="类目关键词"], input[placeholder*="搜索分类"], input[placeholder*="请输入类目"], input[placeholder*="搜索类目"]');
            if (!catInput) {
                catInput = await page.evaluateHandle(() => {
                    const isGlobal = el => /mms-header/.test(el.className || '') || /搜索功能|订单|课程/.test(el.placeholder || '');
                    // 优先在弹框(dialog/modal)内找
                    const scope = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="dialog"]') || document;
                    const ins = [...scope.querySelectorAll('input[type="text"], input:not([type])')]
                        .filter(el => el.offsetParent !== null && !isGlobal(el));
                    const hit = ins.find(el => /类目|分类|关键词/.test(el.placeholder || '')) || ins[0];
                    return hit || null;
                }).then(h => h.asElement());
            }
            if (catInput) {
                await catInput.click({ force: true });
                await page.waitForTimeout(300);
                await catInput.type(keyword, { delay: 80 });
                // 显式等搜索结果项出现（含关键词），最多 6s
                await page.waitForFunction((kw) => {
                    const els = [...document.querySelectorAll('[class*="searchItem"], [class*="search-item"], [role="dialog"] li, [class*="modal"] li, .c-name')];
                    return els.some(el => el.offsetParent !== null && (el.textContent || '').replace(/\s+/g, '').includes(kw));
                }, keyword, { timeout: 6000 }).catch(() => {});
                await page.waitForTimeout(500);

                // 3) 在弹框结果里点选末级类目（按文字精确匹配）
                let clicked = false;
                try {
                    const exact = page.locator('[class*="searchItem"], [class*="search-item"], [class*="SPP_searchItem"], [role="dialog"] li, [class*="modal"] li')
                        .filter({ hasText: keyword }).first();
                    await exact.click({ force: true, timeout: 3000 });
                    clicked = true;
                    log('STEP4: 分类点击成功: ' + keyword);
                } catch (_) {}
                if (!clicked) {
                    const elHandle = await page.evaluateHandle((kw) => {
                        const scope = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="dialog"]') || document.body;
                        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
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
                    if (el) { await el.click({ force: true }); clicked = true; log('STEP4: 分类 fallback 点击: ' + keyword); }
                    else log('⚠ STEP4: 弹框内未匹配到分类「' + keyword + '」，请确认末级品类名与拼多多一致');
                }
                await page.waitForTimeout(1000);

                // 4) 点弹框「确认/确定」
                try {
                    const okBtn = page.locator('[role="dialog"] button:has-text("确认"), [role="dialog"] button:has-text("确定"), [class*="modal"] button:has-text("确认"), [class*="modal"] button:has-text("确定"), button:has-text("确认")').first();
                    await okBtn.click({ force: true, timeout: 3000 });
                    log('STEP4: 分类弹框已确认');
                    await page.waitForTimeout(1500);
                } catch (_) { log('STEP4: 未找到分类弹框确认按钮（可能点选后自动关闭）'); }
            } else {
                log('⚠ STEP4: 未找到分类搜索输入框，页面可能再次改版');
            }
            // 校验：若页面提示「请先选择分类」则中断
            const needCat = await page.evaluate(() => document.body.innerText.includes('请先选择分类') || document.body.innerText.includes('请选择分类'));
            if (needCat) {
                throw new Error('分类未选中：拼多多提示「请先选择分类」。请检查软件里所选末级品类名是否与拼多多类目库一致（当前关键词：' + keyword + '）');
            }
        }
        progress(40, '分类选择完成');
        if (dryRun) { await page.screenshot({ path: 'step4_category.png' }); log('截图已保存: step4_category.png'); }

        // ── STEP 4.5：点「下一步，完善商品信息」进入第二段表单（新版两段式发布）──
        //    v3 已在前置步骤点过「下一步」进表单，跳过。
        progress(42, '进入完善商品信息');
        if (!v3Done) try {
            // 按钮文字可能是「下一步，完善商品信息」/「下一步」/「完善商品信息」
            let nextClicked = false;
            const nextBtn = page.locator('button:has-text("完善商品信息"), button:has-text("下一步"), [class*="btn"]:has-text("下一步")').first();
            try { await nextBtn.click({ force: true, timeout: 5000 }); nextClicked = true; }
            catch (_) {
                // 兜底：全局找文字含「下一步/完善商品信息」的可点击元素
                nextClicked = await page.evaluate(() => {
                    for (const el of document.querySelectorAll('button,a,[role="button"],div,span')) {
                        const t = (el.textContent || '').replace(/\s+/g, '');
                        if ((t.includes('完善商品信息') || t === '下一步') && el.offsetParent !== null) { el.click(); return true; }
                    }
                    return false;
                });
            }
            if (nextClicked) { log('STEP4.5: 已点「下一步，完善商品信息」'); await page.waitForTimeout(2500); }
            else log('⚠ STEP4.5: 未找到「下一步/完善商品信息」按钮（可能是单段式表单，继续）');
            await closePddPopups();
        } catch (e) { log('STEP4.5: 进入完善商品信息跳过: ' + e.message.split('\n')[0]); }
        if (dryRun) { await page.screenshot({ path: 'step4_5_next.png' }); log('截图已保存: step4_5_next.png'); }

        // ── STEP 5：填写商品属性 ────────────────────────────────────────
        progress(45, '填写商品属性');
        // 先尝试「一键复用」（复用上次同类目商品的属性），它会自动填好大部分属性
        let reused = false;
        const reuseBtn = await page.$('button:has-text("一键复用"), [class*="reuse"]');
        if (reuseBtn) {
            await reuseBtn.click();
            await page.waitForTimeout(2500);
            reused = true;
            log('已点击一键复用');
        }
        if (config.attributes) {
            for (const [attrName, attrValue] of Object.entries(config.attributes)) {
                if (!attrValue) continue;
                try {
                    // 一键复用后：该属性若已有值，则跳过（避免再次点击导致多选项被反选清空，如「功能特点」）；
                    //   仅当已填值与前端输入不一致时才覆盖（以前端为准）。未填的正常填。
                    const cur = await attrCurrentValue(page, attrName);
                    if (reused && cur) {
                        const want = String(attrValue);
                        const same = cur.includes(want) || want.includes(cur)
                            || want.split(/[、,，\/]/).every(v => !v.trim() || cur.includes(v.trim()));
                        if (same) { log(`属性「${attrName}」一键复用已填(${cur})，跳过`); continue; }
                        log(`属性「${attrName}」复用值「${cur}」与前端「${want}」不一致，以前端为准重填`);
                    }
                    const ok = await fillAttribute(page, attrName, String(attrValue));
                    log(ok ? `属性「${attrName}」已填: ${attrValue}` : `属性「${attrName}」未找到匹配项「${attrValue}」，已跳过`);
                } catch (e) {
                    log(`属性「${attrName}」填写异常，已跳过: ${e.message}`);
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

                // 先等 init-loading 遮罩消失，避免它拦截点击导致「Element is not attached / intercepts pointer events」
                await page.waitForFunction(
                    () => !document.querySelector('.init-loading, [class*="init-loading"]'),
                    { timeout: 8000 }
                ).catch(() => {});

                try {
                // 规格名输入框也是虚拟滚动：先滚到规格区底部，触发新空框渲染
                await page.evaluate(() => {
                    const section = document.getElementById('goods-spec-sku');
                    if (!section) return;
                    const scrollers = [section, ...section.querySelectorAll('*')].filter(el => {
                        const s = getComputedStyle(el);
                        return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 20;
                    });
                    (scrollers[0] || document.scrollingElement || section).scrollTop = 1e9;
                });
                await sleep(400);

                const beforeCount = (await page.$$('#goods-spec-sku input[placeholder="请输入规格名称"]')).length;

                // 取第一个空的（value 为空）输入框
                const allInps = await page.$$('#goods-spec-sku input[placeholder="请输入规格名称"]');
                let inp = null;
                for (const h of allInps) {
                    const val = await h.evaluate(el => el.value);
                    if (!val || val.trim() === '') { inp = h; break; }
                }

                if (!inp) {
                    // 没有空框了：可能需要点"添加规格值/+"按钮新增一行
                    const addBtn = page.locator('#goods-spec-sku').locator(
                        'text=/添加规格值|新增规格值|添加.*款式|\\+ ?添加/'
                    ).first();
                    let added = false;
                    if (await addBtn.count().catch(() => 0) > 0) {
                        await addBtn.scrollIntoViewIfNeeded().catch(() => {});
                        await addBtn.click({ timeout: 2000 }).catch(() => {});
                        await sleep(500);
                        const ai = await page.$$('#goods-spec-sku input[placeholder="请输入规格名称"]');
                        for (const h of ai) {
                            const v = await h.evaluate(el => el.value);
                            if (!v || v.trim() === '') { inp = h; added = true; break; }
                        }
                    }
                    if (!inp) {
                        log(`第${i+1}个规格值：找不到空输入框且无法新增行，跳过: ${sku.name}（当前框数=${beforeCount}）`);
                        continue;
                    }
                    if (added) log(`第${i+1}个规格值：点击"添加"后获得新空框`);
                }

                await inp.scrollIntoViewIfNeeded().catch(() => {});
                await inp.click({ force: true }).catch(() => {});
                await humanDelay(150, 300);
                // 用 JS 原子地清空并写值（React 受控输入用 nativeSetter），避免 type 期间虚拟滚动重排导致
                // 「Element is not attached to the DOM」；写完派发 input/change 触发 React 更新。
                let filled = false;
                try {
                    await inp.evaluate((el, val) => {
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(el, '');
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        setter.call(el, val);
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }, sku.name);
                    filled = true;
                } catch (e) {
                    log(`第${i+1}个规格值 JS 写值失败，回退 type: ${e.message.split('\n')[0]}`);
                }
                if (!filled) {
                    // 回退：重新按索引取一次输入框再 type（防止旧 handle 失效）
                    try {
                        await inp.type(sku.name, { delay: rand(60, 100) });
                    } catch (e2) {
                        log(`第${i+1}个规格值 type 也失败，跳过: ${e2.message.split('\n')[0]}`);
                        continue;
                    }
                }
                await humanDelay(200, 400);

                // 写后校验回读：React 受控框偶发吞首字/异步覆盖，回读不符则重写一次
                try {
                    const actual = await inp.evaluate(el => el.value).catch(() => null);
                    if (actual != null && actual.replace(/\s+/g, '') !== sku.name.replace(/\s+/g, '')) {
                        log(`第${i+1}个规格值回读不符（期望「${sku.name}」实际「${actual}」），重写一次`);
                        await inp.evaluate((el, val) => {
                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                            setter.call(el, '');
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            setter.call(el, val);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }, sku.name).catch(() => {});
                        await humanDelay(150, 300);
                    }
                } catch (_) {}

                await inp.press('Enter').catch(() => {});

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
                } catch (e) {
                    log(`第${i+1}个规格值填写异常，跳过继续: ${e.message.split('\n')[0]}`);
                }
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
            log('STEP: 开始处理"添加图片"复选框');
            try {
                let addImgCheckbox = null;
                const lbl = page.locator('label:has-text("添加图片")').first();
                if (await lbl.count() > 0) {
                    const cb = lbl.locator('input[type="checkbox"]').first();
                    if (await cb.count() > 0) addImgCheckbox = cb;
                }
                if (!addImgCheckbox) {
                    const cb2 = page.locator('input[type="checkbox"][class*="img"]').first();
                    if (await cb2.count() > 0) addImgCheckbox = cb2;
                }
                if (addImgCheckbox) {
                    await addImgCheckbox.scrollIntoViewIfNeeded().catch(() => {});
                    await humanDelay(400, 600);
                    const checked = await addImgCheckbox.evaluate(el => el.checked).catch(() => false);
                    if (!checked) {
                        await addImgCheckbox.evaluate(el => el.click()).catch(() => {});
                        await humanDelay(400, 600);
                    }
                    log('STEP: 添加图片已勾选');
                } else {
                    log('STEP: 未找到"添加图片"复选框，跳过');
                }
            } catch (e) {
                log('添加图片复选框操作失败，跳过: ' + e.message.split('\n')[0]);
            }

            // 勾选"添加图片"后可能弹出"新增批量上传规格图功能"引导弹窗，关闭它
            log('STEP: 开始关闭引导弹窗');
            try {
                await page.waitForTimeout(800);
                let closed = false;
                for (const txt of ['我知道了', '知道了', '我知道啦', '跳过', '不再提示']) {
                    const btn = page.locator(`button:has-text("${txt}")`).first();
                    const cnt = await btn.count().catch(() => 0);
                    if (cnt > 0 && await btn.isVisible().catch(() => false)) {
                        await btn.click({ timeout: 1500 }).catch(() => {});
                        log('STEP: 已点击引导弹窗按钮"' + txt + '"');
                        await page.waitForTimeout(400);
                        closed = true;
                        break;
                    }
                }
                if (!closed) log('STEP: 未发现引导弹窗按钮');
                await page.keyboard.press('Escape').catch(() => {});
                await page.waitForTimeout(300);
            } catch (e) {
                log('关闭引导弹窗操作跳过: ' + e.message.split('\n')[0]);
            }
            log('STEP: 进入 SKU 图诊断/上传阶段, dryRun=' + dryRun);
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
            // 拼多多规格表 file input 是虚拟滚动：任何时刻只渲染可见的 ~11 行，
            // 无法一次性拿到全部行。故"边滚边传"——逐个 SKU：把它的行滚进视口触发渲染，
            // 等该行 file input 出现，立即传图。
            const allSkuNames = config.skus.map(s => (s.name || '').replace(/\s+/g, '')).filter(Boolean);
            const skippedNoImg = [];

            for (let i = 0; i < config.skus.length; i++) {
                const sku = config.skus[i];
                if (!sku.imgDir || !fs.existsSync(sku.imgDir)) {
                    log(`SKU[${i}] (${sku.name}) 无图片(imgDir=${sku.imgDir || '空'})，跳过`);
                    skippedNoImg.push(i + 1);
                    continue;
                }
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

                const key = sku.name.replace(/\s+/g, '');
                // 直接返回目标行的 file input 句柄（同一次 evaluate 内定位+滚动+取句柄），
                // 避免"先标记再重新查询"之间虚拟滚动重排导致标记元素失效/错位。
                // 同时排除"批量设置"行——它也有 file input，误传会把图灌进批量槽污染所有 SKU。
                const handle = await page.evaluateHandle((args) => {
                    const { target, allNames } = args;
                    const section = document.getElementById('goods-spec-sku');
                    if (!section) return null;
                    const rows = section.querySelectorAll('tr, [class*="row"], [class*="Row"], [class*="item"]');
                    for (const row of rows) {
                        const txt = row.textContent.replace(/\s+/g, '');
                        // 跳过批量设置行
                        if (txt.includes('批量') || txt.includes('批量设置')) continue;
                        if (!txt.includes(target)) continue;
                        // 行内可能命中多个 SKU 名（一个名是另一个子串）；只接受 target 是最长（最具体）的那个
                        const matched = allNames.filter(n => n && txt.includes(n));
                        const longest = matched.reduce((a, b) => (b.length > a.length ? b : a), '');
                        if (longest !== target) continue;
                        const inp = row.querySelector('input[type="file"]');
                        if (!inp) continue;
                        row.scrollIntoView({ block: 'center' });
                        return inp;
                    }
                    return null;
                }, { target: key, allNames: allSkuNames });

                const inp = handle && handle.asElement ? handle.asElement() : null;
                if (!inp) { log(`SKU[${i}] (${sku.name}) 滚动后仍找不到对应行，跳过`); skippedNoImg.push(i + 1); continue; }
                await page.waitForTimeout(300);
                await inp.setInputFiles(skuFile);
                await page.waitForFunction(() => !document.querySelector('.init-loading, [class*="init-loading"]'), { timeout: 8000 }).catch(() => {});
                await humanDelay(800, 1200);
                log(`SKU图片已上传[${i}] ${sku.name}: ${path.basename(skuFile)}`);
            }
            if (skippedNoImg.length) {
                log(`⚠ 警告：第 ${skippedNoImg.join('、')} 行 SKU 未能上传图片，请检查这些 SKU 的图或名称匹配`);
            }

            // ── STEP 9.5：发布前检测 SKU 图是否都上传成功，缺的补传 ──
            // 上传成功后该 SKU 行的 file input 会消失；按名称重新定位仍存在 input 的行补传。
            {
                let round = 0;
                while (round < 2) {
                    let fixedCount = 0;
                    const allNames2 = config.skus.map(s => (s.name || '').replace(/\s+/g, '')).filter(Boolean);
                    for (let i = 0; i < config.skus.length; i++) {
                        const sku = config.skus[i];
                        if (!sku.imgDir || !fs.existsSync(sku.imgDir)) continue;
                        const h = await page.evaluateHandle((args) => {
                            const { target, allNames } = args;
                            const section = document.getElementById('goods-spec-sku');
                            if (!section) return null;
                            for (const el of section.querySelectorAll('input[type="file"]')) {
                                const row = el.closest('tr, [class*="row"], [class*="Row"], [class*="item"]');
                                const txt = row ? row.textContent.replace(/\s+/g, '') : '';
                                if (txt.includes('批量') || txt.includes('批量设置')) continue; // 排除批量设置行
                                if (!txt.includes(target)) continue;
                                // 同上：只在 target 是该行命中的最长 SKU 名时才补传，避免短名误配长名行
                                const matched = allNames.filter(n => n && txt.includes(n));
                                const longest = matched.reduce((a, b) => (b.length > a.length ? b : a), '');
                                if (longest === target) return el;
                            }
                            return null;
                        }, { target: sku.name.replace(/\s+/g, ''), allNames: allNames2 });
                        const inp = h && h.asElement ? h.asElement() : null;
                        if (!inp) continue; // 该行 input 已消失 = 已传成功
                        const stat = fs.statSync(sku.imgDir);
                        const skuFile = stat.isFile() ? sku.imgDir
                            : fs.readdirSync(sku.imgDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort().map(f => path.join(sku.imgDir, f))[0];
                        if (!skuFile) continue;
                        log(`SKU图补传：第 ${i + 1} 个(${sku.name})`);
                        await inp.setInputFiles(skuFile);
                        await page.waitForFunction(() => !document.querySelector('.init-loading, [class*="init-loading"]'), { timeout: 8000 }).catch(() => {});
                        await humanDelay(800, 1200);
                        fixedCount++;
                    }
                    if (fixedCount === 0) { log('SKU图检测：全部已上传 ✓'); break; }
                    round++;
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

            // 取价格区所有可见"请输入"框及其所在行的标识，用于正确分组
            const priceInputsInfo = await page.evaluate(() => {
                const section = document.getElementById('goods-spec-sku');
                if (!section) return [];
                const inputs = [...section.querySelectorAll('input[placeholder="请输入"]')]
                    .filter(el => el.offsetParent !== null);
                return inputs.map((el, idx) => {
                    // 找最近的"行"容器，用其在父列表中的位置做行号
                    const row = el.closest('tr, [class*="row"], [class*="Row"], [class*="item"]');
                    let rowKey = 'none', rowTag = '', rowCls = '';
                    if (row) {
                        const sib = [...(row.parentElement ? row.parentElement.children : [])];
                        rowKey = String(sib.indexOf(row));
                        rowTag = row.tagName;
                        rowCls = (row.className || '').toString().slice(0, 40);
                    }
                    return { idx, rowKey, rowTag, rowCls };
                });
            });
            log(`价格框分布(前15): ${JSON.stringify(priceInputsInfo.slice(0, 15))}`);
            log(`价格框总数: ${priceInputsInfo.length}`);
            // 批量设置入口 + 表格结构诊断
            const batchDiag = await page.evaluate(() => {
                const section = document.getElementById('goods-spec-sku');
                if (!section) return { error: 'no section' };
                // 找"批量"相关按钮/文本
                const batchEls = [...section.querySelectorAll('*')].filter(el => {
                    const t = (el.childElementCount === 0 ? el.textContent : '').trim();
                    return /批量(设置|填写|操作)|一键设置/.test(t);
                }).map(el => ({ tag: el.tagName, cls: (el.className||'').toString().slice(0,40), txt: el.textContent.trim().slice(0,20) }));
                // 所有 table 及各自 tr 数
                const tables = [...section.querySelectorAll('table')].map((tb, i) => ({
                    i, rows: tb.querySelectorAll('tr').length,
                    rowsWithInput: [...tb.querySelectorAll('tr')].filter(r => r.querySelector('input[placeholder="请输入"]')).length,
                    cls: (tb.className||'').toString().slice(0,30)
                }));
                return { batchEls: batchEls.slice(0, 8), tables };
            });
            log(`批量入口诊断: ${JSON.stringify(batchDiag)}`);
            // 批量设置行深度诊断：dump 批量行的输入框(placeholder/类型)和附近按钮(应用/确定)，
            // 用于把"库存+单买价"改成批量填一次（全表统一值），减少逐行虚拟滚动操作。
            const batchRowDiag = await page.evaluate(() => {
                const section = document.getElementById('goods-spec-sku');
                if (!section) return { error: 'no section' };
                // 找含"批量/全部款式"且带输入框的行
                const rows = [...section.querySelectorAll('tr, [class*="row"], [class*="Row"], [class*="item"]')];
                const out = [];
                for (const r of rows) {
                    const t = r.textContent.replace(/\s+/g, '');
                    if (!/批量|全部款式|一键/.test(t)) continue;
                    const inputs = [...r.querySelectorAll('input')].map(el => ({
                        ph: (el.placeholder || '').slice(0, 20),
                        type: el.type, disabled: el.disabled,
                        val: (el.value || '').slice(0, 10)
                    }));
                    const btns = [...r.querySelectorAll('button, [class*="btn"], [class*="Btn"], span')]
                        .map(el => (el.textContent || '').trim()).filter(x => x && x.length <= 8 && /应用|确定|批量|设置|保存/.test(x));
                    if (inputs.length || btns.length) {
                        out.push({ txt: t.slice(0, 40), inputs, btns: [...new Set(btns)].slice(0, 6) });
                    }
                }
                return { rows: out.slice(0, 6) };
            });
            log(`批量设置行深度诊断: ${JSON.stringify(batchRowDiag)}`);
            // 虚拟列表行结构诊断：看行靠什么标识真实行号（data-*/aria-rowindex/transform/top）
            const rowStructDiag = await page.evaluate(() => {
                const section = document.getElementById('goods-spec-sku');
                if (!section) return 'no section';
                const tbl = [...section.querySelectorAll('table')].find(t => t.querySelector('input[placeholder="请输入"]'));
                if (!tbl) return 'no price table';
                const rows = [...tbl.querySelectorAll('tr')].filter(r => r.querySelector('input[placeholder="请输入"]'));
                const sample = rows.slice(0, 3).map(r => {
                    const attrs = {};
                    for (const a of r.attributes) attrs[a.name] = a.value.slice(0, 30);
                    const cs = getComputedStyle(r);
                    return { attrs, top: r.offsetTop, transform: cs.transform.slice(0, 30), position: cs.position, rectTop: Math.round(r.getBoundingClientRect().top) };
                });
                // 滚动容器内有没有"撑高占位"元素（虚拟列表特征）
                let scroller = tbl.parentElement, scrollerInfo = 'none';
                while (scroller && scroller !== document.body) {
                    const s = getComputedStyle(scroller);
                    if (/(auto|scroll)/.test(s.overflowY) && scroller.scrollHeight > scroller.clientHeight + 10) {
                        scrollerInfo = { cls: (scroller.className||'').toString().slice(0,30), scrollH: scroller.scrollHeight, clientH: scroller.clientHeight };
                        break;
                    }
                    scroller = scroller.parentElement;
                }
                const rowH = rows.length >= 2 ? Math.round(rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top) : 0;
                return { sampleRows: sample, scroller: scrollerInfo, rowHeight: rowH, renderedRows: rows.length };
            });
            log(`行结构诊断: ${JSON.stringify(rowStructDiag)}`);
            // 统计每个 rowKey 的框数分布，看清是否有行不足4个框被过滤
            const rowKeyCount = {};
            priceInputsInfo.forEach(x => { rowKeyCount[x.rowKey] = (rowKeyCount[x.rowKey] || 0) + 1; });
            log(`各行框数分布(rowKey:框数): ${JSON.stringify(rowKeyCount)}`);

            // 直接按 goods-spec-sku 内的全部 "请输入" input 按顺序分组
            const allPriceInputs = await page.evaluate(() => {
                const section = document.getElementById('goods-spec-sku');
                if (!section) return [];
                return [...section.querySelectorAll('input[placeholder="请输入"]')]
                    .filter(el => el.offsetParent !== null)
                    .map(el => el.placeholder);
            });
            log(`价格区域可见 "请输入" inputs: ${allPriceInputs.length} 个`);

            const maxGroupPrice = Math.max(...config.skus.map(s => s.groupPrice / 100));
            const batchSinglePrice = (maxGroupPrice + 1).toFixed(2);

            // ── 批量设置：库存(8888)+单买价(全表统一) 一次填好，应用到所有 SKU ──
            // 库存/单买价全表相同，用批量行填一次，省去逐行操作、减少虚拟滚动暴露。
            // 逐行循环里这两列只在"该格仍为空"时兜底补填，所以批量失败也不会漏。
            const batchStock = String(config.skus[0]?.stock || 8888);
            try {
                // 批量行：含"全部款式"、带 placeholder=库存/单买价 的输入框那一行
                const filled = await page.evaluate((args) => {
                    const { stock, single } = args;
                    const section = document.getElementById('goods-spec-sku');
                    if (!section) return false;
                    const rows = [...section.querySelectorAll('tr, [class*="row"], [class*="Row"], [class*="item"]')];
                    const setVal = (el, v) => {
                        const proto = Object.getPrototypeOf(el);
                        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
                        desc && desc.set ? desc.set.call(el, v) : (el.value = v);
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    };
                    for (const r of rows) {
                        const t = r.textContent.replace(/\s+/g, '');
                        if (!/全部款式/.test(t)) continue;
                        const stockInp = r.querySelector('input[placeholder="库存"]');
                        const singleInp = r.querySelector('input[placeholder="单买价"]');
                        if (!stockInp && !singleInp) continue;
                        if (stockInp) setVal(stockInp, stock);
                        if (singleInp) setVal(singleInp, single);
                        return true;
                    }
                    return false;
                }, { stock: batchStock, single: batchSinglePrice });
                if (filled) {
                    // 点"批量设置"按钮应用到全表
                    const applied = await page.evaluate(() => {
                        const section = document.getElementById('goods-spec-sku');
                        if (!section) return false;
                        const rows = [...section.querySelectorAll('tr, [class*="row"], [class*="Row"], [class*="item"]')];
                        for (const r of rows) {
                            if (!/全部款式/.test(r.textContent.replace(/\s+/g, ''))) continue;
                            const btn = [...r.querySelectorAll('button, [class*="btn"], [class*="Btn"], span, a')]
                                .find(el => (el.textContent || '').trim() === '批量设置');
                            if (btn) { btn.click(); return true; }
                        }
                        return false;
                    });
                    await page.waitForTimeout(600);
                    log(`批量设置：库存=${batchStock} 单买价=${batchSinglePrice}，应用按钮=${applied ? '已点击' : '未找到'}`);
                } else {
                    log('批量设置行未找到库存/单买价输入框，改为逐行填写');
                }
            } catch (e) {
                log('批量设置失败，改为逐行填写: ' + e.message.split('\n')[0]);
            }

            // 价格表是虚拟滚动，不可靠 offsetTop 定位（行高不固定，第12行起易错位）。
            // 改用 SKU 名称文本匹配定位行——与 SKU 图上传阶段（第779行）同策略：
            // 在 goods-spec-sku 内遍历价格表行，按行内 textContent 匹配 SKU 名称，
            // scrollIntoView 触发虚拟列表渲染，再标记该行的"请输入"input 后填入。
            // 去重大容器行：一行含多个 SKU 名称的是汇总行，跳过。
            const allNamesP = config.skus.map(s => (s.name || '').replace(/\s+/g, '')).filter(Boolean);

            for (let i = 0; i < config.skus.length; i++) {
                const sku = config.skus[i];
                const groupPriceYuan = parseFloat((sku.groupPrice / 100).toFixed(2));
                const key = (sku.name || '').replace(/\s+/g, '');
                log(`处理第 ${i+1} 行 SKU: ${sku.name}`);

                if (!key) { log(`第 ${i+1} 行 SKU 名称为空，跳过`); continue; }

                // 按 SKU 名称在价格表中匹配行（最多尝试 8 次，等虚拟列表渲染）
                let found = false;
                for (let attempt = 0; attempt < 8 && !found; attempt++) {
                    found = await page.evaluate((args) => {
                        const { target, allNames } = args;
                        const section = document.getElementById('goods-spec-sku');
                        if (!section) return false;
                        section.querySelectorAll('[data-pcell]').forEach(el => el.removeAttribute('data-pcell'));

                        // 找价格表（含"请输入"框的 table）
                        const tbls = [...section.querySelectorAll('table')].filter(t => t.querySelector('input[placeholder="请输入"]'));
                        if (!tbls.length) return false;

                        for (const tbl of tbls) {
                            const rows = [...tbl.querySelectorAll('tr')].filter(r => {
                                if (r.querySelectorAll('input[placeholder="请输入"]').length < 2) return false;
                                const t = r.textContent.replace(/\s+/g, '');
                                return !/全部款式|批量|启用\/停用|如实填写|承诺发货|全屏编辑/.test(t);
                            });

                            for (const row of rows) {
                                const txt = row.textContent.replace(/\s+/g, '');
                                if (!txt.includes(target)) continue;
                                // 去重：该行含其他 SKU 名数量>3 的是大容器行（如批量行），跳过
                                const matchedCount = allNames.filter(n => n && n !== target && txt.includes(n)).length;
                                if (matchedCount > 3) continue;

                                row.scrollIntoView({ block: 'center' });
                                const ins = [...row.querySelectorAll('input[placeholder="请输入"]')];
                                ins.forEach((el, c) => el.setAttribute('data-pcell', String(c)));
                                return true;
                            }
                        }
                        return false;
                    }, { target: key, allNames: allNamesP });

                    if (!found) await page.waitForTimeout(400);
                }

                // 名称匹配失败：回退 offsetTop 定位（兼容少数直接行匹配不到的场景）
                if (!found) {
                    log(`第 ${i+1} 行名称匹配未找到，回退 offsetTop 定位`);
                    let picked = { ok: false };
                    for (let attempt = 0; attempt < 6 && !picked.ok; attempt++) {
                        await page.evaluate((rowIndex) => {
                            const section = document.getElementById('goods-spec-sku');
                            if (!section) return;
                            const tbl = [...section.querySelectorAll('table')].find(t => t.querySelector('input[placeholder="请输入"]'));
                            if (!tbl) return;
                            let scroller = tbl.parentElement;
                            while (scroller && scroller !== document.body) {
                                const s = getComputedStyle(scroller);
                                if (/(auto|scroll)/.test(s.overflowY) && scroller.scrollHeight > scroller.clientHeight + 10) break;
                                scroller = scroller.parentElement;
                            }
                            if (scroller && scroller !== document.body) scroller.scrollTop = Math.max(0, rowIndex * 88 - 40);
                        }, i);
                        await page.waitForTimeout(350);
                        picked = await page.evaluate((rowIndex) => {
                            const section = document.getElementById('goods-spec-sku');
                            if (!section) return { ok: false };
                            section.querySelectorAll('[data-pcell]').forEach(el => el.removeAttribute('data-pcell'));
                            const tbl = [...section.querySelectorAll('table')].find(t => t.querySelector('input[placeholder="请输入"]'));
                            if (!tbl) return { ok: false };
                            const rowH = 88;
                            const targetTop = rowIndex * rowH;
                            const rows = [...tbl.querySelectorAll('tr')].filter(r => {
                                if (r.querySelectorAll('input[placeholder="请输入"]').length < 2) return false;
                                const t = r.textContent.replace(/\s+/g, '');
                                return !/全部款式|批量|启用\/停用|如实填写|承诺发货|全屏编辑/.test(t);
                            });
                            let best = null, bestDist = 1e9;
                            for (const r of rows) {
                                const d = Math.abs(r.offsetTop - targetTop);
                                if (d < bestDist) { bestDist = d; best = r; }
                            }
                            if (!best || bestDist > rowH) return { ok: false, bestDist, rendered: rows.length };
                            const ins = [...best.querySelectorAll('input[placeholder="请输入"]')];
                            ins.forEach((el, c) => el.setAttribute('data-pcell', String(c)));
                            return { ok: true };
                        }, i);
                        if (!picked.ok) await page.waitForTimeout(200);
                    }
                    if (!picked.ok) { log(`第 ${i+1} 行 offsetTop 定位也失败（bestDist=${picked.bestDist}, rendered=${picked.rendered}），跳过`); continue; }
                }

                await page.waitForTimeout(150);

                const fillCell = async (c, value, onlyIfEmpty) => {
                    if (value === undefined || value === null || value === '') return;
                    const el = await page.$(`#goods-spec-sku input[data-pcell="${c}"]`);
                    if (!el) { log(`  列${c}找不到输入框`); return; }
                    if (onlyIfEmpty) {
                        const cur = (await el.inputValue().catch(() => '')).trim();
                        if (cur) return;  // 批量设置已填，跳过
                    }
                    await el.scrollIntoViewIfNeeded().catch(() => {});
                    await humanType(page, el, String(value));
                    await humanDelay(150, 300);
                };
                await fillCell(0, batchStock, true);                // 库存：批量已填则跳过，否则兜底
                await fillCell(1, groupPriceYuan.toFixed(2));        // 拼单价：每行不同，必填
                await fillCell(2, batchSinglePrice, true);          // 单买价：批量已填则跳过，否则兜底
                if (sku.itemCode) await fillCell(3, sku.itemCode);  // 规格编码：每行不同，必填
                await humanDelay(300, 600);
            }

            // 填完后验证：检查是否还有空白库存/价格行（兜底补填）
            {
                const emptyRows = await page.evaluate(() => {
                    const section = document.getElementById('goods-spec-sku');
                    if (!section) return [];
                    const tbls = [...section.querySelectorAll('table')].filter(t => t.querySelector('input[placeholder="请输入"]'));
                    const result = [];
                    for (const tbl of tbls) {
                        const rows = [...tbl.querySelectorAll('tr')].filter(r => {
                            if (r.querySelectorAll('input[placeholder="请输入"]').length < 2) return false;
                            const t = r.textContent.replace(/\s+/g, '');
                            return !/全部款式|批量|启用\/停用|如实填写|承诺发货|全屏编辑/.test(t);
                        });
                        for (const row of rows) {
                            const ins = [...row.querySelectorAll('input[placeholder="请输入"]')];
                            const emptyCols = [];
                            // 只检查前两列（库存和拼单价）是否为空
                            for (let c = 0; c < Math.min(2, ins.length); c++) {
                                if (!ins[c].value || ins[c].value.trim() === '') emptyCols.push(c);
                            }
                            if (emptyCols.length > 0) {
                                result.push({ rowText: row.textContent.replace(/\s+/g, ' ').trim().substring(0, 60), emptyCols });
                            }
                        }
                    }
                    return result;
                });
                if (emptyRows.length > 0) {
                    log(`⚠ 价格验证：发现 ${emptyRows.length} 行仍有空字段: ${JSON.stringify(emptyRows.slice(0, 5))}`);
                } else {
                    log('✓ 价格验证：所有行库存和拼单价均已填写');
                }
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
            await context.close();
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

        // 判成功：URL 跳到成功页（goods_add/success?goods_id=... 即成功）或商品列表页，或出现成功弹窗。
        // 注意：成功页 URL 形如 .../goods_add/success，含 success 即成功——不能因它也含 goods_add 就否定。
        const okUrl = /\/success(\?|$|\/)/.test(submitResultUrl) || submitResultUrl.includes('goods_list') || submitResultUrl.includes('goods/list');
        const successModal = await page.$('.success-modal, [class*="successModal"], [class*="result-success"], [class*="publishSuccess"]').catch(() => null);
        const isSuccess = okUrl || !!successModal;

        if (isSuccess) {
            progress(100, '商品发布成功');
            const cookies = await context.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            done('success');
        } else {
            // 失败：把页面上的报错/红字/校验提示全部抓出来，便于定位真实原因
            const errMsgs = await page.evaluate(() => {
                const out = [];
                const sel = '[class*="error"], [class*="Error"], [class*="errMsg"], [class*="invalid"], '
                          + '[class*="toast"], [class*="Toast"], [class*="message"], [class*="Message"], '
                          + '[class*="form-explain"], [class*="formExplain"], [aria-invalid="true"]';
                document.querySelectorAll(sel).forEach(el => {
                    const t = (el.textContent || '').trim();
                    if (t && t.length < 80 && out.indexOf(t) < 0) out.push(t);
                });
                return out.slice(0, 20);
            }).catch(() => []);
            const joined = errMsgs.join(' | ');
            log('页面报错/校验提示: ' + (joined || '(未抓到明确报错文字，请看 submit_result.png 截图)'));
            error('上架未成功：提交后停留在编辑页(' + submitResultUrl + ')。页面提示: ' + (joined || '无，见 submit_result.png'));
        }

    } catch (e) {
        log('发生异常: ' + e.message);
        await page.screenshot({ path: 'error_screenshot.png' }).catch(() => {});
        error(e.message);
    } finally {
        await context.close();
    }
}

main().catch(e => error(e.message));
