export interface User {
  id?: string; // uid de Firebase
  username: string;
  email: string;
  password?: string;
  token?: string;
}