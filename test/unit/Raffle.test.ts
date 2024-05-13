import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { EventLog } from "ethers";
import { deployments, ethers, network } from "hardhat";
import { developmentChains, networkConfig } from "../../helper-hardhat-config";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
const chainId = network.config.chainId!;

!developmentChains.includes(chainId)
    ? describe.skip
    : describe("Raffle", () => {
          let raffle: Raffle;
          let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock;
          let raffleEntranceFee: bigint;
          let interval: bigint;
          let deployer: HardhatEthersSigner;
          let accounts: HardhatEthersSigner[];

          beforeEach(async () => {
              accounts = await ethers.getSigners();
              deployer = accounts[0];
              await deployments.fixture(["all"]);
              const raffleContract = await deployments.get("Raffle");
              const vrfCoordinatorV2MockContract = await deployments.get(
                  "VRFCoordinatorV2Mock"
              );
              raffle = await ethers.getContractAt(
                  "Raffle",
                  raffleContract.address,
                  deployer
              );
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
              vrfCoordinatorV2Mock = await ethers.getContractAt(
                  "VRFCoordinatorV2Mock",
                  vrfCoordinatorV2MockContract.address,
                  deployer
              );
          });

          describe("constructor", () => {
              it("initializes the raffle correctly", async () => {
                  const raffleState = await raffle.getRaffleState();
                  const gasLane = await raffle.getGasLane();
                  const subscriptionId = await raffle.getSubscriptionId();
                  const callbackGasLimit = await raffle.getCallbackGasLimit();
                  const vrfCoordinatorV2 =
                      await raffle.getVRFCoordinatorV2Address();
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(
                      interval.toString(),
                      networkConfig[chainId].interval
                  );
                  assert.equal(
                      raffleEntranceFee,
                      networkConfig[chainId].entranceFee
                  );
                  assert.equal(gasLane, networkConfig[chainId].gasLane);
                  assert.equal(subscriptionId.toString(), "1"); // becaouse of mock
                  assert.equal(
                      callbackGasLimit.toString(),
                      networkConfig[chainId].callbackGasLimit
                  );
                  assert.equal(
                      vrfCoordinatorV2,
                      await vrfCoordinatorV2Mock.getAddress()
                  );
              });
          });

          describe("enterRaffle", () => {
              it("reverts when don't pay enough", async () => {
                  await expect(
                      raffle.enterRaffle()
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered"
                  );
              });
              it("records players when they entered", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer.address);
              });
              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x");
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
              });
              it("emits event on enter", async () => {
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.emit(raffle, "RaffleEnter");
              });
          });

          describe("checkUpkeep", () => {
              it("return false if people haven't send any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNedded } = await raffle.checkUpkeep.staticCall(
                      "0x"
                  );
                  assert.equal(upkeepNedded, false);
              });
              it("returns false if raffle isn't open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x");
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNedded } = await raffle.checkUpkeep.staticCall(
                      "0x"
                  );
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNedded, false);
              });
              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) - 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x");
                  const { upkeepNedded } = await raffle.checkUpkeep.staticCall(
                      "0x"
                  );
                  assert.equal(upkeepNedded, false);
              });
              it("return true if enough time has passed, has players, ETH and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNedded } = await raffle.checkUpkeep.staticCall(
                      "0x"
                  );
                  assert.equal(upkeepNedded, true);
              });
          });
          describe("perfromUpkeep", () => {
              it("it can only run if checkUpkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const tx = await raffle.performUpkeep("0x");
                  assert(tx);
              });
              it("reverts when checkUpkeep is false", async () => {
                  await expect(
                      raffle.performUpkeep("0x")
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded"
                  );
              });
              it("updates the raffle state, emits event and call the vrf coordinator", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await raffle.performUpkeep("0x");
                  const txReceipt = await txResponse.wait(1);
                  const log = txReceipt?.logs[1] as EventLog; // 1 log because requestRandomWords emits 0 earlier
                  const requestId = log.args["requestId"];
                  const raffleState = await raffle.getRaffleState();
                  assert.equal(raffleState.toString(), "1");
                  assert(Number(requestId) > 0);
                  await expect(txResponse).to.emit(
                      raffle,
                      "RequestRaffleWinner"
                  );
              });
          });
          describe("fulfillRandomWords", () => {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(
                          0,
                          raffle.getAddress()
                      )
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(
                          1,
                          raffle.getAddress()
                      )
                  ).to.be.revertedWith("nonexistent request");
              });

              it("picks a winner, resets the lottery and sends money", async () => {
                  const additionalEntrants = 3;
                  const startingAccountIndex = 1; // deployer is 0
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(
                          accounts[i]
                      );
                      await accountConnectedRaffle.enterRaffle({
                          value: raffleEntranceFee,
                      });
                  }
                  const startingTimestamp = await raffle.getLatestTimestamp();
                  await new Promise<void>(async (resolve, reject) => {
                      raffle.once(raffle.filters.WinnerPicked, async () => {
                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner();

                              const raffleState = await raffle.getRaffleState();
                              const endingTimestamp =
                                  await raffle.getLatestTimestamp();
                              const numPlayers =
                                  await raffle.getNumberOfPlayers();
                              const winnerEndingBalance =
                                  await ethers.provider.getBalance(
                                      accounts[1].getAddress()
                                  );
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimestamp > startingTimestamp);
                              assert.equal(
                                  winnerEndingBalance.toString(),

                                  (
                                      winnerStartingBalance +
                                      raffleEntranceFee *
                                          BigInt(additionalEntrants) +
                                      raffleEntranceFee
                                  ).toString()
                              );
                          } catch (error: any) {
                              reject(error);
                          }
                          resolve();
                      });
                      const tx = await raffle.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);
                      const log = txReceipt?.logs[1] as EventLog;
                      const requestId = log.args["requestId"];
                      const winnerStartingBalance =
                          await ethers.provider.getBalance(
                              accounts[1].getAddress()
                          );
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          requestId,
                          raffle.getAddress()
                      );
                  });
              });
          });
      });
