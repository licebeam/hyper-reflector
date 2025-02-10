import Layout from '../layout/Layout'

export default function SettingsPage() {
    return (
        <Layout>
            <div> This is where we can set our emulator path and other setting </div>
            <button onClick={() => {
                window.api.setEmulatorPath();
            }}>Set Emulator Path</button>
        </Layout>
    )
}