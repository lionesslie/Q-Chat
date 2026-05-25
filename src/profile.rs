use actix_web::{web, HttpRequest, HttpResponse};
use serde_json::json;
use crate::models::*;
use crate::storage::Storage;

pub async fn update_avatar(
    req: HttpRequest,
    storage: web::Data<Storage>,
    body: web::Json<AvatarRequest>,
) -> HttpResponse {
    let username = match crate::auth::get_active_username(&req, &storage) {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(json!({"error": "Giriş yapmalısınız"})),
    };

    let avatar_data = &body.avatar;

    if avatar_data.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Avatar verisi gerekli"}));
    }

    if avatar_data.len() > 700000 {
        return HttpResponse::BadRequest().json(json!({"error": "Avatar dosyası çok büyük (max 500KB)"}));
    }

    let mut users = storage.get_users();
    match users.get_mut(&username) {
        Some(user) => {
            user.avatar = Some(avatar_data.clone());
            storage.save_users(&users);
            HttpResponse::Ok().json(json!({"success": true, "avatar": avatar_data}))
        }
        None => HttpResponse::NotFound().json(json!({"error": "Kullanıcı bulunamadı"})),
    }
}

pub async fn update_bio(
    req: HttpRequest,
    storage: web::Data<Storage>,
    body: web::Json<BioRequest>,
) -> HttpResponse {
    let username = match crate::auth::get_active_username(&req, &storage) {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(json!({"error": "Giriş yapmalısınız"})),
    };

    let bio_data = body.bio.trim().to_string();

    let mut users = storage.get_users();
    match users.get_mut(&username) {
        Some(user) => {
            user.bio = Some(bio_data.clone());
            storage.save_users(&users);
            HttpResponse::Ok().json(json!({"success": true, "bio": bio_data}))
        }
        None => HttpResponse::NotFound().json(json!({"error": "Kullanıcı bulunamadı"})),
    }
}

pub async fn user_info(
    storage: web::Data<Storage>,
    path: web::Path<String>,
) -> HttpResponse {
    let username = path.into_inner();
    let users = storage.get_users();

    match users.get(&username) {
        Some(user) => {
            HttpResponse::Ok().json(json!({
                "username": username,
                "avatar": user.avatar,
                "avatar_color": user.avatar_color,
                "created_at": user.created_at,
                "bio": user.bio
            }))
        }
        None => HttpResponse::NotFound().json(json!({})),
    }
}
