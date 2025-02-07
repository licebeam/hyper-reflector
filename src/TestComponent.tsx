import * as React from 'react'

export default function TestComponent() {
    return (
        <>
            <button onClick={() => {
                window.api.serveMatch('127.0.0.1', 7000);
            }}>click me</button>
            <div>Hello World</div>
        </>
    )
}