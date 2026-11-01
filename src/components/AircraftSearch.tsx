"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

export interface AircraftHint {
  id: string;
  registration: string;
  group: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Registration search with live suggestions. Any part of a registration matches ("mhv", "A7", "apy").
export default function AircraftSearch({
  aircraft,
  defaultValue = "",
  placeholder = "Registration, e.g. AU-EPY or EPY",
  hidden,
}: {
  aircraft: AircraftHint[];
  defaultValue?: string;
  placeholder?: string;
  hidden?: Record<string, string>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLFormElement>(null);

  const hits = useMemo(() => {
    const n = norm(q);
    if (!n) return [];
    return aircraft
      .filter((a) => norm(a.registration).includes(n))
      .sort((a, b) => {
        const sa = norm(a.registration).startsWith(n) ? 0 : 1;
        const sb = norm(b.registration).startsWith(n) ? 0 : 1;
        return sa - sb || a.registration.localeCompare(b.registration);
      })
      .slice(0, 8);
  }, [aircraft, q]);

  function go(a: AircraftHint) {
    setOpen(false);
    router.push(`/aircraft/${a.id}`);
  }

  return (
    <form
      action="/aircraft"
      method="get"
      className="search"
      ref={wrap}
      onSubmit={(e) => {
        if (active >= 0 && hits[active]) {
          e.preventDefault();
          go(hits[active]);
        }
      }}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <input
        name="q"
        value={q}
        placeholder={placeholder}
        aria-label="Aircraft registration"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className="btn" type="submit">
        Search
      </button>
      {open && q.trim() !== "" && (
        <ul className="sugg" role="listbox">
          {hits.length === 0 && <li className="ss-empty">No aircraft match “{q.trim()}”</li>}
          {hits.map((a, i) => (
            <li
              key={a.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? "on" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                go(a);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="sugg-reg">{a.registration}</span>
              <span className="muted small">{a.group ?? "No group"}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
