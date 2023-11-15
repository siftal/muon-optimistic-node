require("dotenv").config();
const { runMuonApp } = require("./utils/muon-helpers");
const { initializeDbCursor } = require("./utils/db");
const {
  getCollateralManager,
  dispute,
  pause,
} = require("./utils/collateral-manager");
const { getWeb3 } = require("./muonapp-utils/utils/eth");
const axios = require("axios");
global.MuonAppUtils = require("./muonapp-utils");

const warrantors = require("./data/warrantors.json");
const network = process.env.NETWORK;
let isMonitoring = false;

let lastProcessedBlockNumber = 0;

// Function to retrieve events from the collateral manager smart contract
async function getEvents(collateralManager, fromBlock, toBlock) {
  return await collateralManager.getPastEvents("Locked", {
    fromBlock,
    toBlock,
  });
}

// Function to monitor events and initiate disputes if necessary
async function monitor() {
  if (isMonitoring) {
    return;
  }
  isMonitoring = true;
  const collateralManager = await getCollateralManager();
  const web3 = await getWeb3(network);
  const latestBlockNumber = await web3.eth.getBlockNumber();
  if (lastProcessedBlockNumber == 0) {
    lastProcessedBlockNumber = latestBlockNumber - 1000;
  }

  const fromBlock = lastProcessedBlockNumber + 1;
  let toBlock = Math.min(fromBlock + 1000, latestBlockNumber);
  let events;
  try {
    events = await getEvents(collateralManager, fromBlock, toBlock);
  } catch (error) {
    console.error("Error getting event: ", error.message);
    toBlock = Math.floor((toBlock - fromBlock) / 2);
    if (toBlock < 1) {
      try {
        const transaction = await pause();
      } catch (error) {
        throw new Error(`Transaction error: ${error.message}`);
      }

      throw new Error(
        "Something went wrong, cannot get the events. pause the contract.",
      );
    }
    events = await getEvents(collateralManager, fromBlock, toBlock);
  }

  console.log(`\nchecking events from block ${fromBlock} to block ${toBlock}`);
  for (const event of events) {
    const verified = await isVerified(event);
    if (!verified) {
      try {
        const transaction = await dispute(event.returnValues.reqId);
        // TODO: should save the disputes
      } catch (error) {
        throw new Error(`Transaction error: ${error.message}`);
      }
    }
    lastProcessedBlockNumber = event.blockNumber - 1;
  }

  lastProcessedBlockNumber = toBlock;
  isMonitoring = false;
}

// Function to verify the authenticity of events
async function isVerified(event) {
  try {
    //TODO: check not disputed before
    console.log(`\nChecking: ${event.returnValues.reqId}`);
    const baseUrl = warrantors[event.returnValues.warrantor];
    if (!baseUrl) {
      throw new Error("Warrantor not found.");
    }

    const url = `${baseUrl}/requests/${event.returnValues.reqId}`;
    let response = await axios.get(url);
    response = response.data;
    if (
      !response?.data?.app ||
      !response?.data?.method ||
      !response?.data?.data?.params ||
      !response?.data?.signParamsHash
    ) {
      throw new Error("Invalid data received from the warrantor.");
    }

    const requestData = {
      app: response.data.app,
      method: response.data.method,
      params: response.data.data.params,
    };
    const supervisorResponse = await runMuonApp(requestData);
    const supervisorHash = MuonAppUtils.soliditySha3(
      supervisorResponse.data.signParams.slice(2),
    );

    // TODO: this does not work for non-deterministic apps
    // for example price feeds.
    if (response.data.signParamsHash != supervisorHash) {
      throw new Error("Warrantor response mismatch.");
    }
    console.log(`request ${event.returnValues.reqId} passed`);
    return true;
  } catch (error) {
    console.error("Error verifying event: ", error.message);
    return false;
  }
}

// Function to initialize the monitoring process
async function run() {
  await initializeDbCursor();
  setInterval(monitor, 30000);
}

run().catch((error) => {
  console.error("An error occurred: ", error.message);
});
