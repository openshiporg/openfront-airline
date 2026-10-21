import type { NextApiRequest, NextApiResponse } from 'next'
import { GraphQLError } from 'graphql'
import { createYoga, type Plugin } from 'graphql-yoga'
import processRequest from 'graphql-upload/processRequest.js'

import { keystoneContext } from '../../features/keystone/context'
import { sensitiveAuthenticationAccounts } from '../../features/keystone/lib/graphql-auth-rate-limit'
import { maskGraphqlError } from '../../features/keystone/lib/graphql-error-mask'
import { graphqlDepthLimitRule } from '../../features/keystone/lib/graphql-security'
import { durableRequestFingerprint } from '../../features/keystone/lib/request-identity'
import { consumeDurableRateLimit } from '../../features/keystone/lib/rate-limit'

export const config = {
  api: {
    bodyParser: false,
  },
}

const depthLimitPlugin: Plugin = {
  onValidate({ addValidationRule }) {
    addValidationRule(graphqlDepthLimitRule)
  },
}

const authRateLimitPlugin: Plugin = {
  async onExecute({ args }) {
    const accounts = sensitiveAuthenticationAccounts(args.document, args.variableValues)
    if (!accounts.length) return
    if (accounts.length > 1) throw new GraphQLError('Send one sign-in or password-reset operation per request.', { extensions: { code: 'BAD_USER_INPUT' } })
    const request = (args.contextValue as any)?.req ?? {}
    // Dashboard sign-in reaches this endpoint as a server-side self-call, so a network-only key would put every
    // operator in one bucket. Keying on the target account too keeps guessing bounded without a global lockout.
    await consumeDurableRateLimit(keystoneContext.prisma, 'graphql.authentication', durableRequestFingerprint(request, accounts[0]), 8, 15 * 60_000)
  },
}

const yoga = createYoga({
  graphqlEndpoint: '/api/graphql',
  schema: keystoneContext.graphql.schema,
  context: ({ req, res }: { req: NextApiRequest; res: NextApiResponse }) =>
    keystoneContext.withRequest(req, res),
  graphiql: process.env.NODE_ENV !== 'production',
  // The same masking in every environment: deliberate DomainErrors keep their message and code, anything else is
  // hidden behind a logged correlation ID.
  maskedErrors: { maskError: maskGraphqlError },
  multipart: false,
  plugins: [depthLimitPlugin, authRateLimitPlugin],
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const contentType = req.headers['content-type']
  if (contentType?.startsWith('multipart/form-data')) {
    req.body = await processRequest(req, res, {
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  }

  return yoga(req, res)
}
