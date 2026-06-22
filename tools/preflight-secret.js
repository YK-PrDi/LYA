// 打包前预检 electron/secret.js 生图配置。
// 独立成文件，避免在 .bat 里用 node -e 时 > | 等字符被 cmd 误解析。
// 退出码：0 通过；1 配置有问题（build-dist.bat 据此中止）。
let s;
try {
    s = require('../electron/secret.js');
} catch (e) {
    console.error('  [ERROR] 无法读取 electron/secret.js：' + e.message);
    process.exit(1);
}
const provider = (s.IMG_PROVIDER || '').trim().toLowerCase();
const bad = [];
if (!s.IMG_PROVIDER) bad.push('IMG_PROVIDER 为空');
if (!s.IMG_MODEL) bad.push('IMG_MODEL 为空');

// 生图密钥：gemini 用 IMG_KEYS；openai(gpt-image) 用 GPT_IMAGE_KEY_1..4
let keyInfo = '';
if (provider === 'openai') {
    const ak = [s.GPT_IMAGE_KEY_1, s.GPT_IMAGE_KEY_2, s.GPT_IMAGE_KEY_3, s.GPT_IMAGE_KEY_4]
        .map(x => (x || '').trim()).filter(Boolean);
    if (!ak.length) bad.push('provider=openai 但 GPT_IMAGE_KEY_1..4 全为空');
    keyInfo = ak.length + ' 个 gpt-image key';
} else {
    const k = (s.IMG_KEYS || '').trim();
    if (!k) bad.push('IMG_KEYS 为空');
    if (k.indexOf('在这里填') >= 0 || k.indexOf('your') >= 0 || k.indexOf('xxxx') >= 0) {
        bad.push('IMG_KEYS 还是占位符，未填真实密钥');
    }
    keyInfo = 'key=' + k.slice(0, 4) + '...(' + k.length + '位)';
}

// 标题生成密钥
const tk = (s.TEXT_API_KEY || '').trim();
if (!tk) bad.push('TEXT_API_KEY 为空（标题生成需要）');

if (bad.length) {
    console.error('  [ERROR] secret.js 配置有问题：');
    bad.forEach(b => console.error('   - ' + b));
    process.exit(1);
}
console.log('        provider=' + s.IMG_PROVIDER + '  model=' + s.IMG_MODEL +
            '  ' + keyInfo + '  text=' + (s.TEXT_MODEL || '?') + '  OK');
