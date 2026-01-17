/**
 * 자막 분석 유틸리티
 * - 시간 분석 (자막 길이, 간격)
 * - 단어 빈도 분석 (워드클라우드용)
 * - 대화 패턴 분석
 */

export interface SubtitleBlock {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
}

export interface TimeAnalysis {
  totalDuration: number; // 전체 영상 길이 (초)
  avgSubtitleDuration: number; // 평균 자막 표시 시간 (초)
  shortSubtitles: number; // 1초 미만 자막 수
  mediumSubtitles: number; // 1-3초 자막 수
  longSubtitles: number; // 3초 이상 자막 수
  durationDistribution: { range: string; count: number }[];
}

export interface GapAnalysis {
  avgGap: number; // 평균 자막 간격 (초)
  quickResponses: number; // 0.5초 미만 간격 (빠른 대화)
  normalGaps: number; // 0.5-2초 간격
  longPauses: number; // 2초 이상 간격 (긴 침묵)
  gapDistribution: { range: string; count: number }[];
}

export interface WordFrequency {
  word: string;
  count: number;
  percentage: number;
}

export interface SentimentAnalysis {
  positive: number; // 긍정 단어 수
  negative: number; // 부정 단어 수
  neutral: number; // 중립 (전체 - 긍정 - 부정)
  score: number; // -1 ~ 1 사이 점수
  dominantMood: 'positive' | 'negative' | 'neutral';
  positiveWords: string[]; // 발견된 긍정 단어
  negativeWords: string[]; // 발견된 부정 단어
}

export interface SubtitleAnalysis {
  blockCount: number;
  totalCharacters: number;
  totalWords: number;
  avgWordsPerBlock: number;
  timeAnalysis: TimeAnalysis;
  gapAnalysis: GapAnalysis;
  topWords: WordFrequency[];
  speakingPace: number; // 분당 단어 수 (WPM)
  sentiment: SentimentAnalysis; // 감성 분석
}

// 시간 문자열을 초로 변환 (00:00:00,000 -> seconds)
export function timeToSeconds(timeStr: string): number {
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  const [, hours, minutes, seconds, ms] = match;
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(ms) / 1000;
}

// 한국어 불용어 (분석에서 제외)
const KOREAN_STOPWORDS = new Set([
  '그', '저', '이', '것', '수', '등', '더', '때', '안', '못', '잘',
  '네', '예', '응', '아', '어', '음', '아니', '뭐', '좀', '막',
  '근데', '그래서', '그런데', '그러면', '그리고', '하지만', '그냥',
  '되게', '진짜', '정말', '완전', '너무', '엄청', '되다', '하다',
  '있다', '없다', '보다', '같다', '되다', '싶다', '알다', '모르다',
]);

// 감성 분석을 위한 단어 사전
const POSITIVE_WORDS = new Set([
  // 긍정 감정
  '좋아', '좋은', '좋다', '좋았', '최고', '대박', '짱', '멋지', '멋진', '멋있',
  '예쁘', '예뻐', '아름다', '사랑', '행복', '기쁘', '즐거', '웃', '감사',
  '고마', '축하', '성공', '완벽', '훌륭', '우수', '뛰어', '칭찬', '응원',
  '화이팅', '파이팅', '힘내', '기대', '설레', '신나', '재미', '재밌',
  // 긍정 표현
  '잘했', '잘한', '잘해', '맛있', '귀여', '귀엽', '사랑스러', '따뜻',
  '포근', '편안', '안심', '든든', '뿌듯', '보람', '만족', '흡족',
  // 영어
  'good', 'great', 'nice', 'love', 'happy', 'awesome', 'amazing', 'wonderful',
  'perfect', 'beautiful', 'excellent', 'fantastic', 'best', 'thank', 'thanks',
]);

const NEGATIVE_WORDS = new Set([
  // 부정 감정
  '싫어', '싫다', '싫은', '나쁘', '나빠', '최악', '별로', '안좋', '못생',
  '짜증', '화나', '분노', '슬프', '슬픔', '우울', '힘들', '어렵', '고통',
  '아프', '아파', '아픔', '무서', '두렵', '걱정', '불안', '스트레스',
  // 부정 표현
  '실패', '실망', '후회', '미안', '죄송', '잘못', '틀렸', '문제', '오류',
  '에러', '버그', '망했', '망함', '끔찍', '지옥', '최저', '쓰레기',
  '짜증나', '미워', '증오', '한심', '멍청', '바보', '못해', '못한',
  // 영어
  'bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'wrong', 'fail',
  'failed', 'error', 'bug', 'problem', 'sorry', 'worried', 'stress',
]);

// 텍스트에서 단어 추출 (한국어 + 영어)
function extractWords(text: string): string[] {
  // 한국어와 영어 단어 추출
  const koreanWords = text.match(/[가-힣]+/g) || [];
  const englishWords = text.match(/[a-zA-Z]+/g) || [];

  return [...koreanWords, ...englishWords]
    .map(w => w.toLowerCase())
    .filter(w => w.length > 1 && !KOREAN_STOPWORDS.has(w));
}

// 자막 시간 분석
export function analyzeTime(blocks: SubtitleBlock[]): TimeAnalysis {
  if (blocks.length === 0) {
    return {
      totalDuration: 0,
      avgSubtitleDuration: 0,
      shortSubtitles: 0,
      mediumSubtitles: 0,
      longSubtitles: 0,
      durationDistribution: [],
    };
  }

  const durations: number[] = [];
  let totalDuration = 0;
  let shortSubtitles = 0;
  let mediumSubtitles = 0;
  let longSubtitles = 0;

  for (const block of blocks) {
    const start = timeToSeconds(block.startTime);
    const end = timeToSeconds(block.endTime);
    const duration = end - start;
    durations.push(duration);

    if (duration < 1) shortSubtitles++;
    else if (duration <= 3) mediumSubtitles++;
    else longSubtitles++;
  }

  // 전체 영상 길이는 마지막 자막의 endTime
  const lastBlock = blocks[blocks.length - 1];
  totalDuration = timeToSeconds(lastBlock.endTime);

  const avgSubtitleDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  // 분포 계산
  const durationDistribution = [
    { range: '< 1초', count: shortSubtitles },
    { range: '1-3초', count: mediumSubtitles },
    { range: '> 3초', count: longSubtitles },
  ];

  return {
    totalDuration,
    avgSubtitleDuration,
    shortSubtitles,
    mediumSubtitles,
    longSubtitles,
    durationDistribution,
  };
}

// 자막 간격 분석 (대화 텀)
export function analyzeGaps(blocks: SubtitleBlock[]): GapAnalysis {
  if (blocks.length < 2) {
    return {
      avgGap: 0,
      quickResponses: 0,
      normalGaps: 0,
      longPauses: 0,
      gapDistribution: [],
    };
  }

  const gaps: number[] = [];
  let quickResponses = 0;
  let normalGaps = 0;
  let longPauses = 0;

  for (let i = 1; i < blocks.length; i++) {
    const prevEnd = timeToSeconds(blocks[i - 1].endTime);
    const currentStart = timeToSeconds(blocks[i].startTime);
    const gap = Math.max(0, currentStart - prevEnd);
    gaps.push(gap);

    if (gap < 0.5) quickResponses++;
    else if (gap <= 2) normalGaps++;
    else longPauses++;
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  const gapDistribution = [
    { range: '빠른 대화 (< 0.5초)', count: quickResponses },
    { range: '보통 (0.5-2초)', count: normalGaps },
    { range: '긴 침묵 (> 2초)', count: longPauses },
  ];

  return {
    avgGap,
    quickResponses,
    normalGaps,
    longPauses,
    gapDistribution,
  };
}

// 단어 빈도 분석
export function analyzeWordFrequency(blocks: SubtitleBlock[], topN: number = 20): WordFrequency[] {
  const wordCount: Record<string, number> = {};
  let totalWords = 0;

  for (const block of blocks) {
    const words = extractWords(block.text);
    for (const word of words) {
      wordCount[word] = (wordCount[word] || 0) + 1;
      totalWords++;
    }
  }

  const sorted = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({
      word,
      count,
      percentage: totalWords > 0 ? (count / totalWords) * 100 : 0,
    }));

  return sorted;
}

// 감성 분석
export function analyzeSentiment(blocks: SubtitleBlock[]): SentimentAnalysis {
  const allText = blocks.map(b => b.text).join(' ');
  const words = allText.split(/\s+/).map(w => w.toLowerCase());

  const foundPositive: string[] = [];
  const foundNegative: string[] = [];

  // 부분 일치 검사 (한국어 어간 매칭)
  for (const word of words) {
    for (const pos of POSITIVE_WORDS) {
      if (word.includes(pos) && !foundPositive.includes(word)) {
        foundPositive.push(word);
        break;
      }
    }
    for (const neg of NEGATIVE_WORDS) {
      if (word.includes(neg) && !foundNegative.includes(word)) {
        foundNegative.push(word);
        break;
      }
    }
  }

  const positive = foundPositive.length;
  const negative = foundNegative.length;
  const total = words.length;
  const neutral = total - positive - negative;

  // 점수 계산 (-1 ~ 1)
  const score = total > 0 ? (positive - negative) / Math.max(positive + negative, 1) : 0;

  // 주요 감성 판단
  let dominantMood: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.2) dominantMood = 'positive';
  else if (score < -0.2) dominantMood = 'negative';

  return {
    positive,
    negative,
    neutral,
    score,
    dominantMood,
    positiveWords: [...new Set(foundPositive)].slice(0, 10),
    negativeWords: [...new Set(foundNegative)].slice(0, 10),
  };
}

// 전체 분석
export function analyzeSubtitles(blocks: SubtitleBlock[]): SubtitleAnalysis {
  const totalCharacters = blocks.reduce((sum, b) => sum + b.text.length, 0);
  const allWords = blocks.flatMap(b => extractWords(b.text));
  const totalWords = allWords.length;
  const avgWordsPerBlock = blocks.length > 0 ? totalWords / blocks.length : 0;

  const timeAnalysis = analyzeTime(blocks);
  const gapAnalysis = analyzeGaps(blocks);
  const topWords = analyzeWordFrequency(blocks);
  const sentiment = analyzeSentiment(blocks);

  // 분당 단어 수 (Speaking pace)
  const speakingPace = timeAnalysis.totalDuration > 0
    ? (totalWords / timeAnalysis.totalDuration) * 60
    : 0;

  return {
    blockCount: blocks.length,
    totalCharacters,
    totalWords,
    avgWordsPerBlock,
    timeAnalysis,
    gapAnalysis,
    topWords,
    speakingPace,
    sentiment,
  };
}

// SRT 텍스트를 블록으로 파싱
export function parseSRTToBlocks(srtText: string): SubtitleBlock[] {
  const blocks: SubtitleBlock[] = [];
  const parts = srtText.trim().split(/\n\n+/);

  for (const part of parts) {
    const lines = part.split('\n');
    if (lines.length < 3) continue;

    const id = parseInt(lines[0]);
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    if (!timeMatch) continue;

    const text = lines.slice(2).join('\n');

    blocks.push({
      id,
      startTime: timeMatch[1],
      endTime: timeMatch[2],
      text,
    });
  }

  return blocks;
}
