import { useState, useRef, useCallback } from 'react';
import { useDictionaryStore } from '../../stores/useDictionaryStore';

// 언어 코드 -> 표시명
const LANG_NAMES: Record<string, string> = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
  zh: '중국어',
  vi: '베트남어',
  es: '스페인어',
  fr: '프랑스어',
  de: '독일어',
  it: '이탈리아어',
  pt: '포르투갈어',
  ru: '러시아어',
  ar: '아랍어',
  th: '태국어',
  id: '인도네시아어',
  tr: '터키어',
  uk: '우크라이나어',
};

export function MemeTab() {
  const {
    dictionaries,
    activeDictionaryIds,
    addDictionary,
    removeDictionary,
    toggleDictionary,
    removeMeme,
    updateMeme,
    bulkAddMemes,
    addLanguageColumn,
  } = useDictionaryStore();

  const [selectedDict, setSelectedDict] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [newDictName, setNewDictName] = useState('');
  const [newDictIcon, setNewDictIcon] = useState('🎭');
  const [isEditMode, setIsEditMode] = useState(true);
  const [editingCell, setEditingCell] = useState<{ memeId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [thirdLang, setThirdLang] = useState<string>('');  // 제3언어 선택
  const tableRef = useRef<HTMLDivElement>(null);

  const memeDictionaries = dictionaries.filter(d => d.category === 'meme');
  const selectedDictData = dictionaries.find(d => d.id === selectedDict);

  const handleAddDictionary = () => {
    if (!newDictName.trim()) return;
    addDictionary(newDictName.trim(), newDictIcon, 'meme');
    setNewDictName('');
    setNewDictIcon('🎭');
    setShowAddModal(false);
  };

  // 엑셀 붙여넣기 처리 (언어별 컬럼)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!selectedDict || !selectedDictData) return;

    const text = e.clipboardData.getData('text/plain');
    if (!text.trim()) return;

    e.preventDefault();

    const lines = text.trim().split('\n');
    const languages = selectedDictData.languages;
    const rows: Array<Record<string, string>> = [];
    const descriptions: string[] = [];

    for (const line of lines) {
      const cells = line.split('\t');
      if (cells.length >= 2) {
        const row: Record<string, string> = {};
        // 마지막 컬럼이 description인지 체크 (languages.length보다 1개 더 많으면)
        const hasDescription = cells.length > languages.length;
        const description = hasDescription ? cells[cells.length - 1]?.trim() : '';

        languages.forEach((lang, i) => {
          if (cells[i]?.trim()) {
            row[lang] = cells[i].trim();
          }
        });

        if (row.ko) {
          rows.push(row);
          descriptions.push(description || '');
        }
      }
    }

    if (rows.length > 0) {
      bulkAddMemes(selectedDict, rows, descriptions);
    }
  }, [selectedDict, selectedDictData, bulkAddMemes]);

  // 언어 컬럼 추가
  const handleAddLanguage = (langCode: string) => {
    if (!selectedDict) return;
    addLanguageColumn(selectedDict, langCode);
    setShowLangModal(false);
  };

  // 셀 편집 시작
  const startEditing = (memeId: string, field: string, currentValue: string) => {
    if (!isEditMode) return;
    setEditingCell({ memeId, field });
    setEditValue(currentValue || '');
  };

  // 셀 편집 완료
  const finishEditing = (moveDirection?: 'right' | 'left' | 'down') => {
    if (!editingCell || !selectedDict || !selectedDictData) return;

    const meme = selectedDictData.memes.find(m => m.id === editingCell.memeId);
    if (meme) {
      if (editingCell.field === 'description') {
        updateMeme(selectedDict, editingCell.memeId, meme.translations, editValue.trim());
      } else {
        const newTranslations = { ...meme.translations, [editingCell.field]: editValue.trim() };
        updateMeme(selectedDict, editingCell.memeId, newTranslations, meme.description);
      }
    }

    const fields = [...selectedDictData.languages, 'description'];
    const currentIdx = fields.indexOf(editingCell.field);
    const memeIdx = selectedDictData.memes.findIndex(m => m.id === editingCell.memeId);

    // Tab: 다음 셀로 이동
    if (moveDirection === 'right') {
      if (currentIdx < fields.length - 1) {
        const nextField = fields[currentIdx + 1];
        const nextValue = nextField === 'description' ? (meme?.description || '') : (meme?.translations[nextField] || '');
        setEditingCell({ memeId: editingCell.memeId, field: nextField });
        setEditValue(nextValue);
        return;
      } else if (memeIdx < selectedDictData.memes.length - 1) {
        const nextMeme = selectedDictData.memes[memeIdx + 1];
        const nextValue = nextMeme.translations[fields[0]] || '';
        setEditingCell({ memeId: nextMeme.id, field: fields[0] });
        setEditValue(nextValue);
        return;
      }
    }

    // Shift+Tab: 이전 셀로 이동
    if (moveDirection === 'left') {
      if (currentIdx > 0) {
        const prevField = fields[currentIdx - 1];
        const prevValue = prevField === 'description' ? (meme?.description || '') : (meme?.translations[prevField] || '');
        setEditingCell({ memeId: editingCell.memeId, field: prevField });
        setEditValue(prevValue);
        return;
      } else if (memeIdx > 0) {
        const prevMeme = selectedDictData.memes[memeIdx - 1];
        const lastField = fields[fields.length - 1];
        const prevValue = lastField === 'description' ? (prevMeme.description || '') : (prevMeme.translations[lastField] || '');
        setEditingCell({ memeId: prevMeme.id, field: lastField });
        setEditValue(prevValue);
        return;
      }
    }

    // Enter: 다음 행으로 이동 (없으면 새 행 추가)
    if (moveDirection === 'down') {
      if (memeIdx < selectedDictData.memes.length - 1) {
        const nextMeme = selectedDictData.memes[memeIdx + 1];
        setEditingCell({ memeId: nextMeme.id, field: fields[0] });
        setEditValue(nextMeme.translations[fields[0]] || '');
        return;
      } else {
        addEmptyRow();
        setTimeout(() => {
          const updatedDict = dictionaries.find(d => d.id === selectedDict);
          if (updatedDict && updatedDict.memes.length > 0) {
            const newMeme = updatedDict.memes[updatedDict.memes.length - 1];
            setEditingCell({ memeId: newMeme.id, field: fields[0] });
            setEditValue('');
          }
        }, 50);
        return;
      }
    }

    setEditingCell(null);
    setEditValue('');
  };

  // 새 행 추가 (빈 행)
  const addEmptyRow = () => {
    if (!selectedDict || !selectedDictData) return;
    const emptyRow: Record<string, string> = {};
    selectedDictData.languages.forEach(lang => {
      emptyRow[lang] = '';
    });
    bulkAddMemes(selectedDict, [emptyRow], ['']);
  };

  return (
    <div style={{ maxWidth: 700, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* 안내 */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 6,
        marginBottom: 16,
        fontSize: 13,
        color: '#fbbf24',
      }}>
        <strong>💡 밈 노트</strong> = 맥락 기반 참고. AI가 문맥을 파악해 <u>적절한 상황에서만</u> 적용합니다.
        <div style={{ fontSize: 12, color: '#aaaacc', marginTop: 4 }}>
          예: "히)" 등록 → "안녕히"의 "히"는 변환 안 함
        </div>
      </div>

      {/* 사전 탭 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {memeDictionaries.map(dict => {
          const isSelected = selectedDict === dict.id;
          const isActive = activeDictionaryIds.includes(dict.id);
          return (
          <button
            key={dict.id}
            onClick={() => setSelectedDict(selectedDict === dict.id ? null : dict.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              border: isSelected ? '2px solid #f59e0b' : isActive ? '2px solid #f59e0b' : '1px solid #2a2a3c',
              borderRadius: 6,
              background: isSelected ? '#f59e0b' : isActive ? 'rgba(245, 158, 11, 0.2)' : '#12121c',
              color: isSelected ? '#fff' : '#ffffff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <span>{dict.icon}</span>
            <span>{dict.name}</span>
            <span style={{
              fontSize: 11,
              padding: '1px 6px',
              background: isSelected ? 'rgba(255,255,255,0.2)' : '#1a1a28',
              borderRadius: 10,
              color: isSelected ? '#fff' : '#aaaacc',
            }}>
              {dict.memes.length}
            </span>
          </button>
          );
        })}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '8px 12px',
            border: '1px dashed #2a2a3c',
            borderRadius: 6,
            background: '#12121c',
            color: '#666688',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          + 새 노트
        </button>
      </div>

      {/* 선택된 사전 */}
      {selectedDictData && (
        <div style={{ background: '#1a1a28', borderRadius: 8, padding: 16, border: '1px solid #2a2a3c' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#ffffff' }}>
              {selectedDictData.icon} {selectedDictData.name}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  background: isEditMode ? '#10b981' : '#12121c',
                  color: isEditMode ? '#fff' : '#aaaacc',
                  border: isEditMode ? '1px solid #10b981' : '1px solid #2a2a3c',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {isEditMode ? '🔓 편집중' : '🔒 잠금'}
              </button>
              <button
                onClick={() => toggleDictionary(selectedDictData.id)}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  background: activeDictionaryIds.includes(selectedDictData.id) ? '#f59e0b' : '#12121c',
                  color: activeDictionaryIds.includes(selectedDictData.id) ? '#fff' : '#aaaacc',
                  border: '1px solid #2a2a3c',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {activeDictionaryIds.includes(selectedDictData.id) ? '✓ 활성' : '비활성'}
              </button>
              {selectedDictData.id !== 'meme-default' && (
                <button
                  onClick={() => {
                    if (confirm('삭제?')) {
                      removeDictionary(selectedDictData.id);
                      setSelectedDict(null);
                    }
                  }}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    background: '#12121c',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              )}
            </div>
          </div>

          {/* 테이블 - 직접 붙여넣기 영역 */}
          <div
            ref={tableRef}
            onPaste={handlePaste}
            tabIndex={0}
            style={{
              border: '1px solid #2a2a3c',
              borderRadius: 6,
              overflow: 'hidden',
              outline: 'none',
            }}
          >
            {/* 헤더 - 3컬럼 고정 (한국어 | 영어 | 제3언어 선택) + 설명 */}
            <div style={{
              display: 'flex',
              background: '#0d0d14',
              padding: '8px 12px',
              fontSize: 11,
              color: '#aaaacc',
              fontWeight: 500,
              borderBottom: '1px solid #2a2a3c',
            }}>
              <span style={{ flex: 1, minWidth: 100 }}>🇰🇷 한국어</span>
              <span style={{ flex: 1, minWidth: 100 }}>🇺🇸 영어</span>
              <div style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  value={thirdLang}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    setThirdLang(newLang);
                    if (newLang && !selectedDictData.languages.includes(newLang)) {
                      addLanguageColumn(selectedDict!, newLang);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    background: '#0d0d14',
                    color: thirdLang ? '#f59e0b' : '#666688',
                    border: '1px solid #2a2a3c',
                    borderRadius: 4,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  <option value="">➕ 언어 선택</option>
                  {Object.entries(LANG_NAMES)
                    .filter(([code]) => code !== 'ko' && code !== 'en')
                    .map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>
              <span style={{ flex: 1, minWidth: 80 }}>설명</span>
              <span style={{ width: 40 }}></span>
            </div>

            {/* 목록 - 3컬럼 고정 (ko, en, thirdLang) + description */}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {selectedDictData.memes.map((meme, idx) => {
                // 표시할 3개 언어: ko, en, thirdLang
                const displayLangs = ['ko', 'en', thirdLang].filter(Boolean);

                return (
                <div
                  key={meme.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 12px',
                    background: idx % 2 === 0 ? '#12121c' : '#0d0d14',
                    borderBottom: idx < selectedDictData.memes.length - 1 ? '1px solid #1a1a28' : 'none',
                    fontSize: 13,
                  }}
                >
                  {displayLangs.map((lang) => {
                    const isEditing = editingCell?.memeId === meme.id && editingCell?.field === lang;
                    return isEditing ? (
                      <input
                        key={lang}
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => finishEditing()}
                        onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                          if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); finishEditing('left'); }
                          else if (e.key === 'Tab') { e.preventDefault(); finishEditing('right'); }
                          else if (e.key === 'Enter') { e.preventDefault(); finishEditing('down'); }
                          else if (e.key === 'Escape') { setEditingCell(null); setEditValue(''); }
                        }}
                        style={{
                          flex: 1,
                          minWidth: 90,
                          padding: '4px 6px',
                          border: '2px solid #f59e0b',
                          borderRadius: 3,
                          fontSize: 13,
                          outline: 'none',
                          marginRight: 4,
                          background: '#0d0d14',
                          color: '#ffffff',
                        }}
                      />
                    ) : (
                      <span
                        key={lang}
                        onClick={() => startEditing(meme.id, lang, meme.translations[lang] || '')}
                        style={{
                          flex: 1,
                          minWidth: 100,
                          padding: '4px 6px',
                          color: lang === 'ko' ? '#ffffff' : lang === 'en' ? '#f59e0b' : '#a78bfa',
                          fontWeight: lang === 'ko' ? 500 : 400,
                          cursor: isEditMode ? 'text' : 'default',
                          borderRadius: 3,
                          background: isEditMode ? 'rgba(245,158,11,0.05)' : 'transparent',
                        }}
                      >
                        {meme.translations[lang] || (isEditMode ? '클릭' : '-')}
                      </span>
                    );
                  })}
                  {/* 제3언어 미선택 시 빈 공간 */}
                  {!thirdLang && (
                    <span style={{ flex: 1, minWidth: 100, padding: '4px 6px', color: '#333344' }}>
                      -
                    </span>
                  )}
                  {/* 설명 컬럼 */}
                  {editingCell?.memeId === meme.id && editingCell?.field === 'description' ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => finishEditing()}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                        if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); finishEditing('left'); }
                        else if (e.key === 'Tab') { e.preventDefault(); finishEditing('right'); }
                        else if (e.key === 'Enter') { e.preventDefault(); finishEditing('down'); }
                        else if (e.key === 'Escape') { setEditingCell(null); setEditValue(''); }
                      }}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        padding: '4px 6px',
                        border: '2px solid #f59e0b',
                        borderRadius: 3,
                        fontSize: 12,
                        outline: 'none',
                        marginRight: 4,
                        background: '#0d0d14',
                        color: '#ffffff',
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => startEditing(meme.id, 'description', meme.description || '')}
                      style={{
                        flex: 1,
                        minWidth: 80,
                        padding: '4px 6px',
                        color: '#666688',
                        fontSize: 12,
                        cursor: isEditMode ? 'text' : 'default',
                        borderRadius: 3,
                        background: isEditMode ? 'rgba(245,158,11,0.05)' : 'transparent',
                      }}
                    >
                      {meme.description || (isEditMode ? '클릭' : '-')}
                    </span>
                  )}
                  <span style={{ width: 24 }}></span>
                  {isEditMode && (
                    <button
                      onClick={() => removeMeme(selectedDictData.id, meme.id)}
                      style={{
                        width: 24,
                        height: 24,
                        background: 'transparent',
                        color: '#666688',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                );
              })}
            </div>

            {/* 편집 모드일 때 새 행 추가 버튼 */}
            {isEditMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addEmptyRow();
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: 'none',
                  borderTop: '1px solid #2a2a3c',
                  color: '#f59e0b',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'background 0.15s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'}
              >
                + 새 행 추가
              </button>
            )}
          </div>

          {/* 하단 안내 */}
          <div style={{ marginTop: 8, fontSize: 11, color: '#666688' }}>
            💡 {isEditMode ? '셀 클릭하여 직접 편집 | ' : ''}엑셀 복사 → 테이블 클릭 → Ctrl+V (마지막 컬럼=설명) | 자동저장됩니다
          </div>
        </div>
      )}

      {/* 새 노트 모달 */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#12121c', padding: 20, borderRadius: 8, width: 300, border: '1px solid #2a2a3c' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, color: '#ffffff' }}>새 밈 노트</h3>
            <input
              placeholder="노트 이름"
              value={newDictName}
              onChange={(e) => setNewDictName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #2a2a3c',
                borderRadius: 4,
                marginBottom: 12,
                fontSize: 13,
                background: '#0d0d14',
                color: '#ffffff',
              }}
            />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#aaaacc', marginBottom: 6 }}>아이콘</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['🎭', '💡', '✨', '🔥', '😂', '🎯', '💬', '🌟'].map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewDictIcon(icon)}
                    style={{
                      width: 32, height: 32,
                      border: newDictIcon === icon ? '2px solid #f59e0b' : '1px solid #2a2a3c',
                      borderRadius: 4,
                      background: newDictIcon === icon ? 'rgba(245, 158, 11, 0.2)' : '#0d0d14',
                      cursor: 'pointer',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '8px 14px', background: '#1a1a28', border: '1px solid #2a2a3c', borderRadius: 4, cursor: 'pointer', color: '#aaaacc' }}>취소</button>
              <button onClick={handleAddDictionary} style={{ padding: '8px 14px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 언어 추가 모달 */}
      {showLangModal && selectedDictData && (
        <div
          onClick={() => setShowLangModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#12121c', padding: 20, borderRadius: 8, width: 300, border: '1px solid #2a2a3c' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, color: '#ffffff' }}>언어 컬럼 추가</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(LANG_NAMES)
                .filter(([code]) => !selectedDictData.languages.includes(code))
                .map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => handleAddLanguage(code)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #2a2a3c',
                      borderRadius: 4,
                      background: '#1a1a28',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: '#aaaacc',
                    }}
                  >
                    {name}
                  </button>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowLangModal(false)} style={{ padding: '8px 14px', background: '#1a1a28', border: '1px solid #2a2a3c', borderRadius: 4, cursor: 'pointer', color: '#aaaacc' }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
