import { FUEL_NETWORK_URL, Provider, ScriptTransactionRequest, sleep, Address } from 'fuels';
import { launchTestNode } from 'fuels/test-utils';

async function fetchSomeExternalCredentials() {
  return Promise.resolve('credential');
}

function decorateResponseWithCustomLogic(response: Response) {
  return response;
}

/**
 * @group node
 * @group browser
 */
describe.skip('Provider', () => {
  it('base examples', async () => {
    // #region provider-definition
    // Create a provider and wallet using launchTestNode utility
    using launched = await launchTestNode();
    const {
      provider,
      wallets: [wallet],
    } = launched;

    // Querying the blockchain
    const { consensusParameters } = provider.getChain();

    // Get the balances of the wallet (this will be empty until we have assets)
    const { balances } = await wallet.getBalances();
    // []
    // #endregion provider-definition

    expect(provider).toBeDefined();
    expect(provider).toBeInstanceOf(Provider);
    expect(consensusParameters).toBeDefined();
    expect(consensusParameters).toBeInstanceOf(Object);
    expect(balances).toEqual([]);
  });

  test('options: requestMiddleware', async () => {
    // #region options-requestMiddleware
    // synchronous request middleware
    await Provider.create(FUEL_NETWORK_URL, {
      requestMiddleware: (request: RequestInit) => {
        request.credentials = 'omit';

        return request;
      },
    });

    // asynchronous request middleware
    await Provider.create(FUEL_NETWORK_URL, {
      requestMiddleware: async (request: RequestInit) => {
        const credentials = await fetchSomeExternalCredentials();
        request.headers ??= {};
        (request.headers as Record<string, string>).auth = credentials;

        return request;
      },
    });
    // #endregion options-requestMiddleware
  });

  it('options: timeout', async () => {
    // #region options-timeout
    await Provider.create(FUEL_NETWORK_URL, {
      timeout: 30000, // will abort if request takes 30 seconds to complete
    });
    // #endregion options-timeout
  });

  it('options: retryOptions', async () => {
    // #region options-retryOptions
    await Provider.create(FUEL_NETWORK_URL, {
      retryOptions: {
        maxRetries: 5,
        baseDelay: 100,
        backoff: 'linear',
      },
    });
    // #endregion options-retryOptions
  });

  it('options: fetch', async () => {
    // #region options-fetch
    await Provider.create(FUEL_NETWORK_URL, {
      fetch: async (url: string, requestInit: RequestInit | undefined) => {
        // do something
        await sleep(100);

        // native fetch
        const response = await fetch(url, requestInit);

        const updatedResponse = decorateResponseWithCustomLogic(response);

        return updatedResponse;
      },
    });
    // #endregion options-fetch
  });

  it('options: cacheUtxo', async () => {
    // #region options-cache-utxo
    const provider = await Provider.create(FUEL_NETWORK_URL, {
      cacheUtxo: 5000, // cache UTXO for 5 seconds
    });
    // #endregion options-cache-utxo

    expect(provider).toBeDefined();
  });

  it('fetches the base asset ID', async () => {
    const recipientAddress = Address.fromRandom();

    // #region provider-getBaseAssetId
    // #import { Provider, FUEL_NETWORK_URL, ScriptTransactionRequest };

    // Fetch the base asset ID using the provider
    const provider = await Provider.create(FUEL_NETWORK_URL);
    const baseAssetId = provider.getBaseAssetId();
    // 0x...

    // Create a transaction request
    const transactionRequest = new ScriptTransactionRequest();
    // Use the base asset for an operation
    transactionRequest.addCoinOutput(recipientAddress, 100, baseAssetId);
    // #endregion provider-getBaseAssetId

    expect(baseAssetId).toBeDefined();
  });

  it('using operations', async () => {
    // #region operations
    const provider = await Provider.create(FUEL_NETWORK_URL);

    const chain = await provider.operations.getChain();
    const nodeInfo = await provider.operations.getNodeInfo();
    // #endregion operations

    expect(chain).toBeDefined();
    expect(nodeInfo).toBeDefined();
  });
});
