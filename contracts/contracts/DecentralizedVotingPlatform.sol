// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title Decentralized-voting-platform
/// @notice On-chain voting. Elections, candidates and vote counts live here.
///         Once a vote is cast it can never be changed or deleted, not even by the admin.
///         Off-chain metadata (descriptions, candidate photos, bios) lives in Supabase and
///         is linked through the election id and candidate index.
contract DecentralizedVotingPlatform {
    struct Candidate {
        string name;
        uint256 voteCount;
    }

    struct Election {
        string title;
        uint64 startTime;
        uint64 endTime;
        bool exists;
        uint256 totalVotes;
        Candidate[] candidates;
    }

    address public immutable admin;
    uint256 public electionCount;

    mapping(uint256 => Election) private elections;

    /// @notice electionId => voter wallet => has already voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ElectionCreated(uint256 indexed electionId, string title, uint64 startTime, uint64 endTime);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);

    error NotAdmin();
    error ElectionNotFound();
    error InvalidTimes();
    error ElectionAlreadyStarted();
    error ElectionNotActive();
    error AlreadyVoted();
    error InvalidCandidate();
    error EmptyName();

    modifier onlyAdmin() {
        require(msg.sender == admin, NotAdmin());
        _;
    }

    modifier electionExists(uint256 electionId) {
        require(elections[electionId].exists, ElectionNotFound());
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // ----------------------------------------------------------------------------------
    // Admin
    // ----------------------------------------------------------------------------------

    /// @notice Create an election with an initial list of candidates.
    function createElection(
        string calldata title,
        string[] calldata candidateNames,
        uint64 startTime,
        uint64 endTime
    ) external onlyAdmin returns (uint256 electionId) {
        require(bytes(title).length > 0, EmptyName());
        require(endTime > startTime && endTime > block.timestamp, InvalidTimes());

        electionId = ++electionCount;
        Election storage e = elections[electionId];
        e.title = title;
        e.startTime = startTime;
        e.endTime = endTime;
        e.exists = true;

        emit ElectionCreated(electionId, title, startTime, endTime);

        for (uint256 i = 0; i < candidateNames.length; i++) {
            _addCandidate(electionId, candidateNames[i]);
        }
    }

    /// @notice Candidates can only be added before voting starts, so the ballot is fixed once open.
    function addCandidate(uint256 electionId, string calldata name)
        external
        onlyAdmin
        electionExists(electionId)
    {
        require(block.timestamp < elections[electionId].startTime, ElectionAlreadyStarted());
        _addCandidate(electionId, name);
    }

    function _addCandidate(uint256 electionId, string calldata name) private {
        require(bytes(name).length > 0, EmptyName());
        Election storage e = elections[electionId];
        e.candidates.push(Candidate({name: name, voteCount: 0}));
        emit CandidateAdded(electionId, e.candidates.length - 1, name);
    }

    // ----------------------------------------------------------------------------------
    // Voting
    // ----------------------------------------------------------------------------------

    /// @notice Cast one vote. Each wallet can vote once per election.
    function vote(uint256 electionId, uint256 candidateId) external electionExists(electionId) {
        Election storage e = elections[electionId];
        require(block.timestamp >= e.startTime && block.timestamp < e.endTime, ElectionNotActive());
        require(!hasVoted[electionId][msg.sender], AlreadyVoted()); // duplicate-vote lock
        require(candidateId < e.candidates.length, InvalidCandidate());

        hasVoted[electionId][msg.sender] = true;
        e.candidates[candidateId].voteCount += 1;
        e.totalVotes += 1;

        emit VoteCast(electionId, candidateId, msg.sender);
    }

    // ----------------------------------------------------------------------------------
    // Public reads (anyone can audit)
    // ----------------------------------------------------------------------------------

    function getElection(uint256 electionId)
        external
        view
        electionExists(electionId)
        returns (
            string memory title,
            uint64 startTime,
            uint64 endTime,
            uint256 totalVotes,
            uint256 candidateCount
        )
    {
        Election storage e = elections[electionId];
        return (e.title, e.startTime, e.endTime, e.totalVotes, e.candidates.length);
    }

    function getCandidates(uint256 electionId)
        external
        view
        electionExists(electionId)
        returns (string[] memory names, uint256[] memory voteCounts)
    {
        Candidate[] storage list = elections[electionId].candidates;
        names = new string[](list.length);
        voteCounts = new uint256[](list.length);
        for (uint256 i = 0; i < list.length; i++) {
            names[i] = list[i].name;
            voteCounts[i] = list[i].voteCount;
        }
    }

    function isActive(uint256 electionId) external view electionExists(electionId) returns (bool) {
        Election storage e = elections[electionId];
        return block.timestamp >= e.startTime && block.timestamp < e.endTime;
    }
}
