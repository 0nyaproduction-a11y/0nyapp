"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

// Reusable CMS-only dropdown replacing native <select>. Chrome/Windows
// renders native <select> popups with the OS's own light popup styling —
// color-scheme:dark on the trigger element does not reliably darken that
// popup on Windows, so this renders the open listbox with real DOM/CSS
// instead of relying on any browser-native popup surface.
//
// Follows the ARIA "select-only combobox" pattern: focus always stays on the
// trigger button (never moves into the list), and the active option is
// tracked via aria-activedescendant. This keeps Tab behavior identical to a
// native <select> for free.
export type CmsSelectOption = {
  disabled?: boolean;
  group?: string;
  label: string;
  value: string;
};

type CmsSelectProps = {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onChange?: (value: string) => void;
  options: CmsSelectOption[];
  placeholderLabel?: string;
  required?: boolean;
  value?: string;
};

const triggerBaseClassName =
  "flex w-full items-center justify-between gap-2 border border-bone/15 bg-[#050505] px-3 py-2 text-left text-sm text-[#E8E4DA] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50";

function findEnabledIndex(options: CmsSelectOption[], start: number, direction: 1 | -1) {
  if (options.length === 0) {
    return -1;
  }

  let index = start;

  for (let step = 0; step < options.length; step += 1) {
    index += direction;

    if (index < 0) {
      index = options.length - 1;
    }

    if (index >= options.length) {
      index = 0;
    }

    if (!options[index]?.disabled) {
      return index;
    }
  }

  return start;
}

export function CmsSelect({
  className,
  defaultValue,
  disabled,
  id,
  name,
  onChange,
  options,
  placeholderLabel = "Select…",
  required,
  value,
}: CmsSelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const currentValue = isControlled ? (value as string) : internalValue;

  const [open, setOpen] = useState(false);
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === currentValue),
    [options, currentValue],
  );
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, selectedIndex));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const listboxId = `${baseId}-listbox`;

  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const activeOptionId = open && options[activeIndex] ? `${baseId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function openMenu() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function commitIndex(index: number) {
    const option = options[index];

    if (!option || option.disabled) {
      return;
    }

    if (!isControlled) {
      setInternalValue(option.value);
    }

    onChange?.(option.value);
    setOpen(false);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();

        if (!open) {
          openMenu();
          return;
        }

        setActiveIndex((current) => findEnabledIndex(options, current, 1));
        return;
      }
      case "ArrowUp": {
        event.preventDefault();

        if (!open) {
          openMenu();
          return;
        }

        setActiveIndex((current) => findEnabledIndex(options, current, -1));
        return;
      }
      case "Enter":
      case " ": {
        event.preventDefault();

        if (!open) {
          openMenu();
          return;
        }

        commitIndex(activeIndex);
        return;
      }
      case "Escape": {
        if (open) {
          event.preventDefault();
          setOpen(false);
        }

        return;
      }
      case "Home": {
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }

        return;
      }
      case "End": {
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }

        return;
      }
      case "Tab": {
        setOpen(false);
        return;
      }
      default:
        return;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={currentValue} required={required} />}
      <button
        ref={triggerRef}
        type="button"
        id={baseId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }

          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`${triggerBaseClassName} ${className ?? ""}`}
      >
        <span className={selectedOption ? "" : "text-[#E8E4DA]/40"}>{selectedOption?.label ?? placeholderLabel}</span>
        <span aria-hidden="true" className="text-[#E8E4DA]/50">
          ▾
        </span>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={baseId}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-bone/15 bg-[#050505] py-1 shadow-xl"
        >
          {options.map((option, index) => {
            const previousOption = options[index - 1];
            const showGroupHeader = Boolean(option.group && option.group !== previousOption?.group);

            return (
              <li key={option.value} role="presentation">
                {showGroupHeader && (
                  <div className="px-3 pt-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[#E8E4DA]/40">
                    {option.group}
                  </div>
                )}
                <div
                  id={`${baseId}-option-${index}`}
                  role="option"
                  aria-selected={option.value === currentValue}
                  aria-disabled={option.disabled || undefined}
                  onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                  onClick={() => commitIndex(index)}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    option.disabled
                      ? "cursor-not-allowed text-[#E8E4DA]/30"
                      : index === activeIndex
                        ? "bg-teal/15 text-[#E8E4DA]"
                        : option.value === currentValue
                          ? "text-teal"
                          : "text-[#E8E4DA]"
                  }`}
                >
                  {option.label}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
