// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AxepArtistNFT is ERC721, ERC721Burnable, Ownable {
    uint256 private _nextTokenId;

    event NFTMinted(address indexed artist, uint256 indexed tokenId);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner_
    ) ERC721(name_, symbol_) Ownable(initialOwner_) {
    }

    function mintFromPlatform(address artistAddress) public onlyOwner returns (uint256) {
        uint256 newTokenId = _nextTokenId;
        _nextTokenId++;
        _safeMint(artistAddress, newTokenId);
        emit NFTMinted(artistAddress, newTokenId);
        return newTokenId;
    }
} 