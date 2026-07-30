export type StubResult = {
  implemented: false
  code: 'NOT_IMPLEMENTED'
  message: string
}

export function notImplemented(feature: string): StubResult {
  return {
    implemented: false,
    code: 'NOT_IMPLEMENTED',
    message: `${feature} غير مُنفَّذ في أساس الواجهة`
  }
}
