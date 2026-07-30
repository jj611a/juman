import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import type { AppError } from '../../shared/errors'
import { mapAxiosError } from './errors'

export type HttpClient = {
  request<T>(config: AxiosRequestConfig): Promise<{ data: T }>
  getInstance(): AxiosInstance
}

export function createHttpClient(baseURL: string): HttpClient {
  const instance = axios.create({
    baseURL,
    timeout: 30_000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  })

  return {
    getInstance: () => instance,
    async request<T>(config: AxiosRequestConfig): Promise<{ data: T }> {
      try {
        const response = await instance.request<T>(config)
        return { data: response.data }
      } catch (error) {
        const mapped: AppError = mapAxiosError(error)
        throw mapped
      }
    }
  }
}
