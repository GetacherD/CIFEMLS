export default function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return (
    <div className={`flash ${err ? "flash-err" : "flash-ok"}`} role="status">
      {err ?? msg}
    </div>
  );
}
