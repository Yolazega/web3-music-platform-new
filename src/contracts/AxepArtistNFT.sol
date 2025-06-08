// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC721/ERC721.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/utils/Counters.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/interfaces/IERC2981.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/utils/introspection/ERC165.sol"; // Required for IERC2981 supportsInterface

contract AxepArtistNFT is ERC721, ERC721URIStorage, ERC721Burnable, Ownable, IERC2981 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    address private _royaltyRecipient;
    uint96 private _royaltyBasisPoints; // Conforms to EIP-2981, max 10000 (100%)

    event RoyaltyInfoUpdated(address indexed newRecipient, uint96 newBasisPoints);
    event NFTMinted(address indexed artist, uint256 indexed tokenId, string tokenURI);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner_, // This will be used to transfer ownership if not deployer
        address royaltyRecipientAddress_,
        uint256 royaltyBasisPoints_
    ) ERC721(name_, symbol_) Ownable() { // Ownable() takes no args in OZ v4.9.3
        if (initialOwner_ != msg.sender && initialOwner_ != address(0)) {
            _transferOwnership(initialOwner_); // Transfer ownership if specified and not deployer
        }
        require(royaltyRecipientAddress_ != address(0), "Royalty recipient cannot be zero address");
        require(royaltyBasisPoints_ <= 10000, "Royalty basis points must be <= 10000 (100%)");
        _royaltyRecipient = royaltyRecipientAddress_;
        _royaltyBasisPoints = uint96(royaltyBasisPoints_);
    }

    function mintFromPlatform(address artistAddress, string memory metadataURI) public onlyOwner returns (uint256) {
        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();
        _safeMint(artistAddress, newTokenId);
        _setTokenURI(newTokenId, metadataURI);
        emit NFTMinted(artistAddress, newTokenId, metadataURI);
        return newTokenId;
    }

    function setTokenURI(uint256 tokenId, string memory _tokenURI) public onlyOwner {
        _setTokenURI(tokenId, _tokenURI);
    }

    /**
     * @dev See EIP-2981. Sets the royalty information for a token.
     */
    function royaltyInfo(uint256 /*tokenId*/, uint256 salePrice) external view override returns (address receiver, uint256 royaltyAmount) {
        receiver = _royaltyRecipient;
        royaltyAmount = (salePrice * _royaltyBasisPoints) / 10000;
        return (receiver, royaltyAmount);
    }

    /**
     * @dev Allows the owner to update the royalty recipient and basis points.
     */
    function setRoyaltyInfo(address newRecipient, uint96 newBasisPoints) public onlyOwner {
        require(newRecipient != address(0), "Royalty recipient cannot be zero address");
        require(newBasisPoints <= 10000, "Royalty basis points must be <= 10000");
        _royaltyRecipient = newRecipient;
        _royaltyBasisPoints = newBasisPoints;
        emit RoyaltyInfoUpdated(newRecipient, newBasisPoints);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     * This is to declare EIP-2981 support.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721URIStorage, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    // Adjusted _burn override
    function _burn(uint256 tokenId) internal virtual override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    // Overriding tokenURI as required due to multiple definitions in ERC721 and ERC721URIStorage.
    // We explicitly use ERC721URIStorage's version.
    function tokenURI(uint256 tokenId) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
} 