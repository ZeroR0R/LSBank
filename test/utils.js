module.exports = {
    ETHER_ADDRESS: '0x0000000000000000000000000000000000000000',
    EVM_REVERT: 'VM Exception while processing transaction: revert',
    ether: n => {
        return new web3.utils.BN(
            web3.utils.toWei(n.toString(), 'ether')
        )
    },
    tokens: n => ether(n),
    wait: s => {
        const milliseconds = s * 1000
        return new Promise(resolve => setTimeout(resolve, milliseconds))
    }
}