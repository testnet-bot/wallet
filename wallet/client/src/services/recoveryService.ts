import apiClient from './apiClient';

export const recoveryService = {
  async executeRescue(address: string, privateKey: string) {
    const { data } = await apiClient.post('/recovery/execute', { 
      address, 
      privateKey 
    });
    return data;
  }
};
