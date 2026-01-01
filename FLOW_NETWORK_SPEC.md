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

### Local-First Architecture (Like OpenCode)

**Key Insight:** This is a local development tool, not a remote service. The server runs locally and reads from the client's file system.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User's Local Machine                        │
│                                                                     │
│  ┌──────────────┐         ┌──────────────────────┐                  │
│  │   Browser    │         │   Local Server       │                  │
│  │  (Frontend)  │◄────────┤  (Bun + Hono)        │                  │
│  │              │  HTTP   │  - Schema endpoints  │                  │
│  │  ReactFlow   │         │  - Validation        │                  │
│  │  Collections │         │  - TOML parsing      │                  │
│  │              │         │  - Network loading   │                  │
│  └──────┬───────┘         └───────────┬──────────┘                  │
│         │                             │                             │
│         │ File System Access API      │ File System                 │
│         │ (read/write)                │ (read)                      │
│         ▼                             ▼                             │
│  ┌──────────────────────────────────────────────┐                   │
│  │         User's Local File System             │                   │
│  │  networks/preset1/                           │                   │
│  │    ├── branch-1.toml                         │                   │
│  │    ├── branch-15.toml  ← Created in browser  │                   │
│  │    ├── group-1.toml                          │                   │
│  │    └── config.toml                           │                   │
│  └──────────────────────────────────────────────┘                   │
│                                                                     │
│                                                                     │
│         ┌──────────────────────────────────────┐                    │
│         │   External Operations Servers        │                    │
│         │  (Separate services, not spawned)    │                    │
│         │  - Costing server                    │                    │
│         │  - Modelling server                  │                    │
│         │  - Other operation servers           │                    │
│         │                                      │                    │
│         │  Receives: Network + Schema          │                    │
│         │  Returns: Operation results          │                    │
│         └──────────────────────────────────────┘                    │
│                    ▲                                                │
│                    │ HTTP/WebSocket                                 │
│                    │ (Local server proxies requests)                │
│         ┌──────────┴───────────┐                                     │
│         │   Local Server       │                                    │
│         │  (proxies to external│                                    │
│         │   operations servers)│                                    │
│         └──────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Architecture Notes:**

- **Local Server:** Handles file I/O, schema/validation, network parsing (lightweight)
- **Operations Servers:** External services that handle heavy computations (costing, modelling)
  - **Not spawned by Tauri** - they are separate external services
  - Local server makes HTTP requests to external operations servers
  - Can be deployed independently, scaled separately
- **Separation of Concerns:** File operations vs. computation operations
- **Similar to OpenCode:** Local server communicates with external services (like AI providers)

### Data Flow

**Initial Load:**

```
┌─────────────────┐
│  Local Server   │ (reads from user's file system)
│  /api/network   │
└────────┬────────┘
         │
         │ NetworkResponse
         ▼
┌─────────────────┐
│  Collections    │ (tanstack-db, localStorage)
│  (NetworkNode/  │
│   NetworkEdge)  │
└────────┬────────┘
         │
         │ ReactFlow sync
         ▼
┌──────────────────┐
│   ReactFlow      │ (UI interactions)
│   (onNodesChange │
│    onEdgesChange)│
└────────┬─────────┘
         │
         │ writeNodesToCollection()
         │ writeEdgesToCollection()
         ▼
┌─────────────────┐
│  Collections    │ (persisted to localStorage)
└────────┬────────┘
         │
         │ User edits in browser
         │ (creates branch-15, etc.)
         ▼
┌─────────────────┐
│  File System    │ (via File System Access API)
│  Access API     │ (write branch-15.toml)
└────────┬────────┘
         │
         │ Local server can now read branch-15.toml
         │ for schema/validation endpoints
         ▼
┌─────────────────┐
│  Local Server   │ (reads updated files)
│  /api/schema    │ (includes branch-15)
│  /api/validate  │
└─────────────────┘
```

**Key Points:**

1. **Local Server:** Runs on user's machine (Bun + Hono), reads from user's file system
2. **File System Access API:** Browser can read/write to user's local files
3. **Schema/Validation:** Local server reads from user's files, so it sees all nodes (including browser-created ones)
4. **Two-way sync:** Browser ↔ Local Files ↔ Local Server

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

I think a dialog will probably be better than a dropdown though.

### 3.2 State Management

After loading a preset:

- Collections become the source of truth
- API is only used for initial load
- All changes persist to localStorage automatically (via tanstack-db)

## Phase 4: Local File System Integration

### 4.1 The Network Mutability Problem

**Problem Statement:**

- **Network is mutable in browser** (localStorage collections)
- **User creates new nodes** (e.g., branch-15) in browser
- **Server file system doesn't have branch-15.toml** (it's only in localStorage)
- **Schema/validation endpoints read from server file system** → branch-15 is omitted
- **Result:** Can't validate or get schemas for browser-created nodes

**Solution: Local-First Architecture**

The tool runs a **local server** (like OpenCode) that:

- Reads from the **user's local file system** (not a remote server)
- Browser writes changes to **user's local files** via File System Access API
- Local server can then read those files for schema/validation
- Everything stays on the user's machine

### 4.2 Architecture Requirements

**Local Server:**

- Runs on user's machine (Bun + Hono)
- Reads from user's file system (not a remote backend)
- Provides schema/validation endpoints that read local files
- Watches local files for changes

**Browser Integration:**

- Uses File System Access API to read/write local files
- When user creates branch-15 in browser:
  1. Write to localStorage (immediate)
  2. Write branch-15.toml to user's file system (via File System Access API)
  3. Local server can now read branch-15.toml for schema/validation

**File System Access:**

- User grants permission to read/write a directory
- Browser can create/update/delete TOML files directly
- Local server reads from same directory

### 4.3 TOML Serialization Strategy

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

### 4.4 File System Access API Integration

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

### 4.5 TOML Parsing Robustness

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

### 4.8 Error Handling & Edge Cases

**Incomplete TOML Handling:**

- **Strategy:** Validate parsed TOML before updating collections
- **Partial Updates:** Only update valid nodes/edges
- **Error Reporting:** Show which files/nodes have issues
- **Recovery:** Allow user to fix and retry

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

**Collection State Recovery:**

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

1. ✅ Connect ReactFlow to collections (useLiveQuery hooks)
2. ✅ Add `onNodesChange`, `onEdgesChange`, `onConnect` handlers
3. ✅ Add handles to node components
4. ✅ Test dragging, edge creation
5. ✅ Fix parent-child node movement (sorting on read)

### Phase 3 (UX)

1. ⏳ Add preset selector UI (API endpoint exists, UI not implemented)
2. ⏳ Add "Start Fresh" option
3. ⏳ Show current preset/state indicator

### Phase 4 (Local File System Integration - Critical)

**4.1-4.2: Core File System Setup (Critical - Required for schema/validation)**

1. ⏳ Set up File System Access API integration
2. ⏳ Implement writeNodeToFile() - write browser changes to local files
3. ⏳ Update local server to read from user's file system (not remote)
4. ⏳ Sync browser changes to files immediately (or on save)
5. ⏳ Ensure schema/validation endpoints read from local files (includes browser-created nodes)
6. ⏳ Test: Create branch-15 in browser → verify it appears in schema endpoints

**4.3-4.5: TOML Serialization & Export**

1. ⏳ TOML export functionality
2. ⏳ Filter ReactFlow UI properties utility (`filter-reactflow-props.ts`)
3. ⏳ Convert edges to branch outgoing arrays (always include, empty array if none)
4. ⏳ Export to watched directory or download as ZIP

**4.4-4.5: File Watching & Watch Mode**

1. ⏳ File watching (one-way: files → browser)
2. ⏳ Watch mode toggle (disables browser edits when enabled)
3. ⏳ Auto-update from file changes
4. ⏳ Robust error handling

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

### Q8: How to handle network mutability with schema/validation?

**A:** See Phase 4 above. The solution is local-first architecture:

- **Local server** reads from user's file system (not remote backend)
- **Browser writes changes** to user's files via File System Access API
- **Local server** can then read those files for schema/validation
- **Result:** Browser-created nodes (like branch-15) are in file system, so schema endpoints include them

**Key insight:** This is a local development tool (like OpenCode), not a remote service. Everything runs on the user's machine.

### Q9: How do schemas relate to networks?

**A:** Networks are **independent of schemas**. The architecture is:

- **Network description:** TOML files describing nodes, edges, properties (schema-agnostic)
- **Schema registry:** Versioned schemas (v1.0, v1.0-costing, etc.) for different operations
- **Schema application:** Schemas are applied to networks when needed:
  - **Costing operation:** Apply costing schema to check if network has required properties
  - **Modelling operation:** Apply modelling schema to check if network has required properties
  - Networks don't "belong to" a schema - schemas are tools for validation/operations

### Q10: How does the operations server fit into the architecture?

**A:** Similar to OpenCode's provider pattern:

- **Local Server:** Handles file I/O, schema/validation, network parsing (lightweight, always running)
- **Operations Server:** Handles heavy computations (costing, modelling, evaluations)
  - Can be a separate process/service
  - Receives: Network data + Schema to apply
  - Returns: Operation results
  - Local server proxies requests to operations server
- **Benefits:**
  - Separation of concerns (file ops vs. computation)
  - Operations server can be scaled/optimized independently
  - Operations server can use different tech stack if needed
  - Similar pattern to OpenCode's AI provider communication

## Recommended Next Steps

**Priority Order:**

1. **Tauri Distribution (Early Priority):** Set up Tauri distribution first

   - This affects how we implement file system access (native vs browser API)
   - Better to build with Tauri in mind from the start
   - See [TAURI_DISTRIBUTION_PLAN.md](./TAURI_DISTRIBUTION_PLAN.md)
   - **Note:** Operations servers are **external** - local server makes HTTP requests to them

2. **Complete Phase 3:** Add preset selector UI (dialog, not dropdown)

3. **Implement Phase 4 (Critical):** Local file system integration
   - This is required for schema/validation to work with browser-created nodes
   - Without this, browser-created nodes won't appear in schema endpoints
   - Start with 4.1-4.2 (core file system setup), then 4.3-4.5 (export/watching)
   - **With Tauri:** Use native file system APIs instead of File System Access API

**Why Tauri First:**

- Architecture decisions (native file system vs browser API) affect Phase 4 implementation
- Better to build with distribution in mind from the start
- File system access patterns differ between Tauri and browser-only
- Avoids retrofitting later
