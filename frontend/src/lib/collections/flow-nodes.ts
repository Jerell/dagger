import type { Edge, Node } from "@xyflow/react";
import type { ReactNode } from "react";

export type BlockInfo = {
  length: number;
  kind: "source" | "sink" | "transform";
  label: string;
};

export type BranchNodeData = {
  id: string;
  label: string;
  blocks: BlockInfo[];
};

export type BranchNodeType = Node<BranchNodeData, "branchNode">;

export type LabeledGroupNodeData = {
  id: string;
  label: ReactNode;
};

export type LabeledGroupNodeType = Node<
  LabeledGroupNodeData,
  "labeledGroupNode"
>;

export type GeographicAnchorNodeData = {
  id: string;
  label: ReactNode;
};

export type GeographicWindowNodeData = {
  id: string;
  label: ReactNode;
};

export type GeographicWindowNodeType = Node<
  GeographicWindowNodeData,
  "geographicWindowNode"
>;

export type GeographicAnchorNodeType = Node<
  GeographicAnchorNodeData,
  "geographicAnchorNode"
>;

export type AppNode =
  | BranchNodeType
  | LabeledGroupNodeType
  | GeographicAnchorNodeType
  | GeographicWindowNodeType;

export type AppEdge = Edge<
  {
    weight: number;
  },
  "weightedEdge"
>;

export function isGeographicWindowNode(
  node: AppNode
): node is GeographicWindowNodeType {
  return node.type === "geographicWindowNode";
}

export function isGeographicAnchorNode(
  node: AppNode
): node is GeographicAnchorNodeType {
  return node.type === "geographicAnchorNode";
}

export function isLabeledGroupNode(
  node: AppNode
): node is LabeledGroupNodeType {
  return node.type === "labeledGroupNode";
}

export function isBranchNode(node: AppNode): node is BranchNodeType {
  return node.type === "branchNode";
}
