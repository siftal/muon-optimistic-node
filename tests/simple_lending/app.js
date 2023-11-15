let userAddress;
let v1Price;
let v1Block;
const USDT_ADDRESS = "0x5e79ECc7a01f4D60a47BcE59b759e7Bc460Cf631";
const ALICE_ADDRESS = "0xF43CD517385237fe7A48927073151D12f4eADC53";
const SIMPLE_LENDING_ADDRESS = "0x7169693bBF6A0B0e2238B50c6e11Abf0271146Db";
SIMPLE_LENDING_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "collateralAmount", type: "uint256" },
      { internalType: "uint256", name: "loanAmount", type: "uint256" },
      { internalType: "uint256", name: "price", type: "uint256" },
      { internalType: "uint256", name: "blockNumber", type: "uint256" },
      { internalType: "bytes32", name: "reqId", type: "bytes32" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "borrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

$(document).ready(function () {
  $("#loading-overlay").hide();
  if (typeof web3 !== "undefined") {
    web3 = new Web3(web3.currentProvider);
  } else {
    alert("Please install Metamask or use a compatible browser.");
    return;
  }

  $("#connectBtn").click(async function () {
    try {
      const accounts = await web3.eth.getAccounts();
      if (accounts.length === 0) {
        alert("Please connect Metamask and log in.");
        return;
      }

      userAddress = accounts[0];
      $("#userAddress").text(`${userAddress}`);

      const ethereum = window.ethereum;
      const networkId = await ethereum.request({ method: "eth_chainId" });

      if (networkId == "0x61") {
        fetchPrice();
        $("#connectBtn").hide();
      } else {
        if (confirm("Please switch to BSC Testnet")) {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x61" }],
          });
        }
      }
    } catch (error) {
      console.error("Error connecting to Metamask:", error);
      alert("Error connecting to Metamask.");
    }
  });

  function fetchPrice() {
    const apiEndpoint = `http://localhost:3000/v1/?app=simplePrice&method=price&params[collateralUser]=${userAddress}&params[collateralAsset]=${USDT_ADDRESS}&params[collateralAmount]=0`;

    $.get(apiEndpoint, function (data) {
      try {
        const priceParam = data.result.data.signParams.find(
          (param) => param.name == "price",
        );
        v1Price = parseInt(priceParam.value, 16);

        const blockParam = data.result.data.signParams.find(
          (param) => param.name == "block",
        );
        v1Block = blockParam.value;

        $("#price").text(`Alice Price: ${v1Price / 10 ** 6}`);
        $("#getWarrantyBtn").prop("disabled", false);
      } catch (error) {
        alert("Error parsing API response.");
      }
    }).fail(function () {
      alert("Error fetching price from the API.");
    });
  }

  $("#getWarrantyBtn").click(function () {
    $("#loading-overlay").show();
    const userInputCollateralAmount = $("#collateralAmount").val();
    const userInputLoanAmount = $("#loanAmount").val();
    const maxLaon = (userInputCollateralAmount * v1Price) / 10 ** 6 / 2;
    if (!userInputCollateralAmount || !userInputLoanAmount) {
      alert("Please enter a valid amounts.");
      $("#loading-overlay").hide();
      return;
    } else if (maxLaon < userInputLoanAmount) {
      alert(`The maximum loan amount is $${maxLaon}.`);
      $("#loading-overlay").hide();
      return;
    } else {
      const amount = userInputCollateralAmount * v1Price;
      const warrantyApiEndpoint = `http://localhost:3000/v1/?app=simplePrice&method=price&params[collateralUser]=${userAddress}&params[collateralAsset]=${USDT_ADDRESS}&params[collateralAmount]=${amount}&params[block]=${v1Block}`;
      $.get(warrantyApiEndpoint, function (data) {
        try {
          const priceParam = data.result.data.signParams.find(
            (param) => param.name == "price",
          );
          const blockParam = data.result.data.signParams.find(
            (param) => param.name == "block",
          );
          const reqIdParam = data.result.data.signParams.find(
            (param) => param.name == "reqId",
          );

          const price = priceParam.value;
          $("#borrowBtn").data("loanAmount", userInputLoanAmount * 10**6);
          $("#borrowBtn").data("aliceAmount", userInputCollateralAmount);
          $("#borrowBtn").data("price", price);
          $("#borrowBtn").data("block", blockParam.value);
          $("#borrowBtn").data("reqId", reqIdParam.value);
          $("#borrowBtn").data("signature", data.result.nodeSignature);
          $("#getWarrantyBtn").hide();
          $("#borrowBtn").show();
          $("#loading-overlay").hide();
        } catch (error) {
          $("#loading-overlay").hide();
          alert("Error parsing API response.");
        }
      }).fail(function () {
        $("#loading-overlay").hide();
        alert("Error fetching warranty data from the API.");
      });
    }
  });

  $("#borrowBtn").click(async function () {
    $("#loading-overlay").show();
    const loanAmount = $("#borrowBtn").data("loanAmount");
    const aliceAmount = $("#borrowBtn").data("aliceAmount");
    const price = $("#borrowBtn").data("price");
    const block = $("#borrowBtn").data("block");
    const reqId = $("#borrowBtn").data("reqId");
    const signature = $("#borrowBtn").data("signature");

    try {
      await approve(SIMPLE_LENDING_ADDRESS, aliceAmount);
    } catch (error) {
      console.error("Error approve:", error);
      $("#price").text("Transaction fail");
      $("#loading-overlay").hide();
      return;
    }

    try {
      await borrow(aliceAmount, loanAmount, price, block, reqId, signature);
    } catch (error) {
      console.error("Error borrow:", error);
      $("#price").text("Transaction fail");
      $("#loading-overlay").hide();
      return;
    }
    $("#collateralAmount").val(0);
    $("#price").text("Done");
    $("#loading-overlay").hide();
  });

  async function approve(spender, amount) {
    if (web3) {
      const amountInWei = web3.utils.toWei(amount.toString(), "ether");
      const alice = new web3.eth.Contract(ERC20_ABI, ALICE_ADDRESS);
      const tx = await alice.methods
        .approve(spender, amountInWei)
        .send({ from: userAddress });
    } else {
      console.error("MetaMask not detected or not connected");
    }
  }

  async function borrow(
    collateralAmount,
    loanAmount,
    price,
    blockNumber,
    reqId,
    signature,
  ) {
    if (web3) {
      const collateralAmountInWei = web3.utils.toWei(
        collateralAmount.toString(),
        "ether",
      );
      const buyer = new web3.eth.Contract(
        SIMPLE_LENDING_ABI,
        SIMPLE_LENDING_ADDRESS,
      );
      const tx = await buyer.methods
        .borrow(
          collateralAmountInWei,
          loanAmount,
          price,
          blockNumber,
          reqId,
          signature,
        )
        .send({ from: userAddress });
    } else {
      console.error("MetaMask not detected or not connected");
    }
  }
});
