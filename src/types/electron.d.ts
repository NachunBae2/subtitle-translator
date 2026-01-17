export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  saveFile: (folderPath: string, fileName: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  saveFiles: (folderPath: string, files: { fileName: string; content: string }[]) => Promise<{ success: boolean; files?: { fileName: string; path: string }[]; error?: string }>;
  ensureFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
