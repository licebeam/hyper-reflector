const net = require("net");
const client = new net.Socket();

export default function networkTest(){
    console.log('hey');
    client.connect(12345, "localhost", () => {
        console.log("Connected to FBNeo!");
        client.write("pause\n"); // Send a command to pause the game
    });
    
    client.on("data", (data) => {
        console.log("FBNeo Response:", data.toString());
    });
}
