import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

type Props = JSX.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export function Select(props: Props) {
  const [local, rest] = splitProps(props, ["label", "class", "children"]);
  return (
    <label class={`field ${local.class ?? ""}`.trim()}>
      {local.label ? <span class="field__label">{local.label}</span> : null}
      <select class="select" {...rest}>
        {local.children}
      </select>
    </label>
  );
}
