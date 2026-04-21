## Welcome to Hyper Reflector

### Prerequisites

- Node.js 18+ (or newer) with npm for the Vite frontend.
- Rust toolchain (via [rustup](https://rustup.rs/)) and the Tauri CLI (`cargo install tauri-cli`) for packaging the desktop app.

### Install & Run

```bash
npm install           # install dependencies
npm run dev           # vite dev server
npm run tauri dev     # tauri desktop dev window
npm run build         # web production bundle
npm run tauri build   # desktop installers
```

# How to build:

To build for release the command is 
```bash
cargo build --release
```

To debug a release build - creates a build with debug enabled, check the dev tools console for errors.
```bash
npx tauri build --debug
```

In order to run hyper-reflector locally, you'll need to have firebase setup
https://firebase.google.com/

Additionally, you'll need to have a server either local or remote to run the required servers.
All of which can be found in our backend repo - https://github.com/Hyper-Reflector-Team/hyper-reflector-backend

Once those two requirements are met you'll need an additional two files which must be located in "Hyper-Reflector/src/private"

These files are:

firebase.js

```
export const firebaseConfig = {
    apiKey: 'key',
    authDomain: 'domain',
    projectId: 'project-id',
    storageBucket: 'bucket',
    messagingSenderId: 'sender-id',
    appId: 'app-id',
    measurementId: 'measurement-id',
}
```

keys.js

```
const COTURN_IP = "ip-for-your-serverhost";
const API_PORT = "express-server-port";
const PUNCH_PORT = "hole-punch-server-port";
const COTURN_PORT = "turn-server-port"; // not needed this is the external TURN server only required in some cases for hole punching.
const SIGNAL_PORT = "websocket-server-port";

export default {
  COTURN_IP,
  COTURN_PORT,
  API_PORT,
  PUNCH_PORT,
  SIGNAL_PORT,
};

```
