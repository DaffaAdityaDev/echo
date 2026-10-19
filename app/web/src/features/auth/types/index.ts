export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export type LoginCredentials = {
  email: string;
  password: string;
};

export interface LoginResponse {
  user: User;
}
