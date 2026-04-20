import type { ReactElement } from "react";

export type ChipState = "err" | "off" | "on";

const CHIP_CLASS: Record<ChipState, string> = {
  err: "chip chip-err",
  off: "chip chip-off",
  on: "chip chip-on",
};

export interface StatusChipProps {
  label: string;
  state?: ChipState | string;
  title?: string;
}

export function StatusChip({
  label,
  state = "off",
  title,
}: StatusChipProps): ReactElement {
  const className = CHIP_CLASS[state as ChipState] ?? CHIP_CLASS.off;
  return (
    <span className={className} title={title}>
      {label}
    </span>
  );
}
