import { useAppStore, Tab } from '../stores/useAppStore';
import { Sidebar } from '../components/layout/Sidebar';
import { SettingsTab } from '../features/settings';
import { TranslateTab } from '../features/translate';
import { ReviewTab } from '../features/review';
import { MultiLangTab } from '../features/multilang';
import { HistoryTab } from '../features/history/HistoryTab';
import { DashboardTab } from '../features/dashboard';
import { FeedbackTab } from '../features/feedback';
import { TerminologyTab } from '../features/dictionary/TerminologyTab';
import { MemeTab } from '../features/dictionary/MemeTab';
import '../styles/index.css';

// Tab Info for header
const TAB_INFO: Record<Tab, { title: string; subtitle: string }> = {
  dashboard: {
    title: '대시보드',
    subtitle: '번역 통계와 뱃지를 확인하세요',
  },
  settings: {
    title: '설정',
    subtitle: 'API, 채널, 용어 사전 설정',
  },
  translate: {
    title: '한글 → 영어',
    subtitle: '한글 자막을 영어로 번역',
  },
  review: {
    title: '자막 검수',
    subtitle: '원본과 번역 비교 검수',
  },
  multilang: {
    title: '다국어 번역',
    subtitle: '영어 → 다국어 번역',
  },
  history: {
    title: '프로젝트',
    subtitle: '프로젝트 관리 및 다운로드',
  },
  feedback: {
    title: '피드백',
    subtitle: 'AI 번역 피드백 노트',
  },
  terminology: {
    title: '전문용어 사전',
    subtitle: '번역에 사용할 용어집 관리',
  },
  meme: {
    title: '밈노트',
    subtitle: '유행어, 밈 표현 관리',
  },
};

// Tab Content Component
function TabContent({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'dashboard':
      return <DashboardTab />;
    case 'settings':
      return <SettingsTab />;
    case 'translate':
      return <TranslateTab />;
    case 'review':
      return <ReviewTab />;
    case 'multilang':
      return <MultiLangTab />;
    case 'history':
      return <HistoryTab />;
    case 'feedback':
      return <FeedbackTab />;
    case 'terminology':
      return <TerminologyTab />;
    case 'meme':
      return <MemeTab />;
  }
}

// Main App Component
export default function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const tabInfo = TAB_INFO[activeTab];

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-content">
        <header className="main-header">
          <h1 className="main-header-title">{tabInfo.title}</h1>
          <p className="main-header-subtitle">{tabInfo.subtitle}</p>
        </header>

        <main className={`main-body ${activeTab === 'review' ? 'full-width' : 'centered'}`}>
          <TabContent tab={activeTab} />
        </main>
      </div>
    </div>
  );
}
