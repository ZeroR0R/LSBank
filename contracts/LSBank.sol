// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LSToken.sol";

contract LSBank {
    LSToken private token;

    struct Account {
        address id;
        uint256 balance;
        uint256 collateral;
        uint256 timestamp;
        bool isDeposited;
        bool isBorrowed;
    }

    mapping(address => Account) public accounts;

    event DepositedETH(
        address id,
        uint256 balance,
        uint256 timestamp,
        bool isDeposited
    );

    event WithdrawnEth(
        address id,
        uint256 balance,
        uint256 timestamp,
        bool isDeposited,
        uint256 interest
    );

    event BorrowedTKN(
        address id,
        uint256 collateral,
        bool isBorrowed,
        uint256 loan
    );

    event ReturnedTKN(
        address id,
        uint256 collateral,
        bool isBorrowed,
        uint256 fee
    );

    constructor(LSToken _token) {
        token = _token;
    }

    function depositETH() public payable {
        Account memory _account = accounts[msg.sender];

        require(msg.value >= 1e16, "Must be >= 0.01 ETH");
        require(_account.isDeposited == false, "Already Deposited");

        _account.balance = msg.value;
        _account.timestamp = block.timestamp;
        _account.isDeposited = true;

        accounts[msg.sender] = _account;

        emit DepositedETH(
            _account.id,
            _account.balance,
            _account.timestamp,
            _account.isDeposited
        );
    }

    function withdrawETH() public payable {
        Account memory _account = accounts[msg.sender];
        require(_account.isDeposited == true, "Not Active");
        uint256 period = block.timestamp - _account.timestamp;
        uint256 interestPerSecond = ((_account.balance * 10) / 100) / 31536000;
        uint256 interest = interestPerSecond * period;

        payable(msg.sender).transfer(_account.balance);

        token.mintTKN(address(this), msg.sender, interest);

        _account.balance = 0;
        _account.timestamp = 0;
        _account.isDeposited = false;

        accounts[msg.sender] = _account;

        emit WithdrawnEth(
            _account.id,
            _account.balance,
            _account.timestamp,
            _account.isDeposited,
            interest
        );
    }

    function borrowTKN() public payable {
        Account memory _account = accounts[msg.sender];

        require(msg.value >= 1e16, "Error: Collateral must be >= 0.01 ETH");
        require(_account.isBorrowed == false, "Error: Loan is already taken");

        _account.collateral = msg.value;

        uint256 loan = _account.collateral / 2;

        token.mintTKN(address(this), msg.sender, loan);

        _account.isBorrowed = true;

        accounts[msg.sender] = _account;

        emit BorrowedTKN(
            msg.sender,
            _account.collateral,
            _account.isBorrowed,
            loan
        );
    }

    function returnTKN() public {
        Account memory _account = accounts[msg.sender];

        require(_account.isBorrowed == true, "No Active Loan");

        token.transferFrom(msg.sender, address(this), _account.collateral / 2);

        uint256 fee = _account.collateral / 10;

        payable(msg.sender).transfer(_account.collateral - fee);

        _account.collateral = 0;
        _account.isBorrowed = false;

        accounts[msg.sender] = _account;

        emit ReturnedTKN(
            msg.sender,
            _account.collateral,
            _account.isBorrowed,
            fee
        );
    }
}
