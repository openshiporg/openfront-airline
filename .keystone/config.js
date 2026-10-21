"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core60 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/AncillaryProduct.ts
var import_core = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");

// features/keystone/models/fields.ts
var import_fields = require("@keystone-6/core/fields");
var permissionLabels = {
  canAccessDashboard: "Access the operations dashboard",
  canManageCarriers: "Manage carrier tenants and cross carrier boundaries",
  canReadUsers: "Read carrier users",
  canManageUsers: "Create and manage carrier users",
  canReadRoles: "Read carrier roles",
  canManageRoles: "Create and manage carrier roles",
  canManageAgents: "Approve and manage travel sellers",
  canReadNetwork: "Read airports, routes, schedules, and dated flights",
  canManageNetwork: "Manage routes, schedules, dated flights, cabins, and seat maps",
  canReadInventory: "Read commercial inventory and holds",
  canManageInventory: "Manage commercial inventory and holds",
  canReadOffers: "Read fares, products, and offers",
  canManageOffers: "Manage fares, products, and offers",
  canReadBookings: "Read bookings and immutable commercial lines",
  canManageBookings: "Create and service bookings",
  canReadPassengers: "Read passenger profiles",
  canManagePassengers: "Manage passenger profiles and service requests",
  canManageSecurePassengerData: "Read and manage encrypted travel-document data",
  canReadTicketing: "Read tickets, coupons, and EMDs",
  canManageTicketing: "Issue and service tickets, coupons, and EMDs",
  canReadPayments: "Read payment and refund records",
  canManagePayments: "Manage payment, refund, and exchange records",
  canReadAirportService: "Read check-in, boarding, seat, and baggage records",
  canManageAirportService: "Manage check-in, boarding, seat, and baggage records",
  canReadDisruptions: "Read disruption and reaccommodation records",
  canManageDisruptions: "Manage disruption and reaccommodation records",
  canReadIntegrations: "Read provider and webhook health records",
  canManageIntegrations: "Manage provider connections and webhooks",
  canReadAudit: "Read carrier audit events",
  canManageOnboarding: "Run carrier onboarding and runtime setup"
};
function canGrantPermission(args, permission) {
  if (args.inputData?.[permission] !== true) return true;
  if (!args.session) return true;
  const role = args.session.data?.role;
  if (role?.canManageCarriers === true) return true;
  if (permission === "canManageCarriers") return false;
  return role?.[permission] === true;
}
async function canGrantFreshPermission(args, permission) {
  if (args.inputData?.[permission] !== true || !args.session) return true;
  const userId = args.session.itemId;
  if (!userId || !args.context?.prisma) return false;
  const user = await args.context.prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { canManageCarriers: true, [permission]: true } } }
  });
  return canGrantPermission({ inputData: args.inputData, session: { data: { role: user?.role ?? null } } }, permission);
}
var permissionFields = Object.fromEntries(
  Object.entries(permissionLabels).map(([key, label]) => [
    key,
    (0, import_fields.checkbox)({
      defaultValue: false,
      label,
      access: {
        create: (args) => canGrantFreshPermission(args, key),
        update: (args) => canGrantFreshPermission(args, key)
      }
    })
  ])
);
var permissionsList = Object.keys(permissionLabels);
var immutableFieldAccess = {
  update: () => false
};
var hiddenSensitiveUi = {
  createView: { fieldMode: "hidden" },
  itemView: { fieldMode: "hidden" },
  listView: { fieldMode: "hidden" }
};

// features/keystone/access.ts
function hasPermission({ session }, permission) {
  if (!session?.data.role || !permissionsList.includes(permission)) return false;
  return session.data.role[permission] === true;
}
var permissions = Object.fromEntries(
  permissionsList.map((permission) => [
    permission,
    (args) => hasPermission(args, permission)
  ])
);
async function freshSessionActor(args) {
  if (!args.session?.itemId || args.session.listKey !== "User" || !args.context?.prisma) return null;
  return args.context.prisma.user.findUnique({
    where: { id: args.session.itemId },
    select: {
      id: true,
      carrierId: true,
      approvedAgent: { select: { id: true, status: true } },
      role: { select: Object.fromEntries(["id", "name", ...permissionsList].map((name) => [name, true])) }
    }
  });
}
function roleWithinGrantCeiling(actorRole, targetRole) {
  if (!actorRole) return false;
  if (actorRole.canManageCarriers === true) return true;
  return permissionsList.every((permission) => targetRole?.[permission] !== true || actorRole[permission] === true);
}
async function canManageTargetUser(args) {
  const actor = await freshSessionActor(args);
  const targetId = typeof args.item?.id === "string" ? args.item.id : null;
  if (!actor?.role || !targetId) return false;
  if (targetId === actor.id) return true;
  if (actor.role.canManageCarriers === true) return true;
  if (actor.role.canManageUsers !== true || !actor.carrierId) return false;
  const target = await args.context.prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, carrierId: true, role: { select: Object.fromEntries(["id", "name", ...permissionsList].map((name) => [name, true])) } }
  });
  return Boolean(target && target.carrierId === actor.carrierId && roleWithinGrantCeiling(actor.role, target.role));
}
async function canAssignUserRole(args) {
  const actor = await freshSessionActor(args);
  if (!actor?.role) return false;
  const requestedRole = args.inputData?.role;
  if (requestedRole === void 0) return true;
  if (actor.role.canManageCarriers !== true && actor.role.canManageUsers !== true) return false;
  if (args.item?.id === actor.id && actor.role.canManageCarriers !== true) return false;
  if (requestedRole?.disconnect === true || requestedRole === null) return actor.role.canManageCarriers === true;
  const roleId = connectedId(requestedRole);
  if (!roleId) return false;
  const targetCarrierId = typeof args.item?.carrierId === "string" ? args.item.carrierId : connectedId(args.inputData?.carrier);
  if (!targetCarrierId || actor.role.canManageCarriers !== true && targetCarrierId !== actor.carrierId) return false;
  const targetRole = await args.context.prisma.role.findUnique({
    where: { id: roleId },
    select: { carrierId: true, ...Object.fromEntries(permissionsList.map((permission) => [permission, true])) }
  });
  return Boolean(
    targetRole && targetRole.carrierId === targetCarrierId && roleWithinGrantCeiling(actor.role, targetRole)
  );
}
async function isFreshSignedIn(args) {
  return Boolean((await freshSessionActor(args))?.role);
}
async function hasFreshPermission(args, ...required2) {
  const actor = await freshSessionActor(args);
  return Boolean(actor?.role && required2.some((permission) => actor.role?.[permission] === true));
}
async function freshCarrierFilter(args, carrierPath = "carrier") {
  const actor = await freshSessionActor(args);
  if (!actor?.role) return false;
  if (actor.role.canManageCarriers === true) return true;
  return actor.carrierId ? nestedRelationshipFilter(carrierPath, actor.carrierId) : false;
}
function nestedRelationshipFilter(path, id) {
  const parts = path.split(".").filter(Boolean);
  return parts.reduceRight(
    (filter, relationship58) => ({ [relationship58]: filter }),
    { id: typeof id === "string" ? { equals: id } : id }
  );
}
function connectedId(value) {
  if (typeof value === "string") return value;
  if (typeof value?.id === "string") return value.id;
  if (typeof value?.connect?.id === "string") return value.connect.id;
  return null;
}
async function canCreateForSessionCarrier(args) {
  const actor = await freshSessionActor(args);
  if (!actor?.role) return false;
  if (actor.role.canManageCarriers === true) return true;
  return Boolean(actor.carrierId && connectedId(args.inputData?.carrier) === actor.carrierId);
}
async function canUpdateForSessionCarrier(args) {
  const actor = await freshSessionActor(args);
  if (!actor?.role) return false;
  if (args.inputData?.carrier === void 0) return true;
  const requestedCarrierId = connectedId(args.inputData.carrier);
  if (!requestedCarrierId) return false;
  const currentCarrierId = typeof args.item?.carrierId === "string" ? args.item.carrierId : null;
  if (currentCarrierId) return requestedCarrierId === currentCarrierId;
  if (actor.role.canManageCarriers === true) return true;
  return requestedCarrierId === actor.carrierId;
}
function carrierScopedAccess(readPermission, managePermission, options = {}) {
  const appendOnly = options.appendOnly ?? false;
  const allowDelete = options.allowDelete ?? false;
  const carrierPath = options.carrierPath ?? "carrier";
  const canRead = (args) => hasFreshPermission(args, readPermission, managePermission);
  const canManage = (args) => hasFreshPermission(args, managePermission);
  const scoped = (args) => freshCarrierFilter(args, carrierPath);
  return {
    operation: {
      query: canRead,
      create: canManage,
      update: appendOnly ? () => false : canManage,
      delete: appendOnly || !allowDelete ? () => false : canManage
    },
    filter: {
      query: scoped,
      update: scoped,
      delete: scoped
    },
    item: {
      create: canCreateForSessionCarrier,
      update: canUpdateForSessionCarrier
    }
  };
}
function commandOnlyCarrierAccess(readPermission, managePermission, carrierPath = "carrier") {
  const canRead = (args) => hasFreshPermission(args, readPermission, managePermission);
  return {
    operation: { query: canRead, create: () => false, update: () => false, delete: () => false },
    filter: { query: (args) => freshCarrierFilter(args, carrierPath) }
  };
}
function stationScopedCommandAccess(readPermission, managePermission, airportPath, capability) {
  const canRead = (args) => hasFreshPermission(args, readPermission, managePermission);
  return {
    operation: { query: canRead, create: () => false, update: () => false, delete: () => false },
    filter: {
      query: async (args) => {
        const carrierScope = await freshCarrierFilter(args);
        if (carrierScope === false) return false;
        const actor = await freshSessionActor(args);
        if (!actor?.role) return false;
        if (actor.role.canManageCarriers === true) return carrierScope;
        const userId = actor.id;
        const carrierId = actor.carrierId;
        if (!carrierId) return false;
        const assignments = await args.context.prisma.stationAssignment.findMany({
          where: { userId, carrierId, status: "active", [capability]: true, validFrom: { lte: /* @__PURE__ */ new Date() }, OR: [{ validUntil: null }, { validUntil: { gt: /* @__PURE__ */ new Date() } }] },
          select: { airportId: true }
        });
        const airportIds = assignments.map((entry) => entry.airportId).filter(Boolean);
        if (!airportIds.length) return false;
        return { AND: [carrierScope, nestedRelationshipFilter(airportPath, { in: airportIds })] };
      }
    }
  };
}
function commandOnlyGraphql() {
  return { omit: { create: true, update: true, delete: true } };
}
async function userReadFilter(args) {
  const actor = await freshSessionActor(args);
  if (!actor?.role) return false;
  if (actor.role.canManageCarriers === true) return true;
  if (actor.role.canReadUsers === true || actor.role.canManageUsers === true) return actor.carrierId ? nestedRelationshipFilter("carrier", actor.carrierId) : false;
  return { id: { equals: actor.id } };
}
async function userUpdateFilter(args) {
  const actor = await freshSessionActor(args);
  if (!actor?.role) return false;
  if (actor.role.canManageCarriers === true) return true;
  if (actor.role.canManageUsers === true) return actor.carrierId ? nestedRelationshipFilter("carrier", actor.carrierId) : false;
  return { id: { equals: actor.id } };
}
function canReadSecurePassengerData(args) {
  return hasFreshPermission(args, "canManageSecurePassengerData");
}
async function requireFreshPermission(context, permission) {
  const session = context.session;
  if (!session?.itemId || session.listKey !== "User") throw new Error("Resource not found or inaccessible.");
  const user = await context.prisma.user.findUnique({
    where: { id: session.itemId },
    select: { id: true, carrierId: true, role: { select: Object.fromEntries([...permissionsList, "id"].map((name) => [name, true])) } }
  });
  if (!user?.role || user.role[permission] !== true || !user.carrierId) throw new Error("Resource not found or inaccessible.");
  return { itemId: user.id, carrierId: user.carrierId, canManageCarriers: user.role.canManageCarriers === true };
}
async function requireFreshCarrierPermission(context, permission, carrierId) {
  const actor = await requireFreshPermission(context, permission);
  if (!actor.canManageCarriers && actor.carrierId !== carrierId) throw new Error("Resource not found or inaccessible.");
  return actor;
}
async function requireStationCapability(context, permission, carrierId, airportId, capability) {
  const actor = await requireFreshCarrierPermission(context, permission, carrierId);
  if (actor.canManageCarriers) return actor;
  const assignment = await context.prisma.stationAssignment.findFirst({
    where: {
      userId: actor.itemId,
      carrierId,
      airportId,
      status: "active",
      [capability]: true,
      validFrom: { lte: /* @__PURE__ */ new Date() },
      OR: [{ validUntil: null }, { validUntil: { gt: /* @__PURE__ */ new Date() } }]
    },
    select: { id: true }
  });
  if (!assignment) throw new Error("Resource not found or inaccessible.");
  return actor;
}

// features/keystone/lib/validation.ts
function assertMinorAmount(value, label) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative safe minor-unit integer.`);
  }
  return Number(value);
}
function assertChronologicalRange(startValue, endValue, label) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`${label} start and end must be valid timestamps.`);
  }
  if (end <= start) throw new Error(`${label} end must be after start.`);
}
function assertInventoryCounts(input) {
  const values = [input.capacity, input.authorized, input.sold, input.held, input.blocked];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("Inventory counts must be non-negative integers.");
  }
  if (input.authorized > input.capacity) {
    throw new Error("Authorized inventory cannot exceed physical capacity.");
  }
  if (input.blocked > input.capacity || input.sold + input.held + input.blocked > input.authorized) {
    throw new Error("Sold, held, and blocked quantities exceed authorized inventory.");
  }
}
function assertTravelDocumentProtection(input) {
  const hasToken = typeof input.documentNumberToken === "string" && input.documentNumberToken.trim().length >= 8;
  const hasEncryptedPayload = typeof input.encryptedPayload === "string" && input.encryptedPayload.trim().length >= 16;
  if (!hasToken && !hasEncryptedPayload) {
    throw new Error("Travel document material must be tokenized or encrypted before storage.");
  }
  if (input.documentNumberHash !== void 0 && input.documentNumberHash !== null && !/^[a-f0-9]{64}$/i.test(String(input.documentNumberHash))) {
    throw new Error("Travel document hash must be a SHA-256 hex digest.");
  }
  if (input.documentNumberLast4 !== void 0 && input.documentNumberLast4 !== null && !/^[A-Z0-9]{4}$/i.test(String(input.documentNumberLast4))) {
    throw new Error("Travel document last four must contain exactly four letters or digits.");
  }
}
function currentValue(resolvedData, item, key) {
  return resolvedData[key] === void 0 ? item?.[key] : resolvedData[key];
}
function relationshipIsConnected(value) {
  if (!value) return false;
  if (typeof value === "string") return true;
  if (typeof value.id === "string" || typeof value.connect?.id === "string") return true;
  return Array.isArray(value.connect) && value.connect.length > 0;
}
function connectedRelationshipIds(value) {
  if (!value || value.disconnect === true) return [];
  const candidates = [value.id, value.connect, value.set].flatMap((candidate) => Array.isArray(candidate) ? candidate : candidate ? [candidate] : []);
  return [...new Set(candidates.map((candidate) => typeof candidate === "string" ? candidate : candidate?.id).filter((id) => typeof id === "string"))];
}
function carrierRelationshipHooks(specs) {
  return {
    async validate({ resolvedData, item, context, addValidationError }) {
      const carrierId = resolvedData.carrier?.connect?.id ?? resolvedData.carrier?.id ?? item?.carrierId;
      if (!carrierId) return;
      for (const [field, spec] of Object.entries(specs)) {
        const value = resolvedData[field];
        if (value === void 0 || value?.disconnect === true) continue;
        if (value?.create) {
          addValidationError(`${field} must reference a separately validated record in the same carrier.`);
          continue;
        }
        const ids = connectedRelationshipIds(value);
        if (!ids.length) continue;
        const carrierField = spec.carrierField ?? "carrierId";
        const rows = await context.prisma[spec.model].findMany({ where: { id: { in: ids } }, select: { id: true, [carrierField]: true } });
        if (rows.length !== ids.length || rows.some((row) => row[carrierField] !== carrierId)) addValidationError(`${field} must belong to the same carrier.`);
      }
    }
  };
}
function reportValidation(addValidationError, operation) {
  try {
    operation();
  } catch (error) {
    addValidationError(error instanceof Error ? error.message : "Invalid data.");
  }
}
function combineListHooks(...hooks) {
  const validators = hooks.flatMap((hook) => hook?.validate ? [hook.validate] : []);
  return {
    async validate(args) {
      for (const validate of validators) await validate(args);
    }
  };
}
function commandOwnedRelationshipHooks(fields) {
  return {
    validate({ resolvedData, addValidationError }) {
      for (const field of fields) {
        if (resolvedData[field] !== void 0) addValidationError(`${field} is maintained by the authoritative related-record command and cannot be reassigned here.`);
      }
    }
  };
}
function requiredRelationshipHooks(fields) {
  return {
    validate({ operation, resolvedData, addValidationError }) {
      for (const field of fields) {
        const value = resolvedData?.[field];
        if (operation === "create" && !relationshipIsConnected(value)) {
          addValidationError(`${field} relationship is required.`);
        }
        if (operation === "update" && (value?.disconnect === true || value === null)) {
          addValidationError(`${field} relationship cannot be disconnected.`);
        }
      }
    }
  };
}
function chronologicalRangeHooks(startField, endField, label) {
  return {
    validate({ resolvedData, item, addValidationError }) {
      const start = currentValue(resolvedData, item, startField);
      const end = currentValue(resolvedData, item, endField);
      if (start === void 0 || start === null || end === void 0 || end === null) return;
      reportValidation(addValidationError, () => assertChronologicalRange(start, end, label));
    }
  };
}
function inventoryCountHooks() {
  return {
    validate({ resolvedData, item, addValidationError }) {
      reportValidation(addValidationError, () => assertInventoryCounts({
        capacity: Number(currentValue(resolvedData, item, "capacity") ?? 0),
        authorized: Number(currentValue(resolvedData, item, "authorized") ?? 0),
        sold: Number(currentValue(resolvedData, item, "sold") ?? 0),
        held: Number(currentValue(resolvedData, item, "held") ?? 0),
        blocked: Number(currentValue(resolvedData, item, "blocked") ?? 0)
      }));
    }
  };
}
function minorAmountHooks(fields) {
  return {
    validate({ resolvedData, item, addValidationError }) {
      for (const field of fields) {
        const amount = currentValue(resolvedData, item, field);
        if (amount === void 0 || amount === null) continue;
        reportValidation(addValidationError, () => assertMinorAmount(amount, field));
      }
    }
  };
}
function travelDocumentHooks() {
  return {
    validate({ resolvedData, item, addValidationError }) {
      reportValidation(addValidationError, () => assertTravelDocumentProtection({
        documentNumberToken: currentValue(resolvedData, item, "documentNumberToken"),
        documentNumberHash: currentValue(resolvedData, item, "documentNumberHash"),
        encryptedPayload: currentValue(resolvedData, item, "encryptedPayload"),
        documentNumberLast4: currentValue(resolvedData, item, "documentNumberLast4")
      }));
      const issuedAt = currentValue(resolvedData, item, "issuedAt");
      const expiresAt = currentValue(resolvedData, item, "expiresAt");
      if (issuedAt && expiresAt) {
        reportValidation(addValidationError, () => assertChronologicalRange(issuedAt, expiresAt, "Travel document validity"));
      }
    }
  };
}

// features/keystone/models/trackingFields.ts
var import_fields3 = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields3.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields3.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/models/AncillaryProduct.ts
var AncillaryProduct = (0, import_core.list)({
  access: carrierScopedAccess("canReadOffers", "canManageOffers"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "type", "status", "defaultPriceAmount", "currencyCode"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields4.relationship)({ ref: "Carrier" }),
    productKey: (0, import_fields4.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    code: (0, import_fields4.text)({ validation: { isRequired: true } }),
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    description: (0, import_fields4.text)({ ui: { displayMode: "textarea" } }),
    type: (0, import_fields4.select)({
      type: "enum",
      validation: { isRequired: true },
      options: [
        { label: "Seat", value: "seat" },
        { label: "Checked bag", value: "checked_bag" },
        { label: "Cabin bag", value: "cabin_bag" },
        { label: "Priority", value: "priority" },
        { label: "Lounge", value: "lounge" },
        { label: "Meal", value: "meal" },
        { label: "Wi-Fi", value: "wifi" },
        { label: "Assistance", value: "assistance" },
        { label: "Other", value: "other" }
      ]
    }),
    status: (0, import_fields4.select)({
      type: "enum",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Archived", value: "archived" }
      ]
    }),
    fulfillmentType: (0, import_fields4.select)({
      type: "enum",
      defaultValue: "associated",
      options: [
        { label: "Associated to flight", value: "associated" },
        { label: "Standalone", value: "standalone" }
      ]
    }),
    defaultPriceAmount: (0, import_fields4.integer)({ defaultValue: 0, validation: { min: 0 } }),
    taxAmount: (0, import_fields4.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields4.text)({
      defaultValue: "USD",
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } }
    }),
    requiresInventory: (0, import_fields4.checkbox)({ defaultValue: false }),
    attributes: (0, import_fields4.json)({ defaultValue: {} }),
    offerItems: (0, import_fields4.relationship)({ ref: "OfferItem.ancillaryProduct", many: true }),
    bookingLineItems: (0, import_fields4.relationship)({ ref: "BookingLineItem.ancillaryProduct", many: true }),
    electronicMiscCoupons: (0, import_fields4.relationship)({ ref: "ElectronicMiscCoupon.ancillaryProduct", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    commandOwnedRelationshipHooks(["offerItems", "bookingLineItems", "electronicMiscCoupons"]),
    minorAmountHooks(["defaultPriceAmount", "taxAmount"])
  )
});

// features/keystone/models/ApprovedAgent.ts
var import_core2 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var canReadAgents = (args) => hasFreshPermission(args, "canManageAgents", "canReadOffers", "canReadBookings");
var ApprovedAgent = (0, import_core2.list)({
  access: {
    operation: {
      query: canReadAgents,
      create: (args) => hasFreshPermission(args, "canManageAgents"),
      update: (args) => hasFreshPermission(args, "canManageAgents"),
      delete: () => false
    },
    filter: {
      query: freshCarrierFilter,
      update: freshCarrierFilter
    },
    item: {
      create: canCreateForSessionCarrier,
      update: canUpdateForSessionCarrier
    }
  },
  ui: {
    labelField: "legalName",
    listView: { initialColumns: ["legalName", "tradingName", "status", "accreditationNumber", "validTo"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields5.relationship)({ ref: "Carrier.approvedAgents" }),
    legalName: (0, import_fields5.text)({ validation: { isRequired: true } }),
    tradingName: (0, import_fields5.text)(),
    externalReference: (0, import_fields5.text)({ isIndexed: true }),
    accreditationType: (0, import_fields5.select)({
      type: "enum",
      defaultValue: "other",
      options: [
        { label: "IATA", value: "iata" },
        { label: "TIDS", value: "tids" },
        { label: "ARC", value: "arc" },
        { label: "Carrier appointed", value: "carrier_appointed" },
        { label: "Other", value: "other" }
      ]
    }),
    accreditationNumber: (0, import_fields5.text)({ isIndexed: true }),
    status: (0, import_fields5.select)({
      type: "enum",
      defaultValue: "pending",
      validation: { isRequired: true },
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ]
    }),
    validFrom: (0, import_fields5.timestamp)(),
    validTo: (0, import_fields5.timestamp)(),
    salesChannels: (0, import_fields5.json)({ defaultValue: [] }),
    servicingScopes: (0, import_fields5.json)({ defaultValue: [] }),
    contactEmail: (0, import_fields5.text)(),
    contactPhone: (0, import_fields5.text)(),
    users: (0, import_fields5.relationship)({ ref: "User.approvedAgent", many: true, access: { create: () => false, update: () => false } }),
    offers: (0, import_fields5.relationship)({ ref: "Offer.approvedAgent", many: true }),
    bookings: (0, import_fields5.relationship)({ ref: "Booking.approvedAgent", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    commandOwnedRelationshipHooks(["offers", "bookings"]),
    chronologicalRangeHooks("validFrom", "validTo", "Agent approval")
  )
});

// features/keystone/models/Airport.ts
var import_core3 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var canReadAirport = (args) => hasFreshPermission(
  args,
  "canReadNetwork",
  "canManageNetwork",
  "canReadOffers",
  "canManageOffers",
  "canReadBookings",
  "canManageBookings",
  "canReadAirportService",
  "canManageAirportService"
);
var Airport = (0, import_core3.list)({
  access: {
    operation: {
      query: canReadAirport,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "iataCode",
    listView: { initialColumns: ["iataCode", "name", "city", "countryCode", "timezone"] },
    hideDelete: true
  },
  fields: {
    iataCode: (0, import_fields6.text)({
      isIndexed: "unique",
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{3}$/, explanation: "Use a three-character IATA location code." } }
    }),
    icaoCode: (0, import_fields6.text)({
      isIndexed: "unique",
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z0-9]{4}$/, explanation: "Use a four-character ICAO airport code." } }
    }),
    name: (0, import_fields6.text)({ validation: { isRequired: true } }),
    city: (0, import_fields6.text)({ validation: { isRequired: true } }),
    subdivisionCode: (0, import_fields6.text)(),
    countryCode: (0, import_fields6.text)({
      validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: "Use an ISO 3166-1 alpha-2 country code." } }
    }),
    timezone: (0, import_fields6.text)({ validation: { isRequired: true } }),
    isActive: (0, import_fields6.checkbox)({ defaultValue: true }),
    departingRoutes: (0, import_fields6.relationship)({ ref: "Route.origin", many: true }),
    arrivingRoutes: (0, import_fields6.relationship)({ ref: "Route.destination", many: true }),
    departingFlights: (0, import_fields6.relationship)({ ref: "FlightInstance.origin", many: true }),
    arrivingFlights: (0, import_fields6.relationship)({ ref: "FlightInstance.destination", many: true }),
    bagEvents: (0, import_fields6.relationship)({ ref: "BagEvent.airport", many: true }),
    stationAssignments: (0, import_fields6.relationship)({ ref: "StationAssignment.airport", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/AuditEvent.ts
var import_core4 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
var AuditEvent = (0, import_core4.list)({
  access: {
    operation: {
      query: (args) => hasFreshPermission(args, "canReadAudit"),
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: freshCarrierFilter }
  },
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "eventKey",
    listView: { initialColumns: ["action", "aggregateType", "aggregateId", "actor", "occurredAt"] },
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" }
  },
  fields: {
    carrier: (0, import_fields7.relationship)({ ref: "Carrier" }),
    eventKey: (0, import_fields7.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    action: (0, import_fields7.text)({ validation: { isRequired: true } }),
    aggregateType: (0, import_fields7.text)({ validation: { isRequired: true } }),
    aggregateId: (0, import_fields7.text)({ validation: { isRequired: true } }),
    actor: (0, import_fields7.relationship)({ ref: "User.auditEvents" }),
    approvedAgent: (0, import_fields7.relationship)({ ref: "ApprovedAgent" }),
    source: (0, import_fields7.select)({ type: "enum", defaultValue: "platform", options: [
      { label: "Platform", value: "platform" },
      { label: "Storefront", value: "storefront" },
      { label: "Approved agent", value: "agent" },
      { label: "Provider", value: "provider" },
      { label: "System", value: "system" }
    ] }),
    correlationId: (0, import_fields7.text)({ isIndexed: true }),
    idempotencyKey: (0, import_fields7.text)({ isIndexed: true }),
    beforeSummary: (0, import_fields7.json)({ defaultValue: {} }),
    afterSummary: (0, import_fields7.json)({ defaultValue: {} }),
    metadata: (0, import_fields7.json)({ defaultValue: {} }),
    ipAddress: (0, import_fields7.text)(),
    userAgent: (0, import_fields7.text)(),
    occurredAt: (0, import_fields7.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields
  },
  hooks: requiredRelationshipHooks(["carrier"])
});

// features/keystone/models/Bag.ts
var import_core5 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");

// features/keystone/lib/lifecycle.ts
var lifecycleMachines = {
  offer: {
    label: "Offer",
    initial: "draft",
    terminal: ["accepted", "expired", "withdrawn"],
    transitions: {
      draft: ["available", "withdrawn"],
      available: ["held", "accepted", "expired", "withdrawn"],
      held: ["available", "accepted", "expired", "withdrawn"],
      accepted: [],
      expired: [],
      withdrawn: []
    },
    actions: { publish: "available", hold: "held", release: "available", accept: "accepted", expire: "expired", withdraw: "withdrawn" }
  },
  flightInstance: {
    label: "Flight instance",
    initial: "scheduled",
    terminal: ["arrived", "cancelled"],
    transitions: {
      scheduled: ["open_for_sale", "closed_for_sale", "delayed", "cancelled"],
      open_for_sale: ["closed_for_sale", "delayed", "cancelled"],
      closed_for_sale: ["open_for_sale", "delayed", "departed", "cancelled"],
      delayed: ["open_for_sale", "closed_for_sale", "departed", "cancelled"],
      departed: ["arrived"],
      arrived: [],
      cancelled: []
    },
    actions: { openSales: "open_for_sale", closeSales: "closed_for_sale", delay: "delayed", depart: "departed", arrive: "arrived", cancel: "cancelled" }
  },
  inventoryHold: {
    label: "Inventory hold",
    initial: "active",
    terminal: ["converted", "released", "expired"],
    transitions: { active: ["converted", "released", "expired"], converted: [], released: [], expired: [] },
    actions: { convert: "converted", release: "released", expire: "expired" }
  },
  booking: {
    label: "Booking",
    initial: "pending",
    terminal: ["completed", "cancelled"],
    transitions: {
      pending: ["confirmed", "cancelled"],
      confirmed: ["ticketed", "in_progress", "cancelled"],
      ticketed: ["in_progress", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed: [],
      cancelled: []
    },
    actions: { confirm: "confirmed", ticket: "ticketed", start: "in_progress", complete: "completed", cancel: "cancelled" }
  },
  journey: {
    label: "Journey",
    initial: "planned",
    terminal: ["completed", "cancelled"],
    transitions: {
      planned: ["in_progress", "disrupted", "cancelled"],
      in_progress: ["completed", "disrupted", "cancelled"],
      disrupted: ["planned", "in_progress", "cancelled"],
      completed: [],
      cancelled: []
    },
    actions: { start: "in_progress", disrupt: "disrupted", recover: "planned", complete: "completed", cancel: "cancelled" }
  },
  bookingSegment: {
    label: "Booking segment",
    initial: "confirmed",
    terminal: ["flown", "cancelled", "refunded"],
    transitions: {
      confirmed: ["checked_in", "disrupted", "reaccommodated", "cancelled", "refunded"],
      checked_in: ["boarded", "offloaded", "disrupted", "reaccommodated", "cancelled"],
      boarded: ["flown", "offloaded", "disrupted"],
      offloaded: ["checked_in", "disrupted", "reaccommodated", "cancelled"],
      disrupted: ["reaccommodated", "cancelled", "refunded"],
      reaccommodated: ["confirmed", "cancelled"],
      flown: [],
      cancelled: [],
      refunded: []
    },
    actions: { checkIn: "checked_in", board: "boarded", fly: "flown", offload: "offloaded", disrupt: "disrupted", reaccommodate: "reaccommodated", cancel: "cancelled", refund: "refunded" }
  },
  seatMap: {
    label: "Seat map",
    initial: "draft",
    terminal: ["retired"],
    transitions: { draft: ["published", "retired"], published: ["retired"], retired: [] },
    actions: { publish: "published", retire: "retired" }
  },
  seatAssignment: {
    label: "Seat assignment",
    initial: "held",
    terminal: ["boarded", "released", "cancelled"],
    transitions: {
      held: ["assigned", "released", "cancelled"],
      assigned: ["confirmed", "released", "cancelled"],
      confirmed: ["boarded", "released", "cancelled"],
      boarded: ["confirmed", "released"],
      released: [],
      cancelled: []
    },
    actions: { assign: "assigned", confirm: "confirmed", board: "boarded", release: "released", cancel: "cancelled" }
  },
  serviceRequest: {
    label: "Service request",
    initial: "requested",
    terminal: ["fulfilled", "unable", "cancelled"],
    transitions: {
      requested: ["pending", "confirmed", "unable", "cancelled"],
      pending: ["confirmed", "unable", "cancelled"],
      confirmed: ["fulfilled", "unable", "cancelled"],
      fulfilled: [],
      unable: [],
      cancelled: []
    },
    actions: { pend: "pending", confirm: "confirmed", fulfill: "fulfilled", unable: "unable", cancel: "cancelled" }
  },
  ticket: {
    label: "Ticket",
    initial: "pending",
    terminal: ["used", "voided", "refunded", "exchanged"],
    transitions: {
      pending: ["issued", "voided"],
      issued: ["partially_used", "used", "voided", "refunded", "exchanged", "suspended"],
      partially_used: ["used", "refunded", "exchanged", "suspended"],
      suspended: ["issued", "partially_used", "refunded", "exchanged"],
      used: [],
      voided: [],
      refunded: [],
      exchanged: []
    },
    actions: { issue: "issued", partiallyUse: "partially_used", use: "used", suspend: "suspended", void: "voided", refund: "refunded", exchange: "exchanged" }
  },
  ticketCoupon: {
    label: "Ticket coupon",
    initial: "open",
    terminal: ["flown", "voided", "refunded", "exchanged"],
    transitions: {
      open: ["checked_in", "voided", "refunded", "exchanged", "suspended"],
      checked_in: ["boarded", "open", "voided", "refunded", "exchanged", "suspended"],
      boarded: ["flown", "open", "suspended"],
      suspended: ["open", "refunded", "exchanged", "voided"],
      flown: [],
      voided: [],
      refunded: [],
      exchanged: []
    },
    actions: { checkIn: "checked_in", reopen: "open", board: "boarded", fly: "flown", suspend: "suspended", void: "voided", refund: "refunded", exchange: "exchanged" }
  },
  electronicMiscDocument: {
    label: "Electronic miscellaneous document",
    initial: "pending",
    terminal: ["used", "voided", "refunded", "exchanged"],
    transitions: {
      pending: ["issued", "voided"],
      issued: ["partially_used", "used", "voided", "refunded", "exchanged"],
      partially_used: ["used", "refunded", "exchanged"],
      used: [],
      voided: [],
      refunded: [],
      exchanged: []
    },
    actions: { issue: "issued", partiallyUse: "partially_used", use: "used", void: "voided", refund: "refunded", exchange: "exchanged" }
  },
  electronicMiscCoupon: {
    label: "Electronic miscellaneous coupon",
    initial: "open",
    terminal: ["used", "voided", "refunded", "exchanged"],
    transitions: { open: ["used", "voided", "refunded", "exchanged"], used: [], voided: [], refunded: [], exchanged: [] },
    actions: { use: "used", void: "voided", refund: "refunded", exchange: "exchanged" }
  },
  paymentSession: {
    label: "Payment session",
    initial: "created",
    terminal: ["captured", "failed", "cancelled", "expired"],
    transitions: {
      created: ["pending", "cancelled", "expired"],
      pending: ["authorized", "captured", "failed", "cancelled", "expired"],
      authorized: ["captured", "failed", "cancelled"],
      captured: [],
      failed: [],
      cancelled: [],
      expired: []
    },
    actions: { begin: "pending", authorize: "authorized", capture: "captured", fail: "failed", cancel: "cancelled", expire: "expired" }
  },
  payment: {
    label: "Payment",
    initial: "pending",
    terminal: ["failed", "cancelled", "refunded"],
    transitions: {
      pending: ["authorized", "captured", "failed", "cancelled"],
      authorized: ["captured", "failed", "cancelled"],
      captured: ["partially_refunded", "refunded"],
      partially_refunded: ["refunded"],
      failed: [],
      cancelled: [],
      refunded: []
    },
    actions: { authorize: "authorized", capture: "captured", partiallyRefund: "partially_refunded", refund: "refunded", fail: "failed", cancel: "cancelled" }
  },
  refund: {
    label: "Refund",
    initial: "requested",
    terminal: ["succeeded", "failed", "cancelled"],
    transitions: {
      requested: ["approved", "cancelled"],
      approved: ["processing", "cancelled"],
      processing: ["succeeded", "failed"],
      succeeded: [],
      failed: [],
      cancelled: []
    },
    actions: { approve: "approved", process: "processing", succeed: "succeeded", fail: "failed", cancel: "cancelled" }
  },
  exchange: {
    label: "Exchange",
    initial: "quoted",
    terminal: ["completed", "failed", "cancelled", "expired"],
    transitions: {
      quoted: ["accepted", "cancelled", "expired"],
      accepted: ["processing", "cancelled"],
      processing: ["completed", "failed"],
      completed: [],
      failed: [],
      cancelled: [],
      expired: []
    },
    actions: { accept: "accepted", process: "processing", complete: "completed", fail: "failed", cancel: "cancelled", expire: "expired" }
  },
  checkIn: {
    label: "Check-in",
    initial: "not_started",
    terminal: ["boarded", "cancelled"],
    transitions: {
      not_started: ["eligible", "blocked", "cancelled"],
      eligible: ["checked_in", "blocked", "cancelled"],
      checked_in: ["boarded", "offloaded", "cancelled"],
      offloaded: ["eligible", "checked_in", "cancelled"],
      blocked: ["eligible", "cancelled"],
      boarded: ["offloaded"],
      cancelled: []
    },
    actions: { markEligible: "eligible", checkIn: "checked_in", board: "boarded", block: "blocked", offload: "offloaded", cancel: "cancelled" }
  },
  boardingPass: {
    label: "Boarding pass",
    initial: "issued",
    terminal: ["revoked"],
    transitions: { issued: ["boarded", "revoked", "reissued"], reissued: ["boarded", "revoked"], boarded: ["revoked"], revoked: [] },
    actions: { board: "boarded", revoke: "revoked", reissue: "reissued" }
  },
  bag: {
    label: "Bag",
    initial: "accepted",
    terminal: ["delivered", "closed"],
    transitions: {
      accepted: ["loaded", "in_transit", "delayed", "mishandled"],
      loaded: ["in_transit", "arrived", "delayed", "mishandled"],
      in_transit: ["loaded", "arrived", "delayed", "mishandled"],
      arrived: ["delivered", "delayed", "mishandled"],
      delayed: ["in_transit", "arrived", "delivered", "mishandled", "closed"],
      mishandled: ["in_transit", "arrived", "delivered", "closed"],
      delivered: ["closed"],
      closed: []
    },
    actions: { load: "loaded", transfer: "in_transit", arrive: "arrived", deliver: "delivered", delay: "delayed", mishandle: "mishandled", close: "closed" }
  },
  disruption: {
    label: "Disruption",
    initial: "detected",
    terminal: ["resolved", "cancelled"],
    transitions: { detected: ["published", "recovering", "resolved", "cancelled"], published: ["recovering", "resolved", "cancelled"], recovering: ["resolved", "cancelled"], resolved: [], cancelled: [] },
    actions: { publish: "published", recover: "recovering", resolve: "resolved", cancel: "cancelled" }
  },
  reaccommodation: {
    label: "Reaccommodation",
    initial: "proposed",
    terminal: ["confirmed", "declined", "failed", "expired", "cancelled"],
    transitions: { proposed: ["accepted", "declined", "expired", "cancelled"], accepted: ["confirmed", "failed", "cancelled"], confirmed: [], declined: [], failed: [], expired: [], cancelled: [] },
    actions: { accept: "accepted", confirm: "confirmed", decline: "declined", fail: "failed", expire: "expired", cancel: "cancelled" }
  },
  providerConnection: {
    label: "Provider connection",
    initial: "pending",
    terminal: ["revoked"],
    transitions: { pending: ["active", "failed", "revoked"], active: ["paused", "failed", "revoked"], paused: ["active", "revoked"], failed: ["pending", "active", "revoked"], revoked: [] },
    actions: { activate: "active", pause: "paused", fail: "failed", retry: "pending", revoke: "revoked" }
  },
  webhookEvent: {
    label: "Webhook event",
    initial: "pending",
    terminal: ["succeeded", "dead_lettered"],
    transitions: { pending: ["processing", "failed", "succeeded"], processing: ["succeeded", "failed"], failed: ["pending", "dead_lettered"], succeeded: [], dead_lettered: [] },
    actions: { process: "processing", succeed: "succeeded", fail: "failed", retry: "pending", deadLetter: "dead_lettered" }
  }
};
function canTransition(machineName, from, to) {
  if (from === to) return true;
  const machine = lifecycleMachines[machineName];
  return machine.transitions[from]?.includes(to) ?? false;
}
function assertLifecycleTransition(machineName, from, to) {
  const machine = lifecycleMachines[machineName];
  if (!canTransition(machineName, from, to)) {
    throw new Error(`${machine.label} cannot transition from ${from} to ${to}.`);
  }
  return { changed: from !== to, from, to };
}
function lifecycleHooks(machineName, statusField = "status") {
  return {
    validate({ operation, item, resolvedData, addValidationError }) {
      if (operation !== "update") return;
      const current = String(item?.[statusField] ?? "");
      const next = resolvedData?.[statusField];
      if (next === void 0 || next === current) return;
      try {
        assertLifecycleTransition(machineName, current, String(next));
      } catch (error) {
        addValidationError(error instanceof Error ? error.message : "Invalid lifecycle transition.");
      }
    }
  };
}

// features/keystone/models/Bag.ts
var Bag = (0, import_core5.list)({
  access: stationScopedCommandAccess("canReadAirportService", "canManageAirportService", "origin", "canAcceptBags"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "tagNumber", listView: { initialColumns: ["tagNumber", "booking", "passenger", "flightInstance", "status", "weightGrams"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields8.relationship)({ ref: "Carrier" }),
    bagKey: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    tagNumber: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields8.relationship)({ ref: "Booking.bags", access: immutableFieldAccess }),
    bookingPassenger: (0, import_fields8.relationship)({ ref: "BookingPassenger.bags", access: immutableFieldAccess }),
    passenger: (0, import_fields8.relationship)({ ref: "Passenger.bags", access: immutableFieldAccess }),
    flightInstance: (0, import_fields8.relationship)({ ref: "FlightInstance.bags", access: immutableFieldAccess }),
    bookingSegment: (0, import_fields8.relationship)({ ref: "BookingSegment.primaryBags", access: immutableFieldAccess }),
    checkIn: (0, import_fields8.relationship)({ ref: "CheckIn.bags", access: immutableFieldAccess }),
    ticketCoupon: (0, import_fields8.relationship)({ ref: "TicketCoupon.bags", access: immutableFieldAccess }),
    entitlementDocument: (0, import_fields8.relationship)({ ref: "ElectronicMiscDocument", access: immutableFieldAccess }),
    segments: (0, import_fields8.relationship)({ ref: "BookingSegment.bags", many: true, access: immutableFieldAccess }),
    origin: (0, import_fields8.relationship)({ ref: "Airport", access: immutableFieldAccess }),
    destination: (0, import_fields8.relationship)({ ref: "Airport", access: immutableFieldAccess }),
    status: (0, import_fields8.select)({ type: "enum", defaultValue: "accepted", options: [
      { label: "Accepted", value: "accepted" },
      { label: "Loaded", value: "loaded" },
      { label: "In transit", value: "in_transit" },
      { label: "Arrived", value: "arrived" },
      { label: "Delivered", value: "delivered" },
      { label: "Delayed", value: "delayed" },
      { label: "Mishandled", value: "mishandled" },
      { label: "Closed", value: "closed" }
    ] }),
    bagType: (0, import_fields8.select)({ type: "enum", defaultValue: "checked", options: [
      { label: "Checked", value: "checked" },
      { label: "Gate checked", value: "gate_checked" },
      { label: "Special item", value: "special_item" },
      { label: "Mobility aid", value: "mobility_aid" }
    ] }),
    weightGrams: (0, import_fields8.integer)({ validation: { min: 0 }, access: immutableFieldAccess }),
    routeSnapshot: (0, import_fields8.json)({ defaultValue: [], access: immutableFieldAccess }),
    acceptedAt: (0, import_fields8.timestamp)(),
    deliveredAt: (0, import_fields8.timestamp)(),
    events: (0, import_fields8.relationship)({ ref: "BagEvent.bag", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "bookingPassenger", "passenger", "bookingSegment", "checkIn", "ticketCoupon"]),
    lifecycleHooks("bag")
  )
});

// features/keystone/models/BagEvent.ts
var import_core6 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var BagEvent = (0, import_core6.list)({
  access: commandOnlyCarrierAccess("canReadAirportService", "canManageAirportService"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "eventKey", listView: { initialColumns: ["bag", "eventType", "airport", "occurredAt", "source"] }, hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" } },
  fields: {
    carrier: (0, import_fields10.relationship)({ ref: "Carrier" }),
    eventKey: (0, import_fields10.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    bag: (0, import_fields10.relationship)({ ref: "Bag.events" }),
    airport: (0, import_fields10.relationship)({ ref: "Airport.bagEvents" }),
    eventType: (0, import_fields10.select)({ type: "enum", validation: { isRequired: true }, options: [
      { label: "Accepted", value: "accepted" },
      { label: "Security screened", value: "screened" },
      { label: "Loaded", value: "loaded" },
      { label: "Unloaded", value: "unloaded" },
      { label: "Transferred", value: "transferred" },
      { label: "Arrived", value: "arrived" },
      { label: "Delivered", value: "delivered" },
      { label: "Exception", value: "exception" }
    ] }),
    statusSnapshot: (0, import_fields10.text)({ validation: { isRequired: true } }),
    occurredAt: (0, import_fields10.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    source: (0, import_fields10.select)({ type: "enum", defaultValue: "system", options: [
      { label: "System", value: "system" },
      { label: "Scanner", value: "scanner" },
      { label: "Provider", value: "provider" },
      { label: "Agent", value: "agent" }
    ] }),
    providerConnection: (0, import_fields10.relationship)({ ref: "ProviderConnection" }),
    providerReference: (0, import_fields10.text)(),
    payloadSummary: (0, import_fields10.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: requiredRelationshipHooks(["carrier", "bag"])
});

// features/keystone/models/BoardingPass.ts
var import_core7 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var manageAirportService = (args) => hasFreshPermission(args, "canManageAirportService");
var BoardingPass = (0, import_core7.list)({
  access: stationScopedCommandAccess("canReadAirportService", "canManageAirportService", "bookingSegment.flightInstance.origin", "canBoard"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "passNumber", listView: { initialColumns: ["passNumber", "passenger", "bookingSegment", "status", "boardingGroup", "issuedAt"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields11.relationship)({ ref: "Carrier" }),
    passNumber: (0, import_fields11.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    checkIn: (0, import_fields11.relationship)({ ref: "CheckIn.boardingPass", access: immutableFieldAccess }),
    passenger: (0, import_fields11.relationship)({ ref: "Passenger.boardingPasses", access: immutableFieldAccess }),
    bookingSegment: (0, import_fields11.relationship)({ ref: "BookingSegment", access: immutableFieldAccess }),
    seatAssignment: (0, import_fields11.relationship)({ ref: "SeatAssignment", access: immutableFieldAccess }),
    status: (0, import_fields11.select)({ type: "enum", defaultValue: "issued", options: [
      { label: "Issued", value: "issued" },
      { label: "Reissued", value: "reissued" },
      { label: "Boarded", value: "boarded" },
      { label: "Revoked", value: "revoked" }
    ] }),
    barcodeToken: (0, import_fields11.text)({
      access: { read: manageAirportService, create: manageAirportService, update: manageAirportService },
      ui: hiddenSensitiveUi
    }),
    seatDesignatorSnapshot: (0, import_fields11.text)({ access: immutableFieldAccess }),
    boardingGroup: (0, import_fields11.text)(),
    boardingZone: (0, import_fields11.text)(),
    sequenceNumber: (0, import_fields11.text)(),
    gateSnapshot: (0, import_fields11.text)(),
    terminalSnapshot: (0, import_fields11.text)(),
    issuedAt: (0, import_fields11.timestamp)({ defaultValue: { kind: "now" }, access: immutableFieldAccess }),
    boardedAt: (0, import_fields11.timestamp)(),
    revokedAt: (0, import_fields11.timestamp)(),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "checkIn", "passenger", "bookingSegment"]),
    lifecycleHooks("boardingPass")
  )
});

// features/keystone/models/Booking.ts
var import_core8 = require("@keystone-6/core");
var import_access8 = require("@keystone-6/core/access");
var import_fields13 = require("@keystone-6/core/fields");
var bookingTotalHooks = {
  validate({ resolvedData, item, addValidationError }) {
    const value = (key) => Number(resolvedData[key] ?? item?.[key] ?? 0);
    if (value("baseAmount") + value("taxAmount") + value("feeAmount") - value("discountAmount") !== value("totalAmount")) {
      addValidationError("Booking total must equal base plus tax and fees minus discounts.");
    }
  }
};
var Booking = (0, import_core8.list)({
  access: commandOnlyCarrierAccess("canReadBookings", "canManageBookings"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "recordLocator",
    listView: { initialColumns: ["recordLocator", "orderNumber", "status", "paymentStatus", "ticketingStatus", "totalAmount", "currencyCode"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields13.relationship)({ ref: "Carrier.bookings" }),
    bookingKey: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    recordLocator: (0, import_fields13.text)({
      isIndexed: true,
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{5,8}$/, explanation: "Use a five-to-eight character record locator." } }
    }),
    orderNumber: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    accessTokenHash: (0, import_fields13.text)({ isIndexed: true, db: { isNullable: true }, access: { read: import_access8.denyAll, create: import_access8.denyAll, update: import_access8.denyAll }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    accessTokenExpiresAt: (0, import_fields13.timestamp)(),
    accessTokenVersion: (0, import_fields13.integer)({ defaultValue: 1, validation: { min: 1 } }),
    status: (0, import_fields13.select)({
      type: "enum",
      defaultValue: "pending",
      validation: { isRequired: true },
      options: [
        { label: "Pending", value: "pending" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Ticketed", value: "ticketed" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" }
      ]
    }),
    paymentStatus: (0, import_fields13.select)({
      type: "enum",
      defaultValue: "unpaid",
      options: [
        { label: "Unpaid", value: "unpaid" },
        { label: "Partially paid", value: "partially_paid" },
        { label: "Paid", value: "paid" },
        { label: "Partially refunded", value: "partially_refunded" },
        { label: "Refunded", value: "refunded" },
        { label: "Payment failed", value: "failed" }
      ]
    }),
    ticketingStatus: (0, import_fields13.select)({
      type: "enum",
      defaultValue: "not_ticketed",
      options: [
        { label: "Not ticketed", value: "not_ticketed" },
        { label: "Partially ticketed", value: "partially_ticketed" },
        { label: "Ticketed", value: "ticketed" },
        { label: "Voided", value: "voided" },
        { label: "Exchanged", value: "exchanged" }
      ]
    }),
    source: (0, import_fields13.select)({
      type: "enum",
      defaultValue: "direct",
      options: [
        { label: "Direct", value: "direct" },
        { label: "Website", value: "website" },
        { label: "Call center", value: "call_center" },
        { label: "Approved agent", value: "agent" },
        { label: "NDC", value: "ndc" },
        { label: "GDS", value: "gds" },
        { label: "Airport", value: "airport" }
      ]
    }),
    contactEmail: (0, import_fields13.text)(),
    contactPhone: (0, import_fields13.text)(),
    preferredLanguage: (0, import_fields13.text)({ defaultValue: "en" }),
    baseAmount: (0, import_fields13.integer)({ defaultValue: 0, validation: { min: 0 } }),
    taxAmount: (0, import_fields13.integer)({ defaultValue: 0, validation: { min: 0 } }),
    feeAmount: (0, import_fields13.integer)({ defaultValue: 0, validation: { min: 0 } }),
    discountAmount: (0, import_fields13.integer)({ defaultValue: 0, validation: { min: 0 } }),
    totalAmount: (0, import_fields13.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields13.text)({
      defaultValue: "USD",
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } }
    }),
    customer: (0, import_fields13.relationship)({ ref: "User.bookings" }),
    approvedAgent: (0, import_fields13.relationship)({ ref: "ApprovedAgent.bookings" }),
    sourceOffer: (0, import_fields13.relationship)({ ref: "Offer.booking" }),
    passengers: (0, import_fields13.relationship)({ ref: "BookingPassenger.booking", many: true }),
    journeys: (0, import_fields13.relationship)({ ref: "Journey.booking", many: true }),
    segments: (0, import_fields13.relationship)({ ref: "BookingSegment.booking", many: true }),
    lineItems: (0, import_fields13.relationship)({ ref: "BookingLineItem.booking", many: true }),
    serviceRequests: (0, import_fields13.relationship)({ ref: "ServiceRequest.booking", many: true }),
    tickets: (0, import_fields13.relationship)({ ref: "Ticket.booking", many: true }),
    serviceObligations: (0, import_fields13.relationship)({ ref: "ServiceObligation.booking", many: true }),
    electronicMiscDocuments: (0, import_fields13.relationship)({ ref: "ElectronicMiscDocument.booking", many: true }),
    seatAssignments: (0, import_fields13.relationship)({ ref: "SeatAssignment.booking", many: true }),
    paymentSessions: (0, import_fields13.relationship)({ ref: "PaymentSession.booking", many: true }),
    payments: (0, import_fields13.relationship)({ ref: "Payment.booking", many: true }),
    refunds: (0, import_fields13.relationship)({ ref: "Refund.booking", many: true }),
    exchanges: (0, import_fields13.relationship)({ ref: "Exchange.booking", many: true }),
    checkIns: (0, import_fields13.relationship)({ ref: "CheckIn.booking", many: true }),
    bags: (0, import_fields13.relationship)({ ref: "Bag.booking", many: true }),
    reaccommodations: (0, import_fields13.relationship)({ ref: "Reaccommodation.booking", many: true }),
    manualPaymentEvidence: (0, import_fields13.relationship)({ ref: "ManualPaymentEvidence.booking", many: true }),
    confirmedAt: (0, import_fields13.timestamp)(),
    ticketedAt: (0, import_fields13.timestamp)(),
    cancelledAt: (0, import_fields13.timestamp)(),
    completedAt: (0, import_fields13.timestamp)(),
    externalReferences: (0, import_fields13.json)({ defaultValue: {} }),
    metadata: (0, import_fields13.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    lifecycleHooks("booking"),
    minorAmountHooks(["baseAmount", "taxAmount", "feeAmount", "discountAmount", "totalAmount"]),
    bookingTotalHooks
  )
});

// features/keystone/models/BookingLineItem.ts
var import_core9 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var lineTotalHooks = {
  validate({ resolvedData, addValidationError }) {
    const quantity = Number(resolvedData.quantity ?? 1);
    const unit = Number(resolvedData.unitAmount ?? 0);
    const base = Number(resolvedData.baseAmount ?? 0);
    const tax = Number(resolvedData.taxAmount ?? 0);
    const fee = Number(resolvedData.feeAmount ?? 0);
    const total = Number(resolvedData.totalAmount ?? 0);
    if (!Number.isSafeInteger(unit * quantity) || unit * quantity !== base) {
      addValidationError("Booking line base amount must equal unit amount multiplied by quantity.");
    }
    if (base + tax + fee !== total) {
      addValidationError("Booking line total must equal base, tax, and fee amounts.");
    }
  }
};
var BookingLineItem = (0, import_core9.list)({
  access: commandOnlyCarrierAccess("canReadBookings", "canManageBookings"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "description",
    listView: { initialColumns: ["booking", "itemType", "description", "quantity", "totalAmount", "currencyCode"] },
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" }
  },
  fields: {
    carrier: (0, import_fields14.relationship)({ ref: "Carrier" }),
    lineItemKey: (0, import_fields14.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    booking: (0, import_fields14.relationship)({ ref: "Booking.lineItems" }),
    sourceOfferItem: (0, import_fields14.relationship)({ ref: "OfferItem.bookingLineItems" }),
    bookingSegment: (0, import_fields14.relationship)({ ref: "BookingSegment" }),
    bookingPassenger: (0, import_fields14.relationship)({ ref: "BookingPassenger.lineItems" }),
    ancillaryProduct: (0, import_fields14.relationship)({ ref: "AncillaryProduct.bookingLineItems" }),
    itemType: (0, import_fields14.select)({
      type: "enum",
      validation: { isRequired: true },
      options: [
        { label: "Flight", value: "flight" },
        { label: "Ancillary", value: "ancillary" },
        { label: "Fee", value: "fee" },
        { label: "Tax", value: "tax" },
        { label: "Discount", value: "discount" },
        { label: "Exchange", value: "exchange" }
      ]
    }),
    description: (0, import_fields14.text)({ validation: { isRequired: true } }),
    quantity: (0, import_fields14.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    unitAmount: (0, import_fields14.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    baseAmount: (0, import_fields14.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    taxAmount: (0, import_fields14.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    feeAmount: (0, import_fields14.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    totalAmount: (0, import_fields14.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    currencyCode: (0, import_fields14.text)({
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } }
    }),
    sourceReference: (0, import_fields14.text)(),
    productSnapshot: (0, import_fields14.json)({ defaultValue: {} }),
    pricingSnapshot: (0, import_fields14.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking"]),
    minorAmountHooks(["unitAmount", "baseAmount", "taxAmount", "feeAmount", "totalAmount"]),
    lineTotalHooks
  )
});

// features/keystone/models/BookingPassenger.ts
var import_core10 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var passengerSnapshotHooks = {
  validate({ operation, resolvedData, addValidationError }) {
    if (operation === "create" && !resolvedData.passengerSnapshot) {
      addValidationError("passengerSnapshot is required and immutable.");
    }
  }
};
var BookingPassenger = (0, import_core10.list)({
  access: commandOnlyCarrierAccess("canReadBookings", "canManageBookings"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "bookingPassengerKey",
    listView: { initialColumns: ["booking", "passenger", "passengerType", "status", "isPrimaryContact"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields15.relationship)({ ref: "Carrier" }),
    bookingPassengerKey: (0, import_fields15.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields15.relationship)({ ref: "Booking.passengers", access: immutableFieldAccess }),
    passenger: (0, import_fields15.relationship)({ ref: "Passenger.bookingPassengers", access: immutableFieldAccess }),
    passengerType: (0, import_fields15.select)({
      type: "enum",
      defaultValue: "adult",
      access: immutableFieldAccess,
      options: [
        { label: "Adult", value: "adult" },
        { label: "Child", value: "child" },
        { label: "Infant with seat", value: "infant_with_seat" },
        { label: "Infant without seat", value: "infant_without_seat" }
      ]
    }),
    status: (0, import_fields15.select)({
      type: "enum",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Completed", value: "completed" }
      ]
    }),
    isPrimaryContact: (0, import_fields15.checkbox)({ defaultValue: false }),
    passengerSnapshot: (0, import_fields15.json)({ access: immutableFieldAccess }),
    loyaltySnapshot: (0, import_fields15.json)({ defaultValue: {}, access: immutableFieldAccess }),
    lineItems: (0, import_fields15.relationship)({ ref: "BookingLineItem.bookingPassenger", many: true }),
    tickets: (0, import_fields15.relationship)({ ref: "Ticket.bookingPassenger", many: true }),
    serviceObligations: (0, import_fields15.relationship)({ ref: "ServiceObligation.bookingPassenger", many: true }),
    ticketCouponLineages: (0, import_fields15.relationship)({ ref: "TicketCouponLineage.bookingPassenger", many: true }),
    electronicMiscDocuments: (0, import_fields15.relationship)({ ref: "ElectronicMiscDocument.bookingPassenger", many: true }),
    seatAssignments: (0, import_fields15.relationship)({ ref: "SeatAssignment.bookingPassenger", many: true }),
    checkIns: (0, import_fields15.relationship)({ ref: "CheckIn.bookingPassenger", many: true }),
    bags: (0, import_fields15.relationship)({ ref: "Bag.bookingPassenger", many: true }),
    reaccommodations: (0, import_fields15.relationship)({ ref: "Reaccommodation.bookingPassenger", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "passenger"]),
    passengerSnapshotHooks
  )
});

// features/keystone/models/BookingSegment.ts
var import_core11 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var BookingSegment = (0, import_core11.list)({
  access: commandOnlyCarrierAccess("canReadBookings", "canManageBookings"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "segmentKey",
    listView: { initialColumns: ["segmentKey", "booking", "sequence", "marketingFlightNumber", "originCode", "destinationCode", "status"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields17.relationship)({ ref: "Carrier" }),
    segmentKey: (0, import_fields17.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields17.relationship)({ ref: "Booking.segments", access: immutableFieldAccess }),
    journey: (0, import_fields17.relationship)({ ref: "Journey.segments", access: immutableFieldAccess }),
    sourceOfferItem: (0, import_fields17.relationship)({ ref: "OfferItem.bookingSegments", access: immutableFieldAccess }),
    flightInstance: (0, import_fields17.relationship)({ ref: "FlightInstance.bookingSegments", access: immutableFieldAccess }),
    inventoryBucket: (0, import_fields17.relationship)({ ref: "InventoryBucket.bookingSegments", access: immutableFieldAccess }),
    sequence: (0, import_fields17.integer)({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    status: (0, import_fields17.select)({
      type: "enum",
      defaultValue: "confirmed",
      options: [
        { label: "Confirmed", value: "confirmed" },
        { label: "Checked in", value: "checked_in" },
        { label: "Boarded", value: "boarded" },
        { label: "Flown", value: "flown" },
        { label: "Offloaded", value: "offloaded" },
        { label: "Disrupted", value: "disrupted" },
        { label: "Reaccommodated", value: "reaccommodated" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Refunded", value: "refunded" }
      ]
    }),
    origin: (0, import_fields17.relationship)({ ref: "Airport", access: immutableFieldAccess }),
    destination: (0, import_fields17.relationship)({ ref: "Airport", access: immutableFieldAccess }),
    originCode: (0, import_fields17.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    destinationCode: (0, import_fields17.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    marketingCarrierCode: (0, import_fields17.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    operatingCarrierCode: (0, import_fields17.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    marketingFlightNumber: (0, import_fields17.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    scheduledDepartureAt: (0, import_fields17.timestamp)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    scheduledArrivalAt: (0, import_fields17.timestamp)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    cabinCode: (0, import_fields17.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    bookingClassCode: (0, import_fields17.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    fareBrandCode: (0, import_fields17.text)({ access: immutableFieldAccess }),
    fareBasisCode: (0, import_fields17.text)({ access: immutableFieldAccess }),
    itinerarySnapshot: (0, import_fields17.json)({ defaultValue: {}, access: immutableFieldAccess }),
    includedBaggageSnapshot: (0, import_fields17.json)({ defaultValue: {}, access: immutableFieldAccess }),
    ticketCoupons: (0, import_fields17.relationship)({ ref: "TicketCoupon.bookingSegment", many: true }),
    electronicMiscCoupons: (0, import_fields17.relationship)({ ref: "ElectronicMiscCoupon.bookingSegment", many: true }),
    seatAssignments: (0, import_fields17.relationship)({ ref: "SeatAssignment.bookingSegment", many: true }),
    serviceRequests: (0, import_fields17.relationship)({ ref: "ServiceRequest.bookingSegment", many: true }),
    checkIns: (0, import_fields17.relationship)({ ref: "CheckIn.bookingSegment", many: true }),
    documentVerifications: (0, import_fields17.relationship)({ ref: "DocumentVerification.bookingSegment", many: true }),
    bags: (0, import_fields17.relationship)({ ref: "Bag.segments", many: true }),
    primaryBags: (0, import_fields17.relationship)({ ref: "Bag.bookingSegment", many: true }),
    disruptions: (0, import_fields17.relationship)({ ref: "Disruption.affectedSegments", many: true }),
    exchangesAsOriginal: (0, import_fields17.relationship)({ ref: "Exchange.originalSegments", many: true }),
    exchangesAsReplacement: (0, import_fields17.relationship)({ ref: "Exchange.replacementSegments", many: true }),
    reaccommodationsAsOriginal: (0, import_fields17.relationship)({ ref: "Reaccommodation.originalSegments", many: true }),
    reaccommodationsAsReplacement: (0, import_fields17.relationship)({ ref: "Reaccommodation.replacementSegments", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "journey", "origin", "destination"]),
    chronologicalRangeHooks("scheduledDepartureAt", "scheduledArrivalAt", "Booked segment"),
    lifecycleHooks("bookingSegment")
  )
});

// features/keystone/models/Cabin.ts
var import_core12 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
var Cabin = (0, import_core12.list)({
  access: carrierScopedAccess("canReadNetwork", "canManageNetwork"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "cabinClass", "displayOrder", "carrier"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields19.relationship)({ ref: "Carrier" }),
    code: (0, import_fields19.text)({ validation: { isRequired: true } }),
    name: (0, import_fields19.text)({ validation: { isRequired: true } }),
    cabinClass: (0, import_fields19.select)({
      type: "enum",
      validation: { isRequired: true },
      options: [
        { label: "Economy", value: "economy" },
        { label: "Premium economy", value: "premium_economy" },
        { label: "Business", value: "business" },
        { label: "First", value: "first" }
      ]
    }),
    displayOrder: (0, import_fields19.integer)({ defaultValue: 0, validation: { min: 0 } }),
    fareBrands: (0, import_fields19.relationship)({ ref: "FareBrand.cabin", many: true }),
    inventoryBuckets: (0, import_fields19.relationship)({ ref: "InventoryBucket.cabin", many: true }),
    seats: (0, import_fields19.relationship)({ ref: "Seat.cabin", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    commandOwnedRelationshipHooks(["fareBrands", "inventoryBuckets", "seats"])
  )
});

// features/keystone/models/Carrier.ts
var import_core13 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var ownCarrierFilter = (args) => freshCarrierFilter(args, "");
var Carrier = (0, import_core13.list)({
  access: {
    operation: {
      query: isFreshSignedIn,
      create: (args) => hasFreshPermission(args, "canManageCarriers"),
      update: (args) => hasFreshPermission(args, "canManageCarriers"),
      delete: () => false
    },
    filter: {
      query: ownCarrierFilter,
      update: ownCarrierFilter
    }
  },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "status", "defaultCurrencyCode"] },
    hideDelete: true
  },
  fields: {
    name: (0, import_fields20.text)({ validation: { isRequired: true } }),
    legalName: (0, import_fields20.text)({ validation: { isRequired: true } }),
    code: (0, import_fields20.text)({
      isIndexed: "unique",
      validation: {
        isRequired: true,
        match: { regex: /^[A-Z0-9]{2,3}$/, explanation: "Use a two or three character carrier designator." }
      }
    }),
    icaoCode: (0, import_fields20.text)({
      isIndexed: "unique",
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter ICAO designator." } }
    }),
    callsign: (0, import_fields20.text)(),
    defaultCurrencyCode: (0, import_fields20.text)({
      defaultValue: "USD",
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } }
    }),
    defaultTimezone: (0, import_fields20.text)({ defaultValue: "UTC", validation: { isRequired: true } }),
    status: (0, import_fields20.select)({
      type: "enum",
      defaultValue: "active",
      validation: { isRequired: true },
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ]
    }),
    directSalesEnabled: (0, import_fields20.checkbox)({ defaultValue: true }),
    storefrontBrandColor: (0, import_fields20.select)({
      type: "string",
      options: [
        { label: "Slate", value: "slate" },
        { label: "Blue", value: "blue" },
        { label: "Indigo", value: "indigo" },
        { label: "Violet", value: "violet" },
        { label: "Rose", value: "rose" },
        { label: "Emerald", value: "emerald" },
        { label: "Amber", value: "amber" }
      ],
      db: { isNullable: true },
      ui: { description: "Allowlisted public storefront accent color" }
    }),
    storefrontHomepageTitle: (0, import_fields20.text)({
      db: { isNullable: true },
      validation: { length: { max: 120 } },
      ui: { description: "Public storefront homepage heading" }
    }),
    storefrontHomepageDescription: (0, import_fields20.text)({
      db: { isNullable: true },
      validation: { length: { max: 320 } },
      ui: { displayMode: "textarea", description: "Public storefront homepage description" }
    }),
    users: (0, import_fields20.relationship)({ ref: "User.carrier", many: true, access: { create: () => false, update: () => false } }),
    roles: (0, import_fields20.relationship)({ ref: "Role.carrier", many: true, access: { create: () => false, update: () => false } }),
    approvedAgents: (0, import_fields20.relationship)({ ref: "ApprovedAgent.carrier", many: true, access: { create: () => false, update: () => false } }),
    routes: (0, import_fields20.relationship)({ ref: "Route.carrier", many: true, access: { create: () => false, update: () => false } }),
    schedules: (0, import_fields20.relationship)({ ref: "FlightSchedule.carrier", many: true, access: { create: () => false, update: () => false } }),
    flightInstances: (0, import_fields20.relationship)({ ref: "FlightInstance.carrier", many: true, access: { create: () => false, update: () => false } }),
    bookings: (0, import_fields20.relationship)({ ref: "Booking.carrier", many: true, access: { create: () => false, update: () => false } }),
    serviceObligations: (0, import_fields20.relationship)({ ref: "ServiceObligation.carrier", many: true, access: { create: () => false, update: () => false } }),
    ticketCouponLineages: (0, import_fields20.relationship)({ ref: "TicketCouponLineage.carrier", many: true, access: { create: () => false, update: () => false } }),
    providerConnections: (0, import_fields20.relationship)({ ref: "ProviderConnection.carrier", many: true, access: { create: () => false, update: () => false } }),
    stationAssignments: (0, import_fields20.relationship)({ ref: "StationAssignment.carrier", many: true, access: { create: () => false, update: () => false } }),
    documentVerifications: (0, import_fields20.relationship)({ ref: "DocumentVerification.carrier", many: true, access: { create: () => false, update: () => false } }),
    machineCredentials: (0, import_fields20.relationship)({ ref: "MachineCredential.carrier", many: true, access: { create: () => false, update: () => false } }),
    outboxEvents: (0, import_fields20.relationship)({ ref: "OutboxEvent.carrier", many: true, access: { create: () => false, update: () => false } }),
    manualPaymentEvidence: (0, import_fields20.relationship)({ ref: "ManualPaymentEvidence.carrier", many: true, access: { create: () => false, update: () => false } }),
    settlementLedgerEntries: (0, import_fields20.relationship)({ ref: "SettlementLedgerEntry.carrier", many: true, access: { create: () => false, update: () => false } }),
    onboardingSteps: (0, import_fields20.relationship)({ ref: "OnboardingStep.carrier", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  },
  hooks: {
    async validate({ operation, resolvedData, item, context, addValidationError }) {
      if (operation !== "update" || !resolvedData.code || resolvedData.code === item?.code) return;
      const carrierId = item?.id;
      const [bookings, flights, offers] = await Promise.all([
        context.prisma.booking.count({ where: { carrierId } }),
        context.prisma.flightInstance.count({ where: { carrierId } }),
        context.prisma.offer.count({ where: { carrierId } })
      ]);
      if (bookings + flights + offers > 0) addValidationError("Carrier code is immutable after commercial records exist.");
    }
  }
});

// features/keystone/models/CheckIn.ts
var import_core14 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");
var CheckIn = (0, import_core14.list)({
  access: stationScopedCommandAccess("canReadAirportService", "canManageAirportService", "flightInstance.origin", "canCheckIn"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "checkInKey", listView: { initialColumns: ["booking", "passenger", "bookingSegment", "status", "channel", "checkedInAt"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields21.relationship)({ ref: "Carrier" }),
    checkInKey: (0, import_fields21.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    booking: (0, import_fields21.relationship)({ ref: "Booking.checkIns" }),
    bookingPassenger: (0, import_fields21.relationship)({ ref: "BookingPassenger.checkIns" }),
    passenger: (0, import_fields21.relationship)({ ref: "Passenger.checkIns" }),
    bookingSegment: (0, import_fields21.relationship)({ ref: "BookingSegment.checkIns" }),
    flightInstance: (0, import_fields21.relationship)({ ref: "FlightInstance.checkIns" }),
    ticketCoupon: (0, import_fields21.relationship)({ ref: "TicketCoupon.checkIns" }),
    seatAssignment: (0, import_fields21.relationship)({ ref: "SeatAssignment" }),
    status: (0, import_fields21.select)({ type: "enum", defaultValue: "not_started", options: [
      { label: "Not started", value: "not_started" },
      { label: "Eligible", value: "eligible" },
      { label: "Checked in", value: "checked_in" },
      { label: "Boarded", value: "boarded" },
      { label: "Blocked", value: "blocked" },
      { label: "Offloaded", value: "offloaded" },
      { label: "Cancelled", value: "cancelled" }
    ] }),
    channel: (0, import_fields21.select)({ type: "enum", defaultValue: "web", options: [
      { label: "Web", value: "web" },
      { label: "Mobile", value: "mobile" },
      { label: "Kiosk", value: "kiosk" },
      { label: "Counter", value: "counter" },
      { label: "Agent", value: "agent" },
      { label: "System", value: "system" }
    ] }),
    travelDocumentsVerified: (0, import_fields21.checkbox)({ defaultValue: false }),
    checkedBagCount: (0, import_fields21.integer)({ defaultValue: 0, validation: { min: 0 } }),
    eligibilityData: (0, import_fields21.json)({ defaultValue: {} }),
    blockedReason: (0, import_fields21.text)(),
    checkedInAt: (0, import_fields21.timestamp)(),
    boardedAt: (0, import_fields21.timestamp)(),
    offloadedAt: (0, import_fields21.timestamp)(),
    boardingPass: (0, import_fields21.relationship)({ ref: "BoardingPass.checkIn" }),
    bags: (0, import_fields21.relationship)({ ref: "Bag.checkIn", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "bookingPassenger", "passenger", "bookingSegment", "flightInstance"]),
    lifecycleHooks("checkIn")
  )
});

// features/keystone/models/Disruption.ts
var import_core15 = require("@keystone-6/core");
var import_fields22 = require("@keystone-6/core/fields");
var Disruption = (0, import_core15.list)({
  access: commandOnlyCarrierAccess("canReadDisruptions", "canManageDisruptions"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "disruptionKey", listView: { initialColumns: ["disruptionKey", "flightInstance", "type", "severity", "status", "detectedAt"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields22.relationship)({ ref: "Carrier" }),
    disruptionKey: (0, import_fields22.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    flightInstance: (0, import_fields22.relationship)({ ref: "FlightInstance.disruptions" }),
    type: (0, import_fields22.select)({ type: "enum", validation: { isRequired: true }, options: [
      { label: "Delay", value: "delay" },
      { label: "Cancellation", value: "cancellation" },
      { label: "Schedule change", value: "schedule_change" },
      { label: "Misconnection", value: "misconnection" },
      { label: "Diversion", value: "diversion" },
      { label: "Equipment change", value: "equipment_change" },
      { label: "Other", value: "other" }
    ] }),
    severity: (0, import_fields22.select)({ type: "enum", defaultValue: "medium", options: [
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" },
      { label: "Critical", value: "critical" }
    ] }),
    status: (0, import_fields22.select)({ type: "enum", defaultValue: "detected", options: [
      { label: "Detected", value: "detected" },
      { label: "Published", value: "published" },
      { label: "Recovering", value: "recovering" },
      { label: "Resolved", value: "resolved" },
      { label: "Cancelled", value: "cancelled" }
    ] }),
    affectedSegments: (0, import_fields22.relationship)({ ref: "BookingSegment.disruptions", many: true }),
    publicSummary: (0, import_fields22.text)({ ui: { displayMode: "textarea" } }),
    internalDetails: (0, import_fields22.text)({ ui: { displayMode: "textarea" } }),
    providerConnection: (0, import_fields22.relationship)({ ref: "ProviderConnection" }),
    providerReference: (0, import_fields22.text)(),
    detectedAt: (0, import_fields22.timestamp)({ defaultValue: { kind: "now" } }),
    publishedAt: (0, import_fields22.timestamp)(),
    resolvedAt: (0, import_fields22.timestamp)(),
    impactSnapshot: (0, import_fields22.json)({ defaultValue: {} }),
    reaccommodations: (0, import_fields22.relationship)({ ref: "Reaccommodation.disruption", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    lifecycleHooks("disruption")
  )
});

// features/keystone/models/DocumentVerification.ts
var import_core16 = require("@keystone-6/core");
var import_fields23 = require("@keystone-6/core/fields");
var DocumentVerification = (0, import_core16.list)({
  access: commandOnlyCarrierAccess("canManageSecurePassengerData", "canManageSecurePassengerData"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "verificationKey", hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["passenger", "bookingSegment", "status", "verifiedAt", "expiresAt"] } },
  fields: {
    carrier: (0, import_fields23.relationship)({ ref: "Carrier.documentVerifications", access: immutableFieldAccess }),
    verificationKey: (0, import_fields23.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    passenger: (0, import_fields23.relationship)({ ref: "Passenger.documentVerifications", access: immutableFieldAccess }),
    travelDocument: (0, import_fields23.relationship)({ ref: "TravelDocument.verifications", access: immutableFieldAccess }),
    bookingSegment: (0, import_fields23.relationship)({ ref: "BookingSegment.documentVerifications", access: immutableFieldAccess }),
    status: (0, import_fields23.select)({ type: "enum", defaultValue: "verified", options: [
      { label: "Verified", value: "verified" },
      { label: "Rejected", value: "rejected" },
      { label: "Revoked", value: "revoked" },
      { label: "Expired", value: "expired" }
    ] }),
    evidenceVersion: (0, import_fields23.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    providerReference: (0, import_fields23.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    verifiedBy: (0, import_fields23.relationship)({ ref: "User.documentVerifications", access: immutableFieldAccess }),
    verifiedAt: (0, import_fields23.timestamp)({ defaultValue: { kind: "now" }, access: immutableFieldAccess }),
    expiresAt: (0, import_fields23.timestamp)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    revokedAt: (0, import_fields23.timestamp)(),
    ...trackingFields
  },
  hooks: requiredRelationshipHooks(["carrier", "passenger", "travelDocument", "bookingSegment", "verifiedBy"])
});

// features/keystone/models/ElectronicMiscCoupon.ts
var import_core17 = require("@keystone-6/core");
var import_fields25 = require("@keystone-6/core/fields");
var ElectronicMiscCoupon = (0, import_core17.list)({
  access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "couponKey",
    listView: { initialColumns: ["document", "couponNumber", "bookingSegment", "ancillaryProduct", "status", "amount"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields25.relationship)({ ref: "Carrier" }),
    couponKey: (0, import_fields25.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    document: (0, import_fields25.relationship)({ ref: "ElectronicMiscDocument.coupons", access: immutableFieldAccess }),
    couponNumber: (0, import_fields25.integer)({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    bookingSegment: (0, import_fields25.relationship)({ ref: "BookingSegment.electronicMiscCoupons", access: immutableFieldAccess }),
    ancillaryProduct: (0, import_fields25.relationship)({ ref: "AncillaryProduct.electronicMiscCoupons", access: immutableFieldAccess }),
    bookingLineItem: (0, import_fields25.relationship)({ ref: "BookingLineItem", access: immutableFieldAccess }),
    status: (0, import_fields25.select)({
      type: "enum",
      defaultValue: "open",
      options: [
        { label: "Open", value: "open" },
        { label: "Used", value: "used" },
        { label: "Voided", value: "voided" },
        { label: "Refunded", value: "refunded" },
        { label: "Exchanged", value: "exchanged" }
      ]
    }),
    amount: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    currencyCode: (0, import_fields25.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    usedAt: (0, import_fields25.timestamp)(),
    entitlementSnapshot: (0, import_fields25.json)({ defaultValue: {}, access: immutableFieldAccess }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "document"]),
    lifecycleHooks("electronicMiscCoupon"),
    minorAmountHooks(["amount"])
  )
});

// features/keystone/models/ElectronicMiscDocument.ts
var import_core18 = require("@keystone-6/core");
var import_fields27 = require("@keystone-6/core/fields");
var ElectronicMiscDocument = (0, import_core18.list)({
  access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "documentNumber",
    listView: { initialColumns: ["documentNumber", "booking", "passenger", "documentType", "status", "totalAmount"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields27.relationship)({ ref: "Carrier" }),
    documentNumber: (0, import_fields27.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields27.relationship)({ ref: "Booking.electronicMiscDocuments", access: immutableFieldAccess }),
    bookingPassenger: (0, import_fields27.relationship)({ ref: "BookingPassenger.electronicMiscDocuments", access: immutableFieldAccess }),
    passenger: (0, import_fields27.relationship)({ ref: "Passenger.electronicMiscDocuments", access: immutableFieldAccess }),
    documentType: (0, import_fields27.select)({
      type: "enum",
      defaultValue: "associated",
      access: immutableFieldAccess,
      options: [
        { label: "Associated", value: "associated" },
        { label: "Standalone", value: "standalone" }
      ]
    }),
    reasonForIssuanceCode: (0, import_fields27.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    serviceCode: (0, import_fields27.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    ancillaryProduct: (0, import_fields27.relationship)({ ref: "AncillaryProduct", access: immutableFieldAccess }),
    status: (0, import_fields27.select)({
      type: "enum",
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Issued", value: "issued" },
        { label: "Partially used", value: "partially_used" },
        { label: "Used", value: "used" },
        { label: "Voided", value: "voided" },
        { label: "Refunded", value: "refunded" },
        { label: "Exchanged", value: "exchanged" }
      ]
    }),
    totalAmount: (0, import_fields27.integer)({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
    currencyCode: (0, import_fields27.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    issuedAt: (0, import_fields27.timestamp)({ access: immutableFieldAccess }),
    providerReference: (0, import_fields27.text)({ access: immutableFieldAccess }),
    coupons: (0, import_fields27.relationship)({ ref: "ElectronicMiscCoupon.document", many: true }),
    metadata: (0, import_fields27.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "bookingPassenger", "passenger"]),
    lifecycleHooks("electronicMiscDocument"),
    minorAmountHooks(["totalAmount"])
  )
});

// features/keystone/models/Exchange.ts
var import_core19 = require("@keystone-6/core");
var import_fields29 = require("@keystone-6/core/fields");
var Exchange = (0, import_core19.list)({
  access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "exchangeKey", listView: { initialColumns: ["exchangeKey", "booking", "status", "priceDifferenceAmount", "changeFeeAmount", "quoteExpiresAt"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields29.relationship)({ ref: "Carrier" }),
    exchangeKey: (0, import_fields29.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    idempotencyKey: (0, import_fields29.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields29.relationship)({ ref: "Booking.exchanges", access: immutableFieldAccess }),
    status: (0, import_fields29.select)({ type: "enum", defaultValue: "quoted", options: [
      { label: "Quoted", value: "quoted" },
      { label: "Accepted", value: "accepted" },
      { label: "Processing", value: "processing" },
      { label: "Completed", value: "completed" },
      { label: "Failed", value: "failed" },
      { label: "Cancelled", value: "cancelled" },
      { label: "Expired", value: "expired" }
    ] }),
    originalSegments: (0, import_fields29.relationship)({ ref: "BookingSegment.exchangesAsOriginal", many: true, access: immutableFieldAccess }),
    replacementSegments: (0, import_fields29.relationship)({ ref: "BookingSegment.exchangesAsReplacement", many: true }),
    priceDifferenceAmount: (0, import_fields29.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    changeFeeAmount: (0, import_fields29.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    additionalCollectionAmount: (0, import_fields29.integer)({ defaultValue: 0, validation: { min: 0 } }),
    refundAmount: (0, import_fields29.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields29.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    quoteExpiresAt: (0, import_fields29.timestamp)({ access: immutableFieldAccess }),
    acceptedAt: (0, import_fields29.timestamp)(),
    completedAt: (0, import_fields29.timestamp)(),
    reason: (0, import_fields29.text)(),
    pricingSnapshot: (0, import_fields29.json)({ defaultValue: {}, access: immutableFieldAccess }),
    metadata: (0, import_fields29.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking"]),
    lifecycleHooks("exchange"),
    minorAmountHooks(["priceDifferenceAmount", "changeFeeAmount", "additionalCollectionAmount", "refundAmount"])
  )
});

// features/keystone/models/FareBrand.ts
var import_core20 = require("@keystone-6/core");
var import_fields31 = require("@keystone-6/core/fields");

// features/keystone/lib/snapshots.ts
function normalizeIncludedBaggageSnapshot(value) {
  if (value === void 0 || value === null) value = {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Included baggage policy must be an object.");
  const policy = value;
  const pieces = policy.pieces ?? 0;
  const maxWeightGrams = policy.maxWeightGrams ?? 0;
  if (!Number.isInteger(pieces) || pieces < 0 || pieces > 10) throw new Error("Included baggage pieces must be an integer between 0 and 10.");
  if (!Number.isInteger(maxWeightGrams) || maxWeightGrams < 0 || maxWeightGrams > 1e5) throw new Error("Included baggage weight must be an integer between 0 and 100000 grams.");
  return deepFreeze({ pieces, maxWeightGrams });
}
function requiredText(value, label) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}
function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer in minor units.`);
  }
  return value;
}
function normalizeCode(value, label, pattern) {
  const normalized = requiredText(value, label).toUpperCase();
  if (!pattern.test(normalized)) throw new Error(`${label} has an invalid format.`);
  return normalized;
}
function normalizeDate(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date;
}
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function normalizeCurrencyCode(value) {
  const normalized = requiredText(value, "Currency code").toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("Currency code must be a three-letter ISO 4217 code.");
  }
  return normalized;
}
function buildBookingLineSnapshot(input) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    throw new Error("Quantity must be a positive safe integer.");
  }
  const unitAmount = nonNegativeInteger(input.unitAmount, "Unit amount");
  const baseAmount = nonNegativeInteger(input.baseAmount, "Base amount");
  const expectedBaseAmount = unitAmount * input.quantity;
  if (!Number.isSafeInteger(expectedBaseAmount) || expectedBaseAmount !== baseAmount) {
    throw new Error("Base amount must equal unit amount multiplied by quantity.");
  }
  const taxAmount = nonNegativeInteger(input.taxAmount, "Tax amount");
  const feeAmount = nonNegativeInteger(input.feeAmount, "Fee amount");
  const totalAmount = nonNegativeInteger(input.totalAmount, "Total amount");
  if (baseAmount + taxAmount + feeAmount !== totalAmount) {
    throw new Error("Line total must equal base, tax, and fee amounts.");
  }
  return deepFreeze({
    sourceOfferItemId: requiredText(input.sourceOfferItemId, "Source offer item id"),
    itemType: input.itemType,
    description: requiredText(input.description, "Description"),
    quantity: input.quantity,
    unitAmount,
    baseAmount,
    taxAmount,
    feeAmount,
    totalAmount,
    currencyCode: normalizeCurrencyCode(input.currencyCode),
    productSnapshot: cloneJson(input.product)
  });
}
function buildBookingSegmentSnapshot(input) {
  const scheduledDepartureAt = normalizeDate(input.scheduledDepartureAt, "Scheduled departure");
  const scheduledArrivalAt = normalizeDate(input.scheduledArrivalAt, "Scheduled arrival");
  if (scheduledArrivalAt <= scheduledDepartureAt) {
    throw new Error("Scheduled arrival must be after departure.");
  }
  const originCode = normalizeCode(input.originCode, "Origin code", /^[A-Z0-9]{3}$/);
  const destinationCode = normalizeCode(input.destinationCode, "Destination code", /^[A-Z0-9]{3}$/);
  if (originCode === destinationCode) throw new Error("Origin and destination must differ.");
  return deepFreeze({
    sourceOfferItemId: requiredText(input.sourceOfferItemId, "Source offer item id"),
    marketingCarrierCode: normalizeCode(input.marketingCarrierCode, "Marketing carrier code", /^[A-Z0-9]{2,3}$/),
    operatingCarrierCode: normalizeCode(input.operatingCarrierCode, "Operating carrier code", /^[A-Z0-9]{2,3}$/),
    flightNumber: normalizeCode(input.flightNumber, "Flight number", /^[A-Z0-9]{1,6}$/),
    originCode,
    destinationCode,
    scheduledDepartureAt: scheduledDepartureAt.toISOString(),
    scheduledArrivalAt: scheduledArrivalAt.toISOString(),
    cabinCode: normalizeCode(input.cabinCode, "Cabin code", /^[A-Z0-9]{1,4}$/),
    bookingClassCode: normalizeCode(input.bookingClassCode, "Booking class code", /^[A-Z0-9]{1,4}$/),
    fareBrandCode: normalizeCode(input.fareBrandCode, "Fare brand code", /^[A-Z0-9_-]{1,32}$/),
    fareBasisCode: normalizeCode(input.fareBasisCode, "Fare basis code", /^[A-Z0-9_-]{1,32}$/),
    includedBaggage: normalizeIncludedBaggageSnapshot(input.includedBaggage)
  });
}

// features/keystone/models/FareBrand.ts
var FareBrand = (0, import_core20.list)({
  access: carrierScopedAccess("canReadOffers", "canManageOffers"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "cabin", "status", "displayOrder"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields31.relationship)({ ref: "Carrier" }),
    code: (0, import_fields31.text)({ validation: { isRequired: true } }),
    name: (0, import_fields31.text)({ validation: { isRequired: true } }),
    description: (0, import_fields31.text)({ ui: { displayMode: "textarea" } }),
    cabin: (0, import_fields31.relationship)({ ref: "Cabin.fareBrands" }),
    status: (0, import_fields31.select)({
      type: "enum",
      defaultValue: "draft",
      validation: { isRequired: true },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Archived", value: "archived" }
      ]
    }),
    displayOrder: (0, import_fields31.integer)({ defaultValue: 0, validation: { min: 0 } }),
    includedBaggage: (0, import_fields31.json)({ defaultValue: {} }),
    benefits: (0, import_fields31.json)({ defaultValue: [] }),
    refundabilitySummary: (0, import_fields31.text)(),
    changeabilitySummary: (0, import_fields31.text)(),
    seatSelectionSummary: (0, import_fields31.text)(),
    rules: (0, import_fields31.relationship)({ ref: "FareRule.fareBrand", many: true }),
    inventoryBuckets: (0, import_fields31.relationship)({ ref: "InventoryBucket.fareBrand", many: true }),
    offerItems: (0, import_fields31.relationship)({ ref: "OfferItem.fareBrand", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "cabin"]),
    carrierRelationshipHooks({ cabin: { model: "cabin" } }),
    commandOwnedRelationshipHooks(["rules", "inventoryBuckets", "offerItems"]),
    {
      validate({ resolvedData, addValidationError }) {
        if (resolvedData.includedBaggage !== void 0) {
          try {
            normalizeIncludedBaggageSnapshot(resolvedData.includedBaggage);
          } catch (error) {
            addValidationError(error instanceof Error ? error.message : "Included baggage policy is invalid.");
          }
        }
      }
    }
  )
});

// features/keystone/models/FareRule.ts
var import_core21 = require("@keystone-6/core");
var import_fields32 = require("@keystone-6/core/fields");
var FareRule = (0, import_core21.list)({
  access: carrierScopedAccess("canReadOffers", "canManageOffers"),
  ui: {
    labelField: "ruleKey",
    listView: { initialColumns: ["ruleKey", "fareBrand", "route", "status", "effectiveFrom", "effectiveTo"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields32.relationship)({ ref: "Carrier" }),
    ruleKey: (0, import_fields32.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    fareBrand: (0, import_fields32.relationship)({ ref: "FareBrand.rules" }),
    route: (0, import_fields32.relationship)({ ref: "Route.fareRules" }),
    fareBasisPattern: (0, import_fields32.text)(),
    status: (0, import_fields32.select)({
      type: "enum",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Archived", value: "archived" }
      ]
    }),
    effectiveFrom: (0, import_fields32.timestamp)(),
    effectiveTo: (0, import_fields32.timestamp)(),
    travelFrom: (0, import_fields32.timestamp)(),
    travelTo: (0, import_fields32.timestamp)(),
    salesChannels: (0, import_fields32.json)({ defaultValue: [] }),
    passengerTypes: (0, import_fields32.json)({ defaultValue: ["adult"] }),
    minimumStayDays: (0, import_fields32.integer)({ validation: { min: 0 } }),
    maximumStayDays: (0, import_fields32.integer)({ validation: { min: 0 } }),
    minimumAdvancePurchaseHours: (0, import_fields32.integer)({ validation: { min: 0 } }),
    isRefundable: (0, import_fields32.checkbox)({ defaultValue: false }),
    isChangeable: (0, import_fields32.checkbox)({ defaultValue: false }),
    changeFeeAmount: (0, import_fields32.integer)({ defaultValue: 0, validation: { min: 0 } }),
    cancellationFeeAmount: (0, import_fields32.integer)({ defaultValue: 0, validation: { min: 0 } }),
    noShowFeeAmount: (0, import_fields32.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields32.text)({
      defaultValue: "USD",
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } }
    }),
    restrictions: (0, import_fields32.json)({ defaultValue: {} }),
    offerItems: (0, import_fields32.relationship)({ ref: "OfferItem.fareRule", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "fareBrand"]),
    carrierRelationshipHooks({ fareBrand: { model: "fareBrand" }, route: { model: "route" } }),
    commandOwnedRelationshipHooks(["offerItems"]),
    chronologicalRangeHooks("effectiveFrom", "effectiveTo", "Fare-rule effective period"),
    chronologicalRangeHooks("travelFrom", "travelTo", "Fare-rule travel period"),
    minorAmountHooks(["changeFeeAmount", "cancellationFeeAmount", "noShowFeeAmount"])
  )
});

// features/keystone/models/FlightInstance.ts
var import_core22 = require("@keystone-6/core");
var import_fields33 = require("@keystone-6/core/fields");
var FlightInstance = (0, import_core22.list)({
  access: commandOnlyCarrierAccess("canReadNetwork", "canManageNetwork"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "instanceKey",
    listView: { initialColumns: ["flightNumber", "serviceDate", "origin", "destination", "status"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields33.relationship)({ ref: "Carrier.flightInstances" }),
    instanceKey: (0, import_fields33.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    schedule: (0, import_fields33.relationship)({ ref: "FlightSchedule.instances" }),
    route: (0, import_fields33.relationship)({ ref: "Route.flightInstances" }),
    origin: (0, import_fields33.relationship)({ ref: "Airport.departingFlights" }),
    destination: (0, import_fields33.relationship)({ ref: "Airport.arrivingFlights" }),
    operatingCarrier: (0, import_fields33.relationship)({ ref: "Carrier" }),
    flightNumber: (0, import_fields33.text)({ validation: { isRequired: true } }),
    serviceDate: (0, import_fields33.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    scheduledDepartureAt: (0, import_fields33.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    scheduledArrivalAt: (0, import_fields33.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    estimatedDepartureAt: (0, import_fields33.timestamp)(),
    estimatedArrivalAt: (0, import_fields33.timestamp)(),
    actualDepartureAt: (0, import_fields33.timestamp)(),
    actualArrivalAt: (0, import_fields33.timestamp)(),
    departureTerminal: (0, import_fields33.text)(),
    departureGate: (0, import_fields33.text)(),
    arrivalTerminal: (0, import_fields33.text)(),
    arrivalGate: (0, import_fields33.text)(),
    status: (0, import_fields33.select)({
      type: "enum",
      defaultValue: "scheduled",
      validation: { isRequired: true },
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Open for sale", value: "open_for_sale" },
        { label: "Closed for sale", value: "closed_for_sale" },
        { label: "Delayed", value: "delayed" },
        { label: "Departed", value: "departed" },
        { label: "Arrived", value: "arrived" },
        { label: "Cancelled", value: "cancelled" }
      ]
    }),
    inventoryBuckets: (0, import_fields33.relationship)({ ref: "InventoryBucket.flightInstance", many: true }),
    seatMaps: (0, import_fields33.relationship)({ ref: "SeatMap.flightInstance", many: true }),
    bookingSegments: (0, import_fields33.relationship)({ ref: "BookingSegment.flightInstance", many: true }),
    checkIns: (0, import_fields33.relationship)({ ref: "CheckIn.flightInstance", many: true }),
    bags: (0, import_fields33.relationship)({ ref: "Bag.flightInstance", many: true }),
    disruptions: (0, import_fields33.relationship)({ ref: "Disruption.flightInstance", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "route", "origin", "destination"]),
    carrierRelationshipHooks({ schedule: { model: "flightSchedule" }, route: { model: "route" }, operatingCarrier: { model: "carrier", carrierField: "id" } }),
    chronologicalRangeHooks("scheduledDepartureAt", "scheduledArrivalAt", "Scheduled flight"),
    lifecycleHooks("flightInstance")
  )
});

// features/keystone/models/FlightSchedule.ts
var import_core23 = require("@keystone-6/core");
var import_fields34 = require("@keystone-6/core/fields");
var FlightSchedule = (0, import_core23.list)({
  access: carrierScopedAccess("canReadNetwork", "canManageNetwork"),
  ui: {
    labelField: "scheduleKey",
    listView: { initialColumns: ["flightNumber", "route", "effectiveFrom", "effectiveTo", "status"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields34.relationship)({ ref: "Carrier.schedules" }),
    scheduleKey: (0, import_fields34.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    route: (0, import_fields34.relationship)({ ref: "Route.schedules" }),
    operatingCarrier: (0, import_fields34.relationship)({ ref: "Carrier" }),
    flightNumber: (0, import_fields34.text)({
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{2,3}\s?[0-9]{1,4}[A-Z]?$/, explanation: "Use a carrier designator and service number." } }
    }),
    serviceSuffix: (0, import_fields34.text)(),
    departureLocalTime: (0, import_fields34.text)({
      validation: { isRequired: true, match: { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: "Use 24-hour HH:mm." } }
    }),
    arrivalLocalTime: (0, import_fields34.text)({
      validation: { isRequired: true, match: { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: "Use 24-hour HH:mm." } }
    }),
    arrivalDayOffset: (0, import_fields34.integer)({ defaultValue: 0, validation: { min: -1, max: 2 } }),
    daysOfWeek: (0, import_fields34.json)({ defaultValue: [] }),
    effectiveFrom: (0, import_fields34.timestamp)(),
    effectiveTo: (0, import_fields34.timestamp)(),
    status: (0, import_fields34.select)({
      type: "enum",
      defaultValue: "draft",
      validation: { isRequired: true },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
        { label: "Suspended", value: "suspended" },
        { label: "Retired", value: "retired" }
      ]
    }),
    instances: (0, import_fields34.relationship)({ ref: "FlightInstance.schedule", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "route"]),
    carrierRelationshipHooks({ route: { model: "route" }, operatingCarrier: { model: "carrier", carrierField: "id" } }),
    commandOwnedRelationshipHooks(["instances"]),
    chronologicalRangeHooks("effectiveFrom", "effectiveTo", "Schedule effective period")
  )
});

// features/keystone/models/InventoryBucket.ts
var import_core24 = require("@keystone-6/core");
var import_fields35 = require("@keystone-6/core/fields");
var InventoryBucket = (0, import_core24.list)({
  access: commandOnlyCarrierAccess("canReadInventory", "canManageInventory"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "bucketKey",
    listView: { initialColumns: ["bucketKey", "flightInstance", "cabin", "bookingClassCode", "sold", "held", "authorized", "status"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields35.relationship)({ ref: "Carrier" }),
    bucketKey: (0, import_fields35.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    flightInstance: (0, import_fields35.relationship)({ ref: "FlightInstance.inventoryBuckets" }),
    cabin: (0, import_fields35.relationship)({ ref: "Cabin.inventoryBuckets" }),
    fareBrand: (0, import_fields35.relationship)({ ref: "FareBrand.inventoryBuckets" }),
    bookingClassCode: (0, import_fields35.text)({
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{1,4}$/, explanation: "Use a one-to-four character booking class." } }
    }),
    capacity: (0, import_fields35.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    authorized: (0, import_fields35.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    sold: (0, import_fields35.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    held: (0, import_fields35.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    blocked: (0, import_fields35.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    baseAmount: (0, import_fields35.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    taxAmount: (0, import_fields35.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    currencyCode: (0, import_fields35.text)({
      defaultValue: "USD",
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } }
    }),
    status: (0, import_fields35.select)({
      type: "enum",
      defaultValue: "open",
      validation: { isRequired: true },
      options: [
        { label: "Open", value: "open" },
        { label: "Closed", value: "closed" },
        { label: "Frozen", value: "frozen" }
      ]
    }),
    holds: (0, import_fields35.relationship)({ ref: "InventoryHold.inventoryBucket", many: true }),
    offerItems: (0, import_fields35.relationship)({ ref: "OfferItem.inventoryBucket", many: true }),
    bookingSegments: (0, import_fields35.relationship)({ ref: "BookingSegment.inventoryBucket", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "flightInstance", "cabin"]),
    carrierRelationshipHooks({ flightInstance: { model: "flightInstance" }, cabin: { model: "cabin" }, fareBrand: { model: "fareBrand" } }),
    commandOwnedRelationshipHooks(["holds", "offerItems", "bookingSegments"]),
    inventoryCountHooks(),
    minorAmountHooks(["baseAmount", "taxAmount"])
  )
});

// features/keystone/models/IdempotencyKey.ts
var import_core25 = require("@keystone-6/core");
var import_access26 = require("@keystone-6/core/access");
var import_fields36 = require("@keystone-6/core/fields");
var IdempotencyKey = (0, import_core25.list)({
  access: {
    operation: {
      query: (args) => hasFreshPermission(args, "canReadAudit", "canManageIntegrations"),
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: freshCarrierFilter }
  },
  graphql: commandOnlyGraphql(),
  ui: { labelField: "key", listView: { initialColumns: ["key", "scope", "status", "resourceType", "resourceId", "createdAt"] }, hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" } },
  fields: {
    carrier: (0, import_fields36.relationship)({ ref: "Carrier" }),
    key: (0, import_fields36.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    scope: (0, import_fields36.text)({ validation: { isRequired: true } }),
    requestHash: (0, import_fields36.text)({ validation: { isRequired: true } }),
    status: (0, import_fields36.select)({ type: "enum", defaultValue: "started", options: [
      { label: "Started", value: "started" },
      { label: "Completed", value: "completed" },
      { label: "Failed", value: "failed" }
    ] }),
    actor: (0, import_fields36.relationship)({ ref: "User" }),
    approvedAgent: (0, import_fields36.relationship)({ ref: "ApprovedAgent" }),
    resourceType: (0, import_fields36.text)(),
    resourceId: (0, import_fields36.text)(),
    result: (0, import_fields36.json)({ access: { read: import_access26.denyAll, create: () => false, update: () => false }, ui: hiddenSensitiveUi }),
    lockedAt: (0, import_fields36.timestamp)({ defaultValue: { kind: "now" } }),
    completedAt: (0, import_fields36.timestamp)(),
    expiresAt: (0, import_fields36.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/IntegrationProvider.ts
var import_core26 = require("@keystone-6/core");
var import_fields38 = require("@keystone-6/core/fields");
var IntegrationProvider = (0, import_core26.list)({
  access: carrierScopedAccess("canReadIntegrations", "canManageIntegrations"),
  ui: { labelField: "name", listView: { initialColumns: ["name", "code", "type", "status", "carrier"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields38.relationship)({ ref: "Carrier" }),
    providerKey: (0, import_fields38.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    name: (0, import_fields38.text)({ validation: { isRequired: true } }),
    code: (0, import_fields38.text)({ validation: { isRequired: true } }),
    type: (0, import_fields38.select)({ type: "enum", validation: { isRequired: true }, options: [
      { label: "NDC", value: "ndc" },
      { label: "GDS", value: "gds" },
      { label: "DCS", value: "dcs" },
      { label: "Identity", value: "identity" },
      { label: "Baggage", value: "baggage" },
      { label: "Notification", value: "notification" },
      { label: "Loyalty", value: "loyalty" },
      { label: "Other", value: "other" }
    ] }),
    status: (0, import_fields38.select)({ type: "enum", defaultValue: "active", options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
      { label: "Deprecated", value: "deprecated" }
    ] }),
    adapterModule: (0, import_fields38.text)({ validation: { isRequired: true } }),
    capabilities: (0, import_fields38.json)({ defaultValue: [] }),
    connections: (0, import_fields38.relationship)({ ref: "ProviderConnection.provider", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  },
  hooks: requiredRelationshipHooks(["carrier"])
});

// features/keystone/models/InventoryHold.ts
var import_core27 = require("@keystone-6/core");
var import_fields39 = require("@keystone-6/core/fields");
var holdExpiryHooks = {
  validate({ operation, resolvedData, item, addValidationError }) {
    const expiresAt = resolvedData.expiresAt ?? item?.expiresAt;
    if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
      addValidationError("Hold expiry must be a valid timestamp.");
      return;
    }
    if (operation === "create" && new Date(expiresAt) <= /* @__PURE__ */ new Date()) {
      addValidationError("A new inventory hold must expire in the future.");
    }
  }
};
var InventoryHold = (0, import_core27.list)({
  access: commandOnlyCarrierAccess("canReadInventory", "canManageInventory"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "holdKey",
    listView: { initialColumns: ["holdKey", "inventoryBucket", "offer", "quantity", "status", "expiresAt"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields39.relationship)({ ref: "Carrier" }),
    holdKey: (0, import_fields39.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    inventoryBucket: (0, import_fields39.relationship)({ ref: "InventoryBucket.holds" }),
    offer: (0, import_fields39.relationship)({ ref: "Offer.inventoryHolds" }),
    quantity: (0, import_fields39.integer)({ validation: { isRequired: true, min: 1 } }),
    status: (0, import_fields39.select)({
      type: "enum",
      defaultValue: "active",
      validation: { isRequired: true },
      options: [
        { label: "Active", value: "active" },
        { label: "Converted", value: "converted" },
        { label: "Released", value: "released" },
        { label: "Expired", value: "expired" }
      ]
    }),
    expiresAt: (0, import_fields39.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    convertedAt: (0, import_fields39.timestamp)(),
    releasedAt: (0, import_fields39.timestamp)(),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "inventoryBucket", "offer"]),
    lifecycleHooks("inventoryHold"),
    holdExpiryHooks
  )
});

// features/keystone/models/MachineCredential.ts
var import_core28 = require("@keystone-6/core");
var import_access30 = require("@keystone-6/core/access");
var import_fields40 = require("@keystone-6/core/fields");
var MachineCredential = (0, import_core28.list)({
  access: commandOnlyCarrierAccess("canReadIntegrations", "canManageIntegrations"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "name", hideCreate: true, hideDelete: true, listView: { initialColumns: ["name", "keyId", "audience", "status", "expiresAt", "lastUsedAt"] } },
  fields: {
    carrier: (0, import_fields40.relationship)({ ref: "Carrier.machineCredentials", access: immutableFieldAccess }),
    name: (0, import_fields40.text)({ validation: { isRequired: true } }),
    keyId: (0, import_fields40.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    tokenHash: (0, import_fields40.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: import_access30.denyAll, create: import_access30.denyAll, update: import_access30.denyAll }, ui: hiddenSensitiveUi }),
    tokenPreview: (0, import_fields40.text)({ access: immutableFieldAccess }),
    audience: (0, import_fields40.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    scopes: (0, import_fields40.json)({ defaultValue: [], access: immutableFieldAccess }),
    status: (0, import_fields40.select)({ type: "enum", defaultValue: "active", options: [
      { label: "Active", value: "active" },
      { label: "Revoked", value: "revoked" },
      { label: "Expired", value: "expired" }
    ] }),
    expiresAt: (0, import_fields40.timestamp)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    lastUsedAt: (0, import_fields40.timestamp)(),
    revokedAt: (0, import_fields40.timestamp)(),
    ...trackingFields
  },
  hooks: requiredRelationshipHooks(["carrier"])
});

// features/keystone/models/ManualPaymentEvidence.ts
var import_core29 = require("@keystone-6/core");
var import_fields42 = require("@keystone-6/core/fields");
var ManualPaymentEvidence = (0, import_core29.list)({
  access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "evidenceKey", hideCreate: true, hideDelete: true, listView: { initialColumns: ["booking", "purpose", "externalReference", "amount", "currencyCode", "status", "submittedBy", "approvedBy"] } },
  fields: {
    carrier: (0, import_fields42.relationship)({ ref: "Carrier.manualPaymentEvidence", access: immutableFieldAccess }),
    evidenceKey: (0, import_fields42.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    purpose: (0, import_fields42.select)({ type: "enum", options: [{ label: "Capture", value: "capture" }, { label: "Refund", value: "refund" }], validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields42.relationship)({ ref: "Booking.manualPaymentEvidence", access: immutableFieldAccess }),
    payment: (0, import_fields42.relationship)({ ref: "Payment.manualPaymentEvidence", access: immutableFieldAccess }),
    ledgerEntry: (0, import_fields42.relationship)({ ref: "SettlementLedgerEntry.evidence", access: immutableFieldAccess }),
    externalReference: (0, import_fields42.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    ledgerSource: (0, import_fields42.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    evidenceDigest: (0, import_fields42.text)({ isIndexed: true, validation: { isRequired: true, match: { regex: /^[a-f0-9]{64}$/i, explanation: "Use a SHA-256 evidence digest." } }, access: immutableFieldAccess }),
    amount: (0, import_fields42.integer)({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    currencyCode: (0, import_fields42.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: (0, import_fields42.select)({ type: "enum", defaultValue: "submitted", options: [
      { label: "Submitted", value: "submitted" },
      { label: "Approved", value: "approved" },
      { label: "Rejected", value: "rejected" },
      { label: "Consumed", value: "consumed" }
    ] }),
    submittedBy: (0, import_fields42.relationship)({ ref: "User.submittedPaymentEvidence", access: immutableFieldAccess }),
    approvedBy: (0, import_fields42.relationship)({ ref: "User.approvedPaymentEvidence" }),
    submittedAt: (0, import_fields42.timestamp)({ defaultValue: { kind: "now" }, access: immutableFieldAccess }),
    approvedAt: (0, import_fields42.timestamp)(),
    consumedAt: (0, import_fields42.timestamp)(),
    rejectionReason: (0, import_fields42.text)(),
    ...trackingFields
  },
  hooks: combineListHooks(requiredRelationshipHooks(["carrier", "booking", "ledgerEntry", "submittedBy"]), minorAmountHooks(["amount"]))
});

// features/keystone/models/Journey.ts
var import_core30 = require("@keystone-6/core");
var import_fields44 = require("@keystone-6/core/fields");
var Journey = (0, import_core30.list)({
  access: commandOnlyCarrierAccess("canReadBookings", "canManageBookings"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "journeyKey",
    listView: { initialColumns: ["journeyKey", "booking", "sequence", "origin", "destination", "status"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields44.relationship)({ ref: "Carrier" }),
    journeyKey: (0, import_fields44.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    booking: (0, import_fields44.relationship)({ ref: "Booking.journeys" }),
    sequence: (0, import_fields44.integer)({ validation: { isRequired: true, min: 1 } }),
    origin: (0, import_fields44.relationship)({ ref: "Airport" }),
    destination: (0, import_fields44.relationship)({ ref: "Airport" }),
    status: (0, import_fields44.select)({
      type: "enum",
      defaultValue: "planned",
      options: [
        { label: "Planned", value: "planned" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Disrupted", value: "disrupted" },
        { label: "Cancelled", value: "cancelled" }
      ]
    }),
    segments: (0, import_fields44.relationship)({ ref: "BookingSegment.journey", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "origin", "destination"]),
    lifecycleHooks("journey")
  )
});

// features/keystone/models/Offer.ts
var import_core31 = require("@keystone-6/core");
var import_fields45 = require("@keystone-6/core/fields");
var offerInvariantHooks = {
  validate({ operation, resolvedData, item, addValidationError }) {
    const value = (key) => Number(resolvedData[key] ?? item?.[key] ?? 0);
    const base = value("baseAmount");
    const tax = value("taxAmount");
    const fee = value("feeAmount");
    const discount = value("discountAmount");
    const total = value("totalAmount");
    if (base + tax + fee - discount !== total) {
      addValidationError("Offer total must equal base plus tax and fees minus discounts.");
    }
    const expiresAt = resolvedData.expiresAt ?? item?.expiresAt;
    const status = resolvedData.status ?? item?.status ?? "draft";
    if (["available", "held"].includes(status)) {
      const expiry = new Date(expiresAt);
      if (!expiresAt || Number.isNaN(expiry.getTime())) {
        addValidationError("A sellable offer requires a valid expiry timestamp.");
      } else if (operation === "create" && expiry <= /* @__PURE__ */ new Date()) {
        addValidationError("A sellable offer must expire in the future.");
      }
    }
  }
};
var Offer = (0, import_core31.list)({
  access: commandOnlyCarrierAccess("canReadOffers", "canManageOffers"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "offerNumber",
    listView: { initialColumns: ["offerNumber", "status", "source", "totalAmount", "currencyCode", "expiresAt"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields45.relationship)({ ref: "Carrier" }),
    offerNumber: (0, import_fields45.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    shoppingSessionId: (0, import_fields45.text)({ isIndexed: true }),
    idempotencyKey: (0, import_fields45.text)({ isIndexed: "unique" }),
    status: (0, import_fields45.select)({
      type: "enum",
      defaultValue: "draft",
      validation: { isRequired: true },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Available", value: "available" },
        { label: "Held", value: "held" },
        { label: "Accepted", value: "accepted" },
        { label: "Expired", value: "expired" },
        { label: "Withdrawn", value: "withdrawn" }
      ]
    }),
    source: (0, import_fields45.select)({
      type: "enum",
      defaultValue: "direct",
      options: [
        { label: "Direct", value: "direct" },
        { label: "Website", value: "website" },
        { label: "Call center", value: "call_center" },
        { label: "Approved agent", value: "agent" },
        { label: "NDC", value: "ndc" },
        { label: "GDS", value: "gds" }
      ]
    }),
    expiresAt: (0, import_fields45.timestamp)({ isIndexed: true }),
    baseAmount: (0, import_fields45.integer)({ defaultValue: 0, validation: { min: 0 } }),
    taxAmount: (0, import_fields45.integer)({ defaultValue: 0, validation: { min: 0 } }),
    feeAmount: (0, import_fields45.integer)({ defaultValue: 0, validation: { min: 0 } }),
    discountAmount: (0, import_fields45.integer)({ defaultValue: 0, validation: { min: 0 } }),
    totalAmount: (0, import_fields45.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields45.text)({
      defaultValue: "USD",
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } }
    }),
    customer: (0, import_fields45.relationship)({ ref: "User.offers" }),
    approvedAgent: (0, import_fields45.relationship)({ ref: "ApprovedAgent.offers" }),
    passengers: (0, import_fields45.relationship)({ ref: "Passenger.offers", many: true }),
    passengerCriteria: (0, import_fields45.json)({ defaultValue: [] }),
    items: (0, import_fields45.relationship)({ ref: "OfferItem.offer", many: true }),
    inventoryHolds: (0, import_fields45.relationship)({ ref: "InventoryHold.offer", many: true }),
    booking: (0, import_fields45.relationship)({ ref: "Booking.sourceOffer" }),
    externalReferences: (0, import_fields45.json)({ defaultValue: {} }),
    metadata: (0, import_fields45.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    lifecycleHooks("offer"),
    minorAmountHooks(["baseAmount", "taxAmount", "feeAmount", "discountAmount", "totalAmount"]),
    offerInvariantHooks
  )
});

// features/keystone/models/OfferItem.ts
var import_core32 = require("@keystone-6/core");
var import_fields46 = require("@keystone-6/core/fields");
var offerItemTotalHooks = {
  validate({ resolvedData, addValidationError }) {
    const quantity = Number(resolvedData.quantity ?? 1);
    const unit = Number(resolvedData.unitAmount ?? 0);
    const base = Number(resolvedData.baseAmount ?? 0);
    const tax = Number(resolvedData.taxAmount ?? 0);
    const fee = Number(resolvedData.feeAmount ?? 0);
    const total = Number(resolvedData.totalAmount ?? 0);
    if (!Number.isSafeInteger(unit * quantity) || unit * quantity !== base) {
      addValidationError("Offer item base amount must equal unit amount multiplied by quantity.");
    }
    if (base + tax + fee !== total) {
      addValidationError("Offer item total must equal base, tax, and fee amounts.");
    }
  }
};
var OfferItem = (0, import_core32.list)({
  access: commandOnlyCarrierAccess("canReadOffers", "canManageOffers"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "itemKey",
    listView: { initialColumns: ["itemKey", "offer", "itemType", "description", "quantity", "totalAmount", "currencyCode"] },
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" }
  },
  fields: {
    carrier: (0, import_fields46.relationship)({ ref: "Carrier" }),
    itemKey: (0, import_fields46.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    offer: (0, import_fields46.relationship)({ ref: "Offer.items" }),
    itemType: (0, import_fields46.select)({
      type: "enum",
      validation: { isRequired: true },
      options: [
        { label: "Flight", value: "flight" },
        { label: "Ancillary", value: "ancillary" },
        { label: "Fee", value: "fee" },
        { label: "Tax", value: "tax" },
        { label: "Discount", value: "discount" }
      ]
    }),
    description: (0, import_fields46.text)({ validation: { isRequired: true } }),
    quantity: (0, import_fields46.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    unitAmount: (0, import_fields46.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    baseAmount: (0, import_fields46.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    taxAmount: (0, import_fields46.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    feeAmount: (0, import_fields46.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    totalAmount: (0, import_fields46.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    currencyCode: (0, import_fields46.text)({
      validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } }
    }),
    flightInstance: (0, import_fields46.relationship)({ ref: "FlightInstance" }),
    inventoryBucket: (0, import_fields46.relationship)({ ref: "InventoryBucket.offerItems" }),
    fareBrand: (0, import_fields46.relationship)({ ref: "FareBrand.offerItems" }),
    fareRule: (0, import_fields46.relationship)({ ref: "FareRule.offerItems" }),
    ancillaryProduct: (0, import_fields46.relationship)({ ref: "AncillaryProduct.offerItems" }),
    passengerReferences: (0, import_fields46.json)({ defaultValue: [] }),
    segmentSnapshot: (0, import_fields46.json)({ defaultValue: {} }),
    productSnapshot: (0, import_fields46.json)({ defaultValue: {} }),
    bookingLineItems: (0, import_fields46.relationship)({ ref: "BookingLineItem.sourceOfferItem", many: true }),
    bookingSegments: (0, import_fields46.relationship)({ ref: "BookingSegment.sourceOfferItem", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "offer"]),
    minorAmountHooks(["unitAmount", "baseAmount", "taxAmount", "feeAmount", "totalAmount"]),
    offerItemTotalHooks
  )
});

// features/keystone/models/OnboardingStep.ts
var import_core33 = require("@keystone-6/core");
var import_fields47 = require("@keystone-6/core/fields");
var OnboardingStep = (0, import_core33.list)({
  access: commandOnlyCarrierAccess("canManageOnboarding", "canManageOnboarding"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "step", hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["step", "status", "attemptCount", "completedAt"] } },
  fields: {
    carrier: (0, import_fields47.relationship)({ ref: "Carrier.onboardingSteps", access: immutableFieldAccess }),
    user: (0, import_fields47.relationship)({ ref: "User.onboardingSteps", access: immutableFieldAccess }),
    progressKey: (0, import_fields47.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    step: (0, import_fields47.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: (0, import_fields47.select)({ type: "enum", defaultValue: "pending", options: [{ label: "Pending", value: "pending" }, { label: "Completed", value: "completed" }, { label: "Needs attention", value: "needs_attention" }] }),
    attemptCount: (0, import_fields47.integer)({ defaultValue: 0, validation: { min: 0 } }),
    inputDigest: (0, import_fields47.text)({ access: immutableFieldAccess }),
    requirements: (0, import_fields47.json)({ defaultValue: [] }),
    completedAt: (0, import_fields47.timestamp)(),
    lastAttemptedAt: (0, import_fields47.timestamp)(),
    ...trackingFields
  },
  hooks: requiredRelationshipHooks(["carrier", "user"])
});

// features/keystone/models/OutboxEvent.ts
var import_core34 = require("@keystone-6/core");
var import_fields49 = require("@keystone-6/core/fields");
var OutboxEvent = (0, import_core34.list)({
  access: commandOnlyCarrierAccess("canReadAudit", "canManageIntegrations"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "eventKey", hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["topic", "aggregateType", "aggregateId", "status", "attemptCount", "availableAt"] } },
  fields: {
    carrier: (0, import_fields49.relationship)({ ref: "Carrier.outboxEvents", access: immutableFieldAccess }),
    eventKey: (0, import_fields49.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    topic: (0, import_fields49.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    aggregateType: (0, import_fields49.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    aggregateId: (0, import_fields49.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    payload: (0, import_fields49.json)({ defaultValue: {}, access: immutableFieldAccess }),
    status: (0, import_fields49.select)({ type: "enum", defaultValue: "pending", options: [
      { label: "Pending", value: "pending" },
      { label: "Processing", value: "processing" },
      { label: "Delivered", value: "delivered" },
      { label: "Failed", value: "failed" },
      { label: "Dead lettered", value: "dead_lettered" }
    ] }),
    attemptCount: (0, import_fields49.integer)({ defaultValue: 0, validation: { min: 0 } }),
    availableAt: (0, import_fields49.timestamp)({ defaultValue: { kind: "now" } }),
    leasedAt: (0, import_fields49.timestamp)(),
    leaseOwner: (0, import_fields49.text)(),
    lastError: (0, import_fields49.text)(),
    deliveredAt: (0, import_fields49.timestamp)(),
    ...trackingFields
  },
  hooks: requiredRelationshipHooks(["carrier"])
});

// features/keystone/models/Passenger.ts
var import_core35 = require("@keystone-6/core");
var import_fields51 = require("@keystone-6/core/fields");
var Passenger = (0, import_core35.list)({
  access: carrierScopedAccess("canReadPassengers", "canManagePassengers"),
  ui: {
    labelField: "familyName",
    listView: { initialColumns: ["givenName", "familyName", "dateOfBirth", "email", "status", "carrier"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields51.relationship)({ ref: "Carrier" }),
    passengerKey: (0, import_fields51.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    title: (0, import_fields51.text)(),
    givenName: (0, import_fields51.text)({ validation: { isRequired: true } }),
    middleNames: (0, import_fields51.text)(),
    familyName: (0, import_fields51.text)({ validation: { isRequired: true } }),
    suffix: (0, import_fields51.text)(),
    dateOfBirth: (0, import_fields51.timestamp)(),
    genderMarker: (0, import_fields51.select)({
      type: "enum",
      options: [
        { label: "Female", value: "female" },
        { label: "Male", value: "male" },
        { label: "Unspecified", value: "unspecified" },
        { label: "Undisclosed", value: "undisclosed" }
      ]
    }),
    nationalityCode: (0, import_fields51.text)({
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z]{2}$/, explanation: "Use an ISO 3166-1 alpha-2 code." } }
    }),
    email: (0, import_fields51.text)(),
    phone: (0, import_fields51.text)(),
    preferredLanguage: (0, import_fields51.text)({ defaultValue: "en" }),
    status: (0, import_fields51.select)({
      type: "enum",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Merged", value: "merged" },
        { label: "Restricted", value: "restricted" },
        { label: "Archived", value: "archived" }
      ]
    }),
    loyaltyPrograms: (0, import_fields51.json)({ defaultValue: [] }),
    preferences: (0, import_fields51.json)({ defaultValue: {} }),
    userAccount: (0, import_fields51.relationship)({ ref: "User.passengerProfile" }),
    travelDocuments: (0, import_fields51.relationship)({ ref: "TravelDocument.passenger", many: true }),
    documentVerifications: (0, import_fields51.relationship)({ ref: "DocumentVerification.passenger", many: true }),
    bookingPassengers: (0, import_fields51.relationship)({ ref: "BookingPassenger.passenger", many: true }),
    offers: (0, import_fields51.relationship)({ ref: "Offer.passengers", many: true }),
    serviceRequests: (0, import_fields51.relationship)({ ref: "ServiceRequest.passenger", many: true }),
    tickets: (0, import_fields51.relationship)({ ref: "Ticket.passenger", many: true }),
    electronicMiscDocuments: (0, import_fields51.relationship)({ ref: "ElectronicMiscDocument.passenger", many: true }),
    seatAssignments: (0, import_fields51.relationship)({ ref: "SeatAssignment.passenger", many: true }),
    checkIns: (0, import_fields51.relationship)({ ref: "CheckIn.passenger", many: true }),
    boardingPasses: (0, import_fields51.relationship)({ ref: "BoardingPass.passenger", many: true }),
    bags: (0, import_fields51.relationship)({ ref: "Bag.passenger", many: true }),
    reaccommodations: (0, import_fields51.relationship)({ ref: "Reaccommodation.passenger", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    carrierRelationshipHooks({ userAccount: { model: "user" } }),
    commandOwnedRelationshipHooks(["travelDocuments", "documentVerifications", "bookingPassengers", "offers", "serviceRequests", "tickets", "electronicMiscDocuments", "seatAssignments", "checkIns", "boardingPasses", "bags", "reaccommodations"])
  )
});

// features/keystone/models/Payment.ts
var import_core36 = require("@keystone-6/core");
var import_fields52 = require("@keystone-6/core/fields");
var import_access39 = require("@keystone-6/core/access");
var managePayments = (args) => hasFreshPermission(args, "canManagePayments");
var Payment = (0, import_core36.list)({
  access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "paymentKey",
    listView: { initialColumns: ["paymentKey", "booking", "provider", "status", "amount", "capturedAmount", "refundedAmount"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields52.relationship)({ ref: "Carrier" }),
    paymentKey: (0, import_fields52.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    idempotencyKey: (0, import_fields52.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields52.relationship)({ ref: "Booking.payments", access: immutableFieldAccess }),
    provider: (0, import_fields52.relationship)({ ref: "PaymentProvider.payments", access: immutableFieldAccess }),
    session: (0, import_fields52.relationship)({ ref: "PaymentSession.payment", access: immutableFieldAccess }),
    status: (0, import_fields52.select)({
      type: "enum",
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Captured", value: "captured" },
        { label: "Partially refunded", value: "partially_refunded" },
        { label: "Refunded", value: "refunded" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" }
      ]
    }),
    amount: (0, import_fields52.integer)({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
    authorizedAmount: (0, import_fields52.integer)({ defaultValue: 0, validation: { min: 0 } }),
    capturedAmount: (0, import_fields52.integer)({ defaultValue: 0, validation: { min: 0 } }),
    refundedAmount: (0, import_fields52.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields52.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    providerPaymentId: (0, import_fields52.text)({ isIndexed: true, access: immutableFieldAccess }),
    providerCaptureId: (0, import_fields52.text)(),
    instrumentBrand: (0, import_fields52.text)(),
    instrumentLast4: (0, import_fields52.text)({
      db: { isNullable: true },
      validation: { match: { regex: /^\d{4}$/, explanation: "Store only four digits." } }
    }),
    rawProviderData: (0, import_fields52.json)({ access: { read: import_access39.denyAll, create: managePayments, update: managePayments }, ui: hiddenSensitiveUi }),
    failureCode: (0, import_fields52.text)(),
    failureMessage: (0, import_fields52.text)(),
    authorizedAt: (0, import_fields52.timestamp)(),
    capturedAt: (0, import_fields52.timestamp)(),
    cancelledAt: (0, import_fields52.timestamp)(),
    refunds: (0, import_fields52.relationship)({ ref: "Refund.payment", many: true }),
    manualPaymentEvidence: (0, import_fields52.relationship)({ ref: "ManualPaymentEvidence.payment", many: true }),
    metadata: (0, import_fields52.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "provider"]),
    lifecycleHooks("payment"),
    minorAmountHooks(["amount", "authorizedAmount", "capturedAmount", "refundedAmount"])
  )
});

// features/keystone/models/PaymentProvider.ts
var import_core37 = require("@keystone-6/core");
var import_access41 = require("@keystone-6/core/access");
var import_fields54 = require("@keystone-6/core/fields");

// features/keystone/lib/bounded-payment-policy.ts
function isEvidenceOnlyManualProvider(provider) {
  if (provider.adapterType !== "manual") return false;
  if (!provider.configuration || typeof provider.configuration !== "object" || Array.isArray(provider.configuration)) return false;
  const configuration = provider.configuration;
  return configuration.providerExecution === false && configuration.requiresIndependentApproval === true;
}

// features/keystone/models/PaymentProvider.ts
var managePaymentSecrets = (args) => hasFreshPermission(args, "canManagePayments");
var PaymentProvider = (0, import_core37.list)({
  access: carrierScopedAccess("canReadPayments", "canManagePayments"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "adapterType", "status", "carrier"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields54.relationship)({ ref: "Carrier" }),
    providerKey: (0, import_fields54.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    name: (0, import_fields54.text)({ validation: { isRequired: true } }),
    code: (0, import_fields54.text)({ validation: { isRequired: true } }),
    adapterType: (0, import_fields54.select)({
      type: "enum",
      defaultValue: "manual",
      options: [
        { label: "Stripe", value: "stripe" },
        { label: "PayPal", value: "paypal" },
        { label: "Manual", value: "manual" },
        { label: "Custom", value: "custom" }
      ]
    }),
    status: (0, import_fields54.select)({
      type: "enum",
      defaultValue: "inactive",
      options: [
        { label: "Inactive", value: "inactive" },
        { label: "Active", value: "active" },
        { label: "Degraded", value: "degraded" },
        { label: "Disabled", value: "disabled" }
      ]
    }),
    credentials: (0, import_fields54.json)({
      defaultValue: {},
      access: { read: import_access41.denyAll, create: managePaymentSecrets, update: managePaymentSecrets },
      ui: hiddenSensitiveUi
    }),
    configuration: (0, import_fields54.json)({ defaultValue: {} }),
    createPaymentFunction: (0, import_fields54.text)({ validation: { isRequired: true } }),
    capturePaymentFunction: (0, import_fields54.text)({ validation: { isRequired: true } }),
    refundPaymentFunction: (0, import_fields54.text)({ validation: { isRequired: true } }),
    getPaymentStatusFunction: (0, import_fields54.text)({ validation: { isRequired: true } }),
    handleWebhookFunction: (0, import_fields54.text)({ validation: { isRequired: true } }),
    sessions: (0, import_fields54.relationship)({ ref: "PaymentSession.provider", many: true, access: { create: () => false, update: () => false } }),
    payments: (0, import_fields54.relationship)({ ref: "Payment.provider", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    { validate({ resolvedData, item, addValidationError }) {
      const status = resolvedData.status ?? item?.status;
      const provider = {
        adapterType: resolvedData.adapterType ?? item?.adapterType ?? null,
        configuration: resolvedData.configuration ?? item?.configuration ?? null
      };
      if (status === "active" && !isEvidenceOnlyManualProvider(provider)) addValidationError("Active payment providers must be configured for evidence-only manual settlement with independent approval.");
    } }
  )
});

// features/keystone/models/PaymentSession.ts
var import_core38 = require("@keystone-6/core");
var import_fields56 = require("@keystone-6/core/fields");
var canManagePayments = (args) => hasFreshPermission(args, "canManagePayments");
var PaymentSession = (0, import_core38.list)({
  access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "sessionKey",
    listView: { initialColumns: ["sessionKey", "booking", "provider", "status", "amount", "currencyCode", "expiresAt"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields56.relationship)({ ref: "Carrier" }),
    sessionKey: (0, import_fields56.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields56.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    booking: (0, import_fields56.relationship)({ ref: "Booking.paymentSessions" }),
    provider: (0, import_fields56.relationship)({ ref: "PaymentProvider.sessions" }),
    payment: (0, import_fields56.relationship)({ ref: "Payment.session" }),
    status: (0, import_fields56.select)({
      type: "enum",
      defaultValue: "created",
      options: [
        { label: "Created", value: "created" },
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Captured", value: "captured" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Expired", value: "expired" }
      ]
    }),
    amount: (0, import_fields56.integer)({ validation: { isRequired: true, min: 0 } }),
    currencyCode: (0, import_fields56.text)({ validation: { isRequired: true } }),
    providerSessionId: (0, import_fields56.text)({ isIndexed: true }),
    providerData: (0, import_fields56.json)({
      defaultValue: {},
      access: { read: canManagePayments, create: canManagePayments, update: canManagePayments },
      ui: hiddenSensitiveUi
    }),
    expiresAt: (0, import_fields56.timestamp)(),
    authorizedAt: (0, import_fields56.timestamp)(),
    completedAt: (0, import_fields56.timestamp)(),
    failureCode: (0, import_fields56.text)(),
    failureMessage: (0, import_fields56.text)(),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "provider"]),
    lifecycleHooks("paymentSession"),
    minorAmountHooks(["amount"])
  )
});

// features/keystone/models/ProviderConnection.ts
var import_core39 = require("@keystone-6/core");
var import_access44 = require("@keystone-6/core/access");
var import_fields58 = require("@keystone-6/core/fields");
var manageIntegrations = (args) => hasFreshPermission(args, "canManageIntegrations");
var ProviderConnection = (0, import_core39.list)({
  access: commandOnlyCarrierAccess("canReadIntegrations", "canManageIntegrations"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "name", listView: { initialColumns: ["name", "provider", "status", "externalAccountId", "lastSucceededAt"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields58.relationship)({ ref: "Carrier.providerConnections" }),
    connectionKey: (0, import_fields58.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    provider: (0, import_fields58.relationship)({ ref: "IntegrationProvider.connections" }),
    name: (0, import_fields58.text)({ validation: { isRequired: true } }),
    status: (0, import_fields58.select)({ type: "enum", defaultValue: "pending", options: [
      { label: "Pending", value: "pending" },
      { label: "Active", value: "active" },
      { label: "Paused", value: "paused" },
      { label: "Failed", value: "failed" },
      { label: "Revoked", value: "revoked" }
    ] }),
    credentials: (0, import_fields58.json)({
      defaultValue: {},
      access: { read: import_access44.denyAll, create: manageIntegrations, update: manageIntegrations },
      ui: hiddenSensitiveUi
    }),
    configuration: (0, import_fields58.json)({ defaultValue: {} }),
    capabilities: (0, import_fields58.json)({ defaultValue: [] }),
    externalAccountId: (0, import_fields58.text)(),
    lastAttemptedAt: (0, import_fields58.timestamp)(),
    lastSucceededAt: (0, import_fields58.timestamp)(),
    lastErrorCode: (0, import_fields58.text)(),
    lastErrorMessage: (0, import_fields58.text)(),
    webhookEndpoints: (0, import_fields58.relationship)({ ref: "WebhookEndpoint.connection", many: true }),
    webhookEvents: (0, import_fields58.relationship)({ ref: "WebhookEvent.connection", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "provider"]),
    lifecycleHooks("providerConnection")
  )
});

// features/keystone/models/Reaccommodation.ts
var import_core40 = require("@keystone-6/core");
var import_fields60 = require("@keystone-6/core/fields");
var Reaccommodation = (0, import_core40.list)({
  access: commandOnlyCarrierAccess("canReadDisruptions", "canManageDisruptions"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "reaccommodationKey", listView: { initialColumns: ["booking", "passenger", "disruption", "status", "optionExpiresAt"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields60.relationship)({ ref: "Carrier" }),
    reaccommodationKey: (0, import_fields60.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    idempotencyKey: (0, import_fields60.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields60.relationship)({ ref: "Booking.reaccommodations", access: immutableFieldAccess }),
    bookingPassenger: (0, import_fields60.relationship)({ ref: "BookingPassenger.reaccommodations", access: immutableFieldAccess }),
    passenger: (0, import_fields60.relationship)({ ref: "Passenger.reaccommodations", access: immutableFieldAccess }),
    disruption: (0, import_fields60.relationship)({ ref: "Disruption.reaccommodations", access: immutableFieldAccess }),
    status: (0, import_fields60.select)({ type: "enum", defaultValue: "proposed", options: [
      { label: "Proposed", value: "proposed" },
      { label: "Accepted", value: "accepted" },
      { label: "Confirmed", value: "confirmed" },
      { label: "Declined", value: "declined" },
      { label: "Failed", value: "failed" },
      { label: "Expired", value: "expired" },
      { label: "Cancelled", value: "cancelled" }
    ] }),
    originalSegments: (0, import_fields60.relationship)({ ref: "BookingSegment.reaccommodationsAsOriginal", many: true, access: immutableFieldAccess }),
    replacementSegments: (0, import_fields60.relationship)({ ref: "BookingSegment.reaccommodationsAsReplacement", many: true }),
    replacementOffer: (0, import_fields60.relationship)({ ref: "Offer" }),
    optionExpiresAt: (0, import_fields60.timestamp)({ access: immutableFieldAccess }),
    priceDifferenceAmount: (0, import_fields60.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    additionalCollectionAmount: (0, import_fields60.integer)({ defaultValue: 0, validation: { min: 0 } }),
    refundAmount: (0, import_fields60.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields60.text)({ defaultValue: "USD", access: immutableFieldAccess }),
    acceptedAt: (0, import_fields60.timestamp)(),
    confirmedAt: (0, import_fields60.timestamp)(),
    reason: (0, import_fields60.text)(),
    optionSnapshot: (0, import_fields60.json)({ defaultValue: {}, access: immutableFieldAccess }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "disruption"]),
    lifecycleHooks("reaccommodation"),
    minorAmountHooks(["priceDifferenceAmount", "additionalCollectionAmount", "refundAmount"])
  )
});

// features/keystone/models/Refund.ts
var import_core41 = require("@keystone-6/core");
var import_fields62 = require("@keystone-6/core/fields");
var Refund = (0, import_core41.list)({
  access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "refundKey", listView: { initialColumns: ["refundKey", "booking", "payment", "status", "amount", "reason"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields62.relationship)({ ref: "Carrier" }),
    refundKey: (0, import_fields62.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    idempotencyKey: (0, import_fields62.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields62.relationship)({ ref: "Booking.refunds", access: immutableFieldAccess }),
    payment: (0, import_fields62.relationship)({ ref: "Payment.refunds", access: immutableFieldAccess }),
    status: (0, import_fields62.select)({ type: "enum", defaultValue: "requested", options: [
      { label: "Requested", value: "requested" },
      { label: "Approved", value: "approved" },
      { label: "Processing", value: "processing" },
      { label: "Succeeded", value: "succeeded" },
      { label: "Failed", value: "failed" },
      { label: "Cancelled", value: "cancelled" }
    ] }),
    reason: (0, import_fields62.select)({ type: "enum", defaultValue: "customer_request", options: [
      { label: "Customer request", value: "customer_request" },
      { label: "Disruption", value: "disruption" },
      { label: "Schedule change", value: "schedule_change" },
      { label: "Duplicate", value: "duplicate" },
      { label: "Fraud", value: "fraud" },
      { label: "Other", value: "other" }
    ] }),
    amount: (0, import_fields62.integer)({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
    currencyCode: (0, import_fields62.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    providerRefundId: (0, import_fields62.text)({ isIndexed: true }),
    note: (0, import_fields62.text)({ ui: { displayMode: "textarea" } }),
    requestedAt: (0, import_fields62.timestamp)({ defaultValue: { kind: "now" }, access: immutableFieldAccess }),
    approvedAt: (0, import_fields62.timestamp)(),
    processedAt: (0, import_fields62.timestamp)(),
    errorMessage: (0, import_fields62.text)(),
    metadata: (0, import_fields62.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "payment"]),
    lifecycleHooks("refund"),
    minorAmountHooks(["amount"])
  )
});

// features/keystone/models/RateLimitBucket.ts
var import_core42 = require("@keystone-6/core");
var import_fields64 = require("@keystone-6/core/fields");
var RateLimitBucket = (0, import_core42.list)({
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    key: (0, import_fields64.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    scope: (0, import_fields64.text)({ validation: { isRequired: true } }),
    count: (0, import_fields64.integer)({ defaultValue: 0, validation: { min: 0 } }),
    windowStartedAt: (0, import_fields64.timestamp)({ validation: { isRequired: true } }),
    expiresAt: (0, import_fields64.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core43 = require("@keystone-6/core");
var import_fields65 = require("@keystone-6/core/fields");
var canReadRolesAccess = (args) => isFreshSignedIn(args);
async function roleReadFilter(args) {
  if (!await isFreshSignedIn(args)) return false;
  if (await hasFreshPermission(args, "canReadRoles", "canManageRoles")) return freshCarrierFilter(args);
  return { assignedTo: { some: { id: { equals: args.session.itemId } } } };
}
var canReadRolesUi = (args) => hasPermission(args, "canReadRoles") || hasPermission(args, "canManageRoles");
var Role = (0, import_core43.list)({
  access: {
    operation: {
      query: canReadRolesAccess,
      create: (args) => hasFreshPermission(args, "canManageRoles"),
      update: (args) => hasFreshPermission(args, "canManageRoles"),
      delete: (args) => hasFreshPermission(args, "canManageRoles")
    },
    filter: {
      query: roleReadFilter,
      update: freshCarrierFilter,
      delete: freshCarrierFilter
    },
    item: {
      create: canCreateForSessionCarrier,
      update: canUpdateForSessionCarrier
    }
  },
  ui: {
    hideCreate: (args) => !hasPermission(args, "canManageRoles"),
    hideDelete: (args) => !hasPermission(args, "canManageRoles"),
    isHidden: (args) => !canReadRolesUi(args),
    listView: { initialColumns: ["name", "carrier", "assignedTo"] }
  },
  fields: {
    name: (0, import_fields65.text)({ validation: { isRequired: true } }),
    carrier: (0, import_fields65.relationship)({ ref: "Carrier.roles" }),
    ...permissionFields,
    assignedTo: (0, import_fields65.relationship)({ ref: "User.role", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Route.ts
var import_core44 = require("@keystone-6/core");
var import_fields67 = require("@keystone-6/core/fields");
var Route = (0, import_core44.list)({
  access: carrierScopedAccess("canReadNetwork", "canManageNetwork"),
  ui: {
    labelField: "routeKey",
    listView: { initialColumns: ["routeKey", "origin", "destination", "status", "distanceKilometers"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields67.relationship)({ ref: "Carrier.routes" }),
    routeKey: (0, import_fields67.text)({
      isIndexed: "unique",
      validation: { isRequired: true, match: { regex: /^[A-Z0-9]{2,3}:[A-Z0-9]{3}:[A-Z0-9]{3}$/, explanation: "Use CARRIER:ORIGIN:DESTINATION." } }
    }),
    origin: (0, import_fields67.relationship)({ ref: "Airport.departingRoutes" }),
    destination: (0, import_fields67.relationship)({ ref: "Airport.arrivingRoutes" }),
    status: (0, import_fields67.select)({
      type: "enum",
      defaultValue: "active",
      validation: { isRequired: true },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ]
    }),
    distanceKilometers: (0, import_fields67.integer)({ validation: { min: 0 } }),
    minimumConnectionMinutes: (0, import_fields67.integer)({ validation: { min: 0 } }),
    isInternational: (0, import_fields67.checkbox)({ defaultValue: false }),
    schedules: (0, import_fields67.relationship)({ ref: "FlightSchedule.route", many: true }),
    flightInstances: (0, import_fields67.relationship)({ ref: "FlightInstance.route", many: true }),
    fareRules: (0, import_fields67.relationship)({ ref: "FareRule.route", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "origin", "destination"]),
    commandOwnedRelationshipHooks(["schedules", "flightInstances", "fareRules"])
  )
});

// features/keystone/models/Seat.ts
var import_core45 = require("@keystone-6/core");
var import_fields68 = require("@keystone-6/core/fields");
var Seat = (0, import_core45.list)({
  access: carrierScopedAccess("canReadNetwork", "canManageNetwork"),
  ui: {
    labelField: "designator",
    listView: { initialColumns: ["designator", "seatMap", "cabin", "status", "surchargeAmount"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields68.relationship)({ ref: "Carrier" }),
    seatKey: (0, import_fields68.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    seatMap: (0, import_fields68.relationship)({ ref: "SeatMap.seats" }),
    cabin: (0, import_fields68.relationship)({ ref: "Cabin.seats" }),
    designator: (0, import_fields68.text)({ validation: { isRequired: true } }),
    rowNumber: (0, import_fields68.integer)({ validation: { isRequired: true, min: 1 } }),
    columnCode: (0, import_fields68.text)({ validation: { isRequired: true } }),
    status: (0, import_fields68.select)({
      type: "enum",
      defaultValue: "available",
      options: [
        { label: "Available", value: "available" },
        { label: "Blocked", value: "blocked" },
        { label: "Unavailable", value: "unavailable" }
      ]
    }),
    seatType: (0, import_fields68.select)({
      type: "enum",
      defaultValue: "standard",
      options: [
        { label: "Standard", value: "standard" },
        { label: "Preferred", value: "preferred" },
        { label: "Extra legroom", value: "extra_legroom" },
        { label: "Bassinet", value: "bassinet" },
        { label: "Restricted", value: "restricted" }
      ]
    }),
    characteristics: (0, import_fields68.json)({ defaultValue: [] }),
    surchargeAmount: (0, import_fields68.integer)({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: (0, import_fields68.text)({ defaultValue: "USD", validation: { isRequired: true } }),
    assignments: (0, import_fields68.relationship)({ ref: "SeatAssignment.seat", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "seatMap", "cabin"]),
    carrierRelationshipHooks({ seatMap: { model: "seatMap" }, cabin: { model: "cabin" } }),
    commandOwnedRelationshipHooks(["assignments"]),
    minorAmountHooks(["surchargeAmount"])
  )
});

// features/keystone/models/SeatAssignment.ts
var import_core46 = require("@keystone-6/core");
var import_fields69 = require("@keystone-6/core/fields");
var SeatAssignment = (0, import_core46.list)({
  access: stationScopedCommandAccess("canReadAirportService", "canManageAirportService", "bookingSegment.flightInstance.origin", "canCheckIn"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "assignmentKey",
    listView: { initialColumns: ["booking", "passenger", "bookingSegment", "seat", "status", "assignedAt"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields69.relationship)({ ref: "Carrier" }),
    assignmentKey: (0, import_fields69.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    occupancyKey: (0, import_fields69.text)({ isIndexed: "unique", db: { isNullable: true }, access: immutableFieldAccess }),
    booking: (0, import_fields69.relationship)({ ref: "Booking.seatAssignments", access: immutableFieldAccess }),
    bookingPassenger: (0, import_fields69.relationship)({ ref: "BookingPassenger.seatAssignments", access: immutableFieldAccess }),
    passenger: (0, import_fields69.relationship)({ ref: "Passenger.seatAssignments", access: immutableFieldAccess }),
    bookingSegment: (0, import_fields69.relationship)({ ref: "BookingSegment.seatAssignments", access: immutableFieldAccess }),
    seat: (0, import_fields69.relationship)({ ref: "Seat.assignments", access: immutableFieldAccess }),
    status: (0, import_fields69.select)({
      type: "enum",
      defaultValue: "held",
      options: [
        { label: "Held", value: "held" },
        { label: "Assigned", value: "assigned" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Boarded", value: "boarded" },
        { label: "Released", value: "released" },
        { label: "Cancelled", value: "cancelled" }
      ]
    }),
    seatDesignatorSnapshot: (0, import_fields69.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    cabinCodeSnapshot: (0, import_fields69.text)({ access: immutableFieldAccess }),
    characteristicsSnapshot: (0, import_fields69.json)({ defaultValue: [], access: immutableFieldAccess }),
    amount: (0, import_fields69.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    currencyCode: (0, import_fields69.text)({ defaultValue: "USD", access: immutableFieldAccess }),
    assignedAt: (0, import_fields69.timestamp)(),
    confirmedAt: (0, import_fields69.timestamp)(),
    releasedAt: (0, import_fields69.timestamp)(),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "bookingPassenger", "passenger", "bookingSegment", "seat"]),
    lifecycleHooks("seatAssignment"),
    minorAmountHooks(["amount"])
  )
});

// features/keystone/models/SeatMap.ts
var import_core47 = require("@keystone-6/core");
var import_fields71 = require("@keystone-6/core/fields");
var SeatMap = (0, import_core47.list)({
  access: commandOnlyCarrierAccess("canReadNetwork", "canManageNetwork"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "mapKey",
    listView: { initialColumns: ["mapKey", "flightInstance", "version", "status", "createdAt"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields71.relationship)({ ref: "Carrier" }),
    mapKey: (0, import_fields71.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    flightInstance: (0, import_fields71.relationship)({ ref: "FlightInstance.seatMaps" }),
    version: (0, import_fields71.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    status: (0, import_fields71.select)({
      type: "enum",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
        { label: "Retired", value: "retired" }
      ]
    }),
    layoutSnapshot: (0, import_fields71.json)({ defaultValue: {} }),
    seats: (0, import_fields71.relationship)({ ref: "Seat.seatMap", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "flightInstance"]),
    lifecycleHooks("seatMap")
  )
});

// features/keystone/models/SettlementLedgerEntry.ts
var import_core48 = require("@keystone-6/core");
var import_fields72 = require("@keystone-6/core/fields");
var SettlementLedgerEntry = (0, import_core48.list)({
  access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "externalReference", hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["externalReference", "ledgerSource", "amount", "currencyCode", "occurredAt", "importedAt"] } },
  fields: {
    carrier: (0, import_fields72.relationship)({ ref: "Carrier.settlementLedgerEntries", access: immutableFieldAccess }),
    connection: (0, import_fields72.relationship)({ ref: "ProviderConnection", access: immutableFieldAccess }),
    ledgerKey: (0, import_fields72.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    externalReference: (0, import_fields72.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    ledgerSource: (0, import_fields72.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    evidenceDigest: (0, import_fields72.text)({ isIndexed: true, validation: { isRequired: true, match: { regex: /^[a-f0-9]{64}$/i, explanation: "Use a SHA-256 evidence digest." } }, access: immutableFieldAccess }),
    amount: (0, import_fields72.integer)({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    currencyCode: (0, import_fields72.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    occurredAt: (0, import_fields72.timestamp)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    importedAt: (0, import_fields72.timestamp)({ defaultValue: { kind: "now" }, access: immutableFieldAccess }),
    importedByCredentialId: (0, import_fields72.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    sourceMetadata: (0, import_fields72.json)({ defaultValue: {}, access: immutableFieldAccess }),
    evidence: (0, import_fields72.relationship)({ ref: "ManualPaymentEvidence.ledgerEntry", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(requiredRelationshipHooks(["carrier"]), minorAmountHooks(["amount"]))
});

// features/keystone/models/StationAssignment.ts
var import_core49 = require("@keystone-6/core");
var import_fields74 = require("@keystone-6/core/fields");
var StationAssignment = (0, import_core49.list)({
  access: carrierScopedAccess("canReadUsers", "canManageUsers"),
  ui: { labelField: "assignmentKey", listView: { initialColumns: ["user", "airport", "status", "validFrom", "validUntil"] } },
  fields: {
    carrier: (0, import_fields74.relationship)({ ref: "Carrier.stationAssignments" }),
    assignmentKey: (0, import_fields74.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    user: (0, import_fields74.relationship)({ ref: "User.stationAssignments" }),
    airport: (0, import_fields74.relationship)({ ref: "Airport.stationAssignments" }),
    status: (0, import_fields74.select)({ type: "enum", defaultValue: "active", options: [
      { label: "Active", value: "active" },
      { label: "Suspended", value: "suspended" },
      { label: "Revoked", value: "revoked" }
    ] }),
    canCheckIn: (0, import_fields74.checkbox)({ defaultValue: false }),
    canAcceptBags: (0, import_fields74.checkbox)({ defaultValue: false }),
    canBoard: (0, import_fields74.checkbox)({ defaultValue: false }),
    validFrom: (0, import_fields74.timestamp)({ defaultValue: { kind: "now" } }),
    validUntil: (0, import_fields74.timestamp)(),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "user", "airport"]),
    carrierRelationshipHooks({ user: { model: "user" } })
  )
});

// features/keystone/models/ServiceRequest.ts
var import_core50 = require("@keystone-6/core");
var import_fields75 = require("@keystone-6/core/fields");
var ServiceRequest = (0, import_core50.list)({
  access: commandOnlyCarrierAccess("canReadBookings", "canManageBookings"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "requestKey",
    listView: { initialColumns: ["requestKey", "booking", "passenger", "code", "category", "status"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields75.relationship)({ ref: "Carrier" }),
    requestKey: (0, import_fields75.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    booking: (0, import_fields75.relationship)({ ref: "Booking.serviceRequests" }),
    passenger: (0, import_fields75.relationship)({ ref: "Passenger.serviceRequests" }),
    bookingPassenger: (0, import_fields75.relationship)({ ref: "BookingPassenger" }),
    bookingSegment: (0, import_fields75.relationship)({ ref: "BookingSegment.serviceRequests" }),
    code: (0, import_fields75.text)({ validation: { isRequired: true } }),
    category: (0, import_fields75.select)({
      type: "enum",
      defaultValue: "ssr",
      options: [
        { label: "Special service request", value: "ssr" },
        { label: "Other service information", value: "osi" },
        { label: "Accessibility", value: "accessibility" },
        { label: "Meal", value: "meal" },
        { label: "Assistance", value: "assistance" },
        { label: "Other", value: "other" }
      ]
    }),
    status: (0, import_fields75.select)({
      type: "enum",
      defaultValue: "requested",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Pending", value: "pending" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Fulfilled", value: "fulfilled" },
        { label: "Unable", value: "unable" },
        { label: "Cancelled", value: "cancelled" }
      ]
    }),
    travelerText: (0, import_fields75.text)(),
    internalNotes: (0, import_fields75.text)({ ui: { displayMode: "textarea" } }),
    serviceData: (0, import_fields75.json)({ defaultValue: {} }),
    confirmedAt: (0, import_fields75.timestamp)(),
    fulfilledAt: (0, import_fields75.timestamp)(),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "passenger"]),
    lifecycleHooks("serviceRequest")
  )
});

// features/keystone/models/Ticket.ts
var import_core51 = require("@keystone-6/core");
var import_fields76 = require("@keystone-6/core/fields");
var Ticket = (0, import_core51.list)({
  access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "ticketNumber",
    listView: { initialColumns: ["ticketNumber", "booking", "passenger", "status", "totalAmount", "currencyCode", "issuedAt"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields76.relationship)({ ref: "Carrier" }),
    ticketNumber: (0, import_fields76.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    booking: (0, import_fields76.relationship)({ ref: "Booking.tickets", access: immutableFieldAccess }),
    bookingPassenger: (0, import_fields76.relationship)({ ref: "BookingPassenger.tickets", access: immutableFieldAccess }),
    passenger: (0, import_fields76.relationship)({ ref: "Passenger.tickets", access: immutableFieldAccess }),
    issuingCarrierCode: (0, import_fields76.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    validatingCarrierCode: (0, import_fields76.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: (0, import_fields76.select)({
      type: "enum",
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Issued", value: "issued" },
        { label: "Partially used", value: "partially_used" },
        { label: "Used", value: "used" },
        { label: "Suspended", value: "suspended" },
        { label: "Voided", value: "voided" },
        { label: "Refunded", value: "refunded" },
        { label: "Exchanged", value: "exchanged" }
      ]
    }),
    totalAmount: (0, import_fields76.integer)({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
    currencyCode: (0, import_fields76.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    issuedAt: (0, import_fields76.timestamp)({ access: immutableFieldAccess }),
    voidedAt: (0, import_fields76.timestamp)(),
    refundedAt: (0, import_fields76.timestamp)(),
    providerReference: (0, import_fields76.text)({ access: immutableFieldAccess }),
    originalTicket: (0, import_fields76.relationship)({ ref: "Ticket.reissuedTickets", access: immutableFieldAccess }),
    reissuedTickets: (0, import_fields76.relationship)({ ref: "Ticket.originalTicket", many: true }),
    coupons: (0, import_fields76.relationship)({ ref: "TicketCoupon.ticket", many: true }),
    metadata: (0, import_fields76.json)({ defaultValue: {} }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "booking", "bookingPassenger", "passenger"]),
    lifecycleHooks("ticket"),
    minorAmountHooks(["totalAmount"])
  )
});

// features/keystone/models/TicketCoupon.ts
var import_core52 = require("@keystone-6/core");
var import_fields78 = require("@keystone-6/core/fields");
var TicketCoupon = (0, import_core52.list)({
  access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "couponKey",
    listView: { initialColumns: ["ticket", "couponNumber", "bookingSegment", "status", "amount"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields78.relationship)({ ref: "Carrier" }),
    couponKey: (0, import_fields78.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    ticket: (0, import_fields78.relationship)({ ref: "Ticket.coupons", access: immutableFieldAccess }),
    serviceObligation: (0, import_fields78.relationship)({ ref: "ServiceObligation.ticketCoupons", access: immutableFieldAccess }),
    serviceObligationVersion: (0, import_fields78.integer)({ validation: { isRequired: true, min: 1 }, db: { isNullable: true }, access: immutableFieldAccess }),
    bookingSegment: (0, import_fields78.relationship)({ ref: "BookingSegment.ticketCoupons", access: immutableFieldAccess }),
    couponNumber: (0, import_fields78.integer)({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    status: (0, import_fields78.select)({
      type: "enum",
      defaultValue: "open",
      options: [
        { label: "Open", value: "open" },
        { label: "Checked in", value: "checked_in" },
        { label: "Boarded", value: "boarded" },
        { label: "Flown", value: "flown" },
        { label: "Suspended", value: "suspended" },
        { label: "Voided", value: "voided" },
        { label: "Refunded", value: "refunded" },
        { label: "Exchanged", value: "exchanged" }
      ]
    }),
    fareBasisCode: (0, import_fields78.text)({ access: immutableFieldAccess }),
    bookingClassCode: (0, import_fields78.text)({ access: immutableFieldAccess }),
    amount: (0, import_fields78.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
    currencyCode: (0, import_fields78.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    usedAt: (0, import_fields78.timestamp)(),
    entitlementSnapshot: (0, import_fields78.json)({ defaultValue: {}, access: immutableFieldAccess }),
    checkedInAt: (0, import_fields78.timestamp)(),
    checkIns: (0, import_fields78.relationship)({ ref: "CheckIn.ticketCoupon", many: true }),
    bags: (0, import_fields78.relationship)({ ref: "Bag.ticketCoupon", many: true }),
    lineageAsParent: (0, import_fields78.relationship)({ ref: "TicketCouponLineage.parentCoupon", many: true }),
    lineageAsChild: (0, import_fields78.relationship)({ ref: "TicketCouponLineage.childCoupon", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "ticket", "bookingSegment", "serviceObligation"]),
    lifecycleHooks("ticketCoupon"),
    minorAmountHooks(["amount"])
  )
});

// features/keystone/models/TicketCouponLineage.ts
var import_core53 = require("@keystone-6/core");
var import_fields80 = require("@keystone-6/core/fields");
var TicketCouponLineage = (0, import_core53.list)({
  access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "lineageKey",
    listView: { initialColumns: ["lineageKey", "transformation", "parentCoupon", "childCoupon", "changeSetKey"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields80.relationship)({ ref: "Carrier.ticketCouponLineages", access: immutableFieldAccess }),
    bookingPassenger: (0, import_fields80.relationship)({ ref: "BookingPassenger.ticketCouponLineages", access: immutableFieldAccess }),
    lineageKey: (0, import_fields80.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    changeSetKey: (0, import_fields80.text)({ isIndexed: true, validation: { isRequired: true }, access: immutableFieldAccess }),
    transformation: (0, import_fields80.select)({
      type: "enum",
      validation: { isRequired: true },
      access: immutableFieldAccess,
      options: [
        { label: "Alternative", value: "alternative" },
        { label: "Connection split", value: "split" },
        { label: "Consolidation", value: "consolidation" }
      ]
    }),
    operationType: (0, import_fields80.select)({
      type: "enum",
      validation: { isRequired: true },
      access: immutableFieldAccess,
      options: [
        { label: "Exchange", value: "exchange" },
        { label: "Reaccommodation", value: "reaccommodation" },
        { label: "Servicing", value: "servicing" }
      ]
    }),
    operationId: (0, import_fields80.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    parentCoupon: (0, import_fields80.relationship)({ ref: "TicketCoupon.lineageAsParent", access: immutableFieldAccess }),
    childCoupon: (0, import_fields80.relationship)({ ref: "TicketCoupon.lineageAsChild", access: immutableFieldAccess }),
    metadata: (0, import_fields80.json)({ defaultValue: {}, access: immutableFieldAccess }),
    ...trackingFields
  },
  hooks: combineListHooks(requiredRelationshipHooks(["carrier", "bookingPassenger", "parentCoupon", "childCoupon"]))
});

// features/keystone/models/ServiceObligation.ts
var import_core54 = require("@keystone-6/core");
var import_fields82 = require("@keystone-6/core/fields");
var ServiceObligation = (0, import_core54.list)({
  access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "obligationKey",
    listView: { initialColumns: ["obligationKey", "bookingPassenger", "currentVersion", "status"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields82.relationship)({ ref: "Carrier.serviceObligations", access: immutableFieldAccess }),
    booking: (0, import_fields82.relationship)({ ref: "Booking.serviceObligations", access: immutableFieldAccess }),
    bookingPassenger: (0, import_fields82.relationship)({ ref: "BookingPassenger.serviceObligations", access: immutableFieldAccess }),
    obligationKey: (0, import_fields82.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    currentVersion: (0, import_fields82.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
    status: (0, import_fields82.select)({
      type: "enum",
      defaultValue: "active",
      validation: { isRequired: true },
      access: immutableFieldAccess,
      options: [
        { label: "Active", value: "active" },
        { label: "Fulfilled", value: "fulfilled" },
        { label: "Retired", value: "retired" }
      ]
    }),
    ticketCoupons: (0, import_fields82.relationship)({ ref: "TicketCoupon.serviceObligation", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(requiredRelationshipHooks(["carrier", "booking", "bookingPassenger"]))
});

// features/keystone/models/TravelDocument.ts
var import_core55 = require("@keystone-6/core");
var import_fields84 = require("@keystone-6/core/fields");
var secureAccess = {
  read: canReadSecurePassengerData,
  create: canReadSecurePassengerData,
  update: canReadSecurePassengerData
};
var TravelDocument = (0, import_core55.list)({
  access: commandOnlyCarrierAccess("canManageSecurePassengerData", "canManageSecurePassengerData"),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: "documentNumberLast4",
    listView: { initialColumns: ["passenger", "documentType", "issuingCountryCode", "expiresAt", "status"] },
    hideDelete: true
  },
  fields: {
    carrier: (0, import_fields84.relationship)({ ref: "Carrier" }),
    passenger: (0, import_fields84.relationship)({ ref: "Passenger.travelDocuments" }),
    documentType: (0, import_fields84.select)({
      type: "enum",
      validation: { isRequired: true },
      options: [
        { label: "Passport", value: "passport" },
        { label: "National identity card", value: "national_id" },
        { label: "Residence permit", value: "residence_permit" },
        { label: "Visa", value: "visa" },
        { label: "Known traveler credential", value: "known_traveler" },
        { label: "Redress credential", value: "redress" },
        { label: "Other", value: "other" }
      ]
    }),
    documentNumberToken: (0, import_fields84.text)({
      access: secureAccess,
      ui: hiddenSensitiveUi,
      db: { isNullable: true }
    }),
    documentNumberHash: (0, import_fields84.text)({
      isIndexed: true,
      access: secureAccess,
      ui: hiddenSensitiveUi,
      db: { isNullable: true },
      validation: {
        match: {
          regex: /^[a-f0-9]{64}$/i,
          explanation: "Store only a SHA-256 hex lookup digest."
        }
      }
    }),
    encryptedPayload: (0, import_fields84.text)({
      access: secureAccess,
      ui: hiddenSensitiveUi,
      db: { nativeType: "Text", isNullable: true }
    }),
    documentNumberLast4: (0, import_fields84.text)({
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z0-9]{4}$/, explanation: "Store only the final four characters." } }
    }),
    issuingCountryCode: (0, import_fields84.text)({
      validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: "Use an ISO 3166-1 alpha-2 code." } }
    }),
    nationalityCode: (0, import_fields84.text)({
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z]{2}$/, explanation: "Use an ISO 3166-1 alpha-2 code." } }
    }),
    issuedAt: (0, import_fields84.timestamp)(),
    expiresAt: (0, import_fields84.timestamp)(),
    status: (0, import_fields84.select)({
      type: "enum",
      defaultValue: "unverified",
      options: [
        { label: "Unverified", value: "unverified" },
        { label: "Verified", value: "verified" },
        { label: "Rejected", value: "rejected" },
        { label: "Expired", value: "expired" },
        { label: "Revoked", value: "revoked" }
      ]
    }),
    verificationProviderReference: (0, import_fields84.text)({ access: secureAccess, ui: hiddenSensitiveUi }),
    verifiedAt: (0, import_fields84.timestamp)(),
    verifiedBy: (0, import_fields84.relationship)({ ref: "User" }),
    verifications: (0, import_fields84.relationship)({ ref: "DocumentVerification.travelDocument", many: true }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier", "passenger"]),
    travelDocumentHooks()
  )
});

// features/keystone/models/User.ts
var import_core56 = require("@keystone-6/core");
var import_access61 = require("@keystone-6/core/access");
var import_fields86 = require("@keystone-6/core/fields");
var canCreateUser = (args) => args.session ? hasFreshPermission(args, "canManageUsers", "canManageCarriers") : false;
var canManageUsersAccess = (args) => hasFreshPermission(args, "canManageUsers", "canManageCarriers");
var canManageUsersUi = (args) => hasPermission(args, "canManageUsers") || hasPermission(args, "canManageCarriers");
function connectedId2(value) {
  return typeof value?.connect?.id === "string" ? value.connect.id : typeof value?.id === "string" ? value.id : null;
}
async function canAssignCarrierRelationship(args, model) {
  const mayAssign = model === "role" ? await canManageUsersAccess(args) : await hasFreshPermission(args, "canManageUsers", "canManageCarriers", "canManageAgents");
  if (!mayAssign) return false;
  if (args.inputData?.[model] === void 0 || args.inputData[model]?.disconnect === true) return true;
  const relatedId = connectedId2(args.inputData[model]);
  const carrierId = args.item?.carrierId ?? connectedId2(args.inputData?.carrier);
  if (!relatedId || !carrierId) return false;
  const related = await args.context.prisma[model].findUnique({ where: { id: relatedId }, select: { carrierId: true } });
  return related?.carrierId === carrierId;
}
var User = (0, import_core56.list)({
  access: {
    operation: {
      query: isFreshSignedIn,
      create: canCreateUser,
      update: isFreshSignedIn,
      delete: canManageUsersAccess
    },
    filter: {
      query: userReadFilter,
      update: userUpdateFilter,
      delete: userUpdateFilter
    },
    item: {
      // Public signup cannot set carrier/role fields; authenticated managers
      // must create users in their own carrier unless they are platform admins.
      create: (args) => !args.session || canCreateForSessionCarrier(args),
      update: canUpdateForSessionCarrier
    }
  },
  ui: {
    hideCreate: (args) => !canManageUsersUi(args),
    hideDelete: (args) => !canManageUsersUi(args),
    listView: { initialColumns: ["name", "email", "carrier", "role", "approvedAgent"] },
    itemView: {
      defaultFieldMode: ({ session, item }) => canManageUsersUi({ session }) || session?.itemId === item?.id ? "edit" : "read"
    }
  },
  fields: {
    name: (0, import_fields86.text)({ validation: { isRequired: true } }),
    email: (0, import_fields86.text)({
      isIndexed: "unique",
      validation: { isRequired: true },
      isFilterable: false,
      isOrderable: false,
      access: { create: canManageUsersAccess, update: canManageTargetUser }
    }),
    password: (0, import_fields86.password)({
      access: {
        read: import_access61.denyAll,
        create: canManageUsersAccess,
        update: canManageTargetUser
      },
      validation: {
        isRequired: true,
        length: { min: 10, max: 1e3 },
        rejectCommon: true
      }
    }),
    carrier: (0, import_fields86.relationship)({
      ref: "Carrier.users",
      access: { create: canManageUsersAccess, update: canManageUsersAccess }
    }),
    role: (0, import_fields86.relationship)({
      ref: "Role.assignedTo",
      access: {
        create: (args) => canAssignCarrierRelationship(args, "role").then((allowed) => allowed && canAssignUserRole(args)),
        update: (args) => canAssignCarrierRelationship(args, "role").then((allowed) => allowed && canAssignUserRole(args))
      }
    }),
    approvedAgent: (0, import_fields86.relationship)({
      ref: "ApprovedAgent.users",
      access: {
        create: (args) => canAssignCarrierRelationship(args, "approvedAgent"),
        update: (args) => canAssignCarrierRelationship(args, "approvedAgent")
      }
    }),
    onboardingStatus: (0, import_fields86.select)({
      type: "enum",
      defaultValue: "not_started",
      options: [
        { label: "Not started", value: "not_started" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" }
      ],
      access: { create: () => false, update: () => false },
      graphql: { omit: { create: true, update: true } }
    }),
    passengerProfile: (0, import_fields86.relationship)({ ref: "Passenger.userAccount", access: { create: () => false, update: () => false } }),
    offers: (0, import_fields86.relationship)({ ref: "Offer.customer", many: true, access: { create: () => false, update: () => false } }),
    bookings: (0, import_fields86.relationship)({ ref: "Booking.customer", many: true, access: { create: () => false, update: () => false } }),
    auditEvents: (0, import_fields86.relationship)({ ref: "AuditEvent.actor", many: true, access: { create: () => false, update: () => false } }),
    stationAssignments: (0, import_fields86.relationship)({ ref: "StationAssignment.user", many: true, access: { create: () => false, update: () => false } }),
    documentVerifications: (0, import_fields86.relationship)({ ref: "DocumentVerification.verifiedBy", many: true, access: { create: () => false, update: () => false } }),
    submittedPaymentEvidence: (0, import_fields86.relationship)({ ref: "ManualPaymentEvidence.submittedBy", many: true, access: { create: () => false, update: () => false } }),
    approvedPaymentEvidence: (0, import_fields86.relationship)({ ref: "ManualPaymentEvidence.approvedBy", many: true, access: { create: () => false, update: () => false } }),
    onboardingSteps: (0, import_fields86.relationship)({ ref: "OnboardingStep.user", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/WebhookEndpoint.ts
var import_node_crypto = __toESM(require("node:crypto"));
var import_core57 = require("@keystone-6/core");
var import_access63 = require("@keystone-6/core/access");
var import_fields87 = require("@keystone-6/core/fields");
var manageIntegrations2 = (args) => hasFreshPermission(args, "canManageIntegrations");
var WebhookEndpoint = (0, import_core57.list)({
  access: carrierScopedAccess("canReadIntegrations", "canManageIntegrations"),
  ui: { labelField: "name", listView: { initialColumns: ["name", "url", "status", "failureCount", "lastDeliveredAt"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields87.relationship)({ ref: "Carrier" }),
    endpointKey: (0, import_fields87.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    connection: (0, import_fields87.relationship)({ ref: "ProviderConnection.webhookEndpoints" }),
    name: (0, import_fields87.text)({ validation: { isRequired: true } }),
    url: (0, import_fields87.text)({ validation: { isRequired: true } }),
    eventTypes: (0, import_fields87.json)({ defaultValue: [] }),
    status: (0, import_fields87.select)({ type: "enum", defaultValue: "active", options: [
      { label: "Active", value: "active" },
      { label: "Paused", value: "paused" },
      { label: "Failed", value: "failed" },
      { label: "Disabled", value: "disabled" }
    ] }),
    secret: (0, import_fields87.text)({
      access: { read: import_access63.denyAll, create: manageIntegrations2, update: manageIntegrations2 },
      ui: hiddenSensitiveUi,
      hooks: { resolveInput: ({ operation, resolvedData }) => operation === "create" && !resolvedData.secret ? import_node_crypto.default.randomBytes(32).toString("hex") : resolvedData.secret }
    }),
    failureCount: (0, import_fields87.integer)({ defaultValue: 0, validation: { min: 0 } }),
    lastAttemptedAt: (0, import_fields87.timestamp)(),
    lastDeliveredAt: (0, import_fields87.timestamp)(),
    nextAttemptAt: (0, import_fields87.timestamp)(),
    events: (0, import_fields87.relationship)({ ref: "WebhookEvent.endpoint", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    carrierRelationshipHooks({ connection: { model: "providerConnection" } })
  )
});

// features/keystone/models/WebhookEvent.ts
var import_core58 = require("@keystone-6/core");
var import_fields89 = require("@keystone-6/core/fields");
var manageIntegrations3 = (args) => hasFreshPermission(args, "canManageIntegrations");
var WebhookEvent = (0, import_core58.list)({
  access: commandOnlyCarrierAccess("canReadIntegrations", "canManageIntegrations"),
  graphql: commandOnlyGraphql(),
  ui: { labelField: "eventKey", listView: { initialColumns: ["eventKey", "direction", "eventType", "status", "attemptCount", "occurredAt"] }, hideDelete: true },
  fields: {
    carrier: (0, import_fields89.relationship)({ ref: "Carrier" }),
    eventKey: (0, import_fields89.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    dedupeKey: (0, import_fields89.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    providerEventId: (0, import_fields89.text)({ isIndexed: true, access: immutableFieldAccess }),
    connection: (0, import_fields89.relationship)({ ref: "ProviderConnection.webhookEvents", access: immutableFieldAccess }),
    endpoint: (0, import_fields89.relationship)({ ref: "WebhookEndpoint.events", access: immutableFieldAccess }),
    direction: (0, import_fields89.select)({ type: "enum", validation: { isRequired: true }, access: immutableFieldAccess, options: [
      { label: "Inbound", value: "inbound" },
      { label: "Outbound", value: "outbound" }
    ] }),
    eventType: (0, import_fields89.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    resourceType: (0, import_fields89.text)({ access: immutableFieldAccess }),
    resourceId: (0, import_fields89.text)({ access: immutableFieldAccess }),
    status: (0, import_fields89.select)({ type: "enum", defaultValue: "pending", options: [
      { label: "Pending", value: "pending" },
      { label: "Processing", value: "processing" },
      { label: "Succeeded", value: "succeeded" },
      { label: "Failed", value: "failed" },
      { label: "Dead lettered", value: "dead_lettered" }
    ] }),
    signatureVerified: (0, import_fields89.checkbox)({ defaultValue: false }),
    payload: (0, import_fields89.json)({
      access: { read: manageIntegrations3, create: manageIntegrations3, update: manageIntegrations3 },
      ui: hiddenSensitiveUi
    }),
    payloadSummary: (0, import_fields89.json)({ defaultValue: {} }),
    attemptCount: (0, import_fields89.integer)({ defaultValue: 0, validation: { min: 0 } }),
    occurredAt: (0, import_fields89.timestamp)({ defaultValue: { kind: "now" }, access: immutableFieldAccess }),
    lastAttemptedAt: (0, import_fields89.timestamp)(),
    nextAttemptAt: (0, import_fields89.timestamp)(),
    completedAt: (0, import_fields89.timestamp)(),
    responseStatus: (0, import_fields89.integer)(),
    errorCode: (0, import_fields89.text)(),
    errorMessage: (0, import_fields89.text)(),
    ...trackingFields
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(["carrier"]),
    lifecycleHooks("webhookEvent")
  )
});

// features/keystone/models/WorkerHeartbeat.ts
var import_core59 = require("@keystone-6/core");
var import_fields91 = require("@keystone-6/core/fields");
var WorkerHeartbeat = (0, import_core59.list)({
  access: {
    operation: { query: (args) => hasFreshPermission(args, "canReadAudit"), create: () => false, update: () => false, delete: () => false }
  },
  graphql: commandOnlyGraphql(),
  ui: { labelField: "workerKey", hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["workerKey", "component", "status", "lastSeenAt"] } },
  fields: {
    workerKey: (0, import_fields91.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
    component: (0, import_fields91.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: (0, import_fields91.select)({ type: "enum", defaultValue: "running", options: [{ label: "Running", value: "running" }, { label: "Draining", value: "draining" }, { label: "Stopped", value: "stopped" }] }),
    lastSeenAt: (0, import_fields91.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    metadata: (0, import_fields91.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  Carrier,
  Airport,
  ApprovedAgent,
  Route,
  FlightSchedule,
  FlightInstance,
  Cabin,
  InventoryBucket,
  InventoryHold,
  FareBrand,
  FareRule,
  AncillaryProduct,
  Offer,
  OfferItem,
  Passenger,
  TravelDocument,
  DocumentVerification,
  Booking,
  BookingPassenger,
  Journey,
  BookingSegment,
  BookingLineItem,
  ServiceRequest,
  Ticket,
  TicketCoupon,
  ServiceObligation,
  TicketCouponLineage,
  ElectronicMiscDocument,
  ElectronicMiscCoupon,
  SeatMap,
  Seat,
  SeatAssignment,
  PaymentProvider,
  PaymentSession,
  SettlementLedgerEntry,
  ManualPaymentEvidence,
  Payment,
  Refund,
  Exchange,
  CheckIn,
  BoardingPass,
  Bag,
  BagEvent,
  Disruption,
  Reaccommodation,
  StationAssignment,
  IntegrationProvider,
  ProviderConnection,
  WebhookEndpoint,
  WebhookEvent,
  MachineCredential,
  OutboxEvent,
  OnboardingStep,
  RateLimitBucket,
  IdempotencyKey,
  AuditEvent,
  WorkerHeartbeat
};

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/lib/initial-operator-setup.ts
function initialOperatorSetupEnabled(env = process.env) {
  return env.NODE_ENV !== "production" || env.ALLOW_INITIAL_OPERATOR_SETUP === "true";
}

// features/keystone/mutations/redirectToInit.ts
async function shouldRedirectToInitialOperatorSetup(context, env = process.env) {
  if (!initialOperatorSetupEnabled(env)) return false;
  const userCount = await context.sudo().query.User.count({});
  return userCount === 0;
}
async function redirectToInit(_root, _args, context) {
  return shouldRedirectToInitialOperatorSetup(context);
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/airlineOperations.ts
var import_node_crypto3 = __toESM(require("node:crypto"));
var import_client = require("@prisma/client");

// features/keystone/lib/storefront-session.ts
var import_node_crypto2 = __toESM(require("node:crypto"));
function normalizeStorefrontToken(value) {
  const token = value?.trim();
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new Error("A valid shopping-session token is required.");
  return token;
}
function hashStorefrontToken(value) {
  return import_node_crypto2.default.createHash("sha256").update(normalizeStorefrontToken(value)).digest("hex");
}
function hasCurrentStorefrontBookingAccess(booking, expectedHash, now = /* @__PURE__ */ new Date()) {
  if (!expectedHash || booking.accessTokenHash !== expectedHash || !booking.accessTokenExpiresAt) return false;
  const expiresAt = booking.accessTokenExpiresAt instanceof Date ? booking.accessTokenExpiresAt : new Date(booking.accessTokenExpiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}
function isStorefrontContext(context) {
  return context.session?.data?.storefront === true;
}
function withStorefrontSession(context, carrier, bookingId) {
  return context.withSession({
    itemId: "",
    listKey: "User",
    data: { name: "Storefront", email: "", carrier, approvedAgent: null, role: null, storefront: true, storefrontBookingId: bookingId }
  });
}

// features/keystone/lib/transactions.ts
var SERIALIZABLE_TRANSACTION_OPTIONS = {
  isolationLevel: "Serializable",
  maxWait: 5e3,
  timeout: 2e4
};
function sortUniqueIds(ids) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}
function throwIfKeystonePrismaError(value) {
  if (!value || typeof value !== "object") return;
  const candidate = value;
  if (candidate.extensions?.code !== "KS_PRISMA_ERROR") return;
  const prisma = candidate.extensions.prisma ?? {};
  const message = typeof prisma.message === "string" ? prisma.message : typeof candidate.message === "string" ? candidate.message : "Prisma error";
  throw Object.assign(new Error(message), prisma);
}
function isSerializableWriteConflict(error) {
  if (!error || typeof error !== "object") return false;
  const candidate = error;
  const prismaCode = candidate.meta?.code ?? candidate.extensions?.prisma?.code ?? candidate.extensions?.prisma?.meta?.code;
  const message = [
    candidate.message,
    candidate.extensions?.prisma?.message,
    candidate.extensions?.message
  ].filter((value) => typeof value === "string").join(" ");
  return candidate.code === "P2034" || prismaCode === "P2034" || candidate.code === "P2010" && candidate.meta?.code === "40001" || prismaCode === "40001" || /serialization failure|could not serialize access|transaction failed due to a write conflict|deadlock/i.test(message);
}
async function runSerializableTransaction(context, work, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await context.transaction(
        work,
        SERIALIZABLE_TRANSACTION_OPTIONS
      );
    } catch (error) {
      if (!isSerializableWriteConflict(error)) throw error;
      if (attempt === maxAttempts) {
        throw new Error("The record changed concurrently; retry the request.");
      }
    }
  }
  throw new Error("The record changed concurrently; retry the request.");
}

// features/keystone/mutations/airlineOperations.ts
var sensitiveAuditKey = /authorization|cookie|credential|document|password|payload|secret|token/i;
function sanitizeAuditMetadata(value, depth = 0) {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 500);
  if (depth >= 3) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeAuditMetadata(item, depth + 1));
  if (typeof value !== "object") return String(value).slice(0, 500);
  return Object.fromEntries(
    Object.entries(value).slice(0, 30).map(([key, item]) => [
      key.slice(0, 100),
      sensitiveAuditKey.test(key) ? "[REDACTED]" : sanitizeAuditMetadata(item, depth + 1)
    ])
  );
}
function normalizeIdempotencyKey(value) {
  const key = value?.trim();
  if (!key || key.length < 12 || key.length > 200) {
    throw new Error("A 12-to-200 character idempotency key is required.");
  }
  return key;
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([name, entry]) => [name, canonicalize(entry)])
    );
  }
  return value;
}
function sha256(value) {
  return import_node_crypto3.default.createHash("sha256").update(value).digest("hex");
}
function idempotencyStorageKey(carrierId, scope, key) {
  return sha256(`${carrierId}\0${scope}\0${key}`);
}
function idempotencyRequestHash(request) {
  return sha256(JSON.stringify(canonicalize(request)));
}
async function findIdempotencyRecord(sudo, storageKey) {
  const records = await sudo.query.IdempotencyKey.findMany({
    where: { key: { equals: storageKey } },
    take: 1,
    query: "id key scope requestHash status resourceType resourceId result carrier { id }"
  });
  return records[0] ?? null;
}
async function inspectOperation(sudo, carrierId, key, scope, request) {
  const storageKey = idempotencyStorageKey(carrierId, scope, key);
  const requestHash = idempotencyRequestHash(request);
  const existing = await findIdempotencyRecord(sudo, storageKey);
  if (!existing) return { storageKey, requestHash };
  if (existing.carrier?.id !== carrierId || existing.scope !== scope || existing.requestHash !== requestHash) {
    throw new Error("This idempotency key was already used for a different request.");
  }
  if (existing.status === "completed") return { storageKey, requestHash, replay: existing };
  throw new Error("An operation with this idempotency key is already in progress or failed.");
}
async function beginOperation(sudo, context, carrierId, key, scope, request) {
  const inspected = await inspectOperation(sudo, carrierId, key, scope, request);
  if (inspected.replay) return inspected;
  const record = await sudo.query.IdempotencyKey.createOne({
    data: {
      carrier: { connect: { id: carrierId } },
      key: inspected.storageKey,
      scope,
      requestHash: inspected.requestHash,
      status: "started",
      actor: context.session?.itemId ? { connect: { id: context.session.itemId } } : void 0,
      approvedAgent: context.session?.data?.approvedAgent?.id ? { connect: { id: context.session.data.approvedAgent.id } } : void 0,
      lockedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    query: "id key status"
  });
  return { ...inspected, record };
}
async function finishOperation(sudo, recordId, result) {
  await sudo.query.IdempotencyKey.updateOne({
    where: { id: recordId },
    data: {
      status: "completed",
      resourceType: String(result.resourceType ?? ""),
      resourceId: String(result.resourceId ?? ""),
      result,
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function failOperation(sudo, recordId) {
  if (!recordId) return;
  await sudo.query.IdempotencyKey.updateOne({
    where: { id: recordId },
    data: { status: "failed", completedAt: (/* @__PURE__ */ new Date()).toISOString() }
  });
}
async function writeAudit(sudo, context, input) {
  await sudo.query.AuditEvent.createOne({
    data: {
      carrier: { connect: { id: input.carrierId } },
      eventKey: `audit:${input.key}`,
      action: input.action,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actor: context.session?.itemId ? { connect: { id: context.session.itemId } } : void 0,
      approvedAgent: context.session?.data?.approvedAgent?.id ? { connect: { id: context.session.data.approvedAgent.id } } : void 0,
      source: isStorefrontContext(context) ? "storefront" : context.session?.data?.approvedAgent?.id ? "agent" : "platform",
      idempotencyKey: input.key,
      beforeSummary: sanitizeAuditMetadata(input.before ?? {}),
      afterSummary: sanitizeAuditMetadata(input.after ?? {}),
      metadata: sanitizeAuditMetadata(input.metadata ?? {}),
      occurredAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  await sudo.query.OutboxEvent.createOne({
    data: {
      carrier: { connect: { id: input.carrierId } },
      eventKey: `outbox:${input.key}`,
      topic: input.action,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: sanitizeAuditMetadata({ before: input.before ?? {}, after: input.after ?? {}, metadata: input.metadata ?? {} }),
      status: "pending",
      availableAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function terminalizeCancellationBags(transactionContext, booking, now) {
  const tx = transactionContext.prisma;
  const bagLocks = await tx.$queryRaw(import_client.Prisma.sql`SELECT "id" FROM "Bag" WHERE "booking" = ${booking.id} ORDER BY "id" FOR UPDATE`);
  throwIfKeystonePrismaError(bagLocks);
  const activeBags = await tx.bag.findMany({ where: { bookingId: booking.id, status: { notIn: ["delivered", "closed"] } }, select: { id: true, bagKey: true, carrierId: true, originId: true, status: true } });
  for (const bag of activeBags) {
    await tx.bag.update({ where: { id: bag.id }, data: { status: "closed" } });
    await tx.bagEvent.upsert({
      where: { eventKey: `${bag.bagKey}:booking-cancelled` },
      update: {},
      create: { carrierId: bag.carrierId, eventKey: `${bag.bagKey}:booking-cancelled`, bagId: bag.id, airportId: bag.originId, eventType: "exception", statusSnapshot: "closed", occurredAt: now, source: "system", payloadSummary: { reason: "booking_cancelled", previousStatus: bag.status } }
    });
  }
  return activeBags.length;
}
async function cancelBooking(_root, args, context) {
  const storefrontBookingId = isStorefrontContext(context) ? context.session?.data?.storefrontBookingId : void 0;
  if (!storefrontBookingId || storefrontBookingId !== args.customerBookingId) await requireFreshPermission(context, "canManageBookings");
  return runSerializableTransaction(context, async (transactionContext) => {
    let booking = await transactionContext.prisma.booking.findUnique({
      where: { id: args.bookingId },
      include: {
        carrier: { select: { id: true } },
        passengers: { select: { id: true } },
        segments: { select: { id: true, status: true, inventoryBucketId: true } },
        paymentSessions: { select: { id: true, status: true } },
        payments: { select: { id: true, status: true, metadata: true } },
        tickets: { include: { coupons: { select: { id: true, status: true } } } },
        seatAssignments: { select: { id: true, status: true } },
        checkIns: { include: { boardingPass: { select: { id: true, status: true } } } }
      }
    });
    if (!booking || storefrontBookingId && booking.id !== storefrontBookingId) throw new Error("Booking not found or inaccessible.");
    if (!storefrontBookingId) await requireFreshCarrierPermission(transactionContext, "canManageBookings", booking.carrier.id);
    const bookingLock = await transactionContext.prisma.$queryRaw(import_client.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`);
    throwIfKeystonePrismaError(bookingLock);
    booking = await transactionContext.prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        carrier: { select: { id: true } },
        passengers: { select: { id: true } },
        segments: { select: { id: true, status: true, inventoryBucketId: true } },
        paymentSessions: { select: { id: true, status: true } },
        payments: { select: { id: true, status: true, metadata: true } },
        tickets: { include: { coupons: { select: { id: true, status: true } } } },
        seatAssignments: { select: { id: true, status: true } },
        checkIns: { include: { boardingPass: { select: { id: true, status: true } } } }
      }
    });
    if (!booking || storefrontBookingId && (booking.id !== storefrontBookingId || !hasCurrentStorefrontBookingAccess(booking, args.customerAccessTokenHash))) throw new Error("Booking changed or access was revoked while preparing cancellation.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const reason = args.reason?.trim();
    if (!reason || reason.length > 500) throw new Error("A cancellation reason of at most 500 characters is required.");
    const request = { bookingId: booking.id, reason };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "booking.cancel", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (booking.status === "cancelled") {
      const claim2 = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "booking.cancel", request);
      if (claim2.replay) return { ...claim2.replay.result ?? {}, replayed: true };
      const reconciledTicketing = booking.tickets.length > 0 && booking.ticketingStatus !== "voided";
      if (reconciledTicketing) {
        await transactionContext.prisma.booking.update({ where: { id: booking.id }, data: { ticketingStatus: "voided" } });
        await writeAudit(sudo, transactionContext, { carrierId: booking.carrier.id, key: claim2.storageKey, action: "booking.cancelled-ticketing.reconcile", aggregateType: "Booking", aggregateId: booking.id, before: { status: "cancelled", ticketingStatus: booking.ticketingStatus }, after: { status: "cancelled", ticketingStatus: "voided" }, metadata: { reason } });
      }
      const closedBagCount2 = await terminalizeCancellationBags(transactionContext, booking, /* @__PURE__ */ new Date());
      const result2 = { resourceType: "Booking", resourceId: booking.id, status: "cancelled", changed: reconciledTicketing || closedBagCount2 > 0, replayed: false };
      await finishOperation(sudo, claim2.record.id, result2);
      return result2;
    }
    if (booking.segments.some((segment) => ["boarded", "flown"].includes(segment.status))) throw new Error("A boarded or flown booking cannot be cancelled by this command.");
    const unsettledFarePayment = booking.payments.find((payment) => {
      const metadata = payment.metadata ?? {};
      return metadata.purchaseKind !== "seat" && ["captured", "partially_refunded"].includes(payment.status);
    });
    if (unsettledFarePayment || ["paid", "partially_refunded"].includes(booking.paymentStatus)) throw new Error("Refund captured airfare before cancelling this booking.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "booking.cancel", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const now = /* @__PURE__ */ new Date();
    const passengerCount = booking.passengers.length;
    const activeSegments = booking.segments.filter((segment) => segment.inventoryBucketId && !["reaccommodated", "cancelled", "refunded"].includes(segment.status));
    const bucketIds = sortUniqueIds(activeSegments.map((segment) => segment.inventoryBucketId));
    if (bucketIds.length) {
      const bucketLocks = await transactionContext.prisma.$queryRaw(import_client.Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${import_client.Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`);
      throwIfKeystonePrismaError(bucketLocks);
      for (const bucketId of bucketIds) {
        const quantity = activeSegments.filter((segment) => segment.inventoryBucketId === bucketId).length * passengerCount;
        const released = await transactionContext.prisma.inventoryBucket.updateMany({ where: { id: bucketId, carrierId: booking.carrier.id, sold: { gte: quantity } }, data: { sold: { decrement: quantity } } });
        if (released.count !== 1) throw new Error("Cancellation could not safely release sold inventory.");
      }
    }
    await Promise.all(booking.paymentSessions.filter((session) => ["created", "pending", "authorized"].includes(session.status)).map(
      (session) => transactionContext.prisma.paymentSession.update({ where: { id: session.id }, data: { status: "cancelled", completedAt: now } })
    ));
    await transactionContext.prisma.manualPaymentEvidence.updateMany({ where: { bookingId: booking.id, status: { in: ["submitted", "approved"] } }, data: { status: "rejected", rejectionReason: `Booking cancelled: ${reason}`.slice(0, 500) } });
    await Promise.all(booking.seatAssignments.filter((seat) => ["held", "assigned", "confirmed"].includes(seat.status)).map(
      (seat) => transactionContext.prisma.seatAssignment.update({ where: { id: seat.id }, data: { status: "cancelled", occupancyKey: null, releasedAt: now } })
    ));
    for (const checkIn of booking.checkIns) {
      if (checkIn.boardingPass && ["issued", "reissued"].includes(checkIn.boardingPass.status)) {
        await transactionContext.prisma.boardingPass.update({ where: { id: checkIn.boardingPass.id }, data: { status: "revoked", revokedAt: now } });
      }
      if (!["boarded", "cancelled"].includes(checkIn.status)) await transactionContext.prisma.checkIn.update({ where: { id: checkIn.id }, data: { status: "cancelled" } });
    }
    const closedBagCount = await terminalizeCancellationBags(transactionContext, booking, now);
    for (const ticket of booking.tickets) {
      for (const coupon of ticket.coupons) {
        if (["open", "checked_in", "suspended"].includes(coupon.status)) await transactionContext.prisma.ticketCoupon.update({ where: { id: coupon.id }, data: { status: "voided" } });
      }
      if (["pending", "issued", "suspended"].includes(ticket.status)) await transactionContext.prisma.ticket.update({ where: { id: ticket.id }, data: { status: "voided", voidedAt: now } });
    }
    await Promise.all(booking.segments.filter((segment) => !["cancelled", "refunded", "flown"].includes(segment.status)).map(
      (segment) => transactionContext.prisma.bookingSegment.update({ where: { id: segment.id }, data: { status: "cancelled" } })
    ));
    await transactionContext.prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled", cancelledAt: now, ...booking.tickets.length ? { ticketingStatus: "voided" } : {} } });
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id,
      key: claim.storageKey,
      action: "booking.cancel",
      aggregateType: "Booking",
      aggregateId: booking.id,
      before: { status: booking.status },
      after: { status: "cancelled" },
      metadata: { reason, releasedPassengerSegments: activeSegments.length * passengerCount, closedBagCount }
    });
    const result = { resourceType: "Booking", resourceId: booking.id, status: "cancelled", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
function randomReference(prefix, length) {
  return `${prefix}${import_node_crypto3.default.randomBytes(length).toString("hex").toUpperCase().slice(0, length)}`;
}
async function assertOfferAccess(context, carrierId, storedSessionHash, suppliedSessionHash) {
  if (isStorefrontContext(context)) {
    if (!storedSessionHash || storedSessionHash !== suppliedSessionHash || context.session?.data?.carrier?.id !== carrierId) {
      throw new Error("This shopping session does not own the offer.");
    }
    return;
  }
  await requireFreshCarrierPermission(context, "canManageBookings", carrierId);
}
async function lockOfferInventory(context, offerId, shoppingSessionHash) {
  const sudo = context.sudo();
  const offerReference = await sudo.query.Offer.findOne({
    where: { id: offerId },
    query: "id shoppingSessionId carrier { id }"
  });
  if (!offerReference) throw new Error("Offer not found.");
  await assertOfferAccess(context, offerReference.carrier.id, offerReference.shoppingSessionId, shoppingSessionHash);
  const offerLockResult = await context.prisma.$queryRaw(
    import_client.Prisma.sql`SELECT "id" FROM "Offer" WHERE "id" = ${offerId} FOR UPDATE`
  );
  throwIfKeystonePrismaError(offerLockResult);
  const lockReferences = await sudo.query.Offer.findOne({
    where: { id: offerId },
    query: "id shoppingSessionId carrier { id } items { flightInstance { id } } inventoryHolds { id inventoryBucket { id } }"
  });
  if (!lockReferences) throw new Error("Offer not found.");
  await assertOfferAccess(context, lockReferences.carrier.id, lockReferences.shoppingSessionId, shoppingSessionHash);
  const flightIds = sortUniqueIds((lockReferences.items ?? []).map((item) => item.flightInstance?.id ?? ""));
  if (flightIds.length) {
    const flightLockResult = await context.prisma.$queryRaw(
      import_client.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" IN (${import_client.Prisma.join(flightIds)}) ORDER BY "id" FOR UPDATE`
    );
    throwIfKeystonePrismaError(flightLockResult);
  }
  const bucketIds = sortUniqueIds(
    (lockReferences.inventoryHolds ?? []).map((hold) => hold.inventoryBucket?.id ?? "")
  );
  if (bucketIds.length) {
    const bucketLockResult = await context.prisma.$queryRaw(
      import_client.Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${import_client.Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`
    );
    throwIfKeystonePrismaError(bucketLockResult);
  }
  const holdIds = sortUniqueIds(
    (lockReferences.inventoryHolds ?? []).map((hold) => hold.id)
  );
  if (holdIds.length) {
    const holdLockResult = await context.prisma.$queryRaw(
      import_client.Prisma.sql`SELECT "id" FROM "InventoryHold" WHERE "id" IN (${import_client.Prisma.join(holdIds)}) ORDER BY "id" FOR UPDATE`
    );
    throwIfKeystonePrismaError(holdLockResult);
  }
  const releaseResult = await context.prisma.$executeRaw(import_client.Prisma.sql`
    WITH expired AS (
      UPDATE "InventoryHold"
      SET "status" = 'expired', "updatedAt" = NOW()
      WHERE "offer" = ${offerId} AND "status" = 'active' AND "expiresAt" <= NOW()
      RETURNING "inventoryBucket", "quantity"
    ), totals AS (
      SELECT "inventoryBucket", SUM("quantity")::integer AS quantity
      FROM expired GROUP BY "inventoryBucket"
    )
    UPDATE "InventoryBucket" bucket
    SET "held" = GREATEST(0, bucket."held" - totals.quantity), "updatedAt" = NOW()
    FROM totals WHERE bucket."id" = totals."inventoryBucket"
  `);
  throwIfKeystonePrismaError(releaseResult);
}
async function createBookingFromOfferInTransaction(_root, args, context) {
  if (!isStorefrontContext(context)) await requireFreshPermission(context, "canManageBookings");
  const sudo = context.sudo();
  const key = normalizeIdempotencyKey(args.idempotencyKey);
  await lockOfferInventory(context, args.offerId, args.shoppingSessionHash);
  const offer = await sudo.query.Offer.findOne({
    where: { id: args.offerId },
    query: `
      id offerNumber shoppingSessionId source status expiresAt baseAmount taxAmount feeAmount discountAmount totalAmount currencyCode
      carrier { id code }
      customer { id carrier { id } }
      approvedAgent { id carrier { id } }
      passengers { id }
      items {
        id itemKey itemType description quantity unitAmount baseAmount taxAmount feeAmount totalAmount currencyCode
        productSnapshot segmentSnapshot carrier { id }
        ancillaryProduct { id carrier { id } }
        inventoryBucket { id carrier { id } }
        flightInstance {
          id status flightNumber scheduledDepartureAt scheduledArrivalAt
          origin { id iataCode } destination { id iataCode }
          carrier { id code } operatingCarrier { id code }
        }
      }
      inventoryHolds {
        id holdKey status quantity expiresAt carrier { id }
        inventoryBucket { id held sold authorized carrier { id } }
      }
    `
  });
  if (!offer) throw new Error("Offer not found.");
  await assertOfferAccess(context, offer.carrier.id, offer.shoppingSessionId, args.shoppingSessionHash);
  const scope = "booking.create-from-offer";
  const request = {
    offerId: args.offerId,
    passengerIds: [...args.passengerIds ?? []].sort(),
    storefront: Boolean(args.shoppingSessionHash)
  };
  const inspected = await inspectOperation(sudo, offer.carrier.id, key, scope, request);
  if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
  if (isStorefrontContext(context) && args.shoppingSessionHash) {
    const reservationLock = await context.prisma.$queryRaw(import_client.Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`airline:pending-reservation:${offer.carrier.id}:${args.shoppingSessionHash}`}, 0)) AS locked`);
    throwIfKeystonePrismaError(reservationLock);
    if (!Array.isArray(reservationLock) || reservationLock[0]?.locked !== true) throw new Error("This shopping session is currently creating a reservation. Retry shortly.");
    const activeUnpaidReservations = await context.prisma.booking.count({
      where: {
        carrierId: offer.carrier.id,
        sourceOffer: { shoppingSessionId: args.shoppingSessionHash },
        status: { notIn: ["cancelled", "completed"] },
        paymentStatus: { in: ["unpaid", "failed"] }
      }
    });
    if (activeUnpaidReservations >= 1) {
      throw new Error("This shopping session already has an unpaid reservation. Complete the disclosed external-settlement handoff or cancel that reservation before creating another.");
    }
  }
  if (!["available", "held"].includes(offer.status)) throw new Error("Offer is not sellable.");
  if (!offer.expiresAt || new Date(offer.expiresAt) <= /* @__PURE__ */ new Date()) throw new Error("Offer has expired.");
  if (!offer.items?.length) throw new Error("Offer has no priced items.");
  if (!args.passengerIds?.length || new Set(args.passengerIds).size !== args.passengerIds.length) {
    throw new Error("At least one unique passenger is required.");
  }
  const offeredPassengerIds = (offer.passengers ?? []).map((passenger) => passenger.id).sort();
  const requestedPassengerIds = [...args.passengerIds].sort();
  if (offeredPassengerIds.length !== requestedPassengerIds.length || offeredPassengerIds.some((id, index) => id !== requestedPassengerIds[index])) {
    throw new Error("Booking passengers must exactly match the accepted offer.");
  }
  if (offer.customer?.carrier?.id && offer.customer.carrier.id !== offer.carrier.id) {
    throw new Error("Offer customer is outside the offer carrier.");
  }
  if (offer.approvedAgent?.carrier?.id && offer.approvedAgent.carrier.id !== offer.carrier.id) {
    throw new Error("Offer agent is outside the offer carrier.");
  }
  for (const item of offer.items) {
    if (item.carrier?.id !== offer.carrier.id) throw new Error("Offer item is outside the offer carrier.");
    if (item.currencyCode !== offer.currencyCode) throw new Error("Offer item currency does not match the offer.");
    if (item.flightInstance?.carrier?.id && item.flightInstance.carrier.id !== offer.carrier.id) {
      throw new Error("Offer flight is outside the offer carrier.");
    }
    if (item.flightInstance && (!["scheduled", "open_for_sale", "delayed"].includes(item.flightInstance.status) || new Date(item.flightInstance.scheduledDepartureAt) <= /* @__PURE__ */ new Date())) {
      throw new Error("Offer flight is no longer open for future sale.");
    }
    if (item.inventoryBucket?.carrier?.id && item.inventoryBucket.carrier.id !== offer.carrier.id) {
      throw new Error("Offer inventory is outside the offer carrier.");
    }
    if (item.ancillaryProduct?.carrier?.id && item.ancillaryProduct.carrier.id !== offer.carrier.id) {
      throw new Error("Offer ancillary is outside the offer carrier.");
    }
  }
  for (const hold of offer.inventoryHolds ?? []) {
    if (hold.carrier?.id !== offer.carrier.id || hold.inventoryBucket?.carrier?.id !== offer.carrier.id) {
      throw new Error("Offer hold is outside the offer carrier.");
    }
  }
  const itemTotal = offer.items.reduce(
    (sum, item) => sum + (item.itemType === "discount" ? -1 : 1) * Number(item.totalAmount),
    0
  );
  if (itemTotal !== offer.totalAmount) throw new Error("Offer item totals do not match the offer total.");
  for (const item of offer.items.filter((candidate) => candidate.itemType === "flight")) {
    if (!item.inventoryBucket) throw new Error("Flight offer item is missing an inventory bucket.");
    const heldQuantity = (offer.inventoryHolds ?? []).filter((hold) => hold.inventoryBucket?.id === item.inventoryBucket.id).reduce((sum, hold) => sum + Number(hold.quantity), 0);
    if (heldQuantity < item.quantity) throw new Error("Flight offer item is not fully covered by inventory holds.");
  }
  for (const hold of offer.inventoryHolds ?? []) {
    if (hold.status !== "active" || new Date(hold.expiresAt) <= /* @__PURE__ */ new Date()) {
      throw new Error("Offer inventory hold is not active.");
    }
    if (!hold.inventoryBucket || hold.inventoryBucket.held < hold.quantity || hold.inventoryBucket.sold + hold.quantity > hold.inventoryBucket.authorized) {
      throw new Error("Offer inventory hold no longer fits authorized inventory.");
    }
  }
  const passengers = await sudo.query.Passenger.findMany({
    where: { id: { in: args.passengerIds }, carrier: { id: { equals: offer.carrier.id } } },
    query: "id passengerKey title givenName middleNames familyName suffix dateOfBirth nationalityCode email phone loyaltyPrograms carrier { id }"
  });
  if (passengers.length !== args.passengerIds.length) throw new Error("One or more passengers are missing or outside this carrier.");
  const claim = await beginOperation(sudo, context, offer.carrier.id, key, scope, request);
  if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
  try {
    const recordLocator = randomReference("", 6);
    const orderNumber = randomReference(`${offer.carrier.code}-`, 12);
    const booking = await sudo.query.Booking.createOne({
      data: {
        carrier: { connect: { id: offer.carrier.id } },
        bookingKey: `${offer.carrier.id}:${orderNumber}`,
        recordLocator,
        orderNumber,
        idempotencyKey: claim.storageKey,
        accessTokenHash: args.bookingAccessTokenHash,
        accessTokenExpiresAt: args.bookingAccessTokenHash ? new Date(Date.now() + 365 * 24 * 60 * 6e4).toISOString() : void 0,
        status: isStorefrontContext(context) ? "pending" : "confirmed",
        paymentStatus: "unpaid",
        ticketingStatus: "not_ticketed",
        source: offer.approvedAgent ? "agent" : offer.source === "website" ? "website" : "direct",
        contactEmail: passengers[0].email ?? "",
        contactPhone: passengers[0].phone ?? "",
        baseAmount: offer.baseAmount,
        taxAmount: offer.taxAmount,
        feeAmount: offer.feeAmount,
        discountAmount: offer.discountAmount,
        totalAmount: offer.totalAmount,
        currencyCode: offer.currencyCode,
        customer: offer.customer ? { connect: { id: offer.customer.id } } : void 0,
        approvedAgent: offer.approvedAgent ? { connect: { id: offer.approvedAgent.id } } : void 0,
        sourceOffer: { connect: { id: offer.id } },
        confirmedAt: isStorefrontContext(context) ? void 0 : (/* @__PURE__ */ new Date()).toISOString(),
        metadata: isStorefrontContext(context) ? { paymentDueAt: new Date(Date.now() + 24 * 60 * 6e4).toISOString(), settlementMode: "external_evidence" } : {}
      },
      query: "id recordLocator orderNumber status"
    });
    for (const passenger of passengers) {
      await sudo.query.BookingPassenger.createOne({
        data: {
          carrier: { connect: { id: offer.carrier.id } },
          booking: { connect: { id: booking.id } },
          passenger: { connect: { id: passenger.id } },
          bookingPassengerKey: `${booking.id}:${passenger.id}`,
          passengerType: "adult",
          isPrimaryContact: passenger.id === passengers[0].id,
          passengerSnapshot: {
            passengerKey: passenger.passengerKey,
            title: passenger.title,
            givenName: passenger.givenName,
            middleNames: passenger.middleNames,
            familyName: passenger.familyName,
            suffix: passenger.suffix,
            dateOfBirth: passenger.dateOfBirth,
            nationalityCode: passenger.nationalityCode
          },
          loyaltySnapshot: passenger.loyaltyPrograms ?? []
        },
        query: "id"
      });
    }
    const flightItems = offer.items.filter((item) => item.itemType === "flight" && item.flightInstance).sort(
      (left, right) => new Date(left.flightInstance.scheduledDepartureAt).getTime() - new Date(right.flightInstance.scheduledDepartureAt).getTime()
    );
    let journey = null;
    if (flightItems.length) {
      const first = flightItems[0].flightInstance;
      const last = flightItems[flightItems.length - 1].flightInstance;
      journey = await sudo.query.Journey.createOne({
        data: {
          carrier: { connect: { id: offer.carrier.id } },
          booking: { connect: { id: booking.id } },
          journeyKey: `${booking.id}:1`,
          sequence: 1,
          origin: { connect: { id: first.origin.id } },
          destination: { connect: { id: last.destination.id } },
          status: "planned"
        },
        query: "id"
      });
    }
    const flightSequenceById = new Map(
      flightItems.map((item, index) => [item.id, index + 1])
    );
    for (const item of offer.items) {
      let segmentId;
      if (item.itemType === "flight" && item.flightInstance && journey) {
        const segmentSequence = flightSequenceById.get(item.id);
        const flight = item.flightInstance;
        const compactFlightNumber = String(flight.flightNumber).toUpperCase().replace(/\s+/g, "");
        const serviceNumber = compactFlightNumber.startsWith(flight.carrier.code) ? compactFlightNumber.slice(flight.carrier.code.length) : compactFlightNumber;
        const snapshot = buildBookingSegmentSnapshot({
          sourceOfferItemId: item.id,
          marketingCarrierCode: flight.carrier.code,
          operatingCarrierCode: flight.operatingCarrier?.code ?? flight.carrier.code,
          flightNumber: serviceNumber,
          originCode: flight.origin.iataCode,
          destinationCode: flight.destination.iataCode,
          scheduledDepartureAt: flight.scheduledDepartureAt,
          scheduledArrivalAt: flight.scheduledArrivalAt,
          cabinCode: item.segmentSnapshot?.cabinCode ?? "Y",
          bookingClassCode: item.segmentSnapshot?.bookingClassCode ?? "Y",
          fareBrandCode: item.segmentSnapshot?.fareBrandCode ?? "STANDARD",
          fareBasisCode: item.segmentSnapshot?.fareBasisCode ?? "STANDARD",
          includedBaggage: item.segmentSnapshot?.includedBaggage
        });
        const segment = await sudo.query.BookingSegment.createOne({
          data: {
            carrier: { connect: { id: offer.carrier.id } },
            booking: { connect: { id: booking.id } },
            journey: { connect: { id: journey.id } },
            sourceOfferItem: { connect: { id: item.id } },
            flightInstance: { connect: { id: flight.id } },
            inventoryBucket: item.inventoryBucket ? { connect: { id: item.inventoryBucket.id } } : void 0,
            segmentKey: `${booking.id}:${segmentSequence}`,
            sequence: segmentSequence,
            status: "confirmed",
            origin: { connect: { id: flight.origin.id } },
            destination: { connect: { id: flight.destination.id } },
            marketingCarrierCode: snapshot.marketingCarrierCode,
            operatingCarrierCode: snapshot.operatingCarrierCode,
            marketingFlightNumber: snapshot.flightNumber,
            originCode: snapshot.originCode,
            destinationCode: snapshot.destinationCode,
            scheduledDepartureAt: snapshot.scheduledDepartureAt,
            scheduledArrivalAt: snapshot.scheduledArrivalAt,
            cabinCode: snapshot.cabinCode,
            bookingClassCode: snapshot.bookingClassCode,
            fareBrandCode: snapshot.fareBrandCode,
            fareBasisCode: snapshot.fareBasisCode,
            itinerarySnapshot: item.segmentSnapshot ?? {},
            includedBaggageSnapshot: snapshot.includedBaggage
          },
          query: "id"
        });
        segmentId = segment.id;
      }
      const line = buildBookingLineSnapshot({
        sourceOfferItemId: item.id,
        itemType: item.itemType,
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        baseAmount: item.baseAmount,
        taxAmount: item.taxAmount,
        feeAmount: item.feeAmount,
        totalAmount: item.totalAmount,
        currencyCode: item.currencyCode,
        product: item.productSnapshot ?? {}
      });
      await sudo.query.BookingLineItem.createOne({
        data: {
          carrier: { connect: { id: offer.carrier.id } },
          booking: { connect: { id: booking.id } },
          sourceOfferItem: { connect: { id: item.id } },
          bookingSegment: segmentId ? { connect: { id: segmentId } } : void 0,
          ancillaryProduct: item.ancillaryProduct ? { connect: { id: item.ancillaryProduct.id } } : void 0,
          lineItemKey: `${booking.id}:${item.itemKey}`,
          itemType: line.itemType,
          description: line.description,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          baseAmount: line.baseAmount,
          taxAmount: line.taxAmount,
          feeAmount: line.feeAmount,
          totalAmount: line.totalAmount,
          currencyCode: line.currencyCode,
          productSnapshot: line.productSnapshot,
          pricingSnapshot: {
            sourceOfferNumber: offer.offerNumber,
            sourceOfferItemKey: item.itemKey
          }
        }
      });
    }
    for (const hold of offer.inventoryHolds ?? []) {
      await sudo.query.InventoryHold.updateOne({ where: { id: hold.id }, data: { status: "converted", convertedAt: (/* @__PURE__ */ new Date()).toISOString() } });
      await sudo.query.InventoryBucket.updateOne({
        where: { id: hold.inventoryBucket.id },
        data: { held: Math.max(0, hold.inventoryBucket.held - hold.quantity), sold: hold.inventoryBucket.sold + hold.quantity }
      });
    }
    await sudo.query.Offer.updateOne({ where: { id: offer.id }, data: { status: "accepted", booking: { connect: { id: booking.id } } } });
    await writeAudit(sudo, context, {
      carrierId: offer.carrier.id,
      key: claim.storageKey,
      action: "booking.create-from-offer",
      aggregateType: "Booking",
      aggregateId: booking.id,
      after: { status: booking.status, recordLocator: booking.recordLocator, totalAmount: offer.totalAmount, currencyCode: offer.currencyCode },
      metadata: { offerId: offer.id, passengerCount: passengers.length, lineItemCount: offer.items.length }
    });
    const result = {
      resourceType: "Booking",
      resourceId: booking.id,
      bookingId: booking.id,
      recordLocator,
      orderNumber,
      status: booking.status,
      changed: true,
      replayed: false
    };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  } catch (error) {
    await failOperation(sudo, claim.record?.id);
    throw error;
  }
}
async function createBookingFromOffer(root, args, context) {
  return runSerializableTransaction(
    context,
    (transactionContext) => createBookingFromOfferInTransaction(
      root,
      args,
      transactionContext
    )
  );
}

// features/keystone/mutations/airlineWorkflows.ts
var import_node_crypto5 = __toESM(require("node:crypto"));
var import_client2 = require("@prisma/client");

// features/integrations/payment/manual.ts
function requiredReference(value, label) {
  const normalized = value?.trim();
  if (!normalized || normalized.length < 6 || normalized.length > 200) {
    throw new Error(`${label} must be a 6-to-200 character reference from the settlement system.`);
  }
  return normalized;
}
var manualReconciliationAdapter = {
  async capture(_provider, input) {
    const reference = requiredReference(input.providerReference, "Payment reference");
    if (input.instrumentLast4 && !/^\d{4}$/.test(input.instrumentLast4)) {
      throw new Error("Instrument last four must contain exactly four digits.");
    }
    return {
      providerPaymentId: reference,
      providerCaptureId: reference,
      ...input.instrumentBrand?.trim() ? { instrumentBrand: input.instrumentBrand.trim().slice(0, 40) } : {},
      ...input.instrumentLast4 ? { instrumentLast4: input.instrumentLast4 } : {},
      providerData: { settlementMode: "manual_reconciliation" }
    };
  },
  async refund(_provider, input) {
    requiredReference(input.paymentReference, "Payment reference");
    const refundReference = requiredReference(input.refundReference, "Refund reference");
    return {
      providerRefundId: refundReference,
      providerData: { settlementMode: "manual_reconciliation" }
    };
  }
};

// features/integrations/payment/index.ts
var adapters = {
  manual: manualReconciliationAdapter
};
function getPaymentAdapter(provider) {
  const adapter = adapters[provider.adapterType];
  if (!adapter) {
    throw new Error(`Payment adapter "${provider.adapterType}" is not installed.`);
  }
  return adapter;
}

// features/keystone/lib/storefront-capacity.ts
function anonymousHoldQuota(authorized, requestedPartySize) {
  const baseline = Math.max(1, Math.floor(authorized * 0.25));
  return Math.min(10, Math.max(requestedPartySize, baseline));
}

// features/keystone/lib/coupon-lineage.ts
var import_node_crypto4 = __toESM(require("node:crypto"));
var spendable = (coupon) => coupon.status === "open" || coupon.status === "checked_in";
function createServiceObligationKey() {
  return `svo_${import_node_crypto4.default.randomBytes(24).toString("base64url")}`;
}
function validateCouponTransformation(transformation, parents, children) {
  if (!parents.length || !children.length) throw new Error("A coupon transformation requires parent and child coupons.");
  if ([...parents, ...children].some((coupon) => !coupon.id || !coupon.serviceObligationId || !Number.isInteger(coupon.serviceObligationVersion) || coupon.serviceObligationVersion < 1 || !coupon.bookingPassengerId)) {
    throw new Error("Coupon lineage requires persisted coupons with versioned service obligations.");
  }
  if (new Set([...parents, ...children].map((coupon) => coupon.bookingPassengerId)).size !== 1) {
    throw new Error("Coupon lineage cannot cross booking passengers.");
  }
  if (parents.some((coupon) => coupon.status !== "exchanged") || children.some((coupon) => !spendable(coupon))) {
    throw new Error("Retire every parent as exchanged before activating spendable child coupons.");
  }
  if (transformation === "alternative") {
    if (parents.length !== 1 || children.length !== 1) throw new Error("An alternative must replace exactly one coupon with one coupon.");
    if (parents[0].serviceObligationId !== children[0].serviceObligationId || children[0].serviceObligationVersion !== parents[0].serviceObligationVersion + 1) {
      throw new Error("An alternative must advance the same service obligation by exactly one version.");
    }
    return;
  }
  if (transformation === "split") {
    if (parents.length !== 1 || children.length < 2) throw new Error("A connection split requires one parent and at least two child coupons.");
    const childObligations = children.map((coupon) => coupon.serviceObligationId);
    if (new Set(childObligations).size !== children.length || childObligations.includes(parents[0].serviceObligationId) || children.some((coupon) => coupon.serviceObligationVersion !== 1)) {
      throw new Error("Every split child requires its own new service obligation at version one.");
    }
    return;
  }
  if (parents.length < 2 || children.length !== 1) throw new Error("A consolidation requires at least two parent coupons and exactly one child coupon.");
  const parentObligations = parents.map((coupon) => coupon.serviceObligationId);
  if (new Set(parentObligations).size !== parents.length || parentObligations.includes(children[0].serviceObligationId) || children[0].serviceObligationVersion !== 1) {
    throw new Error("A consolidation must retire distinct parent obligations and create a new child obligation at version one.");
  }
}

// features/keystone/mutations/airlineWorkflows.ts
function calculateAvailability(input) {
  return {
    available: Math.max(0, input.authorized - input.sold - input.held - input.blocked),
    authorized: input.authorized,
    sold: input.sold,
    held: input.held,
    blocked: input.blocked
  };
}
function normalizeSearchDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Search date must use YYYY-MM-DD.");
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Search date must use YYYY-MM-DD.");
  }
  return value;
}
function validatePassengerCount(value) {
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new Error("Passenger count must be between 1 and 9.");
  }
  return value;
}
function sessionCarrierId(context) {
  const session = context.session;
  const carrierId = session?.data?.carrier?.id;
  if (!carrierId) throw new Error("A carrier-scoped session is required.");
  return carrierId;
}
async function assertCanShop(context, carrierId) {
  if (isStorefrontContext(context) && context.session?.data?.carrier?.id === carrierId) return;
  await requireFreshCarrierPermission(context, "canReadOffers", carrierId);
}
async function searchAirlineFlights(_root, args, context) {
  const carrierId = sessionCarrierId(context);
  await assertCanShop(context, carrierId);
  const serviceDate = normalizeSearchDate(args.serviceDate);
  const passengerCount = validatePassengerCount(args.passengerCount ?? 1);
  const originCode = args.originCode.trim().toUpperCase();
  const destinationCode = args.destinationCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(originCode) || !/^[A-Z0-9]{3}$/.test(destinationCode)) {
    throw new Error("Origin and destination must be three-character airport codes.");
  }
  const flights = await context.prisma.flightInstance.findMany({
    where: {
      carrierId,
      serviceDate: { gte: /* @__PURE__ */ new Date(`${serviceDate}T00:00:00.000Z`), lt: new Date((/* @__PURE__ */ new Date(`${serviceDate}T00:00:00.000Z`)).getTime() + 864e5) },
      origin: { iataCode: originCode },
      destination: { iataCode: destinationCode },
      status: { in: ["scheduled", "open_for_sale", "delayed"] },
      scheduledDepartureAt: { gt: /* @__PURE__ */ new Date() }
    },
    orderBy: { scheduledDepartureAt: "asc" },
    include: {
      origin: { select: { iataCode: true, city: true } },
      destination: { select: { iataCode: true, city: true } },
      inventoryBuckets: {
        where: { status: "open", fareBrand: { status: "active" } },
        include: { holds: { where: { status: "active", expiresAt: { gt: /* @__PURE__ */ new Date() } }, select: { quantity: true } }, fareBrand: { select: { code: true, name: true, status: true } } },
        /* Active, unexpired holds are authoritative for shopping availability. */
        orderBy: { bookingClassCode: "asc" },
        take: 3
      }
    }
  });
  return flights.flatMap((flight) => flight.inventoryBuckets.map((bucket) => {
    const availability = calculateAvailability({ ...bucket, held: (bucket.holds ?? []).reduce((sum, hold) => sum + hold.quantity, 0) });
    return {
      id: flight.id,
      flightNumber: flight.flightNumber,
      serviceDate,
      scheduledDepartureAt: flight.scheduledDepartureAt.toISOString(),
      scheduledArrivalAt: flight.scheduledArrivalAt.toISOString(),
      origin: flight.origin,
      destination: flight.destination,
      fareBrand: {
        code: bucket.fareBrand?.code ?? bucket.bookingClassCode,
        name: bucket.fareBrand?.name ?? bucket.bookingClassCode
      },
      currencyCode: bucket.currencyCode,
      baseAmount: bucket.baseAmount,
      taxAmount: bucket.taxAmount,
      totalAmount: bucket.baseAmount + bucket.taxAmount,
      perTravelerBaseAmount: bucket.baseAmount,
      perTravelerTaxAmount: bucket.taxAmount,
      perTravelerTotalAmount: bucket.baseAmount + bucket.taxAmount,
      partyTotalAmount: (bucket.baseAmount + bucket.taxAmount) * passengerCount,
      passengerCount,
      availability,
      ...availability.available < passengerCount ? { unavailableReason: "Not enough seats" } : {},
      inventoryBucketId: bucket.id
    };
  }));
}
var MAX_ACTIVE_STOREFRONT_OFFERS = 2;
var MAX_ACTIVE_STOREFRONT_HELD_SEATS = 9;
async function enforceStorefrontHoldCap(context, carrierId, shoppingSessionHash, requestedSeats) {
  await context.prisma.$queryRaw(import_client2.Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${carrierId}:`} || ${shoppingSessionHash}, 0))::text AS "lock"`);
  const reconciled = await context.prisma.$executeRaw(import_client2.Prisma.sql`
    WITH expired AS (
      UPDATE "InventoryHold" hold SET "status" = 'expired', "updatedAt" = NOW()
      FROM "Offer" offer
      WHERE hold."offer" = offer."id" AND offer."carrier" = ${carrierId}
        AND offer."shoppingSessionId" = ${shoppingSessionHash}
        AND hold."status" = 'active' AND hold."expiresAt" <= NOW()
      RETURNING hold."inventoryBucket", hold."quantity"
    ), totals AS (
      SELECT "inventoryBucket", SUM("quantity")::integer AS quantity FROM expired GROUP BY "inventoryBucket"
    )
    UPDATE "InventoryBucket" bucket SET "held" = GREATEST(0, bucket."held" - totals.quantity), "updatedAt" = NOW()
    FROM totals WHERE bucket."id" = totals."inventoryBucket"
  `);
  throwIfKeystonePrismaError(reconciled);
  const [usage] = await context.prisma.$queryRaw(import_client2.Prisma.sql`
    SELECT COUNT(DISTINCT offer."id") AS "offerCount", COALESCE(SUM(hold."quantity"), 0) AS "heldSeats"
    FROM "Offer" offer
    JOIN "InventoryHold" hold ON hold."offer" = offer."id"
    WHERE offer."carrier" = ${carrierId} AND offer."shoppingSessionId" = ${shoppingSessionHash}
      AND offer."status" IN ('held', 'available') AND hold."status" = 'active' AND hold."expiresAt" > NOW()
  `);
  if (Number(usage?.offerCount ?? 0) >= MAX_ACTIVE_STOREFRONT_OFFERS || Number(usage?.heldSeats ?? 0) + requestedSeats > MAX_ACTIVE_STOREFRONT_HELD_SEATS) {
    throw new Error("Complete or release an existing held offer before holding more inventory.");
  }
}
async function createOfferInTransaction(args, context) {
  const sudo = context.sudo();
  const carrierId = sessionCarrierId(context);
  if (!isStorefrontContext(context)) await requireFreshCarrierPermission(context, "canManageOffers", carrierId);
  const key = normalizeIdempotencyKey(args.idempotencyKey);
  const passengerIds = [...new Set(args.passengerIds ?? [])].sort();
  if (!passengerIds.length) throw new Error("At least one passenger is required.");
  validatePassengerCount(passengerIds.length);
  if (args.shoppingSessionHash) await enforceStorefrontHoldCap(context, carrierId, args.shoppingSessionHash, passengerIds.length);
  const request = { flightInstanceId: args.flightInstanceId, inventoryBucketId: args.inventoryBucketId, passengerIds, storefront: Boolean(args.shoppingSessionHash) };
  const inspected = await inspectOperation(sudo, carrierId, key, "offer.create", request);
  if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
  const bucketReference = await context.prisma.inventoryBucket.findUnique({ where: { id: args.inventoryBucketId }, select: { carrierId: true, flightInstanceId: true, fareBrandId: true } });
  if (!bucketReference || bucketReference.carrierId !== carrierId || bucketReference.flightInstanceId !== args.flightInstanceId || !bucketReference.fareBrandId) throw new Error("The requested inventory is outside this carrier, flight, or active fare catalog.");
  const flightLock = await context.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${bucketReference.flightInstanceId} FOR UPDATE`);
  throwIfKeystonePrismaError(flightLock);
  const lock = await context.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" = ${args.inventoryBucketId} FOR UPDATE`);
  throwIfKeystonePrismaError(lock);
  const fareLock = await context.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "FareBrand" WHERE "id" = ${bucketReference.fareBrandId} FOR UPDATE`);
  throwIfKeystonePrismaError(fareLock);
  const released = await context.prisma.$executeRaw(import_client2.Prisma.sql`
    WITH expired AS (
      UPDATE "InventoryHold"
      SET "status" = 'expired', "updatedAt" = NOW()
      WHERE "inventoryBucket" = ${args.inventoryBucketId}
        AND "status" = 'active' AND "expiresAt" <= NOW()
      RETURNING "quantity"
    )
    UPDATE "InventoryBucket"
    SET "held" = GREATEST(0, "held" - COALESCE((SELECT SUM("quantity") FROM expired), 0)), "updatedAt" = NOW()
    WHERE "id" = ${args.inventoryBucketId}
  `);
  throwIfKeystonePrismaError(released);
  const bucket = await sudo.query.InventoryBucket.findOne({
    where: { id: args.inventoryBucketId },
    query: `id carrier { id code } status authorized sold held blocked baseAmount taxAmount currencyCode bookingClassCode flightInstance { id status carrier { id } flightNumber serviceDate scheduledDepartureAt scheduledArrivalAt origin { id iataCode } destination { id iataCode } } fareBrand { id code name status includedBaggage }`
  });
  if (!bucket || bucket.carrier.id !== carrierId || bucket.flightInstance?.id !== args.flightInstanceId) {
    throw new Error("The requested inventory is outside this carrier or flight.");
  }
  if (bucket.status !== "open") throw new Error("This inventory bucket is closed.");
  if (!bucket.fareBrand || bucket.fareBrand.status !== "active") throw new Error("This fare is no longer active for shopping or holding.");
  if (!bucket.flightInstance || !["scheduled", "open_for_sale", "delayed"].includes(bucket.flightInstance.status) || new Date(bucket.flightInstance.scheduledDepartureAt) <= /* @__PURE__ */ new Date()) throw new Error("This dated flight is not open for future sale.");
  const availability = calculateAvailability(bucket);
  if (availability.available < passengerIds.length) throw new Error("Not enough inventory for this request.");
  if (args.shoppingSessionHash) {
    const anonymous = await context.prisma.inventoryHold.aggregate({
      where: { inventoryBucketId: bucket.id, status: "active", expiresAt: { gt: /* @__PURE__ */ new Date() }, offer: { shoppingSessionId: { not: "" } } },
      _sum: { quantity: true }
    });
    const anonymousQuota = anonymousHoldQuota(bucket.authorized, passengerIds.length);
    if (Number(anonymous._sum.quantity ?? 0) + passengerIds.length > anonymousQuota) throw new Error("Online hold capacity is temporarily full; choose another service or try again after existing holds expire.");
  }
  const passengers = await sudo.query.Passenger.findMany({
    where: { id: { in: passengerIds }, carrier: { id: { equals: carrierId } } },
    query: "id"
  });
  if (passengers.length !== passengerIds.length) throw new Error("One or more passengers are outside this carrier.");
  const claim = await beginOperation(sudo, context, carrierId, key, "offer.create", request);
  if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
  try {
    const now = Date.now();
    const expiresAt = new Date(now + 15 * 6e4).toISOString();
    const offerNumber = randomReference(`${bucket.carrier.code}-O-`, 9);
    const totalAmount = (bucket.baseAmount + bucket.taxAmount) * passengerIds.length;
    const offer = await sudo.query.Offer.createOne({
      data: {
        carrier: { connect: { id: carrierId } },
        offerNumber,
        idempotencyKey: claim.storageKey,
        shoppingSessionId: args.shoppingSessionHash,
        status: "held",
        source: args.shoppingSessionHash ? "website" : "direct",
        expiresAt,
        baseAmount: bucket.baseAmount * passengerIds.length,
        taxAmount: bucket.taxAmount * passengerIds.length,
        totalAmount,
        currencyCode: bucket.currencyCode,
        customer: context.session?.itemId ? { connect: { id: context.session.itemId } } : void 0,
        passengers: { connect: passengerIds.map((id) => ({ id })) }
      },
      query: "id offerNumber status"
    });
    const item = await sudo.query.OfferItem.createOne({
      data: {
        carrier: { connect: { id: carrierId } },
        offer: { connect: { id: offer.id } },
        itemKey: `${offer.id}:flight`,
        itemType: "flight",
        description: `${bucket.flightInstance.origin.iataCode} to ${bucket.flightInstance.destination.iataCode}`,
        quantity: passengerIds.length,
        unitAmount: bucket.baseAmount,
        baseAmount: bucket.baseAmount * passengerIds.length,
        taxAmount: bucket.taxAmount * passengerIds.length,
        totalAmount,
        currencyCode: bucket.currencyCode,
        flightInstance: { connect: { id: bucket.flightInstance.id } },
        inventoryBucket: { connect: { id: bucket.id } },
        fareBrand: bucket.fareBrand ? { connect: { id: bucket.fareBrand.id } } : void 0,
        passengerReferences: passengerIds,
        segmentSnapshot: { cabinCode: "Y", bookingClassCode: bucket.bookingClassCode, fareBrandCode: bucket.fareBrand?.code ?? bucket.bookingClassCode, fareBasisCode: bucket.fareBrand?.code ?? bucket.bookingClassCode, includedBaggage: normalizeIncludedBaggageSnapshot(bucket.fareBrand?.includedBaggage) },
        productSnapshot: { code: bucket.fareBrand?.code ?? bucket.bookingClassCode, name: bucket.fareBrand?.name ?? bucket.bookingClassCode }
      },
      query: "id"
    });
    await sudo.query.InventoryHold.createOne({
      data: {
        carrier: { connect: { id: carrierId } },
        holdKey: `${offer.id}:${bucket.id}`,
        inventoryBucket: { connect: { id: bucket.id } },
        offer: { connect: { id: offer.id } },
        quantity: passengerIds.length,
        status: "active",
        expiresAt
      },
      query: "id"
    });
    await sudo.query.InventoryBucket.updateOne({ where: { id: bucket.id }, data: { held: bucket.held + passengerIds.length } });
    await writeAudit(sudo, context, {
      carrierId,
      key: claim.storageKey,
      action: "offer.create",
      aggregateType: "Offer",
      aggregateId: offer.id,
      after: { status: "held", offerNumber, totalAmount, currencyCode: bucket.currencyCode },
      metadata: { flightInstanceId: bucket.flightInstance.id, offerItemId: item.id, passengerCount: passengerIds.length }
    });
    const result = { resourceType: "Offer", resourceId: offer.id, offerId: offer.id, offerNumber, status: "held", totalAmount, currencyCode: bucket.currencyCode, expiresAt, passengerIds, changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  } catch (error) {
    throw error;
  }
}
async function createOfferFromShopping(_root, args, context) {
  return runSerializableTransaction(context, (transactionContext) => createOfferInTransaction(args, transactionContext));
}
async function lockBooking(context, bookingId) {
  const result = await context.prisma.$queryRaw(
    import_client2.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`
  );
  throwIfKeystonePrismaError(result);
}
async function submitManualPaymentEvidence(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManagePayments");
    const sudo = transactionContext.sudo();
    let booking = await transactionContext.prisma.booking.findUnique({ where: { id: args.bookingId }, include: { payments: true } });
    if (!booking) throw new Error("Resource not found or inaccessible.");
    const actor = await requireFreshCarrierPermission(transactionContext, "canManagePayments", booking.carrierId);
    await lockBooking(transactionContext, booking.id);
    booking = await transactionContext.prisma.booking.findUnique({ where: { id: booking.id }, include: { payments: true } });
    if (!booking || booking.carrierId !== actor.carrierId) throw new Error("Booking changed while preparing settlement evidence.");
    if (!["capture", "refund"].includes(args.purpose) || !Number.isSafeInteger(args.amount) || args.amount <= 0 || !/^[A-Z]{3}$/.test(args.currencyCode) || !/^[a-f0-9]{64}$/i.test(args.evidenceDigest)) throw new Error("Manual evidence is invalid.");
    if (args.currencyCode !== booking.currencyCode || args.purpose === "capture" && args.amount !== booking.totalAmount) throw new Error("Settlement evidence must match the booking amount and currency.");
    if (args.purpose === "capture" && (!["pending", "confirmed"].includes(booking.status) || !["unpaid", "failed"].includes(booking.paymentStatus))) throw new Error("This booking is not eligible for capture evidence.");
    if (args.purpose === "refund" && !["paid", "partially_refunded"].includes(booking.paymentStatus)) throw new Error("This booking is not eligible for refund evidence.");
    if (args.purpose === "refund") {
      const captured = booking.payments.reduce((sum, payment) => sum + Number(payment.capturedAmount ?? 0) - Number(payment.refundedAmount ?? 0), 0);
      if (args.amount > captured) throw new Error("Refund evidence exceeds the remaining captured amount.");
    }
    const ledgerEntry = await transactionContext.prisma.settlementLedgerEntry.findFirst({ where: { carrierId: booking.carrierId, externalReference: args.externalReference.trim(), ledgerSource: args.ledgerSource.trim(), evidenceDigest: args.evidenceDigest.toLowerCase(), amount: args.amount, currencyCode: args.currencyCode } });
    if (!ledgerEntry) throw new Error("An externally imported settlement ledger entry is required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { ...args, idempotencyKey: void 0 };
    const inspected = await inspectOperation(sudo, booking.carrierId, key, "manual-payment-evidence.submit", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const ledgerLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "SettlementLedgerEntry" WHERE "id" = ${ledgerEntry.id} FOR UPDATE`);
    throwIfKeystonePrismaError(ledgerLock);
    const lockedReplay = await inspectOperation(sudo, booking.carrierId, key, "manual-payment-evidence.submit", request);
    if (lockedReplay.replay) return { ...lockedReplay.replay.result ?? {}, replayed: true };
    const retainedEvidence = await transactionContext.prisma.manualPaymentEvidence.findFirst({ where: { ledgerEntryId: ledgerEntry.id }, select: { id: true } });
    if (retainedEvidence) throw new Error("Settlement ledger evidence has already been assigned and cannot fund another operation.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrierId, key, "manual-payment-evidence.submit", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const evidence = await sudo.query.ManualPaymentEvidence.createOne({ data: {
      carrier: { connect: { id: booking.carrierId } },
      evidenceKey: claim.storageKey,
      purpose: args.purpose,
      booking: { connect: { id: booking.id } },
      ledgerEntry: { connect: { id: ledgerEntry.id } },
      externalReference: args.externalReference.trim(),
      ledgerSource: args.ledgerSource.trim(),
      evidenceDigest: args.evidenceDigest.toLowerCase(),
      amount: args.amount,
      currencyCode: args.currencyCode,
      status: "submitted",
      submittedBy: { connect: { id: actor.itemId } }
    }, query: "id status" });
    await writeAudit(sudo, transactionContext, { carrierId: booking.carrierId, key: claim.storageKey, action: "manual-payment-evidence.submit", aggregateType: "ManualPaymentEvidence", aggregateId: evidence.id, after: { status: evidence.status, purpose: args.purpose, amount: args.amount, currencyCode: args.currencyCode }, metadata: { bookingId: booking.id, ledgerEntryId: ledgerEntry.id } });
    const result = { resourceType: "ManualPaymentEvidence", resourceId: evidence.id, status: evidence.status, changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function approveManualPaymentEvidence(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManagePayments");
    const sudo = transactionContext.sudo();
    const evidence = await transactionContext.prisma.manualPaymentEvidence.findUnique({ where: { id: args.evidenceId } });
    if (!evidence) throw new Error("Resource not found or inaccessible.");
    const actor = await requireFreshCarrierPermission(transactionContext, "canManagePayments", evidence.carrierId);
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { evidenceId: evidence.id };
    const inspected = await inspectOperation(sudo, evidence.carrierId, key, "manual-payment-evidence.approve", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const evidenceLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${evidence.id} FOR UPDATE`);
    throwIfKeystonePrismaError(evidenceLock);
    const lockedReplay = await inspectOperation(sudo, evidence.carrierId, key, "manual-payment-evidence.approve", request);
    if (lockedReplay.replay) return { ...lockedReplay.replay.result ?? {}, replayed: true };
    const currentEvidence = await transactionContext.prisma.manualPaymentEvidence.findUnique({ where: { id: evidence.id }, select: { status: true, submittedById: true, purpose: true, booking: { select: { status: true, paymentStatus: true } } } });
    const bookingEligible = currentEvidence?.purpose === "capture" ? ["pending", "confirmed"].includes(currentEvidence.booking.status) && ["unpaid", "failed"].includes(currentEvidence.booking.paymentStatus) : ["paid", "partially_refunded"].includes(currentEvidence?.booking.paymentStatus);
    if (currentEvidence?.status !== "submitted" || currentEvidence.submittedById === actor.itemId || !bookingEligible) throw new Error("Evidence must be current, booking-eligible, and approved once by a different authorized user.");
    const claim = await beginOperation(sudo, transactionContext, evidence.carrierId, key, "manual-payment-evidence.approve", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    await sudo.query.ManualPaymentEvidence.updateOne({ where: { id: evidence.id }, data: { status: "approved", approvedBy: { connect: { id: actor.itemId } }, approvedAt: (/* @__PURE__ */ new Date()).toISOString() } });
    await writeAudit(sudo, transactionContext, { carrierId: evidence.carrierId, key: claim.storageKey, action: "manual-payment-evidence.approve", aggregateType: "ManualPaymentEvidence", aggregateId: evidence.id, before: { status: "submitted" }, after: { status: "approved" }, metadata: {} });
    const result = { resourceType: "ManualPaymentEvidence", resourceId: evidence.id, status: "approved", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function rejectManualPaymentEvidence(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    const sudo = transactionContext.sudo();
    const evidence = await transactionContext.prisma.manualPaymentEvidence.findUnique({ where: { id: args.evidenceId } });
    if (!evidence) throw new Error("Resource not found or inaccessible.");
    const actor = await requireFreshCarrierPermission(transactionContext, "canManagePayments", evidence.carrierId);
    const reason = args.reason.trim();
    if (!reason || reason.length > 500) throw new Error("A bounded rejection reason is required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { evidenceId: evidence.id, reason };
    const inspected = await inspectOperation(sudo, evidence.carrierId, key, "manual-payment-evidence.reject", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const evidenceLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${evidence.id} FOR UPDATE`);
    throwIfKeystonePrismaError(evidenceLock);
    const lockedReplay = await inspectOperation(sudo, evidence.carrierId, key, "manual-payment-evidence.reject", request);
    if (lockedReplay.replay) return { ...lockedReplay.replay.result ?? {}, replayed: true };
    const currentEvidence = await transactionContext.prisma.manualPaymentEvidence.findUnique({ where: { id: evidence.id }, select: { status: true, submittedById: true } });
    if (currentEvidence?.status !== "submitted" || currentEvidence.submittedById === actor.itemId) throw new Error("Evidence must be submitted and rejected once by a different authorized user.");
    const claim = await beginOperation(sudo, transactionContext, evidence.carrierId, key, "manual-payment-evidence.reject", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    await sudo.query.ManualPaymentEvidence.updateOne({ where: { id: evidence.id }, data: { status: "rejected", rejectionReason: reason } });
    await writeAudit(sudo, transactionContext, { carrierId: evidence.carrierId, key: claim.storageKey, action: "manual-payment-evidence.reject", aggregateType: "ManualPaymentEvidence", aggregateId: evidence.id, before: { status: "submitted" }, after: { status: "rejected" }, metadata: { reason } });
    const result = { resourceType: "ManualPaymentEvidence", resourceId: evidence.id, status: "rejected", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function captureBookingPayment(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManagePayments");
    const sudo = transactionContext.sudo();
    const booking = await sudo.query.Booking.findOne({
      where: { id: args.bookingId },
      query: "id status paymentStatus totalAmount currencyCode carrier { id } payments { id status }"
    });
    if (!booking) throw new Error("Booking not found.");
    await requireFreshCarrierPermission(transactionContext, "canManagePayments", booking.carrier.id);
    await lockBooking(transactionContext, booking.id);
    const currentBooking = await transactionContext.prisma.booking.findUnique({
      where: { id: booking.id },
      select: { status: true, paymentStatus: true, payments: { select: { status: true, metadata: true } } }
    });
    const providerReference = args.providerReference.trim();
    const instrumentBrand = args.instrumentBrand?.trim().slice(0, 40) || null;
    const instrumentLast4 = args.instrumentLast4?.trim() || null;
    if (providerReference.length < 6 || providerReference.length > 200 || instrumentLast4 && !/^\d{4}$/.test(instrumentLast4)) throw new Error("Payment reference or instrument summary is invalid.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingId: booking.id, providerReference, instrumentBrand, instrumentLast4 };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "payment.capture", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!currentBooking || !["unpaid", "failed"].includes(currentBooking.paymentStatus)) throw new Error("Booking payment state is not eligible for capture.");
    if (currentBooking.status === "cancelled") throw new Error("Cancelled bookings cannot be paid.");
    if (currentBooking.payments.some((payment2) => {
      const purchaseKind = payment2.metadata?.purchaseKind ?? "booking";
      return purchaseKind !== "seat" && ["authorized", "captured", "partially_refunded", "refunded"].includes(payment2.status);
    })) throw new Error("Booking already has an authoritative airfare payment record.");
    const provider = (await sudo.query.PaymentProvider.findMany({
      where: { carrier: { id: { equals: booking.carrier.id } }, status: { equals: "active" }, adapterType: { equals: "manual" } },
      orderBy: [{ providerKey: "asc" }],
      take: 1,
      query: "id providerKey adapterType configuration"
    }))[0];
    if (!provider) throw new Error("No active payment provider is configured for this carrier.");
    const providerLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "id" = ${provider.id} FOR UPDATE`);
    throwIfKeystonePrismaError(providerLock);
    const currentProvider = await transactionContext.prisma.paymentProvider.findUnique({ where: { id: provider.id } });
    if (!currentProvider || currentProvider.carrierId !== booking.carrier.id || currentProvider.status !== "active" || !isEvidenceOnlyManualProvider(currentProvider)) throw new Error("The payment provider is not an active evidence-only manual settlement boundary.");
    const duplicateProviderReference = await transactionContext.prisma.payment.findFirst({ where: { providerId: currentProvider.id, providerPaymentId: providerReference }, select: { id: true } });
    if (duplicateProviderReference) throw new Error("Settlement reference was already captured by this provider.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "payment.capture", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const manualEvidence = currentProvider.adapterType === "manual" ? await transactionContext.prisma.manualPaymentEvidence.findFirst({
      where: { bookingId: booking.id, purpose: "capture", externalReference: providerReference, amount: booking.totalAmount, currencyCode: booking.currencyCode, status: "approved" }
    }) : null;
    if (currentProvider.adapterType === "manual" && !manualEvidence) throw new Error("Approved manual settlement evidence is required.");
    if (manualEvidence) {
      const evidenceLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${manualEvidence.id} FOR UPDATE`);
      throwIfKeystonePrismaError(evidenceLock);
    }
    const adapter = getPaymentAdapter(currentProvider);
    const captured = await adapter.capture(currentProvider, {
      amount: booking.totalAmount,
      currencyCode: booking.currencyCode,
      providerReference,
      instrumentBrand,
      instrumentLast4
    });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payment = await sudo.query.Payment.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } },
        paymentKey: `PAY-${randomReference("", 12)}`,
        idempotencyKey: claim.storageKey,
        booking: { connect: { id: booking.id } },
        provider: { connect: { id: currentProvider.id } },
        status: "captured",
        amount: booking.totalAmount,
        authorizedAmount: booking.totalAmount,
        capturedAmount: booking.totalAmount,
        currencyCode: booking.currencyCode,
        providerPaymentId: captured.providerPaymentId,
        providerCaptureId: captured.providerCaptureId,
        instrumentBrand: captured.instrumentBrand,
        instrumentLast4: captured.instrumentLast4,
        authorizedAt: now,
        capturedAt: now,
        rawProviderData: captured.providerData,
        metadata: { adapterType: currentProvider.adapterType, purchaseKind: "booking" }
      },
      query: "id"
    });
    if (manualEvidence) await sudo.query.ManualPaymentEvidence.updateOne({ where: { id: manualEvidence.id }, data: { status: "consumed", payment: { connect: { id: payment.id } }, consumedAt: now } });
    await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { paymentStatus: "paid", ...booking.status === "pending" ? { status: "confirmed", confirmedAt: now } : {} } });
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id,
      key: claim.storageKey,
      action: "payment.capture",
      aggregateType: "Booking",
      aggregateId: booking.id,
      after: { paymentStatus: "paid", amount: booking.totalAmount, currencyCode: booking.currencyCode },
      metadata: { paymentId: payment.id, providerId: currentProvider.id }
    });
    const result = { resourceType: "Payment", resourceId: payment.id, status: "captured", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function processBookingRefund(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManagePayments");
    const sudo = transactionContext.sudo();
    let booking = await sudo.query.Booking.findOne({
      where: { id: args.bookingId },
      query: "id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id } payments { id status capturedAmount refundedAmount providerPaymentId metadata session { id providerData } provider { id providerKey adapterType configuration } } tickets { id status coupons { id status } }"
    });
    if (!booking) throw new Error("Booking not found.");
    await requireFreshCarrierPermission(transactionContext, "canManagePayments", booking.carrier.id);
    if (!Number.isSafeInteger(args.amount) || args.amount <= 0) throw new Error("Refund amount must be a positive minor-unit integer.");
    const reason = args.reason.trim();
    const providerReference = args.providerReference.trim();
    if (!["customer_request", "disruption", "schedule_change", "duplicate", "fraud", "other"].includes(reason)) throw new Error("Refund reason must use a supported commercial reason code.");
    if (providerReference.length < 6 || providerReference.length > 200) throw new Error("A bounded settlement reference is required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingId: booking.id, amount: args.amount, reason, providerReference };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "refund.process", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    await lockBooking(transactionContext, booking.id);
    booking = await sudo.query.Booking.findOne({
      where: { id: booking.id },
      query: "id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id } payments { id status capturedAmount refundedAmount providerPaymentId metadata session { id providerData } provider { id providerKey adapterType configuration } } tickets { id status coupons { id status } }"
    });
    if (!booking) throw new Error("Booking changed while preparing the refund.");
    const lockedInspection = await inspectOperation(sudo, booking.carrier.id, key, "refund.process", request);
    if (lockedInspection.replay) return { ...lockedInspection.replay.result ?? {}, replayed: true };
    if ((booking.tickets ?? []).some((ticket) => (ticket.coupons ?? []).some((coupon) => ["boarded", "flown"].includes(coupon.status)))) throw new Error("Boarded or flown ticket coupons require an exceptional servicing workflow and cannot be refunded here.");
    const payment = booking.payments.find((candidate) => {
      const purchaseKind = candidate.metadata?.purchaseKind ?? candidate.session?.providerData?.kind ?? "booking";
      return purchaseKind !== "seat" && ["captured", "partially_refunded"].includes(candidate.status);
    });
    if (!payment) throw new Error("No captured payment is available to refund.");
    const remaining = payment.capturedAmount - payment.refundedAmount;
    if (args.amount > remaining) throw new Error("Refund amount exceeds the remaining captured amount.");
    const providerLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "id" = ${payment.provider.id} FOR UPDATE`);
    throwIfKeystonePrismaError(providerLock);
    const duplicateRefundReference = await transactionContext.prisma.refund.findFirst({ where: { providerRefundId: providerReference, payment: { providerId: payment.provider.id } }, select: { id: true } });
    if (duplicateRefundReference) throw new Error("Settlement refund reference was already consumed by this provider.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "refund.process", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const manualEvidence = payment.provider.adapterType === "manual" ? await transactionContext.prisma.manualPaymentEvidence.findFirst({
      where: { bookingId: booking.id, purpose: "refund", externalReference: providerReference, amount: args.amount, currencyCode: booking.currencyCode, status: "approved" }
    }) : null;
    if (payment.provider.adapterType === "manual" && !manualEvidence) throw new Error("Approved manual refund evidence is required.");
    if (manualEvidence) {
      const evidenceLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${manualEvidence.id} FOR UPDATE`);
      throwIfKeystonePrismaError(evidenceLock);
    }
    const adapter = getPaymentAdapter(payment.provider);
    const refunded = await adapter.refund(payment.provider, {
      amount: args.amount,
      currencyCode: booking.currencyCode,
      paymentReference: payment.providerPaymentId,
      refundReference: providerReference
    });
    const nextRefunded = payment.refundedAmount + args.amount;
    const fullyRefunded = nextRefunded === payment.capturedAmount;
    const processedAt = (/* @__PURE__ */ new Date()).toISOString();
    const refund = await sudo.query.Refund.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } },
        booking: { connect: { id: booking.id } },
        payment: { connect: { id: payment.id } },
        refundKey: `REF-${randomReference("", 12)}`,
        idempotencyKey: claim.storageKey,
        status: "succeeded",
        reason,
        amount: args.amount,
        currencyCode: booking.currencyCode,
        providerRefundId: refunded.providerRefundId,
        requestedAt: processedAt,
        approvedAt: processedAt,
        processedAt,
        metadata: { adapterType: payment.provider.adapterType }
      },
      query: "id"
    });
    if (manualEvidence) await sudo.query.ManualPaymentEvidence.updateOne({ where: { id: manualEvidence.id }, data: { status: "consumed", payment: { connect: { id: payment.id } }, consumedAt: processedAt } });
    await sudo.query.Payment.updateOne({ where: { id: payment.id }, data: { refundedAmount: nextRefunded, status: fullyRefunded ? "refunded" : "partially_refunded" } });
    await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { paymentStatus: fullyRefunded ? "refunded" : "partially_refunded", ...fullyRefunded && (booking.tickets ?? []).length ? { ticketingStatus: "voided" } : {} } });
    if (fullyRefunded) {
      for (const ticket of booking.tickets ?? []) {
        if (!["issued", "partially_used", "suspended"].includes(ticket.status)) continue;
        for (const coupon of ticket.coupons ?? []) {
          if (["open", "checked_in", "suspended"].includes(coupon.status)) await sudo.query.TicketCoupon.updateOne({ where: { id: coupon.id }, data: { status: "refunded" } });
        }
        await sudo.query.Ticket.updateOne({ where: { id: ticket.id }, data: { status: "refunded", refundedAt: processedAt } });
      }
      const retiredObligations = await transactionContext.prisma.serviceObligation.updateMany({ where: { bookingId: booking.id, status: "active" }, data: { status: "retired" } });
      throwIfKeystonePrismaError(retiredObligations);
    }
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id,
      key: claim.storageKey,
      action: "refund.process",
      aggregateType: "Refund",
      aggregateId: refund.id,
      after: { status: "succeeded", amount: args.amount, currencyCode: booking.currencyCode },
      metadata: { bookingId: booking.id, paymentId: payment.id }
    });
    const result = { resourceType: "Refund", resourceId: refund.id, status: "succeeded", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function issueBookingTickets(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageTicketing");
    const sudo = transactionContext.sudo();
    let booking = await sudo.query.Booking.findOne({
      where: { id: args.bookingId },
      query: `id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id code } passengers { id passenger { id } } segments { id sequence status bookingClassCode fareBasisCode }`
    });
    if (!booking) throw new Error("Booking not found.");
    await requireFreshCarrierPermission(transactionContext, "canManageTicketing", booking.carrier.id);
    await lockBooking(transactionContext, booking.id);
    booking = await sudo.query.Booking.findOne({
      where: { id: booking.id },
      query: `id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id code } passengers { id passenger { id } } segments { id sequence status bookingClassCode fareBasisCode }`
    });
    if (!booking) throw new Error("Booking changed while preparing ticket issuance.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingId: booking.id };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "ticket.issue", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (booking.paymentStatus !== "paid") throw new Error("Capture payment before issuing tickets.");
    if (booking.ticketingStatus === "ticketed") throw new Error("Booking is already ticketed.");
    if (booking.status !== "confirmed") throw new Error("Only confirmed bookings can be ticketed.");
    if (!booking.passengers?.length || !booking.segments?.length) throw new Error("Booking has no ticketable passengers or segments.");
    if (booking.segments.some((segment) => segment.status === "disrupted")) throw new Error("Resolve disrupted itinerary slots before issuing passenger coupons.");
    const ticketableSegments = booking.segments.filter((segment) => segment.status === "confirmed");
    if (!ticketableSegments.length) throw new Error("Booking has no active confirmed itinerary segments to ticket.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "ticket.issue", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const issuedAt = (/* @__PURE__ */ new Date()).toISOString();
    let ticketCount = 0;
    for (const [passengerIndex, bookingPassenger] of booking.passengers.entries()) {
      const passengerAmount = Math.floor(booking.totalAmount / booking.passengers.length) + (passengerIndex < booking.totalAmount % booking.passengers.length ? 1 : 0);
      const ticket = await sudo.query.Ticket.createOne({
        data: {
          carrier: { connect: { id: booking.carrier.id } },
          ticketNumber: `${booking.carrier.code}-${randomReference("", 12)}`,
          booking: { connect: { id: booking.id } },
          bookingPassenger: { connect: { id: bookingPassenger.id } },
          passenger: { connect: { id: bookingPassenger.passenger.id } },
          issuingCarrierCode: booking.carrier.code,
          validatingCarrierCode: booking.carrier.code,
          status: "issued",
          totalAmount: passengerAmount,
          currencyCode: booking.currencyCode,
          issuedAt,
          providerReference: `internal:${booking.id}`,
          metadata: { issuanceChannel: "openfront", allocation: "party-total-minor-units" }
        },
        query: "id"
      });
      for (const [segmentIndex, segment] of ticketableSegments.entries()) {
        const couponAmount = Math.floor(passengerAmount / ticketableSegments.length) + (segmentIndex < passengerAmount % ticketableSegments.length ? 1 : 0);
        const obligation = await sudo.query.ServiceObligation.createOne({
          data: {
            carrier: { connect: { id: booking.carrier.id } },
            booking: { connect: { id: booking.id } },
            bookingPassenger: { connect: { id: bookingPassenger.id } },
            obligationKey: createServiceObligationKey(),
            currentVersion: 1,
            status: "active"
          },
          query: "id"
        });
        await sudo.query.TicketCoupon.createOne({
          data: {
            carrier: { connect: { id: booking.carrier.id } },
            couponKey: `${ticket.id}:${segment.id}`,
            ticket: { connect: { id: ticket.id } },
            bookingSegment: { connect: { id: segment.id } },
            serviceObligation: { connect: { id: obligation.id } },
            serviceObligationVersion: 1,
            couponNumber: segment.sequence,
            status: "open",
            fareBasisCode: segment.fareBasisCode ?? "STANDARD",
            bookingClassCode: segment.bookingClassCode ?? "Y",
            amount: couponAmount,
            currencyCode: booking.currencyCode,
            entitlementSnapshot: { bookingId: booking.id, segmentId: segment.id }
          },
          query: "id"
        });
      }
      ticketCount += 1;
    }
    await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { status: "ticketed", ticketingStatus: "ticketed", ticketedAt: issuedAt } });
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id,
      key: claim.storageKey,
      action: "ticket.issue",
      aggregateType: "Booking",
      aggregateId: booking.id,
      after: { status: "ticketed", ticketingStatus: "ticketed" },
      metadata: { ticketCount }
    });
    const result = { resourceType: "Booking", resourceId: booking.id, status: "ticketed", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function registerPassengerTravelDocument(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageSecurePassengerData");
    const bookingPassenger = await transactionContext.prisma.bookingPassenger.findUnique({ where: { id: args.bookingPassengerId }, include: { passenger: true, booking: true } });
    const segment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: args.bookingSegmentId }, include: { flightInstance: true } });
    if (!bookingPassenger || !segment || bookingPassenger.bookingId !== segment.bookingId || bookingPassenger.carrierId !== segment.carrierId) throw new Error("Resource not found or inaccessible.");
    const actor = await requireStationCapability(transactionContext, "canManageSecurePassengerData", segment.carrierId, segment.flightInstance.originId, "canCheckIn");
    await lockBooking(transactionContext, bookingPassenger.bookingId);
    const currentBooking = await transactionContext.prisma.booking.findUnique({ where: { id: bookingPassenger.bookingId }, select: { status: true } });
    const currentSegment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: segment.id }, select: { status: true, bookingId: true } });
    if (!currentBooking || !currentSegment || currentSegment.bookingId !== bookingPassenger.bookingId || ["cancelled", "completed"].includes(currentBooking.status) || ["cancelled", "refunded", "reaccommodated", "flown"].includes(currentSegment.status)) throw new Error("Booking changed while preparing document registration.");
    const passengerLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "Passenger" WHERE "id" = ${bookingPassenger.passengerId} FOR UPDATE`);
    throwIfKeystonePrismaError(passengerLock);
    const documentNumber = args.documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const documentTypes = /* @__PURE__ */ new Set(["passport", "national_id", "residence_permit", "visa", "known_traveler", "redress", "other"]);
    const issuingCountryCode = args.issuingCountryCode.trim().toUpperCase();
    const nationalityCode = args.nationalityCode?.trim().toUpperCase() || null;
    const providerReference = args.providerReference.trim();
    const evidenceVersion = args.evidenceVersion.trim();
    const expiresAt = new Date(args.expiresAt);
    const issuedAt = args.issuedAt ? new Date(args.issuedAt) : null;
    const verificationExpiresAt = new Date(args.verificationExpiresAt);
    if (!documentTypes.has(args.documentType) || documentNumber.length < 4 || documentNumber.length > 64 || !/^[A-Z]{2}$/.test(issuingCountryCode) || nationalityCode && !/^[A-Z]{2}$/.test(nationalityCode)) throw new Error("Travel-document identity fields are invalid.");
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= /* @__PURE__ */ new Date() || issuedAt && (Number.isNaN(issuedAt.getTime()) || issuedAt > /* @__PURE__ */ new Date() || issuedAt >= expiresAt)) throw new Error("Travel-document validity is invalid.");
    if (Number.isNaN(verificationExpiresAt.getTime()) || verificationExpiresAt <= /* @__PURE__ */ new Date() || verificationExpiresAt > expiresAt) throw new Error("Verification expiry must be current and no later than the document expiry.");
    if (!providerReference || providerReference.length > 200 || !evidenceVersion || evidenceVersion.length > 100) throw new Error("A bounded manual/provider reference and evidence version are required.");
    const tokenizationKey = process.env.TRAVEL_DOCUMENT_TOKENIZATION_KEY?.trim() ?? "";
    if (tokenizationKey.length < 32) throw new Error("Travel-document tokenization is not configured.");
    const documentToken = `tdoc_${import_node_crypto5.default.createHmac("sha256", tokenizationKey).update(`${segment.carrierId}\0${documentNumber}`).digest("hex")}`;
    const documentNumberHash = import_node_crypto5.default.createHash("sha256").update(documentToken).digest("hex");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id, documentType: args.documentType, documentNumberHash, issuingCountryCode, nationalityCode, issuedAt: issuedAt?.toISOString() ?? null, expiresAt: expiresAt.toISOString(), providerReference, evidenceVersion, verificationExpiresAt: verificationExpiresAt.toISOString() };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, segment.carrierId, key, "document.register-verify", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const claim = await beginOperation(sudo, transactionContext, segment.carrierId, key, "document.register-verify", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const retained = await transactionContext.prisma.travelDocument.findFirst({ where: { carrierId: segment.carrierId, passengerId: bookingPassenger.passengerId, documentNumberHash } });
    if (retained && ["rejected", "expired", "revoked"].includes(retained.status)) throw new Error("A rejected, expired, or revoked travel document cannot be reactivated.");
    if (retained && (retained.documentType !== args.documentType || retained.issuingCountryCode !== issuingCountryCode)) throw new Error("Retained travel-document identity does not match this attestation.");
    const now = /* @__PURE__ */ new Date();
    const document = retained ? await transactionContext.prisma.travelDocument.update({ where: { id: retained.id }, data: { nationalityCode, issuedAt, expiresAt, status: "verified", verificationProviderReference: providerReference, verifiedAt: now, verifiedById: actor.itemId } }) : await transactionContext.prisma.travelDocument.create({ data: { carrierId: segment.carrierId, passengerId: bookingPassenger.passengerId, documentType: args.documentType, documentNumberToken: documentToken, documentNumberHash, documentNumberLast4: documentNumber.slice(-4), issuingCountryCode, nationalityCode, issuedAt, expiresAt, status: "verified", verificationProviderReference: providerReference, verifiedAt: now, verifiedById: actor.itemId } });
    const verification = await transactionContext.prisma.documentVerification.create({ data: { carrierId: segment.carrierId, verificationKey: claim.storageKey, passengerId: bookingPassenger.passengerId, travelDocumentId: document.id, bookingSegmentId: segment.id, status: "verified", evidenceVersion, providerReference, verifiedById: actor.itemId, verifiedAt: now, expiresAt: verificationExpiresAt } });
    await writeAudit(sudo, transactionContext, { carrierId: segment.carrierId, key: claim.storageKey, action: "document.register-verify", aggregateType: "TravelDocument", aggregateId: document.id, after: { status: "verified", documentType: args.documentType, issuingCountryCode, expiresAt: expiresAt.toISOString() }, metadata: { bookingSegmentId: segment.id, documentVerificationId: verification.id, evidenceVersion } });
    const result = { resourceType: "TravelDocument", resourceId: document.id, status: "verified", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function verifyPassengerTravelDocument(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageSecurePassengerData");
    const sudo = transactionContext.sudo();
    const document = await transactionContext.prisma.travelDocument.findUnique({ where: { id: args.travelDocumentId }, include: { passenger: true } });
    const segment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: args.bookingSegmentId }, include: { flightInstance: true, booking: { include: { passengers: true } } } });
    if (!document || !segment || document.carrierId !== segment.carrierId || !segment.booking.passengers.some((entry) => entry.passengerId === document.passengerId)) {
      throw new Error("Resource not found or inaccessible.");
    }
    await requireStationCapability(transactionContext, "canManageSecurePassengerData", segment.carrierId, segment.flightInstance.originId, "canCheckIn");
    await lockBooking(transactionContext, segment.bookingId);
    const currentBooking = await transactionContext.prisma.booking.findUnique({ where: { id: segment.bookingId }, select: { status: true } });
    const currentSegment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: segment.id }, select: { status: true } });
    if (!currentBooking || !currentSegment || ["cancelled", "completed"].includes(currentBooking.status) || ["cancelled", "refunded", "reaccommodated", "flown"].includes(currentSegment.status)) throw new Error("Booking changed while preparing document verification.");
    if (document.status !== "verified" || !document.expiresAt || document.expiresAt <= /* @__PURE__ */ new Date()) throw new Error("The travel document is not current.");
    const expiresAt = new Date(args.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= /* @__PURE__ */ new Date() || expiresAt > document.expiresAt) throw new Error("Verification expiry must be current and no later than the document expiry.");
    const providerReference = args.providerReference.trim();
    const evidenceVersion = args.evidenceVersion.trim();
    if (!providerReference || providerReference.length > 200 || !evidenceVersion || evidenceVersion.length > 100) throw new Error("A bounded provider/manual reference and evidence version are required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { travelDocumentId: document.id, bookingSegmentId: segment.id, providerReference, evidenceVersion, expiresAt: expiresAt.toISOString() };
    const inspected = await inspectOperation(sudo, segment.carrierId, key, "document.verify", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const claim = await beginOperation(sudo, transactionContext, segment.carrierId, key, "document.verify", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const verification = await sudo.query.DocumentVerification.createOne({
      data: {
        carrier: { connect: { id: segment.carrierId } },
        verificationKey: claim.storageKey,
        passenger: { connect: { id: document.passengerId } },
        travelDocument: { connect: { id: document.id } },
        bookingSegment: { connect: { id: segment.id } },
        status: "verified",
        evidenceVersion,
        providerReference,
        verifiedBy: { connect: { id: transactionContext.session.itemId } },
        expiresAt: expiresAt.toISOString()
      },
      query: "id status"
    });
    await writeAudit(sudo, transactionContext, { carrierId: segment.carrierId, key: claim.storageKey, action: "document.verify", aggregateType: "DocumentVerification", aggregateId: verification.id, after: { status: "verified", expiresAt: expiresAt.toISOString() }, metadata: { bookingSegmentId: segment.id } });
    const result = { resourceType: "DocumentVerification", resourceId: verification.id, status: "verified", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function checkInBookingPassenger(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    const customerBookingId = isStorefrontContext(transactionContext) ? transactionContext.session?.data?.storefrontBookingId : void 0;
    if (!customerBookingId || customerBookingId !== args.customerBookingId) await requireFreshPermission(transactionContext, "canManageAirportService");
    const sudo = transactionContext.sudo();
    const bookingPassenger = await sudo.query.BookingPassenger.findOne({
      where: { id: args.bookingPassengerId },
      query: "id booking { id status carrier { id code } } passenger { id givenName familyName }"
    });
    const segment = await sudo.query.BookingSegment.findOne({
      where: { id: args.bookingSegmentId },
      query: "id status booking { id carrier { id code } } flightInstance { id flightNumber origin { id iataCode } destination { id iataCode } departureGate departureTerminal seatMaps { seats { id designator status seatType characteristics surchargeAmount currencyCode cabin { code } } } }"
    });
    if (!bookingPassenger || !segment || bookingPassenger.booking.id !== segment.booking.id) throw new Error("Passenger and segment must belong to the same booking.");
    const booking = bookingPassenger.booking;
    if (!customerBookingId) await requireStationCapability(transactionContext, "canManageAirportService", booking.carrier.id, segment.flightInstance.origin.id, "canCheckIn");
    else if (booking.id !== customerBookingId) throw new Error("Resource not found or inaccessible.");
    await lockBooking(transactionContext, booking.id);
    const flightLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${segment.flightInstance.id} FOR UPDATE`);
    throwIfKeystonePrismaError(flightLock);
    const currentBooking = await transactionContext.prisma.booking.findUnique({ where: { id: booking.id }, select: { status: true, paymentStatus: true, ticketingStatus: true, accessTokenHash: true, accessTokenExpiresAt: true } });
    const currentSegment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: segment.id }, select: { status: true, flightInstance: { select: { status: true } } } });
    if (!currentBooking || !currentSegment || customerBookingId && !hasCurrentStorefrontBookingAccess(currentBooking, args.customerAccessTokenHash)) throw new Error("Booking changed or access was revoked while preparing check-in.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: args.bookingSegmentId, seatId: args.seatId ?? null };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "check-in.create", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!["ticketed", "in_progress"].includes(currentBooking.status) || currentBooking.paymentStatus === "refunded" || currentBooking.ticketingStatus !== "ticketed") throw new Error("Booking must have a current paid ticket before check-in.");
    if (!["confirmed", "checked_in", "offloaded", "boarded"].includes(currentSegment.status)) throw new Error("Segment is not eligible for check-in.");
    if (["cancelled", "departed", "arrived"].includes(currentSegment.flightInstance?.status)) throw new Error("This dated service is no longer eligible for check-in.");
    const previousCheckIn = await transactionContext.prisma.checkIn.findFirst({
      where: { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, status: true }
    });
    if (previousCheckIn && previousCheckIn.status !== "offloaded") throw new Error("This passenger already has an active or terminal check-in for the itinerary segment.");
    const verification = await transactionContext.prisma.documentVerification.findFirst({
      where: {
        carrierId: booking.carrier.id,
        passengerId: bookingPassenger.passenger.id,
        bookingSegmentId: segment.id,
        status: "verified",
        expiresAt: { gt: /* @__PURE__ */ new Date() },
        travelDocument: { passengerId: bookingPassenger.passenger.id, status: "verified", expiresAt: { gt: /* @__PURE__ */ new Date() } }
      },
      select: { id: true, evidenceVersion: true, providerReference: true },
      orderBy: { verifiedAt: "desc" }
    });
    if (!verification) throw new Error("A current authoritative travel-document verification is required.");
    const couponCandidates = await transactionContext.prisma.ticketCoupon.findMany({
      where: {
        bookingSegmentId: segment.id,
        status: "open",
        ticket: { bookingId: booking.id, bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passenger.id, status: "issued" },
        serviceObligation: { is: { bookingPassengerId: bookingPassenger.id, status: "active" } }
      },
      include: { serviceObligation: true }
    });
    const coupon = couponCandidates.find((candidate) => candidate.serviceObligation && candidate.serviceObligationVersion === candidate.serviceObligation.currentVersion);
    if (!coupon) throw new Error("No current-version open ticket coupon entitles this passenger to this segment.");
    const obligationLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ServiceObligation" WHERE "id" = ${coupon.serviceObligationId} FOR UPDATE`);
    throwIfKeystonePrismaError(obligationLock);
    const couponLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "TicketCoupon" WHERE "id" = ${coupon.id} FOR UPDATE`);
    throwIfKeystonePrismaError(couponLock);
    const currentCoupon = await transactionContext.prisma.ticketCoupon.findUnique({ where: { id: coupon.id }, include: { serviceObligation: true } });
    if (currentCoupon?.status !== "open" || currentCoupon.serviceObligation?.status !== "active" || currentCoupon.serviceObligationVersion !== currentCoupon.serviceObligation.currentVersion) throw new Error("Ticket coupon service obligation changed while preparing check-in.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "check-in.create", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const seats = (segment.flightInstance.seatMaps ?? []).flatMap((seatMap) => seatMap.seats ?? []).filter((seat) => seat.status === "available" && (!args.seatId ? Number(seat.surchargeAmount ?? 0) === 0 : seat.id === args.seatId)).sort((left, right) => left.designator.localeCompare(right.designator));
    const existingAssignment = await transactionContext.prisma.seatAssignment.findFirst({
      where: { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id, status: { in: ["held", "assigned", "confirmed"] } },
      include: { seat: { include: { cabin: true } } }
    });
    let selectedSeat = existingAssignment?.seat;
    for (const candidate of existingAssignment ? [] : seats) {
      const lock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "Seat" WHERE "id" = ${candidate.id} FOR UPDATE`);
      throwIfKeystonePrismaError(lock);
      const occupied = await transactionContext.prisma.seatAssignment.findFirst({
        where: { seatId: candidate.id, status: { in: ["held", "assigned", "confirmed", "boarded"] }, bookingSegment: { flightInstanceId: segment.flightInstance.id } },
        select: { id: true }
      });
      if (!occupied) {
        selectedSeat = candidate;
        break;
      }
    }
    if (!selectedSeat) throw new Error("No seat is available for this segment.");
    if (args.seatId && existingAssignment && selectedSeat.id !== args.seatId) throw new Error("The requested seat differs from the passenger\u2019s existing assignment.");
    if (!existingAssignment && Number(selectedSeat.surchargeAmount ?? 0) > 0) throw new Error("A paid seat entitlement is required for this seat.");
    const seatAssignment = existingAssignment ? await sudo.query.SeatAssignment.updateOne({ where: { id: existingAssignment.id }, data: { status: "confirmed", confirmedAt: now }, query: "id" }) : await sudo.query.SeatAssignment.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } },
        assignmentKey: `${bookingPassenger.id}:${segment.id}:${selectedSeat.id}`,
        occupancyKey: `${segment.flightInstance.id}:${selectedSeat.id}`,
        booking: { connect: { id: booking.id } },
        bookingPassenger: { connect: { id: bookingPassenger.id } },
        passenger: { connect: { id: bookingPassenger.passenger.id } },
        bookingSegment: { connect: { id: segment.id } },
        seat: { connect: { id: selectedSeat.id } },
        status: "confirmed",
        seatDesignatorSnapshot: selectedSeat.designator,
        cabinCodeSnapshot: selectedSeat.cabin?.code ?? "Y",
        characteristicsSnapshot: selectedSeat.characteristics ?? [],
        amount: selectedSeat.surchargeAmount ?? 0,
        currencyCode: selectedSeat.currencyCode,
        assignedAt: now,
        confirmedAt: now
      },
      query: "id"
    });
    const checkInData = {
      status: "checked_in",
      channel: customerBookingId ? "web" : "agent",
      travelDocumentsVerified: true,
      checkedInAt: now,
      offloadedAt: null,
      boardedAt: null,
      booking: { connect: { id: booking.id } },
      bookingPassenger: { connect: { id: bookingPassenger.id } },
      passenger: { connect: { id: bookingPassenger.passenger.id } },
      bookingSegment: { connect: { id: segment.id } },
      flightInstance: { connect: { id: segment.flightInstance.id } },
      seatAssignment: { connect: { id: seatAssignment.id } },
      ticketCoupon: { connect: { id: coupon.id } },
      eligibilityData: { documentVerificationId: verification.id, evidenceVersion: verification.evidenceVersion, confirmedAt: now }
    };
    const checkIn = previousCheckIn ? await sudo.query.CheckIn.updateOne({ where: { id: previousCheckIn.id }, data: checkInData, query: "id" }) : await sudo.query.CheckIn.createOne({
      data: { carrier: { connect: { id: booking.carrier.id } }, checkInKey: `${bookingPassenger.id}:${segment.id}`, ...checkInData },
      query: "id"
    });
    const boardingPass = await sudo.query.BoardingPass.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } },
        passNumber: `BP-${randomReference("", 10)}`,
        checkIn: { connect: { id: checkIn.id } },
        passenger: { connect: { id: bookingPassenger.passenger.id } },
        bookingSegment: { connect: { id: segment.id } },
        seatAssignment: { connect: { id: seatAssignment.id } },
        status: "issued",
        barcodeToken: randomReference("BP-", 32),
        seatDesignatorSnapshot: selectedSeat.designator,
        boardingGroup: "A",
        boardingZone: "1",
        gateSnapshot: segment.flightInstance.departureGate ?? "TBD",
        terminalSnapshot: segment.flightInstance.departureTerminal ?? "TBD"
      },
      query: "id"
    });
    await sudo.query.TicketCoupon.updateOne({ where: { id: coupon.id }, data: { status: "checked_in", checkedInAt: now } });
    const remainingBoardedPassengers = await transactionContext.prisma.checkIn.count({ where: { bookingSegmentId: segment.id, status: "boarded" } });
    await sudo.query.BookingSegment.updateOne({ where: { id: segment.id }, data: { status: remainingBoardedPassengers ? "boarded" : "checked_in" } });
    await writeAudit(sudo, transactionContext, {
      carrierId: booking.carrier.id,
      key: claim.storageKey,
      action: "check-in.create",
      aggregateType: "CheckIn",
      aggregateId: checkIn.id,
      after: { status: "checked_in" },
      metadata: { boardingPassId: boardingPass.id, seatAssignmentId: seatAssignment.id, seat: selectedSeat.designator }
    });
    const result = { resourceType: "CheckIn", resourceId: checkIn.id, status: "checked_in", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function acceptCheckedBag(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageAirportService");
    const sudo = transactionContext.sudo();
    let bookingPassenger = await transactionContext.prisma.bookingPassenger.findUnique({
      where: { id: args.bookingPassengerId },
      include: { booking: true, passenger: true }
    });
    let flight = await transactionContext.prisma.flightInstance.findUnique({ where: { id: args.flightInstanceId }, include: { carrier: { select: { code: true } }, origin: true, destination: true } });
    if (!bookingPassenger || !flight || bookingPassenger.booking.carrierId !== flight.carrierId) throw new Error("Resource not found or inaccessible.");
    if (!["ticketed", "in_progress"].includes(bookingPassenger.booking.status)) throw new Error("Booking must be ticketed before accepting a bag.");
    await requireStationCapability(transactionContext, "canManageAirportService", flight.carrierId, flight.originId, "canAcceptBags");
    await lockBooking(transactionContext, bookingPassenger.bookingId);
    bookingPassenger = await transactionContext.prisma.bookingPassenger.findUnique({ where: { id: args.bookingPassengerId }, include: { booking: true, passenger: true } });
    flight = await transactionContext.prisma.flightInstance.findUnique({ where: { id: args.flightInstanceId }, include: { carrier: { select: { code: true } }, origin: true, destination: true } });
    if (!bookingPassenger || !flight || bookingPassenger.booking.carrierId !== flight.carrierId || !["ticketed", "in_progress"].includes(bookingPassenger.booking.status) || !["scheduled", "open_for_sale", "closed_for_sale", "delayed"].includes(flight.status)) throw new Error("Booking or flight changed while preparing bag acceptance.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    if (!Number.isInteger(args.weightGrams) || args.weightGrams < 0 || args.weightGrams > 1e5) throw new Error("Bag weight must be an integer between 0 and 100000 grams.");
    const request = { bookingPassengerId: args.bookingPassengerId, flightInstanceId: args.flightInstanceId, weightGrams: args.weightGrams };
    const inspected = await inspectOperation(sudo, flight.carrierId, key, "bag.accept", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const segment = await transactionContext.prisma.bookingSegment.findFirst({
      where: { bookingId: bookingPassenger.bookingId, flightInstanceId: flight.id, status: "checked_in" },
      include: {
        checkIns: { where: { bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passengerId, status: "checked_in" }, include: { ticketCoupon: true } }
      }
    });
    const checkIn = segment?.checkIns?.[0];
    if (!segment || !checkIn?.ticketCoupon || checkIn.ticketCoupon.status !== "checked_in") throw new Error("A checked-in passenger and valid flight coupon are required for bag acceptance.");
    const existingBagCount = await transactionContext.prisma.bag.count({ where: { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id } });
    const allowance = normalizeIncludedBaggageSnapshot(segment.includedBaggageSnapshot);
    const withinIncludedAllowance = existingBagCount < allowance.pieces && args.weightGrams <= allowance.maxWeightGrams;
    const paidCandidates = withinIncludedAllowance ? [] : await transactionContext.prisma.electronicMiscCoupon.findMany({
      where: {
        bookingSegmentId: segment.id,
        status: "open",
        ancillaryProduct: { type: "checked_bag", status: "active" },
        document: { bookingId: bookingPassenger.bookingId, bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passengerId, status: "issued" }
      },
      include: { document: true, ancillaryProduct: true }
    });
    const paidCoupon = paidCandidates.find((candidate) => {
      const product = candidate.ancillaryProduct;
      const attributes = product?.attributes ?? {};
      const expectedAmount = Number(product?.defaultPriceAmount ?? 0) + Number(product?.taxAmount ?? 0);
      const expectedCurrency = String(product?.currencyCode ?? "");
      const maxWeight = Number(attributes.maxWeightGrams ?? 1e5);
      return candidate.amount === expectedAmount && candidate.currencyCode === expectedCurrency && candidate.document.totalAmount >= candidate.amount && candidate.document.currencyCode === expectedCurrency && expectedCurrency === bookingPassenger.booking.currencyCode && args.weightGrams <= maxWeight;
    });
    if (!withinIncludedAllowance && !paidCoupon) throw new Error("No unused checked-bag entitlement with matching amount, currency, passenger, segment, and weight covers this bag.");
    if (paidCoupon) {
      const entitlementLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ElectronicMiscCoupon" WHERE "id" = ${paidCoupon.id} FOR UPDATE`);
      throwIfKeystonePrismaError(entitlementLock);
      const currentEntitlement = await transactionContext.prisma.electronicMiscCoupon.findUnique({ where: { id: paidCoupon.id }, select: { status: true } });
      if (currentEntitlement?.status !== "open") throw new Error("The checked-bag entitlement was already consumed.");
    }
    const claim = await beginOperation(sudo, transactionContext, flight.carrierId, key, "bag.accept", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const bag = await sudo.query.Bag.createOne({
      data: {
        carrier: { connect: { id: flight.carrierId } },
        bagKey: `BAG-${randomReference("", 10)}`,
        tagNumber: `${flight.carrier.code}${randomReference("", 8)}`,
        booking: { connect: { id: bookingPassenger.bookingId } },
        bookingPassenger: { connect: { id: bookingPassenger.id } },
        passenger: { connect: { id: bookingPassenger.passengerId } },
        flightInstance: { connect: { id: flight.id } },
        bookingSegment: { connect: { id: segment.id } },
        checkIn: { connect: { id: checkIn.id } },
        ticketCoupon: { connect: { id: checkIn.ticketCoupon.id } },
        entitlementDocument: paidCoupon ? { connect: { id: paidCoupon.document.id } } : void 0,
        origin: { connect: { id: flight.originId } },
        destination: { connect: { id: flight.destinationId } },
        status: "accepted",
        bagType: "checked",
        weightGrams: args.weightGrams,
        acceptedAt: (/* @__PURE__ */ new Date()).toISOString(),
        routeSnapshot: [{ flightInstanceId: flight.id }]
      },
      query: "id"
    });
    if (paidCoupon) await sudo.query.ElectronicMiscCoupon.updateOne({ where: { id: paidCoupon.id }, data: { status: "used", usedAt: (/* @__PURE__ */ new Date()).toISOString() } });
    await sudo.query.BagEvent.createOne({ data: { carrier: { connect: { id: flight.carrierId } }, eventKey: `${bag.id}:accepted`, bag: { connect: { id: bag.id } }, eventType: "accepted", statusSnapshot: "accepted", occurredAt: (/* @__PURE__ */ new Date()).toISOString(), source: "system", payloadSummary: { weightGrams: args.weightGrams } }, query: "id" });
    await writeAudit(sudo, transactionContext, { carrierId: flight.carrierId, key: claim.storageKey, action: "bag.accept", aggregateType: "Bag", aggregateId: bag.id, after: { status: "accepted" }, metadata: { weightGrams: args.weightGrams, bookingSegmentId: segment.id, entitlement: paidCoupon ? "emd" : "included" } });
    const result = { resourceType: "Bag", resourceId: bag.id, status: "accepted", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}

// features/keystone/mutations/storefront.ts
var import_node_crypto8 = __toESM(require("node:crypto"));
var import_client4 = require("@prisma/client");

// features/keystone/lib/rate-limit.ts
var import_node_crypto6 = __toESM(require("node:crypto"));
var import_client3 = require("@prisma/client");
async function consumeDurableRateLimit(prisma, scope, signal, limit, windowMs) {
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const key = import_node_crypto6.default.createHash("sha256").update(`${scope}\0${signal}`).digest("hex");
  const rows = await prisma.$queryRaw(import_client3.Prisma.sql`
    INSERT INTO "RateLimitBucket" ("id", "key", "scope", "count", "windowStartedAt", "expiresAt", "createdAt", "updatedAt")
    VALUES (${import_node_crypto6.default.randomUUID()}, ${key}, ${scope}, 1, ${now}, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStartedAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now} ELSE "RateLimitBucket"."windowStartedAt" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "count"
  `);
  if (!rows[0] || rows[0].count > limit) throw new Error("This request cannot be completed right now.");
}

// features/keystone/lib/request-identity.ts
var import_node_crypto7 = __toESM(require("node:crypto"));
var import_node_net = __toESM(require("node:net"));
function normalizeAddress(value) {
  const address = value.trim();
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}
function configuredTrustedProxies() {
  const configured = process.env.TRUSTED_PROXY_IPS?.split(",").map(normalizeAddress).filter(Boolean) ?? [];
  if (process.env.NODE_ENV !== "production") return /* @__PURE__ */ new Set([...configured, "127.0.0.1", "::1"]);
  if (!configured.length) throw new Error("TRUSTED_PROXY_IPS is required in production.");
  return new Set(configured);
}
function trustedClientAddress(request) {
  const peer = normalizeAddress(request.socket?.remoteAddress ?? "");
  if (!peer || import_node_net.default.isIP(peer) === 0) return "unknown";
  if (!configuredTrustedProxies().has(peer)) return peer;
  const raw = request.headers?.["x-forwarded-for"];
  const forwarded = Array.isArray(raw) ? raw[0] : raw;
  const candidate = normalizeAddress(String(forwarded ?? "").split(",")[0] ?? "");
  return import_node_net.default.isIP(candidate) ? candidate : peer;
}
function durableRequestFingerprint(request, sessionSignal) {
  return import_node_crypto7.default.createHash("sha256").update(`${trustedClientAddress(request)}\0${sessionSignal ?? ""}`).digest("hex");
}

// features/storefront/lib/theme.ts
var STOREFRONT_BRAND_COLORS = [
  { value: "slate", label: "Slate", hex: "#334155", hover: "#1e293b", soft: "#f1f5f9" },
  { value: "blue", label: "Blue", hex: "#1d4ed8", hover: "#1e40af", soft: "#eff6ff" },
  { value: "indigo", label: "Indigo", hex: "#4338ca", hover: "#3730a3", soft: "#eef2ff" },
  { value: "violet", label: "Violet", hex: "#6d28d9", hover: "#5b21b6", soft: "#f5f3ff" },
  { value: "rose", label: "Rose", hex: "#be123c", hover: "#9f1239", soft: "#fff1f2" },
  { value: "emerald", label: "Emerald", hex: "#047857", hover: "#065f46", soft: "#ecfdf5" },
  { value: "amber", label: "Amber", hex: "#92400e", hover: "#78350f", soft: "#fffbeb" }
];
function normalizeStorefrontBrandColor(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return STOREFRONT_BRAND_COLORS.some((option) => option.value === normalized) ? normalized : null;
}
function storefrontBrandPalette(value) {
  const normalized = normalizeStorefrontBrandColor(value);
  return STOREFRONT_BRAND_COLORS.find((option) => option.value === normalized) ?? null;
}
function hasConfiguredStorefrontBrand(settings) {
  return Boolean(
    storefrontBrandPalette(settings?.storefrontBrandColor) && typeof settings?.storefrontHomepageTitle === "string" && settings.storefrontHomepageTitle.trim() && typeof settings?.storefrontHomepageDescription === "string" && settings.storefrontHomepageDescription.trim()
  );
}

// features/keystone/mutations/storefront.ts
async function consumeRateLimit(context, scope, limit, windowMs, sessionSignal) {
  const request = context.req ?? {};
  await consumeDurableRateLimit(context.prisma, `${scope}.client`, durableRequestFingerprint(request), limit, windowMs);
  if (sessionSignal) await consumeDurableRateLimit(context.prisma, `${scope}.session`, durableRequestFingerprint(request, sessionSignal), limit, windowMs);
}
function bookingAccessToken(shoppingSessionToken, offerId) {
  return import_node_crypto8.default.createHmac("sha256", shoppingSessionToken).update(`booking-access:${offerId}`).digest("base64url");
}
function requiredText2(value, label, max = 120) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} is required and must be at most ${max} characters.`);
  return normalized;
}
function email(value) {
  const normalized = requiredText2(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter a valid email address.");
  return normalized;
}
async function lookupDirectCarrier(prisma, carrierCode) {
  const carrier = await prisma.carrier.findFirst({
    where: { code: carrierCode.trim().toUpperCase(), status: "active", directSalesEnabled: true },
    select: {
      id: true,
      code: true,
      name: true,
      legalName: true,
      defaultCurrencyCode: true,
      defaultTimezone: true,
      storefrontBrandColor: true,
      storefrontHomepageTitle: true,
      storefrontHomepageDescription: true
    }
  });
  if (!carrier) throw new Error("Direct sales are not available for this carrier.");
  const storefrontBrandColor = normalizeStorefrontBrandColor(carrier.storefrontBrandColor);
  const storefrontConfigured = hasConfiguredStorefrontBrand({ ...carrier, storefrontBrandColor });
  if (!storefrontConfigured) throw new Error("Direct sales are unavailable until storefront branding is configured.");
  return { ...carrier, storefrontBrandColor, storefrontConfigured, salesEnabled: true };
}
async function lookupCarrierIdentity(prisma, carrierCode) {
  const carrier = await prisma.carrier.findUnique({
    where: { code: carrierCode.trim().toUpperCase() },
    select: { id: true, code: true, name: true, legalName: true, defaultCurrencyCode: true, defaultTimezone: true, status: true, directSalesEnabled: true, storefrontBrandColor: true, storefrontHomepageTitle: true, storefrontHomepageDescription: true }
  });
  if (!carrier) throw new Error("Carrier identity is not configured.");
  const storefrontBrandColor = normalizeStorefrontBrandColor(carrier.storefrontBrandColor);
  const storefrontConfigured = hasConfiguredStorefrontBrand({ ...carrier, storefrontBrandColor });
  return { ...carrier, storefrontBrandColor, storefrontConfigured, salesEnabled: storefrontConfigured && carrier.status === "active" && carrier.directSalesEnabled === true };
}
function operatorOnlyLaunchSetup(env = process.env) {
  return env.NODE_ENV === "production" && env.ALLOW_INCOMPLETE_LAUNCH_SETUP === "true";
}
function configuredPublicCarrierCode(env = process.env) {
  const configured = env.STOREFRONT_CARRIER_CODE?.trim().toUpperCase() || (env.NODE_ENV === "production" ? "" : "AV");
  if (!/^[A-Z0-9]{2,3}$/.test(configured)) throw new Error("Public carrier configuration is unavailable.");
  return configured;
}
function isConfiguredPublicCarrier(carrierCode, env = process.env) {
  return carrierCode.trim().toUpperCase() === configuredPublicCarrierCode(env);
}
function assertConfiguredPublicCarrier(carrierCode) {
  if (!isConfiguredPublicCarrier(carrierCode)) throw new Error("Carrier is unavailable on this storefront.");
}
function directCarrier(context, carrierCode) {
  assertConfiguredPublicCarrier(carrierCode);
  if (operatorOnlyLaunchSetup()) throw new Error("Direct sales are disabled during operator-only launch setup.");
  return lookupDirectCarrier(context.prisma, carrierCode);
}
async function getPublicCarrierIdentity(_root, args, context) {
  assertConfiguredPublicCarrier(args.carrierCode);
  try {
    const identity = await lookupCarrierIdentity(context.prisma, args.carrierCode);
    return operatorOnlyLaunchSetup() ? { ...identity, salesEnabled: false } : identity;
  } catch (error) {
    if (error instanceof Error && error.message === "Carrier identity is not configured.") return null;
    throw error;
  }
}
function adultDateOfBirth(value, serviceDate) {
  const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(value) ? /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`) : /* @__PURE__ */ new Date("invalid");
  const departureDate = /* @__PURE__ */ new Date(`${serviceDate.toISOString().slice(0, 10)}T23:59:59.999Z`);
  const adultAtDeparture = new Date(dateOfBirth);
  adultAtDeparture.setUTCFullYear(adultAtDeparture.getUTCFullYear() + 18);
  const oldestAccepted = new Date(departureDate);
  oldestAccepted.setUTCFullYear(oldestAccepted.getUTCFullYear() - 120);
  if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth.toISOString().slice(0, 10) !== value || adultAtDeparture > departureDate || dateOfBirth < oldestAccepted) throw new Error("An adult date of birth is required for the bounded launch.");
  return dateOfBirth;
}
async function publicAirlineFlightOptions(root, args, context) {
  await consumeRateLimit(context, "storefront.search", 60, 6e4);
  const carrier = await directCarrier(context, args.carrierCode);
  return searchAirlineFlights(root, args, withStorefrontSession(context, carrier));
}
function normalizePublicFlightStatusInput(input) {
  const flightNumber = input.flightNumber.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(flightNumber)) throw new Error("Flight number must contain one to six letters or digits.");
  return { flightNumber, serviceDate: normalizeSearchDate(input.serviceDate) };
}
async function publicFlightStatuses(_root, args, context) {
  await consumeRateLimit(context, "storefront.flight-status", 60, 6e4);
  assertConfiguredPublicCarrier(args.carrierCode);
  const carrier = await lookupCarrierIdentity(context.prisma, args.carrierCode);
  const input = normalizePublicFlightStatusInput(args);
  const start = /* @__PURE__ */ new Date(`${input.serviceDate}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 864e5);
  const flights = await context.prisma.flightInstance.findMany({
    where: { carrierId: carrier.id, flightNumber: input.flightNumber, serviceDate: { gte: start, lt: end } },
    orderBy: { scheduledDepartureAt: "asc" },
    take: 10,
    select: {
      id: true,
      flightNumber: true,
      status: true,
      serviceDate: true,
      scheduledDepartureAt: true,
      scheduledArrivalAt: true,
      estimatedDepartureAt: true,
      estimatedArrivalAt: true,
      actualDepartureAt: true,
      actualArrivalAt: true,
      departureTerminal: true,
      departureGate: true,
      arrivalTerminal: true,
      arrivalGate: true,
      origin: { select: { iataCode: true, city: true } },
      destination: { select: { iataCode: true, city: true } },
      disruptions: {
        where: { status: { in: ["published", "recovering"] } },
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: { type: true, status: true, publicSummary: true, publishedAt: true }
      }
    }
  });
  return flights.map((flight) => ({
    ...flight,
    serviceDate: flight.serviceDate.toISOString().slice(0, 10),
    scheduledDepartureAt: flight.scheduledDepartureAt.toISOString(),
    scheduledArrivalAt: flight.scheduledArrivalAt.toISOString(),
    estimatedDepartureAt: flight.estimatedDepartureAt?.toISOString() ?? null,
    estimatedArrivalAt: flight.estimatedArrivalAt?.toISOString() ?? null,
    actualDepartureAt: flight.actualDepartureAt?.toISOString() ?? null,
    actualArrivalAt: flight.actualArrivalAt?.toISOString() ?? null,
    originCode: flight.origin.iataCode,
    originCity: flight.origin.city,
    destinationCode: flight.destination.iataCode,
    destinationCity: flight.destination.city,
    disruption: flight.disruptions[0] ? {
      ...flight.disruptions[0],
      publishedAt: flight.disruptions[0].publishedAt?.toISOString() ?? null
    } : null
  }));
}
async function createCustomerOffer(_root, args, context) {
  const shoppingSessionHash = hashStorefrontToken(args.shoppingSessionToken);
  await consumeRateLimit(context, "storefront.offer", 10, 15 * 6e4, shoppingSessionHash);
  const carrier = await directCarrier(context, args.carrierCode);
  const storefrontContext = withStorefrontSession(context, carrier);
  return runSerializableTransaction(storefrontContext, async (transactionContext) => {
    const flight = await transactionContext.prisma.flightInstance.findFirst({
      where: { id: args.flightInstanceId, carrierId: carrier.id, status: { in: ["scheduled", "open_for_sale", "delayed"] }, scheduledDepartureAt: { gt: /* @__PURE__ */ new Date() } },
      select: { id: true, serviceDate: true }
    });
    if (!flight) throw new Error("The selected flight is not available for direct sale.");
    validatePassengerCount(args.passengers.length);
    const normalizedPassengers = args.passengers.map((input, index) => {
      let dateOfBirth;
      try {
        dateOfBirth = adultDateOfBirth(input.dateOfBirth, flight.serviceDate);
      } catch {
        throw new Error(`Passenger ${index + 1} must be an adult with a valid date of birth for the bounded launch.`);
      }
      return {
        passengerKey: `${carrier.code}:WEB:${import_node_crypto8.default.createHash("sha256").update(`${shoppingSessionHash}\0${args.idempotencyKey}\0${index}`).digest("hex").slice(0, 32)}`,
        carrierId: carrier.id,
        givenName: requiredText2(input.givenName, `Passenger ${index + 1} given name`, 80),
        familyName: requiredText2(input.familyName, `Passenger ${index + 1} family name`, 80),
        dateOfBirth,
        email: email(input.email),
        phone: input.phone?.trim().slice(0, 40) || ""
      };
    });
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const sudo = transactionContext.sudo();
    const request = { carrierId: carrier.id, flightInstanceId: args.flightInstanceId, inventoryBucketId: args.inventoryBucketId, shoppingSessionHash, passengers: normalizedPassengers.map((passenger) => ({ ...passenger, dateOfBirth: passenger.dateOfBirth.toISOString() })) };
    const claim = await beginOperation(sudo, transactionContext, carrier.id, key, "customer-offer.create", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const passengerIds = [];
    for (const passengerData of normalizedPassengers) {
      const existing = await sudo.query.Passenger.findOne({ where: { passengerKey: passengerData.passengerKey }, query: "id carrier { id }" });
      if (existing && existing.carrier?.id !== carrier.id) throw new Error("Passenger identity belongs to another carrier.");
      const profile = { givenName: passengerData.givenName, familyName: passengerData.familyName, dateOfBirth: passengerData.dateOfBirth.toISOString(), email: passengerData.email, phone: passengerData.phone };
      const passenger = existing ? await sudo.query.Passenger.updateOne({ where: { id: existing.id }, data: profile, query: "id" }) : await sudo.query.Passenger.createOne({ data: { passengerKey: passengerData.passengerKey, carrier: { connect: { id: carrier.id } }, ...profile }, query: "id" });
      passengerIds.push(passenger.id);
    }
    const result = await createOfferInTransaction({ flightInstanceId: args.flightInstanceId, inventoryBucketId: args.inventoryBucketId, passengerIds, idempotencyKey: args.idempotencyKey, shoppingSessionHash }, transactionContext);
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function createCustomerBooking(root, args, context) {
  const shoppingSessionHash = hashStorefrontToken(args.shoppingSessionToken);
  await consumeRateLimit(context, "storefront.booking", 10, 15 * 6e4, shoppingSessionHash);
  const offer = await context.prisma.offer.findUnique({
    where: { id: args.offerId },
    select: { carrier: { select: { id: true, code: true } }, shoppingSessionId: true }
  });
  if (!offer?.carrier?.code || offer.shoppingSessionId !== shoppingSessionHash) {
    throw new Error("This shopping session does not own the offer.");
  }
  const carrier = await directCarrier(context, offer.carrier.code);
  if (carrier.id !== offer.carrier.id) throw new Error("Carrier is unavailable on this storefront.");
  const accessToken = bookingAccessToken(args.shoppingSessionToken, args.offerId);
  const result = await createBookingFromOffer(root, {
    offerId: args.offerId,
    passengerIds: args.passengerIds,
    idempotencyKey: args.idempotencyKey,
    shoppingSessionHash,
    bookingAccessTokenHash: hashStorefrontToken(accessToken)
  }, withStorefrontSession(context, carrier));
  return { ...result, bookingAccessToken: accessToken };
}
async function ownedBooking(context, recordLocator, accessToken) {
  await consumeRateLimit(context, "storefront.manage-booking", 30, 15 * 6e4, hashStorefrontToken(accessToken));
  const booking = await context.prisma.booking.findFirst({
    where: {
      recordLocator: recordLocator.trim().toUpperCase(),
      accessTokenHash: hashStorefrontToken(accessToken),
      accessTokenExpiresAt: { gt: /* @__PURE__ */ new Date() }
    },
    include: {
      carrier: { select: { id: true, code: true, name: true } },
      passengers: { include: { passenger: { select: { id: true, givenName: true, familyName: true } } } },
      segments: {
        include: {
          flightInstance: {
            include: {
              origin: true,
              destination: true,
              seatMaps: {
                where: { status: "published" },
                include: {
                  seats: {
                    where: { status: "available" },
                    include: {
                      cabin: true,
                      assignments: {
                        where: { status: { in: ["held", "assigned", "confirmed", "boarded"] } },
                        select: { bookingId: true, bookingPassengerId: true, bookingSegmentId: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      payments: { select: { status: true, amount: true, currencyCode: true } },
      tickets: { select: { status: true, ticketNumber: true } },
      checkIns: { select: { id: true, bookingPassengerId: true, bookingSegmentId: true, status: true, checkedInAt: true, boardingPass: { select: { id: true, passNumber: true, status: true, barcodeToken: true, seatDesignatorSnapshot: true, boardingGroup: true, boardingZone: true, gateSnapshot: true, terminalSnapshot: true } } } },
      reaccommodations: { select: { id: true, status: true, optionExpiresAt: true, acceptedAt: true, confirmedAt: true, optionSnapshot: true } }
    }
  });
  if (!booking) throw new Error("Booking not found or inaccessible.");
  return booking;
}
async function rotateCustomerBookingAccessToken(_root, args, context) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken);
  const nextToken = import_node_crypto8.default.randomBytes(32).toString("base64url");
  await runSerializableTransaction(context, async (transactionContext) => {
    const bookingLock = await transactionContext.prisma.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`;
    throwIfKeystonePrismaError(bookingLock);
    const current = await transactionContext.prisma.booking.findUnique({ where: { id: booking.id }, select: { accessTokenHash: true, accessTokenExpiresAt: true } });
    if (!current || !hasCurrentStorefrontBookingAccess(current, hashStorefrontToken(args.accessToken))) throw new Error("Booking not found or inaccessible.");
    const now = /* @__PURE__ */ new Date();
    await transactionContext.prisma.booking.update({ where: { id: booking.id }, data: { accessTokenHash: hashStorefrontToken(nextToken), accessTokenExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 6e4) } });
    const eventKey = `booking-access-rotated:${booking.id}:${import_node_crypto8.default.randomUUID()}`;
    await transactionContext.prisma.auditEvent.create({ data: { carrierId: booking.carrier.id, eventKey, action: "booking.access-token.rotate", aggregateType: "Booking", aggregateId: booking.id, source: "storefront", beforeSummary: {}, afterSummary: { accessRevoked: true }, metadata: {}, occurredAt: now } });
    await transactionContext.prisma.outboxEvent.create({ data: { carrierId: booking.carrier.id, eventKey, topic: "booking.access-token.rotated", aggregateType: "Booking", aggregateId: booking.id, payload: {}, status: "pending", availableAt: now } });
  });
  return { recordLocator: booking.recordLocator, accessToken: nextToken };
}
async function checkInCustomerBooking(root, args, context) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken);
  if (!booking.passengers.some((entry) => entry.id === args.bookingPassengerId) || !booking.segments.some((segment) => segment.id === args.bookingSegmentId)) throw new Error("Booking not found or inaccessible.");
  return checkInBookingPassenger(root, {
    bookingPassengerId: args.bookingPassengerId,
    bookingSegmentId: args.bookingSegmentId,
    seatId: args.seatId,
    idempotencyKey: args.idempotencyKey,
    customerBookingId: booking.id,
    customerAccessTokenHash: hashStorefrontToken(args.accessToken)
  }, withStorefrontSession(context, booking.carrier, booking.id));
}
async function cancelCustomerBooking(root, args, context) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken);
  return cancelBooking(root, {
    bookingId: booking.id,
    reason: args.reason,
    idempotencyKey: args.idempotencyKey,
    customerBookingId: booking.id,
    customerAccessTokenHash: hashStorefrontToken(args.accessToken)
  }, withStorefrontSession(context, booking.carrier, booking.id));
}
async function assignCustomerSeat(_root, args, context) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken);
  if (!booking.passengers.some((entry) => entry.id === args.bookingPassengerId) || !booking.segments.some((entry) => entry.id === args.bookingSegmentId)) throw new Error("Booking not found or inaccessible.");
  return runSerializableTransaction(context, async (transactionContext) => {
    const bookingLock = await transactionContext.prisma.$queryRaw(import_client4.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`);
    throwIfKeystonePrismaError(bookingLock);
    const currentBooking = await transactionContext.prisma.booking.findUnique({
      where: { id: booking.id },
      select: {
        status: true,
        carrierId: true,
        accessTokenHash: true,
        accessTokenExpiresAt: true,
        passengers: { where: { id: args.bookingPassengerId }, select: { id: true, passengerId: true } }
      }
    });
    const expectedTokenHash = hashStorefrontToken(args.accessToken);
    if (!currentBooking || currentBooking.carrierId !== booking.carrier.id || !hasCurrentStorefrontBookingAccess(currentBooking, expectedTokenHash) || !currentBooking.passengers[0]) throw new Error("Booking changed or access was revoked while preparing seat assignment.");
    if (!["pending", "confirmed", "ticketed", "in_progress"].includes(currentBooking.status)) throw new Error("Booking is not eligible for seat assignment.");
    const operationContext = withStorefrontSession(transactionContext, booking.carrier, booking.id);
    const sudo = operationContext.sudo();
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingId: booking.id, bookingPassengerId: args.bookingPassengerId, bookingSegmentId: args.bookingSegmentId, seatId: args.seatId };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "customer-seat.assign", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const segment = await transactionContext.prisma.bookingSegment.findFirst({ where: { id: args.bookingSegmentId, bookingId: booking.id }, include: { flightInstance: true } });
    if (!segment || !["confirmed"].includes(segment.status)) throw new Error("The booking segment is not eligible for seat assignment.");
    const activeCheckIn = await transactionContext.prisma.checkIn.findFirst({ where: { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: segment.id, status: { in: ["checked_in", "boarded"] } }, select: { id: true } });
    if (activeCheckIn) throw new Error("Seats cannot be changed after check-in; use the controlled station workflow.");
    const seat = await transactionContext.prisma.seat.findFirst({ where: { id: args.seatId, carrierId: booking.carrier.id, seatMap: { flightInstanceId: segment.flightInstanceId, status: "published" }, status: "available" }, include: { cabin: true } });
    if (!seat) throw new Error("The selected seat is not available for this segment.");
    const seatLock = await transactionContext.prisma.$queryRaw(import_client4.Prisma.sql`SELECT "id" FROM "Seat" WHERE "id" = ${seat.id} FOR UPDATE`);
    throwIfKeystonePrismaError(seatLock);
    const occupancyKey = `${segment.flightInstanceId}:${seat.id}`;
    const priorAssignments = await transactionContext.prisma.seatAssignment.findMany({ where: { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: segment.id, status: { in: ["held", "assigned", "confirmed"] } }, orderBy: { createdAt: "asc" } });
    const existing = priorAssignments.find((assignment2) => assignment2.seatId === seat.id);
    const occupied = await transactionContext.prisma.seatAssignment.findUnique({ where: { occupancyKey } });
    if (occupied && occupied.id !== existing?.id) throw new Error("The selected seat is no longer available.");
    const claim = await beginOperation(sudo, operationContext, booking.carrier.id, key, "customer-seat.assign", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    if (existing) {
      const result2 = { resourceType: "SeatAssignment", resourceId: existing.id, status: existing.status, changed: false, replayed: false };
      await finishOperation(sudo, claim.record.id, result2);
      return result2;
    }
    let entitlement = null;
    if (seat.surchargeAmount > 0) {
      entitlement = await transactionContext.prisma.electronicMiscCoupon.findFirst({ where: { bookingSegmentId: segment.id, status: "open", amount: seat.surchargeAmount, currencyCode: seat.currencyCode, ancillaryProduct: { type: "seat" }, entitlementSnapshot: { path: ["seatId"], equals: seat.id }, document: { bookingId: booking.id, bookingPassengerId: args.bookingPassengerId, status: "issued" } } });
      if (!entitlement) throw new Error("A paid seat entitlement is required for this seat.");
      const entitlementLock = await transactionContext.prisma.$queryRaw(import_client4.Prisma.sql`SELECT "id" FROM "ElectronicMiscCoupon" WHERE "id" = ${entitlement.id} FOR UPDATE`);
      throwIfKeystonePrismaError(entitlementLock);
      const currentEntitlement = await transactionContext.prisma.electronicMiscCoupon.findUnique({ where: { id: entitlement.id }, select: { status: true } });
      if (currentEntitlement?.status !== "open") throw new Error("The paid seat entitlement was already consumed.");
    }
    const now = /* @__PURE__ */ new Date();
    for (const prior of priorAssignments) await transactionContext.prisma.seatAssignment.update({ where: { id: prior.id }, data: { status: "released", occupancyKey: null, releasedAt: now } });
    const assignment = await sudo.query.SeatAssignment.createOne({ data: { carrier: { connect: { id: booking.carrier.id } }, assignmentKey: claim.storageKey, occupancyKey, booking: { connect: { id: booking.id } }, bookingPassenger: { connect: { id: args.bookingPassengerId } }, passenger: { connect: { id: currentBooking.passengers[0].passengerId } }, bookingSegment: { connect: { id: segment.id } }, seat: { connect: { id: seat.id } }, status: "assigned", seatDesignatorSnapshot: seat.designator, cabinCodeSnapshot: seat.cabin?.code ?? "Y", characteristicsSnapshot: seat.characteristics ?? [], amount: seat.surchargeAmount, currencyCode: seat.currencyCode, assignedAt: now.toISOString() }, query: "id status" });
    if (entitlement) await transactionContext.prisma.electronicMiscCoupon.update({ where: { id: entitlement.id }, data: { status: "used", usedAt: now, entitlementSnapshot: { seatId: seat.id, assignmentId: assignment.id } } });
    await writeAudit(sudo, operationContext, { carrierId: booking.carrier.id, key: claim.storageKey, action: "customer-seat.assign", aggregateType: "SeatAssignment", aggregateId: assignment.id, after: { status: "assigned", seat: seat.designator }, metadata: { bookingId: booking.id, bookingSegmentId: segment.id } });
    const result = { resourceType: "SeatAssignment", resourceId: assignment.id, status: "assigned", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function getCustomerBooking(_root, args, context) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken);
  return {
    id: booking.id,
    recordLocator: booking.recordLocator,
    orderNumber: booking.orderNumber,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    ticketingStatus: booking.ticketingStatus,
    totalAmount: booking.totalAmount,
    currencyCode: booking.currencyCode,
    carrier: booking.carrier,
    passengers: booking.passengers.map((entry) => ({ id: entry.id, passenger: entry.passenger })),
    segments: booking.segments.map((segment) => ({
      id: segment.id,
      status: segment.status,
      flightNumber: segment.flightInstance.flightNumber,
      scheduledDepartureAt: segment.flightInstance.scheduledDepartureAt.toISOString(),
      scheduledArrivalAt: segment.flightInstance.scheduledArrivalAt.toISOString(),
      originCode: segment.flightInstance.origin.iataCode,
      destinationCode: segment.flightInstance.destination.iataCode,
      seats: (segment.flightInstance.seatMaps ?? []).flatMap((map) => map.seats ?? []).map((seat) => {
        const assignment = seat.assignments?.[0];
        const selectedForPassengerId = assignment?.bookingId === booking.id && assignment?.bookingSegmentId === segment.id ? assignment.bookingPassengerId : null;
        return { id: seat.id, designator: seat.designator, seatType: seat.seatType, surchargeAmount: seat.surchargeAmount, currencyCode: seat.currencyCode, cabinCode: seat.cabin?.code, isAvailable: !assignment, selectedForPassengerId };
      })
    })),
    payments: booking.payments,
    tickets: booking.tickets,
    checkIns: booking.checkIns,
    reaccommodations: booking.reaccommodations
  };
}

// features/keystone/mutations/airlineRecovery.ts
var import_client5 = require("@prisma/client");
var disruptionTypes = /* @__PURE__ */ new Set(["delay", "cancellation", "schedule_change", "misconnection", "diversion", "equipment_change", "other"]);
async function publishFlightDisruption(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageDisruptions");
    const sudo = transactionContext.sudo();
    let flight = await sudo.query.FlightInstance.findOne({ where: { id: args.flightInstanceId }, query: "id status flightNumber carrier { id } bookingSegments { id status checkIns { status } }" });
    if (!flight) throw new Error("Flight not found.");
    await requireFreshCarrierPermission(transactionContext, "canManageDisruptions", flight.carrier.id);
    if (!disruptionTypes.has(args.type)) throw new Error("Unsupported disruption type.");
    const summary = args.publicSummary?.trim();
    if (!summary || summary.length > 500) throw new Error("A public summary of at most 500 characters is required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { flightInstanceId: flight.id, type: args.type, publicSummary: summary };
    const inspected = await inspectOperation(sudo, flight.carrier.id, key, "disruption.publish", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const lock = await transactionContext.prisma.$queryRaw(import_client5.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${flight.id} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    flight = await sudo.query.FlightInstance.findOne({ where: { id: args.flightInstanceId }, query: "id status flightNumber carrier { id } bookingSegments { id status checkIns { status } }" });
    if (!flight) throw new Error("Flight changed while publishing disruption.");
    const claim = await beginOperation(sudo, transactionContext, flight.carrier.id, key, "disruption.publish", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const flightTransition = args.type === "cancellation" ? assertLifecycleTransition("flightInstance", flight.status, "cancelled") : args.type === "delay" ? assertLifecycleTransition("flightInstance", flight.status, "delayed") : null;
    const affected = (flight.bookingSegments ?? []).filter((segment) => ["confirmed", "checked_in", "offloaded"].includes(segment.status) && !(segment.checkIns ?? []).some((checkIn) => checkIn.status === "boarded"));
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const disruption = await sudo.query.Disruption.createOne({
      data: {
        carrier: { connect: { id: flight.carrier.id } },
        disruptionKey: `DSP-${randomReference("", 12)}`,
        flightInstance: { connect: { id: flight.id } },
        type: args.type,
        severity: args.type === "cancellation" ? "high" : "medium",
        status: "published",
        publicSummary: summary,
        detectedAt: now,
        publishedAt: now,
        affectedSegments: { connect: affected.map((segment) => ({ id: segment.id })) },
        impactSnapshot: { affectedSegmentCount: affected.length, flightNumber: flight.flightNumber }
      },
      query: "id"
    });
    for (const segment of affected) await sudo.query.BookingSegment.updateOne({ where: { id: segment.id }, data: { status: "disrupted" } });
    if (flightTransition?.changed) await sudo.query.FlightInstance.updateOne({ where: { id: flight.id }, data: { status: args.type === "cancellation" ? "cancelled" : "delayed" } });
    await writeAudit(sudo, transactionContext, { carrierId: flight.carrier.id, key: claim.storageKey, action: "disruption.publish", aggregateType: "Disruption", aggregateId: disruption.id, after: { status: "published", type: args.type }, metadata: { flightInstanceId: flight.id, affectedSegmentCount: affected.length } });
    const result = { resourceType: "Disruption", resourceId: disruption.id, status: "published", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function reaccommodateBooking(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageDisruptions");
    const sudo = transactionContext.sudo();
    let disruption = await sudo.query.Disruption.findOne({ where: { id: args.disruptionId }, query: "id status carrier { id } flightInstance { id } affectedSegments { id booking { id } journey { id } inventoryBucket { id sold } sourceOfferItem { inventoryBucket { id sold } } status sequence includedBaggageSnapshot origin { id } destination { id } originCode destinationCode cabinCode bookingClassCode fareBrandCode fareBasisCode }" });
    if (!disruption) throw new Error("Disruption is not available for recovery.");
    const carrierId = disruption.carrier.id;
    await requireFreshCarrierPermission(transactionContext, "canManageDisruptions", carrierId);
    let original = disruption.affectedSegments.find((segment) => segment.booking.id === args.bookingId);
    let booking = await sudo.query.Booking.findOne({ where: { id: args.bookingId }, query: "id status paymentStatus ticketingStatus currencyCode carrier { id code } passengers { id passenger { id } } tickets { id status bookingPassenger { id } coupons { id status bookingSegment { id } serviceObligation { id currentVersion status } serviceObligationVersion } }" });
    if (!booking || booking.carrier.id !== carrierId) throw new Error("Booking is not available for this carrier.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { disruptionId: args.disruptionId, bookingId: args.bookingId, replacementFlightInstanceId: args.replacementFlightInstanceId, replacementInventoryBucketId: args.replacementInventoryBucketId };
    const inspected = await inspectOperation(sudo, carrierId, key, "reaccommodation.confirm", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!["published", "recovering"].includes(disruption.status)) throw new Error("Disruption is not open for recovery.");
    if (!original || original.status !== "disrupted") throw new Error("Booking has no recoverable segment in this disruption.");
    let replacement = await sudo.query.FlightInstance.findOne({ where: { id: args.replacementFlightInstanceId }, query: "id status flightNumber scheduledDepartureAt scheduledArrivalAt carrier { id code } operatingCarrier { code } origin { id iataCode } destination { id iataCode }" });
    let bucket = await sudo.query.InventoryBucket.findOne({ where: { id: args.replacementInventoryBucketId }, query: "id status authorized sold held blocked bookingClassCode carrier { id } flightInstance { id } cabin { code } fareBrand { code }" });
    if (!replacement || !bucket || replacement.carrier.id !== carrierId || bucket.carrier.id !== carrierId || bucket.flightInstance.id !== replacement.id) throw new Error("Replacement service must belong to the booking carrier.");
    if (replacement.id === disruption.flightInstance?.id) throw new Error("Replacement service must differ from the disrupted flight.");
    if (!["scheduled", "open_for_sale", "delayed"].includes(replacement.status) || bucket.status !== "open" || new Date(replacement.scheduledDepartureAt) <= /* @__PURE__ */ new Date()) throw new Error("Replacement inventory is not available for a future service.");
    if (replacement.origin.iataCode !== original.originCode || replacement.destination.iataCode !== original.destinationCode) throw new Error("Replacement service must preserve the disrupted origin and destination.");
    let quantity = booking.passengers.length;
    let originalBucket = original.inventoryBucket ?? original.sourceOfferItem?.inventoryBucket;
    if (!originalBucket?.id) throw new Error("The disrupted segment has no accountable inventory bucket.");
    const bookingLock = await transactionContext.prisma.$queryRaw(import_client5.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`);
    throwIfKeystonePrismaError(bookingLock);
    const flightLock = await transactionContext.prisma.$queryRaw(import_client5.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${replacement.id} FOR UPDATE`);
    throwIfKeystonePrismaError(flightLock);
    disruption = await sudo.query.Disruption.findOne({ where: { id: args.disruptionId }, query: "id status carrier { id } flightInstance { id } affectedSegments { id booking { id } journey { id } inventoryBucket { id sold } sourceOfferItem { inventoryBucket { id sold } } status sequence includedBaggageSnapshot origin { id } destination { id } originCode destinationCode cabinCode bookingClassCode fareBrandCode fareBasisCode }" });
    booking = await sudo.query.Booking.findOne({ where: { id: args.bookingId }, query: "id status paymentStatus ticketingStatus currencyCode carrier { id code } passengers { id passenger { id } } tickets { id status bookingPassenger { id } coupons { id status bookingSegment { id } serviceObligation { id currentVersion status } serviceObligationVersion } }" });
    replacement = await sudo.query.FlightInstance.findOne({ where: { id: args.replacementFlightInstanceId }, query: "id status flightNumber scheduledDepartureAt scheduledArrivalAt carrier { id code } operatingCarrier { code } origin { id iataCode } destination { id iataCode }" });
    bucket = await sudo.query.InventoryBucket.findOne({ where: { id: args.replacementInventoryBucketId }, query: "id status authorized sold held blocked bookingClassCode carrier { id } flightInstance { id } cabin { code } fareBrand { code }" });
    const lockedInspection = await inspectOperation(sudo, carrierId, key, "reaccommodation.confirm", request);
    if (lockedInspection.replay) return { ...lockedInspection.replay.result ?? {}, replayed: true };
    if (!disruption || !["published", "recovering"].includes(disruption.status) || disruption.carrier.id !== carrierId) throw new Error("Disruption changed while preparing recovery.");
    original = disruption.affectedSegments.find((segment) => segment.booking.id === args.bookingId);
    if (!original || original.status !== "disrupted" || !booking || ["cancelled", "completed"].includes(booking.status) || booking.paymentStatus === "refunded" || booking.ticketingStatus === "voided" || !replacement || !bucket || booking.carrier.id !== carrierId || replacement.carrier.id !== carrierId || bucket.carrier.id !== carrierId || bucket.flightInstance.id !== replacement.id) throw new Error("Recovery resources changed while acquiring locks.");
    if (replacement.id === disruption.flightInstance?.id || !["scheduled", "open_for_sale", "delayed"].includes(replacement.status) || bucket.status !== "open" || new Date(replacement.scheduledDepartureAt) <= /* @__PURE__ */ new Date()) throw new Error("Replacement service is no longer available.");
    if (replacement.origin.iataCode !== original.originCode || replacement.destination.iataCode !== original.destinationCode) throw new Error("Replacement service must preserve the disrupted origin and destination.");
    if ((booking.tickets ?? []).some((ticket) => (ticket.coupons ?? []).some((coupon) => coupon.bookingSegment?.id === original.id && ["boarded", "flown"].includes(coupon.status)))) throw new Error("Boarded or flown coupons must be offloaded before recovery.");
    const artifactNow = /* @__PURE__ */ new Date();
    const tx = transactionContext.prisma;
    const [activeCheckIns, activeBoardingPasses, activeSeatAssignments, activeBags, activeVerifications] = await Promise.all([
      tx.checkIn.count({ where: { bookingSegmentId: original.id, status: { not: "cancelled" } } }),
      tx.boardingPass.count({ where: { bookingSegmentId: original.id, status: { in: ["issued", "reissued", "boarded"] } } }),
      tx.seatAssignment.count({ where: { bookingSegmentId: original.id, status: { in: ["held", "assigned", "confirmed", "boarded"] } } }),
      tx.bag.count({ where: { OR: [{ bookingSegmentId: original.id }, { segments: { some: { id: original.id } } }], status: { notIn: ["delivered", "closed"] } } }),
      tx.documentVerification.count({ where: { bookingSegmentId: original.id, status: "verified", expiresAt: { gt: artifactNow } } })
    ]);
    const activeOperationalArtifacts = { checkIns: activeCheckIns, boardingPasses: activeBoardingPasses, seatAssignments: activeSeatAssignments, bags: activeBags, documentVerifications: activeVerifications };
    if (Object.values(activeOperationalArtifacts).some((count) => count > 0)) throw new Error(`Reaccommodation requires original passenger-service artifacts to be atomically unwound first; active artifacts: ${JSON.stringify(activeOperationalArtifacts)}.`);
    quantity = booking.passengers.length;
    originalBucket = original.inventoryBucket ?? original.sourceOfferItem?.inventoryBucket;
    if (!originalBucket?.id) throw new Error("The disrupted segment no longer has accountable inventory.");
    const bucketIds = [.../* @__PURE__ */ new Set([originalBucket.id, bucket.id])].sort();
    const bucketLocks = await transactionContext.prisma.$queryRaw(import_client5.Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${import_client5.Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`);
    throwIfKeystonePrismaError(bucketLocks);
    const releaseExpired = await transactionContext.prisma.$executeRaw(import_client5.Prisma.sql`
      WITH expired AS (
        UPDATE "InventoryHold" SET "status" = 'expired', "updatedAt" = NOW()
        WHERE "inventoryBucket" IN (${import_client5.Prisma.join(bucketIds)}) AND "status" = 'active' AND "expiresAt" <= NOW()
        RETURNING "inventoryBucket", "quantity"
      ), totals AS (
        SELECT "inventoryBucket", SUM("quantity")::integer AS quantity FROM expired GROUP BY "inventoryBucket"
      )
      UPDATE "InventoryBucket" target SET "held" = GREATEST(0, target."held" - totals.quantity), "updatedAt" = NOW()
      FROM totals WHERE target."id" = totals."inventoryBucket"
    `);
    throwIfKeystonePrismaError(releaseExpired);
    const lockedBuckets = await transactionContext.prisma.inventoryBucket.findMany({ where: { id: { in: bucketIds } } });
    const lockedReplacement = lockedBuckets.find((entry) => entry.id === bucket.id);
    const lockedOriginal = lockedBuckets.find((entry) => entry.id === originalBucket.id);
    if (!lockedReplacement || !lockedOriginal || originalBucket.id !== bucket.id && calculateAvailability(lockedReplacement).available < quantity) throw new Error("Replacement inventory is insufficient.");
    const claim = await beginOperation(sudo, transactionContext, disruption.carrier.id, key, "reaccommodation.confirm", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const replacementSegment = await sudo.query.BookingSegment.createOne({
      data: {
        carrier: { connect: { id: disruption.carrier.id } },
        booking: { connect: { id: booking.id } },
        journey: { connect: { id: original.journey.id } },
        flightInstance: { connect: { id: replacement.id } },
        inventoryBucket: { connect: { id: bucket.id } },
        segmentKey: `${booking.id}:R:${randomReference("", 8)}`,
        sequence: original.sequence,
        status: "confirmed",
        origin: { connect: { id: replacement.origin.id } },
        destination: { connect: { id: replacement.destination.id } },
        originCode: replacement.origin.iataCode,
        destinationCode: replacement.destination.iataCode,
        marketingCarrierCode: replacement.carrier.code,
        operatingCarrierCode: replacement.operatingCarrier?.code ?? replacement.carrier.code,
        marketingFlightNumber: replacement.flightNumber,
        scheduledDepartureAt: replacement.scheduledDepartureAt,
        scheduledArrivalAt: replacement.scheduledArrivalAt,
        cabinCode: bucket.cabin?.code ?? original.cabinCode,
        bookingClassCode: bucket.bookingClassCode,
        fareBrandCode: bucket.fareBrand?.code ?? original.fareBrandCode,
        fareBasisCode: bucket.fareBrand?.code ?? original.fareBasisCode,
        itinerarySnapshot: { reason: "involuntary_reaccommodation", originalSegmentId: original.id, disruptionId: disruption.id },
        includedBaggageSnapshot: original.includedBaggageSnapshot ?? {}
      },
      query: "id"
    });
    if (originalBucket.id !== bucket.id) {
      const debited = await transactionContext.prisma.inventoryBucket.updateMany({
        where: { id: bucket.id, sold: { lte: lockedReplacement.authorized - lockedReplacement.held - lockedReplacement.blocked - quantity } },
        data: { sold: { increment: quantity } }
      });
      if (debited.count !== 1) throw new Error("Replacement inventory is insufficient.");
      if (lockedOriginal.sold < quantity) throw new Error("Original inventory accounting is inconsistent.");
      await transactionContext.prisma.inventoryBucket.update({ where: { id: originalBucket.id }, data: { sold: { decrement: quantity } } });
    }
    await sudo.query.BookingSegment.updateOne({ where: { id: original.id }, data: { status: "reaccommodated" } });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = await sudo.query.Reaccommodation.createOne({
      data: { carrier: { connect: { id: disruption.carrier.id } }, reaccommodationKey: `REA-${randomReference("", 12)}`, idempotencyKey: claim.storageKey, booking: { connect: { id: booking.id } }, disruption: { connect: { id: disruption.id } }, status: "confirmed", originalSegments: { connect: [{ id: original.id }] }, replacementSegments: { connect: [{ id: replacementSegment.id }] }, priceDifferenceAmount: 0, additionalCollectionAmount: 0, refundAmount: 0, currencyCode: booking.currencyCode, optionExpiresAt: now, acceptedAt: now, confirmedAt: now, reason: "involuntary", optionSnapshot: { replacementFlightInstanceId: replacement.id, replacementInventoryBucketId: bucket.id } },
      query: "id"
    });
    for (const ticket of booking.tickets ?? []) {
      const oldCoupon = ticket.coupons?.find((coupon) => coupon.bookingSegment?.id === original.id && ["open", "checked_in", "suspended"].includes(coupon.status));
      if (!oldCoupon) {
        if (booking.ticketingStatus === "ticketed" && ["issued", "partially_used", "suspended"].includes(ticket.status)) throw new Error("A ticketed passenger lacks a recoverable coupon for the disrupted segment.");
        continue;
      }
      const obligation = oldCoupon.serviceObligation;
      if (!obligation || obligation.status !== "active" || oldCoupon.serviceObligationVersion !== obligation.currentVersion) throw new Error("The original coupon has no current versioned service obligation; reconcile before reaccommodation.");
      const obligationLock = await transactionContext.prisma.$queryRaw(import_client5.Prisma.sql`SELECT "id" FROM "ServiceObligation" WHERE "id" = ${obligation.id} FOR UPDATE`);
      throwIfKeystonePrismaError(obligationLock);
      const lockedObligation = await transactionContext.prisma.serviceObligation.findUnique({ where: { id: obligation.id } });
      if (!lockedObligation || lockedObligation.status !== "active" || lockedObligation.currentVersion !== oldCoupon.serviceObligationVersion) throw new Error("The original service obligation changed while preparing reaccommodation.");
      await sudo.query.TicketCoupon.updateOne({ where: { id: oldCoupon.id }, data: { status: "exchanged" } });
      const nextVersion = lockedObligation.currentVersion + 1;
      const versionedObligation = await sudo.query.ServiceObligation.updateOne({ where: { id: obligation.id }, data: { currentVersion: nextVersion }, query: "id currentVersion" });
      throwIfKeystonePrismaError(versionedObligation);
      const remainingSpendableCoupon = (ticket.coupons ?? []).some((coupon) => coupon.id !== oldCoupon.id && ["open", "checked_in"].includes(coupon.status));
      if (!remainingSpendableCoupon) await sudo.query.Ticket.updateOne({ where: { id: ticket.id }, data: { status: "exchanged" } });
      const newTicket = await sudo.query.Ticket.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, ticketNumber: `${booking.carrier.code}-${randomReference("", 12)}`, booking: { connect: { id: booking.id } }, bookingPassenger: { connect: { id: ticket.bookingPassenger.id } }, passenger: { connect: { id: booking.passengers.find((entry) => entry.id === ticket.bookingPassenger.id)?.passenger.id } }, issuingCarrierCode: booking.carrier.code, validatingCarrierCode: booking.carrier.code, status: "issued", totalAmount: 0, currencyCode: booking.currencyCode, issuedAt: now, originalTicket: { connect: { id: ticket.id } }, providerReference: `internal:${record.id}`, metadata: { reason: "involuntary_reaccommodation" } }, query: "id" });
      const newCoupon = await sudo.query.TicketCoupon.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, couponKey: `${newTicket.id}:${replacementSegment.id}`, ticket: { connect: { id: newTicket.id } }, bookingSegment: { connect: { id: replacementSegment.id } }, serviceObligation: { connect: { id: obligation.id } }, serviceObligationVersion: nextVersion, couponNumber: original.sequence, status: "open", fareBasisCode: bucket.fareBrand?.code ?? original.fareBasisCode, bookingClassCode: bucket.bookingClassCode, amount: 0, currencyCode: booking.currencyCode, entitlementSnapshot: { replacedCouponId: oldCoupon.id } }, query: "id" });
      validateCouponTransformation(
        "alternative",
        [{ id: oldCoupon.id, serviceObligationId: obligation.id, serviceObligationVersion: oldCoupon.serviceObligationVersion, status: "exchanged", bookingPassengerId: ticket.bookingPassenger.id }],
        [{ id: newCoupon.id, serviceObligationId: obligation.id, serviceObligationVersion: nextVersion, status: "open", bookingPassengerId: ticket.bookingPassenger.id }]
      );
      await sudo.query.TicketCouponLineage.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, bookingPassenger: { connect: { id: ticket.bookingPassenger.id } }, lineageKey: `${record.id}:alternative:${oldCoupon.id}:${newCoupon.id}`, changeSetKey: `${record.id}:${ticket.bookingPassenger.id}:${oldCoupon.id}`, transformation: "alternative", operationType: "reaccommodation", operationId: record.id, parentCoupon: { connect: { id: oldCoupon.id } }, childCoupon: { connect: { id: newCoupon.id } }, metadata: { originalSegmentId: original.id, replacementSegmentId: replacementSegment.id } }, query: "id" });
    }
    await writeAudit(sudo, transactionContext, { carrierId: disruption.carrier.id, key: claim.storageKey, action: "reaccommodation.confirm", aggregateType: "Reaccommodation", aggregateId: record.id, before: { segmentId: original.id }, after: { replacementSegmentId: replacementSegment.id, status: "confirmed" }, metadata: { bookingId: booking.id, disruptionId: disruption.id } });
    const result = { resourceType: "Reaccommodation", resourceId: record.id, status: "confirmed", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}

// features/keystone/mutations/airlineDepartures.ts
var import_client6 = require("@prisma/client");
function dayRange(serviceDate) {
  const normalized = normalizeSearchDate(serviceDate);
  const start = /* @__PURE__ */ new Date(`${normalized}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 864e5);
  return { normalized, start, end };
}
async function departureManifest(_root, args, context) {
  const actor = await requireFreshPermission(context, "canReadAirportService");
  const { normalized, start, end } = dayRange(args.serviceDate);
  const originCode = args.originCode?.trim().toUpperCase() || void 0;
  if (originCode && !/^[A-Z]{3}$/.test(originCode)) throw new Error("Origin must be a three-letter airport code.");
  const now = /* @__PURE__ */ new Date();
  const user = await context.prisma.user.findUnique({
    where: { id: actor.itemId },
    select: { role: { select: { canManageSecurePassengerData: true } } }
  });
  const canVerifyDocuments = user?.role?.canManageSecurePassengerData === true;
  const assignments = actor.canManageCarriers ? [] : await context.prisma.stationAssignment.findMany({
    where: {
      userId: actor.itemId,
      carrierId: actor.carrierId,
      status: "active",
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      AND: [{ OR: [{ canCheckIn: true }, { canAcceptBags: true }, { canBoard: true }] }],
      ...originCode ? { airport: { iataCode: originCode } } : {}
    },
    select: { airportId: true },
    take: 100
  });
  if (!actor.canManageCarriers && !assignments.length) return { carrierId: actor.carrierId, serviceDate: normalized, canVerifyDocuments, flights: [] };
  const originIds = assignments.map((assignment) => assignment.airportId);
  const flights = await context.prisma.flightInstance.findMany({
    where: {
      carrierId: actor.carrierId,
      serviceDate: { gte: start, lt: end },
      status: { in: ["scheduled", "open_for_sale", "closed_for_sale", "delayed"] },
      bookingSegments: { some: { status: { notIn: ["cancelled", "refunded", "reaccommodated"] }, booking: { ticketingStatus: "ticketed", status: { in: ["ticketed", "in_progress"] } } } },
      ...actor.canManageCarriers ? originCode ? { origin: { iataCode: originCode } } : {} : { originId: { in: originIds } }
    },
    orderBy: [{ scheduledDepartureAt: "asc" }, { id: "asc" }],
    take: 50,
    include: {
      carrier: { select: { id: true, code: true, name: true, defaultTimezone: true } },
      origin: { select: { id: true, iataCode: true, city: true } },
      destination: { select: { id: true, iataCode: true, city: true } },
      bookingSegments: {
        where: { status: { notIn: ["cancelled", "refunded", "reaccommodated"] }, booking: { ticketingStatus: "ticketed", status: { in: ["ticketed", "in_progress"] } } },
        orderBy: [{ booking: { recordLocator: "asc" } }, { sequence: "asc" }],
        include: {
          booking: {
            include: {
              passengers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { passenger: { select: { id: true, givenName: true, familyName: true, dateOfBirth: true } } } },
              checkIns: { include: { boardingPass: true, seatAssignment: true, ticketCoupon: true } }
            }
          }
        }
      }
    }
  });
  const passengerIds = [...new Set(flights.flatMap((flight) => flight.bookingSegments.flatMap((segment) => segment.booking.passengers.map((entry) => entry.passenger.id))))];
  const segmentIds = [...new Set(flights.flatMap((flight) => flight.bookingSegments.map((segment) => segment.id)))];
  const documents = canVerifyDocuments && passengerIds.length ? await context.prisma.travelDocument.findMany({
    where: { carrierId: actor.carrierId, passengerId: { in: passengerIds } },
    select: { id: true, passengerId: true, documentType: true, documentNumberLast4: true, status: true, expiresAt: true },
    orderBy: [{ expiresAt: "desc" }, { id: "asc" }],
    take: 500
  }) : [];
  const verifications = canVerifyDocuments && passengerIds.length && segmentIds.length ? await context.prisma.documentVerification.findMany({
    where: { carrierId: actor.carrierId, passengerId: { in: passengerIds }, bookingSegmentId: { in: segmentIds }, status: "verified", expiresAt: { gt: now } },
    select: { id: true, passengerId: true, bookingSegmentId: true, travelDocumentId: true, status: true, evidenceVersion: true, expiresAt: true },
    orderBy: [{ verifiedAt: "desc" }, { id: "asc" }],
    take: 500
  }) : [];
  return {
    carrierId: actor.carrierId,
    carrier: flights[0]?.carrier ?? null,
    serviceDate: normalized,
    canVerifyDocuments,
    flights: flights.map((flight) => ({
      id: flight.id,
      flightNumber: flight.flightNumber,
      status: flight.status,
      scheduledDepartureAt: flight.scheduledDepartureAt.toISOString(),
      scheduledArrivalAt: flight.scheduledArrivalAt.toISOString(),
      origin: flight.origin,
      destination: flight.destination,
      departureGate: flight.departureGate,
      departureTerminal: flight.departureTerminal,
      travelers: flight.bookingSegments.flatMap((segment) => segment.booking.passengers.map((bookingPassenger) => {
        const checkIn = segment.booking.checkIns.find((entry) => entry.bookingPassengerId === bookingPassenger.id && entry.bookingSegmentId === segment.id);
        return {
          bookingId: segment.booking.id,
          recordLocator: segment.booking.recordLocator,
          bookingPassengerId: bookingPassenger.id,
          bookingSegmentId: segment.id,
          segmentStatus: segment.status,
          passenger: { id: bookingPassenger.passenger.id, givenName: bookingPassenger.passenger.givenName, familyName: bookingPassenger.passenger.familyName, dateOfBirth: canVerifyDocuments ? bookingPassenger.passenger.dateOfBirth?.toISOString().slice(0, 10) ?? null : null },
          documents: documents.filter((document) => document.passengerId === bookingPassenger.passenger.id),
          verification: verifications.find((verification) => verification.passengerId === bookingPassenger.passenger.id && verification.bookingSegmentId === segment.id) ?? null,
          checkIn: checkIn ? {
            id: checkIn.id,
            status: checkIn.status,
            checkedInAt: checkIn.checkedInAt?.toISOString() ?? null,
            boardedAt: checkIn.boardedAt?.toISOString() ?? null,
            boardingPass: checkIn.boardingPass ? {
              id: checkIn.boardingPass.id,
              passNumber: checkIn.boardingPass.passNumber,
              status: checkIn.boardingPass.status,
              seatDesignator: checkIn.boardingPass.seatDesignatorSnapshot,
              boardingGroup: checkIn.boardingPass.boardingGroup
            } : null,
            seatAssignment: checkIn.seatAssignment ? { id: checkIn.seatAssignment.id, status: checkIn.seatAssignment.status, seatDesignator: checkIn.seatAssignment.seatDesignatorSnapshot } : null,
            ticketCoupon: checkIn.ticketCoupon ? { id: checkIn.ticketCoupon.id, status: checkIn.ticketCoupon.status } : null
          } : null
        };
      }))
    }))
  };
}
async function passengerServiceAggregate(action, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageAirportService");
    let pass = await transactionContext.prisma.boardingPass.findUnique({
      where: { id: args.boardingPassId },
      include: {
        carrier: { select: { id: true } },
        checkIn: { include: { ticketCoupon: true, seatAssignment: true } },
        bookingSegment: { include: { flightInstance: true, booking: { include: { passengers: { select: { id: true } } } } } }
      }
    });
    if (!pass?.carrierId || !pass.checkIn || !pass.bookingSegment?.flightInstance) throw new Error("Boarding pass not found or inaccessible.");
    await requireStationCapability(transactionContext, "canManageAirportService", pass.carrierId, pass.bookingSegment.flightInstance.originId, "canBoard");
    const bookingLock = await transactionContext.prisma.$queryRaw(import_client6.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${pass.bookingSegment.bookingId} FOR UPDATE`);
    throwIfKeystonePrismaError(bookingLock);
    const flightLock = await transactionContext.prisma.$queryRaw(import_client6.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${pass.bookingSegment.flightInstance.id} FOR UPDATE`);
    throwIfKeystonePrismaError(flightLock);
    pass = await transactionContext.prisma.boardingPass.findUnique({
      where: { id: args.boardingPassId },
      include: {
        carrier: { select: { id: true } },
        checkIn: { include: { ticketCoupon: true, seatAssignment: true } },
        bookingSegment: { include: { flightInstance: true, booking: { include: { passengers: { select: { id: true } } } } } }
      }
    });
    if (!pass?.carrierId || !pass.checkIn || !pass.bookingSegment?.flightInstance) throw new Error("Boarding pass changed while preparing passenger service.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const reason = args.reason?.trim() || null;
    if (reason && reason.length > 500) throw new Error("Reason must be at most 500 characters.");
    const request = { boardingPassId: pass.id, action, reason };
    const sudo = transactionContext.sudo();
    const scope = `departure.${action}`;
    const inspected = await inspectOperation(sudo, pass.carrierId, key, scope, request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const claim = await beginOperation(sudo, transactionContext, pass.carrierId, key, scope, request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const alreadyApplied = action === "board" ? pass.status === "boarded" && pass.checkIn.status === "boarded" : pass.status === "revoked" && pass.checkIn.status === "offloaded";
    if (alreadyApplied) {
      const result2 = { resourceType: "BoardingPass", resourceId: pass.id, status: action === "board" ? "boarded" : "offloaded", changed: false, replayed: false };
      await finishOperation(sudo, claim.record.id, result2);
      return result2;
    }
    const now = /* @__PURE__ */ new Date();
    if (action === "board") {
      if (!["checked_in", "boarded"].includes(pass.bookingSegment.status) || ["cancelled", "departed", "arrived"].includes(pass.bookingSegment.flightInstance.status) || !["ticketed", "in_progress"].includes(pass.bookingSegment.booking.status) || pass.bookingSegment.booking.paymentStatus === "refunded" || pass.bookingSegment.booking.ticketingStatus !== "ticketed") {
        throw new Error("Passenger, ticket, segment, or dated service is no longer eligible for boarding.");
      }
      assertLifecycleTransition("boardingPass", pass.status, "boarded");
      assertLifecycleTransition("checkIn", pass.checkIn.status, "boarded");
      if (!pass.checkIn.ticketCoupon || !pass.checkIn.seatAssignment) throw new Error("Boarding requires a checked-in coupon and confirmed seat assignment.");
      assertLifecycleTransition("ticketCoupon", pass.checkIn.ticketCoupon.status, "boarded");
      assertLifecycleTransition("seatAssignment", pass.checkIn.seatAssignment.status, "boarded");
      await transactionContext.prisma.boardingPass.update({ where: { id: pass.id }, data: { status: "boarded", boardedAt: now } });
      await transactionContext.prisma.checkIn.update({ where: { id: pass.checkIn.id }, data: { status: "boarded", boardedAt: now } });
      await transactionContext.prisma.ticketCoupon.update({ where: { id: pass.checkIn.ticketCoupon.id }, data: { status: "boarded" } });
      await transactionContext.prisma.seatAssignment.update({ where: { id: pass.checkIn.seatAssignment.id }, data: { status: "boarded" } });
      const boardedCount = await transactionContext.prisma.checkIn.count({ where: { bookingSegmentId: pass.bookingSegment.id, status: "boarded" } });
      if (boardedCount === pass.bookingSegment.booking.passengers.length && pass.bookingSegment.status === "checked_in") {
        await transactionContext.prisma.bookingSegment.update({ where: { id: pass.bookingSegment.id }, data: { status: "boarded" } });
      }
    } else {
      if (!reason) throw new Error("An offload reason is required.");
      if (pass.status !== "boarded" || pass.checkIn.status !== "boarded") throw new Error("Only a boarded traveler can be offloaded.");
      await transactionContext.prisma.boardingPass.update({ where: { id: pass.id }, data: { status: "revoked", revokedAt: now } });
      await transactionContext.prisma.checkIn.update({ where: { id: pass.checkIn.id }, data: { status: "offloaded", offloadedAt: now } });
      if (pass.checkIn.ticketCoupon?.status === "boarded") await transactionContext.prisma.ticketCoupon.update({ where: { id: pass.checkIn.ticketCoupon.id }, data: { status: "open" } });
      if (pass.checkIn.seatAssignment?.status === "boarded") await transactionContext.prisma.seatAssignment.update({ where: { id: pass.checkIn.seatAssignment.id }, data: { status: "confirmed" } });
      const remainingBoarded = await transactionContext.prisma.checkIn.count({ where: { bookingSegmentId: pass.bookingSegment.id, status: "boarded" } });
      if (!remainingBoarded && pass.bookingSegment.status === "boarded") await transactionContext.prisma.bookingSegment.update({ where: { id: pass.bookingSegment.id }, data: { status: "offloaded" } });
    }
    await writeAudit(sudo, transactionContext, {
      carrierId: pass.carrierId,
      key: claim.storageKey,
      action: `departure.${action}`,
      aggregateType: "BoardingPass",
      aggregateId: pass.id,
      before: { boardingPass: pass.status, checkIn: pass.checkIn.status },
      after: { boardingPass: action === "board" ? "boarded" : "revoked", checkIn: action === "board" ? "boarded" : "offloaded" },
      metadata: { bookingSegmentId: pass.bookingSegment.id, reason }
    });
    const result = { resourceType: "BoardingPass", resourceId: pass.id, status: action === "board" ? "boarded" : "offloaded", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
function boardBookingPassenger(_root, args, context) {
  return passengerServiceAggregate("board", args, context);
}
function offloadBookingPassenger(_root, args, context) {
  return passengerServiceAggregate("offload", args, context);
}

// features/keystone/mutations/airlineProvisioning.ts
var import_client7 = require("@prisma/client");
var launchSeatColumns = ["A", "B", "C", "D", "E", "F"];
async function createDatedFlightRecords(tx, input, query) {
  const instanceKey = `${input.carrierCode}:${input.flightNumber}:${input.serviceDate}`;
  const existing = await tx.flightInstance.findUnique({ where: { instanceKey }, select: { id: true, carrierId: true, scheduleId: true, routeId: true, originId: true, destinationId: true, operatingCarrierId: true, flightNumber: true, serviceDate: true, scheduledDepartureAt: true, scheduledArrivalAt: true, status: true } });
  if (existing) {
    if (existing.carrierId !== input.carrierId) throw new Error("Dated-flight identity belongs to another carrier.");
    const bucket2 = await tx.inventoryBucket.findUnique({ where: { bucketKey: `${instanceKey}:${input.cabinCode}:${input.fareBrandCode}` } });
    const seatMap2 = await tx.seatMap.findUnique({ where: { mapKey: `${instanceKey}:${input.cabinCode}` }, include: { _count: { select: { seats: true } } } });
    const retainedSeats = seatMap2 ? await tx.seat.findMany({ where: { seatMapId: seatMap2.id }, orderBy: [{ rowNumber: "asc" }, { columnCode: "asc" }] }) : [];
    const expectedSeats = Array.from({ length: input.capacity }, (_, index) => ({ rowNumber: Math.floor(index / launchSeatColumns.length) + 1, columnCode: launchSeatColumns[index % launchSeatColumns.length] }));
    const seatCatalogMatches = retainedSeats.length === expectedSeats.length && retainedSeats.every((seat, index) => {
      const expected = expectedSeats[index];
      const designator = `${expected.rowNumber}${expected.columnCode}`;
      return seat.carrierId === input.carrierId && seat.seatMapId === seatMap2?.id && seat.cabinId === input.cabinId && seat.seatKey === `${instanceKey}:${designator}` && seat.designator === designator && seat.rowNumber === expected.rowNumber && seat.columnCode === expected.columnCode && ["available", "blocked", "unavailable"].includes(seat.status) && seat.seatType === "standard" && seat.surchargeAmount === 0 && seat.currencyCode === input.currencyCode;
    });
    const layout = seatMap2?.layoutSnapshot ?? {};
    const serviceDate = /* @__PURE__ */ new Date(`${input.serviceDate}T00:00:00.000Z`);
    const sameInput = existing.scheduleId === input.scheduleId && existing.routeId === input.routeId && existing.originId === input.originId && existing.destinationId === input.destinationId && existing.operatingCarrierId === input.operatingCarrierId && existing.flightNumber === input.flightNumber && existing.serviceDate.getTime() === serviceDate.getTime() && existing.scheduledDepartureAt.getTime() === input.scheduledDepartureAt.getTime() && existing.scheduledArrivalAt.getTime() === input.scheduledArrivalAt.getTime() && ["scheduled", "open_for_sale"].includes(existing.status) && bucket2?.carrierId === input.carrierId && bucket2?.flightInstanceId === existing.id && bucket2?.bookingClassCode === input.cabinCode && bucket2?.cabinId === input.cabinId && bucket2?.fareBrandId === input.fareBrandId && bucket2?.capacity === input.capacity && bucket2?.status === "open" && bucket2?.authorized >= bucket2?.sold + bucket2?.held + bucket2?.blocked && bucket2?.authorized <= bucket2?.capacity && bucket2?.baseAmount === input.baseAmount && bucket2?.taxAmount === input.taxAmount && bucket2?.currencyCode === input.currencyCode && seatMap2?.carrierId === input.carrierId && seatMap2?.flightInstanceId === existing.id && seatMap2?.status === "published" && seatMap2?.version === 1 && seatMap2?._count.seats === input.capacity && layout.rows === Math.ceil(input.capacity / launchSeatColumns.length) && Array.isArray(layout.columns) && JSON.stringify(layout.columns) === JSON.stringify(launchSeatColumns) && layout.generatedForCapacity === input.capacity && seatCatalogMatches;
    if (!bucket2 || !seatMap2 || !sameInput) throw new Error("Existing dated service or retained seat/inventory catalog differs from this request; replay will not overwrite retained commercial records.");
    return { flight: existing, bucket: bucket2, seatMap: seatMap2, changed: false };
  }
  const flightData = {
    carrier: { connect: { id: input.carrierId } },
    instanceKey,
    schedule: { connect: { id: input.scheduleId } },
    route: { connect: { id: input.routeId } },
    origin: { connect: { id: input.originId } },
    destination: { connect: { id: input.destinationId } },
    operatingCarrier: { connect: { id: input.operatingCarrierId } },
    flightNumber: input.flightNumber,
    serviceDate: `${input.serviceDate}T00:00:00.000Z`,
    scheduledDepartureAt: input.scheduledDepartureAt.toISOString(),
    scheduledArrivalAt: input.scheduledArrivalAt.toISOString(),
    departureTerminal: input.departureTerminal ?? "",
    departureGate: input.departureGate ?? "",
    status: "open_for_sale"
  };
  const flight = query ? await query.FlightInstance.createOne({ data: flightData, query: "id status" }) : await tx.flightInstance.create({ data: { carrierId: input.carrierId, instanceKey, scheduleId: input.scheduleId, routeId: input.routeId, originId: input.originId, destinationId: input.destinationId, operatingCarrierId: input.operatingCarrierId, flightNumber: input.flightNumber, serviceDate: /* @__PURE__ */ new Date(`${input.serviceDate}T00:00:00.000Z`), scheduledDepartureAt: input.scheduledDepartureAt, scheduledArrivalAt: input.scheduledArrivalAt, departureTerminal: input.departureTerminal ?? "", departureGate: input.departureGate ?? "", status: "open_for_sale" } });
  const bucketData = { carrier: { connect: { id: input.carrierId } }, bucketKey: `${instanceKey}:${input.cabinCode}:${input.fareBrandCode}`, flightInstance: { connect: { id: flight.id } }, cabin: { connect: { id: input.cabinId } }, fareBrand: { connect: { id: input.fareBrandId } }, bookingClassCode: input.cabinCode, capacity: input.capacity, authorized: input.capacity, sold: 0, held: 0, blocked: 0, baseAmount: input.baseAmount, taxAmount: input.taxAmount, currencyCode: input.currencyCode, status: "open" };
  const bucket = query ? await query.InventoryBucket.createOne({ data: bucketData, query: "id status authorized sold held blocked capacity baseAmount taxAmount currencyCode" }) : await tx.inventoryBucket.create({ data: { carrierId: input.carrierId, bucketKey: `${instanceKey}:${input.cabinCode}:${input.fareBrandCode}`, flightInstanceId: flight.id, cabinId: input.cabinId, fareBrandId: input.fareBrandId, bookingClassCode: input.cabinCode, capacity: input.capacity, authorized: input.capacity, sold: 0, held: 0, blocked: 0, baseAmount: input.baseAmount, taxAmount: input.taxAmount, currencyCode: input.currencyCode, status: "open" } });
  const columns = [...launchSeatColumns];
  const rowCount = Math.ceil(input.capacity / columns.length);
  const seatMapData = { carrier: { connect: { id: input.carrierId } }, mapKey: `${instanceKey}:${input.cabinCode}`, flightInstance: { connect: { id: flight.id } }, version: 1, status: "published", layoutSnapshot: { rows: rowCount, columns, generatedForCapacity: input.capacity } };
  const seatMap = query ? await query.SeatMap.createOne({ data: seatMapData, query: "id status" }) : await tx.seatMap.create({ data: { carrierId: input.carrierId, mapKey: `${instanceKey}:${input.cabinCode}`, flightInstanceId: flight.id, version: 1, status: "published", layoutSnapshot: { rows: rowCount, columns, generatedForCapacity: input.capacity } } });
  let seatIndex = 0;
  for (let row = 1; row <= rowCount && seatIndex < input.capacity; row += 1) {
    for (const columnCode of columns) {
      if (seatIndex >= input.capacity) break;
      const designator = `${row}${columnCode}`;
      const seatData = { carrier: { connect: { id: input.carrierId } }, seatKey: `${instanceKey}:${designator}`, seatMap: { connect: { id: seatMap.id } }, cabin: { connect: { id: input.cabinId } }, designator, rowNumber: row, columnCode, status: "available", seatType: "standard", characteristics: [], surchargeAmount: 0, currencyCode: input.currencyCode };
      if (query) await query.Seat.createOne({ data: seatData, query: "id" });
      else await tx.seat.create({ data: { carrierId: input.carrierId, seatKey: `${instanceKey}:${designator}`, seatMapId: seatMap.id, cabinId: input.cabinId, designator, rowNumber: row, columnCode, status: "available", seatType: "standard", characteristics: [], surchargeAmount: 0, currencyCode: input.currencyCode } });
      seatIndex += 1;
    }
  }
  return { flight, bucket, seatMap, changed: true };
}
function serviceDateInTimezone(value, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
    const part = (type) => parts.find((entry) => entry.type === type)?.value ?? "";
    const result = `${part("year")}-${part("month")}-${part("day")}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error("invalid formatted date");
    return result;
  } catch {
    throw new Error("Carrier timezone must be a valid IANA timezone for dated service.");
  }
}
function dateTime(value, label) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date-time.`);
  return parsed;
}
function zonedLocalDateTime(value, timezone, label) {
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return dateTime(value, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error(`${label} must be a local date-time or an ISO date-time with offset.`);
  const target = match.slice(1).map((part, index) => index === 5 && !part ? 0 : Number(part));
  const targetUtc = Date.UTC(target[0], target[1] - 1, target[2], target[3], target[4], target[5] ?? 0);
  let instant = targetUtc;
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    throw new Error(`${label} is not valid in the carrier timezone.`);
  }
  const partsAt = (timestamp42) => {
    const parts = formatter.formatToParts(new Date(timestamp42));
    const part = (type) => Number(parts.find((entry) => entry.type === type)?.value);
    return [part("year"), part("month"), part("day"), part("hour"), part("minute"), part("second")];
  };
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rendered2 = partsAt(instant);
      const renderedUtc = Date.UTC(rendered2[0], rendered2[1] - 1, rendered2[2], rendered2[3], rendered2[4], rendered2[5]);
      instant += targetUtc - renderedUtc;
    }
    const rendered = partsAt(instant);
    if (rendered.some((part, index) => part !== target[index])) throw new Error("nonexistent local time");
    if ([-36e5, 36e5].some((delta) => partsAt(instant + delta).every((part, index) => part === target[index]))) throw new Error("ambiguous local time");
    return new Date(instant);
  } catch {
    throw new Error(`${label} is not valid in the carrier timezone.`);
  }
}
async function provisionDatedFlight(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    const actor = await requireFreshPermission(transactionContext, "canManageNetwork");
    await requireFreshPermission(transactionContext, "canManageInventory");
    let schedule = await transactionContext.prisma.flightSchedule.findUnique({
      where: { id: args.scheduleId },
      include: { carrier: true, route: true, operatingCarrier: true }
    });
    const cabin = await transactionContext.prisma.cabin.findUnique({ where: { id: args.cabinId } });
    const fareBrand = await transactionContext.prisma.fareBrand.findUnique({ where: { id: args.fareBrandId } });
    if (!schedule?.carrierId || !schedule.route || !schedule.operatingCarrierId || !cabin || !fareBrand || schedule.carrierId !== actor.carrierId || cabin.carrierId !== actor.carrierId || fareBrand.carrierId !== actor.carrierId || fareBrand.cabinId !== cabin.id) throw new Error("Provisioning catalog records were not found in the current carrier.");
    if (fareBrand.status !== "active") throw new Error("Dated service requires an active fare brand.");
    await requireFreshCarrierPermission(transactionContext, "canManageNetwork", schedule.carrierId);
    if (schedule.status !== "published") throw new Error("Only a published schedule can create sellable dated service.");
    const serviceDate = normalizeSearchDate(args.serviceDate);
    const serviceDay = /* @__PURE__ */ new Date(`${serviceDate}T00:00:00.000Z`);
    if (serviceDay < /* @__PURE__ */ new Date((/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "T00:00:00.000Z") || serviceDay > new Date(Date.now() + 550 * 864e5)) throw new Error("Service date must be today through 18 months from now.");
    if (schedule.effectiveFrom && serviceDay < schedule.effectiveFrom || schedule.effectiveTo && serviceDay > schedule.effectiveTo) throw new Error("Service date is outside the schedule effective period.");
    const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : [];
    const isoDay = serviceDay.getUTCDay() || 7;
    if (days.length && !days.includes(isoDay)) throw new Error("The schedule does not operate on this service day.");
    const departure = zonedLocalDateTime(args.scheduledDepartureAt, schedule.carrier.defaultTimezone, "Scheduled departure");
    const arrival = zonedLocalDateTime(args.scheduledArrivalAt, schedule.carrier.defaultTimezone, "Scheduled arrival");
    if (departure <= /* @__PURE__ */ new Date() || arrival <= departure || arrival.getTime() - departure.getTime() > 24 * 60 * 6e4) throw new Error("Scheduled departure must be in the future and arrival must be after departure within 24 hours.");
    if (serviceDateInTimezone(departure, schedule.carrier.defaultTimezone) !== serviceDate) throw new Error("Scheduled departure must fall on the service date in the carrier timezone.");
    if (!Number.isSafeInteger(args.capacity) || args.capacity < 1 || args.capacity > 300) throw new Error("Capacity must be an integer between 1 and 300.");
    if (![args.baseAmount, args.taxAmount].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("Amounts must be non-negative minor-unit integers.");
    const currencyCode = args.currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode) || currencyCode !== schedule.carrier.defaultCurrencyCode) throw new Error("Currency must match the carrier default currency.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { ...args, serviceDate, currencyCode };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, actor.carrierId, key, "dated-flight.provision", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const scheduleLock = await transactionContext.prisma.$queryRaw(import_client7.Prisma.sql`SELECT "id" FROM "FlightSchedule" WHERE "id" = ${schedule.id} FOR UPDATE`);
    throwIfKeystonePrismaError(scheduleLock);
    schedule = await transactionContext.prisma.flightSchedule.findUnique({ where: { id: args.scheduleId }, include: { carrier: true, route: true, operatingCarrier: true } });
    if (!schedule?.carrierId || schedule.carrierId !== actor.carrierId || !schedule.route || !schedule.operatingCarrierId || schedule.status !== "published") throw new Error("The published schedule changed while provisioning dated service.");
    if (schedule.effectiveFrom && serviceDay < schedule.effectiveFrom || schedule.effectiveTo && serviceDay > schedule.effectiveTo) throw new Error("Service date is outside the current schedule effective period.");
    const currentDays = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : [];
    if (currentDays.length && !currentDays.includes(isoDay)) throw new Error("The schedule no longer operates on this service day.");
    if (currencyCode !== schedule.carrier.defaultCurrencyCode) throw new Error("Currency must match the current carrier default currency.");
    const cabinLock = await transactionContext.prisma.$queryRaw(import_client7.Prisma.sql`SELECT "id" FROM "Cabin" WHERE "id" = ${args.cabinId} FOR UPDATE`);
    throwIfKeystonePrismaError(cabinLock);
    const fareLock = await transactionContext.prisma.$queryRaw(import_client7.Prisma.sql`SELECT "id" FROM "FareBrand" WHERE "id" = ${args.fareBrandId} FOR UPDATE`);
    throwIfKeystonePrismaError(fareLock);
    const [currentCabin, currentFareBrand] = await Promise.all([
      transactionContext.prisma.cabin.findUnique({ where: { id: args.cabinId } }),
      transactionContext.prisma.fareBrand.findUnique({ where: { id: args.fareBrandId } })
    ]);
    if (!currentCabin || !currentFareBrand || currentCabin.carrierId !== actor.carrierId || currentFareBrand.carrierId !== actor.carrierId || currentFareBrand.cabinId !== currentCabin.id || currentFareBrand.status !== "active") throw new Error("The active provisioning cabin/fare catalog changed while acquiring locks.");
    const claim = await beginOperation(sudo, transactionContext, actor.carrierId, key, "dated-flight.provision", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const records = await createDatedFlightRecords(transactionContext.prisma, {
      carrierId: actor.carrierId,
      carrierCode: schedule.carrier.code,
      scheduleId: schedule.id,
      routeId: schedule.routeId,
      originId: schedule.route.originId,
      destinationId: schedule.route.destinationId,
      operatingCarrierId: schedule.operatingCarrierId,
      flightNumber: schedule.flightNumber,
      serviceDate,
      scheduledDepartureAt: departure,
      scheduledArrivalAt: arrival,
      cabinId: currentCabin.id,
      cabinCode: currentCabin.code,
      fareBrandId: currentFareBrand.id,
      fareBrandCode: currentFareBrand.code,
      capacity: args.capacity,
      baseAmount: args.baseAmount,
      taxAmount: args.taxAmount,
      currencyCode,
      departureTerminal: args.departureTerminal?.trim().slice(0, 20) || null,
      departureGate: args.departureGate?.trim().slice(0, 20) || null
    }, sudo.query);
    await writeAudit(sudo, transactionContext, { carrierId: actor.carrierId, key: claim.storageKey, action: "dated-flight.provision", aggregateType: "FlightInstance", aggregateId: records.flight.id, after: { status: records.flight.status, serviceDate, capacity: args.capacity, currencyCode }, metadata: { bucketId: records.bucket.id, seatMapId: records.seatMap.id } });
    const result = { resourceType: "FlightInstance", resourceId: records.flight.id, status: records.flight.status, changed: records.changed, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
function assertDatedFlightSalesStatus(value) {
  if (value !== "open_for_sale" && value !== "closed_for_sale") {
    throw new Error("Sales status must be open_for_sale or closed_for_sale.");
  }
}
async function setDatedFlightSalesStatus(_root, args, context) {
  assertDatedFlightSalesStatus(args.status);
  return runSerializableTransaction(context, async (transactionContext) => {
    const actor = await requireFreshPermission(transactionContext, "canManageInventory");
    let flight = await transactionContext.prisma.flightInstance.findUnique({ where: { id: args.flightInstanceId }, include: { inventoryBuckets: true } });
    if (!flight || flight.carrierId !== actor.carrierId) throw new Error("Dated flight not found or inaccessible.");
    const lock = await transactionContext.prisma.$queryRaw(import_client7.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${flight.id} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    flight = await transactionContext.prisma.flightInstance.findUnique({ where: { id: flight.id }, include: { inventoryBuckets: true } });
    if (!flight || flight.carrierId !== actor.carrierId) throw new Error("Dated flight changed while updating sales status.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { flightInstanceId: flight.id, status: args.status };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, actor.carrierId, key, "dated-flight.sales-status", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const transition = assertLifecycleTransition("flightInstance", flight.status, args.status);
    const claim = await beginOperation(sudo, transactionContext, actor.carrierId, key, "dated-flight.sales-status", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    if (transition.changed) {
      await transactionContext.prisma.flightInstance.update({ where: { id: flight.id }, data: { status: args.status } });
      await transactionContext.prisma.inventoryBucket.updateMany({ where: { flightInstanceId: flight.id }, data: { status: args.status === "open_for_sale" ? "open" : "closed" } });
      await writeAudit(sudo, transactionContext, { carrierId: actor.carrierId, key: claim.storageKey, action: "dated-flight.sales-status", aggregateType: "FlightInstance", aggregateId: flight.id, before: { status: flight.status }, after: { status: args.status } });
    }
    const result = { resourceType: "FlightInstance", resourceId: flight.id, status: args.status, changed: transition.changed, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function setInventoryAuthorization(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    const actor = await requireFreshPermission(transactionContext, "canManageInventory");
    let bucket = await transactionContext.prisma.inventoryBucket.findUnique({ where: { id: args.inventoryBucketId } });
    if (!bucket || bucket.carrierId !== actor.carrierId) throw new Error("Inventory bucket not found or inaccessible.");
    const lock = await transactionContext.prisma.$queryRaw(import_client7.Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" = ${bucket.id} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    bucket = await transactionContext.prisma.inventoryBucket.findUnique({ where: { id: bucket.id } });
    if (!bucket || bucket.carrierId !== actor.carrierId) throw new Error("Inventory bucket changed while updating authorization.");
    assertInventoryCounts({ capacity: bucket.capacity, authorized: args.authorized, sold: bucket.sold, held: bucket.held, blocked: bucket.blocked });
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { inventoryBucketId: bucket.id, authorized: args.authorized };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, actor.carrierId, key, "inventory.authorize", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const claim = await beginOperation(sudo, transactionContext, actor.carrierId, key, "inventory.authorize", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const changed = bucket.authorized !== args.authorized;
    if (changed) {
      await transactionContext.prisma.inventoryBucket.update({ where: { id: bucket.id }, data: { authorized: args.authorized } });
      await writeAudit(sudo, transactionContext, { carrierId: actor.carrierId, key: claim.storageKey, action: "inventory.authorize", aggregateType: "InventoryBucket", aggregateId: bucket.id, before: { authorized: bucket.authorized }, after: { authorized: args.authorized } });
    }
    const result = { resourceType: "InventoryBucket", resourceId: bucket.id, status: bucket.status, changed, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}

// features/keystone/lib/machine-auth.ts
var import_node_crypto9 = __toESM(require("node:crypto"));
function hashMachineToken(token) {
  return import_node_crypto9.default.createHash("sha256").update(token).digest("hex");
}
function issueMachineToken() {
  const keyId = import_node_crypto9.default.randomBytes(12).toString("hex");
  const secret = import_node_crypto9.default.randomBytes(32).toString("base64url");
  return { keyId, token: `ofm_${keyId}.${secret}`, tokenHash: hashMachineToken(`ofm_${keyId}.${secret}`) };
}

// features/keystone/mutations/machineCredentials.ts
async function machineCredentialSummaries(_root, _args, context) {
  const actor = await requireFreshPermission(context, "canManageIntegrations");
  return context.prisma.machineCredential.findMany({
    where: { carrierId: actor.carrierId },
    select: { id: true, name: true, tokenPreview: true, audience: true, scopes: true, status: true, expiresAt: true, lastUsedAt: true, revokedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 100
  });
}
async function issueMachineCredential(_root, args, context) {
  const actor = await requireFreshPermission(context, "canManageIntegrations");
  const expiresAt = new Date(args.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= /* @__PURE__ */ new Date() || expiresAt > new Date(Date.now() + 365 * 24 * 60 * 6e4)) throw new Error("Credential expiry must be within the next year.");
  const name = args.name.trim();
  const audience = args.audience.trim();
  const scopes = [...new Set(args.scopes.map((scope) => scope.trim()).filter(Boolean))].sort();
  if (!name || name.length > 120 || !audience || audience.length > 120 || !scopes.length || scopes.some((scope) => scope.length > 120)) throw new Error("Credential name, audience, and at least one bounded scope are required.");
  const issued = issueMachineToken();
  const credential = await context.prisma.$transaction(async (tx) => {
    const created = await tx.machineCredential.create({ data: {
      carrierId: actor.carrierId,
      name,
      keyId: issued.keyId,
      tokenHash: issued.tokenHash,
      tokenPreview: `${issued.token.slice(0, 16)}\u2026`,
      audience,
      scopes,
      status: "active",
      expiresAt
    } });
    const now = /* @__PURE__ */ new Date();
    await tx.auditEvent.create({ data: { carrierId: actor.carrierId, actorId: actor.itemId, eventKey: `machine-credential:${created.id}:issued`, action: "machine-credential.issue", aggregateType: "MachineCredential", aggregateId: created.id, source: "platform", beforeSummary: {}, afterSummary: { status: "active", audience, scopes, expiresAt: expiresAt.toISOString() }, metadata: {}, occurredAt: now } });
    await tx.outboxEvent.create({ data: { carrierId: actor.carrierId, eventKey: `machine-credential:${created.id}:issued`, topic: "machine-credential.issued", aggregateType: "MachineCredential", aggregateId: created.id, payload: { audience, scopes, expiresAt: expiresAt.toISOString() }, status: "pending", availableAt: now } });
    return created;
  });
  return { credentialId: credential.id, keyId: issued.keyId, token: issued.token, expiresAt: expiresAt.toISOString() };
}
async function revokeMachineCredential(_root, args, context) {
  const actor = await requireFreshPermission(context, "canManageIntegrations");
  return context.prisma.$transaction(async (tx) => {
    const credential = await tx.machineCredential.findFirst({ where: { id: args.credentialId, carrierId: actor.carrierId, status: "active" }, select: { id: true, audience: true, scopes: true } });
    if (!credential) throw new Error("Resource not found or inaccessible.");
    const now = /* @__PURE__ */ new Date();
    const result = await tx.machineCredential.updateMany({ where: { id: credential.id, carrierId: actor.carrierId, status: "active" }, data: { status: "revoked", revokedAt: now } });
    if (result.count !== 1) throw new Error("Resource not found or inaccessible.");
    await tx.auditEvent.create({ data: { carrierId: actor.carrierId, actorId: actor.itemId, eventKey: `machine-credential:${credential.id}:revoked`, action: "machine-credential.revoke", aggregateType: "MachineCredential", aggregateId: credential.id, source: "platform", beforeSummary: { status: "active" }, afterSummary: { status: "revoked" }, metadata: { audience: credential.audience, scopes: credential.scopes }, occurredAt: now } });
    await tx.outboxEvent.create({ data: { carrierId: actor.carrierId, eventKey: `machine-credential:${credential.id}:revoked`, topic: "machine-credential.revoked", aggregateType: "MachineCredential", aggregateId: credential.id, payload: { audience: credential.audience }, status: "pending", availableAt: now } });
    return true;
  });
}

// features/keystone/mutations/onboarding.ts
var import_node_crypto10 = __toESM(require("node:crypto"));

// features/platform/onboarding/seed.json
var seed_default = {
  version: 2,
  steps: [
    { key: "carrier_profile", label: "Carrier identity", dependsOn: [] },
    { key: "network_catalog", label: "Route and commercial catalog", dependsOn: ["carrier_profile"] },
    { key: "dated_service", label: "Sellable dated service", dependsOn: ["network_catalog"] },
    { key: "station_scope", label: "Station authorization", dependsOn: ["carrier_profile"] },
    { key: "settlement_boundary", label: "External settlement evidence", dependsOn: ["carrier_profile"] },
    { key: "launch_review", label: "Bounded launch review", dependsOn: ["dated_service", "station_scope", "settlement_boundary"] }
  ],
  supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD"],
  timezoneExamples: ["America/New_York", "Europe/London", "Asia/Singapore"],
  launchScope: "One carrier, direct-only, nonstop standard fares, externally evidenced manual settlement, internal ticketing, station-scoped passenger service, and operator-led same-route recovery."
};

// features/keystone/mutations/onboarding.ts
var [PROFILE_STEP, CATALOG_STEP, DATED_SERVICE_STEP, STATION_STEP, SETTLEMENT_STEP, REVIEW_STEP] = seed_default.steps.map((step) => step.key);
var initialAirportCatalog = {
  JFK: { name: "John F. Kennedy International Airport", city: "New York", countryCode: "US", timezone: "America/New_York" },
  BOS: { name: "Boston Logan International Airport", city: "Boston", countryCode: "US", timezone: "America/New_York" }
};
function required(value, label, pattern) {
  const normalized = value.trim();
  if (!pattern.test(normalized)) throw new Error(`${label} is invalid.`);
  return normalized;
}
function localTime(value, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
  } catch {
    throw new Error("Timezone is not a recognized IANA timezone.");
  }
}
async function completeCarrierOnboarding(_root, args, context) {
  const actor = await requireFreshPermission(context, "canManageOnboarding");
  await requireFreshPermission(context, "canManageNetwork");
  await requireFreshPermission(context, "canManageInventory");
  const serviceDate = normalizeSearchDate(args.serviceDate);
  const timezone = required(args.timezone, "Timezone", /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/);
  const departure = zonedLocalDateTime(args.scheduledDepartureAt, timezone, "Scheduled departure");
  const arrival = zonedLocalDateTime(args.scheduledArrivalAt, timezone, "Scheduled arrival");
  if (departure <= /* @__PURE__ */ new Date() || arrival <= departure || arrival.getTime() - departure.getTime() > 24 * 60 * 6e4) throw new Error("Scheduled departure must be in the future and arrival must be after departure within 24 hours.");
  const serviceDay = /* @__PURE__ */ new Date(`${serviceDate}T00:00:00.000Z`);
  if (serviceDay < /* @__PURE__ */ new Date((/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "T00:00:00.000Z") || serviceDay > new Date(Date.now() + 180 * 864e5)) throw new Error("Initial service date must be today through six months from now.");
  if (!Number.isSafeInteger(args.capacity) || args.capacity < 1 || args.capacity > 300) throw new Error("Capacity must be an integer between 1 and 300.");
  if (![args.baseAmount, args.taxAmount].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("Amounts must be non-negative minor-unit integers.");
  const data = {
    name: required(args.name, "Carrier name", /^.{2,120}$/),
    legalName: required(args.legalName, "Legal name", /^.{2,160}$/),
    code: required(args.code.toUpperCase(), "Carrier code", /^[A-Z0-9]{2,3}$/),
    defaultCurrencyCode: required(args.currencyCode.toUpperCase(), "Currency", /^[A-Z]{3}$/),
    defaultTimezone: timezone,
    originCode: required(args.originCode.toUpperCase(), "Origin airport", /^[A-Z]{3}$/),
    destinationCode: required(args.destinationCode.toUpperCase(), "Destination airport", /^[A-Z]{3}$/),
    flightNumber: required(args.flightNumber, "Flight number", /^[A-Z0-9]{1,6}$/),
    serviceDate,
    scheduledDepartureAt: departure.toISOString(),
    scheduledArrivalAt: arrival.toISOString(),
    capacity: args.capacity,
    baseAmount: args.baseAmount,
    taxAmount: args.taxAmount
  };
  if (data.originCode === data.destinationCode) throw new Error("Origin and destination must differ.");
  if (serviceDateInTimezone(departure, data.defaultTimezone) !== serviceDate) throw new Error("Scheduled departure must fall on the service date in the carrier timezone.");
  const digest = import_node_crypto10.default.createHash("sha256").update(JSON.stringify(data)).digest("hex");
  try {
    return await runSerializableTransaction(context, async (transactionContext) => {
      const tx = transactionContext.prisma;
      const sudo = transactionContext.sudo();
      const now = /* @__PURE__ */ new Date();
      await tx.$queryRaw`SELECT "id" FROM "Carrier" WHERE "id" = ${actor.carrierId} FOR UPDATE`;
      const currentCarrier = await tx.carrier.findUnique({ where: { id: actor.carrierId }, select: { code: true } });
      if (!currentCarrier) throw new Error("Carrier not found or inaccessible.");
      if (currentCarrier.code !== data.code) {
        const retainedCommercialRows = await tx.flightInstance.count({ where: { carrierId: actor.carrierId } }) + await tx.booking.count({ where: { carrierId: actor.carrierId } });
        if (retainedCommercialRows) throw new Error("Carrier code cannot change after dated flights or bookings exist.");
      }
      await tx.user.update({ where: { id: actor.itemId }, data: { onboardingStatus: "in_progress" } });
      const carrierRecord = await tx.carrier.update({ where: { id: actor.carrierId }, data: { name: data.name, legalName: data.legalName, code: data.code, defaultCurrencyCode: data.defaultCurrencyCode, defaultTimezone: data.defaultTimezone } });
      const loadAirport = async (iataCode) => {
        const existing = await tx.airport.findUnique({ where: { iataCode } });
        const reference = initialAirportCatalog[iataCode];
        if (existing) {
          if (!existing.isActive || !reference || existing.name !== reference.name || existing.city !== reference.city || existing.timezone !== reference.timezone || existing.countryCode !== reference.countryCode) throw new Error(`Retained airport ${iataCode} differs from the authoritative launch catalog.`);
          return existing;
        }
        if (!reference) throw new Error(`Airport ${iataCode} must be created as an authoritative global reference before onboarding.`);
        return tx.airport.create({ data: { iataCode, ...reference } });
      };
      const [origin, destination] = await Promise.all([loadAirport(data.originCode), loadAirport(data.destinationCode)]);
      const route = await tx.route.upsert({
        where: { routeKey: `${data.code}:${data.originCode}:${data.destinationCode}` },
        update: {},
        create: { carrierId: actor.carrierId, routeKey: `${data.code}:${data.originCode}:${data.destinationCode}`, originId: origin.id, destinationId: destination.id, status: "active" }
      });
      if (route.carrierId !== actor.carrierId || route.originId !== origin.id || route.destinationId !== destination.id || route.status !== "active") throw new Error("Retained route differs from the authoritative launch catalog.");
      const expectedScheduleDay = serviceDay.getUTCDay() || 7;
      const expectedEffectiveFrom = new Date(serviceDay.getTime() - 30 * 864e5);
      const expectedEffectiveTo = new Date(serviceDay.getTime() + 365 * 864e5);
      const arrivalLocalDate = serviceDateInTimezone(arrival, data.defaultTimezone);
      const expectedArrivalDayOffset = Math.round(((/* @__PURE__ */ new Date(`${arrivalLocalDate}T00:00:00.000Z`)).getTime() - serviceDay.getTime()) / 864e5);
      const schedule = await tx.flightSchedule.upsert({
        where: { scheduleKey: `${data.code}:${data.flightNumber}` },
        update: {},
        create: {
          carrierId: actor.carrierId,
          scheduleKey: `${data.code}:${data.flightNumber}`,
          routeId: route.id,
          operatingCarrierId: actor.carrierId,
          flightNumber: data.flightNumber,
          departureLocalTime: localTime(departure, data.defaultTimezone),
          arrivalLocalTime: localTime(arrival, data.defaultTimezone),
          arrivalDayOffset: expectedArrivalDayOffset,
          daysOfWeek: [expectedScheduleDay],
          effectiveFrom: expectedEffectiveFrom,
          effectiveTo: expectedEffectiveTo,
          status: "published"
        }
      });
      const expectedDepartureLocalTime = localTime(departure, data.defaultTimezone);
      const expectedArrivalLocalTime = localTime(arrival, data.defaultTimezone);
      if (schedule.carrierId !== actor.carrierId || schedule.routeId !== route.id || schedule.operatingCarrierId !== actor.carrierId || schedule.flightNumber !== data.flightNumber || schedule.departureLocalTime !== expectedDepartureLocalTime || schedule.arrivalLocalTime !== expectedArrivalLocalTime || schedule.arrivalDayOffset !== expectedArrivalDayOffset || schedule.status !== "published" || !schedule.effectiveFrom || schedule.effectiveFrom > serviceDay || !schedule.effectiveTo || schedule.effectiveTo < serviceDay || !Array.isArray(schedule.daysOfWeek) || !schedule.daysOfWeek.includes(expectedScheduleDay)) throw new Error("Retained schedule differs from the authoritative launch catalog.");
      const instanceKey = `${data.code}:${data.flightNumber}:${serviceDate}`;
      const retainedFlight = await tx.flightInstance.findUnique({ where: { instanceKey }, select: { id: true } });
      const retainedCatalog = await tx.inventoryBucket.findUnique({
        where: { bucketKey: `${instanceKey}:Y:STANDARD` },
        include: { cabin: true, fareBrand: true }
      });
      let cabin;
      let fareBrand;
      if (retainedCatalog) {
        cabin = retainedCatalog.cabin;
        fareBrand = retainedCatalog.fareBrand;
        const catalogMatches = retainedFlight?.id === retainedCatalog.flightInstanceId && retainedCatalog.carrierId === actor.carrierId && retainedCatalog.bookingClassCode === "Y" && retainedCatalog.capacity === data.capacity && retainedCatalog.baseAmount === data.baseAmount && retainedCatalog.taxAmount === data.taxAmount && retainedCatalog.currencyCode === data.defaultCurrencyCode && retainedCatalog.status === "open" && retainedCatalog.authorized >= retainedCatalog.sold + retainedCatalog.held + retainedCatalog.blocked && retainedCatalog.authorized <= retainedCatalog.capacity && cabin?.carrierId === actor.carrierId && cabin.code === "Y" && cabin.name === "Economy" && cabin.cabinClass === "economy" && fareBrand?.carrierId === actor.carrierId && fareBrand.cabinId === cabin.id && fareBrand.code === "STANDARD" && fareBrand.name === "Standard" && fareBrand.status === "active" && fareBrand.includedBaggage?.pieces === 1 && fareBrand.includedBaggage?.maxWeightGrams === 23e3 && JSON.stringify(fareBrand.benefits) === JSON.stringify(["Standard seat selection", "One checked bag"]);
        if (!catalogMatches) throw new Error("Retained launch inventory catalog differs from the bounded onboarding contract; replay will not rewrite commercial relationships.");
      } else {
        const launchCabinId = `${actor.carrierId}:launch-cabin-y`;
        const launchFareBrandId = `${actor.carrierId}:launch-fare-standard`;
        const [retainedCabin, retainedFareBrand] = await Promise.all([
          tx.cabin.findUnique({ where: { id: launchCabinId } }),
          tx.fareBrand.findUnique({ where: { id: launchFareBrandId } })
        ]);
        const cabinCompatible = (record) => !record || record.carrierId === actor.carrierId && record.code === "Y" && record.name === "Economy" && record.cabinClass === "economy";
        const fareCompatible = (record) => !record || record.carrierId === actor.carrierId && record.cabinId === launchCabinId && record.code === "STANDARD" && record.name === "Standard" && record.status === "active" && record.includedBaggage?.pieces === 1 && record.includedBaggage?.maxWeightGrams === 23e3 && JSON.stringify(record.benefits) === JSON.stringify(["Standard seat selection", "One checked bag"]);
        if (!cabinCompatible(retainedCabin) || !fareCompatible(retainedFareBrand)) throw new Error("Partial retained launch cabin/fare catalog differs from the bounded onboarding contract; replay will not complete or rewrite it.");
        cabin = await tx.cabin.upsert({
          where: { id: launchCabinId },
          update: {},
          create: { id: launchCabinId, carrierId: actor.carrierId, code: "Y", name: "Economy", cabinClass: "economy" }
        });
        fareBrand = await tx.fareBrand.upsert({
          where: { id: launchFareBrandId },
          update: {},
          create: { id: launchFareBrandId, carrierId: actor.carrierId, cabinId: cabin.id, code: "STANDARD", name: "Standard", status: "active", includedBaggage: { pieces: 1, maxWeightGrams: 23e3 }, benefits: ["Standard seat selection", "One checked bag"], refundabilitySummary: "Refunds require verified operator processing." }
        });
        if (!cabinCompatible(cabin) || !fareCompatible(fareBrand)) throw new Error("Launch cabin/fare catalog could not be verified after creation.");
      }
      const datedService = await createDatedFlightRecords(tx, {
        carrierId: actor.carrierId,
        carrierCode: data.code,
        scheduleId: schedule.id,
        routeId: route.id,
        originId: origin.id,
        destinationId: destination.id,
        operatingCarrierId: actor.carrierId,
        flightNumber: data.flightNumber,
        serviceDate,
        scheduledDepartureAt: departure,
        scheduledArrivalAt: arrival,
        cabinId: cabin.id,
        cabinCode: cabin.code,
        fareBrandId: fareBrand.id,
        fareBrandCode: fareBrand.code,
        capacity: data.capacity,
        baseAmount: data.baseAmount,
        taxAmount: data.taxAmount,
        currencyCode: data.defaultCurrencyCode
      }, sudo.query);
      const stationAssignment = await tx.stationAssignment.upsert({
        where: { assignmentKey: `${actor.carrierId}:${actor.itemId}:${origin.id}` },
        update: {},
        create: { carrierId: actor.carrierId, assignmentKey: `${actor.carrierId}:${actor.itemId}:${origin.id}`, userId: actor.itemId, airportId: origin.id, status: "active", canCheckIn: true, canAcceptBags: true, canBoard: true, validFrom: now }
      });
      const paymentProvider = await tx.paymentProvider.upsert({
        where: { providerKey: `${data.code}:external-settlement-evidence` },
        update: {},
        create: {
          carrierId: actor.carrierId,
          providerKey: `${data.code}:external-settlement-evidence`,
          name: "External settlement evidence",
          code: "EXTERNAL_EVIDENCE",
          adapterType: "manual",
          status: "active",
          createPaymentFunction: "manual.capture",
          capturePaymentFunction: "manual.capture",
          refundPaymentFunction: "manual.refund",
          getPaymentStatusFunction: "manual.status",
          handleWebhookFunction: "manual.webhook",
          configuration: { mode: "external_evidence_only", providerExecution: false, requiresIndependentApproval: true }
        }
      });
      const settlementProvider = await tx.integrationProvider.upsert({
        where: { providerKey: `${data.code}:local-settlement-ledger-provider` },
        update: {},
        create: { carrierId: actor.carrierId, providerKey: `${data.code}:local-settlement-ledger-provider`, name: "Local settlement evidence import", code: "LOCAL_SETTLEMENT_EVIDENCE", type: "other", status: "active", adapterModule: "settlement-ledger-import", capabilities: ["settlement_import"] }
      });
      const settlementConnection = await tx.providerConnection.upsert({
        where: { connectionKey: `${data.code}:local-settlement-ledger` },
        update: {},
        create: { carrierId: actor.carrierId, connectionKey: `${data.code}:local-settlement-ledger`, providerId: settlementProvider.id, name: "Local settlement evidence connection", status: "active", capabilities: ["settlement_import"], configuration: { localOnly: true, providerExecution: false } }
      });
      const paymentOperatorCount = await tx.user.count({ where: { carrierId: actor.carrierId, role: { canManagePayments: true } } });
      const settlementCredentials = await tx.machineCredential.findMany({ where: { carrierId: actor.carrierId, audience: "settlement-import", status: "active", expiresAt: { gt: now } }, select: { scopes: true }, take: 100 });
      const settlementCredentialReady = settlementCredentials.some((credential) => Array.isArray(credential.scopes) && credential.scopes.includes("settlements:write"));
      const datedReady = ["scheduled", "open_for_sale"].includes(datedService.flight.status) && datedService.bucket.status === "open" && datedService.bucket.authorized >= datedService.bucket.sold + datedService.bucket.held + datedService.bucket.blocked;
      const stationReady = stationAssignment.status === "active" && stationAssignment.canCheckIn && stationAssignment.canAcceptBags && stationAssignment.canBoard && (!stationAssignment.validFrom || stationAssignment.validFrom <= now) && (!stationAssignment.validUntil || stationAssignment.validUntil > now);
      const settlementReady = paymentProvider.status === "active" && isEvidenceOnlyManualProvider(paymentProvider) && settlementProvider.status === "active" && settlementProvider.adapterModule === "settlement-ledger-import" && Array.isArray(settlementProvider.capabilities) && settlementProvider.capabilities.includes("settlement_import") && settlementConnection.status === "active" && settlementConnection.configuration?.providerExecution === false && Array.isArray(settlementConnection.capabilities) && settlementConnection.capabilities.includes("settlement_import") && paymentOperatorCount >= 2 && settlementCredentialReady;
      const profileReady = carrierRecord.status === "active" && carrierRecord.directSalesEnabled === true;
      const completed = profileReady && datedReady && stationReady && settlementReady;
      const upsertStep = (step, status, requirements = []) => tx.onboardingStep.upsert({
        where: { progressKey: `${actor.carrierId}:${actor.itemId}:${step}` },
        update: { status, requirements, inputDigest: digest, lastAttemptedAt: now, attemptCount: { increment: 1 }, ...status === "completed" ? { completedAt: now } : { completedAt: null } },
        create: { carrierId: actor.carrierId, userId: actor.itemId, progressKey: `${actor.carrierId}:${actor.itemId}:${step}`, step, status, requirements, inputDigest: digest, attemptCount: 1, lastAttemptedAt: now, ...status === "completed" ? { completedAt: now } : {} }
      });
      const steps = [
        await upsertStep(PROFILE_STEP, profileReady ? "completed" : "needs_attention", profileReady ? [] : ["Reactivate direct sales through an explicit carrier-management decision; onboarding replay will not override retained suspension."]),
        await upsertStep(CATALOG_STEP, "completed"),
        await upsertStep(DATED_SERVICE_STEP, datedReady ? "completed" : "needs_attention", datedReady ? [] : ["Restore an open future flight and inventory authorization without overwriting retained counts."]),
        await upsertStep(STATION_STEP, stationReady ? "completed" : "needs_attention", stationReady ? [] : ["Restore an active current origin-station assignment with check-in, bag, and boarding capabilities."]),
        await upsertStep(SETTLEMENT_STEP, settlementReady ? "completed" : "needs_attention", settlementReady ? ["External funds remain unconfirmed until immutable settlement evidence is imported and independently approved."] : ["Restore the evidence-only manual provider and settlement-import connection and authorize at least two payment operators and issue an active settlement-import credential with settlements:write for independent approval/import; no provider success is assumed."]),
        await upsertStep(REVIEW_STEP, completed ? "completed" : "needs_attention", completed ? ["This setup does not certify provider, regulatory, compliance, or safety readiness."] : ["Resolve retained dependency state before bounded launch review."])
      ];
      await tx.user.update({ where: { id: actor.itemId }, data: { onboardingStatus: completed ? "completed" : "in_progress" } });
      if (completed) await tx.outboxEvent.upsert({
        where: { eventKey: `onboarding:${actor.carrierId}:${digest}` },
        update: {},
        create: { carrierId: actor.carrierId, eventKey: `onboarding:${actor.carrierId}:${digest}`, topic: "carrier.onboarding.completed", aggregateType: "Carrier", aggregateId: actor.carrierId, payload: { code: data.code, flightInstanceId: datedService.flight.id, boundedScope: seed_default.launchScope }, status: "pending", availableAt: now }
      });
      return { completed, steps: steps.map((step) => ({ key: step.step, status: step.status, attemptCount: step.attemptCount, requirements: step.requirements ?? [] })) };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onboarding failed closed.";
    const now = /* @__PURE__ */ new Date();
    const markNeedsAttention = (step) => context.prisma.onboardingStep.upsert({
      where: { progressKey: `${actor.carrierId}:${actor.itemId}:${step}` },
      update: { status: "needs_attention", requirements: [message], inputDigest: digest, lastAttemptedAt: now, attemptCount: { increment: 1 }, completedAt: null },
      create: { carrierId: actor.carrierId, userId: actor.itemId, progressKey: `${actor.carrierId}:${actor.itemId}:${step}`, step, status: "needs_attention", requirements: [message], inputDigest: digest, attemptCount: 1, lastAttemptedAt: now }
    });
    await markNeedsAttention(REVIEW_STEP);
    if (/retained|catalog|dated service/i.test(message)) await markNeedsAttention(CATALOG_STEP);
    throw error;
  }
}

// features/keystone/mutations/storefrontSettings.ts
function boundedText(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} is required and must be at most ${max} characters.`);
  return normalized;
}
function normalizeStorefrontSettingsInput(input) {
  const storefrontBrandColor = normalizeStorefrontBrandColor(input.storefrontBrandColor);
  if (!storefrontBrandColor) throw new Error("Choose one of the approved storefront colors.");
  return {
    name: boundedText(input.name, "Carrier name", 120),
    legalName: boundedText(input.legalName, "Legal name", 160),
    storefrontBrandColor,
    storefrontHomepageTitle: boundedText(input.storefrontHomepageTitle, "Homepage title", 120),
    storefrontHomepageDescription: boundedText(input.storefrontHomepageDescription, "Homepage description", 320)
  };
}
async function updateCarrierStorefrontSettings(_root, args, context) {
  const actor = await requireFreshPermission(context, "canManageOnboarding");
  const data = normalizeStorefrontSettingsInput(args);
  const updated = await context.prisma.carrier.update({ where: { id: actor.carrierId }, data });
  return updated;
}

// features/keystone/mutations/index.ts
var graphql = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql`
      enum AirlineSalesStatus {
        open_for_sale
        closed_for_sale
      }

      type AirlineOperationResult {
        resourceType: String!
        resourceId: ID!
        offerId: ID
        offerNumber: String
        bookingId: ID
        recordLocator: String
        orderNumber: String
        status: String!
        totalAmount: Int
        currencyCode: String
        expiresAt: String
        passengerIds: [ID!]
        bookingAccessToken: String
        changed: Boolean!
        replayed: Boolean!
      }

      type AirlineAvailability {
        available: Int!
        authorized: Int!
        sold: Int!
        held: Int!
        blocked: Int!
      }

      type AirlineFareBrand {
        code: String!
        name: String!
      }

      type PublicCarrierIdentity {
        id: ID!
        code: String!
        name: String!
        legalName: String!
        defaultCurrencyCode: String!
        defaultTimezone: String!
        salesEnabled: Boolean!
        storefrontBrandColor: String
        storefrontHomepageTitle: String
        storefrontHomepageDescription: String
        storefrontConfigured: Boolean!
      }

      type AirlineFlightOption {
        id: ID!
        inventoryBucketId: ID!
        flightNumber: String!
        serviceDate: String!
        scheduledDepartureAt: String!
        scheduledArrivalAt: String!
        originCode: String!
        originCity: String!
        destinationCode: String!
        destinationCity: String!
        fareBrand: AirlineFareBrand!
        currencyCode: String!
        baseAmount: Int!
        taxAmount: Int!
        totalAmount: Int!
        perTravelerBaseAmount: Int!
        perTravelerTaxAmount: Int!
        perTravelerTotalAmount: Int!
        partyTotalAmount: Int!
        passengerCount: Int!
        availability: AirlineAvailability!
        unavailableReason: String
      }

      type PublicFlightDisruption {
        type: String!
        status: String!
        publicSummary: String
        publishedAt: String
      }

      type PublicFlightStatus {
        id: ID!
        flightNumber: String!
        serviceDate: String!
        status: String!
        scheduledDepartureAt: String!
        scheduledArrivalAt: String!
        estimatedDepartureAt: String
        estimatedArrivalAt: String
        actualDepartureAt: String
        actualArrivalAt: String
        departureTerminal: String
        departureGate: String
        arrivalTerminal: String
        arrivalGate: String
        originCode: String!
        originCity: String!
        destinationCode: String!
        destinationCity: String!
        disruption: PublicFlightDisruption
      }

      type RotatedBookingAccess {
        recordLocator: String!
        accessToken: String!
      }

      type OnboardingStepProgress {
        key: String!
        status: String!
        attemptCount: Int!
        requirements: [String!]!
      }

      type OnboardingProgress {
        completed: Boolean!
        steps: [OnboardingStepProgress!]!
      }

      type IssuedMachineCredential {
        credentialId: ID!
        keyId: String!
        token: String!
        expiresAt: String!
      }

      type CustomerBooking {
        id: ID!
        recordLocator: String!
        orderNumber: String!
        status: String!
        paymentStatus: String!
        ticketingStatus: String!
        totalAmount: Int!
        currencyCode: String!
        carrier: JSON!
        passengers: JSON!
        segments: JSON!
        payments: JSON!
        tickets: JSON!
        checkIns: JSON!
        reaccommodations: JSON!
      }

      input CustomerPassengerInput {
        givenName: String!
        familyName: String!
        dateOfBirth: String!
        email: String!
        phone: String
      }

      type Query {
        redirectToInit: Boolean
        airlineFlightOptions(
          originCode: String!
          destinationCode: String!
          serviceDate: String!
          passengerCount: Int = 1
        ): [AirlineFlightOption!]!
        customerBooking(recordLocator: String!, accessToken: String!): CustomerBooking!
        publicCarrierIdentity(carrierCode: String!): PublicCarrierIdentity
        departureManifest(serviceDate: String!, originCode: String): JSON!
        machineCredentialSummaries: JSON!
        publicAirlineFlightOptions(
          carrierCode: String!
          originCode: String!
          destinationCode: String!
          serviceDate: String!
          passengerCount: Int = 1
        ): [AirlineFlightOption!]!
        publicFlightStatuses(
          carrierCode: String!
          flightNumber: String!
          serviceDate: String!
        ): [PublicFlightStatus!]!
      }

      type Mutation {
        updateCarrierStorefrontSettings(
          name: String!
          legalName: String!
          storefrontBrandColor: String!
          storefrontHomepageTitle: String!
          storefrontHomepageDescription: String!
        ): Carrier!
        completeCarrierOnboarding(
          name: String!
          legalName: String!
          code: String!
          currencyCode: String!
          timezone: String!
          originCode: String!
          destinationCode: String!
          flightNumber: String!
          serviceDate: String!
          scheduledDepartureAt: String!
          scheduledArrivalAt: String!
          capacity: Int!
          baseAmount: Int!
          taxAmount: Int!
        ): OnboardingProgress!
        issueMachineCredential(name: String!, audience: String!, scopes: [String!]!, expiresAt: String!): IssuedMachineCredential!
        revokeMachineCredential(credentialId: ID!): Boolean!
        rotateCustomerBookingAccessToken(recordLocator: String!, accessToken: String!): RotatedBookingAccess!
        cancelCustomerBooking(recordLocator: String!, accessToken: String!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
        assignCustomerSeat(recordLocator: String!, accessToken: String!, bookingPassengerId: ID!, bookingSegmentId: ID!, seatId: ID!, idempotencyKey: String!): AirlineOperationResult!
        checkInCustomerBooking(
          recordLocator: String!
          accessToken: String!
          bookingPassengerId: ID!
          bookingSegmentId: ID!
          seatId: ID
          idempotencyKey: String!
        ): AirlineOperationResult!
        createCustomerOffer(
          carrierCode: String!
          flightInstanceId: ID!
          inventoryBucketId: ID!
          shoppingSessionToken: String!
          idempotencyKey: String!
          passengers: [CustomerPassengerInput!]!
        ): AirlineOperationResult!
        createCustomerBooking(
          offerId: ID!
          passengerIds: [ID!]!
          shoppingSessionToken: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        createOfferFromShopping(
          flightInstanceId: ID!
          inventoryBucketId: ID!
          passengerIds: [ID!]!
          idempotencyKey: String!
        ): AirlineOperationResult!
        submitManualPaymentEvidence(
          bookingId: ID!
          purpose: String!
          externalReference: String!
          ledgerSource: String!
          evidenceDigest: String!
          amount: Int!
          currencyCode: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        approveManualPaymentEvidence(evidenceId: ID!, idempotencyKey: String!): AirlineOperationResult!
        rejectManualPaymentEvidence(evidenceId: ID!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
        captureBookingPayment(
          bookingId: ID!
          idempotencyKey: String!
          providerReference: String!
          instrumentBrand: String
          instrumentLast4: String
        ): AirlineOperationResult!
        issueBookingTickets(bookingId: ID!, idempotencyKey: String!): AirlineOperationResult!
        processBookingRefund(
          bookingId: ID!
          amount: Int!
          reason: String!
          providerReference: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        provisionDatedFlight(
          scheduleId: ID!
          cabinId: ID!
          fareBrandId: ID!
          serviceDate: String!
          scheduledDepartureAt: String!
          scheduledArrivalAt: String!
          capacity: Int!
          baseAmount: Int!
          taxAmount: Int!
          currencyCode: String!
          departureTerminal: String
          departureGate: String
          idempotencyKey: String!
        ): AirlineOperationResult!
        setDatedFlightSalesStatus(flightInstanceId: ID!, status: AirlineSalesStatus!, idempotencyKey: String!): AirlineOperationResult!
        setInventoryAuthorization(inventoryBucketId: ID!, authorized: Int!, idempotencyKey: String!): AirlineOperationResult!
        publishFlightDisruption(
          flightInstanceId: ID!
          type: String!
          publicSummary: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        reaccommodateBooking(
          disruptionId: ID!
          bookingId: ID!
          replacementFlightInstanceId: ID!
          replacementInventoryBucketId: ID!
          idempotencyKey: String!
        ): AirlineOperationResult!
        registerPassengerTravelDocument(
          bookingPassengerId: ID!
          bookingSegmentId: ID!
          documentType: String!
          documentNumber: String!
          issuingCountryCode: String!
          nationalityCode: String
          issuedAt: String
          expiresAt: String!
          providerReference: String!
          evidenceVersion: String!
          verificationExpiresAt: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        verifyPassengerTravelDocument(
          travelDocumentId: ID!
          bookingSegmentId: ID!
          providerReference: String!
          evidenceVersion: String!
          expiresAt: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        checkInBookingPassenger(
          bookingPassengerId: ID!
          bookingSegmentId: ID!
          idempotencyKey: String!
          seatId: ID
        ): AirlineOperationResult!
        boardBookingPassenger(boardingPassId: ID!, idempotencyKey: String!): AirlineOperationResult!
        offloadBookingPassenger(boardingPassId: ID!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
        acceptCheckedBag(
          bookingPassengerId: ID!
          flightInstanceId: ID!
          idempotencyKey: String!
          weightGrams: Int!
        ): AirlineOperationResult!

        createBookingFromOffer(
          offerId: ID!
          passengerIds: [ID!]!
          idempotencyKey: String!
        ): AirlineOperationResult!
        cancelBooking(bookingId: ID!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        customerBooking: getCustomerBooking,
        publicCarrierIdentity: getPublicCarrierIdentity,
        departureManifest,
        machineCredentialSummaries,
        publicFlightStatuses,
        airlineFlightOptions: async (root, args, context) => {
          const options = await searchAirlineFlights(root, args, context);
          return options.map((option) => ({
            ...option,
            originCode: option.origin.iataCode,
            originCity: option.origin.city,
            destinationCode: option.destination.iataCode,
            destinationCity: option.destination.city
          }));
        },
        publicAirlineFlightOptions: async (root, args, context) => {
          const options = await publicAirlineFlightOptions(root, args, context);
          return options.map((option) => ({
            ...option,
            originCode: option.origin.iataCode,
            originCity: option.origin.city,
            destinationCode: option.destination.iataCode,
            destinationCity: option.destination.city
          }));
        }
      },
      Mutation: {
        updateCarrierStorefrontSettings,
        completeCarrierOnboarding,
        issueMachineCredential,
        revokeMachineCredential,
        createCustomerOffer,
        createCustomerBooking,
        rotateCustomerBookingAccessToken,
        cancelCustomerBooking,
        assignCustomerSeat,
        checkInCustomerBooking,
        createOfferFromShopping,
        submitManualPaymentEvidence,
        approveManualPaymentEvidence,
        rejectManualPaymentEvidence,
        captureBookingPayment,
        issueBookingTickets,
        processBookingRefund,
        provisionDatedFlight,
        setDatedFlightSalesStatus,
        setInventoryAuthorization,
        publishFlightDisruption,
        reaccommodateBooking,
        registerPassengerTravelDocument,
        verifyPassengerTravelDocument,
        checkInBookingPassenger,
        boardBookingPassenger,
        offloadBookingPassenger,
        acceptCheckedBag,
        cancelBooking,
        createBookingFromOffer
      }
    }
  });
}

// features/keystone/lib/graphql-security.ts
var import_depth_limit = require("@graphile/depth-limit");
var graphqlDepthLimitRule = (0, import_depth_limit.depthLimit)({
  maxDepth: 12,
  maxListDepth: 4,
  maxSelfReferentialDepth: 2,
  maxIntrospectionDepth: 20,
  maxIntrospectionListDepth: 4,
  // GraphQL's standard introspection query recursively follows __Type.ofType.
  maxIntrospectionSelfReferentialDepth: 15,
  maxDepthByFieldCoordinates: {
    // graphql@16.12's getIntrospectionQuery traverses __Type.ofType nine times.
    "__Type.ofType": 15
  },
  revealDetails: false
});

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  if (process.env.NODE_ENV === "production") throw new Error("SMTP_STORE_LINK is required in production.");
  console.warn("SMTP_STORE_LINK not set; password-reset links are unavailable outside configured environments.");
  return "";
}
var smtpPort = process.env.SMTP_PORT ? Number.parseInt(process.env.SMTP_PORT, 10) : void 0;
var transport = (0, import_nodemailer.createTransport)({
  host: process.env.SMTP_HOST,
  port: Number.isSafeInteger(smtpPort) ? smtpPort : void 0,
  auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  } : void 0,
  // Password-reset mail is generated in process and never needs filesystem or
  // URL-backed content. Keep these attack surfaces closed at the transport.
  disableFileAccess: true,
  disableUrlAccess: true
});
function safeCarrierName(value) {
  const normalized = String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return normalized || "Carrier operations";
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function passwordResetEmail({ url, carrierName }) {
  const brandName = escapeHtml(safeCarrierName(carrierName));
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            <strong>${brandName}</strong><br />Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, options = {}) {
  if (process.env.NODE_ENV === "production" && (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !smtpPort)) {
    throw new Error("Complete SMTP configuration is required in production.");
  }
  const frontendUrl = options.baseUrl || getBaseUrlForEmails();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: `${safeCarrierName(options.carrierName)} password reset`,
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${encodeURIComponent(resetToken)}`,
      carrierName: options.carrierName
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/lib/session.ts
var LOCAL_TEST_SECRET = "local-test-session-secret-not-for-production";
function resolveSessionSecret(env = process.env) {
  const configured = env.SESSION_SECRET;
  if (configured) {
    if (configured.length < 32) {
      throw new Error("SESSION_SECRET must contain at least 32 characters.");
    }
    return configured;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return LOCAL_TEST_SECRET;
}

// features/keystone/index.ts
var isProduction = process.env.NODE_ENV === "production";
function productionValue(name, developmentFallback) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProduction) throw new Error(`${name} is required in production.`);
  return developmentFallback;
}
var databaseURL = productionValue("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/openfront_airline");
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: resolveSessionSecret()
};
var bucketName = productionValue("S3_BUCKET_NAME", "keystone-test");
var region = productionValue("S3_REGION", "us-east-1");
var accessKeyId = productionValue("S3_ACCESS_KEY_ID", "keystone");
var secretAccessKey = productionValue("S3_SECRET_ACCESS_KEY", "keystone");
var endpoint = productionValue("S3_ENDPOINT", "http://localhost:9000");
var { withAuth } = (0, import_auth.createAuth)({
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
          status: "active",
          directSalesEnabled: false
        }
      },
      role: {
        create: {
          name: "Initial Carrier Administrator",
          ...Object.fromEntries(permissionsList.map((permission) => [permission, true]))
        }
      }
    }
  } : void 0,
  passwordResetLink: {
    async sendToken(args) {
      const recipient = await args.context.prisma.user.findUnique({
        where: { id: String(args.itemId) },
        select: { carrier: { select: { name: true } } }
      });
      await sendPasswordResetEmail(args.token, args.identity, { carrierName: recipient?.carrier?.name });
    }
  },
  sessionData: `
    id
    name
    email
    carrier { id code name legalName }
    approvedAgent { id status }
    role { id name ${permissionsList.join(" ")} }
  `
});
var keystone_default = withAuth(
  (0, import_core60.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
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
        signed: { expiry: 5e3 },
        forcePathStyle: true
      }
    },
    ui: {
      isAccessAllowed: (context) => hasFreshPermission({ session: context.session, context }, "canAccessDashboard")
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      extendGraphqlSchema,
      apolloConfig: {
        validationRules: [graphqlDepthLimitRule]
      }
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
