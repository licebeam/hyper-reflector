import Layout from '../layout/Layout'

export default function OfflinePage() {
    return (
        <Layout>
            <div>
                <p>Play Offline</p>
                <button onClick={() => console.log('go to offline page')}>
                    Direct Connections
                </button>
                <button onClick={() => window.api.startSoloTraining()}>Training Modes</button>
            </div>
        </Layout>
    )
}
