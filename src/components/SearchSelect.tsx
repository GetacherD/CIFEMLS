"use client";

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

interface Opt {
  value: string;
  label: string;
}

function text(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement(node)) return text((node.props as { children?: ReactNode }).children);
  return "";
}

function collect(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string; children?: ReactNode };
    if (c.type === "option") out.push({ value: p.value ?? text(p.children), label: text(p.children) });
    else out.push(...collect(p.children));
  });
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Drop-in replacement for <select> with <option> children: type to filter, works inside plain forms.
export default function SearchSelect({
  name,
  children,
  defaultValue = "",
  required,
  className,
}: {
  name: string;
  children: ReactNode;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const options = useMemo(() => collect(children), [children]);
  const [value, setValue] = useState(defaultValue);
  const current = options.find((o) => o.value === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  const shown = useMemo(() => {
    const n = norm(query);
    return n ? options.filter((o) => norm(o.label).includes(n) || norm(o.value).includes(n)) : options;
  }, [options, query]);

  useEffect(() => {
    input.current?.setCustomValidity(required && !value ? "Choose an option from the list" : "");
  }, [required, value]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  });

  function close() {
    setOpen(false);
    setQuery("");
  }
  function pick(o: Opt) {
    setValue(o.value);
    close();
  }

  return (
    <div className={`ss ${className ?? ""}`} ref={box}>
      <input type="hidden" name={name} value={value} />
      <input
        ref={input}
        className="ss-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        placeholder={current?.label || "Search…"}
        value={open ? query : (current?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (shown[active]) pick(shown[active]);
          } else if (e.key === "Escape" || e.key === "Tab") close();
        }}
      />
      <span className="ss-caret" aria-hidden="true" />
      {open && (
        <ul className="ss-list" id={listId} role="listbox">
          {shown.length === 0 && <li className="ss-empty">No match</li>}
          {shown.map((o, i) => (
            <li
              key={o.value + i}
              role="option"
              aria-selected={o.value === value}
              className={`${i === active ? "on" : ""} ${o.value === value ? "sel" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {o.label || "—"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
