# Costing Server Integration Plan

> **Status:** Planning
> **Created:** January 2026
> **Costing Server:** `http://localhost:8080` (when running locally)

## Overview

This document outlines the integration between Dagger and an external costing server. The local server acts as an **adapter/gateway** that transforms our network format into the costing server's expected format, and transforms responses back.

## Concept Mapping

| Dagger Concept | Costing Server Concept | Notes |
|----------------|----------------------|-------|
| **Network** | **Cluster** | The whole network; contains multiple assets |
| **Group** | **Asset** (named) | A named set of branches with shared timeline/factors |
| **Branch** (ungrouped) | **Asset** (unnamed) | Standalone branch becomes its own asset with defaults |
| **Block** | **Module / CostItem** | Atomic component. Maps to cost library module |
| **Block type** | **definition.type** | e.g., `type = "CaptureUnit"` in both (with normalization) |

### Key Insights

1. Groups → Named Assets

- Groups with a `costing` section become named assets
- All blocks from branches within the group are collected into one asset
- Asset-level properties (timeline, factors) come from the group

2. Ungrouped Branches → Unnamed Assets

- Branches not in a group become standalone assets
- Use default timeline/factors (shown in results as "using defaults")
- Each ungrouped branch = one asset

3. Block Type Mapping

**UX Decision:** Dagger uses **human-readable format** for block types (natural language with spaces). The adapter normalizes internally to match cost library format.

```toml
# Dagger block (user-facing - natural language)
[[block]]
type = "Capture Unit"
type = "Pipe"
type = "Compressor"
```

```json
// Cost library module (internal format - camelCase)
"definition": { "type": "CaptureUnit", ... }
```

The adapter normalizes user input to match cost library:

```typescript
// backend/src/services/costing/type-normalization.ts

/**
 * Normalize user-friendly block types to cost library format.
 * Users write natural language; adapter handles translation.
 */
export function normalizeBlockType(userType: string): string {
  // Remove spaces, capitalize each word
  return userType
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

// Examples:
// "Capture Unit" → "CaptureUnit"
// "capture unit" → "CaptureUnit"
// "CAPTURE_UNIT" → "CaptureUnit"
// "Pipe" → "Pipe" (already normalized)
```

**Why this approach:**

- Engineers shouldn't have to think about camelCase conventions
- Natural language is more readable in TOML files
- Adapter handles all translation internally
- Same user-facing format works for all operations (costing, modelling, etc.)

**4. Cluster = Network**
The costing tool's "Cluster" concept maps to our "Network". A cluster contains multiple assets, and we report costs at cluster/asset/module levels.

---

## Costing Server Data Structures

### CostEstimateRequest (Input)

```rust
pub struct CostEstimateRequest {
    pub assets: Vec<AssetParameters>,
}

pub struct AssetParameters {
    pub id: String,
    pub timeline: Timeline,
    pub labour_average_salary: CostParameter,
    pub fte_personnel: f64,
    pub asset_uptime: f64,
    pub capex_lang_factors: CapexLangFactors,
    pub opex_factors: FixedOpexFactors,
    pub cost_items: Vec<CostItemParameters>,
    pub discount_rate: f64,
}

pub struct CostItemParameters {
    pub id: String,                    // Unique ID for this instance
    pub cost_item_ref: String,         // Reference to cost library module (e.g., "M0201")
    pub quantity: u32,                 // How many of this item
    pub parameters: HashMap<String, f64>, // Parameter values for scaling
}

pub struct Timeline {
    pub construction_start: Year,
    pub construction_finish: Year,
    pub operation_start: Year,
    pub operation_finish: Year,
    pub decommissioning_start: Year,
    pub decommissioning_finish: Year,
}
```

### Cost Library Modules

The cost library defines available modules with their:
- **id**: Module reference (e.g., "M0201")
- **definition**: Type info (e.g., `{ type: "CaptureUnit", capture_unit_type: "Amine" }`)
- **subtype**: Human-readable subtype
- **cost_items**: Cost data with scaling factors

Example module from `V1.1_working/cost-library.json`:
```json
{
  "id": "M0201",
  "definition": {
    "type": "CaptureUnit",
    "capture_unit_type": "Amine"
  },
  "subtype": "Amine",
  "cost_items": [
    {
      "id": "Item 023",
      "scaling_factors": [
        { "name": "Mass flow", "units": "kg/h", "source_value": 342465.7534246575 }
      ],
      "capex_contribution": { ... }
    }
  ]
}
```

### Default Values (from existing costing tool)

When groups don't specify asset properties, or for ungrouped branches, we use these defaults:

```typescript
// backend/src/services/costing-defaults.ts

export const DEFAULT_TIMELINE: Timeline = {
  construction_start: 2025,
  construction_finish: 2026,
  operation_start: 2027,
  operation_finish: 2046,
  decommissioning_start: 2047,
  decommissioning_finish: 2047,
};

export const DEFAULT_LABOUR_AVERAGE_SALARY: CostParameter = {
  currency_code: "USD",
  amount: 55000,
};

export const DEFAULT_FTE_PERSONNEL = 5;
export const DEFAULT_ASSET_UPTIME = 0.95;
export const DEFAULT_DISCOUNT_RATE = 0.1;

export const DEFAULT_CAPEX_LANG_FACTORS: CapexLangFactors = {
  equipment_erection: 0.4,
  piping: 0.7,
  instrumentation: 0.2,
  electrical: 0.1,
  buildings_and_process: 0.15,
  utilities: 0.5,
  storages: 0.15,
  site_development: 0.05,
  ancillary_buildings: 0.15,
  design_and_engineering: 0.3,
  contractors_fee: 0.05,
  contingency: 1.0,
};

export const DEFAULT_OPEX_FACTORS: FixedOpexFactors = {
  maintenance: 0.08,
  control_room_facilities: 0.0,
  insurance_liability: 0.0,
  insurance_equipment_loss: 0.0,
  cost_of_capital: 0.0,
  major_turnarounds: 0.0,
};
```

**Usage:**
- Named assets (groups with `costing` section): Use group properties, fall back to defaults for missing fields
- Unnamed assets (ungrouped branches): Use all defaults, flag as "using defaults" in results

---

## Dagger Schema Requirements

To make a costing request, we need properties at different scope levels:

### Group-Level Properties (Asset Properties)

These properties are defined on the **Group** and apply to the whole asset:

```toml
# group-capture-plant.toml
type = "labeledGroup"
label = "Capture Plant"

# Asset properties for costing
[costing]
timeline.construction_start = 2025
timeline.construction_finish = 2027
timeline.operation_start = 2028
timeline.operation_finish = 2053
timeline.decommissioning_start = 2054
timeline.decommissioning_finish = 2056

labour_average_salary = "75000 USD"
fte_personnel = 50
asset_uptime = 0.9
discount_rate = 0.08

# Optional: Override default factors
# capex_lang_factors.contingency = 0.15
# opex_factors.maintenance = 0.06
```

### Block-Level Properties (Cost Item Properties)

These properties are defined on **Blocks** within branches:

```toml
# branch-1.toml
type = "branch"
label = "Main Capture"
parentId = "group-capture-plant"

[[block]]
type = "CaptureUnit"
subtype = "Amine"
quantity = 1

# Parameters for cost scaling
mass_flow = "342000 kg/h"  # Will be converted to f64 in kg/h
```

### Block Type → Module ID Mapping

We need a mapping from Dagger block types to costing module IDs:

| Block Type | Block Subtype | Module ID | Required Parameters |
|------------|--------------|-----------|---------------------|
| `CaptureUnit` | `Amine` | `M0201` | `mass_flow` (kg/h) |
| `CaptureUnit` | `InorganicSolvents` | `M0202` | `mass_flow` (kg/h) |
| `Emitter` | `Cement` | `M0101` | `mass_flowrate` (kg/h) |
| `Emitter` | `Steel` | `M0102` | `mass_flowrate` (kg/h) |
| ... | ... | ... | ... |

This mapping can be:
1. **Generated from cost library** - parse the library and build the mapping
2. **Defined in a schema file** - explicit mapping maintained by us
3. **Hybrid** - schema defines what we support, validated against library

---

## Adapter Implementation

### Transformation: Network → CostEstimateRequest

```typescript
// backend/src/services/costing-adapter.ts

interface TransformOptions {
  libraryId: string;
  targetCurrency?: string;
}

async function transformNetworkToCostingRequest(
  network: NetworkResponse,
  options: TransformOptions
): Promise<CostEstimateRequest> {
  
  // 1. Find all Groups that are marked as assets (or all groups by default)
  const assetGroups = network.nodes.filter(
    n => n.type === "labeledGroup" && n.data?.costing
  );
  
  // 2. For each asset group, build AssetParameters
  const assets = assetGroups.map(group => {
    // Find all branches in this group
    const branches = network.nodes.filter(
      n => n.type === "branch" && n.parentId === group.id
    );
    
    // Collect all blocks from these branches
    const costItems = branches.flatMap(branch => 
      transformBlocksToCostItems(branch.data.blocks, libraryMapping)
    );
    
    return {
      id: group.id,
      timeline: extractTimeline(group.data.costing.timeline),
      labour_average_salary: extractCostParameter(group.data.costing.labour_average_salary),
      fte_personnel: group.data.costing.fte_personnel,
      asset_uptime: group.data.costing.asset_uptime,
      capex_lang_factors: group.data.costing.capex_lang_factors ?? DEFAULT_CAPEX_FACTORS,
      opex_factors: group.data.costing.opex_factors ?? DEFAULT_OPEX_FACTORS,
      cost_items: costItems,
      discount_rate: group.data.costing.discount_rate,
    };
  });
  
  return { assets };
}

function transformBlocksToCostItems(
  blocks: Block[],
  libraryMapping: ModuleMapping,
  schemaRegistry: SchemaRegistry
): CostItemParameters[] {
  return blocks.map(block => {
    // Look up module ID from block type + subtype
    const moduleId = libraryMapping.getModuleId(block.type, block.subtype);
    
    // Get schema for this block type to know target units
    const schema = schemaRegistry.getSchema("v1.0-costing", block.type);
    
    // Extract parameters and convert units using dim
    // Schema annotations tell us the target unit (e.g., "kg/h")
    // dim converts from user's unit (e.g., "100 t/h") to target unit (100000 kg/h)
    const parameters = extractAndConvertParameters(block, schema);
    
    return {
      id: block.id ?? generateBlockId(),
      cost_item_ref: moduleId,
      quantity: block.quantity ?? 1,
      parameters,
    };
  });
}

function extractAndConvertParameters(
  block: Block,
  schema: Schema
): Record<string, number> {
  const parameters: Record<string, number> = {};
  
  // For each parameter field in the schema
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    const annotation = getAnnotation(fieldSchema);
    if (annotation?.dimension && block[fieldName]) {
      // Use dim to parse and convert to target unit
      const converted = dim.convert(block[fieldName], annotation.defaultUnit);
      parameters[fieldName] = converted;
    }
  }
  
  return parameters;
}
```

### Transformation: CostEstimateResponse → NetworkCostingResult

Based on the existing costing tool's report structure (ClusterCostReport, AssetCostReport, ModuleCostReport):

```typescript
// Result structure matching existing costing tool patterns

interface NetworkCostingResult {
  // Network-level (Cluster)
  networkId: string;
  networkName?: string;
  currency: string;
  
  // Lifetime costs (undiscounted)
  lifetimeCosts: LifetimeCosts;
  
  // Lifetime NPC (discounted - Net Present Cost)
  lifetimeDcfCosts: LifetimeCosts;
  
  // Asset-level results (one per group or ungrouped branch)
  assetCostReports: AssetCostReport[];
  
  // Track which assets used defaults
  assetsUsingDefaults: string[];  // asset IDs
}

interface AssetCostReport {
  id: string;           // group ID or branch ID
  name?: string;        // group/branch label
  isUsingDefaults: boolean;
  
  lifetimeCosts: LifetimeCosts;
  lifetimeDcfCosts: LifetimeCosts;
  
  // Module-level results (one per block)
  moduleCostReports: ModuleCostReport[];
}

interface ModuleCostReport {
  id: string;           // block ID
  blockType: string;    // e.g., "CaptureUnit"
  moduleRef: string;    // e.g., "M0201"
  quantity: number;
  
  // Cost breakdown for this block
  directEquipmentCost: number;
  langFactoredCapitalCost: LangFactoredCosts;
  totalInstalledCost: number;
  fixedOpexCost: FixedOpexCosts;
  variableOpexCost: VariableOpexCosts;
}

interface LifetimeCosts {
  direct_equipment_cost: number;
  lang_factored_capital_cost: LangFactoredCosts;
  total_installed_cost: number;
  fixed_opex_cost: FixedOpexCosts;
  variable_opex_cost: VariableOpexCosts;
  decommissioning_cost: number;
}

interface LangFactoredCosts {
  equipment_erection: number;
  piping: number;
  instrumentation: number;
  electrical: number;
  buildings_and_process: number;
  utilities: number;
  storages: number;
  site_development: number;
  ancillary_buildings: number;
  design_and_engineering: number;
  contractors_fee: number;
  contingency: number;
}
```

```typescript
function transformCostingResponseToNetwork(
  response: CostEstimateResponse,
  originalNetwork: NetworkResponse,
  assetsUsingDefaults: string[]
): NetworkCostingResult {
  // Map costs back to our network structure
  // - Aggregate by asset (group or ungrouped branch)
  // - Aggregate by block (module)
  // - Track which used defaults
  // - Provide network-level totals
}
```

### Excel Export

Use ExcelJS to generate Excel workbooks (matching existing costing tool pattern):

```typescript
// backend/src/services/excel-export.ts
import * as ExcelJS from "exceljs";

export async function createCostingWorkbook(
  result: NetworkCostingResult
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet("Network Summary");
  summarySheet.addRow(["Network Costs"]);
  summarySheet.addRow(["Network ID", result.networkId]);
  summarySheet.addRow(["Currency", result.currency]);
  // ... add cost rows
  
  // Per-asset sheets
  for (const asset of result.assetCostReports) {
    const assetSheet = workbook.addWorksheet(asset.name ?? asset.id);
    // ... add asset-specific data
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
```
```

---

## API Design

### Local Server Endpoints

```typescript
// Operations endpoints
POST /api/operations/costing/estimate
  Body: { 
    networkPath: string,           // Path to network files
    libraryId: string,             // "V1.1_working", "V2.0", etc.
    targetCurrency?: string        // "USD", "EUR", etc.
  }
  Response: NetworkCostingResult

GET /api/operations/costing/libraries
  Response: { libraries: [{ id: string, name: string }] }

GET /api/operations/costing/libraries/:id/modules
  Response: { modules: ModuleInfo[] }

// Readiness check
POST /api/operations/costing/validate
  Body: { networkPath: string, libraryId: string }
  Response: {
    ready: boolean,
    missingProperties: ValidationError[],
    warnings: ValidationWarning[]
  }
```

### Schema for Costing Operation

We use **Effect Schema** (not Zod) to match the existing codebase patterns. Schemas include dimension annotations for automatic unit conversion via `dim`.

```typescript
// backend/src/schemas/v1.0-costing/

import { Schema } from "effect";

// Timeline schema
export const TimelineSchema = Schema.Struct({
  construction_start: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ title: "Construction start year" })
  ),
  construction_finish: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ title: "Construction finish year" })
  ),
  operation_start: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ title: "Operation start year" })
  ),
  operation_finish: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ title: "Operation finish year" })
  ),
  decommissioning_start: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ title: "Decommissioning start year" })
  ),
  decommissioning_finish: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ title: "Decommissioning finish year" })
  ),
});

// Group schema for asset properties
export const CostingGroupSchema = Schema.Struct({
  costing: Schema.Struct({
    timeline: TimelineSchema,
    
    labour_average_salary: Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "currency",
        defaultUnit: "USD",
        title: "Labour average salary",
      })
    ),
    
    fte_personnel: Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({ title: "FTE Personnel" })
    ),
    
    asset_uptime: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1),
      Schema.annotations({ title: "Asset uptime (0-1)" })
    ),
    
    discount_rate: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1),
      Schema.annotations({ title: "Discount rate (0-1)" })
    ),
    
    // Optional factor overrides
    capex_lang_factors: Schema.optional(CapexLangFactorsSchema),
    opex_factors: Schema.optional(FixedOpexFactorsSchema),
  }),
});

// Block schema example - CaptureUnit
export const CaptureUnitSchema = Schema.Struct({
  type: Schema.Literal("CaptureUnit"),
  subtype: Schema.Literal("Amine", "InorganicSolvents", "Membrane", "Cryogenic"),
  quantity: Schema.optional(Schema.Number),
  
  // Required for costing - dimension annotation enables auto-conversion via dim
  mass_flow: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "mass_flow_rate",
      defaultUnit: "kg/h",  // Costing server expects kg/h
      title: "Mass flow rate",
    })
  ),
});
```

**Unit Conversion:** The `dim` library will auto-convert any compatible unit to the `defaultUnit` specified in annotations. For example, if a user specifies `mass_flow = "100 t/h"`, dim converts it to `100000 kg/h` before sending to the costing server.

---

## Frontend: Operation Readiness UI

### Operation Registry

```typescript
// lib/operations/registry.ts
interface Operation {
  id: string;
  name: string;
  description: string;
  schemaVersion: string;       // Schema to validate against
  requiredGroupTypes: string[]; // e.g., ["labeledGroup"] with costing properties
  endpoint: string;            // API endpoint
}

const OPERATIONS: Operation[] = [
  {
    id: "costing",
    name: "Cost Estimation",
    description: "Estimate CAPEX and OPEX for the network",
    schemaVersion: "v1.0-costing",
    requiredGroupTypes: ["labeledGroup"],
    endpoint: "/api/operations/costing/estimate",
  },
];
```

### Readiness Component

```tsx
// components/operations/operation-readiness.tsx
function OperationReadiness({ networkId }: { networkId: string }) {
  const { data: operations } = useQuery(operationsQueryOptions());
  
  return (
    <div className="space-y-2">
      <h3>Available Operations</h3>
      {operations.map(op => (
        <OperationCard 
          key={op.id}
          operation={op}
          networkId={networkId}
        />
      ))}
    </div>
  );
}

function OperationCard({ operation, networkId }) {
  const { data: validation } = useQuery(
    operationValidationQueryOptions(operation.id, networkId)
  );
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {validation?.ready ? (
            <CheckCircle className="text-green-500" />
          ) : (
            <AlertCircle className="text-yellow-500" />
          )}
          {operation.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {validation?.ready ? (
          <Button onClick={() => runOperation(operation)}>
            Run {operation.name}
          </Button>
        ) : (
          <div>
            <p>Missing required properties:</p>
            <ul>
              {validation?.missingProperties.map(err => (
                <li key={err.path}>{err.message}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Implementation Checklist

### Phase 1: Cost Library Integration ✅ COMPLETE

- [x] Copy cost library reference data to `backend/reference/costing/`
- [x] Create type normalization function (e.g., "Capture Unit" → "CaptureUnit")
- [x] Parse cost library to extract available modules and their required parameters
- [x] Create module lookup service (block type + subtype → module ID)
- [x] Create types for cost library structures
- [x] Add tests (23 passing)

### Phase 2: Schema Definition

- [ ] Define costing group schema (asset properties) using Effect Schema
- [ ] Define costing block schemas for each supported module type
- [ ] Create timeline schema
- [ ] Create factors schemas
- [ ] Add dimension annotations for unit conversion via dim
- [ ] Register schemas in schema registry under `v1.0-costing`

### Phase 3: Defaults & Validation

- [ ] Create defaults file (`costing-defaults.ts`)
- [ ] Implement default value fallback for unnamed assets
- [ ] Track which assets/fields are using defaults
- [ ] Create validation service to check network readiness

### Phase 4: Adapter Implementation

- [ ] Create `transformNetworkToCostingRequest()` function
- [ ] Implement block → cost item transformation with unit conversion (dim)
- [ ] Implement group → named asset transformation
- [ ] Implement ungrouped branch → unnamed asset transformation
- [ ] Create `transformCostingResponseToNetwork()` function
- [ ] Map costs back to network structure (cluster/asset/module levels)

### Phase 5: API Endpoints

- [ ] Create `/api/operations/costing/estimate` endpoint
- [ ] Create `/api/operations/costing/validate` endpoint
- [ ] Create `/api/operations/costing/libraries` endpoint
- [ ] Create `/api/operations/costing/libraries/:id/modules` endpoint
- [ ] Add error handling for costing server unavailability
- [ ] Add Excel export endpoint `/api/operations/costing/export-excel`

### Phase 6: Operation Registry

- [ ] Create operation registry structure
- [ ] Register costing operation with schema requirements
- [ ] Create readiness check that returns validation status + missing properties
- [ ] Support multiple operations (costing first, modelling later)

### Phase 7: Frontend UI - Results Display

- [ ] Create cost results panel/dialog
- [ ] Network-level (cluster) summary table
- [ ] Asset-level cost breakdown table
- [ ] Module-level (block) cost details
- [ ] Show "using defaults" indicators
- [ ] Add Excel download button

### Phase 8: Frontend UI - Operation Readiness

- [ ] Create operations panel showing available operations
- [ ] Show readiness status (✅ ready / ⚠️ missing properties)
- [ ] Show missing properties with paths to fix
- [ ] "Run Operation" button (disabled if not ready)
- [ ] Loading state during calculation

### Phase 9: Network Visualization Integration

- [ ] Color blocks by cost (optional overlay)
- [ ] Show cost tooltips on hover
- [ ] Cost legend/scale

### Phase 10: Testing

We have e2e tests in the existing costing tool that we can replicate. Same network → same results.

**Unit Tests (Bun)**
- [ ] Type normalization (`"Capture Unit"` → `"CaptureUnit"`)
- [ ] Module lookup (block type + subtype → module ID)
- [ ] Unit conversion via dim
- [ ] Network → CostEstimateRequest transformation
- [ ] CostEstimateResponse → NetworkCostingResult transformation
- [ ] Defaults fallback logic

**Integration Tests (Bun)**
- [ ] Create sample network matching existing costing tool test
- [ ] Verify adapter produces same results as existing tool
- [ ] Test named assets (groups with costing properties)
- [ ] Test unnamed assets (ungrouped branches with defaults)
- [ ] Test currency conversion

**E2E Tests (Playwright, optional)**
- [ ] Full flow: network → validate → estimate → display results

### Phase 11: Polish

- [ ] Add loading states
- [ ] Add error notifications
- [ ] Document the integration

---

## Open Questions

1. ~~**Module ID Discovery**~~: ✅ **DECIDED** - Use `definition.type` from cost library. Create normalization dictionary for minor naming differences.

2. ~~**Multiple Assets per Network**~~: ✅ **DECIDED** - Yes, a network can have multiple groups (named assets) and multiple ungrouped branches (unnamed assets).

3. ~~**Branches without Groups**~~: ✅ **DECIDED** - Become unnamed assets with default parameters. Show "using defaults" indicator in results.

4. ~~**Parameter Units**~~: ✅ **DECIDED** - Auto-convert using `dim`. Schema annotations specify `defaultUnit` (what the costing server expects), and dim converts any compatible unit automatically.

5. ~~**Default Factors**~~: ✅ **DECIDED** - Show defaults in results. Initially users can't override factors, but we show what values were used. Future: allow overrides.

6. ~~**Result Display**~~: ✅ **DECIDED** - Multiple views:
   - **Table view** at cluster/asset/module levels (like existing costing tool)
   - **Network overlay** (future: color blocks by cost)
   - **Excel export** capability (using ExcelJS pattern from existing tool)

## Confirmed Decisions

- ✅ **Asset properties on Group nodes** - Groups with a `costing` section become named assets
- ✅ **Ungrouped branches → unnamed assets** - Use defaults, show "using defaults" in results
- ✅ **Use Effect Schema** (not Zod) - matches existing codebase patterns
- ✅ **Auto-convert units via dim** - schema annotations define target units
- ✅ **Human-readable block types** - Users write `"Capture Unit"`, adapter normalizes to `"CaptureUnit"`
- ✅ **Cluster = Network** - report costs at cluster/asset/module levels
- ✅ **Show defaults** - indicate when default values are used
- ✅ **Table + Network views** - tables first, network overlay later
- ✅ **Excel export** - use ExcelJS pattern from existing costing tool

---

## File Structure

```
backend/
├── reference/
│   └── costing/
│       ├── data/                    # Cost library data files
│       │   ├── V1.1_working/
│       │   │   └── cost-library.json
│       │   ├── V1.3/
│       │   │   └── cost-library.json
│       │   └── V2.0/
│       │       └── cost-library.json
│       ├── end-to-end-tests/        # Reference e2e tests from costing tool
│       │   ├── costing.spec.ts      # Main costing test with expected results
│       │   ├── lib/
│       │   │   ├── buildBranch.ts
│       │   │   └── assert*.ts
│       │   └── ...
│       └── src/                     # Reference costing server source
│           ├── lib.rs               # API endpoints
│           └── route/
│               └── cost/
│                   └── estimate/    # Request/response types
├── src/
│   ├── routes/
│   │   └── operations.ts              # Operation endpoints
│   ├── services/
│   │   ├── costing/
│   │   │   ├── adapter.ts             # Transform network ↔ costing format
│   │   │   ├── defaults.ts            # Default values for asset properties
│   │   │   ├── module-lookup.ts       # Block type → module ID lookup
│   │   │   ├── type-normalization.ts  # Normalize block type names
│   │   │   ├── result-transformer.ts  # Transform response → NetworkCostingResult
│   │   │   └── excel-export.ts        # Excel workbook generation
│   │   └── operation-registry.ts      # Available operations & readiness checks
│   └── schemas/
│       └── v1.0-costing/
│           ├── group.ts               # Asset/group costing properties
│           ├── timeline.ts            # Timeline schema
│           ├── factors.ts             # CapexLangFactors, FixedOpexFactors
│           ├── blocks/
│           │   ├── capture-unit.ts
│           │   ├── emitter.ts
│           │   ├── compressor.ts
│           │   ├── pipe.ts
│           │   └── ...
│           └── index.ts

frontend/
└── src/
    ├── components/
    │   └── operations/
    │       ├── operations-panel.tsx       # Main panel showing available ops
    │       ├── operation-card.tsx         # Single operation with readiness
    │       ├── operation-results.tsx      # Results container
    │       ├── cost-summary-table.tsx     # Network/cluster level summary
    │       ├── asset-cost-table.tsx       # Asset level breakdown
    │       ├── module-cost-table.tsx      # Block/module level details
    │       └── defaults-indicator.tsx     # "Using defaults" badge
    └── lib/
        └── operations/
            ├── registry.ts                # Operation definitions
            ├── queries.ts                 # React Query hooks
            └── types.ts                   # Result types
```

---

## Reference Test Data

From the existing costing tool's e2e tests, we have a reference network and expected results. Our adapter should produce identical results for the same input.

### Reference Network (from costing tool e2e test)

This branch produces known results we can verify against:

```toml
# test-networks/costing-reference/branch-1.toml
type = "branch"
label = "Reference Branch"

# Source module
[[block]]
type = "Emitter"
subtype = "Cement"
mass_flow = "100 kg/h"

# Capture
[[block]]
type = "Capture Unit"
subtype = "Amine"
mass_flow = "100 kg/h"
parallel_splits = 3

# LP Compression
[[block]]
type = "Compressor"
subtype = "LP Compression (1 to 40 bar) (Electric Drive)"
compressor_duty = "100 kW"
electrical_power_item_007 = "100 kW"
electrical_power_item_008 = "100 kW"
cooling_duty = "100 kW"
parallel_splits = 2

# Dehydration
[[block]]
type = "Dehydration"
subtype = "Molecular Sieve"
mass_flow_co2 = "100 kg/h"

# HP Compression
[[block]]
type = "Compressor"
subtype = "HP Compression (40 to 120bara) (Electric Drive)"
compressor_duty = "100 kW"
electrical_power_item_007 = "100 kW"
electrical_power_item_008 = "100 kW"
cooling_duty = "100 kW"

# Refrigeration
[[block]]
type = "Refrigeration"
subtype = "EP - Water Cooling + trim refrig"
heat_duty = "100 kW"
cooling_water = "100 kg/h"

# Shipping
[[block]]
type = "Shipping"
subtype = "EP"

# FISU
[[block]]
type = "FISU"
subtype = "vessel"
number_of_fisu_vessels = 100

# Injection Topsides
[[block]]
type = "Injection Topsides"
subtype = "pair with FISU or Platform"
pump_motor_rating = "100 kW"
pump_flowrate = "100 m³/h"
electrical_power_item_028 = "100 kW"
electrical_power_item_006 = "100 kW"
heater_duty = "100 kW"

# Sink
[[block]]
type = "Injection Well"
subtype = "Offshore"
number_of_wells = 100
```

### Expected Results (EUR, cluster total)

```typescript
// Expected cluster totals from existing costing tool test (EUR)
const EXPECTED_CLUSTER_TOTALS = {
  costs: {
    directEquipment: 8_501_698_415.04,
    langFactoredCapital: 31_881_369_056.40,
    totalInstalled: 31_881_369_056.40,
    contingency: 8_501_698_415.04,
    fixedOpex: 51_010_190_490.24,
    variableOpex: 4_750_231_995.86,
    decommissioning: 3_188_136_905.64,
  },
  npvCosts: {
    directEquipment: 8_115_257_577.99,
    langFactoredCapital: 30_432_215_917.47,
    totalInstalled: 30_432_215_917.47,
    contingency: 8_115_257_577.99,
    fixedOpex: 19_739_932_140.71,
    variableOpex: 1_838_245_580.92,
    decommissioning: 391_649_782.06,
  },
};
```

### Test Strategy

```typescript
// backend/src/services/costing/__tests__/adapter.test.ts

import { describe, it, expect } from "bun:test";
import { transformNetworkToCostingRequest } from "../adapter";
import { EXPECTED_CLUSTER_TOTALS } from "./fixtures/expected-results";

describe("Costing Adapter", () => {
  it("produces same results as existing costing tool", async () => {
    // Load reference network
    const network = await loadNetwork("test-networks/costing-reference");
    
    // Transform to costing request
    const request = transformNetworkToCostingRequest(network, {
      libraryId: "V1.1_working",
    });
    
    // Call costing server
    const response = await callCostingServer(request, {
      libraryId: "V1.1_working",
      targetCurrency: "EUR",
    });
    
    // Transform response
    const result = transformCostingResponseToNetwork(response, network);
    
    // Verify against expected results
    expect(result.lifetimeCosts.direct_equipment_cost)
      .toBeCloseTo(EXPECTED_CLUSTER_TOTALS.costs.directEquipment, 2);
    expect(result.lifetimeCosts.lang_factored_capital_cost)
      .toBeCloseTo(EXPECTED_CLUSTER_TOTALS.costs.langFactoredCapital, 2);
    // ... etc
  });
});
```

---

## Next Steps

All major decisions are confirmed. Ready to implement!

### Recommended Order

1. **Phase 1: Cost Library Integration**
   - Parse the cost library JSON to understand available modules
   - Create type normalization dictionary
   - Build module lookup service
   
2. **Phase 2: Schema Definition**
   - Define Effect schemas for costing groups and blocks
   - Add dimension annotations for dim unit conversion
   
3. **Phase 3: Create Sample Network**
   - Create a test network (`preset-costing/`) with:
     - A group with full `[costing]` section (named asset)
     - An ungrouped branch (unnamed asset, uses defaults)
     - Blocks with costing-relevant properties
   
4. **Phase 4-5: Adapter & API**
   - Build the transformation logic
   - Create API endpoints
   - Test against the costing server
   
5. **Phase 7-8: Frontend**
   - Results display (tables)
   - Readiness UI

### Questions for Implementation

1. **Which modules first?** Recommend starting with 2-3 module types (e.g., CaptureUnit, Pipe, Compressor)
2. **Costing server URL** - Is it running locally? What port?
3. **Sample data** - Do you have example networks from the existing costing tool we can reference?
