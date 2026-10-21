import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { carrierScopedAccess } from '../access'
import { carrierRelationshipHooks, combineListHooks, commandOwnedRelationshipHooks, requiredRelationshipHooks } from '../lib/validation'
import { trackingFields } from './trackingFields'

export const Passenger = list({
  access: carrierScopedAccess('canReadPassengers', 'canManagePassengers'),
  ui: {
    labelField: 'familyName',
    listView: { initialColumns: ['givenName', 'familyName', 'dateOfBirth', 'email', 'status', 'carrier'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    passengerKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    title: text(),
    givenName: text({ validation: { isRequired: true } }),
    middleNames: text(),
    familyName: text({ validation: { isRequired: true } }),
    suffix: text(),
    dateOfBirth: timestamp(),
    genderMarker: select({
      type: 'enum',
      options: [
        { label: 'Female', value: 'female' },
        { label: 'Male', value: 'male' },
        { label: 'Unspecified', value: 'unspecified' },
        { label: 'Undisclosed', value: 'undisclosed' },
      ],
    }),
    nationalityCode: text({
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z]{2}$/, explanation: 'Use an ISO 3166-1 alpha-2 code.' } },
    }),
    email: text(),
    phone: text(),
    preferredLanguage: text({ defaultValue: 'en' }),
    status: select({
      type: 'enum',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Merged', value: 'merged' },
        { label: 'Restricted', value: 'restricted' },
        { label: 'Archived', value: 'archived' },
      ],
    }),
    loyaltyPrograms: json({ defaultValue: [] }),
    preferences: json({ defaultValue: {} }),
    userAccount: relationship({ ref: 'User.passengerProfile' }),
    travelDocuments: relationship({ ref: 'TravelDocument.passenger', many: true }),
    documentVerifications: relationship({ ref: 'DocumentVerification.passenger', many: true }),
    bookingPassengers: relationship({ ref: 'BookingPassenger.passenger', many: true }),
    offers: relationship({ ref: 'Offer.passengers', many: true }),
    serviceRequests: relationship({ ref: 'ServiceRequest.passenger', many: true }),
    tickets: relationship({ ref: 'Ticket.passenger', many: true }),
    electronicMiscDocuments: relationship({ ref: 'ElectronicMiscDocument.passenger', many: true }),
    seatAssignments: relationship({ ref: 'SeatAssignment.passenger', many: true }),
    checkIns: relationship({ ref: 'CheckIn.passenger', many: true }),
    boardingPasses: relationship({ ref: 'BoardingPass.passenger', many: true }),
    bags: relationship({ ref: 'Bag.passenger', many: true }),
    reaccommodations: relationship({ ref: 'Reaccommodation.passenger', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    carrierRelationshipHooks({ userAccount: { model: 'user' } }),
    commandOwnedRelationshipHooks(['travelDocuments', 'documentVerifications', 'bookingPassengers', 'offers', 'serviceRequests', 'tickets', 'electronicMiscDocuments', 'seatAssignments', 'checkIns', 'boardingPasses', 'bags', 'reaccommodations']),
  ),
})
