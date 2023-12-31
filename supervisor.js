require('dotenv').config();
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
const waitingBlocks = process.env.WAITING_BLOCKS;

// Function to retrieve events from the collateral manager smart contract
async function getEvents(fromBlock, toBlock) {
  console.error(`Getting events from block #${fromBlock} to block #${toBlock}`);
  if (fromBlock > toBlock) {
    return [];
  }
  try {
    return await collateralManager.getPastEvents("Locked", {
      fromBlock,
      toBlock,
    });
  } catch (error) {
    console.error("Error getting event: ", error.message);
    // Halving number of querying blocks to resolve errors
    // that are related to high number of blocks/events
    // or pause the contract if it can not help
    if (toBlock > fromBlock) {
      const i = fromBlock + Math.floor((toBlock - fromBlock) / 2);
      const events1 = await getEvents(fromBlock, i);
      const events2 = await getEvents(i + 1, toBlock);
      return events1.concat(events2);
    } else {
      await pause();
      throw new Error("The contract is paused");
    }
  }
}

// Function to monitor events and initiate disputes if necessary
async function monitor() {
  let fromBlock = lastProcessedBlock + 1;
  let toBlock = (await web3.eth.getBlockNumber()) - waitingBlocks;
  const events = await getEvents(fromBlock, toBlock);
  for (const event of events) {
    const verified = await isVerified(event);
    if (!verified) {
      await dispute(event.returnValues.reqId);
      // TODO: should save the disputes
    }
  }
  lastProcessedBlock = toBlock;
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
let web3, collateralManager, lastProcessedBlock;
async function run() {
  await initializeDbCursor();
  web3 = await getWeb3(network);
  lastProcessedBlock = (await web3.eth.getBlockNumber()) - waitingBlocks;
  collateralManager = await getCollateralManager();
  while (true) {
    await monitor();
    await new Promise((r) => setTimeout(r, 30000));
  }
}

run();
