/// Q-Chat Standalone Server (original behavior)
/// Runs the web server without a desktop window.
fn main() -> std::io::Result<()> {
    // This delegates to the library's main function
    q_chat::main_server()
}
