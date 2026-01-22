"use client";

import { useQuery } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { openDialog } from "@/contexts/dialog-provider";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  getOperations,
  costingValidationQueryOptions,
  costingHealthQueryOptions,
  type Operation,
  type OperationValidation,
  type HealthStatus,
} from "@/lib/operations";
import {
  OperationStatusDot,
  type OperationStatus,
} from "./operation-status-indicator";
import { CostingOperationDialog } from "./costing-operation-dialog";

type OperationsListProps = {
  /** Path to the network directory */
  networkPath: string;
  /** Cost library to use */
  libraryId?: string;
};

/**
 * Get icon for an operation.
 */
function getOperationIcon(operationId: string) {
  switch (operationId) {
    case "costing":
      return Calculator;
    default:
      return Calculator;
  }
}

/**
 * Determine operation status from validation and health data.
 */
function getOperationStatus(
  validation: OperationValidation | undefined,
  health: HealthStatus | undefined,
  isLoading: boolean
): OperationStatus {
  if (isLoading) return "loading";
  if (health?.status === "error") return "error";
  if (!validation) return "unknown";
  if (validation.isReady) return "ready";
  if (validation.summary.costableBlocks > 0) return "warning";
  return "error";
}

/**
 * List of available operations for the sidebar.
 */
export function OperationsList({
  networkPath,
  libraryId = "V1.1_working",
}: OperationsListProps) {
  const operations = getOperations();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Operations</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {operations.map((operation) => (
            <OperationListItem
              key={operation.id}
              operation={operation}
              networkPath={networkPath}
              libraryId={libraryId}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

type OperationListItemProps = {
  operation: Operation;
  networkPath: string;
  libraryId: string;
};

function OperationListItem({
  operation,
  networkPath,
  libraryId,
}: OperationListItemProps) {
  // Fetch validation status for this operation
  const { data: validation, isLoading: isValidationLoading } = useQuery({
    ...costingValidationQueryOptions(networkPath, libraryId),
    enabled: operation.id === "costing" && !!networkPath,
  });

  // Fetch health status
  const { data: health, isLoading: isHealthLoading } = useQuery({
    ...costingHealthQueryOptions(),
    enabled: operation.id === "costing",
  });

  const isLoading = isValidationLoading || isHealthLoading;
  const status = getOperationStatus(validation, health, isLoading);
  const Icon = getOperationIcon(operation.id);

  const handleClick = () => {
    if (operation.id === "costing") {
      openDialog(
        ({ close }) => (
          <CostingOperationDialog
            networkPath={networkPath}
            libraryId={libraryId}
            validation={validation}
            health={health}
            onClose={close}
          />
        ),
        {
          title: operation.name,
          description: operation.description,
          className: "max-w-2xl",
        }
      );
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={handleClick} tooltip={operation.description}>
        <Icon className="h-4 w-4" />
        <span className="flex-1">{operation.name}</span>
        <OperationStatusDot status={status} />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
