require('dotenv').config();
const Web3 = require('web3');

const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BSC_MAINNET_WEBSOCKET));

web3.eth
    .subscribe('newBlockHeaders')
    .on('data', async (block) => {
        console.log(`New block ${block.number}`);
    })
    .on('error', (error) => {
        console.log(error);
    });
