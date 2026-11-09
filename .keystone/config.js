"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// features/keystone/lib/s3-storage.ts
function s3ForcePathStyle(endpoint2) {
  let hostname = "";
  try {
    hostname = endpoint2 ? new URL(endpoint2).hostname : "";
  } catch {
  }
  return !(hostname === "storageapi.dev" || hostname.endsWith(".storageapi.dev"));
}
var init_s3_storage = __esm({
  "features/keystone/lib/s3-storage.ts"() {
    "use strict";
  }
});

// features/keystone/lib/lifecycle.ts
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
function getLifecycleTarget(machineName, action) {
  const machine = lifecycleMachines[machineName];
  const target = machine.actions[action];
  if (!target) throw new Error(`Unsupported ${machine.label} action: ${action}.`);
  return target;
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
var lifecycleMachines;
var init_lifecycle = __esm({
  "features/keystone/lib/lifecycle.ts"() {
    "use strict";
    lifecycleMachines = {
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
      },
      route: {
        label: "Route",
        initial: "draft",
        terminal: ["archived"],
        transitions: { draft: ["active", "archived"], active: ["suspended", "archived"], suspended: ["active", "archived"], archived: [] },
        actions: { activate: "active", suspend: "suspended", archive: "archived" }
      },
      flightSchedule: {
        label: "Flight schedule",
        initial: "draft",
        terminal: ["retired"],
        transitions: { draft: ["published", "retired"], published: ["suspended", "retired"], suspended: ["published", "retired"], retired: [] },
        actions: { publish: "published", suspend: "suspended", retire: "retired" }
      },
      catalogProduct: {
        label: "Catalog item",
        initial: "draft",
        terminal: ["archived"],
        transitions: { draft: ["active", "archived"], active: ["inactive", "archived"], inactive: ["active", "archived"], archived: [] },
        actions: { activate: "active", deactivate: "inactive", archive: "archived" }
      },
      stationAssignment: {
        label: "Station assignment",
        initial: "active",
        terminal: ["revoked"],
        transitions: { active: ["suspended", "revoked"], suspended: ["active", "revoked"], revoked: [] },
        actions: { suspend: "suspended", reinstate: "active", revoke: "revoked" }
      },
      carrier: {
        label: "Carrier",
        initial: "active",
        terminal: ["archived"],
        transitions: { active: ["suspended", "archived"], suspended: ["active", "archived"], archived: [] },
        actions: { suspend: "suspended", reinstate: "active", archive: "archived" }
      },
      approvedAgent: {
        label: "Approved agent",
        initial: "pending",
        terminal: ["revoked", "expired"],
        transitions: { pending: ["approved", "revoked"], approved: ["suspended", "revoked", "expired"], suspended: ["approved", "revoked", "expired"], revoked: [], expired: [] },
        actions: { approve: "approved", suspend: "suspended", revoke: "revoked", expire: "expired" }
      },
      bookingPayment: {
        label: "Booking payment status",
        initial: "unpaid",
        terminal: ["refunded"],
        transitions: {
          unpaid: ["partially_paid", "paid", "failed"],
          failed: ["unpaid", "partially_paid", "paid"],
          partially_paid: ["paid", "failed", "partially_refunded", "refunded"],
          paid: ["partially_refunded", "refunded"],
          partially_refunded: ["refunded"],
          refunded: []
        },
        actions: { pay: "paid", fail: "failed", refundPartly: "partially_refunded", refund: "refunded" }
      },
      bookingTicketing: {
        label: "Booking ticketing status",
        initial: "not_ticketed",
        terminal: ["voided", "exchanged"],
        transitions: {
          not_ticketed: ["partially_ticketed", "ticketed", "voided"],
          partially_ticketed: ["ticketed", "voided", "exchanged"],
          ticketed: ["voided", "exchanged"],
          voided: [],
          exchanged: []
        },
        actions: { ticket: "ticketed", void: "voided", exchange: "exchanged" }
      }
    };
  }
});

// features/keystone/lib/domain-error.ts
var import_graphql, DomainError;
var init_domain_error = __esm({
  "features/keystone/lib/domain-error.ts"() {
    "use strict";
    import_graphql = require("graphql");
    DomainError = class extends import_graphql.GraphQLError {
      constructor(message, code = "BAD_USER_INPUT") {
        super(message, { extensions: { code } });
      }
    };
  }
});

// features/keystone/models/fields.ts
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
var import_fields, permissionLabels, permissionFields, permissionsList, immutableFieldAccess, hiddenSensitiveUi;
var init_fields = __esm({
  "features/keystone/models/fields.ts"() {
    "use strict";
    import_fields = require("@keystone-6/core/fields");
    permissionLabels = {
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
    permissionFields = Object.fromEntries(
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
    permissionsList = Object.keys(permissionLabels);
    immutableFieldAccess = {
      update: () => false
    };
    hiddenSensitiveUi = {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "hidden" },
      listView: { fieldMode: "hidden" }
    };
  }
});

// features/keystone/access.ts
function hasPermission({ session }, permission) {
  if (!session?.data.role || !permissionsList.includes(permission)) return false;
  return session.data.role[permission] === true;
}
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
function nestedRelationshipFilter(path, id2) {
  const parts = path.split(".").filter(Boolean);
  return parts.reduceRight(
    (filter, relationship57) => ({ [relationship57]: filter }),
    { id: typeof id2 === "string" ? { equals: id2 } : id2 }
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
  if (!session?.itemId || session.listKey !== "User") throw new DomainError("Resource not found or inaccessible.", "NOT_FOUND");
  const user = await context.prisma.user.findUnique({
    where: { id: session.itemId },
    select: { id: true, carrierId: true, role: { select: Object.fromEntries([...permissionsList, "id"].map((name) => [name, true])) } }
  });
  if (!user?.role || user.role[permission] !== true || !user.carrierId) throw new DomainError("Resource not found or inaccessible.", "NOT_FOUND");
  return { itemId: user.id, carrierId: user.carrierId, canManageCarriers: user.role.canManageCarriers === true };
}
async function requireFreshCarrierPermission(context, permission, carrierId) {
  const actor = await requireFreshPermission(context, permission);
  if (!actor.canManageCarriers && actor.carrierId !== carrierId) throw new DomainError("Resource not found or inaccessible.", "NOT_FOUND");
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
  if (!assignment) throw new DomainError("Resource not found or inaccessible.", "NOT_FOUND");
  return actor;
}
var permissions;
var init_access = __esm({
  "features/keystone/access.ts"() {
    "use strict";
    init_domain_error();
    init_fields();
    permissions = Object.fromEntries(
      permissionsList.map((permission) => [
        permission,
        (args) => hasPermission(args, permission)
      ])
    );
  }
});

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
  return [...new Set(candidates.map((candidate) => typeof candidate === "string" ? candidate : candidate?.id).filter((id2) => typeof id2 === "string"))];
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
        const ids2 = connectedRelationshipIds(value);
        if (!ids2.length) continue;
        const carrierField = spec.carrierField ?? "carrierId";
        const rows = await context.prisma[spec.model].findMany({ where: { id: { in: ids2 } }, select: { id: true, [carrierField]: true } });
        if (rows.length !== ids2.length || rows.some((row) => row[carrierField] !== carrierId)) addValidationError(`${field} must belong to the same carrier.`);
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
var init_validation = __esm({
  "features/keystone/lib/validation.ts"() {
    "use strict";
  }
});

// features/keystone/models/trackingFields.ts
var import_fields3, trackingFields;
var init_trackingFields = __esm({
  "features/keystone/models/trackingFields.ts"() {
    "use strict";
    import_fields3 = require("@keystone-6/core/fields");
    trackingFields = {
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
  }
});

// features/keystone/models/AncillaryProduct.ts
var import_core, import_fields4, AncillaryProduct;
var init_AncillaryProduct = __esm({
  "features/keystone/models/AncillaryProduct.ts"() {
    "use strict";
    import_core = require("@keystone-6/core");
    import_fields4 = require("@keystone-6/core/fields");
    init_lifecycle();
    init_access();
    init_validation();
    init_trackingFields();
    AncillaryProduct = (0, import_core.list)({
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
        lifecycleHooks("catalogProduct"),
        requiredRelationshipHooks(["carrier"]),
        commandOwnedRelationshipHooks(["offerItems", "bookingLineItems", "electronicMiscCoupons"]),
        minorAmountHooks(["defaultPriceAmount", "taxAmount"])
      )
    });
  }
});

// features/keystone/models/ApprovedAgent.ts
var import_core2, import_fields5, canReadAgents, ApprovedAgent;
var init_ApprovedAgent = __esm({
  "features/keystone/models/ApprovedAgent.ts"() {
    "use strict";
    import_core2 = require("@keystone-6/core");
    import_fields5 = require("@keystone-6/core/fields");
    init_lifecycle();
    init_access();
    init_validation();
    init_trackingFields();
    canReadAgents = (args) => hasFreshPermission(args, "canManageAgents", "canReadOffers", "canReadBookings");
    ApprovedAgent = (0, import_core2.list)({
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
        lifecycleHooks("approvedAgent"),
        requiredRelationshipHooks(["carrier"]),
        commandOwnedRelationshipHooks(["offers", "bookings"]),
        chronologicalRangeHooks("validFrom", "validTo", "Agent approval")
      )
    });
  }
});

// features/keystone/models/Airport.ts
var import_core3, import_fields6, canReadAirport, Airport;
var init_Airport = __esm({
  "features/keystone/models/Airport.ts"() {
    "use strict";
    import_core3 = require("@keystone-6/core");
    import_fields6 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    canReadAirport = (args) => hasFreshPermission(
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
    Airport = (0, import_core3.list)({
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
  }
});

// features/keystone/models/AuditEvent.ts
var import_core4, import_fields7, AuditEvent;
var init_AuditEvent = __esm({
  "features/keystone/models/AuditEvent.ts"() {
    "use strict";
    import_core4 = require("@keystone-6/core");
    import_fields7 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_trackingFields();
    AuditEvent = (0, import_core4.list)({
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
  }
});

// features/keystone/models/Bag.ts
var import_core5, import_fields8, Bag;
var init_Bag = __esm({
  "features/keystone/models/Bag.ts"() {
    "use strict";
    import_core5 = require("@keystone-6/core");
    import_fields8 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    Bag = (0, import_core5.list)({
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
  }
});

// features/keystone/models/BagEvent.ts
var import_core6, import_fields10, BagEvent;
var init_BagEvent = __esm({
  "features/keystone/models/BagEvent.ts"() {
    "use strict";
    import_core6 = require("@keystone-6/core");
    import_fields10 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_trackingFields();
    BagEvent = (0, import_core6.list)({
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
  }
});

// features/keystone/models/BoardingPass.ts
var import_core7, import_fields11, manageAirportService, BoardingPass;
var init_BoardingPass = __esm({
  "features/keystone/models/BoardingPass.ts"() {
    "use strict";
    import_core7 = require("@keystone-6/core");
    import_fields11 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    manageAirportService = (args) => hasFreshPermission(args, "canManageAirportService");
    BoardingPass = (0, import_core7.list)({
      access: stationScopedCommandAccess("canReadAirportService", "canManageAirportService", "bookingSegment.flightInstance.origin", "canBoard"),
      graphql: commandOnlyGraphql(),
      ui: { labelField: "passNumber", listView: { initialColumns: ["passNumber", "passenger", "bookingSegment", "status", "boardingGroup", "issuedAt"] }, hideDelete: true },
      fields: {
        carrier: (0, import_fields11.relationship)({ ref: "Carrier" }),
        passNumber: (0, import_fields11.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        checkIn: (0, import_fields11.relationship)({ ref: "CheckIn.boardingPasses", access: immutableFieldAccess }),
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
  }
});

// features/keystone/models/Booking.ts
var import_core8, import_access8, import_fields13, bookingTotalHooks, Booking;
var init_Booking = __esm({
  "features/keystone/models/Booking.ts"() {
    "use strict";
    import_core8 = require("@keystone-6/core");
    import_access8 = require("@keystone-6/core/access");
    import_fields13 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    bookingTotalHooks = {
      validate({ resolvedData, item, addValidationError }) {
        const value = (key) => Number(resolvedData[key] ?? item?.[key] ?? 0);
        if (value("baseAmount") + value("taxAmount") + value("feeAmount") - value("discountAmount") !== value("totalAmount")) {
          addValidationError("Booking total must equal base plus tax and fees minus discounts.");
        }
      }
    };
    Booking = (0, import_core8.list)({
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
        lifecycleHooks("bookingTicketing", "ticketingStatus"),
        lifecycleHooks("bookingPayment", "paymentStatus"),
        requiredRelationshipHooks(["carrier"]),
        lifecycleHooks("booking"),
        minorAmountHooks(["baseAmount", "taxAmount", "feeAmount", "discountAmount", "totalAmount"]),
        bookingTotalHooks
      )
    });
  }
});

// features/keystone/models/BookingLineItem.ts
var import_core9, import_fields14, lineTotalHooks, BookingLineItem;
var init_BookingLineItem = __esm({
  "features/keystone/models/BookingLineItem.ts"() {
    "use strict";
    import_core9 = require("@keystone-6/core");
    import_fields14 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_trackingFields();
    lineTotalHooks = {
      validate({ resolvedData, addValidationError }) {
        const quantity = Number(resolvedData.quantity ?? 1);
        const unit = Number(resolvedData.unitAmount ?? 0);
        const base = Number(resolvedData.baseAmount ?? 0);
        const tax = Number(resolvedData.taxAmount ?? 0);
        const fee = Number(resolvedData.feeAmount ?? 0);
        const total2 = Number(resolvedData.totalAmount ?? 0);
        if (!Number.isSafeInteger(unit * quantity) || unit * quantity !== base) {
          addValidationError("Booking line base amount must equal unit amount multiplied by quantity.");
        }
        if (base + tax + fee !== total2) {
          addValidationError("Booking line total must equal base, tax, and fee amounts.");
        }
      }
    };
    BookingLineItem = (0, import_core9.list)({
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
  }
});

// features/keystone/models/BookingPassenger.ts
var import_core10, import_fields15, passengerSnapshotHooks, BookingPassenger;
var init_BookingPassenger = __esm({
  "features/keystone/models/BookingPassenger.ts"() {
    "use strict";
    import_core10 = require("@keystone-6/core");
    import_fields15 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_trackingFields();
    passengerSnapshotHooks = {
      validate({ operation, resolvedData, addValidationError }) {
        if (operation === "create" && !resolvedData.passengerSnapshot) {
          addValidationError("passengerSnapshot is required and immutable.");
        }
      }
    };
    BookingPassenger = (0, import_core10.list)({
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
  }
});

// features/keystone/models/BookingSegment.ts
var import_core11, import_fields17, BookingSegment;
var init_BookingSegment = __esm({
  "features/keystone/models/BookingSegment.ts"() {
    "use strict";
    import_core11 = require("@keystone-6/core");
    import_fields17 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    BookingSegment = (0, import_core11.list)({
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
  }
});

// features/keystone/models/Cabin.ts
var import_core12, import_fields19, Cabin;
var init_Cabin = __esm({
  "features/keystone/models/Cabin.ts"() {
    "use strict";
    import_core12 = require("@keystone-6/core");
    import_fields19 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_trackingFields();
    Cabin = (0, import_core12.list)({
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
  }
});

// features/platform/onboarding/seed.json
var seed_default;
var init_seed = __esm({
  "features/platform/onboarding/seed.json"() {
    seed_default = {
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
  }
});

// features/keystone/lib/currency-policy.ts
function supportedCurrencyCode(value) {
  const currency = String(value ?? "").trim().toUpperCase();
  if (!ONBOARDING_CURRENCIES.includes(currency)) throw new DomainError(`Currency must be one of ${ONBOARDING_CURRENCIES.join(", ")}.`);
  return currency;
}
var ONBOARDING_CURRENCIES;
var init_currency_policy = __esm({
  "features/keystone/lib/currency-policy.ts"() {
    "use strict";
    init_seed();
    init_domain_error();
    ONBOARDING_CURRENCIES = seed_default.supportedCurrencies;
  }
});

// features/keystone/utils/storeLogo.ts
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) {
    return "";
  }
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) {
    return "";
  }
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}
var ALLOWED_ELEMENTS, ALLOWED_ATTRIBUTES, ATTRIBUTE_PATTERN, TAG_PATTERN;
var init_storeLogo = __esm({
  "features/keystone/utils/storeLogo.ts"() {
    "use strict";
    ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
      "svg",
      "g",
      "path",
      "defs",
      "lineargradient",
      "radialgradient",
      "stop",
      "clippath",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "title",
      "desc"
    ]);
    ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
      "xmlns",
      "fill",
      "fill-rule",
      "clip-rule",
      "height",
      "width",
      "viewbox",
      "d",
      "clip-path",
      "id",
      "x1",
      "x2",
      "y1",
      "y2",
      "gradientunits",
      "gradienttransform",
      "offset",
      "stop-color",
      "stop-opacity",
      "opacity",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "x",
      "y",
      "transform",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "points",
      "role",
      "aria-hidden",
      "aria-label",
      "preserveaspectratio"
    ]);
    ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
  }
});

// features/platform/store-settings/lib/icon-registry.ts
var LOGO_ICONS;
var init_icon_registry = __esm({
  "features/platform/store-settings/lib/icon-registry.ts"() {
    "use strict";
    LOGO_ICONS = [
      {
        id: "3portals",
        name: "3Portals",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill-rule="evenodd"><path d="m34.5868 8.40061-9.6868-2.59556c-.6687-.17919-1.2108.23679-1.2108.92911v10.02854c0 .6923.5421 1.3988 1.2108 1.578l9.6868 2.5955c.6687.1792 1.2109-.2368 1.2109-.9291v-10.02848c0-.69232-.5422-1.39882-1.2109-1.57801zm-9.6868-6.35625c-2.6749-.71674-4.8434.94718-4.8434 3.71647v10.02847c0 2.7693 2.1685 5.5953 4.8434 6.312l9.6868 2.5956c2.6749.7168 4.8434-.9472 4.8434-3.7165v-10.0284c0-2.76934-2.1685-5.59533-4.8434-6.31207z" fill="#8098f9"/><path d="m26.9812 16.5707-12.1085-3.2444c-.6687-.1792-1.2109.2368-1.2109.9291v12.5356c0 .6923.5422 1.3988 1.2109 1.578l12.1085 3.2445c.6687.1792 1.2108-.2368 1.2108-.9291v-12.5356c0-.6924-.5421-1.3989-1.2108-1.5781zm-12.1085-7.0051c-2.6749-.71674-4.8434.9472-4.8434 3.7165v12.5356c0 2.7693 2.1685 5.5953 4.8434 6.312l12.1085 3.2445c2.6749.7167 4.8433-.9472 4.8433-3.7165v-12.5356c0-2.7693-2.1684-5.5953-4.8433-6.312z" fill="#6172f3"/><path d="m19.3736 24.7409-14.53021-3.8934c-.66873-.1792-1.21085.2368-1.21085.9291v15.0428c0 .6923.54212 1.3988 1.21085 1.578l14.53021 3.8933c.6687.1792 1.2108-.2368 1.2108-.9291v-15.0427c0-.6923-.5421-1.3988-1.2108-1.578zm-14.53021-7.6541c-2.67493-.7167-4.84339.9472-4.84339 3.7165v15.0427c0 2.7693 2.16846 5.5953 4.84339 6.3121l14.53021 3.8933c2.6749.7168 4.8433-.9472 4.8433-3.7164v-15.0428c0-2.7693-2.1684-5.5953-4.8433-6.312z" fill="#444ce7"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m34.5868 8.40061-9.6868-2.59556c-.6687-.17919-1.2108.23679-1.2108.92911v10.02854c0 .6923.5421 1.3988 1.2108 1.578l9.6868 2.5955c.6687.1792 1.2109-.2368 1.2109-.9291v-10.02848c0-.69232-.5422-1.39882-1.2109-1.57801zm-9.6868-6.35625c-2.6749-.71674-4.8434.94718-4.8434 3.71647v10.02847c0 2.7693 2.1685 5.5953 4.8434 6.312l9.6868 2.5956c2.6749.7168 4.8434-.9472 4.8434-3.7165v-10.0284c0-2.76934-2.1685-5.59533-4.8434-6.31207z" opacity=".5"/><path d="m26.9812 16.5707-12.1085-3.2444c-.6687-.1792-1.2109.2368-1.2109.9291v12.5356c0 .6923.5422 1.3988 1.2109 1.578l12.1085 3.2445c.6687.1792 1.2108-.2368 1.2108-.9291v-12.5356c0-.6924-.5421-1.3989-1.2108-1.5781zm-12.1085-7.0051c-2.6749-.71674-4.8434.9472-4.8434 3.7165v12.5356c0 2.7693 2.1685 5.5953 4.8434 6.312l12.1085 3.2445c2.6749.7167 4.8433-.9472 4.8433-3.7165v-12.5356c0-2.7693-2.1684-5.5953-4.8433-6.312z" opacity=".7"/><path d="m19.3736 24.7409-14.53021-3.8934c-.66873-.1792-1.21085.2368-1.21085.9291v15.0428c0 .6923.54212 1.3988 1.21085 1.578l14.53021 3.8933c.6687.1792 1.2108-.2368 1.2108-.9291v-15.0427c0-.6923-.5421-1.3988-1.2108-1.578zm-14.53021-7.6541c-2.67493-.7167-4.84339.9472-4.84339 3.7165v15.0427c0 2.7693 2.16846 5.5953 4.84339 6.3121l14.53021 3.8933c2.6749.7168 4.8433-.9472 4.8433-3.7164v-15.0428c0-2.7693-2.1684-5.5953-4.8433-6.312z"/></g></svg>`
      },
      {
        id: "45-degrees",
        name: "45 Degrees",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 24 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="#155eef"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 24 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="#155eef"/></svg>`
      },
      {
        id: "acme-corp",
        name: "Acme Corp",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m0 24c15.2548 0 24-8.7452 24-24 0 15.2548 8.7452 24 24 24-15.2548 0-24 8.7452-24 24 0-15.2548-8.7452-24-24-24z" fill="#155eef" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m0 24c15.2548 0 24-8.7452 24-24 0 15.2548 8.7452 24 24 24-15.2548 0-24 8.7452-24 24 0-15.2548-8.7452-24-24-24z" fill="#155eef" fill-rule="evenodd"/></svg>`
      },
      {
        id: "alphawave",
        name: "AlphaWave",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 47 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m24.9706 7.03309c-3.1242-3.1242-8.1896-3.1242-11.3137 0l-11.31375 11.31371c-3.124199 3.1242-3.124199 8.1895 0 11.3137l11.31375 11.3137c3.1241 3.1242 8.1895 3.1242 11.3137 0l5.3982-5.3983c-4.4939-1.7337-7.682-6.0944-7.682-11.1997 0-5.3087 3.4472-9.8123 8.2254-11.3943-.0935-.0982-.1884-.1955-.2848-.292z" fill="#155eef"/><path d="m30.3691 35.5798c1.3398.5168 2.7955.8001 4.3174.8001 6.6274 0 12-5.3726 12-12s-5.3726-12-12-12c-1.3185 0-2.5873.2126-3.774.6055 5.9623 6.2681 5.8675 16.1836-.2846 22.3356z" fill="#155eef" opacity=".7"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 47 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m24.9706 7.03309c-3.1242-3.1242-8.1896-3.1242-11.3137 0l-11.31375 11.31371c-3.124199 3.1242-3.124199 8.1895 0 11.3137l11.31375 11.3137c3.1241 3.1242 8.1895 3.1242 11.3137 0l5.3982-5.3983c-4.4939-1.7337-7.682-6.0944-7.682-11.1997 0-5.3087 3.4472-9.8123 8.2254-11.3943-.0935-.0982-.1884-.1955-.2848-.292z" fill="#155eef"/><path d="m30.3691 35.5798c1.3398.5168 2.7955.8001 4.3174.8001 6.6274 0 12-5.3726 12-12s-5.3726-12-12-12c-1.3185 0-2.5873.2126-3.774.6055 5.9623 6.2681 5.8675 16.1836-.2846 22.3356z" fill="#155eef" opacity=".7"/></svg>`
      },
      {
        id: "alt-shift",
        name: "Alt+Shift",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m23.4538 34.7189c-3.1818-1.1818-6.4544-1.3636-9.4544-.5455-2.0909.5455-4.09082 1.6364-5.90897 3l-1.27273 1.0909-.36362.3636.81816.7273c.09091 0 .09092.0909.18183.1818.18181.1818.36364.2727.63636.4545l.54542.3636.54545-.4545c.09091-.0909.27273-.2727.45454-.3636 1.63636-1.3636 3.45446-2.2727 5.36356-2.7272 2.4545-.6364 5.0908-.5455 7.7271.4545 2.1818.8182 6.6363 1.8181 11.9998-.4545l.1818-.091.2728-.2727c0-.0909.0909-.0909.1818-.1818.4545-.5454.9091-1.0909 1.2727-1.7272l1.8181-2.8182-2.909 1.6363c-4.2727 2.3636-8.1817 2.8182-12.0907 1.3637z"/><path d="m10.9998 24.9011c2.4545-.6363 5.0908-.5454 7.7272.4546 2.909 1.0909 10.3634 2.6363 18.7269-4.909l1.8182-1.8182-.1819-.4545c-.0909-.3636-.2727-.8182-.4545-1.2727l-.4545-1.2727-.9091.909c-.0909.1819-.2727.2728-.4546.4546-3.9999 4.0908-10.1816 8.2726-17.2724 5.7272-3.1817-1.1818-6.4544-1.3637-9.4544-.5455-2.909.8182-5.45442 2.3636-7.81801 4.5454v-.0909l-1.363614 1.4545c0 .0909-.090891.0909-.181798.1818l-.27274.2727.090913.3637c.090908.4545.272717.909.363625 1.3636l.545454 1.4545.90907-1.1818c.09091-.1818.27272-.2727.36363-.4545 1.90905-1.7273 4.54538-4.1818 8.27257-5.1818z"/><path d="m2.1818 23.2646c2.09088-2.1818 4.45445-3.5454 6.99987-4.2727 2.45453-.6363 5.09083-.5454 7.72713.4546 8.1817 2.9999 15.2725-1.9091 18.3633-4.5454l1.1818-1.1818.4546-.3636-.3637-.5455c-.2727-.2727-.4545-.6363-.7272-1l-.5455-.7272-.6363.6363c-.0909.0909-.2727.2727-.3637.3637-3.8181 3.6363-9.7271 7.3635-16.4542 4.8181-3.1818-1.1818-6.4544-1.3637-9.4544-.5455-1.90906.5455-3.72721 1.4545-5.54536 2.6363l-1.909065 1.5455c-.181815.1818-.272722.2727-.454537.4545l-.181799.1818v.2727c-.090907.6364-.090918 1.2727-.1818259 1.8182l-.0909131 2.2727 1.54544-1.6364c.18181-.1818.36364-.4545.63636-.6363z"/><path d="m26.0908 40.9007c-.2727-.0909-.4545-.1819-.7272-.2728-3.1818-1.1818-6.4545-1.3636-9.4545-.5454-.6363.1818-1.2726.3636-1.909.6364l-2.1818.9999-.5454.2728 1.8181.6363c.5455.1818 1.0909.3637 1.6364.5455l.2727.0909.2727-.0909c.2727-.0909.5455-.2728.8182-.2728.1818 0 .3636-.0909.5454-.1818 2.1818-.5454 4.5454-.5454 7.0908.2727.2727.091.4546.1819.7273.2728l.4545.1818.2727-.0909c.6364-.1818 1.3636-.3636 1.9091-.6364l2.5454-.909-2.6363-.6364c-.2727-.0909-.6364-.1818-.9091-.2727z"/><path d="m40 22.0829-1.3636 1.3636c-.1818.1818-.3636.3636-.5454.5454-3.7272 3.5454-9.7271 7.3635-16.4543 4.8181-3.1818-1.1818-6.4544-1.3636-9.4544-.5454-2.81811.8182-5.36354 2.2727-7.63623 4.4545l-1.18179 1.2727-.36362.4545.36362.5454c.27273.3637.45455.6364.63637 1l.54542.8182.63636-.8182c.09091-.0909.27272-.2727.36363-.3636 2.18178-2.3636 4.54534-3.8181 7.27264-4.5454 2.4545-.6364 5.0908-.5454 7.7271.4545 2.2727.8182 4.6363 1.0909 6.9999.8182 4.1817-.4545 8.3635-2.8181 11.4543-5.4544.1819-.1818.3636-.2727.5455-.4546l.2727-.2727v-.2727c0-.5455.0909-1.1818.0909-1.7273z"/><path d="m5.45373 13.7196c.54545-.2728 1.18182-.4546 1.72726-.6364 2.45451-.6364 5.09081-.5455 7.72711.4545 1.7273.6364 3.4545.9091 5.3636.9091 3.8181 0 7.6362-1.3636 11.1816-3.9999l1.8181-1.45455-.8181-.63636c-.2727-.27273-.6364-.54544-1-.72725l-.5455-.36363-.4545.36363c-.1818.09091-.2727.27272-.4545.36362-4.8181 3.63634-9.6362 4.63634-14.1816 2.90904-3.2727-1.18178-6.54535-1.45451-9.81802-.4545-.27272.0909-.54544.1818-.90907.2727l-.1818.0909-.27274.2727c0 .0909-.09089.0909-.1818.1818-.36363.5455-.81818 1-1.18181 1.5455l-1.72724 2.6363 2.81814-1.4545c.45453 0 .81815-.1818 1.09087-.2727z"/><path d="m12.9089 7.53769.2727.09091c1.1818.45454 3 .90907 5.2726.90907 2.3636 0 4.6363-.54545 6.909-1.45452l2.8181-1.36361-1.909-.63634c-.5454-.18182-1.0909-.36363-1.7273-.45454h-.2727l-.2727.09089c-.2727.0909-.5455.27274-.8182.36365-2.7272.99998-5.4544 1.1818-8.0907.45454-.2728-.09091-.5455-.18183-.8182-.27274l-.2727-.09091-.2728.09091c-.5454.18181-1.0908.36364-1.6363.63636l-2.09087.90908 2.18177.63633c.1818-.0909.4546.00001.7273.09092z"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m23.4538 34.7189c-3.1818-1.1818-6.4544-1.3636-9.4544-.5455-2.0909.5455-4.09082 1.6364-5.90897 3l-1.27273 1.0909-.36362.3636.81816.7273c.09091 0 .09092.0909.18183.1818.18181.1818.36364.2727.63636.4545l.54542.3636.54545-.4545c.09091-.0909.27273-.2727.45454-.3636 1.63636-1.3636 3.45446-2.2727 5.36356-2.7272 2.4545-.6364 5.0908-.5455 7.7271.4545 2.1818.8182 6.6363 1.8181 11.9998-.4545l.1818-.091.2728-.2727c0-.0909.0909-.0909.1818-.1818.4545-.5454.9091-1.0909 1.2727-1.7272l1.8181-2.8182-2.909 1.6363c-4.2727 2.3636-8.1817 2.8182-12.0907 1.3637z"/><path d="m10.9998 24.9011c2.4545-.6363 5.0908-.5454 7.7272.4546 2.909 1.0909 10.3634 2.6363 18.7269-4.909l1.8182-1.8182-.1819-.4545c-.0909-.3636-.2727-.8182-.4545-1.2727l-.4545-1.2727-.9091.909c-.0909.1819-.2727.2728-.4546.4546-3.9999 4.0908-10.1816 8.2726-17.2724 5.7272-3.1817-1.1818-6.4544-1.3637-9.4544-.5455-2.909.8182-5.45442 2.3636-7.81801 4.5454v-.0909l-1.363614 1.4545c0 .0909-.090891.0909-.181798.1818l-.27274.2727.090913.3637c.090908.4545.272717.909.363625 1.3636l.545454 1.4545.90907-1.1818c.09091-.1818.27272-.2727.36363-.4545 1.90905-1.7273 4.54538-4.1818 8.27257-5.1818z"/><path d="m2.1818 23.2646c2.09088-2.1818 4.45445-3.5454 6.99987-4.2727 2.45453-.6363 5.09083-.5454 7.72713.4546 8.1817 2.9999 15.2725-1.9091 18.3633-4.5454l1.1818-1.1818.4546-.3636-.3637-.5455c-.2727-.2727-.4545-.6363-.7272-1l-.5455-.7272-.6363.6363c-.0909.0909-.2727.2727-.3637.3637-3.8181 3.6363-9.7271 7.3635-16.4542 4.8181-3.1818-1.1818-6.4544-1.3637-9.4544-.5455-1.90906.5455-3.72721 1.4545-5.54536 2.6363l-1.909065 1.5455c-.181815.1818-.272722.2727-.454537.4545l-.181799.1818v.2727c-.090907.6364-.090918 1.2727-.1818259 1.8182l-.0909131 2.2727 1.54544-1.6364c.18181-.1818.36364-.4545.63636-.6363z"/><path d="m26.0908 40.9007c-.2727-.0909-.4545-.1819-.7272-.2728-3.1818-1.1818-6.4545-1.3636-9.4545-.5454-.6363.1818-1.2726.3636-1.909.6364l-2.1818.9999-.5454.2728 1.8181.6363c.5455.1818 1.0909.3637 1.6364.5455l.2727.0909.2727-.0909c.2727-.0909.5455-.2728.8182-.2728.1818 0 .3636-.0909.5454-.1818 2.1818-.5454 4.5454-.5454 7.0908.2727.2727.091.4546.1819.7273.2728l.4545.1818.2727-.0909c.6364-.1818 1.3636-.3636 1.9091-.6364l2.5454-.909-2.6363-.6364c-.2727-.0909-.6364-.1818-.9091-.2727z"/><path d="m40 22.0829-1.3636 1.3636c-.1818.1818-.3636.3636-.5454.5454-3.7272 3.5454-9.7271 7.3635-16.4543 4.8181-3.1818-1.1818-6.4544-1.3636-9.4544-.5454-2.81811.8182-5.36354 2.2727-7.63623 4.4545l-1.18179 1.2727-.36362.4545.36362.5454c.27273.3637.45455.6364.63637 1l.54542.8182.63636-.8182c.09091-.0909.27272-.2727.36363-.3636 2.18178-2.3636 4.54534-3.8181 7.27264-4.5454 2.4545-.6364 5.0908-.5454 7.7271.4545 2.2727.8182 4.6363 1.0909 6.9999.8182 4.1817-.4545 8.3635-2.8181 11.4543-5.4544.1819-.1818.3636-.2727.5455-.4546l.2727-.2727v-.2727c0-.5455.0909-1.1818.0909-1.7273z"/><path d="m5.45373 13.7196c.54545-.2728 1.18182-.4546 1.72726-.6364 2.45451-.6364 5.09081-.5455 7.72711.4545 1.7273.6364 3.4545.9091 5.3636.9091 3.8181 0 7.6362-1.3636 11.1816-3.9999l1.8181-1.45455-.8181-.63636c-.2728-.27273-.6364-.54544-1-.72725l-.5455-.36363-.4545.36363c-.1818.09091-.2727.27272-.4545.36362-4.8181 3.63634-9.6362 4.63634-14.1816 2.90904-3.2727-1.18178-6.54535-1.45451-9.81802-.4545-.27272.0909-.54544.1818-.90907.2727l-.1818.0909-.27274.2727c0 .0909-.09089.0909-.1818.1818-.36363.5455-.81818 1-1.18181 1.5455l-1.72724 2.6363 2.81814-1.4545c.45453 0 .81815-.1818 1.09087-.2727z"/><path d="m12.9089 7.53769.2727.09091c1.1818.45454 3 .90907 5.2726.90907 2.3636 0 4.6363-.54545 6.909-1.45452l2.8181-1.36361-1.909-.63634c-.5454-.18182-1.0909-.36363-1.7273-.45454h-.2727l-.2727.09089c-.2727.0909-.5455.27274-.8182.36365-2.7272.99998-5.4544 1.1818-8.0907.45454-.2728-.09091-.5455-.18183-.8182-.27274l-.2727-.09091-.2728.09091c-.5454.18181-1.0908.36364-1.6363.63636l-2.09087.90908 2.18177.63633c.1818-.0909.4546.00001.7273.09092z"/></g></svg>`
      },
      {
        id: "biosynthesis",
        name: "Biosynthesis",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill-rule="evenodd"><path d="m4.29111 28.6025c.90712.9019.9071 2.3641-.00003 3.266l-.04646.0462c-.90713.9019-2.37788.9018-3.284994-.0001-.9071177-.9019-.9071038-2.3641.000031-3.266l.046453-.0462c.90714-.9019 2.37788-.9018 3.285.0001z" fill="#a4bcfd"/><path d="m15.2112 29.298c.9055.9035.9028 2.3658-.006 3.266l-6.43424 6.3741c-.90876.9002-2.3795.8976-3.28499-.0059-.90548-.9035-.90282-2.3658.00594-3.266l6.43429-6.3741c.9088-.9002 2.3795-.8976 3.285.0059z" fill="#6172f3"/><path d="m23.9431 40.2706c.7116-1.0613 2.1538-1.348 3.2212-.6405l.1394.0923c1.0674.7075 1.3558 2.1414.6442 3.2026-.7116 1.0613-2.1538 1.3481-3.2212.6406l-.1394-.0924c-1.0674-.7075-1.3558-2.1414-.6442-3.2026z" fill="#a4bcfd"/><path d="m39.2728 28.4638c.9072.9019.9072 2.3641 0 3.266l-3.159 3.1408c-.9072.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l3.1591-3.1408c.9071-.9019 2.3778-.9019 3.2849 0z" fill="#6172f3"/><g fill="#444ce7"><path d="m39.3197 16.8473c.9071.9019.9071 2.3642 0 3.266l-23.3446 23.2098c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l23.3446-23.2098c.9071-.9019 2.3778-.9019 3.285 0z"/><path d="m34.905 9.71133c.9072.90187.9072 2.36417 0 3.26607l-13.426 13.3485c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3642 0-3.2661l13.4261-13.34847c.9071-.90189 2.3778-.90189 3.2849 0z"/><path d="m27.8187 5.18362c.9077.90128.9087 2.36353.0022 3.26603l-17.2588 17.18215c-.90647.9025-2.37721.9035-3.28495.0022-.90773-.9013-.90872-2.3635-.00221-3.266l17.25876-17.18218c.9065-.9025 2.3772-.90348 3.285-.0022z"/></g><path d="m10.7276 10.6841c.9056.9035.9031 2.3657-.0056 3.266l-6.75949 6.6974c-.90869.9003-2.37943.8978-3.28499-.0056-.905563-.9035-.903032-2.3657.005654-3.2661l6.759476-6.6973c.90868-.90034 2.37942-.89783 3.28495.0056z" fill="#6172f3"/><path d="m14.8678 4.00024c1.2828 0 2.3228 1.03397 2.3228 2.30944v.23094c0 1.27546-1.04 2.30943-2.3228 2.30943-1.2829 0-2.3229-1.03397-2.3229-2.30943v-.23094c0-1.27547 1.04-2.30944 2.3229-2.30944z" fill="#a4bcfd"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m4.29111 28.6025c.90712.9019.9071 2.3641-.00003 3.266l-.04646.0462c-.90713.9019-2.37788.9018-3.284994-.0001-.9071177-.9019-.9071038-2.3641.000031-3.266l.046453-.0462c.90714-.9019 2.37788-.9018 3.285.0001z" opacity=".5"/><path d="m15.2112 29.298c.9055.9035.9028 2.3658-.006 3.266l-6.43424 6.3741c-.90876.9002-2.3795.8976-3.28499-.0059-.90548-.9035-.90282-2.3658.00594-3.266l6.43429-6.3741c.9088-.9002 2.3795-.8976 3.285.0059z" opacity=".7"/><path d="m23.9431 40.2706c.7116-1.0613 2.1538-1.348 3.2212-.6405l.1394.0923c1.0674.7075 1.3558 2.1414.6442 3.2026-.7116 1.0613-2.1538 1.3481-3.2212.6406l-.1394-.0924c-1.0674-.7075-1.3558-2.1414-.6442-3.2026z" opacity=".5"/><path d="m39.2728 28.4638c.9072.9019.9072 2.3641 0 3.266l-3.159 3.1408c-.9072.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l3.1591-3.1408c.9071-.9019 2.3778-.9019 3.2849 0z" opacity=".7"/><path d="m39.3197 16.8473c.9071.9019.9071 2.3642 0 3.266l-23.3446 23.2098c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l23.3446-23.2098c.9071-.9019 2.3778-.9019 3.285 0z"/><path d="m34.905 9.71133c.9072.90187.9072 2.36417 0 3.26607l-13.426 13.3485c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3642 0-3.2661l13.4261-13.34847c.9071-.90189 2.3778-.90189 3.2849 0z"/><path d="m27.8187 5.18362c.9077.90128.9087 2.36353.0022 3.26603l-17.2588 17.18215c-.90647.9025-2.37721.9035-3.28495.0022-.90773-.9013-.90872-2.3635-.00221-3.266l17.25876-17.18218c.9065-.9025 2.3772-.90348 3.285-.0022z"/><path d="m10.7276 10.6841c.9056.9035.9031 2.3657-.0056 3.266l-6.75949 6.6974c-.90869.9003-2.37943.8978-3.28499-.0056-.905563-.9035-.903032-2.3657.005654-3.2661l6.759476-6.6973c.90868-.90034 2.37942-.89783 3.28495.0056z" opacity=".7"/><path d="m14.8678 4.00024c1.2828 0 2.3228 1.03397 2.3228 2.30944v.23094c0 1.27546-1.04 2.30943-2.3228 2.30943-1.2829 0-2.3229-1.03397-2.3229-2.30943v-.23094c0-1.27547 1.04-2.30944 2.3229-2.30944z" opacity=".5"/></g></svg>`
      },
      {
        id: "boltshift",
        name: "Boltshift",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 44c11.0457 0 20-8.9543 20-20s-8.9543-20-20-20c-11.04572 0-20 8.9543-20 20s8.95428 20 20 20zm6.2393-30.6832c.3037-1.0787-.7432-1.7167-1.6993-1.0355l-13.3469 9.5083c-1.0369.7387-.8738 2.2104.245 2.2104h3.5146v-.0272h6.8498l-5.5813 1.9693-2.4605 8.7411c-.3037 1.0788.7431 1.7167 1.6993 1.0355l13.3469-9.5082c1.0369-.7387.8737-2.2105-.245-2.2105h-5.3298z" fill="#155eef" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 44c11.0457 0 20-8.9543 20-20s-8.9543-20-20-20c-11.04572 0-20 8.9543-20 20s8.95428 20 20 20zm6.2393-30.6832c.3037-1.0787-.7432-1.7167-1.6993-1.0355l-13.3469 9.5083c-1.0369.7387-.8738 2.2104.245 2.2104h3.5146v-.0272h6.8498l-5.5813 1.9693-2.4605 8.7411c-.3037 1.0788.7431 1.7167 1.6993 1.0355l13.3469-9.5082c1.0369-.7387.8737-2.2105-.245-2.2105h-5.3298z" fill="#fff" fill-rule="evenodd"/></svg>`
      },
      {
        id: "buildingblocks",
        name: "BuildingBlocks",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 37 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.8841 4.30945-6.8842 3.97574 6.8891 3.97661 6.8862-3.97575zm8.8919 7.44025-6.887 3.9762-.0007 7.9532 6.8877-3.9771zm2 11.4164-6.8879 3.9772 6.8889 3.9765 6.8871-3.9763zm8.8879 7.4416-6.8868 3.9761v7.9522l6.8868-3.9761zm-10.8868 11.9287v-7.9525l-6.8891-3.9766v7.9525zm-10.8888-18.8569-6.8883-3.9775v-7.9526l6.889 3.9765zm-.0003 4.6187-9.38814-5.4209c-.928127-.5359-1.49986-1.5262-1.49986-2.598v-11.99368c0-.71444.381106-1.37463.999789-1.73193l10.383811-5.996798c.9281-.5359626 2.0716-.5361538 2.9998-.000505l10.3922 5.996973c.619.3572 1.0004 1.01758 1.0004 1.73226v11.41638l9.888 5.7096c.6188.3573.9999 1.0175.9999 1.732v11.9937c0 1.0718-.5718 2.0621-1.5 2.598l-10.3868 5.9969c-.6187.3572-1.381.3572-1.9998.0001l-10.3891-5.9969c-.9283-.5358-1.5002-1.5263-1.5002-2.5982z" fill="#155eef" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 37 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.8841 4.30945-6.8842 3.97574 6.8891 3.97661 6.8862-3.97575zm8.8919 7.44025-6.887 3.9762-.0007 7.9532 6.8877-3.9771zm2 11.4164-6.8879 3.9772 6.8889 3.9765 6.8871-3.9763zm8.8879 7.4416-6.8868 3.9761v7.9522l6.8868-3.9761zm-10.8868 11.9287v-7.9525l-6.8891-3.9766v7.9525zm-10.8888-18.8569-6.8883-3.9775v-7.9526l6.889 3.9765zm-.0003 4.6187-9.38814-5.4209c-.928127-.5359-1.49986-1.5262-1.49986-2.598v-11.99368c0-.71444.381106-1.37463.999789-1.73193l10.383811-5.996798c.9281-.5359626 2.0716-.5361538 2.9998-.000505l10.3922 5.996973c.619.3572 1.0004 1.01758 1.0004 1.73226v11.41638l9.888 5.7096c.6188.3573.9999 1.0175.9999 1.732v11.9937c0 1.0718-.5718 2.0621-1.5 2.598l-10.3868 5.9969c-.6187.3572-1.381.3572-1.9998.0001l-10.3891-5.9969c-.9283-.5358-1.5002-1.5263-1.5002-2.5982z" fill="#155eef" fill-rule="evenodd"/></svg>`
      },
      {
        id: "calescence",
        name: "Calescence",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#1570ef" fill-rule="evenodd"><path d="m35.3721 14v8.0492h-9.9698v-2.2927z"/><path d="m35.3699 14.0001-9.9698 5.7565-7.3513-4.2436v-11.513z" opacity=".9"/><path d="m18.0512 4v11.513l-7.349 4.2436-9.969778-5.7565z" opacity=".8"/><path d="m10.7002 19.7565v8.4868l-9.969731 5.756v-19.9993z" opacity=".7"/><path d="m18.0492 32.4871v11.5129l-17.318731-10.0006 9.969731-5.756z" opacity=".6"/><path d="m35.3699 33.9994-17.3211 10.0006v-11.5129l7.3513-4.2437z" opacity=".5"/><path d="m35.3721 25.9507v8.0487l-9.9698-5.756v-2.2927z" opacity=".4"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m35.3721 14v8.0492h-9.9698v-2.2927z"/><path d="m35.3699 14.0001-9.9698 5.7565-7.3513-4.2436v-11.513z" opacity=".9"/><path d="m18.0512 4v11.513l-7.349 4.2436-9.969778-5.7565z" opacity=".8"/><path d="m10.7002 19.7565v8.4868l-9.969731 5.756v-19.9993z" opacity=".7"/><path d="m18.0492 32.4871v11.5129l-17.318731-10.0006 9.969731-5.756z" opacity=".6"/><path d="m35.3699 33.9994-17.3211 10.0006v-11.5129l7.3513-4.2437z" opacity=".5"/><path d="m35.3721 25.9507v8.0487l-9.9698-5.756v-2.2927z" opacity=".4"/></g></svg>`
      },
      {
        id: "capsule",
        name: "Capsule",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="18" fill="#1570ef" r="14"/><circle cx="26" cy="30" fill="#53b1fd" r="14"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><circle cx="14" cy="18" opacity=".7" r="14"/><circle cx="26" cy="30" opacity=".7" r="14"/></g></svg>`
      },
      {
        id: "constellation",
        name: "Constellation",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m16 8 5.0912 10.9088 10.9088 5.0912-10.9088 5.0912-5.0912 10.9088-5.0912-10.9088-10.9088-5.0912 10.9088-5.0912z"/><path d="m20.0469 31.3286 6.3539-1.0932 3.6 9.7646 3.6-9.7646 10.2565 1.7646-6.6564-8 6.6564-8-10.2565 1.7646-3.6-9.7646-3.6 9.7646-6.3539-1.0932 1.0442 2.2374 10.9088 5.0912-10.9088 5.0912z" opacity=".5"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m16 8 5.0912 10.9088 10.9088 5.0912-10.9088 5.0912-5.0912 10.9088-5.0912-10.9088-10.9088-5.0912 10.9088-5.0912z"/><path d="m20.0469 31.3286 6.3539-1.0932 3.6 9.7646 3.6-9.7646 10.2565 1.7646-6.6564-8 6.6564-8-10.2565 1.7646-3.6-9.7646-3.6 9.7646-6.3539-1.0932 1.0442 2.2374 10.9088 5.0912-10.9088 5.0912z" opacity=".5"/></g></svg>`
      },
      {
        id: "codecraft",
        name: "Codecraft",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 9c0-2.76142 2.23858-5 5-5h10c2.7614 0 5 2.23858 5 5v9.8192c.0002.06.0003.1203.0003.1808 0 2.7575 2.2322 4.9936 4.9881 5h.0116 10c2.7614 0 5 2.2386 5 5v10c0 2.7614-2.2386 5-5 5h-10c-2.7614 0-5-2.2386-5-5v-10c0-.0139.0001-.0277.0002-.0416-.0224-2.7422-2.2523-4.9584-4.9999-4.9584-.0129 0-.0258 0-.0387 0h-9.9616c-2.76142 0-5-2.2386-5-5z" fill="#155eef"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 9c0-2.76142 2.23858-5 5-5h10c2.7614 0 5 2.23858 5 5v9.8192c.0002.06.0003.1203.0003.1808 0 2.7575 2.2322 4.9936 4.9881 5h.0116 10c2.7614 0 5 2.2386 5 5v10c0 2.7614-2.2386 5-5 5h-10c-2.7614 0-5-2.2386-5-5v-10c0-.0139.0001-.0277.0002-.0416-.0224-2.7422-2.2523-4.9584-4.9999-4.9584-.0129 0-.0258 0-.0387 0h-9.9616c-2.76142 0-5-2.2386-5-5z" fill="#155eef"/></svg>`
      },
      {
        id: "command-r",
        name: "Command+R",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m18.6667 30.6667c7.3638 0 13.3333-5.9696 13.3333-13.3334 0-7.36376-5.9695-13.3333-13.3333-13.3333h-18.6667v26.6667z" fill="#155eef"/><path d="m0 4 32 40h-21.3333l-10.6667-13.3333z" fill="#2e90fa"/><path d="m21.1488 30.436c-.8042.1515-1.6339.2307-2.4821.2307h-18.6667v-26.6667z" fill="#53b1fd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m18.6667 30.6667c7.3638 0 13.3333-5.9696 13.3333-13.3334 0-7.36376-5.9695-13.3333-13.3333-13.3333h-18.6667v26.6667z" opacity=".7"/><path d="m0 4 32 40h-21.3333l-10.6667-13.3333z" opacity=".7"/><path d="m21.1488 30.436c-.8042.1515-1.6339.2307-2.4821.2307h-18.6667v-26.6667z" opacity=".7"/></g></svg>`
      },
      {
        id: "contrast-ai",
        name: "ContrastAI",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 4c11.0457 0 20 8.9543 20 20s-8.9543 20-20 20-20-8.9543-20-20 8.9543-20 20-20zm15 20c0 8.2843-6.7157 15-15 15v-30c8.2843 0 15 6.7157 15 15z" fill="#155eef" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 4c11.0457 0 20 8.9543 20 20s-8.9543 20-20 20-20-8.9543-20-20 8.9543-20 20-20zm15 20c0 8.2843-6.7157 15-15 15v-30c8.2843 0 15 6.7157 15 15z" fill="#fff" fill-rule="evenodd"/></svg>`
      },
      {
        id: "convergence",
        name: "Convergence",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m22.1017 20.8596 9.8995-9.8994-2.1213-2.12137-7.3389 7.33887v-13.1777h-3v13.1777l-7.3388-7.33887-2.1213 2.12137 9.8995 9.8994 1.0606 1.0607zm2.1207 2.1214 9.8995-9.8995 2.1213 2.1213-7.3388 7.3388h13.0956v3h-13.0956l7.3388 7.3389-2.1213 2.1213-9.8995-9.8995-1.0607-1.0607zm-16.26224 12.0208 9.89944-9.8995 1.0607-1.0607-1.0607-1.0606-9.89944-9.8995-2.12133 2.1213 7.33887 7.3388h-13.17574688v3h13.17574688l-7.33887 7.3389zm12.02024-7.7782-9.8995 9.8995 2.1213 2.1213 7.3388-7.3388v13.0944h3v-13.0944l7.3389 7.3388 2.1213-2.1213-9.8995-9.8995-1.0607-1.0607z" fill="#155eef" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m22.1017 20.8596 9.8995-9.8994-2.1213-2.12137-7.3389 7.33887v-13.1777h-3v13.1777l-7.3388-7.33887-2.1213 2.12137 9.8995 9.8994 1.0606 1.0607zm2.1207 2.1214 9.8995-9.8995 2.1213 2.1213-7.3388 7.3388h13.0956v3h-13.0956l7.3388 7.3389-2.1213 2.1213-9.8995-9.8995-1.0607-1.0607zm-16.26224 12.0208 9.89944-9.8995 1.0607-1.0607-1.0607-1.0606-9.89944-9.8995-2.12133 2.1213 7.33887 7.3388h-13.17574688v3h13.17574688l-7.33887 7.3389zm12.02024-7.7782-9.8995 9.8995 2.1213 2.1213 7.3388-7.3388v13.0944h3v-13.0944l7.3389 7.3388 2.1213-2.1213-9.8995-9.8995-1.0607-1.0607z" fill="#155eef" fill-rule="evenodd"/></svg>`
      },
      {
        id: "core-os",
        name: "CoreOS",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m15.2286 4.99951c-3.2154 0-6.18655 1.71539-7.79425 4.5l-5.7735 9.99999c-1.6076941 2.7846-1.607697 6.2154 0 9l5.7735 10c1.6077 2.7846 4.57885 4.5 7.79425 4.5h11.547c3.2154 0 6.1865-1.7154 7.7942-4.5l5.7735-10c1.6077-2.7846 1.6077-6.2154 0-9l-5.7735-9.99999c-1.6077-2.78461-4.5788-4.5-7.7942-4.5zm11.547 5.99999h-7.2169c-1.1547 0-1.8762 1.2499-1.298 2.2494 1.784 3.0838 3.5722 6.1653 5.3536 9.2506.5359.9282.5359 2.0718 0 3-1.7814 3.0854-3.5696 6.1668-5.3536 9.2506-.5782.9995.1433 2.2494 1.298 2.2494h7.2169c1.0718 0 2.0622-.5718 2.5981-1.5l5.7735-10c.5359-.9282.5359-2.0718 0-3l-5.7735-10c-.5359-.9282-1.5263-1.5-2.5981-1.5z" fill="#155eef" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m15.2286 4.99951c-3.2154 0-6.18655 1.71539-7.79425 4.5l-5.7735 9.99999c-1.6076941 2.7846-1.607697 6.2154 0 9l5.7735 10c1.6077 2.7846 4.57885 4.5 7.79425 4.5h11.547c3.2154 0 6.1865-1.7154 7.7942-4.5l5.7735-10c1.6077-2.7846 1.6077-6.2154 0-9l-5.7735-9.99999c-1.6077-2.78461-4.5788-4.5-7.7942-4.5zm11.547 5.99999h-7.2169c-1.1547 0-1.8762 1.2499-1.298 2.2494 1.784 3.0838 3.5722 6.1653 5.3536 9.2506.5359.9282.5359 2.0718 0 3-1.7814 3.0854-3.5696 6.1668-5.3536 9.2506-.5782.9995.1433 2.2494 1.298 2.2494h7.2169c1.0718 0 2.0622-.5718 2.5981-1.5l5.7735-10c.5359-.9282.5359-2.0718 0-3l-5.7735-10c-.5359-.9282-1.5263-1.5-2.5981-1.5z" fill="#155eef" fill-rule="evenodd"/></svg>`
      },
      {
        id: "cubekit",
        name: "Cubekit",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" fill="#155eef" opacity=".5"/><path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" fill="#1570ef" opacity=".5"/><path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" fill="#155eef" opacity=".5"/><path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" fill="#1570ef" opacity=".5"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" opacity=".5"/><path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" opacity=".5"/><path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" opacity=".5"/><path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" opacity=".5"/></g></svg>`
      },
      {
        id: "europa",
        name: "Europa",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m28.6446 39.168c-.6032 1.3404-1.353 2.6531-2.2519 3.7888 7.4581-2.5137 12.9483-9.3054 13.5527-17.4568h-2.6549c-3.2399 0-5.8424 2.5861-6.369 5.7829-.4855 2.9468-1.2621 5.6301-2.2769 7.8851z"/><path d="m22.7724 25.5c3.3921 0 6.167 2.8299 5.5439 6.1643-1.3533 7.2424-4.5667 12.3357-8.3155 12.3357-4.7435 0-8.6299-8.1549-8.975-18.5z"/><path d="m30.9904 17.1502c.4961 3.2267 3.1106 5.8498 6.3752 5.8498h2.6107c-.4123-8.3729-5.9735-15.39183-13.5836-17.95683.8989 1.13575 1.6487 2.44843 2.2519 3.78878 1.0643 2.36505 1.8666 5.20115 2.3458 8.31825z"/><path d="m28.4165 16.8957c.5674 3.3176-2.1954 6.1043-5.5612 6.1043h-11.8434c.2344-10.5811 4.1693-19 8.9889-19 3.8447 0 7.1263 5.35721 8.4157 12.8957z"/><path d="m8.51131 23c.11359-5.4083 1.14536-10.3894 2.84579-14.16805.6031-1.34035 1.3529-2.65303 2.2519-3.78878-7.61011 2.565-13.171316 9.58393-13.5836094 17.95683z"/><path d="m.0562286 25.5c.6043994 8.1514 6.0946514 14.9431 13.5527714 17.4568-.899-1.1357-1.6488-2.4484-2.2519-3.7888-1.6479-3.6619-2.66781-8.4531-2.83264-13.668z"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m28.6446 39.168c-.6032 1.3404-1.353 2.6531-2.2519 3.7888 7.4581-2.5137 12.9483-9.3054 13.5527-17.4568h-2.6549c-3.2399 0-5.8424 2.5861-6.369 5.7829-.4855 2.9468-1.2621 5.6301-2.2769 7.8851z"/><path d="m22.7724 25.5c3.3921 0 6.167 2.8299 5.5439 6.1643-1.3533 7.2424-4.5667 12.3357-8.3155 12.3357-4.7435 0-8.6299-8.1549-8.975-18.5z"/><path d="m30.9904 17.1502c.4961 3.2267 3.1106 5.8498 6.3752 5.8498h2.6107c-.4123-8.3729-5.9735-15.39183-13.5836-17.95683.8989 1.13575 1.6487 2.44843 2.2519 3.78878 1.0643 2.36505 1.8666 5.20115 2.3458 8.31825z"/><path d="m28.4165 16.8957c.5674 3.3176-2.1954 6.1043-5.5612 6.1043h-11.8434c.2344-10.5811 4.1693-19 8.9889-19 3.8447 0 7.1263 5.35721 8.4157 12.8957z"/><path d="m8.51131 23c.11359-5.4083 1.14536-10.3894 2.84579-14.16805.6031-1.34035 1.3529-2.65303 2.2519-3.78878-7.61011 2.565-13.171316 9.58393-13.5836094 17.95683z"/><path d="m.0562286 25.5c.6043994 8.1514 6.0946514 14.9431 13.5527714 17.4568-.899-1.1357-1.6488-2.4484-2.2519-3.7888-1.6479-3.6619-2.66781-8.4531-2.83264-13.668z"/></g></svg>`
      },
      {
        id: "feather-dev",
        name: "FeatherDev",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m36.3068 11.4224c-.4322-.4323-.8644-.8645-1.2967-1.2967-1.2966-1.38311-2.6797-2.76621-4.4086-3.63065-1.9882-1.03733-4.1493-.778-6.3104-.778-3.2849 0-11.4971 0-16.33798 0l3.28488 4.40865h19.6228c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.5186.0864.6051 0z" fill="#53b1fd"/><path d="m39.9368 18.511c-.4322-.4322-.8645-.8645-1.2967-1.2967-1.2967-1.3831-2.6797-2.7662-4.4086-3.6306-1.9882-1.0374-4.1494-.778-6.3105-.778-2.8526 0-9.6817 0-14.5226 0l3.2849 4.4086h17.8939c1.8154 0 3.3714.3458 4.8409 1.2967.1729.0864.3458.0864.5187 0z" fill="#2e90fa"/><path d="m44 25.4263c-.4322-.4323-.8645-.8645-1.2967-1.2967-1.2966-1.3831-2.6797-2.7662-4.4086-3.6307-1.9882-1.0373-4.1493-.7779-6.3104-.7779-2.6798 0-8.558 0-13.3124 0l3.2848 4.4086h16.5973c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.4322.1729.6051 0z" fill="#1570ef"/><path d="m7.60742 37.0961c.43222.4322.86444.8644 1.29666 1.2966 1.29662 1.3831 2.67972 2.7662 4.40862 3.6307 1.9882 1.0373 4.1493.778 6.3104.778h16.338l-3.2849-4.4087c-5.9646 0-15.3006 0-19.6228 0-1.8153 0-3.37132-.3457-4.84087-1.2966-.25933-.0865-.43222-.0865-.60511 0z" fill="#53b1fd"/><path d="m3.97656 30.0079c.43222.4323.86444.8645 1.29666 1.2967 1.29667 1.3831 2.67976 2.7662 4.40864 3.6307 1.98824 1.0373 4.14934.778 6.31044.778h14.5226l-3.2849-4.4087c-5.8782 0-13.9175 0-17.89391 0-1.81532 0-3.37132-.3458-4.84087-1.2967-.17289-.0864-.34577-.0864-.51866 0z" fill="#2e90fa"/><path d="m0 23.0058c.43222.4322.864441.8644 1.29666 1.2966 1.29666 1.3831 2.67977 2.7662 4.40866 3.6307 1.98821 1.0373 4.1493.778 6.31038.778h13.3124l-3.2849-4.4087c-5.7053 0-12.96657 0-16.59722 0-1.81533 0-3.37132-.3458-4.840874-1.2966-.259332-.0865-.432218-.0865-.605106 0z" fill="#1570ef"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m36.3068 11.4224c-.4322-.4323-.8644-.8645-1.2967-1.2967-1.2966-1.38311-2.6797-2.76621-4.4086-3.63065-1.9882-1.03733-4.1493-.778-6.3104-.778-3.2849 0-11.4971 0-16.33798 0l3.28488 4.40865h19.6228c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.5186.0864.6051 0z" opacity=".5"/><path d="m39.9368 18.511c-.4322-.4322-.8645-.8645-1.2967-1.2967-1.2967-1.3831-2.6797-2.7662-4.4086-3.6306-1.9882-1.0374-4.1494-.778-6.3105-.778-2.8526 0-9.6817 0-14.5226 0l3.2849 4.4086h17.8939c1.8154 0 3.3714.3458 4.8409 1.2967.1729.0864.3458.0864.5187 0z" opacity=".7"/><path d="m44 25.4263c-.4322-.4323-.8645-.8645-1.2967-1.2967-1.2966-1.3831-2.6797-2.7662-4.4086-3.6307-1.9882-1.0373-4.1493-.7779-6.3104-.7779-2.6798 0-8.558 0-13.3124 0l3.2848 4.4086h16.5973c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.4322.1729.6051 0z"/><path d="m7.60742 37.0961c.43222.4322.86444.8644 1.29666 1.2966 1.29662 1.3832 2.67972 2.7662 4.40862 3.6307 1.9882 1.0373 4.1493.778 6.3104.778h16.338l-3.2849-4.4087c-5.9646 0-15.3006 0-19.6228 0-1.8153 0-3.37132-.3457-4.84087-1.2966-.25933-.0865-.43222-.0865-.60511 0z" opacity=".5"/><path d="m3.97656 30.0079c.43222.4323.86444.8645 1.29666 1.2967 1.29667 1.3831 2.67976 2.7662 4.40864 3.6307 1.98824 1.0373 4.14934.778 6.31044.778h14.5226l-3.2849-4.4087c-5.8782 0-13.9175 0-17.89391 0-1.81532 0-3.37132-.3458-4.84087-1.2967-.17289-.0864-.34577-.0864-.51866 0z" opacity=".7"/><path d="m0 23.0058c.43222.4322.864441.8644 1.29666 1.2966 1.29666 1.3831 2.67977 2.7662 4.40866 3.6307 1.98821 1.0373 4.1493.778 6.31038.778h13.3124l-3.2849-4.4087c-5.7053 0-12.96657 0-16.59722 0-1.81533 0-3.37132-.3458-4.840874-1.2966-.259332-.0865-.432218-.0865-.605106 0z"/></g></svg>`
      },
      {
        id: "flora-fauna",
        name: "Flora&Fauna",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m13.7146 4c-2.2564 0-4.4203.89634-6.01579 2.49183l-7.69881 7.69877v3.524c0 2.4897 1.06944 4.7296 2.77401 6.2854-1.70457 1.5558-2.77401 3.7957-2.77401 6.2854v3.524l7.69881 7.6988c1.59549 1.5955 3.75939 2.4918 6.01579 2.4918 2.4897 0 4.7296-1.0694 6.2854-2.774 1.5558 1.7046 3.7957 2.774 6.2854 2.774 2.2564 0 4.4203-.8963 6.0158-2.4918l7.6988-7.6988v-3.524c0-2.4897-1.0694-4.7296-2.774-6.2854 1.7046-1.5558 2.774-3.7957 2.774-6.2854v-3.524l-7.6988-7.69877c-1.5955-1.59549-3.7594-2.49183-6.0158-2.49183-2.4897 0-4.7296 1.06944-6.2854 2.77401-1.5558-1.70457-3.7957-2.77401-6.2854-2.77401zm12.0442 20c-.0959-.0875-.19-.1774-.2822-.2696l-5.4766-5.4766-5.4766 5.4766c-.0922.0922-.1863.1821-.2822.2696.0959.0875.19.1774.2822.2696l5.4766 5.4766 5.4766-5.4766c.0922-.0922.1863-.1821.2822-.2696zm-3.5366 9.8094v1.683c0 2.244 1.8192 4.0632 4.0632 4.0632 1.0776 0 2.1111-.4281 2.8731-1.1901l6.3971-6.3971v-1.683c0-2.244-1.8192-4.0632-4.0632-4.0632-1.0776 0-2.1111.4281-2.8731 1.1901zm-4.4444 0-6.3971-6.3971c-.762-.762-1.79546-1.1901-2.87308-1.1901-2.24403 0-4.06318 1.8192-4.06318 4.0632v1.683l6.39706 6.3971c.762.762 1.7955 1.1901 2.8731 1.1901 2.244 0 4.0632-1.8192 4.0632-4.0632zm0-21.3018v1.683l-6.3971 6.3971c-.762.762-1.79546 1.1901-2.87308 1.1901-2.24403 0-4.06318-1.8192-4.06318-4.0632v-1.683l6.39706-6.39708c.762-.76199 1.7955-1.19007 2.8731-1.19007 2.244 0 4.0632 1.81915 4.0632 4.06315zm10.8415 8.0801-6.3971-6.3971v-1.683c0-2.244 1.8192-4.06315 4.0632-4.06315 1.0776 0 2.1111.42808 2.8731 1.19007l6.3971 6.39708v1.683c0 2.244-1.8192 4.0632-4.0632 4.0632-1.0776 0-2.1111-.4281-2.8731-1.1901z" fill="#155eef" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m13.7146 4c-2.2564 0-4.4203.89634-6.01579 2.49183l-7.69881 7.69877v3.524c0 2.4897 1.06944 4.7296 2.77401 6.2854-1.70457 1.5558-2.77401 3.7957-2.77401 6.2854v3.524l7.69881 7.6988c1.59549 1.5955 3.75939 2.4918 6.01579 2.4918 2.4897 0 4.7296-1.0694 6.2854-2.774 1.5558 1.7046 3.7957 2.774 6.2854 2.774 2.2564 0 4.4203-.8963 6.0158-2.4918l7.6988-7.6988v-3.524c0-2.4897-1.0694-4.7296-2.774-6.2854 1.7046-1.5558 2.774-3.7957 2.774-6.2854v-3.524l-7.6988-7.69877c-1.5955-1.59549-3.7594-2.49183-6.0158-2.49183-2.4897 0-4.7296 1.06944-6.2854 2.77401-1.5558-1.70457-3.7957-2.77401-6.2854-2.77401zm12.0442 20c-.0959-.0875-.19-.1774-.2822-.2696l-5.4766-5.4766-5.4766 5.4766c-.0922.0922-.1863.1821-.2822.2696.0959.0875.19.1774.2822.2696l5.4766 5.4766 5.4766-5.4766c.0922-.0922.1863-.1821.2822-.2696zm-3.5366 9.8094v1.683c0 2.244 1.8192 4.0632 4.0632 4.0632 1.0776 0 2.1111-.4281 2.8731-1.1901l6.3971-6.3971v-1.683c0-2.244-1.8192-4.0632-4.0632-4.0632-1.0776 0-2.1111.4281-2.8731 1.1901zm-4.4444 0-6.3971-6.3971c-.762-.762-1.79546-1.1901-2.87308-1.1901-2.24403 0-4.06318 1.8192-4.06318 4.0632v1.683l6.39706 6.3971c.762.762 1.7955 1.1901 2.8731 1.1901 2.244 0 4.0632-1.8192 4.0632-4.0632zm0-21.3018v1.683l-6.3971 6.3971c-.762.762-1.79546 1.1901-2.87308 1.1901-2.24403 0-4.06318-1.8192-4.06318-4.0632v-1.683l6.39706-6.39708c.762-.76199 1.7955-1.19007 2.8731-1.19007 2.244 0 4.0632 1.81915 4.0632 4.06315zm10.8415 8.0801-6.3971-6.3971v-1.683c0-2.244 1.8192-4.06315 4.0632-4.06315 1.0776 0 2.1111.42808 2.8731 1.19007l6.3971 6.39708v1.683c0 2.244-1.8192 4.0632-4.0632 4.0632-1.0776 0-2.1111-.4281-2.8731-1.1901z" fill="#fff" fill-rule="evenodd"/></svg>`
      },
      {
        id: "focal-point",
        name: "FocalPoint",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m10.7788 6.1817 4.6901 17.5036v-19.24382c.3719-.08679.7478-.16322 1.1273-.22897v19.47459l5.2752-19.6871c.3801.03442.7572.07945 1.1309.13479l-5.3176 19.84571 10.5701-18.30794c.3443.15492.6835.31927 1.0172.49274l-10.6095 18.3763 15.1464-15.1465c.2731.25824.5389.52407.7971.7972l-15.1486 15.1487 18.3784-10.6108c.1734.3337.3377.6729.4926 1.0173l-18.3034 10.5675 19.8403-5.3162c.0553.3737.1003.7508.1347 1.1309l-19.6869 5.2751h19.4741c-.0658.3796-.1422.7554-.229 1.1273h-19.2481l17.507 4.691c-.1798.3443-.3693.6827-.5681 1.0149l-17.2257-4.6156 14.3874 8.3066c-.2723.2801-.5528.5522-.8411.8161l-14.1087-8.1457 10.6759 10.6758c-.3377.1973-.6817.385-1.0316.5628l-10.4426-10.4426 6.8421 11.8508c-.3746.1059-.7537.2012-1.1368.2855l-6.6825-11.5744 3.2219 12.0243c-.2872.0122-.5759.0184-.8661.0184-.0991 0-.198-.0007-.2967-.0022l-3.1483-11.7497v11.4569c-.3795-.0657-.7554-.1421-1.1273-.2289v-11.2261l-2.7759 10.36c-.3541-.1396-.7033-.289-1.0471-.4478l2.7337-10.2024-5.13175 8.8884c-.3177-.2034-.62928-.4156-.9344-.6361l5.09135-8.8186-7.1301 7.1302c-.2731-.2583-.53893-.5241-.79717-.7971l7.12787-7.1279-8.81599 5.0899c-.22059-.3051-.4328-.6167-.6363-.9344l8.89259-5.1341-10.20737 2.735c-.15888-.3438-.3083-.693-.44793-1.047l10.3599-2.776h-11.226124c-.086806-.3719-.163256-.7477-.22903-1.1273h11.452154l-11.74511583-3.1471c-.00145443-.0995-.00218417-.1991-.00218417-.2989 0-.2894.00613487-.5774.0182816-.8639l12.0258184 3.2224-11.57621-6.6836c.084291-.3832.179549-.7623.285427-1.1369l11.855683 6.8449-10.44698-10.447c.17774-.3499.36544-.6939.56273-1.0315l10.68025 10.6802-8.14896-14.1144c.26387-.2882.53605-.56863.81617-.84096l8.30809 14.38996-4.61634-17.22828c.33214-.1988.67064-.38826 1.01484-.56802z" fill="#155eef"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m10.7788 6.1817 4.6901 17.5036v-19.24382c.3719-.08679.7478-.16322 1.1273-.22897v19.47459l5.2752-19.6871c.3801.03442.7572.07945 1.1309.13479l-5.3176 19.84571 10.5701-18.30794c.3443.15492.6835.31927 1.0172.49274l-10.6095 18.3763 15.1464-15.1465c.2731.25824.5389.52407.7971.7972l-15.1486 15.1487 18.3784-10.6108c.1734.3337.3377.6729.4926 1.0173l-18.3034 10.5675 19.8403-5.3162c.0553.3737.1003.7508.1347 1.1309l-19.6869 5.2751h19.4741c-.0658.3796-.1422.7554-.229 1.1273h-19.2481l17.507 4.691c-.1798.3443-.3693.6827-.5681 1.0149l-17.2257-4.6156 14.3874 8.3066c-.2723.2801-.5528.5522-.8411.8161l-14.1087-8.1457 10.6759 10.6758c-.3377.1973-.6817.385-1.0316.5628l-10.4426-10.4426 6.8421 11.8508c-.3746.1059-.7537.2012-1.1368.2855l-6.6825-11.5744 3.2219 12.0243c-.2872.0122-.5759.0184-.8661.0184-.0991 0-.198-.0007-.2967-.0022l-3.1483-11.7497v11.4569c-.3795-.0657-.7554-.1421-1.1273-.2289v-11.2261l-2.7759 10.36c-.3541-.1396-.7033-.289-1.0471-.4478l2.7337-10.2024-5.13174 8.8884c-.31771-.2034-.62929-.4156-.93441-.6361l5.09135-8.8186-7.1301 7.1302c-.2731-.2583-.53893-.5241-.79717-.7971l7.12787-7.1279-8.81599 5.0899c-.22059-.3051-.4328-.6167-.6363-.9344l8.89259-5.1341-10.20737 2.735c-.15888-.3438-.3083-.693-.44793-1.047l10.3599-2.776h-11.226124c-.086806-.3719-.163256-.7477-.22903-1.1273h11.452154l-11.74511583-3.1471c-.00145443-.0995-.00218417-.1991-.00218417-.2989 0-.2894.00613486-.5774.0182816-.8639l12.0258184 3.2224-11.57621-6.6836c.084291-.3832.179549-.7623.285427-1.1369l11.855683 6.8449-10.44698-10.447c.17774-.3499.36544-.6939.56273-1.0315l10.68025 10.6802-8.14896-14.1144c.26387-.2882.53605-.56863.81617-.84096l8.30809 14.38996-4.61634-17.22828c.33214-.1988.67064-.38826 1.01484-.56802z" fill="#fff"/></svg>`
      },
      {
        id: "foresight",
        name: "Foresight",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 31 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#444ce7"><path d="m-.00195312 17.8433 30.90545312-17.8433-.8189 12.6994-26.32058 15.1961z"/><path d="m3.76367 27.8951 21.73573-12.5492-.8189 12.6994-17.15086 9.902z" opacity=".5"/><path d="m7.52734 37.9477 12.56596-7.255-.8189 12.6994-7.9811 4.6079z" opacity=".25"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 31 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m-.00195312 17.8433 30.90545312-17.8433-.8189 12.6994-26.32058 15.1961z"/><path d="m3.76367 27.8951 21.73573-12.5492-.8189 12.6994-17.15086 9.902z" opacity=".5"/><path d="m7.52734 37.9477 12.56596-7.255-.8189 12.6994-7.9811 4.6079z" opacity=".25"/></g></svg>`
      },
      {
        id: "galileo",
        name: "Galileo",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m29.5411 6.41772c2.6913 5.27688 4.209 11.25228 4.209 17.58218s-1.5177 12.3054-4.2091 17.5823c6.2304-3.3881 10.4593-9.9914 10.4593-17.5823s-4.2289-14.19404-10.4592-17.58218z" fill="#6172f3"/><path d="m20.5481 5.99826c-.9047-1.28153-2.4457-1.9717-3.9913-1.70349-9.40496 1.63214-16.5568 9.83343-16.5568 19.70503 0 9.8717 7.1518 18.0729 16.5567 19.7051 1.5456.2682 3.0867-.4219 3.9913-1.7035 3.5923-5.0889 5.7025-11.2988 5.7025-18.0016 0-6.7027-2.1101-12.9126-5.7024-18.00154z" fill="#444ce7"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m29.5411 6.41772c2.6913 5.27688 4.209 11.25228 4.209 17.58218s-1.5177 12.3054-4.2091 17.5823c6.2304-3.3881 10.4593-9.9914 10.4593-17.5823s-4.2289-14.19404-10.4592-17.58218z" opacity=".7"/><path d="m20.5481 5.99826c-.9047-1.28153-2.4457-1.9717-3.9913-1.70349-9.40496 1.63214-16.5568 9.83343-16.5568 19.70503 0 9.8717 7.1518 18.0729 16.5567 19.7051 1.5456.2682 3.0867-.4219 3.9913-1.7035 3.5923-5.0889 5.7025-11.2988 5.7025-18.0016 0-6.7027-2.1101-12.9126-5.7024-18.00154z"/></g></svg>`
      },
      {
        id: "global-bank",
        name: "GlobalBank",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m27.6627 4h-15.3253l-12.3374 12.3373v15.3253l12.3374 12.3374h15.3253l12.3373-12.3374v-15.3253zm-13.2049 27.8554-7.90357-7.9036 7.90357-7.9036c2.988-2.988 7.9037-2.988 10.8916 0l7.9036 7.9036-7.9036 7.9036c-2.9879 2.988-7.8072 2.988-10.8916 0z" fill="#444ce7"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m27.6627 4h-15.3253l-12.3374 12.3373v15.3253l12.3374 12.3374h15.3253l12.3373-12.3374v-15.3253zm-13.2049 27.8554-7.90357-7.9036 7.90357-7.9036c2.988-2.988 7.9037-2.988 10.8916 0l7.9036 7.9036-7.9036 7.9036c-2.9879 2.988-7.8072 2.988-10.8916 0z" fill="#fff"/></svg>`
      },
      {
        id: "hexsmith",
        name: "Hexsmith",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m9.72461 41.7983h18.49589c1.2717 0 2.4469-.6785 3.0827-1.7798l4.1102-7.1191h-20.5481z" opacity=".7"/><path d="m25.1445 15.1015h-20.55661l4.11021-7.11909c.63585-1.10133 1.811-1.77977 3.0827-1.77977h18.4959z" opacity=".4"/><path d="m39.5272 25.7801c.6358-1.1014.6358-2.4582 0-3.5596l-4.1102-7.1191-5.1378 8.8989h-20.55068l5.13718 8.8989h20.5481l.0016-.0027.0016.0027z" opacity=".4"/><path d="m14.8634 32.8992-5.13775-8.8988-5.13776 8.8988 5.13776 8.8989z"/><path d="m25.1445 15.1014h-20.55593l-4.108166 7.1192c-.635516 1.1013-.635318 2.458.000521 3.5591l4.111125 7.1195 5.13775-8.8989h20.55l.0013-.0021z" opacity=".7"/><path d="m35.4181 15.1015-5.1378-8.89886-5.1377 8.89886 5.1377 8.8989z"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m9.72461 41.7983h18.49589c1.2717 0 2.4469-.6785 3.0827-1.7798l4.1102-7.1191h-20.5481z" opacity=".7"/><path d="m25.1445 15.1015h-20.55661l4.11021-7.11909c.63585-1.10133 1.811-1.77977 3.0827-1.77977h18.4959z" opacity=".4"/><path d="m39.5272 25.7801c.6358-1.1013.6358-2.4582 0-3.5596l-4.1102-7.1191-5.1378 8.8989h-20.55068l5.13718 8.8989h20.5481l.0016-.0027.0016.0027z" opacity=".4"/><path d="m14.8634 32.8992-5.13775-8.8988-5.13776 8.8988 5.13776 8.8989z"/><path d="m25.1445 15.1014h-20.55593l-4.108166 7.1192c-.635516 1.1013-.635318 2.458.000521 3.5591l4.111125 7.1195 5.13775-8.8989h20.55l.0013-.0022z" opacity=".7"/><path d="m35.4181 15.1015-5.1378-8.89886-5.1377 8.89886 5.1377 8.8989z"/></g></svg>`
      },
      {
        id: "hourglass",
        name: "Hourglass",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 30 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 41.2222c0 1.5341 1.24365 2.7778 2.77778 2.7778h24.44442c1.5341 0 2.7778-1.2437 2.7778-2.7778v-7.2222c0-8.2843-6.7157-15-15-15-8.28427 0-15 6.7157-15 15z" fill="#1570ef"/><path d="m0 6.77778c0-1.53413 1.24365-2.77778 2.77778-2.77778h24.44442c1.5341 0 2.7778 1.24365 2.7778 2.77778v7.22222c0 8.2843-6.7157 15-15 15-8.28427 0-15-6.7157-15-15z" fill="#53b1fd" opacity=".5"/></svg>`,
        darkSvg: `<svg width="100%" height="100%" viewBox="0 0 30 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.7" d="M0 41.2222C0 42.7563 1.24365 44 2.77778 44H27.2222C28.7563 44 30 42.7563 30 41.2222V34C30 25.7157 23.2843 19 15 19C6.71573 19 0 25.7157 0 34V41.2222Z" fill="white"/><path opacity="0.7" d="M0 6.77778C0 5.24365 1.24365 4 2.77778 4H27.2222C28.7563 4 30 5.24365 30 6.77778V14C30 22.2843 23.2843 29 15 29C6.71573 29 0 22.2843 0 14V6.77778Z" fill="white"/></svg>`
      },
      {
        id: "kintsugi",
        name: "Kintsugi",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m20 4 4.2861 9.6525 9.856-3.79464-3.7946 9.85604 9.6525 4.2861-9.6525 4.2861 3.7946 9.856-9.856-3.7946-4.2861 9.6525-4.2861-9.6525-9.85604 3.7946 3.79469-9.856-9.65255-4.2861 9.65255-4.2861-3.79469-9.85604 9.85604 3.79464z" fill="#155eef"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m20 4 4.2861 9.6525 9.856-3.79464-3.7946 9.85604 9.6525 4.2861-9.6525 4.2861 3.7946 9.856-9.856-3.7946-4.2861 9.6525-4.2861-9.6525-9.85604 3.7946 3.79469-9.856-9.65255-4.2861 9.65255-4.2861-3.79469-9.85604 9.85604 3.79464z" fill="#155eef"/></svg>`
      },
      {
        id: "layers",
        name: "Layers",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m5.03741 15.4637c.7506-2.8008 3.62961-5.67985 6.43049-6.43044l17.4617-4.67957c2.8009-.7506 4.4629.91146 3.7123 3.71231l-4.6795 17.4617c-.7506 2.8009-3.6297 5.6799-6.4305 6.4305l-17.46175 4.6796c-2.80085.7505-4.462904-.9115-3.712306-3.7124z" opacity=".7"/><path d="m12.0355 22.4642c.7506-2.8008 3.6296-5.6799 6.4304-6.4305l17.4617-4.6795c2.8009-.7506 4.4629.9114 3.7123 3.7123l-4.6795 17.4617c-.7506 2.8009-3.6296 5.6799-6.4305 6.4305l-17.4617 4.6795c-2.80085.7506-4.46291-.9114-3.71231-3.7123z" opacity=".7"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m5.03741 15.4637c.7506-2.8008 3.62961-5.67985 6.43049-6.43044l17.4617-4.67957c2.8009-.7506 4.4629.91146 3.7123 3.71231l-4.6795 17.4617c-.7506 2.8009-3.6297 5.6799-6.4305 6.4305l-17.46175 4.6795c-2.80085.7506-4.462904-.9114-3.712306-3.7123z" opacity=".7"/><path d="m12.0355 22.4642c.7506-2.8008 3.6296-5.6799 6.4304-6.4305l17.4617-4.6795c2.8009-.7506 4.4629.9114 3.7123 3.7123l-4.6795 17.4617c-.7506 2.8009-3.6296 5.6799-6.4305 6.4305l-17.4617 4.6795c-2.80085.7506-4.46291-.9114-3.71231-3.7123z" opacity=".7"/></g></svg>`
      },
      {
        id: "lightspeed",
        name: "Lightspeed",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 24c0 6.6274 5.37258 12 12 12v-12c0 6.6274 5.3726 12 12 12v-12c0 6.6274 5.3726 12 12 12s12-5.3726 12-12-5.3726-12-12-12-12 5.3726-12 12v-12c-6.6274 0-12 5.3726-12 12v-12c-6.62742 0-12 5.3726-12 12z" fill="#155eef"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 24c0 6.6274 5.37258 12 12 12v-12c0 6.6274 5.3726 12 12 12v-12c0 6.6274 5.3726 12 12 12s12-5.3726 12-12-5.3726-12-12-12-12 5.3726-12 12v-12c-6.6274 0-12 5.3726-12 12v-12c-6.62742 0-12 5.3726-12 12z" fill="#155eef"/></svg>`
      },
      {
        id: "luminescence",
        name: "Luminescence",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m32.3008 36h-.1015c-.0261.0402-.0523.0804-.0787.1204-2.7604 1.8201-6.0668 2.8794-9.6206 2.8794-9.665 0-17.5-7.835-17.5-17.5 0-3.5538 1.05931-6.8602 2.87939-9.6206.04009-.0264.08029-.0527.12061-.0788v-.1017c-.04056.0599-.08077.1201-.12061.1805-4.7469 3.1299-7.87939 8.5094-7.87939 14.6206 0 9.665 7.83502 17.5 17.5 17.5 6.1112 0 11.4907-3.1325 14.6206-7.8794.0603-.0398.1204-.0799.1802-.1204z"/><g opacity=".5"><path d="m40.0003 21.5c0 6.1112-3.1325 11.4907-7.8794 14.6206 1.8201-2.7604 2.8794-6.0668 2.8794-9.6206 0-9.665-7.835-17.5-17.5-17.5-3.5538 0-6.8602 1.0593-9.6206 2.8794 3.1299-4.74691 8.5094-7.8794 14.6206-7.8794 9.665 0 17.5 7.835 17.5 17.5z"/><path d="m32.0003 36.1994c.0403-.0261.0805-.0524.1206-.0788-.0398.0604-.08.1206-.1206.1805z"/><path d="m7.80088 12c.02611-.0403.05238-.0805.07882-.1206-.06043.0398-.12059.08-.18048.1206z"/></g></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m32.3008 36h-.1015c-.0261.0402-.0523.0804-.0787.1204-2.7604 1.8201-6.0668 2.8794-9.6206 2.8794-9.665 0-17.5-7.835-17.5-17.5 0-3.5538 1.05931-6.8602 2.87939-9.6206.04009-.0264.08029-.0527.12061-.0788v-.1017c-.04056.0599-.08077.1201-.12061.1805-4.7469 3.1299-7.87939 8.5094-7.87939 14.6206 0 9.665 7.83502 17.5 17.5 17.5 6.1112 0 11.4907-3.1325 14.6206-7.8794.0603-.0398.1204-.0799.1802-.1204z"/><g opacity=".5"><path d="m40.0003 21.5c0 6.1112-3.1325 11.4907-7.8794 14.6206 1.8201-2.7604 2.8794-6.0668 2.8794-9.6206 0-9.665-7.835-17.5-17.5-17.5-3.5538 0-6.8602 1.0593-9.6206 2.8794 3.1299-4.74691 8.5094-7.8794 14.6206-7.8794 9.665 0 17.5 7.835 17.5 17.5z"/><path d="m32.0003 36.1994c.0403-.0261.0805-.0524.1206-.0788-.0398.0604-.08.1206-.1206.1805z"/><path d="m7.80088 12c.02611-.0403.05238-.0805.07882-.1206-.06043.0398-.12059.08-.18048.1206z"/></g></g></svg>`
      },
      {
        id: "luminous",
        name: "Luminous",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m14.1061 19.6565c5.499-2.6299 9.8025-7.0929 12.2731-12.67168-1.5939-1.67362-3.666-2.86907-5.8975-3.58634l-1.1954-.39848c-.0797.15939-.1594.39849-.1594.55788-1.9127 5.41936-5.8178 9.80262-11.07766 12.27322-3.66599 1.7533-6.37564 4.9412-7.650763 8.7666l-.398477 1.1955c.159391.0797.39848.1593.557871.1593 1.514209.5579 3.028419 1.2752 4.462939 2.1519 1.99238-3.5864 5.18019-6.6148 9.08529-8.4479z"/><path d="m37.2173 19.9753c-2.9487 4.463-7.0132 8.0494-12.034 10.4403-4.0645 1.9127-7.1726 5.499-8.6071 9.8026l-.3985 1.3549c1.5142 1.3548 3.3472 2.3909 5.3396 3.0284l1.1955.3985c.0796-.1594.1593-.3985.1593-.5579 1.9127-5.4193 5.8178-9.8026 11.0777-12.2732 3.666-1.7533 6.4553-4.9412 7.6507-8.7666l.3985-1.1954c-1.6736-.4782-3.2675-1.2752-4.7817-2.2316z" opacity=".6"/><path d="m12.9903 37.4284c1.9924-4.7818 5.6584-8.6869 10.3604-10.9184 4.3035-2.0721 7.8898-5.26 10.3604-9.1651-1.833-1.7533-3.3472-3.7458-4.463-6.1366-2.9487 5.4193-7.571 9.8026-13.2294 12.5123-3.2675 1.5142-5.8974 4.1442-7.49136 7.3321 1.75326 1.6736 3.18786 3.7457 4.30356 6.0569 0 0 .0797.1594.1594.3188z" opacity=".8"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m14.1061 19.6565c5.499-2.6299 9.8025-7.0929 12.2731-12.67168-1.5939-1.67362-3.666-2.86907-5.8975-3.58634l-1.1954-.39848c-.0797.15939-.1594.39849-.1594.55788-1.9127 5.41936-5.8178 9.80262-11.07766 12.27322-3.66599 1.7533-6.37564 4.9412-7.650763 8.7666l-.398477 1.1955c.159391.0797.39848.1593.557871.1593 1.514209.5579 3.028419 1.2752 4.462939 2.1519 1.99238-3.5864 5.18019-6.6148 9.08529-8.4479z"/><path d="m37.2173 19.9753c-2.9487 4.463-7.0132 8.0494-12.034 10.4403-4.0645 1.9127-7.1726 5.499-8.6071 9.8026l-.3985 1.3549c1.5142 1.3548 3.3472 2.3909 5.3396 3.0284l1.1955.3985c.0796-.1594.1593-.3985.1593-.5579 1.9127-5.4193 5.8178-9.8026 11.0777-12.2732 3.666-1.7533 6.4553-4.9412 7.6507-8.7666l.3985-1.1954c-1.6736-.4782-3.2675-1.2752-4.7817-2.2316z" opacity=".5"/><path d="m12.9903 37.4284c1.9924-4.7818 5.6584-8.6869 10.3604-10.9184 4.3035-2.0721 7.8898-5.26 10.3604-9.1651-1.833-1.7533-3.3472-3.7458-4.463-6.1366-2.9487 5.4193-7.571 9.8026-13.2294 12.5123-3.2675 1.5142-5.8974 4.1442-7.49136 7.3321 1.75326 1.6736 3.18786 3.7457 4.30356 6.0569 0 0 .0797.1594.1594.3188z" opacity=".7"/></g></svg>`
      },
      {
        id: "pollinate",
        name: "Pollinate",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m25.0008 24c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m25.0008 10c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6c0-3.31371 2.6863-6 6-6s6 2.68629 6 6z"/><path d="m37.125 31c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m37.127 17.0002c0 3.3137-2.6863 6-6 6-3.3138 0-6-2.6863-6-6s2.6862-6 6-6c3.3137 0 6 2.6863 6 6z"/><path d="m25.0008 38c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m12.877 17c0 3.3137-2.6863 6-6.00005 6-3.31371 0-5.999997-2.6863-5.999997-6s2.686287-6 5.999997-6c3.31375 0 6.00005 2.6863 6.00005 6z"/><path d="m12.875 30.9997c0 3.3137-2.6863 6-6 6-3.31371 0-6-2.6863-6-6s2.68629-6 6-6c3.3137 0 6 2.6863 6 6z"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m25.0008 24c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m25.0008 10c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6c0-3.31371 2.6863-6 6-6s6 2.68629 6 6z"/><path d="m37.125 31c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m37.127 17.0002c0 3.3137-2.6863 6-6 6-3.3138 0-6-2.6863-6-6s2.6862-6 6-6c3.3137 0 6 2.6863 6 6z"/><path d="m25.0008 38c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m12.877 17c0 3.3137-2.6863 6-6.00005 6-3.31371 0-5.999997-2.6863-5.999997-6s2.686287-6 5.999997-6c3.31375 0 6.00005 2.6863 6.00005 6z"/><path d="m12.875 30.9997c0 3.3137-2.6863 6-6 6-3.31371 0-6-2.6863-6-6s2.68629-6 6-6c3.3137 0 6 2.6863 6 6z"/></g></svg>`
      },
      {
        id: "polymath",
        name: "Polymath",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="19" cy="24" r="16" stroke="#155eef" stroke-width="6"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="19" cy="24" r="16" stroke="#fff" stroke-width="6"/></svg>`
      },
      {
        id: "prometheus",
        name: "Prometheus",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m10.4993 16.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h19c2.2091 0 4-1.7909 4-4v-3h-22.5c-3.0376 0-5.5 2.46243-5.5 5.5 0 3.0376-2.4631 5.5-5.5007 5.5z"/><path d="m10.4993 26.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h13c2.2091 0 4-1.7909 4-4v-3h-16.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".7"/><path d="m10.4993 36.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h7.8c1.7673 0 3.2-1.4327 3.2-3.2v-3.8h-10.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".5"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m10.4993 16.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h19c2.2091 0 4-1.7909 4-4v-3h-22.5c-3.0376 0-5.5 2.46243-5.5 5.5 0 3.0376-2.4631 5.5-5.5007 5.5z"/><path d="m10.4993 26.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h13c2.2091 0 4-1.7909 4-4v-3h-16.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".75"/><path d="m10.4993 36.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h7.8c1.7673 0 3.2-1.4327 3.2-3.2v-3.8h-10.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".5"/></g></svg>`
      },
      {
        id: "quantum",
        name: "Quantum",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 39 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m9 23c0-5.5228 4.4772-10 10-10 5.5229 0 10 4.4772 10 10h9c0-10.4934-8.5066-19-19-19-10.49341 0-18.99999908 8.5066-19 19s8.50659 19 19 19v-9c-5.5228 0-10-4.4771-10-10z"/><path d="m29 23c0 5.5228 4.4772 10 10 10v9c-10.4934 0-19-8.5066-19-19z" opacity=".5"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 39 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m9 23c0-5.5228 4.4772-10 10-10 5.5229 0 10 4.4772 10 10h9c0-10.4934-8.5066-19-19-19-10.49341 0-18.99999908 8.5066-19 19s8.50659 19 19 19v-9c-5.5228 0-10-4.4771-10-10z"/><path d="m29 23c0 5.5228 4.4772 10 10 10v9c-10.4934 0-19-8.5066-19-19z" opacity=".5"/></g></svg>`
      },
      {
        id: "quartz-ai",
        name: "QuartzAI",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m17.6264 6.5h14.8017l11.4661 18.6661-15.7786 15.9489-22.68835-4.0459-5.157719-19.2098zm.5273 4.9692-6.816 15.105 6.4504 5.3411 8.8246-3.7975zm12.3276 15.3 9.2139-2.7073-7.1983-11.7184zm-.6163-17.2692h-9.3468l7.3309 14.4284zm6.9795 18.5263-6.779 1.9919-.5448 5.4109zm-10.5005 9.008.5824-5.7856-6.0573 2.6067zm-6.8394-.5022-10.91261-1.9459 1.64741-5.0264 6.438 5.3308zm-11.69782-9.1824-2.7037-3.0571 1.66868 6.215zm-3.53432-8.5248 4.81433 5.4437 5.50351-12.1963z" fill="#155eef" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m17.6264 6.5h14.8017l11.4661 18.6661-15.7786 15.9489-22.68835-4.0459-5.157719-19.2098zm.5273 4.9692-6.816 15.105 6.4504 5.3411 8.8246-3.7975zm12.3276 15.3 9.2139-2.7073-7.1983-11.7184zm-.6163-17.2692h-9.3468l7.3309 14.4284zm6.9795 18.5263-6.779 1.9919-.5448 5.4109zm-10.5005 9.008.5824-5.7856-6.0573 2.6067zm-6.8394-.5022-10.91261-1.9459 1.64741-5.0264 6.438 5.3308zm-11.69782-9.1824-2.7037-3.0571 1.66868 6.215zm-3.53432-8.5248 4.81433 5.4437 5.50351-12.1963z" fill="#fff" fill-rule="evenodd"/></svg>`
      },
      {
        id: "radius",
        name: "Radius",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#155eef" fill-rule="evenodd"><path d="m18.5 19v-15h3v15z"/><path d="m18.5 44v-15h3v15z"/><path d="m22.4754 19.404 10.6066-10.60664 2.1214 2.12134-8.4853 8.4853z"/><path d="m4.79776 37.0816 10.60664-10.6066 2.1213 2.1214-10.60662 10.6066z"/><path d="m26.7178 28.5963 8.4853 8.4852-2.1213 2.1214-10.6066-10.6066z"/><path d="m6.91885 8.79727 10.60665 10.60663-2.1214 2.1213-10.60657-10.6066z"/><path d="m18.5 22.5h21.5v3h-21.5z"/><path d="m.00000026 22.5h14.99999974v3h-15z"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#155eef" fill-rule="evenodd"><path d="m18.5 19v-15h3v15z"/><path d="m18.5 44v-15h3v15z"/><path d="m22.4754 19.404 10.6066-10.60664 2.1214 2.12134-8.4853 8.4853z"/><path d="m4.79776 37.0816 10.60664-10.6066 2.1213 2.1214-10.60662 10.6066z"/><path d="m26.7178 28.5963 8.4853 8.4852-2.1213 2.1214-10.6066-10.6066z"/><path d="m6.91885 8.79727 10.60665 10.60663-2.1214 2.1213-10.60657-10.6066z"/><path d="m18.5 22.5h21.5v3h-21.5z"/><path d="m.00000026 22.5h14.99999974v3h-15z"/></g></svg>`
      },
      {
        id: "railspeed",
        name: "Railspeed",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m0 7.5h28.8c2.5202 0 3.7804 0 4.743.49047.8467.43143 1.5351 1.11984 1.9665 1.96657.4905.96256.4905 2.22276.4905 4.74296v1.8h-28.8c-2.52024 0-3.78035 0-4.74296-.4905-.84673-.4314-1.535139-1.1198-1.966569-1.9665-.490471-.9626-.490471-2.2228-.490471-4.743z"/><path d="m0 28.5h28.8c2.5202 0 3.7804 0 4.743-.4905.8467-.4314 1.5351-1.1198 1.9665-1.9665.4905-.9626.4905-2.2228.4905-4.743v-1.8h-28.8c-2.52024 0-3.78035 0-4.74296.4905-.84673.4314-1.535139 1.1198-1.966569 1.9665-.490471.9626-.490471 2.2228-.490471 4.743z"/><path d="m14 31.5h14.8c2.5202 0 3.7804 0 4.743.4905.8467.4314 1.5351 1.1198 1.9665 1.9665.4905.9626.4905 2.2228.4905 4.743v1.8h-14.8c-2.5202 0-3.7804 0-4.743-.4905-.8467-.4314-1.5351-1.1198-1.9665-1.9665-.4905-.9626-.4905-2.2228-.4905-4.743z"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m0 7.5h28.8c2.5202 0 3.7804 0 4.743.49047.8467.43143 1.5351 1.11984 1.9665 1.96657.4905.96256.4905 2.22276.4905 4.74296v1.8h-28.8c-2.52024 0-3.78035 0-4.74296-.4905-.84673-.4314-1.535139-1.1198-1.966569-1.9665-.490471-.9626-.490471-2.2228-.490471-4.743z"/><path d="m0 28.5h28.8c2.5202 0 3.7804 0 4.743-.4905.8467-.4314 1.5351-1.1198 1.9665-1.9665.4905-.9626.4905-2.2228.4905-4.743v-1.8h-28.8c-2.52024 0-3.78035 0-4.74296.4905-.84673.4314-1.535139 1.1198-1.966569 1.9665-.490471.9626-.490471 2.2228-.490471 4.743z"/><path d="m14 31.5h14.8c2.5202 0 3.7804 0 4.743.4905.8467.4314 1.5351 1.1198 1.9665 1.9665.4905.9626.4905 2.2228.4905 4.743v1.8h-14.8c-2.5202 0-3.7804 0-4.743-.4905-.8467-.4314-1.5351-1.1198-1.9665-1.9665-.4905-.9626-.4905-2.2228-.4905-4.743z"/></g></svg>`
      },
      {
        id: "refractional",
        name: "Refractional",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m48 11h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#444ce7"/><path d="m46 19h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#155eef"/><path d="m44 27h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#8098f9"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m48 11h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/><path d="m46 19h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/><path d="m44 27h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/></g></svg>`
      },
      {
        id: "renaissance",
        name: "Renaissance",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 35 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.7018 5c1.841 0 3.4172 1.31967 3.7408 3.13199l.4648 2.60271c.3236 1.8123 1.8998 3.132 3.7408 3.132h3.1518c4.8969 0 8.8667 3.9697 8.8667 8.8666 0 2.9333-1.4244 5.5339-3.6191 7.1479.92.3126 1.6466.809 2.1799 1.461.549.7191.9411 1.7411 1.1764 3.028.0392.3406.0883.6718.1373 1.003s.098.6624.1372 1.003c.0408.3538.0709.6566.096.9083.0232.233.042.4223.0609.5679.0784 1.0598.1961 1.9303.3529 2.5738.1655.9048.4994 1.7867.9727 2.5738h-6.6982c-.3137-.6056-.5098-1.3248-.6666-2.1196-.1349-.6836-.2408-1.5352-.3676-2.5548-.0207-.1659-.0418-.3362-.0638-.5111l-.2353-1.7411c-.1961-1.3247-.4314-2.271-.6667-2.8766-.2745-.5677-.7058-.9841-1.2941-1.2112-.6274-.2271-1.5686-.3856-2.9019-.3856h-.3018c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.68517v10.1334h-6.33333v-27.8667zm13.6315 17.7333c0 1.3992-1.1342 2.5334-2.5333 2.5334h-3.1518c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.36847v-5.0667h5.68517c1.841 0 3.4172 1.3197 3.7408 3.132l.4647 2.6027c.3237 1.8123 1.8999 3.132 3.7409 3.132h2.8351c1.3991 0 2.5333 1.1342 2.5333 2.5333z" fill="#1849a9" fill-rule="evenodd"/></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 35 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.7018 5c1.841 0 3.4172 1.31967 3.7408 3.13199l.4648 2.60271c.3236 1.8123 1.8998 3.132 3.7408 3.132h3.1518c4.8969 0 8.8667 3.9697 8.8667 8.8666 0 2.9333-1.4244 5.5339-3.6191 7.1479.92.3126 1.6466.809 2.1799 1.461.549.7191.9411 1.7411 1.1764 3.028.0392.3406.0883.6718.1373 1.003s.098.6624.1372 1.003c.0408.3538.0709.6566.096.9083.0232.233.042.4223.0609.5679.0784 1.0598.1961 1.9303.3529 2.5738.1655.9048.4994 1.7867.9727 2.5738h-6.6982c-.3137-.6056-.5098-1.3247-.6666-2.1196-.1349-.6836-.2408-1.5352-.3676-2.5548-.0207-.1659-.0418-.3362-.0638-.5111l-.2353-1.7411c-.1961-1.3247-.4314-2.271-.6667-2.8766-.2745-.5677-.7058-.9841-1.2941-1.2112-.6274-.2271-1.5686-.3856-2.9019-.3856h-.3018c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.68517v10.1334h-6.33333v-27.8667zm13.6315 17.7333c0 1.3992-1.1342 2.5334-2.5333 2.5334h-3.1518c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.36847v-5.0667h5.68517c1.841 0 3.4172 1.3197 3.7408 3.132l.4647 2.6027c.3237 1.8123 1.8999 3.132 3.7409 3.132h2.8351c1.3991 0 2.5333 1.1342 2.5333 2.5333z" fill="#fff" fill-rule="evenodd"/></svg>`
      },
      {
        id: "sisyphus",
        name: "Sisyphus",
        lightSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m.599609 19.2002h9.59998v9.59999h-9.59998z"/><path d="m31.4004 28.7998h9.6v9.59999h-9.6z" transform="matrix(-1 0 -0 -1 62.8008 57.5996)"/><path d="m10.1992 19.2001 11.6-9.6v9.6l-11.6 9.6z" opacity=".2"/><path d="m21.7988 28.7999-11.6 9.6v-9.6l11.6-9.6z" opacity=".5"/><path d="m.599609 19.2 21.199991-19.2v9.59999l-11.6 9.60001z" opacity=".6"/><path d="m31.4004 28.8-21.2 19.2v-9.6l11.6-9.6z" opacity=".7"/></g></svg>`,
        darkSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m.599609 19.2002h9.59998v9.59999h-9.59998z"/><path d="m31.4004 28.7998h9.6v9.59999h-9.6z" transform="matrix(-1 0 -0 -1 62.8008 57.5996)"/><path d="m10.1992 19.2001 11.6-9.6v9.6l-11.6 9.6z" opacity=".2"/><path d="m21.7988 28.7999-11.6 9.6v-9.6l11.6-9.6z" opacity=".5"/><path d="m.599609 19.2 21.199991-19.2v9.59999l-11.6 9.60001z" opacity=".6"/><path d="m31.4004 28.8-21.2 19.2v-9.6l11.6-9.6z" opacity=".7"/></g></svg>`
      },
      {
        id: "solaris-energy",
        name: "Solaris Energy",
        lightSvg: `<svg width="100%" height="100%" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 4V16.3604C20 19.087 16.6569 20.3998 14.8016 18.4017L7 10M40 24H27.6396C24.913 24 23.6002 20.6569 25.5983 18.8016L34 11M20 44V31.6396C20 28.913 23.3431 27.6002 25.1984 29.5983L33 38M0 24L12.3604 24C15.087 24 16.3998 27.3431 14.4017 29.1984L6 37" stroke="#175CD3" stroke-width="4"/></svg>`,
        darkSvg: `<svg width="100%" height="100%" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 4V16.3604C20 19.087 16.6569 20.3998 14.8016 18.4017L7 10M40 24H27.6396C24.913 24 23.6002 20.6569 25.5983 18.8016L34 11M20 44V31.6396C20 28.913 23.3431 27.6002 25.1984 29.5983L33 38M0 24L12.3604 24C15.087 24 16.3998 27.3431 14.4017 29.1984L6 37" stroke="white" stroke-width="4"/></svg>`
      }
    ];
  }
});

// features/platform/store-settings/lib/store-logo.ts
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String((numeric % 360 + 360) % 360);
}
var DEFAULT_STORE_LOGO_ICON, DEFAULT_STORE_LOGO_COLOR;
var init_store_logo = __esm({
  "features/platform/store-settings/lib/store-logo.ts"() {
    "use strict";
    init_icon_registry();
    DEFAULT_STORE_LOGO_ICON = LOGO_ICONS.find((icon) => icon.id === "foresight").lightSvg;
    DEFAULT_STORE_LOGO_COLOR = "330";
  }
});

// features/keystone/models/Carrier.ts
var import_core13, import_fields20, ownCarrierFilter, Carrier;
var init_Carrier = __esm({
  "features/keystone/models/Carrier.ts"() {
    "use strict";
    init_lifecycle();
    import_core13 = require("@keystone-6/core");
    import_fields20 = require("@keystone-6/core/fields");
    init_access();
    init_currency_policy();
    init_storeLogo();
    init_store_logo();
    init_trackingFields();
    ownCarrierFilter = (args) => freshCarrierFilter(args, "");
    Carrier = (0, import_core13.list)({
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
            { label: "Navy", value: "navy" },
            { label: "Slate", value: "slate" },
            { label: "Blue", value: "blue" },
            { label: "Rose", value: "rose" },
            { label: "Emerald", value: "emerald" },
            { label: "Amber", value: "amber" }
          ],
          db: { isNullable: true },
          ui: { description: "Allowlisted public storefront accent color" }
        }),
        logoIcon: (0, import_fields20.text)({
          defaultValue: DEFAULT_STORE_LOGO_ICON,
          hooks: {
            resolveInput: ({ resolvedData, fieldKey }) => {
              const value = resolvedData[fieldKey];
              if (value === void 0 || value === null || value === "") return value;
              return typeof value === "string" ? sanitizeStoreLogoSvg(value) : "";
            },
            validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
              const submitted = inputData?.[fieldKey];
              if (typeof submitted === "string" && submitted.trim() && !resolvedData?.[fieldKey]) {
                addValidationError("Logo must be a valid, safe SVG document");
              }
            }
          },
          ui: { description: "Public storefront logo icon (sanitized SVG)" }
        }),
        logoColor: (0, import_fields20.text)({
          defaultValue: DEFAULT_STORE_LOGO_COLOR,
          hooks: {
            resolveInput: ({ resolvedData, fieldKey }) => {
              const value = resolvedData[fieldKey];
              return value === void 0 ? value : normalizeStoreLogoColor(value);
            }
          },
          ui: { description: "Logo hue rotation in degrees, 0 to 359" }
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
        storefrontContactEmail: (0, import_fields20.text)({ validation: { length: { max: 254 } }, ui: { description: "Public customer service email" } }),
        storefrontContactPhone: (0, import_fields20.text)({ validation: { length: { max: 40 } }, ui: { description: "Public customer service phone" } }),
        storefrontServiceHours: (0, import_fields20.text)({ validation: { length: { max: 200 } }, ui: { description: "Public customer service hours" } }),
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
        manualPaymentEvidence: (0, import_fields20.relationship)({ ref: "ManualPaymentEvidence.carrier", many: true, access: { create: () => false, update: () => false } }),
        settlementLedgerEntries: (0, import_fields20.relationship)({ ref: "SettlementLedgerEntry.carrier", many: true, access: { create: () => false, update: () => false } }),
        onboardingSteps: (0, import_fields20.relationship)({ ref: "OnboardingStep.carrier", many: true, access: { create: () => false, update: () => false } }),
        ...trackingFields
      },
      hooks: {
        async validate({ operation, resolvedData, item, context, addValidationError }) {
          const timezone = resolvedData.defaultTimezone;
          if (resolvedData.defaultCurrencyCode !== void 0 && !ONBOARDING_CURRENCIES.includes(resolvedData.defaultCurrencyCode)) {
            addValidationError(`Default currency must be one of ${ONBOARDING_CURRENCIES.join(", ")}.`);
          }
          if (timezone !== void 0) {
            try {
              new Intl.DateTimeFormat("en-US", { timeZone: String(timezone) });
            } catch {
              addValidationError("Default timezone must be an IANA timezone such as America/New_York.");
            }
          }
          if (operation !== "update") return;
          lifecycleHooks("carrier").validate({ operation, item, resolvedData, addValidationError });
          const changed = ["code", "defaultCurrencyCode", "defaultTimezone"].filter((field) => resolvedData[field] !== void 0 && resolvedData[field] !== item?.[field]);
          if (!changed.length) return;
          const carrierId = item?.id;
          const [bookings, flights, offers, buckets] = await Promise.all([
            context.prisma.booking.count({ where: { carrierId } }),
            context.prisma.flightInstance.count({ where: { carrierId } }),
            context.prisma.offer.count({ where: { carrierId } }),
            context.prisma.inventoryBucket.count({ where: { carrierId } })
          ]);
          if (bookings + flights + offers + buckets > 0) addValidationError("Carrier code, currency, and timezone are immutable after commercial records exist.");
        }
      }
    });
  }
});

// features/keystone/models/CheckIn.ts
var import_core14, import_fields21, CheckIn;
var init_CheckIn = __esm({
  "features/keystone/models/CheckIn.ts"() {
    "use strict";
    import_core14 = require("@keystone-6/core");
    import_fields21 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    CheckIn = (0, import_core14.list)({
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
        boardingPasses: (0, import_fields21.relationship)({ ref: "BoardingPass.checkIn", many: true }),
        bags: (0, import_fields21.relationship)({ ref: "Bag.checkIn", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "booking", "bookingPassenger", "passenger", "bookingSegment", "flightInstance"]),
        lifecycleHooks("checkIn")
      )
    });
  }
});

// features/keystone/models/Disruption.ts
var import_core15, import_fields22, Disruption;
var init_Disruption = __esm({
  "features/keystone/models/Disruption.ts"() {
    "use strict";
    import_core15 = require("@keystone-6/core");
    import_fields22 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    Disruption = (0, import_core15.list)({
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
  }
});

// features/keystone/models/DocumentVerification.ts
var import_core16, import_fields23, DocumentVerification;
var init_DocumentVerification = __esm({
  "features/keystone/models/DocumentVerification.ts"() {
    "use strict";
    import_core16 = require("@keystone-6/core");
    import_fields23 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_trackingFields();
    DocumentVerification = (0, import_core16.list)({
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
  }
});

// features/keystone/models/ElectronicMiscCoupon.ts
var import_core17, import_fields25, ElectronicMiscCoupon;
var init_ElectronicMiscCoupon = __esm({
  "features/keystone/models/ElectronicMiscCoupon.ts"() {
    "use strict";
    import_core17 = require("@keystone-6/core");
    import_fields25 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    ElectronicMiscCoupon = (0, import_core17.list)({
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
  }
});

// features/keystone/models/ElectronicMiscDocument.ts
var import_core18, import_fields27, ElectronicMiscDocument;
var init_ElectronicMiscDocument = __esm({
  "features/keystone/models/ElectronicMiscDocument.ts"() {
    "use strict";
    import_core18 = require("@keystone-6/core");
    import_fields27 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    ElectronicMiscDocument = (0, import_core18.list)({
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
  }
});

// features/keystone/models/Exchange.ts
var import_core19, import_fields29, Exchange;
var init_Exchange = __esm({
  "features/keystone/models/Exchange.ts"() {
    "use strict";
    import_core19 = require("@keystone-6/core");
    import_fields29 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    Exchange = (0, import_core19.list)({
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
  }
});

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
  const date2 = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date2.getTime())) throw new Error(`${label} must be a valid date.`);
  return date2;
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
var init_snapshots = __esm({
  "features/keystone/lib/snapshots.ts"() {
    "use strict";
  }
});

// features/keystone/models/FareBrand.ts
var import_core20, import_fields31, FareBrand;
var init_FareBrand = __esm({
  "features/keystone/models/FareBrand.ts"() {
    "use strict";
    import_core20 = require("@keystone-6/core");
    import_fields31 = require("@keystone-6/core/fields");
    init_lifecycle();
    init_access();
    init_validation();
    init_snapshots();
    init_trackingFields();
    FareBrand = (0, import_core20.list)({
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
        lifecycleHooks("catalogProduct"),
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
  }
});

// features/keystone/models/FareRule.ts
var import_core21, import_fields32, FareRule;
var init_FareRule = __esm({
  "features/keystone/models/FareRule.ts"() {
    "use strict";
    import_core21 = require("@keystone-6/core");
    import_fields32 = require("@keystone-6/core/fields");
    init_lifecycle();
    init_access();
    init_validation();
    init_trackingFields();
    FareRule = (0, import_core21.list)({
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
        lifecycleHooks("catalogProduct"),
        requiredRelationshipHooks(["carrier", "fareBrand"]),
        carrierRelationshipHooks({ fareBrand: { model: "fareBrand" }, route: { model: "route" } }),
        commandOwnedRelationshipHooks(["offerItems"]),
        chronologicalRangeHooks("effectiveFrom", "effectiveTo", "Fare-rule effective period"),
        chronologicalRangeHooks("travelFrom", "travelTo", "Fare-rule travel period"),
        minorAmountHooks(["changeFeeAmount", "cancellationFeeAmount", "noShowFeeAmount"])
      )
    });
  }
});

// features/keystone/models/FlightInstance.ts
var import_core22, import_fields33, FlightInstance;
var init_FlightInstance = __esm({
  "features/keystone/models/FlightInstance.ts"() {
    "use strict";
    import_core22 = require("@keystone-6/core");
    import_fields33 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    FlightInstance = (0, import_core22.list)({
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
  }
});

// features/keystone/models/FlightSchedule.ts
var import_core23, import_fields34, FlightSchedule;
var init_FlightSchedule = __esm({
  "features/keystone/models/FlightSchedule.ts"() {
    "use strict";
    import_core23 = require("@keystone-6/core");
    import_fields34 = require("@keystone-6/core/fields");
    init_lifecycle();
    init_access();
    init_validation();
    init_trackingFields();
    FlightSchedule = (0, import_core23.list)({
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
        lifecycleHooks("flightSchedule"),
        {
          // Provisioning reads ISO weekdays (Monday 1 … Sunday 7) and treats an empty list as every day.
          validate({ resolvedData, addValidationError }) {
            const days = resolvedData.daysOfWeek;
            if (days === void 0) return;
            if (!Array.isArray(days) || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7) || new Set(days).size !== days.length) {
              addValidationError("Days of week must be unique ISO weekday numbers from 1 (Monday) to 7 (Sunday).");
            }
          }
        },
        requiredRelationshipHooks(["carrier", "route"]),
        carrierRelationshipHooks({ route: { model: "route" }, operatingCarrier: { model: "carrier", carrierField: "id" } }),
        commandOwnedRelationshipHooks(["instances"]),
        chronologicalRangeHooks("effectiveFrom", "effectiveTo", "Schedule effective period")
      )
    });
  }
});

// features/keystone/models/InventoryBucket.ts
var import_core24, import_fields35, InventoryBucket;
var init_InventoryBucket = __esm({
  "features/keystone/models/InventoryBucket.ts"() {
    "use strict";
    import_core24 = require("@keystone-6/core");
    import_fields35 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_trackingFields();
    InventoryBucket = (0, import_core24.list)({
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
  }
});

// features/keystone/models/IdempotencyKey.ts
var import_core25, import_access26, import_fields36, IdempotencyKey;
var init_IdempotencyKey = __esm({
  "features/keystone/models/IdempotencyKey.ts"() {
    "use strict";
    import_core25 = require("@keystone-6/core");
    import_access26 = require("@keystone-6/core/access");
    import_fields36 = require("@keystone-6/core/fields");
    init_access();
    init_fields();
    init_trackingFields();
    IdempotencyKey = (0, import_core25.list)({
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
  }
});

// features/keystone/models/IntegrationProvider.ts
var import_core26, import_fields38, IntegrationProvider;
var init_IntegrationProvider = __esm({
  "features/keystone/models/IntegrationProvider.ts"() {
    "use strict";
    import_core26 = require("@keystone-6/core");
    import_fields38 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_trackingFields();
    IntegrationProvider = (0, import_core26.list)({
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
  }
});

// features/keystone/models/InventoryHold.ts
var import_core27, import_fields39, holdExpiryHooks, InventoryHold;
var init_InventoryHold = __esm({
  "features/keystone/models/InventoryHold.ts"() {
    "use strict";
    import_core27 = require("@keystone-6/core");
    import_fields39 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    holdExpiryHooks = {
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
    InventoryHold = (0, import_core27.list)({
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
  }
});

// features/keystone/models/MachineCredential.ts
var import_core28, import_access30, import_fields40, MachineCredential;
var init_MachineCredential = __esm({
  "features/keystone/models/MachineCredential.ts"() {
    "use strict";
    import_core28 = require("@keystone-6/core");
    import_access30 = require("@keystone-6/core/access");
    import_fields40 = require("@keystone-6/core/fields");
    init_access();
    init_fields();
    init_validation();
    init_trackingFields();
    MachineCredential = (0, import_core28.list)({
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
  }
});

// features/keystone/models/ManualPaymentEvidence.ts
var import_core29, import_fields42, ManualPaymentEvidence;
var init_ManualPaymentEvidence = __esm({
  "features/keystone/models/ManualPaymentEvidence.ts"() {
    "use strict";
    import_core29 = require("@keystone-6/core");
    import_fields42 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_trackingFields();
    ManualPaymentEvidence = (0, import_core29.list)({
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
  }
});

// features/keystone/models/Journey.ts
var import_core30, import_fields44, Journey;
var init_Journey = __esm({
  "features/keystone/models/Journey.ts"() {
    "use strict";
    import_core30 = require("@keystone-6/core");
    import_fields44 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    Journey = (0, import_core30.list)({
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
  }
});

// features/keystone/models/Offer.ts
var import_core31, import_access34, import_fields45, offerInvariantHooks, Offer;
var init_Offer = __esm({
  "features/keystone/models/Offer.ts"() {
    "use strict";
    import_core31 = require("@keystone-6/core");
    import_access34 = require("@keystone-6/core/access");
    import_fields45 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    offerInvariantHooks = {
      validate({ operation, resolvedData, item, addValidationError }) {
        const value = (key) => Number(resolvedData[key] ?? item?.[key] ?? 0);
        const base = value("baseAmount");
        const tax = value("taxAmount");
        const fee = value("feeAmount");
        const discount = value("discountAmount");
        const total2 = value("totalAmount");
        if (base + tax + fee - discount !== total2) {
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
    Offer = (0, import_core31.list)({
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
        shoppingSessionId: (0, import_fields45.text)({ isIndexed: true, access: { read: import_access34.denyAll, create: import_access34.denyAll, update: import_access34.denyAll } }),
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
  }
});

// features/keystone/models/OfferItem.ts
var import_core32, import_fields46, offerItemTotalHooks, OfferItem;
var init_OfferItem = __esm({
  "features/keystone/models/OfferItem.ts"() {
    "use strict";
    import_core32 = require("@keystone-6/core");
    import_fields46 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_trackingFields();
    offerItemTotalHooks = {
      validate({ resolvedData, addValidationError }) {
        const quantity = Number(resolvedData.quantity ?? 1);
        const unit = Number(resolvedData.unitAmount ?? 0);
        const base = Number(resolvedData.baseAmount ?? 0);
        const tax = Number(resolvedData.taxAmount ?? 0);
        const fee = Number(resolvedData.feeAmount ?? 0);
        const total2 = Number(resolvedData.totalAmount ?? 0);
        if (!Number.isSafeInteger(unit * quantity) || unit * quantity !== base) {
          addValidationError("Offer item base amount must equal unit amount multiplied by quantity.");
        }
        if (base + tax + fee !== total2) {
          addValidationError("Offer item total must equal base, tax, and fee amounts.");
        }
      }
    };
    OfferItem = (0, import_core32.list)({
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
  }
});

// features/keystone/models/OnboardingStep.ts
var import_core33, import_fields47, OnboardingStep;
var init_OnboardingStep = __esm({
  "features/keystone/models/OnboardingStep.ts"() {
    "use strict";
    import_core33 = require("@keystone-6/core");
    import_fields47 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_trackingFields();
    OnboardingStep = (0, import_core33.list)({
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
  }
});

// features/keystone/models/Passenger.ts
var import_core34, import_fields49, Passenger;
var init_Passenger = __esm({
  "features/keystone/models/Passenger.ts"() {
    "use strict";
    import_core34 = require("@keystone-6/core");
    import_fields49 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_trackingFields();
    Passenger = (0, import_core34.list)({
      access: carrierScopedAccess("canReadPassengers", "canManagePassengers"),
      ui: {
        labelField: "familyName",
        listView: { initialColumns: ["givenName", "familyName", "dateOfBirth", "email", "status", "carrier"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields49.relationship)({ ref: "Carrier" }),
        passengerKey: (0, import_fields49.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        title: (0, import_fields49.text)(),
        givenName: (0, import_fields49.text)({ validation: { isRequired: true } }),
        middleNames: (0, import_fields49.text)(),
        familyName: (0, import_fields49.text)({ validation: { isRequired: true } }),
        suffix: (0, import_fields49.text)(),
        dateOfBirth: (0, import_fields49.timestamp)(),
        genderMarker: (0, import_fields49.select)({
          type: "enum",
          options: [
            { label: "Female", value: "female" },
            { label: "Male", value: "male" },
            { label: "Unspecified", value: "unspecified" },
            { label: "Undisclosed", value: "undisclosed" }
          ]
        }),
        nationalityCode: (0, import_fields49.text)({
          db: { isNullable: true },
          validation: { match: { regex: /^[A-Z]{2}$/, explanation: "Use an ISO 3166-1 alpha-2 code." } }
        }),
        email: (0, import_fields49.text)(),
        phone: (0, import_fields49.text)(),
        preferredLanguage: (0, import_fields49.text)({ defaultValue: "en" }),
        status: (0, import_fields49.select)({
          type: "enum",
          defaultValue: "active",
          options: [
            { label: "Active", value: "active" },
            { label: "Merged", value: "merged" },
            { label: "Restricted", value: "restricted" },
            { label: "Archived", value: "archived" }
          ]
        }),
        loyaltyPrograms: (0, import_fields49.json)({ defaultValue: [] }),
        preferences: (0, import_fields49.json)({ defaultValue: {} }),
        userAccount: (0, import_fields49.relationship)({ ref: "User.passengerProfile" }),
        travelDocuments: (0, import_fields49.relationship)({ ref: "TravelDocument.passenger", many: true }),
        documentVerifications: (0, import_fields49.relationship)({ ref: "DocumentVerification.passenger", many: true }),
        bookingPassengers: (0, import_fields49.relationship)({ ref: "BookingPassenger.passenger", many: true }),
        offers: (0, import_fields49.relationship)({ ref: "Offer.passengers", many: true }),
        serviceRequests: (0, import_fields49.relationship)({ ref: "ServiceRequest.passenger", many: true }),
        tickets: (0, import_fields49.relationship)({ ref: "Ticket.passenger", many: true }),
        electronicMiscDocuments: (0, import_fields49.relationship)({ ref: "ElectronicMiscDocument.passenger", many: true }),
        seatAssignments: (0, import_fields49.relationship)({ ref: "SeatAssignment.passenger", many: true }),
        checkIns: (0, import_fields49.relationship)({ ref: "CheckIn.passenger", many: true }),
        boardingPasses: (0, import_fields49.relationship)({ ref: "BoardingPass.passenger", many: true }),
        bags: (0, import_fields49.relationship)({ ref: "Bag.passenger", many: true }),
        reaccommodations: (0, import_fields49.relationship)({ ref: "Reaccommodation.passenger", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier"]),
        carrierRelationshipHooks({ userAccount: { model: "user" } }),
        commandOwnedRelationshipHooks(["travelDocuments", "documentVerifications", "bookingPassengers", "offers", "serviceRequests", "tickets", "electronicMiscDocuments", "seatAssignments", "checkIns", "boardingPasses", "bags", "reaccommodations"])
      )
    });
  }
});

// features/keystone/models/Payment.ts
var import_core35, import_fields50, import_access39, managePayments, Payment;
var init_Payment = __esm({
  "features/keystone/models/Payment.ts"() {
    "use strict";
    import_core35 = require("@keystone-6/core");
    import_fields50 = require("@keystone-6/core/fields");
    import_access39 = require("@keystone-6/core/access");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    managePayments = (args) => hasFreshPermission(args, "canManagePayments");
    Payment = (0, import_core35.list)({
      access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "paymentKey",
        listView: { initialColumns: ["paymentKey", "booking", "provider", "status", "amount", "capturedAmount", "refundedAmount"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields50.relationship)({ ref: "Carrier" }),
        paymentKey: (0, import_fields50.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        idempotencyKey: (0, import_fields50.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        booking: (0, import_fields50.relationship)({ ref: "Booking.payments", access: immutableFieldAccess }),
        provider: (0, import_fields50.relationship)({ ref: "PaymentProvider.payments", access: immutableFieldAccess }),
        session: (0, import_fields50.relationship)({ ref: "PaymentSession.payment", access: immutableFieldAccess }),
        status: (0, import_fields50.select)({
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
        amount: (0, import_fields50.integer)({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
        authorizedAmount: (0, import_fields50.integer)({ defaultValue: 0, validation: { min: 0 } }),
        capturedAmount: (0, import_fields50.integer)({ defaultValue: 0, validation: { min: 0 } }),
        refundedAmount: (0, import_fields50.integer)({ defaultValue: 0, validation: { min: 0 } }),
        currencyCode: (0, import_fields50.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        providerPaymentId: (0, import_fields50.text)({ isIndexed: true, access: immutableFieldAccess }),
        providerCaptureId: (0, import_fields50.text)(),
        instrumentBrand: (0, import_fields50.text)(),
        instrumentLast4: (0, import_fields50.text)({
          db: { isNullable: true },
          validation: { match: { regex: /^\d{4}$/, explanation: "Store only four digits." } }
        }),
        rawProviderData: (0, import_fields50.json)({ access: { read: import_access39.denyAll, create: managePayments, update: managePayments }, ui: hiddenSensitiveUi }),
        failureCode: (0, import_fields50.text)(),
        failureMessage: (0, import_fields50.text)(),
        authorizedAt: (0, import_fields50.timestamp)(),
        capturedAt: (0, import_fields50.timestamp)(),
        cancelledAt: (0, import_fields50.timestamp)(),
        refunds: (0, import_fields50.relationship)({ ref: "Refund.payment", many: true }),
        manualPaymentEvidence: (0, import_fields50.relationship)({ ref: "ManualPaymentEvidence.payment", many: true }),
        metadata: (0, import_fields50.json)({ defaultValue: {} }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "booking", "provider"]),
        lifecycleHooks("payment"),
        minorAmountHooks(["amount", "authorizedAmount", "capturedAmount", "refundedAmount"])
      )
    });
  }
});

// features/keystone/lib/bounded-payment-policy.ts
function isEvidenceOnlyManualProvider(provider) {
  if (provider.adapterType !== "manual") return false;
  if (!provider.configuration || typeof provider.configuration !== "object" || Array.isArray(provider.configuration)) return false;
  const configuration = provider.configuration;
  return configuration.providerExecution === false && configuration.requiresIndependentApproval === true;
}
var init_bounded_payment_policy = __esm({
  "features/keystone/lib/bounded-payment-policy.ts"() {
    "use strict";
  }
});

// features/keystone/context.ts
var context_exports = {};
__export(context_exports, {
  keystoneContext: () => keystoneContext
});
var import_context, PrismaModule, keystoneContext;
var init_context = __esm({
  "features/keystone/context.ts"() {
    "use strict";
    import_context = require("@keystone-6/core/context");
    init_keystone();
    PrismaModule = __toESM(require("@prisma/client"));
    keystoneContext = globalThis.keystoneContext ?? (0, import_context.getContext)(keystone_default, PrismaModule);
    globalThis.keystoneContext = keystoneContext;
  }
});

// features/integrations/payment/stripe.ts
function stripeSecretKey(credentials) {
  const key = credentials && typeof credentials === "object" && !Array.isArray(credentials) ? credentials.secretKey : null;
  return typeof key === "string" && /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(key.trim()) ? key.trim() : null;
}
function form(values) {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) if (value !== void 0) body.append(name, String(value));
  return body;
}
async function stripeRequest(secretKey, path, init = {}) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${secretKey}`,
      ...init.body ? { "content-type": "application/x-www-form-urlencoded" } : {},
      ...init.idempotencyKey ? { "idempotency-key": init.idempotencyKey } : {}
    },
    body: init.body,
    signal: AbortSignal.timeout(2e4)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Stripe request failed: ${payload?.error?.message ?? response.status}`);
  return payload;
}
function createStripeCheckoutSession(secretKey, input) {
  return stripeRequest(secretKey, "/checkout/sessions", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: form({
      mode: "payment",
      client_reference_id: input.bookingId,
      "metadata[bookingId]": input.bookingId,
      "metadata[recordLocator]": input.recordLocator,
      "payment_intent_data[metadata][bookingId]": input.bookingId,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": input.currencyCode.toLowerCase(),
      "line_items[0][price_data][unit_amount]": input.amount,
      "line_items[0][price_data][product_data][name]": input.description,
      customer_email: input.customerEmail || void 0,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl
    })
  });
}
function retrieveStripeCheckoutSession(secretKey, sessionId) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Checkout session is invalid.");
  return stripeRequest(secretKey, `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent.latest_charge`);
}
async function providerSecretKey(provider) {
  const { keystoneContext: keystoneContext2 } = await Promise.resolve().then(() => (init_context(), context_exports));
  const record2 = await keystoneContext2.prisma.paymentProvider.findUnique({ where: { providerKey: provider.providerKey }, select: { credentials: true } });
  const key = stripeSecretKey(record2?.credentials);
  if (!key) throw new Error("Stripe secret key is not configured for this provider.");
  return key;
}
var STRIPE_API, stripeAdapter;
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
    STRIPE_API = "https://api.stripe.com/v1";
    stripeAdapter = {
      async capture(_provider, _input) {
        throw new Error("Stripe payments are captured at checkout.");
      },
      // The attempt key is the stored command identity, so a retried transaction repeats the same Stripe refund.
      async refund(provider, input) {
        const refund = await stripeRequest(await providerSecretKey(provider), "/refunds", {
          method: "POST",
          idempotencyKey: input.attemptKey,
          body: form({ payment_intent: input.paymentReference, amount: input.amount, "metadata[reference]": input.refundReference })
        });
        if (!["succeeded", "pending"].includes(refund.status)) throw new Error(`Stripe refund ${refund.id} is ${refund.status}.`);
        return { providerRefundId: refund.id, providerData: { id: refund.id, status: refund.status } };
      }
    };
  }
});

// features/keystone/models/PaymentProvider.ts
var import_core36, import_access41, import_fields52, managePaymentSecrets, legacySelectorUi, INSTALLED_ADAPTER_TYPES, PaymentProvider;
var init_PaymentProvider = __esm({
  "features/keystone/models/PaymentProvider.ts"() {
    "use strict";
    import_core36 = require("@keystone-6/core");
    import_access41 = require("@keystone-6/core/access");
    import_fields52 = require("@keystone-6/core/fields");
    init_access();
    init_bounded_payment_policy();
    init_stripe();
    init_validation();
    init_fields();
    init_trackingFields();
    managePaymentSecrets = (args) => hasFreshPermission(args, "canManagePayments");
    legacySelectorUi = { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" }, listView: { fieldMode: "hidden" } };
    INSTALLED_ADAPTER_TYPES = ["manual", "stripe"];
    PaymentProvider = (0, import_core36.list)({
      access: carrierScopedAccess("canReadPayments", "canManagePayments"),
      ui: {
        labelField: "name",
        listView: { initialColumns: ["name", "code", "adapterType", "status", "carrier"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields52.relationship)({ ref: "Carrier" }),
        providerKey: (0, import_fields52.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        name: (0, import_fields52.text)({ validation: { isRequired: true } }),
        code: (0, import_fields52.text)({ validation: { isRequired: true } }),
        adapterType: (0, import_fields52.select)({
          type: "enum",
          defaultValue: "manual",
          options: [
            { label: "Stripe", value: "stripe" },
            { label: "PayPal", value: "paypal" },
            { label: "Manual", value: "manual" },
            { label: "Custom", value: "custom" }
          ]
        }),
        status: (0, import_fields52.select)({
          type: "enum",
          defaultValue: "inactive",
          options: [
            { label: "Inactive", value: "inactive" },
            { label: "Active", value: "active" },
            { label: "Degraded", value: "degraded" },
            { label: "Disabled", value: "disabled" }
          ]
        }),
        credentials: (0, import_fields52.json)({
          defaultValue: {},
          access: { read: import_access41.denyAll, create: managePaymentSecrets, update: managePaymentSecrets },
          ui: hiddenSensitiveUi
        }),
        configuration: (0, import_fields52.json)({ defaultValue: {} }),
        // Legacy selector columns: the dispatcher (integrations/payment/index.ts) selects only by adapterType, so these are
        // kept for retained records but are neither required nor offered when configuring a provider.
        createPaymentFunction: (0, import_fields52.text)({ ui: legacySelectorUi }),
        capturePaymentFunction: (0, import_fields52.text)({ ui: legacySelectorUi }),
        refundPaymentFunction: (0, import_fields52.text)({ ui: legacySelectorUi }),
        getPaymentStatusFunction: (0, import_fields52.text)({ ui: legacySelectorUi }),
        handleWebhookFunction: (0, import_fields52.text)({ ui: legacySelectorUi }),
        sessions: (0, import_fields52.relationship)({ ref: "PaymentSession.provider", many: true, access: { create: () => false, update: () => false } }),
        payments: (0, import_fields52.relationship)({ ref: "Payment.provider", many: true, access: { create: () => false, update: () => false } }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier"]),
        { validate({ resolvedData, item, addValidationError }) {
          if (resolvedData.adapterType !== void 0 && resolvedData.adapterType !== item?.adapterType && !INSTALLED_ADAPTER_TYPES.includes(resolvedData.adapterType)) {
            addValidationError("Only the manual (evidence-only) and Stripe payment adapters are installed.");
          }
          const adapterType = resolvedData.adapterType ?? item?.adapterType ?? null;
          const status = resolvedData.status ?? item?.status;
          const provider = {
            adapterType: resolvedData.adapterType ?? item?.adapterType ?? null,
            configuration: resolvedData.configuration ?? item?.configuration ?? null
          };
          if (status === "active" && adapterType === "stripe") {
            if (!stripeSecretKey(resolvedData.credentials ?? item?.credentials)) addValidationError("Active Stripe providers need a secret key (sk_test_\u2026 or sk_live_\u2026).");
          } else if (status === "active" && !isEvidenceOnlyManualProvider(provider)) addValidationError("Active payment providers must be configured for evidence-only manual settlement with independent approval.");
        } }
      )
    });
  }
});

// features/keystone/models/PaymentSession.ts
var import_core37, import_fields54, canManagePayments, PaymentSession;
var init_PaymentSession = __esm({
  "features/keystone/models/PaymentSession.ts"() {
    "use strict";
    import_core37 = require("@keystone-6/core");
    import_fields54 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    canManagePayments = (args) => hasFreshPermission(args, "canManagePayments");
    PaymentSession = (0, import_core37.list)({
      access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "sessionKey",
        listView: { initialColumns: ["sessionKey", "booking", "provider", "status", "amount", "currencyCode", "expiresAt"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields54.relationship)({ ref: "Carrier" }),
        sessionKey: (0, import_fields54.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        idempotencyKey: (0, import_fields54.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        booking: (0, import_fields54.relationship)({ ref: "Booking.paymentSessions" }),
        provider: (0, import_fields54.relationship)({ ref: "PaymentProvider.sessions" }),
        payment: (0, import_fields54.relationship)({ ref: "Payment.session" }),
        status: (0, import_fields54.select)({
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
        amount: (0, import_fields54.integer)({ validation: { isRequired: true, min: 0 } }),
        currencyCode: (0, import_fields54.text)({ validation: { isRequired: true } }),
        providerSessionId: (0, import_fields54.text)({ isIndexed: true }),
        providerData: (0, import_fields54.json)({
          defaultValue: {},
          access: { read: canManagePayments, create: canManagePayments, update: canManagePayments },
          ui: hiddenSensitiveUi
        }),
        expiresAt: (0, import_fields54.timestamp)(),
        authorizedAt: (0, import_fields54.timestamp)(),
        completedAt: (0, import_fields54.timestamp)(),
        failureCode: (0, import_fields54.text)(),
        failureMessage: (0, import_fields54.text)(),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "booking", "provider"]),
        lifecycleHooks("paymentSession"),
        minorAmountHooks(["amount"])
      )
    });
  }
});

// features/keystone/models/ProviderConnection.ts
var import_core38, import_access44, import_fields56, manageIntegrations, ProviderConnection;
var init_ProviderConnection = __esm({
  "features/keystone/models/ProviderConnection.ts"() {
    "use strict";
    import_core38 = require("@keystone-6/core");
    import_access44 = require("@keystone-6/core/access");
    import_fields56 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    manageIntegrations = (args) => hasFreshPermission(args, "canManageIntegrations");
    ProviderConnection = (0, import_core38.list)({
      access: commandOnlyCarrierAccess("canReadIntegrations", "canManageIntegrations"),
      graphql: commandOnlyGraphql(),
      ui: { labelField: "name", listView: { initialColumns: ["name", "provider", "status", "externalAccountId", "lastSucceededAt"] }, hideDelete: true },
      fields: {
        carrier: (0, import_fields56.relationship)({ ref: "Carrier.providerConnections" }),
        connectionKey: (0, import_fields56.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        provider: (0, import_fields56.relationship)({ ref: "IntegrationProvider.connections" }),
        name: (0, import_fields56.text)({ validation: { isRequired: true } }),
        status: (0, import_fields56.select)({ type: "enum", defaultValue: "pending", options: [
          { label: "Pending", value: "pending" },
          { label: "Active", value: "active" },
          { label: "Paused", value: "paused" },
          { label: "Failed", value: "failed" },
          { label: "Revoked", value: "revoked" }
        ] }),
        credentials: (0, import_fields56.json)({
          defaultValue: {},
          access: { read: import_access44.denyAll, create: manageIntegrations, update: manageIntegrations },
          ui: hiddenSensitiveUi
        }),
        configuration: (0, import_fields56.json)({ defaultValue: {} }),
        capabilities: (0, import_fields56.json)({ defaultValue: [] }),
        externalAccountId: (0, import_fields56.text)(),
        lastAttemptedAt: (0, import_fields56.timestamp)(),
        lastSucceededAt: (0, import_fields56.timestamp)(),
        lastErrorCode: (0, import_fields56.text)(),
        lastErrorMessage: (0, import_fields56.text)(),
        webhookEndpoints: (0, import_fields56.relationship)({ ref: "WebhookEndpoint.connection", many: true }),
        webhookEvents: (0, import_fields56.relationship)({ ref: "WebhookEvent.connection", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "provider"]),
        lifecycleHooks("providerConnection")
      )
    });
  }
});

// features/keystone/models/Reaccommodation.ts
var import_core39, import_fields58, Reaccommodation;
var init_Reaccommodation = __esm({
  "features/keystone/models/Reaccommodation.ts"() {
    "use strict";
    import_core39 = require("@keystone-6/core");
    import_fields58 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    Reaccommodation = (0, import_core39.list)({
      access: commandOnlyCarrierAccess("canReadDisruptions", "canManageDisruptions"),
      graphql: commandOnlyGraphql(),
      ui: { labelField: "reaccommodationKey", listView: { initialColumns: ["booking", "passenger", "disruption", "status", "optionExpiresAt"] }, hideDelete: true },
      fields: {
        carrier: (0, import_fields58.relationship)({ ref: "Carrier" }),
        reaccommodationKey: (0, import_fields58.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        idempotencyKey: (0, import_fields58.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        booking: (0, import_fields58.relationship)({ ref: "Booking.reaccommodations", access: immutableFieldAccess }),
        bookingPassenger: (0, import_fields58.relationship)({ ref: "BookingPassenger.reaccommodations", access: immutableFieldAccess }),
        passenger: (0, import_fields58.relationship)({ ref: "Passenger.reaccommodations", access: immutableFieldAccess }),
        disruption: (0, import_fields58.relationship)({ ref: "Disruption.reaccommodations", access: immutableFieldAccess }),
        status: (0, import_fields58.select)({ type: "enum", defaultValue: "proposed", options: [
          { label: "Proposed", value: "proposed" },
          { label: "Accepted", value: "accepted" },
          { label: "Confirmed", value: "confirmed" },
          { label: "Declined", value: "declined" },
          { label: "Failed", value: "failed" },
          { label: "Expired", value: "expired" },
          { label: "Cancelled", value: "cancelled" }
        ] }),
        originalSegments: (0, import_fields58.relationship)({ ref: "BookingSegment.reaccommodationsAsOriginal", many: true, access: immutableFieldAccess }),
        replacementSegments: (0, import_fields58.relationship)({ ref: "BookingSegment.reaccommodationsAsReplacement", many: true }),
        replacementOffer: (0, import_fields58.relationship)({ ref: "Offer" }),
        optionExpiresAt: (0, import_fields58.timestamp)({ access: immutableFieldAccess }),
        priceDifferenceAmount: (0, import_fields58.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
        additionalCollectionAmount: (0, import_fields58.integer)({ defaultValue: 0, validation: { min: 0 } }),
        refundAmount: (0, import_fields58.integer)({ defaultValue: 0, validation: { min: 0 } }),
        currencyCode: (0, import_fields58.text)({ defaultValue: "USD", access: immutableFieldAccess }),
        acceptedAt: (0, import_fields58.timestamp)(),
        confirmedAt: (0, import_fields58.timestamp)(),
        reason: (0, import_fields58.text)(),
        optionSnapshot: (0, import_fields58.json)({ defaultValue: {}, access: immutableFieldAccess }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "booking", "disruption"]),
        lifecycleHooks("reaccommodation"),
        minorAmountHooks(["priceDifferenceAmount", "additionalCollectionAmount", "refundAmount"])
      )
    });
  }
});

// features/keystone/models/Refund.ts
var import_core40, import_fields60, Refund;
var init_Refund = __esm({
  "features/keystone/models/Refund.ts"() {
    "use strict";
    import_core40 = require("@keystone-6/core");
    import_fields60 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    Refund = (0, import_core40.list)({
      access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
      graphql: commandOnlyGraphql(),
      ui: { labelField: "refundKey", listView: { initialColumns: ["refundKey", "booking", "payment", "status", "amount", "reason"] }, hideDelete: true },
      fields: {
        carrier: (0, import_fields60.relationship)({ ref: "Carrier" }),
        refundKey: (0, import_fields60.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        idempotencyKey: (0, import_fields60.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        booking: (0, import_fields60.relationship)({ ref: "Booking.refunds", access: immutableFieldAccess }),
        payment: (0, import_fields60.relationship)({ ref: "Payment.refunds", access: immutableFieldAccess }),
        status: (0, import_fields60.select)({ type: "enum", defaultValue: "requested", options: [
          { label: "Requested", value: "requested" },
          { label: "Approved", value: "approved" },
          { label: "Processing", value: "processing" },
          { label: "Succeeded", value: "succeeded" },
          { label: "Failed", value: "failed" },
          { label: "Cancelled", value: "cancelled" }
        ] }),
        reason: (0, import_fields60.select)({ type: "enum", defaultValue: "customer_request", options: [
          { label: "Customer request", value: "customer_request" },
          { label: "Disruption", value: "disruption" },
          { label: "Schedule change", value: "schedule_change" },
          { label: "Duplicate", value: "duplicate" },
          { label: "Fraud", value: "fraud" },
          { label: "Other", value: "other" }
        ] }),
        amount: (0, import_fields60.integer)({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
        currencyCode: (0, import_fields60.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        providerRefundId: (0, import_fields60.text)({ isIndexed: true }),
        note: (0, import_fields60.text)({ ui: { displayMode: "textarea" } }),
        requestedAt: (0, import_fields60.timestamp)({ defaultValue: { kind: "now" }, access: immutableFieldAccess }),
        approvedAt: (0, import_fields60.timestamp)(),
        processedAt: (0, import_fields60.timestamp)(),
        errorMessage: (0, import_fields60.text)(),
        metadata: (0, import_fields60.json)({ defaultValue: {} }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "booking", "payment"]),
        lifecycleHooks("refund"),
        minorAmountHooks(["amount"])
      )
    });
  }
});

// features/keystone/models/RateLimitBucket.ts
var import_core41, import_fields62, RateLimitBucket;
var init_RateLimitBucket = __esm({
  "features/keystone/models/RateLimitBucket.ts"() {
    "use strict";
    import_core41 = require("@keystone-6/core");
    import_fields62 = require("@keystone-6/core/fields");
    init_trackingFields();
    RateLimitBucket = (0, import_core41.list)({
      access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
      graphql: { omit: true },
      ui: { isHidden: true },
      fields: {
        key: (0, import_fields62.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        scope: (0, import_fields62.text)({ validation: { isRequired: true } }),
        count: (0, import_fields62.integer)({ defaultValue: 0, validation: { min: 0 } }),
        windowStartedAt: (0, import_fields62.timestamp)({ validation: { isRequired: true } }),
        expiresAt: (0, import_fields62.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Role.ts
async function roleReadFilter(args) {
  if (!await isFreshSignedIn(args)) return false;
  if (await hasFreshPermission(args, "canReadRoles", "canManageRoles")) return freshCarrierFilter(args);
  return { assignedTo: { some: { id: { equals: args.session.itemId } } } };
}
var import_core42, import_fields63, canReadRolesAccess, canReadRolesUi, Role;
var init_Role = __esm({
  "features/keystone/models/Role.ts"() {
    "use strict";
    import_core42 = require("@keystone-6/core");
    import_fields63 = require("@keystone-6/core/fields");
    init_access();
    init_fields();
    init_trackingFields();
    canReadRolesAccess = (args) => isFreshSignedIn(args);
    canReadRolesUi = (args) => hasPermission(args, "canReadRoles") || hasPermission(args, "canManageRoles");
    Role = (0, import_core42.list)({
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
        name: (0, import_fields63.text)({ validation: { isRequired: true } }),
        carrier: (0, import_fields63.relationship)({ ref: "Carrier.roles" }),
        ...permissionFields,
        assignedTo: (0, import_fields63.relationship)({ ref: "User.role", many: true, access: { create: () => false, update: () => false } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Route.ts
var import_core43, import_fields65, routeIdentityHooks, Route;
var init_Route = __esm({
  "features/keystone/models/Route.ts"() {
    "use strict";
    import_core43 = require("@keystone-6/core");
    import_fields65 = require("@keystone-6/core/fields");
    init_lifecycle();
    init_access();
    init_validation();
    init_trackingFields();
    routeIdentityHooks = {
      async validate({ operation, resolvedData, item, context, addValidationError }) {
        if (operation !== "update") return;
        const relationChanged = (field) => resolvedData[field] !== void 0 && resolvedData[field]?.connect?.id !== item?.[`${field}Id`];
        if (!(resolvedData.routeKey !== void 0 && resolvedData.routeKey !== item?.routeKey || relationChanged("origin") || relationChanged("destination"))) return;
        const [schedules, flights] = await Promise.all([
          context.prisma.flightSchedule.count({ where: { routeId: item.id } }),
          context.prisma.flightInstance.count({ where: { routeId: item.id } })
        ]);
        if (schedules + flights > 0) addValidationError("Route key, origin, and destination are fixed once schedules or dated flights use the route.");
      }
    };
    Route = (0, import_core43.list)({
      access: carrierScopedAccess("canReadNetwork", "canManageNetwork"),
      ui: {
        labelField: "routeKey",
        listView: { initialColumns: ["routeKey", "origin", "destination", "status", "distanceKilometers"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields65.relationship)({ ref: "Carrier.routes" }),
        routeKey: (0, import_fields65.text)({
          isIndexed: "unique",
          validation: { isRequired: true, match: { regex: /^[A-Z0-9]{2,3}:[A-Z0-9]{3}:[A-Z0-9]{3}$/, explanation: "Use CARRIER:ORIGIN:DESTINATION." } }
        }),
        origin: (0, import_fields65.relationship)({ ref: "Airport.departingRoutes" }),
        destination: (0, import_fields65.relationship)({ ref: "Airport.arrivingRoutes" }),
        status: (0, import_fields65.select)({
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
        distanceKilometers: (0, import_fields65.integer)({ validation: { min: 0 } }),
        minimumConnectionMinutes: (0, import_fields65.integer)({ validation: { min: 0 } }),
        isInternational: (0, import_fields65.checkbox)({ defaultValue: false }),
        schedules: (0, import_fields65.relationship)({ ref: "FlightSchedule.route", many: true }),
        flightInstances: (0, import_fields65.relationship)({ ref: "FlightInstance.route", many: true }),
        fareRules: (0, import_fields65.relationship)({ ref: "FareRule.route", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(
        lifecycleHooks("route"),
        requiredRelationshipHooks(["carrier", "origin", "destination"]),
        commandOwnedRelationshipHooks(["schedules", "flightInstances", "fareRules"]),
        routeIdentityHooks
      )
    });
  }
});

// features/keystone/models/Seat.ts
var import_core44, import_fields66, Seat;
var init_Seat = __esm({
  "features/keystone/models/Seat.ts"() {
    "use strict";
    import_core44 = require("@keystone-6/core");
    import_fields66 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_trackingFields();
    Seat = (0, import_core44.list)({
      access: carrierScopedAccess("canReadNetwork", "canManageNetwork"),
      ui: {
        labelField: "designator",
        listView: { initialColumns: ["designator", "seatMap", "cabin", "status", "surchargeAmount"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields66.relationship)({ ref: "Carrier" }),
        seatKey: (0, import_fields66.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        // Seat-map structure is fixed at creation (SeatMap itself is command-only); status, type, and surcharge stay editable.
        seatMap: (0, import_fields66.relationship)({ ref: "SeatMap.seats", access: immutableFieldAccess }),
        cabin: (0, import_fields66.relationship)({ ref: "Cabin.seats", access: immutableFieldAccess }),
        designator: (0, import_fields66.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        rowNumber: (0, import_fields66.integer)({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
        columnCode: (0, import_fields66.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        status: (0, import_fields66.select)({
          type: "enum",
          defaultValue: "available",
          options: [
            { label: "Available", value: "available" },
            { label: "Blocked", value: "blocked" },
            { label: "Unavailable", value: "unavailable" }
          ]
        }),
        seatType: (0, import_fields66.select)({
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
        characteristics: (0, import_fields66.json)({ defaultValue: [] }),
        surchargeAmount: (0, import_fields66.integer)({ defaultValue: 0, validation: { min: 0 } }),
        currencyCode: (0, import_fields66.text)({ defaultValue: "USD", validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "Use an ISO 4217 currency code." } } }),
        assignments: (0, import_fields66.relationship)({ ref: "SeatAssignment.seat", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "seatMap", "cabin"]),
        carrierRelationshipHooks({ seatMap: { model: "seatMap" }, cabin: { model: "cabin" } }),
        commandOwnedRelationshipHooks(["assignments"]),
        minorAmountHooks(["surchargeAmount"])
      )
    });
  }
});

// features/keystone/models/SeatAssignment.ts
var import_core45, import_fields68, SeatAssignment;
var init_SeatAssignment = __esm({
  "features/keystone/models/SeatAssignment.ts"() {
    "use strict";
    import_core45 = require("@keystone-6/core");
    import_fields68 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    SeatAssignment = (0, import_core45.list)({
      access: stationScopedCommandAccess("canReadAirportService", "canManageAirportService", "bookingSegment.flightInstance.origin", "canCheckIn"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "assignmentKey",
        listView: { initialColumns: ["booking", "passenger", "bookingSegment", "seat", "status", "assignedAt"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields68.relationship)({ ref: "Carrier" }),
        assignmentKey: (0, import_fields68.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        occupancyKey: (0, import_fields68.text)({ isIndexed: "unique", db: { isNullable: true }, access: immutableFieldAccess }),
        booking: (0, import_fields68.relationship)({ ref: "Booking.seatAssignments", access: immutableFieldAccess }),
        bookingPassenger: (0, import_fields68.relationship)({ ref: "BookingPassenger.seatAssignments", access: immutableFieldAccess }),
        passenger: (0, import_fields68.relationship)({ ref: "Passenger.seatAssignments", access: immutableFieldAccess }),
        bookingSegment: (0, import_fields68.relationship)({ ref: "BookingSegment.seatAssignments", access: immutableFieldAccess }),
        seat: (0, import_fields68.relationship)({ ref: "Seat.assignments", access: immutableFieldAccess }),
        status: (0, import_fields68.select)({
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
        seatDesignatorSnapshot: (0, import_fields68.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        cabinCodeSnapshot: (0, import_fields68.text)({ access: immutableFieldAccess }),
        characteristicsSnapshot: (0, import_fields68.json)({ defaultValue: [], access: immutableFieldAccess }),
        amount: (0, import_fields68.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
        currencyCode: (0, import_fields68.text)({ defaultValue: "USD", access: immutableFieldAccess }),
        assignedAt: (0, import_fields68.timestamp)(),
        confirmedAt: (0, import_fields68.timestamp)(),
        releasedAt: (0, import_fields68.timestamp)(),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "booking", "bookingPassenger", "passenger", "bookingSegment", "seat"]),
        lifecycleHooks("seatAssignment"),
        minorAmountHooks(["amount"])
      )
    });
  }
});

// features/keystone/models/SeatMap.ts
var import_core46, import_fields70, SeatMap;
var init_SeatMap = __esm({
  "features/keystone/models/SeatMap.ts"() {
    "use strict";
    import_core46 = require("@keystone-6/core");
    import_fields70 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    SeatMap = (0, import_core46.list)({
      access: commandOnlyCarrierAccess("canReadNetwork", "canManageNetwork"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "mapKey",
        listView: { initialColumns: ["mapKey", "flightInstance", "version", "status", "createdAt"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields70.relationship)({ ref: "Carrier" }),
        mapKey: (0, import_fields70.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        flightInstance: (0, import_fields70.relationship)({ ref: "FlightInstance.seatMaps" }),
        version: (0, import_fields70.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
        status: (0, import_fields70.select)({
          type: "enum",
          defaultValue: "draft",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Published", value: "published" },
            { label: "Retired", value: "retired" }
          ]
        }),
        layoutSnapshot: (0, import_fields70.json)({ defaultValue: {} }),
        seats: (0, import_fields70.relationship)({ ref: "Seat.seatMap", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "flightInstance"]),
        lifecycleHooks("seatMap")
      )
    });
  }
});

// features/keystone/models/SettlementLedgerEntry.ts
var import_core47, import_fields71, SettlementLedgerEntry;
var init_SettlementLedgerEntry = __esm({
  "features/keystone/models/SettlementLedgerEntry.ts"() {
    "use strict";
    import_core47 = require("@keystone-6/core");
    import_fields71 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_trackingFields();
    SettlementLedgerEntry = (0, import_core47.list)({
      access: commandOnlyCarrierAccess("canReadPayments", "canManagePayments"),
      graphql: commandOnlyGraphql(),
      ui: { labelField: "externalReference", hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["externalReference", "ledgerSource", "amount", "currencyCode", "occurredAt", "importedAt"] } },
      fields: {
        carrier: (0, import_fields71.relationship)({ ref: "Carrier.settlementLedgerEntries", access: immutableFieldAccess }),
        connection: (0, import_fields71.relationship)({ ref: "ProviderConnection", access: immutableFieldAccess }),
        ledgerKey: (0, import_fields71.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        externalReference: (0, import_fields71.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        ledgerSource: (0, import_fields71.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        evidenceDigest: (0, import_fields71.text)({ isIndexed: true, validation: { isRequired: true, match: { regex: /^[a-f0-9]{64}$/i, explanation: "Use a SHA-256 evidence digest." } }, access: immutableFieldAccess }),
        amount: (0, import_fields71.integer)({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
        currencyCode: (0, import_fields71.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        occurredAt: (0, import_fields71.timestamp)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        importedAt: (0, import_fields71.timestamp)({ defaultValue: { kind: "now" }, access: immutableFieldAccess }),
        importedByCredentialId: (0, import_fields71.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        sourceMetadata: (0, import_fields71.json)({ defaultValue: {}, access: immutableFieldAccess }),
        evidence: (0, import_fields71.relationship)({ ref: "ManualPaymentEvidence.ledgerEntry", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(requiredRelationshipHooks(["carrier"]), minorAmountHooks(["amount"]))
    });
  }
});

// features/keystone/models/StationAssignment.ts
var import_core48, import_fields73, StationAssignment;
var init_StationAssignment = __esm({
  "features/keystone/models/StationAssignment.ts"() {
    "use strict";
    import_core48 = require("@keystone-6/core");
    import_fields73 = require("@keystone-6/core/fields");
    init_lifecycle();
    init_access();
    init_validation();
    init_trackingFields();
    StationAssignment = (0, import_core48.list)({
      access: carrierScopedAccess("canReadUsers", "canManageUsers"),
      ui: { labelField: "assignmentKey", listView: { initialColumns: ["user", "airport", "status", "validFrom", "validUntil"] } },
      fields: {
        carrier: (0, import_fields73.relationship)({ ref: "Carrier.stationAssignments" }),
        assignmentKey: (0, import_fields73.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        user: (0, import_fields73.relationship)({ ref: "User.stationAssignments" }),
        airport: (0, import_fields73.relationship)({ ref: "Airport.stationAssignments" }),
        status: (0, import_fields73.select)({ type: "enum", defaultValue: "active", options: [
          { label: "Active", value: "active" },
          { label: "Suspended", value: "suspended" },
          { label: "Revoked", value: "revoked" }
        ] }),
        canCheckIn: (0, import_fields73.checkbox)({ defaultValue: false }),
        canAcceptBags: (0, import_fields73.checkbox)({ defaultValue: false }),
        canBoard: (0, import_fields73.checkbox)({ defaultValue: false }),
        validFrom: (0, import_fields73.timestamp)({ defaultValue: { kind: "now" } }),
        validUntil: (0, import_fields73.timestamp)(),
        ...trackingFields
      },
      hooks: combineListHooks(
        lifecycleHooks("stationAssignment"),
        requiredRelationshipHooks(["carrier", "user", "airport"]),
        carrierRelationshipHooks({ user: { model: "user" } }),
        // An inverted range would silently never take effect in station capability checks.
        chronologicalRangeHooks("validFrom", "validUntil", "Station assignment validity"),
        {
          async validate({ resolvedData, context, addValidationError }) {
            const airportId = resolvedData.airport?.connect?.id;
            if (!airportId) return;
            const airport = await context.prisma.airport.findUnique({ where: { id: airportId }, select: { isActive: true } });
            if (!airport?.isActive) addValidationError("Station assignments require an active airport.");
          }
        }
      )
    });
  }
});

// features/keystone/models/ServiceRequest.ts
var import_core49, import_fields74, ServiceRequest;
var init_ServiceRequest = __esm({
  "features/keystone/models/ServiceRequest.ts"() {
    "use strict";
    import_core49 = require("@keystone-6/core");
    import_fields74 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_trackingFields();
    ServiceRequest = (0, import_core49.list)({
      access: commandOnlyCarrierAccess("canReadBookings", "canManageBookings"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "requestKey",
        listView: { initialColumns: ["requestKey", "booking", "passenger", "code", "category", "status"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields74.relationship)({ ref: "Carrier" }),
        requestKey: (0, import_fields74.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        booking: (0, import_fields74.relationship)({ ref: "Booking.serviceRequests" }),
        passenger: (0, import_fields74.relationship)({ ref: "Passenger.serviceRequests" }),
        bookingPassenger: (0, import_fields74.relationship)({ ref: "BookingPassenger" }),
        bookingSegment: (0, import_fields74.relationship)({ ref: "BookingSegment.serviceRequests" }),
        code: (0, import_fields74.text)({ validation: { isRequired: true } }),
        category: (0, import_fields74.select)({
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
        status: (0, import_fields74.select)({
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
        travelerText: (0, import_fields74.text)(),
        internalNotes: (0, import_fields74.text)({ ui: { displayMode: "textarea" } }),
        serviceData: (0, import_fields74.json)({ defaultValue: {} }),
        confirmedAt: (0, import_fields74.timestamp)(),
        fulfilledAt: (0, import_fields74.timestamp)(),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "booking", "passenger"]),
        lifecycleHooks("serviceRequest")
      )
    });
  }
});

// features/keystone/models/Ticket.ts
var import_core50, import_fields75, Ticket;
var init_Ticket = __esm({
  "features/keystone/models/Ticket.ts"() {
    "use strict";
    import_core50 = require("@keystone-6/core");
    import_fields75 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    Ticket = (0, import_core50.list)({
      access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "ticketNumber",
        listView: { initialColumns: ["ticketNumber", "booking", "passenger", "status", "totalAmount", "currencyCode", "issuedAt"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields75.relationship)({ ref: "Carrier" }),
        ticketNumber: (0, import_fields75.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        booking: (0, import_fields75.relationship)({ ref: "Booking.tickets", access: immutableFieldAccess }),
        bookingPassenger: (0, import_fields75.relationship)({ ref: "BookingPassenger.tickets", access: immutableFieldAccess }),
        passenger: (0, import_fields75.relationship)({ ref: "Passenger.tickets", access: immutableFieldAccess }),
        issuingCarrierCode: (0, import_fields75.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        validatingCarrierCode: (0, import_fields75.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        status: (0, import_fields75.select)({
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
        totalAmount: (0, import_fields75.integer)({ validation: { isRequired: true, min: 0 }, access: immutableFieldAccess }),
        currencyCode: (0, import_fields75.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        issuedAt: (0, import_fields75.timestamp)({ access: immutableFieldAccess }),
        voidedAt: (0, import_fields75.timestamp)(),
        refundedAt: (0, import_fields75.timestamp)(),
        providerReference: (0, import_fields75.text)({ access: immutableFieldAccess }),
        originalTicket: (0, import_fields75.relationship)({ ref: "Ticket.reissuedTickets", access: immutableFieldAccess }),
        reissuedTickets: (0, import_fields75.relationship)({ ref: "Ticket.originalTicket", many: true }),
        coupons: (0, import_fields75.relationship)({ ref: "TicketCoupon.ticket", many: true }),
        metadata: (0, import_fields75.json)({ defaultValue: {} }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "booking", "bookingPassenger", "passenger"]),
        lifecycleHooks("ticket"),
        minorAmountHooks(["totalAmount"])
      )
    });
  }
});

// features/keystone/lib/prisma-schema-constraints.ts
function requirePrismaRelations(schema, relations) {
  let next = schema;
  for (const relation of relations) {
    const relationLine = new RegExp(`^([ \\t]*${relation}[ \\t]+)(\\w+)\\?([ \\t]+@relation\\([^)]*)\\)`, "m");
    if (!relationLine.test(next)) throw new Error(`Prisma relation ${relation} was not found while applying retained constraints.`);
    next = next.replace(relationLine, (_line, lead, type, attributes) => `${lead}${type}${attributes}, onDelete: Restrict)`);
    const foreignKeyLine = new RegExp(`^([ \\t]*${relation}Id[ \\t]+)String\\?([ \\t]+@map)`, "m");
    if (!foreignKeyLine.test(next)) throw new Error(`Prisma foreign key ${relation}Id was not found while applying retained constraints.`);
    next = next.replace(foreignKeyLine, "$1String$2");
  }
  return next;
}
function addPrismaModelAttribute(schema, attribute) {
  const end = schema.lastIndexOf("}");
  if (end < 0) throw new Error("Prisma model block was not found while applying retained constraints.");
  return `${schema.slice(0, end).trimEnd()}
  ${attribute}
}`;
}
var init_prisma_schema_constraints = __esm({
  "features/keystone/lib/prisma-schema-constraints.ts"() {
    "use strict";
  }
});

// features/keystone/models/TicketCoupon.ts
var import_core51, import_fields77, TicketCoupon;
var init_TicketCoupon = __esm({
  "features/keystone/models/TicketCoupon.ts"() {
    "use strict";
    import_core51 = require("@keystone-6/core");
    import_fields77 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_prisma_schema_constraints();
    init_trackingFields();
    TicketCoupon = (0, import_core51.list)({
      // NOT NULL service obligation (and version) from migration 20260923044000; see prisma-schema-constraints.ts.
      db: { extendPrismaSchema: (schema) => requirePrismaRelations(schema, ["serviceObligation"]) },
      access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "couponKey",
        listView: { initialColumns: ["ticket", "couponNumber", "bookingSegment", "status", "amount"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields77.relationship)({ ref: "Carrier" }),
        couponKey: (0, import_fields77.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        ticket: (0, import_fields77.relationship)({ ref: "Ticket.coupons", access: immutableFieldAccess }),
        serviceObligation: (0, import_fields77.relationship)({ ref: "ServiceObligation.ticketCoupons", access: immutableFieldAccess }),
        serviceObligationVersion: (0, import_fields77.integer)({ validation: { isRequired: true, min: 1 }, db: { isNullable: false }, access: immutableFieldAccess }),
        bookingSegment: (0, import_fields77.relationship)({ ref: "BookingSegment.ticketCoupons", access: immutableFieldAccess }),
        couponNumber: (0, import_fields77.integer)({ validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
        status: (0, import_fields77.select)({
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
        fareBasisCode: (0, import_fields77.text)({ access: immutableFieldAccess }),
        bookingClassCode: (0, import_fields77.text)({ access: immutableFieldAccess }),
        amount: (0, import_fields77.integer)({ defaultValue: 0, validation: { min: 0 }, access: immutableFieldAccess }),
        currencyCode: (0, import_fields77.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        usedAt: (0, import_fields77.timestamp)(),
        entitlementSnapshot: (0, import_fields77.json)({ defaultValue: {}, access: immutableFieldAccess }),
        checkedInAt: (0, import_fields77.timestamp)(),
        checkIns: (0, import_fields77.relationship)({ ref: "CheckIn.ticketCoupon", many: true }),
        bags: (0, import_fields77.relationship)({ ref: "Bag.ticketCoupon", many: true }),
        lineageAsParent: (0, import_fields77.relationship)({ ref: "TicketCouponLineage.parentCoupon", many: true }),
        lineageAsChild: (0, import_fields77.relationship)({ ref: "TicketCouponLineage.childCoupon", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "ticket", "bookingSegment", "serviceObligation"]),
        lifecycleHooks("ticketCoupon"),
        minorAmountHooks(["amount"])
      )
    });
  }
});

// features/keystone/models/TicketCouponLineage.ts
var import_core52, import_fields79, TicketCouponLineage;
var init_TicketCouponLineage = __esm({
  "features/keystone/models/TicketCouponLineage.ts"() {
    "use strict";
    import_core52 = require("@keystone-6/core");
    import_fields79 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_prisma_schema_constraints();
    init_trackingFields();
    TicketCouponLineage = (0, import_core52.list)({
      // NOT NULL ownership/coupon links and the parent/child unique pair from migration 20260923044000.
      db: {
        extendPrismaSchema: (schema) => addPrismaModelAttribute(
          requirePrismaRelations(schema, ["carrier", "bookingPassenger", "parentCoupon", "childCoupon"]),
          '@@unique([parentCouponId, childCouponId], map: "TicketCouponLineage_parentCoupon_childCoupon_key")'
        )
      },
      access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "lineageKey",
        listView: { initialColumns: ["lineageKey", "transformation", "parentCoupon", "childCoupon", "changeSetKey"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields79.relationship)({ ref: "Carrier.ticketCouponLineages", access: immutableFieldAccess }),
        bookingPassenger: (0, import_fields79.relationship)({ ref: "BookingPassenger.ticketCouponLineages", access: immutableFieldAccess }),
        lineageKey: (0, import_fields79.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        changeSetKey: (0, import_fields79.text)({ isIndexed: true, validation: { isRequired: true }, access: immutableFieldAccess }),
        transformation: (0, import_fields79.select)({
          type: "enum",
          validation: { isRequired: true },
          access: immutableFieldAccess,
          options: [
            { label: "Alternative", value: "alternative" },
            { label: "Connection split", value: "split" },
            { label: "Consolidation", value: "consolidation" }
          ]
        }),
        operationType: (0, import_fields79.select)({
          type: "enum",
          validation: { isRequired: true },
          access: immutableFieldAccess,
          options: [
            { label: "Exchange", value: "exchange" },
            { label: "Reaccommodation", value: "reaccommodation" },
            { label: "Servicing", value: "servicing" }
          ]
        }),
        operationId: (0, import_fields79.text)({ validation: { isRequired: true }, access: immutableFieldAccess }),
        parentCoupon: (0, import_fields79.relationship)({ ref: "TicketCoupon.lineageAsParent", access: immutableFieldAccess }),
        childCoupon: (0, import_fields79.relationship)({ ref: "TicketCoupon.lineageAsChild", access: immutableFieldAccess }),
        metadata: (0, import_fields79.json)({ defaultValue: {}, access: immutableFieldAccess }),
        ...trackingFields
      },
      hooks: combineListHooks(requiredRelationshipHooks(["carrier", "bookingPassenger", "parentCoupon", "childCoupon"]))
    });
  }
});

// features/keystone/models/ServiceObligation.ts
var import_core53, import_fields81, ServiceObligation;
var init_ServiceObligation = __esm({
  "features/keystone/models/ServiceObligation.ts"() {
    "use strict";
    import_core53 = require("@keystone-6/core");
    import_fields81 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_prisma_schema_constraints();
    init_trackingFields();
    ServiceObligation = (0, import_core53.list)({
      // NOT NULL carrier/booking/passenger ownership from migration 20260923044000; see prisma-schema-constraints.ts.
      db: { extendPrismaSchema: (schema) => requirePrismaRelations(schema, ["carrier", "booking", "bookingPassenger"]) },
      access: commandOnlyCarrierAccess("canReadTicketing", "canManageTicketing"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "obligationKey",
        listView: { initialColumns: ["obligationKey", "bookingPassenger", "currentVersion", "status"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields81.relationship)({ ref: "Carrier.serviceObligations", access: immutableFieldAccess }),
        booking: (0, import_fields81.relationship)({ ref: "Booking.serviceObligations", access: immutableFieldAccess }),
        bookingPassenger: (0, import_fields81.relationship)({ ref: "BookingPassenger.serviceObligations", access: immutableFieldAccess }),
        obligationKey: (0, import_fields81.text)({ isIndexed: "unique", validation: { isRequired: true }, access: immutableFieldAccess }),
        currentVersion: (0, import_fields81.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 }, access: immutableFieldAccess }),
        status: (0, import_fields81.select)({
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
        ticketCoupons: (0, import_fields81.relationship)({ ref: "TicketCoupon.serviceObligation", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(requiredRelationshipHooks(["carrier", "booking", "bookingPassenger"]))
    });
  }
});

// features/keystone/models/TravelDocument.ts
var import_core54, import_fields83, secureAccess, TravelDocument;
var init_TravelDocument = __esm({
  "features/keystone/models/TravelDocument.ts"() {
    "use strict";
    import_core54 = require("@keystone-6/core");
    import_fields83 = require("@keystone-6/core/fields");
    init_access();
    init_validation();
    init_fields();
    init_trackingFields();
    secureAccess = {
      read: canReadSecurePassengerData,
      create: canReadSecurePassengerData,
      update: canReadSecurePassengerData
    };
    TravelDocument = (0, import_core54.list)({
      access: commandOnlyCarrierAccess("canManageSecurePassengerData", "canManageSecurePassengerData"),
      graphql: commandOnlyGraphql(),
      ui: {
        labelField: "documentNumberLast4",
        listView: { initialColumns: ["passenger", "documentType", "issuingCountryCode", "expiresAt", "status"] },
        hideDelete: true
      },
      fields: {
        carrier: (0, import_fields83.relationship)({ ref: "Carrier" }),
        passenger: (0, import_fields83.relationship)({ ref: "Passenger.travelDocuments" }),
        documentType: (0, import_fields83.select)({
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
        documentNumberToken: (0, import_fields83.text)({
          access: secureAccess,
          ui: hiddenSensitiveUi,
          db: { isNullable: true }
        }),
        documentNumberHash: (0, import_fields83.text)({
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
        encryptedPayload: (0, import_fields83.text)({
          access: secureAccess,
          ui: hiddenSensitiveUi,
          db: { nativeType: "Text", isNullable: true }
        }),
        documentNumberLast4: (0, import_fields83.text)({
          db: { isNullable: true },
          validation: { match: { regex: /^[A-Z0-9]{4}$/, explanation: "Store only the final four characters." } }
        }),
        issuingCountryCode: (0, import_fields83.text)({
          validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: "Use an ISO 3166-1 alpha-2 code." } }
        }),
        nationalityCode: (0, import_fields83.text)({
          db: { isNullable: true },
          validation: { match: { regex: /^[A-Z]{2}$/, explanation: "Use an ISO 3166-1 alpha-2 code." } }
        }),
        issuedAt: (0, import_fields83.timestamp)(),
        expiresAt: (0, import_fields83.timestamp)(),
        status: (0, import_fields83.select)({
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
        verificationProviderReference: (0, import_fields83.text)({ access: secureAccess, ui: hiddenSensitiveUi }),
        verifiedAt: (0, import_fields83.timestamp)(),
        verifiedBy: (0, import_fields83.relationship)({ ref: "User" }),
        verifications: (0, import_fields83.relationship)({ ref: "DocumentVerification.travelDocument", many: true }),
        ...trackingFields
      },
      hooks: combineListHooks(
        requiredRelationshipHooks(["carrier", "passenger"]),
        travelDocumentHooks()
      )
    });
  }
});

// features/keystone/lib/initial-operator-setup.ts
function initialOperatorSetupEnabled(_env = process.env) {
  return true;
}
function validateInitialOperatorInput(input) {
  const name = input.name.trim();
  const email2 = input.email.trim().toLowerCase();
  if (!name || name.length > 120) throw new Error("Operator name is required and must be at most 120 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email2) || email2.length > 254) throw new Error("Enter a valid operator email address.");
  if (input.password.length < 10 || input.password.length > 1e3) throw new Error("The initial operator password must contain at least 10 characters.");
  return { name, email: email2, password: input.password };
}
async function ensureInitialCarrierAndRole(prisma, permissions2, env = process.env) {
  const allPermissions = Object.fromEntries(permissions2.map((permission) => [permission, true]));
  return prisma.$transaction(async (tx) => {
    let carrier = await tx.carrier.findFirst({ where: { users: { none: {} } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
    if (!carrier) {
      carrier = await tx.carrier.create({
        data: {
          name: env.INITIAL_CARRIER_NAME || "Avante Air",
          legalName: env.INITIAL_CARRIER_LEGAL_NAME || "Avante Air LLC",
          code: (env.INITIAL_CARRIER_CODE || "AV").toUpperCase(),
          defaultCurrencyCode: env.INITIAL_CURRENCY_CODE || "USD",
          defaultTimezone: env.INITIAL_TIMEZONE || "America/New_York",
          status: "active",
          directSalesEnabled: false,
          // Like E-commerce's onboarding, the new carrier always gets the registry logo.
          logoIcon: DEFAULT_STORE_LOGO_ICON,
          logoColor: DEFAULT_STORE_LOGO_COLOR
        },
        select: { id: true }
      });
    }
    const existingRole = await tx.role.findFirst({
      where: { name: INITIAL_ROLE_NAME, assignedTo: { none: {} }, OR: [{ carrierId: carrier.id }, { carrierId: null }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true }
    });
    const role = existingRole ? await tx.role.update({ where: { id: existingRole.id }, data: { carrierId: carrier.id, ...allPermissions }, select: { id: true } }) : await tx.role.create({ data: { carrierId: carrier.id, name: INITIAL_ROLE_NAME, ...allPermissions }, select: { id: true } });
    await tx.role.deleteMany({ where: { id: { not: role.id }, name: INITIAL_ROLE_NAME, carrierId: null, assignedTo: { none: {} } } });
    return { carrierId: carrier.id, roleId: role.id };
  });
}
var INITIAL_ROLE_NAME;
var init_initial_operator_setup = __esm({
  "features/keystone/lib/initial-operator-setup.ts"() {
    "use strict";
    init_store_logo();
    INITIAL_ROLE_NAME = "Initial Carrier Administrator";
  }
});

// features/keystone/models/User.ts
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
var import_core55, import_access61, import_fields85, canCreateUser, canManageUsersAccess, canManageUsersUi, User;
var init_User = __esm({
  "features/keystone/models/User.ts"() {
    "use strict";
    import_core55 = require("@keystone-6/core");
    import_access61 = require("@keystone-6/core/access");
    import_fields85 = require("@keystone-6/core/fields");
    init_access();
    init_initial_operator_setup();
    init_fields();
    init_trackingFields();
    canCreateUser = (args) => args.session ? hasFreshPermission(args, "canManageUsers", "canManageCarriers") : false;
    canManageUsersAccess = (args) => hasFreshPermission(args, "canManageUsers", "canManageCarriers");
    canManageUsersUi = (args) => hasPermission(args, "canManageUsers") || hasPermission(args, "canManageCarriers");
    User = (0, import_core55.list)({
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
          update: canUpdateForSessionCarrier,
          // Deleting an account removes its sign-in authority, so it is held to the same fresh target-role ceiling as
          // changing that account's credentials: a delegated manager cannot delete a peer or superior.
          delete: canManageTargetUser
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
        name: (0, import_fields85.text)({ validation: { isRequired: true } }),
        email: (0, import_fields85.text)({
          isIndexed: "unique",
          validation: { isRequired: true },
          isFilterable: false,
          isOrderable: false,
          access: { create: canManageUsersAccess, update: canManageTargetUser }
        }),
        password: (0, import_fields85.password)({
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
        carrier: (0, import_fields85.relationship)({
          ref: "Carrier.users",
          access: { create: canManageUsersAccess, update: canManageUsersAccess }
        }),
        role: (0, import_fields85.relationship)({
          ref: "Role.assignedTo",
          access: {
            create: (args) => canAssignCarrierRelationship(args, "role").then((allowed) => allowed && canAssignUserRole(args)),
            update: (args) => canAssignCarrierRelationship(args, "role").then((allowed) => allowed && canAssignUserRole(args))
          }
        }),
        approvedAgent: (0, import_fields85.relationship)({
          ref: "ApprovedAgent.users",
          access: {
            create: (args) => canAssignCarrierRelationship(args, "approvedAgent"),
            update: (args) => canAssignCarrierRelationship(args, "approvedAgent")
          }
        }),
        onboardingStatus: (0, import_fields85.select)({
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
        // A carrier that has taken a paid booking is launched, whatever its stored launch-setup state says; the dashboard
        // stops offering "Get started" to an airline that already sells.
        carrierLaunched: (0, import_fields85.virtual)({
          field: import_core55.graphql.field({
            type: import_core55.graphql.Boolean,
            async resolve(item, _args, context) {
              if (!item.carrierId) return false;
              const paid = await context.sudo().prisma.booking.findFirst({ where: { carrierId: item.carrierId, paymentStatus: { in: ["paid", "partially_refunded", "refunded"] } }, select: { id: true } });
              return Boolean(paid);
            }
          })
        }),
        passengerProfile: (0, import_fields85.relationship)({ ref: "Passenger.userAccount", access: { create: () => false, update: () => false } }),
        offers: (0, import_fields85.relationship)({ ref: "Offer.customer", many: true, access: { create: () => false, update: () => false } }),
        bookings: (0, import_fields85.relationship)({ ref: "Booking.customer", many: true, access: { create: () => false, update: () => false } }),
        auditEvents: (0, import_fields85.relationship)({ ref: "AuditEvent.actor", many: true, access: { create: () => false, update: () => false } }),
        stationAssignments: (0, import_fields85.relationship)({ ref: "StationAssignment.user", many: true, access: { create: () => false, update: () => false } }),
        documentVerifications: (0, import_fields85.relationship)({ ref: "DocumentVerification.verifiedBy", many: true, access: { create: () => false, update: () => false } }),
        submittedPaymentEvidence: (0, import_fields85.relationship)({ ref: "ManualPaymentEvidence.submittedBy", many: true, access: { create: () => false, update: () => false } }),
        approvedPaymentEvidence: (0, import_fields85.relationship)({ ref: "ManualPaymentEvidence.approvedBy", many: true, access: { create: () => false, update: () => false } }),
        onboardingSteps: (0, import_fields85.relationship)({ ref: "OnboardingStep.user", many: true, access: { create: () => false, update: () => false } }),
        ...trackingFields
      },
      hooks: {
        // First-run setup (createInitialUser, no session, empty user table) attaches the operator to the carrier and
        // full-permission role from ensureInitialCarrierAndRole. Invalid details write nothing: validate rejects them.
        async resolveInput({ operation, resolvedData, inputData, context }) {
          if (operation !== "create" || context.session) return resolvedData;
          if (await context.prisma.user.count() !== 0) return resolvedData;
          try {
            validateInitialOperatorInput({ name: String(inputData.name ?? ""), email: String(inputData.email ?? ""), password: String(inputData.password ?? "") });
          } catch {
            return resolvedData;
          }
          const { carrierId, roleId } = await ensureInitialCarrierAndRole(context.prisma, permissionsList);
          return { ...resolvedData, carrier: { connect: { id: carrierId } }, role: { connect: { id: roleId } } };
        },
        // createInitialUser runs without a session while no user exists. Hold that first operator to the launch policy
        // (name, email and password rules).
        async validate({ operation, inputData, context, addValidationError }) {
          if (operation !== "create" || context.session) return;
          if (await context.prisma.user.count() !== 0) return;
          try {
            validateInitialOperatorInput({ name: String(inputData.name ?? ""), email: String(inputData.email ?? ""), password: String(inputData.password ?? "") });
          } catch (error) {
            addValidationError(error instanceof Error ? error.message : "Initial operator details are invalid.");
          }
        }
      }
    });
  }
});

// features/integrations/webhook-url.ts
function assertExternalWebhookUrl(url, env = process.env) {
  if (url.username || url.password || url.hash) throw new Error("Webhook endpoints cannot contain credentials or fragments.");
  if (env.NODE_ENV !== "production") return;
  if (url.protocol !== "https:") throw new Error("Production webhook endpoints must use HTTPS.");
  const allowedHosts = new Set(String(env.OUTBOUND_WEBHOOK_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
  if (!allowedHosts.has(url.host.toLowerCase())) throw new Error("Production webhook endpoint host is not explicitly allowlisted.");
}
var import_promises, import_node_net;
var init_webhook_url = __esm({
  "features/integrations/webhook-url.ts"() {
    "use strict";
    import_promises = require("node:dns/promises");
    import_node_net = __toESM(require("node:net"));
  }
});

// features/keystone/models/WebhookEndpoint.ts
var import_core56, import_access63, import_fields87, manageIntegrations2, WebhookEndpoint;
var init_WebhookEndpoint = __esm({
  "features/keystone/models/WebhookEndpoint.ts"() {
    "use strict";
    import_core56 = require("@keystone-6/core");
    import_access63 = require("@keystone-6/core/access");
    import_fields87 = require("@keystone-6/core/fields");
    init_webhook_url();
    init_access();
    init_validation();
    init_fields();
    init_trackingFields();
    manageIntegrations2 = (args) => hasFreshPermission(args, "canManageIntegrations");
    WebhookEndpoint = (0, import_core56.list)({
      access: carrierScopedAccess("canReadIntegrations", "canManageIntegrations"),
      ui: { labelField: "name", listView: { initialColumns: ["name", "url", "status", "failureCount", "lastDeliveredAt"] }, hideDelete: true },
      fields: {
        carrier: (0, import_fields87.relationship)({ ref: "Carrier" }),
        endpointKey: (0, import_fields87.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        connection: (0, import_fields87.relationship)({ ref: "ProviderConnection.webhookEndpoints" }),
        name: (0, import_fields87.text)({ validation: { isRequired: true } }),
        url: (0, import_fields87.text)({
          validation: { isRequired: true },
          // Stored normalized, so the value delivery targets is exactly the one validated on save.
          hooks: { resolveInput: ({ resolvedData }) => {
            try {
              return typeof resolvedData.url === "string" ? new URL(resolvedData.url).toString() : resolvedData.url;
            } catch {
              return resolvedData.url;
            }
          } }
        }),
        eventTypes: (0, import_fields87.json)({ defaultValue: [] }),
        status: (0, import_fields87.select)({ type: "enum", defaultValue: "active", options: [
          { label: "Active", value: "active" },
          { label: "Paused", value: "paused" },
          { label: "Failed", value: "failed" },
          { label: "Disabled", value: "disabled" }
        ] }),
        // The receiver must already hold the shared secret to verify signatures, so the operator supplies it; a secret
        // generated here could never be read back (read: denyAll) and nothing could verify it.
        secret: (0, import_fields87.text)({
          access: { read: import_access63.denyAll, create: manageIntegrations2, update: manageIntegrations2 },
          ui: hiddenSensitiveUi
        }),
        failureCount: (0, import_fields87.integer)({ defaultValue: 0, validation: { min: 0 } }),
        lastAttemptedAt: (0, import_fields87.timestamp)(),
        lastDeliveredAt: (0, import_fields87.timestamp)(),
        nextAttemptAt: (0, import_fields87.timestamp)(),
        events: (0, import_fields87.relationship)({ ref: "WebhookEvent.endpoint", many: true, access: { create: () => false, update: () => false } }),
        ...trackingFields
      },
      hooks: combineListHooks(
        {
          validate({ resolvedData, addValidationError }) {
            if (resolvedData.url === void 0) return;
            let url;
            try {
              url = new URL(String(resolvedData.url));
            } catch {
              return addValidationError("Webhook URL must be an absolute http(s) URL.");
            }
            if (!["http:", "https:"].includes(url.protocol)) return addValidationError("Webhook URL must be an absolute http(s) URL.");
            try {
              assertExternalWebhookUrl(url);
            } catch (error) {
              addValidationError(error instanceof Error ? error.message : "Webhook URL is not allowed.");
            }
          }
        },
        {
          validate({ operation, resolvedData, inputData, addValidationError }) {
            const eventTypes = resolvedData.eventTypes;
            if (eventTypes !== void 0 && (!Array.isArray(eventTypes) || eventTypes.length > 50 || eventTypes.some((type) => typeof type !== "string" || !(type === "*" || /^[a-z0-9][a-z0-9._-]{0,99}$/.test(type))))) {
              addValidationError('Event types must be a list of topic names (for example booking.confirmed), or "*" for every topic.');
            }
            if (operation === "create" && typeof inputData.secret !== "string") addValidationError("Enter the signing secret shared with the receiver (at least 32 characters).");
            if (typeof inputData.secret === "string" && inputData.secret.length < 32) addValidationError("Webhook signing secrets must be at least 32 characters.");
          }
        },
        requiredRelationshipHooks(["carrier"]),
        carrierRelationshipHooks({ connection: { model: "providerConnection" } })
      )
    });
  }
});

// features/keystone/models/WebhookEvent.ts
var import_core57, import_fields89, manageIntegrations3, WebhookEvent;
var init_WebhookEvent = __esm({
  "features/keystone/models/WebhookEvent.ts"() {
    "use strict";
    import_core57 = require("@keystone-6/core");
    import_fields89 = require("@keystone-6/core/fields");
    init_access();
    init_lifecycle();
    init_validation();
    init_fields();
    init_trackingFields();
    manageIntegrations3 = (args) => hasFreshPermission(args, "canManageIntegrations");
    WebhookEvent = (0, import_core57.list)({
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
  }
});

// features/keystone/models/index.ts
var models;
var init_models = __esm({
  "features/keystone/models/index.ts"() {
    "use strict";
    init_AncillaryProduct();
    init_ApprovedAgent();
    init_Airport();
    init_AuditEvent();
    init_Bag();
    init_BagEvent();
    init_BoardingPass();
    init_Booking();
    init_BookingLineItem();
    init_BookingPassenger();
    init_BookingSegment();
    init_Cabin();
    init_Carrier();
    init_CheckIn();
    init_Disruption();
    init_DocumentVerification();
    init_ElectronicMiscCoupon();
    init_ElectronicMiscDocument();
    init_Exchange();
    init_FareBrand();
    init_FareRule();
    init_FlightInstance();
    init_FlightSchedule();
    init_InventoryBucket();
    init_IdempotencyKey();
    init_IntegrationProvider();
    init_InventoryHold();
    init_MachineCredential();
    init_ManualPaymentEvidence();
    init_Journey();
    init_Offer();
    init_OfferItem();
    init_OnboardingStep();
    init_Passenger();
    init_Payment();
    init_PaymentProvider();
    init_PaymentSession();
    init_ProviderConnection();
    init_Reaccommodation();
    init_Refund();
    init_RateLimitBucket();
    init_Role();
    init_Route();
    init_Seat();
    init_SeatAssignment();
    init_SeatMap();
    init_SettlementLedgerEntry();
    init_StationAssignment();
    init_ServiceRequest();
    init_Ticket();
    init_TicketCoupon();
    init_TicketCouponLineage();
    init_ServiceObligation();
    init_TravelDocument();
    init_User();
    init_WebhookEndpoint();
    init_WebhookEvent();
    models = {
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
      OnboardingStep,
      RateLimitBucket,
      IdempotencyKey,
      AuditEvent
    };
  }
});

// features/keystone/mutations/redirectToInit.ts
async function shouldRedirectToInitialOperatorSetup(context, env = process.env) {
  if (!initialOperatorSetupEnabled(env)) return false;
  const userCount = await context.sudo().query.User.count({});
  return userCount === 0;
}
async function redirectToInit(_root, _args, context) {
  return shouldRedirectToInitialOperatorSetup(context);
}
var redirectToInit_default;
var init_redirectToInit = __esm({
  "features/keystone/mutations/redirectToInit.ts"() {
    "use strict";
    init_initial_operator_setup();
    redirectToInit_default = redirectToInit;
  }
});

// features/keystone/lib/storefront-session.ts
function normalizeStorefrontToken(value) {
  const token = value?.trim();
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new DomainError("A valid shopping-session token is required.");
  return token;
}
function hashStorefrontToken(value) {
  return import_node_crypto.default.createHash("sha256").update(normalizeStorefrontToken(value)).digest("hex");
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
var import_node_crypto;
var init_storefront_session = __esm({
  "features/keystone/lib/storefront-session.ts"() {
    "use strict";
    import_node_crypto = __toESM(require("node:crypto"));
    init_domain_error();
  }
});

// features/keystone/lib/passenger-service-allocation.ts
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UnsupportedPassengerServiceAllocation("missing explicit itinerary identity");
  return value;
}
function id(value) {
  if (typeof value !== "string" || !value || value.trim() !== value) throw new UnsupportedPassengerServiceAllocation("missing or noncanonical service identity");
  return value;
}
function ids(value) {
  if (!Array.isArray(value) || !value.length) throw new UnsupportedPassengerServiceAllocation("missing explicit passenger allocation");
  const result = value.map(id).sort();
  if (new Set(result).size !== result.length) throw new UnsupportedPassengerServiceAllocation("duplicate passenger allocation");
  return result;
}
function sameIds(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function date(value) {
  if (typeof value !== "string" && !(value instanceof Date)) throw new UnsupportedPassengerServiceAllocation("missing dated-service identity");
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new UnsupportedPassengerServiceAllocation("invalid dated-service identity");
  return parsed;
}
function supportedPassengerServiceAllocation(value, passengerIds, acceptanceVersion = 2) {
  const offer = record(value);
  const carrierId = id(record(offer.carrier).id);
  const party = ids(passengerIds);
  if (!Array.isArray(offer.passengers)) throw new UnsupportedPassengerServiceAllocation("missing explicit offer party");
  if (!sameIds(ids(offer.passengers.map((entry) => record(entry).id)), party)) {
    throw new UnsupportedPassengerServiceAllocation("offer party differs from command");
  }
  if (!Array.isArray(offer.items)) throw new UnsupportedPassengerServiceAllocation("missing priced itinerary");
  const items = offer.items.map(record).filter((item) => item.itemType === "flight");
  if (!items.length) throw new UnsupportedPassengerServiceAllocation("missing explicit priced flight");
  const services = /* @__PURE__ */ new Set();
  const itemIds = /* @__PURE__ */ new Set();
  const itemKeys = /* @__PURE__ */ new Set();
  const legs = items.map((item) => {
    const itemId = id(item.id);
    const itemKey = id(item.itemKey);
    const flight = record(item.flightInstance);
    const bucket = record(item.inventoryBucket);
    const flightId = id(flight.id);
    const bucketId = id(bucket.id);
    if (itemIds.has(itemId) || itemKeys.has(itemKey)) throw new UnsupportedPassengerServiceAllocation("duplicate priced service identity");
    itemIds.add(itemId);
    itemKeys.add(itemKey);
    if (services.has(flightId)) throw new UnsupportedPassengerServiceAllocation("repeated dated flight needs an explicit reviewed extra-seat or separate service contract");
    services.add(flightId);
    if (id(record(item.carrier).id) !== carrierId || id(record(flight.carrier).id) !== carrierId || id(record(bucket.carrier).id) !== carrierId || id(record(bucket.flightInstance).id) !== flightId) throw new UnsupportedPassengerServiceAllocation("foreign or mismatched flight/bucket binding");
    if (item.currencyCode !== offer.currencyCode || typeof offer.currencyCode !== "string" || !/^[A-Z]{3}$/.test(offer.currencyCode)) throw new UnsupportedPassengerServiceAllocation("service currency differs from accepted offer");
    const legacyWholeParty = acceptanceVersion === 1 && (item.passengerReferences == null || Array.isArray(item.passengerReferences) && item.passengerReferences.length === 0);
    if (item.quantity !== party.length || !legacyWholeParty && !sameIds(ids(item.passengerReferences), party)) throw new UnsupportedPassengerServiceAllocation("every supported leg must allocate exactly this whole party once");
    const originId = id(record(flight.origin).id);
    const destinationId = id(record(flight.destination).id);
    const departure = date(flight.scheduledDepartureAt);
    const arrival = date(flight.scheduledArrivalAt);
    if (originId === destinationId || arrival <= departure) throw new UnsupportedPassengerServiceAllocation("invalid service endpoints or chronology");
    return { itemId, flightId, bucketId, originId, destinationId, departure, arrival };
  }).sort((a, b) => a.departure - b.departure || a.itemId.localeCompare(b.itemId));
  for (let index = 1; index < legs.length; index++) {
    if (legs[index - 1].destinationId !== legs[index].originId || legs[index - 1].arrival > legs[index].departure) {
      throw new UnsupportedPassengerServiceAllocation("legs do not form the supported contiguous chronological journey; multiple journey partitions require an explicit contract");
    }
  }
  return {
    version: 1,
    type: PASSENGER_SERVICE_ALLOCATION_TYPE,
    passengerIds: party,
    legs: legs.map((leg, index) => ({ sequence: index + 1, offerItemId: leg.itemId, flightInstanceId: leg.flightId, inventoryBucketId: leg.bucketId, passengerIds: [...party] }))
  };
}
function allocationFromAcceptedSnapshot(value) {
  const accepted = record(value);
  const carrierId = id(accepted.carrierId);
  if (!Array.isArray(accepted.passengers) || !Array.isArray(accepted.items)) throw new UnsupportedPassengerServiceAllocation("incomplete frozen acceptance");
  const passengerIds = accepted.passengers.map((entry) => id(record(entry).id));
  const items = accepted.items.map((entry) => {
    const item = record(entry);
    if (item.itemType !== "flight") return item;
    const flight = record(item.flight);
    return {
      ...item,
      carrier: { id: carrierId },
      flightInstance: { ...flight, carrier: { id: flight.carrierId }, origin: { id: flight.originId }, destination: { id: flight.destinationId } },
      inventoryBucket: { id: item.inventoryBucketId, carrier: { id: carrierId }, flightInstance: { id: flight.id } }
    };
  });
  return supportedPassengerServiceAllocation({ carrier: { id: carrierId }, currencyCode: record(accepted.economics).currencyCode, passengers: passengerIds.map((id2) => ({ id: id2 })), items }, passengerIds);
}
function frozenAcceptanceVersion(value) {
  const version = value && typeof value === "object" && !Array.isArray(value) ? record(value).version : void 0;
  if (version !== 1 && version !== 2) throw new Error("Legacy offer has no supported frozen acceptance version; reconcile the original offer, not a new booking key.");
  return version;
}
var PASSENGER_SERVICE_ALLOCATION_TYPE, UnsupportedPassengerServiceAllocation;
var init_passenger_service_allocation = __esm({
  "features/keystone/lib/passenger-service-allocation.ts"() {
    "use strict";
    PASSENGER_SERVICE_ALLOCATION_TYPE = "whole-party-contiguous-journey";
    UnsupportedPassengerServiceAllocation = class extends Error {
      constructor(reason) {
        super(`Unsupported passenger-service allocation: ${reason}. Retain the original offer/command for reconciliation; do not create a replacement key.`);
        this.code = "UNSUPPORTED_PASSENGER_SERVICE_ALLOCATION";
        this.name = "UnsupportedPassengerServiceAllocation";
      }
    };
  }
});

// features/keystone/lib/booking-acceptance.ts
function bookingAcceptanceDigest(value) {
  const canonical = (entry) => entry instanceof Date ? entry.toISOString() : Array.isArray(entry) ? entry.map(canonical) : entry && typeof entry === "object" ? Object.fromEntries(Object.entries(entry).filter(([, item]) => item !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : entry;
  return import_node_crypto2.default.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function normalizedBookingPassengerIds(ids2) {
  if (!Array.isArray(ids2) || ids2.length < 1 || ids2.length > 9 || ids2.some((id2) => typeof id2 !== "string" || !id2.trim())) throw new Error("One to nine unique passenger IDs are required.");
  const normalized = ids2.map((id2) => id2.trim()).sort();
  if (new Set(normalized).size !== normalized.length) throw new Error("One to nine unique passenger IDs are required.");
  return normalized;
}
function acceptedBookingSnapshot(offer, passengers, version = 2) {
  const identityFields = ["id", "passengerKey", "title", "givenName", "middleNames", "familyName", "suffix", "dateOfBirth", "nationalityCode", "email", "phone", "loyaltyPrograms", "updatedAt"];
  return {
    version,
    serviceAllocation: version === 2 ? supportedPassengerServiceAllocation(offer, passengers.map((passenger) => passenger.id)) : void 0,
    offerId: offer.id,
    offerNumber: offer.offerNumber,
    carrierId: offer.carrier.id,
    source: offer.source,
    expiresAt: new Date(offer.expiresAt).toISOString(),
    economics: Object.fromEntries(["baseAmount", "taxAmount", "feeAmount", "discountAmount", "totalAmount", "currencyCode"].map((key) => [key, offer[key]])),
    configuration: { carrierCode: offer.carrier.code, currencyCode: offer.currencyCode, salesSource: offer.source, conversionContract: version === 2 ? "airline-held-offer-v2" : "airline-held-offer-v1", paymentContract: "separate-settlement-v1", documentContract: "internal-record-not-external-issuance-v1" },
    passengers: passengers.map((passenger) => ({ id: passenger.id, identityDigest: bookingAcceptanceDigest(Object.fromEntries(identityFields.map((key) => [key, passenger[key]]))) })).sort((a, b) => a.id.localeCompare(b.id)),
    items: offer.items.map((item) => ({
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      baseAmount: item.baseAmount,
      taxAmount: item.taxAmount,
      feeAmount: item.feeAmount,
      totalAmount: item.totalAmount,
      currencyCode: item.currencyCode,
      inventoryBucketId: item.inventoryBucket?.id ?? null,
      fareBrandId: item.fareBrand?.id ?? null,
      fareRuleId: item.fareRule?.id ?? null,
      ancillaryProductId: item.ancillaryProduct?.id ?? null,
      passengerReferences: item.passengerReferences ?? null,
      productSnapshot: item.productSnapshot,
      segmentSnapshot: item.segmentSnapshot,
      flight: item.flightInstance ? {
        id: item.flightInstance.id,
        carrierId: item.flightInstance.carrier.id,
        operatingCarrierCode: item.flightInstance.operatingCarrier?.code ?? item.flightInstance.carrier.code,
        flightNumber: item.flightInstance.flightNumber,
        originId: item.flightInstance.origin.id,
        destinationId: item.flightInstance.destination.id,
        originCode: item.flightInstance.origin.iataCode,
        destinationCode: item.flightInstance.destination.iataCode,
        scheduledDepartureAt: item.flightInstance.scheduledDepartureAt,
        scheduledArrivalAt: item.flightInstance.scheduledArrivalAt
      } : null
    })).sort((a, b) => a.id.localeCompare(b.id)),
    holds: offer.inventoryHolds.map((hold) => ({ id: hold.id, bucketId: hold.inventoryBucket.id, quantity: hold.quantity, expiresAt: hold.expiresAt })).sort((a, b) => a.id.localeCompare(b.id))
  };
}
function bookingInventoryConversionPlan(offer, passengerCount, acceptanceVersion = 2) {
  const allocation = supportedPassengerServiceAllocation(offer, (offer.passengers ?? []).map((passenger) => passenger.id), acceptanceVersion);
  if (allocation.passengerIds.length !== passengerCount) throw new Error("Conversion passenger count differs from the original party.");
  const totals = /* @__PURE__ */ new Map();
  const priced = /* @__PURE__ */ new Map();
  for (const item of offer.items.filter((entry) => entry.itemType === "flight")) {
    if (!item.flightInstance || !item.inventoryBucket || item.quantity !== passengerCount || item.inventoryBucket.flightInstance?.id !== item.flightInstance.id) throw new Error("Flight quantity or bucket binding does not match the accepted passenger itinerary.");
    priced.set(item.inventoryBucket.id, (priced.get(item.inventoryBucket.id) ?? 0) + item.quantity);
  }
  if (!priced.size) throw new Error("Booking requires an explicit held flight itinerary.");
  for (const hold of offer.inventoryHolds ?? []) {
    const bucket = hold.inventoryBucket;
    if (!bucket || !Number.isSafeInteger(hold.quantity) || hold.quantity <= 0) throw new Error("Invalid held inventory quantity.");
    const current = totals.get(bucket.id);
    if (current && ["held", "sold", "blocked", "authorized", "capacity"].some((key) => current[key] !== bucket[key])) throw new Error("Inventory reads disagree within this conversion.");
    totals.set(bucket.id, { id: bucket.id, quantity: (current?.quantity ?? 0) + hold.quantity, held: bucket.held, sold: bucket.sold, blocked: bucket.blocked, authorized: bucket.authorized, capacity: bucket.capacity });
  }
  if (totals.size !== priced.size) throw new Error("Inventory holds do not exactly cover the priced flight itinerary.");
  for (const bucket of totals.values()) {
    if (priced.get(bucket.id) !== bucket.quantity) throw new Error("Inventory holds do not exactly cover the priced flight itinerary.");
    if (["quantity", "held", "sold", "blocked", "authorized", "capacity"].some((key) => !Number.isSafeInteger(bucket[key]) || bucket[key] < 0) || bucket.authorized > bucket.capacity || bucket.held < bucket.quantity || bucket.sold + bucket.held + bucket.blocked > bucket.authorized) throw new Error("Held inventory no longer conserves authorized capacity.");
  }
  return [...totals.values()].sort((a, b) => a.id.localeCompare(b.id));
}
function assertHeldBookingSnapshot(held, current) {
  frozenAcceptanceVersion(held);
  if (bookingAcceptanceDigest(held) !== bookingAcceptanceDigest(current)) throw new Error("Passenger, service, fare, quantity, expiry, or accepted economics changed after the hold; reconcile the original offer.");
}
function publicBookingReceipt(result, booking, accessState) {
  const accepted = result.acceptedSnapshot;
  const verified = result.receiptVersion === 1 && (accepted?.version === 1 || accepted?.version === 2) && result.acceptedDigest === bookingAcceptanceDigest(accepted) && accepted.carrierId === booking.carrierId && accepted.offerId === booking.sourceOfferId;
  if (!verified) throw new Error("Legacy or incomplete booking receipt requires operator reconciliation; retain the original command and do not create a replacement booking.");
  if (accepted.version === 2 && bookingAcceptanceDigest(accepted.serviceAllocation) !== bookingAcceptanceDigest(allocationFromAcceptedSnapshot(accepted))) {
    throw new Error("Frozen booking service allocation is incomplete; reconcile the original receipt, not a replacement booking.");
  }
  return {
    version: 1,
    accessState,
    acceptedStatus: result.status,
    accepted: {
      allocationState: accepted.version === 2 ? "supported_v1" : "legacy_unversioned",
      serviceAllocation: accepted.version === 2 ? { version: 1, type: accepted.serviceAllocation.type, passengerCount: accepted.serviceAllocation.passengerIds.length, legCount: accepted.serviceAllocation.legs.length } : null,
      offerNumber: accepted.offerNumber,
      expiresAt: accepted.expiresAt,
      ...accepted.economics,
      configuration: accepted.configuration,
      items: accepted.items.map((item) => ({ description: item.description, quantity: item.quantity, totalAmount: item.totalAmount, currencyCode: item.currencyCode, fareName: item.productSnapshot?.name ?? null, fareCode: item.productSnapshot?.code ?? null, cabinCode: item.segmentSnapshot?.cabinCode ?? null, bookingClassCode: item.segmentSnapshot?.bookingClassCode ?? null, includedBaggage: item.segmentSnapshot?.includedBaggage ?? null, flight: item.flight }))
    },
    current: { status: booking.status, paymentStatus: booking.paymentStatus, ticketingStatus: booking.ticketingStatus }
  };
}
var import_node_crypto2, BOOKING_ACCEPTANCE_OFFER_QUERY, BOOKING_ACCEPTANCE_PASSENGER_QUERY;
var init_booking_acceptance = __esm({
  "features/keystone/lib/booking-acceptance.ts"() {
    "use strict";
    import_node_crypto2 = __toESM(require("node:crypto"));
    init_passenger_service_allocation();
    BOOKING_ACCEPTANCE_OFFER_QUERY = `
  id offerNumber idempotencyKey shoppingSessionId source status expiresAt baseAmount taxAmount feeAmount discountAmount totalAmount currencyCode
  carrier { id code } customer { id carrier { id } } approvedAgent { id carrier { id } }
  passengers { id }
  items {
    id itemKey itemType description quantity unitAmount baseAmount taxAmount feeAmount totalAmount currencyCode
    productSnapshot segmentSnapshot passengerReferences carrier { id }
    fareBrand { id } fareRule { id } ancillaryProduct { id carrier { id } }
    inventoryBucket { id carrier { id } flightInstance { id } cabin { id code } }
    flightInstance { id status flightNumber scheduledDepartureAt scheduledArrivalAt origin { id iataCode } destination { id iataCode } carrier { id code } operatingCarrier { id code } }
  }
  inventoryHolds {
    id holdKey status quantity expiresAt carrier { id }
    inventoryBucket { id held sold blocked authorized capacity carrier { id } }
  }
`;
    BOOKING_ACCEPTANCE_PASSENGER_QUERY = "id passengerKey title givenName middleNames familyName suffix dateOfBirth nationalityCode email phone loyaltyPrograms updatedAt carrier { id }";
  }
});

// features/keystone/lib/service-eligibility.ts
function timestamp40(value) {
  if (value == null) return null;
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}
function assertDatedFlightEligibleForAction(flight, action, now = /* @__PURE__ */ new Date(), options = {}) {
  if (!flight?.id || flight.actualDepartureAt || flight.actualArrivalAt) {
    throw new DomainError(`${action} requires a current dated service that has not departed or arrived.`);
  }
  if (flight.status === "cancelled" && options.allowCancelledForOffload) return;
  if (!passengerProcessingFlightStatuses.has(String(flight.status))) {
    throw new DomainError(`${action} is not allowed for a cancelled, departed, arrived, or unsupported dated service.`);
  }
  const departureAt = timestamp40(flight.status === "delayed" && flight.estimatedDepartureAt ? flight.estimatedDepartureAt : flight.scheduledDepartureAt);
  if (departureAt == null || departureAt <= now.getTime()) {
    throw new DomainError(`${action} requires a future scheduled departure; the dated service is missing, departed, or past departure.`);
  }
}
function selectCurrentTicketableSegments(segments, now = /* @__PURE__ */ new Date()) {
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > 50) {
    throw new DomainError("Booking must have between one and 50 itinerary segments before ticket issuance.");
  }
  const current = [];
  for (const segment of segments) {
    if (segment.status === "reaccommodated") continue;
    if (segment.status !== "confirmed") {
      throw new DomainError("Only confirmed current itinerary segments can be ticketed; resolve disrupted or terminal segment states first.");
    }
    assertDatedFlightEligibleForAction(segment.flightInstance, "Ticket issuance", now);
    current.push(segment);
  }
  current.sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  if (!current.length) throw new DomainError("Booking has no active confirmed itinerary segments to ticket.");
  const seenSequences = /* @__PURE__ */ new Set();
  for (const [index, segment] of current.entries()) {
    if (!Number.isInteger(segment.sequence) || segment.sequence !== index + 1 || seenSequences.has(segment.sequence)) {
      throw new DomainError("Current ticketable itinerary slots must have unique, contiguous sequence numbers.");
    }
    seenSequences.add(segment.sequence);
  }
  return current;
}
function assertPassengerServiceTransition(action, state, now = /* @__PURE__ */ new Date()) {
  const { booking, segment, flight, bookingPassenger, ticket, coupon, obligation, checkIn, boardingPass, seatAssignment } = state;
  if (!["ticketed", "in_progress"].includes(String(booking.status)) || booking.paymentStatus !== "paid" || booking.ticketingStatus !== "ticketed") {
    throw new DomainError("Passenger service requires an active, paid, ticketed booking.");
  }
  if (segment.bookingId !== booking.id || segment.flightInstanceId !== flight.id || !["checked_in", "boarded", ...action === "offload" ? ["disrupted"] : []].includes(String(segment.status))) {
    throw new DomainError(`Passenger ${action} requires the current booking segment and supported segment state.`);
  }
  assertDatedFlightEligibleForAction(flight, action === "board" ? "Boarding" : "Offload", now, { allowCancelledForOffload: action === "offload" });
  const expected = action === "board" ? { pass: ["issued", "reissued"], checkIn: "checked_in", coupon: "checked_in", seat: "confirmed" } : { pass: ["boarded"], checkIn: "boarded", coupon: "boarded", seat: "boarded" };
  const bindingsMatch = Boolean(booking.carrierId) && segment.carrierId === booking.carrierId && flight.carrierId === booking.carrierId && (bookingPassenger.carrierId == null || bookingPassenger.carrierId === booking.carrierId) && (ticket.carrierId == null || ticket.carrierId === booking.carrierId) && (coupon.carrierId == null || coupon.carrierId === booking.carrierId) && (obligation.carrierId == null || obligation.carrierId === booking.carrierId) && (checkIn.carrierId == null || checkIn.carrierId === booking.carrierId) && (boardingPass.carrierId == null || boardingPass.carrierId === booking.carrierId) && (seatAssignment.carrierId == null || seatAssignment.carrierId === booking.carrierId) && boardingPass.passengerId === bookingPassenger.passengerId && ticket.bookingId === booking.id && ticket.bookingPassengerId === bookingPassenger.id && ticket.passengerId === bookingPassenger.passengerId && ["issued", "partially_used"].includes(String(ticket.status)) && coupon.ticketId === ticket.id && coupon.bookingSegmentId === segment.id && coupon.serviceObligationId === obligation.id && coupon.status === expected.coupon && obligation.bookingId === booking.id && obligation.bookingPassengerId === bookingPassenger.id && obligation.status === "active" && coupon.serviceObligationVersion != null && coupon.serviceObligationVersion === obligation.currentVersion && checkIn.bookingId === booking.id && checkIn.bookingPassengerId === bookingPassenger.id && checkIn.passengerId === bookingPassenger.passengerId && checkIn.bookingSegmentId === segment.id && checkIn.flightInstanceId === flight.id && checkIn.ticketCouponId === coupon.id && checkIn.status === expected.checkIn && boardingPass.checkInId === checkIn.id && boardingPass.bookingSegmentId === segment.id && boardingPass.seatAssignmentId === seatAssignment.id && expected.pass.includes(String(boardingPass.status)) && seatAssignment.bookingId === booking.id && seatAssignment.bookingPassengerId === bookingPassenger.id && seatAssignment.passengerId === bookingPassenger.passengerId && seatAssignment.bookingSegmentId === segment.id && Boolean(seatAssignment.seatId) && seatAssignment.occupancyKey === `${flight.id}:${seatAssignment.seatId}` && seatAssignment.seatMapFlightInstanceId === flight.id && seatAssignment.seatMapStatus === "published" && seatAssignment.seatDesignatorSnapshot === boardingPass.seatDesignatorSnapshot && seatAssignment.seatDesignator === seatAssignment.seatDesignatorSnapshot && seatAssignment.currencyCode === booking.currencyCode && seatAssignment.amount === 0 && seatAssignment.status === expected.seat && checkIn.seatAssignmentId === seatAssignment.id;
  if (!bindingsMatch) {
    throw new DomainError(`Passenger ${action} requires matching current ticket, coupon obligation version, boarding pass, check-in, and free seat states.`);
  }
}
function cancellationArtifactBlockers(state) {
  const blockers = /* @__PURE__ */ new Set();
  if ((state.bagCount ?? 0) > 0) blockers.add("checked-baggage physical disposition");
  if ((state.activeAncillaryCouponCount ?? 0) > 0) blockers.add("open or used ancillary coupon disposition");
  if ((state.segments ?? []).some((segment) => ["boarded", "flown"].includes(String(segment.status)))) blockers.add("boarded or flown segment");
  if ((state.segments ?? []).some((segment) => !["confirmed", "checked_in", "boarded", "flown", "offloaded", "disrupted", "reaccommodated", "cancelled", "refunded"].includes(String(segment.status)))) blockers.add("unknown or missing segment state");
  for (const ticket of state.tickets ?? []) {
    if (["partially_used", "used"].includes(String(ticket.status))) blockers.add("partially used or used ticket");
    else if (!["pending", "issued", "suspended", "voided", "refunded", "exchanged"].includes(String(ticket.status))) blockers.add("unknown or missing ticket state");
    for (const coupon of ticket.coupons ?? []) {
      if (["boarded", "flown"].includes(String(coupon.status))) blockers.add("boarded or flown coupon");
      else if (!["open", "checked_in", "suspended", "voided", "refunded", "exchanged"].includes(String(coupon.status))) blockers.add("unknown or missing ticket-coupon state");
      if (["open", "checked_in", "suspended"].includes(String(coupon.status)) && (!coupon.serviceObligation || coupon.serviceObligation.status !== "active" || coupon.serviceObligationVersion == null || coupon.serviceObligationVersion !== coupon.serviceObligation.currentVersion)) {
        blockers.add("ambiguous or stale current coupon obligation");
      }
    }
  }
  for (const checkIn of state.checkIns ?? []) {
    if (checkIn.status === "boarded") blockers.add("boarded passenger check-in");
    else if (!["eligible", "checked_in", "blocked", "offloaded", "cancelled", "not_started"].includes(String(checkIn.status))) blockers.add("unknown or missing check-in state");
    for (const pass of checkIn.boardingPasses ?? []) {
      if (pass.status === "boarded") blockers.add("boarded passenger boarding pass");
      else if (!["issued", "reissued", "revoked"].includes(String(pass.status))) blockers.add("unknown or missing boarding-pass state");
    }
  }
  for (const seat of state.seatAssignments ?? []) {
    if (seat.status === "boarded") blockers.add("boarded seat assignment");
    else if (!["held", "assigned", "confirmed", "released", "cancelled"].includes(String(seat.status))) blockers.add("unknown or missing seat-assignment state");
    if (seat.amount !== 0) blockers.add("paid or inconsistent seat assignment disposition");
  }
  return [...blockers].sort();
}
function hasUnresolvedCancelledBookingArtifacts(state) {
  const currentSegments = (state.segments ?? []).some((segment) => ["confirmed", "checked_in", "boarded", "offloaded", "disrupted"].includes(String(segment.status)));
  const activeTickets = (state.tickets ?? []).some((ticket) => ["pending", "issued", "partially_used", "used", "suspended"].includes(String(ticket.status)));
  const activeCoupons = (state.tickets ?? []).some((ticket) => (ticket.coupons ?? []).some((coupon) => ["open", "checked_in", "suspended", "boarded", "flown"].includes(String(coupon.status))));
  const activeCheckIns = (state.checkIns ?? []).some((checkIn) => checkIn.status !== "cancelled");
  const activePasses = (state.checkIns ?? []).some((checkIn) => (checkIn.boardingPasses ?? []).some((pass) => ["issued", "reissued", "boarded"].includes(String(pass.status))));
  const activeSeats = (state.seatAssignments ?? []).some((seat) => ["held", "assigned", "confirmed", "boarded"].includes(String(seat.status)));
  const activeObligations = (state.serviceObligations ?? []).some((obligation) => obligation.status === "active");
  return currentSegments || activeTickets || activeCoupons || activeCheckIns || activePasses || activeSeats || activeObligations || state.bagCount > 0 || state.activeAncillaryCouponCount > 0;
}
function ticketIssuanceArtifactBlockers(input) {
  const blockers = [];
  if (input.ticketCount !== 0) blockers.push("existing ticket history");
  if (input.obligationCount !== 0) blockers.push("existing service-obligation history");
  if (input.checkInCount !== 0 || input.boardingPassCount !== 0) blockers.push("check-in or boarding-pass artifacts");
  if (input.seatAssignmentCount !== 0) blockers.push("seat-assignment artifacts");
  if (input.bagCount !== 0) blockers.push("baggage artifacts");
  if (input.ancillaryCouponCount !== 0) blockers.push("existing ancillary coupon artifacts");
  return blockers;
}
var passengerProcessingFlightStatuses;
var init_service_eligibility = __esm({
  "features/keystone/lib/service-eligibility.ts"() {
    "use strict";
    init_domain_error();
    passengerProcessingFlightStatuses = /* @__PURE__ */ new Set(["scheduled", "open_for_sale", "closed_for_sale", "delayed"]);
  }
});

// features/keystone/lib/transactions.ts
function sortUniqueIds(ids2) {
  return [...new Set(ids2.map((id2) => id2.trim()).filter(Boolean))].sort();
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
        throw new DomainError("The record changed concurrently; retry the request.", "CONFLICT");
      }
    }
  }
  throw new DomainError("The record changed concurrently; retry the request.", "CONFLICT");
}
var SERIALIZABLE_TRANSACTION_OPTIONS;
var init_transactions = __esm({
  "features/keystone/lib/transactions.ts"() {
    "use strict";
    init_domain_error();
    SERIALIZABLE_TRANSACTION_OPTIONS = {
      isolationLevel: "Serializable",
      maxWait: 5e3,
      timeout: 2e4
    };
  }
});

// features/keystone/lib/passenger-age.ts
function ageOn(dateOfBirth, on) {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday = on.getUTCMonth() < dateOfBirth.getUTCMonth() || on.getUTCMonth() === dateOfBirth.getUTCMonth() && on.getUTCDate() < dateOfBirth.getUTCDate();
  if (beforeBirthday) age -= 1;
  return age;
}
function passengerTypeOn(dateOfBirth, on) {
  const birth = dateOfBirth ? new Date(dateOfBirth) : null;
  if (!birth || Number.isNaN(birth.getTime())) return "adult";
  const age = ageOn(birth, on);
  return age < 2 ? "infant_with_seat" : age < 12 ? "child" : "adult";
}
function travelerDateOfBirth(value, departure) {
  const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(value) ? /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`) : /* @__PURE__ */ new Date("invalid");
  if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth.toISOString().slice(0, 10) !== value) return null;
  const age = ageOn(dateOfBirth, departure);
  if (age < 0 || age > 120) return null;
  return dateOfBirth;
}
function hasAccompanyingAdult(datesOfBirth, departure) {
  return datesOfBirth.some((dateOfBirth) => ageOn(dateOfBirth, departure) >= 18);
}
var init_passenger_age = __esm({
  "features/keystone/lib/passenger-age.ts"() {
    "use strict";
  }
});

// features/keystone/mutations/airlineOperations.ts
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
    throw new DomainError("A 12-to-200 character idempotency key is required.");
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
    throw new DomainError("This idempotency key was already used for a different request.");
  }
  if (existing.status === "completed") return { storageKey, requestHash, replay: existing };
  throw new DomainError("An operation with this idempotency key is already in progress or failed.");
}
async function beginOperation(sudo, context, carrierId, key, scope, request) {
  const inspected = await inspectOperation(sudo, carrierId, key, scope, request);
  if (inspected.replay) return inspected;
  const record2 = await sudo.query.IdempotencyKey.createOne({
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
  return { ...inspected, record: record2 };
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
}
async function cancelBooking(_root, args, context) {
  const storefrontBookingId = isStorefrontContext(context) ? context.session?.data?.storefrontBookingId : void 0;
  if (!storefrontBookingId || storefrontBookingId !== args.customerBookingId) await requireFreshPermission(context, "canManageBookings");
  return runSerializableTransaction(context, (transactionContext) => cancelBookingInTransaction(transactionContext, args, storefrontBookingId));
}
async function cancelBookingInTransaction(transactionContext, args, storefrontBookingId, options = {}) {
  {
    const prisma = transactionContext.prisma;
    const readCancellationState = () => prisma.booking.findUnique({
      where: { id: args.bookingId },
      include: {
        carrier: { select: { id: true } },
        passengers: { select: { id: true } },
        segments: { select: { id: true, status: true, inventoryBucketId: true } },
        paymentSessions: { select: { id: true, status: true } },
        payments: { select: { id: true, status: true, metadata: true } },
        tickets: { include: { coupons: { include: { serviceObligation: true } } } },
        seatAssignments: { select: { id: true, status: true, amount: true } },
        checkIns: { include: { boardingPasses: { select: { id: true, status: true } } } },
        bags: { select: { id: true } },
        serviceObligations: { select: { id: true, status: true } }
      }
    });
    let booking = await readCancellationState();
    if (!booking || storefrontBookingId && booking.id !== storefrontBookingId) throw new DomainError("Booking not found or inaccessible.");
    if (!storefrontBookingId) await requireFreshCarrierPermission(transactionContext, "canManageBookings", booking.carrier.id);
    const bookingLock = await transactionContext.prisma.$queryRaw(import_client.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`);
    throwIfKeystonePrismaError(bookingLock);
    booking = await readCancellationState();
    if (!booking || storefrontBookingId && (booking.id !== storefrontBookingId || !hasCurrentStorefrontBookingAccess(booking, args.customerAccessTokenHash))) throw new DomainError("Booking changed or access was revoked while preparing cancellation.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const reason = args.reason?.trim();
    if (!reason || reason.length > 500) throw new DomainError("A cancellation reason of at most 500 characters is required.");
    const request = { bookingId: booking.id, reason };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "booking.cancel", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const activeAncillaryCouponCount = await prisma.electronicMiscCoupon.count({
      where: { document: { bookingId: booking.id }, OR: [{ status: { in: ["open", "used"] } }, { status: null }] }
    });
    const artifactState = {
      segments: booking.segments,
      tickets: booking.tickets,
      checkIns: booking.checkIns,
      seatAssignments: booking.seatAssignments,
      bagCount: booking.bags.length,
      activeAncillaryCouponCount
    };
    if (booking.status === "cancelled") {
      const blockers2 = cancellationArtifactBlockers(artifactState);
      if (blockers2.length || hasUnresolvedCancelledBookingArtifacts({ ...artifactState, serviceObligations: booking.serviceObligations })) {
        throw new DomainError(`Cancelled booking has unresolved passenger-service artifacts; audited reconciliation is required before further cancellation processing${blockers2.length ? ` (${blockers2.join(", ")})` : ""}.`);
      }
      const claim2 = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "booking.cancel", request);
      if (claim2.replay) return { ...claim2.replay.result ?? {}, replayed: true };
      const reconciledTicketing = booking.tickets.length > 0 && booking.ticketingStatus !== "voided";
      if (reconciledTicketing) {
        await prisma.booking.update({ where: { id: booking.id }, data: { ticketingStatus: "voided" } });
        await writeAudit(sudo, transactionContext, { carrierId: booking.carrier.id, key: claim2.storageKey, action: "booking.cancelled-ticketing.reconcile", aggregateType: "Booking", aggregateId: booking.id, before: { status: "cancelled", ticketingStatus: booking.ticketingStatus }, after: { status: "cancelled", ticketingStatus: "voided" }, metadata: { reason } });
      }
      const result2 = { resourceType: "Booking", resourceId: booking.id, status: "cancelled", changed: reconciledTicketing, replayed: false };
      await finishOperation(sudo, claim2.record.id, result2);
      return result2;
    }
    const unsettledFarePayment = booking.payments.find((payment) => {
      const metadata = payment.metadata ?? {};
      return metadata.purchaseKind !== "seat" && ["captured", "partially_refunded"].includes(payment.status);
    });
    const fareSettledByRefund = options.refundSettled === true && booking.paymentStatus !== "paid" && (!unsettledFarePayment || unsettledFarePayment.status === "partially_refunded");
    if (!fareSettledByRefund && (unsettledFarePayment || ["paid", "partially_refunded"].includes(booking.paymentStatus))) throw new DomainError("Refund captured airfare before cancelling this booking.");
    const unsettledSeatPayment = booking.payments.find((payment) => {
      const metadata = payment.metadata ?? {};
      return metadata.purchaseKind === "seat" && ["captured", "partially_refunded"].includes(payment.status);
    });
    if (unsettledSeatPayment) throw new DomainError("Paid-seat value requires its separately authorized audited disposition before booking cancellation.");
    const blockers = cancellationArtifactBlockers(artifactState);
    if (blockers.length) throw new DomainError(`Cancellation is blocked pending authorized disposition or reconciliation of: ${blockers.join(", ")}.`);
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
        if (released.count !== 1) throw new DomainError("Cancellation could not safely release sold inventory.");
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
      for (const pass of checkIn.boardingPasses ?? []) {
        if (["issued", "reissued"].includes(pass.status)) {
          await transactionContext.prisma.boardingPass.update({ where: { id: pass.id }, data: { status: "revoked", revokedAt: now } });
        }
      }
      if (!["boarded", "cancelled"].includes(checkIn.status)) await transactionContext.prisma.checkIn.update({ where: { id: checkIn.id }, data: { status: "cancelled" } });
    }
    for (const ticket of booking.tickets) {
      for (const coupon of ticket.coupons) {
        if (["open", "checked_in", "suspended"].includes(coupon.status)) await transactionContext.prisma.ticketCoupon.update({ where: { id: coupon.id }, data: { status: "voided" } });
      }
      if (["pending", "issued", "suspended"].includes(ticket.status)) await transactionContext.prisma.ticket.update({ where: { id: ticket.id }, data: { status: "voided", voidedAt: now } });
    }
    const retiredObligations = await prisma.serviceObligation.updateMany({ where: { bookingId: booking.id, status: "active" }, data: { status: "retired" } });
    throwIfKeystonePrismaError(retiredObligations);
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
      metadata: { reason, releasedPassengerSegments: activeSegments.length * passengerCount }
    });
    const result = { resourceType: "Booking", resourceId: booking.id, status: "cancelled", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  }
}
function randomReference(prefix, length) {
  return `${prefix}${import_node_crypto3.default.randomBytes(length).toString("hex").toUpperCase().slice(0, length)}`;
}
async function assertOfferAccess(context, carrierId, storedSessionHash, suppliedSessionHash) {
  if (isStorefrontContext(context)) {
    if (!storedSessionHash || storedSessionHash !== suppliedSessionHash || context.session?.data?.carrier?.id !== carrierId) {
      throw new DomainError("This shopping session does not own the offer.");
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
  if (!offerReference) throw new DomainError("Offer not found.");
  await assertOfferAccess(context, offerReference.carrier.id, offerReference.shoppingSessionId, shoppingSessionHash);
  const offerLockResult = await context.prisma.$queryRaw(
    import_client.Prisma.sql`SELECT "id" FROM "Offer" WHERE "id" = ${offerId} FOR UPDATE`
  );
  throwIfKeystonePrismaError(offerLockResult);
  const lockReferences = await sudo.query.Offer.findOne({
    where: { id: offerId },
    query: "id shoppingSessionId carrier { id } items { flightInstance { id } } inventoryHolds { id inventoryBucket { id } }"
  });
  if (!lockReferences) throw new DomainError("Offer not found.");
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
async function operatorBookingReceipt(_root, args, context) {
  return runSerializableTransaction(context, async (tx) => {
    const visible = await tx.query.Booking.findOne({ where: { id: args.bookingId }, query: "id carrier { id }" });
    if (!visible?.carrier?.id) throw new DomainError("Booking not found or inaccessible.");
    const booking = await tx.prisma.booking.findUnique({ where: { id: visible.id } });
    if (!booking || booking.carrierId !== visible.carrier.id) throw new DomainError("Booking not found or inaccessible.");
    const retained = await tx.prisma.idempotencyKey.findUnique({ where: { key: booking.idempotencyKey } });
    if (retained?.carrierId !== booking.carrierId || retained.scope !== "booking.create-from-offer" || retained.status !== "completed" || retained.result?.resourceId !== booking.id) return { version: 0, state: "legacy_or_incomplete", message: "Original acceptance receipt requires reconciliation; no terms were reconstructed from the current catalog." };
    try {
      return publicBookingReceipt(retained.result, booking, "operator");
    } catch {
      return { version: 0, state: "legacy_or_incomplete", message: "Original acceptance receipt requires reconciliation; current state is not historical evidence." };
    }
  });
}
async function inspectBookingReceipt(context, args, offer, key, request) {
  await assertOfferAccess(context, offer.carrier.id, offer.shoppingSessionId, args.shoppingSessionHash);
  const sudo = context.sudo();
  const storageKey = idempotencyStorageKey(offer.carrier.id, "booking.create-from-offer", key);
  const retained = await findIdempotencyRecord(sudo, storageKey);
  if (!retained) return null;
  if (retained.result?.receiptVersion !== 1) {
    await inspectOperation(sudo, offer.carrier.id, key, "booking.create-from-offer", retained.requestHash === idempotencyRequestHash(request) ? request : { offerId: args.offerId, passengerIds: args.passengerIds, storefront: Boolean(args.shoppingSessionHash) });
    throw new DomainError("Legacy booking receipt lacks frozen acceptance evidence; operator reconciliation is required. Retain the original key, not a replacement booking.");
  }
  const inspected = await inspectOperation(sudo, offer.carrier.id, key, "booking.create-from-offer", request);
  if (!inspected.replay) return null;
  const result = inspected.replay.result;
  const lock = await context.prisma.$queryRaw(import_client.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${result.bookingId} FOR UPDATE`);
  throwIfKeystonePrismaError(lock);
  const booking = await context.prisma.booking.findUnique({ where: { id: result.bookingId } });
  if (!booking || booking.carrierId !== offer.carrier.id || booking.sourceOfferId !== offer.id || booking.idempotencyKey !== storageKey || result.resourceId !== booking.id) throw new DomainError("Booking receipt is incomplete or outside current authority; reconciliation is required.");
  await assertOfferAccess(context, booking.carrierId, offer.shoppingSessionId, args.shoppingSessionHash);
  if (isStorefrontContext(context) && !hasCurrentStorefrontBookingAccess(booking, args.bookingAccessTokenHash)) {
    throw new DomainError("Original booking access was rotated, revoked, or expired. Use the current booking credential; the original command remains recorded and must not be replaced.");
  }
  return { ...result, status: booking.status, changed: false, replayed: true, bookingReceipt: publicBookingReceipt(result, booking, isStorefrontContext(context) ? "current" : "operator") };
}
function requiredCabinCode(value) {
  if (typeof value !== "string" || !value.trim()) throw new DomainError("The held fare has no cabin; the offer must be repriced.");
  return value.trim();
}
async function createBookingFromOfferInTransaction(_root, args, context, admission) {
  if (!isStorefrontContext(context)) await requireFreshPermission(context, "canManageBookings");
  const sudo = context.sudo();
  const key = normalizeIdempotencyKey(args.idempotencyKey);
  args = { ...args, offerId: args.offerId.trim(), passengerIds: normalizedBookingPassengerIds(args.passengerIds) };
  const reference = await sudo.query.Offer.findOne({ where: { id: args.offerId }, query: "id shoppingSessionId carrier { id code }" });
  if (!reference) throw new DomainError("Offer not found or inaccessible.");
  await assertOfferAccess(context, reference.carrier.id, reference.shoppingSessionId, args.shoppingSessionHash);
  const request = {
    version: 2,
    offerId: args.offerId,
    passengerIds: args.passengerIds,
    authority: isStorefrontContext(context) ? { kind: "guest", shoppingSessionHash: args.shoppingSessionHash, initialAccessHash: args.bookingAccessTokenHash } : { kind: "operator", actorId: context.session?.itemId, carrierId: reference.carrier.id }
  };
  const fastReplay = await inspectBookingReceipt(context, args, reference, key, request);
  if (fastReplay) return fastReplay;
  if (args.recoverOnly) throw new DomainError("No committed booking receipt exists for this exact command. Keep the original intent; no booking was created by this recovery read.");
  if (isStorefrontContext(context)) {
    if (!admission || !args.bookingAccessTokenHash) throw new DomainError("Storefront booking admission is required for a new reservation.");
    await admission(context, reference.carrier);
  }
  await lockOfferInventory(context, args.offerId, args.shoppingSessionHash);
  const offer = await sudo.query.Offer.findOne({ where: { id: args.offerId }, query: BOOKING_ACCEPTANCE_OFFER_QUERY });
  if (!offer) throw new DomainError("Offer not found.");
  await assertOfferAccess(context, offer.carrier.id, offer.shoppingSessionId, args.shoppingSessionHash);
  const scope = "booking.create-from-offer";
  const lockedReplay = await inspectBookingReceipt(context, args, offer, key, request);
  if (lockedReplay) return lockedReplay;
  if (isStorefrontContext(context) && args.shoppingSessionHash) {
    const reservationLock = await context.prisma.$queryRaw(import_client.Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`airline:pending-reservation:${offer.carrier.id}:${args.shoppingSessionHash}`}, 0)) AS locked`);
    throwIfKeystonePrismaError(reservationLock);
    if (!Array.isArray(reservationLock) || reservationLock[0]?.locked !== true) throw new DomainError("This shopping session is currently creating a reservation. Retry shortly.");
    const activeUnpaidReservations = await context.prisma.booking.count({
      where: {
        carrierId: offer.carrier.id,
        sourceOffer: { shoppingSessionId: args.shoppingSessionHash },
        status: { notIn: ["cancelled", "completed"] },
        paymentStatus: { in: ["unpaid", "failed"] }
      }
    });
    if (activeUnpaidReservations >= 1) {
      throw new DomainError("This shopping session already has an unpaid reservation. Complete the disclosed external-settlement handoff or cancel that reservation before creating another.");
    }
  }
  if (!["available", "held"].includes(offer.status)) throw new DomainError("Offer is not sellable.");
  if (!offer.expiresAt || new Date(offer.expiresAt) <= /* @__PURE__ */ new Date()) throw new DomainError("Offer has expired.");
  if (!offer.items?.length) throw new DomainError("Offer has no priced items.");
  if (!args.passengerIds?.length || new Set(args.passengerIds).size !== args.passengerIds.length) {
    throw new DomainError("At least one unique passenger is required.");
  }
  const offeredPassengerIds = (offer.passengers ?? []).map((passenger) => passenger.id).sort();
  const requestedPassengerIds = [...args.passengerIds].sort();
  if (offeredPassengerIds.length !== requestedPassengerIds.length || offeredPassengerIds.some((id2, index) => id2 !== requestedPassengerIds[index])) {
    throw new DomainError("Booking passengers must exactly match the accepted offer.");
  }
  if (offer.customer?.carrier?.id && offer.customer.carrier.id !== offer.carrier.id) {
    throw new DomainError("Offer customer is outside the offer carrier.");
  }
  if (offer.approvedAgent?.carrier?.id && offer.approvedAgent.carrier.id !== offer.carrier.id) {
    throw new DomainError("Offer agent is outside the offer carrier.");
  }
  for (const item of offer.items) {
    if (item.carrier?.id !== offer.carrier.id) throw new DomainError("Offer item is outside the offer carrier.");
    if (item.currencyCode !== offer.currencyCode) throw new DomainError("Offer item currency does not match the offer.");
    if (item.flightInstance?.carrier?.id && item.flightInstance.carrier.id !== offer.carrier.id) {
      throw new DomainError("Offer flight is outside the offer carrier.");
    }
    if (item.flightInstance && (!["scheduled", "open_for_sale", "delayed"].includes(item.flightInstance.status) || new Date(item.flightInstance.scheduledDepartureAt) <= /* @__PURE__ */ new Date())) {
      throw new DomainError("Offer flight is no longer open for future sale.");
    }
    if (item.inventoryBucket?.carrier?.id && item.inventoryBucket.carrier.id !== offer.carrier.id) {
      throw new DomainError("Offer inventory is outside the offer carrier.");
    }
    if (item.ancillaryProduct?.carrier?.id && item.ancillaryProduct.carrier.id !== offer.carrier.id) {
      throw new DomainError("Offer ancillary is outside the offer carrier.");
    }
  }
  for (const hold of offer.inventoryHolds ?? []) {
    if (hold.carrier?.id !== offer.carrier.id || hold.inventoryBucket?.carrier?.id !== offer.carrier.id) {
      throw new DomainError("Offer hold is outside the offer carrier.");
    }
  }
  const itemTotal = offer.items.reduce(
    (sum, item) => sum + (item.itemType === "discount" ? -1 : 1) * Number(item.totalAmount),
    0
  );
  if (itemTotal !== offer.totalAmount) throw new DomainError("Offer item totals do not match the offer total.");
  for (const item of offer.items.filter((candidate) => candidate.itemType === "flight")) {
    if (!item.inventoryBucket) throw new DomainError("Flight offer item is missing an inventory bucket.");
    const heldQuantity = (offer.inventoryHolds ?? []).filter((hold) => hold.inventoryBucket?.id === item.inventoryBucket.id).reduce((sum, hold) => sum + Number(hold.quantity), 0);
    if (heldQuantity < item.quantity) throw new DomainError("Flight offer item is not fully covered by inventory holds.");
  }
  for (const hold of offer.inventoryHolds ?? []) {
    if (hold.status !== "active" || new Date(hold.expiresAt) <= /* @__PURE__ */ new Date()) {
      throw new DomainError("Offer inventory hold is not active.");
    }
    if (!hold.inventoryBucket || hold.inventoryBucket.held < hold.quantity || hold.inventoryBucket.sold + hold.quantity > hold.inventoryBucket.authorized) {
      throw new DomainError("Offer inventory hold no longer fits authorized inventory.");
    }
  }
  const passengers = await sudo.query.Passenger.findMany({
    where: { id: { in: args.passengerIds }, carrier: { id: { equals: offer.carrier.id } } },
    orderBy: [{ id: "asc" }],
    take: 9,
    query: BOOKING_ACCEPTANCE_PASSENGER_QUERY
  });
  if (passengers.length !== args.passengerIds.length) throw new DomainError("One or more passengers are missing or outside this carrier.");
  const heldOperation = offer.idempotencyKey ? await findIdempotencyRecord(sudo, offer.idempotencyKey) : null;
  if (!heldOperation || heldOperation.carrier?.id !== offer.carrier.id || heldOperation.scope !== "offer.create" || heldOperation.status !== "completed") throw new DomainError("The original held-offer receipt is unavailable; reconcile the offer before accepting.");
  const acceptanceVersion = frozenAcceptanceVersion(heldOperation.result?.heldSnapshot);
  const acceptedSnapshot = acceptedBookingSnapshot(offer, passengers, acceptanceVersion);
  assertHeldBookingSnapshot(heldOperation.result?.heldSnapshot, acceptedSnapshot);
  const conversionPlan = bookingInventoryConversionPlan(offer, passengers.length, acceptanceVersion);
  const claim = await beginOperation(sudo, context, offer.carrier.id, key, scope, request);
  if (claim.replay) {
    const replay = await inspectBookingReceipt(context, args, offer, key, request);
    if (!replay) throw new DomainError("Booking receipt changed while claiming conversion.");
    return replay;
  }
  try {
    let recordLocator = randomReference("", 6);
    for (let attempt = 0; attempt < 5 && await context.prisma.booking.findFirst({ where: { carrierId: offer.carrier.id, recordLocator }, select: { id: true } }); attempt++) {
      recordLocator = randomReference("", 6);
    }
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
    const departures = offer.items.map((item) => Date.parse(item.flightInstance?.scheduledDepartureAt ?? "")).filter(Number.isFinite);
    const firstDeparture = new Date(departures.length ? Math.min(...departures) : Date.now());
    for (const passenger of passengers) {
      await sudo.query.BookingPassenger.createOne({
        data: {
          carrier: { connect: { id: offer.carrier.id } },
          booking: { connect: { id: booking.id } },
          passenger: { connect: { id: passenger.id } },
          bookingPassengerKey: `${booking.id}:${passenger.id}`,
          passengerType: passengerTypeOn(passenger.dateOfBirth, firstDeparture),
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
          // The held bucket's cabin is authoritative; older offers snapshotted a fixed 'Y'.
          cabinCode: requiredCabinCode(item.inventoryBucket?.cabin?.code ?? item.segmentSnapshot?.cabinCode),
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
    }
    for (const bucket of conversionPlan) {
      await sudo.query.InventoryBucket.updateOne({ where: { id: bucket.id }, data: { held: bucket.held - bucket.quantity, sold: bucket.sold + bucket.quantity } });
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
      replayed: false,
      receiptVersion: 1,
      acceptedSnapshot,
      acceptedDigest: bookingAcceptanceDigest(acceptedSnapshot)
    };
    await finishOperation(sudo, claim.record.id, result);
    const current = await context.prisma.booking.findUnique({ where: { id: booking.id } });
    return { ...result, bookingReceipt: publicBookingReceipt(result, current, isStorefrontContext(context) ? "current" : "operator") };
  } catch (error) {
    await failOperation(sudo, claim.record?.id).catch(() => void 0);
    throw error;
  }
}
async function createBookingFromOffer(root, args, context, admission) {
  try {
    return await runSerializableTransaction(context, (tx) => createBookingFromOfferInTransaction(root, args, tx, admission));
  } catch (error) {
    const code = error?.code ?? error?.extensions?.prisma?.code;
    if (code !== "P2002") throw error;
    return runSerializableTransaction(context, (tx) => createBookingFromOfferInTransaction(root, { ...args, recoverOnly: true }, tx, admission));
  }
}
var import_node_crypto3, import_client, sensitiveAuditKey;
var init_airlineOperations = __esm({
  "features/keystone/mutations/airlineOperations.ts"() {
    "use strict";
    import_node_crypto3 = __toESM(require("node:crypto"));
    import_client = require("@prisma/client");
    init_access();
    init_lifecycle();
    init_snapshots();
    init_storefront_session();
    init_passenger_service_allocation();
    init_booking_acceptance();
    init_service_eligibility();
    init_transactions();
    init_domain_error();
    init_passenger_age();
    sensitiveAuditKey = /authorization|cookie|credential|document|password|payload|secret|token/i;
  }
});

// features/keystone/lib/segment-service-status.ts
function deriveSegmentServiceStatus(entitlements) {
  if (!entitlements.length) return "confirmed";
  if (new Set(entitlements.map((item) => item.bookingPassengerId)).size !== entitlements.length) throw new DomainError("Conflicting current passenger entitlements require reconciliation.");
  if (entitlements.every((item) => ["boarded", "flown"].includes(item.status))) return "boarded";
  return entitlements.some((item) => ["checked_in", "boarded", "flown"].includes(item.status)) ? "checked_in" : "confirmed";
}
async function currentSegmentServiceStatus(prisma, bookingId, segmentId) {
  const coupons = await prisma.ticketCoupon.findMany({
    where: { bookingSegmentId: segmentId, ticket: { bookingId }, status: { in: ["open", "checked_in", "boarded", "flown"] } },
    select: { status: true, serviceObligationVersion: true, serviceObligation: { select: { bookingId: true, bookingPassengerId: true, status: true, currentVersion: true } } },
    orderBy: { id: "asc" },
    take: 101
  });
  if (coupons.length > 100) throw new DomainError("Current segment entitlements require reconciliation before passenger service can continue.");
  const entitlements = coupons.flatMap((coupon) => {
    const obligation = coupon.serviceObligation;
    if (!obligation || obligation.bookingId !== bookingId || !["active", "fulfilled"].includes(obligation.status ?? "") || coupon.serviceObligationVersion !== obligation.currentVersion) return [];
    return [{ bookingPassengerId: obligation.bookingPassengerId ?? "", status: coupon.status ?? "" }];
  });
  if (entitlements.some((item) => !item.bookingPassengerId)) throw new DomainError("A current entitlement has no traveler binding.");
  return deriveSegmentServiceStatus(entitlements);
}
var init_segment_service_status = __esm({
  "features/keystone/lib/segment-service-status.ts"() {
    "use strict";
    init_domain_error();
  }
});

// features/integrations/payment/manual.ts
function requiredReference(value, label) {
  const normalized = value?.trim();
  if (!normalized || normalized.length < 6 || normalized.length > 200) {
    throw new Error(`${label} must be a 6-to-200 character reference from the settlement system.`);
  }
  return normalized;
}
function requiredAttemptKey(value) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 300) throw new Error("A payment attempt identity is required.");
  return normalized;
}
var manualReconciliationAdapter;
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
    manualReconciliationAdapter = {
      async capture(_provider, input) {
        const attemptKey = requiredAttemptKey(input.attemptKey);
        const reference = requiredReference(input.providerReference, "Payment reference");
        if (input.instrumentLast4 && !/^\d{4}$/.test(input.instrumentLast4)) {
          throw new Error("Instrument last four must contain exactly four digits.");
        }
        return {
          providerPaymentId: reference,
          providerCaptureId: reference,
          ...input.instrumentBrand?.trim() ? { instrumentBrand: input.instrumentBrand.trim().slice(0, 40) } : {},
          ...input.instrumentLast4 ? { instrumentLast4: input.instrumentLast4 } : {},
          providerData: { settlementMode: "manual_reconciliation", attemptKey }
        };
      },
      async refund(_provider, input) {
        const attemptKey = requiredAttemptKey(input.attemptKey);
        requiredReference(input.paymentReference, "Payment reference");
        const refundReference = requiredReference(input.refundReference, "Refund reference");
        return {
          providerRefundId: refundReference,
          providerData: { settlementMode: "manual_reconciliation", attemptKey }
        };
      }
    };
  }
});

// features/integrations/payment/index.ts
function getPaymentAdapter(provider) {
  const adapter = adapters[provider.adapterType];
  if (!adapter) {
    throw new Error(`Payment adapter "${provider.adapterType}" is not installed.`);
  }
  return adapter;
}
var adapters;
var init_payment = __esm({
  "features/integrations/payment/index.ts"() {
    "use strict";
    init_manual();
    init_stripe();
    adapters = {
      manual: manualReconciliationAdapter,
      stripe: stripeAdapter
    };
  }
});

// features/keystone/lib/storefront-capacity.ts
function anonymousHoldQuota(authorized, requestedPartySize) {
  const baseline = Math.max(1, Math.floor(authorized * 0.25));
  return Math.min(10, Math.max(requestedPartySize, baseline));
}
var init_storefront_capacity = __esm({
  "features/keystone/lib/storefront-capacity.ts"() {
    "use strict";
  }
});

// features/keystone/lib/coupon-lineage.ts
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
var import_node_crypto4, spendable;
var init_coupon_lineage = __esm({
  "features/keystone/lib/coupon-lineage.ts"() {
    "use strict";
    import_node_crypto4 = __toESM(require("node:crypto"));
    spendable = (coupon) => coupon.status === "open" || coupon.status === "checked_in";
  }
});

// features/keystone/lib/money.ts
function currencyExponent(currencyCode) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}
function minorToMajor(amount, currencyCode) {
  return amount / 10 ** currencyExponent(currencyCode);
}
function formatMinorUnits(amount, currencyCode) {
  if (amount == null || !Number.isFinite(amount) || !currencyCode) return "\u2014";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(minorToMajor(amount, currencyCode));
  } catch {
    return `${currencyCode} ${minorToMajor(amount, currencyCode).toFixed(currencyExponent(currencyCode))}`;
  }
}
function checkedMinorTotal(perUnit, quantity = 1) {
  const unit = perUnit.reduce((sum, value) => sum + value, 0);
  const total2 = unit * quantity;
  if (![...perUnit, unit, total2].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_MINOR_AMOUNT)) {
    throw new DomainError("This fare total exceeds the largest supported amount.");
  }
  return total2;
}
var MAX_MINOR_AMOUNT;
var init_money = __esm({
  "features/keystone/lib/money.ts"() {
    "use strict";
    init_domain_error();
    MAX_MINOR_AMOUNT = 2147483647;
  }
});

// features/keystone/lib/session.ts
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
var LOCAL_TEST_SECRET;
var init_session = __esm({
  "features/keystone/lib/session.ts"() {
    "use strict";
    LOCAL_TEST_SECRET = "local-test-session-secret-not-for-production";
  }
});

// features/keystone/lib/travel-document-key.ts
function travelDocumentTokenizationKey(env = process.env) {
  const configured = env.TRAVEL_DOCUMENT_TOKENIZATION_KEY?.trim();
  if (configured) return configured;
  return import_node_crypto5.default.createHmac("sha256", resolveSessionSecret(env)).update("openfront-airline:travel-document-tokenization:v1").digest("hex");
}
var import_node_crypto5;
var init_travel_document_key = __esm({
  "features/keystone/lib/travel-document-key.ts"() {
    "use strict";
    import_node_crypto5 = __toESM(require("node:crypto"));
    init_session();
  }
});

// features/airline/lib/travel-documents.ts
function travelDocumentsRequired(originCountryCode, destinationCountryCode) {
  const origin = originCountryCode?.trim().toUpperCase() ?? "";
  const destination = destinationCountryCode?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(origin) || !/^[A-Z]{2}$/.test(destination)) return true;
  return origin !== destination;
}
var init_travel_documents = __esm({
  "features/airline/lib/travel-documents.ts"() {
    "use strict";
  }
});

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError("Search date must use YYYY-MM-DD.");
  const date2 = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date2.getTime()) || date2.toISOString().slice(0, 10) !== value) {
    throw new DomainError("Search date must use YYYY-MM-DD.");
  }
  return value;
}
function validatePassengerCount(value) {
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new DomainError("Passenger count must be between 1 and 9.");
  }
  return value;
}
function sessionCarrierId(context) {
  const session = context.session;
  const carrierId = session?.data?.carrier?.id;
  if (!carrierId) throw new DomainError("A carrier-scoped session is required.");
  return carrierId;
}
async function assertCanShop(context, carrierId) {
  if (isStorefrontContext(context) && context.session?.data?.carrier?.id === carrierId) return;
  await requireFreshCarrierPermission(context, "canReadOffers", carrierId);
}
function publicBaggageAllowance(value) {
  try {
    const policy = normalizeIncludedBaggageSnapshot(value);
    return { baggagePieces: policy.pieces, baggageWeightGrams: policy.maxWeightGrams };
  } catch {
    return { baggagePieces: 0, baggageWeightGrams: 0 };
  }
}
async function searchAirlineFlights(_root, args, context) {
  const carrierId = sessionCarrierId(context);
  await assertCanShop(context, carrierId);
  const serviceDate = normalizeSearchDate(args.serviceDate);
  const passengerCount = validatePassengerCount(args.passengerCount ?? 1);
  const originCode = args.originCode.trim().toUpperCase();
  const destinationCode = args.destinationCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(originCode) || !/^[A-Z0-9]{3}$/.test(destinationCode)) {
    throw new DomainError("Origin and destination must be three-character airport codes.");
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
        include: { holds: { where: { status: "active", expiresAt: { gt: /* @__PURE__ */ new Date() } }, select: { quantity: true } }, fareBrand: { select: { code: true, name: true, status: true, description: true, includedBaggage: true } }, cabin: { select: { name: true, cabinClass: true } } },
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
        name: bucket.fareBrand?.name ?? bucket.bookingClassCode,
        description: bucket.fareBrand?.description || null,
        ...publicBaggageAllowance(bucket.fareBrand?.includedBaggage)
      },
      cabinName: bucket.cabin?.name || null,
      currencyCode: bucket.currencyCode,
      baseAmount: bucket.baseAmount,
      taxAmount: bucket.taxAmount,
      totalAmount: checkedMinorTotal([bucket.baseAmount, bucket.taxAmount]),
      perTravelerBaseAmount: bucket.baseAmount,
      perTravelerTaxAmount: bucket.taxAmount,
      perTravelerTotalAmount: checkedMinorTotal([bucket.baseAmount, bucket.taxAmount]),
      partyTotalAmount: checkedMinorTotal([bucket.baseAmount, bucket.taxAmount], passengerCount),
      passengerCount,
      availability,
      ...availability.available < passengerCount ? { unavailableReason: "Not enough seats" } : {},
      inventoryBucketId: bucket.id
    };
  }));
}
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
    throw new DomainError("Complete or release an existing held offer before holding more inventory.");
  }
}
async function createOfferInTransaction(args, context) {
  const sudo = context.sudo();
  const carrierId = sessionCarrierId(context);
  if (!isStorefrontContext(context)) await requireFreshCarrierPermission(context, "canManageOffers", carrierId);
  const key = normalizeIdempotencyKey(args.idempotencyKey);
  const passengerIds = [...new Set(args.passengerIds ?? [])].sort();
  if (!passengerIds.length) throw new DomainError("At least one passenger is required.");
  validatePassengerCount(passengerIds.length);
  const request = { flightInstanceId: args.flightInstanceId, inventoryBucketId: args.inventoryBucketId, passengerIds, storefront: Boolean(args.shoppingSessionHash) };
  const inspected = await inspectOperation(sudo, carrierId, key, "offer.create", request);
  if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
  if (args.shoppingSessionHash) await enforceStorefrontHoldCap(context, carrierId, args.shoppingSessionHash, passengerIds.length);
  const bucketReference = await context.prisma.inventoryBucket.findUnique({ where: { id: args.inventoryBucketId }, select: { carrierId: true, flightInstanceId: true, fareBrandId: true } });
  if (!bucketReference || bucketReference.carrierId !== carrierId || bucketReference.flightInstanceId !== args.flightInstanceId || !bucketReference.fareBrandId) throw new DomainError("The requested inventory is outside this carrier, flight, or active fare catalog.");
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
    query: `id carrier { id code } cabin { id code } status authorized sold held blocked baseAmount taxAmount currencyCode bookingClassCode flightInstance { id status carrier { id } flightNumber serviceDate scheduledDepartureAt scheduledArrivalAt origin { id iataCode } destination { id iataCode } } fareBrand { id code name status includedBaggage }`
  });
  if (!bucket || bucket.carrier.id !== carrierId || bucket.flightInstance?.id !== args.flightInstanceId) {
    throw new DomainError("The requested inventory is outside this carrier or flight.");
  }
  if (bucket.status !== "open") throw new DomainError("This inventory bucket is closed.");
  if (!bucket.cabin?.code) throw new DomainError("This inventory bucket has no cabin.");
  if (!bucket.fareBrand || bucket.fareBrand.status !== "active") throw new DomainError("This fare is no longer active for shopping or holding.");
  if (!bucket.flightInstance || !["scheduled", "open_for_sale", "delayed"].includes(bucket.flightInstance.status) || new Date(bucket.flightInstance.scheduledDepartureAt) <= /* @__PURE__ */ new Date()) throw new DomainError("This dated flight is not open for future sale.");
  const availability = calculateAvailability(bucket);
  if (availability.available < passengerIds.length) throw new DomainError("Not enough inventory for this request.");
  if (args.shoppingSessionHash) {
    const anonymous = await context.prisma.inventoryHold.aggregate({
      where: { inventoryBucketId: bucket.id, status: "active", expiresAt: { gt: /* @__PURE__ */ new Date() }, offer: { shoppingSessionId: { not: "" } } },
      _sum: { quantity: true }
    });
    const anonymousQuota = anonymousHoldQuota(bucket.authorized, passengerIds.length);
    if (Number(anonymous._sum.quantity ?? 0) + passengerIds.length > anonymousQuota) throw new DomainError("Online hold capacity is temporarily full; choose another service or try again after existing holds expire.");
  }
  const passengers = await sudo.query.Passenger.findMany({
    where: { id: { in: passengerIds }, carrier: { id: { equals: carrierId } } },
    query: BOOKING_ACCEPTANCE_PASSENGER_QUERY
  });
  if (passengers.length !== passengerIds.length) throw new DomainError("One or more passengers are outside this carrier.");
  supportedPassengerServiceAllocation({
    carrier: { id: carrierId },
    currencyCode: bucket.currencyCode,
    passengers: passengerIds.map((id2) => ({ id: id2 })),
    items: [{
      id: key,
      itemKey: `${key}:flight`,
      itemType: "flight",
      carrier: { id: carrierId },
      quantity: passengerIds.length,
      passengerReferences: passengerIds,
      currencyCode: bucket.currencyCode,
      flightInstance: bucket.flightInstance,
      inventoryBucket: { id: bucket.id, carrier: bucket.carrier, flightInstance: { id: bucket.flightInstance.id } }
    }]
  }, passengerIds);
  const claim = await beginOperation(sudo, context, carrierId, key, "offer.create", request);
  if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
  try {
    const now = Date.now();
    const expiresAt = new Date(now + 15 * 6e4).toISOString();
    const offerNumber = randomReference(`${bucket.carrier.code}-O-`, 9);
    const totalAmount = checkedMinorTotal([bucket.baseAmount, bucket.taxAmount], passengerIds.length);
    checkedMinorTotal([bucket.baseAmount], passengerIds.length);
    checkedMinorTotal([bucket.taxAmount], passengerIds.length);
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
        passengers: { connect: passengerIds.map((id2) => ({ id: id2 })) }
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
        segmentSnapshot: { cabinCode: bucket.cabin.code, bookingClassCode: bucket.bookingClassCode, fareBrandCode: bucket.fareBrand?.code ?? bucket.bookingClassCode, fareBasisCode: bucket.fareBrand?.code ?? bucket.bookingClassCode, includedBaggage: normalizeIncludedBaggageSnapshot(bucket.fareBrand?.includedBaggage) },
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
    const frozenOffer = await sudo.query.Offer.findOne({ where: { id: offer.id }, query: BOOKING_ACCEPTANCE_OFFER_QUERY });
    if (!frozenOffer) throw new DomainError("Held offer could not be read back before acknowledgement.");
    const result = { resourceType: "Offer", resourceId: offer.id, offerId: offer.id, offerNumber, status: "held", totalAmount, currencyCode: bucket.currencyCode, expiresAt, passengerIds, changed: true, replayed: false, heldSnapshot: acceptedBookingSnapshot(frozenOffer, passengers) };
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
    if (!booking) throw new DomainError("Resource not found or inaccessible.");
    const actor = await requireFreshCarrierPermission(transactionContext, "canManagePayments", booking.carrierId);
    await lockBooking(transactionContext, booking.id);
    booking = await transactionContext.prisma.booking.findUnique({ where: { id: booking.id }, include: { payments: true } });
    if (!booking || booking.carrierId !== actor.carrierId) throw new DomainError("Booking changed while preparing settlement evidence.");
    if (!["capture", "refund"].includes(args.purpose) || !Number.isSafeInteger(args.amount) || args.amount <= 0 || !/^[A-Z]{3}$/.test(args.currencyCode) || !/^[a-f0-9]{64}$/i.test(args.evidenceDigest)) throw new DomainError("Manual evidence is invalid.");
    if (args.currencyCode !== booking.currencyCode || args.purpose === "capture" && args.amount !== booking.totalAmount) throw new DomainError("Settlement evidence must match the booking amount and currency.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { ...args, idempotencyKey: void 0 };
    const inspected = await inspectOperation(sudo, booking.carrierId, key, "manual-payment-evidence.submit", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (args.purpose === "capture" && (!["pending", "confirmed"].includes(booking.status) || !["unpaid", "failed"].includes(booking.paymentStatus))) throw new DomainError("This booking is not eligible for capture evidence.");
    if (args.purpose === "refund" && !["paid", "partially_refunded"].includes(booking.paymentStatus)) throw new DomainError("This booking is not eligible for refund evidence.");
    if (args.purpose === "refund") {
      const captured = booking.payments.reduce((sum, payment) => sum + Number(payment.capturedAmount ?? 0) - Number(payment.refundedAmount ?? 0), 0);
      if (args.amount > captured) throw new DomainError("Refund evidence exceeds the remaining captured amount.");
    }
    const ledgerEntry = await transactionContext.prisma.settlementLedgerEntry.findFirst({ where: { carrierId: booking.carrierId, externalReference: args.externalReference.trim(), ledgerSource: args.ledgerSource.trim(), evidenceDigest: args.evidenceDigest.toLowerCase(), amount: args.amount, currencyCode: args.currencyCode } });
    if (!ledgerEntry) throw new DomainError("An externally imported settlement ledger entry is required.");
    const ledgerLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "SettlementLedgerEntry" WHERE "id" = ${ledgerEntry.id} FOR UPDATE`);
    throwIfKeystonePrismaError(ledgerLock);
    const lockedReplay = await inspectOperation(sudo, booking.carrierId, key, "manual-payment-evidence.submit", request);
    if (lockedReplay.replay) return { ...lockedReplay.replay.result ?? {}, replayed: true };
    const retainedEvidence = await transactionContext.prisma.manualPaymentEvidence.findFirst({ where: { ledgerEntryId: ledgerEntry.id }, select: { id: true } });
    if (retainedEvidence) throw new DomainError("Settlement ledger evidence has already been assigned and cannot fund another operation.");
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
    if (!evidence) throw new DomainError("Resource not found or inaccessible.");
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
    if (currentEvidence?.status !== "submitted" || currentEvidence.submittedById === actor.itemId || !bookingEligible) throw new DomainError("Evidence must be current, booking-eligible, and approved once by a different authorized user.");
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
    if (!evidence) throw new DomainError("Resource not found or inaccessible.");
    const actor = await requireFreshCarrierPermission(transactionContext, "canManagePayments", evidence.carrierId);
    const reason = args.reason.trim();
    if (!reason || reason.length > 500) throw new DomainError("A bounded rejection reason is required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { evidenceId: evidence.id, reason };
    const inspected = await inspectOperation(sudo, evidence.carrierId, key, "manual-payment-evidence.reject", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const evidenceLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${evidence.id} FOR UPDATE`);
    throwIfKeystonePrismaError(evidenceLock);
    const lockedReplay = await inspectOperation(sudo, evidence.carrierId, key, "manual-payment-evidence.reject", request);
    if (lockedReplay.replay) return { ...lockedReplay.replay.result ?? {}, replayed: true };
    const currentEvidence = await transactionContext.prisma.manualPaymentEvidence.findUnique({ where: { id: evidence.id }, select: { status: true, submittedById: true } });
    if (currentEvidence?.status !== "submitted" || currentEvidence.submittedById === actor.itemId) throw new DomainError("Evidence must be submitted and rejected once by a different authorized user.");
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
    if (!booking) throw new DomainError("Booking not found.");
    await requireFreshCarrierPermission(transactionContext, "canManagePayments", booking.carrier.id);
    await lockBooking(transactionContext, booking.id);
    const currentBooking = await transactionContext.prisma.booking.findUnique({
      where: { id: booking.id },
      select: { status: true, paymentStatus: true, payments: { select: { status: true, metadata: true } } }
    });
    const providerReference = args.providerReference.trim();
    const instrumentBrand = args.instrumentBrand?.trim().slice(0, 40) || null;
    const instrumentLast4 = args.instrumentLast4?.trim() || null;
    if (providerReference.length < 6 || providerReference.length > 200 || instrumentLast4 && !/^\d{4}$/.test(instrumentLast4)) throw new DomainError("Payment reference or instrument summary is invalid.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingId: booking.id, providerReference, instrumentBrand, instrumentLast4 };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "payment.capture", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!currentBooking || !["unpaid", "failed"].includes(currentBooking.paymentStatus)) throw new DomainError("Booking payment state is not eligible for capture.");
    if (currentBooking.status === "cancelled") throw new DomainError("Cancelled bookings cannot be paid.");
    if (currentBooking.payments.some((payment2) => {
      const purchaseKind = payment2.metadata?.purchaseKind ?? "booking";
      return purchaseKind !== "seat" && ["authorized", "captured", "partially_refunded", "refunded"].includes(payment2.status);
    })) throw new DomainError("Booking already has an authoritative airfare payment record.");
    const provider = (await sudo.query.PaymentProvider.findMany({
      where: { carrier: { id: { equals: booking.carrier.id } }, status: { equals: "active" }, adapterType: { equals: "manual" } },
      orderBy: [{ providerKey: "asc" }],
      take: 1,
      query: "id providerKey adapterType configuration"
    }))[0];
    if (!provider) throw new DomainError("No active payment provider is configured for this carrier.");
    const providerLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "id" = ${provider.id} FOR UPDATE`);
    throwIfKeystonePrismaError(providerLock);
    const currentProvider = await transactionContext.prisma.paymentProvider.findUnique({ where: { id: provider.id } });
    if (!currentProvider || currentProvider.carrierId !== booking.carrier.id || currentProvider.status !== "active" || !isEvidenceOnlyManualProvider(currentProvider)) throw new DomainError("The payment provider is not an active evidence-only manual settlement boundary.");
    const duplicateProviderReference = await transactionContext.prisma.payment.findFirst({ where: { providerId: currentProvider.id, providerPaymentId: providerReference }, select: { id: true } });
    if (duplicateProviderReference) throw new DomainError("Settlement reference was already captured by this provider.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "payment.capture", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const manualEvidence = currentProvider.adapterType === "manual" ? await transactionContext.prisma.manualPaymentEvidence.findFirst({
      where: { bookingId: booking.id, purpose: "capture", externalReference: providerReference, amount: booking.totalAmount, currencyCode: booking.currencyCode, status: "approved" }
    }) : null;
    if (currentProvider.adapterType === "manual" && !manualEvidence) throw new DomainError("Approved manual settlement evidence is required.");
    if (manualEvidence) {
      const evidenceLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${manualEvidence.id} FOR UPDATE`);
      throwIfKeystonePrismaError(evidenceLock);
    }
    const adapter = getPaymentAdapter(currentProvider);
    const captured = await adapter.capture(currentProvider, {
      attemptKey: claim.storageKey,
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
  return runSerializableTransaction(context, (transactionContext) => processBookingRefundInTransaction(transactionContext, args, { authorize: true }));
}
async function processBookingRefundInTransaction(transactionContext, args, options) {
  {
    if (options.authorize) await requireFreshPermission(transactionContext, "canManagePayments");
    const sudo = transactionContext.sudo();
    let booking = await sudo.query.Booking.findOne({
      where: { id: args.bookingId },
      query: "id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id } payments { id status capturedAmount refundedAmount providerPaymentId metadata session { id providerData } provider { id providerKey adapterType configuration } } tickets { id status coupons { id status } }"
    });
    if (!booking) throw new DomainError("Booking not found.");
    if (options.authorize) await requireFreshCarrierPermission(transactionContext, "canManagePayments", booking.carrier.id);
    if (!Number.isSafeInteger(args.amount) || args.amount <= 0) throw new DomainError("Refund amount must be a positive minor-unit integer.");
    const reason = args.reason.trim();
    const providerReference = args.providerReference.trim();
    if (!["customer_request", "disruption", "schedule_change", "duplicate", "fraud", "other"].includes(reason)) throw new DomainError("Refund reason must use a supported commercial reason code.");
    if (providerReference.length < 6 || providerReference.length > 200) throw new DomainError("A bounded settlement reference is required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingId: booking.id, amount: args.amount, reason, providerReference };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "refund.process", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    await lockBooking(transactionContext, booking.id);
    booking = await sudo.query.Booking.findOne({
      where: { id: booking.id },
      query: "id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id } payments { id status capturedAmount refundedAmount providerPaymentId metadata session { id providerData } provider { id providerKey adapterType configuration } } tickets { id status coupons { id status } }"
    });
    if (!booking) throw new DomainError("Booking changed while preparing the refund.");
    const lockedInspection = await inspectOperation(sudo, booking.carrier.id, key, "refund.process", request);
    if (lockedInspection.replay) return { ...lockedInspection.replay.result ?? {}, replayed: true };
    if ((booking.tickets ?? []).some((ticket) => (ticket.coupons ?? []).some((coupon) => ["boarded", "flown"].includes(coupon.status)))) throw new DomainError("Boarded or flown ticket coupons require an exceptional servicing workflow and cannot be refunded here.");
    const payment = booking.payments.find((candidate) => {
      const purchaseKind = candidate.metadata?.purchaseKind ?? candidate.session?.providerData?.kind ?? "booking";
      return purchaseKind !== "seat" && ["captured", "partially_refunded"].includes(candidate.status);
    });
    if (!payment) throw new DomainError("No captured payment is available to refund.");
    if (options.cardOnly && payment.provider.adapterType !== "stripe") throw new DomainError("This booking was not paid by card online. Contact the airline to cancel it.");
    const remaining = payment.capturedAmount - payment.refundedAmount;
    if (args.amount > remaining) throw new DomainError("Refund amount exceeds the remaining captured amount.");
    const providerLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "PaymentProvider" WHERE "id" = ${payment.provider.id} FOR UPDATE`);
    throwIfKeystonePrismaError(providerLock);
    const duplicateRefundReference = await transactionContext.prisma.refund.findFirst({ where: { providerRefundId: providerReference, payment: { providerId: payment.provider.id } }, select: { id: true } });
    if (duplicateRefundReference) throw new DomainError("Settlement refund reference was already consumed by this provider.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "refund.process", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const manualEvidence = payment.provider.adapterType === "manual" ? await transactionContext.prisma.manualPaymentEvidence.findFirst({
      where: { bookingId: booking.id, purpose: "refund", externalReference: providerReference, amount: args.amount, currencyCode: booking.currencyCode, status: "approved" }
    }) : null;
    if (payment.provider.adapterType === "manual" && !manualEvidence) throw new DomainError("Approved manual refund evidence is required.");
    if (manualEvidence) {
      const evidenceLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ManualPaymentEvidence" WHERE "id" = ${manualEvidence.id} FOR UPDATE`);
      throwIfKeystonePrismaError(evidenceLock);
    }
    const adapter = getPaymentAdapter(payment.provider);
    const refunded = await adapter.refund(payment.provider, {
      attemptKey: claim.storageKey,
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
  }
}
async function issueBookingTickets(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageTicketing");
    return issueBookingTicketsInTransaction(transactionContext, args, { authorize: true });
  });
}
async function issueBookingTicketsInTransaction(transactionContext, args, options) {
  const sudo = transactionContext.sudo();
  const prisma = transactionContext.prisma;
  const bookingQuery = `id status paymentStatus ticketingStatus totalAmount currencyCode carrier { id code } passengers { id passenger { id } }`;
  let booking = await sudo.query.Booking.findOne({ where: { id: args.bookingId }, query: bookingQuery });
  if (!booking) throw new DomainError("Booking not found.");
  if (options.authorize) await requireFreshCarrierPermission(transactionContext, "canManageTicketing", booking.carrier.id);
  await lockBooking(transactionContext, booking.id);
  booking = await sudo.query.Booking.findOne({ where: { id: booking.id }, query: bookingQuery });
  if (!booking) throw new DomainError("Booking changed while preparing ticket issuance.");
  const key = normalizeIdempotencyKey(args.idempotencyKey);
  const request = { bookingId: booking.id };
  const inspected = await inspectOperation(sudo, booking.carrier.id, key, "ticket.issue", request);
  if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
  const readSegments = () => prisma.bookingSegment.findMany({
    where: { bookingId: booking.id },
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
    take: 51,
    select: {
      id: true,
      carrierId: true,
      bookingId: true,
      sequence: true,
      status: true,
      bookingClassCode: true,
      fareBasisCode: true,
      flightInstanceId: true,
      flightInstance: { select: { id: true, carrierId: true, status: true, scheduledDepartureAt: true, estimatedDepartureAt: true, actualDepartureAt: true, actualArrivalAt: true } }
    }
  });
  const initialSegments = await readSegments();
  if (initialSegments.length > 50) throw new DomainError("Booking exceeds the bounded 50-segment ticket-issuance limit.");
  const flightIds = [...new Set(initialSegments.map((segment) => segment.flightInstanceId).filter((id2) => typeof id2 === "string"))].sort();
  if (flightIds.length) {
    const flightLocks = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" IN (${import_client2.Prisma.join(flightIds)}) ORDER BY "id" FOR UPDATE`);
    throwIfKeystonePrismaError(flightLocks);
  }
  const ticketableSegmentsRaw = await readSegments();
  if (ticketableSegmentsRaw.length > 50) throw new DomainError("Booking exceeds the bounded 50-segment ticket-issuance limit.");
  const inspectedAfterFlightLocks = await inspectOperation(sudo, booking.carrier.id, key, "ticket.issue", request);
  if (inspectedAfterFlightLocks.replay) return { ...inspectedAfterFlightLocks.replay.result ?? {}, replayed: true };
  if (booking.paymentStatus !== "paid") throw new DomainError("Capture payment before issuing tickets.");
  if (booking.ticketingStatus !== "not_ticketed") throw new DomainError("Only a never-ticketed booking can receive its initial ticket issuance.");
  if (booking.status !== "confirmed") throw new DomainError("Only confirmed bookings can be ticketed.");
  if (!booking.passengers?.length || booking.passengers.length > 9 || new Set(booking.passengers.map((passenger) => passenger.id)).size !== booking.passengers.length || booking.passengers.some((passenger) => !passenger.id || !passenger.passenger?.id)) {
    throw new DomainError("Booking must have one to nine uniquely linked passengers before ticket issuance.");
  }
  if (ticketableSegmentsRaw.some((segment) => segment.bookingId !== booking.id || segment.carrierId !== booking.carrier.id || segment.flightInstance?.carrierId !== booking.carrier.id)) {
    throw new DomainError("Ticketable itinerary ownership is inconsistent across booking, carrier, or dated service.");
  }
  const now = /* @__PURE__ */ new Date();
  const ticketableSegments = selectCurrentTicketableSegments(ticketableSegmentsRaw, now);
  const [ticketCount, obligationCount, checkInCount, boardingPassCount, seatAssignmentCount, bagCount, ancillaryCouponCount] = await Promise.all([
    prisma.ticket.count({ where: { bookingId: booking.id } }),
    prisma.serviceObligation.count({ where: { bookingId: booking.id } }),
    prisma.checkIn.count({ where: { bookingId: booking.id } }),
    prisma.boardingPass.count({ where: { checkIn: { bookingId: booking.id } } }),
    prisma.seatAssignment.count({ where: { bookingId: booking.id } }),
    prisma.bag.count({ where: { bookingId: booking.id } }),
    prisma.electronicMiscCoupon.count({ where: { document: { bookingId: booking.id } } })
  ]);
  const artifactBlockers = ticketIssuanceArtifactBlockers({ ticketCount, obligationCount, checkInCount, boardingPassCount, seatAssignmentCount, bagCount, ancillaryCouponCount });
  if (artifactBlockers.length) throw new DomainError(`Initial ticket issuance is blocked by existing passenger-service artifacts: ${artifactBlockers.join(", ")}.`);
  const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "ticket.issue", request);
  if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
  const issuedAt = now.toISOString();
  let ticketCountCreated = 0;
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
    ticketCountCreated += 1;
  }
  await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { status: "ticketed", ticketingStatus: "ticketed", ticketedAt: issuedAt } });
  await writeAudit(sudo, transactionContext, {
    carrierId: booking.carrier.id,
    key: claim.storageKey,
    action: "ticket.issue",
    aggregateType: "Booking",
    aggregateId: booking.id,
    after: { status: "ticketed", ticketingStatus: "ticketed" },
    metadata: { ticketCount: ticketCountCreated, currentSegmentCount: ticketableSegments.length }
  });
  const result = { resourceType: "Booking", resourceId: booking.id, status: "ticketed", changed: true, replayed: false };
  await finishOperation(sudo, claim.record.id, result);
  return result;
}
async function registerPassengerTravelDocument(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageSecurePassengerData");
    const bookingPassenger = await transactionContext.prisma.bookingPassenger.findUnique({ where: { id: args.bookingPassengerId }, include: { passenger: true, booking: true } });
    const segment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: args.bookingSegmentId }, include: { flightInstance: true } });
    if (!bookingPassenger || !segment || bookingPassenger.bookingId !== segment.bookingId || bookingPassenger.carrierId !== segment.carrierId) throw new DomainError("Resource not found or inaccessible.");
    const actor = await requireStationCapability(transactionContext, "canManageSecurePassengerData", segment.carrierId, segment.flightInstance.originId, "canCheckIn");
    await lockBooking(transactionContext, bookingPassenger.bookingId);
    const currentBooking = await transactionContext.prisma.booking.findUnique({ where: { id: bookingPassenger.bookingId }, select: { status: true } });
    const currentSegment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: segment.id }, select: { status: true, bookingId: true } });
    if (!currentBooking || !currentSegment || currentSegment.bookingId !== bookingPassenger.bookingId) throw new DomainError("Booking changed while preparing document registration.");
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
    if (!documentTypes.has(args.documentType) || documentNumber.length < 4 || documentNumber.length > 64 || !/^[A-Z]{2}$/.test(issuingCountryCode) || nationalityCode && !/^[A-Z]{2}$/.test(nationalityCode)) throw new DomainError("Travel-document identity fields are invalid.");
    if (Number.isNaN(expiresAt.getTime()) || issuedAt && Number.isNaN(issuedAt.getTime()) || Number.isNaN(verificationExpiresAt.getTime())) throw new DomainError("Document validity dates are invalid.");
    if (!providerReference || providerReference.length > 200 || !evidenceVersion || evidenceVersion.length > 100) throw new DomainError("A bounded manual/provider reference and evidence version are required.");
    const tokenizationKey = travelDocumentTokenizationKey();
    if (tokenizationKey.length < 32) throw new DomainError("Travel-document tokenization is not configured.");
    const documentToken = `tdoc_${import_node_crypto6.default.createHmac("sha256", tokenizationKey).update(`${segment.carrierId}\0${documentNumber}`).digest("hex")}`;
    const documentNumberHash = import_node_crypto6.default.createHash("sha256").update(documentToken).digest("hex");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id, documentType: args.documentType, documentNumberHash, issuingCountryCode, nationalityCode, issuedAt: issuedAt?.toISOString() ?? null, expiresAt: expiresAt.toISOString(), providerReference, evidenceVersion, verificationExpiresAt: verificationExpiresAt.toISOString() };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, segment.carrierId, key, "document.register-verify", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!currentBooking || !currentSegment || currentSegment.bookingId !== bookingPassenger.bookingId || ["cancelled", "completed"].includes(currentBooking.status) || ["cancelled", "refunded", "reaccommodated", "flown"].includes(currentSegment.status)) throw new DomainError("Booking changed while preparing document registration.");
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= /* @__PURE__ */ new Date() || issuedAt && (Number.isNaN(issuedAt.getTime()) || issuedAt > /* @__PURE__ */ new Date() || issuedAt >= expiresAt)) throw new DomainError("Travel-document validity is invalid.");
    if (Number.isNaN(verificationExpiresAt.getTime()) || verificationExpiresAt <= /* @__PURE__ */ new Date() || verificationExpiresAt > expiresAt) throw new DomainError("Verification expiry must be current and no later than the document expiry.");
    const claim = await beginOperation(sudo, transactionContext, segment.carrierId, key, "document.register-verify", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const retained = await transactionContext.prisma.travelDocument.findFirst({ where: { carrierId: segment.carrierId, passengerId: bookingPassenger.passengerId, documentNumberHash } });
    if (retained && ["rejected", "expired", "revoked"].includes(retained.status)) throw new DomainError("A rejected, expired, or revoked travel document cannot be reactivated.");
    if (retained && (retained.documentType !== args.documentType || retained.issuingCountryCode !== issuingCountryCode)) throw new DomainError("Retained travel-document identity does not match this attestation.");
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
      throw new DomainError("Resource not found or inaccessible.");
    }
    await requireStationCapability(transactionContext, "canManageSecurePassengerData", segment.carrierId, segment.flightInstance.originId, "canCheckIn");
    await lockBooking(transactionContext, segment.bookingId);
    const currentBooking = await transactionContext.prisma.booking.findUnique({ where: { id: segment.bookingId }, select: { status: true } });
    const currentSegment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: segment.id }, select: { status: true } });
    if (!currentBooking || !currentSegment) throw new DomainError("Booking changed while preparing document verification.");
    const expiresAt = new Date(args.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new DomainError("Verification expiry is invalid.");
    const providerReference = args.providerReference.trim();
    const evidenceVersion = args.evidenceVersion.trim();
    if (!providerReference || providerReference.length > 200 || !evidenceVersion || evidenceVersion.length > 100) throw new DomainError("A bounded provider/manual reference and evidence version are required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { travelDocumentId: document.id, bookingSegmentId: segment.id, providerReference, evidenceVersion, expiresAt: expiresAt.toISOString() };
    const inspected = await inspectOperation(sudo, segment.carrierId, key, "document.verify", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!currentBooking || !currentSegment || ["cancelled", "completed"].includes(currentBooking.status) || ["cancelled", "refunded", "reaccommodated", "flown"].includes(currentSegment.status)) throw new DomainError("Booking changed while preparing document verification.");
    if (document.status !== "verified" || !document.expiresAt || document.expiresAt <= /* @__PURE__ */ new Date()) throw new DomainError("The travel document is not current.");
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= /* @__PURE__ */ new Date() || expiresAt > document.expiresAt) throw new DomainError("Verification expiry must be current and no later than the document expiry.");
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
      query: "id booking { id status currencyCode carrier { id code } } passenger { id givenName familyName }"
    });
    const segment = await sudo.query.BookingSegment.findOne({
      where: { id: args.bookingSegmentId },
      query: "id status booking { id carrier { id code } } flightInstance { id flightNumber status scheduledDepartureAt estimatedDepartureAt actualDepartureAt actualArrivalAt origin { id iataCode countryCode } destination { id iataCode countryCode } departureGate departureTerminal }"
    });
    if (!bookingPassenger || !segment || bookingPassenger.booking.id !== segment.booking.id) throw new DomainError("Passenger and segment must belong to the same booking.");
    const booking = bookingPassenger.booking;
    if (!customerBookingId) await requireStationCapability(transactionContext, "canManageAirportService", booking.carrier.id, segment.flightInstance.origin.id, "canCheckIn");
    else if (booking.id !== customerBookingId) throw new DomainError("Resource not found or inaccessible.");
    await lockBooking(transactionContext, booking.id);
    const flightLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${segment.flightInstance.id} FOR UPDATE`);
    throwIfKeystonePrismaError(flightLock);
    const currentBooking = await transactionContext.prisma.booking.findUnique({ where: { id: booking.id }, select: { status: true, paymentStatus: true, ticketingStatus: true, accessTokenHash: true, accessTokenExpiresAt: true } });
    const currentSegment = await transactionContext.prisma.bookingSegment.findUnique({ where: { id: segment.id }, select: { bookingId: true, carrierId: true, flightInstanceId: true, status: true, cabinCode: true, flightInstance: { select: { id: true, carrierId: true, status: true, scheduledDepartureAt: true, estimatedDepartureAt: true, actualDepartureAt: true, actualArrivalAt: true, departureGate: true, departureTerminal: true } } } });
    if (!currentBooking || !currentSegment || currentSegment.bookingId !== booking.id || currentSegment.carrierId !== booking.carrier.id || currentSegment.flightInstanceId !== segment.flightInstance.id || currentSegment.flightInstance?.carrierId !== booking.carrier.id || customerBookingId && !hasCurrentStorefrontBookingAccess(currentBooking, args.customerAccessTokenHash)) throw new DomainError("Booking changed or access was revoked while preparing check-in.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: args.bookingSegmentId, seatId: args.seatId ?? null };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "check-in.create", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!["ticketed", "in_progress"].includes(currentBooking.status) || currentBooking.paymentStatus !== "paid" || currentBooking.ticketingStatus !== "ticketed") throw new DomainError("Booking must have a current paid ticket before check-in.");
    if (!["confirmed", "checked_in", "offloaded", "boarded"].includes(currentSegment.status)) throw new DomainError("Segment is not eligible for check-in.");
    assertDatedFlightEligibleForAction(currentSegment.flightInstance, "Check-in", /* @__PURE__ */ new Date());
    const previousCheckIn = await transactionContext.prisma.checkIn.findFirst({
      where: { bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, status: true }
    });
    if (previousCheckIn && previousCheckIn.status !== "offloaded") throw new DomainError("This passenger already has an active or terminal check-in for the itinerary segment.");
    if (previousCheckIn?.status === "offloaded") {
      const priorBags = await transactionContext.prisma.bag.count({
        where: {
          bookingPassengerId: bookingPassenger.id,
          OR: [{ bookingSegmentId: segment.id }, { segments: { some: { id: segment.id } } }]
        }
      });
      if (priorBags > 0) throw new DomainError("Checked baggage must have an authorized, audited physical disposition before re-check-in.");
    }
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
    const documentsRequired = travelDocumentsRequired(segment.flightInstance.origin?.countryCode, segment.flightInstance.destination?.countryCode);
    if (!verification && documentsRequired) throw new DomainError("A current authoritative travel-document verification is required.");
    const couponCandidates = await transactionContext.prisma.ticketCoupon.findMany({
      where: {
        bookingSegmentId: segment.id,
        status: "open",
        ticket: { bookingId: booking.id, bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passenger.id, status: { in: ["issued", "partially_used"] } },
        serviceObligation: { is: { bookingPassengerId: bookingPassenger.id, bookingId: booking.id, status: "active" } }
      },
      include: { serviceObligation: true, ticket: true }
    });
    const coupon = couponCandidates.find((candidate) => candidate.serviceObligation && candidate.serviceObligationVersion === candidate.serviceObligation.currentVersion);
    if (!coupon) throw new DomainError("No current-version open ticket coupon entitles this passenger to this segment.");
    const obligationLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ServiceObligation" WHERE "id" = ${coupon.serviceObligationId} FOR UPDATE`);
    throwIfKeystonePrismaError(obligationLock);
    const couponLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "TicketCoupon" WHERE "id" = ${coupon.id} FOR UPDATE`);
    throwIfKeystonePrismaError(couponLock);
    const currentCoupon = await transactionContext.prisma.ticketCoupon.findUnique({ where: { id: coupon.id }, include: { serviceObligation: true, ticket: true } });
    if (currentCoupon?.status !== "open" || !["issued", "partially_used"].includes(currentCoupon.ticket?.status) || currentCoupon.ticket?.bookingId !== booking.id || currentCoupon.ticket?.bookingPassengerId !== bookingPassenger.id || currentCoupon.ticket?.passengerId !== bookingPassenger.passenger.id || currentCoupon.serviceObligation?.status !== "active" || currentCoupon.serviceObligation.bookingId !== booking.id || currentCoupon.serviceObligation.bookingPassengerId !== bookingPassenger.id || currentCoupon.serviceObligationVersion !== currentCoupon.serviceObligation.currentVersion) throw new DomainError("Ticket coupon service obligation changed while preparing check-in.");
    const claim = await beginOperation(sudo, transactionContext, booking.carrier.id, key, "check-in.create", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const currentFlight = currentSegment.flightInstance;
    const seatMaps = await transactionContext.prisma.seatMap.findMany({
      where: { flightInstanceId: currentFlight.id, status: "published" },
      orderBy: [{ version: "desc" }, { id: "asc" }],
      take: 2,
      include: { seats: { orderBy: [{ designator: "asc" }, { id: "asc" }], take: 1e3, include: { cabin: true } } }
    });
    if (seatMaps.length !== 1) throw new DomainError("Check-in requires exactly one published seat map for the dated flight.");
    const seats = seatMaps.flatMap((seatMap) => (seatMap.seats ?? []).filter((seat) => seat.status === "available" && seat.cabin?.code === currentSegment.cabinCode && (!args.seatId ? Number(seat.surchargeAmount ?? 0) === 0 : seat.id === args.seatId)).map((seat) => ({ ...seat, seatMap }))).sort((left, right) => left.designator.localeCompare(right.designator));
    const assignmentHistory = await transactionContext.prisma.seatAssignment.findMany({
      where: { bookingId: booking.id, bookingPassengerId: bookingPassenger.id, bookingSegmentId: segment.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 51,
      include: { seat: { include: { cabin: true, seatMap: true } } }
    });
    if (assignmentHistory.length > 50) throw new DomainError("Seat-assignment history exceeds the bounded check-in review; reconcile it before check-in.");
    const activeAssignments = assignmentHistory.filter((assignment) => ["held", "assigned", "confirmed"].includes(assignment.status));
    if (activeAssignments.length > 1) throw new DomainError("Multiple active seat-assignment records require an audited seat reconciliation before check-in.");
    if (assignmentHistory.some((assignment) => assignment.amount !== 0)) throw new DomainError("Paid or inconsistent seat assignments require an authorized audited resolution before check-in.");
    if (assignmentHistory.some((assignment) => !activeAssignments.includes(assignment) && !["released", "cancelled"].includes(assignment.status))) throw new DomainError("The prior seat-assignment state is unsupported for check-in.");
    const existingAssignment = activeAssignments[0] ?? null;
    if (existingAssignment && (existingAssignment.bookingId !== booking.id || existingAssignment.bookingPassengerId !== bookingPassenger.id || existingAssignment.passengerId !== bookingPassenger.passenger.id || existingAssignment.bookingSegmentId !== segment.id || existingAssignment.occupancyKey !== `${currentFlight.id}:${existingAssignment.seatId}` || existingAssignment.currencyCode !== booking.currencyCode || existingAssignment.seat?.seatMap?.flightInstanceId !== currentFlight.id || existingAssignment.seat?.seatMap?.status !== "published" || existingAssignment.seat?.status !== "available" || existingAssignment.seatDesignatorSnapshot !== existingAssignment.seat?.designator || existingAssignment.seat?.cabin?.code !== currentSegment.cabinCode || Number(existingAssignment.seat?.surchargeAmount ?? 0) !== 0)) {
      throw new DomainError("The existing seat assignment is inconsistent, paid, unavailable, or not on a published seat map for this dated flight.");
    }
    let selectedSeat = existingAssignment ? seats.find((seat) => seat.id === existingAssignment.seatId && seat.seatMap.id === existingAssignment.seat.seatMapId) : null;
    for (const candidate of existingAssignment ? [] : seats) {
      const lock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "Seat" WHERE "id" = ${candidate.id} FOR UPDATE`);
      throwIfKeystonePrismaError(lock);
      const occupied = await transactionContext.prisma.seatAssignment.findFirst({
        where: { seatId: candidate.id, status: { in: ["held", "assigned", "confirmed", "boarded"] }, bookingSegment: { flightInstanceId: currentFlight.id } },
        select: { id: true }
      });
      if (!occupied) {
        selectedSeat = candidate;
        break;
      }
    }
    if (!selectedSeat) throw new DomainError("No seat is available on a published seat map for this segment.");
    if (args.seatId && existingAssignment && selectedSeat.id !== args.seatId) throw new DomainError("The requested seat differs from the passenger\u2019s existing assignment.");
    if (Number(selectedSeat.surchargeAmount ?? 0) !== 0 || selectedSeat.currencyCode !== booking.currencyCode) throw new DomainError("A paid or currency-inconsistent seat requires an authorized audited entitlement before check-in.");
    const seatAssignment = existingAssignment ? await sudo.query.SeatAssignment.updateOne({ where: { id: existingAssignment.id }, data: { status: "confirmed", confirmedAt: now }, query: "id" }) : await sudo.query.SeatAssignment.createOne({
      data: {
        carrier: { connect: { id: booking.carrier.id } },
        assignmentKey: `${bookingPassenger.id}:${segment.id}:${selectedSeat.id}:${randomReference("", 8)}`,
        occupancyKey: `${currentFlight.id}:${selectedSeat.id}`,
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
      travelDocumentsVerified: Boolean(verification),
      checkedInAt: now,
      offloadedAt: null,
      boardedAt: null,
      booking: { connect: { id: booking.id } },
      bookingPassenger: { connect: { id: bookingPassenger.id } },
      passenger: { connect: { id: bookingPassenger.passenger.id } },
      bookingSegment: { connect: { id: segment.id } },
      flightInstance: { connect: { id: currentFlight.id } },
      seatAssignment: { connect: { id: seatAssignment.id } },
      ticketCoupon: { connect: { id: coupon.id } },
      eligibilityData: verification ? { documentVerificationId: verification.id, evidenceVersion: verification.evidenceVersion, confirmedAt: now } : { travelDocumentsRequired: false, reason: "domestic", confirmedAt: now }
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
        gateSnapshot: currentFlight.departureGate ?? "TBD",
        terminalSnapshot: currentFlight.departureTerminal ?? "TBD"
      },
      query: "id"
    });
    await sudo.query.TicketCoupon.updateOne({ where: { id: coupon.id }, data: { status: "checked_in", checkedInAt: now } });
    const segmentStatus = await currentSegmentServiceStatus(transactionContext.prisma, booking.id, segment.id);
    await sudo.query.BookingSegment.updateOne({ where: { id: segment.id }, data: { status: segmentStatus } });
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
    if (!bookingPassenger || !flight || bookingPassenger.booking.carrierId !== flight.carrierId) throw new DomainError("Resource not found or inaccessible.");
    await requireStationCapability(transactionContext, "canManageAirportService", flight.carrierId, flight.originId, "canAcceptBags");
    await lockBooking(transactionContext, bookingPassenger.bookingId);
    const flightLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${args.flightInstanceId} FOR UPDATE`);
    throwIfKeystonePrismaError(flightLock);
    bookingPassenger = await transactionContext.prisma.bookingPassenger.findUnique({ where: { id: args.bookingPassengerId }, include: { booking: true, passenger: true } });
    flight = await transactionContext.prisma.flightInstance.findUnique({ where: { id: args.flightInstanceId }, include: { carrier: { select: { code: true } }, origin: true, destination: true } });
    if (!bookingPassenger || !flight || bookingPassenger.booking.carrierId !== flight.carrierId) throw new DomainError("Booking or flight changed while preparing bag acceptance.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    if (!Number.isInteger(args.weightGrams) || args.weightGrams < 0 || args.weightGrams > 1e5) throw new DomainError("Bag weight must be an integer between 0 and 100000 grams.");
    const request = { bookingPassengerId: args.bookingPassengerId, flightInstanceId: args.flightInstanceId, weightGrams: args.weightGrams };
    const inspected = await inspectOperation(sudo, flight.carrierId, key, "bag.accept", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (bookingPassenger.booking.paymentStatus !== "paid" || bookingPassenger.booking.ticketingStatus !== "ticketed" || !["ticketed", "in_progress"].includes(bookingPassenger.booking.status)) throw new DomainError("Booking is not eligible for new bag acceptance.");
    assertDatedFlightEligibleForAction(flight, "Checked-bag acceptance", /* @__PURE__ */ new Date());
    const segment = await transactionContext.prisma.bookingSegment.findFirst({
      where: { bookingId: bookingPassenger.bookingId, flightInstanceId: flight.id, status: { in: ["confirmed", "checked_in", "boarded", "offloaded"] } },
      include: {
        checkIns: { where: { bookingPassengerId: bookingPassenger.id, passengerId: bookingPassenger.passengerId, status: "checked_in" }, include: { ticketCoupon: { include: { ticket: true, serviceObligation: true } } } }
      }
    });
    const checkIn = segment?.checkIns?.[0];
    const currentCoupon = checkIn?.ticketCoupon;
    if (!segment || segment.carrierId !== flight.carrierId || segment.bookingId !== bookingPassenger.bookingId || segment.flightInstanceId !== flight.id || !checkIn || checkIn.carrierId !== flight.carrierId || checkIn.bookingId !== bookingPassenger.bookingId || checkIn.bookingPassengerId !== bookingPassenger.id || checkIn.bookingSegmentId !== segment.id || checkIn.flightInstanceId !== flight.id || !currentCoupon || currentCoupon.carrierId !== flight.carrierId || currentCoupon.bookingSegmentId !== segment.id || currentCoupon.status !== "checked_in" || !["issued", "partially_used"].includes(currentCoupon.ticket?.status) || currentCoupon.ticket?.carrierId !== flight.carrierId || currentCoupon.ticket?.bookingId !== bookingPassenger.bookingId || currentCoupon.ticket?.bookingPassengerId !== bookingPassenger.id || currentCoupon.ticket?.passengerId !== bookingPassenger.passengerId || currentCoupon.serviceObligation?.carrierId !== flight.carrierId || currentCoupon.serviceObligation?.status !== "active" || currentCoupon.serviceObligation.bookingId !== bookingPassenger.bookingId || currentCoupon.serviceObligation.bookingPassengerId !== bookingPassenger.id || currentCoupon.serviceObligationVersion == null || currentCoupon.serviceObligationVersion !== currentCoupon.serviceObligation.currentVersion) {
      throw new DomainError("A checked-in passenger with a current-version ticket coupon and service obligation is required for bag acceptance.");
    }
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
    if (!withinIncludedAllowance && !paidCoupon) throw new DomainError("No unused checked-bag entitlement with matching amount, currency, passenger, segment, and weight covers this bag.");
    if (paidCoupon) {
      const entitlementLock = await transactionContext.prisma.$queryRaw(import_client2.Prisma.sql`SELECT "id" FROM "ElectronicMiscCoupon" WHERE "id" = ${paidCoupon.id} FOR UPDATE`);
      throwIfKeystonePrismaError(entitlementLock);
      const currentEntitlement = await transactionContext.prisma.electronicMiscCoupon.findUnique({ where: { id: paidCoupon.id }, select: { status: true } });
      if (currentEntitlement?.status !== "open") throw new DomainError("The checked-bag entitlement was already consumed.");
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
var import_node_crypto6, import_client2, MAX_ACTIVE_STOREFRONT_OFFERS, MAX_ACTIVE_STOREFRONT_HELD_SEATS;
var init_airlineWorkflows = __esm({
  "features/keystone/mutations/airlineWorkflows.ts"() {
    "use strict";
    init_segment_service_status();
    import_node_crypto6 = __toESM(require("node:crypto"));
    import_client2 = require("@prisma/client");
    init_access();
    init_airlineOperations();
    init_transactions();
    init_payment();
    init_bounded_payment_policy();
    init_storefront_capacity();
    init_passenger_service_allocation();
    init_booking_acceptance();
    init_storefront_session();
    init_snapshots();
    init_coupon_lineage();
    init_money();
    init_service_eligibility();
    init_domain_error();
    init_travel_document_key();
    init_travel_documents();
    MAX_ACTIVE_STOREFRONT_OFFERS = 2;
    MAX_ACTIVE_STOREFRONT_HELD_SEATS = 9;
  }
});

// features/keystone/lib/mail.ts
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK.replace(/\/+$/, "");
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  console.warn("SMTP_STORE_LINK not set. Email links will be relative.");
  return "";
}
function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}
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
  if (!emailConfigured()) {
    console.warn("Password reset email not sent: SMTP_HOST and SMTP_FROM are not configured.");
    throw new Error("Email is not configured.");
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
function bookingConfirmationEmail(booking, manageUrl) {
  const brandName = escapeHtml(safeCarrierName(booking.carrierName));
  const rows = booking.segments.map((segment) => `<tr><td style="padding:6px 0;font-family:Menlo,Consolas,monospace;">${escapeHtml(booking.carrierCode)} ${escapeHtml(segment.flightNumber)}</td><td style="padding:6px 0;font-family:Menlo,Consolas,monospace;">${escapeHtml(segment.originCode)} \u2013 ${escapeHtml(segment.destinationCode)}</td><td style="padding:6px 0;">${escapeHtml(segment.departureLabel)}</td></tr>`).join("");
  return `
    <body style="background:#f5f2eb;margin:0;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#fffdf8;border-radius:16px;font-family:Helvetica,Arial,sans-serif;color:#0f1b2d;">
        <tr><td style="padding:24px 28px 8px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b7689;">${brandName} \xB7 Reservation</td></tr>
        <tr><td style="padding:0 28px;font-family:Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:.18em;">${escapeHtml(booking.recordLocator)}</td></tr>
        <tr><td style="padding:16px 28px 0;"><table width="100%" style="font-size:14px;">${rows}</table></td></tr>
        <tr><td style="padding:12px 28px 0;font-size:14px;">${booking.travelers.map(escapeHtml).join(", ")}</td></tr>
        <tr><td style="padding:12px 28px 0;font-size:16px;font-weight:700;">${escapeHtml(booking.totalLabel)}</td></tr>
        <tr><td style="padding:20px 28px 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7689;">Access code</td></tr>
        <tr><td style="padding:6px 28px 0;font-family:Menlo,Consolas,monospace;font-size:12px;word-break:break-all;">${escapeHtml(booking.accessToken)}</td></tr>
        <tr><td style="padding:24px 28px 28px;"><a href="${escapeHtml(manageUrl)}" style="background:#0f1b2d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;display:inline-block;">Manage booking</a></td></tr>
      </table>
    </body>
  `;
}
async function sendBookingConfirmationEmail(booking) {
  if (!emailConfigured()) {
    console.warn(`Booking confirmation for ${booking.recordLocator} not emailed: SMTP is not configured.`);
    return false;
  }
  try {
    const manageUrl = `${getBaseUrlForEmails()}/manage-booking?ref=${encodeURIComponent(booking.recordLocator)}`;
    await transport.sendMail({
      to: booking.to,
      from: process.env.SMTP_FROM,
      subject: `${safeCarrierName(booking.carrierName)} reservation ${booking.recordLocator}`,
      html: bookingConfirmationEmail(booking, manageUrl)
    });
    return true;
  } catch (error) {
    console.error(`Booking confirmation for ${booking.recordLocator} could not be emailed:`, error instanceof Error ? error.message : "unknown error");
    return false;
  }
}
function bookingNoticeEmail(notice, manageUrl) {
  const brandName = escapeHtml(safeCarrierName(notice.carrierName));
  const lines = notice.lines.map((line) => `<tr><td style="padding:8px 28px 0;font-size:15px;line-height:1.5;">${escapeHtml(line)}</td></tr>`).join("");
  return `
    <body style="background:#f5f2eb;margin:0;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#fffdf8;border-radius:16px;font-family:Helvetica,Arial,sans-serif;color:#0f1b2d;">
        <tr><td style="padding:24px 28px 8px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b7689;">${brandName} \xB7 ${escapeHtml(notice.recordLocator)}</td></tr>
        <tr><td style="padding:0 28px;font-size:24px;font-weight:700;">${escapeHtml(notice.heading)}</td></tr>
        ${lines}
        <tr><td style="padding:24px 28px 28px;"><a href="${escapeHtml(manageUrl)}" style="background:#0f1b2d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;display:inline-block;">Manage booking</a></td></tr>
      </table>
    </body>
  `;
}
async function sendBookingNoticeEmail(notice) {
  if (!emailConfigured()) {
    console.warn(`Booking notice for ${notice.recordLocator} not emailed: SMTP is not configured.`);
    return false;
  }
  try {
    const manageUrl = `${getBaseUrlForEmails()}/manage-booking?ref=${encodeURIComponent(notice.recordLocator)}`;
    await transport.sendMail({ to: notice.to, from: process.env.SMTP_FROM, subject: `${safeCarrierName(notice.carrierName)}: ${notice.subject}`, html: bookingNoticeEmail(notice, manageUrl) });
    return true;
  } catch (error) {
    console.error(`Booking notice for ${notice.recordLocator} could not be emailed:`, error instanceof Error ? error.message : "unknown error");
    return false;
  }
}
var import_nodemailer, smtpPort, transport;
var init_mail = __esm({
  "features/keystone/lib/mail.ts"() {
    "use strict";
    import_nodemailer = require("nodemailer");
    smtpPort = process.env.SMTP_PORT ? Number.parseInt(process.env.SMTP_PORT, 10) : void 0;
    transport = (0, import_nodemailer.createTransport)({
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
  }
});

// features/airline/lib/time.ts
function formatAirportTime(value, timeZone) {
  if (value === null || value === void 0 || value === "") return null;
  const date2 = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date2.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { ...FIELDS, timeZone: timeZone || "UTC" }).format(date2);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...FIELDS, timeZone: "UTC" }).format(date2);
  }
}
var FIELDS;
var init_time = __esm({
  "features/airline/lib/time.ts"() {
    "use strict";
    FIELDS = { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  }
});

// features/keystone/lib/rate-limit.ts
function rateLimitKey(scope, signal) {
  return import_node_crypto7.default.createHash("sha256").update(`${scope}\0${signal}`).digest("hex");
}
async function isDurableRateLimitExhausted(prisma, scope, signal, limit) {
  const rows = await prisma.$queryRaw(import_client3.Prisma.sql`
    SELECT "count" FROM "RateLimitBucket" WHERE "key" = ${rateLimitKey(scope, signal)} AND "expiresAt" > ${/* @__PURE__ */ new Date()}
  `);
  return (rows[0]?.count ?? 0) >= limit;
}
async function consumeDurableRateLimit(prisma, scope, signal, limit, windowMs) {
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const key = rateLimitKey(scope, signal);
  const rows = await prisma.$queryRaw(import_client3.Prisma.sql`
    INSERT INTO "RateLimitBucket" ("id", "key", "scope", "count", "windowStartedAt", "expiresAt", "createdAt", "updatedAt")
    VALUES (${import_node_crypto7.default.randomUUID()}, ${key}, ${scope}, 1, ${now}, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStartedAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now} ELSE "RateLimitBucket"."windowStartedAt" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "count"
  `);
  if (!rows[0] || rows[0].count > limit) throw new DomainError("This request cannot be completed right now.", "RATE_LIMITED");
}
var import_node_crypto7, import_client3;
var init_rate_limit = __esm({
  "features/keystone/lib/rate-limit.ts"() {
    "use strict";
    import_node_crypto7 = __toESM(require("node:crypto"));
    import_client3 = require("@prisma/client");
    init_domain_error();
  }
});

// features/keystone/lib/request-identity.ts
function normalizeAddress(value) {
  const address = value.trim();
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}
function configuredTrustedProxies() {
  const configured = process.env.TRUSTED_PROXY_IPS?.split(",").map(normalizeAddress).filter(Boolean) ?? [];
  const valid = configured.every((address) => import_node_net2.default.isIP(address) !== 0) ? configured : [];
  if (process.env.NODE_ENV !== "production") return /* @__PURE__ */ new Set([...valid, "127.0.0.1", "::1"]);
  return new Set(valid);
}
function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && (0, import_node_crypto8.timingSafeEqual)(leftBuffer, rightBuffer);
}
function verifiedInternalIdentity(headers, socketAddress, secret = String(process.env.SESSION_SECRET || ""), now = Date.now()) {
  const loopback = /^(?:127\.|::1$|::ffff:127\.)/.test(String(socketAddress || ""));
  if (!loopback || secret.length < 32) return null;
  const identity = String(headers["x-openfront-client-identity"] || "");
  const timestamp41 = String(headers["x-openfront-client-timestamp"] || "");
  const signature = String(headers["x-openfront-client-signature"] || "");
  if (!/^[a-f0-9]{64}$/.test(identity) || !/^\d{10}$/.test(timestamp41) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const age = Math.abs(now - Number(timestamp41) * 1e3);
  if (!Number.isFinite(age) || age > INTERNAL_IDENTITY_MAX_AGE_MS) return null;
  const expected = (0, import_node_crypto8.createHmac)("sha256", secret).update(`${timestamp41}:${identity}`).digest("hex");
  return safeEqual(signature, expected) ? `forwarded:${identity}` : null;
}
function railwayEdgeClientAddress(request) {
  if (!process.env.RAILWAY_ENVIRONMENT) return null;
  const peer = normalizeAddress(request.socket?.remoteAddress ?? "");
  if (!peer || /^(?:127\.|::1$)/.test(peer)) return null;
  const raw = request.headers?.["x-real-ip"];
  const value = normalizeAddress(String(Array.isArray(raw) ? raw[0] ?? "" : raw ?? ""));
  if (!value || value.length > 64 || value.includes(",") || import_node_net2.default.isIP(value) === 0) return null;
  return value.toLowerCase();
}
function trustedClientAddress(request) {
  const internal = verifiedInternalIdentity(request.headers ?? {}, request.socket?.remoteAddress);
  if (internal) return internal;
  const edge = railwayEdgeClientAddress(request);
  if (edge) return edge;
  const peer = normalizeAddress(request.socket?.remoteAddress ?? "");
  if (!peer || import_node_net2.default.isIP(peer) === 0) return "unknown";
  const trusted = configuredTrustedProxies();
  if (!trusted.has(peer)) return peer;
  const raw = request.headers?.["x-forwarded-for"];
  const forwarded = Array.isArray(raw) ? raw.join(",") : raw;
  if (!forwarded) return peer;
  const hops = forwarded.length > 4096 ? [] : forwarded.split(",").map(normalizeAddress);
  if (!hops.length || hops.length > 32 || hops.some((address) => import_node_net2.default.isIP(address) === 0)) return "unknown";
  let current = peer;
  for (let index = hops.length - 1; index >= 0 && trusted.has(current); index--) current = hops[index];
  return current;
}
function durableRequestFingerprint(request, sessionSignal) {
  return import_node_crypto8.default.createHash("sha256").update(`${trustedClientAddress(request)}\0${sessionSignal ?? ""}`).digest("hex");
}
var import_node_crypto8, import_node_net2, INTERNAL_IDENTITY_MAX_AGE_MS;
var init_request_identity = __esm({
  "features/keystone/lib/request-identity.ts"() {
    "use strict";
    import_node_crypto8 = __toESM(require("node:crypto"));
    import_node_net2 = __toESM(require("node:net"));
    INTERNAL_IDENTITY_MAX_AGE_MS = 9e4;
  }
});

// features/airline/lib/branding.ts
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
var STOREFRONT_BRAND_COLORS;
var init_branding = __esm({
  "features/airline/lib/branding.ts"() {
    "use strict";
    STOREFRONT_BRAND_COLORS = [
      { value: "navy", label: "Navy", hex: "#0a3161", hover: "#072448", soft: "#eaf1f8" },
      { value: "slate", label: "Slate", hex: "#334155", hover: "#1e293b", soft: "#f1f5f9" },
      { value: "blue", label: "Blue", hex: "#1d4ed8", hover: "#1e40af", soft: "#eff6ff" },
      { value: "rose", label: "Rose", hex: "#be123c", hover: "#9f1239", soft: "#fff1f2" },
      { value: "emerald", label: "Emerald", hex: "#047857", hover: "#065f46", soft: "#ecfdf5" },
      { value: "amber", label: "Amber", hex: "#92400e", hover: "#78350f", soft: "#fffbeb" }
    ];
  }
});

// features/keystone/mutations/storefrontPayments.ts
async function activeStripeProvider(prisma, carrierId) {
  const providers = await prisma.paymentProvider.findMany({
    where: { carrierId, adapterType: "stripe", status: "active" },
    orderBy: [{ providerKey: "asc" }],
    take: 5,
    select: { id: true, providerKey: true, credentials: true }
  });
  const provider = providers.find((candidate) => stripeSecretKey(candidate.credentials));
  return provider ? { id: provider.id, providerKey: provider.providerKey, secretKey: stripeSecretKey(provider.credentials) } : null;
}
async function onlinePaymentEnabled(prisma, carrierId) {
  return Boolean(await activeStripeProvider(prisma, carrierId));
}
function storefrontOrigin(context) {
  if (process.env.SMTP_STORE_LINK) return process.env.SMTP_STORE_LINK.replace(/\/+$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  const headers = context.req?.headers ?? {};
  const first = (value) => (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim();
  const host = first(headers["x-forwarded-host"]) || first(headers.host);
  if (!host || !/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) throw new DomainError("Online payment isn\u2019t available right now.");
  const protocol = first(headers["x-forwarded-proto"]) === "http" || host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${protocol}://${host}`;
}
async function payableBooking(context, carrierCode, recordLocator, accessToken) {
  if (!await isConfiguredPublicCarrier(context.prisma, carrierCode)) throw new DomainError("Carrier is unavailable on this storefront.");
  const owned = await ownedBooking(context, recordLocator, accessToken);
  const booking = await context.prisma.booking.findUnique({
    where: { id: owned.id },
    select: { id: true, carrierId: true, recordLocator: true, status: true, paymentStatus: true, ticketingStatus: true, totalAmount: true, currencyCode: true, contactEmail: true, metadata: true }
  });
  if (!booking || booking.carrierId !== owned.carrier.id) throw new DomainError("Booking not found or inaccessible.");
  return { booking, carrier: owned.carrier };
}
async function startCustomerCheckout(_root, args, context) {
  const { booking, carrier } = await payableBooking(context, args.carrierCode, args.recordLocator, args.accessToken);
  if (booking.status === "cancelled") throw new DomainError("Cancelled bookings can\u2019t be paid.");
  if (!["unpaid", "failed"].includes(booking.paymentStatus)) throw new DomainError("This booking is already paid.");
  const dueAt = Date.parse(booking.metadata?.paymentDueAt ?? "");
  if (Number.isFinite(dueAt) && dueAt <= Date.now()) throw new DomainError("The payment window for this reservation has closed. Contact the airline.");
  const provider = await activeStripeProvider(context.prisma, carrier.id);
  if (!provider) throw new DomainError("Online payment isn\u2019t available for this airline.");
  await consumeDurableRateLimit(context.prisma, "storefront.checkout.client", durableRequestFingerprint(context.req ?? {}), 20, 15 * 6e4);
  const origin = storefrontOrigin(context);
  const locator = encodeURIComponent(booking.recordLocator);
  let session;
  try {
    session = await createStripeCheckoutSession(provider.secretKey, {
      bookingId: booking.id,
      recordLocator: booking.recordLocator,
      description: `${carrier.name} reservation ${booking.recordLocator}`,
      amount: booking.totalAmount,
      currencyCode: booking.currencyCode,
      customerEmail: booking.contactEmail,
      successUrl: `${origin}/manage-booking?ref=${locator}&checkout={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/manage-booking?ref=${locator}&checkout=cancelled`,
      // One Checkout session per booking amount and ten-minute window: double clicks reuse it.
      idempotencyKey: `checkout:${booking.id}:${booking.totalAmount}:${Math.floor(Date.now() / 6e5)}`
    });
  } catch (error) {
    console.error("Stripe checkout could not start:", error instanceof Error ? error.message : "unknown error");
    throw new DomainError("Online payment couldn\u2019t start. Try again in a moment.");
  }
  if (!session.url) throw new DomainError("Online payment couldn\u2019t start. Try again in a moment.");
  await context.prisma.booking.update({ where: { id: booking.id }, data: { metadata: { ...booking.metadata ?? {}, checkoutSessionId: session.id } } });
  return { url: session.url, checkoutSessionId: session.id };
}
async function completeCustomerCheckout(_root, args, context) {
  const { booking, carrier } = await payableBooking(context, args.carrierCode, args.recordLocator, args.accessToken);
  const sessionId = args.checkoutSessionId?.trim() || (typeof booking.metadata?.checkoutSessionId === "string" ? booking.metadata.checkoutSessionId : "");
  if (booking.paymentStatus === "paid") return { status: "paid", ticketingStatus: booking.ticketingStatus };
  if (!sessionId) return { status: "none", ticketingStatus: booking.ticketingStatus };
  const provider = await activeStripeProvider(context.prisma, carrier.id);
  if (!provider) return { status: "none", ticketingStatus: booking.ticketingStatus };
  let session;
  try {
    session = await retrieveStripeCheckoutSession(provider.secretKey, sessionId);
  } catch {
    throw new DomainError("We couldn\u2019t confirm your payment yet. Retrieve your booking again in a moment.");
  }
  if (session.client_reference_id !== booking.id || session.metadata?.bookingId !== booking.id) throw new DomainError("This payment doesn\u2019t belong to this booking.");
  if (session.payment_status !== "paid") return { status: session.status === "expired" ? "expired" : "pending", ticketingStatus: booking.ticketingStatus };
  if (session.amount_total !== booking.totalAmount || session.currency?.toUpperCase() !== booking.currencyCode) throw new DomainError("The paid amount doesn\u2019t match this booking. Contact the airline.");
  const intent = typeof session.payment_intent === "string" ? { id: session.payment_intent, latest_charge: null } : session.payment_intent;
  if (!intent?.id) throw new DomainError("We couldn\u2019t confirm your payment yet. Retrieve your booking again in a moment.");
  const charge = intent.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const card = charge?.payment_method_details?.card;
  await runSerializableTransaction(context, async (transactionContext) => {
    const sudo = transactionContext.sudo();
    const lock = await transactionContext.prisma.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`;
    throwIfKeystonePrismaError(lock);
    const key = `stripe-checkout:${session.id}`;
    const request = { bookingId: booking.id, checkoutSessionId: session.id, paymentIntentId: intent.id, amount: booking.totalAmount, currencyCode: booking.currencyCode };
    const inspected = await inspectOperation(sudo, carrier.id, key, "payment.checkout", request);
    if (inspected.replay) return;
    const current = await transactionContext.prisma.booking.findUnique({ where: { id: booking.id }, select: { status: true, paymentStatus: true, payments: { select: { providerPaymentId: true } } } });
    if (!current) throw new DomainError("Booking not found or inaccessible.");
    if (current.payments.some((payment2) => payment2.providerPaymentId === intent.id)) return;
    if (current.status === "cancelled" || !["unpaid", "failed"].includes(current.paymentStatus)) {
      console.error(`Stripe payment ${intent.id} arrived for booking ${booking.id} in state ${current.status}/${current.paymentStatus}; needs operator refund review.`);
      throw new DomainError("Your payment was received but the booking changed. Contact the airline.");
    }
    const claim = await beginOperation(sudo, transactionContext, carrier.id, key, "payment.checkout", request);
    if (claim.replay) return;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payment = await sudo.query.Payment.createOne({
      data: {
        carrier: { connect: { id: carrier.id } },
        paymentKey: `PAY-${randomReference("", 12)}`,
        idempotencyKey: claim.storageKey,
        booking: { connect: { id: booking.id } },
        provider: { connect: { id: provider.id } },
        status: "captured",
        amount: booking.totalAmount,
        authorizedAmount: booking.totalAmount,
        capturedAmount: booking.totalAmount,
        currencyCode: booking.currencyCode,
        providerPaymentId: intent.id,
        providerCaptureId: charge?.id ?? "",
        instrumentBrand: card?.brand ?? "card",
        instrumentLast4: card?.last4 && /^\d{4}$/.test(card.last4) ? card.last4 : null,
        authorizedAt: now,
        capturedAt: now,
        rawProviderData: { checkoutSessionId: session.id, paymentIntentId: intent.id, chargeId: charge?.id ?? null },
        metadata: { adapterType: "stripe", purchaseKind: "booking", checkoutSessionId: session.id }
      },
      query: "id"
    });
    await sudo.query.Booking.updateOne({ where: { id: booking.id }, data: { paymentStatus: "paid", ...current.status === "pending" ? { status: "confirmed", confirmedAt: now } : {} } });
    await writeAudit(sudo, transactionContext, {
      carrierId: carrier.id,
      key: claim.storageKey,
      action: "payment.checkout",
      aggregateType: "Booking",
      aggregateId: booking.id,
      after: { paymentStatus: "paid", amount: booking.totalAmount, currencyCode: booking.currencyCode },
      metadata: { paymentId: payment.id, providerId: provider.id }
    });
    await finishOperation(sudo, claim.record.id, { resourceType: "Payment", resourceId: payment.id, status: "captured", changed: true, replayed: false });
  });
  let ticketingStatus = "not_ticketed";
  try {
    await runSerializableTransaction(context, (transactionContext) => issueBookingTicketsInTransaction(transactionContext, { bookingId: booking.id, idempotencyKey: `checkout-ticketing:${session.id}` }, { authorize: false }));
    ticketingStatus = "ticketed";
  } catch (error) {
    const latest = await context.prisma.booking.findUnique({ where: { id: booking.id }, select: { ticketingStatus: true } });
    ticketingStatus = latest?.ticketingStatus ?? "not_ticketed";
    if (ticketingStatus !== "ticketed") console.error(`Tickets for paid booking ${booking.id} need operator issuance:`, error instanceof Error ? error.message : "unknown error");
  }
  return { status: "paid", ticketingStatus };
}
var init_storefrontPayments = __esm({
  "features/keystone/mutations/storefrontPayments.ts"() {
    "use strict";
    init_stripe();
    init_domain_error();
    init_rate_limit();
    init_request_identity();
    init_transactions();
    init_airlineOperations();
    init_airlineWorkflows();
    init_storefront();
  }
});

// features/keystone/mutations/storefront.ts
async function consumeRateLimit(context, scope, limit, windowMs, sessionSignal) {
  const request = context.req ?? {};
  await consumeDurableRateLimit(context.prisma, `${scope}.client`, durableRequestFingerprint(request), limit, windowMs);
  if (sessionSignal) await consumeDurableRateLimit(context.prisma, `${scope}.session`, durableRequestFingerprint(request, sessionSignal), limit, windowMs);
}
function bookingAccessToken(shoppingSessionToken, offerId) {
  return import_node_crypto9.default.createHmac("sha256", shoppingSessionToken).update(`booking-access:${offerId}`).digest("base64url");
}
function requiredText2(value, label, max = 120) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > max) throw new DomainError(`${label} is required and must be at most ${max} characters.`);
  return normalized;
}
function email(value) {
  const normalized = requiredText2(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new DomainError("Enter a valid email address.");
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
  if (!carrier) throw new DomainError("Direct sales are not available for this carrier.");
  const storefrontBrandColor = normalizeStorefrontBrandColor(carrier.storefrontBrandColor);
  const storefrontConfigured = hasConfiguredStorefrontBrand({ ...carrier, storefrontBrandColor });
  if (!storefrontConfigured) throw new DomainError("Online booking isn\u2019t available right now. Please try again later.");
  return { ...carrier, storefrontBrandColor, storefrontConfigured, salesEnabled: true };
}
async function lookupCarrierIdentity(prisma, carrierCode) {
  const carrier = await prisma.carrier.findUnique({
    where: { code: carrierCode.trim().toUpperCase() },
    select: { id: true, code: true, name: true, legalName: true, defaultCurrencyCode: true, defaultTimezone: true, status: true, directSalesEnabled: true, logoIcon: true, logoColor: true, storefrontBrandColor: true, storefrontHomepageTitle: true, storefrontHomepageDescription: true, storefrontContactEmail: true, storefrontContactPhone: true, storefrontServiceHours: true }
  });
  if (!carrier) throw new DomainError("Carrier identity is not configured.");
  const storefrontBrandColor = normalizeStorefrontBrandColor(carrier.storefrontBrandColor);
  const storefrontConfigured = hasConfiguredStorefrontBrand({ ...carrier, storefrontBrandColor });
  return { ...carrier, storefrontBrandColor, storefrontConfigured, salesEnabled: storefrontConfigured && carrier.status === "active" && carrier.directSalesEnabled === true };
}
function operatorOnlyLaunchSetup(env = process.env) {
  return env.NODE_ENV === "production" && env.ALLOW_INCOMPLETE_LAUNCH_SETUP === "true";
}
async function configuredPublicCarrierCode(prisma, env = process.env) {
  const configured = env.STOREFRONT_CARRIER_CODE?.trim().toUpperCase() || (await prisma.carrier.findFirst({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { code: true } }))?.code || "";
  if (!/^[A-Z0-9]{2,3}$/.test(configured)) throw new DomainError("Public carrier configuration is unavailable.");
  return configured;
}
async function isConfiguredPublicCarrier(prisma, carrierCode, env = process.env) {
  return carrierCode.trim().toUpperCase() === await configuredPublicCarrierCode(prisma, env);
}
async function assertConfiguredPublicCarrier(prisma, carrierCode) {
  if (!await isConfiguredPublicCarrier(prisma, carrierCode)) throw new DomainError("Carrier is unavailable on this storefront.");
}
async function directCarrier(context, carrierCode) {
  await assertConfiguredPublicCarrier(context.prisma, carrierCode);
  if (operatorOnlyLaunchSetup()) throw new DomainError("Online booking isn\u2019t available yet. Please check back soon.");
  return lookupDirectCarrier(context.prisma, carrierCode);
}
async function getPublicCarrierIdentity(_root, args, context) {
  await assertConfiguredPublicCarrier(context.prisma, args.carrierCode);
  try {
    const carrierIdentity = await lookupCarrierIdentity(context.prisma, args.carrierCode);
    const identity = { ...carrierIdentity, accessRecoveryEnabled: accessRecoveryEnabled(), onlinePaymentEnabled: await onlinePaymentEnabled(context.prisma, carrierIdentity.id) };
    return operatorOnlyLaunchSetup() ? { ...identity, salesEnabled: false } : identity;
  } catch (error) {
    if (error instanceof Error && error.message === "Carrier identity is not configured.") return null;
    throw error;
  }
}
async function publicAirlineFlightOptions(root, args, context) {
  const carrier = await directCarrier(context, args.carrierCode);
  return searchAirlineFlights(root, args, withStorefrontSession(context, carrier));
}
function normalizePublicFlightStatusInput(input) {
  const flightNumber = input.flightNumber.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(flightNumber)) throw new DomainError("Flight number must contain one to six letters or digits.");
  return { flightNumber, serviceDate: normalizeSearchDate(input.serviceDate) };
}
async function publicFlightStatuses(_root, args, context) {
  await assertConfiguredPublicCarrier(context.prisma, args.carrierCode);
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
      origin: { select: { iataCode: true, city: true, timezone: true } },
      destination: { select: { iataCode: true, city: true, timezone: true } },
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
    originTimezone: flight.origin.timezone,
    destinationTimezone: flight.destination.timezone,
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
  const carrier = await directCarrier(context, args.carrierCode);
  const storefrontContext = withStorefrontSession(context, carrier);
  const prepare = async (prisma) => {
    const flight = await prisma.flightInstance.findFirst({
      where: { id: args.flightInstanceId, carrierId: carrier.id, status: { in: ["scheduled", "open_for_sale", "delayed"] }, scheduledDepartureAt: { gt: /* @__PURE__ */ new Date() } },
      select: { id: true, serviceDate: true }
    });
    if (!flight) throw new DomainError("The selected flight is not available for direct sale.");
    validatePassengerCount(args.passengers.length);
    const departureDate = /* @__PURE__ */ new Date(`${flight.serviceDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const normalizedPassengers = args.passengers.map((input, index) => {
      const dateOfBirth = travelerDateOfBirth(input.dateOfBirth, departureDate);
      if (!dateOfBirth) throw new DomainError(`Enter a valid date of birth for traveler ${index + 1}.`);
      return {
        passengerKey: `${carrier.code}:WEB:${import_node_crypto9.default.createHash("sha256").update(`${shoppingSessionHash}\0${args.idempotencyKey}\0${index}`).digest("hex").slice(0, 32)}`,
        carrierId: carrier.id,
        givenName: requiredText2(input.givenName, `Passenger ${index + 1} given name`, 80),
        familyName: requiredText2(input.familyName, `Passenger ${index + 1} family name`, 80),
        dateOfBirth,
        // Travelers after the lead may leave contact details blank; they share the lead traveler's.
        email: email(input.email?.trim() ? input.email : args.passengers[0]?.email ?? ""),
        phone: input.phone?.trim().slice(0, 40) || ""
      };
    });
    if (!hasAccompanyingAdult(normalizedPassengers.map((passenger) => passenger.dateOfBirth), departureDate)) throw new DomainError("Each booking needs at least one traveler aged 18 or over.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { carrierId: carrier.id, flightInstanceId: args.flightInstanceId, inventoryBucketId: args.inventoryBucketId, shoppingSessionHash, passengers: normalizedPassengers.map((passenger) => ({ ...passenger, dateOfBirth: passenger.dateOfBirth.toISOString() })) };
    return { key, request, normalizedPassengers };
  };
  const prepared = await prepare(storefrontContext.prisma);
  const inspected = await inspectOperation(storefrontContext.sudo(), carrier.id, prepared.key, "customer-offer.create", prepared.request);
  if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
  await consumeRateLimit(context, "storefront.offer", 10, 15 * 6e4, shoppingSessionHash);
  return runSerializableTransaction(storefrontContext, async (transactionContext) => {
    const { key, request, normalizedPassengers } = await prepare(transactionContext.prisma);
    const sudo = transactionContext.sudo();
    const claim = await beginOperation(sudo, transactionContext, carrier.id, key, "customer-offer.create", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const passengerIds = [];
    for (const passengerData of normalizedPassengers) {
      const existing = await sudo.query.Passenger.findOne({ where: { passengerKey: passengerData.passengerKey }, query: "id carrier { id }" });
      if (existing && existing.carrier?.id !== carrier.id) throw new DomainError("Passenger identity belongs to another carrier.");
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
  const offer = await context.prisma.offer.findUnique({
    where: { id: args.offerId },
    select: { carrier: { select: { id: true, code: true } }, shoppingSessionId: true }
  });
  if (!offer?.carrier?.code || offer.shoppingSessionId !== shoppingSessionHash) {
    await consumeRateLimit(context, "storefront.booking", 10, 15 * 6e4, shoppingSessionHash);
    throw new DomainError("This shopping session does not own the offer.");
  }
  const carrier = offer.carrier;
  const accessToken = bookingAccessToken(args.shoppingSessionToken.trim(), args.offerId.trim());
  const result = await createBookingFromOffer(root, {
    offerId: args.offerId,
    passengerIds: args.passengerIds,
    idempotencyKey: args.idempotencyKey,
    shoppingSessionHash,
    bookingAccessTokenHash: hashStorefrontToken(accessToken),
    recoverOnly: args.recoverOnly
  }, withStorefrontSession(context, carrier), async (tx, expected) => {
    await consumeRateLimit(context, "storefront.booking", 10, 15 * 6e4, shoppingSessionHash);
    const lock = await tx.prisma.$queryRaw(import_client4.Prisma.sql`SELECT "id" FROM "Carrier" WHERE "id" = ${expected.id} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    const admitted = await directCarrier(tx, expected.code);
    if (admitted.id !== expected.id) throw new DomainError("Carrier is unavailable on this storefront.");
  });
  const current = result.bookingReceipt?.accessState === "current";
  if (current && !result.replayed && result.resourceId) await emailBookingAccess(context, String(result.resourceId), accessToken);
  return { ...result, bookingAccessToken: current ? accessToken : null };
}
async function ownedBooking(context, recordLocator, accessToken) {
  let accessTokenHash = null;
  try {
    accessTokenHash = hashStorefrontToken(accessToken);
  } catch {
    accessTokenHash = null;
  }
  const proof = accessTokenHash ? await context.prisma.booking.findFirst({
    where: {
      recordLocator: recordLocator.trim().toUpperCase(),
      accessTokenHash,
      accessTokenExpiresAt: { gt: /* @__PURE__ */ new Date() }
    },
    select: { id: true }
  }) : null;
  if (!proof) {
    const request = context.req ?? {};
    if (await isDurableRateLimitExhausted(context.prisma, "storefront.manage-booking.client", durableRequestFingerprint(request), 30)) {
      throw new DomainError("This request cannot be completed right now.");
    }
    await consumeRateLimit(context, "storefront.manage-booking", 30, 15 * 6e4);
    throw new DomainError(BOOKING_ACCESS_MISMATCH);
  }
  const booking = await context.prisma.booking.findUnique({
    where: { id: proof.id },
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
      checkIns: { select: { id: true, bookingPassengerId: true, bookingSegmentId: true, status: true, checkedInAt: true, offloadedAt: true, boardingPasses: { orderBy: [{ issuedAt: "desc" }, { id: "desc" }], select: { id: true, passNumber: true, status: true, barcodeToken: true, seatDesignatorSnapshot: true, boardingGroup: true, boardingZone: true, gateSnapshot: true, terminalSnapshot: true } } } },
      reaccommodations: { select: { id: true, status: true, optionExpiresAt: true, acceptedAt: true, confirmedAt: true, optionSnapshot: true } }
    }
  });
  if (!booking) throw new DomainError("Booking not found or inaccessible.");
  return {
    ...booking,
    checkIns: booking.checkIns.map((checkIn) => ({
      ...checkIn,
      boardingPass: checkIn.boardingPasses.find((pass) => ["issued", "reissued", "boarded"].includes(pass.status)) ?? null
    }))
  };
}
async function rotateCustomerBookingAccessToken(_root, args, context) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken);
  const nextToken = import_node_crypto9.default.randomBytes(32).toString("base64url");
  await runSerializableTransaction(context, async (transactionContext) => {
    const bookingLock = await transactionContext.prisma.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`;
    throwIfKeystonePrismaError(bookingLock);
    const current = await transactionContext.prisma.booking.findUnique({ where: { id: booking.id }, select: { accessTokenHash: true, accessTokenExpiresAt: true, accessTokenVersion: true } });
    if (!current || !hasCurrentStorefrontBookingAccess(current, hashStorefrontToken(args.accessToken))) throw new DomainError("Booking not found or inaccessible.");
    const now = /* @__PURE__ */ new Date();
    await transactionContext.prisma.booking.update({ where: { id: booking.id }, data: { accessTokenHash: hashStorefrontToken(nextToken), accessTokenExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 6e4), accessTokenVersion: (current.accessTokenVersion ?? 1) + 1 } });
    const eventKey = `booking-access-rotated:${booking.id}:${import_node_crypto9.default.randomUUID()}`;
    await transactionContext.prisma.auditEvent.create({ data: { carrierId: booking.carrier.id, eventKey, action: "booking.access-token.rotate", aggregateType: "Booking", aggregateId: booking.id, source: "storefront", beforeSummary: {}, afterSummary: { accessRevoked: true }, metadata: {}, occurredAt: now } });
  });
  return { recordLocator: booking.recordLocator, accessToken: nextToken };
}
async function checkInCustomerBooking(root, args, context) {
  const booking = await ownedBooking(context, args.recordLocator, args.accessToken);
  if (!booking.passengers.some((entry) => entry.id === args.bookingPassengerId) || !booking.segments.some((segment) => segment.id === args.bookingSegmentId)) throw new DomainError("Booking not found or inaccessible.");
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
  const requestedSegment = booking.segments.find((entry) => entry.id === args.bookingSegmentId);
  if (!booking.passengers.some((entry) => entry.id === args.bookingPassengerId) || !requestedSegment?.flightInstanceId) throw new DomainError("Booking not found or inaccessible.");
  return runSerializableTransaction(context, async (transactionContext) => {
    const bookingLock = await transactionContext.prisma.$queryRaw(import_client4.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`);
    throwIfKeystonePrismaError(bookingLock);
    const flightLock = await transactionContext.prisma.$queryRaw(import_client4.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${requestedSegment.flightInstanceId} FOR UPDATE`);
    throwIfKeystonePrismaError(flightLock);
    const currentBooking = await transactionContext.prisma.booking.findUnique({
      where: { id: booking.id },
      select: {
        status: true,
        paymentStatus: true,
        ticketingStatus: true,
        currencyCode: true,
        carrierId: true,
        accessTokenHash: true,
        accessTokenExpiresAt: true,
        passengers: { where: { id: args.bookingPassengerId }, select: { id: true, passengerId: true } }
      }
    });
    const expectedTokenHash = hashStorefrontToken(args.accessToken);
    if (!currentBooking || currentBooking.carrierId !== booking.carrier.id || !hasCurrentStorefrontBookingAccess(currentBooking, expectedTokenHash) || !currentBooking.passengers[0]) throw new DomainError("Booking changed or access was revoked while preparing seat assignment.");
    const operationContext = withStorefrontSession(transactionContext, booking.carrier, booking.id);
    const sudo = operationContext.sudo();
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bookingId: booking.id, bookingPassengerId: args.bookingPassengerId, bookingSegmentId: args.bookingSegmentId, seatId: args.seatId };
    const inspected = await inspectOperation(sudo, booking.carrier.id, key, "customer-seat.assign", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!["ticketed", "in_progress"].includes(currentBooking.status) || currentBooking.paymentStatus !== "paid" || currentBooking.ticketingStatus !== "ticketed") {
      throw new DomainError("Seat selection is available after your ticket is issued.");
    }
    const segment = await transactionContext.prisma.bookingSegment.findFirst({ where: { id: args.bookingSegmentId, bookingId: booking.id }, include: { flightInstance: true } });
    if (!segment || segment.flightInstanceId !== requestedSegment.flightInstanceId) throw new DomainError("Booking changed while preparing seat assignment.");
    if (!["confirmed", "checked_in", "offloaded", "boarded"].includes(segment.status)) throw new DomainError("The booking segment is not eligible for seat assignment.");
    assertDatedFlightEligibleForAction(segment.flightInstance, "Seat selection", /* @__PURE__ */ new Date());
    const openCoupon = await transactionContext.prisma.ticketCoupon.findFirst({
      where: { bookingSegmentId: segment.id, status: "open", ticket: { bookingId: booking.id, bookingPassengerId: args.bookingPassengerId, status: { in: ["issued", "partially_used"] } } },
      select: { id: true }
    });
    if (!openCoupon) throw new DomainError("This traveler has no open ticket coupon for the segment.");
    const activeCheckIn = await transactionContext.prisma.checkIn.findFirst({ where: { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: segment.id, status: { in: ["checked_in", "boarded"] } }, select: { id: true } });
    if (activeCheckIn) throw new DomainError("Seats can\u2019t be changed after check-in. Please see an agent at the airport.");
    const seat = await transactionContext.prisma.seat.findFirst({ where: { id: args.seatId, carrierId: booking.carrier.id, seatMap: { flightInstanceId: segment.flightInstanceId, status: "published" }, status: "available" }, include: { cabin: true } });
    if (!seat) throw new DomainError("The selected seat is not available for this segment.");
    if (seat.cabin?.code !== segment.cabinCode) throw new DomainError("The selected seat is outside the cabin of this fare.");
    if (seat.currencyCode !== currentBooking.currencyCode) throw new DomainError("The selected seat is not available for this booking.");
    const seatLock = await transactionContext.prisma.$queryRaw(import_client4.Prisma.sql`SELECT "id" FROM "Seat" WHERE "id" = ${seat.id} FOR UPDATE`);
    throwIfKeystonePrismaError(seatLock);
    const occupancyKey = `${segment.flightInstanceId}:${seat.id}`;
    const priorAssignments = await transactionContext.prisma.seatAssignment.findMany({ where: { bookingPassengerId: args.bookingPassengerId, bookingSegmentId: segment.id, status: { in: ["held", "assigned", "confirmed"] } }, orderBy: { createdAt: "asc" } });
    const existing = priorAssignments.find((assignment2) => assignment2.seatId === seat.id);
    const occupied = await transactionContext.prisma.seatAssignment.findUnique({ where: { occupancyKey } });
    if (occupied && occupied.id !== existing?.id) throw new DomainError("The selected seat is no longer available.");
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
      if (!entitlement) throw new DomainError("A paid seat entitlement is required for this seat.");
      const entitlementLock = await transactionContext.prisma.$queryRaw(import_client4.Prisma.sql`SELECT "id" FROM "ElectronicMiscCoupon" WHERE "id" = ${entitlement.id} FOR UPDATE`);
      throwIfKeystonePrismaError(entitlementLock);
      const currentEntitlement = await transactionContext.prisma.electronicMiscCoupon.findUnique({ where: { id: entitlement.id }, select: { status: true } });
      if (currentEntitlement?.status !== "open") throw new DomainError("The paid seat entitlement was already consumed.");
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
  const retained = await context.prisma.idempotencyKey.findUnique({ where: { key: booking.idempotencyKey }, select: { scope: true, carrierId: true, status: true, result: true } });
  let bookingReceipt = { version: 0, state: "legacy_or_incomplete", message: "Original acceptance receipt needs operator reconciliation; current booking state remains separately shown." };
  if (retained?.carrierId === booking.carrierId && retained.scope === "booking.create-from-offer" && retained.status === "completed" && retained.result?.resourceId === booking.id) {
    try {
      bookingReceipt = publicBookingReceipt(retained.result, booking, "current");
    } catch {
    }
  }
  return {
    bookingReceipt,
    id: booking.id,
    recordLocator: booking.recordLocator,
    orderNumber: booking.orderNumber,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    ticketingStatus: booking.ticketingStatus,
    totalAmount: booking.totalAmount,
    currencyCode: booking.currencyCode,
    carrier: booking.carrier,
    passengers: booking.passengers.map((entry) => ({
      id: entry.id,
      passenger: entry.passenger,
      acceptedName: typeof entry.passengerSnapshot?.givenName === "string" && typeof entry.passengerSnapshot?.familyName === "string" ? { givenName: entry.passengerSnapshot.givenName, familyName: entry.passengerSnapshot.familyName } : null
    })),
    // Current operational itinerary, shown separately from the immutable accepted receipt. Times are instants;
    // the airport timezones let the page show local departure and arrival with explicit zones.
    segments: booking.segments.map((segment) => ({
      id: segment.id,
      status: segment.status,
      flightNumber: segment.flightInstance.flightNumber,
      flightStatus: segment.flightInstance.status,
      serviceDate: segment.flightInstance.serviceDate?.toISOString().slice(0, 10) ?? null,
      scheduledDepartureAt: segment.flightInstance.scheduledDepartureAt.toISOString(),
      scheduledArrivalAt: segment.flightInstance.scheduledArrivalAt.toISOString(),
      estimatedDepartureAt: segment.flightInstance.estimatedDepartureAt?.toISOString() ?? null,
      estimatedArrivalAt: segment.flightInstance.estimatedArrivalAt?.toISOString() ?? null,
      actualDepartureAt: segment.flightInstance.actualDepartureAt?.toISOString() ?? null,
      actualArrivalAt: segment.flightInstance.actualArrivalAt?.toISOString() ?? null,
      originCode: segment.flightInstance.origin.iataCode,
      destinationCode: segment.flightInstance.destination.iataCode,
      originTimezone: segment.flightInstance.origin.timezone,
      destinationTimezone: segment.flightInstance.destination.timezone,
      seats: (segment.flightInstance.seatMaps ?? []).flatMap((map) => map.seats ?? []).map((seat) => {
        const assignment = seat.assignments?.[0];
        const selectedForPassengerId = assignment?.bookingId === booking.id && assignment?.bookingSegmentId === segment.id ? assignment.bookingPassengerId : null;
        return { id: seat.id, designator: seat.designator, rowNumber: seat.rowNumber, columnCode: seat.columnCode, seatType: seat.seatType, surchargeAmount: seat.surchargeAmount, currencyCode: seat.currencyCode, cabinCode: seat.cabin?.code, isAvailable: !assignment && seat.currencyCode === booking.currencyCode && seat.cabin?.code === segment.cabinCode, selectedForPassengerId };
      })
    })),
    payments: booking.payments,
    tickets: booking.tickets,
    checkIns: booking.checkIns,
    reaccommodations: booking.reaccommodations
  };
}
var import_node_crypto9, import_client4, BOOKING_ACCESS_MISMATCH;
var init_storefront = __esm({
  "features/keystone/mutations/storefront.ts"() {
    "use strict";
    import_node_crypto9 = __toESM(require("node:crypto"));
    import_client4 = require("@prisma/client");
    init_storefront_session();
    init_rate_limit();
    init_request_identity();
    init_transactions();
    init_booking_acceptance();
    init_airlineOperations();
    init_airlineWorkflows();
    init_service_eligibility();
    init_branding();
    init_domain_error();
    init_passenger_age();
    init_storefrontAccess();
    init_storefrontPayments();
    BOOKING_ACCESS_MISMATCH = "That booking reference and access code don\u2019t match.";
  }
});

// features/keystone/mutations/storefrontAccess.ts
function accessRecoveryEnabled() {
  return emailConfigured();
}
async function emailBookingAccess(context, bookingId, accessToken) {
  try {
    const booking = await context.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        recordLocator: true,
        contactEmail: true,
        totalAmount: true,
        currencyCode: true,
        carrier: { select: { name: true, code: true } },
        passengers: { select: { passenger: { select: { givenName: true, familyName: true } } } },
        segments: { orderBy: [{ sequence: "asc" }, { id: "asc" }], select: { flightInstance: { select: { flightNumber: true, scheduledDepartureAt: true, origin: { select: { iataCode: true, timezone: true } }, destination: { select: { iataCode: true } } } } } }
      }
    });
    if (!booking?.contactEmail) return false;
    return await sendBookingConfirmationEmail({
      to: booking.contactEmail,
      carrierName: booking.carrier.name,
      carrierCode: booking.carrier.code,
      recordLocator: booking.recordLocator,
      accessToken,
      totalLabel: formatMinorUnits(booking.totalAmount, booking.currencyCode),
      travelers: booking.passengers.map((entry) => `${entry.passenger.givenName} ${entry.passenger.familyName}`),
      segments: booking.segments.filter((segment) => segment.flightInstance).map((segment) => {
        const departureLabel = formatAirportTime(segment.flightInstance.scheduledDepartureAt, segment.flightInstance.origin.timezone) ?? "";
        return { flightNumber: segment.flightInstance.flightNumber, originCode: segment.flightInstance.origin.iataCode, destinationCode: segment.flightInstance.destination.iataCode, departureLabel };
      })
    });
  } catch (error) {
    console.error(`Booking email for ${bookingId} failed:`, error instanceof Error ? error.message : "unknown error");
    return false;
  }
}
async function recoverCustomerBookingAccess(_root, args, context) {
  if (!emailConfigured()) throw new DomainError("Access codes can\u2019t be emailed right now. Contact the airline.");
  if (!await isConfiguredPublicCarrier(context.prisma, args.carrierCode)) throw new DomainError("Carrier is unavailable on this storefront.");
  await consumeDurableRateLimit(context.prisma, "storefront.access-recovery.client", durableRequestFingerprint(context.req ?? {}), 5, 60 * 6e4);
  const recordLocator = args.recordLocator.trim().toUpperCase();
  const email2 = args.email.trim().toLowerCase();
  if (!/^[A-Z0-9]{5,8}$/.test(recordLocator) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email2)) return true;
  const booking = await context.prisma.booking.findFirst({
    where: { recordLocator, contactEmail: { equals: email2, mode: "insensitive" }, carrier: { code: args.carrierCode.trim().toUpperCase() } },
    select: { id: true, carrierId: true, accessTokenVersion: true }
  });
  if (!booking) return true;
  const token = import_node_crypto10.default.randomBytes(32).toString("base64url");
  const now = /* @__PURE__ */ new Date();
  await context.prisma.booking.update({ where: { id: booking.id }, data: { accessTokenHash: hashStorefrontToken(token), accessTokenExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 6e4), accessTokenVersion: (booking.accessTokenVersion ?? 1) + 1 } });
  await context.prisma.auditEvent.create({ data: { carrierId: booking.carrierId, eventKey: `booking-access-recovered:${booking.id}:${import_node_crypto10.default.randomUUID()}`, action: "booking.access-token.recover", aggregateType: "Booking", aggregateId: booking.id, source: "storefront", beforeSummary: {}, afterSummary: { accessRevoked: true, emailed: true }, metadata: {}, occurredAt: now } });
  await emailBookingAccess(context, booking.id, token);
  return true;
}
var import_node_crypto10;
var init_storefrontAccess = __esm({
  "features/keystone/mutations/storefrontAccess.ts"() {
    "use strict";
    import_node_crypto10 = __toESM(require("node:crypto"));
    init_domain_error();
    init_mail();
    init_money();
    init_time();
    init_rate_limit();
    init_request_identity();
    init_storefront_session();
    init_storefront();
  }
});

// features/airline/lib/cancellation-policy.ts
function quoteCustomerCancellation(input) {
  const now = input.now.getTime();
  const departure = input.firstDepartureAt.getTime();
  if (!Number.isFinite(departure) || departure <= now) return { allowed: false, reason: "departed" };
  if (!Number.isSafeInteger(input.paidAmount) || input.paidAmount <= 0) return { allowed: true, refundAmount: 0, feeAmount: 0, basis: "unpaid" };
  const bookedAt = input.bookedAt.getTime();
  if (Number.isFinite(bookedAt) && now - bookedAt <= RISK_FREE_WINDOW_MS && departure - bookedAt >= RISK_FREE_MIN_ADVANCE_MS) {
    return { allowed: true, refundAmount: input.paidAmount, feeAmount: 0, basis: "risk_free_24h" };
  }
  const rules = input.fareRules.length ? input.fareRules : [null];
  const refundable = rules.every((rule) => rule ? rule.isRefundable : input.fallbackRefundable);
  if (!refundable) return { allowed: false, reason: "non_refundable" };
  const fee = Math.min(input.paidAmount, rules.reduce((sum, rule) => sum + Math.max(0, rule?.cancellationFeeAmount ?? 0), 0));
  return { allowed: true, refundAmount: input.paidAmount - fee, feeAmount: fee, basis: "refundable_fare" };
}
var RISK_FREE_WINDOW_MS, RISK_FREE_MIN_ADVANCE_MS;
var init_cancellation_policy = __esm({
  "features/airline/lib/cancellation-policy.ts"() {
    "use strict";
    RISK_FREE_WINDOW_MS = 24 * 60 * 6e4;
    RISK_FREE_MIN_ADVANCE_MS = 2 * 24 * 60 * 6e4;
  }
});

// features/keystone/lib/booking-notices.ts
async function sendBookingNotice(notice) {
  try {
    return await sendBookingNoticeEmail(notice);
  } catch {
    return false;
  }
}
var init_booking_notices = __esm({
  "features/keystone/lib/booking-notices.ts"() {
    "use strict";
    init_mail();
  }
});

// features/keystone/mutations/storefrontCancellation.ts
async function cancellationFacts(prisma, bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      currencyCode: true,
      contactEmail: true,
      recordLocator: true,
      carrier: { select: { id: true, name: true, code: true } },
      segments: { select: { status: true, flightInstance: { select: { scheduledDepartureAt: true } } } },
      payments: { select: { id: true, status: true, capturedAmount: true, refundedAmount: true, metadata: true, provider: { select: { adapterType: true } } } },
      lineItems: { where: { itemType: "flight" }, select: { sourceOfferItem: { select: { fareRule: { select: { isRefundable: true, cancellationFeeAmount: true } }, fareBrand: { select: { refundabilitySummary: true } } } } } }
    }
  });
  if (!booking) throw new DomainError("Booking not found or inaccessible.");
  const departures = booking.segments.filter((segment) => !["cancelled", "refunded", "reaccommodated"].includes(segment.status) && segment.flightInstance).map((segment) => new Date(segment.flightInstance.scheduledDepartureAt).getTime()).filter(Number.isFinite);
  const farePayments = booking.payments.filter((payment) => (payment.metadata?.purchaseKind ?? "booking") !== "seat" && ["captured", "partially_refunded"].includes(payment.status));
  const paidAmount = farePayments.reduce((sum, payment) => sum + payment.capturedAmount - payment.refundedAmount, 0);
  const quote = quoteCustomerCancellation({
    bookedAt: new Date(booking.createdAt),
    firstDepartureAt: new Date(departures.length ? Math.min(...departures) : NaN),
    now: /* @__PURE__ */ new Date(),
    paidAmount,
    fareRules: booking.lineItems.map((item) => item.sourceOfferItem?.fareRule ?? null),
    // Without a fare rule the fare brand is the policy; a brand that says refunds need operator processing is
    // treated as non-refundable online, so those travelers are sent to the airline rather than refunded blind.
    fallbackRefundable: false
  });
  const cardOnly = farePayments.every((payment) => payment.provider?.adapterType === "stripe");
  return { booking, quote, farePayments, cardOnly };
}
function quoteResult(quote, currencyCode, status, cardOnly) {
  if (status === "cancelled") return { allowed: false, reason: "already_cancelled", refundAmount: 0, feeAmount: 0, currencyCode, summary: "This booking is already cancelled." };
  if (!quote.allowed) {
    const summary2 = quote.reason === "departed" ? "Your flight has departed, so this booking can\u2019t be cancelled online." : "This fare can\u2019t be refunded online. Contact the airline about changing your flight or a travel credit.";
    return { allowed: false, reason: quote.reason, refundAmount: 0, feeAmount: 0, currencyCode, summary: summary2 };
  }
  if (quote.refundAmount > 0 && !cardOnly) return { allowed: false, reason: "not_card", refundAmount: 0, feeAmount: 0, currencyCode, summary: "This booking wasn\u2019t paid by card online. Contact the airline to cancel it." };
  const summary = quote.basis === "unpaid" ? "Nothing has been charged. Cancelling releases your seats." : quote.basis === "risk_free_24h" ? `Booked within the last 24 hours: you get a full refund of ${formatMinorUnits(quote.refundAmount, currencyCode)} to your card.` : quote.feeAmount > 0 ? `You get ${formatMinorUnits(quote.refundAmount, currencyCode)} back to your card (fare less a ${formatMinorUnits(quote.feeAmount, currencyCode)} cancellation fee).` : `You get a full refund of ${formatMinorUnits(quote.refundAmount, currencyCode)} to your card.`;
  return { allowed: true, reason: quote.basis, refundAmount: quote.refundAmount, feeAmount: quote.feeAmount, currencyCode, summary };
}
async function customerCancellationQuote(_root, args, context) {
  const owned = await ownedBooking(context, args.recordLocator, args.accessToken);
  const { booking, quote, cardOnly } = await cancellationFacts(context.prisma, owned.id);
  return quoteResult(quote, booking.currencyCode, booking.status, cardOnly);
}
async function cancelCustomerBookingWithRefund(_root, args, context) {
  const owned = await ownedBooking(context, args.recordLocator, args.accessToken);
  const key = normalizeIdempotencyKey(args.idempotencyKey);
  const storefrontContext = withStorefrontSession(context, owned.carrier, owned.id);
  const outcome = await runSerializableTransaction(storefrontContext, async (transactionContext) => {
    const { booking, quote, cardOnly } = await cancellationFacts(transactionContext.prisma, owned.id);
    const offered = quoteResult(quote, booking.currencyCode, booking.status, cardOnly);
    if (booking.status === "cancelled") return { status: "cancelled", refundAmount: 0, currencyCode: booking.currencyCode, replayed: true };
    if (!offered.allowed) throw new DomainError(offered.summary);
    if (offered.refundAmount > 0) {
      await processBookingRefundInTransaction(transactionContext, {
        bookingId: booking.id,
        amount: offered.refundAmount,
        reason: "customer_request",
        providerReference: `self-cancel-${booking.recordLocator}-${key.slice(0, 24)}`,
        idempotencyKey: `${key}:refund`
      }, { authorize: false, cardOnly: true });
    }
    await cancelBookingInTransaction(transactionContext, {
      bookingId: booking.id,
      idempotencyKey: `${key}:cancel`,
      reason: args.reason?.trim() || "Traveler cancelled online.",
      customerBookingId: booking.id,
      customerAccessTokenHash: hashStorefrontToken(args.accessToken)
    }, booking.id, { refundSettled: offered.refundAmount > 0 });
    return { status: "cancelled", refundAmount: offered.refundAmount, currencyCode: booking.currencyCode, replayed: false, email: booking.contactEmail, carrier: booking.carrier, recordLocator: booking.recordLocator };
  });
  if (!outcome.replayed && "email" in outcome && outcome.email) {
    await sendBookingNotice({
      to: outcome.email,
      carrierName: outcome.carrier.name,
      recordLocator: outcome.recordLocator,
      subject: `Booking ${outcome.recordLocator} cancelled`,
      heading: "Your booking is cancelled",
      lines: [outcome.refundAmount > 0 ? `${formatMinorUnits(outcome.refundAmount, outcome.currencyCode)} is on its way back to your card. Refunds usually show within 5\u201310 business days.` : "Nothing was charged for this booking.", "Your seats have been released."]
    });
  }
  return { status: outcome.status, refundAmount: outcome.refundAmount, currencyCode: outcome.currencyCode };
}
var init_storefrontCancellation = __esm({
  "features/keystone/mutations/storefrontCancellation.ts"() {
    "use strict";
    init_domain_error();
    init_money();
    init_storefront_session();
    init_transactions();
    init_cancellation_policy();
    init_airlineOperations();
    init_airlineWorkflows();
    init_booking_notices();
    init_storefront();
  }
});

// features/keystone/mutations/airlineOperationsControl.ts
function validTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
function optionalText(value, label, max) {
  if (value === void 0) return void 0;
  const text58 = (value ?? "").trim();
  if (text58.length > max) throw new DomainError(`${label} must be at most ${max} characters.`);
  return text58 || null;
}
function optionalInstant(value, label) {
  if (value === void 0) return void 0;
  if (value === null || value === "") return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new DomainError(`${label} is not a valid time.`);
  return instant;
}
async function registerAirport(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    const actor = await requireFreshPermission(transactionContext, "canManageNetwork");
    const iataCode = args.iataCode.trim().toUpperCase();
    const icaoCode = args.icaoCode?.trim().toUpperCase() || null;
    const countryCode = args.countryCode.trim().toUpperCase();
    const name = args.name.trim();
    const city = args.city.trim();
    const timezone = args.timezone.trim();
    if (!/^[A-Z]{3}$/.test(iataCode)) throw new DomainError("IATA code must be three letters.");
    if (icaoCode && !/^[A-Z]{4}$/.test(icaoCode)) throw new DomainError("ICAO code must be four letters.");
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new DomainError("Country must be a two-letter ISO code.");
    if (!name || name.length > 160 || !city || city.length > 120) throw new DomainError("Airport name and city are required.");
    if (!validTimezone(timezone)) throw new DomainError("Timezone must be an IANA zone such as America/New_York.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { iataCode, icaoCode, name, city, countryCode, timezone };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, actor.carrierId, key, "airport.register", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const prisma = transactionContext.prisma;
    const existing = await prisma.airport.findUnique({ where: { iataCode }, select: { id: true } });
    const claim = await beginOperation(sudo, transactionContext, actor.carrierId, key, "airport.register", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    if (existing) {
      const result2 = { resourceType: "Airport", resourceId: existing.id, status: "existing", changed: false, replayed: false };
      await finishOperation(sudo, claim.record.id, result2);
      return result2;
    }
    if (icaoCode && await prisma.airport.findUnique({ where: { icaoCode }, select: { id: true } })) throw new DomainError(`ICAO code ${icaoCode} belongs to another airport.`);
    const airport = await prisma.airport.create({ data: { iataCode, icaoCode, name, city, countryCode, subdivisionCode: args.subdivisionCode?.trim().toUpperCase() || "", timezone, isActive: true }, select: { id: true } });
    await writeAudit(sudo, transactionContext, { carrierId: actor.carrierId, key: claim.storageKey, action: "airport.register", aggregateType: "Airport", aggregateId: airport.id, after: request });
    const result = { resourceType: "Airport", resourceId: airport.id, status: "created", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function updateFlightOperations(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    const actor = await requireFreshPermission(transactionContext, "canManageAirportService");
    const prisma = transactionContext.prisma;
    const lock = await transactionContext.prisma.$queryRaw(import_client5.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${args.flightInstanceId} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    const flight = await prisma.flightInstance.findUnique({ where: { id: args.flightInstanceId } });
    if (!flight || flight.carrierId !== actor.carrierId && !actor.canManageCarriers) throw new DomainError("Dated flight not found or inaccessible.");
    const data = {};
    const texts = { departureTerminal: ["Departure terminal", 20], departureGate: ["Departure gate", 20], arrivalTerminal: ["Arrival terminal", 20], arrivalGate: ["Arrival gate", 20] };
    for (const [field, [label, max]] of Object.entries(texts)) {
      const value = optionalText(args[field], label, max);
      if (value !== void 0) data[field] = value ?? "";
    }
    for (const [field, label] of [["estimatedDepartureAt", "Estimated departure"], ["estimatedArrivalAt", "Estimated arrival"], ["actualDepartureAt", "Actual departure"], ["actualArrivalAt", "Actual arrival"]]) {
      const value = optionalInstant(args[field], label);
      if (value !== void 0) data[field] = value;
    }
    const status = args.status?.trim() || null;
    if (status && !OPERATIONAL_STATUSES.includes(status)) throw new DomainError("Status must be delayed, departed or arrived.");
    const nextActualDeparture = data.actualDepartureAt ?? flight.actualDepartureAt;
    const nextActualArrival = data.actualArrivalAt ?? flight.actualArrivalAt;
    if (status === "departed" && !nextActualDeparture) data.actualDepartureAt = /* @__PURE__ */ new Date();
    if (status === "arrived" && !nextActualArrival) data.actualArrivalAt = /* @__PURE__ */ new Date();
    const departure = data.actualDepartureAt ?? flight.actualDepartureAt;
    const arrival = data.actualArrivalAt ?? flight.actualArrivalAt;
    if (departure && arrival && arrival <= departure) throw new DomainError("Actual arrival must be after actual departure.");
    if (status) {
      assertLifecycleTransition("flightInstance", flight.status, status);
      if (status !== flight.status) data.status = status;
    }
    if (!Object.keys(data).length) throw new DomainError("Nothing to update.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { flightInstanceId: flight.id, ...Object.fromEntries(Object.entries(data).map(([field, value]) => [field, value instanceof Date ? value.toISOString() : value])) };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, flight.carrierId, key, "dated-flight.operations", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const claim = await beginOperation(sudo, transactionContext, flight.carrierId, key, "dated-flight.operations", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    await prisma.flightInstance.update({ where: { id: flight.id }, data });
    if (data.status === "departed") await prisma.inventoryBucket.updateMany({ where: { flightInstanceId: flight.id, status: "open" }, data: { status: "closed" } });
    await writeAudit(sudo, transactionContext, {
      carrierId: flight.carrierId,
      key: claim.storageKey,
      action: "dated-flight.operations",
      aggregateType: "FlightInstance",
      aggregateId: flight.id,
      before: { status: flight.status, departureGate: flight.departureGate, departureTerminal: flight.departureTerminal },
      after: request
    });
    const result = { resourceType: "FlightInstance", resourceId: flight.id, status: String(data.status ?? flight.status), changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
async function recordBagEvent(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    const actor = await requireFreshPermission(transactionContext, "canManageAirportService");
    const prisma = transactionContext.prisma;
    const lock = await transactionContext.prisma.$queryRaw(import_client5.Prisma.sql`SELECT "id" FROM "Bag" WHERE "id" = ${args.bagId} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    const bag = await prisma.bag.findUnique({ where: { id: args.bagId }, select: { id: true, carrierId: true, status: true, tagNumber: true } });
    if (!bag || bag.carrierId !== actor.carrierId && !actor.canManageCarriers) throw new DomainError("Bag not found or inaccessible.");
    const eventType = BAG_EVENT_TYPES[args.action];
    if (!eventType) throw new DomainError("Unsupported bag action.");
    const nextStatus = getLifecycleTarget("bag", args.action);
    assertLifecycleTransition("bag", bag.status, nextStatus);
    const airportCode = args.airportCode?.trim().toUpperCase() || null;
    const airport = airportCode ? await prisma.airport.findUnique({ where: { iataCode: airportCode }, select: { id: true } }) : null;
    if (airportCode && !airport) throw new DomainError(`Airport ${airportCode} is not in the network.`);
    const note = optionalText(args.note, "Note", 300) ?? null;
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { bagId: bag.id, action: args.action, airportCode, note };
    const sudo = transactionContext.sudo();
    const inspected = await inspectOperation(sudo, bag.carrierId, key, "bag.event", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const claim = await beginOperation(sudo, transactionContext, bag.carrierId, key, "bag.event", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const now = /* @__PURE__ */ new Date();
    await prisma.bag.update({ where: { id: bag.id }, data: { status: nextStatus, ...nextStatus === "delivered" ? { deliveredAt: now } : {} } });
    await prisma.bagEvent.create({
      data: {
        carrierId: bag.carrierId,
        bagId: bag.id,
        airportId: airport?.id ?? null,
        eventKey: `${bag.id}:${randomReference("", 12)}`,
        eventType,
        statusSnapshot: nextStatus,
        source: "agent",
        occurredAt: now,
        providerReference: "",
        payloadSummary: note ? { note } : {}
      }
    });
    await writeAudit(sudo, transactionContext, { carrierId: bag.carrierId, key: claim.storageKey, action: "bag.event", aggregateType: "Bag", aggregateId: bag.id, before: { status: bag.status }, after: { status: nextStatus, eventType, airportCode } });
    const result = { resourceType: "Bag", resourceId: bag.id, status: nextStatus, changed: nextStatus !== bag.status, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
var import_client5, OPERATIONAL_STATUSES, BAG_EVENT_TYPES;
var init_airlineOperationsControl = __esm({
  "features/keystone/mutations/airlineOperationsControl.ts"() {
    "use strict";
    import_client5 = require("@prisma/client");
    init_access();
    init_domain_error();
    init_lifecycle();
    init_transactions();
    init_airlineOperations();
    OPERATIONAL_STATUSES = ["delayed", "departed", "arrived"];
    BAG_EVENT_TYPES = { load: "loaded", transfer: "transferred", arrive: "arrived", deliver: "delivered", delay: "exception", mishandle: "exception", close: "exception" };
  }
});

// features/keystone/mutations/airlinePaymentsDesk.ts
async function recordReceivedPayment(root, args, context) {
  await requireFreshPermission(context, "canManagePayments");
  const prisma = context.prisma;
  const booking = await prisma.booking.findUnique({ where: { id: args.bookingId }, select: { id: true, carrierId: true, currencyCode: true } });
  if (!booking) throw new DomainError("Resource not found or inaccessible.");
  const actor = await requireFreshCarrierPermission(context, "canManagePayments", booking.carrierId);
  const purpose = args.purpose === "refund" ? "refund" : args.purpose === "capture" ? "capture" : null;
  if (!purpose) throw new DomainError("Choose payment received or refund sent.");
  if (!METHODS.includes(args.method)) throw new DomainError("Choose how the money moved.");
  const externalReference = args.externalReference.trim();
  if (externalReference.length < 6 || externalReference.length > 200) throw new DomainError("Enter the bank, terminal or receipt reference (6 to 200 characters).");
  if (!Number.isSafeInteger(args.amount) || args.amount <= 0) throw new DomainError("Enter the amount.");
  const receivedAt = new Date(args.receivedAt);
  if (Number.isNaN(receivedAt.getTime()) || receivedAt > new Date(Date.now() + 5 * 6e4)) throw new DomainError("Enter when the money moved; it can\u2019t be in the future.");
  const providers = await prisma.paymentProvider.findMany({ where: { carrierId: booking.carrierId, adapterType: "manual", status: "active" }, take: 5 });
  if (!providers.some((provider) => isEvidenceOnlyManualProvider(provider))) throw new DomainError("Activate a manual settlement provider on the Payment providers page first.");
  const key = normalizeIdempotencyKey(args.idempotencyKey);
  const ledgerSource = `operator:${args.method}`;
  const currencyCode = booking.currencyCode;
  const occurredAt = receivedAt.toISOString();
  const evidenceDigest = import_node_crypto11.default.createHash("sha256").update(JSON.stringify({ carrierId: booking.carrierId, bookingId: booking.id, purpose, ledgerSource, externalReference, amount: args.amount, currencyCode, occurredAt })).digest("hex");
  const ledgerKey = import_node_crypto11.default.createHash("sha256").update(`${booking.carrierId}\0${ledgerSource}\0${externalReference}`).digest("hex");
  const retained = await prisma.settlementLedgerEntry.upsert({
    where: { ledgerKey },
    update: {},
    create: {
      carrierId: booking.carrierId,
      ledgerKey,
      externalReference,
      ledgerSource,
      evidenceDigest,
      amount: args.amount,
      currencyCode,
      occurredAt: receivedAt,
      importedByCredentialId: `user:${actor.itemId}`,
      sourceMetadata: { recordedBy: actor.itemId, method: args.method, bookingId: booking.id, purpose }
    }
  });
  if (retained.amount !== args.amount || retained.currencyCode !== currencyCode || retained.evidenceDigest !== evidenceDigest) throw new DomainError("That reference was already recorded with different details.");
  return submitManualPaymentEvidence(root, { bookingId: booking.id, purpose, externalReference, ledgerSource, evidenceDigest, amount: args.amount, currencyCode, idempotencyKey: `${key}:evidence` }, context);
}
async function reissueBookingAccessCode(_root, args, context) {
  await requireFreshPermission(context, "canManageBookings");
  const prisma = context.prisma;
  const booking = await prisma.booking.findUnique({ where: { id: args.bookingId }, select: { id: true, carrierId: true, recordLocator: true, accessTokenVersion: true, status: true } });
  if (!booking) throw new DomainError("Resource not found or inaccessible.");
  const actor = await requireFreshCarrierPermission(context, "canManageBookings", booking.carrierId);
  const token = import_node_crypto11.default.randomBytes(32).toString("base64url");
  const now = /* @__PURE__ */ new Date();
  await prisma.booking.update({ where: { id: booking.id }, data: { accessTokenHash: hashStorefrontToken(token), accessTokenExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 6e4), accessTokenVersion: (booking.accessTokenVersion ?? 1) + 1 } });
  await prisma.auditEvent.create({ data: { carrierId: booking.carrierId, actorId: actor.itemId, eventKey: `booking-access-reissued:${booking.id}:${import_node_crypto11.default.randomUUID()}`, action: "booking.access-token.reissue", aggregateType: "Booking", aggregateId: booking.id, source: "platform", beforeSummary: {}, afterSummary: { accessRevoked: true }, metadata: {}, occurredAt: now } });
  return { recordLocator: booking.recordLocator, accessToken: token };
}
var import_node_crypto11, METHODS;
var init_airlinePaymentsDesk = __esm({
  "features/keystone/mutations/airlinePaymentsDesk.ts"() {
    "use strict";
    import_node_crypto11 = __toESM(require("node:crypto"));
    init_access();
    init_bounded_payment_policy();
    init_domain_error();
    init_storefront_session();
    init_airlineOperations();
    init_airlineWorkflows();
    METHODS = ["bank_transfer", "card_terminal", "cash", "other"];
  }
});

// features/keystone/lib/recovery-party.ts
function partitionRecoveryParty(passengers, ticketedBooking) {
  const eligiblePassengerIds = [];
  const boardedOrFlownPassengerIds = [];
  for (const passenger of passengers) {
    const hasBoardedOrFlownService = passenger.couponStatuses.some((status) => status === "boarded" || status === "flown") || passenger.checkInStatuses.includes("boarded") || passenger.boardingPassStatuses.includes("boarded");
    if (hasBoardedOrFlownService) {
      boardedOrFlownPassengerIds.push(passenger.bookingPassengerId);
      continue;
    }
    if (passenger.recoverableCouponCount > 1) {
      throw new Error(`Ticketed passenger ${passenger.bookingPassengerId} has multiple recoverable coupons for the disrupted segment.`);
    }
    const hasRecoverableCoupon = passenger.recoverableCouponCount === 1;
    if (passenger.activeTicket && !hasRecoverableCoupon || ticketedBooking && !passenger.hasTicket) {
      throw new Error(`Ticketed passenger ${passenger.bookingPassengerId} lacks a recoverable coupon for the disrupted segment.`);
    }
    if (hasRecoverableCoupon) eligiblePassengerIds.push(passenger.bookingPassengerId);
  }
  if (!eligiblePassengerIds.length) {
    throw new Error("No unboarded ticketed passengers are eligible for recovery; boarded or flown passengers remain on the original service.");
  }
  return { eligiblePassengerIds, boardedOrFlownPassengerIds };
}
var init_recovery_party = __esm({
  "features/keystone/lib/recovery-party.ts"() {
    "use strict";
  }
});

// features/keystone/mutations/airlineRecovery.ts
async function publishFlightDisruption(_root, args, context) {
  return runSerializableTransaction(context, async (transactionContext) => {
    await requireFreshPermission(transactionContext, "canManageDisruptions");
    const sudo = transactionContext.sudo();
    let flight = await sudo.query.FlightInstance.findOne({ where: { id: args.flightInstanceId }, query: "id status flightNumber carrier { id } bookingSegments { id status booking { passengers { id } } checkIns { status bookingPassenger { id } } }" });
    if (!flight) throw new DomainError("Flight not found.");
    await requireFreshCarrierPermission(transactionContext, "canManageDisruptions", flight.carrier.id);
    if (!disruptionTypes.has(args.type)) throw new DomainError("Unsupported disruption type.");
    const summary = args.publicSummary?.trim();
    if (!summary || summary.length > 500) throw new DomainError("A public summary of at most 500 characters is required.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { flightInstanceId: flight.id, type: args.type, publicSummary: summary };
    const inspected = await inspectOperation(sudo, flight.carrier.id, key, "disruption.publish", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    const lock = await transactionContext.prisma.$queryRaw(import_client6.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${flight.id} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    flight = await sudo.query.FlightInstance.findOne({ where: { id: args.flightInstanceId }, query: "id status flightNumber carrier { id } bookingSegments { id status booking { passengers { id } } checkIns { status bookingPassenger { id } } }" });
    if (!flight) throw new DomainError("Flight changed while publishing disruption.");
    const claim = await beginOperation(sudo, transactionContext, flight.carrier.id, key, "disruption.publish", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const flightTransition = args.type === "cancellation" ? assertLifecycleTransition("flightInstance", flight.status, "cancelled") : args.type === "delay" ? assertLifecycleTransition("flightInstance", flight.status, "delayed") : null;
    const affected = (flight.bookingSegments ?? []).filter(
      (segment) => ["confirmed", "checked_in", "offloaded"].includes(segment.status) && !(segment.booking?.passengers ?? []).every(
        (passenger) => (segment.checkIns ?? []).some((checkIn) => checkIn.bookingPassenger?.id === passenger.id && checkIn.status === "boarded")
      )
    );
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
    let disruption = await sudo.query.Disruption.findOne({ where: { id: args.disruptionId }, query: "id status carrier { id } flightInstance { id status origin { id } } affectedSegments { id booking { id } journey { id } inventoryBucket { id sold } sourceOfferItem { inventoryBucket { id sold } } status sequence includedBaggageSnapshot origin { id } destination { id } originCode destinationCode cabinCode bookingClassCode fareBrandCode fareBasisCode }" });
    if (!disruption) throw new DomainError("Disruption is not available for recovery.");
    const carrierId = disruption.carrier.id;
    await requireFreshCarrierPermission(transactionContext, "canManageDisruptions", carrierId);
    let original = disruption.affectedSegments.find((segment) => segment.booking.id === args.bookingId);
    let booking = await sudo.query.Booking.findOne({ where: { id: args.bookingId }, query: "id status paymentStatus ticketingStatus currencyCode carrier { id code } passengers { id passenger { id } } tickets { id status bookingPassenger { id } coupons { id status bookingSegment { id } serviceObligation { id currentVersion status } serviceObligationVersion } }" });
    if (!booking || booking.carrier.id !== carrierId) throw new DomainError("Booking is not available for this carrier.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { disruptionId: args.disruptionId, bookingId: args.bookingId, replacementFlightInstanceId: args.replacementFlightInstanceId, replacementInventoryBucketId: args.replacementInventoryBucketId };
    const inspected = await inspectOperation(sudo, carrierId, key, "reaccommodation.confirm", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (!["published", "recovering"].includes(disruption.status)) throw new DomainError("Disruption is not open for recovery.");
    if (!original || original.status !== "disrupted") throw new DomainError("Booking has no recoverable segment in this disruption.");
    let replacement = await sudo.query.FlightInstance.findOne({ where: { id: args.replacementFlightInstanceId }, query: "id status flightNumber scheduledDepartureAt scheduledArrivalAt carrier { id code } operatingCarrier { code } origin { id iataCode } destination { id iataCode }" });
    let bucket = await sudo.query.InventoryBucket.findOne({ where: { id: args.replacementInventoryBucketId }, query: "id status authorized sold held blocked bookingClassCode carrier { id } flightInstance { id } cabin { code } fareBrand { code }" });
    if (!replacement || !bucket || replacement.carrier.id !== carrierId || bucket.carrier.id !== carrierId || bucket.flightInstance.id !== replacement.id) throw new DomainError("Replacement service must belong to the booking carrier.");
    if (replacement.id === disruption.flightInstance?.id) throw new DomainError("Replacement service must differ from the disrupted flight.");
    if (!["scheduled", "open_for_sale", "delayed"].includes(replacement.status) || bucket.status !== "open" || new Date(replacement.scheduledDepartureAt) <= /* @__PURE__ */ new Date()) throw new DomainError("Replacement inventory is not available for a future service.");
    if (replacement.origin.iataCode !== original.originCode || replacement.destination.iataCode !== original.destinationCode) throw new DomainError("Replacement service must preserve the disrupted origin and destination.");
    let quantity = 0;
    let originalBucket = original.inventoryBucket ?? original.sourceOfferItem?.inventoryBucket;
    if (!originalBucket?.id) throw new DomainError("The disrupted segment has no accountable inventory bucket.");
    const bookingLock = await transactionContext.prisma.$queryRaw(import_client6.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`);
    throwIfKeystonePrismaError(bookingLock);
    const serviceFlightIds = sortUniqueIds([disruption.flightInstance?.id ?? "", replacement.id]);
    const flightLock = await transactionContext.prisma.$queryRaw(import_client6.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" IN (${import_client6.Prisma.join(serviceFlightIds)}) ORDER BY "id" FOR UPDATE`);
    throwIfKeystonePrismaError(flightLock);
    disruption = await sudo.query.Disruption.findOne({ where: { id: args.disruptionId }, query: "id status carrier { id } flightInstance { id status origin { id } } affectedSegments { id booking { id } journey { id } inventoryBucket { id sold } sourceOfferItem { inventoryBucket { id sold } } status sequence includedBaggageSnapshot origin { id } destination { id } originCode destinationCode cabinCode bookingClassCode fareBrandCode fareBasisCode }" });
    booking = await sudo.query.Booking.findOne({ where: { id: args.bookingId }, query: "id status paymentStatus ticketingStatus currencyCode carrier { id code } passengers { id passenger { id } } tickets { id status bookingPassenger { id } coupons { id status bookingSegment { id } serviceObligation { id currentVersion status } serviceObligationVersion } }" });
    replacement = await sudo.query.FlightInstance.findOne({ where: { id: args.replacementFlightInstanceId }, query: "id status flightNumber scheduledDepartureAt scheduledArrivalAt carrier { id code } operatingCarrier { code } origin { id iataCode } destination { id iataCode }" });
    bucket = await sudo.query.InventoryBucket.findOne({ where: { id: args.replacementInventoryBucketId }, query: "id status authorized sold held blocked bookingClassCode carrier { id } flightInstance { id } cabin { code } fareBrand { code }" });
    const lockedInspection = await inspectOperation(sudo, carrierId, key, "reaccommodation.confirm", request);
    if (lockedInspection.replay) return { ...lockedInspection.replay.result ?? {}, replayed: true };
    if (!disruption || !["published", "recovering"].includes(disruption.status) || disruption.carrier.id !== carrierId) throw new DomainError("Disruption changed while preparing recovery.");
    original = disruption.affectedSegments.find((segment) => segment.booking.id === args.bookingId);
    if (!original || original.status !== "disrupted" || !booking || ["cancelled", "completed"].includes(booking.status) || booking.paymentStatus === "refunded" || booking.ticketingStatus === "voided" || !replacement || !bucket || booking.carrier.id !== carrierId || replacement.carrier.id !== carrierId || bucket.carrier.id !== carrierId || bucket.flightInstance.id !== replacement.id) throw new DomainError("Recovery resources changed while acquiring locks.");
    if (replacement.id === disruption.flightInstance?.id || !["scheduled", "open_for_sale", "delayed"].includes(replacement.status) || bucket.status !== "open" || new Date(replacement.scheduledDepartureAt) <= /* @__PURE__ */ new Date()) throw new DomainError("Replacement service is no longer available.");
    if (replacement.origin.iataCode !== original.originCode || replacement.destination.iataCode !== original.destinationCode) throw new DomainError("Replacement service must preserve the disrupted origin and destination.");
    if (!disruption.flightInstance?.id || ["departed", "arrived"].includes(disruption.flightInstance.status)) throw new DomainError("Recovery is unavailable after the original service has departed or arrived.");
    const tx = transactionContext.prisma;
    const allBookingPassengerIds = sortUniqueIds((booking.passengers ?? []).map((passenger) => passenger.id));
    const originalCoupons = (booking.tickets ?? []).flatMap((ticket) => (ticket.coupons ?? []).filter((coupon) => coupon.bookingSegment?.id === original.id).map((coupon) => ({ ...coupon, ticketStatus: ticket.status, bookingPassengerId: ticket.bookingPassenger?.id })));
    const allCheckIns = await tx.checkIn.findMany({
      where: { bookingSegmentId: original.id, bookingPassengerId: { in: allBookingPassengerIds } },
      select: { id: true, status: true, bookingPassengerId: true, passengerId: true, seatAssignmentId: true, ticketCouponId: true, boardingPasses: { select: { id: true, status: true } } }
    });
    const ticketedBooking = booking.ticketingStatus === "ticketed";
    const party = partitionRecoveryParty((booking.passengers ?? []).map((passenger) => {
      const passengerCoupons = originalCoupons.filter((coupon) => coupon.bookingPassengerId === passenger.id);
      const activeTickets = (booking.tickets ?? []).filter((ticket) => ticket.bookingPassenger?.id === passenger.id && ["issued", "partially_used", "suspended"].includes(ticket.status));
      const recoverableCouponCount = passengerCoupons.filter(
        (coupon) => ["issued", "partially_used", "suspended"].includes(coupon.ticketStatus) && ["open", "checked_in", "suspended"].includes(coupon.status)
      ).length;
      const checkIns = allCheckIns.filter((checkIn) => checkIn.bookingPassengerId === passenger.id);
      return {
        bookingPassengerId: passenger.id,
        hasTicket: (booking.tickets ?? []).some((ticket) => ticket.bookingPassenger?.id === passenger.id),
        activeTicket: activeTickets.length > 0,
        couponStatuses: passengerCoupons.map((coupon) => coupon.status),
        recoverableCouponCount,
        checkInStatuses: checkIns.map((checkIn) => checkIn.status),
        boardingPassStatuses: checkIns.flatMap((checkIn) => (checkIn.boardingPasses ?? []).map((pass) => pass.status))
      };
    }), ticketedBooking);
    const eligiblePassengerIds = sortUniqueIds(party.eligiblePassengerIds);
    quantity = eligiblePassengerIds.length;
    const eligiblePassengerIdSet = new Set(eligiblePassengerIds);
    const eligiblePassengers = (booking.passengers ?? []).filter((passenger) => eligiblePassengerIdSet.has(passenger.id));
    const eligibleTravelerIds = sortUniqueIds(eligiblePassengers.map((passenger) => passenger.passenger?.id ?? ""));
    if (eligibleTravelerIds.length !== eligiblePassengers.length) throw new DomainError("Duplicate passenger identities in a mixed booking require explicit reconciliation before recovery.");
    const eligibleCheckIns = allCheckIns.filter((checkIn) => eligiblePassengerIdSet.has(checkIn.bookingPassengerId));
    const eligiblePasses = await tx.boardingPass.findMany({
      where: { bookingSegmentId: original.id, passengerId: { in: eligibleTravelerIds } },
      select: { id: true, status: true, checkInId: true, passengerId: true, checkIn: { select: { bookingPassengerId: true, passengerId: true } } }
    });
    const eligibleSeats = await tx.seatAssignment.findMany({
      where: { bookingSegmentId: original.id, bookingPassengerId: { in: eligiblePassengerIds } },
      select: { id: true, status: true, amount: true, occupancyKey: true, bookingPassengerId: true }
    });
    const eligibleBags = await tx.bag.findMany({
      where: {
        bookingPassengerId: { in: eligiblePassengerIds },
        OR: [{ bookingSegmentId: original.id }, { segments: { some: { id: original.id } } }]
      },
      select: { id: true, bagKey: true, status: true, bookingPassengerId: true }
    });
    const eligibleVerifications = await tx.documentVerification.findMany({
      where: { bookingSegmentId: original.id, passengerId: { in: eligibleTravelerIds }, status: "verified" },
      select: { id: true, status: true, passengerId: true }
    });
    const eligibleAncillaryCoupons = await tx.electronicMiscCoupon.findMany({
      where: { bookingSegmentId: original.id, status: { in: ["open", "used"] }, document: { bookingPassengerId: { in: eligiblePassengerIds } } },
      select: { id: true, amount: true, currencyCode: true }
    });
    const lockArtifactRows = async (table, ids2) => {
      const uniqueIds = sortUniqueIds(ids2);
      if (!uniqueIds.length) return;
      const lock = await tx.$queryRaw(import_client6.Prisma.sql`SELECT "id" FROM ${import_client6.Prisma.raw(table)} WHERE "id" IN (${import_client6.Prisma.join(uniqueIds)}) ORDER BY "id" FOR UPDATE`);
      throwIfKeystonePrismaError(lock);
    };
    await Promise.all([
      lockArtifactRows('"TicketCoupon"', originalCoupons.filter((entry) => eligiblePassengerIdSet.has(entry.bookingPassengerId)).map((entry) => entry.id)),
      lockArtifactRows('"CheckIn"', eligibleCheckIns.map((entry) => entry.id)),
      lockArtifactRows('"BoardingPass"', eligiblePasses.map((entry) => entry.id)),
      lockArtifactRows('"SeatAssignment"', eligibleSeats.map((entry) => entry.id)),
      lockArtifactRows('"Bag"', eligibleBags.map((entry) => entry.id)),
      lockArtifactRows('"DocumentVerification"', eligibleVerifications.map((entry) => entry.id)),
      lockArtifactRows('"ElectronicMiscCoupon"', eligibleAncillaryCoupons.map((entry) => entry.id))
    ]);
    const unsupportedCheckIns = eligibleCheckIns.filter((entry) => !["cancelled", "checked_in", "offloaded"].includes(entry.status));
    const activePasses = eligiblePasses.filter((entry) => ["issued", "reissued"].includes(entry.status));
    const unsafePasses = eligiblePasses.filter((pass) => pass.status === "boarded" || ["issued", "reissued"].includes(pass.status) && !eligibleCheckIns.some((checkIn) => checkIn.id === pass.checkInId && checkIn.status === "checked_in" && checkIn.bookingPassengerId === pass.checkIn?.bookingPassengerId && checkIn.passengerId === pass.passengerId));
    const activePassesPerCheckIn = activePasses.reduce((counts, pass) => {
      counts[pass.checkInId] = (counts[pass.checkInId] ?? 0) + 1;
      return counts;
    }, {});
    const duplicateActivePasses = Object.values(activePassesPerCheckIn).filter((count) => count > 1).length;
    const activeSeats = eligibleSeats.filter((entry) => ["held", "assigned", "confirmed", "boarded"].includes(entry.status));
    const invalidSeats = activeSeats.filter((seat) => seat.status !== "confirmed" || seat.amount !== 0 || !eligibleCheckIns.some((checkIn) => checkIn.seatAssignmentId === seat.id && ["checked_in", "offloaded"].includes(checkIn.status)));
    const missingCheckInSeats = eligibleCheckIns.filter((checkIn) => ["checked_in", "offloaded"].includes(checkIn.status) && !eligibleSeats.some((seat) => seat.id === checkIn.seatAssignmentId && seat.status === "confirmed" && seat.amount === 0));
    const activeOperationalArtifacts = {
      unsupportedCheckIns: unsupportedCheckIns.length,
      unsafeBoardingPasses: unsafePasses.length + duplicateActivePasses,
      nonFreeOrUnlinkedSeats: invalidSeats.length + missingCheckInSeats.length,
      bagsRequiringPhysicalDisposition: eligibleBags.length,
      ancillaryCouponsRequiringReconciliation: eligibleAncillaryCoupons.length
    };
    if (Object.values(activeOperationalArtifacts).some((count) => count > 0)) {
      throw new DomainError(`Recovery is blocked until unboarded traveler artifacts have an authorized disposition; active artifacts: ${JSON.stringify(activeOperationalArtifacts)}.`);
    }
    if (eligibleVerifications.length) {
      await requireFreshCarrierPermission(transactionContext, "canManageSecurePassengerData", carrierId);
      await requireStationCapability(transactionContext, "canManageSecurePassengerData", carrierId, disruption.flightInstance.origin.id, "canCheckIn");
    }
    if (eligibleCheckIns.some((entry) => ["checked_in", "offloaded"].includes(entry.status)) || activePasses.length || activeSeats.length) {
      await requireStationCapability(transactionContext, "canManageAirportService", carrierId, disruption.flightInstance.origin.id, "canCheckIn");
    }
    originalBucket = original.inventoryBucket ?? original.sourceOfferItem?.inventoryBucket;
    if (!originalBucket?.id) throw new DomainError("The disrupted segment no longer has accountable inventory.");
    const bucketIds = [.../* @__PURE__ */ new Set([originalBucket.id, bucket.id])].sort();
    const bucketLocks = await transactionContext.prisma.$queryRaw(import_client6.Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" IN (${import_client6.Prisma.join(bucketIds)}) ORDER BY "id" FOR UPDATE`);
    throwIfKeystonePrismaError(bucketLocks);
    const releaseExpired = await transactionContext.prisma.$executeRaw(import_client6.Prisma.sql`
      WITH expired AS (
        UPDATE "InventoryHold" SET "status" = 'expired', "updatedAt" = NOW()
        WHERE "inventoryBucket" IN (${import_client6.Prisma.join(bucketIds)}) AND "status" = 'active' AND "expiresAt" <= NOW()
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
    if (!lockedReplacement || !lockedOriginal || originalBucket.id !== bucket.id && calculateAvailability(lockedReplacement).available < quantity) throw new DomainError("Replacement inventory is insufficient.");
    const claim = await beginOperation(sudo, transactionContext, disruption.carrier.id, key, "reaccommodation.confirm", request);
    if (claim.replay) return { ...claim.replay.result ?? {}, replayed: true };
    const nowDate = /* @__PURE__ */ new Date();
    const now = nowDate.toISOString();
    const unwind = {
      checkInIds: [],
      boardingPassIds: [],
      seatAssignmentIds: [],
      documentVerificationIds: []
    };
    for (const checkIn of eligibleCheckIns) {
      if (!["checked_in", "offloaded"].includes(checkIn.status)) continue;
      assertLifecycleTransition("checkIn", checkIn.status, "cancelled");
      await tx.checkIn.update({ where: { id: checkIn.id }, data: { status: "cancelled" } });
      unwind.checkInIds.push(checkIn.id);
    }
    for (const pass of activePasses) {
      assertLifecycleTransition("boardingPass", pass.status, "revoked");
      await tx.boardingPass.update({ where: { id: pass.id }, data: { status: "revoked", revokedAt: nowDate } });
      unwind.boardingPassIds.push(pass.id);
    }
    for (const seat of activeSeats) {
      assertLifecycleTransition("seatAssignment", seat.status, "released");
      await tx.seatAssignment.update({ where: { id: seat.id }, data: { status: "released", occupancyKey: null, releasedAt: nowDate } });
      unwind.seatAssignmentIds.push(seat.id);
    }
    for (const verification of eligibleVerifications) {
      await tx.documentVerification.update({ where: { id: verification.id }, data: { status: "revoked", revokedAt: nowDate } });
      unwind.documentVerificationIds.push(verification.id);
    }
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
      if (debited.count !== 1) throw new DomainError("Replacement inventory is insufficient.");
      if (lockedOriginal.sold < quantity) throw new DomainError("Original inventory accounting is inconsistent.");
      await transactionContext.prisma.inventoryBucket.update({ where: { id: originalBucket.id }, data: { sold: { decrement: quantity } } });
    }
    const record2 = await sudo.query.Reaccommodation.createOne({
      data: {
        carrier: { connect: { id: disruption.carrier.id } },
        reaccommodationKey: `REA-${randomReference("", 12)}`,
        idempotencyKey: claim.storageKey,
        booking: { connect: { id: booking.id } },
        disruption: { connect: { id: disruption.id } },
        status: "confirmed",
        originalSegments: { connect: [{ id: original.id }] },
        replacementSegments: { connect: [{ id: replacementSegment.id }] },
        priceDifferenceAmount: 0,
        additionalCollectionAmount: 0,
        refundAmount: 0,
        currencyCode: booking.currencyCode,
        optionExpiresAt: now,
        acceptedAt: now,
        confirmedAt: now,
        reason: "involuntary",
        optionSnapshot: {
          replacementFlightInstanceId: replacement.id,
          replacementInventoryBucketId: bucket.id,
          eligibleBookingPassengerIds: eligiblePassengerIds,
          boardedOrFlownPassengerIds: party.boardedOrFlownPassengerIds,
          unwind
        }
      },
      query: "id"
    });
    const recoveredPassengerIds = /* @__PURE__ */ new Set();
    for (const ticket of (booking.tickets ?? []).filter((entry) => eligiblePassengerIdSet.has(entry.bookingPassenger?.id))) {
      const oldCoupon = ticket.coupons?.find((coupon) => coupon.bookingSegment?.id === original.id && ["open", "checked_in", "suspended"].includes(coupon.status));
      if (!oldCoupon) continue;
      const obligation = oldCoupon.serviceObligation;
      if (!obligation || obligation.status !== "active" || oldCoupon.serviceObligationVersion !== obligation.currentVersion) throw new DomainError("The original coupon has no current versioned service obligation; reconcile before reaccommodation.");
      const obligationLock = await transactionContext.prisma.$queryRaw(import_client6.Prisma.sql`SELECT "id" FROM "ServiceObligation" WHERE "id" = ${obligation.id} FOR UPDATE`);
      throwIfKeystonePrismaError(obligationLock);
      const lockedObligation = await transactionContext.prisma.serviceObligation.findUnique({ where: { id: obligation.id } });
      if (!lockedObligation || lockedObligation.status !== "active" || lockedObligation.currentVersion !== oldCoupon.serviceObligationVersion) throw new DomainError("The original service obligation changed while preparing reaccommodation.");
      await sudo.query.TicketCoupon.updateOne({ where: { id: oldCoupon.id }, data: { status: "exchanged" } });
      const nextVersion = lockedObligation.currentVersion + 1;
      const versionedObligation = await sudo.query.ServiceObligation.updateOne({ where: { id: obligation.id }, data: { currentVersion: nextVersion }, query: "id currentVersion" });
      throwIfKeystonePrismaError(versionedObligation);
      const remainingSpendableCoupon = (ticket.coupons ?? []).some((coupon) => coupon.id !== oldCoupon.id && ["open", "checked_in"].includes(coupon.status));
      if (!remainingSpendableCoupon) await sudo.query.Ticket.updateOne({ where: { id: ticket.id }, data: { status: "exchanged" } });
      const newTicket = await sudo.query.Ticket.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, ticketNumber: `${booking.carrier.code}-${randomReference("", 12)}`, booking: { connect: { id: booking.id } }, bookingPassenger: { connect: { id: ticket.bookingPassenger.id } }, passenger: { connect: { id: booking.passengers.find((entry) => entry.id === ticket.bookingPassenger.id)?.passenger.id } }, issuingCarrierCode: booking.carrier.code, validatingCarrierCode: booking.carrier.code, status: "issued", totalAmount: 0, currencyCode: booking.currencyCode, issuedAt: now, originalTicket: { connect: { id: ticket.id } }, providerReference: `internal:${record2.id}`, metadata: { reason: "involuntary_reaccommodation" } }, query: "id" });
      const newCoupon = await sudo.query.TicketCoupon.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, couponKey: `${newTicket.id}:${replacementSegment.id}`, ticket: { connect: { id: newTicket.id } }, bookingSegment: { connect: { id: replacementSegment.id } }, serviceObligation: { connect: { id: obligation.id } }, serviceObligationVersion: nextVersion, couponNumber: original.sequence, status: "open", fareBasisCode: bucket.fareBrand?.code ?? original.fareBasisCode, bookingClassCode: bucket.bookingClassCode, amount: 0, currencyCode: booking.currencyCode, entitlementSnapshot: { replacedCouponId: oldCoupon.id } }, query: "id" });
      validateCouponTransformation(
        "alternative",
        [{ id: oldCoupon.id, serviceObligationId: obligation.id, serviceObligationVersion: oldCoupon.serviceObligationVersion, status: "exchanged", bookingPassengerId: ticket.bookingPassenger.id }],
        [{ id: newCoupon.id, serviceObligationId: obligation.id, serviceObligationVersion: nextVersion, status: "open", bookingPassengerId: ticket.bookingPassenger.id }]
      );
      await sudo.query.TicketCouponLineage.createOne({ data: { carrier: { connect: { id: disruption.carrier.id } }, bookingPassenger: { connect: { id: ticket.bookingPassenger.id } }, lineageKey: `${record2.id}:alternative:${oldCoupon.id}:${newCoupon.id}`, changeSetKey: `${record2.id}:${ticket.bookingPassenger.id}:${oldCoupon.id}`, transformation: "alternative", operationType: "reaccommodation", operationId: record2.id, parentCoupon: { connect: { id: oldCoupon.id } }, childCoupon: { connect: { id: newCoupon.id } }, metadata: { originalSegmentId: original.id, replacementSegmentId: replacementSegment.id } }, query: "id" });
      recoveredPassengerIds.add(ticket.bookingPassenger.id);
    }
    if (eligiblePassengerIds.some((id2) => !recoveredPassengerIds.has(id2))) throw new DomainError("A selected passenger coupon changed before the atomic recovery could complete.");
    const originalRetainsBoardedOrFlownTravelers = party.boardedOrFlownPassengerIds.length > 0;
    if (!originalRetainsBoardedOrFlownTravelers) {
      await sudo.query.BookingSegment.updateOne({ where: { id: original.id }, data: { status: "reaccommodated" } });
    }
    await writeAudit(sudo, transactionContext, {
      carrierId: disruption.carrier.id,
      key: claim.storageKey,
      action: "reaccommodation.confirm",
      aggregateType: "Reaccommodation",
      aggregateId: record2.id,
      before: { segmentId: original.id, status: "disrupted" },
      after: { replacementSegmentId: replacementSegment.id, status: "confirmed", originalSegmentStatus: originalRetainsBoardedOrFlownTravelers ? "disrupted" : "reaccommodated" },
      metadata: {
        bookingId: booking.id,
        disruptionId: disruption.id,
        eligiblePassengerCount: eligiblePassengerIds.length,
        boardedOrFlownPassengerCount: party.boardedOrFlownPassengerIds.length,
        unwoundCheckInCount: unwind.checkInIds.length,
        revokedBoardingPassCount: unwind.boardingPassIds.length,
        releasedSeatAssignmentCount: unwind.seatAssignmentIds.length,
        revokedDocumentVerificationCount: unwind.documentVerificationIds.length
      }
    });
    const result = { resourceType: "Reaccommodation", resourceId: record2.id, status: "confirmed", changed: true, replayed: false };
    await finishOperation(sudo, claim.record.id, result);
    return result;
  });
}
var import_client6, disruptionTypes;
var init_airlineRecovery = __esm({
  "features/keystone/mutations/airlineRecovery.ts"() {
    "use strict";
    import_client6 = require("@prisma/client");
    init_access();
    init_lifecycle();
    init_transactions();
    init_coupon_lineage();
    init_recovery_party();
    init_airlineOperations();
    init_airlineWorkflows();
    init_domain_error();
    disruptionTypes = /* @__PURE__ */ new Set(["delay", "cancellation", "schedule_change", "misconnection", "diversion", "equipment_change", "other"]);
  }
});

// features/keystone/lib/refund-cleanup-queue.ts
function statusCounts(rows, segmentId) {
  return rows.filter((row) => row.bookingSegmentId === segmentId).reduce((counts, row) => {
    const status = row.status ?? "unknown";
    counts[status] = row._count?._all ?? 0;
    return counts;
  }, {});
}
function total(counts) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}
function refundCleanupCouponSummary(ticketRows, ancillaryRows, segmentId) {
  const tickets = statusCounts(ticketRows, segmentId);
  const ancillary = statusCounts(ancillaryRows, segmentId);
  return {
    ticketCoupons: total(tickets),
    activeTicketCoupons: ["open", "checked_in", "boarded", "suspended", "unknown"].reduce((sum, status) => sum + (tickets[status] ?? 0), 0),
    refundedTicketCoupons: tickets.refunded ?? 0,
    voidedTicketCoupons: tickets.voided ?? 0,
    boardedCoupons: (tickets.boarded ?? 0) + (tickets.flown ?? 0),
    ancillaryCoupons: total(ancillary),
    activeAncillaryCoupons: ["open", "used", "unknown"].reduce((sum, status) => sum + (ancillary[status] ?? 0), 0),
    refundedAncillaryCoupons: ancillary.refunded ?? 0,
    voidedAncillaryCoupons: ancillary.voided ?? 0
  };
}
function refundCleanupGate(input) {
  const boardedOrFlown = input.boardedOrFlownSegmentCount > 0 || (input.boardedPassengerArtifactCount ?? 0) > 0;
  if (boardedOrFlown) return "blocked_by_boarded_or_flown";
  const dispositionBlocked = (input.bagRecordCount ?? 0) > 0 || (input.paidOrInconsistentSeatCount ?? 0) > 0 || (input.activeAncillaryCouponCount ?? 0) > 0;
  if (input.bookingStatus === "cancelled" && (dispositionBlocked || (input.activePassengerArtifactCount ?? 0) > 0)) {
    return "cancelled_requires_reconciliation";
  }
  if (dispositionBlocked) return "blocked_by_artifact_disposition";
  if (!input.canManageBookings) return "read_only";
  if (input.paymentStatus === "refunded" && !["cancelled", "completed"].includes(input.bookingStatus)) {
    return "booking_desk_cancel_review";
  }
  return "review_required";
}
var init_refund_cleanup_queue = __esm({
  "features/keystone/lib/refund-cleanup-queue.ts"() {
    "use strict";
  }
});

// features/keystone/lib/refund-cleanup-pagination.ts
function normalizeRefundCleanupCursor(value) {
  const cursor = value?.trim();
  if (!cursor) return null;
  if (cursor.length > 128) throw new Error("Refund-cleanup cursor is invalid or expired; reload the station manifest to restart.");
  return cursor;
}
function buildRefundCleanupScope(input) {
  return {
    carrierId: input.carrierId,
    booking: {
      carrierId: input.carrierId,
      OR: [{ paymentStatus: "refunded" }, { ticketingStatus: "voided" }]
    },
    flightInstance: {
      serviceDate: { gte: input.start, lt: input.end },
      ...input.canManageCarriers ? input.originCode ? { origin: { iataCode: input.originCode } } : {} : { originId: { in: input.originIds } }
    }
  };
}
function refundCleanupFindManyArgs(cursor) {
  return {
    orderBy: REFUND_CLEANUP_ORDER_BY,
    take: REFUND_CLEANUP_PAGE_SIZE + 1,
    ...cursor ? { cursor: { id: cursor }, skip: 1 } : {}
  };
}
function refundCleanupPage(rows, totalCount) {
  const items = rows.slice(0, REFUND_CLEANUP_PAGE_SIZE);
  const hasNextPage = rows.length > REFUND_CLEANUP_PAGE_SIZE;
  return {
    items,
    pageSize: REFUND_CLEANUP_PAGE_SIZE,
    totalCount,
    hasNextPage,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null
  };
}
var REFUND_CLEANUP_PAGE_SIZE, REFUND_CLEANUP_ORDER_BY;
var init_refund_cleanup_pagination = __esm({
  "features/keystone/lib/refund-cleanup-pagination.ts"() {
    "use strict";
    REFUND_CLEANUP_PAGE_SIZE = 100;
    REFUND_CLEANUP_ORDER_BY = [
      { flightInstance: { scheduledDepartureAt: "asc" } },
      { booking: { recordLocator: "asc" } },
      { sequence: "asc" },
      { id: "asc" }
    ];
  }
});

// features/keystone/mutations/airlineDepartures.ts
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
  if (originCode && !/^[A-Z]{3}$/.test(originCode)) throw new DomainError("Origin must be a three-letter airport code.");
  const cleanupCursor = normalizeRefundCleanupCursor(args.cleanupCursor);
  const now = /* @__PURE__ */ new Date();
  const user = await context.prisma.user.findUnique({
    where: { id: actor.itemId },
    select: { role: { select: { canManageSecurePassengerData: true, canManageBookings: true, canReadOffers: true, canManageOffers: true, canReadPayments: true, canManagePayments: true } } }
  });
  const canVerifyDocuments = user?.role?.canManageSecurePassengerData === true;
  const canManageBookings = user?.role?.canManageBookings === true;
  const canOpenBookingDesk = canManageBookings;
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
  if (!actor.canManageCarriers && !assignments.length) {
    if (cleanupCursor) throw new DomainError("Refund-cleanup cursor is outside your current station scope; reload the station manifest to restart.");
    return { carrierId: actor.carrierId, serviceDate: normalized, canVerifyDocuments, canManageBookings, canOpenBookingDesk, noStationScope: true, flights: [], refundCleanup: refundCleanupPage([], 0) };
  }
  const originIds = assignments.map((assignment) => assignment.airportId);
  const cleanupWhere = buildRefundCleanupScope({
    carrierId: actor.carrierId,
    start,
    end,
    canManageCarriers: actor.canManageCarriers,
    originCode,
    originIds
  });
  if (cleanupCursor) {
    const cursorInScope = await context.prisma.bookingSegment.findFirst({
      where: { ...cleanupWhere, id: cleanupCursor },
      select: { id: true }
    });
    if (!cursorInScope) throw new DomainError("Refund-cleanup cursor is outside your current carrier/station/date scope or expired; reload the station manifest to restart.");
  }
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
      origin: { select: { id: true, iataCode: true, city: true, countryCode: true } },
      destination: { select: { id: true, iataCode: true, city: true, countryCode: true } },
      bookingSegments: {
        where: { status: { notIn: ["cancelled", "refunded", "reaccommodated"] }, booking: { ticketingStatus: "ticketed", status: { in: ["ticketed", "in_progress"] } } },
        orderBy: [{ booking: { recordLocator: "asc" } }, { sequence: "asc" }],
        include: {
          booking: {
            include: {
              passengers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { passenger: { select: { id: true, givenName: true, familyName: true, dateOfBirth: true } } } },
              checkIns: { include: { boardingPasses: { orderBy: [{ issuedAt: "desc" }, { id: "desc" }] }, seatAssignment: true, ticketCoupon: true } }
            }
          }
        }
      }
    }
  });
  const [cleanupTotalCount, cleanupRows] = await Promise.all([
    context.prisma.bookingSegment.count({ where: cleanupWhere }),
    context.prisma.bookingSegment.findMany({
      where: cleanupWhere,
      ...refundCleanupFindManyArgs(cleanupCursor),
      select: {
        id: true,
        sequence: true,
        status: true,
        originCode: true,
        destinationCode: true,
        booking: {
          select: {
            recordLocator: true,
            status: true,
            paymentStatus: true,
            ticketingStatus: true,
            _count: { select: {
              segments: { where: { status: { in: ["boarded", "flown"] } } },
              serviceObligations: { where: { status: "active" } },
              tickets: { where: { status: { in: ["pending", "issued", "partially_used", "used", "suspended"] } } }
            } }
          }
        },
        flightInstance: { select: { flightNumber: true, status: true, scheduledDepartureAt: true } },
        _count: {
          select: {
            checkIns: { where: { OR: [{ status: { not: "cancelled" } }, { status: null }] } },
            from_BoardingPass_bookingSegment: { where: { OR: [{ status: { in: ["issued", "reissued", "boarded"] } }, { status: null }] } },
            seatAssignments: { where: { OR: [{ status: { in: ["held", "assigned", "confirmed", "boarded"] } }, { status: null }] } },
            primaryBags: true,
            bags: true,
            documentVerifications: { where: { status: "verified" } }
          }
        }
      }
    })
  ]);
  const cleanupPage = refundCleanupPage(cleanupRows, cleanupTotalCount);
  const refundCleanupSegments = cleanupPage.items;
  const cleanupSegmentIds = refundCleanupSegments.map((segment) => segment.id);
  const [boardedCheckIns, boardedPasses, ticketCouponStates, ancillaryCouponStates, paidSeatAssignments] = cleanupSegmentIds.length ? await Promise.all([
    context.prisma.checkIn.groupBy({ by: ["bookingSegmentId"], where: { bookingSegmentId: { in: cleanupSegmentIds }, status: "boarded" }, _count: { _all: true } }),
    context.prisma.boardingPass.groupBy({ by: ["bookingSegmentId"], where: { bookingSegmentId: { in: cleanupSegmentIds }, status: "boarded" }, _count: { _all: true } }),
    context.prisma.ticketCoupon.groupBy({ by: ["bookingSegmentId", "status"], where: { bookingSegmentId: { in: cleanupSegmentIds } }, _count: { _all: true } }),
    context.prisma.electronicMiscCoupon.groupBy({ by: ["bookingSegmentId", "status"], where: { bookingSegmentId: { in: cleanupSegmentIds } }, _count: { _all: true } }),
    context.prisma.seatAssignment.groupBy({ by: ["bookingSegmentId"], where: { bookingSegmentId: { in: cleanupSegmentIds }, OR: [{ amount: { not: 0 } }, { amount: null }] }, _count: { _all: true } })
  ]) : [[], [], [], [], []];
  const groupedCount = (rows, segmentId) => rows.find((row) => row.bookingSegmentId === segmentId)?._count?._all ?? 0;
  const refundCleanup = refundCleanupSegments.map((segment) => {
    const boardedOrFlownSegmentCount = segment.booking._count.segments;
    const boardedCheckInCount = groupedCount(boardedCheckIns, segment.id);
    const boardedPassCount = groupedCount(boardedPasses, segment.id);
    const couponSummary = refundCleanupCouponSummary(ticketCouponStates, ancillaryCouponStates, segment.id);
    const { activeTicketCoupons: activeTicketCouponCount, activeAncillaryCoupons: activeAncillaryCouponCount } = couponSummary;
    const boardedPassengerArtifactCount = boardedCheckInCount + boardedPassCount + couponSummary.boardedCoupons;
    const paidOrInconsistentSeatCount = groupedCount(paidSeatAssignments, segment.id);
    const bagRecordCount = segment._count.primaryBags + segment._count.bags;
    const activePassengerArtifactCount = segment._count.checkIns + segment._count.from_BoardingPass_bookingSegment + segment._count.seatAssignments + activeTicketCouponCount + segment.booking._count.serviceObligations + segment.booking._count.tickets;
    return {
      id: segment.id,
      recordLocator: segment.booking.recordLocator,
      bookingStatus: segment.booking.status,
      paymentStatus: segment.booking.paymentStatus,
      ticketingStatus: segment.booking.ticketingStatus,
      segmentStatus: segment.status,
      sequence: segment.sequence,
      originCode: segment.originCode,
      destinationCode: segment.destinationCode,
      flightNumber: segment.flightInstance.flightNumber,
      flightStatus: segment.flightInstance.status,
      scheduledDepartureAt: segment.flightInstance.scheduledDepartureAt.toISOString(),
      boardedOrFlownSegmentCount,
      boardedPassengerArtifactCount,
      gate: refundCleanupGate({
        canManageBookings,
        bookingStatus: segment.booking.status,
        paymentStatus: segment.booking.paymentStatus,
        ticketingStatus: segment.booking.ticketingStatus,
        boardedOrFlownSegmentCount,
        boardedPassengerArtifactCount,
        bagRecordCount,
        paidOrInconsistentSeatCount,
        activeAncillaryCouponCount,
        activePassengerArtifactCount
      }),
      artifacts: {
        checkIns: segment._count.checkIns,
        boardedCheckIns: boardedCheckInCount,
        boardingPasses: segment._count.from_BoardingPass_bookingSegment,
        boardedPasses: boardedPassCount,
        seatAssignments: segment._count.seatAssignments,
        paidOrInconsistentSeats: paidOrInconsistentSeatCount,
        directBags: segment._count.primaryBags,
        routeLinkedBags: segment._count.bags,
        ticketCoupons: couponSummary.ticketCoupons,
        activeTicketCoupons: couponSummary.activeTicketCoupons,
        refundedTicketCoupons: couponSummary.refundedTicketCoupons,
        voidedTicketCoupons: couponSummary.voidedTicketCoupons,
        boardedCoupons: couponSummary.boardedCoupons,
        ancillaryCoupons: couponSummary.ancillaryCoupons,
        activeAncillaryCoupons: couponSummary.activeAncillaryCoupons,
        refundedAncillaryCoupons: couponSummary.refundedAncillaryCoupons,
        voidedAncillaryCoupons: couponSummary.voidedAncillaryCoupons,
        activeServiceObligations: segment.booking._count.serviceObligations,
        activeTickets: segment.booking._count.tickets,
        documentVerifications: segment._count.documentVerifications
      }
    };
  });
  const passengerIds = [...new Set(flights.flatMap((flight) => flight.bookingSegments.flatMap((segment) => segment.booking.passengers.map((entry) => entry.passenger.id))))];
  const currentProofs = /* @__PURE__ */ new Map();
  for (const flight of flights) for (const segment of flight.bookingSegments) for (const entry of segment.booking.passengers) {
    const key = `${entry.passenger.id}:${segment.id}`;
    if (currentProofs.has(key)) continue;
    const proof = await context.prisma.documentVerification.findFirst({
      where: { carrierId: actor.carrierId, passengerId: entry.passenger.id, bookingSegmentId: segment.id, status: "verified", expiresAt: { gt: now }, travelDocument: { carrierId: actor.carrierId, passengerId: entry.passenger.id, status: "verified", expiresAt: { gt: now } } },
      select: { id: true, passengerId: true, bookingSegmentId: true, status: true, expiresAt: true },
      orderBy: [{ verifiedAt: "desc" }, { id: "asc" }]
    });
    if (proof) currentProofs.set(key, proof);
  }
  const documents = [];
  if (canVerifyDocuments) for (const passengerId of passengerIds) {
    const rows = await context.prisma.travelDocument.findMany({
      where: { carrierId: actor.carrierId, passengerId },
      select: { id: true, passengerId: true, documentType: true, documentNumberLast4: true, status: true, expiresAt: true },
      orderBy: [{ expiresAt: "desc" }, { id: "asc" }],
      take: 21
    });
    documents.push(...rows);
  }
  return {
    carrierId: actor.carrierId,
    carrier: flights[0]?.carrier ?? null,
    serviceDate: normalized,
    canVerifyDocuments,
    canManageBookings,
    canOpenBookingDesk,
    refundCleanup: { ...cleanupPage, items: refundCleanup },
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
        const boardingPass = checkIn?.boardingPasses?.find((entry) => ["issued", "reissued", "boarded"].includes(entry.status)) ?? null;
        return {
          bookingId: segment.booking.id,
          recordLocator: segment.booking.recordLocator,
          bookingPassengerId: bookingPassenger.id,
          bookingSegmentId: segment.id,
          segmentStatus: segment.status,
          passenger: { id: bookingPassenger.passenger.id, givenName: bookingPassenger.passenger.givenName, familyName: bookingPassenger.passenger.familyName, dateOfBirth: canVerifyDocuments ? bookingPassenger.passenger.dateOfBirth?.toISOString().slice(0, 10) ?? null : null },
          documents: documents.filter((document) => document.passengerId === bookingPassenger.passenger.id),
          documentsRequired: travelDocumentsRequired(flight.origin?.countryCode, flight.destination?.countryCode),
          verificationPresent: currentProofs.has(`${bookingPassenger.passenger.id}:${segment.id}`),
          verification: canVerifyDocuments ? currentProofs.get(`${bookingPassenger.passenger.id}:${segment.id}`) ?? null : null,
          checkIn: checkIn ? {
            id: checkIn.id,
            status: checkIn.status,
            checkedInAt: checkIn.checkedInAt?.toISOString() ?? null,
            boardedAt: checkIn.boardedAt?.toISOString() ?? null,
            offloadedAt: checkIn.offloadedAt?.toISOString() ?? null,
            boardingPass: boardingPass ? {
              id: boardingPass.id,
              passNumber: boardingPass.passNumber,
              status: boardingPass.status,
              seatDesignator: boardingPass.seatDesignatorSnapshot,
              boardingGroup: boardingPass.boardingGroup
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
    const passengerPassInclude = {
      carrier: { select: { id: true } },
      checkIn: { include: { ticketCoupon: { include: { serviceObligation: true, ticket: true } }, seatAssignment: { include: { seat: { include: { seatMap: true } } } } } },
      bookingSegment: { include: { flightInstance: true, booking: { include: { passengers: { select: { id: true } } } } } }
    };
    let pass = await transactionContext.prisma.boardingPass.findUnique({
      where: { id: args.boardingPassId },
      include: passengerPassInclude
    });
    if (!pass?.carrierId || !pass.checkIn || !pass.bookingSegment?.flightInstance) throw new DomainError("Boarding pass not found or inaccessible.");
    await requireStationCapability(transactionContext, "canManageAirportService", pass.carrierId, pass.bookingSegment.flightInstance.originId, "canBoard");
    const bookingLock = await transactionContext.prisma.$queryRaw(import_client7.Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${pass.bookingSegment.bookingId} FOR UPDATE`);
    throwIfKeystonePrismaError(bookingLock);
    const flightLock = await transactionContext.prisma.$queryRaw(import_client7.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${pass.bookingSegment.flightInstance.id} FOR UPDATE`);
    throwIfKeystonePrismaError(flightLock);
    pass = await transactionContext.prisma.boardingPass.findUnique({
      where: { id: args.boardingPassId },
      include: passengerPassInclude
    });
    if (!pass?.carrierId || !pass.checkIn || !pass.bookingSegment?.flightInstance) throw new DomainError("Boarding pass changed while preparing passenger service.");
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const reason = args.reason?.trim() || null;
    if (reason && reason.length > 500) throw new DomainError("Reason must be at most 500 characters.");
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
    if (action === "offload" && !reason) throw new DomainError("An offload reason is required.");
    const coupon = pass.checkIn.ticketCoupon;
    const seat = pass.checkIn.seatAssignment;
    if (!coupon?.ticket || !coupon.serviceObligation || !seat?.seat || !seat.seat.seatMap) throw new DomainError("Passenger service requires linked ticket, current service obligation, and seat-map evidence.");
    assertPassengerServiceTransition(action, {
      booking: pass.bookingSegment.booking,
      segment: pass.bookingSegment,
      flight: pass.bookingSegment.flightInstance,
      bookingPassenger: { id: pass.checkIn.bookingPassengerId, carrierId: pass.checkIn.carrierId, passengerId: pass.checkIn.passengerId },
      ticket: coupon.ticket,
      coupon,
      obligation: coupon.serviceObligation,
      checkIn: pass.checkIn,
      boardingPass: pass,
      seatAssignment: {
        ...seat,
        seatMapFlightInstanceId: seat.seat.seatMap.flightInstanceId,
        seatMapStatus: seat.seat.seatMap.status,
        seatDesignator: seat.seat.designator
      }
    }, now);
    if (action === "board") {
      assertLifecycleTransition("boardingPass", pass.status, "boarded");
      assertLifecycleTransition("checkIn", pass.checkIn.status, "boarded");
      if (!pass.checkIn.ticketCoupon || !pass.checkIn.seatAssignment) throw new DomainError("Boarding requires a checked-in coupon and confirmed seat assignment.");
      assertLifecycleTransition("ticketCoupon", pass.checkIn.ticketCoupon.status, "boarded");
      assertLifecycleTransition("seatAssignment", pass.checkIn.seatAssignment.status, "boarded");
      await transactionContext.prisma.boardingPass.update({ where: { id: pass.id }, data: { status: "boarded", boardedAt: now } });
      await transactionContext.prisma.checkIn.update({ where: { id: pass.checkIn.id }, data: { status: "boarded", boardedAt: now } });
      await transactionContext.prisma.ticketCoupon.update({ where: { id: pass.checkIn.ticketCoupon.id }, data: { status: "boarded" } });
      await transactionContext.prisma.seatAssignment.update({ where: { id: pass.checkIn.seatAssignment.id }, data: { status: "boarded" } });
      const segmentStatus = await currentSegmentServiceStatus(transactionContext.prisma, pass.bookingSegment.booking.id, pass.bookingSegment.id);
      await transactionContext.prisma.bookingSegment.update({ where: { id: pass.bookingSegment.id }, data: { status: segmentStatus } });
    } else {
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
var import_client7;
var init_airlineDepartures = __esm({
  "features/keystone/mutations/airlineDepartures.ts"() {
    "use strict";
    init_segment_service_status();
    import_client7 = require("@prisma/client");
    init_access();
    init_lifecycle();
    init_refund_cleanup_queue();
    init_refund_cleanup_pagination();
    init_service_eligibility();
    init_transactions();
    init_airlineWorkflows();
    init_airlineOperations();
    init_domain_error();
    init_travel_documents();
  }
});

// features/keystone/mutations/airlineProvisioning.ts
async function createDatedFlightRecords(tx, input, query) {
  const instanceKey = `${input.carrierCode}:${input.flightNumber}:${input.serviceDate}`;
  const existing = await tx.flightInstance.findUnique({ where: { instanceKey }, select: { id: true, carrierId: true, scheduleId: true, routeId: true, originId: true, destinationId: true, operatingCarrierId: true, flightNumber: true, serviceDate: true, scheduledDepartureAt: true, scheduledArrivalAt: true, status: true } });
  if (existing) {
    if (existing.carrierId !== input.carrierId) throw new DomainError("Dated-flight identity belongs to another carrier.");
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
    if (!bucket2 || !seatMap2 || !sameInput) throw new DomainError("Existing dated service or retained seat/inventory catalog differs from this request; replay will not overwrite retained commercial records.");
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new DomainError("invalid formatted date");
    return result;
  } catch {
    throw new DomainError("Carrier timezone must be a valid IANA timezone for dated service.");
  }
}
function dateTime(value, label) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new DomainError(`${label} must be a valid date-time.`);
  return parsed;
}
function zonedLocalDateTime(value, timezone, label) {
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return dateTime(value, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new DomainError(`${label} must be a local date-time or an ISO date-time with offset.`);
  const target = match.slice(1).map((part, index) => index === 5 && !part ? 0 : Number(part));
  const targetUtc = Date.UTC(target[0], target[1] - 1, target[2], target[3], target[4], target[5] ?? 0);
  let instant = targetUtc;
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    throw new DomainError(`${label} is not valid in the carrier timezone.`);
  }
  const partsAt = (timestamp41) => {
    const parts = formatter.formatToParts(new Date(timestamp41));
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
    if (rendered.some((part, index) => part !== target[index])) throw new DomainError("nonexistent local time");
    if ([-36e5, 36e5].some((delta) => partsAt(instant + delta).every((part, index) => part === target[index]))) throw new DomainError("ambiguous local time");
    return new Date(instant);
  } catch {
    throw new DomainError(`${label} is not valid in the carrier timezone.`);
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
    if (!schedule?.carrierId || !schedule.route || !schedule.operatingCarrierId || !cabin || !fareBrand || schedule.carrierId !== actor.carrierId || cabin.carrierId !== actor.carrierId || fareBrand.carrierId !== actor.carrierId || fareBrand.cabinId !== cabin.id) throw new DomainError("Provisioning catalog records were not found in the current carrier.");
    const serviceDate = normalizeSearchDate(args.serviceDate);
    const currencyCode = String(args.currencyCode).trim().toUpperCase();
    const key = normalizeIdempotencyKey(args.idempotencyKey);
    const request = { ...args, serviceDate, currencyCode };
    const sudo = transactionContext.sudo();
    await requireFreshCarrierPermission(transactionContext, "canManageNetwork", schedule.carrierId);
    const inspected = await inspectOperation(sudo, actor.carrierId, key, "dated-flight.provision", request);
    if (inspected.replay) return { ...inspected.replay.result ?? {}, replayed: true };
    if (fareBrand.status !== "active") throw new DomainError("Dated service requires an active fare brand.");
    await requireFreshCarrierPermission(transactionContext, "canManageNetwork", schedule.carrierId);
    if (schedule.status !== "published") throw new DomainError("Only a published schedule can create sellable dated service.");
    const serviceDay = /* @__PURE__ */ new Date(`${serviceDate}T00:00:00.000Z`);
    if (serviceDay < /* @__PURE__ */ new Date((/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "T00:00:00.000Z") || serviceDay > new Date(Date.now() + 550 * 864e5)) throw new DomainError("Service date must be today through 18 months from now.");
    if (schedule.effectiveFrom && serviceDay < schedule.effectiveFrom || schedule.effectiveTo && serviceDay > schedule.effectiveTo) throw new DomainError("Service date is outside the schedule effective period.");
    const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : [];
    const isoDay = serviceDay.getUTCDay() || 7;
    if (days.length && !days.includes(isoDay)) throw new DomainError("The schedule does not operate on this service day.");
    const departure = zonedLocalDateTime(args.scheduledDepartureAt, schedule.carrier.defaultTimezone, "Scheduled departure");
    const arrival = zonedLocalDateTime(args.scheduledArrivalAt, schedule.carrier.defaultTimezone, "Scheduled arrival");
    if (departure <= /* @__PURE__ */ new Date() || arrival <= departure || arrival.getTime() - departure.getTime() > 24 * 60 * 6e4) throw new DomainError("Scheduled departure must be in the future and arrival must be after departure within 24 hours.");
    if (serviceDateInTimezone(departure, schedule.carrier.defaultTimezone) !== serviceDate) throw new DomainError("Scheduled departure must fall on the service date in the carrier timezone.");
    if (!Number.isSafeInteger(args.capacity) || args.capacity < 1 || args.capacity > 300) throw new DomainError("Capacity must be an integer between 1 and 300.");
    if (![args.baseAmount, args.taxAmount].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new DomainError("Amounts must be non-negative minor-unit integers.");
    checkedMinorTotal([args.baseAmount, args.taxAmount], 9);
    supportedCurrencyCode(currencyCode);
    if (currencyCode !== schedule.carrier.defaultCurrencyCode) throw new DomainError("Currency must match the carrier default currency.");
    const scheduleLock = await transactionContext.prisma.$queryRaw(import_client8.Prisma.sql`SELECT "id" FROM "FlightSchedule" WHERE "id" = ${schedule.id} FOR UPDATE`);
    throwIfKeystonePrismaError(scheduleLock);
    schedule = await transactionContext.prisma.flightSchedule.findUnique({ where: { id: args.scheduleId }, include: { carrier: true, route: true, operatingCarrier: true } });
    if (!schedule?.carrierId || schedule.carrierId !== actor.carrierId || !schedule.route || !schedule.operatingCarrierId || schedule.status !== "published") throw new DomainError("The published schedule changed while provisioning dated service.");
    if (schedule.effectiveFrom && serviceDay < schedule.effectiveFrom || schedule.effectiveTo && serviceDay > schedule.effectiveTo) throw new DomainError("Service date is outside the current schedule effective period.");
    const currentDays = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : [];
    if (currentDays.length && !currentDays.includes(isoDay)) throw new DomainError("The schedule no longer operates on this service day.");
    if (currencyCode !== schedule.carrier.defaultCurrencyCode) throw new DomainError("Currency must match the current carrier default currency.");
    const cabinLock = await transactionContext.prisma.$queryRaw(import_client8.Prisma.sql`SELECT "id" FROM "Cabin" WHERE "id" = ${args.cabinId} FOR UPDATE`);
    throwIfKeystonePrismaError(cabinLock);
    const fareLock = await transactionContext.prisma.$queryRaw(import_client8.Prisma.sql`SELECT "id" FROM "FareBrand" WHERE "id" = ${args.fareBrandId} FOR UPDATE`);
    throwIfKeystonePrismaError(fareLock);
    const [currentCabin, currentFareBrand] = await Promise.all([
      transactionContext.prisma.cabin.findUnique({ where: { id: args.cabinId } }),
      transactionContext.prisma.fareBrand.findUnique({ where: { id: args.fareBrandId } })
    ]);
    if (!currentCabin || !currentFareBrand || currentCabin.carrierId !== actor.carrierId || currentFareBrand.carrierId !== actor.carrierId || currentFareBrand.cabinId !== currentCabin.id || currentFareBrand.status !== "active") throw new DomainError("The active provisioning cabin/fare catalog changed while acquiring locks.");
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
    throw new DomainError("Sales status must be open_for_sale or closed_for_sale.");
  }
}
async function setDatedFlightSalesStatus(_root, args, context) {
  assertDatedFlightSalesStatus(args.status);
  return runSerializableTransaction(context, async (transactionContext) => {
    const actor = await requireFreshPermission(transactionContext, "canManageInventory");
    let flight = await transactionContext.prisma.flightInstance.findUnique({ where: { id: args.flightInstanceId }, include: { inventoryBuckets: true } });
    if (!flight || flight.carrierId !== actor.carrierId) throw new DomainError("Dated flight not found or inaccessible.");
    const lock = await transactionContext.prisma.$queryRaw(import_client8.Prisma.sql`SELECT "id" FROM "FlightInstance" WHERE "id" = ${flight.id} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    flight = await transactionContext.prisma.flightInstance.findUnique({ where: { id: flight.id }, include: { inventoryBuckets: true } });
    if (!flight || flight.carrierId !== actor.carrierId) throw new DomainError("Dated flight changed while updating sales status.");
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
    if (!bucket || bucket.carrierId !== actor.carrierId) throw new DomainError("Inventory bucket not found or inaccessible.");
    const lock = await transactionContext.prisma.$queryRaw(import_client8.Prisma.sql`SELECT "id" FROM "InventoryBucket" WHERE "id" = ${bucket.id} FOR UPDATE`);
    throwIfKeystonePrismaError(lock);
    bucket = await transactionContext.prisma.inventoryBucket.findUnique({ where: { id: bucket.id } });
    if (!bucket || bucket.carrierId !== actor.carrierId) throw new DomainError("Inventory bucket changed while updating authorization.");
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
var import_client8, launchSeatColumns;
var init_airlineProvisioning = __esm({
  "features/keystone/mutations/airlineProvisioning.ts"() {
    "use strict";
    import_client8 = require("@prisma/client");
    init_access();
    init_lifecycle();
    init_validation();
    init_transactions();
    init_airlineOperations();
    init_airlineWorkflows();
    init_currency_policy();
    init_money();
    init_domain_error();
    launchSeatColumns = ["A", "B", "C", "D", "E", "F"];
  }
});

// features/keystone/lib/machine-auth.ts
function hashMachineToken(token) {
  return import_node_crypto12.default.createHash("sha256").update(token).digest("hex");
}
function issueMachineToken() {
  const keyId = import_node_crypto12.default.randomBytes(12).toString("hex");
  const secret = import_node_crypto12.default.randomBytes(32).toString("base64url");
  return { keyId, token: `ofm_${keyId}.${secret}`, tokenHash: hashMachineToken(`ofm_${keyId}.${secret}`) };
}
var import_node_crypto12;
var init_machine_auth = __esm({
  "features/keystone/lib/machine-auth.ts"() {
    "use strict";
    import_node_crypto12 = __toESM(require("node:crypto"));
  }
});

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
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= /* @__PURE__ */ new Date() || expiresAt > new Date(Date.now() + 365 * 24 * 60 * 6e4)) throw new DomainError("Credential expiry must be within the next year.");
  const name = args.name.trim();
  const audience = args.audience.trim();
  const scopes = [...new Set(args.scopes.map((scope) => scope.trim()).filter(Boolean))].sort();
  if (!name || name.length > 120 || !audience || audience.length > 120 || !scopes.length || scopes.some((scope) => scope.length > 120)) throw new DomainError("Credential name, audience, and at least one bounded scope are required.");
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
    return created;
  });
  return { credentialId: credential.id, keyId: issued.keyId, token: issued.token, expiresAt: expiresAt.toISOString() };
}
async function revokeMachineCredential(_root, args, context) {
  const actor = await requireFreshPermission(context, "canManageIntegrations");
  return context.prisma.$transaction(async (tx) => {
    const credential = await tx.machineCredential.findFirst({ where: { id: args.credentialId, carrierId: actor.carrierId, status: "active" }, select: { id: true, audience: true, scopes: true } });
    if (!credential) throw new DomainError("Resource not found or inaccessible.");
    const now = /* @__PURE__ */ new Date();
    const result = await tx.machineCredential.updateMany({ where: { id: credential.id, carrierId: actor.carrierId, status: "active" }, data: { status: "revoked", revokedAt: now } });
    if (result.count !== 1) throw new DomainError("Resource not found or inaccessible.");
    await tx.auditEvent.create({ data: { carrierId: actor.carrierId, actorId: actor.itemId, eventKey: `machine-credential:${credential.id}:revoked`, action: "machine-credential.revoke", aggregateType: "MachineCredential", aggregateId: credential.id, source: "platform", beforeSummary: { status: "active" }, afterSummary: { status: "revoked" }, metadata: { audience: credential.audience, scopes: credential.scopes }, occurredAt: now } });
    return true;
  });
}
var init_machineCredentials = __esm({
  "features/keystone/mutations/machineCredentials.ts"() {
    "use strict";
    init_access();
    init_machine_auth();
    init_domain_error();
  }
});

// features/airline/lib/airport-catalog.ts
var AIRPORT_CATALOG;
var init_airport_catalog = __esm({
  "features/airline/lib/airport-catalog.ts"() {
    "use strict";
    AIRPORT_CATALOG = {
      JFK: { name: "John F. Kennedy International Airport", city: "New York", countryCode: "US", timezone: "America/New_York" },
      BOS: { name: "Boston Logan International Airport", city: "Boston", countryCode: "US", timezone: "America/New_York" },
      LGA: { name: "LaGuardia Airport", city: "New York", countryCode: "US", timezone: "America/New_York" },
      EWR: { name: "Newark Liberty International Airport", city: "Newark", countryCode: "US", timezone: "America/New_York" },
      DCA: { name: "Ronald Reagan Washington National Airport", city: "Washington", countryCode: "US", timezone: "America/New_York" },
      IAD: { name: "Washington Dulles International Airport", city: "Washington", countryCode: "US", timezone: "America/New_York" },
      ATL: { name: "Hartsfield-Jackson Atlanta International Airport", city: "Atlanta", countryCode: "US", timezone: "America/New_York" },
      MIA: { name: "Miami International Airport", city: "Miami", countryCode: "US", timezone: "America/New_York" },
      MCO: { name: "Orlando International Airport", city: "Orlando", countryCode: "US", timezone: "America/New_York" },
      ORD: { name: "O'Hare International Airport", city: "Chicago", countryCode: "US", timezone: "America/Chicago" },
      DFW: { name: "Dallas Fort Worth International Airport", city: "Dallas", countryCode: "US", timezone: "America/Chicago" },
      IAH: { name: "George Bush Intercontinental Airport", city: "Houston", countryCode: "US", timezone: "America/Chicago" },
      AUS: { name: "Austin-Bergstrom International Airport", city: "Austin", countryCode: "US", timezone: "America/Chicago" },
      DEN: { name: "Denver International Airport", city: "Denver", countryCode: "US", timezone: "America/Denver" },
      PHX: { name: "Phoenix Sky Harbor International Airport", city: "Phoenix", countryCode: "US", timezone: "America/Phoenix" },
      LAS: { name: "Harry Reid International Airport", city: "Las Vegas", countryCode: "US", timezone: "America/Los_Angeles" },
      LAX: { name: "Los Angeles International Airport", city: "Los Angeles", countryCode: "US", timezone: "America/Los_Angeles" },
      SFO: { name: "San Francisco International Airport", city: "San Francisco", countryCode: "US", timezone: "America/Los_Angeles" },
      SEA: { name: "Seattle-Tacoma International Airport", city: "Seattle", countryCode: "US", timezone: "America/Los_Angeles" },
      HNL: { name: "Daniel K. Inouye International Airport", city: "Honolulu", countryCode: "US", timezone: "Pacific/Honolulu" },
      YYZ: { name: "Toronto Pearson International Airport", city: "Toronto", countryCode: "CA", timezone: "America/Toronto" },
      YVR: { name: "Vancouver International Airport", city: "Vancouver", countryCode: "CA", timezone: "America/Vancouver" },
      MEX: { name: "Mexico City International Airport", city: "Mexico City", countryCode: "MX", timezone: "America/Mexico_City" },
      CUN: { name: "Canc\xFAn International Airport", city: "Canc\xFAn", countryCode: "MX", timezone: "America/Cancun" },
      GRU: { name: "S\xE3o Paulo/Guarulhos International Airport", city: "S\xE3o Paulo", countryCode: "BR", timezone: "America/Sao_Paulo" },
      LHR: { name: "Heathrow Airport", city: "London", countryCode: "GB", timezone: "Europe/London" },
      LGW: { name: "Gatwick Airport", city: "London", countryCode: "GB", timezone: "Europe/London" },
      DUB: { name: "Dublin Airport", city: "Dublin", countryCode: "IE", timezone: "Europe/Dublin" },
      CDG: { name: "Paris Charles de Gaulle Airport", city: "Paris", countryCode: "FR", timezone: "Europe/Paris" },
      AMS: { name: "Amsterdam Airport Schiphol", city: "Amsterdam", countryCode: "NL", timezone: "Europe/Amsterdam" },
      FRA: { name: "Frankfurt Airport", city: "Frankfurt", countryCode: "DE", timezone: "Europe/Berlin" },
      MAD: { name: "Adolfo Su\xE1rez Madrid-Barajas Airport", city: "Madrid", countryCode: "ES", timezone: "Europe/Madrid" },
      BCN: { name: "Barcelona-El Prat Airport", city: "Barcelona", countryCode: "ES", timezone: "Europe/Madrid" },
      FCO: { name: "Leonardo da Vinci-Fiumicino Airport", city: "Rome", countryCode: "IT", timezone: "Europe/Rome" },
      IST: { name: "Istanbul Airport", city: "Istanbul", countryCode: "TR", timezone: "Europe/Istanbul" },
      DXB: { name: "Dubai International Airport", city: "Dubai", countryCode: "AE", timezone: "Asia/Dubai" },
      DOH: { name: "Hamad International Airport", city: "Doha", countryCode: "QA", timezone: "Asia/Qatar" },
      SIN: { name: "Singapore Changi Airport", city: "Singapore", countryCode: "SG", timezone: "Asia/Singapore" },
      HKG: { name: "Hong Kong International Airport", city: "Hong Kong", countryCode: "HK", timezone: "Asia/Hong_Kong" },
      HND: { name: "Tokyo Haneda Airport", city: "Tokyo", countryCode: "JP", timezone: "Asia/Tokyo" },
      NRT: { name: "Narita International Airport", city: "Tokyo", countryCode: "JP", timezone: "Asia/Tokyo" },
      ICN: { name: "Incheon International Airport", city: "Seoul", countryCode: "KR", timezone: "Asia/Seoul" },
      SYD: { name: "Sydney Kingsford Smith Airport", city: "Sydney", countryCode: "AU", timezone: "Australia/Sydney" },
      AKL: { name: "Auckland Airport", city: "Auckland", countryCode: "NZ", timezone: "Pacific/Auckland" },
      JNB: { name: "O. R. Tambo International Airport", city: "Johannesburg", countryCode: "ZA", timezone: "Africa/Johannesburg" }
    };
  }
});

// features/keystone/mutations/onboarding.ts
function required(value, label, pattern) {
  const normalized = value.trim();
  if (!pattern.test(normalized)) throw new DomainError(`${label} is invalid.`);
  return normalized;
}
function localTime(value, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
  } catch {
    throw new DomainError("Timezone is not a recognized IANA timezone.");
  }
}
async function completeCarrierOnboarding(_root, args, context) {
  const actor = await requireFreshPermission(context, "canManageOnboarding");
  await requireFreshPermission(context, "canManageNetwork");
  await requireFreshPermission(context, "canManageInventory");
  await requireFreshPermission(context, "canManagePayments");
  await requireFreshPermission(context, "canManageIntegrations");
  await requireFreshPermission(context, "canManageUsers");
  const serviceDate = normalizeSearchDate(args.serviceDate);
  const timezone = required(args.timezone, "Timezone", /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/);
  const departure = zonedLocalDateTime(args.scheduledDepartureAt, timezone, "Scheduled departure");
  const arrival = zonedLocalDateTime(args.scheduledArrivalAt, timezone, "Scheduled arrival");
  if (departure <= /* @__PURE__ */ new Date() || arrival <= departure || arrival.getTime() - departure.getTime() > 24 * 60 * 6e4) throw new DomainError("Scheduled departure must be in the future and arrival must be after departure within 24 hours.");
  const serviceDay = /* @__PURE__ */ new Date(`${serviceDate}T00:00:00.000Z`);
  if (serviceDay < /* @__PURE__ */ new Date((/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "T00:00:00.000Z") || serviceDay > new Date(Date.now() + 180 * 864e5)) throw new DomainError("Initial service date must be today through six months from now.");
  if (!Number.isSafeInteger(args.capacity) || args.capacity < 1 || args.capacity > 300) throw new DomainError("Capacity must be an integer between 1 and 300.");
  if (![args.baseAmount, args.taxAmount].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new DomainError("Amounts must be non-negative minor-unit integers.");
  checkedMinorTotal([args.baseAmount, args.taxAmount], 9);
  const data = {
    name: required(args.name, "Carrier name", /^.{2,120}$/),
    legalName: required(args.legalName, "Legal name", /^.{2,160}$/),
    code: required(args.code.toUpperCase(), "Carrier code", /^[A-Z0-9]{2,3}$/),
    defaultCurrencyCode: supportedCurrencyCode(args.currencyCode),
    defaultTimezone: timezone,
    originCode: required(args.originCode.toUpperCase(), "Origin airport", /^[A-Z]{3}$/),
    destinationCode: required(args.destinationCode.toUpperCase(), "Destination airport", /^[A-Z]{3}$/),
    flightNumber: required(args.flightNumber.toUpperCase(), "Flight number", /^[A-Z0-9]{1,6}$/),
    serviceDate,
    scheduledDepartureAt: departure.toISOString(),
    scheduledArrivalAt: arrival.toISOString(),
    capacity: args.capacity,
    baseAmount: args.baseAmount,
    taxAmount: args.taxAmount
  };
  if (data.originCode === data.destinationCode) throw new DomainError("Origin and destination must differ.");
  if (serviceDateInTimezone(departure, data.defaultTimezone) !== serviceDate) throw new DomainError("Scheduled departure must fall on the service date in the carrier timezone.");
  const digest = import_node_crypto13.default.createHash("sha256").update(JSON.stringify(data)).digest("hex");
  try {
    return await runSerializableTransaction(context, async (transactionContext) => {
      const tx = transactionContext.prisma;
      const sudo = transactionContext.sudo();
      const now = /* @__PURE__ */ new Date();
      await tx.$queryRaw`SELECT "id" FROM "Carrier" WHERE "id" = ${actor.carrierId} FOR UPDATE`;
      const currentCarrier = await tx.carrier.findUnique({ where: { id: actor.carrierId }, select: { code: true, defaultCurrencyCode: true, defaultTimezone: true } });
      if (!currentCarrier) throw new DomainError("Carrier not found or inaccessible.");
      if (currentCarrier.code !== data.code || currentCarrier.defaultCurrencyCode !== data.defaultCurrencyCode || currentCarrier.defaultTimezone !== data.defaultTimezone) {
        const retainedCommercialRows = await tx.flightInstance.count({ where: { carrierId: actor.carrierId } }) + await tx.booking.count({ where: { carrierId: actor.carrierId } }) + await tx.offer.count({ where: { carrierId: actor.carrierId } });
        if (retainedCommercialRows) throw new DomainError("Carrier code, currency, and timezone cannot change after dated flights, offers, or bookings exist.");
      }
      await tx.user.update({ where: { id: actor.itemId }, data: { onboardingStatus: "in_progress" } });
      const carrierRecord = await tx.carrier.update({ where: { id: actor.carrierId }, data: { name: data.name, legalName: data.legalName, code: data.code, defaultCurrencyCode: data.defaultCurrencyCode, defaultTimezone: data.defaultTimezone } });
      const loadAirport = async (iataCode) => {
        const existing = await tx.airport.findUnique({ where: { iataCode } });
        const reference = initialAirportCatalog[iataCode];
        if (existing) {
          if (!existing.isActive) throw new DomainError(`Airport ${iataCode} is inactive.`);
          return existing;
        }
        if (!reference) throw new DomainError(`Add airport ${iataCode} on the Network page first.`);
        return tx.airport.create({ data: { iataCode, ...reference } });
      };
      const [origin, destination] = await Promise.all([loadAirport(data.originCode), loadAirport(data.destinationCode)]);
      const route = await tx.route.upsert({
        where: { routeKey: `${data.code}:${data.originCode}:${data.destinationCode}` },
        update: {},
        create: { carrierId: actor.carrierId, routeKey: `${data.code}:${data.originCode}:${data.destinationCode}`, originId: origin.id, destinationId: destination.id, status: "active" }
      });
      if (route.carrierId !== actor.carrierId || route.originId !== origin.id || route.destinationId !== destination.id || route.status !== "active") throw new DomainError("Retained route differs from the authoritative launch catalog.");
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
      if (schedule.carrierId !== actor.carrierId || schedule.routeId !== route.id || schedule.operatingCarrierId !== actor.carrierId || schedule.flightNumber !== data.flightNumber || schedule.departureLocalTime !== expectedDepartureLocalTime || schedule.arrivalLocalTime !== expectedArrivalLocalTime || schedule.arrivalDayOffset !== expectedArrivalDayOffset || schedule.status !== "published" || !schedule.effectiveFrom || schedule.effectiveFrom > serviceDay || !schedule.effectiveTo || schedule.effectiveTo < serviceDay || !Array.isArray(schedule.daysOfWeek) || !schedule.daysOfWeek.includes(expectedScheduleDay)) throw new DomainError("Retained schedule differs from the authoritative launch catalog.");
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
        if (!catalogMatches) throw new DomainError("Retained launch inventory catalog differs from the bounded onboarding contract; replay will not rewrite commercial relationships.");
      } else {
        const launchCabinId = `${actor.carrierId}:launch-cabin-y`;
        const launchFareBrandId = `${actor.carrierId}:launch-fare-standard`;
        const [retainedCabin, retainedFareBrand] = await Promise.all([
          tx.cabin.findUnique({ where: { id: launchCabinId } }),
          tx.fareBrand.findUnique({ where: { id: launchFareBrandId } })
        ]);
        const cabinCompatible = (record2) => !record2 || record2.carrierId === actor.carrierId && record2.code === "Y" && record2.name === "Economy" && record2.cabinClass === "economy";
        const fareCompatible = (record2) => !record2 || record2.carrierId === actor.carrierId && record2.cabinId === launchCabinId && record2.code === "STANDARD" && record2.name === "Standard" && record2.status === "active" && record2.includedBaggage?.pieces === 1 && record2.includedBaggage?.maxWeightGrams === 23e3 && JSON.stringify(record2.benefits) === JSON.stringify(["Standard seat selection", "One checked bag"]);
        if (!cabinCompatible(retainedCabin) || !fareCompatible(retainedFareBrand)) throw new DomainError("Partial retained launch cabin/fare catalog differs from the bounded onboarding contract; replay will not complete or rewrite it.");
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
        if (!cabinCompatible(cabin) || !fareCompatible(fareBrand)) throw new DomainError("Launch cabin/fare catalog could not be verified after creation.");
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
      if ([paymentProvider, settlementProvider, settlementConnection].some((row) => row.carrierId !== actor.carrierId) || settlementConnection.providerId !== settlementProvider.id) {
        throw new DomainError("Settlement provider keys for this carrier code belong to another carrier or connection; reconcile them before launch review.");
      }
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
      const storefrontReady = hasConfiguredStorefrontBrand(carrierRecord);
      const steps = [
        await upsertStep(PROFILE_STEP, profileReady ? "completed" : "needs_attention", profileReady ? [] : ["Turn on direct sales for your carrier in Carrier settings."]),
        await upsertStep(CATALOG_STEP, "completed"),
        await upsertStep(DATED_SERVICE_STEP, datedReady ? "completed" : "needs_attention", datedReady ? [] : ["Open a future flight for sale on Schedules & flights."]),
        await upsertStep(STATION_STEP, stationReady ? "completed" : "needs_attention", stationReady ? [] : ["Give an operator check-in, bag and boarding access at the origin airport on Stations & access."]),
        await upsertStep(SETTLEMENT_STEP, settlementReady ? "completed" : "needs_attention", settlementReady ? ["One payment operator records money received; a second approves it."] : ["Add a second user with payment permission (one records payments, another approves them), keep the manual settlement provider active on Payment providers, and keep an active settlement credential."]),
        await upsertStep(REVIEW_STEP, completed ? "completed" : "needs_attention", completed ? storefrontReady ? [] : ["Set the storefront title, description and brand colour in Storefront settings to start selling."] : ["Finish the steps above, then run setup again."])
      ];
      await tx.user.update({ where: { id: actor.itemId }, data: { onboardingStatus: completed ? "completed" : "in_progress" } });
      if (completed) await tx.user.updateMany({
        where: { carrierId: actor.carrierId, id: { not: actor.itemId }, onboardingStatus: { in: ["not_started", "in_progress", "dismissed"] }, role: { canManageOnboarding: true } },
        data: { onboardingStatus: "completed" }
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
async function dismissCarrierOnboarding(_root, _args, context) {
  const actor = await requireFreshPermission(context, "canManageOnboarding");
  return context.prisma.$transaction(async (tx) => {
    const dismissed = await tx.user.updateMany({
      where: { id: actor.itemId, carrierId: actor.carrierId, onboardingStatus: { in: ["not_started", "in_progress"] } },
      data: { onboardingStatus: "dismissed" }
    });
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.itemId }, select: { id: true, onboardingStatus: true } });
    if (dismissed.count === 1) {
      const now = /* @__PURE__ */ new Date();
      await tx.auditEvent.create({ data: {
        carrierId: actor.carrierId,
        actorId: actor.itemId,
        eventKey: `user:${actor.itemId}:onboarding-dismissed:${now.getTime()}`,
        action: "onboarding.dismiss",
        aggregateType: "User",
        aggregateId: actor.itemId,
        source: "platform",
        beforeSummary: {},
        afterSummary: { onboardingStatus: "dismissed" },
        metadata: {},
        occurredAt: now
      } });
    }
    return { id: user.id, onboardingStatus: user.onboardingStatus };
  });
}
var import_node_crypto13, PROFILE_STEP, CATALOG_STEP, DATED_SERVICE_STEP, STATION_STEP, SETTLEMENT_STEP, REVIEW_STEP, initialAirportCatalog;
var init_onboarding = __esm({
  "features/keystone/mutations/onboarding.ts"() {
    "use strict";
    import_node_crypto13 = __toESM(require("node:crypto"));
    init_access();
    init_bounded_payment_policy();
    init_currency_policy();
    init_transactions();
    init_seed();
    init_airlineProvisioning();
    init_airlineWorkflows();
    init_domain_error();
    init_airport_catalog();
    init_branding();
    init_money();
    [PROFILE_STEP, CATALOG_STEP, DATED_SERVICE_STEP, STATION_STEP, SETTLEMENT_STEP, REVIEW_STEP] = seed_default.steps.map((step) => step.key);
    initialAirportCatalog = AIRPORT_CATALOG;
  }
});

// features/keystone/mutations/storefrontSettings.ts
function optionalText2(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > max) throw new DomainError(`${label} must be at most ${max} characters.`);
  return normalized;
}
function boundedText(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) throw new DomainError(`${label} is required and must be at most ${max} characters.`);
  return normalized;
}
function contactDetails(input) {
  const storefrontContactEmail = optionalText2(input.storefrontContactEmail, "Contact email", 254).toLowerCase();
  if (storefrontContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storefrontContactEmail)) throw new DomainError("Enter a valid contact email.");
  const storefrontContactPhone = optionalText2(input.storefrontContactPhone, "Contact phone", 40);
  if (storefrontContactPhone && !/^[+()0-9 .-]{5,40}$/.test(storefrontContactPhone)) throw new DomainError("Enter a valid contact phone.");
  return { storefrontContactEmail, storefrontContactPhone, storefrontServiceHours: optionalText2(input.storefrontServiceHours, "Service hours", 200) };
}
function logoDetails(input) {
  const logo = {};
  if (input.logoIcon) {
    const logoIcon = sanitizeStoreLogoSvg(input.logoIcon);
    if (!logoIcon) throw new DomainError("Logo must be a valid, safe SVG document.");
    logo.logoIcon = logoIcon;
  }
  if (input.logoColor !== void 0 && input.logoColor !== null) logo.logoColor = normalizeStoreLogoColor(input.logoColor);
  return logo;
}
function normalizeStorefrontSettingsInput(input) {
  const storefrontBrandColor = normalizeStorefrontBrandColor(input.storefrontBrandColor);
  if (!storefrontBrandColor) throw new DomainError("Choose one of the approved storefront colors.");
  return {
    name: boundedText(input.name, "Carrier name", 120),
    legalName: boundedText(input.legalName, "Legal name", 160),
    storefrontBrandColor,
    storefrontHomepageTitle: boundedText(input.storefrontHomepageTitle, "Homepage title", 120),
    storefrontHomepageDescription: boundedText(input.storefrontHomepageDescription, "Homepage description", 320),
    ...contactDetails(input),
    ...logoDetails(input)
  };
}
async function updateCarrierStorefrontSettings(_root, args, context) {
  const actor = await requireFreshPermission(context, "canManageOnboarding");
  const data = normalizeStorefrontSettingsInput(args);
  return context.prisma.$transaction(async (tx) => {
    const before = await tx.carrier.findUniqueOrThrow({ where: { id: actor.carrierId }, select: { name: true, legalName: true, logoIcon: true, logoColor: true, storefrontBrandColor: true, storefrontHomepageTitle: true, storefrontHomepageDescription: true, storefrontContactEmail: true, storefrontContactPhone: true, storefrontServiceHours: true } });
    const updated = await tx.carrier.update({ where: { id: actor.carrierId }, data });
    const now = /* @__PURE__ */ new Date();
    await tx.auditEvent.create({ data: {
      carrierId: actor.carrierId,
      actorId: actor.itemId,
      eventKey: `carrier:${actor.carrierId}:storefront-settings:${now.getTime()}`,
      action: "carrier.storefront.update",
      aggregateType: "Carrier",
      aggregateId: actor.carrierId,
      source: "platform",
      beforeSummary: before,
      afterSummary: data,
      metadata: {},
      occurredAt: now
    } });
    return updated;
  });
}
var init_storefrontSettings = __esm({
  "features/keystone/mutations/storefrontSettings.ts"() {
    "use strict";
    init_access();
    init_branding();
    init_domain_error();
    init_store_logo();
    init_storeLogo();
  }
});

// features/keystone/mutations/index.ts
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql2`
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
        bookingReceipt: JSON
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
        description: String
        baggagePieces: Int
        baggageWeightGrams: Int
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
        logoIcon: String
        logoColor: String
        storefrontHomepageTitle: String
        storefrontHomepageDescription: String
        storefrontConfigured: Boolean!
        accessRecoveryEnabled: Boolean!
        onlinePaymentEnabled: Boolean!
        storefrontContactEmail: String
        storefrontContactPhone: String
        storefrontServiceHours: String
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
        cabinName: String
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
        originTimezone: String!
        destinationCode: String!
        destinationCity: String!
        destinationTimezone: String!
        disruption: PublicFlightDisruption
      }

      type CustomerCheckoutSession {
        url: String!
        checkoutSessionId: String!
      }

      type CustomerCheckoutResult {
        status: String!
        ticketingStatus: String!
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

      type OnboardingStatusResult {
        id: ID!
        onboardingStatus: String!
      }

      type IssuedMachineCredential {
        credentialId: ID!
        keyId: String!
        token: String!
        expiresAt: String!
      }

      type CustomerCancellationQuote {
        allowed: Boolean!
        reason: String!
        refundAmount: Int!
        feeAmount: Int!
        currencyCode: String!
        summary: String!
      }

      type CustomerCancellationResult {
        status: String!
        refundAmount: Int!
        currencyCode: String!
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
        bookingReceipt: JSON!
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
        customerCancellationQuote(recordLocator: String!, accessToken: String!): CustomerCancellationQuote!
        operatorBookingReceipt(bookingId: ID!): JSON!
        publicCarrierIdentity(carrierCode: String!): PublicCarrierIdentity
        departureManifest(serviceDate: String!, originCode: String, cleanupCursor: String): JSON!
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
          storefrontContactEmail: String
          storefrontContactPhone: String
          storefrontServiceHours: String
          logoIcon: String
          logoColor: String
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
        dismissCarrierOnboarding: OnboardingStatusResult!
        issueMachineCredential(name: String!, audience: String!, scopes: [String!]!, expiresAt: String!): IssuedMachineCredential!
        revokeMachineCredential(credentialId: ID!): Boolean!
        registerAirport(iataCode: String!, icaoCode: String, name: String!, city: String!, countryCode: String!, subdivisionCode: String, timezone: String!, idempotencyKey: String!): AirlineOperationResult!
        updateFlightOperations(
          flightInstanceId: ID!
          departureTerminal: String
          departureGate: String
          arrivalTerminal: String
          arrivalGate: String
          estimatedDepartureAt: String
          estimatedArrivalAt: String
          actualDepartureAt: String
          actualArrivalAt: String
          status: String
          idempotencyKey: String!
        ): AirlineOperationResult!
        recordBagEvent(bagId: ID!, action: String!, airportCode: String, note: String, idempotencyKey: String!): AirlineOperationResult!
        startCustomerCheckout(carrierCode: String!, recordLocator: String!, accessToken: String!): CustomerCheckoutSession!
        completeCustomerCheckout(carrierCode: String!, recordLocator: String!, accessToken: String!, checkoutSessionId: String): CustomerCheckoutResult!
        recordReceivedPayment(bookingId: ID!, purpose: String!, method: String!, externalReference: String!, amount: Int!, receivedAt: String!, idempotencyKey: String!): AirlineOperationResult!
        reissueBookingAccessCode(bookingId: ID!): RotatedBookingAccess!
        rotateCustomerBookingAccessToken(recordLocator: String!, accessToken: String!): RotatedBookingAccess!
        recoverCustomerBookingAccess(carrierCode: String!, recordLocator: String!, email: String!): Boolean!
        cancelCustomerBooking(recordLocator: String!, accessToken: String!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
        cancelCustomerBookingWithRefund(recordLocator: String!, accessToken: String!, reason: String!, idempotencyKey: String!): CustomerCancellationResult!
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
          recoverOnly: Boolean
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
          recoverOnly: Boolean
        ): AirlineOperationResult!
        cancelBooking(bookingId: ID!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        customerBooking: getCustomerBooking,
        customerCancellationQuote,
        operatorBookingReceipt,
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
        dismissCarrierOnboarding,
        issueMachineCredential,
        revokeMachineCredential,
        createCustomerOffer,
        createCustomerBooking,
        rotateCustomerBookingAccessToken,
        registerAirport,
        updateFlightOperations,
        recordBagEvent,
        recordReceivedPayment,
        startCustomerCheckout,
        completeCustomerCheckout,
        reissueBookingAccessCode,
        recoverCustomerBookingAccess,
        cancelCustomerBooking,
        cancelCustomerBookingWithRefund,
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
var import_schema, graphql2;
var init_mutations = __esm({
  "features/keystone/mutations/index.ts"() {
    "use strict";
    import_schema = require("@graphql-tools/schema");
    init_redirectToInit();
    init_airlineOperations();
    init_airlineWorkflows();
    init_storefrontAccess();
    init_storefrontCancellation();
    init_airlineOperationsControl();
    init_airlinePaymentsDesk();
    init_storefrontPayments();
    init_storefront();
    init_airlineRecovery();
    init_airlineDepartures();
    init_airlineProvisioning();
    init_machineCredentials();
    init_onboarding();
    init_storefrontSettings();
    graphql2 = String.raw;
  }
});

// features/keystone/database-url.ts
function pooledDatabaseUrl(url, role = "web") {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.searchParams.has("connection_limit")) return url;
  const override = Number(process.env[OVERRIDE_ENV[role]]);
  parsed.searchParams.set("connection_limit", String(Number.isInteger(override) && override > 0 ? override : POOL_SIZES[role]));
  return parsed.toString();
}
var POOL_SIZES, OVERRIDE_ENV;
var init_database_url = __esm({
  "features/keystone/database-url.ts"() {
    "use strict";
    POOL_SIZES = { web: 15, worker: 5 };
    OVERRIDE_ENV = {
      web: "DATABASE_CONNECTION_LIMIT",
      worker: "DATABASE_CONNECTION_LIMIT_WORKER"
    };
  }
});

// features/keystone/lib/keystonePrismaErrors.ts
function isKeystonePrismaError(value) {
  return value instanceof Error && value.extensions?.code === "KS_PRISMA_ERROR";
}
function rethrowKeystonePrismaError(value) {
  if (!isKeystonePrismaError(value)) return value;
  const prisma = value.extensions.prisma ?? {};
  throw Object.assign(value, { code: prisma.code, meta: prisma.meta, clientVersion: prisma.clientVersion });
}
function throwing(result) {
  if (!result || typeof result.then !== "function") return rethrowKeystonePrismaError(result);
  const settled = () => result.then(rethrowKeystonePrismaError);
  return new Proxy(result, {
    get(target, key) {
      if (key === "then") return (ok, fail) => settled().then(ok, fail);
      if (key === "catch") return (fail) => settled().catch(fail);
      if (key === "finally") return (done) => settled().finally(done);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
function throwingDelegate(delegate) {
  const cached = delegates.get(delegate);
  if (cached) return cached;
  const wrapped = new Proxy(delegate, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? (...args) => throwing(value.apply(target, args)) : value;
    }
  });
  delegates.set(delegate, wrapped);
  return wrapped;
}
function throwKeystonePrismaErrors(client) {
  const cached = clients.get(client);
  if (cached) return cached;
  const wrapped = new Proxy(client, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "$transaction" && typeof value === "function") {
        return (work, ...options) => {
          if (typeof work === "function") return value.call(target, (tx) => work(throwKeystonePrismaErrors(tx)), ...options);
          return Promise.resolve(value.call(target, work, ...options)).then((results) => Array.isArray(results) ? results.map(rethrowKeystonePrismaError) : results);
        };
      }
      if (key === "$extends" && typeof value === "function") return (...args) => throwKeystonePrismaErrors(value.apply(target, args));
      if (typeof key === "string" && RAW_METHOD.test(key) && typeof value === "function") return (...args) => throwing(value.apply(target, args));
      if (typeof value === "function") return value.bind(target);
      if (typeof key === "string" && !key.startsWith("$") && value && typeof value === "object" && typeof value.findFirst === "function") return throwingDelegate(value);
      return value;
    }
  });
  clients.set(client, wrapped);
  return wrapped;
}
var RAW_METHOD, clients, delegates;
var init_keystonePrismaErrors = __esm({
  "features/keystone/lib/keystonePrismaErrors.ts"() {
    "use strict";
    RAW_METHOD = /^\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe|queryRawTyped|runCommandRaw)$/;
    clients = /* @__PURE__ */ new WeakMap();
    delegates = /* @__PURE__ */ new WeakMap();
  }
});

// features/keystone/index.ts
function productionValue(name, developmentFallback) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProduction) throw new Error(`${name} is required in production.`);
  return developmentFallback;
}
var import_auth, import_core58, import_config, import_session2, isProduction, databaseURL, sessionConfig, bucketName, region, accessKeyId, secretAccessKey, endpoint, withAuth, keystone_default;
var init_keystone = __esm({
  "features/keystone/index.ts"() {
    "use strict";
    init_s3_storage();
    import_auth = require("@keystone-6/auth");
    import_core58 = require("@keystone-6/core");
    import_config = require("dotenv/config");
    init_models();
    import_session2 = require("@keystone-6/core/session");
    init_mutations();
    init_mail();
    init_session();
    init_access();
    init_fields();
    init_initial_operator_setup();
    init_database_url();
    init_keystonePrismaErrors();
    isProduction = process.env.NODE_ENV === "production";
    databaseURL = productionValue("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/openfront_airline");
    sessionConfig = {
      maxAge: 60 * 60 * 24 * 30,
      secret: resolveSessionSecret()
    };
    bucketName = productionValue("S3_BUCKET_NAME", "keystone-test");
    region = productionValue("S3_REGION", "us-east-1");
    accessKeyId = productionValue("S3_ACCESS_KEY_ID", "keystone");
    secretAccessKey = productionValue("S3_SECRET_ACCESS_KEY", "keystone");
    endpoint = productionValue("S3_ENDPOINT", "http://localhost:9000");
    ({ withAuth } = (0, import_auth.createAuth)({
      listKey: "User",
      identityField: "email",
      secretField: "password",
      // Keystone's normal empty-database init flow, as in E-commerce: it is permitted only while no User exists.
      initFirstItem: initialOperatorSetupEnabled() ? {
        fields: ["name", "email", "password"]
        // The carrier and role are attached by the User resolveInput hook, in one transaction, only for valid details.
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
    }));
    keystone_default = withAuth(
      (0, import_core58.config)({
        db: {
          provider: "postgresql",
          url: pooledDatabaseUrl(databaseURL),
          // Keystone returns failed queries as values; this makes them throw so transactions roll back.
          extendPrismaClient: throwKeystonePrismaErrors
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
            forcePathStyle: s3ForcePathStyle(endpoint)
          }
        },
        ui: {
          isAccessAllowed: (context) => hasFreshPermission({ session: context.session, context }, "canAccessDashboard")
        },
        session: (0, import_session2.statelessSessions)(sessionConfig),
        graphql: {
          extendGraphqlSchema
        }
      })
    );
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);
init_keystone();
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
