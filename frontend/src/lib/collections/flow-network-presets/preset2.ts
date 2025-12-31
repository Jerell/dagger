import type { AppEdge, AppNode } from "@/lib/types/flow-nodes";

export const preset2 = {
  id: "preset-2",
  label: "Preset 2",
  nodes: [
    {
      id: "branch-1",
      position: { x: 0, y: -50 },
      data: {
        id: "branch-1",
        label: "Branch 1",
        blocks: [
          { length: 1, kind: "source", label: "Source" },
          { length: 4, kind: "transform", label: "Capture Unit" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 2, kind: "transform", label: "Compressor" },
          { length: 1, kind: "transform", label: "Pipe" },
        ],
      },
      type: "branchNode",
    },
    {
      id: "branch-2",
      position: { x: 200, y: 0 },
      data: {
        id: "branch-2",
        label: "Branch 2",
        blocks: [
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Compressor" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
        ],
      },
      type: "branchNode",
    },
    {
      id: "branch-3",
      position: { x: 500, y: 0 },
      data: {
        id: "branch-3",
        label: "Branch 3",
        blocks: [
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Compressor" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
        ],
      },
      type: "branchNode",
    },
    {
      id: "branch-4",
      position: { x: 0, y: 150 },
      data: {
        id: "branch-4",
        label: "Branch 4",
        blocks: [
          { length: 1, kind: "source", label: "Source" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
        ],
      },
      type: "branchNode",
    },
    {
      id: "branch-5",
      position: { x: 200, y: 150 },
      data: {
        id: "branch-5",
        label: "Branch 5",
        blocks: [
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
        ],
      },
      type: "branchNode",
    },
    {
      id: "branch-6",
      position: { x: 400, y: 150 },
      data: {
        id: "branch-6",
        label: "Branch 6",
        blocks: [
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
        ],
      },
      type: "branchNode",
    },
    {
      id: "branch-7",
      position: { x: 650, y: 150 },
      data: {
        id: "branch-7",
        label: "Branch 7",
        blocks: [
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
        ],
      },
      type: "branchNode",
    },
    {
      id: "branch-8",
      position: { x: 1000, y: 150 },
      data: {
        id: "branch-8",
        label: "Branch 8",
        blocks: [
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
          { length: 1, kind: "transform", label: "Pipe" },
        ],
      },
      type: "branchNode",
    },
    {
      id: "branch-9",
      position: { x: 0, y: 350 },
      data: {
        id: "branch-9",
        label: "Branch 9",
        blocks: [],
      },
      type: "branchNode",
    },
  ] satisfies AppNode[],
  edges: [
    {
      id: "branch-1_branch-2",
      source: "branch-1",
      target: "branch-2",
      data: { weight: 1 },
    },
    {
      id: "branch-2_branch-3",
      source: "branch-2",
      target: "branch-3",
      data: { weight: 1 },
    },
    {
      id: "branch-4_branch-5",
      source: "branch-4",
      target: "branch-5",
      data: { weight: 1 },
    },
    {
      id: "branch-5_branch-6",
      source: "branch-5",
      target: "branch-6",
      data: { weight: 1 },
    },
  ] satisfies AppEdge[],
};
