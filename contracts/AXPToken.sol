// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract AXPToken is ERC20, Ownable, ERC20Burnable {
    constructor(address initialOwner) ERC20("Axep", "AXP") Ownable(initialOwner) {
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
} 