import {
  createCollection,
  liveQueryCollectionOptions,
  eq,
  or,
} from "@tanstack/db";
import { nodesCollection } from "./flow";
import {
  BranchNodeType,
  GeographicAnchorNodeType,
  GeographicWindowNodeType,
  LabeledGroupNodeType,
} from "../types/flow-nodes";

export const selectedNodesCollection = createCollection(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ node: nodesCollection })
        .where(({ node }) => eq(node.selected, true)),
  })
);

export const selectedGroupsCollection = createCollection<LabeledGroupNodeType>(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ node: nodesCollection })
        .where(({ node }) => eq(node.type, "labeledGroupNode"))
        .where(({ node }) => eq(node.selected, true)),
  })
);

export const selectedBranchesCollection = createCollection<BranchNodeType>(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ node: nodesCollection })
        .where(({ node }) => eq(node.type, "branchNode"))
        .where(({ node }) => eq(node.selected, true)),
  })
);

export const selectedGeographyCollection = createCollection<
  GeographicAnchorNodeType | GeographicWindowNodeType
>(
  liveQueryCollectionOptions({
    query: (q) =>
      q
        .from({ node: nodesCollection })
        .where(({ node }) =>
          or(
            eq(node.type, "geographicAnchorNode"),
            eq(node.type, "geographicWindowNode")
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
