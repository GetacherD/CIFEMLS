export default function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="skel" style={{ height: "3.4rem", borderRadius: 16 }} />
      <div className="skel" style={{ height: "2.4rem", width: "40%" }} />
      <div className="skel" style={{ height: "11rem" }} />
      <div className="skel" style={{ height: "9rem" }} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
