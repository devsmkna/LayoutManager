// File: src/extension.ts
// Main extension file for Layout Manager
import * as vscode from "vscode";

interface LayoutConfig {
  name: string;
  sidebar?: {
    view: string;
  };
  panel?: {
    view: string;
    maximized?: boolean;
  };
  editorLayout?: {
    orientation: number;
    groups: Array<{ size?: number }>;
  };

  // VIEW AGENT (Cursor)
  agentWindow?: boolean;
}

// Stato interno della Agent Window (toggle-based)
let agentWindowActive = false;
let terminalPanelMaximized = false;

async function setSidebar(view?: string) {
  await vscode.commands.executeCommand("workbench.action.closeSidebar");
  await new Promise((r) => setTimeout(r, 40));

  if (view) {
    const viewCommands: Record<string, string> = {
      explorer: "workbench.view.explorer",
      search: "workbench.view.search",
      scm: "workbench.view.scm",
      debug: "workbench.view.debug",
      extensions: "workbench.view.extensions",
    };

    await vscode.commands.executeCommand("workbench.action.focusSideBar");
    await new Promise((r) => setTimeout(r, 40));

    await vscode.commands.executeCommand(
      viewCommands[view] ?? "workbench.view.explorer"
    );
    await new Promise((r) => setTimeout(r, 40));
  }
}

async function setAgentWindow(active: boolean) {
  if (active !== agentWindowActive) {
    await vscode.commands.executeCommand(
      "cursor.toggleAgentWindowIDEUnification"
    );
    agentWindowActive = active;
  }
}

async function setTerminalPanel(
  active: boolean,
  view: string | undefined,
  maximized: boolean
) {
  const panelCommands: Record<string, string> = {
    terminal: "workbench.action.terminal.focus",
    problems: "workbench.action.problems.focus",
    output: "workbench.action.output.focus",
    "debug-console": "workbench.debug.action.focusRepl",
  };

  await vscode.commands.executeCommand("workbench.action.closePanel");
  await new Promise((r) => setTimeout(r, 40));

  if (active) {
    await vscode.commands.executeCommand("workbench.action.togglePanel");
    await new Promise((r) => setTimeout(r, 40));

    if (maximized && !terminalPanelMaximized) {
      await vscode.commands.executeCommand(
        "workbench.action.toggleMaximizedPanel"
      );
      await new Promise((r) => setTimeout(r, 40));

      terminalPanelMaximized = true;
    } else if (!maximized && terminalPanelMaximized) {
      await vscode.commands.executeCommand(
        "workbench.action.toggleMaximizedPanel"
      );
      await new Promise((r) => setTimeout(r, 40));

      terminalPanelMaximized = false;
    }

    await vscode.commands.executeCommand(panelCommands[view ?? "terminal"]);
    await new Promise((r) => setTimeout(r, 40));
  }
}

const LAYOUTS: LayoutConfig[] = [
  {
    name: "Search",
    sidebar: { view: "search" },
  },
  {
    name: "Agent",
    agentWindow: true,
  },
  {
    name: "Editor",
    sidebar: { view: "explorer" },
  },
  {
    name: "Git",
    sidebar: { view: "scm" },
    panel: { view: "terminal", maximized: true },
  },
];

async function applyLayout(layout: LayoutConfig) {
  // -------------------------------------------------------------------------
  // SIDEBAR
  // -------------------------------------------------------------------------
  await setSidebar(layout.sidebar?.view);

  // -------------------------------------------------------------------------
  // CURSOR AGENT WINDOW
  // -------------------------------------------------------------------------
  await setAgentWindow(!!layout.agentWindow);

  // -------------------------------------------------------------------------
  // TERMINAL PANEL
  // -------------------------------------------------------------------------
  await setTerminalPanel(
    !!layout.panel,
    layout.panel?.view,
    layout.panel?.maximized ?? false
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Layout Manager Extension is now active!");

  // Commands per ogni layout
  LAYOUTS.forEach((layout, index) => {
    const disposable = vscode.commands.registerCommand(
      `layoutManager.layout${index + 1}`,
      async () => {
        await applyLayout(layout);
        vscode.window.showInformationMessage(`Applied layout: ${layout.name}`);
      }
    );
    context.subscriptions.push(disposable);
  });

  // Quick Pick selector
  const quickPickDisposable = vscode.commands.registerCommand(
    "layoutManager.selectLayout",
    async () => {
      const items = LAYOUTS.map((layout, index) => ({
        label: `$(layout) ${layout.name}`,
        description: `Layout ${index + 1}`,
        layout,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a layout to apply",
      });

      if (selected) {
        await applyLayout(selected.layout);
        vscode.window.showInformationMessage(
          `Applied layout: ${selected.layout.name}`
        );
      }
    }
  );

  context.subscriptions.push(quickPickDisposable);

  // Status Bar shortcut
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(layout) Layouts";
  statusBarItem.command = "layoutManager.selectLayout";
  statusBarItem.tooltip = "Switch Layout";
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
}

export function deactivate() {}
