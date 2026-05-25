use actix_web::{web, HttpRequest, HttpResponse};
use actix_multipart::Multipart;
use futures_util::StreamExt;
use serde_json::json;
use crate::models::*;
use crate::storage::Storage;
use std::io::Write;

fn get_session_username(req: &HttpRequest) -> Option<String> {
    req.cookie("q_session").map(|c| c.value().to_string())
}

pub async fn upload_project(
    req: HttpRequest,
    storage: web::Data<Storage>,
    mut payload: Multipart,
) -> HttpResponse {
    let username = match get_session_username(&req) {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(json!({"error": "Giriş yapmalısınız"})),
    };

    let mut name = String::new();
    let mut description = String::new();
    let mut tags_str = String::new();
    let mut original_filename = String::new();
    let mut image_data: Vec<u8> = Vec::new();
    let mut original_image_filename = String::new();

    let project_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
    let mut stored_filename = String::new();
    let mut file_size: u64 = 0;
    let mut file_path_opt: Option<std::path::PathBuf> = None;

    while let Some(Ok(mut field)) = payload.next().await {
        let field_name = field.name().map(|s| s.to_string()).unwrap_or_default();

        match field_name.as_str() {
            "name" => {
                while let Some(Ok(chunk)) = field.next().await {
                    name.push_str(&String::from_utf8_lossy(&chunk));
                }
            }
            "description" => {
                while let Some(Ok(chunk)) = field.next().await {
                    description.push_str(&String::from_utf8_lossy(&chunk));
                }
            }
            "tags" => {
                while let Some(Ok(chunk)) = field.next().await {
                    tags_str.push_str(&String::from_utf8_lossy(&chunk));
                }
            }
            "file" => {
                if let Some(cd) = field.content_disposition() {
                    original_filename = cd.get_filename().unwrap_or("unknown").to_string();
                }
                
                let safe_filename = sanitize_filename::sanitize(&original_filename);
                stored_filename = format!("{}_{}", project_id, safe_filename);
                let file_path = storage.projects_dir().join(&stored_filename);
                file_path_opt = Some(file_path.clone());
                
                if let Ok(mut f) = std::fs::File::create(&file_path) {
                    while let Some(Ok(chunk)) = field.next().await {
                        file_size += chunk.len() as u64;
                        if file_size > 100_u64 * 1024 * 1024 * 1024 {
                            drop(f);
                            let _ = std::fs::remove_file(&file_path);
                            return HttpResponse::BadRequest().json(json!({"error": "Dosya çok büyük (max 100GB)"}));
                        }
                        if let Err(_) = f.write_all(&chunk) {
                            drop(f);
                            let _ = std::fs::remove_file(&file_path);
                            return HttpResponse::InternalServerError().json(json!({"error": "Dosya yazılamadı"}));
                        }
                    }
                } else {
                    return HttpResponse::InternalServerError().json(json!({"error": "Dosya oluşturulamadı"}));
                }
            }
            "image" => {
                if let Some(cd) = field.content_disposition() {
                    original_image_filename = cd.get_filename().unwrap_or("unknown").to_string();
                }
                while let Some(Ok(chunk)) = field.next().await {
                    image_data.extend_from_slice(&chunk);
                }
            }
            _ => {
                while let Some(_) = field.next().await {}
            }
        }
    }

    if name.trim().is_empty() {
        if let Some(p) = file_path_opt { let _ = std::fs::remove_file(p); }
        return HttpResponse::BadRequest().json(json!({"error": "Proje adı gereklidir"}));
    }

    if file_size == 0 {
        if let Some(p) = file_path_opt { let _ = std::fs::remove_file(p); }
        return HttpResponse::BadRequest().json(json!({"error": "Dosya gereklidir"}));
    }

    // Save image if present
    let mut stored_image_filename = None;
    if !image_data.is_empty() {
        // Max image size 20MB
        if image_data.len() > 20 * 1024 * 1024 {
            if let Some(p) = file_path_opt { let _ = std::fs::remove_file(p); }
            return HttpResponse::BadRequest().json(json!({"error": "Görsel çok büyük (max 20MB)"}));
        }
        let safe_img_filename = sanitize_filename::sanitize(&original_image_filename);
        let img_filename = format!("{}_img_{}", project_id, safe_img_filename);
        let img_path = storage.projects_dir().join(&img_filename);
        if let std::io::Result::Ok(_) = std::fs::write(&img_path, &image_data) {
            stored_image_filename = Some(img_filename);
        }
    }

    let tags: Vec<String> = tags_str
        .split(',')
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .collect();

    let project = Project {
        id: project_id.clone(),
        name: name.trim().to_string(),
        description: description.trim().to_string(),
        uploader: username,
        filename: stored_filename,
        original_filename: sanitize_filename::sanitize(&original_filename),
        size: file_size,
        tags,
        created_at: chrono::Utc::now().to_rfc3339(),
        download_count: 0,
        image_filename: stored_image_filename,
    };

    let mut projects = storage.get_projects();
    projects.push(project.clone());
    storage.save_projects(&projects);

    HttpResponse::Ok().json(json!({
        "success": true,
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "uploader": project.uploader,
            "original_filename": project.original_filename,
            "size": project.size,
            "tags": project.tags,
            "created_at": project.created_at,
            "download_count": project.download_count,
            "image_filename": project.image_filename
        }
    }))
}

pub async fn list_projects(storage: web::Data<Storage>) -> HttpResponse {
    let projects = storage.get_projects();
    let project_list: Vec<serde_json::Value> = projects.iter().map(|p| {
        json!({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "uploader": p.uploader,
            "original_filename": p.original_filename,
            "size": p.size,
            "tags": p.tags,
            "created_at": p.created_at,
            "download_count": p.download_count,
            "image_filename": p.image_filename
        })
    }).collect();
    HttpResponse::Ok().json(project_list)
}

pub async fn get_project(
    storage: web::Data<Storage>,
    path: web::Path<String>,
) -> HttpResponse {
    let project_id = path.into_inner();
    let projects = storage.get_projects();

    match projects.iter().find(|p| p.id == project_id) {
        Some(p) => {
            HttpResponse::Ok().json(json!({
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "uploader": p.uploader,
                "original_filename": p.original_filename,
                "size": p.size,
                "tags": p.tags,
                "created_at": p.created_at,
                "download_count": p.download_count,
                "image_filename": p.image_filename
            }))
        }
        None => HttpResponse::NotFound().json(json!({"error": "Proje bulunamadı"})),
    }
}

pub async fn download_project(
    storage: web::Data<Storage>,
    path: web::Path<String>,
) -> HttpResponse {
    let project_id = path.into_inner();
    let mut projects = storage.get_projects();

    let project = match projects.iter_mut().find(|p| p.id == project_id) {
        Some(p) => {
            p.download_count += 1;
            p.clone()
        }
        None => return HttpResponse::NotFound().json(json!({"error": "Proje bulunamadı"})),
    };

    storage.save_projects(&projects);

    let file_path = storage.projects_dir().join(&project.filename);
    match std::fs::read(&file_path) {
        Ok(data) => {
            let mime = mime_guess::from_path(&project.original_filename)
                .first_or_octet_stream();
            HttpResponse::Ok()
                .insert_header(("Content-Type", mime.to_string()))
                .insert_header((
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", project.original_filename),
                ))
                .body(data)
        }
        Err(_) => HttpResponse::NotFound().json(json!({"error": "Dosya bulunamadı"})),
    }
}
