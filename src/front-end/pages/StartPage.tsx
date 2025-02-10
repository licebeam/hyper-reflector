import Layout from '../layout/Layout'
import LoginBlock from '../components/LoginBlock'
import { Link } from '@tanstack/react-router'

export default function StartPage() {
    return (
        <Layout>
            Welcome to hyper reflector
            <LoginBlock />
            <div>
                <Link to="/offline" className="[&.active]:font-bold">
                    Play Offline
                </Link>{' '}
            </div>
        </Layout>
    )
}
