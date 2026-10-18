import { createListboxNavigation } from "./listbox-navigation.ts";
import { typeName } from "./presentation.ts";

type SearchRecord = { key: string; title: string; statement?: string; type: string };
type Command = [name: string, run: () => void];
type Options = {
  dialog: HTMLDialogElement;
  records: SearchRecord[];
  commands: Command[];
  escape(value: string): string;
  select(key: string): void;
};

// Search only the supplied revision. Selection and navigation remain with the workspace.
export function mountWorkspaceSearch({ dialog, records, commands, escape: e, select }: Options) {
  dialog.classList.add("search-dialog");
  dialog.setAttribute("closedby", "any");
  dialog.insertAdjacentHTML(
    "beforeend",
    `<div class="search-input-row"><input id="search" role="combobox" aria-label="Search artifacts and commands" aria-autocomplete="list" aria-expanded="true" aria-controls="search-results" aria-describedby="search-help" autocomplete="off" spellcheck="false" placeholder="Find an artifact or command…"><button type="button" class="search-clear" aria-label="Clear search" hidden>×</button></div><p id="search-status" class="search-status" role="status" aria-live="polite"></p><div id="search-results" role="listbox" aria-label="Artifacts and commands"></div><div class="search-empty" hidden><strong>No matches found</strong><p>Try an identifier, a shorter title, or a word from the statement.</p><button type="button" data-clear-search>Clear search</button></div><p id="search-help" class="search-help"><span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></p>`,
  );
  const input = dialog.querySelector<HTMLInputElement>("#search")!;
  const list = dialog.querySelector<HTMLElement>("#search-results")!;
  const status = dialog.querySelector<HTMLElement>("#search-status")!;
  const clear = dialog.querySelector<HTMLButtonElement>(".search-clear")!;
  const navigation = createListboxNavigation(input, true);
  function group(label: string, content: string) {
    return content
      ? `<div role="group" aria-label="${label}"><p class="search-group-label" aria-hidden="true">${label}</p>${content}</div>`
      : "";
  }
  function renderResults() {
    const query = input.value.trim().toLowerCase();
    const matches = records
      .map((record) => ({ record, rank: matchRank(record, query) }))
      .filter(({ rank }) => rank >= 0)
      .sort((a, b) => a.rank - b.rank);
    const commandMatches = commands
      .map(([name], index) =>
        name.toLowerCase().includes(query)
          ? `<button type="button" role="option" tabindex="-1" data-command="${index}"><span class="command-icon" aria-hidden="true">↗</span><span>${e(name)}</span></button>`
          : "",
      )
      .join("");
    const artifacts = matches
      .slice(0, 12)
      .map(
        ({ record }) =>
          `<button type="button" role="option" tabindex="-1" data-result="${e(record.key)}"><span class="mono">${e(record.key)}</span><span>${e(record.title)}<small class="search-type">${e(typeName(record.type))}</small></span></button>`,
      )
      .join("");
    const artifactGroup = group("Artifacts", artifacts);
    const commandGroup = group("Commands", commandMatches);
    list.innerHTML = query ? artifactGroup + commandGroup : commandGroup + artifactGroup;
    const buttons = [...list.querySelectorAll<HTMLButtonElement>("button")];
    clear.hidden = !input.value;
    status.textContent =
      matches.length > 12
        ? `Showing 12 of ${matches.length} artifacts · refine your search for more`
        : `${matches.length} artifact${matches.length === 1 ? "" : "s"}${commandMatches ? " · commands available" : ""}`;
    list.hidden = !buttons.length;
    dialog.querySelector<HTMLElement>(".search-empty")!.hidden = Boolean(buttons.length);
    input.setAttribute("aria-expanded", String(Boolean(buttons.length)));
    buttons.forEach((button, index) => {
      button.id = `workspace-search-option-${index}`;
      button.onclick = () => {
        dialog.close();
        if (button.dataset.result !== undefined) select(button.dataset.result);
        else commands[Number(button.dataset.command)][1]();
      };
    });
    list.scrollTop = 0;
    navigation.reset(buttons);
  }
  function reset() {
    input.value = "";
    renderResults();
    input.focus();
  }
  input.oninput = renderResults;
  clear.onclick = reset;
  dialog.querySelector<HTMLButtonElement>("[data-clear-search]")!.onclick = reset;
  renderResults();
  input.focus();
}

function matchRank(record: SearchRecord, query: string): number {
  if (!query) return 0;
  const key = record.key.toLowerCase();
  const title = record.title.toLowerCase();
  if (key === query) return 0;
  if (key.startsWith(query)) return 1;
  if (title.startsWith(query)) return 2;
  if (`${key} ${title}`.includes(query)) return 3;
  return (record.statement ?? "").toLowerCase().includes(query) ? 4 : -1;
}
