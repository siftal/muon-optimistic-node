const { MongoClient } = require("mongodb");

const url = "mongodb://localhost:27017";
const client = new MongoClient(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
let requests_col;

// Function to initialize the MongoDB database connection and collection
async function initializeDbCursor() {
  await client.connect();
  const db = client.db("muon_optimistic");
  requests_col = db.collection("requests");
}

// Function to get unlockable requests
async function getUnlockables() {
  try {
    const borderTimestamp =
      Math.floor(Date.now() / 1000) - process.env.WARRANTY_DURATION;
    const query = {
      status: "LOCKED",
      lockTime: { $lt: borderTimestamp },
    };
    const result = await requests_col.find(query).toArray();
    const unlockables = result.map((document) => document.reqId);
    return unlockables;
  } catch (error) {
    console.error(error);
  }
}

// Function to update the status of a request
async function updateStatus(reqId, status) {
  try {
    const filter = { reqId };
    const updateOperation = {
      $set: { status },
    };
    await requests_col.updateOne(filter, updateOperation);
  } catch (error) {
    console.error(error);
  }
}

// Function to save a new request
async function saveRequest(result) {
  for (const param of result.data.signParams) {
    if (param["type"] == "uint256") {
      param["value"] = param["value"].toString();
    }
  }

  try {
    await requests_col.insertOne(result);
  } catch (error) {
    console.error(error);
  }
}

// Function to retrieve a request by its reqId
async function getRequest(reqId) {
  try {
    const request = await requests_col.findOne({ reqId });
    return request;
  } catch (error) {
    console.error(error);
  }
}

// Function to retrieve all requests
async function getAllRequests() {
  try {
    const cursor = await requests_col.find();
    return await cursor.toArray();
  } catch (error) {
    console.error(error);
  }
}

module.exports = {
  getUnlockables,
  saveRequest,
  getRequest,
  updateStatus,
  getAllRequests,
  initializeDbCursor,
};
