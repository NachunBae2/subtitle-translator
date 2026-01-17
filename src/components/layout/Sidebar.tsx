import { useAppStore, Tab } from '../../stores/useAppStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useTranslateStore } from '../../stores/useTranslateStore';
import { useProjectStore } from '../../stores/useProjectStore';

interface NavItem {
  id: Tab;
  icon: string;
  label: string;
  badge?: string | number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const { activeTab, setActiveTab } = useAppStore();
  const { isApiKeyValid, apiKey } = useSettingsStore();
  const { reviewStatus, koreanBlocks, englishBlocks } = useTranslateStore();
  const { projects } = useProjectStore();

  const isConnected = apiKey && isApiKeyValid();

  // Calculate pending review count (only if blocks exist)
  const hasBlocks = koreanBlocks.length > 0 && englishBlocks.length > 0;
  const pendingCount = hasBlocks
    ? Object.values(reviewStatus).filter((s) => s === 'pending').length
    : 0;

  const navGroups: NavGroup[] = [
    {
      title: '',
      items: [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      ]
    },
    {
      title: 'Memory',
      items: [
        { id: 'settings', icon: '⚙️', label: 'Settings' },
        { id: 'terminology', icon: '📖', label: 'Terminology' },
        { id: 'meme', icon: '🎭', label: 'Meme Note' },
        { id: 'feedback', icon: '💬', label: 'Feedback' },
      ]
    },
    {
      title: 'Actions',
      items: [
        { id: 'translate', icon: '📝', label: 'Translate' },
        {
          id: 'review',
          icon: '🔍',
          label: 'Review',
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
        { id: 'multilang', icon: '🌍', label: 'Multilang' },
        {
          id: 'history',
          icon: '📂',
          label: 'Projects',
          badge: projects.length > 0 ? projects.length : undefined,
        },
      ]
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🧶</span>
          <span className="sidebar-logo-text">자막 번역기</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="sidebar-nav-group">
            {group.title && (
              <div className="sidebar-section">{group.title}</div>
            )}
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="sidebar-nav-item-icon">{item.icon}</span>
                <span className="sidebar-nav-item-label">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="sidebar-nav-item-badge">{item.badge}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span
            className={`sidebar-status-dot ${isConnected ? 'connected' : 'disconnected'}`}
          />
          <span>{isConnected ? 'API Connected' : 'API Disconnected'}</span>
        </div>
      </div>
    </aside>
  );
}
