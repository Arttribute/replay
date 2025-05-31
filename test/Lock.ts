// test/ProvenanceEconomy.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("ProvenanceEconomy", function () {
  let contract: Contract;
  let owner: Signer, alice: Signer, bob: Signer, carol: Signer;

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();
    const ProvenanceEconomyFactory = await ethers.getContractFactory(
      "ProvenanceEconomy"
    );
    contract = await ProvenanceEconomyFactory.deploy();
    await contract.deployed();
  });

  it("should register a new resource", async function () {
    await contract.connect(alice).registerResource("video1", "cid123");
    const info = await contract.getResourceInfo("video1");
    expect(info.cid).to.equal("cid123");
    expect(info.submitter).to.equal(await alice.getAddress());
  });

  it("should add attributions", async function () {
    await contract.connect(alice).registerResource("video1", "cid123");
    await contract
      .connect(alice)
      .addAttribution(
        "video1",
        await bob.getAddress(),
        "creator",
        6000,
        true,
        "Main contributor"
      );
    const attributions = await contract.getAttributions("video1");
    expect(attributions.length).to.equal(1);
    expect(attributions[0].contributor).to.equal(await bob.getAddress());
    expect(attributions[0].weight).to.equal(6000);
  });

  it("should reject non-submitters from adding attribution", async function () {
    await contract.connect(alice).registerResource("video1", "cid123");
    await expect(
      contract
        .connect(bob)
        .addAttribution(
          "video1",
          await bob.getAddress(),
          "creator",
          5000,
          true,
          "Invalid attempt"
        )
    ).to.be.revertedWith("Not the resource submitter");
  });

  it("should allow revenue deposits and contributor claims", async function () {
    await contract.connect(alice).registerResource("video1", "cid123");
    await contract
      .connect(alice)
      .addAttribution(
        "video1",
        await bob.getAddress(),
        "creator",
        6000,
        true,
        "Main"
      );
    await contract
      .connect(alice)
      .addAttribution(
        "video1",
        await carol.getAddress(),
        "contributor",
        4000,
        true,
        "Support"
      );

    await contract
      .connect(owner)
      .depositRevenue("video1", { value: ethers.utils.parseEther("1.0") });

    const beforeClaim = await ethers.provider.getBalance(
      await bob.getAddress()
    );
    const tx = await contract.connect(bob).claim("video1");
    await tx.wait();
    const afterClaim = await ethers.provider.getBalance(await bob.getAddress());

    const bobClaimed = await contract.getClaimedAmount(
      "video1",
      await bob.getAddress()
    );
    expect(bobClaimed).to.equal(ethers.utils.parseEther("0.6"));
    expect(afterClaim).to.be.above(beforeClaim); // allow some slack for gas
  });

  it("should not allow double claims", async function () {
    await contract.connect(alice).registerResource("video1", "cid123");
    await contract
      .connect(alice)
      .addAttribution(
        "video1",
        await bob.getAddress(),
        "creator",
        6000,
        true,
        "Main"
      );
    await contract
      .connect(owner)
      .depositRevenue("video1", { value: ethers.utils.parseEther("1.0") });

    await contract.connect(bob).claim("video1");
    await expect(contract.connect(bob).claim("video1")).to.be.revertedWith(
      "Nothing to claim"
    );
  });
});
