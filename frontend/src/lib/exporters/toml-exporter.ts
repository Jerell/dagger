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
    // Add outgoing array only if there are outgoing edges
    // (original TOML files omit this field when empty)
    if (outgoing && outgoing.length > 0) {
      tomlObj.outgoing = outgoing;
    }

    // Add blocks (convert from data.blocks to [[block]] format)
    // Note: 'kind' and 'label' are computed fields from the backend, not part of the original TOML
    if (node.data.blocks && node.data.blocks.length > 0) {
      tomlObj.block = node.data.blocks.map((block) => {
        const blockObj: Record<string, unknown> = {};
        // Only include quantity if it's not the default (1)
        if (block.quantity !== undefined && block.quantity !== 1) {
          blockObj.quantity = block.quantity;
        }
        // type is required
        blockObj.type = block.type;
        // Add any extra properties from the block (excluding computed fields)
        Object.keys(block).forEach((key) => {
          // Skip known fields and computed fields (kind, label are computed by backend)
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

  // For image nodes, add the path property
  if (node.type === "image" && "path" in node.data) {
    tomlObj.path = node.data.path;
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
