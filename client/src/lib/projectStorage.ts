const PROJECTS_KEY = 'ycs_projects_v1';
const MAX_PROJECTS = 10;

export interface SavedProject {
  id: string;
  name: string;
  savedAt: string; // ISO string
  thumbnailDataUrl: string;
  gridWidth: number;
  gridHeight: number;
  pixelsJson: string;
  colorStatsJson: string;
  backgroundIndicesJson: string;
  gridSize: number;
}

export function saveProject(name: string, data: Omit<SavedProject, 'id' | 'name' | 'savedAt'>): SavedProject {
  const project: SavedProject = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    savedAt: new Date().toISOString(),
    ...data,
  };

  try {
    const existing = getAllProjects();
    const updated = [project, ...existing].slice(0, MAX_PROJECTS);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[projectStorage] saveProject failed:', e);
  }

  return project;
}

export function getAllProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedProject[];
  } catch (e) {
    console.warn('[projectStorage] getAllProjects failed:', e);
    return [];
  }
}

export function deleteProject(id: string): void {
  try {
    const existing = getAllProjects();
    const updated = existing.filter((p) => p.id !== id);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[projectStorage] deleteProject failed:', e);
  }
}

export function formatSavedAt(iso: string): string {
  try {
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function generateThumbnail(canvas: HTMLCanvasElement | null, size = 80): string {
  if (!canvas) return '';
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(canvas, 0, 0, size, size);
    return offscreen.toDataURL('image/png');
  } catch (e) {
    console.warn('[projectStorage] generateThumbnail failed:', e);
    return '';
  }
}
