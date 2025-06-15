// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AxepVoting is Ownable {
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
        string videoUrl;
        string coverImageUrl;
        uint256 uploadTimestamp;
    }

    struct Share {
        string url1;
        string url2;
    }

    // --- State Variables ---
    IERC20 public axpToken;

    string[] public officialGenres;

    mapping(uint256 => Artist) public artists;
    mapping(address => uint256) public artistIdByWallet;
    uint256 private _nextArtistId;

    mapping(uint256 => Track) public tracks;
    uint256 private _nextTrackId;
    
    mapping(uint256 => uint256) public trackVotes;

    mapping(string => uint256[]) private _trackIdsByGenre;
    uint256[] public allTrackIds;

    // --- Winner Selection State ---
    uint256 public currentVotingPeriod;
    uint256 public winningTrackId; 
    uint256 public lastWinnerTimestamp;
    mapping(uint256 => uint256) public historicalWinners; // period => winning trackId

    uint256 public shareRewardAmount;
    mapping(uint256 => mapping(address => Share)) public proofOfShares;
    mapping(uint256 => mapping(address => bool)) public rewardedShares;

    // --- Events ---
    event ArtistRegistered(uint256 indexed artistId, string name, address indexed artistWallet);
    event TrackUploaded(
        uint256 indexed trackId,
        uint256 indexed artistId,
        string title,
        string genre,
        string videoUrl,
        string coverImageUrl
    );
    event Voted(uint256 indexed trackId, address indexed voter, uint256 totalVotes);
    event ShareRecorded(uint256 indexed trackId, address indexed sharer, string shareUrl1, string shareUrl2);
    event ShareRewardsDistributed(uint256 indexed trackId, address indexed distributor);
    event VotesTallied(uint256[] trackIds, uint256[] voteCounts);
    event WinnerSelected(uint256 indexed votingPeriod, uint256 indexed trackId, uint256 voteCount);


    // --- Constructor ---
    constructor(address _tokenAddress) Ownable(msg.sender) {
        axpToken = IERC20(_tokenAddress);
        shareRewardAmount = 500 * (10**18);
        currentVotingPeriod = 1;

        officialGenres.push("Pop");
        officialGenres.push("Soul");
        officialGenres.push("Rock");
        officialGenres.push("Country");
        officialGenres.push("RAP");

        _nextArtistId = 1;
        _nextTrackId = 1;
    }

    // --- External Functions ---

    function batchRegisterAndUpload(
        address[] calldata artistWallets,
        string[] calldata artistNames,
        string[] calldata trackTitles,
        string[] calldata genres,
        string[] calldata videoUrls,
        string[] calldata coverImageUrls
    ) external onlyOwner {
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

    function adminBatchVote(uint256[] calldata _trackIds, uint256[] calldata _voteCounts) external onlyOwner {
        require(_trackIds.length == _voteCounts.length, "Input arrays must have the same length.");
        for (uint256 i = 0; i < _trackIds.length; i++) {
            uint256 trackId = _trackIds[i];
            uint256 newVotes = _voteCounts[i];
            if (tracks[trackId].id != 0 && newVotes > 0) {
                trackVotes[trackId] += newVotes;
            }
        }
        emit VotesTallied(_trackIds, _voteCounts);
    }
    
    function recordShare(uint256 _trackId, string calldata _shareUrl1, string calldata _shareUrl2) external {
        require(tracks[_trackId].id != 0, "Track does not exist.");
        require(bytes(_shareUrl1).length > 0, "Share URL1 cannot be empty.");
        require(bytes(_shareUrl2).length > 0, "Share URL2 cannot be empty.");
        proofOfShares[_trackId][msg.sender] = Share({ url1: _shareUrl1, url2: _shareUrl2 });
        emit ShareRecorded(_trackId, msg.sender, _shareUrl1, _shareUrl2);
    }

    // --- View Functions ---

    function getVoteCount(uint256 trackId) public view returns (uint256) {
        return trackVotes[trackId];
    }
    
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

    function getWinningTrackDetails() external view returns (Track memory, Artist memory) {
        require(winningTrackId != 0, "No winner has been selected yet.");
        Track memory winnerTrack = tracks[winningTrackId];
        Artist memory winnerArtist = artists[winnerTrack.artistId];
        return (winnerTrack, winnerArtist);
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
        uint256 artistId;
        if (artistIdByWallet[artistWallet] == 0) {
            require(_isValidGenre(genre), "Invalid genre for new artist's first track.");
            artistId = _nextArtistId++;
            artists[artistId] = Artist({
                id: artistId,
                name: artistName,
                artistWallet: payable(artistWallet),
                isRegistered: true
            });
            artistIdByWallet[artistWallet] = artistId;
            emit ArtistRegistered(artistId, artistName, artistWallet);
        } else {
            artistId = artistIdByWallet[artistWallet];
        }

        uint256 trackId = _nextTrackId++;
        tracks[trackId] = Track({
            id: trackId,
            artistId: artistId,
            title: trackTitle,
            genre: genre,
            videoUrl: videoUrl,
            coverImageUrl: coverImageUrl,
            uploadTimestamp: block.timestamp
        });
        trackVotes[trackId] = 0;

        _trackIdsByGenre[genre].push(trackId);
        allTrackIds.push(trackId);

        emit TrackUploaded(trackId, artistId, trackTitle, genre, videoUrl, coverImageUrl);
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
    function finalizeVotingAndSelectWinner(uint256[] calldata _trackIdsForPeriod) external onlyOwner {
        require(_trackIdsForPeriod.length > 0, "Cannot determine winner from an empty set of tracks.");

        uint256 maxVotes = 0;
        uint256 currentWinnerId = 0;

        for (uint i = 0; i < _trackIdsForPeriod.length; i++) {
            uint256 trackId = _trackIdsForPeriod[i];
            uint256 votes = trackVotes[trackId];

            if (votes > maxVotes) {
                maxVotes = votes;
                currentWinnerId = trackId;
            }
        }

        require(currentWinnerId != 0, "No track with votes found to select a winner.");

        winningTrackId = currentWinnerId;
        lastWinnerTimestamp = block.timestamp;
        historicalWinners[currentVotingPeriod] = winningTrackId;

        emit WinnerSelected(currentVotingPeriod, winningTrackId, maxVotes);
        
        // Reset votes for the next period and advance the period counter
        for (uint i = 0; i < _trackIdsForPeriod.length; i++) {
            trackVotes[_trackIdsForPeriod[i]] = 0;
        }

        currentVotingPeriod++;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function setShareRewardAmount(uint256 _newAmount) external onlyOwner {
        shareRewardAmount = _newAmount;
    }

    function batchDistributeShareRewards(uint256 _trackId, address[] calldata _recipients) external onlyOwner {
        uint256 rewardAmount = shareRewardAmount;
        require(axpToken.balanceOf(address(this)) >= rewardAmount * _recipients.length, "Insufficient token balance in contract.");

        for (uint i = 0; i < _recipients.length; i++) {
            address recipient = _recipients[i];
            if (bytes(proofOfShares[_trackId][recipient].url1).length > 0 && !rewardedShares[_trackId][recipient]) {
                rewardedShares[_trackId][recipient] = true;
                axpToken.transfer(recipient, rewardAmount);
            }
        }
        emit ShareRewardsDistributed(_trackId, msg.sender);
    }
} 