import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen, Save, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllProjects, deleteProject, formatSavedAt, SavedProject } from '@/lib/projectStorage';

interface ProjectManagerProps {
  hasActiveProject: boolean;
  onSave: (name: string) => void;
  onLoad: (project: SavedProject) => void;
}

export default function ProjectManager({ hasActiveProject, onSave, onLoad }: ProjectManagerProps) {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reload project list whenever panel opens
  useEffect(() => {
    if (open) {
      setProjects(getAllProjects());
    }
  }, [open]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSave = () => {
    const name = projectName.trim() || `项目 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    onSave(name);
    setProjectName('');
    // Refresh list after save with a tiny delay to let saveProject write
    setTimeout(() => setProjects(getAllProjects()), 50);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteProject(id);
    setProjects(getAllProjects());
  };

  const handleLoad = (project: SavedProject) => {
    onLoad(project);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        size="sm"
        variant="outline"
        className="text-[9px] sm:text-xs gap-1 border-[#7B6A9B] text-[#7B6A9B] hover:bg-purple-50 rounded-full px-2 sm:px-3 h-7 w-full sm:w-auto"
        onClick={() => setOpen((v) => !v)}
      >
        <FolderOpen className="w-3 h-3" />
        My Projects
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-[#F5EFE6] border border-border rounded-lg shadow-xl z-50 p-3 flex flex-col gap-3">
          {/* Save section */}
          {hasActiveProject && (
            <div className="flex gap-2">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                placeholder="输入项目名称…"
                className="flex-1 h-7 px-2 text-xs border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#7B6A9B]"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 border-[#7B6A9B] text-[#7B6A9B] hover:bg-purple-50 rounded flex-shrink-0"
                onClick={handleSave}
              >
                <Save className="w-3 h-3" /> 保存
              </Button>
            </div>
          )}

          {/* Project list */}
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {projects.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4">暂无保存的项目</p>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border bg-white hover:bg-purple-50 cursor-pointer transition-colors group"
                  onClick={() => handleLoad(project)}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 flex-shrink-0 rounded border border-border overflow-hidden bg-[#EDE7DA]">
                    {project.thumbnailDataUrl ? (
                      <img
                        src={project.thumbnailDataUrl}
                        alt={project.name}
                        className="w-full h-full object-cover"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">无图</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{project.name}</p>
                    <p className="text-[10px] text-muted-foreground">{project.gridWidth} × {project.gridHeight}</p>
                    <p className="text-[9px] text-muted-foreground">{formatSavedAt(project.savedAt)}</p>
                  </div>

                  {/* Delete */}
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={(e) => handleDelete(e, project.id)}
                    title="删除项目"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
