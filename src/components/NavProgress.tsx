"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Immediate feedback for slow server round trips: a top progress bar on any internal link click or
// form submit, and a busy state on the pressed button so people do not tap or search twice.
export default function NavProgress() {
  const [active, setActive] = useState(false);
  const path = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    setActive(false);
    document.querySelectorAll(".is-busy").forEach((el) => el.classList.remove("is-busy"));
  }, [path, search]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const start = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setActive(false);
        document.querySelectorAll(".is-busy").forEach((el) => el.classList.remove("is-busy"));
      }, 20000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const btn = (e.submitter as HTMLElement | null) ?? (e.target as HTMLFormElement).querySelector("button[type=submit], button:not([type])");
      if (btn?.classList.contains("is-busy")) {
        e.preventDefault();
        return;
      }
      btn?.classList.add("is-busy");
      start();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      clearTimeout(timer);
    };
  }, []);

  return <div className={`progress ${active ? "on" : ""}`} role="progressbar" aria-hidden={!active} />;
}
