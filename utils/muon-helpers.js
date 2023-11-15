const { soliditySha3, sign } = require("../muonapp-utils/utils/crypto");

function moduleIsAvailable(path) {
  try {
    require.resolve(path);
    return true;
  } catch (error) {
    return false;
  }
}

function calculateRequestId(request, resultHash) {
  return soliditySha3([
    { type: "address", value: request.nodeAddress },
    { type: "uint32", value: request.data.timestamp },
    { type: "uint256", value: request.appId },
    { type: "string", value: soliditySha3(request.method) },
    { type: "uint256", value: resultHash },
    { type: "uint256", value: Math.floor(Date.now() / 1000) },
  ]);
}

async function runMuonApp(request) {
  const { app, method, params = {} } = request;

  const appPath = `../muon-apps/${app}.js`;
  if (!moduleIsAvailable(appPath)) {
    throw { message: `App not found on optimistic node` };
  }

  const appId = BigInt(soliditySha3(`${app}.js`)).toString(10);

  const response = {
    reqId: null,
    app,
    appId,
    method,
    nodeAddress: process.env.WARRANTOR_ADDRESS,
    data: {
      params,
      timestamp: Math.floor(Date.now() / 1000),
    },
  };

  const muonApp = require(appPath);
  const onRequestResult = await muonApp.onRequest(response);
  const appSignParams = muonApp.signParams(response, onRequestResult);
  const hashSecurityParams = soliditySha3(appSignParams);
  response.reqId = calculateRequestId(response, hashSecurityParams);
  response.data.signParams = [
    { name: "appId", type: "uint256", value: response.appId },
    { name: "reqId", type: "uint256", value: response.reqId },
    ...appSignParams,
  ];
  const hashToBeSigned = soliditySha3(response.data.signParams);
  response.nodeSignature = sign(hashToBeSigned);
  return response;
}

module.exports = {
  runMuonApp,
};
