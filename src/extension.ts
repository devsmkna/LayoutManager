import * as vscode from "vscode";

type AIMode = "agent" | "ask" | "plan";
type PanelView = "terminal" | "problems" | "output" | "debug-console";
type PrimarySidebarView =
| "explorer"
| "search"
| "scm"
| "extensions"
| "debug";
type SidebarPosition = "left" | "right";

interface PrimarySidebar {
  view: PrimarySidebarView;
  position: SidebarPosition;
}

interface AuxiliarySidebar {
  position: SidebarPosition;
  mode: AIMode;
}

interface Panel {
  view: PanelView;
  maximized: boolean;
}

interface LayoutConfig {
  name: string;
  primarySidebar?: PrimarySidebar;
  auxiliarySidebar?: AuxiliarySidebar;
  panel?: Panel;
}

let panelMaximized = false;

/* ----------------------------
  PRIMARY SIDEBAR
---------------------------- */
const setPrimarySidebar = async (primarySidebar: PrimarySidebar) => {
  await vscode.workspace
    .getConfiguration("workbench")
    .update("sideBar.location", primarySidebar.position);
  await vscode.commands.executeCommand("workbench.action.focusSideBar");
  await vscode.commands.executeCommand(`workbench.view.${primarySidebar.view}`);
};

/* ----------------------------
  AUXILIARY SIDEBAR
---------------------------- */
const setAuxiliarySidebar = async (auxiliarySidebar: AuxiliarySidebar) => {
  await vscode.commands.executeCommand("aichat.close-sidebar");
  const primarySidebarPosition =
    auxiliarySidebar.position === "left" ? "right" : "left";
  await vscode.workspace
    .getConfiguration("workbench")
    .update("sideBar.location", primarySidebarPosition);
  /* await vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar"); */
  switch (auxiliarySidebar.mode) {
    case "agent":
      await vscode.commands.executeCommand("composerMode.agent");
      break;
    case "ask":
      await vscode.commands.executeCommand("composerMode.chat");
      break;
    case "plan":
      await vscode.commands.executeCommand("composerMode.plan");
      break;
  }
};

/* ----------------------------
  PANEL
---------------------------- */
const setPanel = async (panel: Panel) => {
  const panelCommands: Record<string, string> = {
    terminal: "workbench.action.terminal.focus",
    problems: "workbench.action.problems.focus",
    output: "workbench.action.output.focus",
    "debug-console": "workbench.debug.action.focusRepl",
  };
  await vscode.commands.executeCommand("workbench.action.focusPanel");
  await vscode.commands.executeCommand(panelCommands[panel.view]);
  console.log(panel.maximized, panelMaximized);
  if (panel.maximized && !panelMaximized) {
    await vscode.commands.executeCommand(
      "workbench.action.toggleMaximizedPanel"
    );
    panelMaximized = true;
  }
};

const LAYOUTS: LayoutConfig[] = [
  {
    name: "Search",
    primarySidebar: { view: "search", position: "right" },
  },
  {
    name: "Git",
    primarySidebar: { view: "scm", position: "left" },
    panel: { view: "terminal", maximized: true },
  },
  {
    name: "Agent",
    auxiliarySidebar: { position: "left", mode: "ask" },
  },
  {
    name: "Editor",
    primarySidebar: { view: "explorer", position: "right" },
  }
];

const applyLayout = async (layout: LayoutConfig) => {
  /* ----------------------------
    PRIMARY SIDEBAR
  ---------------------------- */
  if (layout.primarySidebar) {
    await setPrimarySidebar(layout.primarySidebar);
  } else {
    await vscode.commands.executeCommand("workbench.action.closeSidebar");
  }

  /* ----------------------------
    AUXILIARY SIDEBAR
  ---------------------------- */
  if (layout.auxiliarySidebar) {
    await setAuxiliarySidebar(layout.auxiliarySidebar);
  } else {
    await vscode.commands.executeCommand("aichat.close-sidebar");
  }

  /* ----------------------------
    PANEL
  ---------------------------- */
  if (layout.panel) {
    await setPanel(layout.panel);
  } else {
    await vscode.commands.executeCommand("workbench.action.closePanel");
    panelMaximized = false;
  }

  vscode.window.showInformationMessage(`Applied layout: ${layout.name}`);
};

export function activate(context: vscode.ExtensionContext) {
  LAYOUTS.forEach((layout) => {
    const disposable = vscode.commands.registerCommand(
      `layoutManager.${layout.name.toLocaleLowerCase().replace(" ", "_")}`,
      async () => {
        await applyLayout(layout);
      }
    );
    context.subscriptions.push(disposable);
  });

  const quickPickDisposable = vscode.commands.registerCommand(
    "layoutManager.selectLayout",
    async () => {
      const items = LAYOUTS.map((layout) => ({
        label: `$(layout) ${layout.name}`,
        description: `layoutManager.${layout.name}`,
        layout,
      }));
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a layout to apply",
      });
      if (selected) {
        await applyLayout(selected.layout);
      }
    }
  );
  context.subscriptions.push(quickPickDisposable);

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

export function deactivate() {
  console.log("Extension is now deactivated!");
}
