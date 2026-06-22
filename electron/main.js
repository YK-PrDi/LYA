const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const http = require('http');
const fs   = require('fs');

const PORT    = 5021;
const APP_URL = `http://localhost:${PORT}`;

// 密钥（不进 git）；缺失时降级为空，避免 clone 后崩溃
let secret = {};
try { secret = require('./secret'); } catch (_) { console.warn('未找到 electron/secret.js，AI 相关功能将不可用'); }

let mainWindow  = null;
let javaProcess = null;

function res(...parts) {
    const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'dist');
    return path.join(base, ...parts);
}

/**
 * 启动自检：Chromium/Java 依赖 VC++ 运行库（缺则 0xC0000135 崩溃）。
 * 检测缺失 → 用随包带的 vc_redist.x64.exe 静默安装 → 装完删掉安装器省空间。
 * 仅 Windows、仅打包态执行；失败不阻断启动（最坏退回原报错）。
 */
async function ensureVcRuntime() {
    if (process.platform !== 'win32' || !app.isPackaged) return;
    // 检测：System32 下有 vcruntime140.dll 即视为已装
    const sys32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
    const installed = fs.existsSync(path.join(sys32, 'vcruntime140.dll'))
                   && fs.existsSync(path.join(sys32, 'vcruntime140_1.dll'));
    if (installed) return;
    const installer = res('vc_redist.x64.exe');
    if (!fs.existsSync(installer)) { console.warn('缺 VC++ 运行库且未随包带安装器，跳过'); return; }
    try {
        const win = new BrowserWindow({ width: 420, height: 160, resizable: false, title: '首次运行环境配置',
            webPreferences: { nodeIntegration: false } });
        win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
            '<body style="font-family:Microsoft YaHei;padding:24px;color:#333;">正在安装运行环境（VC++ 运行库），请稍候，可能需要管理员授权…</body>'));
        // 静默安装（/install /quiet /norestart）；需要管理员权限会弹 UAC
        execFileSync(installer, ['/install', '/quiet', '/norestart'], { timeout: 180000 });
        try { win.close(); } catch (_) {}
        // 装完删掉安装器省空间
        try { fs.unlinkSync(installer); } catch (_) {}
        console.log('VC++ 运行库安装完成');
    } catch (e) {
        // exitCode 3010=需重启完成、1638=已装更高版本，都视为成功
        const code = e && e.status;
        if (code === 3010 || code === 1638 || code === 0) {
            try { fs.unlinkSync(installer); } catch (_) {}
        } else {
            console.error('VC++ 运行库安装失败:', e.message);
            try {
                dialog.showMessageBoxSync({ type: 'warning', title: '环境提示',
                    message: '运行环境（VC++ 运行库）未能自动安装。\n若软件无法生成图片或打开浏览器，请手动安装：\n' + installer });
            } catch (_) {}
        }
    }
}

function prefFile() { return path.join(app.getPath('userData'), 'pref.json'); }
function loadDataDir() {
    try { return (JSON.parse(fs.readFileSync(prefFile(), 'utf8')) || {}).dataDir || null; }
    catch (_) { return null; }
}
function saveDataDir(dataDir) {
    try {
        fs.mkdirSync(path.dirname(prefFile()), { recursive: true });
        fs.writeFileSync(prefFile(), JSON.stringify({ dataDir }), 'utf8');
    } catch (_) {}
}

async function pickDataDir() {
    const r = await dialog.showOpenDialog({
        title: '请选择数据存储目录',
        message: 'cookies 和配置将存储在此文件夹',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: '选择此文件夹',
    });
    if (r.canceled || !r.filePaths.length) { app.quit(); return null; }
    const dir = r.filePaths[0];
    saveDataDir(dir);
    return dir;
}

// ── 启动 Spring Boot（仅打包态；开发态请先手动 mvn spring-boot:run） ──
async function startJava() {
    if (!app.isPackaged) return; // 开发态：假定 Spring Boot 已在 5021 跑着
    const javaExe = res('runtime', 'bin', 'java.exe');
    const jarPath = res('app.jar');
    let dataDir = loadDataDir() || await pickDataDir();
    if (!dataDir) return;
    const jvmArgs = [
        `-Dspring.web.resources.static-locations=file:${res('frontend').replace(/\\/g, '/')}/`,
        `-Dapp.paths.user-data-dir=${dataDir.replace(/\\/g, '/')}`,
        `-Dapp.resources-path=${process.resourcesPath.replace(/\\/g, '/')}`,
        '-jar', jarPath
    ];
    javaProcess = spawn(javaExe, jvmArgs, {
        cwd: dataDir,
        stdio: 'ignore',
        windowsHide: true,
        env: {
            ...process.env,
            VOLCENGINE_API_KEY: secret.VOLCENGINE_API_KEY || '',
            IMG_PROVIDER: secret.IMG_PROVIDER || '',
            IMG_BASE_URL: secret.IMG_BASE_URL || '',
            IMG_MODEL: secret.IMG_MODEL || '',
            IMG_KEYS: secret.IMG_KEYS || '',
            GPT_IMAGE_KEY_1: secret.GPT_IMAGE_KEY_1 || '',
            GPT_IMAGE_KEY_2: secret.GPT_IMAGE_KEY_2 || '',
            GPT_IMAGE_KEY_3: secret.GPT_IMAGE_KEY_3 || '',
            GPT_IMAGE_KEY_4: secret.GPT_IMAGE_KEY_4 || '',
            IMG_PROXY_HOST: secret.IMG_PROXY_HOST || '',
            IMG_PROXY_PORT: secret.IMG_PROXY_PORT || '',
            TEXT_BASE_URL: secret.TEXT_BASE_URL || '',
            TEXT_MODEL: secret.TEXT_MODEL || '',
            TEXT_API_KEY: secret.TEXT_API_KEY || '',
        },
    });
    javaProcess.on('error', err => console.error('Java 启动失败:', err.message));
}

function waitForServer(timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const check = () => {
            const req = http.get(APP_URL, r => { r.resume(); resolve(); });
            req.on('error', () => {
                if (Date.now() > deadline) return reject(new Error('服务启动超时'));
                setTimeout(check, 800);
            });
            req.setTimeout(1500, () => req.destroy());
        };
        check();
    });
}

function createMain() {
    mainWindow = new BrowserWindow({
        width: 1100, height: 860, minWidth: 720, minHeight: 600,
        title: '乐羽', show: false, backgroundColor: '#F8FAFC',
        webPreferences: {
            nodeIntegration: false, contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    mainWindow.loadURL(APP_URL);
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = null; });
}

// pickDir IPC：前端文件夹选择
ipcMain.handle('pick-dir', async (_e, defaultPath) => {
    const r = await dialog.showOpenDialog(mainWindow, {
        title: '选择文件夹',
        defaultPath: defaultPath || undefined,
        properties: ['openDirectory'],
    });
    return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    await ensureVcRuntime();   // 首次运行自检/安装 VC++ 运行库（缺则 Chromium/Java 崩溃）
    await startJava();
    try { await waitForServer(); } catch (e) { console.error(e.message); }
    createMain();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMain(); });
});

app.on('window-all-closed', () => {
    if (javaProcess) try { javaProcess.kill(); } catch (_) {}
    if (process.platform !== 'darwin') app.quit();
});
