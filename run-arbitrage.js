require('dotenv').config()
const Web3 = require('web3')
const abis = require('./abis')
const { addresses } = require('./addresses')
const BigNumber = require('bignumber.js')
const Flashloan = require('./build/contracts/Flashloan.json')
const log = require('log-to-file')

/** Config */
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.NARIOX_BSC_MAINNET_WEBSOCKET))
const { address: admin } = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY)
BigNumber.config({ EXPONENTIAL_AT: [-30, 30] })

const amountInWBNB = web3.utils.toBN(web3.utils.toWei('1'))

const exchanges = {
  pancakeSwap: new web3.eth.Contract(abis.pancakeSwap.router, addresses.pancakeSwap.router),
  bakerySwap: new web3.eth.Contract(abis.bakerySwap.router, addresses.bakerySwap.router),
  apeSwap: new web3.eth.Contract(abis.apeSwap.router, addresses.apeSwap.router),
  biSwap: new web3.eth.Contract(abis.biSwap.router, addresses.biSwap.router),
  babySwap: new web3.eth.Contract(abis.babySwap.router, addresses.babySwap.router),
}

const getArrayMax = (array) => {
  return array.reduce((a, b) => {
    return BigNumber(a).gt(BigNumber(b)) ? BigNumber(a).toString() : BigNumber(b).toString()
  })
}

const getObjectMax = (obj) => {
  const keys = Object.keys(obj)
  const values = keys.map((key) => {
    return obj[key]
  })
  return keys[values.indexOf(getArrayMax(values))]
}

const init = async () => {
  const networkId = await web3.eth.net.getId()
  //const flashloan = new web3.eth.Contract(Flashloan.abi, Flashloan.networks[networkId].address)

  web3.eth
    .subscribe('newBlockHeaders')
    .on('data', async (block) => {
      console.log(`New block ${block.number}`)

      for (var [tokenName, tokenAddress] of Object.entries(addresses.tokens)) {
        // Get the buy market
        let buyAt = {}
        for (var [exchangeName, exchangeContract] of Object.entries(exchanges)) {
          try {
            const data = await exchangeContract.methods.getAmountsOut(amountInWBNB, [addresses.wbnb, tokenAddress]).call() // buy TOKEN from (1) WBNB
            buyAt[exchangeName] = data[1]
          } catch (error) {}
        }
        const buyMarket = getObjectMax(buyAt)
        const maxTokens = buyAt[buyMarket]

        // Get the sell market
        let sellAt = {}
        for (var [exchangeName, exchangeContract] of Object.entries(exchanges)) {
          try {
            const data = await exchangeContract.methods.getAmountsOut(maxTokens, [tokenAddress, addresses.wbnb]).call() // sell TOKEN to (1) WBNB
            sellAt[exchangeName] = data[1]
          } catch (error) {}
        }
        const sellMarket = getObjectMax(sellAt)
        const maxWBNB = sellAt[sellMarket]

        log(
          `${buyMarket} -> ${sellMarket}. WBNB -> ${tokenName} -> WBNB input / output: ${web3.utils.fromWei(
            amountInWBNB.toString(),
          )} / ${web3.utils.fromWei(maxWBNB.toString())}`,
          `logs/simple/${tokenName}.log`,
        )

        // calculate costs
        const gasCost = 440000
        const gasPrice = await web3.eth.getGasPrice()
        const txCost = gasCost * parseInt(gasPrice)
        const flashLoanCost = amountInWBNB * 0.003

        // calculate profit
        const profit = BigNumber(maxWBNB).minus(amountInWBNB).minus(flashLoanCost).minus(txCost)
        //const profit = BigNumber(maxWBNB).minus(amountInWBNB)

        detailedLog(block, tokenName, amountInWBNB, maxTokens, maxWBNB, buyAt, sellAt, buyMarket, sellMarket, profit, txCost, flashLoanCost)

        // send transaction
        if (profit.gt(0)) {
          log(
            `
              ------------------------------
              Arb opportunity found
              Expected profit: ${web3.utils.fromWei(profit.toString())} WBNB
              buying ${web3.utils.fromWei(maxTokens)} ${tokenName} at ${buyMarket} using ${web3.utils.fromWei(amountInWBNB)} WBNB
              selling ${web3.utils.fromWei(maxTokens)} ${tokenName} at ${sellMarket} for ${web3.utils.fromWei(maxWBNB)} WBNB
              ------------------------------
            `,
            `logs/opportunities/${tokenName}.log`,
          )

          /* let tx = flashloan.methods.startArbitrage(
            addresses.wbnb, // token0
            tokenAddress, // token1
            amountInWBNB.toString(), // amount0
            0, // amount1
            DIRECTION.BAKERY_TO_PANCAKE,
            repayAmount.toString(),
          )

          const data = tx.encodeABI()
          const txData = {
            from: admin,
            to: flashloan.options.address,
            data,
            gas: gas,
            gasPrice: gasPrice,
          } */
        }
      }
    })
    .on('error', (error) => {
      console.log(error)
    })
}
init()

const detailedLog = (
  block,
  tokenName,
  amountInWBNB,
  maxTokens,
  maxWBNB,
  buyAt,
  sellAt,
  buyMarket,
  sellMarket,
  profit,
  txCost,
  flashLoanCost,
) => {
  var text = '\n'
  text += `   Block: ${block.number}\n`
  text += '   -------------------------------- Buy --------------------------------\n'
  for (var [exchangeName, exchangeAmount] of Object.entries(buyAt)) {
    text += `   Buy ${web3.utils.fromWei(exchangeAmount)} ${tokenName} at ${exchangeName} using ${web3.utils.fromWei(amountInWBNB)} WBNB\n`
  }
  text += `   The best place to buy ${tokenName} using ${web3.utils.fromWei(amountInWBNB)} WBNB is ${buyMarket}\n`
  text += '   -------------------------------- Sell --------------------------------\n'
  for (var [exchangeName, exchangeAmount] of Object.entries(sellAt)) {
    text += `   Sell ${web3.utils.fromWei(maxTokens)} ${tokenName} at ${exchangeName} for ${web3.utils.fromWei(exchangeAmount)} WBNB\n`
  }
  text += `   The best place to sell the ${tokenName} to WBNB is ${sellMarket}\n`
  text += '   ----------------------------- Best route -----------------------------\n'
  text += `   ${buyMarket} -> ${sellMarket}. WBNB -> ${tokenName} -> WBNB input / output: ${web3.utils.fromWei(
    amountInWBNB.toString(),
  )} / ${web3.utils.fromWei(maxWBNB.toString())}\n`

  if (BigNumber(maxWBNB).gt(BigNumber(amountInWBNB))) {
    text += `   ------------------------------ Profit ------------------------------\n`
    text += `   Transaction profit: ${web3.utils.fromWei((maxWBNB - amountInWBNB).toString())} WBNB\n`
  }

  text += `   -------------------------------- Costs -------------------------------\n`
  if (!profit.gt(0)) {
    text += `   Transaction loss: ${web3.utils.fromWei((amountInWBNB - maxWBNB).toString())} WBNB\n`
  }
  text += `   TX cost: ${web3.utils.fromWei(txCost.toString())} WBNB\n`
  text += `   Flash loan cost: ${web3.utils.fromWei(flashLoanCost.toString())} WBNB\n`
  text += '   ------------------------------- Result -------------------------------\n'
  text += `   Expected profit: ${web3.utils.fromWei(profit.toString())} WBNB\n\n`

  log(text, `logs/detailed/${tokenName}.log`)
}
