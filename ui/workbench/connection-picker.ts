import { createListboxNavigation } from "./listbox-navigation.ts";
import { typeName } from "./presentation.ts";

type Candidate = { key: string; title: string; type: string };
type Options = {
  candidates(): Candidate[];
  changed(): void;
  escape(value: string): string;
};

// Choosing a suggestion supplies an exact key; titles are search text, never identity.
export function createConnectionPicker(form: HTMLFormElement, options: Options) {
  const input = form.querySelector<HTMLInputElement>("#connection-target")!;
  const list = form.querySelector<HTMLElement>("#connection-target-results")!;
  const status = form.querySelector<HTMLElement>("#connection-target-status")!;
  const navigation = createListboxNavigation(input);
  function refresh() {
    const candidates = options.candidates();
    const selected = candidates.find((record) => record.key === input.value);
    const query = input.value.trim().toLowerCase();
    const matches = candidates.filter((record) =>
      `${record.key} ${record.title}`.toLowerCase().includes(query),
    );
    const e = options.escape;
    list.innerHTML = selected
      ? ""
      : matches
          .slice(0, 6)
          .map(
            (record, index) =>
              `<button type="button" role="option" tabindex="-1" id="connection-candidate-${index}" data-connection-candidate="${e(record.key)}"><span class="mono">${e(record.key)}</span><span>${e(record.title)}<small>${e(typeName(record.type))}</small></span></button>`,
          )
          .join("");
    const buttons = [...list.querySelectorAll<HTMLButtonElement>("button")];
    list.hidden = !buttons.length;
    input.setAttribute("aria-expanded", String(Boolean(buttons.length)));
    input.removeAttribute("aria-activedescendant");
    status.textContent = selected
      ? `${selected.key} · ${selected.title} · ${typeName(selected.type)}`
      : matches.length
        ? `Showing ${Math.min(6, matches.length)} of ${matches.length} compatible artifacts`
        : "No compatible artifacts match. Try an identifier or title.";
    buttons.forEach((button) => {
      button.onclick = () => {
        input.value = button.dataset.connectionCandidate!;
        options.changed();
        input.focus();
      };
    });
    navigation.reset(buttons, true);
  }
  return { refresh };
}
