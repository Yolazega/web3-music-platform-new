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

    // --- Constructor ---
    constructor(address _tokenAddress) {
        owner = msg.sender;
        axpToken = IERC20(_tokenAddress);

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

    function voteForTrack(uint256 trackId) external {
        // Basic vote logic (can be expanded later with week limits, etc.)
        require(tracks[trackId].id != 0, "Track does not exist.");
        tracks[trackId].votes++;
        emit Voted(trackId, msg.sender);
    }

    // --- View Functions ---

    function getArtist(uint256 artistId) external view returns (Artist memory) {
        return artists[artistId];
    }

    function getTrack(uint256 trackId) external view returns (Track memory) {
        return tracks[trackId];
    }

    function getAllTrackIds() external view returns (uint256[] memory) {
        return allTrackIds;
    }

    function getTrackIdsByGenre(string calldata genre) external view returns (uint256[] memory) {
        return _trackIdsByGenre[genre];
    }
    
    function getOfficialGenres() external view returns (string[] memory) {
        return officialGenres;
    }

    // --- Internal Functions ---
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
} 