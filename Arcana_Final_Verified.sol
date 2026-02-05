// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

abstract contract Ownable is Context {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor() {
        _transferOwnership(_msgSender());
    }
    modifier onlyOwner() {
        _checkOwner();
        _;
    }
    function owner() public view virtual returns (address) {
        return _owner;
    }
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;
    constructor() {
        _status = _NOT_ENTERED;
    }
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }
    function _nonReentrantBefore() private {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
    }
    function _nonReentrantAfter() private {
        _status = _NOT_ENTERED;
    }
}

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        require(token.transfer(to, value), "SafeERC20: transfer failed");
    }
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        require(token.transferFrom(from, to, value), "SafeERC20: transferFrom failed");
    }
    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        require(token.approve(spender, value), "SafeERC20: approve failed");
    }
}

contract ArcanaPresaleVault is Ownable, ReentrancyGuard {
    IERC20 public immutable arcanaToken;
    mapping(address => uint256) public balanceOf;
    bool public claimOpen;
    uint256 public totalSold;

    event Bought(address indexed buyer, uint256 amountNative, uint256 tokens);
    event Claimed(address indexed user, uint256 amount);
    event ClaimOpenUpdated(bool open);

    constructor(address _arcanaToken) {
        require(_arcanaToken != address(0), "Invalid token");
        arcanaToken = IERC20(_arcanaToken);
    }

    function setClaimOpen(bool _open) external onlyOwner {
        claimOpen = _open;
        emit ClaimOpenUpdated(_open);
    }

    receive() external payable {
        _buyWithNative();
    }

    function buyWithPOL() external payable nonReentrant {
        _buyWithNative();
    }

    function buyWithNative() external payable nonReentrant {
        _buyWithNative();
    }

    function _buyWithNative() internal {
        require(msg.value > 0, "Zero amount");
        uint256 tokens = msg.value * 1e18 / 0.00025 ether;
        balanceOf[msg.sender] += tokens;
        totalSold += tokens;
        emit Bought(msg.sender, msg.value, tokens);
    }

    function buyWithUSDT(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        address usdt = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
        SafeERC20.safeTransferFrom(IERC20(usdt), msg.sender, address(this), amount);
        uint256 tokens = amount * 1e18 / (0.00025 ether * 1e6 / 1e6);
        balanceOf[msg.sender] += tokens;
        totalSold += tokens;
        emit Bought(msg.sender, 0, tokens);
    }

    function buyWithUSDC(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        address usdc = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
        SafeERC20.safeTransferFrom(IERC20(usdc), msg.sender, address(this), amount);
        uint256 tokens = amount * 1e18 / (0.00025 ether * 1e6 / 1e6);
        balanceOf[msg.sender] += tokens;
        totalSold += tokens;
        emit Bought(msg.sender, 0, tokens);
    }

    function buyWithToken(address token, uint256 amount) external nonReentrant {
        require(amount > 0 && token != address(0), "Invalid");
        SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);
        uint256 tokens = amount * 1e18 / (0.00025 ether * 1e18 / 1e18);
        balanceOf[msg.sender] += tokens;
        totalSold += tokens;
        emit Bought(msg.sender, 0, tokens);
    }

    function claim() external nonReentrant {
        require(claimOpen, "Claim not open");
        uint256 amount = balanceOf[msg.sender];
        require(amount > 0, "Nothing to claim");
        balanceOf[msg.sender] = 0;
        SafeERC20.safeTransfer(arcanaToken, msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    function withdrawNative() external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: address(this).balance}("");
        require(ok, "Transfer failed");
    }

    function withdrawToken(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        SafeERC20.safeTransfer(IERC20(token), owner(), bal);
    }
}
