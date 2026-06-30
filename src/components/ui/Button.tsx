import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

type Props = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

export function Button(props: Props) {
  const [local, rest] = splitProps(props, ["variant", "size", "class", "children"]);
  const variant = () => local.variant ?? "default";
  const size = () => local.size ?? "default";

  return (
    <button
      type="button"
      class={`btn ${variant() === "primary" ? "btn--primary" : ""} ${variant() === "ghost" ? "btn--ghost" : ""} ${size() === "sm" ? "btn--sm" : ""} ${size() === "lg" ? "btn--lg" : ""} ${size() === "icon" ? "btn--icon" : ""} ${local.class ?? ""}`.trim()}
      {...rest}
    >
      {local.children}
    </button>
  );
}
