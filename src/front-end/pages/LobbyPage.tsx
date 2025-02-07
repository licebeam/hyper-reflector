import * as React from 'react'
import Layout from '../layout/Layout'
import ChatWindow from '../components/ChatWindow'
import ChatBar from '../components/ChatBar'

export default function LobbyPage() {
    return (
        <Layout>
            <ChatWindow />
            <ChatBar />
        </Layout>
    )
}