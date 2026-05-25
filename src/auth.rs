use actix_web::{web, HttpRequest, HttpResponse};
use serde_json::json;
use crate::models::*;
use crate::storage::{Storage, hash_password};
use crate::email::{generate_verification_code, send_verification_email};

fn get_session_username(req: &HttpRequest) -> Option<String> {
    req.cookie("q_session").map(|c| c.value().to_string())
}

pub fn get_client_ip(req: &HttpRequest) -> String {
    // Check X-Forwarded-For header first (for proxied requests)
    if let Some(forwarded) = req.headers().get("X-Forwarded-For") {
        if let Ok(val) = forwarded.to_str() {
            if let Some(ip) = val.split(',').next() {
                let ip = ip.trim().to_string();
                if !ip.is_empty() {
                    return ip;
                }
            }
        }
    }
    // Check X-Real-IP header
    if let Some(real_ip) = req.headers().get("X-Real-IP") {
        if let Ok(val) = real_ip.to_str() {
            let ip = val.trim().to_string();
            if !ip.is_empty() {
                return ip;
            }
        }
    }
    // Fall back to peer address
    req.peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub fn get_active_username(req: &HttpRequest, storage: &Storage) -> Option<String> {
    // First check cookie session
    let mut username = get_session_username(req);

    // If no cookie, try IP-based auto-login
    if username.is_none() {
        let client_ip = get_client_ip(req);
        username = storage.get_username_by_ip(&client_ip);
    }
    
    username
}

pub async fn register(
    req: HttpRequest,
    storage: web::Data<Storage>,
    body: web::Json<RegisterRequest>,
) -> HttpResponse {
    let username = body.username.trim().to_string();
    let email = body.email.trim().to_string();
    let password = body.password.trim().to_string();
    let verification_code = body.verification_code.trim().to_string();

    if username.is_empty() || email.is_empty() || password.is_empty() || verification_code.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Tüm alanlar gereklidir"}));
    }

    if username.len() < 3 {
        return HttpResponse::BadRequest().json(json!({"error": "Kullanıcı adı en az 3 karakter olmalıdır"}));
    }

    if !email.contains('@') || !email.contains('.') {
        return HttpResponse::BadRequest().json(json!({"error": "Geçerli bir e-posta adresi girin"}));
    }

    if password.len() < 4 {
        return HttpResponse::BadRequest().json(json!({"error": "Şifre en az 4 karakter olmalıdır"}));
    }

    let mut users = storage.get_users();

    let lower = username.to_lowercase();
    for key in users.keys() {
        if key.to_lowercase() == lower {
            return HttpResponse::BadRequest().json(json!({"error": "Bu kullanıcı adı zaten alınmış"}));
        }
    }

    for u_data in users.values() {
        if u_data.email.to_lowercase() == email.to_lowercase() {
            return HttpResponse::BadRequest().json(json!({"error": "Bu e-posta zaten kullanılıyor"}));
        }
    }

    let stored_code = storage.get_verification_code(&email);
    match stored_code {
        Some(code) if code == verification_code => {
            storage.remove_verification_code(&email);
        }
        _ => {
            return HttpResponse::BadRequest().json(json!({"error": "Geçersiz veya süresi dolmuş doğrulama kodu"}));
        }
    }

    let hash_val = std::collections::hash_map::DefaultHasher::new();
    use std::hash::{Hash, Hasher};
    let mut hasher = hash_val;
    username.hash(&mut hasher);
    let h = hasher.finish();
    let lightness = (h % 60) + 20;

    users.insert(username.clone(), User {
        password: hash_password(&password),
        email,
        created_at: chrono::Utc::now().to_rfc3339(),
        avatar_color: format!("hsl(0, 0%, {}%)", lightness),
        avatar: None,
        bio: None,
    });
    storage.save_users(&users);

    // Save IP session for auto-login
    let client_ip = get_client_ip(&req);
    storage.set_ip_session(&client_ip, &username);

    use actix_web::cookie::{Cookie, SameSite};
    let cookie = Cookie::build("q_session", username.clone())
        .path("/")
        .same_site(SameSite::Lax)
        .http_only(true)
        .finish();

    HttpResponse::Ok()
        .cookie(cookie)
        .json(json!({"success": true, "username": username}))
}

pub async fn login(
    req: HttpRequest,
    storage: web::Data<Storage>,
    body: web::Json<LoginRequest>,
) -> HttpResponse {
    let username = body.username.trim().to_string();
    let password = body.password.trim().to_string();

    if username.is_empty() || password.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Kullanıcı adı ve şifre gereklidir"}));
    }

    let users = storage.get_users();

    let actual_username = users.keys()
        .find(|k| k.to_lowercase() == username.to_lowercase())
        .cloned();

    let actual_username = match actual_username {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(json!({"error": "Kullanıcı bulunamadı"})),
    };

    if users[&actual_username].password != hash_password(&password) {
        return HttpResponse::Unauthorized().json(json!({"error": "Yanlış şifre"}));
    }

    // Save IP session for auto-login
    let client_ip = get_client_ip(&req);
    storage.set_ip_session(&client_ip, &actual_username);

    use actix_web::cookie::{Cookie, SameSite};
    let cookie = Cookie::build("q_session", actual_username.clone())
        .path("/")
        .same_site(SameSite::Lax)
        .http_only(true)
        .finish();

    HttpResponse::Ok()
        .cookie(cookie)
        .json(json!({"success": true, "username": actual_username}))
}

pub async fn logout(
    req: HttpRequest,
    storage: web::Data<Storage>,
) -> HttpResponse {
    // Clear IP session
    let client_ip = get_client_ip(&req);
    storage.remove_ip_session(&client_ip);

    use actix_web::cookie::Cookie;
    let cookie = Cookie::build("q_session", "")
        .path("/")
        .max_age(actix_web::cookie::time::Duration::seconds(0))
        .finish();

    HttpResponse::Ok()
        .cookie(cookie)
        .json(json!({"success": true}))
}

pub async fn me(
    req: HttpRequest,
    storage: web::Data<Storage>,
) -> HttpResponse {
    let username = match get_active_username(&req, &storage) {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(json!({"authenticated": false})),
    };

    let users = storage.get_users();
    let user = match users.get(&username) {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(json!({"authenticated": false})),
    };

    HttpResponse::Ok().json(json!({
        "authenticated": true,
        "username": username,
        "email": user.email,
        "avatar": user.avatar,
        "avatar_color": user.avatar_color
    }))
}

pub async fn send_code(
    storage: web::Data<Storage>,
    body: web::Json<SendVerificationRequest>,
) -> HttpResponse {
    let username = body.username.trim().to_string();
    let email = body.email.trim().to_string();

    if username.is_empty() || email.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "Kullanıcı adı ve e-posta gereklidir"}));
    }

    if username.len() < 3 {
        return HttpResponse::BadRequest().json(json!({"error": "Kullanıcı adı en az 3 karakter olmalıdır"}));
    }

    if !email.contains('@') || !email.contains('.') {
        return HttpResponse::BadRequest().json(json!({"error": "Geçerli bir e-posta adresi girin"}));
    }

    let users = storage.get_users();

    let lower = username.to_lowercase();
    for key in users.keys() {
        if key.to_lowercase() == lower {
            return HttpResponse::BadRequest().json(json!({"error": "Bu kullanıcı adı zaten alınmış"}));
        }
    }

    for u_data in users.values() {
        if u_data.email.to_lowercase() == email.to_lowercase() {
            return HttpResponse::BadRequest().json(json!({"error": "Bu e-posta zaten kullanılıyor"}));
        }
    }

    let code = generate_verification_code();
    if let Err(e) = send_verification_email(&email, &code).await {
        return HttpResponse::InternalServerError().json(json!({"error": e}));
    }

    storage.set_verification_code(&email, &code);

    HttpResponse::Ok().json(json!({"success": true, "message": "Doğrulama kodu e-posta adresinize gönderildi"}))
}
