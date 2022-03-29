require('dotenv').config();
const Web3 = require('web3');
const abis = require('./abis');
const { addresses } = require('./addresses');
const BigNumber = require('bignumber.js');
const Flashloan = require('./build/contracts/Flashloan.json');

const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.GETBLOCK_BSC_MAINNET_WEBSOCKET));

const { address: admin } = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY);

const amountInWBNB = web3.utils.toBN(web3.utils.toWei('1'));
const repayAmount = amountInWBNB - amountInWBNB * 0.997 + amountInWBNB;

const tokenName = 'BUSD';

const PancakeSwap = new web3.eth.Contract(abis.pancakeSwap.router, addresses.pancakeSwap.router);
const BakerySwap = new web3.eth.Contract(abis.bakerySwap.router, addresses.bakerySwap.router);
const ApeSwap = new web3.eth.Contract(abis.apeSwap.router, addresses.apeSwap.router);

const getArrayMax = (array) => {
    return array.reduce((a, b) => {
        return BigNumber(a).gt(BigNumber(b)) ? BigNumber(a).toString() : BigNumber(b).toString();
    });
};

const init = async () => {
    const networkId = await web3.eth.net.getId();
    //const flashloan = new web3.eth.Contract(Flashloan.abi, Flashloan.networks[networkId].address);

    web3.eth
        .subscribe('newBlockHeaders')
        .on('data', async (block) => {
            console.log(`New block ${block.number}`);

            // Get the buy market
            const buyAtPancakeSwap = await PancakeSwap.methods.getAmountsOut(amountInWBNB, [addresses.tokens.WBNB, addresses.tokens.BUSD]).call(); // buy TOKEN at PancakeSwap with (1) WBNB
            const buyAtBakerySwap = await BakerySwap.methods.getAmountsOut(amountInWBNB, [addresses.tokens.WBNB, addresses.tokens.BUSD]).call(); // buy TOKEN at BakerySwap with (1) WBNB
            const buyAtApeSwap = await ApeSwap.methods.getAmountsOut(amountInWBNB, [addresses.tokens.WBNB, addresses.tokens.BUSD]).call(); // buy TOKEN at ApeSwap with (1) WBNB

            const maxTokens = getArrayMax([buyAtPancakeSwap[1], buyAtBakerySwap[1], buyAtApeSwap[1]]);

            // Get the sell market
            const sellAtPancakeSwap = await PancakeSwap.methods.getAmountsOut(maxTokens, [addresses.tokens.BUSD, addresses.tokens.WBNB]).call(); // sell TOKEN at PancakeSwap to (1) WBNB
            const sellAtBakerySwap = await BakerySwap.methods.getAmountsOut(maxTokens, [addresses.tokens.BUSD, addresses.tokens.WBNB]).call(); // sell TOKEN at BakerySwap to (1) WBNB
            const sellAtApeSwap = await ApeSwap.methods.getAmountsOut(maxTokens, [addresses.tokens.BUSD, addresses.tokens.WBNB]).call(); // sell TOKEN at ApeSwap to (1) WBNB

            const maxWBNB = getArrayMax([sellAtPancakeSwap[1], sellAtBakerySwap[1], sellAtApeSwap[1]]);

            // create logs
            var buyMarket;
            var sellMarket;

            switch (maxTokens) {
                case buyAtPancakeSwap[1]:
                    buyMarket = 'PancakeSwap';
                    break;

                case buyAtBakerySwap[1]:
                    buyMarket = 'BakerySwap';
                    break;

                case buyAtApeSwap[1]:
                    buyMarket = 'ApeSwap';
                    break;
            }

            switch (maxWBNB) {
                case sellAtPancakeSwap[1]:
                    sellMarket = 'PancakeSwap';
                    break;

                case sellAtBakerySwap[1]:
                    sellMarket = 'BakerySwap';
                    break;

                case sellAtApeSwap[1]:
                    sellMarket = 'ApeSwap';
                    break;
            }

            console.log(`${buyMarket} -> ${sellMarket}. WBNB -> ${tokenName} -> WBNB input / output: ${web3.utils.fromWei(amountInWBNB.toString())} / ${web3.utils.fromWei(maxWBNB.toString())}`);

            // calculate costs
            const gasCost = 200000;
            const gasPrice = await web3.eth.getGasPrice();
            const txCost = gasCost * parseInt(gasPrice);

            // calculate profit
            const profit = BigNumber(maxWBNB).minus(repayAmount).minus(txCost);

            // send transaction
            if (profit.gt(0)) {
                console.log('------------------------------');
                console.log('Arb opportunity found');
                console.log(`Expected profit: ${web3.utils.fromWei(profit.toString())} WBNB`);
                console.log(`buying ${web3.utils.fromWei(maxTokens)} ${tokenName} at ${buyMarket} using ${web3.utils.fromWei(amountInWBNB)} WBNB`);
                console.log(`selling ${web3.utils.fromWei(maxTokens)} ${tokenName} at ${sellMarket} for ${web3.utils.fromWei(maxWBNB)} WBNB`);
                console.log('------------------------------');
            }

            /* const profitPancakeSwapToBakerySwap = amountsOut2[1].sub(amountInWBNB).sub(txCost);
            const profitBakerySwapToPancakeSwap = amountsOut4[1].sub(amountInWBNB).sub(txCost);

            if (profitPancakeSwapToBakerySwap > 0) {
                console.log('Arb opportunity found from PancakeSwap -> BakerySwap!');
                console.log(`Expected profit: ${web3.utils.fromWei(profitPancakeSwapToBakerySwap.toString())} USD`);
            }

            if (profitBakerySwapToPancakeSwap > 0) {
                console.log('Arb opportunity found from BakerySwap -> PancakeSwap!');
                console.log(`Expected profit: ${web3.utils.fromWei(profitBakerySwapToPancakeSwap.toString())} USD`);
            } */
        })
        .on('error', (error) => {
            console.log(error);
        });
};
init();
