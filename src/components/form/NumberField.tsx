import { useEffect, useState } from "react";

type Props = {
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
  placeholder?: string;
  className?: string;
  required?: boolean;
  inputMode?: "numeric" | "decimal";
};

/**
 * Controlled numeric input that holds a string internally so the user can
 * clear it / type freely (fixes the "0 keeps reappearing" bug).
 * Emits `null` while the field is empty; emits a parsed number otherwise.
 */
export function NumberField({
  value, onChange, min, max, allowDecimal = false,
  placeholder, className, required, inputMode,
}: Props) {
  const [text, setText] = useState<string>(value == null ? "" : String(value));

  // Sync if parent resets the value externally.
  useEffect(() => {
    const current = text === "" ? null : Number(text);
    if (value !== current) setText(value == null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pattern = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
  const mode = inputMode ?? (allowDecimal ? "decimal" : "numeric");

  return (
    <input
      type="text"
      inputMode={mode}
      placeholder={placeholder}
      className={className}
      required={required}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(pattern, "");
        setText(raw);
        if (raw === "" || raw === ".") {
          onChange(null);
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        onChange(n);
      }}
      onBlur={() => {
        if (text === "" || text === ".") return;
        let n = Number(text);
        if (!Number.isFinite(n)) return;
        if (min != null && n < min) n = min;
        if (max != null && n > max) n = max;
        setText(String(n));
        onChange(n);
      }}
    />
  );
}
