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

// IPC: 파일 존재 확인 (여러 파일)
ipcMain.handle('check-files-exist', async (event, { folderPath, fileNames }) => {
  try {
    const existingFiles = [];
    for (const fileName of fileNames) {
      const filePath = path.join(folderPath, fileName);
      if (fs.existsSync(filePath)) {
        existingFiles.push(fileName);
      }
    }
    return { success: true, existingFiles };
  } catch (error) {
    return { success: false, error: error.message, existingFiles: [] };
  }
});

// IPC: 파일 삭제
ipcMain.handle('delete-file', async (event, { folderPath, fileName }) => {
  try {
    const filePath = path.join(folderPath, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: '파일이 존재하지 않습니다.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 폴더 내 파일 목록
ipcMain.handle('list-folder-files', async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      return { success: true, files: [] };
    }
    const files = fs.readdirSync(folderPath).filter(file => {
      const filePath = path.join(folderPath, file);
      return fs.statSync(filePath).isFile();
    });
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message, files: [] };
  }
});

// IPC: 파일 이름 변경
ipcMain.handle('rename-file', async (event, { folderPath, oldFileName, newFileName }) => {
  try {
    const oldPath = path.join(folderPath, oldFileName);
    const newPath = path.join(folderPath, newFileName);
    if (!fs.existsSync(oldPath)) {
      return { success: false, error: '원본 파일이 존재하지 않습니다.' };
    }
    if (fs.existsSync(newPath)) {
      return { success: false, error: '같은 이름의 파일이 이미 존재합니다.' };
    }
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 여러 파일 이름 일괄 변경 (프로젝트명 변경 시)
ipcMain.handle('rename-files-batch', async (event, { folderPath, renames }) => {
  try {
    const results = [];
    for (const { oldFileName, newFileName } of renames) {
      const oldPath = path.join(folderPath, oldFileName);
      const newPath = path.join(folderPath, newFileName);
      if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        results.push({ oldFileName, newFileName, success: true });
      } else {
        results.push({ oldFileName, newFileName, success: false });
      }
    }
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
