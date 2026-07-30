import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { apiClient } from '@/services/apiClient'

export type CameraCaptureProps = {
  className?: string
  facingMode?: 'user' | 'environment'
  deviceId?: string | null
  onCapture: (file: File) => void | Promise<void>
  disabled?: boolean
  captureLabel?: string
  stopLabel?: string
  startLabel?: string
}

/**
 * Webcam capture for dress / customer photos.
 * Preview via getUserMedia; Main grants media permission.
 * File picker remains available via ImagePicker elsewhere.
 */
export function CameraCapture({
  className,
  facingMode = 'environment',
  deviceId,
  onCapture,
  disabled,
  captureLabel = 'التقاط',
  stopLabel = 'إيقاف',
  startLabel = 'تشغيل الكاميرا'
}: CameraCaptureProps): React.ReactElement {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [streaming, setStreaming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [resolvedDeviceId, setResolvedDeviceId] = React.useState<string | null>(deviceId ?? null)

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStreaming(false)
  }, [])

  React.useEffect(() => () => stop(), [stop])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (deviceId) {
        setResolvedDeviceId(deviceId)
        return
      }
      try {
        const cfg = await apiClient.hardware.getConfig()
        if (!cancelled) setResolvedDeviceId(cfg.cameraDeviceId)
      } catch {
        if (!cancelled) setResolvedDeviceId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deviceId])

  async function start(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      const caps = await apiClient.hardware.cameraCapabilities()
      if (!caps.permissionGranted) {
        throw new Error('لم تُمنح صلاحية الكاميرا')
      }
      const videoConstraint: MediaTrackConstraints = resolvedDeviceId
        ? { deviceId: { exact: resolvedDeviceId } }
        : { facingMode }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: false
        })
      } catch (firstErr) {
        // Recovery after disconnect / stale deviceId: fall back to any camera.
        if (resolvedDeviceId) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: false
          })
        } else {
          throw firstErr
        }
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStreaming(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الوصول إلى الكاميرا')
      stop()
    } finally {
      setBusy(false)
    }
  }

  async function capture(): Promise<void> {
    const video = videoRef.current
    if (!video) return
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('تعذر إنشاء اللقطة')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!blob) throw new Error('تعذر حفظ اللقطة')
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
      await onCapture(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الالتقاط')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-hidden rounded-md border border-border bg-black/40 aspect-video">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {!streaming ? (
          <Button type="button" disabled={disabled || busy} onClick={() => void start()}>
            {startLabel}
          </Button>
        ) : (
          <>
            <Button type="button" disabled={disabled || busy} onClick={() => void capture()}>
              {captureLabel}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={stop}>
              {stopLabel}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
