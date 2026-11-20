export const registryABI = [
  'function getProduct(bytes32) view returns (tuple(bytes32 metadataHash,string metadataURI,uint64 registeredAt,uint8 stage))',
  'function owner() view returns (address)',
];
export const marketABI = [
  'error InvalidCart()', 'error Unavailable()', 'error PriceChanged()', 'error IncorrectPayment()',
  'function registry() view returns (address)',
  'function getListing(bytes32) view returns (tuple(bytes32 productId,uint256 price,uint256 stock,string passportURI))',
  'function quote(bytes32[],uint256[]) view returns (uint256)',
  'function buy(bytes32[],uint256[],uint256[]) payable returns (uint256)',
  'function orderCountOf(address) view returns (uint256)',
  'function orderIdAt(address,uint256) view returns (uint256)',
  'function orders(uint256) view returns (address buyer,uint64 placedAt,uint256 total,uint256 firstToken,uint256 units)',
  'function getOrderLines(uint256) view returns (tuple(bytes32 variantId,uint256 quantity,uint256 unitPrice)[])',
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
  'function passports(uint256) view returns (bytes32 productId,bytes32 variantId,uint256 orderId)',
  'function tokenURI(uint256) view returns (string)',
  'event OrderPlaced(uint256 indexed orderId,address indexed buyer,uint256 total,uint256 firstToken,uint256 units)',
];
export function shortAddress(value = '') { return value ? value.slice(0, 6) + '…' + value.slice(-4) : ''; }
export function variantKey(sku, size) { return sku + ':' + size; }
export function networkLabel(config) { return config?.chainName || 'Wallet network'; }
