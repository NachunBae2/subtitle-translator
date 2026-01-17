import { useState } from 'react';
import { useTranslateStore } from '../../stores/useTranslateStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useDictionaryStore } from '../../stores/useDictionaryStore';
import { useAppStore } from '../../stores/useAppStore';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { translateFull, translateDictionaryTerms, Language, LANGUAGE_NAMES, parseLanguageFromText } from '../../lib/translator';
import { parseSRT, mergeTranslatedChunksWithOriginal } from '../../lib/srt';
import { createChunks, getChunkSummary } from '../../lib/chunker';
import { getFileCode } from '../../lib/languages';
import { isElectron, saveFiles, selectFolder } from '../../lib/fileSystem';

export function MultiLangTab() {
  const { englishBlocks, selectedLanguages, multiLangResults, toggleLanguage, setMultiLangResult, removeMultiLangResult, originalFileName } = useTranslateStore();
  const { apiKey, multiLangModel, outputFolder } = useSettingsStore();
  const { getActiveTermsFromEnglish, getActiveMemesFromEnglish, getEntriesNeedingTranslation, getMemesNeedingTranslation, bulkUpdateEntryTranslations, bulkUpdateMemeTranslations } = useDictionaryStore();
  const { setStatus, setProgress, progress, statusMessage, isMultiLangTranslating, setIsMultiLangTranslating, createAbortController, cancelTranslation } = useAppStore();
  const { languages, getEnabled, addCustomLanguage } = useLanguageStore();
  const { setActiveTab } = useAppStore();
  const { getCurrentProject, addTranslation, setProjectStatus } = useProjectStore();

  const [currentLang, setCurrentLang] = useState<string>('');
  const [langProgress, setLangProgress] = useState<Record<string, 'pending' | 'translating' | 'done'>>({});
  const [viewingLang, setViewingLang] = useState<string>('');
  const [newLangInput, setNewLangInput] = useState('');
  const [isAddingLang, setIsAddingLang] = useState(false);
  const [addLangError, setAddLangError] = useState('');

  // Available languages (excluding English since we translate FROM English)
  const availableLanguages = getEnabled().filter((lang) => lang.code !== 'en');

  // 자연어로 언어 추가
  const handleAddLanguage = async () => {
    if (!newLangInput.trim() || !apiKey) return;

    setIsAddingLang(true);
    setAddLangError('');

    try {
      const langInfo = await parseLanguageFromText(apiKey, newLangInput.trim());
      if (langInfo) {
        const added = addCustomLanguage(langInfo.code, langInfo.name, langInfo.nativeName, langInfo.koreanName, langInfo.fileCode);
        if (added) {
          setNewLangInput('');
          setStatus('success', `[${langInfo.fileCode}] ${langInfo.koreanName} (${langInfo.nativeName}) 추가됨`);
        } else {
          setAddLangError('이미 존재하는 언어입니다');
        }
      } else {
        setAddLangError('언어를 인식하지 못했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      setAddLangError(error instanceof Error ? error.message : '언어 추가 실패');
    } finally {
      setIsAddingLang(false);
    }
  };

  // Generate SRT from englishBlocks (검수 탭에서 수정된 내용 반영)
  const englishSRT = englishBlocks.map((b) =>
    `${b.id}\n${b.startTime} --> ${b.endTime}\n${b.text}`
  ).join('\n\n');

  const handleTranslate = async () => {
    if (selectedLanguages.length === 0) return;

    const abortController = createAbortController();
    setIsMultiLangTranslating(true);
    setProgress(0); // 초기화 - NaN 방지
    setStatus('processing', '다국어 번역 시작...');

    // 초기 진행 상태 설정
    const initialProgress: Record<string, 'pending' | 'translating' | 'done'> = {};
    selectedLanguages.forEach(code => { initialProgress[code] = 'pending'; });
    setLangProgress(initialProgress);

    try {
      // 디버그: 입력 데이터 확인
      console.log('📝 [MultiLang] englishBlocks:', englishBlocks.length);
      console.log('📝 [MultiLang] englishSRT 첫 200자:', englishSRT.substring(0, 200));

      // 영어 SRT를 스마트 청킹 (대화 덩어리 기준)
      const srtBlocks = parseSRT(englishSRT);
      console.log('📝 [MultiLang] srtBlocks:', srtBlocks.length);

      const smartChunks = createChunks(srtBlocks);
      console.log('📝 [MultiLang] smartChunks:', smartChunks.length);

      const chunkTexts = smartChunks.map(c => c.text);
      console.log('📝 [MultiLang] chunkTexts:', chunkTexts.length, '첫 청크:', chunkTexts[0]?.substring(0, 100));

      const failedLangs: string[] = [];

      // 언어별 순차 처리 (언어 내부는 청크 병렬, 실패 시 재시도)
      const MAX_LANG_RETRIES = 5; // 언어당 최대 재시도 횟수

      for (let i = 0; i < selectedLanguages.length; i++) {
        // 취소 확인
        if (abortController.signal.aborted) {
          throw new Error('번역이 취소되었습니다.');
        }

        const langCode = selectedLanguages[i];
        const langName = LANGUAGE_NAMES[langCode as Language] || langCode;

        let langSuccess = false;
        let langAttempt = 0;

        while (!langSuccess && langAttempt < MAX_LANG_RETRIES) {
          // 취소 확인
          if (abortController.signal.aborted) {
            throw new Error('번역이 취소되었습니다.');
          }

          langAttempt++;
          setCurrentLang(langCode);
          setLangProgress(prev => ({ ...prev, [langCode]: 'translating' }));

          const attemptMsg = langAttempt > 1 ? ` (재시도 ${langAttempt}/${MAX_LANG_RETRIES})` : '';
          setStatus('processing', `[${i + 1}/${selectedLanguages.length}] ${langName} 번역 중${attemptMsg}... (${getChunkSummary(smartChunks)})`);

          try {
            // 1단계: 번역 안 된 용어들 먼저 번역해서 Terminology/MemeNote에 저장
            const entriesNeedingTranslation = getEntriesNeedingTranslation(langCode);
            const memesNeedingTranslation = getMemesNeedingTranslation(langCode);

            console.log(`📚 [Terminology Auto] ${langCode}: 번역 필요한 용어 ${entriesNeedingTranslation.length}개, 밈 ${memesNeedingTranslation.length}개`);
            if (entriesNeedingTranslation.length > 0) {
              console.log(`📚 [Terminology Auto] 첫 번째 항목:`, entriesNeedingTranslation[0]);
            }

            if (entriesNeedingTranslation.length > 0 || memesNeedingTranslation.length > 0) {
              setStatus('processing', `[${i + 1}/${selectedLanguages.length}] ${langName}: 용어 ${entriesNeedingTranslation.length}개 + 밈 ${memesNeedingTranslation.length}개 번역 중...`);

              // 용어 번역
              if (entriesNeedingTranslation.length > 0) {
                const termResults = await translateDictionaryTerms(
                  apiKey,
                  entriesNeedingTranslation.map(e => ({ korean: e.korean, english: e.english })),
                  langCode,
                  'gpt-4.1-mini',
                  abortController.signal
                );
                // Terminology 탭에 저장
                if (termResults.length > 0) {
                  console.log(`📚 [Terminology Auto] ${langCode}: ${termResults.length}개 용어 저장 중...`, termResults);
                  bulkUpdateEntryTranslations(termResults.map(r => ({
                    korean: r.korean,
                    langCode,
                    translation: r.translation,
                  })));
                  console.log(`📚 [Terminology Auto] ${langCode}: 저장 완료!`);
                }
              }

              // 밈 번역
              if (memesNeedingTranslation.length > 0) {
                const memeResults = await translateDictionaryTerms(
                  apiKey,
                  memesNeedingTranslation.map(m => ({ korean: m.korean, english: m.english })),
                  langCode,
                  'gpt-4.1-mini',
                  abortController.signal
                );
                // MemeNote 탭에 저장
                if (memeResults.length > 0) {
                  bulkUpdateMemeTranslations(memeResults.map(r => ({
                    korean: r.korean,
                    langCode,
                    translation: r.translation,
                  })));
                }
              }

              setStatus('processing', `[${i + 1}/${selectedLanguages.length}] ${langName}: 용어/밈 번역 완료, 저장됨`);
            }

            // 2단계: 채워진 용어로 자막 번역
            const terminology = {
              terms: getActiveTermsFromEnglish(langCode),
              rules: getActiveMemesFromEnglish(langCode).map(m => ({
                pattern: m.pattern,
                replacement: m.replacement,
                description: m.description,
              })),
            };
            const termCount = Object.keys(terminology.terms).length;
            const ruleCount = terminology.rules.length;
            if (termCount > 0 || ruleCount > 0) {
              setStatus('processing', `[${i + 1}/${selectedLanguages.length}] ${langName}: ${termCount}개 용어, ${ruleCount}개 규칙 적용`);
            }

            // 청크 병렬 번역 (다국어는 고품질 모델 사용)
            console.log('📝 [MultiLang] translateFull 호출 시작, 모델:', multiLangModel, '타겟:', langCode);
            const results = await translateFull(
              chunkTexts,
              {
                apiKey,
                model: multiLangModel,
                terminology,
                targetLang: langCode as Language,
                sourceLang: 'en',
                signal: abortController.signal,
              },
              (current, total, message) => {
                // current < 0 means retry mode, don't update progress
                if (current >= 0 && total > 0) {
                  const langBase = (i / selectedLanguages.length) * 100;
                  const langPortion = (1 / selectedLanguages.length) * 100;
                  const chunkProgress = (current / total) * langPortion;
                  setProgress(Math.round(langBase + chunkProgress));
                }
                setStatus('processing', `[${i + 1}/${selectedLanguages.length}] ${langName}: ${message}`);
              }
            );

            console.log('📝 [MultiLang] translateFull 완료, results 개수:', results.length);
            if (results.length > 0) {
              console.log('📝 [MultiLang] 첫 결과 100자:', results[0]?.substring(0, 100));
            }

            // 청크 결과 합치기 (원본 블록 구조 유지 - 1:1 매핑)
            const mergedBlocks = mergeTranslatedChunksWithOriginal(srtBlocks, results);
            console.log('📝 [MultiLang] mergedBlocks:', mergedBlocks.length);

            const finalSRT = mergedBlocks
              .map((b) => `${b.index}\n${b.startTime} --> ${b.endTime}\n${b.text}`)
              .join('\n\n');

            console.log('📝 [MultiLang] finalSRT 첫 200자:', finalSRT.substring(0, 200));
            setMultiLangResult(langCode, finalSRT);
            setLangProgress(prev => ({ ...prev, [langCode]: 'done' }));

            // 프로젝트에 번역 결과 저장
            const currentProject = getCurrentProject();
            if (currentProject) {
              const fileCode = getFileCode(languages, langCode);
              addTranslation(currentProject.id, {
                langCode,
                fileCode,
                content: finalSRT,
                completedAt: new Date().toISOString(),
              });
            }

            langSuccess = true; // 성공!
          } catch (langError) {
            // 취소된 경우 바로 throw
            if (abortController.signal.aborted || (langError instanceof Error && langError.message === '번역이 취소되었습니다.')) {
              throw new Error('번역이 취소되었습니다.');
            }

            console.error(`🔴 [MultiLang] ${langName} 번역 실패 (시도 ${langAttempt}):`, langError);
            console.error('🔴 [MultiLang] 에러 상세:', langError instanceof Error ? langError.stack : langError);

            if (langAttempt < MAX_LANG_RETRIES) {
              // 재시도 전 대기
              const waitTime = Math.min(2000 * langAttempt, 10000);
              setStatus('processing', `${langName} 실패, ${waitTime / 1000}초 후 재시도...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              // 최대 재시도 초과
              failedLangs.push(langName);
              setLangProgress(prev => ({ ...prev, [langCode]: 'pending' }));
            }
          }
        }

        setProgress(Math.round(((i + 1) / selectedLanguages.length) * 100));
      }

      // 프로젝트 상태를 완료로 변경
      const project = getCurrentProject();
      if (project) {
        setProjectStatus(project.id, 'completed');
      }

      // Electron: 자동으로 파일 저장
      if (isElectron() && outputFolder) {
        setStatus('processing', '파일 저장 중...');
        const baseName = originalFileName || 'subtitle';
        const currentProject = getCurrentProject();
        const filesToSave = [
          // 한글 원본
          ...(currentProject?.koreanSRT ? [{ fileName: `[KOR]_${baseName}.srt`, content: currentProject.koreanSRT }] : []),
          // 영어
          { fileName: `[ENG]_${baseName}.srt`, content: englishSRT },
          // 다국어
          ...selectedLanguages.map((langCode) => ({
            fileName: getFileName(langCode),
            content: multiLangResults[langCode] || '',
          })),
        ].filter((f) => f.content);

        const saveResult = await saveFiles(outputFolder, filesToSave);
        if (saveResult.success) {
          setStatus('success', `번역 완료! ${saveResult.count}개 파일 저장됨: ${outputFolder}`);
        } else {
          setStatus('error', `파일 저장 실패: ${saveResult.error}`);
        }
      } else {
        const successCount = selectedLanguages.length - failedLangs.length;
        if (failedLangs.length > 0) {
          setStatus('warning', `${successCount}개 완료, ${failedLangs.length}개 실패 (${failedLangs.join(', ')})`);
        } else {
          setStatus('success', `다국어 번역 완료! ${selectedLanguages.length}개 언어`);
        }
      }
      setProgress(100);
    } catch (error) {
      // 취소된 경우는 이미 cancelTranslation에서 상태가 설정됨
      if (error instanceof Error && error.message === '번역이 취소되었습니다.') {
        return;
      }
      setStatus('error', error instanceof Error ? error.message : '번역 중 오류 발생');
    } finally {
      setIsMultiLangTranslating(false);
      setCurrentLang('');
    }
  };

  const handleCancel = () => {
    cancelTranslation();
    setStatus('idle', '번역이 취소되었습니다.');
    setCurrentLang('');
    // Reset language progress
    const resetProgress: Record<string, 'pending' | 'translating' | 'done'> = {};
    selectedLanguages.forEach(code => {
      resetProgress[code] = multiLangResults[code] ? 'done' : 'pending';
    });
    setLangProgress(resetProgress);
  };

  // 파일명: [언어코드]_[원본파일명].srt
  const getFileName = (langCode: string) => {
    const fileCode = getFileCode(languages, langCode);
    const baseName = originalFileName || 'subtitle';
    return `[${fileCode}]_${baseName}.srt`;
  };

  const handleDownload = (langCode: string) => {
    const content = multiLangResults[langCode];
    if (!content) return;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFileName(langCode);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const baseName = originalFileName || 'subtitle';
    const project = getCurrentProject();
    // 한글 + 영어 + 다국어 모두 포함
    const files = [
      // 한글 원본
      ...(project?.koreanSRT ? [{ fileName: `[KOR]_${baseName}.srt`, content: project.koreanSRT }] : []),
      // 영어
      { fileName: `[ENG]_${baseName}.srt`, content: englishSRT },
      // 다국어
      ...Object.entries(multiLangResults).map(([langCode, content]) => ({
        fileName: getFileName(langCode),
        content,
      })),
    ].filter(f => f.content);

    if (isElectron()) {
      // Electron: 폴더 선택 후 저장
      const folder = outputFolder || await selectFolder();
      if (folder) {
        const result = await saveFiles(folder, files);
        if (result.success) {
          setStatus('success', `${result.count}개 파일 저장 완료: ${folder}`);
        } else {
          setStatus('error', `저장 실패: ${result.error}`);
        }
      }
    } else {
      // 브라우저: 지연 다운로드
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      for (const file of files) {
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await delay(300);
      }
    }
  };

  if (englishBlocks.length === 0) {
    return (
      <div className="animate-slide-up" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <div style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>🌍</div>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>영어 자막이 없습니다</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
          먼저 한글 자막을 영어로 번역하고 검수해주세요.
        </p>
        <button className="btn btn-primary" onClick={() => setActiveTab('translate')}>
          번역 탭으로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Language Selection */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-icon">🌍</span>
          <div>
            <h2 className="card-title">번역할 언어 선택</h2>
            <p className="card-subtitle">영어 자막을 번역할 언어를 선택하세요</p>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {availableLanguages.map((lang) => {
              const isSelected = selectedLanguages.includes(lang.code);
              const hasResult = !!multiLangResults[lang.code];
              const status = langProgress[lang.code];
              return (
                <button
                  key={lang.code}
                  onClick={() => !isMultiLangTranslating && toggleLanguage(lang.code)}
                  disabled={isMultiLangTranslating}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    fontSize: 'var(--text-sm)',
                    position: 'relative',
                    opacity: isMultiLangTranslating && !isSelected ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginRight: '4px' }}>
                    [{lang.fileCode}]
                  </span>
                  {lang.koreanName || lang.name}
                  <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginLeft: '4px' }}>
                    ({lang.nativeName})
                  </span>
                  {status === 'translating' && (
                    <span className="animate-spin" style={{ marginLeft: '4px' }}>⏳</span>
                  )}
                  {(hasResult || status === 'done') && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--color-success-500)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      color: 'white',
                    }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
          <p style={{ marginTop: 'var(--space-3)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {selectedLanguages.length}개 언어 선택됨 |
            {Object.keys(multiLangResults).length}개 번역 완료
          </p>

          {/* 자연어로 언어 추가 */}
          <div style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <p style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              언어 추가 (자연어 입력)
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                className="input"
                placeholder="예: 일본어, Japanese, 日本語, pt-br..."
                value={newLangInput}
                onChange={(e) => setNewLangInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLanguage()}
                disabled={isAddingLang || !apiKey}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleAddLanguage}
                disabled={isAddingLang || !newLangInput.trim() || !apiKey}
              >
                {isAddingLang ? '⏳' : '➕ 추가'}
              </button>
            </div>
            {addLangError && (
              <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-error-500)' }}>
                {addLangError}
              </p>
            )}
            {!apiKey && (
              <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-warning-500)' }}>
                API 키가 필요합니다
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Translation Status / Progress */}
      {isMultiLangTranslating && (
        <div className="card">
          <div className="card-body" style={{ padding: 'var(--space-6)' }}>
            {/* Progress Bar */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)',
              }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  {currentLang && LANGUAGE_NAMES[currentLang as Language]} 번역 중
                </span>
                <span style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                  color: 'var(--color-primary-500)',
                }}>
                  {isNaN(progress) ? 0 : progress}%
                </span>
              </div>
              {/* Progress bar track */}
              <div style={{
                width: '100%',
                height: '12px',
                background: 'rgba(124, 58, 237, 0.1)',
                borderRadius: '6px',
                overflow: 'hidden',
              }}>
                {/* Progress bar fill */}
                <div style={{
                  width: `${isNaN(progress) ? 0 : progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                  borderRadius: '6px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
            {/* Status message */}
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              textAlign: 'center',
              margin: 0,
            }}>
              {statusMessage || '잠시만 기다려주세요'}
            </p>
          </div>
        </div>
      )}

      {/* Translate Button */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleTranslate}
          disabled={selectedLanguages.length === 0 || isMultiLangTranslating}
          style={{ flex: 1 }}
        >
          {isMultiLangTranslating ? (
            <>
              <span className="animate-spin" style={{ marginRight: 'var(--space-2)' }}>⏳</span>
              번역 중...
            </>
          ) : (
            <>
              🚀 {selectedLanguages.length}개 언어로 번역 시작
            </>
          )}
        </button>
        {isMultiLangTranslating && (
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

      {/* Results - List View */}
      {Object.keys(multiLangResults).length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-icon">📦</span>
            <div>
              <h2 className="card-title">번역 결과</h2>
              <p className="card-subtitle">{Object.keys(multiLangResults).length}개 언어 번역 완료</p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDownloadAll}
              style={{ marginLeft: 'auto' }}
            >
              📥 전체 다운로드
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {/* Language list */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Object.keys(multiLangResults).map((langCode, index) => {
                const langData = languages.find(l => l.code === langCode);
                const fileCode = langData?.fileCode || getFileCode(languages, langCode);
                const koreanName = langData?.koreanName || LANGUAGE_NAMES[langCode as Language] || langCode;
                const nativeName = langData?.nativeName || langCode;
                const isSelected = viewingLang === langCode;
                const lineCount = (multiLangResults[langCode].match(/\n/g) || []).length + 1;

                return (
                  <div
                    key={langCode}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: index < Object.keys(multiLangResults).length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: isSelected ? 'var(--surface-secondary)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onClick={() => setViewingLang(isSelected ? '' : langCode)}
                  >
                    {/* 언어 코드 배지 */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '50px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: 'var(--color-primary-100)',
                        color: 'var(--color-primary-600)',
                        fontSize: '11px',
                        fontWeight: 600,
                        marginRight: '12px',
                      }}
                    >
                      {fileCode}
                    </span>

                    {/* 언어명 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>
                        {koreanName} <span style={{ opacity: 0.6 }}>({nativeName})</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {getFileName(langCode)} · {lineCount} lines
                      </div>
                    </div>

                    {/* 완료 표시 */}
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'var(--color-success-100)',
                        color: 'var(--color-success-600)',
                        fontSize: '11px',
                        marginRight: '12px',
                      }}
                    >
                      ✓ 완료
                    </span>

                    {/* 액션 버튼들 */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(langCode);
                        }}
                        style={{ padding: '6px 10px' }}
                        title="다운로드"
                      >
                        📥
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`${koreanName} 번역을 삭제하시겠습니까?`)) {
                            removeMultiLangResult(langCode);
                            if (viewingLang === langCode) setViewingLang('');
                          }
                        }}
                        style={{ padding: '6px 10px', color: 'var(--color-error-500)' }}
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 선택된 언어 미리보기 */}
      {viewingLang && multiLangResults[viewingLang] && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-icon">👁️</span>
            <div>
              <h2 className="card-title">
                [{getFileCode(languages, viewingLang)}] {LANGUAGE_NAMES[viewingLang as Language] || viewingLang}
              </h2>
              <p className="card-subtitle">{getFileName(viewingLang)}</p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleDownload(viewingLang)}
              >
                📥 다운로드
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setViewingLang('')}
              >
                ✕ 닫기
              </button>
            </div>
          </div>
          <div className="card-body">
            <textarea
              className="input textarea"
              value={multiLangResults[viewingLang]}
              readOnly
              style={{
                minHeight: '300px',
                fontFamily: 'monospace',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiLangTab;
