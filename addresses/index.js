const pancakeSwapMainnet = require('./pancakeSwap-mainnet.json')
const bakerySwapMainnet = require('./bakerySwap-mainnet.json')
const apeSwapMainnet = require('./apeSwap-mainnet.json')
const biSwapMainnet = require('./biSwap-mainnet.json')
const babySwapMainnet = require('./babySwap-mainnet.json')

const tokensMainnet = require('./tokens-mainnet.json')

module.exports = {
  addresses: {
    pancakeSwap: pancakeSwapMainnet,
    bakerySwap: bakerySwapMainnet,
    apeSwap: apeSwapMainnet,
    biSwap: biSwapMainnet,
    babySwap: babySwapMainnet,
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    tokens: tokensMainnet,
  },
}
