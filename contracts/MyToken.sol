// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyToken
 * @dev Custom ERC-20 token built with OpenZeppelin.
 *      Total supply is minted to the deployer on construction.
 */
contract MyToken is ERC20, Ownable {
    /**
     * @param initialSupply The number of tokens (in whole units) to mint at deploy time.
     *                      They will be minted with 18 decimals automatically.
     */
    constructor(uint256 initialSupply)
        ERC20("SabaToken", "SABA")
        Ownable(msg.sender)
    {
        // Mint initialSupply tokens (scaled to 18 decimals) to the deployer
        _mint(msg.sender, initialSupply * (10 ** decimals()));
    }

    /**
     * @dev Allows the owner to mint additional tokens to any address.
     * @param to      Recipient address.
     * @param amount  Amount in whole token units (18 decimals applied internally).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount * (10 ** decimals()));
    }
}
