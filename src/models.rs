use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub password: String,
    pub email: String,
    pub created_at: String,
    pub avatar_color: String,
    pub avatar: Option<String>,
    #[serde(default)]
    pub bio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub username: String,
    pub text: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(default)]
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivateMessage {
    pub id: String,
    pub from: String,
    pub to: String,
    pub text: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(default)]
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub name: String,
    pub creator: String,
    pub members: Vec<String>,
    pub messages: Vec<Message>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomInfo {
    pub id: String,
    pub name: String,
    pub creator: String,
    pub members_count: usize,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub uploader: String,
    pub filename: String,
    pub original_filename: String,
    pub size: u64,
    pub tags: Vec<String>,
    pub created_at: String,
    pub download_count: u64,
    #[serde(default)]
    pub image_filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub uploader: String,
    pub original_filename: String,
    pub size: u64,
    pub tags: Vec<String>,
    pub created_at: String,
    pub download_count: u64,
    #[serde(default)]
    pub image_filename: Option<String>,
}

// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(flatten)]
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendVerificationRequest {
    pub username: String,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub verification_code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AvatarRequest {
    pub avatar: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BioRequest {
    pub bio: String,
}
