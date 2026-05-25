#![windows_subsystem = "windows"]

use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::{WindowBuilder, Icon};
use tao::dpi::LogicalSize;
use wry::WebViewBuilder;

/// İkonu belleğe alıp tao::window::Icon nesnesine çeviren yardımcı fonksiyon
fn load_icon() -> Icon {
    // İkonu uygulamanın içine bayt olarak gömüyoruz (src'nin bir üst dizininde olduğunu varsayıyoruz)
    let icon_bytes = include_bytes!("icon.ico");
    
    let image = image::load_from_memory(icon_bytes)
        .expect("İkon dosyası bellekten okunamadı")
        .into_rgba8();
        
    let (width, height) = image.dimensions();
    let rgba = image.into_raw();
    
    Icon::from_rgba(rgba, width, height).expect("İkon oluşturulamadı")
}

fn main() {
    // Actix-web sunucusunu arka planda başlatma
    let _server_thread = std::thread::spawn(|| {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Tokio runtime oluşturulamadı");

        rt.block_on(async {
            if let Err(e) = q_chat::start_server_localhost().await {
                eprintln!("Sunucu hatası: {}", e);
            }
        });
    });

    std::thread::sleep(std::time::Duration::from_millis(800));

    let event_loop = EventLoop::new();

    // Simgemizi yüklüyoruz
    let app_icon = load_icon();

    // WindowBuilder'a .with_window_icon() ekliyoruz
    let window = WindowBuilder::new()
        .with_title("Q-Chat")
        .with_inner_size(LogicalSize::new(1280.0, 720.0))
        .with_min_inner_size(LogicalSize::new(800.0, 500.0))
        .with_window_icon(Some(app_icon)) // <--- SİMGE BURADA EKLENİYOR
        .build(&event_loop)
        .expect("Pencere oluşturulamadı");

    let _webview = WebViewBuilder::new()
        .with_url("https://q-chat.duckdns.org/")
        .with_devtools(cfg!(debug_assertions))
        .with_incognito(false)
        .with_background_color((13, 17, 23, 255))
        .with_clipboard(true)
        .with_autoplay(true)
        .build(&window)
        .expect("WebView oluşturulamadı");

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        match event {
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });
}