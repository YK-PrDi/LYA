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
        lstLoadProductInfo();
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
    if (!hasChildren) { document.getElementById('lst-cat-cascader')?.classList.remove('open'); lstHidePanels(); lstLoadProductInfo(); }
    lstRefreshCascader();
}

function lstClearCat() {
    lstCatPath = [];
    const txt = document.getElementById('lst-cat-text');
    if (txt) txt.textContent = '— 点击选择品类';
    lstRefreshCascader();
}

function lstOnCatSearch() {
    clearTimeout(window._lstCatSearchTimer);
    window._lstCatSearchTimer = setTimeout(lstRefreshCascader, 200);
}

// ── 产品信息属性面板 ──
let lstAttributes = [];  // [{name, value, options:[], manual}]
// 取产品信息面板里「材质」的值（右侧材质，优先于隐藏默认值）
function panelMaterialVal() {
    const a = (lstAttributes || []).find(x => (x.name || '').trim() === '材质' && (x.value || '').trim());
    return a ? a.value.trim() : '';
}

async function lstLoadProductInfo() {
    if (!lstCatPath.length) return;
    const cat = lstCatPath.join(' > ');
    try {
        const resp = await fetch('/api/listing/product-info?category=' + encodeURIComponent(cat));
        const data = await resp.json();
        const attrs = data.attributes || [];
        lstAttributes = attrs.map(a => ({
            name: a.name || '',
            value: a.value || '',
            options: a.options || [],
            manual: !!a.manual
        }));
    } catch (_) {
        lstAttributes = [];
    }
    // 强制材质默认塑料：有「材质」属性但空则填塑料；没有则新增一个默认塑料
    const matAttr = lstAttributes.find(a => (a.name || '').trim() === '材质');
    if (matAttr) { if (!(matAttr.value || '').trim()) matAttr.value = '塑料'; }
    else { lstAttributes.unshift({ name: '材质', value: '塑料', options: ['塑料','碳钢','不锈钢','铝合金','铁','木','竹'], manual: false }); }
    lstRenderAttrs();
}

function lstRenderAttrs() {
    const box = document.getElementById('lstAttrList');
    const empty = document.getElementById('lstAttrEmpty');
    if (!box) return;
    if (!lstAttributes.length) {
        box.innerHTML = '';
        if (empty) { empty.style.display = 'block'; empty.textContent = lstCatPath.length ? '该品类无预设，点「+新增属性」自行填写' : '请先选择商品品类'; }
        return;
    }
    if (empty) empty.style.display = 'none';
    box.innerHTML = lstAttributes.map((a, i) => {
        let ctrl;
        if (a.options && a.options.length) {
            const opts = a.options.map(o => `<option value="${ecEscAttr(o)}"${a.value===o?' selected':''}>${ecEscAttr(o)}</option>`).join('');
            ctrl = `<select onchange="lstAttrEdit(${i},this.value)" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:0.76rem;">
                <option value="">请选择</option>${opts}
                <option value="__custom__"${a.value&&!a.options.includes(a.value)?' selected':''}>自定义…</option>
            </select>`;
            if (a.value && !a.options.includes(a.value)) {
                ctrl += `<input value="${ecEscAttr(a.value)}" oninput="lstAttrEdit(${i},this.value)" placeholder="自定义值" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:0.76rem;">`;
            }
        } else {
            ctrl = `<input value="${ecEscAttr(a.value)}" oninput="lstAttrEdit(${i},this.value)" placeholder="${a.manual?'请填写':''}" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:0.76rem;">`;
        }
        return `<div style="display:flex;align-items:center;gap:6px;">
            <input value="${ecEscAttr(a.name)}" oninput="lstAttrEditName(${i},this.value)" style="width:96px;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:0.74rem;color:var(--text-muted);">
            ${ctrl}
            <span onclick="lstDelAttr(${i})" style="cursor:pointer;color:#dc2626;font-size:0.8rem;padding:0 2px;">✕</span>
        </div>`;
    }).join('');
}

function lstAttrEdit(i, val) {
    if (!lstAttributes[i]) return;
    if (val === '__custom__') { lstAttributes[i].value = ''; lstRenderAttrs(); return; }
    lstAttributes[i].value = val;
}
function lstAttrEditName(i, val) { if (lstAttributes[i]) lstAttributes[i].name = val; }
function lstDelAttr(i) { lstAttributes.splice(i, 1); lstRenderAttrs(); }
function lstAddAttr() { lstAttributes.push({ name: '', value: '', options: [], manual: true }); lstRenderAttrs(); }


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

// ── SKU 生图面板 ──
let siGenImages = [];   // [{name, path, error}]

async function openSkuImgModal() {
    if (!lstSkuItems.length) { alert('请先确认 SKU 布局'); return; }
    const mainDir = document.getElementById('lstMainImgDir')?.value || '';
    const thumbs = document.getElementById('siRefThumbs');
    document.getElementById('siRefPath').value = '';
    siGenImages = [];
    document.getElementById('siContent').innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-dim);font-size:0.82rem;">选好参考图后点「开始生成」</div>';
    document.getElementById('skuImgModal')?.classList.add('show');
    siLoadTemplates();  // 加载防比价模板到下拉

    thumbs.innerHTML = '<span style="font-size:0.72rem;color:var(--text-dim);">加载主图中...</span>';
    let imgs = [];
    if (mainDir) {
        try {
            const resp = await fetch('/api/listing/list-images', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: mainDir })
            });
            const data = await resp.json();
            imgs = data.images || [];
        } catch (_) {}
    }
    if (imgs.length) {
        thumbs.innerHTML = imgs.map(p =>
            `<img src="/api/image?path=${encodeURIComponent(p)}" data-path="${ecEscAttr(p)}"
                onclick="siChooseRef(this)" title="${ecEscAttr(p.replace(/.*[\\/]/,''))}"
                style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:2px solid transparent;cursor:pointer;">`
        ).join('') + '<button onclick="siPickRef()" class="btn-outline" style="padding:6px 10px;font-size:0.72rem;align-self:center;">其他…</button>';
    } else {
        thumbs.innerHTML = `<button onclick="siPickRef()" class="btn-outline" style="padding:6px 12px;font-size:0.76rem;">📁 选择参考主图</button>
            <span id="siRefName" style="font-size:0.72rem;color:var(--text-dim);align-self:center;">未识别主图文件夹，可手动选一张</span>`;
    }
}

function closeSkuImgModal() { document.getElementById('skuImgModal')?.classList.remove('show'); }

// ── 设置（人工/全自动、方案数）存 localStorage ──
function lyGetSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('lySettings') || '{}') || {}; } catch (_) {}
    return { mode: s.mode || 'manual', planMode: s.planMode || '1' };
}
function openSettingsModal() {
    const s = lyGetSettings();
    document.querySelectorAll('input[name="setMode"]').forEach(r => r.checked = (r.value === s.mode));
    document.querySelectorAll('input[name="setPlan"]').forEach(r => r.checked = (r.value === s.planMode));
    document.getElementById('settingsModal')?.classList.add('show');
}
function closeSettingsModal() { document.getElementById('settingsModal')?.classList.remove('show'); }
function saveSettings() {
    const mode = document.querySelector('input[name="setMode"]:checked')?.value || 'manual';
    const planMode = document.querySelector('input[name="setPlan"]:checked')?.value || '1';
    localStorage.setItem('lySettings', JSON.stringify({ mode, planMode }));
    closeSettingsModal();
    alert('设置已保存：' + (mode === 'auto' ? '全自动' : '人工') + '模式，' + (planMode === '1' ? '1 套' : '多套'));
}

// ── 配件规则库编辑 ──
async function openRuleEditor() {
    try {
        const resp = await fetch('/api/listing/accessory-rules');
        const txt = await resp.text();
        document.getElementById('ruleJson').value = JSON.stringify(JSON.parse(txt), null, 2);
    } catch (e) { document.getElementById('ruleJson').value = '{\n  "byCategory": {},\n  "byMainCode": {}\n}'; }
    document.getElementById('ruleEditorModal')?.classList.add('show');
}
function closeRuleEditor() { document.getElementById('ruleEditorModal')?.classList.remove('show'); }
async function saveRules() {
    const txt = document.getElementById('ruleJson').value;
    try { JSON.parse(txt); } catch (e) { alert('JSON 格式错误：' + e.message); return; }
    try {
        const resp = await fetch('/api/listing/accessory-rules', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: txt
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        closeRuleEditor();
        alert('规则已保存');
    } catch (e) { alert('保存失败：' + e.message); }
}

// ── 防比价模板 ──
let siTemplates = [];  // [{id,name,type,hasPortrait,prompt}]

async function siLoadTemplates() {
    try {
        const resp = await fetch('/api/listing/antiprice-templates');
        const data = await resp.json();
        siTemplates = (data && data.templates) || [];
    } catch (_) { siTemplates = []; }
    siRenderTemplateOptions();
}

// 按"排除人像"过滤后的可用模板
function siAvailableTemplates() {
    const exP = document.getElementById('siExcludePortrait')?.checked;
    return siTemplates.filter(t => !(exP && t.hasPortrait));
}

function siRenderTemplateOptions() {
    const box = document.getElementById('siTemplateOptions');
    if (!box) return;
    const opts = ['<div class="gf-option" data-value="" onclick="selectOption(this,event)">🎲 随机一种</div>']
        .concat(siAvailableTemplates().map(t =>
            `<div class="gf-option" data-value="${ecEscAttr(t.id)}" onclick="selectOption(this,event)">${ecEscAttr(t.name)}${t.type==='sticker'?'（贴图）':''}</div>`));
    box.innerHTML = opts.join('');
    // 当前选中若已被过滤掉则重置为随机
    const cur = document.getElementById('siTemplate').value;
    if (cur && !siAvailableTemplates().some(t => t.id === cur)) {
        document.getElementById('siTemplate').value = '';
        document.getElementById('siTemplateText').textContent = '🎲 随机一种';
    }
}

// 排除人像勾选变化时刷新下拉
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'siExcludePortrait') siRenderTemplateOptions();
});

// 整批确定一个 templateId：手选则用所选；选"随机"则从可用模板里随机抽一个
function siPickBatchTemplate() {
    const chosen = document.getElementById('siTemplate')?.value || '';
    if (chosen) return chosen;
    const pool = siAvailableTemplates();
    if (!pool.length) return '';
    return pool[Math.floor(Math.random() * pool.length)].id;
}

// ── 模板编辑弹窗 ──
function openTplEditor() {
    tplRenderList(siTemplates);
    document.getElementById('tplEditorModal')?.classList.add('show');
}
function closeTplEditor() { document.getElementById('tplEditorModal')?.classList.remove('show'); }

function tplRenderList(list) {
    const box = document.getElementById('tplList');
    if (!box) return;
    box.innerHTML = (list || []).map((t, i) => `
        <div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;gap:8px;align-items:center;">
                <input value="${ecEscAttr(t.name||'')}" oninput="siTemplates[${i}].name=this.value" placeholder="模板名" style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:5px;font-size:0.76rem;">
                <select onchange="siTemplates[${i}].type=this.value" style="padding:4px 6px;border:1px solid var(--border);border-radius:5px;font-size:0.72rem;">
                    <option value="ai"${t.type==='ai'?' selected':''}>纯AI</option>
                    <option value="sticker"${t.type==='sticker'?' selected':''}>贴图</option>
                </select>
                <label style="font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;gap:3px;"><input type="checkbox" ${t.hasPortrait?'checked':''} onchange="siTemplates[${i}].hasPortrait=this.checked"> 人像</label>
                <button onclick="tplDel(${i})" style="font-size:0.66rem;padding:2px 8px;border:1px solid #ef4444;border-radius:5px;background:transparent;color:#ef4444;cursor:pointer;">删</button>
            </div>
            <textarea oninput="siTemplates[${i}].prompt=this.value" placeholder="${t.type==='sticker'?'贴图模板无需提示词':'提示词，可用 {{colorName}} {{bgStyle}}'}" rows="3" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:0.73rem;resize:vertical;">${ecEscAttr(t.prompt||'')}</textarea>
        </div>`).join('') || '<div style="color:var(--text-dim);font-size:0.78rem;text-align:center;padding:20px;">暂无模板，点下方新增</div>';
}

function tplAdd() {
    siTemplates.push({ id: 't' + Date.now(), name: '新模板', type: 'ai', hasPortrait: false, prompt: '' });
    tplRenderList(siTemplates);
}
function tplDel(i) { siTemplates.splice(i, 1); tplRenderList(siTemplates); }

async function tplSave() {
    try {
        const resp = await fetch('/api/listing/antiprice-templates', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templates: siTemplates })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        siRenderTemplateOptions();
        closeTplEditor();
        alert('模板已保存');
    } catch (e) { alert('保存失败：' + e.message); }
}

// 点选缩略图作参考
function siChooseRef(el) {
    document.querySelectorAll('#siRefThumbs img').forEach(i => i.style.borderColor = 'transparent');
    el.style.borderColor = 'var(--primary)';
    document.getElementById('siRefPath').value = el.getAttribute('data-path');
}

async function siPickRef() {
    const p = prompt('请输入参考主图的完整路径（jpg/png）：', document.getElementById('lstMainImgDir')?.value || '');
    if (p) {
        document.getElementById('siRefPath').value = p.trim();
        const n = document.getElementById('siRefName');
        if (n) n.textContent = '✓ ' + p.replace(/.*[\\/]/, '');
    }
}

async function siGenerate() {
    const ref = document.getElementById('siRefPath').value.trim();
    const btn = document.getElementById('siGenBtn');
    const productType = (lstCatPath[lstCatPath.length - 1] || '');
    btn.disabled = true;
    const box = document.getElementById('siContent');
    try {
        // 共享参考图只取一次（袋子/配件/水质对比）
        const bagImagePath = await siFindBagImage(productType);
        const accImagePaths = await siFindAccessoryImages(productType);
        const waterImagePath = await siFindWaterImage(productType);
        // 整批背景只分析一次，分发给每个并发 SKU，保证背景一致（并发下各请求不再各自分析）
        let bgStyle = '';
        try {
            const bgResp = await fetch('/api/listing/analyze-bg', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refImagePath: ref })
            });
            bgStyle = (await bgResp.json()).bgStyle || '';
        } catch (_) {}

        // 整批确定一个防比价模板（手选或随机），所有 SKU 用同一个
        const templateId = siPickBatchTemplate();
        const tplName = templateId ? (siTemplates.find(t => t.id === templateId)?.name || templateId) : '';

        // 初始化所有格子为"生成中"，并渲染进度条 + 网格
        siGenImages = lstSkuItems.map((s, i) => ({ idx: i, name: siSkuFullName(s), loading: true }));
        const total = siGenImages.length;
        siRenderResult();
        siRenderProgress(0, total, tplName);

        // 单个 SKU 生图请求（失败自动重试：429/网络抖动/后端报错都重试，指数退避）
        const RETRY = 3;  // 总尝试次数 = 1 + (RETRY-1) 次重试
        const genOne = async (i) => {
            const s = lstSkuItems[i];
            const reqBody = JSON.stringify({
                refImagePath: ref, productType, bagImagePath, accImagePaths, waterImagePath, bgStyle, templateId,
                skus: [{ idx: i, name: siSkuFullName(s), compDesc: siSkuFullName(s), itemCode: s.itemCode || '', accParts: s.accParts || [], whiteImgPath: s.whiteImgDir || '' }]
            });
            let lastErr = '失败';
            for (let attempt = 1; attempt <= RETRY; attempt++) {
                try {
                    const resp = await fetch('/api/listing/gen-sku-images', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody
                    });
                    const data = await resp.json();
                    const one = (data.images || [])[0];
                    if (one && one.path) {  // 真正成功
                        const pos = siGenImages.findIndex(im => im.idx === i);
                        if (pos >= 0) siGenImages[pos] = one;
                        siRefreshCell(i);
                        return;
                    }
                    lastErr = (one && one.error) || data.error || '生成失败';
                } catch (e) {
                    lastErr = e.message;
                }
                if (attempt < RETRY) {
                    // 退避：1s、2s…（避开瞬时 429/抖动），并在格子上提示重试中
                    const pos = siGenImages.findIndex(im => im.idx === i);
                    if (pos >= 0) { siGenImages[pos].loading = true; siGenImages[pos].error = ''; }
                    siRefreshCell(i);
                    await new Promise(r => setTimeout(r, attempt * 1000));
                }
            }
            // 多次仍失败：标记错误
            const pos = siGenImages.findIndex(im => im.idx === i);
            if (pos >= 0) { siGenImages[pos].loading = false; siGenImages[pos].error = lastErr; }
            siRefreshCell(i);
        };

        // 并发池：同时最多 CONC 张，每完成一张更新进度条（既提速又有实时进度）
        // Tier 1 下 Nano Banana Pro RPM=20，6 并发稳妥（留余量防偶发 429）；要更快可调 8。
        const CONC = 6;
        let next = 0, done = 0;
        await Promise.all(Array.from({ length: Math.min(CONC, total) }, async () => {
            while (next < total) {
                const cur = next++;
                await genOne(cur);
                done++;
                siRenderProgress(done, total, tplName);
            }
        }));
        siRenderProgress(total, total, tplName);
    } catch (e) {
        box.innerHTML = `<div style="color:#dc2626;padding:20px;font-size:0.82rem;">生成失败：${ecEscAttr(e.message)}</div>`;
    } finally {
        btn.disabled = false;
    }
}

// 生图进度条（渲染在网格上方）
function siRenderProgress(done, total, tplName) {
    const el = document.getElementById('siProgress');
    if (!el) return;
    const pct = total ? Math.round(done / total * 100) : 0;
    const tpl = tplName ? `　构图：${ecEscAttr(tplName)}` : '';
    el.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-dim);margin-bottom:4px;">
            <span>生成中… ${done}/${total}（并发加速，每张约 1-3 分钟）${tpl}</span><span>${pct}%</span>
        </div>
        <div style="height:8px;background:var(--surface-alt);border-radius:5px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:var(--primary);transition:width .3s;"></div>
        </div>`;
    el.style.display = done >= total ? 'none' : '';
}

// 花洒品类：从白底图目录里自动找文件名含"袋"的图作包装袋参考图；非花洒或找不到返回空
async function siFindBagImage(productType) {
    if (!(productType && (productType.includes('花洒') || productType.includes('淋浴')))) return '';
    const whiteDir = document.getElementById('lstWhiteImgDir')?.value
        || (lstSkuItems.find(s => s.whiteImgDir) ? lstSkuItems.find(s => s.whiteImgDir).whiteImgDir.replace(/[\\/][^\\/]+$/, '') : '');
    if (!whiteDir) return '';
    try {
        const resp = await fetch('/api/listing/list-images', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: whiteDir })
        });
        const data = await resp.json();
        const imgs = data.images || [];
        const bag = imgs.find(p => /袋|bag/i.test(p.replace(/.*[\\/]/, '')));
        return bag || '';
    } catch (_) { return ''; }
}

// 花洒品类：配件候选白底图＝目录内所有图，排除（袋子/水质对比/已用作主件白底图的颜色图）。
// 不再靠中文关键字预筛，交给后端按 SKU 规格编码里的配件码精确匹配（兼容纯编码文件名）。
async function siFindAccessoryImages(productType) {
    if (!(productType && (productType.includes('花洒') || productType.includes('淋浴')))) return [];
    const whiteDir = document.getElementById('lstWhiteImgDir')?.value
        || (lstSkuItems.find(s => s.whiteImgDir) ? lstSkuItems.find(s => s.whiteImgDir).whiteImgDir.replace(/[\\/][^\\/]+$/, '') : '');
    if (!whiteDir) return [];
    try {
        const resp = await fetch('/api/listing/list-images', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: whiteDir })
        });
        const data = await resp.json();
        const imgs = data.images || [];
        const bagWaterRe = /袋|bag|水质|对比|water/i;
        const usedMains = new Set(lstSkuItems.map(s => s.whiteImgDir).filter(Boolean));
        return imgs.filter(p => !bagWaterRe.test(p.replace(/.*[\\/]/, '')) && !usedMains.has(p));
    } catch (_) { return []; }
}

// 花洒品类：找水质对比参考图（白底图目录或其父目录里文件名含「水质/对比/water」），找不到返回空
async function siFindWaterImage(productType) {
    if (!(productType && (productType.includes('花洒') || productType.includes('淋浴')))) return '';
    const whiteDir = document.getElementById('lstWhiteImgDir')?.value
        || (lstSkuItems.find(s => s.whiteImgDir) ? lstSkuItems.find(s => s.whiteImgDir).whiteImgDir.replace(/[\\/][^\\/]+$/, '') : '');
    if (!whiteDir) return '';
    const parent = whiteDir.replace(/[\\/][^\\/]+$/, '');
    const re = /水质|对比|water/i;
    for (const dir of [whiteDir, parent]) {
        if (!dir) continue;
        try {
            const resp = await fetch('/api/listing/list-images', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: dir })
            });
            const data = await resp.json();
            const hit = (data.images || []).find(p => re.test(p.replace(/.*[\\/]/, '')));
            if (hit) return hit;
        } catch (_) {}
    }
    return '';
}

// SKU 完整描述：主件颜色(spec1) + 型号(spec2)，回退到款式名
function siSkuFullName(s) {
    const parts = [];
    if (s.spec1) parts.push(s.spec1);
    if (s.spec2) parts.push(s.spec2);
    const full = parts.join(' ').trim();
    return full || s.skuDisplayName || s.name || '';
}

function siRenderResult() {
    const box = document.getElementById('siContent');
    box.innerHTML = `<div id="siProgress" style="margin-bottom:12px;display:none;"></div>
    <div id="siGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">
        ${siGenImages.map(im => siCellHtml(im)).join('')}
    </div>
    <div style="margin-top:12px;text-align:right;">
        <button class="btn-primary" style="padding:6px 18px;font-size:0.78rem;" onclick="siApply()">采用这批图 → 填入SKU</button>
    </div>`;
}

// 单个格子 HTML（按 idx 锚定，显示名取自 lstSkuItems 单一数据源）
function siCellHtml(im) {
    const idx = im.idx;
    const dispName = lstSkuItems[idx] ? (lstSkuItems[idx].skuDisplayName || lstSkuItems[idx].name || '') : (im.name || '');
    const ok = im.path && !im.error;
    const inner = im.loading
        ? `<div style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--surface-alt);border-radius:6px;color:var(--text-dim);font-size:0.7rem;">⏳ 生成中…</div>`
        : ok
            ? `<img src="/api/image?path=${encodeURIComponent(im.path)}&t=${Date.now()}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:1px solid var(--border);">`
            : `<div style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--surface-alt);border-radius:6px;color:#dc2626;font-size:0.7rem;text-align:center;padding:6px;">${ecEscAttr(im.error||'失败')}</div>`;
    return `<div id="siCell_${idx}" style="display:flex;flex-direction:column;gap:4px;">
        ${inner}
        <span style="font-size:0.68rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ecEscAttr(dispName)}</span>
        <button onclick="siRegenOne(${idx})" ${im.loading?'disabled':''} style="font-size:0.66rem;padding:2px 6px;border:1px solid var(--border);border-radius:5px;background:transparent;cursor:pointer;color:var(--text-muted);">🔄 重新生成</button>
    </div>`;
}

// 单张重生：只对该 idx 的 SKU 调生图，替换对应项后局部刷新该格
async function siRegenOne(idx) {
    const s = lstSkuItems[idx];
    if (!s) return;
    const ref = document.getElementById('siRefPath').value.trim();
    const productType = (lstCatPath[lstCatPath.length - 1] || '');
    // 标记 loading 并刷新该格
    const target = siGenImages.find(im => im.idx === idx);
    if (target) { target.loading = true; }
    siRefreshCell(idx);
    try {
        const bagImagePath = await siFindBagImage(productType);
        const accImagePaths = await siFindAccessoryImages(productType);
        const waterImagePath = await siFindWaterImage(productType);
        let bgStyle = '';
        try {
            const bgResp = await fetch('/api/listing/analyze-bg', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refImagePath: ref })
            });
            bgStyle = (await bgResp.json()).bgStyle || '';
        } catch (_) {}
        const resp = await fetch('/api/listing/gen-sku-images', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                refImagePath: ref, productType, bagImagePath, accImagePaths, waterImagePath, bgStyle, templateId: siPickBatchTemplate(),
                skus: [{ idx, name: siSkuFullName(s), compDesc: siSkuFullName(s), itemCode: s.itemCode || '', accParts: s.accParts || [], whiteImgPath: s.whiteImgDir || '' }]
            })
        });
        const data = await resp.json();
        const one = (data.images || [])[0];
        const pos = siGenImages.findIndex(im => im.idx === idx);
        if (one) { if (pos >= 0) siGenImages[pos] = one; else siGenImages.push(one); }
        else if (target) { target.loading = false; target.error = data.error || '失败'; }
    } catch (e) {
        if (target) { target.loading = false; target.error = e.message; }
    }
    siRefreshCell(idx);
}

function siRefreshCell(idx) {
    const cell = document.getElementById(`siCell_${idx}`);
    const im = siGenImages.find(x => x.idx === idx);
    if (cell && im) cell.outerHTML = siCellHtml(im);
}

function siApply() {
    let applied = 0;
    siGenImages.forEach(im => {
        if (im.path && !im.error && lstSkuItems[im.idx]) { lstSkuItems[im.idx].imgDir = im.path; applied++; }
    });
    lstRenderSkuList();
    closeSkuImgModal();
    // 全自动模式：采用图后人工已确认，直接连上架
    if (lyGetSettings().mode === 'auto') {
        if (confirm(`已采用 ${applied} 张 SKU 图。全自动模式将直接上架，确认继续？`)) {
            lstStartListing(false);
        }
        return;
    }
    alert(`已采用 ${applied} 张 SKU 图`);
}

// ── 全自动上新：只选主件 → 规则补配件 → 成本/定价/标题 → 打开生图并自动开始 ──
async function lyAutoRun() {
    try {
        if (!lstCatPath.length) { alert('全自动需先选好商品品类'); return; }
        if (!document.getElementById('lstBrand').value.trim()) { alert('请先填写品牌（必填）'); return; }
        if (!document.getElementById('lstMainImgDir').value.trim()) { alert('请先导入商品图片文件夹（需含主图，用作生图参考）'); return; }
        const category = lstCatPath.join(' > ');
        const mainCode = erpSelectedSkus[0]?.itemCode || '';
        // 1) 规则解析：补配件/批量件 + 阶梯
        const erpSkus = (window._erpAllSkuRowsFull || []).map(r => ({ itemCode: r.skuOuterId, name: r.name }));
        const rresp = await fetch('/api/listing/auto-resolve', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, mainItemCode: mainCode, erpSkus })
        });
        const rule = await rresp.json();
        if (rule.error) throw new Error(rule.error);
        let ladders = rule.ladders || [];
        const accSkus = rule.accSkus || [];
        // accSkus 建索引（按通用类型 + 关键字 + 编码，供 AI 阶梯回映）
        const accByKw = {};
        const codeToType = {};
        accSkus.forEach(a => {
            accByKw[a.type || a.keyword] = a;
            if (a.keyword) accByKw[a.keyword] = a;
            if (a.itemCode) codeToType[a.itemCode] = a.type || a.keyword;
        });
        // 阶梯全交 AI：规则库不再写死阶梯，调 generate-sku-plans 让 AI 自由组合（含滤芯数量）
        if (!ladders.length) {
            if (!accSkus.length) { alert('该主件在规则库/ERP 里没找到可搭配的配件，请检查规则库或改用人工模式。'); return; }
            const planCount = lyGetSettings().planMode === '1' ? 1 : 4;
            const aiSkus = [
                { itemCode: mainCode, name: erpSelectedSkus[0]?.productName || mainCode, role: 'main' }
            ].concat(accSkus.map(a => ({ itemCode: a.itemCode, name: a.name, role: a.role || 'accessory' })));
            const gResp = await fetch('/api/listing/generate-sku-plans', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category, brand: document.getElementById('lstBrand').value.trim(),
                    material: panelMaterialVal() || '塑料', planCount, skus: aiSkus
                })
            });
            const gData = await gResp.json();
            const plan = (gData.plans || [])[0];
            if (!plan || !(plan.models || []).length) { alert('AI 搭配方案生成失败，请重试或改用人工模式。'); return; }
            // 把 AI 的 models 转成 ladder 结构（components.itemCode → 通用 match）
            ladders = plan.models.map(md => ({
                name: md.specName || '型号',
                components: (md.components || []).map(c => ({
                    match: codeToType[c.itemCode] || c.itemCode, qty: parseInt(c.qty) || 1
                }))
            }));
        }
        // 成本/重量查表（来自 ERP 单品行）
        const costMap = {};
        (window._erpAllSkuRowsFull || []).forEach(r => {
            costMap[r.skuOuterId] = { cost: parseFloat(r.purchasePrice) || 0, weight: parseFloat(r.weight) || 0 };
        });
        const items = [];
        const cells = [];  // 供 calc-combo-cost
        erpSelectedSkus.forEach(main => {
            const mc = costMap[main.itemCode] || { cost: 0, weight: 0 };
            ladders.forEach(ld => {
                const parts = (ld.components || []).map(c => {
                    const a = accByKw[c.match]; if (!a) return null;
                    return { code: a.itemCode, qty: c.qty || a.defaultQty || 1 };
                }).filter(Boolean);
                const codeStr = [main.itemCode].concat(parts.map(p => p.qty > 1 ? `${p.code}*${p.qty}` : p.code)).join('+');
                items.push({
                    name: `${main.productName || main.itemCode} ${ld.name}`.trim(),
                    spec1: main.productName || main.itemCode, spec2: ld.name,
                    itemCode: codeStr, accParts: parts, stock: 8888, groupPrice: 0, singlePrice: 0, imgDir: ''
                });
                // 组件清单（主件+配件）供成本计算
                const comps = [{ itemCode: main.itemCode, qty: 1, cost: mc.cost, weight: mc.weight }]
                    .concat(parts.map(p => {
                        const pc = costMap[p.code] || { cost: 0, weight: 0 };
                        return { itemCode: p.code, qty: p.qty, cost: pc.cost, weight: pc.weight };
                    }));
                cells.push({ name: `${main.productName||main.itemCode} ${ld.name}`.trim(), components: comps, stock: 8888 });
            });
        });
        // 2.5) 成本 + 定价（复用现有端点）
        try {
            const ccResp = await fetch('/api/erp/calc-combo-cost', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productType: lstCatPath[lstCatPath.length - 1] || '', fixedAccessories: [], skus: cells })
            });
            const ccData = await ccResp.json();
            const costedSkus = (ccData.skus || []).map((s, i) => ({ itemCode: items[i]?.itemCode || '', name: items[i]?.name || '', cost: s.cost || 0, stock: 8888 }));
            const prResp = await fetch('/api/pricing/calculate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ costRatio: 0.35, skus: costedSkus })
            });
            const prData = await prResp.json();
            (prData.skus || []).forEach((s, i) => {
                if (items[i]) { items[i].groupPrice = s.pinPrice || 0; items[i].singlePrice = prData.singlePrice || 0; items[i].cost = s.cost || 0; }
            });
        } catch (e) { console.warn('全自动定价失败，价格留 0 待人工填', e); }
        lstSkuItems = items;
        lstRenderSkuList();
        // 2.6) SKU 生成后，把已导入的白底图目录自动匹配到各 SKU（供生图贴图用）
        const whiteDir = document.getElementById('lstWhiteImgDir')?.value.trim();
        if (whiteDir) { try { await lstAutoMatchWhite(whiteDir); } catch (_) {} }
        // 3) 标题自动生成（复用 prepare）
        try {
            const brand = document.getElementById('lstBrand')?.value.trim() || '';
            const material = document.getElementById('lstMaterial')?.value.trim() || '';
            const pResp = await fetch('/api/listing/prepare', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, material, brand, skuNames: items.map(i => i.spec2) })
            });
            const pdata = await pResp.json();
            if (pdata.title) document.getElementById('lstTitle').value = pdata.title;
            if (pdata.skuNames) items.forEach(i => { if (pdata.skuNames[i.name]) i.skuDisplayName = pdata.skuNames[i.name]; });
        } catch (e) { console.warn('标题自动生成失败', e); }
        // 4) 打开生图弹窗并自动开始（生图→停在待确认，确认后自动上架见 siApply）
        document.getElementById('lstPreview').style.display = 'block';
        await openSkuImgModal();
        // 自动选第一张主图作参考并开始
        const firstRef = document.querySelector('#siRefThumbs img');
        if (firstRef) { siChooseRef(firstRef); }
        if (document.getElementById('siRefPath').value) {
            siGenerate();
        } else {
            alert('已自动搭配+定价完成，请在生图弹窗选参考主图后点「开始生成」。');
        }
    } catch (e) {
        alert('全自动流程失败：' + e.message + '\n可改用人工模式逐步操作。');
    }
}

// 白底图：选一个文件夹，按数字顺序逐个贴到 SKU 的 whiteImgDir
// 把白底图目录里的图按颜色/编码自动匹配到各 SKU（供文件夹扫描 + 手动导入复用）。返回匹配数。
async function lstAutoMatchWhite(dir) {
    if (!dir || !lstSkuItems.length) return 0;
    const resp = await fetch('/api/listing/list-images', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: dir })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    const imgs = data.images || [];
    if (!imgs.length) return 0;
    // 配件/包装类文件不能当作主件白底图
    const accRe = /软管|hose|滤芯|filter|底座|base|袋|bag|水质|对比|water/i;
    const colorImgs = imgs.filter(p => !accRe.test(p.replace(/.*[\\/]/, '')));
    const pool = colorImgs.length ? colorImgs : imgs;
    const baseName = p => p.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, '');
    let n = 0, matched = 0;
    lstSkuItems.forEach(s => {
        const code = (s.itemCode || '').replace(/\s/g, '');
        const spec = (s.spec1 || s.name || '').replace(/[【】\[\]\s]/g, '');
        const hit = pool.find(p => {
            const bn = baseName(p).replace(/\s/g, '');
            if (!bn) return false;
            return (code && code.includes(bn)) || (spec && spec.includes(bn));
        });
        if (hit) { s.whiteImgDir = hit; n++; matched++; }
    });
    let ri = 0;
    lstSkuItems.forEach(s => {
        if (s.whiteImgDir) return;
        if (pool.length) { s.whiteImgDir = pool[ri % pool.length]; ri++; n++; }
    });
    lstRenderSkuList();
    lstRenderImgPreview();
    return n;
}

async function lstImportWhite() {
    if (!lstSkuItems.length) { alert('请先确认 SKU 布局'); return; }
    let dir = '';
    if (window.electronAPI && typeof window.electronAPI.pickDir === 'function') {
        try { dir = await window.electronAPI.pickDir(); } catch (_) {}
    } else {
        dir = prompt('请输入白底图文件夹的完整路径：');
    }
    if (!dir) return;
    try {
        const wdInput = document.getElementById('lstWhiteImgDir');
        if (wdInput) wdInput.value = dir;
        const n = await lstAutoMatchWhite(dir);
        if (!n) { alert('该文件夹未找到可匹配图片'); return; }
        alert(`已匹配 ${n}/${lstSkuItems.length} 张白底图（按颜色/编码匹配，同色共用一张，其余按顺序兜底）`);
    } catch (e) {
        alert('导入白底图失败：' + e.message);
    }
}

// 导出 SKU 图：选目标文件夹，后端复制到 目标/商品素材/序号_款式名.png
async function lstExportSkuImages() {
    if (!lstSkuItems.length) { alert('请先确认 SKU 布局'); return; }
    const withImg = lstSkuItems.filter(s => s.imgDir);
    if (!withImg.length) { alert('当前没有已采用的 SKU 图，请先生成并采用'); return; }
    let dir = '';
    if (window.electronAPI && typeof window.electronAPI.pickDir === 'function') {
        try { dir = await window.electronAPI.pickDir(); } catch (_) {}
    } else {
        dir = prompt('请输入导出目标文件夹的完整路径：');
    }
    if (!dir) return;
    try {
        const resp = await fetch('/api/listing/export-sku-images', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetDir: dir,
                skus: lstSkuItems.map(s => ({ name: s.skuDisplayName || s.name || '', imgPath: s.imgDir || '' }))
            })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        alert(`已导出 ${data.count} 张 SKU 图到：\n${data.savedDir}`);
    } catch (e) {
        alert('导出失败：' + e.message);
    }
}

// 导入已有 SKU 图：选之前导出的「商品素材」文件夹，按序贴回 SKU 的 imgDir（省重新生图）
async function lstImportSkuImages() {
    if (!lstSkuItems.length) { alert('请先确认 SKU 布局'); return; }
    let dir = '';
    if (window.electronAPI && typeof window.electronAPI.pickDir === 'function') {
        try { dir = await window.electronAPI.pickDir(); } catch (_) {}
    } else {
        dir = prompt('请输入「商品素材」文件夹的完整路径：');
    }
    if (!dir) return;
    try {
        const resp = await fetch('/api/listing/list-images', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: dir })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        const imgs = data.images || [];
        if (!imgs.length) { alert('该文件夹未找到图片'); return; }
        let n = 0;
        lstSkuItems.forEach((s, i) => { if (imgs[i]) { s.imgDir = imgs[i]; n++; } });
        lstRenderSkuList();
        alert(`已按顺序导入 ${n}/${lstSkuItems.length} 张 SKU 图`);
    } catch (e) {
        alert('导入 SKU 图失败：' + e.message);
    }
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

let _spProgressTimer = null;

function spStartProgress() {
    const box = document.getElementById('spPlanContent');
    const stages = [
        '正在理解单品清单…',
        'AI 正在构思多套搭配逻辑…',
        '组合阶梯款式、套餐与引流方案…',
        '为每个 SKU 起营销款式名…',
        '整理输出，马上就好…'
    ];
    let sec = 0, stageIdx = 0;
    const render = () => {
        const pct = Math.min(95, Math.round(sec / 90 * 100)); // 估算上限95%，按90s铺满
        box.innerHTML = `
            <div style="text-align:center;padding:36px 20px;">
                <div style="font-size:0.86rem;color:var(--text);margin-bottom:14px;">${stages[stageIdx]}</div>
                <div style="height:8px;background:var(--surface-alt);border-radius:6px;overflow:hidden;max-width:420px;margin:0 auto;">
                    <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:6px;transition:width .8s ease;"></div>
                </div>
                <div style="font-size:0.72rem;color:var(--text-dim);margin-top:10px;">已用时 ${sec}s · AI 生成较慢，请耐心等待（最长约 3 分钟）</div>
            </div>`;
    };
    render();
    _spProgressTimer = setInterval(() => {
        sec++;
        if (sec % 8 === 0 && stageIdx < stages.length - 1) stageIdx++;
        render();
    }, 1000);
}

function spStopProgress() {
    if (_spProgressTimer) { clearInterval(_spProgressTimer); _spProgressTimer = null; }
}

async function spGenerate() {
    const btn = document.getElementById('spGenBtn');
    btn.textContent = '⏳ 生成中...';
    btn.disabled = true;
    spStartProgress();
    let planCount = parseInt(document.getElementById('spCount')?.value || '3');
    if (!(planCount >= 1)) planCount = 3;       // 非法/空值兜底为 3
    if (planCount > 20) planCount = 20;         // 上限保护，与输入框 max 一致
    // 只把非固定成本项（主件/配件）传给 AI，固定成本项（包材/纸箱）不参与搭配
    const skuPayload = lstSkuItems.filter(s => !s.isFixed)
        .map(s => ({ itemCode: s.itemCode || s.name, name: s.name || s.itemCode, cost: parseFloat(s.cost) || 0, role: s.role || 'main' }));
    try {
        const resp = await fetch('/api/listing/generate-sku-plans', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: lstCatPath.join(' > '),
                productName: (lstCatPath[lstCatPath.length - 1] || ''),
                brand: document.getElementById('lstBrand')?.value.trim() || '',
                material: document.getElementById('lstMaterial')?.value.trim() || '',
                skus: skuPayload, planCount
            })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        spStopProgress();
        spPlans = data.plans || [];
        spActiveIdx = 0;
        spRenderTabs();
        spRenderTable(0);
        document.getElementById('spConfirmBtn').disabled = spPlans.length === 0;
    } catch (e) {
        spStopProgress();
        document.getElementById('spPlanContent').innerHTML = `<div style="color:#dc2626;padding:20px;font-size:0.82rem;">生成失败：${e.message}</div>`;
    } finally {
        btn.textContent = '✨ 生成搭配';
        btn.disabled = false;
    }
}

// 单品编码 → 单品对象（name, cost）映射，供组合表格查名查成本
function spItemByCode(code) {
    return lstSkuItems.find(s => (s.itemCode || s.name) === code) || null;
}

// 滤芯识别：名称含"滤芯"才允许调数量
function spIsFilter(name) {
    return typeof name === 'string' && name.includes('滤芯');
}

// 组合层运费：花洒固定3；架类按组合总重阶梯；总重0则0
function spFreight(totalWeight) {
    if (erpProductType === '花洒') return 3.0;
    const w = parseFloat(totalWeight) || 0;
    if (w <= 0) return 0;
    const over = Math.ceil(Math.max(0, w - 0.3) / 0.1);
    return Math.round((2.4 + over * 0.15) * 100) / 100;
}

// 计算单个组合SKU的预览成本：材料(组件×数量) + 固定包材 + 组合层运费(按总重一次)
function spComboCost(components) {
    let material = 0, totalWeight = 0;
    (components || []).forEach(c => {
        const item = spItemByCode(c.itemCode);
        const qty  = parseInt(c.qty) || 1;
        const unit = item ? (parseFloat(item.cost) || 0) : 0;
        const w    = item ? (parseFloat(item.weight) || 0) : 0;
        material += unit * qty;
        totalWeight += w * qty;
    });
    const cost = material + spAccessoryCostPreview() + spFreight(totalWeight);
    return Math.round(cost * 100) / 100;
}

// 固定成本项预览成本：累加 lstSkuItems 里 isFixed 项的 cost（包材/纸箱，每件SKU都含）
function spAccessoryCostPreview() {
    let total = 0;
    lstSkuItems.forEach(s => {
        if (s.isFixed) total += parseFloat(s.cost) || 0;
    });
    return total;
}

function spRenderTabs() {
    const bar = document.getElementById('spTabBar');
    if (!bar) return;
    bar.innerHTML = spPlans.map((p, i) => {
        const label = p.planName || ('方案' + (i+1));
        return `<button class="sp-tab${i === spActiveIdx ? ' active' : ''}" onclick="spSelectTab(${i})">${ecEscAttr(label)}</button>`;
    }).join('');
}

function spSelectTab(idx) { spActiveIdx = idx; spRenderTabs(); spRenderTable(idx); }

function spRenderTable(idx) {
    const plan = spPlans[idx];
    const box = document.getElementById('spPlanContent');
    if (!plan || !box) return;
    // 兼容：把旧结构(skus)或缺失字段规整为 mainItems + models
    plan.mainItems = plan.mainItems || [];
    plan.models    = plan.models || [];

    // 配件下拉：只列 role=accessory 的单品（主件不作为型号配件）
    const accOpts = lstSkuItems.filter(it => !it.isFixed && it.role === 'accessory').map(it => {
        const code = it.itemCode || it.name;
        return `<option value="${ecEscAttr(code)}">${ecEscAttr(it.name || code)}</option>`;
    }).join('');

    // 单个格子成本 = 主件 + 该型号配件 + 固定成本 + 运费（复用 spComboCost）
    const cellCost = (mainCode, model) => {
        const comps = [{ itemCode: mainCode, qty: 1 }, ...(model.components || [])];
        return spComboCost(comps);
    };

    // 表头：第一列空 + 每个主件一列
    const mainCols = plan.mainItems.map((m, mi) => `
        <th style="padding:6px 8px;min-width:130px;border-left:1px solid var(--border);">
            <input value="${ecEscAttr(m.specName||'')}" oninput="spPlans[${idx}].mainItems[${mi}].specName=this.value" placeholder="主件名"
                style="width:90px;padding:2px 5px;border:1px solid var(--border);border-radius:4px;font-size:0.72rem;font-weight:600;">
            <div style="font-size:0.62rem;color:var(--text-dim);margin-top:2px;">${ecEscAttr(m.itemCode||'')}
                <span onclick="spDelMain(${idx},${mi})" style="cursor:pointer;color:#dc2626;margin-left:4px;">✕</span></div>
        </th>`).join('');

    // 型号行
    const rows = plan.models.map((md, ri) => {
        md.components = md.components || [];
        const compHtml = md.components.map((c, ci) => {
            const item = spItemByCode(c.itemCode);
            const cname = item ? (item.name || c.itemCode) : c.itemCode;
            const qtyCtrl = spIsFilter(cname)
                ? `<input type="number" min="1" step="1" value="${c.qty||1}" onchange="spSetModelQty(${idx},${ri},${ci},this.value)" style="width:42px;padding:0 3px;border:1px solid var(--border);border-radius:4px;font-size:0.68rem;">个`
                : `×1`;
            return `<span style="display:inline-flex;align-items:center;gap:2px;background:var(--surface-alt);border-radius:4px;padding:1px 5px;margin:1px;font-size:0.68rem;">
                ${ecEscAttr(cname)} ${qtyCtrl}
                <span onclick="spDelModelComp(${idx},${ri},${ci})" style="cursor:pointer;color:#dc2626;font-weight:700;">×</span></span>`;
        }).join('');
        const cells = plan.mainItems.map(m => `
            <td style="padding:6px 8px;font-size:0.74rem;font-weight:600;white-space:nowrap;border-left:1px solid var(--border);">¥${cellCost(m.itemCode, md).toFixed(2)}</td>`).join('');
        return `<tr style="border-bottom:1px solid var(--border);vertical-align:top;">
            <td style="padding:6px 8px;min-width:220px;">
                <input value="${ecEscAttr(md.specName||'')}" oninput="spPlans[${idx}].models[${ri}].specName=this.value" placeholder="型号名"
                    style="width:130px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.74rem;">
                <span onclick="spDelModel(${idx},${ri})" style="cursor:pointer;color:#dc2626;font-size:0.7rem;margin-left:4px;">删除</span>
                <div style="margin-top:3px;">${compHtml}
                    <select onchange="spAddModelComp(${idx},${ri},this.value);this.selectedIndex=0;" style="font-size:0.68rem;padding:1px 3px;border:1px dashed var(--border);border-radius:4px;color:var(--primary);">
                        <option value="">+配件</option>${accOpts}
                    </select></div>
            </td>${cells}
        </tr>`;
    }).join('');

    const accNote = spAccessoryCostPreview() > 0
        ? `<span style="color:var(--text-dim);">（每件已含固定成本 ¥${spAccessoryCostPreview().toFixed(2)}）</span>` : '';

    box.innerHTML = `
        <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:10px;padding:8px 10px;background:var(--primary-light);border-radius:6px;">💡 ${ecEscAttr(plan.description || '')} ${accNote}</div>
        <div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:6px;">行=型号，列=主件；每格为该 SKU 成本。共 ${plan.mainItems.length}×${plan.models.length}=${plan.mainItems.length*plan.models.length} 个 SKU</div>
        <div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:0.78rem;">
            <thead><tr style="background:var(--surface-alt);font-size:0.7rem;color:var(--text-dim);">
                <th style="padding:6px 8px;text-align:left;">型号 \\ 主件</th>${mainCols}
            </tr></thead><tbody>${rows}</tbody></table></div>
        <div style="margin-top:10px;display:flex;gap:8px;">
            <button onclick="spAddModel(${idx})" style="padding:5px 14px;border:1px dashed var(--primary);border-radius:6px;background:var(--primary-light);color:var(--primary);font-size:0.76rem;cursor:pointer;">+ 新增型号</button>
            <button onclick="spAddMain(${idx})" style="padding:5px 14px;border:1px dashed var(--border);border-radius:6px;background:transparent;color:var(--text-muted);font-size:0.76rem;cursor:pointer;">+ 新增主件</button>
        </div>`;
}

function spAddModelComp(idx, ri, code) {
    if (!code) return;
    const md = spPlans[idx].models[ri];
    md.components = md.components || [];
    const item = spItemByCode(code);
    md.components.push({ itemCode: code, qty: (item && spIsFilter(item.name)) ? 5 : 1 });
    spRenderTable(idx);
}
function spDelModelComp(idx, ri, ci) { spPlans[idx].models[ri].components.splice(ci, 1); spRenderTable(idx); }
function spSetModelQty(idx, ri, ci, val) { spPlans[idx].models[ri].components[ci].qty = Math.max(1, parseInt(val)||1); spRenderTable(idx); }
function spDelModel(idx, ri) { spPlans[idx].models.splice(ri, 1); spRenderTable(idx); }
function spAddModel(idx) { spPlans[idx].models.push({ specName: '', components: [] }); spRenderTable(idx); }
function spDelMain(idx, mi) { spPlans[idx].mainItems.splice(mi, 1); spRenderTable(idx); }
function spAddMain(idx) {
    // 从未用作主件的 role=main 单品里挑一个加入
    const used = new Set((spPlans[idx].mainItems||[]).map(m => m.itemCode));
    const cand = lstSkuItems.find(s => !s.isFixed && s.role !== 'accessory' && !used.has(s.itemCode));
    if (!cand) { alert('没有更多可作主件的单品'); return; }
    spPlans[idx].mainItems.push({ itemCode: cand.itemCode, specName: cand.name || cand.itemCode });
    spRenderTable(idx);
}

async function spConfirm() {
    const plan = spPlans[spActiveIdx];
    if (!plan || !(plan.mainItems||[]).length || !(plan.models||[]).length) {
        alert('该方案缺少主件或型号'); return;
    }

    const btn = document.getElementById('spConfirmBtn');
    btn.disabled = true; btn.textContent = '计算成本中...';
    try {
        // 固定成本项（包材/纸箱），带成本
        const fixedAccessories = lstSkuItems.filter(s => s.isFixed)
            .map(s => ({ itemCode: s.itemCode, cost: parseFloat(s.cost) || 0 }));

        // 矩阵笛卡尔积展平：每个 {主件 × 型号} = 一个格子 SKU
        const cellComp = (mainCode, model) => [{ itemCode: mainCode, qty: 1 }, ...(model.components || [])]
            .map(c => {
                const item = spItemByCode(c.itemCode);
                return {
                    itemCode: c.itemCode,
                    qty: parseInt(c.qty) || 1,
                    cost: item ? (parseFloat(item.cost) || 0) : 0,
                    weight: item ? (parseFloat(item.weight) || 0) : 0
                };
            });
        const cells = [];
        plan.mainItems.forEach(m => {
            plan.models.forEach(md => {
                // 规格编码 = 主件编码 + 各配件编码，用 + 连接；数量>1 的配件（如滤芯）用「码*数量」后缀，
                // 与快麦组合装格式一致，如 GF-099不开窗-灰色+银底座+银色1.5米软管+052滤芯*5
                const codeParts = [m.itemCode];
                (md.components || []).forEach(c => {
                    const code = c.itemCode;
                    if (!code) return;
                    const n = Math.max(1, parseInt(c.qty) || 1);
                    codeParts.push(n > 1 ? `${code}*${n}` : code);
                });
                const specCode = codeParts.filter(Boolean).join('+');
                cells.push({
                    itemCode: specCode,
                    spec1: m.specName || m.itemCode,
                    spec2: md.specName || '默认',
                    name: `${m.specName||m.itemCode} ${md.specName||''}`.trim(),
                    stock: 8888,
                    components: cellComp(m.itemCode, md)
                });
            });
        });

        const resp = await fetch('/api/erp/calc-combo-cost', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productType: erpProductType, fixedAccessories, skus: cells })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        // 展平后的格子列表进定价面板（带 spec1/spec2 + 组合规格编码 + 已选配件码）
        openPricingModal((data.skus || []).map((s, i) => ({
            name: s.name, cost: parseFloat(s.cost) || 0, stock: s.stock || 8888,
            itemCode: cells[i]?.itemCode || '',
            spec1: cells[i]?.spec1 || '', spec2: cells[i]?.spec2 || '',
            // 配件码清单（来自前面选的型号 components，去掉主件；保留 code+qty 供生图贴图用）
            accParts: ((cells[i]?.components) || []).slice(1).map(c => ({ code: c.itemCode, qty: c.qty || 1 }))
        })));
        closeSkuPlanModal();
    } catch (e) {
        alert('成本计算失败：' + e.message);
    } finally {
        btn.disabled = false; btn.textContent = '确认此搭配 → 定价';
    }
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

        // 白底图跟主图/详情图一起识别；白底图自动按颜色/编码匹配到各 SKU（不再单独导入）
        const lines = [];
        if (data.mainImgDir) lines.push(`✓ 主图：${data.mainImgDir}（用作生图参考）`); else lines.push('✗ 未找到主图文件夹（命名需含"主图"）');
        if (data.detailImgDir) lines.push(`✓ 详情图：${data.detailImgDir}`); else lines.push('✗ 未找到详情图文件夹（命名需含"详情"）');
        if (data.whiteImgDir) lines.push(`✓ 白底图：${data.whiteImgDir}（自动匹配 SKU）`); else lines.push('✗ 未找到白底图文件夹（命名需含"白底"）');
        if (data.whiteImgDir) { try { await lstAutoMatchWhite(data.whiteImgDir); } catch (_) {} }
        status.innerHTML = lines.join('<br>');
        lstShowPreview();
        lstRenderImgPreview();
    } catch (e) {
        status.textContent = '扫描失败：' + e.message;
    }
}

// 左侧图片预览：主图/详情图/白底图各取目录图片显示缩略图
async function lstRenderImgPreview() {
    const box = document.getElementById('lstImgPreview');
    if (!box) return;
    const groups = [
        { label: '主图',  dir: document.getElementById('lstMainImgDir')?.value || '' },
        { label: '详情图', dir: document.getElementById('lstDetailImgDir')?.value || '' },
        { label: '白底图', dir: document.getElementById('lstWhiteImgDir')?.value || '' },
    ].filter(g => g.dir);
    if (!groups.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = '<div style="font-size:0.7rem;color:var(--text-dim);">加载预览…</div>';

    const sections = await Promise.all(groups.map(async g => {
        let imgs = [];
        try {
            const resp = await fetch('/api/listing/list-images', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: g.dir })
            });
            imgs = (await resp.json()).images || [];
        } catch (_) {}
        if (!imgs.length) return '';
        const MAX = 12;
        const thumbs = imgs.slice(0, MAX).map(p =>
            `<img src="/api/image?path=${encodeURIComponent(p)}" title="${ecEscAttr(p.replace(/.*[\\/]/, ''))}"
                style="width:48px;height:48px;object-fit:cover;border-radius:5px;border:1px solid var(--border);flex-shrink:0;">`
        ).join('');
        const more = imgs.length > MAX ? `<span style="font-size:0.66rem;color:var(--text-dim);align-self:center;">+${imgs.length - MAX}</span>` : '';
        return `<div style="margin-bottom:8px;">
            <div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:4px;">${g.label}（${imgs.length}）</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">${thumbs}${more}</div>
        </div>`;
    }));
    const html = sections.filter(Boolean).join('');
    box.innerHTML = html || '<div style="font-size:0.7rem;color:var(--text-dim);">无可预览图片</div>';
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

// 参考标题库生成标题 + SKU 款式名（有主图则看图识别卖点）
async function lstAutoPrepare() {
    if (!lstCatPath.length) { alert('请先选择商品品类'); return; }
    const material = document.getElementById('lstMaterial').value.trim();
    if (!material) { alert('请先选择材质'); return; }
    const brand = document.getElementById('lstBrand').value.trim();
    if (!brand) { alert('请先填写品牌（标题最前面必须是品牌）'); return; }
    const mainImgDir = document.getElementById('lstMainImgDir')?.value.trim() || '';
    const skuNames = lstSkuItems.map(s => s.name).filter(Boolean);
    const btn = document.getElementById('lstRegenBtn');
    const titleInput = document.getElementById('lstTitle');
    if (btn) { btn.textContent = '⏳ 生成中...'; btn.disabled = true; }
    if (titleInput) titleInput.placeholder = mainImgDir ? 'AI 看图识别卖点生成中...' : 'AI 生成标题中...';
    try {
        const resp = await fetch('/api/listing/prepare', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: lstCatPath.join(' > '), material, brand, skuNames,
                mainImgDir, useVision: !!mainImgDir
            })
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

async function lstStartListing(dryRun) {
    const title = document.getElementById('lstTitle').value.trim();
    if (!lstCatPath.length) { alert('请选择商品品类'); return; }
    if (!document.getElementById('lstMaterial').value.trim()) { alert('请选择材质'); return; }
    if (lstSkuItems.length === 0) { alert('请先生成或导入 SKU'); return; }
    // 上新前校验：所有 SKU 必须都有图，否则提交会因缺预览图报错
    if (!dryRun) {
        const noImg = lstSkuItems.filter(s => !s.imgDir);
        if (noImg.length) {
            alert(`还有 ${noImg.length} 个 SKU 没有图片，无法上新：\n` +
                noImg.map(s => '· ' + (s.name || s.itemCode)).join('\n') +
                `\n\n请用「🎨生成SKU图」补齐，或「📂导入SKU图」后再上新。`);
            return;
        }
    }
    const categoryPath = lstCatPath.join(' > ');
    const productType = lstCatPath[lstCatPath.length - 1] || '';
    const material = panelMaterialVal() || document.getElementById('lstMaterial').value.trim() || '塑料';
    const attributes = {};
    if (material) attributes['材质'] = material;
    // 并入产品信息属性面板的其余非空项（材质单独处理，避免重复）
    (lstAttributes || []).forEach(a => {
        const n = (a.name || '').trim(), v = (a.value || '').trim();
        if (n && v && n !== '材质') attributes[n] = v;
    });
    const config = {
        productType, material,
        brand: document.getElementById('lstBrand').value.trim(),
        category: categoryPath, title, attributes,
        skus: lstSkuItems.map(s => ({
            name: s.skuDisplayName || s.name, imgDir: s.imgDir,
            groupPrice: Math.round(Math.max(0, parseFloat(s.groupPrice) || 0) * 100),
            singlePrice: Math.round(Math.max(0, parseFloat(s.singlePrice) || 0) * 100),
            stock: Math.max(0, parseInt(s.stock) || 8888), itemCode: s.itemCode || ''
        })),
        mainImgDir: document.getElementById('lstMainImgDir').value.trim(),
        detailImgDir: document.getElementById('lstDetailImgDir').value.trim(),
        whiteImgDir: document.getElementById('lstWhiteImgDir').value.trim(),
        skuSpecType: document.getElementById('lstSkuSpecType')?.value || '款式',
        discount: '9.9折', deliveryPromise: '48小时发货及揽收',
        dryRun: !!dryRun
    };
    const log = document.getElementById('lstProgressLog');
    log.style.display = 'block';
    log.textContent = dryRun ? '启动诊断模式（不提交，生成 sku_input_diag.json）...\n' : '启动自动上新...\n';
    const startBtn = document.getElementById('lstStartBtn');
    startBtn.disabled = true;
    startBtn.textContent = dryRun ? '🔍 诊断中...' : '⏳ 上新中...';
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

// ── 定价确认面板 ──

let pmSkus = [];        // 当前待定价的 SKU 列表（来自 AI 方案）
let pmRatio = 0.35;     // 当前成本占比

function openPricingModal(skus) {
    // 保留 imgDir 映射
    const imgMap = {};
    lstSkuItems.forEach(s => { imgMap[s.itemCode || s.name] = s.imgDir || ''; });
    pmSkus = skus.map(s => ({
        itemCode: s.itemCode || s.name || '',
        name:     s.name || '',
        cost:     parseFloat(s.cost) || 0,
        imgDir:   imgMap[s.itemCode] || imgMap[s.name] || '',
        stock:    parseInt(s.stock) || 8888,
        spec1:    s.spec1 || '',
        spec2:    s.spec2 || '',
        accParts: s.accParts || []
    }));
    pmRatio = 0.35;
    const slider = document.getElementById('pmRatioSlider');
    if (slider) slider.value = pmRatio;
    pmRefresh();
    document.getElementById('pricingModal')?.classList.add('show');
}

function closePricingModal() {
    document.getElementById('pricingModal')?.classList.remove('show');
}

function pmOnSlider(val) {
    pmRatio = parseFloat(val);
    document.getElementById('pmRatioVal').textContent = Math.round(pmRatio * 100) + '%';
    pmRefresh();
}

async function pmRefresh() {
    if (!pmSkus.length) return;
    try {
        const resp = await fetch('/api/pricing/calculate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ costRatio: pmRatio, skus: pmSkus })
        });
        const data = await resp.json();
        if (data.error) return;
        pmRenderTable(data);
    } catch (_) {}
}

function pmRenderTable(data) {
    const skus = data.skus || [];
    const sp   = (data.singlePrice || 0).toFixed(2);
    const rp   = (data.refPrice    || 0).toFixed(2);
    const rows = skus.map(s => `
        <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;">
            <td style="padding:5px 8px;color:var(--text-dim);">${ecEscAttr(s.itemCode)}</td>
            <td style="padding:5px 8px;">${ecEscAttr(s.name)}</td>
            <td style="padding:5px 8px;">¥${(s.cost||0).toFixed(2)}</td>
            <td style="padding:5px 8px;font-weight:600;">¥${(s.price||0).toFixed(2)}</td>
            <td style="padding:5px 8px;">¥${(s.profit||0).toFixed(2)}</td>
            <td style="padding:5px 8px;">¥${(s.deduction||0).toFixed(2)}</td>
            <td style="padding:5px 8px;">¥${(s.profit2||0).toFixed(2)}</td>
            <td style="padding:5px 8px;${(s.marginRate||0)>=0.25?'color:#16a34a':'color:#dc2626'};font-weight:600;">${((s.marginRate||0)*100).toFixed(1)}%</td>
            <td style="padding:5px 8px;">${(s.breakeven||0).toFixed(2)}</td>
            <td style="padding:5px 8px;font-weight:600;">¥${(s.pinPrice||0).toFixed(2)}</td>
        </tr>`).join('');
    const box = document.getElementById('pmTableBox');
    if (!box) return;
    box.innerHTML = `
        <div style="font-size:0.73rem;color:var(--text-muted);margin-bottom:8px;display:flex;gap:16px;">
            <span>单买价（整品）：<b>¥${sp}</b></span>
            <span>参考价（划线）：<b>¥${rp}</b></span>
        </div>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:var(--surface-alt);font-size:0.7rem;color:var(--text-dim);">
                <th style="padding:5px 8px;text-align:left;">编码</th>
                <th style="padding:5px 8px;text-align:left;">款式名</th>
                <th style="padding:5px 8px;text-align:left;">成本</th>
                <th style="padding:5px 8px;text-align:left;">价格</th>
                <th style="padding:5px 8px;text-align:left;">利润</th>
                <th style="padding:5px 8px;text-align:left;">活动扣</th>
                <th style="padding:5px 8px;text-align:left;">二级利润</th>
                <th style="padding:5px 8px;text-align:left;">利润率</th>
                <th style="padding:5px 8px;text-align:left;">保本投产</th>
                <th style="padding:5px 8px;text-align:left;">拼单价</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;
    document.getElementById('pmLastData')?.setAttribute('data-json', JSON.stringify(data));
}

async function pmExport() {
    const btn = document.getElementById('pmExportBtn');
    btn.disabled = true; btn.textContent = '⏳ 导出中...';
    try {
        const resp = await fetch('/api/pricing/export', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ costRatio: pmRatio, skus: pmSkus })
        });
        if (!resp.ok) throw new Error('导出失败');
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = '定价表.xlsx';
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('导出失败：' + e.message);
    } finally {
        btn.disabled = false; btn.textContent = '📥 导出定价表 xlsx';
    }
}

async function pmApply() {
    // 先拿最新计算结果再填回
    const resp = await fetch('/api/pricing/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costRatio: pmRatio, skus: pmSkus })
    });
    const data = await resp.json();
    if (data.error) { alert('计算失败：' + data.error); return; }

    lstSkuItems = (data.skus || []).map((s, i) => ({
        name:        pmSkus[i]?.name || s.name || '',
        imgDir:      pmSkus[i]?.imgDir || '',
        groupPrice:  s.pinPrice || 0,
        singlePrice: data.singlePrice || 0,
        stock:       pmSkus[i]?.stock || 8888,
        itemCode:    s.itemCode || '',
        spec1:       pmSkus[i]?.spec1 || '',
        spec2:       pmSkus[i]?.spec2 || '',
        accParts:    pmSkus[i]?.accParts || [],
        cost:        s.cost || 0
    }));
    lstRenderSkuList();
    closePricingModal();
    document.getElementById('lstPreview').style.display = 'block';
}

// ── ERP 选品面板 ──

let erpPage = 1;
let erpKeyword = '';
let erpSelectedSkus = [];  // [{itemCode, productName}]
let erpProductType = '架类';

// ── 常用 SKU 计数器：选中即 +1，持久化到 localStorage，渲染时计数高的置顶 ──
let erpUsage = {};  // { skuOuterId: 次数 }
try { erpUsage = JSON.parse(localStorage.getItem('erpUsage') || '{}') || {}; } catch (_) { erpUsage = {}; }
function erpSaveUsage() {
    try { localStorage.setItem('erpUsage', JSON.stringify(erpUsage)); } catch (_) {}
}
function erpBumpUsage(code) {
    if (!code) return;
    erpUsage[code] = (erpUsage[code] || 0) + 1;
    erpSaveUsage();
}
// 把行列表按常用计数降序置顶（计数相同/为0 保持原有相对顺序）
function erpSortByUsage(rows) {
    return rows.map((r, i) => [r, i]).sort((a, b) => {
        const ua = erpUsage[a[0].skuOuterId] || 0, ub = erpUsage[b[0].skuOuterId] || 0;
        if (ua !== ub) return ub - ua;
        return a[1] - b[1];  // 稳定：计数相同按原顺序
    }).map(x => x[0]);
}

function openErpModal() {
    if (!lstCatPath.length) { alert('请先选择商品品类再进行选品'); return; }
    const catStr = lstCatPath.join('');
    erpProductType = (catStr.includes('花洒') || catStr.includes('淋浴')) ? '花洒' : '架类';
    erpPage = 1; erpKeyword = ''; erpSelectedSkus = [];
    erpAllSkuRows = []; erpTotalItems = 0;
    document.getElementById('erpSearchInput').value = '';
    erpUpdateCount();
    const tag = document.getElementById('erpProductTypeTag');
    if (tag) tag.textContent = erpProductType;
    erpLoad(false);
    document.getElementById('erpModal')?.classList.add('show');
}

function closeErpModal() {
    document.getElementById('erpModal')?.classList.remove('show');
}

// ── 流程返回上一步（保留已填数据，不重置）──
// 成本核对 → ERP选品：轻量 show（不调 openErpModal，避免重置勾选），重渲染保留勾选
function crBack() {
    closeCostReviewModal();
    document.getElementById('erpModal')?.classList.add('show');
    if (typeof renderErpRows === 'function') renderErpRows();
    if (typeof erpUpdateCount === 'function') erpUpdateCount();
}

// 搭配工作台 → 成本核对：直接 show + 用现有 costReviewItems 重渲染
function spBack() {
    closeSkuPlanModal();
    document.getElementById('costReviewModal')?.classList.add('show');
    if (typeof crRender === 'function') crRender();
}

// 定价 → 搭配工作台：直接 show（spPlans 还在）
function pmBack() {
    closePricingModal();
    document.getElementById('skuPlanModal')?.classList.add('show');
}

async function erpLoad(append) {
    const box = document.getElementById('erpProductList');
    if (!append) box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-dim);font-size:0.8rem;">加载中（首次需要约10秒建立缓存）...</div>';
    try {
        const url = `/api/erp/sku-items?keyword=${encodeURIComponent(erpKeyword)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        erpRenderList(data, false);
    } catch (e) {
        box.innerHTML = `<div style="padding:20px;color:#dc2626;font-size:0.8rem;">加载失败：${ecEscAttr(e.message)}</div>`;
    }
}

let erpItemsCache = {};
let erpAllSkuRows = [];  // 累积所有已加载的单品行
let erpTotalItems = 0;

function erpRenderList(data, append) {
    const items = data.items || [];
    erpTotalItems = typeof data.total === 'number' ? data.total : erpTotalItems;

    // 摊平 SKU
    const newRows = [];
    items.forEach(item => {
        erpItemsCache[item.sysItemId] = item;
        const skus = item.skus || [];
        if (skus.length > 0) {
            skus.forEach(sk => {
                // 名称优先级：propertiesAlias > shortTitle > propertiesName > item.title
                const name = (sk.propertiesAlias || sk.shortTitle || sk.propertiesName || item.title || '').trim();
                newRows.push({
                    sysItemId:    item.sysItemId,
                    skuOuterId:   sk.skuOuterId || '',
                    name:         name || sk.skuOuterId || item.outerId || '—',
                    productTitle: item.title || '',
                    purchasePrice: sk.purchasePrice != null ? sk.purchasePrice : (item.purchasePrice || 0),
                    weight:       sk.weight != null ? sk.weight : (item.weight || 0),
                    hasSupplier:  sk.hasSupplier != null ? sk.hasSupplier : (item.hasSupplier || 0)
                });
            });
        } else {
            newRows.push({
                sysItemId:    item.sysItemId,
                skuOuterId:   item.outerId || '',
                name:         item.shortTitle || item.title || item.outerId || '—',
                productTitle: item.title || '',
                purchasePrice: item.purchasePrice || 0,
                weight:       item.weight || 0,
                hasSupplier:  item.hasSupplier || 0
            });
        }
    });

    if (append) {
        erpAllSkuRows = erpAllSkuRows.concat(newRows);
    } else {
        erpAllSkuRows = newRows;
        window._erpAllSkuRowsFull = newRows.slice(); // 保存完整数据供本地过滤
    }
    window._erpSkuRows = erpAllSkuRows;
    renderErpRows();
}

function renderErpRows() {
    const box = document.getElementById('erpProductList');
    if (!erpAllSkuRows.length) {
        box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-dim);font-size:0.8rem;">暂无单品</div>';
        erpUpdatePageInfo();
        return;
    }

    // 渲染上限：避免一次插入上万 DOM 节点卡死浏览器
    const LIMIT = 200;
    const sorted = erpSortByUsage(erpAllSkuRows);  // 常用计数高的置顶
    const rows = sorted.slice(0, LIMIT);
    let html = rows.map((sk, idx) => {
        const price    = `¥${parseFloat(sk.purchasePrice || 0).toFixed(2)}`;
        const weight   = `${parseFloat(sk.weight || 0).toFixed(3)}kg`;
        const supplier = sk.hasSupplier === 1 ? '<span style="color:#16a34a;font-size:0.66rem;padding:1px 5px;background:#f0fdf4;border-radius:3px;">代发</span>' : '';
        const useCnt   = erpUsage[sk.skuOuterId] || 0;
        const usedTag  = useCnt > 0 ? `<span title="常用次数" style="color:#d97706;font-size:0.64rem;padding:1px 5px;background:#fffbeb;border-radius:3px;flex-shrink:0;">★${useCnt}</span>` : '';
        const isChosen = erpSelectedSkus.some(s => s.itemCode === sk.skuOuterId);
        const chkStyle = isChosen ? 'background:var(--primary);color:#fff;' : '';
        const rowBg    = isChosen ? 'background:var(--primary-light);' : '';
        return `<div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;cursor:pointer;${rowBg}" onclick="erpToggleSingleSku(${idx}, this)">
            <span id="erpSkuChk_${idx}" style="width:16px;height:16px;border:2px solid var(--border);border-radius:3px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.6rem;${chkStyle}">${isChosen ? '✓' : ''}</span>
            <span style="flex:1;font-size:0.78rem;font-weight:600;">${ecEscAttr(sk.name)}</span>
            ${usedTag}
            ${supplier}
            <span style="font-size:0.68rem;color:var(--text-dim);">${ecEscAttr(sk.skuOuterId)}</span>
            <span style="font-size:0.68rem;color:var(--text-dim);white-space:nowrap;">${price} · ${weight}</span>
        </div>`;
    }).join('');
    if (erpAllSkuRows.length > LIMIT) {
        html += `<div style="text-align:center;padding:14px;color:var(--text-dim);font-size:0.74rem;">仅显示前 ${LIMIT} 条，共 ${erpAllSkuRows.length} 条 — 请用上方搜索框缩小范围</div>`;
    }
    box.innerHTML = html;

    window._erpSkuRows = rows;
    erpUpdatePageInfo();
}

function erpUpdatePageInfo() {
    const loaded = erpAllSkuRows.length;
    const el = document.getElementById('erpPageInfo');
    if (el) el.textContent = `已加载 ${loaded} 条`;
    const nextBtn = document.getElementById('erpNextBtn');
    if (nextBtn) {
        const hasMore = loaded < erpTotalItems || erpTotalItems === 0;
        nextBtn.style.display = hasMore ? '' : 'none';
    }
}

function erpToggleSingleSku(idx, el) {
    const sk = (window._erpSkuRows || [])[idx];
    if (!sk) return;
    const chk = document.getElementById(`erpSkuChk_${idx}`);
    const isSelected = chk.style.background === 'var(--primary)';
    if (isSelected) {
        chk.style.background = ''; chk.innerHTML = '';
        el.style.background = '';
        erpSelectedSkus = erpSelectedSkus.filter(s => s.itemCode !== sk.skuOuterId);
    } else {
        chk.style.background = 'var(--primary)'; chk.innerHTML = '✓';
        chk.style.color = '#fff';
        el.style.background = 'var(--primary-light)';
        if (!erpSelectedSkus.find(s => s.itemCode === sk.skuOuterId)) {
            erpSelectedSkus.push({
                sysItemId:   sk.sysItemId,
                itemCode:    sk.skuOuterId,
                productName: sk.name,
                role:        'main'
            });
            erpBumpUsage(sk.skuOuterId);  // 选中即 +1，用于常用置顶
        }
    }
    erpUpdateCount();
}

function erpToggleSku(sysItemId, code, productName, checked) {
    if (checked) {
        if (!erpSelectedSkus.find(s => s.itemCode === code)) {
            erpSelectedSkus.push({ sysItemId, itemCode: code, productName });
            erpBumpUsage(code);  // 选中即 +1，用于常用置顶
        }
    } else {
        erpSelectedSkus = erpSelectedSkus.filter(s => s.itemCode !== code);
    }
    erpUpdateCount();
}

function erpUpdateCount() {
    const cnt = document.getElementById('erpSelectedCount');
    if (cnt) cnt.textContent = erpSelectedSkus.length ? `已选 ${erpSelectedSkus.length} 个SKU` : '';
}

function erpSearch() {
    erpKeyword = document.getElementById('erpSearchInput').value.trim();
    erpPage = 1; erpAllSkuRows = []; erpTotalItems = 0;
    erpLoad(false);
}

async function erpRefreshCache() {
    const btn = document.getElementById('erpRefreshCacheBtn');
    if (btn) { btn.disabled = true; btn.textContent = '🔄 刷新中...'; }
    try {
        const resp = await fetch('/api/erp/sku-items/refresh', { method: 'POST' });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        // 刷新后重新加载列表
        document.getElementById('erpSearchInput').value = '';
        erpKeyword = ''; erpPage = 1; erpAllSkuRows = []; erpTotalItems = 0;
        erpLoad(false);
    } catch (e) {
        alert('刷新失败：' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 刷新'; }
    }
}

function erpSearchLocal(kw) {
    // 防抖：避免每次按键都过滤+渲染全量缓存导致卡顿
    clearTimeout(window._erpSearchTimer);
    window._erpSearchTimer = setTimeout(() => {
        const q = (kw || '').trim().toLowerCase();
        const full = window._erpAllSkuRowsFull || [];
        erpAllSkuRows = q
            ? full.filter(r =>
                String(r.name || '').toLowerCase().includes(q) ||
                String(r.skuOuterId || '').toLowerCase().includes(q))
            : full.slice();
        window._erpSkuRows = erpAllSkuRows;
        renderErpRows();
    }, 150);
}

function erpPrev() { if (erpPage > 1) { erpPage--; erpAllSkuRows = []; erpLoad(false); } }
function erpNext() { erpPage++; erpLoad(true); }

async function erpConfirm() {
    if (!erpSelectedSkus.length) { alert('请先勾选单品'); return; }

    // 全自动模式：只需选了主件，后端按规则补配件/批量件，自动跑到生图
    if (lyGetSettings().mode === 'auto') {
        closeErpModal();
        lyAutoRun();
        return;
    }

    closeErpModal();

    // 调成本计算接口（花洒品类后端会自动补充手喷袋/好评卡/胶纸等固定包材）
    const btn = document.getElementById('erpConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '计算中...'; }
    try {
        const resp = await fetch('/api/erp/calc-cost', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                skuOuterIds: erpSelectedSkus.map(s => s.itemCode),
                productType: erpProductType
            })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        openCostReviewModal(data);
    } catch (e) {
        // 降级到手动录入
        alert('自动计算成本失败：' + e.message + '\n将切换为手动录入模式。');
        openCostModal(erpSelectedSkus);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '确认选品 →'; }
    }
}

// ── 成本核对面板 ──

let costReviewItems = [];

function openCostReviewModal(data) {
    // 从 erpSelectedSkus 回填 role（主件/配件）；固定成本项无 role
    const roleMap = {};
    erpSelectedSkus.forEach(s => { roleMap[s.itemCode] = s.role || 'main'; });
    costReviewItems = (data.items || []).map(s => ({
        ...s,
        overrideCost: null,
        role: s.isFixed ? 'fixed' : (roleMap[s.skuOuterId] || 'main')
    }));
    crRender(data.totalCost);
    document.getElementById('costReviewModal')?.classList.add('show');
}

function closeCostReviewModal() { document.getElementById('costReviewModal')?.classList.remove('show'); }

// 当前行成本：覆盖值优先，否则材料成本价（运费在组合层算，不在此处）
function crRowCost(s) {
    if (s.overrideCost != null) return s.overrideCost;
    return Math.round((parseFloat(s.purchasePrice) || 0) * 100) / 100;
}

function crRender(totalCost) {
    const rows = costReviewItems.map((s, i) => {
        const isSupplier = s.hasSupplier === 1;
        const fixed = s.isFixed === true;
        const rowBg = fixed ? 'background:#fffbeb;' : '';
        const nameCell = fixed
            ? `${ecEscAttr(s.name)} <span style="color:#d97706;font-size:0.66rem;padding:1px 4px;background:#fef3c7;border-radius:3px;">固定成本</span>`
            : ecEscAttr(s.name);
        const inp = 'padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.75rem;';
        // 主件/配件/批量件切换（固定成本项不可选角色）
        const roleCell = fixed
            ? '<span style="font-size:0.7rem;color:var(--text-dim);">—</span>'
            : `<select onchange="crSetRole(${i}, this.value)" style="${inp}">
                  <option value="main"${(s.role!=='accessory'&&s.role!=='batch')?' selected':''}>主件</option>
                  <option value="accessory"${s.role==='accessory'?' selected':''}>配件</option>
                  <option value="batch"${s.role==='batch'?' selected':''}>批量件</option>
               </select>`;
        return `<tr style="border-bottom:1px solid var(--border);font-size:0.75rem;${rowBg}">
            <td style="padding:6px 8px;">${ecEscAttr(s.skuOuterId)}</td>
            <td style="padding:6px 8px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nameCell}</td>
            <td style="padding:6px 8px;">${roleCell}</td>
            <td style="padding:6px 8px;"><input type="number" min="0" step="0.01" value="${(s.purchasePrice||0).toFixed(2)}" oninput="crEdit(${i},'purchasePrice',this.value)" style="width:74px;${inp}"></td>
            <td style="padding:6px 8px;"><input type="number" min="0" step="0.001" value="${s.weight||0}" oninput="crEdit(${i},'weight',this.value)" style="width:70px;${inp}" placeholder="0"></td>
            <td style="padding:6px 8px;">${isSupplier ? '<span style="color:#16a34a;">代发</span>' : '否'}</td>
            <td style="padding:6px 8px;font-weight:600;"><input type="number" min="0" step="0.01" value="${crRowCost(s).toFixed(2)}" oninput="crOverride(${i}, this.value)" id="crCost_${i}" style="width:80px;${inp}"></td>
        </tr>`;
    }).join('');
    const box = document.getElementById('crTableBody');
    if (box) box.innerHTML = rows;
    crUpdateTotal();
}

function crSetRole(idx, role) {
    if (costReviewItems[idx]) costReviewItems[idx].role = role;
}

// 编辑成本价/重量 → 重算材料成本（运费在组合层算，此处不涉及）
function crEdit(idx, field, val) {
    const s = costReviewItems[idx];
    s[field] = parseFloat(val) || 0;
    if (field === 'purchasePrice' && s.overrideCost == null) {
        const cCell = document.getElementById(`crCost_${idx}`);
        if (cCell) cCell.value = crRowCost(s).toFixed(2);
    }
    crUpdateTotal();
}

function crOverride(idx, val) {
    costReviewItems[idx].overrideCost = parseFloat(val) || 0;
    crUpdateTotal();
}

function crUpdateTotal() {
    const total = costReviewItems.reduce((sum, s) => sum + crRowCost(s), 0);
    const el = document.getElementById('crTotalCost');
    if (el) el.textContent = '¥' + total.toFixed(2);
}

function crConfirm() {
    // 架类非代发项：重量必填（运费按组合总重量计算）
    if (erpProductType !== '花洒') {
        const missing = costReviewItems.find(s => s.hasSupplier !== 1 && s.isFixed !== true && (parseFloat(s.weight) || 0) <= 0);
        if (missing) {
            alert(`架类非代发单品「${missing.name}」重量为空，请填写重量后再继续（运费按组合总重量计算）。`);
            return;
        }
    }
    lstSkuItems = costReviewItems.map(s => ({
        name:        s.name || s.skuOuterId,
        imgDir:      '',
        groupPrice:  0,
        singlePrice: 0,
        stock:       8888,
        itemCode:    s.skuOuterId,
        cost:        crRowCost(s),       // 材料价（不含运费）
        weight:      parseFloat(s.weight) || 0,
        hasSupplier: s.hasSupplier === 1 ? 1 : 0,
        isFixed:     s.isFixed === true,
        role:        s.isFixed ? 'fixed' : (s.role || 'main')
    }));
    lstRenderSkuList();
    document.getElementById('lstPreview').style.display = 'block';
    closeCostReviewModal();
    openSkuPlanModal();
}

// ── 成本录入面板 ──

let costSkus = [];

function openCostModal(skus) {
    costSkus = skus.map(s => ({ ...s, cost: 0 }));
    const rows = costSkus.map((s, i) => `
        <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:7px 10px;font-size:0.76rem;">${ecEscAttr(s.itemCode)}</td>
            <td style="padding:7px 10px;font-size:0.72rem;color:var(--text-dim);">${ecEscAttr(s.productName||'')}</td>
            <td style="padding:7px 10px;">
                <input type="number" min="0" step="0.01" placeholder="0.00"
                    oninput="costSkus[${i}].cost=parseFloat(this.value)||0"
                    style="width:90px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;font-size:0.76rem;">
            </td>
        </tr>`).join('');
    document.getElementById('costTableBody').innerHTML = rows;
    document.getElementById('costModal')?.classList.add('show');
}

function closeCostModal() { document.getElementById('costModal')?.classList.remove('show'); }

function costConfirm() {
    if (costSkus.some(s => !s.cost || s.cost <= 0)) {
        if (!confirm('部分 SKU 成本为 0，确认继续？')) return;
    }
    closeErpModal();
    closeCostModal();
    // 直接传给 AI 生成方案
    lstSkuItems = costSkus.map(s => ({
        name: s.itemCode, imgDir: '', groupPrice: 0, singlePrice: 0,
        stock: 8888, itemCode: s.itemCode, cost: s.cost
    }));
    lstRenderSkuList();
    document.getElementById('lstPreview').style.display = 'block';
    openSkuPlanModal();
}

// ── 快麦 ERP 设置（添加到帮助 modal 中通过单独函数控制）──

async function erpLoadConfig() {
    try {
        const resp = await fetch('/api/erp/config');
        const data = await resp.json();
        const el = document.getElementById('erpConfigAppKey');
        if (el) el.textContent = data.appKey || '';
        const at = document.getElementById('erpConfigAccessToken');
        if (at) at.value = data.accessToken || '';
    } catch (_) {}
}

async function erpSaveConfig() {
    const accessToken  = document.getElementById('erpConfigAccessToken')?.value.trim();
    const refreshToken = document.getElementById('erpConfigRefreshToken')?.value.trim();
    if (!accessToken) { alert('请填写 accessToken'); return; }
    try {
        await fetch('/api/erp/config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken, refreshToken })
        });
        alert('保存成功');
    } catch (e) { alert('保存失败：' + e.message); }
}

async function erpRefreshToken() {
    const btn = document.getElementById('erpRefreshBtn');
    if (btn) { btn.disabled = true; btn.textContent = '刷新中...'; }
    try {
        const resp = await fetch('/api/erp/refresh-token', { method: 'POST' });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        alert('Token 刷新成功');
        erpLoadConfig();
    } catch (e) {
        alert('刷新失败：' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '刷新 Token'; }
    }
}

function openErpConfigModal() {
    erpLoadConfig();
    document.getElementById('erpConfigModal')?.classList.add('show');
}

function closeErpConfigModal() {
    document.getElementById('erpConfigModal')?.classList.remove('show');
}
