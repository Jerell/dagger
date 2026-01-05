import * as TOML from "@iarna/toml";
import type { FlowNode, FlowEdge } from "@/lib/collections/flow-nodes";
import type { NetworkNode } from "@/lib/api-client";
import { toNetworkNode } from "@/lib/utils/filter-reactflow-props";
import { writeNetworkFile } from "@/lib/tauri";

/**
 * Convert a NetworkNode to TOML format
 * Handles the structure differences between API format and TOML format
 * @param node NetworkNode to serialize
 * @param outgoing Optional outgoing array for branch nodes (from edges)
 */
function serializeNodeToToml(
  node: NetworkNode,
  outgoing?: Array<{ target: string; weight: number }>
): string {
  // Build the TOML object structure
  const tomlObj: Record<string, unknown> = {
    type: node.type,
  };

  // Add label if present
  if (node.data.label) {
    tomlObj.label = node.data.label;
  }

  // Add parentId if present
  if (node.parentId) {
    tomlObj.parentId = node.parentId;
  }

  // Add width and height if present (top-level, not in position)
  if (node.width !== null && node.width !== undefined) {
    tomlObj.width = node.width;
  }
  if (node.height !== null && node.height !== undefined) {
    tomlObj.height = node.height;
  }

  // Add position (will be serialized as [position] table)
  tomlObj.position = {
    x: node.position.x,
    y: node.position.y,
  };

  // Handle branch-specific properties
  if (node.type === "branch") {
    // Add outgoing array (always include, even if empty)
    // outgoing comes from edges, not from the node itself
    if (outgoing && outgoing.length > 0) {
      tomlObj.outgoing = outgoing;
    } else {
      tomlObj.outgoing = [];
    }

    // Add blocks (convert from data.blocks to [[block]] format)
    if (node.data.blocks && node.data.blocks.length > 0) {
      tomlObj.block = node.data.blocks.map((block) => {
        const blockObj: Record<string, unknown> = {
          type: block.type,
        };
        if (block.quantity !== undefined) {
          blockObj.quantity = block.quantity;
        }
        if (block.kind) {
          blockObj.kind = block.kind;
        }
        if (block.label) {
          blockObj.label = block.label;
        }
        // Add any extra properties from the block
        Object.keys(block).forEach((key) => {
          if (!["type", "quantity", "kind", "label"].includes(key)) {
            blockObj[key] = (block as Record<string, unknown>)[key];
          }
        });
        return blockObj;
      });
    }
  }

  // For group and geographic nodes, add extra properties from data
  if (
    node.type === "labeledGroup" ||
    node.type === "geographicAnchor" ||
    node.type === "geographicWindow"
  ) {
    // Add any extra properties from data (excluding id and label which are already handled)
    Object.keys(node.data).forEach((key) => {
      if (
        key !== "id" &&
        key !== "label" &&
        node.data[key] !== undefined &&
        node.data[key] !== null
      ) {
        tomlObj[key] = node.data[key];
      }
    });
  }

  // @iarna/toml will automatically serialize nested objects as TOML tables
  // So position: { x, y } becomes [position] x = ... y = ...
  // Cast to JsonMap type expected by @iarna/toml
  return TOML.stringify(tomlObj as TOML.JsonMap);
}

/**
 * Export network to TOML files
 * @param nodes Array of FlowNode
 * @param edges Array of FlowEdge
 * @param directoryPath Directory path to write files to
 */
export async function exportNetworkToToml(
  nodes: FlowNode[],
  edges: FlowEdge[],
  directoryPath: string
): Promise<void> {
  // Build outgoing arrays for branches from edges
  const edgesBySource = new Map<string, FlowEdge[]>();
  edges.forEach((edge) => {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);
  });

  // Process each node
  for (const node of nodes) {
    // Filter out ReactFlow UI properties
    const nodeForToml = toNetworkNode(node);

    // Get outgoing array for branches
    const outgoing =
      nodeForToml.type === "branch"
        ? edgesBySource.get(node.id)?.map((edge) => ({
            target: edge.target,
            weight: edge.data.weight,
          })) || []
        : undefined;

    // Serialize to TOML
    const tomlContent = serializeNodeToToml(nodeForToml, outgoing);

    // Write file using Tauri (construct path manually since we're in browser)
    const filePath = directoryPath.endsWith("/")
      ? `${directoryPath}${node.id}.toml`
      : `${directoryPath}/${node.id}.toml`;
    await writeNetworkFile(filePath, tomlContent);
  }
}
