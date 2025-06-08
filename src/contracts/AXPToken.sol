// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title AXPToken
 * @dev ERC20 Token für die Axep Plattform
 */

contract AXPToken {
    string public name = "Axep Token";
    string public symbol = "AXP";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    address public owner;

    uint256 public constant MAX_SUPPLY = 5_200_000_000 * (10**18);
    // Initial reserve for the creator as per whitepaper
    uint256 public constant FOUNDER_RESERVE = 200_000_000 * (10**18);

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can execute");
        _;
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        owner = msg.sender;
        // Mint only the founder's reserve initially
        totalSupply = FOUNDER_RESERVE;
        balanceOf[msg.sender] = FOUNDER_RESERVE;
        emit Transfer(address(0), msg.sender, FOUNDER_RESERVE);
    }

    function transfer(address to, uint256 value) public returns (bool success) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Allowance too low");
        // Note: You might want to handle the case where allowance[from][msg.sender] is type(uint256).max
        // For simplicity, direct subtraction is used here.
        allowance[from][msg.sender] -= value; 
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "Cannot transfer to zero address");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function mint(address to, uint256 value) public onlyOwner {
        // Assuming 'value' is the number of whole tokens (e.g., mint 100 AXP)
        uint256 amountToMint = value * (10**uint256(decimals));
        require(totalSupply + amountToMint <= MAX_SUPPLY, "Minting would exceed max supply");
        totalSupply += amountToMint;
        balanceOf[to] += amountToMint;
        emit Transfer(address(0), to, amountToMint);
    }

    function burn(address from, uint256 value) public onlyOwner {
        // Assuming 'value' is the number of tokens to burn
        uint256 amountToBurn = value * (10**uint256(decimals));
        require(balanceOf[from] >= amountToBurn, "Burn amount exceeds balance");
        balanceOf[from] -= amountToBurn;
        totalSupply -= amountToBurn;
        emit Transfer(from, address(0), amountToBurn);
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        owner = newOwner;
    }
} 