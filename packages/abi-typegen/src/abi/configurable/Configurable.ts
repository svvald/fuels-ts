import type { IType } from '../../types/interfaces/IType';
import type { Configurable } from '../../types/interfaces/JsonAbi';
import { findType } from '../../utils/findType';

export class AbiConfigurable {
  public name: string;
  public type: IType;
  public rawAbiConfigurable: Configurable;

  constructor(params: { types: IType[]; rawAbiConfigurable: Configurable }) {
    const { types, rawAbiConfigurable } = params;

    this.name = rawAbiConfigurable.name;
    this.rawAbiConfigurable = rawAbiConfigurable;
    this.type = findType({ types, typeId: rawAbiConfigurable.configurableType.type });
  }
}
