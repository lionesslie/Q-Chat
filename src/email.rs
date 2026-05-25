use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use rand::Rng;

pub fn generate_verification_code() -> String {
    let mut rng = rand::thread_rng();
    let code: u32 = rng.gen_range(100000..999999);
    code.to_string()
}

use lettre::message::{header, MultiPart, SinglePart};

pub async fn send_verification_email(to_email: &str, code: &str) -> Result<(), String> {
    let plain_text = format!("Merhaba,\n\nQ-Chat hesabınızı oluşturmak için doğrulama kodunuz:\n\n{}", code);
    
    let html_content = format!(
        r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: #000000;
            color: #ffffff;
            margin: 0;
            padding: 40px 0;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background: #09090b;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 40px;
            text-align: center;
        }}
        .logo {{
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
            margin-bottom: 24px;
            color: #ffffff;
        }}
        .title {{
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #ffffff;
        }}
        .message {{
            font-size: 15px;
            color: #cccccc;
            line-height: 1.5;
            margin-bottom: 32px;
        }}
        .code-box {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 24px;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 4px;
            color: #ffffff;
            margin: 0 auto 32px;
            display: inline-block;
        }}
        .footer {{
            font-size: 12px;
            color: #888888;
            margin-top: 32px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 24px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">Q-Chat</div>
        <div class="title">E-posta Doğrulama</div>
        <div class="message">
            Merhaba, <br><br>
            Q-Chat'e hoş geldiniz! Hesabınızı güvenle oluşturmak için aşağıdaki doğrulama kodunu kullanabilirsiniz.
        </div>
        <div class="code-box">{}</div>
        <div class="footer">
            Bu kodu siz talep etmediyseniz, lütfen bu e-postayı dikkate almayınız.<br>
            &copy; 2024 Q-Chat
        </div>
    </div>
</body>
</html>
        "#,
        code
    );

    let email = Message::builder()
        .from("Q-Chat <q.chat.verify@gmail.com>".parse().map_err(|_| "Geçersiz gönderici adresi")?)
        .to(to_email.parse().map_err(|_| "Geçersiz e-posta adresi")?)
        .subject("Q-Chat - E-posta Doğrulama Kodu")
        .multipart(
            MultiPart::alternative()
                .singlepart(
                    SinglePart::builder()
                        .header(header::ContentType::TEXT_PLAIN)
                        .body(plain_text),
                )
                .singlepart(
                    SinglePart::builder()
                        .header(header::ContentType::TEXT_HTML)
                        .body(html_content),
                ),
        )
        .map_err(|e| format!("E-posta oluşturulamadı: {}", e))?;

    let creds = Credentials::new(
        "q.chat.verify@gmail.com".to_string(),
        "bokx jvwo ygix fsmv".to_string(),
    );

    let mailer: AsyncSmtpTransport<Tokio1Executor> = AsyncSmtpTransport::<Tokio1Executor>::relay("smtp.gmail.com")
        .map_err(|e| format!("SMTP sunucusuna bağlanılamadı: {}", e))?
        .credentials(creds)
        .build();

    mailer.send(email).await.map_err(|e| format!("E-posta gönderilemedi: {}", e))?;
    
    Ok(())
}
