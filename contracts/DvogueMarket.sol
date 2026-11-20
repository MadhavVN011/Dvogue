// SPDX-License-Identifier: MIT
pragma solidity ^0.8.39;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DvogueRegistry} from "./DvogueRegistry.sol";

/// @notice Native-currency checkout and transferable digital product passports.
/// @dev Physical fulfilment is off-chain. Orders contain no shipping/personal data.
contract DvogueMarket is ERC721Enumerable, Ownable, ReentrancyGuard {
    struct Listing { bytes32 productId; uint256 price; uint256 stock; string passportURI; }
    struct Order { address buyer; uint64 placedAt; uint256 total; uint256 firstToken; uint256 units; }
    struct OrderLine { bytes32 variantId; uint256 quantity; uint256 unitPrice; }
    struct Passport { bytes32 productId; bytes32 variantId; uint256 orderId; }
    DvogueRegistry public immutable registry;
    uint256 public orderCount;
    uint256 private nextToken = 1;
    mapping(bytes32 => Listing) private listings;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => OrderLine[]) private orderLines;
    mapping(address => uint256[]) private buyerOrders;
    mapping(uint256 => Passport) public passports;
    mapping(uint256 => string) private passportURIs;
    error InvalidListing();
    error InvalidCart();
    error Unavailable();
    error PriceChanged();
    error IncorrectPayment();
    error TransferFailed();
    event OrderPlaced(uint256 indexed orderId, address indexed buyer, uint256 total, uint256 firstToken, uint256 units);
    event ListingUpdated(bytes32 indexed variantId, bytes32 indexed productId, uint256 price, uint256 stock);

    constructor(address registryAddress) ERC721("Dvogue Product Passport", "DVOGUE") Ownable(msg.sender) {
        if (registryAddress == address(0) || registryAddress.code.length == 0) revert InvalidListing();
        registry = DvogueRegistry(registryAddress);
    }
    function setListing(bytes32 variantId, bytes32 productId, uint256 price, uint256 stock, string calldata passportURI) external onlyOwner nonReentrant {
        registry.getProduct(productId);
        if (variantId == bytes32(0) || price == 0 || bytes(passportURI).length == 0 || bytes(passportURI).length > 512) revert InvalidListing();
        if (listings[variantId].productId != bytes32(0) && listings[variantId].productId != productId) revert InvalidListing();
        listings[variantId] = Listing(productId, price, stock, passportURI);
        emit ListingUpdated(variantId, productId, price, stock);
    }
    function getListing(bytes32 variantId) external view returns (Listing memory) { return listings[variantId]; }
    function quote(bytes32[] calldata variants, uint256[] calldata quantities) public view returns (uint256 total) {
        if (variants.length == 0 || variants.length > 20 || variants.length != quantities.length) revert InvalidCart();
        uint256 units;
        for (uint256 i; i < variants.length; i++) {
            if (quantities[i] == 0 || quantities[i] > 10) revert InvalidCart();
            for (uint256 j; j < i; j++) if (variants[j] == variants[i]) revert InvalidCart();
            Listing storage item = listings[variants[i]];
            if (item.price == 0 || item.stock < quantities[i]) revert Unavailable();
            total += item.price * quantities[i];
            units += quantities[i];
        }
        if (units > 20) revert InvalidCart();
    }
    function buy(bytes32[] calldata variants, uint256[] calldata quantities, uint256[] calldata expectedPrices) external payable nonReentrant returns (uint256 orderId) {
        uint256 total = quote(variants, quantities);
        if (expectedPrices.length != variants.length) revert InvalidCart();
        if (msg.value != total) revert IncorrectPayment();
        orderId = ++orderCount;
        uint256 first = nextToken;
        uint256 units;
        // Commit prices/inventory before the ERC721 receiver callbacks.
        for (uint256 i; i < variants.length; i++) {
            Listing storage item = listings[variants[i]];
            if (item.price != expectedPrices[i]) revert PriceChanged();
            item.stock -= quantities[i];
            units += quantities[i];
            orderLines[orderId].push(OrderLine(variants[i], quantities[i], item.price));
        }
        orders[orderId] = Order(msg.sender, uint64(block.timestamp), total, first, units);
        buyerOrders[msg.sender].push(orderId);
        for (uint256 i; i < variants.length; i++) _issuePassports(variants[i], quantities[i], orderId);
        emit OrderPlaced(orderId, msg.sender, total, first, units);
    }
    function _issuePassports(bytes32 variantId, uint256 quantity, uint256 orderId) private {
        bytes32 productId = listings[variantId].productId;
        string memory uri = listings[variantId].passportURI;
        for (uint256 j; j < quantity; j++) {
            uint256 tokenId = nextToken++;
            passports[tokenId] = Passport(productId, variantId, orderId);
            passportURIs[tokenId] = uri;
            _safeMint(msg.sender, tokenId);
        }
    }
    function getOrderLines(uint256 orderId) external view returns (OrderLine[] memory) { return orderLines[orderId]; }
    function orderCountOf(address buyer) external view returns (uint256) { return buyerOrders[buyer].length; }
    function orderIdAt(address buyer, uint256 index) external view returns (uint256) { return buyerOrders[buyer][index]; }
    function tokenURI(uint256 tokenId) public view override returns (string memory) { _requireOwned(tokenId); return passportURIs[tokenId]; }
    function withdraw() external onlyOwner nonReentrant {
        (bool success,) = payable(owner()).call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }
}
