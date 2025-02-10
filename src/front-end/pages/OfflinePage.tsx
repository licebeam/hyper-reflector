import { useState } from 'react'
import Layout from '../layout/Layout'

export default function OfflinePage() {
    const [player, setPlayer] = useState(0)
    const [opponentIp, setOpponentIp] = useState('')

    // document.getElementById("api-serve-btn").addEventListener("click", () => {
    //     var port = document.getElementById("externalPort").value; // typescript error, works fine
    //     var ip = document.getElementById("externalIp").value; // typescript error, works fine
    //     console.log('starting match with: ', connectIp, ":", connectPort)
    //     window.api.serveMatch(connectIp, connectPort);
    // });

    // document.getElementById("api-connect-btn").addEventListener("click", () => {
    //     var port = document.getElementById("externalPort").value; // typescript error, works fine
    //     var ip = document.getElementById("externalIp").value; // typescript error, works fine
    //     console.log('starting match with: ', connectIp, ":", connectPort)
    //     window.api.connectMatch(connectIp, connectPort);
    // });

    return (
        <Layout>
            <div>
                <p>Play Offline</p>
                <input
                    type="number"
                    value={player}
                    onChange={(e) => setPlayer(e.target.value)}
                    placeholder="player -- either 0 or 1"
                />
                <input
                    type="strong"
                    value={opponentIp}
                    onChange={(e) => setOpponentIp(e.target.value)}
                    placeholder="opponent public ip"
                />
                <button
                    onClick={() => {
                        console.log('yo hey what the hell is goin on', player)
                        console.log('serving match')
                        window.api.serveMatch(opponentIp, 3478, player, 0)
                    }}
                >
                    Connect
                </button>

                <button id="startCallBtn">
                    Handshake
                </button>
                <br></br>
                <button onClick={() => console.log('go to offline page')}>
                    Direct Connections
                </button>
                <button onClick={() => window.api.startSoloTraining()}>Training Modes</button>
            </div>
        </Layout>
    )
}
