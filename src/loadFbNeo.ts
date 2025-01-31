const { exec } = require('child_process');
const path = require('path');

// Path to the Fightcade-FBNeo executable
const fightcadePath = "C:/Users/dusti/Documents/Fightcade/emulator/fbneo/fcadefbneo.exe";

// Example command to start a GGPO session (adjust for your setup)
// "quark:direct,%[^,],%d,%[^,],%d,%d,%d,%d", game, &localPort, server, &remotePort, &player, &delay, &ranked
// "quark:training,%[^,],%[^,],%d,%d", game, quarkid, &port, &delay
// `"${fightcadePath}" -game sfiii3nr1 quark:debugdetector,sfiii3nr1`; This works 
// sscanf(connect, "quark:served,%[^,],%[^,],%d,%d,%d", game, quarkid, &port, &delay, &ranked);
//
const fakeQuarkID = 'ABC123XYZ789';
const openPort = 7000;

// const command = `"${fightcadePath}" -game sfiii3nr1 quark:debugdetector,sfiii3nr1`; // debug;
// const command = `"${fightcadePath}" -game sfiii3nr1 quark:training,sfiii3nr1,${fakeQuarkID},${openPort},0`; // training mode, not working load into dc
// const command = `"${fightcadePath}" -game sfiii3nr1 quark:direct,sfiii3nr1,${openPort},192.168.11.5,7000,1,0,FALSE`; // direct, working wtf
// const command = `"${fightcadePath}" -game sfiii3nr1 quark:served,sfiii3nr1,${fakeQuarkID},${openPort},0,1`; // served, load into dc - works

export default function launchGGPO(command){
    try {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error starting Fightcade-FBNeo: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
    } catch (error) {
        console.log(error)
    }

}
