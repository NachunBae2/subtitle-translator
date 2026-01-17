import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Tab = 'dashboard' | 'settings' | 'translate' | 'review' | 'multilang' | 'history' | 'feedback' | 'terminology' | 'meme';
export type Status = 'idle' | 'processing' | 'success' | 'error' | 'warning';

interface AppState {
  // Navigation
  activeTab: Tab;

  // Status
  status: Status;
  statusMessage: string;
  progress: number;
  currentLang: string;
  error: string | null;

  // Translation state (전역 - 탭 이동해도 유지)
  isTranslating: boolean;
  isMultiLangTranslating: boolean;

  // Cancel state
  abortController: AbortController | null;

  // Actions
  setActiveTab: (tab: Tab) => void;
  setStatus: (status: Status, message?: string) => void;
  setProgress: (progress: number, lang?: string) => void;
  setError: (error: string | null) => void;
  setIsTranslating: (isTranslating: boolean) => void;
  setIsMultiLangTranslating: (isMultiLangTranslating: boolean) => void;
  createAbortController: () => AbortController;
  cancelTranslation: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeTab: 'settings',
      status: 'idle',
      statusMessage: '',
      progress: 0,
      currentLang: '',
      error: null,
      isTranslating: false,
      isMultiLangTranslating: false,
      abortController: null,

      setActiveTab: (activeTab) => set({ activeTab }),

      setStatus: (status, message = '') =>
        set({ status, statusMessage: message }),

      setProgress: (progress, lang = '') =>
        set({ progress, currentLang: lang }),

      setError: (error) => set({ error }),

      setIsTranslating: (isTranslating) => set({ isTranslating }),

      setIsMultiLangTranslating: (isMultiLangTranslating) => set({ isMultiLangTranslating }),

      createAbortController: () => {
        const controller = new AbortController();
        set({ abortController: controller });
        return controller;
      },

      cancelTranslation: () => {
        const { abortController } = get();
        if (abortController) {
          abortController.abort();
          set({
            abortController: null,
            isTranslating: false,
            isMultiLangTranslating: false,
            status: 'idle',
            statusMessage: '번역이 취소되었습니다.',
            progress: 0,
          });
        }
      },

      reset: () =>
        set({
          status: 'idle',
          statusMessage: '',
          progress: 0,
          currentLang: '',
          error: null,
          isTranslating: false,
          isMultiLangTranslating: false,
          abortController: null,
        }),
    }),
    {
      name: 'subtitle-app-storage',
      partialize: (state) => ({ activeTab: state.activeTab }),
    }
  )
);
