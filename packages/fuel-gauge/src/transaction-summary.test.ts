import type {
  TransactionResultReceipt,
  Operation,
  TransactionSummary,
  TransactionResult,
  AbstractAddress,
} from 'fuels';
import {
  BN,
  getTransactionsSummaries,
  getTransactionSummary,
  getTransactionSummaryFromRequest,
  ScriptTransactionRequest,
  TransactionTypeName,
  Wallet,
  AddressType,
  OperationName,
} from 'fuels';
import { ASSET_A, ASSET_B, launchTestNode, TestMessage } from 'fuels/test-utils';

import { MultiTokenContractFactory, TokenContractFactory } from '../test/typegen';

/**
 * @group node
 * @group browser
 */
describe('TransactionSummary', () => {
  const verifyTransactionSummary = (params: {
    transaction: TransactionResult | TransactionSummary;
    isRequest?: boolean;
  }) => {
    const { transaction, isRequest } = params;

    expect(transaction.fee).toStrictEqual(expect.any(BN));
    expect(transaction.gasUsed).toStrictEqual(expect.any(BN));
    expect(transaction.operations).toStrictEqual(expect.any(Array<Operation>));
    expect(transaction.type).toEqual(TransactionTypeName.Script);
    expect(transaction.receipts).toStrictEqual(expect.any(Array<TransactionResultReceipt>));
    expect(transaction.isTypeMint).toBe(false);
    expect(transaction.isTypeCreate).toBe(false);
    expect(transaction.isTypeScript).toBe(true);
    expect(transaction.isTypeBlob).toBe(false);
    expect(transaction.isStatusFailure).toBe(false);
    expect(transaction.isStatusSuccess).toBe(!isRequest);
    expect(transaction.isStatusPending).toBe(false);
    if (!isRequest) {
      expect((<TransactionResult>transaction).gqlTransaction).toStrictEqual(expect.any(Object));
      expect(transaction.blockId).toEqual(expect.any(String));
      expect(transaction.time).toEqual(expect.any(String));
      expect(transaction.status).toEqual(expect.any(String));
      expect(transaction.date).toEqual(expect.any(Date));
    }
  };

  it('should ensure getTransactionSummary executes just fine', async () => {
    using launched = await launchTestNode();

    const {
      provider,
      wallets: [adminWallet],
    } = launched;

    const destination = Wallet.generate({
      provider,
    });

    const amountToTransfer = 100;

    const request = new ScriptTransactionRequest({
      gasLimit: 10000,
    });

    request.addCoinOutput(destination.address, amountToTransfer, provider.getBaseAssetId());

    const txCost = await adminWallet.getTransactionCost(request);

    request.gasLimit = txCost.gasUsed;
    request.maxFee = txCost.maxFee;

    await adminWallet.fund(request, txCost);

    const tx = await adminWallet.sendTransaction(request);

    const transactionResponse = await tx.waitForResult();

    const transactionSummary = await getTransactionSummary({
      id: tx.id,
      provider,
    });

    verifyTransactionSummary({
      transaction: transactionSummary,
    });

    expect(transactionResponse).toStrictEqual(transactionSummary);
    expect(transactionSummary.transaction).toStrictEqual(transactionResponse.transaction);
  });

  it('should ensure getTransactionsSummaries executes just fine', async () => {
    using launched = await launchTestNode();

    const {
      provider,
      wallets: [adminWallet],
    } = launched;

    const sender = Wallet.generate({
      provider,
    });

    const tx1 = await adminWallet.transfer(sender.address, 500_000, provider.getBaseAssetId(), {
      gasLimit: 10_000,
    });
    const transactionResponse1 = await tx1.waitForResult();

    const amountToTransfer = 100;

    const destination = Wallet.generate({
      provider,
    });

    const tx2 = await sender.transfer(
      destination.address,
      amountToTransfer,
      provider.getBaseAssetId(),
      {
        gasLimit: 10_000,
      }
    );
    const transactionResponse2 = await tx2.waitForResult();

    const { transactions } = await getTransactionsSummaries({
      provider,
      filters: {
        first: 2,
        owner: sender.address.toB256(),
      },
    });

    expect(transactions.length).toBe(2);

    transactions.forEach((transactionSummary) => {
      verifyTransactionSummary({
        transaction: transactionSummary,
      });
    });

    expect(transactions[0]).toStrictEqual(transactionResponse1);
    expect(transactions[1]).toStrictEqual(transactionResponse2);
  });

  it('should ensure getTransactionSummaryFromRequest executes just fine', async () => {
    using launched = await launchTestNode();

    const {
      provider,
      wallets: [adminWallet],
    } = launched;

    const request = new ScriptTransactionRequest({
      gasLimit: 10000,
    });

    const txCost = await adminWallet.getTransactionCost(request);

    request.gasLimit = txCost.gasUsed;
    request.maxFee = txCost.maxFee;

    await adminWallet.fund(request, txCost);

    const transactionRequest = await adminWallet.populateTransactionWitnessesSignature(request);

    const transactionSummary = await getTransactionSummaryFromRequest({
      provider,
      transactionRequest,
    });
    verifyTransactionSummary({
      transaction: transactionSummary,
      isRequest: true,
    });

    expect(transactionSummary.transaction).toStrictEqual(transactionRequest.toTransaction());
  });

  describe('Transfer Operations', () => {
    const validateTransferOperation = (params: {
      operations: Operation[];
      sender: AbstractAddress;
      recipients: { address: AbstractAddress; quantities: { amount: number; assetId: string }[] }[];
      fromType: AddressType;
      toType: AddressType;
    }) => {
      const { operations, recipients, sender, fromType, toType } = params;

      recipients.forEach(({ address, quantities }, index) => {
        expect(operations[index].name).toBe(OperationName.transfer);
        expect(operations[index].from?.type).toBe(fromType);
        expect(operations[index].from?.address).toBe(sender.toB256());
        expect(operations[index].to?.type).toBe(toType);
        expect(operations[index].to?.address).toBe(address.toB256());
        expect(operations[index].assetsSent).toHaveLength(quantities.length);

        quantities.forEach(({ amount, assetId }, qunatitiesIndex) => {
          expect(Number(operations[index].assetsSent?.[qunatitiesIndex].amount)).toBe(amount);
          expect(operations[index].assetsSent?.[qunatitiesIndex].assetId).toBe(assetId);
        });
      });
    };

    it('should ensure transfer operation is assembled (ACCOUNT TRANSFER)', async () => {
      using launched = await launchTestNode();

      const {
        provider,
        wallets: [wallet],
      } = launched;

      const recipient = Wallet.generate({ provider });

      const amount = 1233;

      const tx1 = await wallet.transfer(recipient.address, amount, provider.getBaseAssetId());

      const { operations } = await tx1.waitForResult();

      expect(operations).toHaveLength(1);

      validateTransferOperation({
        operations,
        sender: wallet.address,
        fromType: AddressType.account,
        toType: AddressType.account,
        recipients: [
          {
            address: recipient.address,
            quantities: [{ amount, assetId: provider.getBaseAssetId() }],
          },
        ],
      });
    });

    it('should ensure transfer operation is assembled (ACCOUNT TRANSFER TO CONTRACT)', async () => {
      using launched = await launchTestNode({
        contractsConfigs: [
          {
            factory: MultiTokenContractFactory,
          },
        ],
      });

      const {
        contracts: [contract],
        wallets: [wallet],
      } = launched;

      const amount = 234;

      const tx1 = await wallet.transferToContract(contract.id, amount, ASSET_A);

      const { operations } = await tx1.waitForResult();

      expect(operations).toHaveLength(1);

      validateTransferOperation({
        operations,
        sender: wallet.address,
        fromType: AddressType.account,
        toType: AddressType.contract,
        recipients: [{ address: contract.id, quantities: [{ amount, assetId: ASSET_A }] }],
      });
    });

    it('should ensure transfer operation is assembled (CONTRACT TRANSFER TO ACCOUNT)', async () => {
      using launched = await launchTestNode({
        contractsConfigs: [
          {
            factory: TokenContractFactory,
          },
        ],
      });

      const {
        provider,
        contracts: [contract],
      } = launched;

      const recipient = Wallet.generate({ provider });
      const amount = 1055;

      const call1 = await contract.functions.mint_coins(100000).call();
      const res1 = await call1.waitForResult();

      const { assetId } = res1.transactionResult.mintedAssets[0];

      const call2 = await contract.functions
        .transfer_to_address({ bits: recipient.address.toB256() }, { bits: assetId }, amount)
        .call();

      const {
        transactionResult: { operations },
      } = await call2.waitForResult();

      validateTransferOperation({
        operations,
        sender: contract.id,
        fromType: AddressType.contract,
        toType: AddressType.account,
        recipients: [{ address: recipient.address, quantities: [{ amount, assetId }] }],
      });
    });

    it(
      'should ensure transfer operations are assembled (CONTRACT TRANSFER TO ACCOUNTS)',
      async () => {
        using launched = await launchTestNode({
          contractsConfigs: [
            {
              factory: TokenContractFactory,
            },
          ],
        });

        const {
          contracts: [senderContract],
          provider,
          wallets: [wallet],
        } = launched;

        const walletA = Wallet.generate({ provider });
        const walletB = Wallet.generate({ provider });

        const submitted1 = await wallet.transfer(walletA.address, 50_000, ASSET_A);
        await submitted1.waitForResult();

        const submitted2 = await wallet.transfer(walletB.address, 50_000, ASSET_B);
        await submitted2.waitForResult();

        senderContract.account = wallet;
        const fundAmount = 5_000;

        const assets = [provider.getBaseAssetId(), ASSET_A, ASSET_B];
        for await (const asset of assets) {
          const tx = await wallet.transferToContract(senderContract.id, fundAmount, asset);
          await tx.waitForResult();
        }

        const transferData1 = {
          address: Wallet.generate({ provider }).address,
          quantities: [
            { amount: 543, assetId: ASSET_A },
            { amount: 40, assetId: ASSET_B },
            { amount: 123, assetId: provider.getBaseAssetId() },
          ],
        };
        const transferData2 = {
          address: Wallet.generate({ provider }).address,
          quantities: [
            { amount: 12, assetId: provider.getBaseAssetId() },
            { amount: 612, assetId: ASSET_B },
          ],
        };

        const { waitForResult } = await senderContract.functions
          .multi_address_transfer([
            // 3 Transfers for recipient contract 1
            ...transferData1.quantities.map(({ amount, assetId }) => ({
              recipient: { bits: transferData1.address.toB256() },
              asset_id: { bits: assetId },
              amount,
            })),
            // 2 Transfers for recipient contract 2
            ...transferData2.quantities.map(({ amount, assetId }) => ({
              recipient: { bits: transferData2.address.toB256() },
              asset_id: { bits: assetId },
              amount,
            })),
          ])
          .call();

        const {
          transactionResult: { operations },
        } = await waitForResult();

        validateTransferOperation({
          operations,
          sender: senderContract.id,
          fromType: AddressType.contract,
          toType: AddressType.account,
          recipients: [transferData1, transferData2],
        });
      },
      { timeout: 10_000 }
    );

    it('should ensure transfer operation is assembled (CONTRACT TRANSFER TO CONTRACT)', async () => {
      using launched = await launchTestNode({
        contractsConfigs: [
          {
            factory: TokenContractFactory,
          },
          {
            factory: TokenContractFactory,
          },
        ],
      });

      const {
        wallets: [wallet],
        contracts: [contractSender, contractRecipient],
      } = launched;

      contractSender.account = wallet;

      const call1 = await contractSender.functions.mint_coins(100000).call();
      const {
        transactionResult: { mintedAssets },
      } = await call1.waitForResult();

      const amount = 2345;
      const { assetId } = mintedAssets[0];
      const call2 = await contractSender.functions
        .transfer_to_contract(
          { bits: contractRecipient.id.toB256() },
          { bits: mintedAssets[0].assetId },
          amount
        )
        .call();

      const {
        transactionResult: { operations },
      } = await call2.waitForResult();

      validateTransferOperation({
        operations,
        sender: contractSender.id,
        fromType: AddressType.contract,
        toType: AddressType.contract,
        recipients: [{ address: contractRecipient.id, quantities: [{ amount, assetId }] }],
      });
    });

    it('should ensure transfer operations are assembled (CONTRACT TRANSFER TO CONTRACTS)', async () => {
      using launched = await launchTestNode({
        contractsConfigs: [
          {
            factory: TokenContractFactory,
          },
          {
            factory: TokenContractFactory,
          },
          {
            factory: TokenContractFactory,
          },
        ],
      });

      const {
        provider,
        wallets: [wallet],
        contracts: [senderContract, contractRecipient1, contractRecipient2],
      } = launched;

      senderContract.account = wallet;
      const fundAmount = 5_000;

      const assets = [provider.getBaseAssetId(), ASSET_A, ASSET_B];
      for await (const asset of assets) {
        const tx = await wallet.transferToContract(senderContract.id, fundAmount, asset);
        await tx.waitForResult();
      }

      const transferData1 = {
        address: contractRecipient1.id,
        quantities: [
          { amount: 300, assetId: ASSET_A },
          { amount: 400, assetId: ASSET_B },
        ],
      };
      const transferData2 = {
        address: contractRecipient2.id,
        quantities: [
          { amount: 500, assetId: ASSET_A },
          { amount: 700, assetId: ASSET_B },
          { amount: 100, assetId: provider.getBaseAssetId() },
        ],
      };

      const { waitForResult } = await senderContract.functions
        .multi_contract_transfer([
          // 2 Transfers for recipient contract 1
          ...transferData1.quantities.map(({ amount, assetId }) => ({
            recipient: { bits: transferData1.address.toB256() },
            asset_id: { bits: assetId },
            amount,
          })),
          // 3 Transfers for recipient contract 2
          ...transferData2.quantities.map(({ amount, assetId }) => ({
            recipient: { bits: transferData2.address.toB256() },
            asset_id: { bits: assetId },
            amount,
          })),
        ])
        .call();

      const {
        transactionResult: { operations },
      } = await waitForResult();

      validateTransferOperation({
        operations,
        sender: senderContract.id,
        fromType: AddressType.contract,
        toType: AddressType.contract,
        recipients: [transferData1, transferData2],
      });
    });

    it('should ensure transfer operations are assembled (CUSTOM SCRIPT TRANSFER)', async () => {
      using launched = await launchTestNode();

      const {
        provider,
        wallets: [wallet],
      } = launched;

      const walletA = Wallet.generate({ provider });
      const walletB = Wallet.generate({ provider });

      const submitted1 = await wallet.transfer(walletA.address, 10_000, ASSET_A);
      await submitted1.waitForResult();

      const submitted2 = await wallet.transfer(walletB.address, 10_000, ASSET_B);
      await submitted2.waitForResult();

      const recipient1Data = {
        address: Wallet.generate({ provider }).address,
        quantities: [{ amount: 250, assetId: ASSET_A }],
      };

      const recipient2Data = {
        address: Wallet.generate({ provider }).address,
        quantities: [
          { amount: 300, assetId: ASSET_A },
          { amount: 400, assetId: ASSET_B },
        ],
      };
      const recipient3Data = {
        address: Wallet.generate({ provider }).address,
        quantities: [
          { amount: 500, assetId: ASSET_A },
          { amount: 700, assetId: ASSET_B },
          { amount: 100, assetId: provider.getBaseAssetId() },
        ],
      };

      const allRecipients = [recipient1Data, recipient2Data, recipient3Data];

      const request = new ScriptTransactionRequest();

      allRecipients.forEach(({ address, quantities }) => {
        quantities.forEach(({ amount, assetId }) => {
          request.addCoinOutput(address, amount, assetId);
        });
      });

      const txCost = await wallet.getTransactionCost(request);

      request.gasLimit = txCost.gasUsed;
      request.maxFee = txCost.maxFee;

      await wallet.fund(request, txCost);

      const tx = await wallet.sendTransaction(request);

      const { operations } = await tx.waitForResult();

      validateTransferOperation({
        operations,
        sender: wallet.address,
        fromType: AddressType.account,
        toType: AddressType.account,
        recipients: allRecipients,
      });
    });

    it('should ensure that transfer operations are assembled correctly if only seeded with a MessageInput (SPENDABLE MESSAGE)', async () => {
      const testMessage = new TestMessage({ amount: 1000000 });

      using launched = await launchTestNode({
        contractsConfigs: [
          {
            factory: MultiTokenContractFactory,
          },
        ],
        walletsConfig: {
          amountPerCoin: 0,
          messages: [testMessage],
        },
      });
      const {
        contracts: [contract],
        provider,
        wallets: [wallet],
      } = launched;

      const amount = 100;

      const tx1 = await wallet.transferToContract(contract.id, amount);

      const { operations } = await tx1.waitForResult();

      expect(operations).toHaveLength(1);

      validateTransferOperation({
        operations,
        sender: wallet.address,
        fromType: AddressType.account,
        toType: AddressType.contract,
        recipients: [
          { address: contract.id, quantities: [{ amount, assetId: provider.getBaseAssetId() }] },
        ],
      });
    });
  });
});
