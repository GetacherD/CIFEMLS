"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Copies each table header onto its cells so the stylesheet can turn rows into labelled cards on phones.
export default function TableLabels() {
  const path = usePathname();
  useEffect(() => {
    document.querySelectorAll("table").forEach((t) => {
      const heads = Array.from(t.querySelectorAll("thead th")).map((h) => h.textContent?.trim() ?? "");
      if (!heads.length) return;
      t.querySelectorAll("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((td, i) => {
          if (td instanceof HTMLElement && !td.dataset.label && heads[i]) td.dataset.label = heads[i];
        });
      });
    });
  });
  void path;
  return null;
}
