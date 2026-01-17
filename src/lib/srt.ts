// SRT 자막 파서

export interface SubtitleBlock {
  index: number;
  startTime: string;
  endTime: string;
  startMs: number;
  endMs: number;
  text: string;
}

// 타임코드를 밀리초로 변환
export function timeToMs(time: string): number {
  const [hours, minutes, rest] = time.split(':');
  const [seconds, ms] = rest.split(',');
  return (
    parseInt(hours) * 3600000 +
    parseInt(minutes) * 60000 +
    parseInt(seconds) * 1000 +
    parseInt(ms)
  );
}

// 밀리초를 타임코드로 변환
export function msToTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// SRT 텍스트를 파싱하여 블록 배열로 변환
export function parseSRT(content: string): SubtitleBlock[] {
  const blocks: SubtitleBlock[] = [];

  // BOM 제거 및 줄바꿈 정규화 (Windows \r\n → \n)
  const normalized = content
    .replace(/^\uFEFF/, '')  // BOM 제거
    .replace(/\r\n/g, '\n')  // Windows → Unix
    .replace(/\r/g, '\n')    // Old Mac → Unix
    .trim();

  // 블록 분리: 하나 이상의 빈 줄로 분리
  const rawBlocks = normalized.split(/\n\n+/);

  for (const block of rawBlocks) {
    const lines = block.trim().split('\n');

    // 최소 2줄 필요 (인덱스 + 타임코드), 텍스트는 없을 수도 있음
    if (lines.length < 2) continue;

    const index = parseInt(lines[0]);
    if (isNaN(index)) continue;

    const timeLine = lines[1];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;

    const startTime = timeMatch[1];
    const endTime = timeMatch[2];
    // 텍스트가 없을 수도 있으므로 빈 문자열 허용
    const text = lines.length > 2 ? lines.slice(2).join('\n') : '';

    blocks.push({
      index,
      startTime,
      endTime,
      startMs: timeToMs(startTime),
      endMs: timeToMs(endTime),
      text,
    });
  }

  return blocks;
}

// 블록 배열을 SRT 텍스트로 변환
export function blocksToSRT(blocks: SubtitleBlock[]): string {
  return blocks
    .map((block) => {
      return `${block.index}\n${block.startTime} --> ${block.endTime}\n${block.text}`;
    })
    .join('\n\n');
}

// 블록 배열을 텍스트만 추출 (번역용)
export function blocksToText(blocks: SubtitleBlock[]): string {
  return blocks
    .map((block) => {
      return `${block.index}\n${block.startTime} --> ${block.endTime}\n${block.text}`;
    })
    .join('\n\n');
}

// SRT 블록을 청크로 분할 (병렬 번역용)
export function chunkSRTBlocks(
  blocks: SubtitleBlock[],
  chunkSize: number = 15
): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < blocks.length; i += chunkSize) {
    const chunkBlocks = blocks.slice(i, i + chunkSize);
    chunks.push(blocksToSRT(chunkBlocks));
  }

  return chunks;
}

// 여러 청크 결과를 합쳐서 파싱
export function mergeTranslatedChunks(chunks: string[]): SubtitleBlock[] {
  const allBlocks: SubtitleBlock[] = [];

  for (const chunk of chunks) {
    const blocks = parseSRT(chunk);
    allBlocks.push(...blocks);
  }

  // 인덱스 순서로 정렬
  allBlocks.sort((a, b) => a.index - b.index);

  return allBlocks;
}

// GPT 응답에서 번역된 텍스트 추출 (인덱스 기준)
function extractTranslatedTexts(translatedSRT: string): Map<number, string> {
  const textMap = new Map<number, string>();
  const blocks = parseSRT(translatedSRT);

  for (const block of blocks) {
    textMap.set(block.index, block.text);
  }

  return textMap;
}

// 원본 블록 구조 유지하면서 번역 텍스트만 교체 (1:1 매핑 강제)
export function applyTranslationToBlocks(
  originalBlocks: SubtitleBlock[],
  translatedSRT: string
): SubtitleBlock[] {
  const translatedTexts = extractTranslatedTexts(translatedSRT);

  return originalBlocks.map(block => {
    const translatedText = translatedTexts.get(block.index);

    return {
      ...block,
      // 번역된 텍스트가 있으면 사용, 없으면 원본 유지 (안전장치)
      text: translatedText ?? block.text,
    };
  });
}

// 여러 청크 번역 결과를 원본 구조에 매핑
export function mergeTranslatedChunksWithOriginal(
  originalBlocks: SubtitleBlock[],
  translatedChunks: string[]
): SubtitleBlock[] {
  // 모든 번역 청크에서 텍스트 추출
  const allTranslatedTexts = new Map<number, string>();

  for (const chunk of translatedChunks) {
    const blocks = parseSRT(chunk);
    for (const block of blocks) {
      allTranslatedTexts.set(block.index, block.text);
    }
  }

  // 원본 블록에 번역 텍스트 적용 (인덱스/타임코드 보존)
  return originalBlocks.map(block => ({
    ...block,
    text: allTranslatedTexts.get(block.index) ?? block.text,
  }));
}
