export function RefTag({ kind, label }: { kind: string; label: string }) {
  return (
    <span className="toolchip" style={{ padding: '2px 6px', fontSize: 9 }}>
      [{kind}]&nbsp;{label}
    </span>
  )
}
