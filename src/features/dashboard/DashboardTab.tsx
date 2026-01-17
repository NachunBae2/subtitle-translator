import { useState, useMemo } from 'react';
import { useStatsStore } from '../../stores/useStatsStore';
import { useProjectStore, Project, SimulatedComment, SentimentScore, ContentSummary } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import {
  analyzeSubtitles,
  parseSRTToBlocks,
  SubtitleAnalysis,
  WordFrequency,
} from '../../lib/subtitleAnalyzer';
import { simulateGlobalComments, summarizeContent, analyzeSentimentWithGPT } from '../../lib/translator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export function DashboardTab() {
  const { stats } = useStatsStore();
  const { projects, setSimulatedComments, setSentimentScores, setContentSummary } = useProjectStore();
  const { apiKey, channelInfo, model } = useSettingsStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isGeneratingComments, setIsGeneratingComments] = useState(false);
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [sentimentProgress, setSentimentProgress] = useState({ current: 0, total: 0 });
  const [translatingCommentId, setTranslatingCommentId] = useState<string | null>(null);
  const [translatedComments, setTranslatedComments] = useState<Record<string, string>>({});

  // 시간 포맷
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  // 절약 금액/시간 계산 (분당 5,000원 기준 / 문장당 1분 기준)
  const COST_PER_MINUTE = 5000;  // 스크립트 번역 분당 비용 (원)
  const TIME_PER_SENTENCE = 1;   // 문장당 번역 시간 (분)

  const savedStats = useMemo(() => {
    // 전체 프로젝트에서 번역 언어 수 및 문장 수 계산
    let totalSentences = 0;
    let totalLanguages = 0;
    let totalMinutes = 0;

    projects.forEach(project => {
      const blocks = project.koreanSRT ? parseSRTToBlocks(project.koreanSRT) : [];
      const sentenceCount = blocks.length;
      totalSentences += sentenceCount;

      // 영어 + 다국어 번역 수
      const langCount = (project.englishSRT ? 1 : 0) + project.translations.length;
      totalLanguages += langCount;

      // 영상 분 수 (마지막 자막의 끝 시간 기준)
      if (blocks.length > 0) {
        const lastBlock = blocks[blocks.length - 1];
        const match = lastBlock.endTime?.match(/(\d+):(\d+):(\d+)/);
        if (match) {
          totalMinutes += parseInt(match[1]) * 60 + parseInt(match[2]);
        }
      }
    });

    // 절약 비용 = 영상분수 × 분당비용 × 번역언어수
    const savedCost = totalMinutes * COST_PER_MINUTE * Math.max(totalLanguages, 1);
    // 절약 시간 = 문장수 × 1분 × 번역언어수
    const savedTime = totalSentences * TIME_PER_SENTENCE * Math.max(totalLanguages, 1);

    return {
      savedCost,
      savedTime,
      totalLanguages,
      totalSentences,
    };
  }, [projects]);

  // 선택된 프로젝트의 자막 분석
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const subtitleAnalysis = useMemo<SubtitleAnalysis | null>(() => {
    if (!selectedProject?.koreanSRT) return null;
    const blocks = parseSRTToBlocks(selectedProject.koreanSRT);
    return analyzeSubtitles(blocks);
  }, [selectedProject]);

  // 최근 프로젝트 (최대 5개)
  const recentProjects = projects.slice(0, 5);

  // 댓글 시뮬레이션 생성
  const handleGenerateComments = async () => {
    if (!selectedProject || !apiKey) return;

    setIsGeneratingComments(true);
    try {
      // 콘텐츠 요약 생성 (이미 있으면 사용)
      let contentSummary = selectedProject.contentSummary?.summary || '';
      if (!contentSummary && selectedProject.koreanSRT) {
        const fullText = parseSRTToBlocks(selectedProject.koreanSRT).map(b => b.text).join(' ');
        const summary = await summarizeContent(apiKey, fullText, model);
        contentSummary = summary.summary;
      }

      // 자막 전문 추출 (고유명사 추출용)
      const fullSubtitleText = selectedProject.koreanSRT
        ? parseSRTToBlocks(selectedProject.koreanSRT).map(b => b.text).join('\n')
        : '';

      // 댓글 시뮬레이션
      const comments = await simulateGlobalComments({
        apiKey,
        contentSummary,
        subtitleText: fullSubtitleText,
        channelGenre: channelInfo.genre,
        targetAudience: channelInfo.targetAudience,
        model,
        commentCount: 10,
      });

      setSimulatedComments(selectedProject.id, comments);
    } catch (error) {
      console.error('댓글 시뮬레이션 실패:', error);
      alert('댓글 생성에 실패했습니다.');
    } finally {
      setIsGeneratingComments(false);
    }
  };

  // GPT 감성분석 핸들러
  const handleAnalyzeSentiment = async () => {
    if (!selectedProject || !apiKey || !selectedProject.koreanSRT) return;

    setIsAnalyzingSentiment(true);
    try {
      const blocks = parseSRTToBlocks(selectedProject.koreanSRT);

      // 10개 블록씩 청크로 묶기
      const CHUNK_SIZE = 10;
      const chunks: string[] = [];
      for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
        const chunkBlocks = blocks.slice(i, i + CHUNK_SIZE);
        chunks.push(chunkBlocks.map(b => b.text).join('\n'));
      }

      setSentimentProgress({ current: 0, total: chunks.length });

      const scores = await analyzeSentimentWithGPT(
        apiKey,
        chunks,
        model,
        (current, total) => setSentimentProgress({ current, total })
      );

      setSentimentScores(selectedProject.id, scores);
    } catch (error) {
      console.error('감성분석 실패:', error);
      alert('감성분석에 실패했습니다.');
    } finally {
      setIsAnalyzingSentiment(false);
    }
  };

  // 콘텐츠 요약 생성 핸들러
  const handleGenerateSummary = async () => {
    if (!selectedProject || !apiKey || !selectedProject.koreanSRT) return;

    setIsGeneratingSummary(true);
    try {
      const fullText = parseSRTToBlocks(selectedProject.koreanSRT).map(b => b.text).join(' ');
      const summary = await summarizeContent(apiKey, fullText, model);

      setContentSummary(selectedProject.id, {
        summary: summary.summary,
        topics: summary.topics || [],
        analyzedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('콘텐츠 요약 실패:', error);
      alert('콘텐츠 요약 생성에 실패했습니다.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 댓글 번역 핸들러
  const handleTranslateComment = async (comment: SimulatedComment) => {
    if (!apiKey || translatedComments[comment.id]) return;

    setTranslatingCommentId(comment.id);
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

      const response = await client.chat.completions.create({
        model: model || 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: '다음 댓글을 자연스러운 한국어로 번역해주세요. 번역만 출력하고 다른 설명은 하지 마세요.',
          },
          { role: 'user', content: comment.comment },
        ],
        temperature: 0.3,
        max_completion_tokens: 200,
      });

      const translated = response.choices[0]?.message?.content?.trim() || '';
      setTranslatedComments(prev => ({ ...prev, [comment.id]: translated }));
    } catch (error) {
      console.error('댓글 번역 실패:', error);
    } finally {
      setTranslatingCommentId(null);
    }
  };

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 핵심 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          icon="📄"
          value={stats.totalSubtitles}
          label="번역한 파일"
          color="var(--color-primary-500)"
        />
        <StatCard
          icon="💬"
          value={savedStats.totalSentences.toLocaleString()}
          label="번역한 문장"
          color="var(--color-success-500)"
        />
        <StatCard
          icon="💰"
          value={`₩${(savedStats.savedCost / 10000).toFixed(0)}만`}
          label="절약한 비용"
          subtitle={`분당 ${(COST_PER_MINUTE / 1000).toFixed(0)}천원 × ${savedStats.totalLanguages}개 언어`}
          color="var(--color-warning-500)"
        />
        <StatCard
          icon="⏰"
          value={formatTime(savedStats.savedTime)}
          label="절약한 시간"
          subtitle={`문장당 1분 × ${savedStats.totalLanguages}개 언어`}
          color="var(--color-error-500)"
        />
      </div>

      {/* 최근 프로젝트 & 자막 분석 */}
      <div style={{ display: 'grid', gridTemplateColumns: projects.length > 0 ? '1fr 2fr' : '1fr', gap: 'var(--space-4)' }}>
        {/* 최근 프로젝트 목록 */}
        {projects.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-header-icon">📁</span>
              <div>
                <h2 className="card-title">최근 프로젝트</h2>
                <p className="card-subtitle">자막 분석하기</p>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {recentProjects.map((project, idx) => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProjectId(selectedProjectId === project.id ? null : project.id)}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: idx < recentProjects.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    cursor: 'pointer',
                    background: selectedProjectId === project.id ? 'var(--surface-secondary)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <StatusBadge status={project.status} />
                    <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {new Date(project.createdAt).toLocaleDateString('ko-KR')} · {project.translations.length}개 언어
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 자막 분석 결과 */}
        {subtitleAnalysis ? (
          <div className="card">
            <div className="card-header">
              <span className="card-header-icon">📊</span>
              <div>
                <h2 className="card-title">{selectedProject?.name} 분석</h2>
                <p className="card-subtitle">{subtitleAnalysis.blockCount}개 자막 · {Math.round(subtitleAnalysis.timeAnalysis.totalDuration)}초</p>
              </div>
            </div>
            <div className="card-body">
              {/* 기본 통계 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <MiniStat label="총 글자" value={subtitleAnalysis.totalCharacters.toLocaleString()} />
                <MiniStat label="총 단어" value={subtitleAnalysis.totalWords.toLocaleString()} />
                <MiniStat label="평균 단어/자막" value={subtitleAnalysis.avgWordsPerBlock.toFixed(1)} />
                <MiniStat label="말하기 속도" value={`${Math.round(subtitleAnalysis.speakingPace)} WPM`} />
              </div>

              {/* 시간 분석 & 대화 패턴 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                {/* 자막 길이 분포 */}
                <div>
                  <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                    자막 길이 분포
                  </h4>
                  {subtitleAnalysis.timeAnalysis.durationDistribution.map(item => (
                    <BarItem
                      key={item.range}
                      label={item.range}
                      value={item.count}
                      max={subtitleAnalysis.blockCount}
                      color="var(--color-primary-500)"
                    />
                  ))}
                </div>

                {/* 대화 텀 분석 */}
                <div>
                  <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                    대화 텀 분석
                  </h4>
                  {subtitleAnalysis.gapAnalysis.gapDistribution.map(item => (
                    <BarItem
                      key={item.range}
                      label={item.range}
                      value={item.count}
                      max={subtitleAnalysis.blockCount}
                      color="var(--color-success-500)"
                    />
                  ))}
                </div>
              </div>

              {/* GPT 감성 분석 */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    🎭 GPT 감성 분석
                  </h4>
                  <button
                    onClick={handleAnalyzeSentiment}
                    disabled={isAnalyzingSentiment || !apiKey}
                    className="action-btn"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isAnalyzingSentiment
                        ? 'var(--surface-tertiary)'
                        : 'linear-gradient(135deg, #10b981, #059669)',
                      color: isAnalyzingSentiment ? 'var(--text-muted)' : 'white',
                      cursor: isAnalyzingSentiment ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      boxShadow: isAnalyzingSentiment ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {isAnalyzingSentiment
                      ? `분석 중... (${sentimentProgress.current}/${sentimentProgress.total})`
                      : selectedProject?.sentimentScores
                      ? '🔄 다시 분석'
                      : '✨ 청크별 분석 시작'}
                  </button>
                </div>

                {selectedProject?.sentimentScores && selectedProject.sentimentScores.length > 0 ? (
                  <GPTSentimentPanel scores={selectedProject.sentimentScores} />
                ) : (
                  <div style={{
                    padding: 'var(--space-5)',
                    background: 'var(--surface-secondary)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: 'var(--space-2)' }}>🤖</div>
                    <p style={{ margin: 0 }}>GPT가 청크 단위로 감성을 분석합니다.</p>
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)' }}>버튼을 눌러 분석을 시작하세요!</p>
                  </div>
                )}
              </div>

              {/* AI 콘텐츠 요약 */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    📝 AI 콘텐츠 요약
                  </h4>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary || !apiKey}
                    className="action-btn"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isGeneratingSummary
                        ? 'var(--surface-tertiary)'
                        : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: isGeneratingSummary ? 'var(--text-muted)' : 'white',
                      cursor: isGeneratingSummary ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      boxShadow: isGeneratingSummary ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {isGeneratingSummary
                      ? '요약 중...'
                      : selectedProject?.contentSummary
                      ? '🔄 다시 요약'
                      : '✨ 요약 생성'}
                  </button>
                </div>

                {selectedProject?.contentSummary ? (
                  <ContentSummaryPanel summary={selectedProject.contentSummary} />
                ) : (
                  <div style={{
                    padding: 'var(--space-5)',
                    background: 'var(--surface-secondary)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: 'var(--space-2)' }}>📄</div>
                    <p style={{ margin: 0 }}>AI가 영상 콘텐츠를 요약합니다.</p>
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)' }}>버튼을 눌러 요약을 생성하세요!</p>
                  </div>
                )}
              </div>

              {/* 단어 빈도 막대그래프 & 워드클라우드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {/* 단어 빈도 막대그래프 */}
                <div>
                  <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                    📊 자주 사용한 단어 TOP 10
                  </h4>
                  <WordBarChart words={subtitleAnalysis.topWords.slice(0, 10)} />
                </div>

                {/* 워드클라우드 (전체 자막 기준) */}
                <div>
                  <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                    ☁️ 워드클라우드
                  </h4>
                  <WordCloud words={subtitleAnalysis.topWords} />
                </div>
              </div>

              {/* 댓글 시뮬레이션 - 유튜브 스타일 */}
              <div style={{ marginTop: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '18px' }}>💬</span>
                    댓글 {selectedProject?.simulatedComments?.length || 0}개
                  </h4>
                  <button
                    onClick={handleGenerateComments}
                    disabled={isGeneratingComments || !apiKey}
                    className="action-btn"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isGeneratingComments
                        ? 'var(--surface-tertiary)'
                        : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      color: isGeneratingComments ? 'var(--text-muted)' : 'white',
                      cursor: isGeneratingComments ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      boxShadow: isGeneratingComments ? 'none' : '0 2px 8px rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    {isGeneratingComments ? '생성 중...' : selectedProject?.simulatedComments ? '🔄 다시 생성' : '✨ AI 댓글 생성'}
                  </button>
                </div>

                {selectedProject?.simulatedComments && selectedProject.simulatedComments.length > 0 ? (
                  <YouTubeStyleComments
                    comments={selectedProject.simulatedComments}
                    onTranslate={handleTranslateComment}
                    translatingId={translatingCommentId}
                    translatedComments={translatedComments}
                  />
                ) : (
                  <div style={{
                    padding: 'var(--space-6)',
                    background: 'var(--surface-secondary)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: 'var(--space-2)' }}>🌍</div>
                    <p style={{ margin: 0 }}>AI가 전 세계 시청자 반응을 예측합니다.</p>
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)' }}>버튼을 눌러 댓글을 생성하세요!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-3)' }}>📊</div>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>자막 분석</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                {projects.length > 0
                  ? '왼쪽에서 프로젝트를 선택하면 자막 분석을 볼 수 있어요'
                  : '번역 탭에서 자막을 번역하면 분석 결과를 볼 수 있어요'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 언어별 통계 */}
      {Object.keys(stats.languageDistribution).length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-icon">🌍</span>
            <div>
              <h2 className="card-title">언어별 번역</h2>
              <p className="card-subtitle">다국어 번역 분포</p>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {Object.entries(stats.languageDistribution).map(([lang, count]) => (
                <div
                  key={lang}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--surface-secondary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <span style={{ fontWeight: 'var(--font-medium)' }}>{lang.toUpperCase()}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{count}개</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ icon, value, label, subtitle, color }: { icon: string; value: string | number; label: string; subtitle?: string; color: string }) {
  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color }}>{value}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{label}</div>
          {subtitle && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

// 미니 통계
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

// 바 차트 아이템
function BarItem({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '2px' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{value}개</span>
      </div>
      <div style={{ height: '6px', background: 'var(--surface-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percentage}%`, background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// GPT 감성 분석 패널 (청크 기반)
function GPTSentimentPanel({ scores }: { scores: SentimentScore[] }) {
  // 전체 평균 점수 계산 (0~100 범위)
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

  // 4가지 레이블 카운트
  const positiveCount = scores.filter(s => s.label === 'positive').length;
  const neutralCount = scores.filter(s => s.label === 'neutral').length;
  const negativeCount = scores.filter(s => s.label === 'negative').length;
  const veryNegativeCount = scores.filter(s => s.label === 'very_negative').length;

  const getMoodEmoji = () => {
    if (avgScore >= 75) return '😊';
    if (avgScore >= 40) return '😐';
    if (avgScore >= 20) return '😕';
    return '😢';
  };

  const getMoodColor = () => {
    if (avgScore >= 75) return 'var(--color-success-500)';
    if (avgScore >= 40) return 'var(--color-warning-500)';
    return 'var(--color-error-500)';
  };

  const getMoodText = () => {
    if (avgScore >= 75) return '긍정적';
    if (avgScore >= 40) return '중립적';
    if (avgScore >= 20) return '부정적';
    return '매우 부정적';
  };

  return (
    <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
      {/* 메인 감성 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: '40px' }}>{getMoodEmoji()}</span>
        <div>
          <div style={{ fontWeight: 700, color: getMoodColor(), fontSize: 'var(--text-xl)' }}>{getMoodText()}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            평균 점수: {avgScore.toFixed(0)}점
          </div>
        </div>
      </div>

      {/* 청크별 분포 (4단계) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
        {positiveCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#86efac' }} />
            <span>긍정 {positiveCount}</span>
          </div>
        )}
        {neutralCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--text-muted)' }} />
            <span>중립 {neutralCount}</span>
          </div>
        )}
        {negativeCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#fca5a5' }} />
            <span>부정 {negativeCount}</span>
          </div>
        )}
        {veryNegativeCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
            <span>매우부정 {veryNegativeCount}</span>
          </div>
        )}
      </div>

      {/* 감성 흐름 차트 */}
      <SentimentFlowChart scores={scores} />

      {/* 청크별 요약 리스트 (접힌 상태) */}
      <details style={{ marginTop: 'var(--space-4)' }}>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          청크별 상세 보기 ({scores.length}개)
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '200px', overflowY: 'auto', marginTop: 'var(--space-2)' }}>
          {scores.map((s, idx) => (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '6px 10px',
              background: 'var(--surface-primary)',
              borderRadius: '6px',
              fontSize: 'var(--text-xs)',
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: s.label.includes('positive') ? 'var(--color-success-500)' : s.label.includes('negative') ? 'var(--color-error-500)' : 'var(--text-muted)',
              }} />
              <span style={{ fontWeight: 600 }}>#{idx + 1}</span>
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>{s.summary}</span>
              <span style={{ color: s.label.includes('positive') ? 'var(--color-success-500)' : s.label.includes('negative') ? 'var(--color-error-500)' : 'var(--text-muted)' }}>
                {s.score.toFixed(0)}점
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// 단어 빈도 수평 막대그래프
function WordBarChart({ words }: { words: WordFrequency[] }) {
  const maxCount = Math.max(...words.map(w => w.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {words.map((word, idx) => {
        const percentage = (word.count / maxCount) * 100;
        const hue = 220 - idx * 10; // 색상 그라데이션

        return (
          <div key={word.word} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* 단어 */}
            <div style={{
              width: '60px',
              textAlign: 'right',
              fontSize: 'var(--text-xs)',
              fontWeight: idx < 3 ? 600 : 400,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {word.word}
            </div>

            {/* 바 */}
            <div style={{ flex: 1, height: '16px', background: 'var(--surface-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${percentage}%`,
                  background: `hsl(${hue}, 70%, 50%)`,
                  borderRadius: '4px',
                  transition: 'width 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '4px',
                }}
              >
                {percentage > 30 && (
                  <span style={{ fontSize: '10px', color: 'white', fontWeight: 500 }}>{word.count}</span>
                )}
              </div>
            </div>

            {/* 카운트 (바 밖에 표시) */}
            {percentage <= 30 && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', minWidth: '24px' }}>{word.count}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// CSS 기반 워드클라우드
function WordCloud({ words }: { words: WordFrequency[] }) {
  const maxCount = Math.max(...words.map(w => w.count), 1);

  // 색상 팔레트
  const colors = [
    'var(--color-primary-500)',
    'var(--color-success-500)',
    'var(--color-warning-500)',
    'var(--color-error-500)',
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];

  // 의사 랜덤 생성 (단어 기반으로 일관된 위치)
  const getPosition = (word: string, idx: number) => {
    const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return {
      x: ((hash * 13 + idx * 7) % 80) + 5,
      y: ((hash * 17 + idx * 11) % 70) + 10,
      rotate: ((hash % 5) - 2) * 5,
    };
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '200px',
        background: 'var(--surface-secondary)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {words.map((word, idx) => {
        const ratio = word.count / maxCount;
        const fontSize = 10 + ratio * 24; // 10px ~ 34px
        const pos = getPosition(word.word, idx);
        const color = colors[idx % colors.length];

        return (
          <span
            key={word.word}
            style={{
              position: 'absolute',
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              fontSize: `${fontSize}px`,
              fontWeight: ratio > 0.5 ? 700 : ratio > 0.3 ? 500 : 400,
              color,
              opacity: 0.7 + ratio * 0.3,
              transform: `rotate(${pos.rotate}deg)`,
              cursor: 'default',
              whiteSpace: 'nowrap',
              transition: 'transform 0.2s, opacity 0.2s',
            }}
            title={`${word.count}회 (${word.percentage.toFixed(1)}%)`}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = `rotate(${pos.rotate}deg) scale(1.1)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = String(0.7 + ratio * 0.3);
              e.currentTarget.style.transform = `rotate(${pos.rotate}deg) scale(1)`;
            }}
          >
            {word.word}
          </span>
        );
      })}
    </div>
  );
}

// 상태 뱃지
function StatusBadge({ status }: { status: Project['status'] }) {
  const config = {
    translating: { color: 'var(--color-warning-500)', bg: 'var(--color-warning-100)', text: '번역중' },
    reviewing: { color: 'var(--color-primary-500)', bg: 'var(--color-primary-100)', text: '검수중' },
    multilang: { color: 'var(--color-success-500)', bg: 'var(--color-success-100)', text: '다국어' },
    completed: { color: 'var(--color-success-600)', bg: 'var(--color-success-100)', text: '완료' },
  }[status];

  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 500,
        color: config.color,
        background: config.bg,
      }}
    >
      {config.text}
    </span>
  );
}

// 콘텐츠 요약 패널
function ContentSummaryPanel({ summary }: { summary: ContentSummary }) {
  return (
    <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
      {/* 요약 */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-2)' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>요약</span>
        </div>
        <p style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          lineHeight: 1.6,
          padding: 'var(--space-3)',
          background: 'var(--surface-primary)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--color-primary-400)',
        }}>
          {summary.summary}
        </p>
      </div>

      {/* 주요 토픽 */}
      {summary.topics && summary.topics.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '18px' }}>🏷️</span>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>주요 토픽</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {summary.topics.map((topic, idx) => (
              <span
                key={idx}
                style={{
                  padding: '4px 12px',
                  background: 'linear-gradient(135deg, var(--color-primary-100), var(--color-primary-50))',
                  color: 'var(--color-primary-600)',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                #{topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 분석 시간 */}
      <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        분석: {new Date(summary.analyzedAt).toLocaleString('ko-KR')}
      </div>
    </div>
  );
}

// GPT 감성 흐름 차트 (Recharts)
function SentimentFlowChart({ scores }: { scores: Array<{ chunkIndex: number; score: number; label: string; summary: string }> }) {
  const data = scores.map((s, idx) => ({
    chunk: idx + 1,
    score: s.score,
    label: s.label,
    summary: s.summary,
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { chunk: number; score: number; summary: string } }> }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div style={{
          background: 'var(--surface-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>청크 #{d.chunk}</div>
          <div style={{ color: d.score >= 55 ? 'var(--color-success-500)' : d.score < 45 ? 'var(--color-error-500)' : 'var(--text-muted)' }}>
            점수: {d.score.toFixed(0)}점
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{d.summary}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height: '180px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis
            dataKey="chunk"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={{ stroke: 'var(--border-default)' }}
          />
          <YAxis
            domain={[-1, 1]}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={{ stroke: 'var(--border-default)' }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="var(--border-default)" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="url(#sentimentGradient)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-primary-500)', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, fill: 'var(--color-primary-400)' }}
          />
          <defs>
            <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-success-500)" />
              <stop offset="50%" stopColor="var(--color-warning-500)" />
              <stop offset="100%" stopColor="var(--color-error-500)" />
            </linearGradient>
          </defs>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// 유튜브 스타일 댓글 컴포넌트
function YouTubeStyleComments({
  comments,
  onTranslate,
  translatingId,
  translatedComments,
}: {
  comments: SimulatedComment[];
  onTranslate: (comment: SimulatedComment) => void;
  translatingId: string | null;
  translatedComments: Record<string, string>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {comments.map((comment) => {
        const isTranslating = translatingId === comment.id;
        const translated = translatedComments[comment.id];

        return (
          <div key={comment.id} style={{ display: 'flex', gap: '12px' }}>
            {/* 프로필 아바타 */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}
            >
              {comment.countryFlag}
            </div>

            {/* 댓글 컨텐츠 */}
            <div style={{ flex: 1 }}>
              {/* 유저네임 + 시간 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                  @{comment.username}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {comment.countryName}
                </span>
              </div>

              {/* 댓글 내용 */}
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}>
                {comment.comment}
              </p>

              {/* 번역된 내용 */}
              {translated && (
                <p style={{
                  margin: '8px 0 0',
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-secondary)',
                  borderRadius: '8px',
                  borderLeft: '3px solid var(--color-primary-400)',
                  lineHeight: 1.5,
                }}>
                  {translated}
                </p>
              )}

              {/* 액션 버튼 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginTop: '8px',
              }}>
                {/* 좋아요 */}
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span>👍</span>
                  <span>{comment.likes}</span>
                </button>

                {/* 싫어요 */}
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span>👎</span>
                </button>

                {/* 번역하기 버튼 */}
                {!translated && (
                  <button
                    onClick={() => onTranslate(comment)}
                    disabled={isTranslating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'transparent',
                      border: 'none',
                      color: isTranslating ? 'var(--text-muted)' : 'var(--color-primary-500)',
                      fontSize: '12px',
                      cursor: isTranslating ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      transition: 'background 0.2s',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => !isTranslating && (e.currentTarget.style.background = 'var(--surface-secondary)')}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {isTranslating ? (
                      <>
                        <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                        <span>번역 중...</span>
                      </>
                    ) : (
                      <>
                        <span>🌐</span>
                        <span>번역하기</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DashboardTab;
