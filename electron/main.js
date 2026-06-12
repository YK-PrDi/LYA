const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
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
            IMG_PROXY_HOST: secret.IMG_PROXY_HOST || '',
            IMG_PROXY_PORT: secret.IMG_PROXY_PORT || '',
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
    await startJava();
    try { await waitForServer(); } catch (e) { console.error(e.message); }
    createMain();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMain(); });
});

app.on('window-all-closed', () => {
    if (javaProcess) try { javaProcess.kill(); } catch (_) {}
    if (process.platform !== 'darwin') app.quit();
});
