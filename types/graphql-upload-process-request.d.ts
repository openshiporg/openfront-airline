// Runtime graphql-upload is 15.x (CommonJS processRequest.js), while @types/graphql-upload 17.x only declares the
// .mjs entry points. This mirrors the installed parser's own JSDoc contract (`@callback ProcessRequestFunction` and
// `@typedef ProcessRequestOptions` in node_modules/graphql-upload/processRequest.js) and its `module.exports`.
declare module 'graphql-upload/processRequest.js' {
  import type { IncomingMessage, ServerResponse } from 'node:http'

  namespace processRequest {
    type ProcessRequestOptions = {
      maxFieldSize?: number
      maxFileSize?: number
      maxFiles?: number
    }
  }

  function processRequest(
    request: IncomingMessage,
    response: ServerResponse,
    options?: processRequest.ProcessRequestOptions,
  ): Promise<{ [key: string]: unknown } | Array<{ [key: string]: unknown }>>

  export = processRequest
}
