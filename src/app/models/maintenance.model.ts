export interface Maintenance {
  id?: string;
  userId?: string;
  vehicleId: string;
  type: string;
  date: string;
  mileage: number;
  notes?: string;
  cost?: number;
}