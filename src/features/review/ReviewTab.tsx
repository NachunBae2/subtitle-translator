import { useState } from 'react';
import { useTranslateStore } from '../../stores/useTranslateStore';
import { useAppStore } from '../../stores/useAppStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useStatsStore } from '../../stores/useStatsStore';
import { isElectron, renameFilesBatch } from '../../lib/fileSystem';

type EditTarget = { id: number; type: 'korean' | 'english' } | null;

export function ReviewTab() {
  const {
    koreanBlocks,
    englishBlocks,
    reviewStatus,
    updateEnglishBlock,
    setReviewStatus,
    approveAll,
    clearAll,
    _hasHydrated,
  } = useTranslateStore();
  const { setActiveTab } = useAppStore();
  const { getCurrentProject, markEnglishReviewed, setEnglishSRT, updateProjectName } = useProjectStore();
  const { addTranslation } = useStatsStore();

  const [editing, setEditing] = useState<EditTarget>(null);
  const [editText, setEditText] = useState('');
  const [editingFileName, setEditingFileName] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');

  // 프로젝트 폴더 경로 계산
  const getProjectFolder = (baseFolder: string, projectName: string) => {
    const cleanName = projectName.replace(/\.(srt|txt)$/i, '');
    return `${baseFolder}/${cleanName}`;
  };

  // 파일명 변경 처리 (파일 rename 포함)
  const handleFileNameSave = async () => {
    const project = getCurrentProject();
    if (!project || !fileNameInput.trim()) {
      setEditingFileName(false);
      return;
    }

    const newName = fileNameInput.trim();
    const oldBaseName = project.name.replace(/\.(srt|txt)$/i, '');
    const newBaseName = newName.replace(/\.(srt|txt)$/i, '');

    if (oldBaseName === newBaseName) {
      setEditingFileName(false);
      return;
    }

    // 바인딩된 폴더가 있으면 파일도 rename
    if (project.boundFolder && isElectron()) {
      const projectFolder = getProjectFolder(project.boundFolder, project.name);
      const renames: { oldFileName: string; newFileName: string }[] = [];

      if (project.englishSRT) {
        renames.push({
          oldFileName: `[ENG]_${oldBaseName}.srt`,
          newFileName: `[ENG]_${newBaseName}.srt`,
        });
      }
      renames.push({
        oldFileName: `[KOR]_${oldBaseName}.srt`,
        newFileName: `[KOR]_${newBaseName}.srt`,
      });
      project.translations.forEach((t) => {
        renames.push({
          oldFileName: `[${t.fileCode}]_${oldBaseName}.srt`,
          newFileName: `[${t.fileCode}]_${newBaseName}.srt`,
        });
      });

      await renameFilesBatch(projectFolder, renames);
    }

    updateProjectName(project.id, newName);
    setEditingFileName(false);
  };

  // 한글 블록 수정 (로컬에서만, 스토어 업데이트는 나중에 필요하면 추가)
  const [localKoreanEdits, setLocalKoreanEdits] = useState<Record<number, string>>({});

  const handleEdit = (id: number, type: 'korean' | 'english', text: string) => {
    setEditing({ id, type });
    setEditText(text);
  };

  const handleSave = () => {
    if (!editing) return;

    if (editing.type === 'english') {
      updateEnglishBlock(editing.id, editText);
      // 수정하면 검수중 상태로 돌아감
      setReviewStatus(editing.id, 'pending');

      // 프로젝트 영어 SRT 실시간 동기화
      const project = getCurrentProject();
      if (project) {
        const updatedBlocks = englishBlocks.map((b) =>
          b.id === editing.id ? { ...b, text: editText } : b
        );
        const newEnglishSRT = updatedBlocks.map((b) =>
          `${b.id}\n${b.startTime} --> ${b.endTime}\n${b.text}`
        ).join('\n\n');
        setEnglishSRT(project.id, newEnglishSRT);
      }
    } else {
      // 한글은 로컬에만 저장 (나중에 스토어 업데이트 함수 추가 가능)
      setLocalKoreanEdits(prev => ({ ...prev, [editing.id]: editText }));
    }
    setEditing(null);
    setEditText('');
  };

  const handleCancel = () => {
    setEditing(null);
    setEditText('');
  };

  const getKoreanText = (id: number, originalText: string) => {
    return localKoreanEdits[id] ?? originalText;
  };

  // 수화 대기 중
  if (!_hasHydrated) {
    return (
      <div className="review-empty">
        <div className="review-empty-icon">⏳</div>
        <h2 className="review-empty-title">데이터 로딩 중...</h2>
      </div>
    );
  }

  // 데이터 없으면
  if (koreanBlocks.length === 0 || englishBlocks.length === 0) {
    return (
      <div className="review-empty">
        <div className="review-empty-icon">🔍</div>
        <h2 className="review-empty-title">검수할 자막이 없습니다</h2>
        <p className="review-empty-desc">번역 탭에서 자막을 번역하세요.</p>
        <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('translate')}>
          번역 탭으로
        </button>
      </div>
    );
  }

  // 블록 수 불일치
  if (koreanBlocks.length !== englishBlocks.length) {
    return (
      <div className="review-empty">
        <div className="review-empty-icon">⚠️</div>
        <h2 className="review-empty-title error">블록 수 불일치</h2>
        <p className="review-empty-desc">
          한글: {koreanBlocks.length}개 / 영어: {englishBlocks.length}개
        </p>
        <p className="review-empty-desc">데이터 손상. 초기화 후 다시 번역하세요.</p>
        <button
          className="btn btn-secondary"
          onClick={() => {
            clearAll();
            setActiveTab('translate');
          }}
        >
          초기화
        </button>
      </div>
    );
  }

  // 검수중 (pending/edited) 카운트 - 검수완료되지 않은 모든 항목
  const reviewingCount = Object.values(reviewStatus).filter((s) => s !== 'approved').length;

  // 빈 행 감지
  const emptyBlocks = englishBlocks.filter((b) => !b.text || b.text.trim() === '');
  const emptyCount = emptyBlocks.length;

  const project = getCurrentProject();

  return (
    <div className="review-container">
      {/* 파일명 편집 */}
      {project && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          marginBottom: 12,
          background: 'var(--color-bg-secondary)',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
        }}>
          <span style={{ fontSize: 18 }}>📄</span>
          {editingFileName ? (
            <input
              value={fileNameInput}
              onChange={(e) => setFileNameInput(e.target.value)}
              onBlur={handleFileNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFileNameSave();
                if (e.key === 'Escape') setEditingFileName(false);
              }}
              autoFocus
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 600,
                padding: '6px 10px',
                border: '2px solid var(--color-primary)',
                borderRadius: 4,
                outline: 'none',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          ) : (
            <span
              onClick={() => {
                setEditingFileName(true);
                setFileNameInput(project.name.replace(/\.(srt|txt)$/i, ''));
              }}
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                padding: '6px 0',
              }}
              title="클릭하여 파일명 수정"
            >
              {project.name.replace(/\.(srt|txt)$/i, '')}
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            .srt
          </span>
        </div>
      )}

      {/* 헤더 */}
      <div className="review-header">
        <span className="review-header-info">
          전체 {koreanBlocks.length}개 | 검수중 {reviewingCount}개
          {emptyCount > 0 && (
            <span style={{
              marginLeft: '8px',
              color: 'var(--color-error-500)',
              fontWeight: 600
            }}>
              ⚠️ 빈 행 {emptyCount}개
            </span>
          )}
        </span>
        <div className="review-controls">
          <button
            className="btn btn-sm btn-secondary"
            onClick={approveAll}
            disabled={reviewingCount === 0}
          >
            전체 검수완료
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              approveAll();
              const currentProject = getCurrentProject();
              if (currentProject) {
                // 최신 englishSRT 동기화
                const latestEnglishSRT = englishBlocks.map((b) =>
                  `${b.id}\n${b.startTime} --> ${b.endTime}\n${b.text}`
                ).join('\n\n');
                setEnglishSRT(currentProject.id, latestEnglishSRT);
                markEnglishReviewed(currentProject.id);
                // 통계 기록: 문장 수 = 블록 수, 단어 수 = 영어 텍스트 단어 계산
                const totalWords = englishBlocks.reduce((sum, b) => sum + b.text.split(/\s+/).filter(Boolean).length, 0);
                addTranslation(englishBlocks.length, totalWords, 'en');
              }
              setActiveTab('multilang');
            }}
          >
            다국어 번역 →
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="review-table-wrapper">
        <table className="review-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th>🇰🇷 한글</th>
              <th>🇺🇸 영어</th>
              <th className="col-action"></th>
            </tr>
          </thead>
          <tbody>
            {koreanBlocks.map((ko, idx) => {
              const en = englishBlocks[idx];
              const status = reviewStatus[en.id] || 'pending';
              const isEditingKorean = editing?.id === ko.id && editing?.type === 'korean';
              const isEditingEnglish = editing?.id === en.id && editing?.type === 'english';
              const koreanText = getKoreanText(ko.id, ko.text);

              return (
                <tr key={ko.id}>
                  {/* 번호 */}
                  <td className="col-num">{ko.id}</td>

                  {/* 한글 */}
                  <td>
                    <div className="subtitle-time">
                      {ko.startTime} → {ko.endTime}
                    </div>
                    {isEditingKorean ? (
                      <div>
                        <textarea
                          className="review-edit-textarea"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSave();
                            } else if (e.key === 'Escape') {
                              handleCancel();
                            }
                          }}
                          autoFocus
                        />
                        <div className="review-edit-buttons">
                          <button className="review-edit-save" onClick={handleSave}>
                            저장
                          </button>
                          <button className="review-edit-cancel" onClick={handleCancel}>
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="subtitle-text editable"
                        onClick={() => handleEdit(ko.id, 'korean', koreanText)}
                        title="클릭하여 수정"
                      >
                        {koreanText}
                      </div>
                    )}
                  </td>

                  {/* 영어 */}
                  <td>
                    <div className="subtitle-time">
                      {en.startTime} → {en.endTime}
                    </div>
                    {isEditingEnglish ? (
                      <div>
                        <textarea
                          className="review-edit-textarea"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSave();
                            } else if (e.key === 'Escape') {
                              handleCancel();
                            }
                          }}
                          autoFocus
                        />
                        <div className="review-edit-buttons">
                          <button className="review-edit-save" onClick={handleSave}>
                            저장
                          </button>
                          <button className="review-edit-cancel" onClick={handleCancel}>
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`subtitle-text editable ${!en.text ? 'empty' : ''}`}
                        onClick={() => handleEdit(en.id, 'english', en.text)}
                        title="클릭하여 수정"
                      >
                        {en.text || '클릭하여 번역 입력...'}
                      </div>
                    )}
                  </td>

                  {/* 상태 */}
                  <td className="col-action">
                    {status === 'approved' ? (
                      <button
                        className="review-status-approved"
                        onClick={() => setReviewStatus(en.id, 'pending')}
                        title="클릭하여 검수중으로 변경"
                      >
                        ✓ 검수완료
                      </button>
                    ) : (
                      <button
                        className="review-status-pending"
                        onClick={() => setReviewStatus(en.id, 'approved')}
                      >
                        검수중
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ReviewTab;
