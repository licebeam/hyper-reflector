const { exec } = require('child_process');

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
