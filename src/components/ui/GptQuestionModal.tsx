import { useState, useRef, useEffect } from 'react';
import { askGptAboutTranslation, GptMessage, GptConversationResponse } from '../../lib/translator';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface GptQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  currentTranslation: string;
  onApplyTranslation: (newTranslation: string) => void;
}

export function GptQuestionModal({
  isOpen,
  onClose,
  originalText,
  currentTranslation,
  onApplyTranslation,
}: GptQuestionModalProps) {
  const { apiKey, model } = useSettingsStore();
  const [messages, setMessages] = useState<GptMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSuggestion, setLastSuggestion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setInput('');
      setLastSuggestion(null);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response: GptConversationResponse = await askGptAboutTranslation(
        apiKey,
        originalText,
        currentTranslation,
        userMessage,
        messages,
        model
      );

      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);

      if (response.suggestedTranslation) {
        setLastSuggestion(response.suggestedTranslation);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleApplySuggestion = () => {
    if (lastSuggestion) {
      onApplyTranslation(lastSuggestion);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .gpt-modal-input:focus {
          outline: none;
          border-color: hsl(221.2 83.2% 53.3%) !important;
          box-shadow: 0 0 0 2px hsla(221.2, 83.2%, 53.3%, 0.2) !important;
        }
        .gpt-modal-btn:hover:not(:disabled) {
          background: hsl(221.2 83.2% 45%) !important;
        }
        .gpt-apply-btn:hover {
          background: hsl(142.1 76.2% 30%) !important;
        }
      `}</style>

      <div
        style={{
          background: 'hsl(240 10% 3.9%)',
          borderRadius: '16px',
          width: 'min(560px, 95vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid hsl(240 3.7% 15.9%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          animation: 'slideUp 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid hsl(240 3.7% 15.9%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, hsl(221.2 83.2% 53.3%), hsl(250 83.2% 53.3%))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              🤖
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'hsl(0 0% 98%)' }}>
                GPT 번역 상담
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'hsl(240 5% 64.9%)' }}>
                번역에 대해 질문하고 개선하세요
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid hsl(240 3.7% 15.9%)',
              color: 'hsl(240 5% 64.9%)',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'hsl(240 3.7% 15.9%)';
              e.currentTarget.style.color = 'hsl(0 0% 98%)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'hsl(240 5% 64.9%)';
            }}
          >
            ×
          </button>
        </div>

        {/* Context Cards */}
        <div style={{ padding: '16px 24px', display: 'flex', gap: '12px' }}>
          <div
            style={{
              flex: 1,
              padding: '14px 16px',
              background: 'hsl(240 3.7% 10%)',
              borderRadius: '12px',
              border: '1px solid hsl(240 3.7% 15.9%)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'hsl(240 5% 64.9%)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '6px',
              }}
            >
              🇰🇷 원문
            </div>
            <div style={{ fontSize: '13px', color: 'hsl(0 0% 98%)', lineHeight: 1.5 }}>
              {originalText}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: '14px 16px',
              background: 'hsla(221.2, 83.2%, 53.3%, 0.1)',
              borderRadius: '12px',
              border: '1px solid hsla(221.2, 83.2%, 53.3%, 0.2)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'hsl(221.2 83.2% 53.3%)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '6px',
              }}
            >
              🇺🇸 현재 번역
            </div>
            <div style={{ fontSize: '13px', color: 'hsl(0 0% 98%)', lineHeight: 1.5 }}>
              {currentTranslation}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px 24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: '240px',
            maxHeight: '300px',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'hsl(240 5% 64.9%)',
                textAlign: 'center',
                padding: '20px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'hsl(240 3.7% 10%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  marginBottom: '12px',
                }}
              >
                💬
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                대화를 시작하세요
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                "이 번역이 맞나요?" / "다른 표현 추천해줘"
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background:
                    msg.role === 'user'
                      ? 'linear-gradient(135deg, hsl(221.2 83.2% 53.3%), hsl(221.2 83.2% 45%))'
                      : 'hsl(240 3.7% 12%)',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: 'hsl(0 0% 98%)',
                  boxShadow: msg.role === 'user' ? '0 2px 8px hsla(221.2, 83.2%, 53.3%, 0.3)' : 'none',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'hsl(240 3.7% 12%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'hsl(221.2 83.2% 53.3%)',
                      animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Banner */}
        {lastSuggestion && (
          <div
            style={{
              margin: '0 24px 16px',
              padding: '14px 16px',
              background: 'hsla(142.1, 76.2%, 36.3%, 0.1)',
              borderRadius: '12px',
              border: '1px solid hsla(142.1, 76.2%, 36.3%, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'hsl(142.1 76.2% 36.3%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
              }}
            >
              ✨
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'hsl(142.1 76.2% 36.3%)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '4px',
                }}
              >
                제안된 번역
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'hsl(0 0% 98%)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {lastSuggestion}
              </div>
            </div>
            <button
              onClick={handleApplySuggestion}
              className="gpt-apply-btn"
              style={{
                padding: '8px 16px',
                background: 'hsl(142.1 76.2% 36.3%)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
            >
              적용
            </button>
          </div>
        )}

        {/* Input Area */}
        <div
          style={{
            padding: '16px 24px 20px',
            borderTop: '1px solid hsl(240 3.7% 15.9%)',
            display: 'flex',
            gap: '10px',
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="번역에 대해 질문하세요..."
            className="gpt-modal-input"
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'hsl(240 3.7% 10%)',
              border: '1px solid hsl(240 3.7% 15.9%)',
              borderRadius: '10px',
              color: 'hsl(0 0% 98%)',
              fontSize: '14px',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            disabled={isLoading}
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="gpt-modal-btn"
            style={{
              padding: '12px 24px',
              background: input.trim() && !isLoading ? 'hsl(221.2 83.2% 53.3%)' : 'hsl(240 3.7% 15.9%)',
              border: 'none',
              borderRadius: '10px',
              color: input.trim() && !isLoading ? '#fff' : 'hsl(240 5% 64.9%)',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

export default GptQuestionModal;
