import { parseAbiItem } from "viem";

export const verifierAbi = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isVerified",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isOver18",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isOver65",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "mintingPaused",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const claimAbi = [
  {
    inputs: [],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const forwarderAbi = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
        name: "request",
        type: "tuple",
      },
    ],
    name: "verify",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
        name: "request",
        type: "tuple",
      },
    ],
    name: "execute",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    type: "error",
    name: "ERC2771ForwarderInvalidSigner",
    inputs: [
      { name: "signer", type: "address" },
      { name: "from", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC2771ForwarderExpiredRequest",
    inputs: [{ name: "deadline", type: "uint48" }],
  },
  {
    type: "error",
    name: "ERC2771UntrustfulTarget",
    inputs: [
      { name: "target", type: "address" },
      { name: "forwarder", type: "address" },
    ],
  },
] as const;

export const addressVerifiedEvent = parseAbiItem(
  "event AddressVerified(address indexed user, uint256 at)"
);

export const verificationRevokedEvent = parseAbiItem(
  "event VerificationRevoked(address indexed user, uint256 at)"
);

export type UserStatus = {
  verified: boolean;
  over18: boolean;
  over65: boolean;
  ageLabel: string;
  clpcBalance: string;
};

export type WalletSnapshot = {
  status: UserStatus;
};
