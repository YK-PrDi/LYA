// ── LY-Automation 上新模式前端逻辑 ──

// HTML 属性转义
function ecEscAttr(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── gf-select 通用下拉 ──
function toggleSelect(el, event) {
    event.stopPropagation();
    const wrapper = el.closest('.gf-select');
    const wasOpen = wrapper.classList.contains('open');
    closeAllSelects();
    if (!wasOpen) wrapper.classList.add('open');
}

function closeAllSelects() {
    document.querySelectorAll('.gf-select').forEach(sel => sel.classList.remove('open'));
}

function selectOption(el, event) {
    event.stopPropagation();
    const wrapper = el.closest('.gf-select');
    if (!wrapper) return;
    const val = el.getAttribute('data-value');
    const text = el.childNodes[0].nodeType === Node.TEXT_NODE
        ? el.childNodes[0].textContent.trim() : el.textContent.trim();
    wrapper.querySelector('input').value = val;
    wrapper.querySelector('.gf-select-text').textContent = text;
    wrapper.querySelectorAll('.gf-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    closeAllSelects();
}

// 全局点击关闭下拉 + 品类级联
document.addEventListener('click', (e) => {
    if (!e.target.closest('.gf-select')) closeAllSelects();
    const cas = document.getElementById('lst-cat-cascader');
    if (cas && !e.target.closest('#lst-cat-cascader') && !e.target.closest('#lst-cat-panels')) {
        cas.classList.remove('open');
        const wrap = document.getElementById('lst-cat-search-wrap');
        if (wrap) wrap.style.display = 'none';
        lstHidePanels();
    }
});

// ── 上新模式状态 ──
let lstSkuItems = [];
let lstCatPath = [];

// ── 品类级联 ──
function lstToggleCascader(e) {
    e.stopPropagation();
    const cas = document.getElementById('lst-cat-cascader');
    const willOpen = !cas.classList.contains('open');
    cas.classList.toggle('open');
    if (willOpen) {
        const wrap = document.getElementById('lst-cat-search-wrap');
        if (wrap) { wrap.style.display = ''; const inp = document.getElementById('lst-cat-search'); if (inp) inp.value = ''; }
        lstRefreshCascader();
        requestAnimationFrame(lstPositionPanels);
    } else {
        lstHidePanels();
    }
}

// fixed 定位面板：移到 body 脱离裁剪，按触发器位置算坐标
// 搜索框 wrap 也一起移到 body，定位在面板正上方，避免被 fixed 面板盖住导致无法输入
function lstPositionPanels() {
  try {
    const cas = document.getElementById('lst-cat-cascader');
    const panels = document.getElementById('lst-cat-panels');
    const searchWrap = document.getElementById('lst-cat-search-wrap');
    if (!cas || !panels || !cas.classList.contains('open')) return;
    if (panels.parentElement !== document.body) document.body.appendChild(panels);
    if (searchWrap && searchWrap.parentElement !== document.body) document.body.appendChild(searchWrap);
    panels.style.display = 'flex';
    const trig = cas.querySelector('.ec-cascader-trigger') || cas;
    const r = trig.getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth;
    const panelW = Math.min(540, vw - 16);
    let left = r.left;
    if (left + panelW > vw - 8) left = Math.max(8, vw - 8 - panelW);
    // 搜索框高度（移到 body 后用 fixed 定位在触发器正下方）
    const searchH = (searchWrap && searchWrap.style.display !== 'none') ? 40 : 0;
    if (searchWrap && searchH) {
        searchWrap.style.cssText = `display:block;position:fixed;z-index:100000;left:${left}px;top:${r.bottom + 4}px;width:${Math.min(260, vw - 16)}px;background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;padding:6px 8px;box-shadow:0 4px 16px rgba(0,0,0,.08);`;
    }
    const spaceBelow = vh - r.bottom - searchH, spaceAbove = r.top;
    panels.style.left = left + 'px';
    let mh, top;
    if (spaceBelow >= spaceAbove) { top = r.bottom + 4 + searchH; mh = Math.max(160, spaceBelow - 12); }
    else { mh = Math.min(spaceAbove - 12, Math.floor(vh * 0.7)); top = Math.max(8, r.top - 4 - mh); }
    panels.style.top = top + 'px';
    panels.style.maxHeight = 'none';
    panels.querySelectorAll('.ec-cascader-panel').forEach(p => { p.style.maxHeight = mh + 'px'; });
  } catch (err) { console.error('lstPositionPanels', err); }
}

function lstHidePanels() {
    const panels = document.getElementById('lst-cat-panels');
    if (panels && panels.parentElement === document.body) panels.style.display = 'none';
    const sw = document.getElementById('lst-cat-search-wrap');
    if (sw && sw.parentElement === document.body) sw.style.display = 'none';
}

function lstRefreshCascader() {
    const panels = document.getElementById('lst-cat-panels');
    if (!panels) return;
    const q = (document.getElementById('lst-cat-search')?.value || '').trim().toLowerCase();
    if (q) { panels.innerHTML = lstBuildSearchCol(window.EC_CATEGORY_TREE || [], q); requestAnimationFrame(lstPositionPanels); return; }
    const cols = [lstBuildCol(window.EC_CATEGORY_TREE || [], 0)];
    let nodes = window.EC_CATEGORY_TREE || [];
    for (let i = 0; i < lstCatPath.length; i++) {
        const hit = nodes.find(n => n.display === lstCatPath[i]);
        if (!hit?.children?.length) break;
        nodes = hit.children;
        cols.push(lstBuildCol(nodes, i + 1));
    }
    panels.innerHTML = cols.join('');
    requestAnimationFrame(lstPositionPanels);
}

function lstBuildCol(nodes, level) {
    const items = (nodes || []).map(n => {
        const hasChildren = !!(n.children?.length);
        const isActive = lstCatPath[level] === n.display;
        return `<div class="ec-cascader-item ${hasChildren ? 'has-children' : ''} ${isActive ? 'active' : ''}"
            onclick="event.stopPropagation();lstPickCat(${level},'${ecEscAttr(n.display)}',${hasChildren})">
            <span class="ec-cascader-label">${ecEscAttr(n.display)}</span>
            ${hasChildren ? `<span class="ec-cascader-arrow-r">›</span>` : ''}
        </div>`;
    }).join('');
    const clear = level === 0 ? `<div class="ec-cascader-item" style="color:var(--text-dim);border-bottom:1px dashed var(--border);" onclick="event.stopPropagation();lstClearCat()"><span class="ec-cascader-label">— 清空选择</span></div>` : '';
    return `<div class="ec-cascader-panel" data-level="${level}">${clear}${items}</div>`;
}

function lstBuildSearchCol(nodes, q) {
    const results = [];
    function walk(list, path) {
        for (const n of (list || [])) {
            const full = path ? path + ' > ' + n.display : n.display;
            if (n.display.toLowerCase().includes(q)) {
                const hasChildren = !!(n.children?.length);
                const pathArr = full.split(' > ');
                results.push(`<div class="ec-cascader-item ${hasChildren ? 'has-children' : ''}"
                    onclick="event.stopPropagation();lstPickCatFull(${ecEscAttr(JSON.stringify(pathArr))},${hasChildren})">
                    <span class="ec-cascader-label" style="font-size:0.72rem;">${ecEscAttr(full)}</span>
                </div>`);
            }
            if (n.children?.length) walk(n.children, full);
        }
    }
    walk(nodes, '');
    if (!results.length) return `<div class="ec-cascader-panel" data-level="0"><span style="padding:8px 12px;font-size:0.75rem;color:var(--text-dim);display:block;">无匹配品类</span></div>`;
    return `<div class="ec-cascader-panel" data-level="0" style="flex:1;">${results.join('')}</div>`;
}

function lstPickCat(level, display, hasChildren) {
    lstCatPath = lstCatPath.slice(0, level);
    lstCatPath.push(display);
    const txt = document.getElementById('lst-cat-text');
    if (txt) txt.textContent = lstCatPath.join(' › ');
    const inp = document.getElementById('lst-cat-search');
    if (inp) inp.value = '';
    if (!hasChildren) {
        document.getElementById('lst-cat-cascader')?.classList.remove('open');
        lstHidePanels();
        return;
    }
    lstRefreshCascader();
}

function lstPickCatFull(pathArr, hasChildren) {
    lstCatPath = pathArr;
    const txt = document.getElementById('lst-cat-text');
    if (txt) txt.textContent = lstCatPath.join(' › ');
    const inp = document.getElementById('lst-cat-search');
    if (inp) inp.value = '';
    if (!hasChildren) { document.getElementById('lst-cat-cascader')?.classList.remove('open'); lstHidePanels(); }
    lstRefreshCascader();
}

function lstClearCat() {
    lstCatPath = [];
    const txt = document.getElementById('lst-cat-text');
    if (txt) txt.textContent = '— 点击选择品类';
    lstRefreshCascader();
}

function lstOnCatSearch() { lstRefreshCascader(); }

function lstMaterialCustom() {
    const inp = document.getElementById('lstMaterialCustomInput');
    const sel = document.getElementById('lstMaterialSelect');
    if (inp) { inp.style.display = 'block'; inp.focus(); }
    if (sel) sel.classList.remove('open');
}

// ── SKU 列表渲染（可编辑） ──
function lstRenderSkuList() {
    const box = document.getElementById('lstSkuList');
    const cnt = document.getElementById('lstSkuCount');
    if (!box) return;
    if (lstSkuItems.length === 0) {
        box.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim);">导入商品文件夹后自动填充</span>';
        if (cnt) cnt.textContent = '';
        return;
    }
    if (cnt) cnt.textContent = `（${lstSkuItems.length} 个）`;
    const ip = 'padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.72rem;box-sizing:border-box;background:var(--surface);color:var(--text);';
    box.innerHTML = lstSkuItems.map((sku, i) => {
        const imgName = sku.imgDir ? sku.imgDir.replace(/.*[\\/]/, '') : '—';
        const imgOk = sku.imgDir ? '✓' : '✗';
        const imgColor = sku.imgDir ? 'var(--primary)' : '#ef4444';
        const dispName = sku.skuDisplayName || sku.name || '';
        return `
        <div style="display:grid;grid-template-columns:18px 1.4fr 1fr 70px 70px 60px 1fr;gap:5px;align-items:center;padding:5px 8px;background:var(--surface-alt);border-radius:6px;">
            <span style="font-size:0.66rem;color:var(--text-dim);text-align:right;">${i + 1}</span>
            <input type="text" value="${ecEscAttr(dispName)}" oninput="lstSkuEdit(${i},'skuDisplayName',this.value)" placeholder="款式名" title="${ecEscAttr(sku.name)}" style="${ip}">
            <span style="color:${imgColor};font-size:0.66rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${ecEscAttr(sku.imgDir)}">${imgOk} ${ecEscAttr(imgName)}</span>
            <input type="number" step="0.01" value="${(+sku.groupPrice||0).toFixed(2)}" oninput="lstSkuEdit(${i},'groupPrice',this.value)" title="拼单价" style="${ip}">
            <input type="number" step="0.01" value="${(+sku.singlePrice||0).toFixed(2)}" oninput="lstSkuEdit(${i},'singlePrice',this.value)" title="单买价" style="${ip}">
            <input type="number" value="${sku.stock||8888}" oninput="lstSkuEdit(${i},'stock',this.value)" title="库存" style="${ip}">
            <input type="text" value="${ecEscAttr(sku.itemCode||'')}" oninput="lstSkuEdit(${i},'itemCode',this.value)" placeholder="编码" style="${ip}">
        </div>`;
    }).join('');
}

function lstSkuEdit(idx, field, val) {
    if (!lstSkuItems[idx]) return;
    lstSkuItems[idx][field] = val;
}

// ── SKU 方案工作台 ──
let spPlans = [];
let spActiveIdx = 0;

function openSkuPlanModal() {
    const modal = document.getElementById('skuPlanModal');
    if (!modal) return;
    const catLabel = document.getElementById('spCategoryLabel');
    if (catLabel) catLabel.textContent = lstCatPath.length ? lstCatPath.join(' › ') : '—';
    modal.classList.add('show');
}

function closeSkuPlanModal() {
    document.getElementById('skuPlanModal')?.classList.remove('show');
}

async function spGenerate() {
    const btn = document.getElementById('spGenBtn');
    btn.textContent = '⏳ 生成中...';
    btn.disabled = true;
    const strategy = document.querySelector('input[name="spStrategy"]:checked')?.value || 'mid';
    const planCount = parseInt(document.querySelector('input[name="spCount"]:checked')?.value || '3');
    const skuPayload = lstSkuItems.map(s => ({ itemCode: s.itemCode || s.name, cost: parseFloat(s.cost) || 0 }));
    try {
        const resp = await fetch('/api/listing/generate-sku-plans', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: lstCatPath.join(' > '),
                productName: (lstCatPath[lstCatPath.length - 1] || ''),
                brand: document.getElementById('lstBrand')?.value.trim() || '',
                material: document.getElementById('lstMaterial')?.value.trim() || '',
                skus: skuPayload, pricingStrategy: strategy, planCount
            })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        spPlans = data.plans || [];
        spActiveIdx = 0;
        spRenderTabs();
        spRenderTable(0);
        document.getElementById('spConfirmBtn').disabled = spPlans.length === 0;
    } catch (e) {
        document.getElementById('spPlanContent').innerHTML = `<div style="color:#dc2626;padding:20px;font-size:0.82rem;">生成失败：${e.message}</div>`;
    } finally {
        btn.textContent = '✨ 生成方案';
        btn.disabled = false;
    }
}

function spRenderTabs() {
    const bar = document.getElementById('spTabBar');
    if (!bar) return;
    bar.innerHTML = spPlans.map((p, i) =>
        `<button class="sp-tab${i === spActiveIdx ? ' active' : ''}" onclick="spSelectTab(${i})">${p.planName || ('方案' + (i+1))}</button>`
    ).join('');
}

function spSelectTab(idx) { spActiveIdx = idx; spRenderTabs(); spRenderTable(idx); }

function spCalcMargin(price, cost) {
    if (!price || price <= 0) return { pct: 0, cls: 'sp-margin-low' };
    const pct = Math.round((price - cost) / price * 100);
    const cls = pct >= 45 ? 'sp-margin-high' : pct >= 25 ? 'sp-margin-mid' : 'sp-margin-low';
    return { pct, cls };
}

function spRenderTable(idx) {
    const plan = spPlans[idx];
    const box = document.getElementById('spPlanContent');
    if (!plan || !box) return;
    const rows = (plan.skus || []).map((s, i) => {
        const cost = parseFloat(s.cost) || 0, gp = parseFloat(s.groupPrice) || 0, sp = parseFloat(s.singlePrice) || 0;
        const mg = spCalcMargin(sp, cost);
        return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 8px;color:var(--text-dim);font-size:0.72rem;">${i+1}</td>
            <td style="padding:6px 8px;"><input value="${ecEscAttr(s.name)}" oninput="spPlans[${idx}].skus[${i}].name=this.value" style="width:100%;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.75rem;"></td>
            <td style="padding:6px 8px;font-size:0.72rem;color:var(--text-dim);">${ecEscAttr(s.itemCode||'')}</td>
            <td style="padding:6px 8px;font-size:0.75rem;color:var(--text-dim);">¥${cost.toFixed(2)}</td>
            <td style="padding:6px 8px;"><input type="number" value="${gp.toFixed(2)}" min="0" step="0.01" oninput="spPlans[${idx}].skus[${i}].groupPrice=parseFloat(this.value)||0;spRefreshRow(this,${idx},${i})" style="width:80px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.75rem;"></td>
            <td style="padding:6px 8px;"><input type="number" value="${sp.toFixed(2)}" min="0" step="0.01" oninput="spPlans[${idx}].skus[${i}].singlePrice=parseFloat(this.value)||0;spRefreshRow(this,${idx},${i})" style="width:80px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.75rem;"></td>
            <td style="padding:6px 8px;" id="spMargin_${idx}_${i}"><span class="${mg.cls}">${mg.pct}%</span></td>
            <td style="padding:6px 8px;"><input type="number" value="${s.stock||999}" min="0" step="1" oninput="spPlans[${idx}].skus[${i}].stock=parseInt(this.value)||999" style="width:60px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.75rem;"></td>
        </tr>`;
    }).join('');
    box.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:10px;padding:8px 10px;background:var(--primary-light);border-radius:6px;">💡 ${ecEscAttr(plan.description || '')}</div>
        <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
            <thead><tr style="background:var(--surface-alt);font-size:0.7rem;color:var(--text-dim);">
                <th style="padding:6px 8px;text-align:left;">#</th><th style="padding:6px 8px;text-align:left;min-width:140px;">款式名</th>
                <th style="padding:6px 8px;text-align:left;">商品编码</th><th style="padding:6px 8px;text-align:left;">成本</th>
                <th style="padding:6px 8px;text-align:left;">拼单价</th><th style="padding:6px 8px;text-align:left;">单买价</th>
                <th style="padding:6px 8px;text-align:left;">毛利率</th><th style="padding:6px 8px;text-align:left;">库存</th>
            </tr></thead><tbody>${rows}</tbody></table></div>`;
}

function spRefreshRow(input, planIdx, skuIdx) {
    const s = spPlans[planIdx]?.skus?.[skuIdx];
    if (!s) return;
    const mg = spCalcMargin(parseFloat(s.singlePrice) || 0, parseFloat(s.cost) || 0);
    const cell = document.getElementById(`spMargin_${planIdx}_${skuIdx}`);
    if (cell) cell.innerHTML = `<span class="${mg.cls}">${mg.pct}%</span>`;
}

function spConfirm() {
    const plan = spPlans[spActiveIdx];
    if (!plan) return;
    const imgMap = {};
    lstSkuItems.forEach(s => { imgMap[s.itemCode || s.name] = s.imgDir || ''; });
    lstSkuItems = (plan.skus || []).map(s => ({
        name: s.name || '', imgDir: imgMap[s.itemCode] || imgMap[s.name] || '',
        groupPrice: parseFloat(s.groupPrice) || 0, singlePrice: parseFloat(s.singlePrice) || 0,
        stock: parseInt(s.stock) || 999, itemCode: s.itemCode || '', cost: parseFloat(s.cost) || 0
    }));
    lstRenderSkuList();
    closeSkuPlanModal();
}

// ── 文件夹拖放 / 选择 ──
function lstOnDragOver(e) {
    e.preventDefault(); e.stopPropagation();
    const zone = document.getElementById('lstDropZone');
    zone.style.borderColor = 'var(--primary)';
    zone.style.background = 'var(--primary-light)';
}

function lstOnDragLeave(e) {
    e.stopPropagation();
    const zone = document.getElementById('lstDropZone');
    zone.style.borderColor = '';
    zone.style.background = '';
}

function lstOnDrop(e) {
    e.preventDefault(); e.stopPropagation();
    lstOnDragLeave(e);
    const items = Array.from(e.dataTransfer.files);
    if (items.length > 0 && items[0].path) {
        const folder = items.find(f => f.type === '' || f.size === 0) || items[0];
        const p = folder.path;
        const isLikelyDir = (folder.type === '' || folder.size === 0);
        lstApplyFolder(isLikelyDir ? p : p.replace(/[\\/][^\\/]+$/, ''));
        return;
    }
    alert('请使用「点击选择」按钮选取文件夹（拖放需 Electron 环境）');
}

async function lstPickRootDir() {
    if (window.electronAPI && typeof window.electronAPI.pickDir === 'function') {
        try {
            const dir = await window.electronAPI.pickDir();
            if (dir) lstApplyFolder(dir);
        } catch (e) { alert('打开目录选择框失败：' + (e.message || e)); }
    } else {
        const dir = prompt('请输入商品文件夹绝对路径：');
        if (dir) lstApplyFolder(dir);
    }
}

function lstApplyFolder(folderPath) {
    const zone = document.getElementById('lstDropZone');
    const text = document.getElementById('lstDropZoneText');
    text.textContent = '📂 ' + folderPath.replace(/.*[\\/]/, '');
    zone.style.borderStyle = 'solid';
    zone.style.borderColor = 'var(--primary)';
    lstScanFolder(folderPath);
}

async function lstScanFolder(folderPath) {
    const status = document.getElementById('lstFolderStatus');
    status.style.display = 'block';
    status.textContent = '扫描中...';
    lstSkuItems = [];
    document.getElementById('lstTitle').value = '';
    lstUpdateTitleCount();
    lstRenderSkuList();
    try {
        const resp = await fetch('/api/listing/scan-folder', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        document.getElementById('lstMainImgDir').value = data.mainImgDir || '';
        document.getElementById('lstDetailImgDir').value = data.detailImgDir || '';
        document.getElementById('lstWhiteImgDir').value = data.whiteImgDir || '';
        lstSkuItems = (data.skus || []).map(s => ({
            name: s.name || '', imgDir: s.imgPath || '',
            groupPrice: s.groupPrice || '', singlePrice: s.singlePrice || '',
            stock: s.stock || 999, itemCode: s.itemCode || '', cost: s.cost || 0
        }));
        lstRenderSkuList();
        const lines = [];
        if (data.mainImgDir) lines.push(`✓ 主图：${data.mainImgDir}`); else lines.push('✗ 未找到主图文件夹（命名需含"主图"）');
        if (data.detailImgDir) lines.push(`✓ 详情图：${data.detailImgDir}`); else lines.push('✗ 未找到详情图文件夹（命名需含"详情"）');
        if (data.whiteImgDir) lines.push(`✓ 白底图：${data.whiteImgDir}`); else lines.push('— 无白底图文件夹');
        if (data.excelFile) lines.push(`✓ Excel：${data.excelFile}，导入 ${(data.skus||[]).length} 个 SKU`); else lines.push('✗ 未找到 .xlsx 文件');
        (data.warnings || []).forEach(w => lines.push(`⚠ ${w}`));
        status.innerHTML = lines.join('<br>');
        if (data.skus && data.skus.length > 0) { lstShowPreview(); lstAutoPrepare(); }
    } catch (e) {
        status.textContent = '扫描失败：' + e.message;
    }
}

function lstShowPreview() {
    const box = document.getElementById('lstPreview');
    if (box) box.style.display = 'block';
    const thumbs = document.getElementById('lstMainThumbs');
    const mainDir = document.getElementById('lstMainImgDir').value;
    if (thumbs) {
        thumbs.innerHTML = mainDir ? `<span style="font-size:0.7rem;color:var(--text-dim);">📁 ${mainDir.replace(/.*[\\/]/, '')}</span>` : '';
    }
    lstRenderSkuList();
}

function lstUpdateTitleCount() {
    const t = document.getElementById('lstTitle').value;
    const cnt = document.getElementById('lstTitleCount');
    if (cnt) {
        const len = [...t].length;
        cnt.textContent = `${len}/30`;
        cnt.style.color = len > 30 ? '#ef4444' : 'var(--text-dim)';
    }
}

// 参考标题库生成标题 + SKU 款式名
async function lstAutoPrepare() {
    if (!lstCatPath.length) { alert('请先选择商品品类'); return; }
    const material = document.getElementById('lstMaterial').value.trim();
    if (!material) { alert('请先选择材质'); return; }
    const brand = document.getElementById('lstBrand').value.trim();
    const skuNames = lstSkuItems.map(s => s.name).filter(Boolean);
    const btn = document.getElementById('lstRegenBtn');
    const titleInput = document.getElementById('lstTitle');
    if (btn) { btn.textContent = '⏳ 生成中...'; btn.disabled = true; }
    if (titleInput) titleInput.placeholder = 'AI 生成标题中...';
    try {
        const resp = await fetch('/api/listing/prepare', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: lstCatPath.join(' > '), material, brand, skuNames })
        });
        const data = await resp.json();
        if (data.error && !data.title) throw new Error(data.error);
        if (data.title) { titleInput.value = data.title; lstUpdateTitleCount(); }
        if (data.skuNames) {
            lstSkuItems.forEach(sku => { if (data.skuNames[sku.name]) sku.skuDisplayName = data.skuNames[sku.name]; });
            lstRenderSkuList();
        }
    } catch (e) {
        if (titleInput) titleInput.placeholder = '生成失败，可手动输入：' + e.message;
    } finally {
        if (btn) { btn.textContent = '🔄 重新生成'; btn.disabled = false; }
    }
}

async function lstCheckEnv() {
    const log = document.getElementById('lstProgressLog');
    log.style.display = 'block';
    log.textContent = '检查环境中...\n';
    try {
        const resp = await fetch('/api/listing/check');
        const data = await resp.json();
        log.textContent += `Node.js: ${data.nodeOk ? '✓ ' + data.nodeVersion : '✗ 未安装'}\n`;
        log.textContent += `脚本: ${data.scriptExists ? '✓ ' + data.scriptPath : '✗ 未找到 pdd_listing.js'}\n`;
        if (!data.nodeOk) log.textContent += '\n请安装 Node.js：https://nodejs.org/\n';
        if (!data.scriptExists) log.textContent += '\n请在 tools/ 目录下运行：npm install && npx playwright install chromium\n';
    } catch (e) {
        log.textContent += '检查失败：' + e.message + '\n';
    }
}

async function lstLoginPdd() {
    const log = document.getElementById('lstProgressLog');
    log.style.display = 'block';
    log.textContent = '启动登录流程...\n浏览器窗口将打开，请在其中完成拼多多登录。\n';
    try {
        const resp = await fetch('/api/listing/run', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginOnly: true })
        });
        const data = await resp.json();
        if (data.taskId) { log.textContent += '登录任务已启动，请在弹出的浏览器中完成登录...\n'; lstPollProgress(data.taskId, log); }
    } catch (e) {
        log.textContent += '启动失败：' + e.message + '\n';
    }
}

async function lstStartListing() {
    const title = document.getElementById('lstTitle').value.trim();
    if (!lstCatPath.length) { alert('请选择商品品类'); return; }
    if (!document.getElementById('lstMaterial').value.trim()) { alert('请选择材质'); return; }
    if (lstSkuItems.length === 0) { alert('请先导入商品文件夹，Excel 中需有 SKU 数据'); return; }
    const categoryPath = lstCatPath.join(' > ');
    const productType = lstCatPath[lstCatPath.length - 1] || '';
    const material = document.getElementById('lstMaterial').value.trim() || '碳钢';
    const attributes = {};
    if (material) attributes['材质'] = material;
    const config = {
        productType, material,
        brand: document.getElementById('lstBrand').value.trim(),
        category: categoryPath, title, attributes,
        skus: lstSkuItems.map(s => ({
            name: s.skuDisplayName || s.name, imgDir: s.imgDir,
            groupPrice: Math.round(Math.max(0, parseFloat(s.groupPrice) || 0) * 100),
            singlePrice: Math.round(Math.max(0, parseFloat(s.singlePrice) || 0) * 100),
            stock: Math.max(0, parseInt(s.stock) || 999), itemCode: s.itemCode || ''
        })),
        mainImgDir: document.getElementById('lstMainImgDir').value.trim(),
        detailImgDir: document.getElementById('lstDetailImgDir').value.trim(),
        whiteImgDir: document.getElementById('lstWhiteImgDir').value.trim(),
        skuSpecType: document.getElementById('lstSkuSpecType')?.value || '款式',
        discount: '9.9折', deliveryPromise: '48小时发货及揽收'
    };
    const log = document.getElementById('lstProgressLog');
    log.style.display = 'block';
    log.textContent = '启动自动上新...\n';
    const startBtn = document.getElementById('lstStartBtn');
    startBtn.disabled = true;
    startBtn.textContent = '⏳ 上新中...';
    try {
        const resp = await fetch('/api/listing/run', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        if (data.taskId) lstPollProgress(data.taskId, log, startBtn);
    } catch (e) {
        log.textContent += '启动失败：' + e.message + '\n';
        startBtn.disabled = false;
        startBtn.textContent = '🚀 开始自动上新';
    }
}

function lstPollProgress(taskId, log, startBtn) {
    let seen = 0;
    const timer = setInterval(async () => {
        try {
            const resp = await fetch(`/api/task/${taskId}`);
            const data = await resp.json();
            if (data.results) {
                data.results.slice(seen).forEach(r => {
                    log.textContent += (r.message || JSON.stringify(r)) + '\n';
                    log.scrollTop = log.scrollHeight;
                });
                seen = data.results.length;
            }
            if (data.status === 'done' || data.status === 'error' || data.status === 'stopped' ||
                (data.results && data.results.some(r => r.type === 'done' || r.type === 'error'))) {
                clearInterval(timer);
                if (startBtn) { startBtn.disabled = false; startBtn.textContent = '🚀 开始自动上新'; }
            }
        } catch (e) {
            clearInterval(timer);
            log.textContent += '轮询失败：' + e.message + '\n';
            if (startBtn) { startBtn.disabled = false; startBtn.textContent = '🚀 开始自动上新'; }
        }
    }, 1500);
}

// ── 使用说明 ──
function openHelpModal() { document.getElementById('helpModal')?.classList.add('show'); }
function closeHelpModal() { document.getElementById('helpModal')?.classList.remove('show'); }

// 初始化
lstRenderSkuList();
