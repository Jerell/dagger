import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import type { Node, Edge, NodeTypes } from "@xyflow/react";
import { BranchNode } from "./nodes/branch";

// Register custom node types
const nodeTypes: NodeTypes = {
  branch: BranchNode as NodeTypes["branch"],
  // Add other node types here as you create them:
  // labeledGroup: LabeledGroupNode,
  // geographicWindow: GeographicWindowNode,
  // geographicAnchor: GeographicAnchorNode,
};

interface FlowNetworkProps {
  nodes: Node[];
  edges: Edge[];
}

export function FlowNetwork({ nodes, edges }: FlowNetworkProps) {
  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
