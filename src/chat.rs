use actix_web::{web, HttpRequest, HttpResponse};
use serde_json::json;
use crate::storage::Storage;

pub async fn general_history(storage: web::Data<Storage>) -> HttpResponse {
    let msgs = storage.get_messages();
    let start = if msgs.len() > 100 { msgs.len() - 100 } else { 0 };
    HttpResponse::Ok().json(&msgs[start..])
}

pub async fn private_history(
    req: HttpRequest,
    storage: web::Data<Storage>,
    path: web::Path<String>,
) -> HttpResponse {
    let username = match crate::auth::get_active_username(&req, &storage) {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(json!([])),
    };

    let other_user = path.into_inner();
    let pm = storage.get_private_messages();
    let key = crate::storage::convo_key(&username, &other_user);

    match pm.get(&key) {
        Some(msgs) => {
            let start = if msgs.len() > 100 { msgs.len() - 100 } else { 0 };
            HttpResponse::Ok().json(&msgs[start..])
        }
        None => HttpResponse::Ok().json(json!([])),
    }
}

pub async fn rooms_list(storage: web::Data<Storage>) -> HttpResponse {
    let rooms = storage.get_rooms();
    let room_list: Vec<serde_json::Value> = rooms.iter().map(|(id, room)| {
        json!({
            "id": id,
            "name": room.name,
            "creator": room.creator,
            "members_count": room.members.len(),
            "created_at": room.created_at
        })
    }).collect();
    HttpResponse::Ok().json(room_list)
}

pub async fn room_history(
    storage: web::Data<Storage>,
    path: web::Path<String>,
) -> HttpResponse {
    let room_id = path.into_inner();
    let rooms = storage.get_rooms();

    match rooms.get(&room_id) {
        Some(room) => {
            let msgs = &room.messages;
            let start = if msgs.len() > 100 { msgs.len() - 100 } else { 0 };
            HttpResponse::Ok().json(&msgs[start..])
        }
        None => HttpResponse::NotFound().json(json!([])),
    }
}
