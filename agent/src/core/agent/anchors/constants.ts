export const ANCHOR_VERSIONS = {
  STANDARD: 'standard',
} as const;

export const ANCHOR_DEFAULTS = {
  LOCATION: 'South Jakarta',
} as const;

export const ANCHOR_TEMPLATES = {
  STANDARD_ANCHOR: (year: number | string, location: string) => 
    `<context_anchor>Current_Year: ${year} | Session_Start_Location: ${location}</context_anchor>`,
} as const;
