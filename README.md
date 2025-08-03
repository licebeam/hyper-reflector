# Hyper Reflector? cool name maybe?

Hey if you see this, you rock you are now part of a secret society sworn by a dark pact of blood.

It also means you probably want to know what the file structure is.

the only current requirements are to have the ROMS for 3rd for fightcade and to have fightcade installed on your machine, you need to change `fightcadePath` within main.ts to match the FULL path of your fbneo emulator that is obtained via the fightcade download.

src/lua is all of the stuff from grouflons training mode that I have currently refactored, basically just for drawing text to screen right now.

src/main.ts is the main api handling and app runner, this is where the front end logic mostly happens.

- everthing else is being messed with in preload.ts , renderer.ts and the main index.html file.

within src, there is the main lua script which is being run when we open the fbneo application, hyper_reflector.lua, this handles reading from hyper_write_commands.txt on the frame
it also writes to hyper_read_commands.txt which is then sometimes parsed on command by the electron frontend.
essentially we are usinga text based file system read/write api.

that's the gist of it and there isn't much going on at the time of writing. Currently the app only allows for running commands/emu on your local machine.

check the notes.txt to see what i'm currently thinking about approaching.

In order to run the project you also need to set up the folder and files for src/private -- this is likely to move to a .env file

/private/firebase.js

```js
// from the firebase website
export const firebaseConfig = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
}
```

/private/keys.js

```js
// these will come from wherever you are hosting the backend server
const COTURN_IP = ''
const COTURN_PORT = ''
const API_PORT = ''

export default {
    COTURN_IP,
    COTURN_PORT,
    API_PORT,
}
```
