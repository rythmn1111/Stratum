import { ethers } from 'ethers';

const ERC20_MIN_ABI = [
  'function transfer(address to, uint256 value) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
] as const;

export class InvalidAddressError extends Error {
  constructor(message = 'Invalid Ethereum address.') {
    super(message);
    this.name = 'InvalidAddressError';
  }
}

export class EthPaymentError extends Error {
  constructor(message = 'Ethereum payment failed.') {
    super(message);
    this.name = 'EthPaymentError';
  }
}

const assertEthAddress = (address: string, label: string): void => {
  if (!ethers.isAddress(address)) {
    throw new InvalidAddressError(`${label} is not a valid Ethereum address.`);
  }
};

const resolveEip1559Fees = async (provider: ethers.JsonRpcProvider): Promise<{
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}> => {
  const feeData = await provider.getFeeData();

  const fallbackPriority = ethers.parseUnits('1.5', 'gwei');
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? fallbackPriority;

  const baseMaxFee = feeData.maxFeePerGas ?? (feeData.gasPrice ? feeData.gasPrice * 2n : ethers.parseUnits('30', 'gwei'));
  const maxFeePerGas = baseMaxFee > maxPriorityFeePerGas ? baseMaxFee : maxPriorityFeePerGas + ethers.parseUnits('2', 'gwei');

  return { maxFeePerGas, maxPriorityFeePerGas };
};

export const sendETH = async (
  privateKeyHex: string,
  toAddress: string,
  amountEth: string,
  rpcUrl: string,
): Promise<{ txHash: string }> => {
  let keyMaterial = privateKeyHex;

  try {
    assertEthAddress(toAddress, 'Recipient address');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(keyMaterial, provider);

    const nonce = await provider.getTransactionCount(wallet.address, 'pending');
    const { maxFeePerGas, maxPriorityFeePerGas } = await resolveEip1559Fees(provider);

    const value = ethers.parseEther(amountEth);
    const gasEstimate = await provider.estimateGas({
      from: wallet.address,
      to: toAddress,
      value,
    });

    const tx = await wallet.sendTransaction({
      to: toAddress,
      value,
      nonce,
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: gasEstimate,
      type: 2,
    });

    await tx.wait(1);

    return { txHash: tx.hash };
  } catch (error) {
    if (error instanceof InvalidAddressError) {
      throw error;
    }
    throw new EthPaymentError(error instanceof Error ? error.message : 'Unknown ETH transfer error.');
  } finally {
    // Key zeroed immediately after signing.
    // Signed tx bytes contain no key material.
    keyMaterial = '0'.repeat(keyMaterial.length);
  }
};

export const sendUSDC_ETH = async (
  privateKeyHex: string,
  toAddress: string,
  amountUsdc: string,
  usdcContractAddress: string,
  rpcUrl: string,
): Promise<{ txHash: string }> => {
  let keyMaterial = privateKeyHex;

  try {
    assertEthAddress(toAddress, 'Recipient address');
    assertEthAddress(usdcContractAddress, 'USDC contract address');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(keyMaterial, provider);
    const contract = new ethers.Contract(usdcContractAddress, ERC20_MIN_ABI, wallet);

    const amount = ethers.parseUnits(amountUsdc, 6);
    const tx = await contract.transfer(toAddress, amount);
    await tx.wait(1);

    return { txHash: tx.hash as string };
  } catch (error) {
    if (error instanceof InvalidAddressError) {
      throw error;
    }
    throw new EthPaymentError(error instanceof Error ? error.message : 'Unknown USDC transfer error.');
  } finally {
    keyMaterial = '0'.repeat(keyMaterial.length);
  }
};

export const getETHBalance = async (address: string, rpcUrl: string): Promise<string> => {
  try {
    assertEthAddress(address, 'Address');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    if (error instanceof InvalidAddressError) {
      throw error;
    }
    throw new EthPaymentError(error instanceof Error ? error.message : 'Failed to fetch ETH balance.');
  }
};

export const getUSDCBalance = async (
  address: string,
  contractAddress: string,
  rpcUrl: string,
): Promise<string> => {
  try {
    assertEthAddress(address, 'Address');
    assertEthAddress(contractAddress, 'USDC contract address');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, ERC20_MIN_ABI, provider);
    const raw = (await contract.balanceOf(address)) as bigint;

    return ethers.formatUnits(raw, 6);
  } catch (error) {
    if (error instanceof InvalidAddressError) {
      throw error;
    }
    throw new EthPaymentError(error instanceof Error ? error.message : 'Failed to fetch USDC balance.');
  }
};
