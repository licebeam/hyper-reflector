import keys from '../private/keys'
import { useUserStore } from '../state/store'
import type { TUser } from '../types/user'
import { isMockUserId } from '../match'

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: `stun:${keys.COTURN_IP}:${keys.COTURN_PORT}` },
]

const MAX_PARALLEL_OUTBOUND = 5
const MAX_INBOUND_SESSIONS = 3
const MEASUREMENT_TTL_MS = 2 * 60 * 1000
const SESSION_TIMEOUT_MS = 10_000
const PING_INTERVAL_MS = 180
const PING_SAMPLE_TARGET = 3
const JITTER_UNSTABLE_THRESHOLD = 6
const TICK_FAST_MS = 1_000   // when unmeasured peers exist
const TICK_IDLE_MS = 15_000  // once everyone is covered

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
    private outboundSessions = new Map<string, MeasurementSession>() // measurementId → session
    private measuringTargets = new Set<string>()                      // targetUid → in-progress
    private sessions = new Map<string, MeasurementSession>()
    private lastMeasured = new Map<string, number>()
    private schedulerHandle?: ReturnType<typeof setTimeout>
    private inMatch = false

    /** Called when a measurement result is ready. Override to skip the v1 user store. */
    onPingRecorded?: (targetUid: string, ping: number, isUnstable: boolean, networkType?: string) => void
    /** Called when a peer starts or finishes being measured — drives "estimating" UI. */
    onMeasuringChanged?: (uid: string, measuring: boolean) => void

    constructor() {
        if (typeof window !== 'undefined') this.reschedule()
    }

    setViewer(viewer?: TUser | null) {
        this.viewer = viewer || undefined
        if (!viewer) this.resetAllSessions()
    }

    setPeers(peers: TUser[]) {
        this.peers = Array.isArray(peers) ? peers : []
    }

    setInMatch(active: boolean) {
        this.inMatch = active
        if (active) this.cancelAllOutboundSessions()
    }

    attachSocket(socket: WebSocket | null) {
        this.socket = socket || undefined
        if (!socket) this.resetAllSessions()
    }

    /** Force an immediate remeasurement for a specific uid (e.g. on challenge / rank match). */
    triggerMeasureNow(uid: string) {
        this.lastMeasured.delete(uid)
        this.reschedule(true)
    }

    handleSignal(payload: LatencySignalPayload): boolean {
        if (!payload?.type) return false
        switch (payload.type) {
            case 'peer-latency-offer':    void this.handleInboundOffer(payload);   return true
            case 'peer-latency-answer':   void this.handleInboundAnswer(payload);  return true
            case 'peer-latency-candidate': void this.handleIncomingCandidate(payload); return true
            case 'peer-latency-decline':  this.handleDecline(payload);             return true
            default: return false
        }
    }

    // ── Scheduler ─────────────────────────────────────────────────────────────

    private reschedule(immediate = false) {
        if (this.schedulerHandle) clearTimeout(this.schedulerHandle)
        const hasWork = this.peers.some(p => {
            if (!p?.uid || p.uid === this.viewer?.uid) return false
            if (this.measuringTargets.has(p.uid)) return false
            const last = this.lastMeasured.get(p.uid)
            return !last || Date.now() - last >= MEASUREMENT_TTL_MS
        })
        const delay = immediate ? 0 : hasWork ? TICK_FAST_MS : TICK_IDLE_MS
        this.schedulerHandle = window.setTimeout(() => {
            this.tick()
            this.reschedule()
        }, delay)
    }

    private tick() {
        if (!this.viewer || this.inMatch) return
        const slots = MAX_PARALLEL_OUTBOUND - this.outboundSessions.size
        if (slots <= 0) return
        for (const peer of this.selectNextPeers(slots)) {
            if (isMockUserId(peer.uid)) {
                this.simulateMockMeasurement(peer.uid)
            } else {
                void this.startOutboundMeasurement(peer.uid)
            }
        }
    }

    private selectNextPeers(n: number): TUser[] {
        if (!this.viewer) return []
        const now = Date.now()
        const viewerCountry = this.viewer.countryCode?.toUpperCase() || ''
        const eligible = this.peers.filter(u => {
            if (!u?.uid || u.uid === this.viewer?.uid) return false
            if (this.measuringTargets.has(u.uid)) return false
            const last = this.lastMeasured.get(u.uid)
            return !last || now - last >= MEASUREMENT_TTL_MS
        })
        eligible.sort((a, b) =>
            this.computePriorityScore(a, viewerCountry) - this.computePriorityScore(b, viewerCountry)
        )
        return eligible.slice(0, n)
    }

    private computePriorityScore(user: TUser, viewerCountry: string): number {
        let score = 0
        const u = user as any
        // Deprioritize AFK/in-match — still measure them, just after available players
        if (u.isAfk || u.currentMatchId) score += 100
        const country = user.countryCode?.toUpperCase()
        if (!country || !viewerCountry) score += 5
        else if (country !== viewerCountry) score += 10
        // Boost least-recently-measured peers
        const last = this.lastMeasured.get(user.uid)
        if (last) score += Math.max(0, MEASUREMENT_TTL_MS - (Date.now() - last)) / 1000
        return score + Math.random() * 0.01
    }

    // ── Mock simulation ───────────────────────────────────────────────────────

    private simulateMockMeasurement(targetUid: string) {
        this.measuringTargets.add(targetUid)
        this.lastMeasured.set(targetUid, Date.now())
        this.onMeasuringChanged?.(targetUid, true)
        const ping = Math.round(20 + Math.random() * 180)
        const jitter = Math.random() * 10
        const isUnstable = jitter >= JITTER_UNSTABLE_THRESHOLD
        const delay = 800 + Math.random() * 1800
        window.setTimeout(() => {
            this.measuringTargets.delete(targetUid)
            this.lastMeasured.set(targetUid, Date.now())
            this.onMeasuringChanged?.(targetUid, false)
            this.onPingRecorded?.(targetUid, ping, isUnstable, undefined)
        }, delay)
    }

    // ── Outbound measurement ──────────────────────────────────────────────────

    private async startOutboundMeasurement(targetUid: string) {
        if (!this.viewer?.uid || !this.socket || this.socket.readyState !== WebSocket.OPEN) return
        const measurementId = `${this.viewer.uid}-${targetUid}-${Date.now()}`
        const session = this.createSession(measurementId, targetUid, 'outbound')
        this.outboundSessions.set(measurementId, session)
        this.sessions.set(session.id, session)
        this.measuringTargets.add(targetUid)
        this.onMeasuringChanged?.(targetUid, true)
        try {
            const offer = await session.pc.createOffer()
            await session.pc.setLocalDescription(offer)
            this.sendSignal('peer-latency-offer', {
                to: targetUid, from: this.viewer.uid, measurementId, offer,
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

    // ── Inbound handling ──────────────────────────────────────────────────────

    private async handleInboundOffer(payload: LatencySignalPayload) {
        if (!this.viewer?.uid || this.inMatch) { this.sendDecline(payload, 'busy'); return }
        if (!payload.measurementId || !payload.offer || !payload.from) return
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
                to: payload.from, from: this.viewer.uid, measurementId: payload.measurementId, answer,
            })
            session.timeoutHandle = window.setTimeout(
                () => this.failSession(session, 'timeout'), SESSION_TIMEOUT_MS
            )
        } catch (error) {
            console.error('Failed to answer latency offer', error)
            this.failSession(session, 'answer-error')
            this.sendDecline(payload, 'answer-error')
        }
    }

    private async handleInboundAnswer(payload: LatencySignalPayload) {
        if (!payload.measurementId || !payload.answer) return
        const session = this.outboundSessions.get(payload.measurementId)
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
        const session = this.outboundSessions.get(payload.measurementId)
        if (session) this.failSession(session, 'declined')
    }

    private flushPendingCandidates(session: MeasurementSession) {
        if (!session.pc.remoteDescription || !session.pendingCandidates.length) return
        const queue = [...session.pendingCandidates]
        session.pendingCandidates.length = 0
        queue.forEach(async candidate => {
            try { await session.pc.addIceCandidate(new RTCIceCandidate(candidate)) }
            catch (error) { console.warn('Failed to flush ICE candidate', error) }
        })
    }

    // ── Session lifecycle ─────────────────────────────────────────────────────

    private createSession(id: string, targetUid: string, direction: MeasurementDirection): MeasurementSession {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        const session: MeasurementSession = {
            id, targetUid, direction, pc,
            awaiting: new Map(), samples: [], sentCount: 0,
            pendingCandidates: [], startedAt: Date.now(),
        }
        pc.onicecandidate = event => {
            if (event.candidate && this.viewer?.uid && this.socket?.readyState === WebSocket.OPEN) {
                this.sendSignal('peer-latency-candidate', {
                    to: targetUid, from: this.viewer.uid, measurementId: id, candidate: event.candidate,
                })
            }
        }
        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState
            if (s === 'failed' || s === 'disconnected') this.failSession(session, 'ice-failed')
        }
        if (direction === 'outbound') {
            const ch = pc.createDataChannel('latency-probe', { ordered: true })
            session.channel = ch
            this.bindChannel(session, ch)
        } else {
            pc.ondatachannel = event => {
                session.channel = event.channel
                this.bindChannel(session, event.channel)
            }
        }
        return session
    }

    private bindChannel(session: MeasurementSession, channel: RTCDataChannel) {
        channel.onopen = () => { if (session.direction === 'outbound') this.beginPingLoop(session) }
        channel.onclose = () => {
            if (session.direction === 'outbound') this.failSession(session, 'channel-closed')
            else this.cleanupSession(session)
        }
        channel.onmessage = event => {
            let payload: any
            try { payload = JSON.parse(event.data) } catch { return }
            if (!payload?.type) return
            if (payload.type === 'latency-ping') {
                channel.send(JSON.stringify({ type: 'latency-pong', seq: payload.seq, time: payload.time }))
            } else if (payload.type === 'latency-pong') {
                this.handlePong(session, payload)
            } else if (payload.type === 'latency-complete') {
                this.cleanupSession(session)
            }
        }
    }

    private beginPingLoop(session: MeasurementSession) {
        const sendPing = () => {
            if (!session.channel || session.channel.readyState !== 'open') return
            const seq = ++session.sentCount
            const timestamp = performance.now()
            session.awaiting.set(seq, timestamp)
            session.channel.send(JSON.stringify({ type: 'latency-ping', seq, time: timestamp }))
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
        const rtt = performance.now() - started
        if (Number.isFinite(rtt)) session.samples.push(rtt)
        if (session.direction === 'outbound' && session.samples.length >= 2 && session.awaiting.size === 0) {
            this.finalizeOutboundSession(session)
        }
    }

    private async finalizeOutboundSession(session: MeasurementSession) {
        if (!this.outboundSessions.has(session.id)) return
        if (!session.samples.length) { this.failSession(session, 'no-samples'); return }
        if (session.completionHandle) { clearTimeout(session.completionHandle); session.completionHandle = undefined }
        const measurement = await this.buildMeasurement(session)
        if (measurement) this.recordMeasurement(session.targetUid, measurement)
        if (session.channel?.readyState === 'open') {
            session.channel.send(JSON.stringify({ type: 'latency-complete' }))
        }
        this.cleanupSession(session)
    }

    private async buildMeasurement(session: MeasurementSession) {
        if (!session.samples.length) return null
        const average = session.samples.reduce((s, v) => s + v, 0) / session.samples.length
        const jitter = this.computeJitter(session.samples)
        const stats = await this.readNetworkType(session.pc)
        return {
            ping: Math.max(1, Math.round(average)),
            jitter: Math.round(jitter),
            isUnstable: jitter >= JITTER_UNSTABLE_THRESHOLD,
            networkType: stats?.networkType,
            measuredAt: Date.now(),
        }
    }

    private computeJitter(samples: number[]): number {
        if (samples.length < 2) return 0
        let total = 0
        for (let i = 1; i < samples.length; i++) total += Math.abs(samples[i] - samples[i - 1])
        return total / (samples.length - 1)
    }

    private async readNetworkType(pc: RTCPeerConnection): Promise<{ networkType?: string } | undefined> {
        try {
            const stats = await pc.getStats(null)
            let pair: any
            stats.forEach(r => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) pair = r })
            if (!pair) return undefined
            const remote = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId) : undefined
            const local  = pair.localCandidateId  ? stats.get(pair.localCandidateId)  : undefined
            const networkType = remote?.networkType || local?.networkType || remote?.candidateType || local?.candidateType
            return networkType ? { networkType } : undefined
        } catch { return undefined }
    }

    private recordMeasurement(targetUid: string, measurement: { ping: number; isUnstable: boolean; networkType?: string }) {
        this.lastMeasured.set(targetUid, Date.now())
        if (this.onPingRecorded) {
            this.onPingRecorded(targetUid, measurement.ping, measurement.isUnstable, measurement.networkType)
            return
        }
        // v1 fallback: write directly to the global user store
        const store = useUserStore.getState()
        const viewer = store.globalUser
        if (!viewer || viewer.uid !== this.viewer?.uid) return
        const current = Array.isArray(viewer.lastKnownPings) ? viewer.lastKnownPings : []
        const filtered = current.filter(e => e && e.id !== targetUid)
        store.setGlobalUser({
            ...viewer,
            lastKnownPings: [...filtered, {
                id: targetUid, ping: measurement.ping,
                isUnstable: measurement.isUnstable, networkType: measurement.networkType,
            }],
        })
    }

    // ── Cleanup helpers ───────────────────────────────────────────────────────

    private cancelAllOutboundSessions() {
        for (const session of this.outboundSessions.values()) this.cleanupSession(session)
    }

    private resetAllSessions() {
        for (const session of this.sessions.values()) this.cleanupSession(session)
        this.sessions.clear()
        this.outboundSessions.clear()
        this.measuringTargets.clear()
    }

    private cleanupSession(session: MeasurementSession) {
        if (session.timeoutHandle)    clearTimeout(session.timeoutHandle)
        if (session.completionHandle) clearTimeout(session.completionHandle)
        if (session.channel && session.channel.readyState !== 'closed') {
            try { session.channel.close() } catch {}
        }
        try { session.pc.close() } catch {}
        this.outboundSessions.delete(session.id)
        this.sessions.delete(session.id)
        if (session.direction === 'outbound' && this.measuringTargets.has(session.targetUid)) {
            this.measuringTargets.delete(session.targetUid)
            this.onMeasuringChanged?.(session.targetUid, false)
        }
    }

    private failSession(session: MeasurementSession, reason: string) {
        if (session.direction === 'outbound') console.warn('Latency session failed', reason)
        this.cleanupSession(session)
    }

    private countInboundSessions(): number {
        let n = 0
        this.sessions.forEach(s => { if (s.direction === 'inbound') n++ })
        return n
    }

    private sendSignal(
        type: 'peer-latency-offer' | 'peer-latency-answer' | 'peer-latency-candidate' | 'peer-latency-decline',
        payload: Record<string, unknown>
    ) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({ type, ...payload }))
    }

    private sendDecline(payload: LatencySignalPayload, reason: string) {
        if (!this.viewer?.uid || !payload.from || !payload.measurementId) return
        this.sendSignal('peer-latency-decline', {
            to: payload.from, from: this.viewer.uid, measurementId: payload.measurementId, reason,
        })
    }
}

export const peerLatencyManager = new PeerLatencyManager()
