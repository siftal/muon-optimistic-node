const { getWeb3 } = require("../muonapp-utils/utils/eth");
const { getUnlockables } = require("./db");

const network = process.env.NETWORK;
const collateralManagerAddress = process.env.COLLATERAL_MANAGER;

const collateralManagerAbi = require("../data/collateralManager-ABI.json");

// Function to get the Collateral Manager instance
async function getCollateralManager() {
  const web3 = await getWeb3(network);
  return new web3.eth.Contract(collateralManagerAbi, collateralManagerAddress);
}

// Function to initiate a lock transaction
async function lock(result) {
  try {
    const collateralManager = await getCollateralManager();
    const web3 = await getWeb3(network);
    const collateralAmount = web3.utils.toWei(
      result.collateralAmount.toString(),
      "wei",
    );
    const nodeAddress = process.env.WARRANTOR_ADDRESS;
    const nonce = await web3.eth.getTransactionCount(nodeAddress, "pending");
    const gasPrice = await web3.eth.getGasPrice();
    const unlockables = await getUnlockables();

    const lockFunction = collateralManager.methods.lock(
      result.collateralAsset,
      collateralAmount,
      result.appId,
      result.collateralUser,
      result.reqId,
      unlockables,
    );

    const estimateGas = await lockFunction.estimateGas({ from: nodeAddress });

    const rawTransaction = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(gasPrice),
      gasLimit: web3.utils.toHex(estimateGas),
      to: collateralManagerAddress,
      value: "0x0",
      data: lockFunction.encodeABI(),
      from: nodeAddress,
    };

    const signTransaction = await web3.eth.accounts.signTransaction(
      rawTransaction,
      process.env.WARRANTOR_PRIVATE_KEY,
    );

    const transaction = await web3.eth.sendSignedTransaction(
      signTransaction.rawTransaction,
    );
    return transaction;
  } catch (error) {
    console.error("Error in lock:", error);
    throw error;
  }
}

// Function to initiate a dispute transaction
async function dispute(reqId) {
  try {
    const collateralManager = await getCollateralManager();
    const supervisorAddress = process.env.SUPERVISOR_ADDRESS;
    const web3 = await getWeb3(network);
    const nonce = await web3.eth.getTransactionCount(
      supervisorAddress,
      "pending",
    );
    const gasPrice = await web3.eth.getGasPrice();

    const disputeFunction = collateralManager.methods.dispute(reqId);

    const estimateGas = await disputeFunction.estimateGas({
      from: supervisorAddress,
    });

    const rawTransaction = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(gasPrice),
      gasLimit: web3.utils.toHex(estimateGas),
      to: collateralManagerAddress,
      value: "0x0",
      data: disputeFunction.encodeABI(),
      from: supervisorAddress,
    };

    const signTransaction = await web3.eth.accounts.signTransaction(
      rawTransaction,
      process.env.SUPERVISOR_PRIVATE_KEY,
    );

    const transaction = await web3.eth.sendSignedTransaction(
      signTransaction.rawTransaction,
    );
    return transaction;
  } catch (error) {
    console.error("Error in dispute:", error);
    throw error;
  }
}

// Function to initiate a pause transaction.
async function pause() {
  try {
    const collateralManager = await getCollateralManager();
    const supervisorAddress = process.env.SUPERVISOR_ADDRESS;
    const web3 = await getWeb3(network);
    const nonce = await web3.eth.getTransactionCount(
      supervisorAddress,
      "pending",
    );
    const gasPrice = await web3.eth.getGasPrice();

    const pauseFunction = collateralManager.methods.pause();
    const estimateGas = await pauseFunction.estimateGas({
      from: supervisorAddress,
    });

    const rawTransaction = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(gasPrice),
      gasLimit: web3.utils.toHex(estimateGas),
      to: collateralManagerAddress,
      value: "0x0",
      data: pauseFunction.encodeABI(),
      from: supervisorAddress,
    };

    const signTransaction = await web3.eth.accounts.signTransaction(
      rawTransaction,
      process.env.SUPERVISOR_PRIVATE_KEY,
    );

    const transaction = await web3.eth.sendSignedTransaction(
      signTransaction.rawTransaction,
    );
    return transaction;
  } catch (error) {
    console.error("Error in pause:", error);
    throw error;
  }
}

module.exports = {
  getCollateralManager,
  lock,
  dispute,
  pause,
};
