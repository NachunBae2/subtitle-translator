// 스마트 청킹 로직
import { SubtitleBlock, blocksToText } from './srt';

export interface Chunk {
  blocks: SubtitleBlock[];
  text: string;
  tokenCount: number;
}

// 간단한 토큰 추정 (정확한 계산은 tiktoken 사용)
// 한글: 약 2-3 토큰/글자, 영어: 약 0.75 토큰/단어
function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).length;
  const others = text.length - koreanChars - (text.match(/[a-zA-Z\d\s]/g) || []).length;

  return Math.ceil(
    koreanChars * 2 +      // 한글
    englishWords * 1.3 +   // 영어
    numbers * 0.5 +        // 숫자
    others * 1             // 기타
  );
}

// 대화 경계 감지 (타임코드 갭 기준)
function isDialogueBoundary(prev: SubtitleBlock, curr: SubtitleBlock, gapMs: number = 2000): boolean {
  return curr.startMs - prev.endMs > gapMs;
}

// 스마트 청킹 (대화 덩어리 기준)
export function createChunks(
  blocks: SubtitleBlock[],
  maxBlocks: number = 10,       // 안전 제한 (최대 블록 수)
  maxTokens: number = 2000,     // 안전 제한 (토큰)
  dialogueGapMs: number = 2000  // 대화 경계 기준 (2초 이상 갭 = 대화 덩어리 전환)
): Chunk[] {
  const chunks: Chunk[] = [];
  let currentBlocks: SubtitleBlock[] = [];
  let currentTokens = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockTokens = estimateTokens(block.text);

    const prevBlock = currentBlocks[currentBlocks.length - 1];

    // 대화 경계 감지 (우선 기준)
    // 1초 이상 갭이 있으면 대화 덩어리가 끝난 것으로 판단
    const isDialogueBreak = prevBlock && isDialogueBoundary(prevBlock, block, dialogueGapMs);

    // 안전 제한 체크 (보조 기준)
    const wouldExceedTokens = currentTokens + blockTokens > maxTokens;
    const wouldExceedBlocks = currentBlocks.length >= maxBlocks;

    // 분할 조건:
    // 1순위: 대화 경계 (1초 이상 갭) - 최소 2블록 이상일 때
    // 2순위: 안전 제한 초과
    const shouldSplitByDialogue = isDialogueBreak && currentBlocks.length >= 2;
    const shouldSplitBySafety = wouldExceedTokens || wouldExceedBlocks;

    if ((shouldSplitByDialogue || shouldSplitBySafety) && currentBlocks.length > 0) {
      // 현재 청크 저장
      const text = blocksToText(currentBlocks);
      chunks.push({
        blocks: [...currentBlocks],
        text,
        tokenCount: currentTokens,
      });

      // 새 청크 시작
      currentBlocks = [block];
      currentTokens = blockTokens;
    } else {
      // 현재 청크에 추가
      currentBlocks.push(block);
      currentTokens += blockTokens;
    }
  }

  // 마지막 청크 저장
  if (currentBlocks.length > 0) {
    const text = blocksToText(currentBlocks);
    chunks.push({
      blocks: [...currentBlocks],
      text,
      tokenCount: currentTokens,
    });
  }

  return chunks;
}

// 청크 정보 요약
export function getChunkSummary(chunks: Chunk[]): string {
  const totalBlocks = chunks.reduce((sum, c) => sum + c.blocks.length, 0);
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  return `${chunks.length}개 청크, 총 ${totalBlocks}개 자막, 약 ${totalTokens} 토큰`;
}
