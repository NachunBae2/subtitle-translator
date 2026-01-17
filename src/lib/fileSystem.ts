// Electron 환경 체크
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI;
};

// 폴더 선택 다이얼로그
export const selectFolder = async (): Promise<string | null> => {
  if (!isElectron()) {
    console.warn('Not in Electron environment');
    return null;
  }
  return window.electronAPI!.selectFolder();
};

// 단일 파일 저장
export const saveFile = async (
  folderPath: string,
  fileName: string,
  content: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  if (!isElectron()) {
    // 브라우저 fallback: 다운로드
    downloadFile(content, fileName);
    return { success: true };
  }
  return window.electronAPI!.saveFile(folderPath, fileName, content);
};

// 여러 파일 저장
export const saveFiles = async (
  folderPath: string,
  files: { fileName: string; content: string }[]
): Promise<{ success: boolean; count?: number; error?: string }> => {
  if (!isElectron()) {
    // 브라우저 fallback: 다운로드
    files.forEach((f) => downloadFile(f.content, f.fileName));
    return { success: true, count: files.length };
  }
  const result = await window.electronAPI!.saveFiles(folderPath, files);
  return { success: result.success, count: result.files?.length, error: result.error };
};

// 브라우저용 다운로드 (fallback)
export const downloadFile = (content: string, fileName: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 파일 존재 확인 (여러 파일)
export const checkFilesExist = async (
  folderPath: string,
  fileNames: string[]
): Promise<{ success: boolean; existingFiles: string[]; error?: string }> => {
  if (!isElectron()) {
    return { success: true, existingFiles: [] };
  }
  return window.electronAPI!.checkFilesExist(folderPath, fileNames);
};

// 파일 삭제
export const deleteFile = async (
  folderPath: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isElectron()) {
    console.warn('Not in Electron environment');
    return { success: false, error: 'Not in Electron environment' };
  }
  return window.electronAPI!.deleteFile(folderPath, fileName);
};

// 폴더 내 파일 목록
export const listFolderFiles = async (
  folderPath: string
): Promise<{ success: boolean; files: string[]; error?: string }> => {
  if (!isElectron()) {
    return { success: true, files: [] };
  }
  return window.electronAPI!.listFolderFiles(folderPath);
};

// 폴더 생성
export const ensureFolder = async (
  folderPath: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isElectron()) {
    return { success: true };
  }
  return window.electronAPI!.ensureFolder(folderPath);
};

// 파일 이름 변경
export const renameFile = async (
  folderPath: string,
  oldFileName: string,
  newFileName: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isElectron()) {
    return { success: false, error: 'Not in Electron environment' };
  }
  return window.electronAPI!.renameFile(folderPath, oldFileName, newFileName);
};

// 여러 파일 이름 일괄 변경
export const renameFilesBatch = async (
  folderPath: string,
  renames: { oldFileName: string; newFileName: string }[]
): Promise<{ success: boolean; results?: { oldFileName: string; newFileName: string; success: boolean }[]; error?: string }> => {
  if (!isElectron()) {
    return { success: false, error: 'Not in Electron environment' };
  }
  return window.electronAPI!.renameFilesBatch(folderPath, renames);
};
