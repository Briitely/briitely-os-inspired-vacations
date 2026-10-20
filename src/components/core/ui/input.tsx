"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneAsTyped } from "@/lib/format/phone";

const inputClasses = "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type InputProps = React.ComponentProps<"input">;
function displayDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : "";
}
function parseDate(display: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (date.getUTCFullYear() !== Number(yyyy) || date.getUTCMonth() + 1 !== Number(mm) || date.getUTCDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}
const DateInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, value, defaultValue, onChange, onBlur, min, max, disabled, required, name, id, ...props }, ref) => {
    const pickerRef = React.useRef<HTMLInputElement>(null);
    const iso = String(value ?? defaultValue ?? "");
    const [draft, setDraft] = React.useState(() => displayDate(iso));
    React.useEffect(() => { setDraft(displayDate(iso)); }, [iso]);
    const emit = (next: string) => {
      onChange?.({ target: { value: next, name, id }, currentTarget: { value: next, name, id } } as React.ChangeEvent<HTMLInputElement>);
    };
    const changeText = (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 8);
      const formatted = digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
      setDraft(formatted);
      if (!digits) emit("");
      const parsed = parseDate(formatted);
      if (parsed && (!min || parsed >= String(min)) && (!max || parsed <= String(max))) emit(parsed);
    };
    return (
      <div className="relative w-full">
        <input
          {...props}
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM/DD/YYYY"
          aria-label={props["aria-label"] ?? "Date (month/day/year)"}
          className={cn(inputClasses, "pr-11", className)}
          value={draft}
          disabled={disabled}
          required={required}
          onChange={event => changeText(event.target.value)}
          onBlur={event => { if (draft && !parseDate(draft)) setDraft(displayDate(iso)); onBlur?.(event); }}
        />
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-3 h-px w-px opacity-0"
          value={parseDate(draft) ?? iso}
          min={min}
          max={max}
          disabled={disabled}
          onChange={event => { setDraft(displayDate(event.target.value)); emit(event.target.value); }}
        />
        <button
          type="button"
          aria-label="Choose date from calendar"
          title="Choose date from calendar"
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => { const picker = pickerRef.current; if (!picker) return; if (typeof picker.showPicker === "function") picker.showPicker(); else picker.click(); }}
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    );
  }
);
DateInput.displayName = "DateInput";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    if (type === "date") return <DateInput {...props} className={className} ref={ref} />;
    if (type === "tel") {
      // Every phone field uses the Briitely format, (403) 555-0123, both for the
      // value it shows and for what it hands to onChange.
      const { value, onChange, ...rest } = props;
      const shownValue = typeof value === "string" ? formatPhoneAsTyped(value) : value;
      const handleChange = onChange
        ? (event: React.ChangeEvent<HTMLInputElement>) => { event.target.value = formatPhoneAsTyped(event.target.value); onChange(event); }
        : undefined;
      return <input type="tel" className={cn(inputClasses, className)} ref={ref} value={shownValue} onChange={handleChange} {...rest} />;
    }
    return <input type={type} className={cn(inputClasses, className)} ref={ref} {...props} />;
  }
);
Input.displayName = "Input";

export { Input };
