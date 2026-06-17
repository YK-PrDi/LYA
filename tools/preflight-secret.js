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
const k = (s.IMG_KEYS || '').trim();
const bad = [];
if (!s.IMG_PROVIDER) bad.push('IMG_PROVIDER 为空');
if (!s.IMG_MODEL) bad.push('IMG_MODEL 为空');
if (!k) bad.push('IMG_KEYS 为空');
if (k.indexOf('在这里填') >= 0 || k.indexOf('your') >= 0 || k.indexOf('xxxx') >= 0) {
    bad.push('IMG_KEYS 还是占位符，未填真实密钥');
}
if (bad.length) {
    console.error('  [ERROR] secret.js 配置有问题：');
    bad.forEach(b => console.error('   - ' + b));
    process.exit(1);
}
console.log('        provider=' + s.IMG_PROVIDER + '  model=' + s.IMG_MODEL +
            '  key=' + k.slice(0, 4) + '...(' + k.length + '位)  OK');
