import { FuelGaugeProjectsEnum, getFuelGaugeForcProject } from '../test/fixtures';

import { setup } from './utils';

test('sets and reads metadata for an nft contract', async () => {
  const { abiContents, binHexlified } = getFuelGaugeForcProject(
    FuelGaugeProjectsEnum.SRC7_METADATA_TEST
  );

  const contract = await setup({
    contractBytecode: binHexlified,
    abi: abiContents,
    cache: false,
  });

  const metadata = {
    String: 'https://bafkreidhmmldn6o5nxyfqf65x5jz7f66qcj4xy2axv2onefkzdbv4i7yta.ipfs.w3s.link',
  };
  const id = {
    value: '0x36e2674c59665fc43a11546ef95054da5fab342b94ffb1a430246b59cef17e12',
  };

  await contract.functions.set_metadata(id, 0, metadata).call();

  const { value, logs } = await contract.functions.metadata(id, 0).call();

  console.log({
    value,
    logs,
  });
});
