/**
 * Types for Fuel JSON ABI Format as defined on:
 * https://github.com/FuelLabs/fuel-specs/blob/master/src/abi/json-abi-format.md
 */
export interface JsonAbi {
  readonly types: readonly JsonAbiType[];
  readonly loggedTypes: readonly JsonAbiLoggedType[];
  readonly functions: readonly JsonAbiFunction[];
  readonly messagesTypes: readonly JsonAbiMessagesType[];
  readonly configurables: readonly JsonAbiConfigurable[];
  readonly encodingVersion: string;
}

export interface JsonAbi2 {
  specVersion: string;
  encodingVersion: string;
  programType: 'script' | 'contract' | 'predicate' | 'library';
  concreteTypes: readonly ConcreteType[];
  typeMetadata: readonly TypeMetadata[];
  functions: readonly AbiFunction[];
  loggedTypes: readonly LoggedType[];
  messageTypes: readonly MessageType[];
}

export interface ConcreteType {
  type: string;
  concreteTypeId: string;
  metadataTypeId?: number;
  typeArguments?: readonly string[];
}

export interface TypeMetadata {
  type: string;
  metadataTypeId: number;
  components: readonly Component[];
  typeParameters?: readonly number[];
}

export interface Component extends TypeArgument {
  name: string;
}

export interface TypeArgument {
  typeId: string; // the type metadata declaration ID or type concrete declaration hash based ID of the type of the component.
  typeArguments?: TypeArgument[];
}

export interface AbiFunction {
  name: string;
  inputs: readonly AbiFunctionInput[];
  output: string;
  attributes?: readonly AbiFunctionAttribute[];
}

export interface AbiFunctionInput {
  name: string;
  concreteTypeId: string;
}

export type AbiFunctionAttribute = Storage | Payable | Test | Inline | DocComment | Doc;

interface Payable {
  name: 'payable';
}
interface Storage {
  name: 'storage';
  arguments: readonly ('read' | 'write')[];
}
interface Test {
  name: 'test';
}
interface Inline {
  name: 'inline';
  arguments: 'never' | 'always';
}
interface DocComment {
  name: 'doc-comment';
  arguments: string;
}
interface Doc {
  name: 'doc';
}

export interface LoggedType {
  logId: string;
  loggedType: string; // the _type concrete declaration_ hash based ID of the value being logged.
}

export interface MessageType {
  message_id: string;
  messageDataType: string;
}
export interface Configurable {
  name: string;
  configurableType: string;
  offset: number;
}

export interface JsonAbiType {
  readonly typeId: number;
  readonly type: string;
  readonly components: readonly JsonAbiArgument[] | null;
  readonly typeParameters: readonly number[] | null;
}

export interface JsonAbiArgument {
  readonly type: number;
  readonly name: string;
  readonly typeArguments: readonly JsonAbiArgument[] | null;
}

export interface JsonAbiArgumentWithoutName {
  readonly type: number;
  readonly typeArguments: readonly JsonAbiArgumentWithoutName[] | null;
}

export interface JsonAbiLoggedType {
  readonly logId: string;
  readonly loggedType: JsonAbiArgument;
}

export interface JsonAbiMessagesType {
  readonly messageDataType: JsonAbiArgumentWithoutName;
}

export interface JsonAbiFunction {
  readonly name: string;
  readonly inputs: readonly JsonAbiArgument[];
  readonly output: JsonAbiArgument;
  readonly attributes: readonly JsonAbiFunctionAttribute[] | null;
}

export interface JsonAbiFunctionAttribute {
  readonly name: string;
  readonly arguments: ReadonlyArray<string>;
}

export interface JsonAbiConfigurable {
  name: string;
  configurableType: JsonAbiArgument;
  offset: number;
}
