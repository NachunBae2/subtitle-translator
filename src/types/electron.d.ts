export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  saveFile: (folderPath: string, fileName: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  saveFiles: (folderPath: string, files: { fileName: string; content: string }[]) => Promise<{ success: boolean; files?: { fileName: string; path: string }[]; error?: string }>;
  ensureFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  checkFilesExist: (folderPath: string, fileNames: string[]) => Promise<{ success: boolean; existingFiles: string[]; error?: string }>;
  deleteFile: (folderPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  listFolderFiles: (folderPath: string) => Promise<{ success: boolean; files: string[]; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
