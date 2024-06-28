// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

// errors
error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 lotteryState
);

/// @title Lottery
/// @author Michał Wojtalczyk
/// @notice Lottery contract using Chainlink VRF
contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum LotteryState {
        OPEN,
        CALCULATING
    }
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    /// @dev Chainlink gasLane
    bytes32 private immutable i_gasLane;
    /// @dev Chainlink subscriptionId
    uint64 private immutable i_subscriptionId;
    /// @dev Chainlink VRF gas limit
    uint32 private immutable i_callbackGasLimit;
    /// @dev Number of request confirmations from chainlink VRF
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    /// @dev Number of requested numbers from chainlink VRF
    uint16 private constant NUM_WORDS = 1;
    address private s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private s_lastTimestamp;
    uint256 private i_interval;

    /// @notice Event emits when someone entered lottery
    /// @param player Player address
    event LotteryEnter(address indexed player);
    /// @notice Event emits when requested chainlink to pick winner
    /// @param requestId Chainlink requestId
    event RequestLotteryWinner(uint256 indexed requestId);
    /// @notice Event emits when winner is picked
    /// @param winner winner address
    event WinnerPicked(address indexed winner);

    constructor(
        address _vrfCoordinatorV2,
        uint256 _entranceFee,
        bytes32 _gasLane,
        uint256 _subscriptionId,
        uint32 _callbackGasLimit,
        uint256 _interval
    ) VRFConsumerBaseV2(_vrfCoordinatorV2) {
        i_entranceFee = _entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinatorV2);
        i_gasLane = _gasLane;
        i_subscriptionId = uint64(_subscriptionId);
        i_callbackGasLimit = _callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimestamp = block.timestamp;
        i_interval = _interval;
    }

    /// @notice Enter lottery
    /// @dev Revert when value is less than entrance fee
    /// @dev Revert when lottery isn't open
    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__NotEnoughETHEntered();
        }
        if (s_lotteryState != LotteryState.OPEN) {
            revert Lottery__NotOpen();
        }
        s_players.push(payable(msg.sender));
        emit LotteryEnter(msg.sender);
    }

    /// @notice Check if upkeep is needed
    /// @return upkeepNedded Upkeep needed
    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        view
        override
        returns (bool upkeepNedded, bytes memory /*performData */)
    {
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
        bool timePassed = (block.timestamp - s_lastTimestamp) > i_interval;
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNedded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    /// @notice Perform upkeep, request to pick random number
    /// @dev Revert when upkeep not needed
    /// @dev Close lottery
    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNedded, ) = checkUpkeep("");
        if (!upkeepNedded) {
            revert Lottery__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_lotteryState)
            );
        }
        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestLotteryWinner(requestId);
    }

    /// @notice Handle random number from chainlink
    /// @param _randomWords random words(numbers) from chainlink
    /// @dev Transfer reward to winner
    /// @dev Revert when sending reward to winner failed
    /// @dev Re-open lottery
    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory _randomWords
    ) internal override {
        uint256 indexOfWinner = _randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        s_lotteryState = LotteryState.OPEN;
        s_players = new address payable[](0);
        s_lastTimestamp = block.timestamp;
        emit WinnerPicked(recentWinner);
    }

    /// @notice Get entrance fee
    /// @return minimum entrance fee in lottery
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    /// @notice Get player by index
    /// @return address of player
    function getPlayer(uint256 _index) public view returns (address) {
        return s_players[_index];
    }

    /// @notice Get recent winner
    /// @return address of recent winner
    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    /// @notice Get lottery state
    /// @return lottery state
    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    /// @notice Get number of players
    /// @return number of players
    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    /// @notice Get interval
    /// @return interval of lottery
    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    /// @notice Get gas lane
    /// @return chainlink gas lane
    function getGasLane() public view returns (bytes32) {
        return i_gasLane;
    }

    /// @notice Get subscription id
    /// @return chainlink subscription id
    function getSubscriptionId() public view returns (uint256) {
        return i_subscriptionId;
    }

    /// @notice Get callback gas limit
    /// @return chainlink gas limit
    function getCallbackGasLimit() public view returns (uint32) {
        return i_callbackGasLimit;
    }

    /// @notice Get latest timestamp
    /// @return timestamp when last winner was picked
    function getLatestTimestamp() public view returns (uint256) {
        return s_lastTimestamp;
    }

    /// @notice Get chainlink VRF coordinator
    /// @return chainlink VRF coordinator
    function getVRFCoordinatorV2Address() public view returns (address) {
        return address(i_vrfCoordinator);
    }
}
