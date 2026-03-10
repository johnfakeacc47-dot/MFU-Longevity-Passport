import { request } from './healthApi';

export interface User {
  id: string;
  email: string;
  mfuId: string;
  name: string;
  role: 'student' | 'staff' | 'admin';
  faculty?: string;
  department?: string;
  createdAt: string;
}

export interface CreateUserPayload {
  email: string;
  mfuId: string;
  name: string;
  role: 'student' | 'staff' | 'admin';
  faculty?: string;
  department?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: 'student' | 'staff' | 'admin';
  faculty?: string;
  department?: string;
}

export const userApi = {
  async createUser(payload: CreateUserPayload): Promise<User> {
    return request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getAllUsers(): Promise<User[]> {
    return request<User[]>('/users');
  },

  async getUserById(id: string): Promise<User> {
    return request<User>(`/users/${id}`);
  },

  async updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
    return request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteUser(id: string): Promise<void> {
    return request<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};
