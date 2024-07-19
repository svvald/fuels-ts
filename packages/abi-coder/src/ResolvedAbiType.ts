import { FuelError, ErrorCode } from '@fuel-ts/errors';

import type { Component, ConcreteType, JsonAbi, TypeArgument, MetadataType } from './types/JsonAbi';
import { arrayRegEx, enumRegEx, genericRegEx, stringRegEx, structRegEx } from './utils/constants';

export class ResolvedAbiType {
  readonly type: string;
  readonly originalTypeArguments: ConcreteType['typeArguments'] | TypeArgument['typeArguments'];
  readonly components: readonly ResolvedAbiType[] | undefined;

  constructor(
    readonly abi: JsonAbi,
    abiType: ConcreteType | TypeArgument,
    readonly name: string | undefined
  ) {
    this.abi = abi;

    const { type, components, originalTypeArguments } =
      'concreteTypeId' in abiType
        ? ResolvedAbiType.getResolvedConcreteType(abi, abiType)
        : ResolvedAbiType.getResolvedTypeArgument(abi, abiType);

    this.type = type;
    this.components = components;
    this.originalTypeArguments = originalTypeArguments;
  }

  private static getResolvedConcreteType(
    abi: JsonAbi,
    concreteType: ConcreteType
  ): Pick<ResolvedAbiType, 'components' | 'type' | 'originalTypeArguments'> {
    const metadataType = this.getMetadataType(abi, concreteType);

    const type = metadataType?.type ?? concreteType.type;
    const originalTypeArguments = concreteType.typeArguments;

    if (!metadataType) {
      return { type, originalTypeArguments, components: undefined };
    }

    if (originalTypeArguments && originalTypeArguments.length > 256) {
      throw new FuelError(
        ErrorCode.INVALID_COMPONENT,
        `The provided ABI type is too long: ${concreteType.type}.`
      );
    }

    const components = ResolvedAbiType.getResolvedGenericComponents(
      abi,
      concreteType.typeArguments,
      metadataType
    );

    return {
      type,
      originalTypeArguments,
      components,
    };
  }

  private static getResolvedTypeArgument(
    abi: JsonAbi,
    typeArgument: TypeArgument
  ): Pick<ResolvedAbiType, 'components' | 'type' | 'originalTypeArguments'> {
    if (typeof typeArgument.typeId === 'string') {
      const concreteType = abi.concreteTypes.find(
        (x) => x.concreteTypeId === typeArgument.typeId
      ) as ConcreteType;

      return ResolvedAbiType.getResolvedConcreteType(abi, concreteType);
    }

    const metadataType = this.getMetadataType(abi, typeArgument) as MetadataType;

    const components = ResolvedAbiType.getResolvedGenericComponents(
      abi,
      typeArgument.typeArguments,
      metadataType
    );
    return {
      type: metadataType.type,
      originalTypeArguments: typeArgument.typeArguments,
      components,
    };
  }

  private static getResolvedGenericComponents(
    abi: JsonAbi,
    typeArguments: ConcreteType['typeArguments'] | TypeArgument['typeArguments'],
    metadataType: MetadataType
  ) {
    if (metadataType.components === undefined) {
      return undefined;
    }

    const typeParameters =
      metadataType.typeParameters ??
      ResolvedAbiType.getImplicitGenericTypeParameters(abi, metadataType.components);

    if (typeParameters === undefined || typeParameters.length === 0) {
      return metadataType.components.map((c) => new ResolvedAbiType(abi, c, c.name));
    }

    const typeParametersAndArgsMap = typeParameters.reduce(
      (obj, typeParameter, typeParameterIndex) => ({
        ...obj,
        [typeParameter]: structuredClone(typeArguments?.[typeParameterIndex]),
      }),
      {} satisfies Record<number, string | TypeArgument>
    );

    const resolvedArgs = this.resolveGenericArgTypes(
      abi,
      metadataType.components,
      typeParametersAndArgsMap
    );

    return resolvedArgs.map((c) => new ResolvedAbiType(abi, c, (c as Component).name));
  }

  private static resolveGenericArgTypes(
    abi: JsonAbi,
    args: NonNullable<MetadataType['components'] | TypeArgument['typeArguments']>,
    typeParametersAndArgsMap: Record<number, string | TypeArgument>
  ): NonNullable<TypeArgument['typeArguments']> {
    return args.map((arg) => {
      const mappedArg = typeParametersAndArgsMap[+arg.typeId];
      if (mappedArg !== undefined) {
        const name = (arg as Component).name;
        return typeof mappedArg === 'string'
          ? {
              typeId: mappedArg,
              name,
            }
          : {
              ...mappedArg,
              name,
            };
      }

      if (arg.typeArguments) {
        return {
          ...structuredClone(arg),
          typeArguments: this.resolveGenericArgTypes(
            abi,
            arg.typeArguments,
            typeParametersAndArgsMap
          ),
        };
      }

      const metadataType = this.getMetadataType(abi, arg);

      if (metadataType) {
        const implicitTypeParameters = this.getImplicitGenericTypeParameters(
          abi,
          metadataType.components
        );

        if (implicitTypeParameters.length > 0) {
          return {
            ...structuredClone(arg),
            typeArguments: implicitTypeParameters.map((itp) => {
              const implicitMappedArg = typeParametersAndArgsMap[itp];
              return typeof implicitMappedArg === 'string'
                ? {
                    typeId: implicitMappedArg,
                  }
                : implicitMappedArg;
            }),
          };
        }
      }

      return arg;
    });
  }

  private static getImplicitGenericTypeParameters(
    abi: JsonAbi,
    args: TypeArgument['typeArguments'],
    implicitGenericParameters: number[] = []
  ) {
    (args ?? []).forEach((arg) => {
      const metadataType = this.getMetadataType(abi, arg);
      if (metadataType === undefined) {
        return;
      }

      if (genericRegEx.test(metadataType.type)) {
        implicitGenericParameters.push(metadataType.metadataTypeId);
        return;
      }

      if (!Array.isArray(arg.typeArguments)) {
        return;
      }
      this.getImplicitGenericTypeParameters(abi, arg.typeArguments, implicitGenericParameters);
    });

    return implicitGenericParameters;
  }

  private static getMetadataType(abi: JsonAbi, type: ConcreteType | TypeArgument) {
    const typeId = 'concreteTypeId' in type ? type.concreteTypeId : type.typeId;

    if (typeof typeId === 'number') {
      return abi.typesMetadata.find((tm) => tm.metadataTypeId === typeId);
    }
    const concreteType = abi.concreteTypes.find(
      (ct) => ct.concreteTypeId === typeId
    ) as ConcreteType;

    return abi.typesMetadata.find((tm) => tm.metadataTypeId === concreteType.metadataTypeId);
  }

  getSignature(): string {
    const prefix = this.getArgSignaturePrefix();
    const content = this.getArgSignatureContent();

    return `${prefix}${content}`;
  }

  private getArgSignaturePrefix(): string {
    const structMatch = structRegEx.test(this.type);
    if (structMatch) {
      return 's';
    }

    const arrayMatch = arrayRegEx.test(this.type);
    if (arrayMatch) {
      return 'a';
    }

    const enumMatch = enumRegEx.test(this.type);
    if (enumMatch) {
      return 'e';
    }

    return '';
  }

  private getArgSignatureContent(): string {
    if (this.type === 'raw untyped ptr') {
      return 'rawptr';
    }

    if (this.type === 'raw untyped slice') {
      return 'rawslice';
    }

    const strMatch = stringRegEx.exec(this.type)?.groups;
    if (strMatch) {
      return `str[${strMatch.length}]`;
    }

    if (this.components === undefined) {
      return this.type;
    }

    const arrayMatch = arrayRegEx.exec(this.type)?.groups;

    if (arrayMatch) {
      return `[${this.components[0].getSignature()};${arrayMatch.length}]`;
    }

    const typeArgumentsSignature =
      this.originalTypeArguments && this.originalTypeArguments?.length > 0
        ? `<${this.originalTypeArguments
            ?.map((ta) =>
              typeof ta === 'string'
                ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  this.abi.concreteTypes.find((ct) => ct.concreteTypeId === ta)!
                : ta
            )
            .map((a) => new ResolvedAbiType(this.abi, a, '').getSignature())
            .join(',')}>`
        : '';

    const componentsSignature = `(${this.components.map((c) => c.getSignature()).join(',')})`;

    return `${typeArgumentsSignature}${componentsSignature}`;
  }
}
