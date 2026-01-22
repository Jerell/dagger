"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  type OperationValidation,
  type HealthStatus,
  type CostingEstimateResponse,
  costLibrariesQueryOptions,
  runCostingEstimate,
  createCostingRequest,
} from "@/lib/operations";

type CostingOperationDialogProps = {
  networkPath: string;
  libraryId: string;
  validation?: OperationValidation;
  health?: HealthStatus;
  onClose: () => void;
};

const CURRENCIES = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
];

export function CostingOperationDialog({
  networkPath,
  libraryId: initialLibraryId,
  validation,
  health,
  onClose,
}: CostingOperationDialogProps) {
  const [selectedLibrary, setSelectedLibrary] = useState(initialLibraryId);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [result, setResult] = useState<CostingEstimateResponse | null>(null);

  console.log(validation);

  // Fetch available libraries
  const { data: libraries = [] } = useQuery(costLibrariesQueryOptions());

  // Run costing mutation
  const costingMutation = useMutation({
    mutationFn: () =>
      runCostingEstimate(
        createCostingRequest({
          networkPathOrId: networkPath,
          libraryId: selectedLibrary,
          targetCurrency: selectedCurrency,
        })
      ),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const isServerAvailable = health?.status === "ok";
  const canRun = isServerAvailable && validation?.isReady;

  return (
    <div className="space-y-6">
      {/* Server Status */}
      <ServerStatusSection health={health} />

      {/* Validation Summary */}
      {validation && <ValidationSummarySection validation={validation} />}

      {/* Request Parameters */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Request Parameters</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Cost Library</label>
            <Select value={selectedLibrary} onValueChange={setSelectedLibrary}>
              <SelectTrigger>
                <SelectValue placeholder="Select library" />
              </SelectTrigger>
              <SelectContent>
                {libraries.map((lib) => (
                  <SelectItem key={lib.id} value={lib.id}>
                    {lib.name || lib.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Currency</label>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.value} value={curr.value}>
                    {curr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && <ResultsSection result={result} />}

      {/* Error Display */}
      {costingMutation.isError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="text-sm text-red-800">
              {costingMutation.error instanceof Error
                ? costingMutation.error.message
                : "An error occurred"}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={() => costingMutation.mutate()}
          disabled={!canRun || costingMutation.isPending}
        >
          {costingMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Estimate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ServerStatusSection({ health }: { health?: HealthStatus }) {
  const isAvailable = health?.status === "ok";
  const isDegraded = health?.status === "degraded";

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-md border",
        isAvailable && "bg-green-50 border-green-200",
        isDegraded && "bg-yellow-50 border-yellow-200",
        !isAvailable && !isDegraded && "bg-red-50 border-red-200"
      )}
    >
      <Server className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">Costing Server</div>
        <div className="text-xs text-muted-foreground">
          {health?.costingServer || "Unknown"}
        </div>
      </div>
      {isAvailable ? (
        <div className="flex items-center gap-1 text-green-600 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Connected
        </div>
      ) : isDegraded ? (
        <div className="flex items-center gap-1 text-yellow-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          Degraded
        </div>
      ) : (
        <div className="flex items-center gap-1 text-red-600 text-sm">
          <XCircle className="h-4 w-4" />
          Unavailable
        </div>
      )}
    </div>
  );
}

function ValidationSummarySection({
  validation,
}: {
  validation: OperationValidation;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Network Analysis</h4>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Assets"
          value={validation.summary.assetCount}
          status={validation.summary.assetCount > 0 ? "ok" : "error"}
        />
        <StatCard
          label="Total Blocks"
          value={validation.summary.totalBlocks}
          status="neutral"
        />
        <StatCard
          label="Costable"
          value={validation.summary.costableBlocks}
          status={validation.summary.costableBlocks > 0 ? "ok" : "warning"}
        />
        <StatCard
          label="Unmapped"
          value={validation.summary.unmappedBlocks}
          status={validation.summary.unmappedBlocks > 0 ? "warning" : "ok"}
        />
      </div>

      {/* Assets Detail */}
      {validation.assets.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {validation.assets.map((asset) => (
            <AssetValidationCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}

      {/* Readiness Status */}
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded text-sm",
          validation.isReady
            ? "bg-green-50 text-green-800"
            : "bg-yellow-50 text-yellow-800"
        )}
      >
        {validation.isReady ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Network is ready for costing
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4" />
            {validation.summary.costableBlocks > 0
              ? "Some blocks cannot be costed (missing properties or unmapped types)"
              : "No blocks can be costed"}
          </>
        )}
      </div>
    </div>
  );
}

function AssetValidationCard({ asset }: { asset: OperationValidation["assets"][0] }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusCounts = {
    costable: asset.blocks.filter(b => b.status === "costable").length,
    missingProps: asset.blocks.filter(b => b.status === "missing_properties").length,
    notCostable: asset.blocks.filter(b => b.status === "not_costable").length,
    unknown: asset.blocks.filter(b => b.status === "unknown").length,
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-md">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{asset.name || asset.id}</span>
          <span className="text-xs text-muted-foreground">
            {asset.isGroup ? "Group" : "Branch"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {statusCounts.costable > 0 && (
            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
              {statusCounts.costable} costable
            </span>
          )}
          {statusCounts.missingProps > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
              {statusCounts.missingProps} missing props
            </span>
          )}
          {statusCounts.notCostable > 0 && (
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {statusCounts.notCostable} not costable
            </span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t p-2 space-y-2">
          {/* Asset defaults */}
          {asset.usingDefaults.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Using defaults for: {asset.usingDefaults.join(", ")}
            </div>
          )}

          {/* Block details */}
          <div className="space-y-1">
            {asset.blocks.map((block) => (
              <BlockValidationRow key={block.id} block={block} />
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function BlockValidationRow({ block }: { block: OperationValidation["assets"][0]["blocks"][0] }) {
  const statusColors = {
    costable: "bg-green-50 border-green-200",
    missing_properties: "bg-yellow-50 border-yellow-200",
    not_costable: "bg-gray-50 border-gray-200",
    unknown: "bg-red-50 border-red-200",
  };

  const definedPropsCount = Object.keys(block.definedProperties).length;

  return (
    <div className={cn("text-xs p-2 rounded border", statusColors[block.status])}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{block.type}</span>
        {block.moduleType && (
          <span className="text-muted-foreground">
            → {block.moduleType}{block.moduleSubtype ? ` (${block.moduleSubtype})` : ""}
          </span>
        )}
      </div>

      {definedPropsCount > 0 && (
        <div className="mt-1 text-muted-foreground">
          Defined: {Object.entries(block.definedProperties).map(([k, v]) => (
            <span key={k} className="inline-block bg-white/50 px-1 rounded mr-1">
              {k}={String(v)}
            </span>
          ))}
        </div>
      )}

      {block.missingProperties.length > 0 && (
        <div className="mt-1 text-yellow-700">
          Missing: {block.missingProperties.map(p => (
            <span key={p} className="inline-block bg-yellow-200/50 px-1 rounded mr-1">{p}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: "ok" | "warning" | "error" | "neutral";
}) {
  const bgClass = {
    ok: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    error: "bg-red-50 border-red-200",
    neutral: "bg-muted/50 border-border",
  }[status];

  return (
    <div className={cn("p-2 rounded border text-center", bgClass)}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ResultsSection({ result }: { result: CostingEstimateResponse }) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: result.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        Results
      </h4>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Cost Category</th>
              <th className="text-right p-2 font-medium">Lifetime</th>
              <th className="text-right p-2 font-medium">NPV</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-2">Direct Equipment Cost</td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(result.lifetimeCosts.directEquipmentCost)}
              </td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(result.lifetimeNpcCosts.directEquipmentCost)}
              </td>
            </tr>
            <tr className="border-t">
              <td className="p-2">Total Installed Cost</td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(result.lifetimeCosts.totalInstalledCost)}
              </td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(result.lifetimeNpcCosts.totalInstalledCost)}
              </td>
            </tr>
            <tr className="border-t">
              <td className="p-2">Fixed OPEX</td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(
                  Object.values(result.lifetimeCosts.fixedOpexCost).reduce(
                    (a, b) => a + b,
                    0
                  )
                )}
              </td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(
                  Object.values(result.lifetimeNpcCosts.fixedOpexCost).reduce(
                    (a, b) => a + b,
                    0
                  )
                )}
              </td>
            </tr>
            <tr className="border-t">
              <td className="p-2">Variable OPEX</td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(
                  Object.values(result.lifetimeCosts.variableOpexCost).reduce(
                    (a, b) => a + b,
                    0
                  )
                )}
              </td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(
                  Object.values(result.lifetimeNpcCosts.variableOpexCost).reduce(
                    (a, b) => a + b,
                    0
                  )
                )}
              </td>
            </tr>
            <tr className="border-t">
              <td className="p-2">Decommissioning</td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(result.lifetimeCosts.decommissioningCost)}
              </td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(result.lifetimeNpcCosts.decommissioningCost)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {result.assetsUsingDefaults.length > 0 && (
        <div className="text-xs text-muted-foreground">
          * {result.assetsUsingDefaults.length} asset(s) used default parameters
        </div>
      )}
    </div>
  );
}
