const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // 개발 모드면 localhost, 아니면 빌드된 파일
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3003');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC: 폴더 선택
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: '저장할 폴더 선택',
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: 파일 저장
ipcMain.handle('save-file', async (event, { folderPath, fileName, content }) => {
  try {
    const filePath = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 여러 파일 저장
ipcMain.handle('save-files', async (event, { folderPath, files }) => {
  try {
    const results = [];
    for (const file of files) {
      const filePath = path.join(folderPath, file.fileName);
      fs.writeFileSync(filePath, file.content, 'utf-8');
      results.push({ fileName: file.fileName, path: filePath });
    }
    return { success: true, files: results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 폴더 존재 확인 및 생성
ipcMain.handle('ensure-folder', async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
