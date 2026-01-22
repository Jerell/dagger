"use client";

import {
  createCollection,
  eq,
  liveQueryCollectionOptions,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import type { FlowNode, FlowEdge } from "./flow-nodes";
import { getNetwork, type NetworkResponse } from "@/lib/api-client";

/**
 * Get z-index for node layering.
 * Geographic nodes at bottom, images above, everything else on top.
 */
function getNodeZIndex(nodeType: string): number {
  switch (nodeType) {
    case "geographicWindow":
    case "geographicAnchor":
      return 0; // Bottom layer
    case "image":
      return 1; // Above geographic
    default:
      return 2; // Top layer (branches, groups, etc.)
  }
}

/**
 * Sort nodes so parent nodes come before their children
 * ReactFlow requires this ordering when nodes have parentId
 * This must be called whenever nodes are read from collections
 * Also ensures z-index is applied for proper layering
 */
export function sortNodesWithParentsFirst(nodes: FlowNode[]): FlowNode[] {
  const nodeMap = new Map<string, FlowNode>();
  const sorted: FlowNode[] = [];
  const visited = new Set<string>();

  // Create a map for quick lookup
  nodes.forEach((node) => nodeMap.set(node.id, node));

  // Helper to add node and its ancestors
  const addNode = (node: FlowNode) => {
    if (visited.has(node.id)) return;

    // If node has a parent, add parent first
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        addNode(parent);
      }
    }

    // Add this node with z-index for layering
    sorted.push({
      ...node,
      zIndex: node.zIndex ?? getNodeZIndex(node.type),
    });
    visited.add(node.id);
  };

  // Add all nodes
  nodes.forEach((node) => addNode(node));

  return sorted;
}

export const nodesCollection = createCollection(
  localStorageCollectionOptions<FlowNode>({
    id: "flow:nodes",
    storageKey: "flow:nodes",
    getKey: (node) => node.id,
  })
);

export const findById = (nodeId: string) =>
  createCollection(
    liveQueryCollectionOptions({
      query: (q) =>
        q
          .from({ node: nodesCollection })
          .where(({ node }) => eq(node.id, nodeId))
          .findOne(),
    })
  );

export const edgesCollection = createCollection(
  localStorageCollectionOptions<FlowEdge>({
    id: "flow:edges",
    storageKey: "flow:edges",
    getKey: (edge) => edge.id,
  })
);

export const findEdgesBySource = (sourceId: string) =>
  createCollection(
    liveQueryCollectionOptions({
      query: (q) =>
        q
          .from({ edge: edgesCollection })
          .where(({ edge }) => eq(edge.source, sourceId)),
    })
  );

export const findEdgesByTarget = (targetId: string) =>
  createCollection(
    liveQueryCollectionOptions({
      query: (q) =>
        q
          .from({ edge: edgesCollection })
          .where(({ edge }) => eq(edge.target, targetId)),
    })
  );

// Removed seedFlowCollections - no longer needed after removing hardcoded presets

/**
 * Clear all data from flow collections
 * Uses delete mutations so subscribers update immediately
 */
export async function clearFlowCollections(): Promise<void> {
  await Promise.all([nodesCollection.preload(), edgesCollection.preload()]);

  const edgeKeys = Array.from(edgesCollection.keys()) as string[];
  if (edgeKeys.length) {
    const delTx = edgesCollection.delete(edgeKeys);
    await delTx.isPersisted.promise;
  }

  const nodeKeys = Array.from(nodesCollection.keys()) as string[];
  if (nodeKeys.length) {
    const delTx = nodesCollection.delete(nodeKeys);
    await delTx.isPersisted.promise;
  }
}

/**
 * Reset collections to a network response from the API
 * This is a helper that can be used if you already have a NetworkResponse
 * Otherwise, use loadPresetFromApi() which fetches and loads
 */
export async function resetFlowToNetwork(
  network: NetworkResponse
): Promise<void> {
  await Promise.all([nodesCollection.preload(), edgesCollection.preload()]);

  const edgeKeys = Array.from(edgesCollection.keys()) as string[];
  if (edgeKeys.length) {
    const delTx = edgesCollection.delete(edgeKeys);
    await delTx.isPersisted.promise;
  }

  const nodeKeys = Array.from(nodesCollection.keys()) as string[];
  if (nodeKeys.length) {
    const delTx = nodesCollection.delete(nodeKeys);
    await delTx.isPersisted.promise;
  }

  // Add ReactFlow properties and validate edges (same as loadPresetFromApi)
  const flowNodes: FlowNode[] = network.nodes.map((node) => {
    const flowNode: FlowNode = {
      ...node,
      width: node.width ?? undefined,
      height: node.height ?? undefined,
      parentId: node.parentId ?? undefined,
      // Preserve extent if it exists (needed for parent-child relationships)
      extent: node.extent === "parent" ? "parent" : undefined,
      // Image nodes are not draggable (they're static reference images)
      draggable: node.type !== "image",
      selectable: true,
      // Layer nodes: geographic at bottom, images above, everything else on top
      zIndex: getNodeZIndex(node.type),
    };
    return flowNode;
  });

  const validEdges = network.edges.filter((edge) => {
    const sourceNode = flowNodes.find((n) => n.id === edge.source);
    const targetNode = flowNodes.find((n) => n.id === edge.target);
    return (
      sourceNode?.type === "branch" &&
      targetNode?.type === "branch" &&
      edge.source !== edge.target
    );
  });

  // Sort nodes so parent nodes come before their children (ReactFlow requirement)
  const sortedNodes = sortNodesWithParentsFirst(flowNodes);

  const insNodesTx = nodesCollection.insert(sortedNodes);
  const insEdgesTx = edgesCollection.insert(validEdges);
  await Promise.all([
    insNodesTx.isPersisted.promise,
    insEdgesTx.isPersisted.promise,
  ]);
}

/**
 * Load a network into collections
 * Adds ReactFlow UI properties and validates edges
 * @param networkOrId - NetworkResponse from API (or networkId to fetch)
 */
export async function loadPresetFromApi(
  networkOrId: string | NetworkResponse
): Promise<void> {
  // Get network data (either use provided or fetch)
  const network =
    typeof networkOrId === "string"
      ? await getNetwork(networkOrId)
      : networkOrId;

  // Use resetFlowToNetwork to handle the transformation and insertion
  await resetFlowToNetwork(network);
}

// ---------------------------------------------------------------------------
// Write helpers for ReactFlow integration
// ---------------------------------------------------------------------------

export function writeNodesToCollection(updated: FlowNode[]): void {
  const prevKeys = new Set<string>(
    Array.from(nodesCollection.keys()) as string[]
  );
  const updatedKeys = new Set<string>(updated.map((n) => n.id));

  const toDelete: string[] = [];
  prevKeys.forEach((k) => {
    if (!updatedKeys.has(k)) toDelete.push(k);
  });
  if (toDelete.length) nodesCollection.delete(toDelete);

  updated.forEach((node) => {
    if (nodesCollection.has(node.id)) {
      nodesCollection.update(node.id, (draft) => {
        Object.assign(draft, node);
      });
    } else {
      nodesCollection.insert(node);
    }
  });
}

export function writeEdgesToCollection(updated: FlowEdge[]): void {
  const prevKeys = new Set<string>(
    Array.from(edgesCollection.keys()) as string[]
  );
  const updatedKeys = new Set<string>(updated.map((e) => e.id));

  const toDelete: string[] = [];
  prevKeys.forEach((k) => {
    if (!updatedKeys.has(k)) toDelete.push(k);
  });
  if (toDelete.length) edgesCollection.delete(toDelete);

  updated.forEach((edge) => {
    if (edgesCollection.has(edge.id)) {
      edgesCollection.update(edge.id, (draft) => {
        Object.assign(draft, edge);
      });
    } else {
      edgesCollection.insert(edge);
    }
  });
}
