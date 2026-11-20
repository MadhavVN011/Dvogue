// SPDX-License-Identifier: MIT
pragma solidity ^0.8.39;

/// @notice Issuer attestations for product metadata. A record is not an independent certification.
contract DvogueRegistry {
    struct Product { bytes32 metadataHash; string metadataURI; uint64 registeredAt; uint8 stage; }
    address public immutable owner;
    uint256 public productCount;
    mapping(bytes32 => Product) private products;
    error Unauthorized();
    error InvalidProduct();
    error AlreadyRegistered();
    error UnknownProduct();
    error InvalidStage();
    event ProductRegistered(bytes32 indexed productId, bytes32 metadataHash, string metadataURI);
    event CheckpointAdded(bytes32 indexed productId, uint8 stage, bytes32 evidenceHash);

    constructor() { owner = msg.sender; }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }

    function registerProduct(bytes32 productId, bytes32 metadataHash, string calldata metadataURI) external onlyOwner {
        if (productId == bytes32(0) || metadataHash == bytes32(0) || bytes(metadataURI).length == 0 || bytes(metadataURI).length > 512) revert InvalidProduct();
        if (products[productId].registeredAt != 0) revert AlreadyRegistered();
        products[productId] = Product(metadataHash, metadataURI, uint64(block.timestamp), 0);
        productCount++;
        emit ProductRegistered(productId, metadataHash, metadataURI);
    }
    function getProduct(bytes32 productId) external view returns (Product memory) {
        if (products[productId].registeredAt == 0) revert UnknownProduct();
        return products[productId];
    }
    /// @dev Stages: 1 material sourced, 2 manufactured, 3 quality checked, 4 shipped.
    function addCheckpoint(bytes32 productId, uint8 stage, bytes32 evidenceHash) external onlyOwner {
        Product storage product = products[productId];
        if (product.registeredAt == 0) revert UnknownProduct();
        if (stage != product.stage + 1 || stage > 4 || evidenceHash == bytes32(0)) revert InvalidStage();
        product.stage = stage;
        emit CheckpointAdded(productId, stage, evidenceHash);
    }
}
