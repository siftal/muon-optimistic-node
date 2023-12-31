require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { runMuonApp } = require("./utils/muon-helpers");
const { lock, getCollateralManager } = require("./utils/collateral-manager");
const {
  saveRequest,
  getRequest,
  updateStatus,
  getAllRequests,
  initializeDbCursor,
} = require("./utils/db");
global.MuonAppUtils = require("./muonapp-utils");

const PORT = process.env.SERVER_PORT || 3000;
const router = express();

// Middleware
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// Enable CORS
router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Function to periodically update requests' status
const updateRequestsStatus = async () => {
  const collateralManager = await getCollateralManager();
  const requestStatus = {
    0: "UNINITIALIZED",
    1: "LOCKED",
    2: "UNLOCKED",
    3: "DISPUTED",
    4: "DISPUTE_CONFIRMED",
    5: "DISPUTE_REJECTED",
  };
  try {
    const requests = await getAllRequests();
    for (const request of requests) {
      if (!["LOCKED", "DISPUTED"].includes(request.status)) {
        continue;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - request.lockTime < process.env.WARRANTY_DURATION) {
        continue;
      }

      const onchainRequest = await collateralManager.methods
        .requests(request.reqId)
        .call();
      if (request.status != requestStatus[onchainRequest.status]) {
        updateStatus(request.reqId, requestStatus[onchainRequest.status]);
      }
    }
  } catch (error) {
    console.error("Updating requests status failed: ", error);
  }
};

// Define routes
router.get("/", (req, res) => {
  res.json({ message: "Muon Optimistic Node" });
});

// Route to retrieve a request request by reqId
router.get("/requests/:reqId", async (req, res) => {
  try {
    const { reqId } = req.params;
    const request = await getRequest(reqId);
    if (request) {
      res.status(200).json({ success: true, data: request });
    } else {
      throw new Error("Request not found.");
    }
  } catch (error) {
    return errorHandler(res, error);
  }
});

router.use("/v1/", async (req, res) => {
  try {
    const mixed = {
      ...req.query,
      ...req.body,
    };
    const {
      app,
      method,
      collateralUser,
      collateralAsset,
      collateralAmount,
      params = {},
    } = mixed;
    const requestData = { app, method, params };
    if (!collateralUser || !collateralAsset || !collateralAmount) {
      throw new Error(
        "One or more required parameters (collateralUser, collateralAsset, collateralAmount) are missing.",
      );
    }

    // TODO: Check if the fee is paid

    const result = await runMuonApp(requestData);
    if (!result) {
      throw new Error("Running the Moun app failed.");
    }

    if (params["collateralAmount"] > 0) {
      try {
        const transaction = await lock(
          result.appId,
          result.reqId,
          collateralAsset,
          collateralAmount,
          collateralUser,
        );
        result["transactionHash"] = transaction.transactionHash;
      } catch (error) {
        throw new Error(`Transaction error: ${error.message}`);
      }

      result["status"] = "LOCKED";
      result["lockTime"] = Math.floor(Date.now() / 1000);
      saveRequest(result);
      console.log(`Request confirmed:`, {
        reqId: result.reqId,
        app: result.app,
        collateralUser: result.collateralUser,
        collateralAsset: result.collateralAsset,
        collateralAmount: result.collateralAmount,
      });
    }
    return res.json({ success: true, result });
  } catch (error) {
    return errorHandler(res, error);
  }
});

// Error handler function
const errorHandler = (res, error) => {
  console.error("Warrantor error: ", error);
  res.status(400).json({
    success: false,
    error: {
      message: error.message,
    },
  });
};

// Start the server and set up periodic request status updates
router.listen(PORT, async () => {
  await initializeDbCursor();
  setInterval(updateRequestsStatus, 60000);
  console.log(`Server is running on port ${PORT}.`);
});
