import {
  createCollection,
  liveQueryCollectionOptions,
  eq,
  or,
} from "@tanstack/react-db";
import { nodesCollection } from "./flow";
import type { FlowNode } from "./flow-nodes";

export const selectedNodesCollection = createCollection(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ node: nodesCollection })
        .where(({ node }) => eq(node.selected, true)),
  })
);

export const selectedGroupsCollection = createCollection<
  FlowNode & { type: "labeledGroup" }
>(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ node: nodesCollection })
        .where(({ node }) => eq(node.type, "labeledGroup"))
        .where(({ node }) => eq(node.selected, true)),
  })
);

export const selectedBranchesCollection = createCollection<
  FlowNode & { type: "branch" }
>(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ node: nodesCollection })
        .where(({ node }) => eq(node.type, "branch"))
        .where(({ node }) => eq(node.selected, true)),
  })
);

export const selectedGeographyCollection = createCollection<
  FlowNode & { type: "geographicAnchor" | "geographicWindow" }
>(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ node: nodesCollection })
        .where(({ node }) =>
          or(
            eq(node.type, "geographicAnchor"),
            eq(node.type, "geographicWindow")
          )
        )
        .where(({ node }) => eq(node.selected, true)),
  })
);
export const selectedChildrenCollection = createCollection(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ child: nodesCollection })
        .innerJoin({ parent: nodesCollection }, ({ child, parent }) =>
          eq(child.parentId, parent.id)
        )
        .where(({ parent }) => eq(parent.selected, true))
        .select(({ child }) => child),
  })
);
