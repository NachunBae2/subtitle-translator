import { useState, useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useTranslateStore, SubtitleBlock } from '../../stores/useTranslateStore';
import { useDictionaryStore } from '../../stores/useDictionaryStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useFeedbackStore } from '../feedback/FeedbackTab';
import { parseSRT, SubtitleBlock as SRTBlock, mergeTranslatedChunksWithOriginal } from '../../lib/srt';
import { createChunks, getChunkSummary } from '../../lib/chunker';
import { translateFull } from '../../lib/translator';

export function TranslateTab() {
  const { setStatus, setProgress, setActiveTab, isTranslating, setIsTranslating, createAbortController, cancelTranslation } = useAppStore();
  const { apiKey, model, customSystemPrompt } = useSettingsStore();
  const { koreanBlocks, setKoreanBlocks, setEnglishBlocks, koreanRaw, clearAll } = useTranslateStore();
  const { getActiveTerms, getActiveMemes } = useDictionaryStore();
  const { createProject, setEnglishSRT: saveEnglishSRT } = useProjectStore();
  const { getNotesForPrompt } = useFeedbackStore();

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [inputText, setInputText] = useState(koreanRaw);

  // 영어 자막 직접 업로드
  const [englishFileName, setEnglishFileName] = useState<string>('');
  const [englishInputText, setEnglishInputText] = useState('');

  // Convert SRTBlock to our SubtitleBlock format
  const convertToSubtitleBlocks = (srtBlocks: SRTBlock[]): SubtitleBlock[] => {
    return srtBlocks.map((b) => ({
      id: b.index,
      startTime: b.startTime,
      endTime: b.endTime,
      text: b.text,
    }));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.srt') || file.name.endsWith('.txt'))) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          setInputText(text);
          setFileName(file.name);
        };
        reader.readAsText(file);
      }
    },
    []
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          setInputText(text);
          setFileName(file.name);
        };
        reader.readAsText(file);
      }
    },
    []
  );

  // 영어 자막 파일 업로드 핸들러
  const handleEnglishFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          setEnglishInputText(text);
          setEnglishFileName(file.name);
        };
        reader.readAsText(file);
      }
    },
    []
  );

  // 영어 자막 직접 사용 (번역 없이 바로 검수 탭으로)
  const handleUseEnglishDirectly = () => {
    if (!englishInputText.trim()) return;

    setStatus('processing', '영어 자막 파싱 중...');

    try {
      const srtBlocks = parseSRT(englishInputText);
      if (srtBlocks.length === 0) {
        throw new Error('유효한 자막을 찾을 수 없습니다. SRT 형식을 확인해주세요.');
      }

      const blocks = convertToSubtitleBlocks(srtBlocks);

      // 한글 자막도 있으면 함께 설정, 없으면 영어 자막을 한글 자리에도 설정
      // (검수 탭에서는 koreanBlocks와 englishBlocks 둘 다 필요)
      if (inputText.trim()) {
        const koreanSrtBlocks = parseSRT(inputText);
        const koreanSubtitleBlocks = convertToSubtitleBlocks(koreanSrtBlocks);
        setKoreanBlocks(koreanSubtitleBlocks, inputText, fileName);
      } else {
        // 한글 자막 없으면 영어를 한글 자리에도 설정
        setKoreanBlocks(blocks, englishInputText, englishFileName);
      }

      // 영어 자막 설정
      setEnglishBlocks(blocks, englishInputText);

      // 프로젝트 생성
      const projectName = englishFileName || fileName || `subtitle_${new Date().toISOString().slice(0, 10)}`;
      const projectId = createProject(projectName, inputText || englishInputText);
      saveEnglishSRT(projectId, englishInputText);

      setStatus('success', `영어 자막 로드 완료! ${blocks.length}개 자막. 검수 탭에서 확인하세요.`);
      setProgress(100);

      setTimeout(() => {
        setActiveTab('review');
      }, 300);
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : '자막 파싱 중 오류 발생');
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    const abortController = createAbortController();
    setIsTranslating(true);
    setStatus('processing', '한글 자막 파싱 중...');
    clearAll();

    try {
      // Parse Korean subtitles
      const srtBlocks = parseSRT(inputText);
      if (srtBlocks.length === 0) {
        throw new Error('유효한 자막을 찾을 수 없습니다. SRT 형식을 확인해주세요.');
      }

      const blocks = convertToSubtitleBlocks(srtBlocks);
      setKoreanBlocks(blocks, inputText, fileName);

      // 프로젝트 생성
      const projectName = fileName || `subtitle_${new Date().toISOString().slice(0, 10)}`;
      const projectId = createProject(projectName, inputText);

      // 스마트 청킹 (대화 덩어리 기준)
      const smartChunks = createChunks(srtBlocks);
      const chunkTexts = smartChunks.map(c => c.text);
      setStatus('processing', `${getChunkSummary(smartChunks)}, 병렬 번역 중...`);

      // 피드백 노트 가져오기
      const feedbackNotes = getNotesForPrompt();

      // 용어 사전 생성 (한→영) - 상태바에 표시
      setStatus('processing', '사전 준비 중...');
      const terminology = {
        terms: getActiveTerms('en'),
        rules: getActiveMemes('en').map(m => ({
          pattern: m.pattern,
          replacement: m.replacement,
          description: m.description,
        })),
      };
      const termCount = Object.keys(terminology.terms).length;
      const ruleCount = terminology.rules.length;
      if (termCount > 0 || ruleCount > 0) {
        setStatus('processing', `사전 적용: ${termCount}개 용어, ${ruleCount}개 규칙`);
      }

      // 병렬로 번역
      const results = await translateFull(
        chunkTexts,
        {
          apiKey,
          model,
          customSystemPrompt,
          feedbackNotes,
          terminology,
          targetLang: 'en',
          signal: abortController.signal,
        },
        (current, total, message) => {
          // current < 0 means retry mode, don't update progress
          if (current >= 0 && total > 0) {
            setProgress(Math.round((current / total) * 100));
          }
          setStatus('processing', message);
        }
      );

      // 결과 합치기 (원본 블록 구조 유지 - 1:1 매핑)
      const englishSRTBlocks = mergeTranslatedChunksWithOriginal(srtBlocks, results);
      const englishBlocks = convertToSubtitleBlocks(englishSRTBlocks);

      // 영어 SRT 텍스트 생성
      const englishSRT = englishSRTBlocks
        .map((b) => `${b.index}\n${b.startTime} --> ${b.endTime}\n${b.text}`)
        .join('\n\n');

      setEnglishBlocks(englishBlocks, englishSRT);

      // 프로젝트에 영어 번역 저장
      saveEnglishSRT(projectId, englishSRT);

      setStatus('success', `번역 완료! ${englishBlocks.length}개 자막. 검수 탭에서 확인하세요.`);
      setProgress(100);

      // Navigate to review tab
      setTimeout(() => {
        setActiveTab('review');
      }, 500);
    } catch (error) {
      // 취소된 경우는 이미 cancelTranslation에서 상태가 설정됨
      if (error instanceof Error && error.message === '번역이 취소되었습니다.') {
        return;
      }
      setStatus('error', error instanceof Error ? error.message : '번역 중 오류 발생');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCancel = () => {
    cancelTranslation();
    setStatus('idle', '번역이 취소되었습니다.');
  };

  const hasInput = inputText.trim().length > 0;

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 파일 업로드 영역 */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-icon">📄</span>
          <div>
            <h2 className="card-title">한글 자막 파일 업로드</h2>
            <p className="card-subtitle">SRT 또는 TXT 파일을 끌어다 놓거나, 클릭해서 선택하세요.</p>
          </div>
        </div>
        <div className="card-body">
          <input
            id="korean-file-input"
            type="file"
            accept=".srt,.txt"
            onChange={handleFileSelect}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          />
          <div
            onClick={() => document.getElementById('korean-file-input')?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              border: `2px dashed ${isDragging ? 'var(--color-primary-500)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              textAlign: 'center',
              background: isDragging ? 'rgba(74, 108, 247, 0.1)' : 'rgba(255,255,255,0.02)',
              transition: 'all var(--transition-fast)',
              marginBottom: 'var(--space-4)',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '2rem' }}>📁</div>
            {fileName ? (
              <div style={{ color: 'var(--color-success-500)', fontWeight: 500 }}>✓ {fileName}</div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                {isDragging ? '📥 여기에 놓으세요!' : '클릭하거나 파일을 여기에 드래그'}
              </div>
            )}
          </div>

          <textarea
            className="input textarea"
            placeholder={`1\n00:00:00,000 --> 00:00:02,000\n안녕하세요\n\n2\n00:00:02,000 --> 00:00:05,000\n오늘은 코 잡는 방법을 알려드릴게요`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ minHeight: '200px', fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* 영어 자막 직접 업로드 (선택) */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-icon">🇺🇸</span>
          <div>
            <h2 className="card-title">영어 자막 직접 업로드 (선택)</h2>
            <p className="card-subtitle">이미 영어 자막이 있다면, 번역 없이 바로 검수 탭에서 확인할 수 있습니다.</p>
          </div>
        </div>
        <div className="card-body">
          <input
            id="english-file-input"
            type="file"
            accept=".srt,.txt"
            onChange={handleEnglishFileSelect}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          />
          <div
            onClick={() => document.getElementById('english-file-input')?.click()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              border: '2px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              transition: 'all var(--transition-fast)',
              marginBottom: 'var(--space-4)',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '2rem' }}>🇺🇸</div>
            {englishFileName ? (
              <div style={{ color: 'var(--color-success-500)', fontWeight: 500 }}>✓ {englishFileName}</div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>클릭하거나 파일을 여기에 드래그</div>
            )}
          </div>

          <textarea
            className="input textarea"
            placeholder={`1\n00:00:00,000 --> 00:00:02,000\nHello\n\n2\n00:00:02,000 --> 00:00:05,000\nToday I'll show you how to...`}
            value={englishInputText}
            onChange={(e) => setEnglishInputText(e.target.value)}
            style={{ minHeight: '120px', fontFamily: 'monospace' }}
          />

          {englishInputText.trim() && (
            <button
              className="btn btn-success btn-lg"
              onClick={handleUseEnglishDirectly}
              style={{ marginTop: 'var(--space-4)', width: '100%' }}
            >
              ✓ 영어 자막 사용 → 검수 탭으로 이동
            </button>
          )}
        </div>
      </div>

      {/* 기존 데이터 표시 */}
      {koreanBlocks.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-icon">📋</span>
            <h2 className="card-title">기존 자막 데이터</h2>
          </div>
          <div className="card-body">
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              {koreanBlocks.length}개의 자막 블록이 로드되어 있습니다.
            </p>
            <button
              className="btn btn-ghost"
              onClick={() => {
                clearAll();
                setInputText('');
                setFileName('');
              }}
              style={{ color: 'var(--color-error-500)' }}
            >
              기존 데이터 삭제
            </button>
          </div>
        </div>
      )}

      {/* 번역 버튼 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleTranslate}
          disabled={!hasInput || isTranslating}
          style={{ flex: 1 }}
        >
          {isTranslating ? (
            <>
              <span className="animate-spin" style={{ marginRight: 'var(--space-2)' }}>⏳</span>
              번역 중...
            </>
          ) : (
            <>
              🚀 영어로 번역 시작
            </>
          )}
        </button>
        {isTranslating && (
          <button
            className="btn btn-lg"
            onClick={handleCancel}
            style={{
              background: 'var(--color-error-500)',
              color: 'white',
              minWidth: '120px',
            }}
          >
            ❌ 취소
          </button>
        )}
      </div>
    </div>
  );
}

export default TranslateTab;
