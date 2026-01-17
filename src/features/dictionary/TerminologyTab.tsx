import { useState, useRef, useCallback } from 'react';
import { useDictionaryStore } from '../../stores/useDictionaryStore';
import { PRESETS } from '../../data/presets';

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

export function TerminologyTab() {
  const {
    dictionaries,
    activeDictionaryIds,
    addDictionary,
    removeDictionary,
    toggleDictionary,
    removeEntry,
    updateEntry,
    loadPreset,
    bulkAddEntries,
    addLanguageColumn,
  } = useDictionaryStore();

  const [selectedDict, setSelectedDict] = useState<string | null>('crochet');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [newDictName, setNewDictName] = useState('');
  const [newDictIcon, setNewDictIcon] = useState('📚');
  const [isEditMode, setIsEditMode] = useState(true);
  const [editingCell, setEditingCell] = useState<{ entryId: string; lang: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [thirdLang, setThirdLang] = useState<string>('');  // 제3언어 선택
  const tableRef = useRef<HTMLDivElement>(null);

  const termDictionaries = dictionaries.filter(d => d.category === 'terminology');
  const selectedDictData = dictionaries.find(d => d.id === selectedDict);

  const handleAddDictionary = () => {
    if (!newDictName.trim()) return;
    addDictionary(newDictName.trim(), newDictIcon, 'terminology');
    setNewDictName('');
    setNewDictIcon('📚');
    setShowAddModal(false);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!selectedDict || !selectedDictData) return;

    const text = e.clipboardData.getData('text/plain');
    if (!text.trim()) return;

    e.preventDefault();

    const lines = text.trim().split('\n');
    const languages = selectedDictData.languages;
    const rows: Array<Record<string, string>> = [];

    for (const line of lines) {
      const cells = line.split('\t');
      if (cells.length >= 2) {
        const row: Record<string, string> = {};
        languages.forEach((lang, i) => {
          if (cells[i]?.trim()) {
            row[lang] = cells[i].trim();
          }
        });
        if (row.ko) {
          rows.push(row);
        }
      }
    }

    if (rows.length > 0) {
      bulkAddEntries(selectedDict, rows);
    }
  }, [selectedDict, selectedDictData, bulkAddEntries]);

  const handleAddLanguage = (langCode: string) => {
    if (!selectedDict) return;
    addLanguageColumn(selectedDict, langCode);
    setShowLangModal(false);
  };

  const startEditing = (entryId: string, lang: string, currentValue: string) => {
    if (!isEditMode) return;
    setEditingCell({ entryId, lang });
    setEditValue(currentValue || '');
  };

  const finishEditing = (moveDirection?: 'right' | 'left' | 'down') => {
    if (!editingCell || !selectedDict || !selectedDictData) return;

    const entry = selectedDictData.entries.find(e => e.id === editingCell.entryId);
    if (entry) {
      const newTranslations = { ...entry.translations, [editingCell.lang]: editValue.trim() };
      updateEntry(selectedDict, editingCell.entryId, newTranslations);
    }

    const langs = selectedDictData.languages;
    const currentLangIdx = langs.indexOf(editingCell.lang);
    const entryIdx = selectedDictData.entries.findIndex(e => e.id === editingCell.entryId);

    if (moveDirection === 'right') {
      if (currentLangIdx < langs.length - 1) {
        const nextLang = langs[currentLangIdx + 1];
        const nextValue = entry?.translations[nextLang] || '';
        setEditingCell({ entryId: editingCell.entryId, lang: nextLang });
        setEditValue(nextValue);
        return;
      } else if (entryIdx < selectedDictData.entries.length - 1) {
        const nextEntry = selectedDictData.entries[entryIdx + 1];
        const nextValue = nextEntry.translations[langs[0]] || '';
        setEditingCell({ entryId: nextEntry.id, lang: langs[0] });
        setEditValue(nextValue);
        return;
      }
    }

    if (moveDirection === 'left') {
      if (currentLangIdx > 0) {
        const prevLang = langs[currentLangIdx - 1];
        const prevValue = entry?.translations[prevLang] || '';
        setEditingCell({ entryId: editingCell.entryId, lang: prevLang });
        setEditValue(prevValue);
        return;
      } else if (entryIdx > 0) {
        const prevEntry = selectedDictData.entries[entryIdx - 1];
        const prevValue = prevEntry.translations[langs[langs.length - 1]] || '';
        setEditingCell({ entryId: prevEntry.id, lang: langs[langs.length - 1] });
        setEditValue(prevValue);
        return;
      }
    }

    if (moveDirection === 'down') {
      const langs = selectedDictData.languages;
      if (entryIdx < selectedDictData.entries.length - 1) {
        const nextEntry = selectedDictData.entries[entryIdx + 1];
        setEditingCell({ entryId: nextEntry.id, lang: langs[0] });
        setEditValue(nextEntry.translations[langs[0]] || '');
        return;
      } else {
        addEmptyRow();
        setTimeout(() => {
          const updatedDict = dictionaries.find(d => d.id === selectedDict);
          if (updatedDict && updatedDict.entries.length > 0) {
            const newEntry = updatedDict.entries[updatedDict.entries.length - 1];
            setEditingCell({ entryId: newEntry.id, lang: langs[0] });
            setEditValue('');
          }
        }, 50);
        return;
      }
    }

    setEditingCell(null);
    setEditValue('');
  };

  const addEmptyRow = (): string | null => {
    if (!selectedDict || !selectedDictData) return null;
    const emptyRow: Record<string, string> = {};
    selectedDictData.languages.forEach(lang => {
      emptyRow[lang] = '';
    });
    bulkAddEntries(selectedDict, [emptyRow]);
    const updatedDict = dictionaries.find(d => d.id === selectedDict);
    if (updatedDict && updatedDict.entries.length > 0) {
      return updatedDict.entries[updatedDict.entries.length - 1].id;
    }
    return null;
  };

  return (
    <div style={{ maxWidth: 900, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* 안내 */}
      <div style={{ padding: '10px 14px', background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: 6, marginBottom: 16, fontSize: 13, color: '#aaaacc' }}>
        <strong style={{ color: '#a78bfa' }}>📌 전문 용어</strong> = 엄격한 약속. 등록된 단어는 <u>반드시</u> 지정된 영어로 변환됩니다.
      </div>

      {/* 사전 탭 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {termDictionaries.map(dict => {
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
              border: isSelected ? '2px solid #7c3aed' : isActive ? '2px solid #7c3aed' : '1px solid #2a2a3c',
              borderRadius: 6,
              background: isSelected ? '#7c3aed' : isActive ? 'rgba(124, 58, 237, 0.2)' : '#12121c',
              color: isSelected ? '#fff' : '#aaaacc',
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
              borderRadius: 10
            }}>
              {dict.entries.length}
            </span>
          </button>
          );
        })}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '8px 12px',
            border: '1px dashed #444466',
            borderRadius: 6,
            background: '#12121c',
            color: '#666688',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          + 새 사전
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
                  background: isEditMode ? '#22c55e' : '#12121c',
                  color: isEditMode ? '#fff' : '#666688',
                  border: isEditMode ? '1px solid #22c55e' : '1px solid #2a2a3c',
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
                  background: activeDictionaryIds.includes(selectedDictData.id) ? '#7c3aed' : '#12121c',
                  color: activeDictionaryIds.includes(selectedDictData.id) ? '#fff' : '#666688',
                  border: '1px solid #2a2a3c',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {activeDictionaryIds.includes(selectedDictData.id) ? '✓ 활성' : '비활성'}
              </button>
              {!['knitting', 'crochet'].includes(selectedDictData.id) && (
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

          {/* 프리셋 로드 */}
          {['knitting', 'crochet'].includes(selectedDictData.id) && (
            <div style={{ marginBottom: 12 }}>
              {PRESETS.filter(p =>
                (selectedDictData.id === 'knitting' && p.info.id === 'knitting') ||
                (selectedDictData.id === 'crochet' && p.info.id === 'crochet')
              ).map((preset) => (
                <button
                  key={preset.info.id}
                  onClick={() => {
                    const entries = Object.entries(preset.terminology.terms).map(([korean, english]) => ({ korean, english }));
                    loadPreset(selectedDictData.id, entries);
                    alert(`${preset.info.name} ${preset.info.termCount}개 추가`);
                  }}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    background: '#12121c',
                    color: '#aaaacc',
                    border: '1px solid #2a2a3c',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  {preset.info.icon} {preset.info.name} 프리셋 로드
                </button>
              ))}
            </div>
          )}

          {/* 테이블 */}
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
            {/* 헤더 - 3컬럼 고정 (한국어 | 영어 | 제3언어 선택) */}
            <div style={{
              display: 'flex',
              background: '#12121c',
              padding: '8px 12px',
              fontSize: 11,
              color: '#666688',
              fontWeight: 500,
              borderBottom: '1px solid #2a2a3c',
            }}>
              <span style={{ flex: 1, minWidth: 120 }}>🇰🇷 한국어</span>
              <span style={{ flex: 1, minWidth: 120 }}>🇺🇸 영어</span>
              <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                    color: thirdLang ? '#22d3ee' : '#666688',
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
              <span style={{ width: 40 }}></span>
            </div>

            {/* 목록 - 3컬럼 고정 */}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {selectedDictData.entries.map((entry, idx) => {
                // 표시할 3개 언어: ko, en, thirdLang
                const displayLangs = ['ko', 'en', thirdLang].filter(Boolean);

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 12px',
                      background: idx % 2 === 0 ? '#0d0d14' : '#12121c',
                      borderBottom: idx < selectedDictData.entries.length - 1 ? '1px solid #1a1a28' : 'none',
                      fontSize: 13,
                    }}
                  >
                    {displayLangs.map((lang) => {
                      const isEditing = editingCell?.entryId === entry.id && editingCell?.lang === lang;
                      const isEmpty = !thirdLang && lang === '';

                      if (isEmpty) {
                        return (
                          <span
                            key="empty-third"
                            style={{
                              flex: 1,
                              minWidth: 120,
                              padding: '4px 6px',
                              color: '#444466',
                              fontStyle: 'italic',
                            }}
                          >
                            언어를 선택하세요
                          </span>
                        );
                      }

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
                            minWidth: 110,
                            padding: '4px 6px',
                            border: '2px solid #7c3aed',
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
                          onClick={() => startEditing(entry.id, lang, entry.translations[lang] || '')}
                          style={{
                            flex: 1,
                            minWidth: 120,
                            padding: '4px 6px',
                            color: lang === 'ko' ? '#ffffff' : lang === 'en' ? '#22d3ee' : '#a78bfa',
                            fontWeight: lang === 'ko' ? 500 : 400,
                            cursor: isEditMode ? 'text' : 'default',
                            borderRadius: 3,
                            background: isEditMode ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
                          }}
                        >
                          {entry.translations[lang] || (isEditMode ? '클릭하여 입력' : '-')}
                        </span>
                      );
                    })}
                    {/* 제3언어 미선택 시 빈 공간 */}
                    {!thirdLang && (
                      <span style={{ flex: 1, minWidth: 120, padding: '4px 6px', color: '#333344' }}>
                        -
                      </span>
                    )}
                    <span style={{ width: 24 }}></span>
                    {isEditMode && (
                      <button
                        onClick={() => removeEntry(selectedDictData.id, entry.id)}
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

            {/* 새 행 추가 버튼 */}
            {isEditMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addEmptyRow();
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(124, 58, 237, 0.15)',
                  border: 'none',
                  borderTop: '1px solid #2a2a3c',
                  color: '#a78bfa',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'background 0.15s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(124, 58, 237, 0.3)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(124, 58, 237, 0.15)'}
              >
                + 새 행 추가
              </button>
            )}
          </div>

          {/* 하단 안내 */}
          <div style={{ marginTop: 8, fontSize: 11, color: '#666688' }}>
            💡 {isEditMode ? '셀 클릭하여 직접 편집 | ' : ''}엑셀 복사 → 테이블 클릭 → Ctrl+V 붙여넣기 | 자동저장됩니다
          </div>
        </div>
      )}

      {/* 새 사전 모달 */}
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, color: '#ffffff' }}>새 전문용어 사전</h3>
            <input
              placeholder="사전 이름"
              value={newDictName}
              onChange={(e) => setNewDictName(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #2a2a3c', borderRadius: 4, marginBottom: 12, fontSize: 13, background: '#0d0d14', color: '#ffffff' }}
            />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#666688', marginBottom: 6 }}>아이콘</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['📚', '📖', '📕', '📗', '📘', '📙', '🔤', '✨'].map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewDictIcon(icon)}
                    style={{
                      width: 32, height: 32,
                      border: newDictIcon === icon ? '2px solid #7c3aed' : '1px solid #2a2a3c',
                      borderRadius: 4,
                      background: newDictIcon === icon ? 'rgba(124, 58, 237, 0.2)' : '#0d0d14',
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
              <button onClick={handleAddDictionary} style={{ padding: '8px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>추가</button>
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
                      background: '#0d0d14',
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
