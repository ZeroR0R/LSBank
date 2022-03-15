const { assert } = require('chai')
const utils = require('./utils')

/* eslint-disable no-undef */
const Token = artifacts.require("LSToken")
const LSBank = artifacts.require("LSBank")

// Required for Failure tests (should.be.rejected)
require('chai')
    .use(require('chai-as-promised'))
    .should()

contract(LSBank, ([deployer, user]) => {
    let token, LSBank, result, event

    before(async () => {
        token = await Token.new() // Initialize token
        LSBank = await LSBank.new(token.address)
    })

    describe('Token', () => {
        // Similar to constructor()
        before(async () => {
            result = await token.changeMinter(LSBank.address, { from: deployer })
            event = result.logs[0].args

            // FAILURE: deployer is not the minter anymore
            await token.changeMinter(LSBank.address, { from: deployer }).should.be.rejectedWith(utils.EVM_REVERT) // Unauthorized minter
            await token.mintLSB(deployer, user, '1').should.be.rejectedWith(utils.EVM_REVERT)
        })

        it('deployment', async () => {
            const address = await token.address

            assert.notEqual(address, 0x0)
            assert.notEqual(address, '')
            assert.notEqual(address, null)
            assert.notEqual(address, undefined)
        })

        it('has a name', async () => {
            const name = await token.name()

            assert.equal(name, 'LS Engine Bank')
            assert.typeOf(name, 'string')
        })

        it('has a symbol', async () => {
            const symbol = await token.symbol()

            assert.equal(symbol, 'LSB')
            assert.typeOf(symbol, 'string')
        })

        it('has correct initial total supply', async () => {
            assert.equal(await token.totalSupply(), '0')
        })

        it('has transfered minter role', async () => {
            // SUCCESS: deployer has has transfered minter role to LSBank
            assert.equal(await event.from, deployer)
            assert.equal(await event.to, LSBank.address)
            assert.equal(await token.minter(), LSBank.address)
        })
    })

    describe('LSBank', () => {
        let walletBalance, block

        describe('depositETH', async () => {
            // Similar to constructor()
            before(async () => {
                // Fetch wallet before withdraw
                walletBalance = await web3.eth.getBalance(user)

                // Deposite 0.01 ETH in the bank
                result = await LSBank.depositETH({ value: Number(web3.utils.toWei('0.01', 'Ether')), from: user })
                event = result.logs[0].args

                // Get the latest block
                block = await web3.eth.getBlock('latest');

                // FAILURE: Can't deposit if the amount is < 0.01 ETH
                await LSBank.depositETH({ value: Number(web3.utils.toWei('0.001', 'Ether')), from: user }).should.be.rejectedWith(utils.EVM_REVERT)
                // FAILURE: Can't deposit when it's already isDeposited
                await LSBank.depositETH({ value: Number(web3.utils.toWei('0.01', 'Ether')), from: user }).should.be.rejectedWith(utils.EVM_REVERT)
            })

            it('user LSBank account balance has increased', async () => {
                // SUCCESS: Balance has increased in user's LSBank Account
                assert.equal(Number(event.balance), Number(web3.utils.toWei('0.01', 'Ether')))
                assert.isTrue(Number(event.balance) > 0)
            })

            it('user wallet balance has decreased', async () => {      
                // SUCCESS: Wallet balance is decreased after depositing ETH to LSBank
                assert.isTrue(Number(await web3.eth.getBalance(user)) < Number(walletBalance)) // New wallet balance < old wallet balance
            })
                
            it('timestamp is updated', async () => {
                // SUCCESS: Timestamp is > 0 in user's LSBank Account
                assert.equal(Number(event.timestamp), Number(block.timestamp))
                assert.isTrue(Number(event.timestamp) > 0)
            })

            it('LSBank has received the deposit', async () => {
                // SUCCESS: LSBank receives the deposited amount
                assert.equal(Number(await web3.eth.getBalance(LSBank.address)), event.balance)
            })
                
            it('LSBank account is updated', async () => {
                // SUCCESS: Deposite is activated in user's LSBank Account
                assert.isTrue(event.isDeposited)
            })
        })

        describe('withdrawETH', () => {
            let account, walletBalance, LSB

            // Similar to constructor()
            before(async () => {
                // Fetch account data and wallet before withdraw
                account = await LSBank.accounts(user)
                walletBalance = await web3.eth.getBalance(user)

                // Withdraw previously deposited ETH from the bank
                result = await LSBank.withdrawETH({from: user})
                event = result.logs[0].args

                // Get the latest block
                block = await web3.eth.getBlock('latest');

                // FAILURE: user has withdrawn his deposit previously,
                await LSBank.withdrawETH({ from: user }).should.be.rejectedWith(utils.EVM_REVERT)
            })
                
            it('user LSBank account balance is decreased', async () => {
                // SUCCESS: LSBank Account balance is back to 0
                assert.isTrue(Number(account.balance) > 0) // Previous balance is > 0
                assert.equal(Number(event.balance), 0)
            })
                
            it('user wallet balance is increased', async () => {      
                // SUCCESS: Wallet balance is increased after receving ETH back from LSBank
                assert.isTrue(Number(await web3.eth.getBalance(user)) > Number(walletBalance)) 
            })
                
            it('LSB balance and token supply increased', async () => {
                LSB = await token.balanceOf(user)
                assert.isTrue(Number(LSB) > 0)
                assert.equal(Number(LSB), Number(event.interest))
                assert.equal(Number(await token.totalSupply()), Number(event.interest)) 
            })

            it('LSBank has returned the deposit', async () => {
                // SUCCESS: LSBank has returned the deposited eth
                assert.equal(Number(await web3.eth.getBalance(LSBank.address)), 0)
            })
                
            it('LSBank account is reset', async () => {
                assert.equal(Number(event.balance), 0)
                assert.equal(Number(event.timestamp), 0)
                assert.equal(event.balance, false)
            })
        })

        describe('borrowLSB', () => {
            let oldTotalSupply, oldBalanceLSBs

            before(async () => {
                // Get data of LSB before borrow
                oldTotalSupply = Number(await token.totalSupply()) // Previously minted LSB due to interest - 63419582
                oldBalanceLSB = Number(await token.balanceOf(user)) // LSB balance of the user - 63419582

                // Borrow (0.01 ETH / 2) LSB from the bank
                result = await LSBank.borrowLSB({ value: Number(web3.utils.toWei('0.01', 'Ether')), from: user })
                event = result.logs[0].args

                // FAILURE: Collateral must be > 0.01 ETH
                await LSBank.borrowLSB({ value: Number(web3.utils.toWei('0.0001', 'Ether')), from: user }).should.be.rejectedWith(utils.EVM_REVERT)
                // FAILURE: isDeposite is already set to true
                await LSBank.borrowLSB({ value: Number(web3.utils.toWei('0.01', 'Ether')), from: user }).should.be.rejectedWith(utils.EVM_REVERT)
            })

            it('LSB total supply is increased', async () => {
                // SUCCESS: LSB are minted based on 50% of collateral
                assert.isTrue(Number(await token.totalSupply()) > Number(event.collateral) / 2) // 63419582 LSB were minted due to interest i.e. 5000000063419582 > 5000000000000000
                assert.equal(Number(await token.totalSupply()), Number(event.collateral) / 2 + oldTotalSupply) // 5000000063419582 = 5000000000000000 + 63419582
            })

            it('user LSB balance is increased', async () => {
                // SUCCESS: LSB balance of user is increased
                assert.isTrue(Number(await token.balanceOf(user)) > oldBalanceLSB) // 63419582 LSB were paid to user as interest i.e. 5000000063419582 > 63419582
                assert.equal(Number(await token.balanceOf(user)), Number(event.collateral) / 2 + oldBalanceLSB) // 5000000063419582 = 5000000000000000 + 63419582
            })

            it('user LSBank account collateral is increased', async () => {
                // SUCCESS: Collateral in the LSBank account of the user has been increased
                assert.isTrue(Number(event.collateral) > 0)
                assert.equal(Number(event.collateral), Number(web3.utils.toWei('0.01', 'Ether')))
            })

            it('LSBank has received the collateral', async () => {
                // SUCCESS: LSBank receives the collateral amount
                assert.equal(Number(await web3.eth.getBalance(LSBank.address)), event.collateral)
            })

            it('LSBank account is updated', async () => {
                // SUCCESS: isBorrowed is set to true
                assert.isTrue(event.isBorrowed)
            })
        })

        describe('returnLSB', () => {
            let account, oldBalanceLSB, fee

            // Similar to constructor()
            before(async () => {
                // Get account data and LSB of user before return
                account = await LSBank.accounts(user)
                oldBalanceLSB = Number(await token.balanceOf(user)) // LSB balance of the user - 5000000063419582

                // Token receiver needs to be approved before receiving any token (except when you mint)
                await token.approve(LSBank.address, Number(web3.utils.toWei('0.01', 'Ether')) / 2, { from: user })
                
                // Return borrowed LSB to the LSBank
                result = await LSBank.returnLSB({ from: user })
                event = result.logs[0].args

                // FAILURE: Deployer hasn't borrowed any LSB
                await LSBank.returnLSB({ from: deployer }).should.be.rejectedWith(utils.EVM_REVERT)
            })

            it('LSB balance is decreased', async () => {
                LSB = oldBalanceLSB - (account.collateral / 2) // Total LSB of user - borrowed BBC = 5000000063419582 - 5000000000000000
                
                // SUCCESS: Borrowed LSB has been returned
                assert.equal(Number(await token.balanceOf(user)), LSB) // 63419582
            })

            it('LSBank has returned the collateral and kept 10% fee', async () => {
                fee = account.collateral / 10 // 10% of collateral
                
                // SUCCESS: LSBank gets 10% of collateral fee (ETH)
                assert.equal(Number(await web3.eth.getBalance(LSBank.address)), fee)
            })

            it('LSBank account is reset', async () => {
                assert.equal(event.collateral, 0)
                assert.equal(event.isBorrowed, false)
            })
        })
    })
})