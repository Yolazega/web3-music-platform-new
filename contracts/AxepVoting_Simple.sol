// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AxepVoting {
    // --- Structs ---
    struct Artist {
        uint256 id;
        string name;
        address payable artistWallet;
        bool isRegistered;
    }

    struct Track {
        uint256 id;
        uint256 artistId;
        string title;
        string genre;
        string videoUrl; // Using a direct URL for simplicity
        string coverImageUrl; // Using a direct URL for simplicity
        uint256 uploadTimestamp;
        uint256 votes;
    }

    // --- State Variables ---
    address public owner;
    IERC20 public axpToken;

    string[] public officialGenres;

    mapping(uint256 => Artist) public artists;
    mapping(address => uint256) public artistIdByWallet;
    uint256 private _nextArtistId;

    mapping(uint256 => Track) public tracks;
    uint256 private _nextTrackId;

    // Track IDs for each genre
    mapping(string => uint256[]) private _trackIdsByGenre;
    uint256[] public allTrackIds;

    // Share reward variables
    uint256 public shareRewardAmount;
    mapping(uint256 => mapping(address => string)) public proofOfShares; // trackId => user => url
    mapping(uint256 => mapping(address => bool)) public rewardedShares; // trackId => user => bool

    // --- Events ---
    event ArtistRegistered(uint256 indexed artistId, string name, address indexed artistWallet);
    event TrackUploaded(
        uint256 indexed trackId,
        uint256 indexed artistId,
        string title,
        string genre,
        string videoUrl
    );
    event Voted(uint256 indexed trackId, address indexed voter);
    event ShareRecorded(uint256 indexed trackId, address indexed sharer, string shareUrl);
    event ShareRewardsDistributed(uint256 indexed trackId, address indexed distributor);

    // --- Constructor ---
    constructor(address _tokenAddress) {
        owner = msg.sender;
        axpToken = IERC20(_tokenAddress);
        shareRewardAmount = 500 * (10**18); // Default to 500 tokens, assuming 18 decimals

        // Hardcoding genres for simplicity, removing admin functions
        officialGenres.push("Pop");
        officialGenres.push("Soul");
        officialGenres.push("Rock");
        officialGenres.push("Country");
        officialGenres.push("RAP");

        _nextArtistId = 1;
        _nextTrackId = 1;
    }

    // --- External Functions ---

    function registerArtistAndUploadFirstTrack(
        string calldata artistName,
        string calldata trackTitle,
        string calldata genre,
        string calldata videoUrl,
        string calldata coverImageUrl
    ) external {
        // Ensure the sender is not already registered as an artist
        require(artistIdByWallet[msg.sender] == 0, "Artist already registered.");
        // Ensure the genre is valid
        require(_isValidGenre(genre), "Invalid genre.");

        // Register the new artist
        uint256 artistId = _nextArtistId++;
        artists[artistId] = Artist({
            id: artistId,
            name: artistName,
            artistWallet: payable(msg.sender),
            isRegistered: true
        });
        artistIdByWallet[msg.sender] = artistId;
        emit ArtistRegistered(artistId, artistName, msg.sender);

        // Upload their first track
        uint256 trackId = _nextTrackId++;
        tracks[trackId] = Track({
            id: trackId,
            artistId: artistId,
            title: trackTitle,
            genre: genre,
            videoUrl: videoUrl,
            coverImageUrl: coverImageUrl,
            uploadTimestamp: block.timestamp,
            votes: 0
        });

        _trackIdsByGenre[genre].push(trackId);
        allTrackIds.push(trackId);

        emit TrackUploaded(trackId, artistId, trackTitle, genre, videoUrl);
    }

    function batchRegisterAndUpload(
        address[] calldata artistWallets,
        string[] calldata artistNames,
        string[] calldata trackTitles,
        string[] calldata genres,
        string[] calldata videoUrls,
        string[] calldata coverImageUrls
    ) external {
        require(msg.sender == owner, "Only owner can call this function.");
        require(artistWallets.length == artistNames.length, "Array length mismatch");
        require(artistWallets.length == trackTitles.length, "Array length mismatch");
        require(artistWallets.length == genres.length, "Array length mismatch");
        require(artistWallets.length == videoUrls.length, "Array length mismatch");
        require(artistWallets.length == coverImageUrls.length, "Array length mismatch");

        for (uint i = 0; i < artistWallets.length; i++) {
            _registerSingleTrackFromBatch(
                artistWallets[i],
                artistNames[i],
                trackTitles[i],
                genres[i],
                videoUrls[i],
                coverImageUrls[i]
            );
        }
    }

    function voteForTrack(uint256 trackId) external {
        // Basic vote logic (can be expanded later with week limits, etc.)
        require(tracks[trackId].id != 0, "Track does not exist.");
        tracks[trackId].votes++;
        emit Voted(trackId, msg.sender);
    }

    function recordShare(uint256 _trackId, string calldata _shareUrl) external {
        require(tracks[_trackId].id != 0, "Track does not exist.");
        require(bytes(_shareUrl).length > 0, "Share URL cannot be empty.");
        proofOfShares[_trackId][msg.sender] = _shareUrl;
        emit ShareRecorded(_trackId, msg.sender, _shareUrl);
    }

    // --- View Functions ---

    function getArtist(uint256 artistId) external view returns (Artist memory) {
        return artists[artistId];
    }

    function getTrack(uint256 trackId) external view returns (Track memory) {
        return tracks[trackId];
    }

    function getTrackIdsByGenre(string calldata genre) external view returns (uint256[] memory) {
        return _trackIdsByGenre[genre];
    }

    function getAllTrackIds() external view returns (uint256[] memory) {
        return allTrackIds;
    }
    
    function getOfficialGenres() external view returns (string[] memory) {
        return officialGenres;
    }

    // --- Internal Functions ---

    function _registerSingleTrackFromBatch(
        address artistWallet,
        string calldata artistName,
        string calldata trackTitle,
        string calldata genre,
        string calldata videoUrl,
        string calldata coverImageUrl
    ) internal {
        if (artistIdByWallet[artistWallet] == 0 && _isValidGenre(genre)) {
            uint256 artistId = _nextArtistId++;
            artists[artistId] = Artist({
                id: artistId,
                name: artistName,
                artistWallet: payable(artistWallet),
                isRegistered: true
            });
            artistIdByWallet[artistWallet] = artistId;
            emit ArtistRegistered(artistId, artistName, artistWallet);

            uint256 trackId = _nextTrackId++;
            tracks[trackId] = Track({
                id: trackId,
                artistId: artistId,
                title: trackTitle,
                genre: genre,
                videoUrl: videoUrl,
                coverImageUrl: coverImageUrl,
                uploadTimestamp: block.timestamp,
                votes: 0
            });

            _trackIdsByGenre[genre].push(trackId);
            allTrackIds.push(trackId);

            emit TrackUploaded(trackId, artistId, trackTitle, genre, videoUrl);
        }
    }

    function _isValidGenre(string calldata genreName) internal view returns (bool) {
        for (uint i = 0; i < officialGenres.length; i++) {
            if (keccak256(abi.encodePacked(officialGenres[i])) == keccak256(abi.encodePacked(genreName))) {
                return true;
            }
        }
        return false;
    }

    // --- Owner Functions ---
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw.");
        payable(owner).transfer(address(this).balance);
    }

    function setShareRewardAmount(uint256 _newAmount) external {
        require(msg.sender == owner, "Only owner can call this function.");
        shareRewardAmount = _newAmount;
    }

    function batchDistributeShareRewards(uint256 _trackId, address[] calldata _recipients) external {
        require(msg.sender == owner, "Only owner can call this function.");

        uint256 rewardAmount = shareRewardAmount;
        require(axpToken.balanceOf(address(this)) >= rewardAmount * _recipients.length, "Insufficient token balance in contract.");

        for(uint i = 0; i < _recipients.length; i++) {
            address recipient = _recipients[i];
            // Check for proof of share and that they haven't been rewarded yet
            if(bytes(proofOfShares[_trackId][recipient]).length > 0 && !rewardedShares[_trackId][recipient]) {
                rewardedShares[_trackId][recipient] = true;
                axpToken.transfer(recipient, rewardAmount);
            }
        }
        emit ShareRewardsDistributed(_trackId, msg.sender);
    }
} 