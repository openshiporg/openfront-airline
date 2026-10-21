# Openfront Airline

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-airline&env=DATABASE_URL%2CSESSION_SECRET%2CS3_BUCKET_NAME%2CS3_REGION%2CS3_ACCESS_KEY_ID%2CS3_SECRET_ACCESS_KEY)

Openfront Airline is a self-hostable airline retailing and passenger-service application. Customers can explore flight options and manage bookings, while airline teams manage network schedules, dated flights, inventory, offers, passengers, departures, payments, and disruption recovery.

## Demo

Explore the application locally using the setup instructions below.

| | |
|---|---|
| **Public application** | `/` on your development URL |
| **Dashboard** | `/dashboard` on your development URL |

[Learn more →](https://openship.org/products/openfront-airline)

[Documentation →](https://docs.openship.org/docs/openfront/airline/)

## The Openfront Ecosystem

Openfront is part of an ecosystem of open-source commerce tools:

- **[Openfront E-commerce](https://github.com/openshiporg/openfront)**: Headless e-commerce for retail.
- **[Openfront Restaurant](https://github.com/openshiporg/openfront-restaurant)**: Restaurant ordering, point of sale, and kitchen operations.
- **[Openship](https://github.com/openshiporg/openship)**: Order routing for multi-channel fulfillment.
- **Openfront Airline**: (This repository) a self-hostable airline retailing and passenger-service application.

## Core Features

### Admin Dashboard
Manage settings, offers, disruptions, payments, bookings, store settings, departures, schedules, passengers, inventory, manifests through dedicated dashboard workspaces and permission-controlled data screens.

### Storefront
Public pages include flight discovery, `/manage-booking`, `/manage`, `/check-in`, and `/status`. Customer booking operations use a record locator together with a private access token.

### Offers, Inventory & Booking
Configure routes, schedules, dated flights, cabins, fare brands, rules, ancillaries, inventory buckets, and holds. Create offers and bookings with immutable booking lines.

### Passenger & Airport Operations
Maintain passengers, travel-document verification, tickets and coupons, seats, check-in, boarding passes, bags, manifests, boarding, and offloading.

### Servicing & Recovery
Record disruptions, reaccommodation, exchanges, refunds, settlement evidence, and outbox recovery. The registered payment adapter is manual reconciliation, not a live card-acquiring or global distribution connection.

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 with App Router and React 19.
- **Backend**: KeystoneJS 6 with a GraphQL API.
- **Database**: PostgreSQL with Prisma ORM.
- **Styling**: Tailwind CSS 4 and shared shadcn/ui components.
- **Authentication**: Password-based user accounts and session-based access with role capabilities.

### Application Structure
```text
openfront-airline/
├── app/                    # Public pages, dashboard routes, and HTTP endpoints
├── features/
│   ├── keystone/           # Backend models, access rules, and GraphQL workflows
│   ├── platform/           # Operator workspaces and onboarding
│   ├── storefront/         # Public application components and screens
│   └── dashboard/          # Authentication and shared dashboard shell
└── components/             # Shared UI components
```

### Data Models
The [model registry](features/keystone/models/index.ts) and [Prisma schema](schema.prisma) cover:

- Carriers, airports, stations, agents, routes, schedules, and flight instances.
- Cabins, inventory, fares, ancillaries, offers, holds, bookings, and journeys.
- Passengers, documents, tickets, coupons, seats, check-in, boarding, and baggage.
- Payments, reconciliation, exchanges, refunds, disruptions, provider records, credentials, audit events, and outbox.

## Getting Started

### Prerequisites
- Node.js 22, compatible with the [package requirements](package.json) and Next.js 16.
- A PostgreSQL database you can migrate.
- npm.

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/openshiporg/openfront-airline.git
   cd openfront-airline
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Review the [example configuration](.env.example) and replace its placeholders. Keep only the local settings you need; do not copy production-mode or infrastructure examples unchanged.

   ```env
   DATABASE_URL=postgresql://user:password@host/database
   SESSION_SECRET=replace-with-a-new-private-random-secret
   ```

   Generate the session secret with `openssl rand -hex 32`; use the generated value, not the placeholder. Never commit `.env`.

   Review [runtime configuration](features/keystone/index.ts) for additional application settings before building or deploying. Configure enabled integrations separately; the two values above are not a complete production configuration.

   Production also requires configured object storage. Set `S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`, and supply the S3-compatible endpoint described in the source. Review mail and application-specific security settings there as well.

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The development script prepares the backend schema, applies checked-in migrations, and starts Next.js.

4. **Access the application:**
   Open the URL `npm run dev` prints, then use these paths:

   - **Public application**: `/`
   - **Admin dashboard**: `/dashboard`
   - **GraphQL API**: `/api/graphql`

5. **Create your first admin user:**
   Use `/dashboard/init` only when initial operator setup is enabled, as defined in [the Keystone configuration](features/keystone/index.ts). Production setup is explicitly gated; disable initial setup again after creating the first carrier administrator.

6. **Run application onboarding:**
   Complete carrier onboarding, review network and dated-flight inventory, and configure station authority, provider records, and customer sales settings before opening direct sales.

## Development Commands

- `npm run dev` - Prepare the backend schema, apply migrations, and start Next.js development.
- `npm run build` - Build the backend and Next.js for production; does not apply migrations.
- `npm start` - Validate production runtime requirements and start the web server.
- `npm run migrate:gen` - Create migration SQL, run the migration-safety check, then apply development migrations.
- `npm run migrate` - Apply checked-in Prisma migrations.
- `npm run lint` - Run the repository's ESLint script.
- `npm run typecheck` - Run the configured TypeScript check.
- `npm run test` - Run the repository's configured test suite.
- `npm run worker` - Run the application's background worker.

Use a disposable development database for migration generation. Review the script before running it against any existing data.

### Airline Provider Integration
The [payment registry](features/integrations/payment/index.ts) includes manual reconciliation only. The [airline commands](features/keystone/mutations/index.ts) cover booking, flight provisioning, departures, customer access, disruptions, and outbox recovery. Configure specialist provider connections explicitly rather than treating ticket or payment records as external execution.

## Documentation

See the [Openfront Airline documentation](https://docs.openship.org/docs/openfront/airline/) for the application guide. The [backend models](features/keystone/models), [registered business workflows](features/keystone/mutations/index.ts), [access rules](features/keystone/access.ts), and [application routes](app) document the implementation in this repository.

## Security & Permissions

### Role-Based Access Control
- `canAccessDashboard` - Access dashboard.
- `canManageNetwork` - Manage network.
- `canManageInventory` - Manage inventory.
- `canManageBookings` - Manage bookings.
- `canManagePassengers` - Manage passengers.
- `canManageSecurePassengerData` - Manage secure passenger data.

### Security Features
- Session-based authentication for signed-in users.
- Backend list access and workflow authorization, rather than dashboard visibility alone.
- Carrier filters and current-permission checks scope operational data; station-scoped commands add local operating authority. Tenant ownership is immutable once assigned, and customer booking access is separate from operator authority.

Review the [access implementation](features/keystone/access.ts) and individual workflow checks before extending permissions.

## Platform Components

### Admin Platform (`/dashboard`)
- **Settings**: `/dashboard/platform/settings`.
- **Offers**: `/dashboard/platform/offers`.
- **Disruptions**: `/dashboard/platform/disruptions`.
- **Payments**: `/dashboard/platform/payments`.
- **Bookings**: `/dashboard/platform/bookings`.
- **Store Settings**: `/dashboard/platform/store-settings`.
- **Departures**: `/dashboard/platform/departures`.
- **Schedules**: `/dashboard/platform/schedules`.
- **Passengers**: `/dashboard/platform/passengers`.
- **Inventory**: `/dashboard/platform/inventory`.
- **Manifests**: `/dashboard/platform/manifests`.

### Storefront Experience
Public pages include flight discovery, `/manage-booking`, `/manage`, `/check-in`, and `/status`. Customer booking operations use a record locator together with a private access token.

Configure routes, schedules, dated flights, cabins, fare brands, rules, ancillaries, inventory buckets, and holds. Create offers and bookings with immutable booking lines.

## Deployment

### Production Deployment
The Vercel button imports this application's own repository. Provision PostgreSQL and configure the application's complete runtime requirements, storage, mail, and enabled providers before building. Importing the source does not configure these services or grant regulatory approval.

Build the application and apply checked-in migrations as a release step before starting the server. Back up existing data before migration.

```bash
npm run build
npm run migrate
npm start
```

The included [Railway configuration](railway.toml) defines this app's build and startup lifecycle. Provision services and secrets separately.

### Scaling Considerations
Run `npm run worker` separately for hold reaping, unpaid-booking expiry, and outbox delivery. Configure the expected worker identity and heartbeat before using production readiness checks. `npm start` validates production configuration before starting the web server.

## Contributing

Use the development commands above when preparing changes. Keep model changes and their migrations together, and describe workflow and permission changes in pull requests.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Support

- **Documentation**: [Openfront Airline guide](https://docs.openship.org/docs/openfront/airline/).
- **Issues**: [Report bugs and feature requests](https://github.com/openshiporg/openfront-airline/issues).
- **Product**: [Learn more about Openfront Airline](https://openship.org/products/openfront-airline).

---

Built with [Next.js](https://nextjs.org) and [KeystoneJS](https://keystonejs.com).
