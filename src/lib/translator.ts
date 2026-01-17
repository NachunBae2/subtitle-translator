// GPT API 클라이언트
import OpenAI from 'openai';
import { normalizeSRTResponse } from './normalizer';
import { Terminology, rulesToPromptText } from './terminology';

export type Language =
  | 'en' | 'zh' | 'vi' | 'it' | 'fr'
  | 'es' | 'de' | 'tr' | 'uk';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  zh: '中文 (Chinese)',
  vi: 'Tiếng Việt (Vietnamese)',
  it: 'Italiano (Italian)',
  fr: 'Français (French)',
  es: 'Español (Spanish)',
  de: 'Deutsch (German)',
  tr: 'Türkçe (Turkish)',
  uk: 'Українська (Ukrainian)',
};

export const LANGUAGE_CODES: Record<Language, string> = {
  en: 'ENG',
  zh: 'CHI',
  vi: 'VIE',
  it: 'ITA',
  fr: 'FRA',
  es: 'SPA',
  de: 'GER',
  tr: 'TUR',
  uk: 'UKR',
};

interface TranslateOptions {
  apiKey: string;
  sourceLang?: string;
  targetLang: Language | string;  // Language 타입 외 커스텀 언어 코드도 허용
  terminology: Terminology;
  customSystemPrompt?: string;  // 사용자 정의 시스템 프롬프트 (있으면 우선 사용)
  feedbackNotes?: string;       // 피드백 탭에서 가져온 번역 노트
  model?: string;
  signal?: AbortSignal;
}

// 용어 사전을 프롬프트용 텍스트로 변환 (한→영)
function terminologyToPrompt(terminology: Terminology): string {
  const entries = Object.entries(terminology.terms || {});
  if (entries.length === 0) return '';

  return entries
    .map(([korean, english]) => `- ${korean} → ${english}`)
    .join('\n');
}
// 번역 시스템 프롬프트 생성
function createSystemPrompt(
  targetLang: Language | string,
  terminology: Terminology,
  isFromKorean: boolean,
  customSystemPrompt?: string,  // 사용자 정의 프롬프트 (있으면 우선 사용)
  feedbackNotes?: string        // 피드백 탭에서 가져온 번역 노트
): string {
  // 언어 이름이 없으면 코드 자체를 사용
  const langName = LANGUAGE_NAMES[targetLang as Language] || targetLang;

  // 사용자 정의 용어집이 있으면 사용
  const termText = terminologyToPrompt(terminology);
  const hasTerminology = termText.length > 0;
  const rulesText = rulesToPromptText(terminology);

  // 한→영 번역 프롬프트
  if (isFromKorean) {
    // 커스텀 프롬프트 섹션 (사용자 정의 또는 기본값)
    const styleSection = customSystemPrompt || `## Translation Style (CRITICAL FOR QUALITY):
- DIRECT & NATURAL: Write how a native English speaker would say it
- SHORT SENTENCES: Subtitles must be quick to read while watching
- CONVERSATIONAL TONE: Friendly, like talking to the viewer
- OMIT KOREAN FILLER: Skip verbal padding like "여기서", "이렇게", "보시면", "자"
- KEEP MEANING: Don't add or remove information, just translate naturally

## Common Korean → English Patterns:
- "~하시면 됩니다" → Direct statement or "You can..."
- "~할 거예요" → "We'll..." or "I'll..."
- "여기서 이렇게" → Skip or "Here, ..."
- "이제 ~해 볼게요" → "Now..." or "Let's..."
- "~하는 거죠" → Statement form
- "~거든요" → Skip or rephrase naturally
- "네/예" at start → Usually skip`;

    return `⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️
YOU WILL BE VALIDATED BY A RULE-BASED SYSTEM AFTER THIS.
IF YOU VIOLATE ANY RULE BELOW, YOUR OUTPUT WILL BE REJECTED AND YOU WILL BE CALLED AGAIN.
FOLLOW THE RULES EXACTLY.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE #1: BLOCK COUNT MUST BE IDENTICAL
═══════════════════════════════════════════════════════════════
- INPUT has N blocks → OUTPUT MUST have EXACTLY N blocks
- 10 input blocks = 10 output blocks. NOT 9. NOT 11. EXACTLY 10.
- This is verified by machine. There is NO exception.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE #2: BLOCK NUMBERS - COPY EXACTLY
═══════════════════════════════════════════════════════════════
- Line 1 of each block = block number (e.g., "1", "2", "3")
- COPY THIS NUMBER EXACTLY. Do not change, skip, or reorder.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE #3: TIMECODES - COPY CHARACTER BY CHARACTER
═══════════════════════════════════════════════════════════════
- Line 2 = timecode (e.g., "00:00:01,000 --> 00:00:03,500")
- COPY THIS LINE EXACTLY AS-IS. Character for character.
- Do NOT modify even a single digit or comma.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE #4: ONLY TRANSLATE LINE 3+
═══════════════════════════════════════════════════════════════
- Lines 3 and beyond = the text to translate
- This is the ONLY part you may change.

═══════════════════════════════════════════════════════════════

You are translating YouTube video subtitles (Korean → English).

${hasTerminology ? `## Terminology (USE THESE EXACT TERMS):
${termText}

` : ''}${rulesText ? `## Context Hints:
${rulesText}

` : ''}${feedbackNotes ? `## Translator Notes (IMPORTANT - User Feedback):
${feedbackNotes}

` : ''}${styleSection}

## OUTPUT FORMAT (FOLLOW EXACTLY):

[block number - copy exactly]
[timecode - copy exactly, character by character]
[translated text]

[next block number]
[next timecode]
[next translated text]

...and so on for ALL blocks.

## FINAL CHECK BEFORE RESPONDING:
☑️ Did I output the SAME number of blocks as input?
☑️ Did I copy EVERY block number exactly?
☑️ Did I copy EVERY timecode exactly, character by character?
☑️ Did I only translate the text content?

If any answer is NO, FIX IT before responding.

Return ONLY the SRT output. No explanations. No markdown. No extra text.`;
  }

  // 영→다국어 번역 프롬프트
  return `⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️
YOU WILL BE VALIDATED BY A RULE-BASED SYSTEM AFTER THIS.
IF YOU VIOLATE ANY RULE BELOW, YOUR OUTPUT WILL BE REJECTED AND YOU WILL BE CALLED AGAIN.
FOLLOW THE RULES EXACTLY.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE #1: BLOCK COUNT MUST BE IDENTICAL
═══════════════════════════════════════════════════════════════
- INPUT has N blocks → OUTPUT MUST have EXACTLY N blocks
- 10 input blocks = 10 output blocks. NOT 9. NOT 11. EXACTLY 10.
- This is verified by machine. There is NO exception.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE #2: BLOCK NUMBERS - COPY EXACTLY
═══════════════════════════════════════════════════════════════
- Line 1 of each block = block number (e.g., "1", "2", "3")
- COPY THIS NUMBER EXACTLY. Do not change, skip, or reorder.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE #3: TIMECODES - COPY CHARACTER BY CHARACTER
═══════════════════════════════════════════════════════════════
- Line 2 = timecode (e.g., "00:00:01,000 --> 00:00:03,500")
- COPY THIS LINE EXACTLY AS-IS. Character for character.
- Do NOT modify even a single digit or comma.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE #4: ONLY TRANSLATE LINE 3+
═══════════════════════════════════════════════════════════════
- Lines 3 and beyond = the text to translate
- This is the ONLY part you may change.

═══════════════════════════════════════════════════════════════

You are translating YouTube video subtitles (English → ${langName}).

${hasTerminology ? `## Terminology (USE THESE EXACT TERMS):
${termText}

` : ''}${rulesText ? `## Context Hints:
${rulesText}

` : ''}## Translation Style:
- Natural, conversational tone in ${langName}
- Write how a native ${langName} speaker would say it
- Keep the friendly, informal video style

## OUTPUT FORMAT (FOLLOW EXACTLY):

[block number - copy exactly]
[timecode - copy exactly, character by character]
[translated text in ${langName}]

[next block number]
[next timecode]
[next translated text]

...and so on for ALL blocks.

## FINAL CHECK BEFORE RESPONDING:
☑️ Did I output the SAME number of blocks as input?
☑️ Did I copy EVERY block number exactly?
☑️ Did I copy EVERY timecode exactly, character by character?
☑️ Did I only translate the text content?

If any answer is NO, FIX IT before responding.

Return ONLY the SRT output. No explanations. No markdown. No extra text.`;
}

// 블록 정보 추출 (번호, 타임코드)
interface BlockInfo {
  index: number;
  timecode: string;
}

function extractBlockInfos(text: string): BlockInfo[] {
  // 줄바꿈 정규화
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const blocks = normalized.split(/\n\n+/);
  const infos: BlockInfo[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const index = parseInt(lines[0]);
    if (isNaN(index)) continue;

    // 타임코드 라인 찾기
    const timecodeLine = lines.find(line => line.includes('-->'));
    if (!timecodeLine) continue;

    infos.push({ index, timecode: timecodeLine.trim() });
  }

  return infos;
}

// 블록 수 및 타임코드 검증
function validateTranslation(input: string, output: string): { valid: boolean; errors: string[] } {
  const inputInfos = extractBlockInfos(input);
  const outputInfos = extractBlockInfos(output);
  const errors: string[] = [];

  // 블록 수 검증
  if (inputInfos.length !== outputInfos.length) {
    errors.push(`Block count mismatch: expected ${inputInfos.length}, got ${outputInfos.length}`);
    return { valid: false, errors };
  }

  // 각 블록의 번호와 타임코드 검증
  for (let i = 0; i < inputInfos.length; i++) {
    const input_ = inputInfos[i];
    const output_ = outputInfos[i];

    if (input_.index !== output_.index) {
      errors.push(`Block ${i}: index mismatch (expected ${input_.index}, got ${output_.index})`);
    }

    if (input_.timecode !== output_.timecode) {
      errors.push(`Block ${input_.index}: timecode mismatch`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// 단일 청크 번역 (블록 수 + 타임코드 검증 + 재시도)
export async function translateChunk(
  text: string,
  options: TranslateOptions,
  maxRetries: number = 3
): Promise<string> {
  const { apiKey, targetLang, terminology, customSystemPrompt, feedbackNotes, model = 'gpt-4.1-mini', signal } = options;

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const isFromKorean = targetLang === 'en';
  const systemPrompt = createSystemPrompt(targetLang, terminology, isFromKorean, customSystemPrompt, feedbackNotes);

  let lastResult = '';
  let userContent = text;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 취소 확인
    if (signal?.aborted) {
      throw new Error('번역이 취소되었습니다.');
    }

    // 재시도 시 프롬프트에 공백 추가 (다른 출력 유도)
    if (attempt > 0) {
      userContent = text + ' '.repeat(attempt);
    }

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_completion_tokens: 4000,
    }, { signal });

    const content = response.choices[0]?.message?.content || '';
    lastResult = normalizeSRTResponse(content);

    // 블록 수 + 타임코드 검증
    const validation = validateTranslation(text, lastResult);

    if (validation.valid) {
      // 검증 통과 - 성공
      return lastResult;
    }

    console.warn(
      `🔴 Translation validation failed (attempt ${attempt + 1}/${maxRetries}):`,
      `\n  Input blocks: ${extractBlockInfos(text).length}`,
      `\n  Output blocks: ${extractBlockInfos(lastResult).length}`,
      `\n  Errors:`, validation.errors.slice(0, 5).join('\n    '),
      validation.errors.length > 5 ? `\n  ... and ${validation.errors.length - 5} more` : ''
    );
  }

  // 모든 재시도 실패 - 마지막 결과라도 반환
  console.error(`Translation validation failed after ${maxRetries} attempts.`);
  return lastResult;
}

// 진행 상황 콜백 타입
export type ProgressCallback = (current: number, total: number, message: string) => void;

// 단일 청크 번역 with 무한 재시도 (성공할 때까지)
async function translateChunkWithRetry(
  chunk: string,
  index: number,
  options: TranslateOptions,
  onProgress?: ProgressCallback,
  maxAttempts: number = 10  // 최대 10번 시도
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 취소 확인
    if (options.signal?.aborted) {
      throw new Error('번역이 취소되었습니다.');
    }

    try {
      console.log(`🔄 청크 ${index + 1} 번역 시도 ${attempt}/${maxAttempts}...`);
      const result = await translateChunk(chunk, options);
      console.log(`✅ 청크 ${index + 1} 번역 완료`);
      return result;
    } catch (error) {
      // 취소된 경우 재시도 없이 바로 throw
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new Error('번역이 취소되었습니다.');
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`청크 ${index + 1} 실패 (시도 ${attempt}/${maxAttempts}):`, lastError.message);

      // 재시도 전 잠시 대기 (exponential backoff)
      if (attempt < maxAttempts) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 최대 10초
        // Note: -1, 1 signals "retry mode" to avoid NaN% in progress calculation
        onProgress?.(-1, 1, `청크 ${index + 1} 재시도 대기 중... (${Math.round(waitTime / 1000)}초)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // 모든 재시도 실패
  throw lastError || new Error(`청크 ${index + 1} 번역 실패`);
}

// 병렬 번역 (최대 동시 실행 수 제한) - 실패 청크 자동 재시도
async function translateParallel(
  chunks: string[],
  options: TranslateOptions,
  onProgress?: ProgressCallback,
  concurrency: number = 5
): Promise<string[]> {
  const results: string[] = new Array(chunks.length);
  let completed = 0;

  // 청크를 배치로 나눠서 병렬 실행
  const batches: number[][] = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    batches.push(
      Array.from({ length: Math.min(concurrency, chunks.length - i) }, (_, j) => i + j)
    );
  }

  for (const batch of batches) {
    // 배치 시작 전 취소 확인
    if (options.signal?.aborted) {
      throw new Error('번역이 취소되었습니다.');
    }

    const promises = batch.map(async (index) => {
      // 무한 재시도로 청크 번역
      const translated = await translateChunkWithRetry(
        chunks[index],
        index,
        options,
        onProgress
      );
      results[index] = translated;
      completed++;
      onProgress?.(completed, chunks.length, `${completed}/${chunks.length} 청크 완료`);
      return translated;
    });

    await Promise.all(promises);
  }

  return results;
}

// 자연어로 언어 정보 파싱 (GPT 활용)
export interface ParsedLanguageInfo {
  code: string;      // ISO 639-1 code (e.g., 'ja', 'ko')
  name: string;      // English name (e.g., 'Japanese')
  nativeName: string;  // Native name (e.g., '日本語')
  koreanName: string;  // Korean name (e.g., '일본어')
  fileCode: string;  // 3-letter code for files (e.g., 'JAP')
}

export async function parseLanguageFromText(
  apiKey: string,
  input: string
): Promise<ParsedLanguageInfo | null> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `You are a language identification expert. Your job is to understand what language the user wants and return structured information about it.

## Your Task
Parse the user's input to identify what language they want, then return a JSON object with these fields:
- code: ISO 639-1 code (2 letters). For non-standard languages, create a sensible 2-letter code.
- name: The language name in English
- nativeName: The language name as native speakers call it (in that language's script)
- koreanName: The language name in Korean (e.g., "일본어", "중국어", "아랍어")
- fileCode: A 3-letter uppercase code for file naming (based on ISO 639-2 when available)

## Input Types You'll Receive
Users may type in various ways:
- Korean: "일본어", "아랍어", "힌디어"
- English: "Japanese", "Arabic", "Hindi"
- Native: "日本語", "العربية", "हिन्दी"
- Informal: "일어", "중국어", "불어"
- Regional dialects: "광동어", "대만어", "스위스 독일어"
- Made-up/meme languages: "엄랭", "도게자어"

## Examples

Input: "일본어"
Output: {"code": "ja", "name": "Japanese", "nativeName": "日本語", "koreanName": "일본어", "fileCode": "JAP"}

Input: "아랍어"
Output: {"code": "ar", "name": "Arabic", "nativeName": "العربية", "koreanName": "아랍어", "fileCode": "ARA"}

Input: "힌디어"
Output: {"code": "hi", "name": "Hindi", "nativeName": "हिन्दी", "koreanName": "힌디어", "fileCode": "HIN"}

Input: "광동어" (Cantonese - regional)
Output: {"code": "yue", "name": "Cantonese", "nativeName": "廣東話", "koreanName": "광동어", "fileCode": "YUE"}

Input: "엄랭" (Korean meme language)
Output: {"code": "um", "name": "Eom-lang", "nativeName": "엄랭", "koreanName": "엄랭", "fileCode": "EOM"}

Input: "태국어"
Output: {"code": "th", "name": "Thai", "nativeName": "ภาษาไทย", "koreanName": "태국어", "fileCode": "THA"}

Input: "체코어"
Output: {"code": "cs", "name": "Czech", "nativeName": "Čeština", "koreanName": "체코어", "fileCode": "CZE"}

Input: "우즈베키스탄어"
Output: {"code": "uz", "name": "Uzbek", "nativeName": "Oʻzbekcha", "koreanName": "우즈베크어", "fileCode": "UZB"}

## Rules
1. ALWAYS return valid JSON with all 5 fields
2. For real languages, use official ISO codes when available
3. For dialects/regional variants, use appropriate variant codes
4. For made-up languages, be creative but consistent
5. nativeName should use the actual script of that language (Arabic script, Devanagari, Thai, etc.)
6. koreanName should be the natural Korean name for that language (ending with 어, e.g., 영어, 일본어)`,
      },
      {
        role: 'user',
        content: input,
      },
    ],
    temperature: 0,
    max_completion_tokens: 150,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    if (parsed.code && parsed.name && parsed.nativeName && parsed.koreanName && parsed.fileCode) {
      return parsed as ParsedLanguageInfo;
    }
  } catch (e) {
    console.error('Language parse error:', content, e);
  }
  return null;
}

// 전체 번역 파이프라인 (병렬 처리)
export async function translateFull(
  chunks: string[],
  options: TranslateOptions,
  onProgress?: ProgressCallback
): Promise<string[]> {
  if (chunks.length === 0) return [];

  console.log(`📝 translateFull 시작: ${chunks.length}개 청크, 모델: ${options.model || 'gpt-4.1-mini'}`);
  console.log(`   타겟 언어: ${options.targetLang}, API Key 존재: ${!!options.apiKey}`);
  onProgress?.(0, chunks.length, `${chunks.length}개 청크 병렬 번역 시작...`);

  try {
    // 5개씩 병렬 처리
    const results = await translateParallel(chunks, options, onProgress, 5);
    return results;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`번역 실패: ${errorMsg}`);
  }
}

// 빈 셀 수정을 위한 블록 인터페이스
export interface SubtitleBlockForFix {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
  originalText?: string;  // 원본 한글 텍스트
}

// 빈 셀 탐지 및 문장 분할 수정 (한→영 번역 전용)
export async function fixEmptyBlocks(
  blocks: SubtitleBlockForFix[],
  apiKey: string,
  model: string = 'gpt-4.1-mini',
  onProgress?: (current: number, total: number, message: string) => void
): Promise<SubtitleBlockForFix[]> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const result = [...blocks];

  // 빈 셀 찾기
  const emptyIndices: number[] = [];
  for (let i = 0; i < result.length; i++) {
    if (!result[i].text || result[i].text.trim() === '') {
      emptyIndices.push(i);
    }
  }

  if (emptyIndices.length === 0) {
    console.log('✅ 빈 셀 없음 - 수정 불필요');
    return result;
  }

  console.log(`🔍 빈 셀 ${emptyIndices.length}개 발견: 인덱스 ${emptyIndices.join(', ')}`);
  onProgress?.(0, emptyIndices.length, `빈 셀 ${emptyIndices.length}개 수정 중...`);

  // 각 빈 셀에 대해 인접 블록 확인 및 분할
  let fixed = 0;
  for (const emptyIdx of emptyIndices) {
    // 이전/다음 블록 확인
    const prevIdx = emptyIdx - 1;
    const nextIdx = emptyIdx + 1;

    const prevBlock = prevIdx >= 0 ? result[prevIdx] : null;
    const nextBlock = nextIdx < result.length ? result[nextIdx] : null;

    // 원본 텍스트들 수집 (빈 셀 + 인접 블록)
    const emptyOriginal = result[emptyIdx].originalText || '';
    const prevOriginal = prevBlock?.originalText || '';
    const nextOriginal = nextBlock?.originalText || '';

    // 이전 블록의 텍스트가 길거나, 원본 비교시 분할이 필요한 경우
    let sourceBlock: SubtitleBlockForFix | null = null;
    let sourceIdx: number = -1;
    let splitPosition: 'before' | 'after' = 'after';

    // 이전 블록 체크: 텍스트가 있고, 원본 대비 너무 길거나 두 문장이 합쳐진 것 같으면
    if (prevBlock && prevBlock.text && prevBlock.text.length > 30) {
      sourceBlock = prevBlock;
      sourceIdx = prevIdx;
      splitPosition = 'after';
    }
    // 다음 블록 체크
    else if (nextBlock && nextBlock.text && nextBlock.text.length > 30) {
      sourceBlock = nextBlock;
      sourceIdx = nextIdx;
      splitPosition = 'before';
    }

    if (!sourceBlock) {
      console.log(`⚠️ 블록 ${emptyIdx}: 분할할 인접 블록 없음`);
      continue;
    }

    // GPT에게 문장 분할 요청
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a subtitle text splitter.

## Task
The translation merged two subtitle lines into one. Split the text back into two parts.

## Input
- Combined English text (needs to be split)
- Original Korean texts for reference (two separate lines)

## Rules
1. Split the English text into TWO parts that align with the original Korean lines
2. Each part should be a complete, natural sentence
3. Maintain the original meaning
4. Return ONLY JSON: {"part1": "first part", "part2": "second part"}

## Example
Combined: "Hello everyone, today we'll learn about cooking."
Korean 1: "안녕하세요 여러분"
Korean 2: "오늘은 요리에 대해 배워볼게요"
Output: {"part1": "Hello everyone,", "part2": "today we'll learn about cooking."}`,
          },
          {
            role: 'user',
            content: `Combined English: "${sourceBlock.text}"

Korean line 1 (${splitPosition === 'after' ? 'source' : 'empty'}): "${splitPosition === 'after' ? prevOriginal : emptyOriginal}"
Korean line 2 (${splitPosition === 'after' ? 'empty' : 'source'}): "${splitPosition === 'after' ? emptyOriginal : nextOriginal}"

Split this into two parts.`,
          },
        ],
        temperature: 0.2,
        max_completion_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      if (parsed.part1 && parsed.part2) {
        if (splitPosition === 'after') {
          // 이전 블록에서 분할: part1은 이전 블록, part2는 현재 빈 셀
          result[sourceIdx].text = parsed.part1.trim();
          result[emptyIdx].text = parsed.part2.trim();
        } else {
          // 다음 블록에서 분할: part1은 현재 빈 셀, part2는 다음 블록
          result[emptyIdx].text = parsed.part1.trim();
          result[sourceIdx].text = parsed.part2.trim();
        }
        fixed++;
        console.log(`✅ 블록 ${emptyIdx}: 분할 완료`);
      }
    } catch (error) {
      console.error(`❌ 블록 ${emptyIdx} 분할 실패:`, error);
    }

    onProgress?.(fixed, emptyIndices.length, `빈 셀 수정 중... (${fixed}/${emptyIndices.length})`);
  }

  console.log(`🎉 빈 셀 수정 완료: ${fixed}/${emptyIndices.length}개 수정됨`);
  onProgress?.(emptyIndices.length, emptyIndices.length, `빈 셀 ${fixed}개 수정 완료`);

  return result;
}

// GPT 대화 메시지 타입
export interface GptMessage {
  role: 'user' | 'assistant';
  content: string;
}

// GPT 대화 응답 타입
export interface GptConversationResponse {
  message: string;
  suggestedTranslation?: string;
}

// 단일 번역에 대해 GPT와 대화
export async function askGptAboutTranslation(
  apiKey: string,
  originalText: string,
  currentTranslation: string,
  question: string,
  conversationHistory: GptMessage[],
  model: string = 'gpt-4.1-mini',
  signal?: AbortSignal
): Promise<GptConversationResponse> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const systemPrompt = `You are a translation assistant helping review and improve subtitle translations.

## Context
- Original (Korean): "${originalText}"
- Current Translation (English): "${currentTranslation}"

## Your Role
1. Answer the user's questions about this translation
2. Provide alternative translations if asked
3. Explain nuances, word choices, or cultural context
4. When suggesting a new translation, include it at the end in this format:
   [SUGGESTED_TRANSLATION]: your suggested translation here

## Guidelines
- Be concise but helpful
- Focus on the specific text being discussed
- If suggesting a translation, make sure it maintains the meaning and tone
- Reply in Korean (the user's language)`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: question },
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_completion_tokens: 500,
  }, { signal });

  const content = response.choices[0]?.message?.content || '';

  // [SUGGESTED_TRANSLATION]: 패턴 추출
  const suggestionMatch = content.match(/\[SUGGESTED_TRANSLATION\]:\s*(.+?)(?:\n|$)/);
  const suggestedTranslation = suggestionMatch ? suggestionMatch[1].trim() : undefined;

  // 응답에서 [SUGGESTED_TRANSLATION] 제거
  const cleanMessage = content.replace(/\[SUGGESTED_TRANSLATION\]:\s*.+?(?:\n|$)/, '').trim();

  return {
    message: cleanMessage,
    suggestedTranslation,
  };
}

// 채널 정보 타입 (useSettingsStore와 동일)
interface ChannelInfo {
  genre: string;
  targetAudience: string;
  description: string;
}

// GPT로 채널 정보 기반 시스템 프롬프트 자동 생성
export async function generateSystemPrompt(
  apiKey: string,
  channelInfo: ChannelInfo,
  model: string = 'gpt-4.1-mini'
): Promise<string> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const metaPrompt = `You are an expert at creating context prompts for YouTube subtitle translators.

## Task
Create a short context prompt for translating Korean YouTube subtitles to English.

## Channel Information
- Genre: ${channelInfo.genre || '(not specified)'}
- Target Audience: ${channelInfo.targetAudience || '(not specified)'}
- Channel Description: ${channelInfo.description || '(not specified)'}

## Output Requirements
1. Start with "You are a subtitle translator for a Korean [genre] channel..."
2. Describe the target audience briefly
3. Include a "Style & tone:" section with 3-5 bullet points
4. Keep it SHORT - around 100-150 words max
5. Write in English
6. DO NOT use quotation marks (' or ") unless absolutely necessary
7. Focus on vibe/tone, not technical translation rules

## Example Output Format:
You are a subtitle translator for a Korean [genre] channel aimed at [audience]. Translate Korean YouTube subtitles into natural, contemporary English that feels [adjectives]—like a [comparison].

Style & tone:
- Use casual, modern phrasing. [Vibe description].
- Keep the creator's personality: [specific traits] should carry over naturally.
- Use contractions where natural.
- [Additional style point relevant to genre/audience].

## CRITICAL
- Output ONLY the prompt text
- NO markdown, NO explanations, NO quotes around output
- Keep it concise and natural`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'user', content: metaPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: 1000,
  });

  return response.choices[0]?.message?.content?.trim() || '';
}

// GPT 기반 감성 분석 (청크별)
export interface SentimentScore {
  chunkIndex: number;
  score: number;  // 0 ~ 100 (GPT가 범위 내에서 직접 평가)
  label: 'positive' | 'neutral' | 'negative' | 'very_negative';
  summary: string;  // 짧은 요약
}

export async function analyzeSentimentWithGPT(
  apiKey: string,
  chunks: string[],  // 자막 텍스트 청크들
  model: string = 'gpt-4.1-mini',
  onProgress?: (current: number, total: number) => void
): Promise<SentimentScore[]> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const results: SentimentScore[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);

    // === 1차 호출: label + summary 평가 ===
    const labelResponse = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a sentiment analyzer for video subtitles.

## Task
Evaluate the emotional level of the text:
- positive: 긍정적, 즐거움, 만족, 열정, 감동, 행복
- neutral: 중립적, 설명적, 담담함, 일반적인 내용
- negative: 약간 부정적, 불만, 걱정, 아쉬움
- very_negative: 극도로 부정적, 분노, 슬픔, 절망

대부분의 일상적인 영상 자막은 positive나 neutral입니다.
부정적 내용이 확실할 때만 negative/very_negative를 사용하세요.

Also write a 3-5 word Korean summary of the mood.

## Output
Return ONLY a JSON object:
{"label": "positive", "summary": "밝고 활기찬 분위기"}`,
        },
        {
          role: 'user',
          content: chunks[i],
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 80,
      response_format: { type: 'json_object' },
    });

    try {
      const labelContent = labelResponse.choices[0]?.message?.content || '{}';
      const labelParsed = JSON.parse(labelContent);
      const label = labelParsed.label ?? 'neutral';
      const summary = labelParsed.summary ?? '';

      // 레이블별 점수 범위 정의 (심리적으로 높은 점수대)
      const scoreRanges: Record<string, { min: number; max: number }> = {
        positive: { min: 75, max: 100 },
        neutral: { min: 40, max: 75 },
        negative: { min: 20, max: 40 },
        very_negative: { min: 0, max: 20 },
      };
      const range = scoreRanges[label] || { min: 40, max: 75 };

      // === 2차 호출: 범위 내 세부 점수 평가 ===
      const scoreResponse = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You already evaluated this text as "${label}" (${summary}).

Now give a specific score between ${range.min} and ${range.max}.

Consider:
- How strong is the emotion within this category?
- ${range.min} = weak ${label}, ${range.max} = strong ${label}

## Output
Return ONLY a JSON object:
{"score": 72}`,
          },
          {
            role: 'user',
            content: chunks[i],
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 30,
        response_format: { type: 'json_object' },
      });

      const scoreContent = scoreResponse.choices[0]?.message?.content || '{}';
      const scoreParsed = JSON.parse(scoreContent);
      const score = Math.max(range.min, Math.min(range.max, scoreParsed.score ?? (range.min + range.max) / 2));

      results.push({
        chunkIndex: i,
        score,
        label: label as SentimentScore['label'],
        summary,
      });
    } catch {
      results.push({
        chunkIndex: i,
        score: 50,  // 중립 기본값
        label: 'neutral',
        summary: '분석 실패',
      });
    }
  }

  return results;
}

// AI 콘텐츠 요약
export async function summarizeContent(
  apiKey: string,
  fullText: string,
  model: string = 'gpt-4.1-mini'
): Promise<{ summary: string; topics: string[] }> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a content summarizer for video subtitles.

## Task
Analyze the full subtitle text and provide:
1. summary: A 2-3 sentence Korean summary of what the video is about
2. topics: An array of 3-5 topic tags in Korean (e.g., ["뜨개질", "패턴 설명", "초보자 가이드"])

## Output
Return ONLY a JSON object:
{"summary": "이 영상은...", "topics": ["태그1", "태그2", "태그3"]}`,
      },
      {
        role: 'user',
        content: fullText.substring(0, 10000), // 토큰 제한
      },
    ],
    temperature: 0.5,
    max_completion_tokens: 300,
    response_format: { type: 'json_object' },
  });

  try {
    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary ?? '',
      topics: parsed.topics ?? [],
    };
  } catch {
    return { summary: '', topics: [] };
  }
}

// 사전 용어 일괄 번역 (영어 → 타겟 언어)
export async function translateDictionaryTerms(
  apiKey: string,
  terms: Array<{ korean: string; english: string }>,
  targetLang: string,
  model: string = 'gpt-4.1-mini',
  signal?: AbortSignal
): Promise<Array<{ korean: string; translation: string }>> {
  if (terms.length === 0) return [];

  console.log('📝 [translateDictionaryTerms] 시작, 용어 수:', terms.length, '타겟:', targetLang);

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  // 언어 이름이 없으면 코드 자체를 사용
  const targetLangName = LANGUAGE_NAMES[targetLang as Language] || targetLang;

  // 용어 목록을 JSON 형식으로 전달
  const termsForPrompt = terms.map((t, i) => `${i + 1}. "${t.english}" (Korean: ${t.korean})`).join('\n');

  const systemPrompt = `You are a specialized terminology translator for crafting/knitting/crochet content.

## Task
Translate the following English terms to ${targetLangName}. These are technical terms used in crafting tutorials.

## Terms to translate:
${termsForPrompt}

## Output Format
Return ONLY a JSON array with translations:
[
  {"index": 1, "translation": "translated term"},
  {"index": 2, "translation": "translated term"},
  ...
]

## Rules
1. Translate technical terms accurately for the crafting context
2. Keep translations natural in ${targetLangName}
3. If a term doesn't have a direct equivalent, use the most commonly used expression in ${targetLangName}
4. Return ONLY the JSON array, no explanations`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please translate the terms listed above.' },
      ],
      temperature: 0.3,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    }, { signal });

    const content = response.choices[0]?.message?.content || '{}';

    console.log('📝 [translateDictionaryTerms] API 응답:', content.substring(0, 200));

    try {
      const parsed = JSON.parse(content);
      const translations = Array.isArray(parsed) ? parsed : parsed.translations || [];

      const result = translations.map((t: { index: number; translation: string }) => ({
        korean: terms[t.index - 1]?.korean || '',
        translation: t.translation,
      })).filter((t: { korean: string; translation: string }) => t.korean && t.translation);

      console.log('📝 [translateDictionaryTerms] 결과:', result.length, '개');
      return result;
    } catch (e) {
      console.error('🔴 [translateDictionaryTerms] JSON 파싱 에러:', content, e);
      return [];
    }
  } catch (error) {
    console.error('🔴 [translateDictionaryTerms] API 에러:', error);
    return [];
  }
}

// ========== 국가별 댓글 시뮬레이션 ==========

// 시뮬레이션 댓글 타입
export interface SimulatedComment {
  id: string;
  country: string;       // 국가 코드 (US, JP, CN, DE, BR 등)
  countryFlag: string;   // 이모지 플래그
  countryName: string;   // 국가명 (영어)
  username: string;      // 가상 유저네임
  comment: string;       // 댓글 내용 (해당 국가 언어)
  sentiment: 'positive' | 'neutral' | 'negative';
  likes: number;         // 가상 좋아요 수
}

// 국가별 페르소나 정의 (언어/밈만 정의, 성격은 랜덤)
const COUNTRY_PERSONAS = [
  {
    code: 'US', flag: '🇺🇸', name: 'United States', lang: 'English',
    memes: ['bruh', 'no way!', 'literally me', 'this is fire 🔥', 'W video', 'lowkey', 'slay', 'ngl', 'fr fr', 'deadass'],
  },
  {
    code: 'JP', flag: '🇯🇵', name: 'Japan', lang: 'Japanese',
    memes: ['草', 'www', 'すごい', 'かわいい', 'やばい', '神回', 'エモい', 'それな', 'ワロタ'],
  },
  {
    code: 'CN', flag: '🇨🇳', name: 'China', lang: 'Chinese (Simplified)',
    memes: ['哈哈哈', '666', 'yyds', '绝了', '太强了', '爱了', '冲', '笑死', '破防了'],
  },
  {
    code: 'DE', flag: '🇩🇪', name: 'Germany', lang: 'German',
    memes: ['krass', 'mega', 'Ehrenmann', 'wild', 'sheesh', 'safe', 'nice', 'digga'],
  },
  {
    code: 'BR', flag: '🇧🇷', name: 'Brazil', lang: 'Portuguese',
    memes: ['kkkk', 'top demais', 'mito', 'só vem', 'arrasou', 'caramba', 'nossa'],
  },
  {
    code: 'FR', flag: '🇫🇷', name: 'France', lang: 'French',
    memes: ['mdr', 'trop bien', 'c\'est ouf', 'incroyable', 'stylé', 'génial', 'grave'],
  },
  {
    code: 'ES', flag: '🇪🇸', name: 'Spain', lang: 'Spanish',
    memes: ['jajaja', 'qué fuerte', 'mola', 'brutal', 'guay', 'tío', 'flipa'],
  },
  {
    code: 'RU', flag: '🇷🇺', name: 'Russia', lang: 'Russian',
    memes: ['ахах', 'жиза', 'кринж', 'респект', 'база', 'имба', 'лол', 'пиши ещё'],
  },
  {
    code: 'IN', flag: '🇮🇳', name: 'India', lang: 'English (Indian style)',
    memes: ['bhai', 'yaar', 'too good', 'mind-blowing', 'next level', 'op', 'bro'],
  },
  {
    code: 'TH', flag: '🇹🇭', name: 'Thailand', lang: 'Thai',
    memes: ['555', 'ชอบมาก', 'น่ารัก', 'เก่งมาก', 'สุดยอด', 'ปัง', 'จริงๆ'],
  },
];

export interface SimulateCommentsOptions {
  apiKey: string;
  contentSummary: string;    // 콘텐츠 요약
  subtitleText: string;      // 실제 자막 전문 (고유명사 추출용)
  channelGenre: string;      // 채널 장르
  targetAudience: string;    // 타겟 시청자
  model?: string;
  commentCount?: number;     // 생성할 댓글 수 (기본 10)
}

// 국가별 예상 댓글 시뮬레이션
export async function simulateGlobalComments(
  options: SimulateCommentsOptions
): Promise<SimulatedComment[]> {
  const {
    apiKey,
    contentSummary,
    subtitleText,
    channelGenre,
    targetAudience,
    model = 'gpt-4.1-mini',
    commentCount = 10,
  } = options;

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  // 댓글 수에 맞게 국가 선택 (랜덤 셔플 후 선택)
  const shuffled = [...COUNTRY_PERSONAS].sort(() => Math.random() - 0.5);
  const selectedCountries = shuffled.slice(0, Math.min(commentCount, COUNTRY_PERSONAS.length));

  // 자막 텍스트를 3000자로 제한 (토큰 절약)
  const trimmedSubtitle = subtitleText?.slice(0, 3000) || '';

  const systemPrompt = `너는 전 세계 유튜브 시청자들이야. 진짜 유튜브 댓글처럼 자연스럽게 써.

## 영상 내용

${contentSummary || '유튜브 영상'}

## 실제 자막 (읽고 구체적으로 언급해)

${trimmedSubtitle}

## 채널 정보
- 장르: ${channelGenre || '일반'}
- 시청자층: ${targetAudience || '일반'}

---

## 댓글 생성 가이드

**${commentCount}개 국가에서 온 댓글을 써줘:**
${selectedCountries.map((c, i) => `${i + 1}. ${c.flag} ${c.name} - ${c.lang}으로 작성
   - 밈/유행어: ${c.memes.slice(0, 5).join(', ')}`).join('\n')}

### 핵심: 자막에서 구체적인 거 언급하기!
자막 읽고 거기 나온 **지명, 가게명, 제품명, 사람이름** 같은 거 댓글에 써.
"영상 좋아요" 이런 뻔한 거 말고, "아 거기 ㅇㅇ 나도 가봤는데ㅋㅋㅋ" 이런 느낌으로.

### 다양한 사람들
모든 사람이 다 친절한 게 아니야. 실제 유튜브 댓글섹션 생각해봐.
- 그냥 "ㅋㅋㅋ" 하고 가는 사람
- 칭찬만 하는 팬
- 약간 삐딱한 사람
- 자기 경험 풀어놓는 사람
- 질문하는 사람
- 드립치는 사람
진짜 다양해. 너도 그렇게 다양하게 써.

### 인터넷 댓글 느낌
- 번역투 ❌ (~~하는 것이 매우 좋았습니다)
- 형식적인 거 ❌ (감사합니다)
- 진짜 인터넷 댓글처럼! 오타도 OK, 줄임말도 OK
- 각 국가 언어로 그 나라 인터넷 스타일로

---

## 출력 형식 (JSON)

{
  "comments": [
    {
      "country": "국가코드",
      "username": "그 나라 스타일 유저네임",
      "comment": "그 나라 언어로 쓴 댓글",
      "sentiment": "positive/neutral/negative",
      "likes": 숫자(0~100)
    }
  ]
}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the comments now.' },
      ],
      temperature: 0.9,  // 높은 창의성
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const comments = parsed.comments || [];

    // 결과 정리 및 국가 정보 추가
    return comments.map((c: { country: string; username: string; comment: string; sentiment: string; likes: number }, idx: number) => {
      const countryInfo = selectedCountries.find(p => p.code === c.country) || selectedCountries[idx % selectedCountries.length];
      return {
        id: `sim-${Date.now()}-${idx}`,
        country: countryInfo.code,
        countryFlag: countryInfo.flag,
        countryName: countryInfo.name,
        username: c.username || `User${idx}`,
        comment: c.comment || '',
        sentiment: c.sentiment || 'neutral',
        likes: c.likes || Math.floor(Math.random() * 50),
      };
    });
  } catch (error) {
    console.error('🔴 [simulateGlobalComments] 에러:', error);
    return [];
  }
}
