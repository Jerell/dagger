use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use toml::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Outgoing {
    pub target: String,
    pub weight: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Block {
    #[serde(default)]
    pub quantity: Option<u32>,

    #[serde(rename = "type")]
    pub type_: String,

    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

impl Block {
    pub fn quantity(&self) -> u32 {
        self.quantity.unwrap_or(1)
    }
}

// Base node structure with dynamic properties
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NodeBase {
    // File-derived ID (from filename: "branch-4.toml" -> "branch-4")
    #[serde(skip)]
    pub id: String,

    // Known fields
    #[serde(rename = "type")]
    pub type_: String,

    #[serde(default)]
    pub label: Option<String>,
    pub position: Position,

    // Optional known fields
    #[serde(rename = "parentId", default)]
    pub parent_id: Option<String>,

    #[serde(default)]
    pub width: Option<u32>,

    #[serde(default)]
    pub height: Option<u32>,

    // Dynamic properties catch-all
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

impl NodeBase {
    pub fn label_display(&self) -> String {
        self.label.clone().unwrap_or_else(|| self.id.clone())
    }
}

// Branch node
#[derive(Debug, Clone, Deserialize)]
pub struct BranchNode {
    #[serde(flatten)]
    pub base: NodeBase,

    #[serde(rename = "outgoing", default)]
    pub outgoing: Vec<Outgoing>,

    // TOML uses [[block]] array syntax, but we serialize as "blocks" in JSON
    #[serde(rename = "block", default)]
    pub blocks: Vec<Block>,
}

// Custom serialization for BranchNode
impl Serialize for BranchNode {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("BranchNode", 6)?;
        state.serialize_field("id", &self.base.id)?;
        state.serialize_field("position", &self.base.position)?;
        let blocks: Vec<BlockData> = self.blocks.iter().map(|b| b.into()).collect();
        state.serialize_field(
            "data",
            &BranchData {
                id: &self.base.id,
                label: self.base.label.as_deref().unwrap_or(&self.base.id),
                blocks: &blocks,
            },
        )?;
        if let Some(parent_id) = &self.base.parent_id {
            state.serialize_field("parentId", parent_id)?;
            state.serialize_field("extent", "parent")?;
        }
        state.serialize_field("type", &self.base.type_)?;
        state.end()
    }
}

#[derive(Serialize)]
struct BranchData<'a> {
    id: &'a str,
    label: &'a str,
    blocks: &'a Vec<BlockData>,
}

#[derive(Serialize)]
struct BlockData {
    quantity: u32,
    #[serde(rename = "type")]
    type_: String,
    kind: String,
    label: String,
}

impl From<&Block> for BlockData {
    fn from(block: &Block) -> Self {
        let kind = match block.type_.as_str() {
            "Source" => "source",
            "Sink" => "sink",
            _ => "transform",
        };
        BlockData {
            quantity: block.quantity(),
            type_: block.type_.clone(),
            kind: kind.to_string(),
            label: block.type_.clone(),
        }
    }
}

// Group node - just use default serialization with flattened base
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GroupNode {
    #[serde(flatten)]
    pub base: NodeBase,
}

// Geographic anchor node
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GeographicAnchorNode {
    #[serde(flatten)]
    pub base: NodeBase,
}

// Geographic window node
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GeographicWindowNode {
    #[serde(flatten)]
    pub base: NodeBase,
}

// Node data enum for network structure
// Serialized as a flat structure (not wrapped in type-keyed object)
#[derive(Debug, Clone)]
pub enum NodeData {
    Branch(BranchNode),
    Group(GroupNode),
    GeographicAnchor(GeographicAnchorNode),
    GeographicWindow(GeographicWindowNode),
}

impl Serialize for NodeData {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            NodeData::Branch(node) => node.serialize(serializer),
            NodeData::Group(node) => node.serialize(serializer),
            NodeData::GeographicAnchor(node) => node.serialize(serializer),
            NodeData::GeographicWindow(node) => node.serialize(serializer),
        }
    }
}

impl NodeData {
    pub fn id(&self) -> &str {
        match self {
            NodeData::Branch(n) => &n.base.id,
            NodeData::Group(n) => &n.base.id,
            NodeData::GeographicAnchor(n) => &n.base.id,
            NodeData::GeographicWindow(n) => &n.base.id,
        }
    }

    pub fn base(&self) -> &NodeBase {
        match self {
            NodeData::Branch(n) => &n.base,
            NodeData::Group(n) => &n.base,
            NodeData::GeographicAnchor(n) => &n.base,
            NodeData::GeographicWindow(n) => &n.base,
        }
    }
}

// Edge structure for network graph
#[derive(Debug, Clone, Serialize)]
pub struct Edge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub data: EdgeData,
}

#[derive(Debug, Clone, Serialize)]
pub struct EdgeData {
    pub weight: u32,
}

// Network structure matching example.json format
#[derive(Debug, Clone, Serialize)]
pub struct Network {
    pub id: String,
    pub label: String,
    pub nodes: Vec<NodeData>,
    pub edges: Vec<Edge>,
}
