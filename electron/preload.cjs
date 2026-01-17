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

  // 파일 존재 확인 (여러 파일)
  checkFilesExist: (folderPath, fileNames) =>
    ipcRenderer.invoke('check-files-exist', { folderPath, fileNames }),

  // 파일 삭제
  deleteFile: (folderPath, fileName) =>
    ipcRenderer.invoke('delete-file', { folderPath, fileName }),

  // 폴더 내 파일 목록
  listFolderFiles: (folderPath) =>
    ipcRenderer.invoke('list-folder-files', folderPath),
});
