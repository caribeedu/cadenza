type Props = {
  label: string;
  value: number;
  displayValue?: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

export function Slider(props: Props) {
  return (
    <label class="slider-row">
      <div class="slider-row__header">
        <span>{props.label}</span>
        <span>{props.displayValue ?? String(props.value)}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
      />
    </label>
  );
}
