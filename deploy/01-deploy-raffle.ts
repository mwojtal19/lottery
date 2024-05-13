import { EventLog, parseEther } from "ethers";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { developmentChains, networkConfig } from "../helper-hardhat-config";
import verify from "../utils/verify";

const VRF_SUB_FUND_AMOUNT = parseEther("2");

const deployRaffle: DeployFunction = async function (
    hre: HardhatRuntimeEnvironment
) {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const chainId = hre.network.config.chainId!;

    let vrfCoordinatorV2Address;
    let subscriptionId;
    if (developmentChains.includes(chainId)) {
        const vrfCoordinatorV2Mock = await hre.deployments.get(
            "VRFCoordinatorV2Mock"
        );
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const vrfCoordinatorV2 = await ethers.getContractAt(
            "VRFCoordinatorV2Mock",
            vrfCoordinatorV2Mock.address,
            deployer
        );
        const txResponse = await vrfCoordinatorV2.createSubscription();
        const txReceipt = await txResponse.wait(1);
        const eventLog = txReceipt?.logs[0] as EventLog;
        subscriptionId = eventLog.args["subId"];
        await vrfCoordinatorV2.fundSubscription(
            subscriptionId,
            VRF_SUB_FUND_AMOUNT
        );
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2;
        subscriptionId = networkConfig[chainId].subscriptionId;
    }
    const entranceFee = networkConfig[chainId].entranceFee;
    const gasLane = networkConfig[chainId].gasLane;
    const callbackGasLimit = networkConfig[chainId].callbackGasLimit;
    const interval = networkConfig[chainId].interval;
    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const raffle = await hre.deployments.deploy("Raffle", {
        from: deployer.address,
        args: args,
        log: true,
        waitConfirmations: 1,
    });
    if (developmentChains.includes(chainId)) {
        const vrfCoordinatorV2Mock = await hre.deployments.get(
            "VRFCoordinatorV2Mock"
        );
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const vrfCoordinatorV2 = await ethers.getContractAt(
            "VRFCoordinatorV2Mock",
            vrfCoordinatorV2Mock.address,
            deployer
        );
        await vrfCoordinatorV2.addConsumer(subscriptionId, raffle.address);
    }
    if (!developmentChains.includes(chainId) && process.env.ETHERSCAN_API_KEY) {
        await verify(raffle.address, args);
    }
    hre.deployments.log("---------------------------------");
};
export default deployRaffle;
deployRaffle.tags = ["all", "raffle"];
