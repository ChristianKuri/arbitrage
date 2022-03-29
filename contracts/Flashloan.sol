pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "./IPancakeRouter02.sol";
import "./interfaces/IPancakePair.sol";
import "./interfaces/IPancakeFactory.sol";
import "./interfaces/IPancakeERC20.sol";
import "./libraries/SafeMath.sol";
import "./PancakeLibrary.sol";

contract Flashloan {
    IPancakeRouter02 public bakeryRouter;
    IPancakeRouter02 public pancakeRouter;
    IPancakeFactory public pancakeFactory;
    address PancakeFactory;

    bytes arbdata;
    enum Direction {
        BakerytoPancake,
        PancaketoBakery
    }
    struct ArbInfo {
        Direction direction;
        uint256 repayAmount;
    }

    constructor(
        address _pancakeFactory,
        address _bakeryRouter,
        address _pancakeRouter02
    ) public {
        pancakeFactory = IPancakeFactory(_pancakeFactory);
        bakeryRouter = IPancakeRouter02(_bakeryRouter);
        pancakeRouter = IPancakeRouter02(_pancakeRouter02);
        PancakeFactory = _pancakeFactory;
    }

    function startArbitrage(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        Direction _direction,
        uint256 repayAmount
    ) external {
        arbdata = abi.encode(
            ArbInfo({direction: _direction, repayAmount: repayAmount})
        );
        address pairAddress = IPancakeFactory().getPair(token0, token1);
        require(pairAddress != address(0), "This pool does not exist");
        IPancakePair(pairAddress).swap(
            amount0,
            amount1,
            address(this),
            bytes("not empty") //not empty bytes param will trigger flashloan
        );
    }

    function pancakeCall(
        address _sender,
        uint256 _amount0,
        uint256 _amount1,
        bytes calldata data
    ) external {
        ArbInfo memory arbInfo = abi.decode(arbdata, (ArbInfo));
        uint256 amountToken = _amount0 == 0 ? _amount1 : _amount0;

        address token0 = IPancakePair(msg.sender).token0();
        address token1 = IPancakePair(msg.sender).token1();

        require(
            msg.sender ==
                PancakeLibrary.pairFor(PancakeFactory, token0, token1),
            "Unauthorized sender should be pancake library"
        );

        require(_amount0 == 0 || _amount1 == 0);

        IPancakeERC20 token = IPancakeERC20(_amount0 == 0 ? token1 : token0);
    }
}
