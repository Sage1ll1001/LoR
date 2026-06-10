const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LetterOfRecommendation", function () {
  let LetterOfRecommendation;
  let contract;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    LetterOfRecommendation = await ethers.getContractFactory("LetterOfRecommendation");
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // To deploy our contract, we run:
    contract = await LetterOfRecommendation.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Should authorize the owner by default", async function () {
      expect(await contract.authorizedApprovers(owner.address)).to.equal(true);
    });
  });

  describe("Approver Management", function () {
    it("Should allow owner to authorize an approver", async function () {
      await expect(contract.authorizeApprover(addr1.address))
        .to.emit(contract, "ApproverAuthorized")
        .withArgs(addr1.address);

      expect(await contract.authorizedApprovers(addr1.address)).to.equal(true);
    });

    it("Should prevent non-owner from authorizing an approver", async function () {
      await expect(
        contract.connect(addr1).authorizeApprover(addr2.address)
      ).to.be.revertedWith("Only owner can call this");
    });

    it("Should allow owner to deauthorize an approver", async function () {
      await contract.authorizeApprover(addr1.address);
      expect(await contract.authorizedApprovers(addr1.address)).to.equal(true);

      await expect(contract.deauthorizeApprover(addr1.address))
        .to.emit(contract, "ApproverDeauthorized")
        .withArgs(addr1.address);

      expect(await contract.authorizedApprovers(addr1.address)).to.equal(false);
    });

    it("Should prevent non-owner from deauthorizing an approver", async function () {
      await contract.authorizeApprover(addr1.address);
      await expect(
        contract.connect(addr2).deauthorizeApprover(addr1.address)
      ).to.be.revertedWith("Only owner can call this");
    });
  });

  describe("Student Management", function () {
    it("Should allow anyone to add a student", async function () {
      await expect(contract.connect(addr1).addStudent("John Doe", "Computer Science", "john@example.com"))
        .to.emit(contract, "StudentAdded")
        .withArgs(1, "John Doe", "Computer Science", "john@example.com");

      expect(await contract.studentCount()).to.equal(1);

      const student = await contract.getStudent(1);
      expect(student.id).to.equal(1);
      expect(student.name).to.equal("John Doe");
      expect(student.course).to.equal("Computer Science");
      expect(student.email).to.equal("john@example.com");
      expect(student.hasRequested).to.equal(false);
      expect(student.isApproved).to.equal(false);
    });

    it("Should revert if fields are empty", async function () {
      await expect(contract.addStudent("", "CS", "test@test.com")).to.be.revertedWith("Name cannot be empty");
      await expect(contract.addStudent("John", "", "test@test.com")).to.be.revertedWith("Course cannot be empty");
      await expect(contract.addStudent("John", "CS", "")).to.be.revertedWith("Email cannot be empty");
    });
  });

  describe("Recommendations", function () {
    beforeEach(async function () {
      await contract.addStudent("John Doe", "Computer Science", "john@example.com");
    });

    it("Should allow requesting a recommendation", async function () {
      await expect(contract.connect(addr1).requestRecommendation(1))
        .to.emit(contract, "RecommendationRequested")
        .withArgs(1, addr1.address);

      const student = await contract.getStudent(1);
      expect(student.hasRequested).to.equal(true);
      expect(student.requester).to.equal(addr1.address);
    });

    it("Should prevent requesting recommendation for non-existent student", async function () {
      await expect(contract.requestRecommendation(999)).to.be.revertedWith("Student does not exist");
    });

    it("Should prevent duplicate requests", async function () {
      await contract.requestRecommendation(1);
      await expect(contract.requestRecommendation(1)).to.be.revertedWith("Recommendation already requested");
    });

    it("Should allow authorized approvers to approve recommendation", async function () {
      await contract.connect(addr1).requestRecommendation(1);
      await contract.authorizeApprover(addr2.address);

      const ipfsHash = "QmXoypizjW3WknFixtdKLw55y9nxsZg62VDo3pt2NStotK";

      await expect(contract.connect(addr2).approveRecommendation(1, ipfsHash))
        .to.emit(contract, "RecommendationApproved")
        .withArgs(1, addr2.address, ipfsHash);

      const student = await contract.getStudent(1);
      expect(student.isApproved).to.equal(true);
      expect(student.lorIpfsHash).to.equal(ipfsHash);
      expect(student.approver).to.equal(addr2.address);
    });

    it("Should allow owner to approve recommendation by default", async function () {
      await contract.connect(addr1).requestRecommendation(1);
      const ipfsHash = "QmXoypizjW3WknFixtdKLw55y9nxsZg62VDo3pt2NStotK";

      await expect(contract.approveRecommendation(1, ipfsHash))
        .to.emit(contract, "RecommendationApproved")
        .withArgs(1, owner.address, ipfsHash);
    });

    it("Should prevent unauthorized users from approving recommendation", async function () {
      await contract.connect(addr1).requestRecommendation(1);
      const ipfsHash = "QmXoypizjW3WknFixtdKLw55y9nxsZg62VDo3pt2NStotK";

      await expect(
        contract.connect(addr2).approveRecommendation(1, ipfsHash)
      ).to.be.revertedWith("Not an authorized approver");
    });

    it("Should prevent approving a request that was not made", async function () {
      const ipfsHash = "QmXoypizjW3WknFixtdKLw55y9nxsZg62VDo3pt2NStotK";
      await expect(
        contract.approveRecommendation(1, ipfsHash)
      ).to.be.revertedWith("Recommendation request not found");
    });

    it("Should prevent double approvals", async function () {
      await contract.connect(addr1).requestRecommendation(1);
      const ipfsHash = "QmXoypizjW3WknFixtdKLw55y9nxsZg62VDo3pt2NStotK";
      await contract.approveRecommendation(1, ipfsHash);

      await expect(
        contract.approveRecommendation(1, ipfsHash)
      ).to.be.revertedWith("Recommendation already approved");
    });
  });
});
