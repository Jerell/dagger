import type { AppEdge, AppNode } from "@/lib/types/flow-nodes";
import { preset1 } from "./preset1";
import { preset2 } from "./preset2";

export type FlowPreset = {
  id: string;
  label: string;
  nodes: AppNode[];
  edges: AppEdge[];
};

export const flowPresets: FlowPreset[] = [preset1, preset2];
