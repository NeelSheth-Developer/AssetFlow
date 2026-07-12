export const ROLES = {
  ADMIN: "ADMIN",
  ASSET_MANAGER: "ASSET_MANAGER",
  DEPT_HEAD: "DEPT_HEAD",
  EMPLOYEE: "EMPLOYEE",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ASSET_STATUSES = {
  AVAILABLE: "AVAILABLE",
  ALLOCATED: "ALLOCATED",
  RESERVED: "RESERVED",
  UNDER_MAINTENANCE: "UNDER_MAINTENANCE",
  LOST: "LOST",
  RETIRED: "RETIRED",
  DISPOSED: "DISPOSED",
} as const;

export type AssetStatus = (typeof ASSET_STATUSES)[keyof typeof ASSET_STATUSES];

export const BOOKING_STATUSES = {
  UPCOMING: "UPCOMING",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES];

export const MAINTENANCE_STATUSES = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  ESCALATED: "ESCALATED",
} as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[keyof typeof MAINTENANCE_STATUSES];

export const PRIORITIES = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type Priority = (typeof PRIORITIES)[keyof typeof PRIORITIES];

export const AUDIT_STATUSES = {
  SCHEDULED: "SCHEDULED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CLOSED: "CLOSED",
} as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[keyof typeof AUDIT_STATUSES];

export const VERIFICATION_STATUSES = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  DISCREPANCY: "DISCREPANCY",
  MISSING: "MISSING",
} as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[keyof typeof VERIFICATION_STATUSES];

export const ALLOCATION_STATUSES = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  RETURNED: "RETURNED",
  OVERDUE: "OVERDUE",
} as const;

export type AllocationStatus = (typeof ALLOCATION_STATUSES)[keyof typeof ALLOCATION_STATUSES];

export const TRANSFER_STATUSES = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
} as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[keyof typeof TRANSFER_STATUSES];

export const ISSUE_TYPES = {
  HARDWARE: "HARDWARE",
  SOFTWARE: "SOFTWARE",
  PHYSICAL_DAMAGE: "PHYSICAL_DAMAGE",
  OTHER: "OTHER",
} as const;

export type IssueType = (typeof ISSUE_TYPES)[keyof typeof ISSUE_TYPES];

export const CONDITIONS = {
  EXCELLENT: "EXCELLENT",
  GOOD: "GOOD",
  FAIR: "FAIR",
  DAMAGED: "DAMAGED",
} as const;

export type Condition = (typeof CONDITIONS)[keyof typeof CONDITIONS];

export const NOTIFICATION_TYPES = {
  ASSET_ASSIGNED: "ASSET_ASSIGNED",
  TRANSFER_APPROVED: "TRANSFER_APPROVED",
  OVERDUE_RETURN: "OVERDUE_RETURN",
  MAINTENANCE_APPROVED: "MAINTENANCE_APPROVED",
  MAINTENANCE_REJECTED: "MAINTENANCE_REJECTED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_REMINDER: "BOOKING_REMINDER",
  AUDIT_DISCREPANCY: "AUDIT_DISCREPANCY",
  ROLE_CHANGED: "ROLE_CHANGED",
} as const;

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Organization", href: "/organization", icon: "Building2" },
  { label: "Assets", href: "/assets", icon: "Package" },
  { label: "Allocations", href: "/allocations", icon: "ArrowLeftRight" },
  { label: "Transfers", href: "/transfers", icon: "Repeat2" },
  { label: "Bookings", href: "/bookings", icon: "Calendar" },
  { label: "Maintenance", href: "/maintenance", icon: "Wrench" },
  { label: "Audits", href: "/audits", icon: "ClipboardCheck" },
  { label: "Reports", href: "/reports", icon: "BarChart3" },
  { label: "Activity", href: "/activity", icon: "Activity" },
] as const;
