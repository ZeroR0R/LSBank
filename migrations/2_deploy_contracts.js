const Token = artifacts.require("LSToken");
const DeBank = artifacts.require("LSBank");

module.exports = async function(deployer) {
    // Deploy Token
    await deployer.deploy(LSToken);

    const token = await LSToken.deployed()

    await deployer.deploy(LSBank, token.address);
    const LSBank = await LSBank.deployed()

    await token.changeMinter(LSBank.address)
};