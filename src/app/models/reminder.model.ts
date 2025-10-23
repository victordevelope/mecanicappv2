export interface Reminder {
  id?: string;
  userId?: string;
  vehicleId: string;
  maintenanceType: string;
  dueDate: string;
  mileage?: number;
  isActive: boolean;
}