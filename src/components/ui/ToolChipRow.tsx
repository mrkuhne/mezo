import type { Tool } from './ToolChip'
import { ToolChip } from './ToolChip'

export function ToolChipRow({ tools }: { tools: Tool[] }) {
  return (
    <div className="row gap-sm flex-wrap" style={{ marginBottom: 10 }}>
      {tools.map((t, i) => (
        <ToolChip key={i} {...t} />
      ))}
    </div>
  )
}
