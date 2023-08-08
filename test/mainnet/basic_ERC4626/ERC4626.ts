import { expect } from "chai";
import hre, { network } from "hardhat";
const { web3, deployments, waffle, ethers } = hre;
const { provider, deployContract } = waffle;

import type { Signer, Contract } from "ethers";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { BigNumber } from "bignumber.js";

import { deployAndEnableConnector } from "../../../scripts/tests/deployAndEnableConnector";
import { buildDSAv2 } from "../../../scripts/tests/buildDSAv2";
import { encodeSpells } from "../../../scripts/tests/encodeSpells";
import { getMasterSigner } from "../../../scripts/tests/getMasterSigner";
import { addresses } from "../../../scripts/tests/mainnet/addresses";
import { abis } from "../../../scripts/constant/abis";
import { tokens } from "../../../scripts/tests/mainnet/tokens";
import { ConnectV2BasicERC4626__factory, IERC4626__factory, IERC20Minimal__factory } from "../../../typechain";

describe("BASIC-D", function () {
  const connectorName = "BASIC-D";

  let dsaWallet0: any;
  let masterSigner: Signer;
  let instaConnectorsV2: Contract;
  let connector: any;
  let wallet: any;

  const account = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";
  const sDAIaddress = "0x83f20f44975d03b1b09e64809b757c47f942beea";
  let signer: any;

  const daiContract = new ethers.Contract(tokens.dai.address, IERC20Minimal__factory.abi, ethers.provider);
  //   const erc4626Contract = new ethers.Contract(sDAIaddress, IERC4626__factory.abi, ethers.provider);

  const wallets = provider.getWallets();
  const [wallet0] = wallets;

  before(async () => {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            // @ts-ignore
            jsonRpcUrl: hre.config.networks.hardhat.forking.url
            // blockNumber: 12796965
          }
        }
      ]
    });

    masterSigner = await getMasterSigner();
    instaConnectorsV2 = await ethers.getContractAt(abis.core.connectorsV2, addresses.core.connectorsV2);
    connector = await deployAndEnableConnector({
      connectorName,
      contractArtifact: ConnectV2BasicERC4626__factory,
      signer: masterSigner,
      connectors: instaConnectorsV2
    });

    console.log("Connector address", connector.address);

    await hre.network.provider.send("hardhat_setBalance", [account, ethers.utils.parseEther("10").toHexString()]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [account]
    });

    signer = await ethers.getSigner(account);
  });

  it("Should have contracts deployed.", async function () {
    expect(!!instaConnectorsV2.address).to.be.true;
    expect(!!connector.address).to.be.true;
    expect(!!(await masterSigner.getAddress())).to.be.true;
  });

  describe("DSA wallet setup", function () {
    it("Should build DSA v2", async function () {
      dsaWallet0 = await buildDSAv2(wallet0.address);
      expect(!!dsaWallet0.address).to.be.true;
      wallet = await ethers.getSigner(dsaWallet0.address);
    });

    it("Deposit ETH into DSA wallet", async function () {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [wallet.address]
      });

      await wallet0.sendTransaction({
        to: dsaWallet0.address,
        value: ethers.utils.parseEther("10")
      });

      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(ethers.utils.parseEther("10"));

      let balance = await ethers.provider.getBalance(account);
      console.log("1:", balance);
      balance = await daiContract.balanceOf(account);
      console.log("2:", balance);
      let txRes = await daiContract.connect(signer).transfer(dsaWallet0.address, ethers.utils.parseEther("10000"));
      await txRes.wait();
      expect(await daiContract.balanceOf(dsaWallet0.address)).to.be.eq(ethers.utils.parseEther("10000"));
    });
  });

  describe("Main", function () {
    it("should deposit asset to ERC4626", async () => {
      const spells = [
        {
          connector: connectorName,
          method: "deposit",
          args: [sDAIaddress, ethers.utils.parseEther("1"), 0, 0]
        }
      ];

      const tx = await dsaWallet0.connect(wallet0).cast(...encodeSpells(spells), wallet0.address);
      const receipt = await tx.wait();
    });

  });
});
