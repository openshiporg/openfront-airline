// Keystone rejects an empty string in an id filter, failing the whole query. Worklist queries that check a cursor
// (or a selected record) in a second alias pass this id instead when there is none: it matches no record.
export const NO_RECORD_ID = 'no-record'
