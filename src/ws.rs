use actix_web::{web, HttpRequest, HttpResponse};
use actix_ws;
use futures_util::StreamExt;
use parking_lot::RwLock;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::broadcast;
use crate::models::*;
use crate::storage::{Storage, convo_key};

/// Shared state for WebSocket connections
pub struct WsState {
    /// sid -> (username, sender)
    pub connections: RwLock<HashMap<String, (String, broadcast::Sender<String>)>>,
    /// username -> sid
    pub user_sids: RwLock<HashMap<String, String>>,
    /// channel -> set of usernames (voice sessions)
    pub voice_sessions: RwLock<HashMap<String, HashSet<String>>>,
    /// broadcast channel for all connected clients
    pub broadcast_tx: broadcast::Sender<String>,
}

impl WsState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(1024);
        WsState {
            connections: RwLock::new(HashMap::new()),
            user_sids: RwLock::new(HashMap::new()),
            voice_sessions: RwLock::new(HashMap::new()),
            broadcast_tx: tx,
        }
    }

    fn get_online_users(&self) -> Vec<String> {
        let conns = self.connections.read();
        let mut users: Vec<String> = conns.values().map(|(u, _)| u.clone()).collect();
        users.sort();
        users.dedup();
        users
    }

    fn broadcast(&self, msg: &str) {
        let _ = self.broadcast_tx.send(msg.to_string());
    }

    fn send_to_user(&self, username: &str, msg: &str) {
        let sids = self.user_sids.read();
        if let Some(sid) = sids.get(username) {
            let conns = self.connections.read();
            if let Some((_, tx)) = conns.get(sid) {
                let _ = tx.send(msg.to_string());
            }
        }
    }

    fn send_to_room_members(&self, storage: &Storage, room_id: &str, msg: &str) {
        let rooms = storage.get_rooms();
        if let Some(room) = rooms.get(room_id) {
            for member in &room.members {
                self.send_to_user(member, msg);
            }
        }
    }

    fn broadcast_user_list(&self, storage: &Storage) {
        let online_users = self.get_online_users();
        let all_users: Vec<String> = storage.get_users().keys().cloned().collect();
        let msg = json!({
            "type": "user_list",
            "users": online_users,
            "all_users": all_users
        }).to_string();
        self.broadcast(&msg);
    }
}

pub async fn ws_handler(
    req: HttpRequest,
    body: web::Payload,
    ws_state: web::Data<Arc<WsState>>,
    storage: web::Data<Storage>,
) -> Result<HttpResponse, actix_web::Error> {
    let (response, session, mut msg_stream) = actix_ws::handle(&req, body)?;

    let sid = uuid::Uuid::new_v4().to_string();
    let (personal_tx, _) = broadcast::channel::<String>(256);

    let ws_state_clone = ws_state.get_ref().clone();
    let storage_clone = storage.get_ref().clone();
    let sid_clone = sid.clone();
    let personal_tx_clone = personal_tx.clone();

    // Spawn message handler
    actix_rt::spawn(async move {
        let ws = ws_state_clone;
        let st = storage_clone;
        let my_sid = sid_clone;

        // Subscribe to broadcasts and personal messages
        let mut broadcast_rx = ws.broadcast_tx.subscribe();
        let mut personal_rx = personal_tx_clone.subscribe();

        let mut session_clone = session.clone();

        // Spawn sender for broadcast messages
        let mut session_broadcast = session.clone();
        let broadcast_handle = actix_rt::spawn(async move {
            loop {
                tokio::select! {
                    Ok(msg) = broadcast_rx.recv() => {
                        if session_broadcast.text(msg).await.is_err() {
                            break;
                        }
                    }
                    Ok(msg) = personal_rx.recv() => {
                        if session_broadcast.text(msg).await.is_err() {
                            break;
                        }
                    }
                    else => break,
                }
            }
        });

        // Handle incoming messages
        while let Some(Ok(msg)) = msg_stream.next().await {
            match msg {
                actix_ws::Message::Text(text) => {
                    let text_str = text.to_string();
                    if let Ok(ws_msg) = serde_json::from_str::<Value>(&text_str) {
                        let msg_type = ws_msg.get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");

                        match msg_type {
                            "authenticate" => {
                                if let Some(username) = ws_msg.get("username").and_then(|v| v.as_str()) {
                                    let username = username.to_string();
                                    {
                                        let mut conns = ws.connections.write();
                                        conns.insert(my_sid.clone(), (username.clone(), personal_tx_clone.clone()));
                                    }
                                    {
                                        let mut sids = ws.user_sids.write();
                                        sids.insert(username.clone(), my_sid.clone());
                                    }

                                    // Rejoin rooms
                                    let rooms = st.get_rooms();
                                    for (_room_id, room_data) in &rooms {
                                        if room_data.members.contains(&username) {
                                            // User is member, no special action needed for native WS
                                        }
                                    }

                                    ws.broadcast_user_list(&st);

                                    // Send current general voice participants
                                    let general_participants = {
                                        let vs = ws.voice_sessions.read();
                                        vs.get("general").map(|s| s.iter().cloned().collect::<Vec<_>>()).unwrap_or_default()
                                    };
                                    let msg = json!({
                                        "type": "general_voice_participants_update",
                                        "participants": general_participants
                                    }).to_string();
                                    let _ = personal_tx_clone.send(msg);
                                }
                            }
                            "general_message" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let text = ws_msg.get("text")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .trim()
                                        .to_string();
                                    let image = ws_msg.get("image")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string());
                                    if !text.is_empty() || image.is_some() {
                                        let msg = Message {
                                            id: uuid::Uuid::new_v4().to_string(),
                                            username: username.clone(),
                                            text: text.clone(),
                                            timestamp: chrono::Utc::now().to_rfc3339(),
                                            msg_type: "general".to_string(),
                                            image: image.clone(),
                                        };

                                        let mut messages = st.get_messages();
                                        messages.push(msg.clone());
                                        if messages.len() > 500 {
                                            let start = messages.len() - 500;
                                            messages = messages[start..].to_vec();
                                        }
                                        st.save_messages(&messages);

                                        let mut broadcast_obj = json!({
                                            "type": "new_general_message",
                                            "id": msg.id,
                                            "username": msg.username,
                                            "text": msg.text,
                                            "timestamp": msg.timestamp,
                                        });
                                        if let Some(ref img) = image {
                                            broadcast_obj["image"] = json!(img);
                                        }
                                        ws.broadcast(&broadcast_obj.to_string());
                                    }
                                }
                            }
                            "private_message" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let to_user = ws_msg.get("to").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    let text = ws_msg.get("text").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                                    let image = ws_msg.get("image")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string());

                                    if !to_user.is_empty() && (!text.is_empty() || image.is_some()) {
                                        let users = st.get_users();
                                        if users.contains_key(&to_user) {
                                            let pm_msg = PrivateMessage {
                                                id: uuid::Uuid::new_v4().to_string(),
                                                from: username.clone(),
                                                to: to_user.clone(),
                                                text: text.clone(),
                                                timestamp: chrono::Utc::now().to_rfc3339(),
                                                msg_type: "private".to_string(),
                                                image: image.clone(),
                                            };

                                            let mut pm = st.get_private_messages();
                                            let key = convo_key(&username, &to_user);
                                            pm.entry(key).or_insert_with(Vec::new).push(pm_msg.clone());
                                            // Keep last 500
                                            if let Some(msgs) = pm.get_mut(&convo_key(&username, &to_user)) {
                                                if msgs.len() > 500 {
                                                    let start = msgs.len() - 500;
                                                    *msgs = msgs[start..].to_vec();
                                                }
                                            }
                                            st.save_private_messages(&pm);

                                            let mut msg_json = json!({
                                                "type": "new_private_message",
                                                "id": pm_msg.id,
                                                "from": pm_msg.from,
                                                "to": pm_msg.to,
                                                "text": pm_msg.text,
                                                "timestamp": pm_msg.timestamp,
                                            });
                                            if let Some(ref img) = image {
                                                msg_json["image"] = json!(img);
                                            }

                                            ws.send_to_user(&to_user, &msg_json.to_string());
                                            ws.send_to_user(&username, &msg_json.to_string());
                                        }
                                    }
                                }
                            }
                            "create_room" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let room_name = ws_msg.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                                    if !room_name.is_empty() {
                                        let room_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
                                        let room = Room {
                                            name: room_name.clone(),
                                            creator: username.clone(),
                                            members: vec![username.clone()],
                                            messages: Vec::new(),
                                            created_at: chrono::Utc::now().to_rfc3339(),
                                        };

                                        let mut rooms = st.get_rooms();
                                        rooms.insert(room_id.clone(), room);
                                        st.save_rooms(&rooms);

                                        let msg = json!({
                                            "type": "room_created",
                                            "id": room_id,
                                            "name": room_name,
                                            "creator": username,
                                            "members_count": 1
                                        }).to_string();
                                        ws.broadcast(&msg);
                                    }
                                }
                            }
                            "delete_room" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let room_id = ws_msg.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    let mut rooms = st.get_rooms();
                                    if let Some(room) = rooms.get(&room_id) {
                                        if room.creator == username {
                                            rooms.remove(&room_id);
                                            st.save_rooms(&rooms);
                                            let msg = json!({
                                                "type": "room_deleted",
                                                "room_id": room_id
                                            }).to_string();
                                            ws.broadcast(&msg);
                                        }
                                    }
                                }
                            }
                            "join_room" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let room_id = ws_msg.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    let mut rooms = st.get_rooms();
                                    if let Some(room) = rooms.get_mut(&room_id) {
                                        if !room.members.contains(&username) {
                                            room.members.push(username.clone());
                                        }
                                        let room_name = room.name.clone();
                                        let members = room.members.clone();
                                        st.save_rooms(&rooms);
                                        let msg = json!({
                                            "type": "room_joined",
                                            "room_id": room_id,
                                            "username": username,
                                            "room_name": room_name
                                        }).to_string();
                                        for member in &members {
                                            ws.send_to_user(member, &msg);
                                        }
                                    }
                                }
                            }
                            "leave_room" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let room_id = ws_msg.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    let mut rooms = st.get_rooms();
                                    if let Some(room) = rooms.get_mut(&room_id) {
                                        room.members.retain(|m| m != &username);
                                        let members = room.members.clone();
                                        st.save_rooms(&rooms);
                                        let msg = json!({
                                            "type": "room_left",
                                            "room_id": room_id,
                                            "username": username
                                        }).to_string();
                                        for member in &members {
                                            ws.send_to_user(member, &msg);
                                        }
                                    }
                                }
                            }
                            "room_message" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let room_id = ws_msg.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    let text = ws_msg.get("text").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                                    let image = ws_msg.get("image")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string());

                                    if !room_id.is_empty() && (!text.is_empty() || image.is_some()) {
                                        let mut rooms = st.get_rooms();
                                        if let Some(room) = rooms.get_mut(&room_id) {
                                            if room.members.contains(&username) {
                                                let msg = Message {
                                                    id: uuid::Uuid::new_v4().to_string(),
                                                    username: username.clone(),
                                                    text: text.clone(),
                                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                                    msg_type: "room".to_string(),
                                                    image: image.clone(),
                                                };
                                                room.messages.push(msg.clone());
                                                if room.messages.len() > 500 {
                                                    let start = room.messages.len() - 500;
                                                    room.messages = room.messages[start..].to_vec();
                                                }
                                                let members = room.members.clone();
                                                st.save_rooms(&rooms);

                                                let mut msg_json = json!({
                                                    "type": "new_room_message",
                                                    "id": msg.id,
                                                    "username": msg.username,
                                                    "text": msg.text,
                                                    "timestamp": msg.timestamp,
                                                    "room_id": room_id,
                                                });
                                                if let Some(ref img) = image {
                                                    msg_json["image"] = json!(img);
                                                }
                                                for member in &members {
                                                    ws.send_to_user(member, &msg_json.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            "get_room_members" => {
                                let room_id = ws_msg.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let rooms = st.get_rooms();
                                if let Some(room) = rooms.get(&room_id) {
                                    let online = ws.get_online_users();
                                    let online_members: Vec<&String> = room.members.iter()
                                        .filter(|m| online.contains(m))
                                        .collect();
                                    let msg = json!({
                                        "type": "room_members",
                                        "room_id": room_id,
                                        "members": room.members,
                                        "online": online_members
                                    }).to_string();
                                    let _ = personal_tx_clone.send(msg);
                                }
                            }
                            // Voice signaling
                            "voice_join" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let channel = ws_msg.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    if !channel.is_empty() {
                                        let participants = {
                                            let mut vs = ws.voice_sessions.write();
                                            vs.entry(channel.clone()).or_insert_with(HashSet::new).insert(username.clone());
                                            vs.get(&channel).unwrap().iter().cloned().collect::<Vec<_>>()
                                        };
                                        let msg = json!({
                                            "type": "voice_user_joined",
                                            "username": username.clone(),
                                            "channel": channel.clone(),
                                            "participants": participants.clone()
                                        }).to_string();
                                        // Send to all participants
                                        for p in &participants {
                                            ws.send_to_user(p, &msg);
                                        }

                                        // If general channel, broadcast general update
                                        if channel == "general" {
                                            let update_msg = json!({
                                                "type": "general_voice_participants_update",
                                                "participants": participants
                                            }).to_string();
                                            ws.broadcast(&update_msg);
                                        } else if channel.starts_with("private_") {
                                            // Extract the other user from "private_user1_user2"
                                            let parts: Vec<&str> = channel.split('_').collect();
                                            if parts.len() == 3 {
                                                let target_user = if parts[1] == username { parts[2] } else { parts[1] };
                                                let incoming_msg = json!({
                                                    "type": "incoming_call",
                                                    "from": username.clone(),
                                                    "channel": channel.clone()
                                                }).to_string();
                                                ws.send_to_user(target_user, &incoming_msg);
                                            }
                                        }
                                    }
                                }
                            }
                            "voice_leave" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let channel = ws_msg.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    let participants = {
                                        let mut vs = ws.voice_sessions.write();
                                        if let Some(set) = vs.get_mut(&channel) {
                                            set.remove(&username);
                                            if set.is_empty() {
                                                vs.remove(&channel);
                                                Vec::new()
                                            } else {
                                                set.iter().cloned().collect()
                                            }
                                        } else {
                                            Vec::new()
                                        }
                                    };
                                    let msg = json!({
                                        "type": "voice_user_left",
                                        "username": username,
                                        "channel": channel.clone(),
                                        "participants": participants.clone()
                                    }).to_string();
                                    for p in &participants {
                                        ws.send_to_user(p, &msg);
                                    }
                                    // Also send to the leaving user
                                    ws.send_to_user(&username, &msg);

                                    // If general channel, broadcast general update
                                    if channel == "general" {
                                        let update_msg = json!({
                                            "type": "general_voice_participants_update",
                                            "participants": participants
                                        }).to_string();
                                        ws.broadcast(&update_msg);
                                    }
                                }
                            }
                            "voice_get_participants" => {
                                let channel = ws_msg.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let vs = ws.voice_sessions.read();
                                let participants: Vec<String> = vs.get(&channel)
                                    .map(|s| s.iter().cloned().collect())
                                    .unwrap_or_default();
                                let msg = json!({
                                    "type": "voice_participants",
                                    "channel": channel,
                                    "participants": participants
                                }).to_string();
                                let _ = personal_tx_clone.send(msg);
                            }
                            "voice_mute" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let channel = ws_msg.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    let muted = ws_msg.get("muted").and_then(|v| v.as_bool()).unwrap_or(false);
                                    let vs = ws.voice_sessions.read();
                                    if let Some(participants) = vs.get(&channel) {
                                        let msg = json!({
                                            "type": "voice_user_muted",
                                            "username": username,
                                            "channel": channel,
                                            "muted": muted
                                        }).to_string();
                                        for p in participants {
                                            if p != &username {
                                                ws.send_to_user(p, &msg);
                                            }
                                        }
                                    }
                                }
                            }
                            // WebRTC signaling - forward to target
                            "webrtc_offer" | "webrtc_answer" | "webrtc_ice_candidate" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(from_user) = username {
                                    let target = ws_msg.get("target").and_then(|v| v.as_str()).unwrap_or("");
                                    if !target.is_empty() {
                                        let mut fwd = ws_msg.clone();
                                        fwd["from"] = json!(from_user);
                                        ws.send_to_user(target, &fwd.to_string());
                                    }
                                }
                            }
                            // Screen share signaling
                            "screen_share_start" | "screen_share_stop" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(from_user) = username {
                                    let channel = ws_msg.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    let event_type = if msg_type == "screen_share_start" {
                                        "screen_share_started"
                                    } else {
                                        "screen_share_stopped"
                                    };
                                    let vs = ws.voice_sessions.read();
                                    if let Some(participants) = vs.get(&channel) {
                                        let msg = json!({
                                            "type": event_type,
                                            "username": from_user,
                                            "channel": channel
                                        }).to_string();
                                        for p in participants {
                                            if p != &from_user {
                                                ws.send_to_user(p, &msg);
                                            }
                                        }
                                    }
                                }
                            }
                            "screen_offer" | "screen_answer" | "screen_ice_candidate" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(from_user) = username {
                                    let target = ws_msg.get("target").and_then(|v| v.as_str()).unwrap_or("");
                                    if !target.is_empty() {
                                        let mut fwd = ws_msg.clone();
                                        fwd["from"] = json!(from_user);
                                        ws.send_to_user(target, &fwd.to_string());
                                    }
                                }
                            }
                            "delete_message" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let msg_id = ws_msg.get("id").and_then(|v| v.as_str()).unwrap_or("");
                                    let channel = ws_msg.get("channel").and_then(|v| v.as_str()).unwrap_or("");
                                    let target_id = ws_msg.get("target").and_then(|v| v.as_str()).unwrap_or("");
                                    
                                    if !msg_id.is_empty() {
                                        let mut success = false;
                                        if channel == "general" {
                                            let mut messages = st.get_messages();
                                            if let Some(pos) = messages.iter().position(|m| m.id == msg_id && m.username == username) {
                                                messages.remove(pos);
                                                st.save_messages(&messages);
                                                success = true;
                                            }
                                        } else if channel == "room" && !target_id.is_empty() {
                                            let mut rooms = st.get_rooms();
                                            if let Some(room) = rooms.get_mut(target_id) {
                                                if let Some(pos) = room.messages.iter().position(|m| m.id == msg_id && m.username == username) {
                                                    room.messages.remove(pos);
                                                    let members = room.members.clone();
                                                    st.save_rooms(&rooms);
                                                    success = true;
                                                    
                                                    // Broadcast to room members specifically
                                                    let msg_json = json!({
                                                        "type": "message_deleted",
                                                        "id": msg_id,
                                                        "channel": channel,
                                                        "target": target_id
                                                    }).to_string();
                                                    for member in &members {
                                                        ws.send_to_user(member, &msg_json);
                                                    }
                                                }
                                            }
                                        } else if channel == "private" && !target_id.is_empty() {
                                            let mut pm = st.get_private_messages();
                                            let key = convo_key(&username, target_id);
                                            if let Some(msgs) = pm.get_mut(&key) {
                                                if let Some(pos) = msgs.iter().position(|m| m.id == msg_id && m.from == username) {
                                                    msgs.remove(pos);
                                                    st.save_private_messages(&pm);
                                                    success = true;
                                                    
                                                    // Send to both users
                                                    let msg_json = json!({
                                                        "type": "message_deleted",
                                                        "id": msg_id,
                                                        "channel": channel,
                                                        "target": target_id
                                                    }).to_string();
                                                    ws.send_to_user(&username, &msg_json);
                                                    ws.send_to_user(target_id, &msg_json);
                                                }
                                            }
                                        }

                                        // For general, broadcast to everyone
                                        if success && channel == "general" {
                                            let broadcast_msg = json!({
                                                "type": "message_deleted",
                                                "id": msg_id,
                                                "channel": channel
                                            }).to_string();
                                            ws.broadcast(&broadcast_msg);
                                        }
                                    }
                                }
                            }
                            "edit_message" => {
                                let username = {
                                    let conns = ws.connections.read();
                                    conns.get(&my_sid).map(|(u, _)| u.clone())
                                };
                                if let Some(username) = username {
                                    let msg_id = ws_msg.get("id").and_then(|v| v.as_str()).unwrap_or("");
                                    let new_text = ws_msg.get("new_text").and_then(|v| v.as_str()).unwrap_or("");
                                    let channel = ws_msg.get("channel").and_then(|v| v.as_str()).unwrap_or("");
                                    let target_id = ws_msg.get("target").and_then(|v| v.as_str()).unwrap_or("");
                                    
                                    if !msg_id.is_empty() && !new_text.trim().is_empty() {
                                        let mut success = false;
                                        if channel == "general" {
                                            let mut messages = st.get_messages();
                                            if let Some(m) = messages.iter_mut().find(|m| m.id == msg_id && m.username == username) {
                                                m.text = new_text.trim().to_string();
                                                success = true;
                                            }
                                            if success { st.save_messages(&messages); }
                                        } else if channel == "room" && !target_id.is_empty() {
                                            let mut rooms = st.get_rooms();
                                            if let Some(room) = rooms.get_mut(target_id) {
                                                if let Some(m) = room.messages.iter_mut().find(|m| m.id == msg_id && m.username == username) {
                                                    m.text = new_text.trim().to_string();
                                                    success = true;
                                                }
                                                if success {
                                                    let members = room.members.clone();
                                                    st.save_rooms(&rooms);
                                                    
                                                    // Broadcast to room members
                                                    let msg_json = json!({
                                                        "type": "message_edited",
                                                        "id": msg_id,
                                                        "new_text": new_text.trim(),
                                                        "channel": channel,
                                                        "target": target_id
                                                    }).to_string();
                                                    for member in &members {
                                                        ws.send_to_user(member, &msg_json);
                                                    }
                                                }
                                            }
                                        } else if channel == "private" && !target_id.is_empty() {
                                            let mut pm = st.get_private_messages();
                                            let key = convo_key(&username, target_id);
                                            if let Some(msgs) = pm.get_mut(&key) {
                                                if let Some(m) = msgs.iter_mut().find(|m| m.id == msg_id && m.from == username) {
                                                    m.text = new_text.trim().to_string();
                                                    success = true;
                                                }
                                                if success {
                                                    st.save_private_messages(&pm);
                                                    let msg_json = json!({
                                                        "type": "message_edited",
                                                        "id": msg_id,
                                                        "new_text": new_text.trim(),
                                                        "channel": channel,
                                                        "target": target_id
                                                    }).to_string();
                                                    ws.send_to_user(&username, &msg_json);
                                                    ws.send_to_user(target_id, &msg_json);
                                                }
                                            }
                                        }

                                        // For general, broadcast to everyone
                                        if success && channel == "general" {
                                            let broadcast_msg = json!({
                                                "type": "message_edited",
                                                "id": msg_id,
                                                "new_text": new_text.trim(),
                                                "channel": channel
                                            }).to_string();
                                            ws.broadcast(&broadcast_msg);
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                actix_ws::Message::Ping(bytes) => {
                    let _ = session_clone.pong(&bytes).await;
                }
                actix_ws::Message::Close(_) => {
                    break;
                }
                _ => {}
            }
        }

        // Cleanup on disconnect
        let username = {
            let mut conns = ws.connections.write();
            let username = conns.get(&my_sid).map(|(u, _)| u.clone());
            conns.remove(&my_sid);
            username
        };

        if let Some(username) = &username {
            {
                let mut sids = ws.user_sids.write();
                sids.remove(username);
            }

            // Clean up voice sessions
            {
                let mut vs = ws.voice_sessions.write();
                let channels_to_clean: Vec<String> = vs.iter()
                    .filter(|(_, participants)| participants.contains(username))
                    .map(|(channel, _)| channel.clone())
                    .collect();

                for channel in channels_to_clean {
                    if let Some(participants) = vs.get_mut(&channel) {
                        participants.remove(username);
                        let remaining: Vec<String> = participants.iter().cloned().collect();
                        if participants.is_empty() {
                            vs.remove(&channel);
                        }
                        // Notify remaining
                        let msg = json!({
                            "type": "voice_user_left",
                            "username": username,
                            "channel": channel.clone(),
                            "participants": remaining.clone()
                        }).to_string();
                        for p in &remaining {
                            ws.send_to_user(p, &msg);
                        }

                        // If general channel, broadcast general update
                        if channel == "general" {
                            let update_msg = json!({
                                "type": "general_voice_participants_update",
                                "participants": remaining
                            }).to_string();
                            ws.broadcast(&update_msg);
                        }
                    }
                }
            }

            ws.broadcast_user_list(&st);

            // Broadcast that the user is now offline
            let offline_msg = json!({
                "type": "user_offline",
                "username": username
            }).to_string();
            ws.broadcast(&offline_msg);
        }

        // Wait for broadcast to finish sending before dropping
        let _ = broadcast_handle.await;
    });

    Ok(response)
}
