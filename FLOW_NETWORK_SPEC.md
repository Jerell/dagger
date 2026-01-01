# Flow Network Interactive Editor - Specification & Implementation Plan

## Overview

Transform the network viewer into an interactive editor where users can:

- Drag nodes to reposition them
- Create edges by dragging from node handles
- Load from API presets (overwrites local state)
- Work with local state (tanstack-db collections) after initial load
- Eventually persist changes back to TOML files
- Optionally use File System Access API for direct file watching/editing

## Architecture

### Data Flow

```
┌─────────────────┐
│  API Response   │ (Initial load only)
│  (NetworkNode/  │ (Unified types - same as collections)
│   NetworkEdge)  │
└────────┬────────┘
         │
         │ direct assignment (types unified)
         ▼
┌─────────────────┐
│  NetworkNode/   │ (tanstack-db collections)
│  NetworkEdge    │ (Local State - same types as API)
└────────┬────────┘
         │
         │ ReactFlow sync
         ▼
┌─────────────────┐
│   ReactFlow     │ (UI interactions)
│   (onNodesChange│
│    onEdgesChange)│
└────────┬────────┘
         │
         │ writeNodesToCollection()
         │ writeEdgesToCollection()
         ▼
┌─────────────────┐
│  Collections    │ (persisted to localStorage)
└─────────────────┘
         │
         │ (Future: export to TOML)
         ▼
┌─────────────────┐
│  TOML Files     │ (via File System Access API)
└─────────────────┘
```

## Phase 1: Type Unification & Collection Integration

### 1.1 Unify Types Throughout Stack

**Current Issue:**

- API returns `NetworkNode` / `NetworkEdge` with types like `"branch"`, `"labeledGroup"`
- Collections expect `AppNode` / `AppEdge` with types like `"branchNode"`, `"labeledGroupNode"`
- Types are similar but not identical

**Solution:**
**Unify types to use API types throughout.** Update collection types to match API:

1. **Update `flow-nodes.ts`** to use `NetworkNode` / `NetworkEdge` from `api-client.ts`
2. **Standardize on `"branch"`** (not `"branchNode"`) - we already know it's a node
3. **Remove type transformation layer** - API response goes directly into collections
4. **If different shapes needed:** Create separate serializer/endpoint for that shape

**Type Standardization:**

- `"branch"` (not `"branchNode"`)
- `"labeledGroup"` (not `"labeledGroupNode"`)
- `"geographicAnchor"` (not `"geographicAnchorNode"`)
- `"geographicWindow"` (not `"geographicWindowNode"`)

### 1.2 Update Collections to Use Unified Types

```typescript
// lib/collections/flow-nodes.ts
// Remove AppNode/AppEdge, use NetworkNode/NetworkEdge directly
import type { NetworkNode, NetworkEdge } from "@/lib/api-client";
import type { Node, Edge } from "@xyflow/react";

// Extend NetworkNode with ReactFlow properties
export type FlowNode = NetworkNode & Node;
export type FlowEdge = NetworkEdge & Edge;

// Update collections to use FlowNode/FlowEdge
export const nodesCollection = createCollection(
  localStorageCollectionOptions<FlowNode>({
    id: "flow:nodes",
    storageKey: "flow:nodes",
    getKey: (node) => node.id,
  })
);
```

### 1.3 Add ReactFlow Properties on Load

ReactFlow-specific properties (like `draggable`, `selectable`) should be added when loading from API, but these are **not** part of the core type - they're ReactFlow extensions:

```typescript
// lib/collections/flow.ts
export async function loadPresetFromApi(networkId: string): Promise<void> {
  // 1. Fetch from API
  const network = await getNetwork(networkId);

  // 2. Add ReactFlow properties (these don't go in TOML)
  const flowNodes: FlowNode[] = network.nodes.map((node) => ({
    ...node,
    // Add ReactFlow-specific properties
    draggable:
      node.type !== "geographicAnchor" && node.type !== "geographicWindow", // Will be true eventually
    selectable: true, // All nodes selectable
    connectable: node.type === "branch", // Only branches connectable
  }));

  // 3. Validate edges (only connect distinct branches)
  const validEdges = network.edges.filter((edge) => {
    const sourceNode = flowNodes.find((n) => n.id === edge.source);
    const targetNode = flowNodes.find((n) => n.id === edge.target);
    return (
      sourceNode?.type === "branch" &&
      targetNode?.type === "branch" &&
      edge.source !== edge.target // Distinct branches only
    );
  });

  // 4. Clear existing collections
  await clearFlowCollections();

  // 5. Insert new data
  await resetFlowToPreset({
    id: network.id,
    label: network.label,
    nodes: flowNodes,
    edges: validEdges,
  });
}
```

### 1.4 API Endpoint for Available Presets

**Backend:** Add endpoint to list available presets:

```rust
// backend/src/routes/network.ts
networkRoutes.get("/list", async (c) => {
  // Scan networks/ directory for available presets
  // Return: { presets: [{ id: "preset1", label: "Preset 1" }, ...] }
});
```

**Frontend:** Create collection/query for presets:

```typescript
// lib/api-client.ts
export async function getAvailablePresets(): Promise<
  Array<{ id: string; label: string }>
> {
  const client = getClient();
  const response = await client.api.network.list.$get();
  if (!response.ok) throw new Error("Failed to fetch presets");
  return (await response.json()) as Array<{ id: string; label: string }>;
}

export function presetsQueryOptions() {
  return {
    queryKey: ["presets"] as const,
    queryFn: () => getAvailablePresets(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  };
}
```

## Phase 2: ReactFlow Integration with Collections

### 2.1 Connect ReactFlow to Collections

**Current State:**

- `FlowNetwork` receives static `nodes` and `edges` props
- No interaction handlers

**Required Changes:**

```typescript
// components/flow/flow-network.tsx
import { useWatchMode } from "@/lib/file-system/watch-directory";

export function FlowNetwork() {
  // Read from collections (reactive)
  const nodes = useCollection(nodesCollection);
  const edges = useCollection(edgesCollection);

  // Watch mode state (disables editing when enabled)
  const { watchMode, nodesDraggable, nodesConnectable, elementsSelectable } =
    useWatchMode();

  // Handle ReactFlow changes (only if not in watch mode)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (watchMode.enabled) return; // Disable in watch mode
      // Apply changes to nodes array
      const updatedNodes = applyNodeChanges(changes, nodes);
      writeNodesToCollection(updatedNodes);
    },
    [nodes, watchMode.enabled]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (watchMode.enabled) return; // Disable in watch mode
      // Apply changes to edges array
      const updatedEdges = applyEdgeChanges(changes, edges);
      writeEdgesToCollection(updatedEdges);
    },
    [edges, watchMode.enabled]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (watchMode.enabled) return; // Disable in watch mode

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

      // Create new edge with default weight of 1
      const newEdge: FlowEdge = {
        id: `${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        data: { weight: 1 },
      };
      edgesCollection.insert(newEdge);
    },
    [nodes, watchMode.enabled]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
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
  );
}
```

### 2.2 Add Node Handles for Edge Creation

Update node components to include ReactFlow handles:

```typescript
// components/flow/nodes/branch.tsx
import { Handle, Position } from "@xyflow/react";

export function BranchNode({ data }: NodeProps) {
  return (
    <div className="...">
      <Handle type="target" position={Position.Left} />
      {/* node content */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

### 2.3 ReactFlow-Specific Properties

Add properties based on node type:

- **Geographic nodes:** `draggable: true`, `selectable: true` (will be editable)
  - **Anchor node (`geographicAnchor`):** Used to position world coordinates (lat/long) on XY plane
    - Dragging the anchor repositions the world coordinate system
  - **Window node (`geographicWindow`):** XY window relative to anchor
    - Position is relative to the anchor's world coordinates
- **Group nodes (`labeledGroup`):** `draggable: true`, `selectable: true`
- **Branch nodes (`branch`):** `draggable: true`, `selectable: true`, `connectable: true`
  - Only branch nodes can have edges (connections)

**Important:** These ReactFlow UI properties are added when loading from API but **not stored in TOML** (they're UI state, not data model).

### 2.4 Edge Validation

**Rule:** Edges can only connect two distinct branches.

```typescript
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

    // Create new edge
    const newEdge: FlowEdge = {
      id: `${connection.source}-${connection.target}`,
      source: connection.source!,
      target: connection.target!,
      data: { weight: 1 },
    };
    edgesCollection.insert(newEdge);
  },
  [nodes]
);
```

**Default Weight:** New edges created via `onConnect` always have `weight: 1`.

**Note:**

- When loading from API/files, validate edges and filter out invalid ones (see 1.3)
- ReactFlow prevents self-loops by default, but we explicitly check to be safe
- Invalid edges from API/files are silently filtered (could show warning in dev mode)

## Phase 3: Preset Management UI

### 3.1 Preset Selection

Add UI to:

1. **Start Fresh:** Clear collections, show empty canvas
2. **Load from API:** Show list of available presets, load selected one
3. **Load from file:** Use a previously saved project: load file(s) into state or perhaps give the option to work locally with the file system access api file watching. can be considered later.

We also need to export to file(s) but again that can come later. if we're doing toml then we probably create all the files and download as a zip

```typescript
// components/preset-selector.tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { presetsQueryOptions } from "@/lib/api-client";

export function PresetSelector() {
  const { data: presets } = useSuspenseQuery(presetsQueryOptions());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Load Preset</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => clearFlowCollections()}>
          Start Fresh
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onClick={() => loadPresetFromApi(preset.id)}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 3.2 State Management

After loading a preset:

- Collections become the source of truth
- API is only used for initial load
- All changes persist to localStorage automatically (via tanstack-db)

## Phase 4: TOML Persistence (Future)

### 4.1 TOML Serialization Strategy

**Challenge:** Convert FlowNode/FlowEdge back to TOML format

**Key Considerations:**

1. **Filter ReactFlow properties:** Don't serialize `draggable`, `selectable`, `selected`, `zIndex`, etc. - these are UI state
2. **Node IDs = filenames:** Use `${node.id}.toml` as filename
3. **Edges → outgoing arrays:** Edges are stored in branch `outgoing` arrays, not as separate edge objects
4. **Preserve extra properties:** Keep any extra properties from TOML that are in the node's `data.extra` or similar, but exclude ReactFlow UI properties

**Approach:**

1. **Filter ReactFlow UI properties** before serialization
2. **Convert edges to outgoing arrays:** For each branch, collect all edges where it's the source, create `outgoing` array
3. **Serialize nodes:** Each node becomes a TOML file named by its ID
4. **Handle extra properties:** Include any custom properties from `data` that aren't ReactFlow-specific

**Library:** Use `@iarna/toml` or similar for TOML serialization

```typescript
// lib/utils/filter-reactflow-props.ts

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
  // Add other ReactFlow-specific properties as needed
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
 */
export function toNetworkNode(node: FlowNode): NetworkNode {
  return filterReactFlowProperties(node) as NetworkNode;
}
```

```typescript
// lib/exporters/toml-exporter.ts
import { toNetworkNode } from "@/lib/utils/filter-reactflow-props";

export async function exportNetworkToToml(
  nodes: FlowNode[],
  edges: FlowEdge[]
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  // Build outgoing arrays for branches from edges
  const edgesBySource = new Map<string, FlowEdge[]>();
  edges.forEach((edge) => {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);
  });

  // Serialize each node to TOML
  nodes.forEach((node) => {
    // Filter out ReactFlow UI properties
    const nodeForToml = toNetworkNode(node);

    // For branches, add outgoing array from edges
    // Always include outgoing array (empty array if no edges)
    if (nodeForToml.type === "branch") {
      const outgoing =
        edgesBySource.get(node.id)?.map((edge) => ({
          target: edge.target,
          weight: edge.data.weight,
        })) || [];
      // Always set outgoing, even if empty array
      nodeForToml.outgoing = outgoing;
    }

    // Serialize to TOML (use backend or client-side parser)
    files[`${node.id}.toml`] = serializeNodeToToml(nodeForToml);
  });

  return files;
}
```

### 4.2 File System Access API Integration

**Use Cases:**

1. **Watch Mode (Toggle):** User selects a directory, app watches TOML files for changes
   - **When enabled:** Browser edits are **disabled** - users must edit files directly
   - **When disabled:** Normal browser editing mode
2. **One-way file watching (Phase 4a):** Files → Browser only
   - User edits TOML files directly, app auto-updates
   - Browser changes are not written back to files
3. **Export to files (Phase 4b):** Browser → Files as separate action
   - User clicks "Export" to write current state to watched files
   - Or download as ZIP if not in watch mode

**Implementation:**

```typescript
// lib/file-system/watch-directory.ts
export type WatchModeState = {
  enabled: boolean;
  directoryHandle: FileSystemDirectoryHandle | null;
  isWatching: boolean;
};

export async function watchTomlDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  onFilesChanged: (files: Record<string, string>) => void
) {
  // Use File System Access API to watch for changes
  // Auto-update when files change (no manual refresh needed)
  // Implementation approach:
  // 1. Use FileSystemHandle.watch() or polling
  // 2. On file change, read all TOML files
  // 3. Send to backend for parsing: POST /api/network/parse-toml
  // 4. Update collections with parsed network
  // 5. Handle errors gracefully:
  //    - Incomplete TOML (missing required fields) → show warnings, use defaults
  //    - Invalid TOML syntax → show error, don't crash
  //    - Missing files → treat as deleted nodes/edges, remove from collections
}

// Hook to manage watch mode and disable ReactFlow editing when enabled
export function useWatchMode() {
  const [watchMode, setWatchMode] = useState<WatchModeState>({
    enabled: false,
    directoryHandle: null,
    isWatching: false,
  });

  // When watch mode enabled, disable ReactFlow editing
  const nodesDraggable = !watchMode.enabled;
  const nodesConnectable = !watchMode.enabled;
  const elementsSelectable = !watchMode.enabled;

  return {
    watchMode,
    setWatchMode,
    nodesDraggable,
    nodesConnectable,
    elementsSelectable,
  };
}
```

**Error Handling:**

- **Incomplete TOML:** Show warnings, use defaults where possible
- **Invalid Syntax:** Show error, don't crash, allow user to fix
- **Missing Files:** Treat as deleted nodes/edges, remove from collections

### 4.3 TOML Parsing Robustness

**Current State:** Backend uses Rust to parse TOML (robust)

**Frontend Options:**

1. **Use Backend:** Send TOML to backend for parsing (recommended)
2. **Client-side Parser:** Use JavaScript TOML parser (less robust)

**Recommendation:** Use backend API endpoint:

```typescript
POST / api / network / parse - toml;
Body: {
  files: Record<string, string>;
}
Response: NetworkResponse;
```

This ensures consistent parsing logic.

## Phase 5: Error Handling & Edge Cases

### 5.1 Incomplete TOML Handling

**Strategy:**

1. **Validation Layer:** Validate parsed TOML before updating collections
2. **Partial Updates:** Only update valid nodes/edges
3. **Error Reporting:** Show which files/nodes have issues
4. **Recovery:** Allow user to fix and retry

```typescript
// lib/validators/toml-validator.ts
export function validateTomlNetwork(
  network: NetworkResponse
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for required fields
  network.nodes.forEach((node) => {
    if (!node.id) errors.push({ node, field: "id", message: "Missing id" });
    if (!node.position)
      warnings.push({
        node,
        field: "position",
        message: "Using default position",
      });
  });

  return { errors, warnings, isValid: errors.length === 0 };
}
```

### 5.2 Collection State Recovery

**If localStorage is corrupted:**

- Detect on load
- Offer to clear and reload from preset
- Log error for debugging

## Implementation Order

### Phase 1 (Foundation)

1. ✅ Unify types: Update `flow-nodes.ts` to use `NetworkNode`/`NetworkEdge` from `api-client.ts`
2. ✅ Standardize node types: Use `"branch"` (not `"branchNode"`) throughout
3. ✅ Add API endpoint: `GET /api/network/list` for available presets
4. ✅ Update `loadPresetFromApi` to add ReactFlow properties and validate edges
5. ✅ Test preset loading overwrites collections

### Phase 2 (Interactivity)

1. ✅ Connect ReactFlow to collections (useCollection hooks)
2. ✅ Add `onNodesChange`, `onEdgesChange`, `onConnect` handlers
3. ✅ Add handles to node components
4. ✅ Test dragging, edge creation

### Phase 3 (UX)

1. ✅ Add preset selector UI
2. ✅ Add "Start Fresh" option
3. ✅ Show current preset/state indicator

### Phase 4 (Persistence - Future)

**Phase 4a: One-way File Watching**

1. ⏳ File System Access API integration
2. ⏳ Watch mode toggle (disables browser edits when enabled)
3. ⏳ Auto-update from file changes
4. ⏳ Robust error handling

**Phase 4b: Export to Files**

1. ⏳ TOML export functionality
2. ⏳ Filter ReactFlow UI properties utility (`filter-reactflow-props.ts`)
3. ⏳ Convert edges to branch outgoing arrays (always include, empty array if none)
4. ⏳ Export to watched directory or download as ZIP

**Phase 4b: Export to Files**

1. ⏳ TOML export functionality
2. ⏳ Filter ReactFlow UI properties utility
3. ⏳ Convert edges to branch outgoing arrays (empty array if none)
4. ⏳ Export to watched directory or download as ZIP

## Questions & Considerations

### Q4: How to handle edge creation validation?

**A:** ReactFlow handles basic validation. Add custom validation in `onConnect`:

- **Only connect distinct branches:** Both source and target must be `type === "branch"`
- **No self-loops:** `connection.source !== connection.target`
- **Set default edge properties:** `weight: 1` (or prompt user for weight)
- **Validate on load:** When loading from API/files, filter out invalid edges

### Q5: File System Access API browser support?

**A:** Chrome/Edge only. Need fallback:

Only the browsers that support it can use the feature. We will provide regular file based import/export too.

### Q6: Should we sync collections with API in real-time?

**A:** No. After initial load, collections are source of truth. API is read-only for presets.

### Q7: How to handle concurrent edits (if multiple tabs)?

**A:** localStorage is shared. Consider:

- Add timestamp/last-modified tracking
- Warn user if another tab modified data
- Or use broadcast channel API for cross-tab sync

I don't know that it's possible for the tabs to be out of sync though.

## Recommended Next Steps

1. **Start with Phase 1:** Unify types and test preset loading
2. **Then Phase 2:** Get ReactFlow interactions working
3. **Then Phase 3:** Polish UX with preset selector
4. **Phase 4 later:** TOML persistence when needed

This incremental approach lets you validate each piece before moving forward.
