// 후처리/정규화 모듈
// GPT 응답에서 SRT 형식을 깨는 문자 제거

export function normalizeText(text: string): string {
  let result = text;

  // 1. 특수 따옴표 → 일반 따옴표
  result = result.replace(/'/g, "'");
  result = result.replace(/'/g, "'");
  result = result.replace(/"/g, '"');
  result = result.replace(/"/g, '"');
  result = result.replace(/„/g, '"');
  result = result.replace(/«/g, '"');
  result = result.replace(/»/g, '"');

  // 2. 마크다운 제거
  result = result.replace(/\*\*(.+?)\*\*/g, '$1');  // **bold**
  result = result.replace(/\*(.+?)\*/g, '$1');      // *italic*
  result = result.replace(/__(.+?)__/g, '$1');      // __underline__
  result = result.replace(/_(.+?)_/g, '$1');        // _italic_
  result = result.replace(/~~(.+?)~~/g, '$1');      // ~~strikethrough~~
  result = result.replace(/`(.+?)`/g, '$1');        // `code`

  // 3. HTML 태그 제거
  result = result.replace(/<[^>]*>/g, '');

  // 4. 불필요한 공백 정리
  result = result.replace(/[ \t]+/g, ' ');          // 연속 공백 → 단일 공백
  result = result.replace(/\n{3,}/g, '\n\n');       // 3줄 이상 줄바꿈 → 2줄

  // 5. 줄 앞뒤 공백 제거
  result = result
    .split('\n')
    .map(line => line.trim())
    .join('\n');

  // 6. BOM 제거
  result = result.replace(/^\uFEFF/, '');

  // 7. 특수 유니코드 공백 → 일반 공백
  result = result.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');

  return result.trim();
}

// SRT 응답 파싱 및 정규화
export function normalizeSRTResponse(response: string): string {
  // GPT가 코드 블록으로 감싼 경우 제거
  let text = response;

  // ```srt ... ``` 또는 ``` ... ``` 제거
  const codeBlockMatch = text.match(/```(?:srt)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1];
  }

  // 일반 정규화 적용
  text = normalizeText(text);

  // SRT 형식 검증 및 정리
  const blocks = text.split(/\n\n+/);
  const validBlocks: string[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // 첫 줄이 숫자인지 확인
    const index = parseInt(lines[0]);
    if (isNaN(index)) continue;

    // 두번째 줄이 타임코드인지 확인
    const timeMatch = lines[1].match(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/);
    if (!timeMatch) continue;

    // 유효한 블록
    validBlocks.push(block.trim());
  }

  return validBlocks.join('\n\n');
}
