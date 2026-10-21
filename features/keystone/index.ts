import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { resolveSessionSecret } from "./lib/session";
import { hasFreshPermission } from "./access";
import { permissionsList } from "./models/fields";
import { initialOperatorSetupEnabled } from './lib/initial-operator-setup';

const isProduction = process.env.NODE_ENV === 'production'

function productionValue(name: string, developmentFallback: string) {
  const value = process.env[name]?.trim()
  if (value) return value
  if (isProduction) throw new Error(`${name} is required in production.`)
  return developmentFallback
}

const databaseURL = productionValue('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/openfront_airline')

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: resolveSessionSecret(),
};

const bucketName = productionValue('S3_BUCKET_NAME', 'keystone-test')
const region = productionValue('S3_REGION', 'us-east-1')
const accessKeyId = productionValue('S3_ACCESS_KEY_ID', 'keystone')
const secretAccessKey = productionValue('S3_SECRET_ACCESS_KEY', 'keystone')
const endpoint = productionValue('S3_ENDPOINT', 'http://localhost:9000')

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  // Ecommerce/Restaurant expose Keystone's normal empty-database init flow.
  // Airline keeps parity in development and requires an explicit, temporary
  // owner-approved flag in production. Keystone itself permits this mutation
  // only while no User exists; retained-account recovery still uses reset.
  initFirstItem: initialOperatorSetupEnabled() ? {
    fields: ["name", "email", "password"],
    itemData: {
      carrier: {
        create: {
          name: process.env.INITIAL_CARRIER_NAME || "Avante Air",
          legalName: process.env.INITIAL_CARRIER_LEGAL_NAME || "Avante Air LLC",
          code: process.env.INITIAL_CARRIER_CODE || "AV",
          defaultCurrencyCode: process.env.INITIAL_CURRENCY_CODE || "USD",
          defaultTimezone: process.env.INITIAL_TIMEZONE || "America/New_York",
          status: 'active',
          directSalesEnabled: false,
        },
      },
      role: {
        create: {
          name: "Initial Carrier Administrator",
          ...Object.fromEntries(permissionsList.map(permission => [permission, true])),
        },
      },
    },
  } : undefined,
  passwordResetLink: {
    async sendToken(args) {
      const recipient = await args.context.prisma.user.findUnique({
        where: { id: String(args.itemId) },
        select: { carrier: { select: { name: true } } },
      })
      await sendPasswordResetEmail(args.token, args.identity, { carrierName: recipient?.carrier?.name });
    },
  },
  sessionData: `
    id
    name
    email
    carrier { id code name legalName }
    approvedAgent { id status }
    role { id name ${permissionsList.join(" ")} }
  `,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: databaseURL,
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5000 },
        forcePathStyle: true,
      },
    },
    ui: {
      isAccessAllowed: context => hasFreshPermission({ session: context.session as any, context }, 'canAccessDashboard'),
    },
    session: statelessSessions(sessionConfig),
    graphql: {
      extendGraphqlSchema,
    },
  })
);