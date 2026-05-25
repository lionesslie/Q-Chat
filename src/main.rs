pub mod models;
pub mod storage;
pub mod auth;
pub mod chat;
pub mod profile;
pub mod projects;
pub mod ws;
pub mod email;

use actix_web::{web, App, HttpServer, HttpResponse};
use actix_files::Files;
use actix_multipart::form::MultipartFormConfig;
use std::sync::Arc;
use std::io::BufReader;

async fn index() -> HttpResponse {
    let html = std::fs::read_to_string("templates/index.html")
        .unwrap_or_else(|_| "<h1>Q-Chat</h1><p>Template not found</p>".to_string());
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html)
}

/// Macro to build the app with all routes (avoids complex return types)
macro_rules! make_app {
    ($storage:expr, $ws_state:expr) => {
        App::new()
            .app_data(web::Data::new($storage.clone()))
            .app_data(web::Data::new($ws_state.clone()))
            .app_data(web::PayloadConfig::new(107_374_182_400)) // 100 GB limit
            .app_data(
                MultipartFormConfig::default()
                    .total_limit(107_374_182_400) // 100 GB total
                    .memory_limit(52_428_800)     // 50 MB memory buffer
            )
            .route("/", web::get().to(index))
            .route("/register", web::post().to(auth::register))
            .route("/auth/send-code", web::post().to(auth::send_code))
            .route("/login", web::post().to(auth::login))
            .route("/logout", web::post().to(auth::logout))
            .route("/me", web::get().to(auth::me))
            .route("/profile/avatar", web::post().to(profile::update_avatar))
            .route("/profile/bio", web::post().to(profile::update_bio))
            .route("/user/{username}/info", web::get().to(profile::user_info))
            .route("/history/general", web::get().to(chat::general_history))
            .route("/history/private/{other_user}", web::get().to(chat::private_history))
            .route("/rooms/list", web::get().to(chat::rooms_list))
            .route("/rooms/{room_id}/history", web::get().to(chat::room_history))
            .route("/projects/upload", web::post().to(projects::upload_project))
            .route("/projects/list", web::get().to(projects::list_projects))
            .route("/projects/{id}", web::get().to(projects::get_project))
            .route("/projects/{id}/download", web::get().to(projects::download_project))
            .route("/ws", web::get().to(ws::ws_handler))
            .service(Files::new("/static", "static").show_files_listing())
    };
}


/// Start only the HTTP server on localhost (used by desktop launcher)
pub async fn start_server_localhost() -> std::io::Result<()> {
    rustls::crypto::ring::default_provider().install_default().ok();
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let storage = storage::Storage::new("data");
    let ws_state = Arc::new(ws::WsState::new());

    log::info!("Q-Chat Server starting on http://127.0.0.1:442");

    HttpServer::new(move || {
        make_app!(storage, ws_state)
    })
    .bind("0.0.0.0:442")?
    .run()
    .await
}

/// Run the full server (HTTP + optional HTTPS)
/// Called by the server binary.
pub fn main_server() -> std::io::Result<()> {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime");

    rt.block_on(async_main_server())
}

async fn async_main_server() -> std::io::Result<()> {
    rustls::crypto::ring::default_provider().install_default().ok();
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("Q-Chat Rust Server starting...");

    let storage = storage::Storage::new("data");
    let ws_state = Arc::new(ws::WsState::new());

    log::info!("Server running at http://0.0.0.0:442 (HTTP)");

    let storage2 = storage.clone();
    let ws_state2 = ws_state.clone();

    // HTTP server on port 442
    let http_server = HttpServer::new(move || {
        make_app!(storage2, ws_state2)
    })
    .bind("0.0.0.0:442")?
    .run();

    // Try to start HTTPS server (optional - only if certs exist)
    if std::path::Path::new("cert.pem").exists() && std::path::Path::new("key.pem").exists() {
        log::info!("Server running at https://0.0.0.0:443 (HTTPS)");
        let tls_config = load_tls_config();
        let https_server = HttpServer::new(move || {
            make_app!(storage, ws_state)
        })
        .bind_rustls_0_23("0.0.0.0:443", tls_config)?
        .run();
        tokio::try_join!(http_server, https_server)?;
    } else {
        log::info!("TLS certificates not found, running HTTP only");
        http_server.await?;
    }

    Ok(())
}

fn load_tls_config() -> rustls::ServerConfig {
    let cert_file = &mut BufReader::new(
        std::fs::File::open("cert.pem").expect("cert.pem not found")
    );
    let key_file = &mut BufReader::new(
        std::fs::File::open("key.pem").expect("key.pem not found")
    );

    let cert_chain: Vec<rustls::pki_types::CertificateDer> = rustls_pemfile::certs(cert_file)
        .filter_map(|r| r.ok())
        .collect();

    let key = rustls_pemfile::private_key(key_file)
        .expect("Failed to read private key")
        .expect("No private key found in key.pem");

    rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(cert_chain, key)
        .expect("Failed to build TLS config")
}

pub fn main() {
    if let Err(e) = main_server() {
        eprintln!("Server error: {}", e);
    }
}
