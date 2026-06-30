import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

type Props = JSX.HTMLAttributes<HTMLDivElement> & {
  glow?: boolean;
};

export function Card(props: Props) {
  const [local, rest] = splitProps(props, ["glow", "class", "children"]);
  return (
    <div
      class={`card ${local.glow ? "card--glow" : ""} ${local.class ?? ""}`.trim()}
      {...rest}
    >
      {local.children}
    </div>
  );
}
