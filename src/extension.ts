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

const DEFAULT_LAYOUTS: LayoutConfig[] = [
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
  },
];

/* ----------------------------
  PERSISTENCE
---------------------------- */
const loadLayouts = (): LayoutConfig[] => {
  const config = vscode.workspace.getConfiguration("layoutManager");
  const savedLayouts = config.get<LayoutConfig[]>("layouts", []);
  return savedLayouts.length > 0 ? savedLayouts : DEFAULT_LAYOUTS;
};

const isDefaultLayout = (layoutName: string): boolean => {
  return DEFAULT_LAYOUTS.some((layout) => layout.name === layoutName);
};

const saveLayouts = async (layouts: LayoutConfig[]): Promise<void> => {
  await vscode.workspace
    .getConfiguration("layoutManager")
    .update("layouts", layouts, vscode.ConfigurationTarget.Workspace);
};

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

/* ----------------------------
  CONFIGURATION WIZARD
---------------------------- */
const createLayoutWizard = async (
  existingLayout?: LayoutConfig
): Promise<LayoutConfig | undefined> => {
  // Richiedi il nome del layout
  const name = await vscode.window.showInputBox({
    prompt: existingLayout
      ? "Inserisci il nuovo nome del layout"
      : "Inserisci il nome del layout",
    placeHolder: "Nome layout",
    value: existingLayout?.name,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Il nome non può essere vuoto";
      }
      const layouts = loadLayouts();
      if (
        layouts.some(
          (l) =>
            l.name.toLowerCase() === value.toLowerCase() &&
            (!existingLayout || l.name !== existingLayout.name)
        )
      ) {
        return "Un layout con questo nome esiste già";
      }
      return null;
    },
  });

  if (!name) {
    return undefined;
  }

  // SEZIONE 1: Selezione Componenti (Flag Si/No)
  const componentItems = [
    {
      label: "$(layout-sidebar-left) Primary Sidebar",
      picked: existingLayout?.primarySidebar !== undefined,
      value: "primarySidebar",
    },
    {
      label: "$(cursor) Auxiliary Sidebar",
      picked: existingLayout?.auxiliarySidebar !== undefined,
      value: "auxiliarySidebar",
    },
    {
      label: "$(layout-panel) Panel",
      picked: existingLayout?.panel !== undefined,
      value: "panel",
    },
  ];

  const selectedComponents = await vscode.window.showQuickPick(componentItems, {
    placeHolder:
      "$(checklist) Seleziona i componenti da includere (Spazio per selezionare)",
    canPickMany: true,
  });

  if (selectedComponents === undefined) {
    return undefined;
  }

  const enabledComponents = selectedComponents.map((item) => item.value);
  const hasPrimarySidebar = enabledComponents.includes("primarySidebar");
  const hasAuxiliarySidebar = enabledComponents.includes("auxiliarySidebar");
  const hasPanel = enabledComponents.includes("panel");

  let primarySidebar: PrimarySidebar | undefined;
  let auxiliarySidebar: AuxiliarySidebar | undefined;
  let panel: Panel | undefined;

  // SEZIONE 2: Posizione Primary Sidebar (solo se Primary Sidebar è abilitata, o se solo Auxiliary Sidebar è abilitata)
  let primarySidebarPosition: SidebarPosition = "left";
  if (hasPrimarySidebar || (hasAuxiliarySidebar && !hasPrimarySidebar)) {
    const positionItems = [
      {
        label: "$(layout-sidebar-left) Sinistra",
        value: "left" as SidebarPosition,
        picked:
          existingLayout?.primarySidebar?.position === "left" ||
          (!existingLayout?.primarySidebar &&
            existingLayout?.auxiliarySidebar?.position === "right"),
      },
      {
        label: "$(layout-sidebar-right) Destra",
        value: "right" as SidebarPosition,
        picked:
          existingLayout?.primarySidebar?.position === "right" ||
          (!existingLayout?.primarySidebar &&
            existingLayout?.auxiliarySidebar?.position === "left"),
      },
    ];

    const selectedPosition = await vscode.window.showQuickPick(positionItems, {
      placeHolder:
        "Seleziona la posizione della Primary Sidebar (l'Auxiliary Sidebar andrà all'opposto)",
    });

    if (!selectedPosition) {
      return undefined;
    }

    primarySidebarPosition = selectedPosition.value;
  }

  // SEZIONE 3: View Primary Sidebar (solo se abilitata)
  if (hasPrimarySidebar) {
    const viewItems = [
      {
        label: "$(explorer-view-icon) Explorer",
        value: "explorer" as PrimarySidebarView,
        picked:
          existingLayout?.primarySidebar?.view === "explorer" ||
          !existingLayout?.primarySidebar?.view,
      },
      {
        label: "$(search) Search",
        value: "search" as PrimarySidebarView,
        picked: existingLayout?.primarySidebar?.view === "search",
      },
      {
        label: "$(git-branch) Source Control",
        value: "scm" as PrimarySidebarView,
        picked: existingLayout?.primarySidebar?.view === "scm",
      },
      {
        label: "$(extensions) Extensions",
        value: "extensions" as PrimarySidebarView,
        picked: existingLayout?.primarySidebar?.view === "extensions",
      },
      {
        label: "$(debug) Debug",
        value: "debug" as PrimarySidebarView,
        picked: existingLayout?.primarySidebar?.view === "debug",
      },
    ];

    const selectedView = await vscode.window.showQuickPick(viewItems, {
      placeHolder:
        "Seleziona la view per Primary Sidebar (default: Explorer)",
    });

    if (!selectedView) {
      return undefined;
    }

    primarySidebar = {
      view: selectedView.value,
      position: primarySidebarPosition,
    };
  }

  // SEZIONE 4: Modalità Auxiliary Sidebar (solo se abilitata)
  if (hasAuxiliarySidebar) {
    // La Auxiliary Sidebar va all'opposto della Primary Sidebar
    const auxiliaryPosition: SidebarPosition =
      primarySidebarPosition === "left" ? "right" : "left";

    const modeItems = [
      {
        label: "$(infinity) Agent",
        value: "agent" as AIMode,
        picked:
          existingLayout?.auxiliarySidebar?.mode === "agent" ||
          !existingLayout?.auxiliarySidebar?.mode,
      },
      {
        label: "$(chat) Ask",
        value: "ask" as AIMode,
        picked: existingLayout?.auxiliarySidebar?.mode === "ask",
      },
      {
        label: "$(list-ordered) Plan",
        value: "plan" as AIMode,
        picked: existingLayout?.auxiliarySidebar?.mode === "plan",
      },
    ];

    const selectedMode = await vscode.window.showQuickPick(modeItems, {
      placeHolder:
        "Seleziona la modalità per Auxiliary Sidebar (default: Agent)",
    });

    if (!selectedMode) {
      return undefined;
    }

    auxiliarySidebar = {
      mode: selectedMode.value,
      position: auxiliaryPosition,
    };
  }

  // SEZIONE 5: View Panel (solo se abilitato)
  if (hasPanel) {
    const viewItems = [
      {
        label: "$(terminal) Terminal",
        value: "terminal" as PanelView,
        picked:
          existingLayout?.panel?.view === "terminal" ||
          !existingLayout?.panel?.view,
      },
      {
        label: "$(warning) Problems",
        value: "problems" as PanelView,
        picked: existingLayout?.panel?.view === "problems",
      },
      {
        label: "$(list-unordered) Output",
        value: "output" as PanelView,
        picked: existingLayout?.panel?.view === "output",
      },
      {
        label: "$(debug) Debug Console",
        value: "debug-console" as PanelView,
        picked: existingLayout?.panel?.view === "debug-console",
      },
    ];

    const selectedView = await vscode.window.showQuickPick(viewItems, {
      placeHolder:
        "Seleziona la view per Panel (default: Terminal)",
    });

    if (!selectedView) {
      return undefined;
    }

    const maximizedItems = [
      {
        label: "$(check) Sì",
        value: true,
        picked: existingLayout?.panel?.maximized === true,
      },
      {
        label: "$(close) No",
        value: false,
        picked:
          existingLayout?.panel?.maximized === false ||
          existingLayout?.panel?.maximized === undefined,
      },
    ];

    const selectedMaximized = await vscode.window.showQuickPick(
      maximizedItems,
      {
        placeHolder: "Panel massimizzato?",
      }
    );

    if (selectedMaximized === undefined) {
      return undefined;
    }

    panel = {
      view: selectedView.value,
      maximized: selectedMaximized.value,
    };
  }

  return {
    name: name.trim(),
    primarySidebar,
    auxiliarySidebar,
    panel,
  };
};

const layoutCommandDisposables: vscode.Disposable[] = [];

const registerLayoutCommands = (context: vscode.ExtensionContext) => {
  // Rimuovi i comandi precedenti
  layoutCommandDisposables.forEach((disposable) => disposable.dispose());
  layoutCommandDisposables.length = 0;

  // Registra i nuovi comandi
  const layouts = loadLayouts();
  layouts.forEach((layout) => {
    const commandName = `layoutManager.${layout.name
      .toLowerCase()
      .replace(/\s+/g, "_")}`;
    const disposable = vscode.commands.registerCommand(
      commandName,
      async () => {
        await applyLayout(layout);
      }
    );
    layoutCommandDisposables.push(disposable);
    context.subscriptions.push(disposable);
  });
};

export function activate(context: vscode.ExtensionContext) {
  // Registra comandi per i layout esistenti
  registerLayoutCommands(context);

  // Listener per ricaricare comandi quando le configurazioni cambiano
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("layoutManager.layouts")) {
        // Ricarica i comandi quando i layout cambiano
        registerLayoutCommands(context);
      }
    })
  );

  // Comando per selezionare layout
  const quickPickDisposable = vscode.commands.registerCommand(
    "layoutManager.selectLayout",
    async () => {
      const layouts = loadLayouts();
      const config = vscode.workspace.getConfiguration("layoutManager");
      const savedLayouts = config.get<LayoutConfig[]>("layouts", []);
      const hasCustomLayouts = savedLayouts.length > 0;

      const items = [
        {
          label: "$(add) Crea nuovo layout",
          description: "Crea un nuovo layout personalizzato",
          action: "create",
        },
        {
          label: "$(edit) Gestisci layout",
          description: "Modifica o elimina layout esistenti",
          action: "manage",
        },
        ...(hasCustomLayouts && savedLayouts.length > 0
          ? [
              {
                label: "$(trash) Elimina layout...",
                description: "Elimina un layout personalizzato",
                action: "delete",
              },
            ]
          : []),
        ...layouts.map((layout) => {
          const isDefault = isDefaultLayout(layout.name);
          const isCustom =
            hasCustomLayouts &&
            savedLayouts.some((l) => l.name === layout.name);
          return {
            label: `$(layout) ${layout.name}${isDefault ? " $(lock)" : ""}`,
            description: isDefault
              ? "Layout predefinito (non eliminabile)"
              : isCustom
              ? "Layout personalizzato"
              : `Applica layout: ${layout.name}`,
            layout,
            action: "apply" as const,
          };
        }),
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Seleziona un layout o un'azione",
      });

      if (!selected) {
        return;
      }

      if (selected.action === "create") {
        await vscode.commands.executeCommand("layoutManager.createLayout");
      } else if (selected.action === "manage") {
        await vscode.commands.executeCommand("layoutManager.manageLayouts");
      } else if (selected.action === "delete") {
        // Mostra solo layout personalizzati eliminabili
        const deletableLayouts = layouts.filter(
          (layout) =>
            !isDefaultLayout(layout.name) &&
            savedLayouts.some((l) => l.name === layout.name)
        );

        if (deletableLayouts.length === 0) {
          vscode.window.showInformationMessage(
            "Nessun layout personalizzato da eliminare."
          );
          return;
        }

        const deleteItems = deletableLayouts.map((layout) => ({
          label: `$(trash) ${layout.name}`,
          description: "Clicca per eliminare",
          layout,
        }));

        const toDelete = await vscode.window.showQuickPick(deleteItems, {
          placeHolder: "Seleziona il layout da eliminare",
        });

        if (toDelete) {
          const confirmed = await vscode.window.showWarningMessage(
            `Sei sicuro di voler eliminare il layout "${toDelete.layout.name}"?`,
            { modal: true },
            "Elimina"
          );
          if (confirmed === "Elimina") {
            const updatedLayouts = layouts.filter(
              (l) => l.name !== toDelete.layout.name
            );
            await saveLayouts(updatedLayouts);
            registerLayoutCommands(context);
            vscode.window.showInformationMessage(
              `Layout "${toDelete.layout.name}" eliminato!`
            );
          }
        }
      } else if (selected.action === "apply" && "layout" in selected) {
        await applyLayout(selected.layout as LayoutConfig);
      }
    }
  );
  context.subscriptions.push(quickPickDisposable);

  // Comando per creare un nuovo layout
  const createLayoutDisposable = vscode.commands.registerCommand(
    "layoutManager.createLayout",
    async () => {
      const newLayout = await createLayoutWizard();
      if (newLayout) {
        const layouts = loadLayouts();
        layouts.push(newLayout);
        await saveLayouts(layouts);
        registerLayoutCommands(context);
        // Applica automaticamente il layout appena creato
        await applyLayout(newLayout);
        vscode.window.showInformationMessage(
          `Layout "${newLayout.name}" creato e applicato con successo!`
        );
      }
    }
  );
  context.subscriptions.push(createLayoutDisposable);

  // Comando per gestire layout (modifica/elimina)
  const manageLayoutsDisposable = vscode.commands.registerCommand(
    "layoutManager.manageLayouts",
    async () => {
      const layouts = loadLayouts();
      const items = layouts.map((layout) => ({
        label: `$(layout) ${layout.name}`,
        description: "Clicca per modificare o eliminare",
        layout,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Seleziona un layout da gestire",
      });

      if (!selected) {
        return;
      }

      const action = await vscode.window.showQuickPick(
        [
          { label: "$(edit) Modifica", value: "edit" },
          { label: "$(trash) Elimina", value: "delete" },
        ],
        {
          placeHolder: "Cosa vuoi fare?",
        }
      );

      if (!action) {
        return;
      }

      if (action.value === "edit") {
        await vscode.commands.executeCommand(
          "layoutManager.editLayout",
          selected.layout
        );
      } else if (action.value === "delete") {
        const confirmed = await vscode.window.showWarningMessage(
          `Sei sicuro di voler eliminare il layout "${selected.layout.name}"?`,
          { modal: true },
          "Elimina"
        );
        if (confirmed === "Elimina") {
          const updatedLayouts = layouts.filter(
            (l) => l.name !== selected.layout.name
          );
          await saveLayouts(updatedLayouts);
          registerLayoutCommands(context);
          vscode.window.showInformationMessage(
            `Layout "${selected.layout.name}" eliminato!`
          );
        }
      }
    }
  );
  context.subscriptions.push(manageLayoutsDisposable);

  // Comando per modificare un layout
  const editLayoutDisposable = vscode.commands.registerCommand(
    "layoutManager.editLayout",
    async (layoutToEdit?: LayoutConfig) => {
      if (!layoutToEdit) {
        const layouts = loadLayouts();
        const items = layouts.map((layout) => ({
          label: `$(layout) ${layout.name}`,
          layout,
        }));
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Seleziona il layout da modificare",
        });
        if (!selected) {
          return;
        }
        layoutToEdit = selected.layout;
      }

      // Usa lo stesso wizard con il layout esistente come base
      const updatedLayout = await createLayoutWizard(layoutToEdit);

      if (!updatedLayout) {
        return;
      }

      const layouts = loadLayouts();
      const index = layouts.findIndex((l) => l.name === layoutToEdit!.name);
      if (index !== -1) {
        layouts[index] = updatedLayout;
        await saveLayouts(layouts);
        registerLayoutCommands(context);
        vscode.window.showInformationMessage(
          `Layout "${updatedLayout.name}" modificato con successo!`
        );
      }
    }
  );
  context.subscriptions.push(editLayoutDisposable);

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
