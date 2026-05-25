# Q-Chat

Q-Chat is a secure, high-performance web-based chat application. Built with a fast **Rust** backend and a responsive frontend using **JavaScript, HTML, and CSS**, it provides a seamless real-time messaging experience. 

## <img src="https://cdn.jsdelivr.net/npm/feather-icons/dist/icons/zap.svg" width="24" height="24" align="text-bottom"> Features

- **Blazing Fast Backend:** Powered by Rust for memory safety, concurrency, and high performance.
- **Interactive UI:** A clean and responsive web interface built with vanilla web technologies (HTML, CSS, JS).
- **Secure Communication:** Out-of-the-box SSL/TLS support (`cert.pem` & `key.pem`) to ensure your data stays encrypted and secure.
- **Template Engine:** Dynamic HTML rendering using backend templates.

## <img src="https://cdn.jsdelivr.net/npm/feather-icons/dist/icons/folder.svg" width="24" height="24" align="text-bottom"> Project Structure

- `src/` - Rust source code for the backend server.
- `static/` - Static web assets including CSS stylesheets and client-side JavaScript.
- `templates/` - HTML templates served by the backend.
- `data/` - Directory for storing application data/state.
- `cert.pem` & `key.pem` - SSL certificates for enabling HTTPS.

## <img src="https://cdn.jsdelivr.net/npm/feather-icons/dist/icons/play-circle.svg" width="24" height="24" align="text-bottom"> Getting Started

### Prerequisites

To run this project, you will need to have **Rust and Cargo** installed on your system.
- Install Rust: [rustup.rs](https://rustup.rs/)

### Installation

1. Clone the repository:
```bash
   git clone [https://github.com/lionesslie/Q-Chat.git](https://github.com/lionesslie/Q-Chat.git)
   cd Q-Chat
