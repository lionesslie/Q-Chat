use crate::models::*;
use serde_json;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct Storage {
    data_dir: PathBuf,
}

impl Storage {
    pub fn new(data_dir: &str) -> Self {
        let path = PathBuf::from(data_dir);
        fs::create_dir_all(&path).ok();
        fs::create_dir_all(path.join("projects")).ok();
        Storage { data_dir: path }
    }

    fn users_path(&self) -> PathBuf {
        self.data_dir.join("users.json")
    }

    fn messages_path(&self) -> PathBuf {
        self.data_dir.join("messages.json")
    }

    fn private_messages_path(&self) -> PathBuf {
        self.data_dir.join("private_messages.json")
    }

    fn rooms_path(&self) -> PathBuf {
        self.data_dir.join("rooms.json")
    }

    fn projects_path(&self) -> PathBuf {
        self.data_dir.join("projects.json")
    }

    pub fn projects_dir(&self) -> PathBuf {
        self.data_dir.join("projects")
    }

    // ─── Users ───────────────────────────────────────────────
    pub fn get_users(&self) -> HashMap<String, User> {
        self.read_json(&self.users_path()).unwrap_or_default()
    }

    pub fn save_users(&self, users: &HashMap<String, User>) {
        self.write_json(&self.users_path(), users);
    }

    // ─── Messages ────────────────────────────────────────────
    pub fn get_messages(&self) -> Vec<Message> {
        self.read_json(&self.messages_path()).unwrap_or_default()
    }

    pub fn save_messages(&self, messages: &Vec<Message>) {
        self.write_json(&self.messages_path(), messages);
    }

    // ─── Private Messages ────────────────────────────────────
    pub fn get_private_messages(&self) -> HashMap<String, Vec<PrivateMessage>> {
        self.read_json(&self.private_messages_path()).unwrap_or_default()
    }

    pub fn save_private_messages(&self, pm: &HashMap<String, Vec<PrivateMessage>>) {
        self.write_json(&self.private_messages_path(), pm);
    }

    // ─── Rooms ───────────────────────────────────────────────
    pub fn get_rooms(&self) -> HashMap<String, Room> {
        self.read_json(&self.rooms_path()).unwrap_or_default()
    }

    pub fn save_rooms(&self, rooms: &HashMap<String, Room>) {
        self.write_json(&self.rooms_path(), rooms);
    }

    // ─── Projects ────────────────────────────────────────────
    pub fn get_projects(&self) -> Vec<Project> {
        self.read_json(&self.projects_path()).unwrap_or_default()
    }

    pub fn save_projects(&self, projects: &Vec<Project>) {
        self.write_json(&self.projects_path(), projects);
    }

    // ─── IP Sessions ─────────────────────────────────────────
    fn ip_sessions_path(&self) -> PathBuf {
        self.data_dir.join("ip_sessions.json")
    }

    pub fn get_ip_sessions(&self) -> HashMap<String, String> {
        self.read_json(&self.ip_sessions_path()).unwrap_or_default()
    }

    pub fn save_ip_sessions(&self, sessions: &HashMap<String, String>) {
        self.write_json(&self.ip_sessions_path(), sessions);
    }

    pub fn set_ip_session(&self, ip: &str, username: &str) {
        let mut sessions = self.get_ip_sessions();
        sessions.insert(ip.to_string(), username.to_string());
        self.save_ip_sessions(&sessions);
    }

    pub fn get_username_by_ip(&self, ip: &str) -> Option<String> {
        let sessions = self.get_ip_sessions();
        sessions.get(ip).cloned()
    }

    pub fn remove_ip_session(&self, ip: &str) {
        let mut sessions = self.get_ip_sessions();
        sessions.remove(ip);
        self.save_ip_sessions(&sessions);
    }

    // ─── Verification Codes ──────────────────────────────────
    fn verification_codes_path(&self) -> PathBuf {
        self.data_dir.join("verification_codes.json")
    }

    pub fn get_verification_codes(&self) -> HashMap<String, String> {
        self.read_json(&self.verification_codes_path()).unwrap_or_default()
    }

    pub fn save_verification_codes(&self, codes: &HashMap<String, String>) {
        self.write_json(&self.verification_codes_path(), codes);
    }

    pub fn set_verification_code(&self, email: &str, code: &str) {
        let mut codes = self.get_verification_codes();
        codes.insert(email.to_string(), code.to_string());
        self.save_verification_codes(&codes);
    }

    pub fn get_verification_code(&self, email: &str) -> Option<String> {
        let codes = self.get_verification_codes();
        codes.get(email).cloned()
    }

    pub fn remove_verification_code(&self, email: &str) {
        let mut codes = self.get_verification_codes();
        codes.remove(email);
        self.save_verification_codes(&codes);
    }

    // ─── Helpers ─────────────────────────────────────────────
    fn read_json<T: serde::de::DeserializeOwned>(&self, path: &Path) -> Option<T> {
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    fn write_json<T: serde::Serialize>(&self, path: &Path, data: &T) {
        if let Ok(content) = serde_json::to_string_pretty(data) {
            fs::write(path, content).ok();
        }
    }
}

pub fn convo_key(user_a: &str, user_b: &str) -> String {
    let mut users = vec![user_a, user_b];
    users.sort();
    users.join("|")
}

pub fn hash_password(password: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}
