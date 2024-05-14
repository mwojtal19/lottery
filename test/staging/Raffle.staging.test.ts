import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { assert } from "chai";
import { deployments, ethers, network } from "hardhat";
import { developmentChains } from "../../helper-hardhat-config";
import { Raffle } from "../../typechain-types";
const chainId = network.config.chainId!;

developmentChains.includes(chainId)
    ? describe.skip
    : describe("Raffle", () => {
          let raffle: Raffle;
          let raffleEntranceFee: bigint;
          let deployer: HardhatEthersSigner;
          let accounts: HardhatEthersSigner[];

          beforeEach(async () => {
              accounts = await ethers.getSigners();
              deployer = accounts[0];
              const raffleContract = await deployments.get("Raffle");
              raffle = await ethers.getContractAt(
                  "Raffle",
                  raffleContract.address,
                  deployer
              );
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", () => {
              it("works with live Chainlink keepers and Chainlink VRF, get custom winner", async () => {
                  const startingTimestamp = await raffle.getLatestTimestamp();
                  await new Promise<void>(async (resolve, reject) => {
                      raffle.once(raffle.filters.WinnerPicked, async () => {
                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance =
                                  await ethers.provider.getBalance(
                                      accounts[0].getAddress()
                                  );
                              const endingTimestamp =
                                  await raffle.getLatestTimestamp();
                              const numPlayers =
                                  await raffle.getNumberOfPlayers();
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimestamp > startingTimestamp);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (
                                      winnerStartingBalance + raffleEntranceFee
                                  ).toString()
                              );
                              resolve();
                          } catch (error: any) {
                              console.log(error);
                              reject(error);
                          }
                      });

                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      const winnerStartingBalance =
                          await ethers.provider.getBalance(
                              accounts[0].getAddress()
                          );
                  });
              });
          });
      });
