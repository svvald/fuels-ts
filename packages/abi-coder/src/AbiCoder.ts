import { ResolvedAbiType } from './ResolvedAbiType';
import type { DecodedValue, InputValue, Coder } from './encoding/coders/AbstractCoder';
import { getCoderForEncoding } from './encoding/strategies/getCoderForEncoding';
import type { EncodingOptions } from './types/EncodingOptions';
import type { JsonAbi } from './types/JsonAbi';

export abstract class AbiCoder {
  static getCoder(
    abi: JsonAbi,
    concreteTypeId: string,
    options: EncodingOptions = {
      padToWordSize: false,
    }
  ): Coder {
    const concreteType = // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      abi.concreteTypes.find((ct) => ct.concreteTypeId === concreteTypeId)!;
    const resolvedAbiType = new ResolvedAbiType(abi, concreteType, '');
    return getCoderForEncoding(options.encoding)(resolvedAbiType, options);
  }

  static encode(
    abi: JsonAbi,
    concreteTypeId: string,
    value: InputValue,
    options?: EncodingOptions
  ) {
    return this.getCoder(abi, concreteTypeId, options).encode(value);
  }

  static decode(
    abi: JsonAbi,
    concreteTypeId: string,
    data: Uint8Array,
    offset: number,
    options?: EncodingOptions
  ): [DecodedValue | undefined, number] {
    return this.getCoder(abi, concreteTypeId, options).decode(data, offset) as [
      DecodedValue | undefined,
      number,
    ];
  }
}
