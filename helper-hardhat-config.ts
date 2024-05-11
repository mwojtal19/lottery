import { parseEther } from "ethers";

interface NetworkConfig {
    [key: number]: {
        name: string;
        vrfCoordinatorV2?: string;
        entranceFee: bigint;
        gasLane: string;
        subscriptionId?: string;
        callbackGasLimit: string;
        interval: string;
    };
}

export const networkConfig: NetworkConfig = {
    11155111: {
        name: "sepolia",
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        entranceFee: parseEther("0.01"),
        gasLane:
            "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subscriptionId: "0",
        callbackGasLimit: "500000",
        interval: "30",
    },
    31337: {
        name: "hardhat",
        entranceFee: parseEther("0.01"),
        gasLane:
            "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "500000",
        interval: "30",
    },
};

export const developmentChains = [31337];
export const DECIMALS = 8;
export const INITIAL_ANSWER = 200000000000;
