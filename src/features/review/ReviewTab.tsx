import { useState } from 'react';
import { useTranslateStore } from '../../stores/useTranslateStore';
import { useAppStore } from '../../stores/useAppStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useStatsStore } from '../../stores/useStatsStore';

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
  const { getCurrentProject, markEnglishReviewed } = useProjectStore();
  const { addTranslation } = useStatsStore();

  const [editing, setEditing] = useState<EditTarget>(null);
  const [editText, setEditText] = useState('');

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
      setReviewStatus(editing.id, 'edited');
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

  const pendingCount = Object.values(reviewStatus).filter((s) => s === 'pending').length;

  return (
    <div className="review-container">
      {/* 헤더 */}
      <div className="review-header">
        <span className="review-header-info">
          전체 {koreanBlocks.length}개 | 대기 {pendingCount}개
        </span>
        <div className="review-controls">
          <button
            className="btn btn-sm btn-secondary"
            onClick={approveAll}
            disabled={pendingCount === 0}
          >
            전체 승인
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              approveAll();
              const project = getCurrentProject();
              if (project) {
                markEnglishReviewed(project.id);
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
                    {status === 'pending' ? (
                      <button
                        className="review-status-pending"
                        onClick={() => setReviewStatus(en.id, 'approved')}
                      >
                        대기
                      </button>
                    ) : status === 'approved' ? (
                      <span className="review-status-approved">✓ 승인</span>
                    ) : (
                      <span className="review-status-edited">수정됨</span>
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
