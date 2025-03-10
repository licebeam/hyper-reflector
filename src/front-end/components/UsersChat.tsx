import { useState, useEffect } from 'react'
import { useLoginStore, useMessageStore } from '../state/store'
import UserButton from './chat/UserButton'

export default function UsersChat() {
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const userState = useLoginStore((state) => state.userState)
    const userList = useMessageStore((state) => state.userList)
    const setUsersList = useMessageStore((state) => state.setUsersList)
    const addUser = useMessageStore((state) => state.pushUser)
    const removeUser = useMessageStore((state) => state.removeUser)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const setCallData = useMessageStore((state) => state.setCallData)

    // user has joined lobby
    const handleUserJoinGroup = (users) => {
        clearUserList()
        console.log('setting list to : ', users)
        // sets the list of users from the websocket server
        setUsersList(users)
    }

    const handleUserJoin = (user) => {
        console.log(user)
        addUser(user)
    }

    // user leaves lobby
    const handleUserLeave = (user) => {
        removeUser(user)
    }

    const handleReceiveCall = (data) => {
        console.log('RECIEVED CALL')
        setCallData(data)
    }

    // get users from websockets
    useEffect(() => {
        window.api.removeAllListeners('room-users-add-group', handleUserJoinGroup)
        window.api.on('room-users-add-group', handleUserJoinGroup)
        return () => {
            window.api.removeListener('room-users-add-group', handleUserJoinGroup)
        }
    }, [])

    useEffect(() => {
        window.api.removeAllListeners('room-users-add', handleUserJoin)
        window.api.on('room-users-add', handleUserJoin)
        return () => {
            window.api.removeListener('room-users-add', handleUserJoin)
        }
    }, [])

    useEffect(() => {
        window.api.removeAllListeners('room-users-remove', handleUserLeave)
        window.api.on('room-users-remove', handleUserLeave)
        return () => {
            window.api.removeListener('room-users-remove', handleUserLeave)
        }
    }, [])

    //get challenge requests
    useEffect(() => {
        window.api.removeAllListeners('receivedCall', handleReceiveCall)
        window.api.on('receivedCall', handleReceiveCall)
        return () => {
            window.api.removeListener('receivedCall', handleReceiveCall)
        }
    }, [])

    useEffect(() => {
        console.log('users updated', userList)
    }, [userList])

    const renderUsers = () => {
        return userList.map((user, index) => {
            var timestamp = new Date()
            return <UserButton key={index + timestamp + user.uid} user={user} />
        })
    }

    return (
        <div style={{ display: 'flex', overflowY: 'auto' }}>
            {isLoggedIn && <div>{renderUsers()}</div>}
        </div>
    )
}
