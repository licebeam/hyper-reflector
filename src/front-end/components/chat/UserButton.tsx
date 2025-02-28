export default function UserButton({ user }) {
    return (
        <div>
            {user.name}
            {user.uid}
            <button
                onClick={() => {
                    console.log('trying to call someone')
                    window.api.callUser({ callerId: 'blah blah', calleeId: user.uid })
                }}
            >
                challenge
            </button>
        </div>
    )
}
