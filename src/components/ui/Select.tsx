import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import "./Select.css";

export type SelectOption = { value: string; label: string };

type Props = {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  class?: string;
};

export function Select(props: Props) {
  const [open, setOpen] = createSignal(false);
  let rootRef: HTMLDivElement | undefined;

  const selectedLabel = () =>
    props.options.find((o) => o.value === props.value)?.label ?? props.value;

  function pick(value: string) {
    props.onChange(value);
    setOpen(false);
  }

  createEffect(() => {
    if (!open()) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef && !rootRef.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    });
  });

  return (
    <div class={`field select-field ${props.class ?? ""}`.trim()} ref={rootRef}>
      {props.label ? <span class="field__label">{props.label}</span> : null}
      <div class="select-wrap" data-open={open() ? "1" : "0"}>
        <button
          type="button"
          class="select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open()}
          onClick={() => setOpen((v) => !v)}
        >
          <span class="select-trigger__label">{selectedLabel()}</span>
          <span class="select-trigger__chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        <Show when={open()}>
          <ul class="select-list" role="listbox">
            <For each={props.options}>
              {(opt) => (
                <li role="presentation">
                  <button
                    type="button"
                    role="option"
                    class="select-option"
                    classList={{ "select-option--selected": opt.value === props.value }}
                    aria-selected={opt.value === props.value}
                    onClick={() => pick(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </div>
  );
}
