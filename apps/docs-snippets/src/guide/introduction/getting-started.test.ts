import { TESTNET_NETWORK_URL, Provider, Wallet, WalletUnlocked } from 'fuels';
import { launchTestNode } from 'fuels/test-utils';

/**
 * @group node
 * @group browser
 */
describe('Getting started', () => {
  it('can connect to a local network', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    using launched = await launchTestNode({
      nodeOptions: { port: '4000' },
    });
    // #region connecting-to-the-local-node
    // #import { Provider, Wallet };

    // Create a provider.
    const LOCAL_FUEL_NETWORK = `http://127.0.0.1:4000/v1/graphql`;
    const provider = await Provider.create(LOCAL_FUEL_NETWORK);

    // Create our wallet (with a private key).
    const PRIVATE_KEY = 'a1447cd75accc6b71a976fd3401a1f6ce318d27ba660b0315ee6ac347bf39568';
    const wallet = Wallet.fromPrivateKey(PRIVATE_KEY, provider);
    // #endregion connecting-to-the-local-node

    expect(provider).toBeTruthy();
    expect(provider).toBeInstanceOf(Provider);
    expect(wallet).toBeTruthy();
    expect(wallet).toBeInstanceOf(WalletUnlocked);
  });

  it('can connect to testnet', async () => {
    // #region connecting-to-the-testnet
    // #import { Provider, Wallet, TESTNET_NETWORK_URL };

    // Create a provider, with the Latest Testnet URL.
    const provider = await Provider.create(TESTNET_NETWORK_URL);

    // Create our wallet (with a private key).
    const PRIVATE_KEY = 'a1447cd75accc6b71a976fd3401a1f6ce318d27ba660b0315ee6ac347bf39568';
    const wallet = Wallet.fromPrivateKey(PRIVATE_KEY, provider);

    // Perform a balance check.
    const { balances } = await wallet.getBalances();
    // [{ assetId: '0x..', amount: bn(..) }, ..]
    // #endregion connecting-to-the-testnet

    expect(balances).toBeTruthy();
    expect(balances).toBeInstanceOf(Array);
  });
});
