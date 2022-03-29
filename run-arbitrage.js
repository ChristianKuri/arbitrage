require('dotenv').config();
const Web3 = require('web3');
const abis = require('./abis');
const { addresses } = require('./addresses');

const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BSC_MAINNET_WEBSOCKET));

const amountInUSD = web3.utils.toBN(web3.utils.toWei('1'));

const PancakeSwap = new web3.eth.Contract(abis.pancakeSwap.router, addresses.pancakeSwap.router);
const BakerySwap = new web3.eth.Contract(abis.bakerySwap.router, addresses.bakerySwap.router);

web3.eth
    .subscribe('newBlockHeaders')
    .on('data', async (block) => {
        console.log(`New block ${block.number}`);

        // buy from pancake and sell to bakery
        const amountsOut1 = await PancakeSwap.methods.getAmountsOut(amountInUSD, [addresses.tokens.WBNB, addresses.tokens.BUSD]).call(); // 1 wbnb to USD
        const amountsOut2 = await BakerySwap.methods.getAmountsOut(amountsOut1[1], [addresses.tokens.BUSD, addresses.tokens.WBNB]).call();

        // buy from bakery and sell to pancake
        const amountsOut3 = await BakerySwap.methods.getAmountsOut(amountInUSD, [addresses.tokens.WBNB, addresses.tokens.BUSD]).call();
        const amountsOut4 = await PancakeSwap.methods.getAmountsOut(amountsOut3[1], [addresses.tokens.BUSD, addresses.tokens.WBNB]).call();

        console.log(`PancakeSwap -> BakerySwap. WBNB input / output: ${web3.utils.fromWei(amountInUSD.toString())} / ${web3.utils.fromWei(amountsOut2[1].toString())}`);
        console.log(`BakerySwap -> PancakeSwap. WBNB input / output: ${web3.utils.fromWei(amountInUSD.toString())} / ${web3.utils.fromWei(amountsOut4[1].toString())}`);
        console.log(`PancakeSwap: ${web3.utils.fromWei(amountInUSD.toString())} WBNB sells for ${web3.utils.fromWei(amountsOut1[1].toString())} USD`);
        console.log(`BakerySwap: ${web3.utils.fromWei(amountInUSD.toString())} WBNB sells for ${web3.utils.fromWei(amountsOut3[1].toString())} USD`);
    })
    .on('error', (error) => {
        console.log(error);
    });
