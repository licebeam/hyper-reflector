import { useState } from 'react'
import Layout from '../layout/Layout'

export default function OfflinePage() {
    const [player, setPlayer] = useState(0)
    const [opponentPort, setOpponentPort] = useState(0)
    const [opponentIp, setOpponentIp] = useState('')
    const [myPort, setMyPort] = useState(0)

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
                    type="text"
                    value={opponentIp}
                    onChange={(e) => setOpponentIp(e.target.value)}
                    placeholder="opponent public ip"
                />
                <input
                    type="text"
                    value={opponentPort}
                    onChange={(e) => setOpponentPort(e.target.value)}
                    placeholder="port"
                />
                <p> user port </p>
                <input
                    type="text"
                    value={myPort}
                    onChange={(e) => setMyPort(e.target.value)}
                    placeholder="my port"
                />
                <button
                    onClick={() => {
                        window.api.serveMatch(opponentIp, opponentPort, player, 0, myPort)
                    }}
                >
                    Connect
                </button>

                <button
                    id="startCallBtn"
                    onClick={() => {
                        window.api.handShake('call')
                    }}
                >
                    Call
                </button>
                <button
                    id="startCallBtn"
                    onClick={() => {
                        window.api.handShake('answer')
                    }}
                >
                    Answer
                </button>
                <button
                    id="sendDataBtn"
                    onClick={() => {
                        window.api.sendDataChannel('Hello from another user')
                    }}
                >
                    Send Message Data Channel
                </button>

                <button
                    id="updateStunBtn"
                    onClick={() => {
                        window.api.updateStun({
                            ip: opponentIp,
                            port: myPort,
                            extPort: opponentPort,
                        })
                    }}
                >
                    Start NAT Punch
                </button>
                <br></br>
                {/* <button onClick={() => console.log('go to offline page')}>
                    Direct Connections
                </button> */}
                <button onClick={() => window.api.startSoloTraining()}>Training Modes</button>
            </div>
        </Layout>
    )
}
