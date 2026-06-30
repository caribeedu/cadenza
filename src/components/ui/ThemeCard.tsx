import { getWaterfallTheme, WATERFALL_THEME_LABELS, type WaterfallThemeId } from "../../lib/waterfall/theme";

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function swatchStyle(id: WaterfallThemeId): string {
  const theme = getWaterfallTheme(id);
  const low = hex(theme.pendingGradient.low);
  const high = hex(theme.pendingGradient.high);
  const glow = hex(theme.backdrop.glow);
  return `linear-gradient(135deg, ${low} 0%, ${glow} 50%, ${high} 100%)`;
}

type Props = {
  id: WaterfallThemeId;
  selected: boolean;
  compact?: boolean;
  onSelect: (id: WaterfallThemeId) => void;
};

export function ThemeCard(props: Props) {
  return (
    <button
      type="button"
      class={`theme-card ${props.selected ? "theme-card--selected" : ""} ${props.compact ? "theme-card--compact" : ""}`}
      onClick={() => props.onSelect(props.id)}
      aria-pressed={props.selected}
    >
      <div class="theme-card__swatch" style={{ background: swatchStyle(props.id) }} />
      <div class="theme-card__label">{WATERFALL_THEME_LABELS[props.id]}</div>
    </button>
  );
}

type GridProps = {
  selected: WaterfallThemeId;
  compact?: boolean;
  onSelect: (id: WaterfallThemeId) => void;
  ids: WaterfallThemeId[];
};

export function ThemeGrid(props: GridProps) {
  return (
    <div class="theme-grid">
      {props.ids.map((id) => (
        <ThemeCard
          id={id}
          selected={props.selected === id}
          compact={props.compact}
          onSelect={props.onSelect}
        />
      ))}
    </div>
  );
}
