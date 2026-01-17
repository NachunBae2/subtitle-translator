import { useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 번역 피드백 노트 타입
interface TranslationNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 피드백 스토어
interface FeedbackState {
  notes: TranslationNote[];
  globalNote: string; // 항상 적용되는 전역 노트
  addNote: (content: string) => void;
  updateNote: (id: string, content: string) => void;
  removeNote: (id: string) => void;
  setGlobalNote: (content: string) => void;
  getNotesForPrompt: () => string; // GPT 프롬프트에 포함할 내용
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      notes: [],
      globalNote: '',

      addNote: (content) => set((state) => ({
        notes: [
          {
            id: Date.now().toString(),
            content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...state.notes,
        ],
      })),

      updateNote: (id, content) => set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n
        ),
      })),

      removeNote: (id) => set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
      })),

      setGlobalNote: (content) => set({ globalNote: content }),

      getNotesForPrompt: () => {
        const { notes, globalNote } = get();
        const parts: string[] = [];

        if (globalNote.trim()) {
          parts.push(`[번역 시 항상 참고할 내용]\n${globalNote}`);
        }

        if (notes.length > 0) {
          const recentNotes = notes.slice(0, 10); // 최근 10개만
          const noteTexts = recentNotes.map((n) => `- ${n.content}`).join('\n');
          parts.push(`[번역 시 주의사항 (검수 중 발견된 패턴)]\n${noteTexts}`);
        }

        return parts.join('\n\n');
      },
    }),
    { name: 'subtitle-translator-feedback' }
  )
);

export function FeedbackTab() {
  const { notes, globalNote, addNote, updateNote, removeNote, setGlobalNote, getNotesForPrompt } = useFeedbackStore();
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNote(newNote.trim());
    setNewNote('');
  };

  const handleStartEdit = (note: TranslationNote) => {
    setEditingId(note.id);
    setEditingContent(note.content);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingContent.trim()) return;
    updateNote(editingId, editingContent.trim());
    setEditingId(null);
    setEditingContent('');
  };

  const promptPreview = getNotesForPrompt();

  return (
    <div className="feedback-container">
      {/* 헤더 */}
      <div className="feedback-header">
        <div className="feedback-header-text">
          <h2>번역 피드백 노트</h2>
          <p>검수 중 발견한 반복적인 실수, 선호하는 표현 등을 기록하세요. 다음 번역 시 AI가 참고합니다.</p>
        </div>
        <button
          className={`btn btn-sm ${showPreview ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? '편집' : '프롬프트 미리보기'}
        </button>
      </div>

      {showPreview ? (
        /* 프롬프트 미리보기 */
        <div className="preview-box">
          <div className="preview-label">AI에게 전달되는 내용 미리보기</div>
          <pre className="preview-content">
            {promptPreview || '(등록된 피드백이 없습니다)'}
          </pre>
        </div>
      ) : (
        <>
          {/* 전역 노트 */}
          <div className="feedback-section">
            <div className="section-header">
              <span className="section-icon">📌</span>
              <div className="section-title">
                <span>항상 적용되는 노트</span>
                <span className="section-hint">매 번역마다 AI에게 전달됩니다</span>
              </div>
            </div>
            <textarea
              className="input input-sm global-note"
              value={globalNote}
              onChange={(e) => setGlobalNote(e.target.value)}
              placeholder="예: 존댓말로 번역해주세요. 'you'는 '여러분'으로 표현해주세요. 문장이 너무 길면 두 줄로 나눠주세요."
              rows={3}
            />
          </div>

          {/* 개별 노트 추가 */}
          <div className="feedback-section">
            <div className="section-header">
              <span className="section-icon">📝</span>
              <div className="section-title">
                <span>검수 피드백</span>
                <span className="section-hint">반복되는 실수, 개선이 필요한 패턴 등을 기록</span>
              </div>
            </div>

            <div className="add-note-row">
              <input
                className="input input-sm"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="예: '뜨다'를 'cast on'이 아니라 'create stitches'로 번역해야 함"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button className="btn btn-sm btn-primary" onClick={handleAddNote} disabled={!newNote.trim()}>
                추가
              </button>
            </div>

            {/* 노트 목록 */}
            <div className="notes-list">
              {notes.length === 0 ? (
                <div className="notes-empty">
                  <span>등록된 피드백이 없습니다</span>
                  <p>검수하면서 발견한 반복적인 실수나 선호 표현을 기록해두세요.</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="note-item">
                    {editingId === note.id ? (
                      <div className="note-edit">
                        <input
                          className="input input-sm"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        />
                        <button className="btn btn-xs btn-primary" onClick={handleSaveEdit}>저장</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => setEditingId(null)}>취소</button>
                      </div>
                    ) : (
                      <>
                        <span className="note-content">{note.content}</span>
                        <div className="note-actions">
                          <span className="note-date">
                            {new Date(note.updatedAt).toLocaleDateString('ko-KR')}
                          </span>
                          <button className="btn btn-xs btn-ghost" onClick={() => handleStartEdit(note)}>수정</button>
                          <button className="btn btn-xs btn-ghost danger" onClick={() => removeNote(note.id)}>삭제</button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 도움말 */}
          <div className="help-box">
            <div className="help-icon">💡</div>
            <div className="help-content">
              <strong>이렇게 활용하세요</strong>
              <ul>
                <li>"~를 ~로 번역해야 함" - 잘못 번역되는 패턴 기록</li>
                <li>"이 채널은 반말 톤을 사용" - 톤/스타일 지정</li>
                <li>"숫자는 한글로 표기" - 포맷 규칙 지정</li>
                <li>"고유명사 ABC는 그대로 표기" - 예외 처리</li>
              </ul>
            </div>
          </div>
        </>
      )}

      <style>{`
        .feedback-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 700px;
          margin: 0 auto;
        }

        .feedback-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .feedback-header-text h2 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }
        .feedback-header-text p {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }

        .preview-box {
          background: var(--surface-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 16px;
        }
        .preview-label {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .preview-content {
          font-family: monospace;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
          margin: 0;
          color: var(--text-primary);
        }

        .feedback-section {
          background: var(--surface-primary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 16px;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 12px;
        }
        .section-icon {
          font-size: 18px;
        }
        .section-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .section-title span:first-child {
          font-weight: 500;
          font-size: 14px;
        }
        .section-hint {
          font-size: 12px;
          color: var(--text-muted);
        }

        .global-note {
          width: 100%;
          resize: vertical;
        }

        .add-note-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .add-note-row .input {
          flex: 1;
        }

        .notes-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
        }

        .notes-empty {
          text-align: center;
          padding: 24px;
          color: var(--text-muted);
        }
        .notes-empty span {
          display: block;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .notes-empty p {
          margin: 0;
          font-size: 12px;
        }

        .note-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          background: var(--surface-secondary);
          border-radius: 6px;
          font-size: 13px;
        }
        .note-content {
          flex: 1;
          color: var(--text-primary);
        }
        .note-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .note-date {
          font-size: 11px;
          color: var(--text-muted);
        }
        .note-edit {
          display: flex;
          gap: 6px;
          flex: 1;
        }
        .note-edit .input {
          flex: 1;
        }

        .help-box {
          display: flex;
          gap: 12px;
          padding: 14px;
          background: var(--color-primary-500)10;
          border: 1px solid var(--color-primary-500)30;
          border-radius: 8px;
        }
        .help-icon {
          font-size: 20px;
        }
        .help-content {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .help-content strong {
          display: block;
          margin-bottom: 6px;
          color: var(--text-primary);
        }
        .help-content ul {
          margin: 0;
          padding-left: 16px;
          line-height: 1.6;
        }

        .btn-xs {
          padding: 2px 8px;
          font-size: 11px;
        }
        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }
        .danger {
          color: var(--color-error-500) !important;
        }
      `}</style>
    </div>
  );
}

export default FeedbackTab;
