"use client";

import {
  createCollection,
  eq,
  liveQueryCollectionOptions,
  localStorageCollectionOptions,
} from "@tanstack/db";
import type { AppEdge, AppNode } from "./flow-nodes";
import { preset1 } from "./flow-network-presets/preset1";
import { FlowPreset } from "./flow-network-presets";

export const nodesCollection = createCollection(
  localStorageCollectionOptions<AppNode>({
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
  localStorageCollectionOptions<AppEdge>({
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

export async function seedFlowCollections(
  initialNodes: AppNode[],
  initialEdges: AppEdge[]
) {
  // Ensure sync starts before we inspect size
  await Promise.all([nodesCollection.preload(), edgesCollection.preload()]);

  const isEmpty = nodesCollection.size === 0 && edgesCollection.size === 0;
  if (!isEmpty) return;

  const nodeTx = nodesCollection.insert(initialNodes);
  const edgeTx = edgesCollection.insert(initialEdges);

  await Promise.all([nodeTx.isPersisted.promise, edgeTx.isPersisted.promise]);
}

export function clearFlowCollections() {
  nodesCollection.utils.clearStorage();
  edgesCollection.utils.clearStorage();
}

// ---------------------------------------------------------------------------
// Initial data and helpers
// ---------------------------------------------------------------------------

let seedPromise: Promise<void> | null = null;

export function ensureFlowSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedFlowCollections(preset1.nodes, preset1.edges);
  }
  return seedPromise;
}

export async function resetFlowCollectionsToInitial(): Promise<void> {
  // Ensure collections are syncing
  await Promise.all([nodesCollection.preload(), edgesCollection.preload()]);

  // Delete current data via mutations so subscribers update immediately
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

  // Reinsert initial data
  const insNodesTx = nodesCollection.insert(preset1.nodes);
  const insEdgesTx = edgesCollection.insert(preset1.edges);
  await Promise.all([
    insNodesTx.isPersisted.promise,
    insEdgesTx.isPersisted.promise,
  ]);
}

export async function resetFlowToPreset(preset: FlowPreset): Promise<void> {
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

  const insNodesTx = nodesCollection.insert(preset.nodes);
  const insEdgesTx = edgesCollection.insert(preset.edges);
  await Promise.all([
    insNodesTx.isPersisted.promise,
    insEdgesTx.isPersisted.promise,
  ]);
}

// ---------------------------------------------------------------------------
// Write helpers for ReactFlow integration
// ---------------------------------------------------------------------------

export function writeNodesToCollection(updated: AppNode[]): void {
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

export function writeEdgesToCollection(updated: AppEdge[]): void {
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
