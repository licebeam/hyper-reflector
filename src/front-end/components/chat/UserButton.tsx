import { useLoginStore, useMessageStore } from '../../state/store'

export default function UserButton({ user }) {
    const userState = useLoginStore((state) => state.userState)
    const callData = useMessageStore((state) => state.callData)

    const isUserChallenging = () => {
        console.log(callData)
        if (callData.find((call) => call.callerId === user.uid)) {
            console.log('caller found')
            return true
        }
        return false
    }

    return (
        <div>
            {user.name}
            {user.uid}
            {!isUserChallenging() && user.uid !== userState.uid && (
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
            {isUserChallenging() && (
                <button
                    onClick={() => {
                        const caller = callData.find((call) => call.callerId === user.uid)
                        console.log('accepting challenge from', caller)
                        window.api.answerCall(caller)
                    }}
                >
                    accept fate
                </button>
            )}
        </div>
    )
}
