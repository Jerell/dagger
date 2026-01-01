import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { BranchNodeData as ApiBranchNodeData } from "@/lib/api-client";

// Extend the API type to include originalNode for ReactFlow
export type BranchNodeData = ApiBranchNodeData & {
  originalNode?: unknown;
};

export function BranchNode({ data }: NodeProps) {
  const nodeData = data as BranchNodeData;
  const { label, blocks } = nodeData;

  return (
    <div className="bg-white border border-brand-grey-3 rounded-lg shadow-sm p-3 min-w-[200px]">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-brand-blue-1 rounded-full"></div>
          <div className="text-sm font-medium">{label || nodeData.id}</div>
        </div>
      </div>
      {blocks && blocks.length > 0 && (
        <div className="mt-2 pt-2 border-t border-brand-grey-3">
          <div className="text-xs text-brand-grey-2 mb-1">
            Blocks ({blocks.length})
          </div>
          <div className="space-y-1">
            {blocks.map((block: BranchNodeData["blocks"][0], index: number) => (
              <div key={index} className="text-xs flex items-center gap-2">
                <span className="text-brand-grey-2">×{block.quantity}</span>
                <span>{block.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
