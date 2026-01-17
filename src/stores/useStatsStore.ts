import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TranslationStats, Badge, DEFAULT_STATS } from '../types/channel';

interface StatsState {
  stats: TranslationStats;

  // Actions
  addTranslation: (sentences: number, words: number, langCode?: string) => void;
  checkAndUnlockBadges: () => Badge[];
  resetStats: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      stats: DEFAULT_STATS,

      addTranslation: (sentences, words, langCode) => {
        const today = new Date().toISOString().split('T')[0];

        set((state) => {
          const newStats = { ...state.stats };
          newStats.totalSubtitles += 1;
          newStats.totalSentences += sentences;
          newStats.totalWords += words;
          newStats.lastTranslationDate = today;

          // 언어 분포
          if (langCode) {
            newStats.languageDistribution[langCode] =
              (newStats.languageDistribution[langCode] || 0) + 1;
          }

          // 일별 활동
          newStats.dailyActivity[today] =
            (newStats.dailyActivity[today] || 0) + 1;

          // 절약 시간 (문장당 평균 30초 가정)
          newStats.estimatedTimeSaved += Math.round(sentences * 0.5);

          return { stats: newStats };
        });

        // 뱃지 체크
        get().checkAndUnlockBadges();
      },

      checkAndUnlockBadges: () => {
        const { stats } = get();
        const unlockedBadges: Badge[] = [];
        const now = new Date();

        // 연속 일수 계산
        const dates = Object.keys(stats.dailyActivity).sort().reverse();
        let streak = 0;
        for (let i = 0; i < dates.length; i++) {
          const expected = new Date(now);
          expected.setDate(expected.getDate() - i);
          const expectedStr = expected.toISOString().split('T')[0];
          if (dates[i] === expectedStr) {
            streak++;
          } else {
            break;
          }
        }

        set((state) => {
          const newBadges = state.stats.badges.map((badge) => {
            if (badge.unlockedAt) return badge;

            let shouldUnlock = false;
            switch (badge.id) {
              case 'first-translation':
                shouldUnlock = stats.totalSubtitles >= 1;
                break;
              case 'multilang-first':
                shouldUnlock = Object.keys(stats.languageDistribution).length > 1;
                break;
              case 'sentences-100':
                shouldUnlock = stats.totalSentences >= 100;
                break;
              case 'sentences-500':
                shouldUnlock = stats.totalSentences >= 500;
                break;
              case 'sentences-1000':
                shouldUnlock = stats.totalSentences >= 1000;
                break;
              case 'streak-3':
                shouldUnlock = streak >= 3;
                break;
              case 'streak-7':
                shouldUnlock = streak >= 7;
                break;
              case 'streak-30':
                shouldUnlock = streak >= 30;
                break;
              case 'files-10':
                shouldUnlock = stats.totalSubtitles >= 10;
                break;
              case 'files-50':
                shouldUnlock = stats.totalSubtitles >= 50;
                break;
            }

            if (shouldUnlock) {
              const unlockedBadge = { ...badge, unlockedAt: now };
              unlockedBadges.push(unlockedBadge);
              return unlockedBadge;
            }
            return badge;
          });

          return { stats: { ...state.stats, badges: newBadges } };
        });

        return unlockedBadges;
      },

      resetStats: () => set({ stats: DEFAULT_STATS }),
    }),
    {
      name: 'subtitle-translator-stats',
    }
  )
);
