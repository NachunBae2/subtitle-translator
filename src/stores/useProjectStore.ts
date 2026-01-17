import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TranslatedFile {
  langCode: string;
  fileCode: string; // [ENG], [CHN], etc.
  content: string;
  completedAt: string;
}

// GPT 감성 분석 결과
export interface SentimentScore {
  chunkIndex: number;
  score: number;  // 0 ~ 100 (GPT 2단계 평가)
  label: 'positive' | 'neutral' | 'negative' | 'very_negative';
  summary: string;
}

// AI 콘텐츠 요약
export interface ContentSummary {
  summary: string;
  topics: string[];
  analyzedAt: string;
}

// 시뮬레이션 댓글
export interface SimulatedComment {
  id: string;
  country: string;
  countryFlag: string;
  countryName: string;
  username: string;
  comment: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  likes: number;
}

export interface Project {
  id: string;
  name: string; // 원본 파일명에서 추출
  createdAt: string;
  koreanSRT: string;
  englishSRT: string | null;
  englishReviewed: boolean;
  translations: TranslatedFile[];
  status: 'translating' | 'reviewing' | 'multilang' | 'completed';
  boundFolder: string | null; // 바인딩된 폴더 경로
  // AI 분석 결과
  sentimentScores?: SentimentScore[];
  contentSummary?: ContentSummary;
  simulatedComments?: SimulatedComment[];
}

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;

  // Actions
  createProject: (name: string, koreanSRT: string) => string;
  setEnglishSRT: (projectId: string, englishSRT: string) => void;
  markEnglishReviewed: (projectId: string) => void;
  addTranslation: (projectId: string, translation: TranslatedFile) => void;
  setProjectStatus: (projectId: string, status: Project['status']) => void;
  setCurrentProject: (projectId: string | null) => void;
  getCurrentProject: () => Project | null;
  deleteProject: (projectId: string) => void;
  clearAllProjects: () => void;

  // Folder binding
  bindFolder: (projectId: string, folderPath: string) => void;
  unbindFolder: (projectId: string) => void;
  updateProjectName: (projectId: string, name: string) => void;

  // Translation management
  clearTranslations: (projectId: string) => void;
  removeTranslation: (projectId: string, langCode: string) => void;

  // AI Analysis
  setSentimentScores: (projectId: string, scores: SentimentScore[]) => void;
  setContentSummary: (projectId: string, summary: ContentSummary) => void;
  setSimulatedComments: (projectId: string, comments: SimulatedComment[]) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,

      createProject: (name, koreanSRT) => {
        const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const project: Project = {
          id,
          name,
          createdAt: new Date().toISOString(),
          koreanSRT,
          englishSRT: null,
          englishReviewed: false,
          translations: [],
          status: 'translating',
          boundFolder: null,
        };
        set((state) => ({
          projects: [project, ...state.projects],
          currentProjectId: id,
        }));
        return id;
      },

      setEnglishSRT: (projectId, englishSRT) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, englishSRT, status: 'reviewing' as const }
              : p
          ),
        }));
      },

      markEnglishReviewed: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, englishReviewed: true, status: 'multilang' as const }
              : p
          ),
        }));
      },

      addTranslation: (projectId, translation) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, translations: [...p.translations, translation] }
              : p
          ),
        }));
      },

      setProjectStatus: (projectId, status) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, status } : p
          ),
        }));
      },

      setCurrentProject: (projectId) => {
        set({ currentProjectId: projectId });
      },

      getCurrentProject: () => {
        const { projects, currentProjectId } = get();
        if (!currentProjectId) return null;
        return projects.find((p) => p.id === currentProjectId) || null;
      },

      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          currentProjectId:
            state.currentProjectId === projectId ? null : state.currentProjectId,
        }));
      },

      clearAllProjects: () => {
        set({ projects: [], currentProjectId: null });
      },

      bindFolder: (projectId, folderPath) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, boundFolder: folderPath } : p
          ),
        }));
      },

      unbindFolder: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, boundFolder: null } : p
          ),
        }));
      },

      updateProjectName: (projectId, name) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, name } : p
          ),
        }));
      },

      clearTranslations: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, translations: [] } : p
          ),
        }));
      },

      removeTranslation: (projectId, langCode) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, translations: p.translations.filter((t) => t.langCode !== langCode) }
              : p
          ),
        }));
      },

      setSentimentScores: (projectId, scores) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, sentimentScores: scores } : p
          ),
        }));
      },

      setContentSummary: (projectId, summary) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, contentSummary: summary } : p
          ),
        }));
      },

      setSimulatedComments: (projectId, comments) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, simulatedComments: comments } : p
          ),
        }));
      },
    }),
    {
      name: 'subtitle-translator-projects',
    }
  )
);
