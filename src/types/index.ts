export type PermissionLevel = 'national' | 'provincial' | 'municipal';

export interface User {
  id: string;
  name: string;
  role: string;
  level: PermissionLevel;
  province?: string;
  city?: string;
  avatar: string;
}

export interface Province {
  code: string;
  name: string;
  cities: City[];
}

export interface City {
  code: string;
  name: string;
  provinceCode: string;
  totalLamps: number;
  lightRate: number;
  energySavingRate: number;
  faultRate: number;
  avgResponseTime: number;
}

export type LampType = 'LED' | '高压钠灯' | '金卤灯' | '无极灯';

export interface StreetLamp {
  id: string;
  code: string;
  province: string;
  city: string;
  district: string;
  road: string;
  type: LampType;
  power: number;
  status: 'normal' | 'fault' | 'offline' | 'maintenance';
  brightness: number;
  lastUpdateTime: string;
  faultType?: string;
  faultTime?: string;
}

export interface SensorData {
  id: string;
  lampId: string;
  timestamp: string;
  voltage: number;
  current: number;
  power: number;
  illumination: number;
  temperature: number;
}

export interface EnergyConsumption {
  date: string;
  province: string;
  city: string;
  district?: string;
  road?: string;
  actualConsumption: number;
  baselineConsumption: number;
  savingAmount: number;
  savingRate: number;
  peakConsumption: number;
  valleyConsumption: number;
}

export type WorkOrderStatus = 'pending' | 'processing' | 'approved1' | 'approved2' | 'completed' | 'rejected';

export interface WorkOrder {
  id: string;
  orderNo: string;
  type: 'fault' | 'inspection' | 'emergency' | 'adjustment';
  title: string;
  description: string;
  province: string;
  city: string;
  district: string;
  road: string;
  lampId?: string;
  status: WorkOrderStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createTime: string;
  responseTime?: number;
  repairTime?: number;
  cost?: number;
  reporter: string;
  assignee: string;
  approvalLog: ApprovalLog[];
}

export interface ApprovalLog {
  level: number;
  approver: string;
  action: 'approve' | 'reject';
  comment: string;
  time: string;
}

export type AlertLevel = 1 | 2 | 3;
export type AlertType = 'light_rate' | 'fault_timeout' | 'energy_abnormal' | 'offline';

export interface Alert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  title: string;
  content: string;
  province: string;
  city: string;
  district: string;
  road?: string;
  lampId?: string;
  value?: number;
  threshold?: number;
  createTime: string;
  isHandled: boolean;
  handledTime?: string;
  handler?: string;
  workOrderId?: string;
}

export interface EnergyPlan {
  id: string;
  year: number;
  province: string;
  city: string;
  uploadTime: string;
  dimmingSchedule: DimmingSchedule[];
  targetSavingRate: number;
  predictedConsumption: number;
}

export interface DimmingSchedule {
  timeRange: string;
  startHour: number;
  endHour: number;
  brightness: number;
  season?: string;
}

export interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  province?: string;
  city?: string;
  lightRate: number;
  lightRateYoY: number;
  lightRateWoW: number;
  energySavingRate: number;
  energySavingRateYoY: number;
  energySavingRateWoW: number;
  faultRate: number;
  faultRateYoY: number;
  faultRateWoW: number;
  avgResponseTime: number;
  avgResponseTimeYoY: number;
  avgResponseTimeWoW: number;
  totalRepairCost: number;
  repairCostWoW: number;
  optimizationSuggestions: string[];
  retrofitPlan: string[];
}

export interface InspectionBatch {
  id: string;
  batchNo: string;
  province: string;
  city: string;
  district: string;
  roads: string[];
  lampCount: number;
  scheduleDate: string;
  inspector: string;
  status: 'pending' | 'in_progress' | 'completed';
}
