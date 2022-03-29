require('dotenv').config();
const Web3 = require('web3');
const abis = require('./abis');
const { addresses } = require('./addresses');

const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BSC_MAINNET_WEBSOCKET));

const amountInUSD = web3.utils.toBN(web3.utils.toWei('1'));

const PancakeSwap = new web3.eth.Contract(abis.pancakeSwap.router, addresses.pancakeSwap.router);
const BakerySwap = new web3.eth.Contract(abis.bakerySwap.router, addresses.bakerySwap.router);
const ApeSwap = new web3.eth.Contract(abis.apeSwap.router, addresses.apeSwap.router);

web3.eth
    .subscribe('newBlockHeaders')
    .on('data', async (block) => {
        console.log(`New block ${block.number}`);

        // buy from pancake and sell to bakery
        const amountsOut1 = await PancakeSwap.methods.getAmountsOut(amountInUSD, [addresses.tokens.WBNB, addresses.tokens.BUSD]).call(); // 1 wbnb to USD (sell WBNB at PancakeSwap)
        const amountsOut2 = await BakerySwap.methods.getAmountsOut(amountsOut1[1], [addresses.tokens.BUSD, addresses.tokens.WBNB]).call(); // buy back the wbnb (buy WBNB at BakerySwap)

        // buy from bakery and sell to pancake
        const amountsOut3 = await BakerySwap.methods.getAmountsOut(amountInUSD, [addresses.tokens.WBNB, addresses.tokens.BUSD]).call();
        const amountsOut4 = await PancakeSwap.methods.getAmountsOut(amountsOut3[1], [addresses.tokens.BUSD, addresses.tokens.WBNB]).call();

        // buy from pancake and sell from ApeSwap
        const amountsOut5 = await ApeSwap.methods.getAmountsOut(amountInUSD, [addresses.tokens.WBNB, addresses.tokens.BUSD]).call();
        const amountsOut6 = await ApeSwap.methods.getAmountsOut(amountsOut1[1], [addresses.tokens.BUSD, addresses.tokens.WBNB]).call();

        console.log(`PancakeSwap -> BakerySwap. WBNB input / output: ${web3.utils.fromWei(amountInUSD.toString())} / ${web3.utils.fromWei(amountsOut2[1].toString())}`);
        console.log(`PancakeSwap -> ApeSwap. WBNB input / output: ${web3.utils.fromWei(amountInUSD.toString())} / ${web3.utils.fromWei(amountsOut6[1].toString())}`);
        console.log(`BakerySwap -> PancakeSwap. WBNB input / output: ${web3.utils.fromWei(amountInUSD.toString())} / ${web3.utils.fromWei(amountsOut4[1].toString())}`);
        console.log(`PancakeSwap: ${web3.utils.fromWei(amountInUSD.toString())} WBNB sells for ${web3.utils.fromWei(amountsOut1[1].toString())} USD`);
        console.log(`BakerySwap: ${web3.utils.fromWei(amountInUSD.toString())} WBNB sells for ${web3.utils.fromWei(amountsOut3[1].toString())} USD`);
        console.log(`ApeSwap: ${web3.utils.fromWei(amountInUSD.toString())} WBNB sells for ${web3.utils.fromWei(amountsOut5[1].toString())} USD`);

        const gasCost = 200000;
        const gasPrice = await web3.eth.getGasPrice();
        const txCost = gasCost * parseInt(gasPrice);

        const profitPancakeSwapToBakerySwap = amountsOut2[1].sub(amountInUSD).sub(txCost);
        const profitBakerySwapToPancakeSwap = amountsOut4[1].sub(amountInUSD).sub(txCost);

        if (profitPancakeSwapToBakerySwap > 0) {
            console.log('Arb opportunity found from PancakeSwap -> BakerySwap!');
            console.log(`Expected profit: ${web3.utils.fromWei(profitPancakeSwapToBakerySwap.toString())} USD`);
        }

        if (profitBakerySwapToPancakeSwap > 0) {
            console.log('Arb opportunity found from BakerySwap -> PancakeSwap!');
            console.log(`Expected profit: ${web3.utils.fromWei(profitBakerySwapToPancakeSwap.toString())} USD`);
        }
    })
    .on('error', (error) => {
        console.log(error);
    });
