// 仅暴露需要的 IPC 通道；contextIsolation:true 下渲染层只能看到 window.electronAPI.* 这一组白名单。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 让前端 settings modal 的 📁 浏览按钮弹出系统目录选择框
    pickDir: (defaultPath) => ipcRenderer.invoke('pick-dir', defaultPath || ''),
});
