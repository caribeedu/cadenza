import type { ParentProps } from "solid-js";

type Props = ParentProps & {
  footer?: ParentProps["children"];
};

export function ScreenLayout(props: Props) {
  return (
    <div class="screen">
      <div class="screen__body">{props.children}</div>
      {props.footer ? <footer class="screen__footer">{props.footer}</footer> : null}
    </div>
  );
}
