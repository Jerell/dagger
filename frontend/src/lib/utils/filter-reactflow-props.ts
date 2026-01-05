import type { FlowNode } from "@/lib/collections/flow-nodes";
import type { NetworkNode } from "@/lib/api-client";

// ReactFlow UI properties to exclude from TOML
const REACTFLOW_UI_PROPERTIES = [
  "draggable",
  "selectable",
  "selected",
  "zIndex",
  "focusable",
  "resizing",
  "style",
  "className",
  "ariaRole",
  "domAttributes",
] as const;

/**
 * Filter ReactFlow UI properties from a node, returning only NetworkNode properties
 * This ensures TOML export doesn't include UI state
 */
export function filterReactFlowProperties<T extends Record<string, unknown>>(
  node: T
): Omit<T, (typeof REACTFLOW_UI_PROPERTIES)[number]> {
  const filtered = { ...node };
  REACTFLOW_UI_PROPERTIES.forEach((prop) => {
    delete filtered[prop];
  });
  return filtered as Omit<T, (typeof REACTFLOW_UI_PROPERTIES)[number]>;
}

/**
 * Convert FlowNode to NetworkNode (removes ReactFlow UI properties)
 * Also handles undefined/null conversions for API compatibility
 */
export function toNetworkNode(node: FlowNode): NetworkNode {
  // Filter out ReactFlow UI properties
  const filtered = filterReactFlowProperties(node);

  // Convert undefined to null for API compatibility (where needed)
  // parentId, width, height can be null in API but undefined in FlowNode
  const networkNode = {
    ...filtered,
    parentId: filtered.parentId ?? null,
    width: filtered.width ?? null,
    height: filtered.height ?? null,
  };

  return networkNode as NetworkNode;
}

