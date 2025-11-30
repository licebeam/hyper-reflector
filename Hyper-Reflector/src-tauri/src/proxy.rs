// WARNING this is likely to be deprecated and removed at some point as it's not necessary long term
// I did not write this, this is a port by chatGPT of the our original node proxy
use crate::{resolve_emulator_path, resolve_lua_args};
use anyhow::anyhow;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::{
    net::{Ipv4Addr, SocketAddr},
    sync::Arc,
    time::Duration,
};
use tauri::{AppHandle, Emitter, EventTarget};
use tokio::{
    net::UdpSocket,
    process::Command as TokioCommand,
    sync::{oneshot, Mutex},
    task::JoinHandle,
    time::{interval, sleep},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerEndpoint {
    pub address: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PunchMessage {
    pub uid: String,
    #[serde(rename = "peerUid")]
    pub peer_uid: String,
    pub kill: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerEnvelope {
    pub peer: Option<PeerEndpoint>,
    pub match_id: Option<String>,
    #[serde(default)]
    pub kill: bool,
    #[serde(rename = "opponentUid")]
    pub opponent_uid: Option<String>,
    pub reason: Option<String>,
}

// ---- Arguments you pass from the frontend ----
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartArgs {
    pub my_uid: String,
    pub peer_uid: String,
    pub server_host: String,
    pub server_port: u16,
    pub match_id: Option<String>,
    // emulator settings
    pub emulator_path: String,     // absolute path to your emulator binary
    pub player: u8,                // proxyStartData.player + 1
    pub delay: u16,                // config.app.emuDelay
    pub user_name: String,         // for passing to emulator
    pub game_name: Option<String>, // just for fun
    // ports (defaults to 7000/7001 like your code)
    pub emulator_game_port: Option<u16>, // where emulator expects its peer (default 7000)
    pub emulator_listen_port: Option<u16>, // where we listen for emulator (default 7001)
    pub emulator_args: Vec<String>,      // exact CLI args to launch emulator
}

pub struct ProxyRuntime {
    // Network
    local_sock: Arc<UdpSocket>, // random local port for holepunch + send to peer & server
    emu_listener: Arc<UdpSocket>, // bound to 7001 (or random) to receive from emulator
    opponent: Arc<Mutex<Option<SocketAddr>>>,
    keepalive_task: Mutex<Option<JoinHandle<()>>>,
    // Emulator process
    child: Mutex<Option<tokio::process::Child>>,
    // Control
    stop_tx: Mutex<Option<oneshot::Sender<()>>>,
    // Meta
    app: AppHandle,
    args: StartArgs,
    match_closed: AtomicBool,
}

impl ProxyRuntime {
    async fn new(app: AppHandle, args: StartArgs) -> anyhow::Result<Arc<Self>> {
        // 1) local socket: bind to 0.0.0.0:0
        let local_sock = UdpSocket::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, 0))).await?;
        // 2) emulator listener: bind to 127.0.0.1:port (default 7001)
        let emu_port = args.emulator_listen_port.unwrap_or(7001);
        let emu_listener =
            match UdpSocket::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, emu_port))).await {
                Ok(s) => s,
                Err(_e) => {
                    // fallback to random port if 7001 busy
                    //app.emit_all("proxy-log", format!("Port {emu_port} busy")).ok();
                    let _ = app.emit_to(EventTarget::any(), "proxy-log", format!("Port busy"));
                    UdpSocket::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0))).await?
                }
            };

        let rt = Arc::new(Self {
            local_sock: Arc::new(local_sock),
            emu_listener: Arc::new(emu_listener),
            opponent: Arc::new(Mutex::new(None)),
            keepalive_task: Mutex::new(None),
            child: Mutex::new(None),
            stop_tx: Mutex::new(None),
            app,
            args,
            match_closed: AtomicBool::new(false),
        });

        Ok(rt)
    }

    async fn start(self: &Arc<Self>) -> anyhow::Result<()> {
        // send initial punch message to server: { uid, peerUid, kill:false }
        self.send_to_server(false).await?;

        // spawn the two proxy loops
        let (stop_tx, stop_rx) = oneshot::channel::<()>();
        *self.stop_tx.lock().await = Some(stop_tx);

        self.spawn_local_reader(stop_rx).await?;
        self.spawn_emulator_reader().await?;
        self.spawn_handshake_watchdog().await?;

        // we don't start emulator immediately; we mimic your behavior: start on first send to B.
        Ok(())
    }

    async fn spawn_local_reader(
        self: &Arc<Self>,
        mut stop_rx: oneshot::Receiver<()>,
    ) -> anyhow::Result<()> {
        let this = Arc::clone(self);
        let sock = Arc::clone(&self.local_sock);
        let emu_listener = Arc::clone(&self.emu_listener);

        tokio::spawn(async move {
            let mut buf = vec![0u8; 65535];

            loop {
                tokio::select! {
                    r = sock.recv_from(&mut buf) => {
                        match r {
                            Ok((n, _from)) => {
                                let slice = &buf[..n];
                                if this.process_server_packet(slice).await {
                                    continue;
                                }

                                let as_str = std::str::from_utf8(slice).unwrap_or("");
                                if as_str == "ping" {
                                    this.ensure_keepalive().await;
                                    continue;
                                }

                                let emu_game_port = this.args.emulator_game_port.unwrap_or(7000);
                                let _ = emu_listener
                                    .send_to(slice, SocketAddr::from((Ipv4Addr::LOCALHOST, emu_game_port)))
                                    .await;
                            }
                            Err(_e) => {
                                let _ = this.app.emit_to(
                                    EventTarget::any(),
                                    "proxy-log",
                                    "local recv error".to_string()
                                );
                                break;
                            }
                        }
                    }
                    _ = &mut stop_rx => {
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    async fn spawn_emulator_reader(self: &Arc<Self>) -> anyhow::Result<()> {
        let this = Arc::clone(self);
        let emu_listener = Arc::clone(&self.emu_listener);

        tokio::spawn(async move {
            let mut buf = vec![0u8; 65535];
            loop {
                match emu_listener.recv_from(&mut buf).await {
                    Ok((n, _from)) => {
                        let payload = &buf[..n];
                        let _ = this.send_to_peer(payload).await;
                    }
                    Err(_e) => {
                        let _ = this.app.emit_to(
                            EventTarget::any(),
                            "proxy-log",
                            "emu recv error".to_string(),
                        );
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    async fn spawn_handshake_watchdog(self: &Arc<Self>) -> anyhow::Result<()> {
        let this = Arc::clone(self);
        tokio::spawn(async move {
            let mut waited = 0u64;
            loop {
                {
                    if this.opponent.lock().await.is_some() {
                        break;
                    }
                }
                if waited >= 15 {
                    let _ = this.app.emit_to(
                        EventTarget::any(),
                        "sendAlert",
                        json!({
                            "type": "error",
                            "message": {
                                "title": "Matchmaking timeout",
                                "description": "No response from the hole punching server. Please try again."
                            }
                        }),
                    );
                    let _ = this.send_to_server(true).await;
                    let _ = this.stop().await;
                    break;
                }
                waited += 1;
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        });
        Ok(())
    }

    async fn ensure_keepalive(self: &Arc<Self>) {
        let mut guard = self.keepalive_task.lock().await;
        if guard.is_some() {
            return;
        }

        let this = Arc::clone(self);
        let handle = tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(1));
            loop {
                ticker.tick().await;
                let _ = this.send_to_peer(b"ping").await;
            }
        });
        *guard = Some(handle);
    }

    async fn send_to_peer(self: &Arc<Self>, payload: &[u8]) -> anyhow::Result<()> {
        let opp = self.opponent.lock().await.clone();
        if let Some(addr) = opp {
            // start emulator on first real send if not started
            if self.child.lock().await.is_none() {
                if let Err(e) = self.start_emulator().await {
                    let _ = self.app.emit_to(EventTarget::any(), "sendAlert", serde_json::json!({
            "type": "error",
            "message": { "title": "Emulator failed to open", "description": e.to_string() }
          }));
                    // notify server we're killing
                    let _ = self.send_to_server(true).await;
                    let _ = self.stop().await;
                    return Ok(());
                }
            }
            let _ = self.local_sock.send_to(payload, addr).await?;
        }
        Ok(())
    }

    async fn start_emulator(self: &Arc<Self>) -> anyhow::Result<()> {
        // Your JS called startPlayingOnline with params; here we just show a spawn.
        // You can craft the exact CLI args your emulator expects.
        let emu_listen_port = self.emu_listener.local_addr()?.port();
        let emu_game_port = self.args.emulator_game_port.unwrap_or(7000);

        // self.app.emit_all("proxy-log",
        //   format!("Starting emulator: {} (listen:{emu_listen_port} game:{emu_game_port})", self.args.emulator_path)
        // ).ok();
        let _ = self
            .app
            .emit_to(EventTarget::any(), "proxy-log", format!("Port busy"));

        let mut cmd = TokioCommand::new(&self.args.emulator_path);
        let mut provided_args = self.args.emulator_args.clone();

        if provided_args.is_empty() {
            provided_args = vec![
                "--local-port".to_string(),
                emu_game_port.to_string(),
                "--remote-ip".to_string(),
                "127.0.0.1".to_string(),
                "--remote-port".to_string(),
                emu_listen_port.to_string(),
                "--player".to_string(),
                self.args.player.to_string(),
                "--delay".to_string(),
                self.args.delay.to_string(),
                "--name".to_string(),
                self.args.user_name.clone(),
            ];
        }

        // Example args - replace with what FBNeo needs in your environment:
        //   --local-port 7000 --remote-ip 127.0.0.1 --remote-port <emu_listener_port> --player N --delay D --name user
        resolve_lua_args(&self.app, &mut provided_args).map_err(|e| anyhow!(e))?;
        cmd.args(provided_args);

        let child = cmd.spawn()?;
        *self.child.lock().await = Some(child);
        self.spawn_emulator_watchdog();
        let _ = self.app.emit_to(
            EventTarget::any(),
            "sendAlert",
            json!({
                "type": "info",
                "message": {
                    "title": "Emulator launching",
                    "description": format!("Starting {}", self.args.emulator_path)
                }
            }),
        );
        Ok(())
    }

    async fn send_to_server(&self, kill: bool) -> anyhow::Result<()> {
        let msg = serde_json::to_vec(&PunchMessage {
            uid: self.args.my_uid.clone(),
            peer_uid: self.args.peer_uid.clone(),
            kill,
        })?;
        let server = format!("{}:{}", self.args.server_host, self.args.server_port);
        let server_addr: SocketAddr = server.parse()?;
        self.local_sock.send_to(&msg, server_addr).await?;
        // self.app.emit_all("proxy-log", format!("Sent punch to {server} kill={kill}")).ok();
        let _ = self
            .app
            .emit_to(EventTarget::any(), "proxy-log", format!("Port busy"));
        Ok(())
    }

    pub async fn stop(&self) -> anyhow::Result<()> {
        if let Some(tx) = self.stop_tx.lock().await.take() {
            let _ = tx.send(());
        }
        // Stop keepalive
        if let Some(h) = self.keepalive_task.lock().await.take() {
            h.abort();
        }
        self.kill_emulator_process("proxy-stop").await?;
        Ok(())
    }

    async fn process_server_packet(self: &Arc<Self>, slice: &[u8]) -> bool {
        match serde_json::from_slice::<ServerEnvelope>(slice) {
            Ok(env) => {
                if env.kill {
                    self.handle_remote_kill(env.reason, env.opponent_uid).await;
                    return true;
                }
                if let Some(peer) = env.peer {
                    if let Ok(addr) =
                        format!("{}:{}", peer.address, peer.port).parse::<SocketAddr>()
                    {
                        *self.opponent.lock().await = Some(addr);
                        let _ = self.send_to_peer(b"ping").await;
                        self.ensure_keepalive().await;
                    }
                    return true;
                }
            }
            Err(_) => {}
        }
        false
    }

    async fn handle_remote_kill(
        self: &Arc<Self>,
        reason: Option<String>,
        opponent_uid: Option<String>,
    ) {
        let description = reason.unwrap_or_else(|| "Opponent closed the match.".to_string());
        let detail = if let Some(uid) = opponent_uid {
            format!("{description} ({uid})")
        } else {
            description.clone()
        };
        let _ = self.app.emit_to(
            EventTarget::any(),
            "sendAlert",
            json!({
                "type": "info",
                "message": {
                    "title": "Match ended",
                    "description": detail
                }
            }),
        );

        if let Err(err) = self.stop().await {
            let _ = self.app.emit_to(
                EventTarget::any(),
                "proxy-log",
                format!("Failed to stop proxy after remote kill: {err}"),
            );
        }
    }

    fn spawn_emulator_watchdog(self: &Arc<Self>) {
        let watcher = Arc::clone(self);
        tokio::spawn(async move {
            loop {
                let terminated = {
                    let mut guard = watcher.child.lock().await;
                    if let Some(child) = guard.as_mut() {
                        match child.try_wait() {
                            Ok(Some(_status)) => {
                                guard.take();
                                true
                            }
                            Ok(None) => false,
                            Err(err) => {
                                let _ = watcher.app.emit_to(
                                    EventTarget::any(),
                                    "proxy-log",
                                    format!("Emulator error: {err}"),
                                );
                                guard.take();
                                true
                            }
                        }
                    } else {
                        false
                    }
                };
                if terminated {
                    watcher.notify_match_closed("emulator-exited").await;
                    break;
                }
                sleep(Duration::from_millis(750)).await;
            }
        });
    }

    async fn notify_match_closed(&self, reason: &str) {
        if self.match_closed.swap(true, Ordering::SeqCst) {
            return;
        }
        let payload = json!({
            "reason": reason,
            "matchId": self.args.match_id,
        });
        let _ = self
            .app
            .emit_to(EventTarget::any(), "endMatch", payload.clone());
        let _ = self.app.emit_to(EventTarget::any(), "endMatchUI", payload);
        if let Err(err) = self.send_to_server(true).await {
            let _ = self.app.emit_to(
                EventTarget::any(),
                "proxy-log",
                format!("Failed to notify holepunch server about match close: {err}"),
            );
        }
    }

    async fn kill_emulator_process(&self, reason: &str) -> anyhow::Result<()> {
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.start_kill();
            let _ = child.wait().await;
            self.notify_match_closed(reason).await;
        }
        Ok(())
    }
}

// ---- Global manager so we can have start/stop commands ----
pub struct ProxyManager {
    inner: Mutex<Option<Arc<ProxyRuntime>>>,
}

impl ProxyManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub async fn start_proxy(
    app: AppHandle,
    state: tauri::State<'_, ProxyManager>,
    args: StartArgs,
) -> Result<String, String> {
    let mut args = args;
    let resolved_path = resolve_emulator_path(&app, &args.emulator_path)?;
    args.emulator_path = resolved_path.to_string_lossy().to_string();

    let rt = ProxyRuntime::new(app, args)
        .await
        .map_err(|e| e.to_string())?;
    rt.start().await.map_err(|e| e.to_string())?;
    *state.inner.lock().await = Some(rt.clone());
    Ok(format!(
        "proxy started: local={} emu_listener={}",
        rt.local_sock.local_addr().unwrap(),
        rt.emu_listener.local_addr().unwrap()
    ))
}

#[tauri::command]
pub async fn stop_proxy(state: tauri::State<'_, ProxyManager>) -> Result<(), String> {
    if let Some(rt) = state.inner.lock().await.take() {
        rt.stop().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn kill_emulator_only(state: tauri::State<'_, ProxyManager>) -> Result<(), String> {
    let runtime = {
        let guard = state.inner.lock().await;
        guard.clone()
    };
    if let Some(rt) = runtime {
        rt.kill_emulator_process("manual-force")
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
