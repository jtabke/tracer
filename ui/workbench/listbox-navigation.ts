// Both pickers keep DOM focus in the combobox and expose one active option.
export function createListboxNavigation(input: HTMLInputElement, consumeEmpty = false) {
  let buttons: HTMLButtonElement[] = [];
  let active = 0;
  function activate(index: number, scroll = false) {
    active = index;
    buttons.forEach((button, i) => button.setAttribute("aria-selected", String(i === active)));
    const button = buttons[active];
    if (!button) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    input.setAttribute("aria-activedescendant", button.id);
    if (scroll) button.scrollIntoView({ block: "nearest" });
  }
  function handleKey(event: KeyboardEvent) {
    if ([event.isComposing, event.ctrlKey, event.metaKey, event.altKey].some(Boolean)) return;
    if (!buttons.length && !consumeEmpty) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (buttons.length)
        activate(
          (active + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length,
          true,
        );
    } else if (event.key === "Enter") {
      event.preventDefault();
      buttons[active]?.click();
    }
  }
  input.onkeydown = handleKey;
  return {
    reset(options: HTMLButtonElement[], scroll = false) {
      buttons = options;
      activate(0, scroll);
    },
  };
}
