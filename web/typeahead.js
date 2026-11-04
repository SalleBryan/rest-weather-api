/* A debounced, keyboard-accessible suggestion popup shared by both searches. */
window.Typeahead = {
  attach({
    input,
    form,
    panel,
    list,
    search,
    invalidate,
    eligible = () => true,
  }) {
    let timer,
      active = -1,
      composing = false;
    const options = () => [...list.querySelectorAll("button")];
    const cancel = () => clearTimeout(timer);
    function close() {
      cancel();
      invalidate();
      active = -1;
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
    function open() {
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    function update() {
      active = -1;
      input.removeAttribute("aria-activedescendant");
      options().forEach((button, index) => {
        button.id = list.id + "-option-" + index;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", "false");
        button.tabIndex = -1;
      });
    }
    function schedule() {
      close();
      const query = input.value.trim();
      if (!composing && eligible() && query.length >= 3) {
        timer = setTimeout(() => {
          if (eligible() && input.value.trim() === query) search();
        }, 450);
      }
    }
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Location suggestions");
    input.addEventListener("input", schedule);
    input.addEventListener("compositionstart", () => {
      composing = true;
      close();
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      schedule();
    });
    form.addEventListener("submit", cancel);
    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "Tab") {
        close();
        return;
      }
      const rows = options();
      if (panel.hidden || !rows.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        active =
          active < 0
            ? event.key === "ArrowDown"
              ? 0
              : rows.length - 1
            : (active + (event.key === "ArrowDown" ? 1 : -1) + rows.length) %
              rows.length;
        rows.forEach((row, i) =>
          row.setAttribute("aria-selected", i === active ? "true" : "false"),
        );
        input.setAttribute("aria-activedescendant", rows[active].id);
        rows[active].scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" && active >= 0) {
        event.preventDefault();
        rows[active].click();
        close();
      }
    });
    list.addEventListener("click", (event) => {
      if (event.target.closest("button")) close();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!form.contains(event.target) && !panel.contains(event.target))
        close();
    });
    return { cancel, close, open, update };
  },
};
