const { soliditySha3, sign } = require("../muonapp-utils/utils/crypto");
const { utils: { randomHex } } = require("web3");

function moduleIsAvailable(path) {
  try {
    require.resolve(path);
    return true;
  } catch (error) {
    return false;
  }
}

async function runMuonApp(request) {
  const { app, method, params = {} } = request;

  const appPath = `../muon-apps/${app}.js`;
  if (!moduleIsAvailable(appPath)) {
    throw { message: `App not found on optimistic node` };
  }

  const appId = BigInt(soliditySha3(`${app}.js`)).toString(10);

  const response = {
    reqId: randomHex(32),
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
