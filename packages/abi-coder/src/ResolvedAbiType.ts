import { FuelError, ErrorCode } from '@fuel-ts/errors';

import type { Component, ConcreteType, JsonAbi, TypeArgument } from './types/JsonAbi';
import { arrayRegEx, enumRegEx, genericRegEx, stringRegEx, structRegEx } from './utils/constants';

export class ResolvedAbiType {
  readonly abi: JsonAbi;
  readonly name: string;
  readonly type: string;
  readonly originalTypeArguments: readonly string[] | undefined;
  readonly components: readonly ResolvedAbiType[] | undefined;

  constructor(abi: JsonAbi, abiType: ConcreteType | TypeArgument, name: string) {
    this.abi = abi;
    this.name = name;

    if ('concreteTypeId' in abiType) {
      // it's a concrete type

      const concreteType = abiType;

      this.type = concreteType.type;
      if (concreteType.metadataTypeId) {
        this.originalTypeArguments = concreteType.typeArguments;

        if (concreteType.typeArguments && concreteType.typeArguments.length > 256) {
          throw new FuelError(
            ErrorCode.INVALID_COMPONENT,
            `The provided ABI type is too long: ${concreteType.type}.`
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const metadataType = this.abi.typeMetadata.find(
          (tm) => tm.metadataTypeId === concreteType.metadataTypeId
        )!;

        this.type = metadataType.type;

        this.components = ResolvedAbiType.getResolvedGenericComponents(
          abi,
          concreteType.typeArguments,
          metadataType.components,
          metadataType.typeParameters ??
            ResolvedAbiType.getImplicitGenericTypeParameters(abi, metadataType.components)
        );
      }
    } else {
      // it's a type argument

      const typeArgument = abiType;

      if (typeof typeArgument.typeId === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const concreteType = abi.concreteTypes.find(
          (x) => x.concreteTypeId === typeArgument.typeId
        )!;
        this.type = concreteType.type;
        if (concreteType.metadataTypeId) {
          this.originalTypeArguments = concreteType.typeArguments;

          if (concreteType.typeArguments && concreteType.typeArguments.length > 256) {
            throw new FuelError(
              ErrorCode.INVALID_COMPONENT,
              `The provided ABI type is too long: ${concreteType.type}.`
            );
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const metadataType = this.abi.typeMetadata.find(
            (tm) => tm.metadataTypeId === concreteType.metadataTypeId
          )!;

          this.type = metadataType.type;

          this.components = ResolvedAbiType.getResolvedGenericComponents(
            abi,
            concreteType.typeArguments,
            metadataType.components,
            metadataType.typeParameters ??
              ResolvedAbiType.getImplicitGenericTypeParameters(abi, metadataType.components)
          );
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const metadataType = abi.typeMetadata.find(
          (tm) => tm.metadataTypeId === typeArgument.typeId
        )!;

        this.type = metadataType?.type;

        this.components = ResolvedAbiType.getResolvedGenericComponents(
          abi,
          typeArgument.typeArguments,
          metadataType.components,
          metadataType.typeParameters ??
            ResolvedAbiType.getImplicitGenericTypeParameters(abi, metadataType.components)
        );
      }
    }
  }

  private static getResolvedGenericComponents(
    abi: JsonAbi,
    typeArguments: readonly string[] | readonly TypeArgument[] | undefined,
    components: readonly Component[] | undefined,
    typeParameters: readonly number[] | undefined
  ) {
    if (components === undefined) {
      return undefined;
    }
    if (typeParameters === undefined || typeParameters.length === 0) {
      return components.map((c) => new ResolvedAbiType(abi, c, c.name));
    }

    const typeParametersAndArgsMap = typeParameters.reduce(
      (obj, typeParameter, typeParameterIndex) => {
        const o: Record<string, string> = { ...obj };
        o[typeParameter.toString()] = structuredClone(
          typeArguments?.[typeParameterIndex]
        ) as string;
        return o;
      },
      {} as Record<string, string>
    );

    const resolvedArgs = this.resolveGenericArgTypes(abi, components, typeParametersAndArgsMap);

    return resolvedArgs.map((c) => new ResolvedAbiType(abi, c, (c as Component).name ?? ''));
  }

  private static resolveGenericArgTypes(
    abi: JsonAbi,
    args: readonly TypeArgument[],
    typeParametersAndArgsMap: Record<string, string>
  ): TypeArgument[] {
    return args.map((arg) => {
      if (typeParametersAndArgsMap[arg.typeId] !== undefined) {
        return {
          ...arg,
          typeId: typeParametersAndArgsMap[arg.typeId],
          name: (arg as Component).name,
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

      if (typeof arg.typeId === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const metadataType = abi.typeMetadata.find((tm) => tm.metadataTypeId === arg.typeId)!;

        const implicitTypeParameters = this.getImplicitGenericTypeParameters(
          abi,
          metadataType.components
        );

        if (implicitTypeParameters && implicitTypeParameters.length > 0) {
          return {
            ...structuredClone(arg),
            typeArguments: implicitTypeParameters.map((itp) => ({
              typeId: typeParametersAndArgsMap[itp],
            })),
          };
        }
      }

      return arg;
    });
  }

  private static getImplicitGenericTypeParameters(
    abi: JsonAbi,
    args: readonly TypeArgument[] | null,
    implicitGenericParametersParam?: number[]
  ) {
    if (!Array.isArray(args)) {
      return undefined;
    }

    const implicitGenericParameters: number[] = implicitGenericParametersParam ?? [];

    args.forEach((a) => {
      const metadataType = this.getMetadataType(abi, a);
      if (metadataType === undefined) {
        return;
      }

      if (genericRegEx.test(metadataType.type)) {
        implicitGenericParameters.push(a.typeId);
        return;
      }

      if (!Array.isArray(a.typeArguments)) {
        return;
      }
      this.getImplicitGenericTypeParameters(abi, a.typeArguments, implicitGenericParameters);
    });

    return implicitGenericParameters.length > 0 ? implicitGenericParameters : undefined;
  }

  private static getMetadataType(abi: JsonAbi, a: TypeArgument) {
    if (typeof a.typeId === 'number') {
      return abi.typeMetadata.find((tm) => tm.metadataTypeId === a.typeId);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { metadataTypeId } = abi.concreteTypes.find((ct) => ct.concreteTypeId === a.typeId)!;
    return abi.typeMetadata.find((tm) => tm.metadataTypeId === metadataTypeId);
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

    if (this.components === null) {
      return this.type;
    }

    const arrayMatch = arrayRegEx.exec(this.type)?.groups;

    if (arrayMatch) {
      return `[${this.components[0].getSignature()};${arrayMatch.length}]`;
    }

    const typeArgumentsSignature =
      this.originalTypeArguments !== null
        ? `<${this.originalTypeArguments
            .map((a) => new ResolvedAbiType(this.abi, a).getSignature())
            .join(',')}>`
        : '';

    const componentsSignature = `(${this.components.map((c) => c.getSignature()).join(',')})`;

    return `${typeArgumentsSignature}${componentsSignature}`;
  }
}
