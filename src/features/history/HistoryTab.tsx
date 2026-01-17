import { useState } from 'react';
import { useProjectStore, Project } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { isElectron, saveFiles, selectFolder } from '../../lib/fileSystem';

export function HistoryTab() {
  const { projects, deleteProject, clearAllProjects, updateProjectName } = useProjectStore();
  const { outputFolder, setOutputFolder } = useSettingsStore();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleSelectFolder = async () => {
    if (!isElectron()) {
      alert('데스크톱 앱에서만 사용 가능합니다.');
      return;
    }
    const folder = await selectFolder();
    if (folder) setOutputFolder(folder);
  };

  const toggleExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleDownloadFile = async (project: Project, fileType: 'english' | string, content: string) => {
    const baseName = project.name.replace(/\.(srt|txt)$/i, '');
    const fileName = fileType === 'english'
      ? `[ENG]_${baseName}.srt`
      : `[${fileType}]_${baseName}.srt`;

    const targetFolder = project.boundFolder || outputFolder;

    if (isElectron() && targetFolder) {
      await saveFiles(targetFolder, [{ fileName, content }]);
    } else if (isElectron()) {
      const folder = await selectFolder();
      if (folder) await saveFiles(folder, [{ fileName, content }]);
    } else {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadAll = async (project: Project) => {
    const baseName = project.name.replace(/\.(srt|txt)$/i, '');
    const files: { fileName: string; content: string }[] = [];

    if (project.englishSRT) {
      files.push({ fileName: `[ENG]_${baseName}.srt`, content: project.englishSRT });
    }
    project.translations.forEach((t) => {
      files.push({ fileName: `[${t.fileCode}]_${baseName}.srt`, content: t.content });
    });

    if (files.length === 0) return;

    const targetFolder = project.boundFolder || outputFolder;

    if (isElectron() && targetFolder) {
      await saveFiles(targetFolder, files);
      alert(`${files.length}개 파일 저장됨`);
    } else if (isElectron()) {
      const folder = await selectFolder();
      if (folder) {
        await saveFiles(folder, files);
        alert(`${files.length}개 파일 저장됨`);
      }
    } else {
      for (const file of files) {
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 200));
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const getLastWorkDate = (project: Project) => {
    const dates = [new Date(project.createdAt).getTime()];
    project.translations.forEach(t => {
      dates.push(new Date(t.completedAt).getTime());
    });
    return new Date(Math.max(...dates));
  };

  return (
    <div style={{ maxWidth: 650, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* 상위 폴더 경로 바 */}
      <div
        onClick={handleSelectFolder}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          marginBottom: 20,
          background: outputFolder ? 'rgba(124, 58, 237, 0.1)' : '#1a1a28',
          border: outputFolder ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid #2a2a3c',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>📁</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#666688', marginBottom: 2 }}>작업 폴더</div>
          <div style={{ fontSize: 13, color: outputFolder ? '#a78bfa' : '#666688', fontWeight: 500 }}>
            {outputFolder || '폴더를 선택하세요'}
          </div>
        </div>
        {outputFolder && (
          <span
            onClick={(e) => { e.stopPropagation(); setOutputFolder(''); }}
            style={{ color: '#666688', fontSize: 14, padding: 4, cursor: 'pointer' }}
          >
            ✕
          </span>
        )}
      </div>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
        <div style={{ fontSize: 13, color: '#aaaacc', fontWeight: 600 }}>
          하위 폴더 <span style={{ color: '#666688', fontWeight: 400 }}>({projects.length})</span>
        </div>
        {projects.length > 0 && (
          <button
            onClick={() => confirm('전체 삭제?') && clearAllProjects()}
            style={{
              fontSize: 11,
              color: '#666688',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            전체 삭제
          </button>
        )}
      </div>

      {/* 프로젝트 폴더 리스트 */}
      {projects.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 0',
          background: '#1a1a28',
          borderRadius: 12,
          border: '1px dashed #2a2a3c',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📂</div>
          <div style={{ fontSize: 13, color: '#666688' }}>프로젝트 폴더 없음</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map((project) => {
            const isExpanded = expandedProjects.has(project.id);
            const isEditing = editingId === project.id;
            const baseName = project.name.replace(/\.(srt|txt)$/i, '');
            const fileCount = (project.englishSRT ? 1 : 0) + project.translations.length;
            const lastWork = getLastWorkDate(project);
            const isComplete = project.englishReviewed && project.englishSRT;

            return (
              <div
                key={project.id}
                style={{
                  background: '#12121c',
                  border: '1px solid #2a2a3c',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {/* 폴더 헤더 (아코디언) */}
                <div
                  onClick={() => fileCount > 0 && toggleExpand(project.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 14px',
                    cursor: fileCount > 0 ? 'pointer' : 'default',
                    background: isExpanded ? '#1a1a28' : '#12121c',
                    transition: 'background 0.15s',
                    gap: 10,
                  }}
                >
                  {/* 폴더 아이콘 + 화살표 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {fileCount > 0 && (
                      <span style={{
                        fontSize: 10,
                        color: '#666688',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}>
                        ▶
                      </span>
                    )}
                    <span style={{ fontSize: 18 }}>
                      {isComplete ? (isExpanded ? '📂' : '📁') : '📝'}
                    </span>
                  </div>

                  {/* 폴더명 */}
                  <div style={{ flex: 1, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => {
                          if (editingName.trim()) updateProjectName(project.id, editingName.trim());
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingName.trim()) updateProjectName(project.id, editingName.trim());
                            setEditingId(null);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        style={{
                          width: '100%',
                          fontSize: 13,
                          fontWeight: 500,
                          padding: '4px 8px',
                          border: '1px solid #7c3aed',
                          borderRadius: 4,
                          outline: 'none',
                          background: '#0d0d14',
                          color: '#ffffff',
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => { setEditingId(project.id); setEditingName(project.name); }}
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#ffffff',
                          cursor: 'text',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {baseName}
                      </div>
                    )}
                  </div>

                  {/* 폴더 정보 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* 자막 수 */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                        {fileCount}
                      </div>
                      <div style={{ fontSize: 10, color: '#666688' }}>자막</div>
                    </div>

                    {/* 최근 작업일 */}
                    <div style={{ textAlign: 'right', minWidth: 50 }}>
                      <div style={{ fontSize: 12, color: '#aaaacc' }}>
                        {formatDate(lastWork.toISOString())}
                      </div>
                      <div style={{ fontSize: 10, color: '#666688' }}>최근</div>
                    </div>

                    {/* 상태 */}
                    {!isComplete && (
                      <span style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        background: 'rgba(251, 191, 36, 0.2)',
                        color: '#fbbf24',
                        borderRadius: 10,
                        fontWeight: 500,
                      }}>
                        진행중
                      </span>
                    )}

                    {/* 액션 버튼들 */}
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      {fileCount > 0 && (
                        <button
                          onClick={() => handleDownloadAll(project)}
                          style={{
                            fontSize: 11,
                            padding: '6px 10px',
                            background: '#7c3aed',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 5,
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          저장
                        </button>
                      )}
                      <button
                        onClick={() => confirm('삭제?') && deleteProject(project.id)}
                        style={{
                          fontSize: 11,
                          padding: '6px 8px',
                          background: '#1a1a28',
                          color: '#666688',
                          border: '1px solid #2a2a3c',
                          borderRadius: 5,
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>

                {/* 하위 파일 리스트 (확장 시) */}
                {isExpanded && fileCount > 0 && (
                  <div style={{ borderTop: '1px solid #2a2a3c', background: '#0d0d14' }}>
                    {/* 영어 자막 */}
                    {project.englishSRT && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 14px 10px 48px',
                          borderBottom: project.translations.length > 0 ? '1px solid #1a1a28' : 'none',
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>📄</span>
                        <span style={{ flex: 1, fontSize: 12, color: '#aaaacc' }}>
                          [ENG]_{baseName}.srt
                        </span>
                        <span style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          background: 'rgba(124, 58, 237, 0.2)',
                          color: '#a78bfa',
                          borderRadius: 4,
                          fontWeight: 500,
                        }}>
                          영어 원본
                        </span>
                        <button
                          onClick={() => handleDownloadFile(project, 'english', project.englishSRT!)}
                          style={{
                            fontSize: 10,
                            padding: '4px 8px',
                            background: '#1a1a28',
                            color: '#aaaacc',
                            border: '1px solid #2a2a3c',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          저장
                        </button>
                      </div>
                    )}

                    {/* 다국어 자막 */}
                    {project.translations.map((trans, idx) => (
                      <div
                        key={trans.langCode}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 14px 10px 48px',
                          borderBottom: idx < project.translations.length - 1 ? '1px solid #1a1a28' : 'none',
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>📄</span>
                        <span style={{ flex: 1, fontSize: 12, color: '#aaaacc' }}>
                          [{trans.fileCode}]_{baseName}.srt
                        </span>
                        <span style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          background: 'rgba(251, 191, 36, 0.2)',
                          color: '#fbbf24',
                          borderRadius: 4,
                          fontWeight: 500,
                        }}>
                          {trans.fileCode}
                        </span>
                        <button
                          onClick={() => handleDownloadFile(project, trans.fileCode, trans.content)}
                          style={{
                            fontSize: 10,
                            padding: '4px 8px',
                            background: '#1a1a28',
                            color: '#aaaacc',
                            border: '1px solid #2a2a3c',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          저장
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HistoryTab;
