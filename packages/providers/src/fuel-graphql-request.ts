/* 

  Replaces `graphql-request` and `graphql-tag` dependencies with a simple
  `fetch` implementation, reducing the final bundle size by 15.68 kB.

  More:
    https://github.com/FuelLabs/fuels-ts/discussions/1592#discussioncomment-8003515

*/

import { FuelError } from '@fuel-ts/errors';
import type { DocumentNode } from 'graphql';
import { print } from 'graphql';

function isSubscription({ definitions: defs }: DocumentNode) {
  const opDef = defs.find((op) => op.kind === 'OperationDefinition');

  if (opDef && 'operation' in opDef) {
    return opDef?.operation === 'subscription';
  }

  return false;
}

class FuelGraphqlSubscriber implements AsyncIterator<unknown> {
  private stream!: ReadableStreamDefaultReader<Uint8Array>;
  private static textDecoder = new TextDecoder();

  public constructor(
    private options: {
      url: string;
      request: RequestInit;
      fetchFn: typeof fetch;
    }
  ) {}

  private async setStream() {
    const { url, request, fetchFn } = this.options;
    const response = await fetchFn(`${url}-sub`, {
      ...request,
      headers: {
        ...request.headers,
        Accept: 'text/event-stream',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.stream = response.body!.getReader();
  }

  private async readUntilFullMessage(
    incompleteMessage?: string
  ): Promise<IteratorResult<string, string | undefined>> {
    const { value, done } = await this.stream.read();

    if (done) {
      return { value, done };
    }

    const message = (incompleteMessage ?? '') + FuelGraphqlSubscriber.textDecoder.decode(value);

    // https://github.com/FuelLabs/fuel-core/blob/e1e631902f762081d2124d9c457ddfe13ac366dc/crates/fuel-core/src/graphql_api/service.rs#L247
    if (message === 'keep-alive-text') {
      return { value: message, done };
    }

    if (message.endsWith('\n\n')) {
      return { value: message, done };
    }

    return this.readUntilFullMessage(message);
  }

  private async readStream(): Promise<IteratorResult<unknown, unknown>> {
    const { value, done } = await this.readUntilFullMessage();

    if (value === undefined) {
      return { value: undefined, done };
    }

    const { data, errors } = JSON.parse(value.split('data:')[1]);

    if (Array.isArray(errors)) {
      throw new FuelError(
        FuelError.CODES.INVALID_REQUEST,
        errors.map((err) => err.message).join('\n\n')
      );
    }

    return { value: data, done };
  }

  async next(): Promise<IteratorResult<unknown, unknown>> {
    if (!this.stream) {
      await this.setStream();
    }

    const { value, done } = await this.readStream();
    if (value instanceof FuelError) {
      throw value;
    }

    return { value, done };
  }

  /**
   * Gets called when `break` is called in a `for-await-of` loop.
   */
  async return(): Promise<IteratorResult<unknown, undefined>> {
    await this.stream.cancel();
    this.stream.releaseLock();
    return { done: true, value: undefined };
  }

  [Symbol.asyncIterator](): AsyncIterator<unknown, unknown, undefined> {
    return this;
  }
}

async function handleQueryAndMutation(fetchFn: typeof fetch, url: string, request: RequestInit) {
  const response = await fetchFn(url, request);

  const { data, errors } = await response.json();

  if (Array.isArray(errors)) {
    throw new FuelError(
      FuelError.CODES.INVALID_REQUEST,
      errors.map((err) => err.message).join('\n\n')
    );
  }

  return data;
}

export function fuelGraphQLRequest(
  fetchFn: typeof fetch,
  url: string,
  operation: DocumentNode,
  variables: Record<string, unknown>
) {
  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: print(operation), variables }),
  };

  if (isSubscription(operation)) {
    return new FuelGraphqlSubscriber({
      fetchFn,
      url,
      request,
    });
  }

  return handleQueryAndMutation(fetchFn, url, request);
}
