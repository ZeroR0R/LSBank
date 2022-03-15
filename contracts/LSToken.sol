// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./openzeppelin/ERC20.sol";

contract LSToken is ERC20 {
    address public minter;

    constructor() payable ERC20("LS Engine Bank", "LSB") {
        minter = msg.sender;
    }

    event MinterChanged(address indexed from, address to);

    function changeMinter(address LSBank) public {
        require(msg.sender == minter, "Only Minter");

        minter = LSBank;

        emit MinterChanged(msg.sender, LSBank);
    }

    function mintTKN(
        address LSbank,
        address account,
        uint256 amount
    ) public {
        require(LSbank == minter, "Needs Minter Role");
        _mint(account, amount);
    }
}
