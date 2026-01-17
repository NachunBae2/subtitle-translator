const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 폴더 선택 다이얼로그
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // 단일 파일 저장
  saveFile: (folderPath, fileName, content) =>
    ipcRenderer.invoke('save-file', { folderPath, fileName, content }),

  // 여러 파일 저장
  saveFiles: (folderPath, files) =>
    ipcRenderer.invoke('save-files', { folderPath, files }),

  // 폴더 생성
  ensureFolder: (folderPath) =>
    ipcRenderer.invoke('ensure-folder', folderPath),
});
