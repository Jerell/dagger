"use client";

import { useCallback } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
} from "@xyflow/react";
import {
  writeNodesToCollection,
  writeEdgesToCollection,
} from "@/lib/collections/flow";
import { BranchNode } from "./nodes/branch";
import { LabeledGroupNode } from "./nodes/labeled-group";
import type { FlowNode, FlowEdge } from "@/lib/collections/flow-nodes";
import { GeographicAnchorNode } from "./nodes/geographic-anchor";
import { GeographicWindowNode } from "./nodes/geographic-window";
import { ImageNode } from "./nodes/image";

// Register custom node types
const nodeTypes: NodeTypes = {
  branch: BranchNode as NodeTypes["branch"],
  labeledGroup: LabeledGroupNode as NodeTypes["labeledGroup"],
  geographicAnchor: GeographicAnchorNode as NodeTypes["geographicAnchor"],
  geographicWindow: GeographicWindowNode as NodeTypes["geographicWindow"],
  image: ImageNode as NodeTypes["image"],
};

type FlowNetworkProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
};

export function FlowNetwork({
  nodes,
  edges,
  nodesDraggable = true,
  nodesConnectable = true,
  elementsSelectable = true,
}: FlowNetworkProps) {
  // Handle ReactFlow changes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, nodes as Node[]);
      // ReactFlow automatically handles parent-child movement in the viewport
      // applyNodeChanges returns all nodes with updated positions (including children)
      writeNodesToCollection(updated as FlowNode[]);
    },
    [nodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updated = applyEdgeChanges(changes, edges as Edge[]);
      writeEdgesToCollection(updated as FlowEdge[]);
    },
    [edges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      // Validate: both source and target must be branches
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (
        !sourceNode ||
        !targetNode ||
        sourceNode.type !== "branch" ||
        targetNode.type !== "branch" ||
        connection.source === connection.target // Must be distinct
      ) {
        // Reject connection
        return;
      }

      // Use ReactFlow's addEdge helper with our edge data structure
      const updated = addEdge(
        {
          ...connection,
          data: { weight: 1 },
        },
        edges as Edge[]
      );

      writeEdgesToCollection(updated as FlowEdge[]);
    },
    [nodes, edges]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        nodesDraggable={nodesDraggable}
        nodesConnectable={nodesConnectable}
        elementsSelectable={elementsSelectable}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
