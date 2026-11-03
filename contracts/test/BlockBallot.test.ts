import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BlockBallot", () => {
  async function deployFixture() {
    const [admin, alice, bob, carol] = await ethers.getSigners();
    const contract = await (await ethers.getContractFactory("BlockBallot")).deploy();
    const now = await time.latest();
    const start = now + 60;
    const end = now + 3600;
    await contract.createElection("Class Representative", ["Asha", "Bikram", "Chandra"], start, end);
    return { contract, admin, alice, bob, carol, start, end };
  }

  async function activeFixture() {
    const f = await deployFixture();
    await time.increaseTo(f.start);
    return f;
  }

  describe("admin", () => {
    it("sets the deployer as admin", async () => {
      const { contract, admin } = await loadFixture(deployFixture);
      expect(await contract.admin()).to.equal(admin.address);
    });

    it("creates an election with candidates", async () => {
      const { contract } = await loadFixture(deployFixture);
      const [title, , , totalVotes, candidateCount] = await contract.getElection(1);
      expect(title).to.equal("Class Representative");
      expect(totalVotes).to.equal(0n);
      expect(candidateCount).to.equal(3n);
      expect(await contract.electionCount()).to.equal(1n);
    });

    it("rejects non-admin election creation", async () => {
      const { contract, alice } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(
        contract.connect(alice).createElection("X", ["A"], now + 10, now + 100)
      ).to.be.revertedWithCustomError(contract, "NotAdmin");
    });

    it("rejects invalid time windows", async () => {
      const { contract } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(contract.createElection("X", ["A"], now + 100, now + 50)).to.be.revertedWithCustomError(
        contract,
        "InvalidTimes"
      );
    });

    it("allows adding candidates only before the election starts", async () => {
      const { contract, start } = await loadFixture(deployFixture);
      await expect(contract.addCandidate(1, "Deepa")).to.emit(contract, "CandidateAdded").withArgs(1, 3, "Deepa");
      await time.increaseTo(start);
      await expect(contract.addCandidate(1, "Late")).to.be.revertedWithCustomError(
        contract,
        "ElectionAlreadyStarted"
      );
    });
  });

  describe("voting", () => {
    it("records a vote and emits VoteCast", async () => {
      const { contract, alice } = await loadFixture(activeFixture);
      await expect(contract.connect(alice).vote(1, 1))
        .to.emit(contract, "VoteCast")
        .withArgs(1, 1, alice.address);
      const [, counts] = await contract.getCandidates(1);
      expect(counts).to.deep.equal([0n, 1n, 0n]);
      expect(await contract.hasVoted(1, alice.address)).to.equal(true);
    });

    it("blocks a second vote from the same wallet", async () => {
      const { contract, alice } = await loadFixture(activeFixture);
      await contract.connect(alice).vote(1, 0);
      await expect(contract.connect(alice).vote(1, 2)).to.be.revertedWithCustomError(contract, "AlreadyVoted");
      const [, counts] = await contract.getCandidates(1);
      expect(counts).to.deep.equal([1n, 0n, 0n]);
    });

    it("blocks the admin from voting twice too", async () => {
      const { contract, admin } = await loadFixture(activeFixture);
      await contract.connect(admin).vote(1, 0);
      await expect(contract.connect(admin).vote(1, 0)).to.be.revertedWithCustomError(contract, "AlreadyVoted");
    });

    it("counts votes from many wallets", async () => {
      const { contract, alice, bob, carol } = await loadFixture(activeFixture);
      await contract.connect(alice).vote(1, 2);
      await contract.connect(bob).vote(1, 2);
      await contract.connect(carol).vote(1, 0);
      const [names, counts] = await contract.getCandidates(1);
      expect(names).to.deep.equal(["Asha", "Bikram", "Chandra"]);
      expect(counts).to.deep.equal([1n, 0n, 2n]);
      const [, , , totalVotes] = await contract.getElection(1);
      expect(totalVotes).to.equal(3n);
    });

    it("rejects votes before start and after end", async () => {
      const { contract, alice, bob, start, end } = await loadFixture(deployFixture);
      await expect(contract.connect(alice).vote(1, 0)).to.be.revertedWithCustomError(contract, "ElectionNotActive");
      expect(await contract.isActive(1)).to.equal(false);
      await time.increaseTo(start);
      expect(await contract.isActive(1)).to.equal(true);
      await time.increaseTo(end);
      await expect(contract.connect(bob).vote(1, 0)).to.be.revertedWithCustomError(contract, "ElectionNotActive");
    });

    it("rejects an invalid candidate", async () => {
      const { contract, alice } = await loadFixture(activeFixture);
      await expect(contract.connect(alice).vote(1, 9)).to.be.revertedWithCustomError(contract, "InvalidCandidate");
      expect(await contract.hasVoted(1, alice.address)).to.equal(false);
    });

    it("rejects an unknown election", async () => {
      const { contract, alice } = await loadFixture(activeFixture);
      await expect(contract.connect(alice).vote(42, 0)).to.be.revertedWithCustomError(contract, "ElectionNotFound");
    });

    it("tracks hasVoted separately per election", async () => {
      const { contract, alice } = await loadFixture(activeFixture);
      const now = await time.latest();
      await contract.createElection("Second", ["X", "Y"], now + 1, now + 1000);
      await time.increase(2);
      await contract.connect(alice).vote(1, 0);
      await expect(contract.connect(alice).vote(2, 1)).to.not.be.reverted;
    });
  });
});
