import { useState, useEffect, memo, useCallback } from 'react';
import { useSettingsStore, Model, MultiLangModel } from '../../stores/useSettingsStore';
import { useDictionaryStore } from '../../stores/useDictionaryStore';
import { isElectron, selectFolder } from '../../lib/fileSystem';
import { generateSystemPrompt } from '../../lib/translator';

// Section 컴포넌트를 외부로 분리
const Section = memo(({
  id,
  title,
  icon,
  children,
  badge,
  isExpanded,
  onToggle
}: {
  id: string;
  title: string;
  icon: string;
  children: React.ReactNode;
  badge?: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}) => (
  <div className="settings-section">
    <button
      type="button"
      className="settings-section-header"
      onClick={() => onToggle(id)}
    >
      <div className="settings-section-title">
        <span className="settings-section-icon">{icon}</span>
        <span>{title}</span>
        {badge && <span className="settings-badge">{badge}</span>}
      </div>
      <span className={`settings-chevron ${isExpanded ? 'open' : ''}`}>▼</span>
    </button>
    {isExpanded && <div className="settings-section-body">{children}</div>}
  </div>
));

export function SettingsTab() {
  const {
    apiKey, setApiKey,
    model, setModel,
    multiLangModel, setMultiLangModel,
    isApiKeyValid,
    outputFolder, setOutputFolder,
    channelInfo, setChannelInfo,
    customSystemPrompt, setCustomSystemPrompt
  } = useSettingsStore();

  const {
    dictionaries,
    activeDictionaryIds,
    toggleDictionary
  } = useDictionaryStore();

  const [showKey, setShowKey] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['folder', 'api', 'channel']));

  // 로컬 state (입력 중 리렌더링 방지)
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localGenre, setLocalGenre] = useState(channelInfo.genre);
  const [localAudience, setLocalAudience] = useState(channelInfo.targetAudience);
  const [localDesc, setLocalDesc] = useState(channelInfo.description);

  // 스토어 값이 변경되면 로컬 state 동기화 (hydration 후)
  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setLocalGenre(channelInfo.genre);
    setLocalAudience(channelInfo.targetAudience);
    setLocalDesc(channelInfo.description);
  }, [channelInfo.genre, channelInfo.targetAudience, channelInfo.description]);

  const isValid = isApiKeyValid();

  const handleGeneratePrompt = async () => {
    // 로컬 값들을 먼저 store에 저장
    if (localApiKey !== apiKey) setApiKey(localApiKey);
    if (localGenre !== channelInfo.genre) setChannelInfo({ genre: localGenre });
    if (localAudience !== channelInfo.targetAudience) setChannelInfo({ targetAudience: localAudience });
    if (localDesc !== channelInfo.description) setChannelInfo({ description: localDesc });

    if (!localGenre && !localDesc) {
      alert('채널 정보를 먼저 입력해주세요.');
      return;
    }
    if (!localApiKey) {
      alert('API 키를 먼저 입력해주세요.');
      return;
    }
    setIsGeneratingPrompt(true);
    try {
      const currentChannelInfo = {
        genre: localGenre,
        targetAudience: localAudience,
        description: localDesc
      };
      const prompt = await generateSystemPrompt(localApiKey, currentChannelInfo, multiLangModel);
      setCustomSystemPrompt(prompt);
    } catch (error) {
      console.error('프롬프트 생성 실패:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`프롬프트 생성 실패: ${errorMsg}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="settings-container">
      {/* 작업 폴더 지정 */}
      <Section id="folder" title="작업 폴더 지정" icon="📁" badge={outputFolder ? '설정됨' : undefined} isExpanded={expandedSections.has('folder')} onToggle={toggleSection}>
        <div className="settings-info-box info">
          <strong>📁 작업 폴더 = 프로젝트 저장 위치</strong>
          <p>번역 완료된 파일들이 이 폴더에 자동 저장됩니다.</p>
        </div>
        <div className="settings-row">
          <div className="settings-folder-display">
            <span className="settings-folder-icon">📂</span>
            <span className="settings-folder-path">
              {outputFolder || '폴더를 선택해주세요'}
            </span>
          </div>
        </div>
        <div className="settings-row">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={async () => {
              if (!isElectron()) {
                alert('데스크톱 앱에서만 사용 가능합니다.');
                return;
              }
              const f = await selectFolder();
              if (f) setOutputFolder(f);
            }}
          >
            폴더 선택
          </button>
          {outputFolder && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setOutputFolder('')}
            >
              초기화
            </button>
          )}
        </div>
      </Section>

      {/* API & 모델 설정 */}
      <Section id="api" title="API 설정" icon="🔑" badge={isValid ? '연결됨' : undefined} isExpanded={expandedSections.has('api')} onToggle={toggleSection}>
        <div className="settings-row">
          <label className="settings-label">API Key</label>
          <div className="settings-input-group">
            <input
              className="input input-sm"
              type={showKey ? 'text' : 'password'}
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              onBlur={() => setApiKey(localApiKey)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              placeholder="sk-proj-..."
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowKey(!showKey)}>
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          {apiKey && (
            <span className={`settings-status ${isValid ? 'success' : 'error'}`}>
              {isValid ? '✓ 유효' : '✗ 무효'}
            </span>
          )}
        </div>
        <div className="settings-grid-2">
          <div className="settings-field">
            <label className="settings-label-sm">번역에 사용할 모델</label>
            <select className="input input-sm" value={model} onChange={(e) => setModel(e.target.value as Model)}>
              <optgroup label="저렴">
                <option value="gpt-4.1-nano">GPT-4.1 Nano (최저가)</option>
                <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                <option value="gpt-5-nano">GPT-5 Nano</option>
                <option value="gpt-5-mini">GPT-5 Mini</option>
              </optgroup>
              <optgroup label="고성능">
                <option value="gpt-4.1">GPT-4.1</option>
                <option value="gpt-5">GPT-5</option>
                <option value="gpt-5.1">GPT-5.1</option>
                <option value="gpt-5.2">GPT-5.2</option>
              </optgroup>
            </select>
          </div>
          <div className="settings-field">
            <label className="settings-label-sm">다국어 번역에 사용할 모델</label>
            <select className="input input-sm" value={multiLangModel} onChange={(e) => setMultiLangModel(e.target.value as MultiLangModel)}>
              <optgroup label="저렴">
                <option value="gpt-4.1-nano">GPT-4.1 Nano (최저가)</option>
                <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                <option value="gpt-5-nano">GPT-5 Nano</option>
                <option value="gpt-5-mini">GPT-5 Mini</option>
              </optgroup>
              <optgroup label="고성능">
                <option value="gpt-4.1">GPT-4.1</option>
                <option value="gpt-5">GPT-5</option>
                <option value="gpt-5.1">GPT-5.1</option>
                <option value="gpt-5.2">GPT-5.2</option>
              </optgroup>
            </select>
          </div>
        </div>
      </Section>

      {/* 채널 & 프롬프트 */}
      <Section id="channel" title="채널 설정" icon="📺" isExpanded={expandedSections.has('channel')} onToggle={toggleSection}>
        <div className="settings-info-box info">
          💡 AI가 우리 채널을 이해할 수 있게 상세히 작성해주세요.
        </div>
        <div className="settings-grid-2">
          <div className="settings-field">
            <label className="settings-label-sm">장르</label>
            <input
              className="input input-sm"
              value={localGenre}
              onChange={(e) => setLocalGenre(e.target.value)}
              onBlur={() => setChannelInfo({ genre: localGenre })}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              placeholder="요리, 게임, 뷰티..."
            />
          </div>
          <div className="settings-field">
            <label className="settings-label-sm">시청자 대상</label>
            <input
              className="input input-sm"
              value={localAudience}
              onChange={(e) => setLocalAudience(e.target.value)}
              onBlur={() => setChannelInfo({ targetAudience: localAudience })}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              placeholder="초보자, 전문가..."
            />
          </div>
        </div>
        <div className="settings-field">
          <label className="settings-label-sm">채널 설명</label>
          <textarea
            className="input input-sm"
            value={localDesc}
            onChange={(e) => setLocalDesc(e.target.value)}
            onBlur={() => setChannelInfo({ description: localDesc })}
            placeholder="채널 특징, 말투, 분위기..."
            rows={2}
          />
        </div>
        <div className="settings-row" style={{ marginTop: '8px' }}>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleGeneratePrompt}
            disabled={isGeneratingPrompt || !localApiKey}
          >
            {isGeneratingPrompt ? '생성 중...' : '✨ AI 프롬프트 생성 (필수)'}
          </button>
        </div>
        <div className="settings-field" style={{ marginTop: '12px' }}>
          <label className="settings-label-sm">Context Prompt (필수)</label>
          <textarea
            className={`input input-sm mono ${customSystemPrompt ? '' : 'system-prompt-empty'}`}
            value={customSystemPrompt}
            onChange={(e) => setCustomSystemPrompt(e.target.value)}
            placeholder="AI 프롬프트 생성 버튼을 눌러 채널 맥락을 생성하세요."
            rows={6}
          />
        </div>
      </Section>

      {/* 사전 활성화 관리 */}
      <Section id="dictionary" title="사전 활성화 관리" icon="📚" isExpanded={expandedSections.has('dictionary')} onToggle={toggleSection}>
        {/* Terminology */}
        <div className="dict-subsection">
          <div className="dict-subsection-header">
            <span>📖 전문용어 (Terminology)</span>
            <span className="dict-count">{dictionaries.filter(d => d.category === 'terminology' && activeDictionaryIds.includes(d.id)).length}/{dictionaries.filter(d => d.category === 'terminology').length} 활성</span>
          </div>
          <div className="dict-list">
            {dictionaries.filter(d => d.category === 'terminology').map(dict => (
              <div key={dict.id} className="dict-item">
                <div className="dict-info">
                  <span className="dict-icon">{dict.icon}</span>
                  <span className="dict-name">{dict.name}</span>
                  <span className="dict-entry-count">{dict.entries.length}개</span>
                </div>
                <button
                  type="button"
                  className={`dict-toggle ${activeDictionaryIds.includes(dict.id) ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); toggleDictionary(dict.id); }}
                >
                  {activeDictionaryIds.includes(dict.id) ? '활성' : '비활성'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Meme Note */}
        <div className="dict-subsection">
          <div className="dict-subsection-header">
            <span>🎭 밈 노트 (Meme Note)</span>
            <span className="dict-count">{dictionaries.filter(d => d.category === 'meme' && activeDictionaryIds.includes(d.id)).length}/{dictionaries.filter(d => d.category === 'meme').length} 활성</span>
          </div>
          <div className="dict-list">
            {dictionaries.filter(d => d.category === 'meme').map(dict => (
              <div key={dict.id} className="dict-item">
                <div className="dict-info">
                  <span className="dict-icon">{dict.icon}</span>
                  <span className="dict-name">{dict.name}</span>
                  <span className="dict-entry-count">{dict.memes.length}개</span>
                </div>
                <button
                  type="button"
                  className={`dict-toggle ${activeDictionaryIds.includes(dict.id) ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); toggleDictionary(dict.id); }}
                >
                  {activeDictionaryIds.includes(dict.id) ? '활성' : '비활성'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <style>{`
        .settings-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 600px;
        }
        .settings-section {
          background: var(--surface-primary);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .settings-section:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .settings-section-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          transition: background 0.15s ease;
        }
        .settings-section-header:hover {
          background: var(--surface-secondary);
        }
        .settings-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .settings-section-icon {
          font-size: 16px;
        }
        .settings-badge {
          font-size: 11px;
          padding: 2px 6px;
          background: var(--color-primary-500);
          color: white;
          border-radius: 10px;
          font-weight: 500;
        }
        .settings-chevron {
          font-size: 10px;
          color: var(--text-muted);
          transition: transform 0.2s;
        }
        .settings-chevron.open {
          transform: rotate(180deg);
        }
        .settings-section-body {
          padding: 16px 20px;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .settings-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .settings-label {
          font-size: 13px;
          color: var(--text-secondary);
          min-width: 70px;
        }
        .settings-label-sm {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 4px;
          display: block;
        }
        .settings-label-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .settings-label-row .settings-label-sm {
          margin-bottom: 0;
        }
        .settings-label-hint {
          font-size: 11px;
          color: #d97706;
          font-weight: 500;
        }
        .settings-input-group {
          display: flex;
          gap: 4px;
          flex: 1;
        }
        .settings-input-group .input {
          flex: 1;
        }
        .settings-status {
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .settings-status.success {
          color: var(--color-success-500);
          background: var(--color-success-500)15;
        }
        .settings-status.error {
          color: var(--color-error-500);
          background: var(--color-error-500)15;
        }
        .settings-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .settings-field {
          display: flex;
          flex-direction: column;
        }
        .settings-info-box {
          font-size: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          line-height: 1.5;
        }
        .settings-info-box.info {
          background: var(--color-primary-500)10;
          border: 1px solid var(--color-primary-500)30;
        }
        .settings-info-box strong {
          display: block;
          margin-bottom: 4px;
        }
        .settings-info-box p {
          margin: 0;
          color: var(--text-secondary);
        }
        .settings-folder-display {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--surface-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          flex: 1;
        }
        .settings-folder-icon {
          font-size: 16px;
        }
        .settings-folder-path {
          font-size: 13px;
          color: var(--text-secondary);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .input-sm {
          padding: 6px 10px;
          font-size: 13px;
        }
        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }
        .mono {
          font-family: monospace;
        }
        .system-prompt-empty {
          border: 2px solid #ef4444 !important;
          font-size: 12px;
          line-height: 1.5;
        }
        .system-prompt-empty:focus {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
        }
        .dict-subsection {
          background: var(--surface-secondary);
          border-radius: 8px;
          overflow: hidden;
        }
        .dict-subsection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 500;
          background: var(--surface-tertiary);
          border-bottom: 1px solid var(--border-subtle);
        }
        .dict-count {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: normal;
        }
        .dict-list {
          display: flex;
          flex-direction: column;
        }
        .dict-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .dict-item:last-child {
          border-bottom: none;
        }
        .dict-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dict-icon {
          font-size: 14px;
        }
        .dict-name {
          font-size: 13px;
          color: var(--text-primary);
        }
        .dict-entry-count {
          font-size: 11px;
          color: var(--text-muted);
          padding: 2px 6px;
          background: var(--surface-tertiary);
          border-radius: 10px;
        }
        .dict-toggle {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-primary);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .dict-toggle:hover {
          border-color: var(--color-primary-400);
        }
        .dict-toggle.active {
          background: var(--color-primary-500);
          color: white;
          border-color: var(--color-primary-500);
        }
        .btn-secondary {
          background: var(--surface-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-subtle);
        }
        .btn-secondary:hover {
          background: var(--surface-tertiary);
        }
        /* AI Toggle Styles */
        .ai-toggle-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: var(--surface-secondary);
          border-radius: 8px;
        }
        .ai-toggle-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ai-toggle-icon {
          font-size: 20px;
        }
        .ai-toggle-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ai-toggle-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .ai-toggle-desc {
          font-size: 11px;
          color: var(--text-muted);
        }
        .ai-toggle-btn {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 20px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--surface-tertiary);
          color: var(--text-muted);
        }
        .ai-toggle-btn:hover {
          background: var(--surface-primary);
        }
        .ai-toggle-btn.active {
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
        }
      `}</style>
    </div>
  );
}

export default SettingsTab;
