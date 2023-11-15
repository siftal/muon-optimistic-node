// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/IToken.sol";

contract SimpleLending is Initializable, AccessControlUpgradeable {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public muonAppId;
    uint256 public blockBorder;

    ICollateralManager public collateralManager;
    IToken public lendingToken;
    IToken public collateralToken;

    mapping(address => uint256) public users;
    mapping(bytes => bool) public paids;

    event Lent(address indexed user, uint256 loanAmount, uint256 collateralAmount, uint256 price, bytes32 reqId);

    function initialize(
        address _collateralManagerAddr,
        address _collateralTokenAddr,
        address _lendingTokenAddr,
        uint256 _muonAppId
    ) external initializer {
        __SimpleLending_init(
            _collateralManagerAddr,
            _collateralTokenAddr,
            _lendingTokenAddr,
            _muonAppId
        );
    }

    function __SimpleLending_init(
        address _collateralManagerAddr,
        address _collateralTokenAddr,
        address _lendingTokenAddr,
        uint256 _muonAppId
    ) internal initializer {
        __AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);

        collateralManager = ICollateralManager(_collateralManagerAddr);
        collateralToken = IToken(_collateralTokenAddr);
        lendingToken = IToken(_lendingTokenAddr);
        muonAppId = _muonAppId;
        blockBorder = 100;
    }

    function __SimpleLending_init_unchained() internal initializer {}

    function borrow(
        uint256 collateralAmount,
        uint256 loanAmount,
        uint256 price,
        uint256 blockNumber,
        bytes32 reqId,
        bytes calldata signature
    ) external {
        ICollateralManager.Request memory request = collateralManager.requests(
            reqId
        );

        bytes32 hash = keccak256(
            abi.encodePacked(muonAppId, reqId, blockNumber, price)
        );
        hash = hash.toEthSignedMessageHash();
        address signer = hash.recover(signature);
        require(signer == request.warrantor, "Invalid Warrantor");

        require(request.user == msg.sender, "Invalid request sender");

        require(
            request.status == ICollateralManager.RequestStatus.LOCKED,
            "Invalid collateral status"
        );

        require(request.asset == address(lendingToken), "Invalid locked asset");

        require(loanAmount <= request.amount / 2, "Invalid collateral amount");

        require(block.number - blockNumber <= blockBorder, "Too old request");

        uint256 balance = collateralToken.balanceOf(address(this));
        collateralToken.transferFrom(msg.sender, address(this), collateralAmount);
        uint256 receivedAmount = collateralToken.balanceOf(address(this)) - balance;
        require(
            collateralAmount == receivedAmount,
            "The discrepancy between the received and claimed collateral"
        );

        lendingToken.transfer(msg.sender, loanAmount);
        emit Lent(msg.sender, loanAmount, collateralAmount, price, reqId);
    }

    function setCollateralManager(address _collateralManagerAddr)
        external
        onlyRole(ADMIN_ROLE)
    {
        collateralManager = ICollateralManager(_collateralManagerAddr);
    }

    function setLendingToken(address _lendingTokenAddr) external onlyRole(ADMIN_ROLE) {
        lendingToken = IToken(_lendingTokenAddr);
    }

    function setCollateralToken(address _collateralTokenAddr) external onlyRole(ADMIN_ROLE) {
        collateralToken = IToken(_collateralTokenAddr);
    }

    function setMuonAppId(uint256 _muonAppId) external onlyRole(ADMIN_ROLE) {
        muonAppId = _muonAppId;
    }

    function setBlockBorder(uint256 _blockBorder) external onlyRole(ADMIN_ROLE) {
        blockBorder = _blockBorder;
    }
}
