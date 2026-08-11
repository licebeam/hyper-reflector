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
            reader_task: Mutex::new(None),
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

    fn proxy_log(&self, msg: impl Into<String>) {
        let msg = msg.into();
        println!("[proxy] {msg}");
        let _ = self
            .app
            .emit_to(EventTarget::any(), "proxy-log", msg);
    }

    async fn is_udp_port_bindable(port: u16) -> Result<(), String> {
        if port == 0 {
            return Err("port=0 is not bindable".to_string());
        }
        match UdpSocket::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port))).await {
            Ok(sock) => {
                drop(sock);
                Ok(())
            }
            Err(e) => Err(e.to_string()),
        }
    }

    async fn wait_for_udp_port_free(&self, port: u16, timeout: Duration) -> Result<(), String> {
        let deadline = tokio::time::Instant::now() + timeout;
        let mut attempts: u32 = 0;

        loop {
            attempts += 1;
            match Self::is_udp_port_bindable(port).await {
                Ok(()) => return Ok(()),
                Err(err) => {
                    if tokio::time::Instant::now() >= deadline {
                        return Err(format!("{err} (after {attempts} attempts)"));
                    }
                }
            }
            sleep(Duration::from_millis(100)).await;
        }
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

        let handle = tokio::spawn(async move {
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
                                this.proxy_log("punch socket recv error");
                                break;
                            }
                        }
                    }
                }
            }
        });

        *self.reader_task.lock().await = Some(handle);

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

        let local = sock
            .local_addr()
            .map(|a| a.to_string())
            .unwrap_or_else(|_| "?".to_string());
        self.proxy_log(format!(
            "Holepunch -> server {server_addr} (local {local}, kill={kill})"
        ));
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

        if let Ok(env) = serde_json::from_slice::<OpponentEnvelope>(slice) {
            if let Some(mid) = env.match_id {
                *self.punch_match_id.lock().await = Some(mid);
            }
            if let Some(addr) = Self::parse_addr(&env.peer.address, env.peer.port) {
                self.register_peer_addr(addr).await;
            } else {
                self.proxy_log(format!(
                    "Invalid opponent address from server: {}:{}",
                    env.peer.address, env.peer.port
                ));
            }
            return true;
        }

        if let Ok(env) = serde_json::from_slice::<FlatPeerEnvelope>(slice) {
            if let Some(mid) = env.match_id {
                *self.punch_match_id.lock().await = Some(mid);
            }
            if let (Some(address), Some(port)) = (env.address.as_deref(), env.port) {
                if let Some(addr) = Self::parse_addr(address, port) {
                    self.register_peer_addr(addr).await;
                } else {
                    self.proxy_log(format!(
                        "Invalid opponent address from server: {address}:{port}"
                    ));
                }
                return true;
            }
        }

        if Self::looks_like_server_control(slice) {
            return true;
        }

        false
    }

    async fn register_peer_addr(self: &Arc<Self>, addr: SocketAddr) {
        {
            let mut guard = self.opponent.lock().await;
            if guard.is_some() {
                return;
            }
            *guard = Some(addr);
        }

        self.proxy_log(format!("Matched opponent address: {addr}"));

        // Stop the reader and release the punch socket so the OS frees the port.
        // No ping is sent here — sending from the emulator's port before it binds
        // can leave a lingering ICMP error that causes the emulator's first sendto
        // to fail. GGPO handles the initial hole-punch itself via retries.
        // Important: this function runs on the reader task. Aborting that task here can cancel
        // the rest of this function before the emulator launch runs. Instead, notify the reader
        // to stop, then drop the socket + launch the emulator from a separate task.
        self.reader_stop.notify_waiters();

        let this = Arc::clone(self);
        tokio::spawn(async move {
            if let Some(handle) = this.reader_task.lock().await.take() {
                handle.abort();
            }

            // Drop the punch socket as deterministically as possible before launching the emulator.
            let sock = this.punch_sock.lock().await.take();
            if let Some(sock) = sock {
                let deadline = tokio::time::Instant::now() + Duration::from_secs(1);
                while Arc::strong_count(&sock) > 1 && tokio::time::Instant::now() < deadline {
                    sleep(Duration::from_millis(5)).await;
                }
                this.proxy_log(format!(
                    "Punch socket strong_count after stop: {}",
                    Arc::strong_count(&sock)
                ));
                drop(sock);
            }

            // Brief pause so both sides finish their handshake and the OS fully releases the port.
            sleep(Duration::from_millis(300)).await;

            let emu_game_port = this.args.emulator_game_port.unwrap_or(7000);
            match this
                .wait_for_udp_port_free(emu_game_port, Duration::from_secs(5))
                .await
            {
                Ok(()) => this.proxy_log(format!("Emulator UDP port {emu_game_port} is free")),
                Err(err) => {
                    this.proxy_log(format!(
                        "Emulator UDP port {emu_game_port} is NOT free: {err}"
                    ));
                    let _ = this.app.emit_to(
                        EventTarget::any(),
                        "sendAlert",
                        json!({
                            "type": "error",
                            "message": {
                                "title": "Emulator port in use",
                                "description": format!("Port {emu_game_port} is not available. Close any existing emulator/match using it, or change emulator_game_port.")
                            }
                        }),
                    );
                    let _ = this.stop().await;
                    return;
                }
            }

            if this.args.server_host == addr.ip().to_string() {
                this.proxy_log(format!(
                    "Warning: matched peer IP equals server host ({}). This may indicate relay mode or server misreporting the peer address.",
                    this.args.server_host
                ));
            }

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
        let peer_ip = match peer_addr.ip() {
            std::net::IpAddr::V4(v4) => v4.to_string(),
            std::net::IpAddr::V6(v6) => {
                if let Some(v4) = v6.to_ipv4_mapped().or_else(|| v6.to_ipv4()) {
                    v4.to_string()
                } else {
                    self.proxy_log(format!(
                        "Opponent address is IPv6-only (unsupported): {peer_addr}"
                    ));
                    return Err(anyhow!(
                        "Opponent address is IPv6-only (unsupported by emulator): {peer_addr}"
                    ));
                }
            }
        };
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
                "--name".to_string(),
                self.args.user_name.clone(),
            ];
        } else {
            Self::rewrite_emulator_args(&mut provided_args, emu_game_port, &peer_ip, peer_port);
        }

        resolve_lua_args(&self.app, &mut provided_args).map_err(|e| anyhow!(e))?;

        // Ensure delay / net-delay reflect StartArgs even when the UI passes a full arg list.
        // Also avoids passing `-d 0` or `--net-delay off` (treat those as "use emulator default").
        self.normalize_delay_and_net_delay(&mut provided_args);

        self.proxy_log(format!(
            "Launching emulator: {} direct to {}:{} (local:{}, matched:{}) args={:?}",
            self.args.emulator_path,
            peer_ip,
            peer_port,
            emu_game_port,
            peer_addr,
            provided_args
        ));
        println!(
            "Launching emulator: {} direct to {}:{} (local:{}, matched:{}) args={:?}",
            self.args.emulator_path, peer_ip, peer_port, emu_game_port, peer_addr, provided_args
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
        if let Some(handle) = self.reader_task.lock().await.take() {
            handle.abort();
        }
        *self.punch_sock.lock().await = None;
        self.kill_emulator_process("proxy-stop").await?;
        Ok(())
    }

    fn parse_addr(address: &str, port: u16) -> Option<SocketAddr> {
        if port == 0 {
            return None;
        }
        let addr = format!("{address}:{port}").parse::<SocketAddr>().ok()?;
        match addr.ip() {
            std::net::IpAddr::V4(ip) => {
                if ip.is_unspecified() || ip.is_multicast() {
                    return None;
                }
            }
            std::net::IpAddr::V6(ip) => {
                if ip.is_unspecified() || ip.is_multicast() {
                    return None;
                }
            }
        }
        Some(addr)
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
            self.proxy_log(format!("Failed to stop after remote kill: {err}"));
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
                                watcher.proxy_log(format!("Emulator error: {err}"));
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
                        watcher.proxy_log(format!("Failed to stop after emulator exit: {err}"));
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

    fn remove_opt_with_value(args: &mut Vec<String>, flags: &[&str]) {
        let mut idx = 0;
        while idx < args.len() {
            if flags.iter().any(|f| args[idx].eq_ignore_ascii_case(f)) {
                args.remove(idx);
                if idx < args.len() {
                    args.remove(idx);
                }
                continue;
            }
            idx += 1;
        }
    }

    fn set_opt_with_value(args: &mut Vec<String>, flags: &[&str], value: &str) {
        let mut updated_any = false;
        let mut idx = 0;
        while idx < args.len() {
            if flags.iter().any(|f| args[idx].eq_ignore_ascii_case(f)) {
                if idx + 1 < args.len() {
                    args[idx + 1] = value.to_string();
                    updated_any = true;
                    idx += 2;
                    continue;
                } else {
                    args.push(value.to_string());
                    updated_any = true;
                    break;
                }
            }
            idx += 1;
        }

        if !updated_any {
            args.push(flags[0].to_string());
            args.push(value.to_string());
        }
    }

    fn normalize_delay_and_net_delay(&self, args: &mut Vec<String>) {
        // `-d/--delay` is GGPO frame delay. Emulator CLI says "1 is default".
        // Always pass through the configured delay (including 0) so both sides are explicit.
        Self::set_opt_with_value(args, &["-d", "--delay"], &self.args.delay.to_string());

        // `--net-delay` in this fork is *artificial* latency for testing (on|off|<ms>).
        // It should not be used in real matches. We strip it by default and only allow it
        // when explicitly enabled (e.g. local testing) via `HR_ALLOW_NET_DELAY=1`.
        let allow_test_net_delay = std::env::var("HR_ALLOW_NET_DELAY")
            .ok()
            .is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"));

        if !allow_test_net_delay {
            Self::remove_opt_with_value(args, &["--net-delay"]);
            return;
        }

        let net_delay = self.args.net_delay.trim();
        if net_delay.is_empty() || net_delay.eq_ignore_ascii_case("off") {
            Self::remove_opt_with_value(args, &["--net-delay"]);
        } else {
            Self::set_opt_with_value(args, &["--net-delay"], net_delay);
        }
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
