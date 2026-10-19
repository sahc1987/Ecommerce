/**
 * Single source of design tokens, mirroring the web app (Tailwind slate + the
 * `primary` blue in frontend/src/index.css) so the two clients feel like one
 * product. Text colours meet 4.5:1 on `bg`/`surface`; `control` meets the 3:1
 * needed for input and chip borders.
 */
export const colors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  border: '#e2e8f0',
  control: '#8091a7',
  text: '#0f172a',
  textMuted: '#475569',
  textFaint: '#64748b',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primarySoft: '#eff6ff',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  success: '#15803d',
  successSoft: '#f0fdf4',
  warning: '#b45309',
  warningSoft: '#fffbeb',
  info: '#0284c7',
  infoSoft: '#f0f9ff',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
};

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
};

export const shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 2,
  },
};

export const statusColor: Record<string, {bg: string; fg: string}> = {
  pending: {bg: colors.warningSoft, fg: colors.warning},
  paid: {bg: colors.infoSoft, fg: colors.info},
  processing: {bg: colors.primarySoft, fg: colors.primary},
  shipped: {bg: colors.primarySoft, fg: colors.primaryDark},
  delivered: {bg: colors.successSoft, fg: colors.success},
  cancelled: {bg: colors.dangerSoft, fg: colors.danger},
  requested: {bg: colors.warningSoft, fg: colors.warning},
  approved: {bg: colors.successSoft, fg: colors.success},
  rejected: {bg: colors.dangerSoft, fg: colors.danger},
  refunded: {bg: colors.infoSoft, fg: colors.info},
};

export const statusLabel: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  refunded: 'Refunded',
};
