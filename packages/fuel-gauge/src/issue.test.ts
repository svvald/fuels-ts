import { generateTestWallet } from '@fuel-ts/account/test-utils';
import { FUEL_NETWORK_URL, Provider } from 'fuels';

import { FuelGaugeProjectsEnum, getFuelGaugeForcProject } from '../test/fixtures';

import { setup } from './utils';

describe('option', () => {
  it('1', async () => {
    const { abiContents, binHexlified } = getFuelGaugeForcProject(FuelGaugeProjectsEnum.CONTRACT);
    const provider = await Provider.create(FUEL_NETWORK_URL);
    const baseAssetId = provider.getBaseAssetId();
    const wallet = await generateTestWallet(provider, [[500_000, baseAssetId]]);
    const contract = await setup({
      abi: abiContents,
      contractBytecode: binHexlified,
    });
    contract.account = wallet;

    // THIS ONE DOES NOT WORKS
    const { value } = await contract.functions
      .get_player({ Address: { bits: wallet.address.toB256() } })
      .call();

    // THIS ONE WORKS
    // const { value } = await contract.functions.get_decimal({ bits: baseAssetId }).call();

    console.log(value);
    expect(2).toBe(2);
  });
});
