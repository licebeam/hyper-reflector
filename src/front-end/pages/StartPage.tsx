import * as React from 'react'
import Layout from '../layout/Layout'
import LoginBlock from '../components/LoginBlock'

export default function StartPage() {
    return (
        <Layout> 
        Welcome to hyper reflector
        <LoginBlock/>
        <div>
            <p>Play Offline</p>
            <button onClick={() => console.log('go to offline page')}>Direct Connections</button>
            <button onClick={() => window.api.startSoloTraining()}>Training Modes</button>
        </div>
        </Layout>
    )
}