import type { Node, Edge } from "@xyflow/react";
import type { NetworkNode, NetworkEdge } from "@/lib/api-client";

// Extend NetworkNode/NetworkEdge with ReactFlow properties
// These are UI state properties that don't go in TOML
export type FlowNode = Omit<NetworkNode, "parentId" | "width" | "height" | "extent"> &
  Partial<
    Pick<
      Node,
      "selected" | "zIndex" | "focusable" | "resizing" | "style" | "className"
    >
  > & {
    // ReactFlow UI properties (optional, added at runtime)
    draggable?: boolean;
    selectable?: boolean;
    // Handle null values from API (convert to undefined for ReactFlow)
    parentId?: string; // Convert null to undefined
    width?: number; // Convert null to undefined
    height?: number; // Convert null to undefined
    extent?: "parent"; // For parent-child relationships
  };

export type FlowEdge = NetworkEdge & Partial<Edge>;

// Type guards for node types
export function isBranchNode(
  node: FlowNode
): node is FlowNode & { type: "branch" } {
  return node.type === "branch";
}

export function isLabeledGroupNode(
  node: FlowNode
): node is FlowNode & { type: "labeledGroup" } {
  return node.type === "labeledGroup";
}

export function isGeographicAnchorNode(
  node: FlowNode
): node is FlowNode & { type: "geographicAnchor" } {
  return node.type === "geographicAnchor";
}

export function isGeographicWindowNode(
  node: FlowNode
): node is FlowNode & { type: "geographicWindow" } {
  return node.type === "geographicWindow";
}

// Legacy type aliases for backward compatibility during migration
export type AppNode = FlowNode;
export type AppEdge = FlowEdge;
