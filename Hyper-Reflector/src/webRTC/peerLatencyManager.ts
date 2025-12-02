import keys from '../private/keys'
import { useUserStore } from '../state/store'
import type { TUser } from '../types/user'
import { isMockUserId } from '../match'

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: `stun:${keys.COTURN_IP}:${keys.COTURN_PORT}` },
]

const MAX_INBOUND_SESSIONS = 1
const MEASUREMENT_TTL_MS = 2 * 60 * 1000
const SESSION_TIMEOUT_MS = 10_000
const PING_INTERVAL_MS = 180
const PING_SAMPLE_TARGET = 5
const JITTER_UNSTABLE_THRESHOLD = 6

type MeasurementDirection = 'outbound' | 'inbound'

type MeasurementSession = {
    id: string
    targetUid: string
    direction: MeasurementDirection
    pc: RTCPeerConnection
    channel?: RTCDataChannel
    awaiting: Map<number, number>
    samples: number[]
    sentCount: number
    pendingCandidates: RTCIceCandidateInit[]
    timeoutHandle?: ReturnType<typeof setTimeout>
    completionHandle?: ReturnType<typeof setTimeout>
    startedAt: number
}

type LatencySignalPayload = {
    type: string
    measurementId?: string
    to?: string
    from?: string
    offer?: RTCSessionDescriptionInit
    answer?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
    reason?: string
}

class PeerLatencyManager {
    private viewer?: TUser
    private peers: TUser[] = []
    private socket?: WebSocket
    private outboundSession?: MeasurementSession
    private sessions = new Map<string, MeasurementSession>()
    private lastMeasured = new Map<string, number>()
    private scheduler?: ReturnType<typeof setInterval>
    private inMatch = false

    constructor() {
        if (typeof window !== 'undefined') {
            this.scheduler = window.setInterval(() => this.tick(), 10_000)
        }
    }

    setViewer(viewer?: TUser | null) {
        this.viewer = viewer || undefined
        if (!viewer) {
            this.resetAllSessions()
        }
    }

    setPeers(peers: TUser[]) {
        this.peers = Array.isArray(peers) ? peers : []
    }

    setInMatch(active: boolean) {
        this.inMatch = active
        if (active) {
            this.cancelOutboundSession()
        }
    }

    attachSocket(socket: WebSocket | null) {
        this.socket = socket || undefined
        if (!socket) {
            this.resetAllSessions()
        }
    }

    handleSignal(payload: LatencySignalPayload): boolean {
        if (!payload?.type) return false
        switch (payload.type) {
            case 'peer-latency-offer':
                void this.handleInboundOffer(payload)
                return true
            case 'peer-latency-answer':
                void this.handleInboundAnswer(payload)
                return true
            case 'peer-latency-candidate':
                void this.handleIncomingCandidate(payload)
                return true
            case 'peer-latency-decline':
                this.handleDecline(payload)
                return true
            default:
                return false
        }
    }

    private tick() {
        if (this.inMatch || this.outboundSession || !this.viewer) {
            return
        }
        const nextPeer = this.selectNextPeer()
        if (!nextPeer) return
        void this.startOutboundMeasurement(nextPeer.uid)
    }

    private selectNextPeer(): TUser | undefined {
        if (!this.viewer) return undefined
        const now = Date.now()
        const eligible = this.peers.filter((user) => {
            if (!user?.uid || user.uid === this.viewer?.uid) return false
            if (isMockUserId(user.uid)) return false
            const last = this.lastMeasured.get(user.uid)
            return !last || now - last >= MEASUREMENT_TTL_MS
        })
        if (!eligible.length) return undefined
        const viewerCountry = this.viewer.countryCode?.toUpperCase() || ''
        eligible.sort((a, b) => {
            const scoreA = this.computePriorityScore(a, viewerCountry)
            const scoreB = this.computePriorityScore(b, viewerCountry)
            return scoreA - scoreB
        })
        return eligible[0]
    }

    private computePriorityScore(user: TUser, viewerCountry: string): number {
        let score = 0
        const country = user.countryCode?.toUpperCase()
        if (!country || !viewerCountry) {
            score += 5
        } else if (country !== viewerCountry) {
            score += 10
        }
        const last = this.lastMeasured.get(user.uid)
        if (last) {
            const age = Date.now() - last
            score += Math.max(0, MEASUREMENT_TTL_MS - age) / 1000
        }
        return score + Math.random() * 0.01
    }

    private async startOutboundMeasurement(targetUid: string) {
        if (!this.viewer?.uid || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return
        }
        const measurementId = `${this.viewer.uid}-${targetUid}-${Date.now()}`
        const session = this.createSession(measurementId, targetUid, 'outbound')
        this.outboundSession = session
        this.sessions.set(session.id, session)
        try {
            const offer = await session.pc.createOffer()
            await session.pc.setLocalDescription(offer)
            this.sendSignal('peer-latency-offer', {
                to: targetUid,
                from: this.viewer.uid,
                measurementId,
                offer,
            })
            session.timeoutHandle = window.setTimeout(
                () => this.failSession(session, 'timeout'),
                SESSION_TIMEOUT_MS
            )
        } catch (error) {
            console.error('Failed to start latency session', error)
            this.failSession(session, 'offer-error')
        }
    }

    private async handleInboundOffer(payload: LatencySignalPayload) {
        if (!this.viewer?.uid || this.inMatch) {
            this.sendDecline(payload, 'busy')
            return
        }
        if (!payload.measurementId || !payload.offer || !payload.from) {
            return
        }
        if (this.countInboundSessions() >= MAX_INBOUND_SESSIONS) {
            this.sendDecline(payload, 'at-capacity')
            return
        }
        const session = this.createSession(payload.measurementId, payload.from, 'inbound')
        this.sessions.set(session.id, session)
        try {
            await session.pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
            const answer = await session.pc.createAnswer()
            await session.pc.setLocalDescription(answer)
            this.sendSignal('peer-latency-answer', {
                to: payload.from,
                from: this.viewer.uid,
                measurementId: payload.measurementId,
                answer,
            })
            session.timeoutHandle = window.setTimeout(
                () => this.failSession(session, 'timeout'),
                SESSION_TIMEOUT_MS
            )
        } catch (error) {
            console.error('Failed to answer latency offer', error)
            this.failSession(session, 'answer-error')
            this.sendDecline(payload, 'answer-error')
        }
    }

    private async handleInboundAnswer(payload: LatencySignalPayload) {
        if (!payload.measurementId || !payload.answer) return
        const session =
            this.outboundSession && this.outboundSession.id === payload.measurementId
                ? this.outboundSession
                : undefined
        if (!session) return
        try {
            await session.pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
            this.flushPendingCandidates(session)
        } catch (error) {
            console.error('Failed to handle latency answer', error)
            this.failSession(session, 'answer-error')
        }
    }

    private async handleIncomingCandidate(payload: LatencySignalPayload) {
        if (!payload.measurementId || !payload.candidate) return
        const session = this.sessions.get(payload.measurementId)
        if (!session) return
        if (!session.pc.remoteDescription) {
            session.pendingCandidates.push(payload.candidate)
            return
        }
        try {
            await session.pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch (error) {
            console.warn('Failed to add latency ICE candidate', error)
        }
    }

    private handleDecline(payload: LatencySignalPayload) {
        if (!payload.measurementId) return
        const session =
            this.outboundSession && this.outboundSession.id === payload.measurementId
                ? this.outboundSession
                : undefined
        if (!session) return
        this.failSession(session, 'declined')
    }

    private flushPendingCandidates(session: MeasurementSession) {
        if (!session.pc.remoteDescription) return
        if (!session.pendingCandidates.length) return
        const queue = [...session.pendingCandidates]
        session.pendingCandidates.length = 0
        queue.forEach(async (candidate) => {
            try {
                await session.pc.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (error) {
                console.warn('Failed to flush ICE candidate', error)
            }
        })
    }

    private createSession(
        id: string,
        targetUid: string,
        direction: MeasurementDirection
    ): MeasurementSession {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        const session: MeasurementSession = {
            id,
            targetUid,
            direction,
            pc,
            awaiting: new Map(),
            samples: [],
            sentCount: 0,
            pendingCandidates: [],
            startedAt: Date.now(),
        }

        pc.onicecandidate = (event) => {
            if (
                event.candidate &&
                this.viewer?.uid &&
                this.socket &&
                this.socket.readyState === WebSocket.OPEN
            ) {
                this.sendSignal('peer-latency-candidate', {
                    to: targetUid,
                    from: this.viewer.uid,
                    measurementId: id,
                    candidate: event.candidate,
                })
            }
        }

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState
            if (state === 'failed' || state === 'disconnected') {
                this.failSession(session, 'ice-failed')
            }
        }

        if (direction === 'outbound') {
            const channel = pc.createDataChannel('latency-probe', { ordered: true })
            session.channel = channel
            this.bindChannel(session, channel)
        } else {
            pc.ondatachannel = (event) => {
                session.channel = event.channel
                this.bindChannel(session, event.channel)
            }
        }

        return session
    }

    private bindChannel(session: MeasurementSession, channel: RTCDataChannel) {
        channel.onopen = () => {
            if (session.direction === 'outbound') {
                this.beginPingLoop(session)
            }
        }

        channel.onclose = () => {
            if (session.direction === 'outbound') {
                this.failSession(session, 'channel-closed')
            } else {
                this.cleanupSession(session)
            }
        }

        channel.onmessage = (event) => {
            let payload: any
            try {
                payload = JSON.parse(event.data)
            } catch {
                return
            }
            if (!payload?.type) return
            if (payload.type === 'latency-ping') {
                channel.send(
                    JSON.stringify({
                        type: 'latency-pong',
                        seq: payload.seq,
                        time: payload.time,
                    })
                )
            } else if (payload.type === 'latency-pong') {
                this.handlePong(session, payload)
            } else if (payload.type === 'latency-complete') {
                this.cleanupSession(session)
            }
        }
    }

    private beginPingLoop(session: MeasurementSession) {
        const sendPing = () => {
            if (!session.channel || session.channel.readyState !== 'open') {
                return
            }
            const seq = ++session.sentCount
            const timestamp = performance.now()
            session.awaiting.set(seq, timestamp)
            session.channel.send(
                JSON.stringify({
                    type: 'latency-ping',
                    seq,
                    time: timestamp,
                })
            )
            if (session.sentCount < PING_SAMPLE_TARGET) {
                setTimeout(sendPing, PING_INTERVAL_MS)
            } else {
                session.completionHandle = window.setTimeout(
                    () => this.finalizeOutboundSession(session),
                    PING_INTERVAL_MS * 4
                )
            }
        }

        setTimeout(sendPing, 100)
    }

    private handlePong(session: MeasurementSession, payload: { seq?: number; time?: number }) {
        if (typeof payload.seq !== 'number') return
        const started = session.awaiting.get(payload.seq)
        if (started === undefined) return
        session.awaiting.delete(payload.seq)
        const now = performance.now()
        const rtt = now - started
        if (Number.isFinite(rtt)) {
            session.samples.push(rtt)
        }
        if (
            session.direction === 'outbound' &&
            session.samples.length >= 3 &&
            session.awaiting.size === 0
        ) {
            this.finalizeOutboundSession(session)
        }
    }

    private async finalizeOutboundSession(session: MeasurementSession) {
        if (this.outboundSession?.id !== session.id) return
        if (!session.samples.length) {
            this.failSession(session, 'no-samples')
            return
        }
        if (session.completionHandle) {
            clearTimeout(session.completionHandle)
            session.completionHandle = undefined
        }
        const measurement = await this.buildMeasurement(session)
        if (measurement) {
            this.recordMeasurement(session.targetUid, measurement)
        }
        if (session.channel?.readyState === 'open') {
            session.channel.send(JSON.stringify({ type: 'latency-complete' }))
        }
        this.cleanupSession(session)
    }

    private async buildMeasurement(session: MeasurementSession) {
        if (!session.samples.length) return null
        const average =
            session.samples.reduce((sum, value) => sum + value, 0) / session.samples.length
        const jitter = this.computeJitter(session.samples)
        const stats = await this.readNetworkType(session.pc)
        const measurement = {
            ping: Math.max(1, Math.round(average)),
            jitter: Math.round(jitter),
            isUnstable: jitter >= JITTER_UNSTABLE_THRESHOLD,
            networkType: stats?.networkType,
            measuredAt: Date.now(),
        }
        return measurement
    }

    private computeJitter(samples: number[]): number {
        if (samples.length < 2) return 0
        let total = 0
        for (let i = 1; i < samples.length; i += 1) {
            total += Math.abs(samples[i] - samples[i - 1])
        }
        return total / (samples.length - 1)
    }

    private async readNetworkType(
        pc: RTCPeerConnection
    ): Promise<{ networkType?: string } | undefined> {
        try {
            const stats = await pc.getStats(null)
            let pairReport: any
            stats.forEach((report) => {
                if (
                    report.type === 'candidate-pair' &&
                    report.state === 'succeeded' &&
                    report.nominated
                ) {
                    pairReport = report
                }
            })
            if (!pairReport) return undefined
            const remoteCandidate = pairReport.remoteCandidateId
                ? stats.get(pairReport.remoteCandidateId)
                : undefined
            const localCandidate = pairReport.localCandidateId
                ? stats.get(pairReport.localCandidateId)
                : undefined
            const networkType =
                remoteCandidate?.networkType ||
                localCandidate?.networkType ||
                remoteCandidate?.candidateType ||
                localCandidate?.candidateType
            return networkType ? { networkType } : undefined
        } catch (error) {
            console.warn('Failed to read network stats', error)
            return undefined
        }
    }

    private recordMeasurement(
        targetUid: string,
        measurement: { ping: number; isUnstable: boolean; networkType?: string }
    ) {
        this.lastMeasured.set(targetUid, Date.now())
        const store = useUserStore.getState()
        const viewer = store.globalUser
        if (!viewer || viewer.uid !== this.viewer?.uid) {
            return
        }
        const current = Array.isArray(viewer.lastKnownPings) ? viewer.lastKnownPings : []
        const filtered = current.filter((entry) => entry && entry.id !== targetUid)
        const nextEntry = {
            id: targetUid,
            ping: measurement.ping,
            isUnstable: measurement.isUnstable,
            networkType: measurement.networkType,
        }
        store.setGlobalUser({
            ...viewer,
            lastKnownPings: [...filtered, nextEntry],
        })
    }

    private cancelOutboundSession() {
        if (this.outboundSession) {
            this.cleanupSession(this.outboundSession)
        }
    }

    private resetAllSessions() {
        this.sessions.forEach((session) => this.cleanupSession(session))
        this.sessions.clear()
        this.outboundSession = undefined
    }

    private cleanupSession(session: MeasurementSession) {
        if (session.timeoutHandle) {
            clearTimeout(session.timeoutHandle)
        }
        if (session.completionHandle) {
            clearTimeout(session.completionHandle)
        }
        if (session.channel && session.channel.readyState !== 'closed') {
            try {
                session.channel.close()
            } catch (error) {
                // ignore
            }
        }
        try {
            session.pc.close()
        } catch {
            // ignore
        }
        if (this.outboundSession?.id === session.id) {
            this.outboundSession = undefined
        }
        this.sessions.delete(session.id)
    }

    private failSession(session: MeasurementSession, reason: string) {
        if (session.direction === 'outbound') {
            console.warn('Latency session failed', reason)
        }
        this.cleanupSession(session)
    }

    private countInboundSessions(): number {
        let total = 0
        this.sessions.forEach((session) => {
            if (session.direction === 'inbound') total += 1
        })
        return total
    }

    private sendSignal(
        type:
            | 'peer-latency-offer'
            | 'peer-latency-answer'
            | 'peer-latency-candidate'
            | 'peer-latency-decline',
        payload: Record<string, unknown>
    ) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(
            JSON.stringify({
                type,
                ...payload,
            })
        )
    }

    private sendDecline(payload: LatencySignalPayload, reason: string) {
        if (!this.viewer?.uid || !payload.from || !payload.measurementId) return
        this.sendSignal('peer-latency-decline', {
            to: payload.from,
            from: this.viewer.uid,
            measurementId: payload.measurementId,
            reason,
        })
    }
}

export const peerLatencyManager = new PeerLatencyManager()
