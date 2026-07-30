import { describe, expect, it } from 'vitest'
import { mapAxiosError } from '../../electron/main/http/errors'

describe('mapAxiosError', () => {
  it('maps backend error envelope', () => {
    const err = {
      isAxiosError: true,
      message: 'Request failed',
      response: {
        data: {
          error: { code: 'UNAUTHORIZED', message: 'غير مصرح' }
        }
      }
    }
    expect(mapAxiosError(err)).toEqual({
      code: 'UNAUTHORIZED',
      message: 'غير مصرح',
      details: undefined
    })
  })

  it('maps connection refused', () => {
    const err = {
      isAxiosError: true,
      message: 'connect',
      code: 'ECONNREFUSED'
    }
    expect(mapAxiosError(err).code).toBe('BACKEND_UNAVAILABLE')
  })
})
