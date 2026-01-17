import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 기본 모델 (한→영): 빠른 모델
export type Model = 'gpt-4.1-nano' | 'gpt-4.1-mini' | 'gpt-4.1' | 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5' | 'gpt-5.1' | 'gpt-5.2';
// 다국어 모델 (영→다국어): 고품질 모델
export type MultiLangModel = 'gpt-4.1-nano' | 'gpt-4.1-mini' | 'gpt-4.1' | 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5' | 'gpt-5.1' | 'gpt-5.2';

// 채널 정보 (새로운 범용 구조)
export interface ChannelInfo {
  genre: string;           // 유튜브 장르 (예: 뜨개질, 요리, 게임)
  targetAudience: string;  // 시청자 대상 (예: 초보자, 전문가)
  description: string;     // 자유 기술
}

interface SettingsState {
  apiKey: string;
  model: Model;
  multiLangModel: MultiLangModel;  // 다국어 번역용 모델
  outputFolder: string; // 저장 폴더 경로

  // 채널 정보 (범용)
  channelInfo: ChannelInfo;
  customSystemPrompt: string;  // GPT가 생성하거나 사용자가 수정한 시스템 프롬프트

  // AI 분석 옵션
  enableSentimentAnalysis: boolean;  // 감성분석 활성화 여부
  enableContentSummary: boolean;     // AI 요약 활성화 여부

  // Actions
  setApiKey: (key: string) => void;
  setModel: (model: Model) => void;
  setMultiLangModel: (model: MultiLangModel) => void;
  setOutputFolder: (folder: string) => void;
  setChannelInfo: (info: Partial<ChannelInfo>) => void;
  setCustomSystemPrompt: (prompt: string) => void;
  setEnableSentimentAnalysis: (enable: boolean) => void;
  setEnableContentSummary: (enable: boolean) => void;
  isApiKeyValid: () => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKey: '',
      model: 'gpt-4.1-mini',
      multiLangModel: 'gpt-4.1',  // 다국어는 기본적으로 더 좋은 모델 사용
      outputFolder: '',

      // 채널 정보 기본값
      channelInfo: {
        genre: '',
        targetAudience: '',
        description: '',
      },
      customSystemPrompt: '',

      // AI 분석 옵션 기본값
      enableSentimentAnalysis: false,  // 기본 비활성화 (API 비용 절약)
      enableContentSummary: false,

      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setMultiLangModel: (multiLangModel) => set({ multiLangModel }),
      setOutputFolder: (outputFolder) => set({ outputFolder }),
      setChannelInfo: (info) => set((state) => ({
        channelInfo: { ...state.channelInfo, ...info }
      })),
      setCustomSystemPrompt: (customSystemPrompt) => set({ customSystemPrompt }),
      setEnableSentimentAnalysis: (enableSentimentAnalysis) => set({ enableSentimentAnalysis }),
      setEnableContentSummary: (enableContentSummary) => set({ enableContentSummary }),

      isApiKeyValid: () => {
        const { apiKey } = get();
        return apiKey.startsWith('sk-') && apiKey.length > 20;
      },
    }),
    {
      name: 'subtitle-translator-settings',
    }
  )
);
