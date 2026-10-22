import { createContext, useContext } from "react";
import type { Workspace } from "../persistence/storage";

/**
 * Actions + state the menu panel needs from App. App owns the workspace
 * state and the Dockview api, so the panel reads them through this context
 * (it sits above DockviewReact, so panel portals can see it).
 */
export interface MenuActions {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  isPanelOpen: (id: string) => boolean;
  addPanel: (id: string) => void;
  switchWorkspace: (id: string) => void;
  createWorkspace: () => void;
  renameWorkspace: () => void;
  deleteWorkspace: () => void;
  openWorkspaceInNewWindow: (id: string) => void;
  exportWorkspace: () => void;
  importWorkspace: () => void;
  resetLayout: () => void;
  closeMenu: () => void;
  /** Phone deck mode: the menu also carries the status-bar toggle and Settings. */
  deckMode: boolean;
  /** Phone width (grid or deck): the menu carries the "One pane at a time" toggle. */
  phone: boolean;
  deckOptIn: boolean;
  toggleDeck: () => void;
  statusBarVisible: boolean;
  toggleStatusBar: () => void;
  toggleSettings: () => void;
  /** The document edge (left): the loaded JSON document, always plugged in. */
  isDocumentOpen: () => boolean;
  toggleDocument: () => void;
}

export const MenuContext = createContext<MenuActions | null>(null);

export function useMenuActions(): MenuActions | null {
  return useContext(MenuContext);
}
