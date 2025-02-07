import * as React from 'react'

export default function Layout({ children }) {
    return (
        <div>
            <div>
                layout header
            </div>
            {children}
        </div>
    )
}