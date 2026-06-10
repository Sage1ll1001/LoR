# Letter of Recommendation (LoR) Decentrashield DApp

A secure, decentralized application built with **Solidity**, **Hardhat**, **React (Vite)**, **Ethers.js**, and **IPFS** to manage, request, approve, and verify academic or professional Letters of Recommendation on-chain.

---

## 🚀 Quick Start Guide

Follow these steps to set up and run the DApp on your local machine.

### Prerequisites
- Node.js (version 22.9.0 or higher recommended)
- MetaMask browser extension

### Step 1: Install Dependencies
Run this command in the root directory:
```bash
npm install
```
Then, install the React frontend dependencies:
```bash
cd frontend
npm install
cd ..
```

---

## 🧪 Smart Contract Development & Testing

The smart contract is located in `contracts/LetterOfRecommendation.sol`. It handles student registration, recommendation requests, approver management, and letter issuance.

### Run Compilation & Tests
To compile the contract and run the automated test suite of 16 tests covering edge cases and access controls:
```bash
npx hardhat test
```

---

## 🛠️ Local Deployment & Execution

### 1. Spin Up Local Blockchain Node
Start the local Hardhat development network:
```bash
npx hardhat node
```
*Keep this terminal window running.*

### 2. Deploy Smart Contract
In a separate terminal, deploy the smart contract to the local blockchain network:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
This script will deploy the contract and automatically save the ABI and address configuration details to the frontend source directory: `frontend/src/contracts/LetterOfRecommendation.json`.

### 3. Start the Frontend App
Go to the frontend directory and start the Vite development server:
```bash
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🦊 MetaMask Integration

To interact with the local DApp:
1. Open the MetaMask extension.
2. Click the network selector and select **Add Network** -> **Add a network manually**.
   - **Network Name**: Hardhat Localhost
   - **New RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `1337`
   - **Currency Symbol**: ETH
3. Import one of the private keys outputted by the `npx hardhat node` terminal (e.g. Account #0 for Admin/Owner access, Account #1 or #2 for students/approvers) to test transactions.

---

## 📁 Repository Structure

- `contracts/`: Solidity smart contracts
- `scripts/`: Deployment scripts
- `test/`: Hardhat Mocha/Chai test suite
- `frontend/`: React Vite application
  - `src/contracts/`: Contains the deployed address & ABI
  - `src/utils/ipfs.js`: IPFS upload helper with local localStorage fallback
  - `src/index.css`: Glassmorphic styling system
  - `src/App.jsx`: Main UI application code
- `README.md`: Submission documentation
