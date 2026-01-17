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
