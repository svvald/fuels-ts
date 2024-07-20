import type { TxParams } from 'fuels';
import { bn, LOCAL_NETWORK_URL, Provider, ScriptTransactionRequest, Wallet } from 'fuels';

import { WALLET_PVT_KEY } from '../env';
import { CounterAbi__factory } from '../typegend';
import bytecode from '../typegend/contracts/CounterAbi.hex';
import { ScriptSumAbi__factory } from '../typegend/scripts';

const { storageSlots } = CounterAbi__factory;

const provider = await Provider.create(LOCAL_NETWORK_URL);
const wallet = Wallet.fromPrivateKey(WALLET_PVT_KEY, provider);

const deploy = await CounterAbi__factory.deployContract(bytecode, wallet, {
  storageSlots,
});

// #region transaction-parameters-6
const txParams: TxParams = {
  // #region transaction-parameters-1
  gasLimit: bn(69242),
  // #endregion transaction-parameters-1
  // #region transaction-parameters-2
  maxFee: bn(69242),
  // #endregion transaction-parameters-2
  // #region transaction-parameters-3
  tip: bn(100),
  // #endregion transaction-parameters-3
  // #region transaction-parameters-4
  maturity: 1,
  // #endregion transaction-parameters-4
  // #region transaction-parameters-5
  witnessLimit: bn(5000),
  // #endregion transaction-parameters-5
};
// #endregion transaction-parameters-6

const { contract } = await deploy.waitForResult();

// #region transaction-parameters-7
const transactionRequest = new ScriptTransactionRequest({
  script: ScriptSumAbi__factory.bin,
  gasLimit: 100,
});
// #endregion transaction-parameters-7

// #region transaction-parameters-8
const { waitForResult } = await contract.functions // contract methods
  .increment_count(15) // contract method params
  .txParams(txParams) // custom params
  .call();

const {
  value,
  transactionResult: { isStatusSuccess },
} = await waitForResult();

console.log({ value, isStatusSuccess, transactionRequest });
// #endregion transaction-parameters-8
