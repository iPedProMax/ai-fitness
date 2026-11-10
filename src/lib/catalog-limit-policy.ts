/** Product database has stricter upstream limits shared by a server egress IP.
 * These caps have buffer for other tools or API traffic behind that IP. */
export const CATALOG_LIMITS = {
  barcode:{perMinutePerUser:3,perMinuteGlobal:10,perDayPerUser:40},
  search:{perMinutePerUser:2,perMinuteGlobal:6,perDayPerUser:15},
} as const;
export type CatalogLimitKind=keyof typeof CATALOG_LIMITS;
