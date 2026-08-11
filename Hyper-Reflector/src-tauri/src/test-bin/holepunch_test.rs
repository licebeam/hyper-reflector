// Standalone holepunch + relay integration test.
// Run with: cargo run --bin holepunch_test
//
// Spins up two fake "players" on this machine, both punching into the real
// server. Once matched, they exchange test packets to verify bidirectional flow.
// NAT hairpinning note: if both sockets are behind the same router, same-machine
// loopback is also attempted as a fallback when the public address fails.

use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, time::Duration};
use tokio::{net::UdpSocket, time::timeout};

const SERVER: &str = "137.184.32.78:33334";
const P1_UID: &str = "hr-test-holepunch-p1";
const P2_UID: &str = "hr-test-holepunch-p2";

#[derive(Serialize)]
struct PunchMessage<'a> {
    uid: &'a str,
    #[serde(rename = "peerUid")]
    peer_uid: &'a str,
    kill: bool,
}

#[derive(Deserialize, Debug)]
struct PeerEndpoint {
    address: String,
    port: u16,
}

#[derive(Deserialize, Debug)]
struct OpponentEnvelope {
    peer: PeerEndpoint,
}

fn looks_like_json(data: &[u8]) -> bool {
    data.first().map(|&b| b == b'{' || b == b'[').unwrap_or(false)
}

async fn player_task(
    label: &'static str,
    my_uid: &'static str,
    peer_uid: &'static str,
    send_payload: &'static [u8],
    expect_payload: &'static [u8],
) -> bool {
    let server_addr: SocketAddr = SERVER.parse().unwrap();
    let sock = UdpSocket::bind("0.0.0.0:0").await.unwrap();
    let local_addr = sock.local_addr().unwrap();
    println!("[{label}] bound to {local_addr}");

    let msg = serde_json::to_vec(&PunchMessage { uid: my_uid, peer_uid, kill: false }).unwrap();
    sock.send_to(&msg, server_addr).await.unwrap();
    println!("[{label}] punch sent to {SERVER}");

    // Wait for server to return opponent's address
    let mut buf = vec![0u8; 4096];
    let peer_addr = match timeout(Duration::from_secs(15), async {
        loop {
            let (n, _) = sock.recv_from(&mut buf).await.unwrap();
            if let Ok(env) = serde_json::from_slice::<OpponentEnvelope>(&buf[..n]) {
                let s = format!("{}:{}", env.peer.address, env.peer.port);
                if let Ok(a) = s.parse::<SocketAddr>() {
                    return a;
                }
            }
        }
    })
    .await
    {
        Ok(a) => {
            println!("[{label}] server matched — opponent at {a}");
            a
        }
        Err(_) => {
            println!("[{label}] FAIL: timed out waiting for server match");
            return false;
        }
    };

    // Brief pause so both sides finish their handshake before we start exchanging
    tokio::time::sleep(Duration::from_millis(300)).await;

    // Send test payload, retrying every 250 ms in case the other side isn't ready yet
    let loopback_addr = SocketAddr::from(([127, 0, 0, 1], peer_addr.port()));
    let mut send_attempts = 0u32;
    let mut received = false;

    let deadline = tokio::time::Instant::now() + Duration::from_secs(6);
    loop {
        if tokio::time::Instant::now() >= deadline {
            break;
        }

        // Send to reported address; also try loopback if on same machine
        let _ = sock.send_to(send_payload, peer_addr).await;
        if peer_addr.ip().to_string() != "127.0.0.1" {
            let _ = sock.send_to(send_payload, loopback_addr).await;
        }
        send_attempts += 1;

        match timeout(Duration::from_millis(250), sock.recv_from(&mut buf)).await {
            Ok(Ok((n, from))) => {
                let data = &buf[..n];
                if looks_like_json(data) {
                    // server control packet — ignore and keep waiting
                    continue;
                }
                if data == expect_payload {
                    println!("[{label}] PASS: received expected payload from {from} (after {send_attempts} sends)");
                    received = true;
                    break;
                } else {
                    println!("[{label}] WARN: unexpected non-json payload: {:?}", data);
                }
            }
            _ => {}
        }
    }

    if !received {
        println!("[{label}] FAIL: never received expected payload (sent {send_attempts} times)");
    }

    // Send kill to server so it cleans up the session
    let kill_msg = serde_json::to_vec(&PunchMessage { uid: my_uid, peer_uid, kill: true }).unwrap();
    let _ = sock.send_to(&kill_msg, server_addr).await;

    received
}

#[tokio::main]
async fn main() {
    println!("=== Holepunch relay test ===");
    println!("Server: {SERVER}");
    println!("UIDs:   {P1_UID}  <->  {P2_UID}\n");

    let (r1, r2) = tokio::join!(
        player_task("P1", P1_UID, P2_UID, b"HELLO_FROM_P1", b"HELLO_FROM_P2"),
        player_task("P2", P2_UID, P1_UID, b"HELLO_FROM_P2", b"HELLO_FROM_P1"),
    );

    println!("\n=== Results ===");
    println!("Player 1: {}", if r1 { "PASS" } else { "FAIL" });
    println!("Player 2: {}", if r2 { "PASS" } else { "FAIL" });

    if r1 && r2 {
        println!("\nFull holepunch + bidirectional relay: PASS");
    } else {
        println!("\nTest FAILED — check output above");
        std::process::exit(1);
    }
}
