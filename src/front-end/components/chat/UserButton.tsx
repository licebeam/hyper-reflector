import { useLoginStore } from '../../state/store'

export default function UserButton({ user }) {
    const userState = useLoginStore((state) => state.userState)

    return (
        <div>
            {user.name}
            {/* {user.uid} */}
            {user.uid !== userState.uid && (
                <button
                    onClick={() => {
                        console.log(
                            'trying to call someone from: ',
                            userState.uid,
                            ' to => ',
                            user.uid
                        )
                        window.api.callUser({ callerId: userState.uid, calleeId: user.uid })
                    }}
                >
                    challenge
                </button>
            )}
        </div>
    )
}
