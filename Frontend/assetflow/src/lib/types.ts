import type {
  Role,
  AssetStatus,
  BookingStatus,
  MaintenanceStatus,
  Priority,
  AuditStatus,
  VerificationStatus,
  AllocationStatus,
  TransferStatus,
  IssueType,
  Condition,
} from "./constants";

// ===== USER =====
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department | null;
  departmentId: string | null;
  designation: string;
  avatar: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

// ===== DEPARTMENT =====
export interface Department {
  id: string;
  name: string;
  head: User | null;
  headId: string | null;
  parentId: string | null;
  parent: Department | null;
  status: "ACTIVE" | "INACTIVE";
  employeeCount: number;
  assetCount: number;
  description?: string;
}

// ===== CATEGORY =====
export interface Category {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  assetCount: number;
  children: Category[];
  customFields: CustomField[];
}

export interface CustomField {
  id: string;
  label: string;
  key: string;
  type: "text" | "number" | "date" | "select";
  required: boolean;
  options?: string[];
}

// ===== LOCATION =====
export interface Location {
  id: string;
  building: string;
  city: string;
  floors: Floor[];
}

export interface Floor {
  id: string;
  name: string;
  rooms: Room[];
}

export interface Room {
  id: string;
  name: string;
}

// ===== ASSET =====
export interface Asset {
  id: string;
  tag: string;
  name: string;
  serialNumber: string;
  categoryId: string;
  category: Category | null;
  status: AssetStatus;
  condition: Condition;
  isBookable: boolean;
  acquisitionDate: string;
  acquisitionCost: number;
  warrantyEndDate?: string;
  locationId?: string;
  location?: string;
  assignedTo: User | null;
  assignedToId: string | null;
  departmentId: string | null;
  department: Department | null;
  documents: AssetDocument[];
  customFieldValues: Record<string, string | number>;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDocument {
  id: string;
  url: string;
  filename: string;
  type: "PURCHASE_RECEIPT" | "WARRANTY" | "MANUAL" | "PHOTO" | "OTHER";
  uploadedAt: string;
}

// ===== ALLOCATION =====
export interface Allocation {
  id: string;
  asset: Asset;
  assetId: string;
  holder: User;
  holderId: string;
  allocatedBy: User;
  allocatedById: string;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  conditionOnReturn: Condition | null;
  returnNotes: string | null;
  status: AllocationStatus;
  notes: string | null;
  createdAt: string;
}

// ===== TRANSFER =====
export interface Transfer {
  id: string;
  asset: Asset;
  assetId: string;
  fromUser: User;
  fromUserId: string;
  toUser: User;
  toUserId: string;
  reason: string;
  notes: string | null;
  status: TransferStatus;
  approvedBy: User | null;
  createdAt: string;
}

// ===== BOOKING =====
export interface Booking {
  id: string;
  resource: Asset;
  resourceId: string;
  bookedBy: User;
  bookedById: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: BookingStatus;
  seriesId: string | null;
  attendees: User[];
  createdAt: string;
}

// ===== MAINTENANCE =====
export interface MaintenanceRequest {
  id: string;
  asset: Asset;
  assetId: string;
  raisedBy: User;
  raisedById: string;
  issueType: IssueType;
  priority: Priority;
  description: string;
  status: MaintenanceStatus;
  technician: User | null;
  technicianId: string | null;
  resolutionNotes: string | null;
  cost: number | null;
  partsUsed: string[];
  nextServiceDate: string | null;
  attachments: string[];
  createdAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
}

export interface MaintenanceComment {
  id: string;
  author: User;
  text: string;
  createdAt: string;
}

// ===== AUDIT =====
export interface AuditCycle {
  id: string;
  name: string;
  scopeType: "DEPARTMENT" | "LOCATION";
  departments: Department[];
  auditors: User[];
  status: AuditStatus;
  startDate: string;
  endDate: string;
  progress: number;
  totalItems: number;
  verifiedItems: number;
  discrepancies: number;
  missing: number;
  createdAt: string;
}

export interface AuditItem {
  id: string;
  asset: Asset;
  assetId: string;
  expectedLocation: string;
  currentStatus: AssetStatus;
  verification: VerificationStatus;
  notes: string | null;
  photo: string | null;
  verifiedBy: User | null;
}

// ===== NOTIFICATION =====
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entityId: string | null;
  entityType: string | null;
  createdAt: string;
}

// ===== ACTIVITY LOG =====
export interface ActivityLog {
  id: string;
  type: string;
  icon: string;
  color: string;
  description: string;
  entities: {
    user?: { id: string; name: string };
    asset?: { id: string; tag: string; name: string };
    target?: { id: string; name: string };
  };
  createdAt: string;
  relativeTime: string;
}

// ===== DASHBOARD =====
export interface DashboardKPIs {
  assetsAvailable: number;
  assetsAllocated: number;
  maintenanceToday: number;
  activeBookings: number;
  pendingTransfers: number;
  overdueReturns: number;
}

export interface UtilizationDataPoint {
  date: string;
  utilization: number;
}

export interface UpcomingReturn {
  allocationId: string;
  asset: { tag: string; name: string };
  holder: { id: string; name: string; avatar: string | null };
  expectedReturnDate: string;
  status: "ON_TIME" | "OVERDUE";
  daysOverdue?: number;
}

// ===== API RESPONSE ENVELOPE =====
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
