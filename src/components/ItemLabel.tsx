interface Props {
  item?: {
    part_number: string;
    version: string;
    code?: string | null;
    properties?: Record<string, string> | null;
  } | null;
}

// Part number, version, code/serial label and any extra named properties.
export default function ItemLabel({ item }: Props) {
  if (!item) return <span className="muted">—</span>;
  const props = Object.entries(item.properties ?? {});
  return (
    <span className="item">
      <strong>{item.part_number}</strong> <span className="ver">v{item.version}</span>
      {item.code ? <span className="code">{item.code}</span> : null}
      {props.length > 0 && (
        <span className="props">
          {props.map(([k, v]) => (
            <span key={k}>
              <em>{k}:</em> {v}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
