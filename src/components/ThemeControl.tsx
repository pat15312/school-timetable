import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Moon, Sun, SunMoon } from "lucide-react";

const choices = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "Auto", icon: SunMoon },
] as const;

function subscribe(callback: () => void) {
  window.addEventListener("schoolcal:theme-applied", callback);
  return () => window.removeEventListener("schoolcal:theme-applied", callback);
}
const getPreference = () =>
  document.documentElement.dataset.themePreference || "system";

export function ThemeControl() {
  const preference = useSyncExternalStore(subscribe, getPreference);
  const selected =
    choices.find((choice) => choice.value === preference) || choices[2];
  const [open, setOpen] = useState(false);
  const control = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!control.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      className="theme-control"
      ref={control}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        const buttons = [
          ...(options.current?.querySelectorAll("button") || []),
        ];
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (open && index >= 0) {
          const next = {
            ArrowDown: (index + 1) % 3,
            ArrowUp: (index + 2) % 3,
            Home: 0,
            End: 2,
          }[event.key];
          if (next !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            buttons[next]?.focus();
          }
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="theme-trigger"
        aria-label={`Appearance: ${selected.label}`}
        title={`Appearance: ${selected.label}`}
        aria-expanded={open}
        aria-controls="theme-options"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
            requestAnimationFrame(() =>
              options.current
                ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
                ?.focus(),
            );
          }
        }}
      >
        <selected.icon size={19} aria-hidden="true" />
      </button>
      <div
        ref={options}
        id="theme-options"
        className="theme-options"
        role="group"
        aria-label="Appearance choices"
        hidden={!open}
      >
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-label={`${choice.label} theme`}
            aria-pressed={preference === choice.value}
            title={
              choice.value === "system"
                ? "Auto — follow device settings"
                : choice.label
            }
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("schoolcal:theme-change", {
                  detail: choice.value,
                }),
              );
              close();
            }}
          >
            <choice.icon size={18} aria-hidden="true" />
            <span>{choice.label}</span>
            {preference === choice.value && (
              <Check size={15} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
