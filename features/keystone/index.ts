import { s3ForcePathStyle } from "./lib/s3-storage";
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
import { anonymousIntrospectionGuard } from './lib/anonymous-introspection';

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
  // Keystone's normal empty-database init flow, as in E-commerce: it is permitted only while no User exists.
  initFirstItem: initialOperatorSetupEnabled() ? {
    fields: ["name", "email", "password"],
    // The carrier and role are attached by the User resolveInput hook, in one transaction, only for valid details.
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
        forcePathStyle: s3ForcePathStyle(endpoint),
      },
    },
    ui: {
      isAccessAllowed: context => hasFreshPermission({ session: context.session as any, context }, 'canAccessDashboard'),
    },
    session: statelessSessions(sessionConfig),
    graphql: {
      extendGraphqlSchema,
      apolloConfig: { plugins: [anonymousIntrospectionGuard] },
    },
  })
);