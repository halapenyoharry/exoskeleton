import { createContext, useContext, type MouseEvent } from "react";
import type { AppStateV8 } from "./persistence/storage";

// Workspace-level actions the App owns (switch/create/rename/delete/
// export/import workspaces, reset layout) exposed to panels that need
// them — today only add-panel. dockview-react renders panels through
// React portals inside the App tree, so a plain context reaches them.

export interface WorkspaceActions {
  appState: AppStateV8 | null;
  switchWorkspace(id: string): void;
  createWorkspace(): void;
  renameWorkspace(): void;
  deleteWorkspace(): void;
  exportWorkspace(): void;
  importWorkspace(): void;
  openWorkspaceInNewWindow(id: string, e: MouseEvent): void;
  resetLayout(): void;
}

const noop = () => {};
export const WorkspaceActionsContext = createContext<WorkspaceActions>({
  appState: null,
  switchWorkspace: noop,
  createWorkspace: noop,
  renameWorkspace: noop,
  deleteWorkspace: noop,
  exportWorkspace: noop,
  importWorkspace: noop,
  openWorkspaceInNewWindow: noop,
  resetLayout: noop,
});

export function useWorkspaceActions(): WorkspaceActions {
  return useContext(WorkspaceActionsContext);
}
