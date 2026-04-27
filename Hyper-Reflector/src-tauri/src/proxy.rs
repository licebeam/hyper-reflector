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
    sync::{Mutex, Notify},
    task::JoinHandle,
    time::sleep,
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
    #[serde(rename = "matchId", skip_serializing_if = "Option::is_none")]
    pub match_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpponentEnvelope {
    pub match_id: Option<String>,
    pub peer: PeerEndpoint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KillEnvelope {
    #[serde(default)]
    pub kill: bool,
    #[serde(rename = "opponentUid")]
    pub opponent_uid: Option<String>,
    pub reason: Option<String>,
    #[serde(rename = "matchId")]
    pub match_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlatPeerEnvelope {
    pub match_id: Option<String>,
    #[serde(
        default,
        alias = "peerAddress",
        alias = "peer_address",
        alias = "peerIp",
        alias = "peer_ip",
        alias = "ip",
        alias = "host"
    )]
    pub address: Option<String>,
    #[serde(default, alias = "peerPort", alias = "peer_port")]
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartArgs {
    pub my_uid: String,
    pub peer_uid: String,
    pub server_host: String,
    pub server_port: u16,
    pub match_id: Option<String>,
    pub emulator_path: String,
    pub player: u8,
    pub delay: u16,
    pub user_name: String,
    pub net_delay: String,
    pub game_name: Option<String>,
    // emulator_game_port is also used as the punch port so NAT traversal
    // opens a hole on the exact port the emulator will bind to.
    pub emulator_game_port: Option<u16>,
    // Kept for backwards-compat with the frontend — no longer used.
    pub emulator_listen_port: Option<u16>,
    pub emulator_args: Vec<String>,
}

pub struct ProxyRuntime {
    // Punch socket bound to emulator_game_port — released before emulator starts.
    punch_sock: Mutex<Option<Arc<UdpSocket>>>,
    opponent: Arc<Mutex<Option<SocketAddr>>>,
    punch_match_id: Arc<Mutex<Option<String>>>,
    child: Mutex<Option<tokio::process::Child>>,
    reader_task: Mutex<Option<JoinHandle<()>>>,
    stop_notify: Arc<Notify>,
    reader_stop: Arc<Notify>,
    app: AppHandle,
    args: StartArgs,
    match_closed: AtomicBool,
}

impl ProxyRuntime {
    async fn new(app: AppHandle, args: StartArgs) -> anyhow::Result<Arc<Self>> {
        let emu_port = args.emulator_game_port.unwrap_or(7000);
        let sock = UdpSocket::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, emu_port)))
            .await
            .map_err(|e| anyhow!("Failed to bind punch socket on port {emu_port}: {e}"))?;

        Ok(Arc::new(Self {
            punch_sock: Mutex::new(Some(Arc::new(sock))),
            opponent: Arc::new(Mutex::new(None)),
            punch_match_id: Arc::new(Mutex::new(None)),
            child: Mutex::new(None),
            stop_notify: Arc::new(Notify::new()),
            reader_stop: Arc::new(Notify::new()),
            app,
            args,
            match_closed: AtomicBool::new(false),
        }))
    }

    async fn get_sock(&self) -> Option<Arc<UdpSocket>> {
        self.punch_sock.lock().await.clone()
    }

    async fn start(self: &Arc<Self>) -> anyhow::Result<()> {
        self.send_to_server(false).await?;
        self.spawn_local_reader().await?;
        self.spawn_handshake_watchdog().await?;
        Ok(())
    }

    async fn spawn_local_reader(self: &Arc<Self>) -> anyhow::Result<()> {
        let sock = self
            .get_sock()
            .await
            .ok_or_else(|| anyhow!("punch socket not available"))?;

        let this = Arc::clone(self);
        let stop_notify = Arc::clone(&self.stop_notify);
        let reader_stop = Arc::clone(&self.reader_stop);

        tokio::spawn(async move {
            let mut buf = vec![0u8; 65535];
            loop {
                tokio::select! {
                    _ = stop_notify.notified() => break,
                    _ = reader_stop.notified() => break,
                    r = sock.recv_from(&mut buf) => {
                        match r {
                            Ok((n, _from)) => {
                                // Only handle server control packets during handshake.
                                // Peer pings confirming the hole are intentionally ignored.
                                this.process_server_packet(&buf[..n]).await;
                            }
                            Err(_) => {
                                let _ = this.app.emit_to(
                                    EventTarget::any(),
                                    "proxy-log",
                                    "punch socket recv error".to_string(),
                                );
                                break;
                            }
                        }
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
                if this.opponent.lock().await.is_some() {
                    break;
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
                sleep(Duration::from_secs(1)).await;
            }
        });
        Ok(())
    }

    async fn send_to_server(&self, kill: bool) -> anyhow::Result<()> {
        let sock = match self.get_sock().await {
            Some(s) => s,
            None => return Ok(()), // socket already released after handshake
        };
        let punch_match_id = self.punch_match_id.lock().await.clone();
        let msg = serde_json::to_vec(&PunchMessage {
            uid: self.args.my_uid.clone(),
            peer_uid: self.args.peer_uid.clone(),
            kill,
            match_id: punch_match_id,
        })?;
        let server_addr: SocketAddr =
            format!("{}:{}", self.args.server_host, self.args.server_port).parse()?;
        sock.send_to(&msg, server_addr).await?;
        Ok(())
    }

    async fn process_server_packet(self: &Arc<Self>, slice: &[u8]) -> bool {
        if let Ok(env) = serde_json::from_slice::<KillEnvelope>(slice) {
            if env.kill {
                self.handle_remote_kill(env.reason, env.opponent_uid, env.match_id)
                    .await;
                return true;
            }
        }

        if let Some(addr) = Self::extract_peer_addr(slice) {
            if let Some(mid) = Self::extract_match_id(slice) {
                *self.punch_match_id.lock().await = Some(mid);
            }
            self.register_peer_addr(addr).await;
            return true;
        }

        if Self::looks_like_server_control(slice) {
            return true;
        }

        false
    }

    async fn register_peer_addr(self: &Arc<Self>, addr: SocketAddr) {
        *self.opponent.lock().await = Some(addr);

        // Stop the reader and release the punch socket so the OS frees the port.
        // No ping is sent here — sending from the emulator's port before it binds
        // can leave a lingering ICMP error that causes the emulator's first sendto
        // to fail. GGPO handles the initial hole-punch itself via retries.
        self.reader_stop.notify_waiters();
        *self.punch_sock.lock().await = None;

        // Brief pause for the OS to fully release the port before the emulator binds.
        sleep(Duration::from_millis(50)).await;

        let this = Arc::clone(self);
        tokio::spawn(async move {
            if let Err(e) = this.start_emulator(addr).await {
                let _ = this.app.emit_to(
                    EventTarget::any(),
                    "sendAlert",
                    json!({
                        "type": "error",
                        "message": {
                            "title": "Emulator failed to open",
                            "description": e.to_string()
                        }
                    }),
                );
                let _ = this.stop().await;
            }
        });
    }

    async fn start_emulator(self: &Arc<Self>, peer_addr: SocketAddr) -> anyhow::Result<()> {
        let emu_game_port = self.args.emulator_game_port.unwrap_or(7000);
        let peer_ip = peer_addr.ip().to_string();
        let peer_port = peer_addr.port();

        let mut cmd = TokioCommand::new(&self.args.emulator_path);
        let mut provided_args = self.args.emulator_args.clone();

        if provided_args.is_empty() {
            provided_args = vec![
                "--local-port".to_string(),
                emu_game_port.to_string(),
                "--remote-ip".to_string(),
                peer_ip.clone(),
                "--remote-port".to_string(),
                peer_port.to_string(),
                "--player".to_string(),
                self.args.player.to_string(),
                "--delay".to_string(),
                self.args.delay.to_string(),
                "--name".to_string(),
                self.args.user_name.clone(),
                "--net-delay".to_string(),
                self.args.net_delay.clone(),
            ];
        } else {
            Self::rewrite_emulator_args(&mut provided_args, emu_game_port, &peer_ip, peer_port);
        }

        resolve_lua_args(&self.app, &mut provided_args).map_err(|e| anyhow!(e))?;

        if !self.args.net_delay.trim().is_empty()
            && !Self::args_contain_net_delay(&provided_args)
        {
            provided_args.push("--net-delay".to_string());
            provided_args.push(self.args.net_delay.clone());
        }

        let _ = self.app.emit_to(
            EventTarget::any(),
            "proxy-log",
            format!(
                "Launching emulator: {} direct to {}:{} (local:{}) args={:?}",
                self.args.emulator_path, peer_ip, peer_port, emu_game_port, provided_args
            ),
        );
        println!(
            "Launching emulator: {} direct to {}:{} (local:{}) args={:?}",
            self.args.emulator_path, peer_ip, peer_port, emu_game_port, provided_args
        );

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
                    "description": format!("Connecting directly to {peer_ip}:{peer_port}")
                }
            }),
        );

        Ok(())
    }

    pub async fn stop(&self) -> anyhow::Result<()> {
        self.stop_notify.notify_waiters();
        self.reader_stop.notify_waiters();
        *self.punch_sock.lock().await = None;
        self.kill_emulator_process("proxy-stop").await?;
        Ok(())
    }

    fn extract_peer_addr(payload: &[u8]) -> Option<SocketAddr> {
        if let Ok(env) = serde_json::from_slice::<OpponentEnvelope>(payload) {
            return Self::parse_addr(&env.peer.address, env.peer.port);
        }
        if let Ok(env) = serde_json::from_slice::<FlatPeerEnvelope>(payload) {
            if let (Some(address), Some(port)) = (env.address.as_deref(), env.port) {
                return Self::parse_addr(address, port);
            }
        }
        None
    }

    fn extract_match_id(payload: &[u8]) -> Option<String> {
        if let Ok(env) = serde_json::from_slice::<OpponentEnvelope>(payload) {
            return env.match_id;
        }
        if let Ok(env) = serde_json::from_slice::<FlatPeerEnvelope>(payload) {
            return env.match_id;
        }
        None
    }

    fn parse_addr(address: &str, port: u16) -> Option<SocketAddr> {
        format!("{address}:{port}").parse::<SocketAddr>().ok()
    }

    fn looks_like_server_control(payload: &[u8]) -> bool {
        if payload.is_empty() {
            return false;
        }
        if payload[0] != b'{' && payload[0] != b'[' {
            return false;
        }
        if let Ok(text) = std::str::from_utf8(payload) {
            let trimmed = text.trim();
            trimmed.contains("\"port\"") || trimmed.contains("\"matchId\"")
        } else {
            false
        }
    }

    async fn handle_remote_kill(
        self: &Arc<Self>,
        reason: Option<String>,
        opponent_uid: Option<String>,
        match_id: Option<String>,
    ) {
        let punch_match_id = self.punch_match_id.lock().await.clone();
        if let (Some(expected), Some(received)) = (punch_match_id, match_id.clone()) {
            if expected != received {
                return;
            }
        }

        if let Some(ref uid) = opponent_uid {
            if *uid != self.args.peer_uid {
                return;
            }
        } else {
            return;
        }

        let description = reason.unwrap_or_else(|| "Opponent closed the match.".to_string());
        let detail = if let Some(uid) = opponent_uid {
            format!("{description} ({uid})")
        } else {
            description
        };

        let _ = self.app.emit_to(
            EventTarget::any(),
            "sendAlert",
            json!({
                "type": "info",
                "message": { "title": "Match ended", "description": detail }
            }),
        );

        if let Err(err) = self.stop().await {
            let _ = self.app.emit_to(
                EventTarget::any(),
                "proxy-log",
                format!("Failed to stop after remote kill: {err}"),
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
                            Ok(Some(_)) => {
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
                    if let Err(err) = watcher.stop().await {
                        let _ = watcher.app.emit_to(
                            EventTarget::any(),
                            "proxy-log",
                            format!("Failed to stop after emulator exit: {err}"),
                        );
                    }
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
        let _ = self.app.emit_to(EventTarget::any(), "endMatch", payload.clone());
        let _ = self.app.emit_to(EventTarget::any(), "endMatchUI", payload);
    }

    async fn kill_emulator_process(&self, reason: &str) -> anyhow::Result<()> {
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.start_kill();
            let _ = child.wait().await;
        }
        self.notify_match_closed(reason).await;
        Ok(())
    }

    fn args_contain_net_delay(args: &[String]) -> bool {
        args.iter().any(|a| {
            a.eq_ignore_ascii_case("--net-delay")
                || a.to_ascii_lowercase().contains("--net-delay")
        })
    }

    // Rewrites emulator args to use the real peer address instead of localhost relay.
    fn rewrite_emulator_args(
        args: &mut Vec<String>,
        local_port: u16,
        peer_ip: &str,
        peer_port: u16,
    ) {
        let local_addr = format!("0.0.0.0:{local_port}");
        let peer_addr = format!("{peer_ip}:{peer_port}");

        let mut idx = 0;
        while idx < args.len() {
            let lowered = args[idx].to_ascii_lowercase();
            match lowered.as_str() {
                "--local-port" => {
                    if idx + 1 < args.len() {
                        args[idx + 1] = local_port.to_string();
                    }
                    idx += 2;
                    continue;
                }
                "--remote-port" => {
                    if idx + 1 < args.len() {
                        args[idx + 1] = peer_port.to_string();
                    }
                    idx += 2;
                    continue;
                }
                "--remote-ip" => {
                    if idx + 1 < args.len() {
                        args[idx + 1] = peer_ip.to_string();
                    }
                    idx += 2;
                    continue;
                }
                "-l" => {
                    if idx + 1 < args.len() {
                        args[idx + 1] = local_addr.clone();
                    }
                    idx += 2;
                    continue;
                }
                "-r" => {
                    if idx + 1 < args.len() {
                        args[idx + 1] = peer_addr.clone();
                    }
                    idx += 2;
                    continue;
                }
                _ => {}
            }

            if args[idx].starts_with("quark:direct") {
                let mut parts: Vec<String> =
                    args[idx].split(',').map(|s| s.to_string()).collect();
                if parts.len() >= 5 {
                    parts[2] = local_port.to_string();
                    parts[3] = peer_ip.to_string();
                    parts[4] = peer_port.to_string();
                    args[idx] = parts.join(",");
                }
            }

            idx += 1;
        }
    }
}

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

    let existing = state.inner.lock().await.take();
    if let Some(existing_rt) = existing {
        existing_rt
            .stop()
            .await
            .map_err(|e| format!("Failed to stop previous proxy: {e}"))?;
    }

    let rt = ProxyRuntime::new(app, args)
        .await
        .map_err(|e| e.to_string())?;
    rt.start().await.map_err(|e| e.to_string())?;

    let port = rt
        .get_sock()
        .await
        .and_then(|s| s.local_addr().ok())
        .map(|a| a.to_string())
        .unwrap_or_else(|| "?".to_string());

    *state.inner.lock().await = Some(rt);
    Ok(format!("proxy started: punch socket on {port}"))
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
    let runtime = state.inner.lock().await.clone();
    if let Some(rt) = runtime {
        rt.kill_emulator_process("manual-force")
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
