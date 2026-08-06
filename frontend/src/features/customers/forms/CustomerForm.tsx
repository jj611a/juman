import { useState, useEffect } from 'react'
import type { CreateCustomerPayload } from '../api/api'

interface CustomerFormProps {
  initialValues?: CreateCustomerPayload
  onSubmit: (values: CreateCustomerPayload) => void | Promise<void>
  onCancel: () => void
  busy?: boolean
  error?: string | null
}

export function CustomerForm({
  initialValues,
  onSubmit,
  onCancel,
  busy = false,
  error = null
}: CustomerFormProps) {
  const [fullName, setFullName] = useState(initialValues?.fullName ?? '')
  const [phone, setPhone] = useState(initialValues?.phone ?? '')
  const [secondaryPhone, setSecondaryPhone] = useState(initialValues?.secondaryPhone ?? '')
  const [address, setAddress] = useState(initialValues?.address ?? '')
  const [city, setCity] = useState(initialValues?.city ?? '')
  const [nationalId, setNationalId] = useState(initialValues?.nationalId ?? '')
  const [gender, setGender] = useState(initialValues?.gender ?? 'FEMALE')
  const [birthDate, setBirthDate] = useState(initialValues?.birthDate ?? '')
  const [notes, setNotes] = useState(initialValues?.notes ?? '')
  const [status, setStatus] = useState(initialValues?.status ?? 'active')

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // Track changes to trigger unsaved alert warning
  useEffect(() => {
    if (!initialValues) {
      if (fullName || phone || address || notes) {
        setHasChanges(true)
      }
    } else {
      const changed =
        fullName !== (initialValues.fullName ?? '') ||
        phone !== (initialValues.phone ?? '') ||
        secondaryPhone !== (initialValues.secondaryPhone ?? '') ||
        address !== (initialValues.address ?? '') ||
        city !== (initialValues.city ?? '') ||
        nationalId !== (initialValues.nationalId ?? '') ||
        gender !== (initialValues.gender ?? 'FEMALE') ||
        birthDate !== (initialValues.birthDate ?? '') ||
        notes !== (initialValues.notes ?? '') ||
        status !== (initialValues.status ?? 'active')
      setHasChanges(changed)
    }
  }, [fullName, phone, secondaryPhone, address, city, nationalId, gender, birthDate, notes, status, initialValues])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!fullName.trim()) errs.fullName = 'الاسم الكامل مطلوب'
    if (!phone.trim()) errs.phone = 'رقم الهاتف مطلوب'
    
    // E.164-like phone validation: minimum length
    if (phone.trim() && phone.trim().length < 7) {
      errs.phone = 'رقم الهاتف غير صالح (يجب أن يكون 7 أرقام على الأقل)'
    }

    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const payload: CreateCustomerPayload = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      ...(secondaryPhone.trim() ? { secondaryPhone: secondaryPhone.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(nationalId.trim() ? { nationalId: nationalId.trim() } : {}),
      gender,
      ...(birthDate ? { birthDate } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      status
    }
    void onSubmit(payload)
  }

  const handleCancelClick = () => {
    if (hasChanges) {
      const confirmLeave = window.confirm('لديك تغييرات غير محفوظة، هل أنت متأكد من المغادرة؟')
      if (!confirmLeave) return
    }
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm" dir="rtl">
      {error && (
        <div className="alert alert-error text-xs p-3">
          <span>{error}</span>
        </div>
      )}

      {/* Name and Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs font-semibold">الاسم الكامل *</span>
          <input
            type="text"
            className={`input input-bordered w-full bg-base-300 ${validationErrors.fullName ? 'border-error' : ''}`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={busy}
            required
          />
          {validationErrors.fullName && (
            <span className="text-[10px] text-error mt-1">{validationErrors.fullName}</span>
          )}
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs font-semibold">رقم الهاتف *</span>
          <input
            type="tel"
            className={`input input-bordered w-full bg-base-300 ${validationErrors.phone ? 'border-error' : ''}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
            placeholder="مثال: 0501234567"
            required
          />
          {validationErrors.phone && (
            <span className="text-[10px] text-error mt-1">{validationErrors.phone}</span>
          )}
        </div>
      </div>

      {/* Alt Phone and National ID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">رقم الهاتف البديل</span>
          <input
            type="tel"
            className="input input-bordered w-full bg-base-300"
            value={secondaryPhone}
            onChange={(e) => setSecondaryPhone(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">رقم الهوية الوطنية / جواز السفر</span>
          <input
            type="text"
            className="input input-bordered w-full bg-base-300"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {/* Address and City */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">العنوان السكني</span>
          <input
            type="text"
            className="input input-bordered w-full bg-base-300"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">المدينة</span>
          <input
            type="text"
            className="input input-bordered w-full bg-base-300"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {/* Gender, Birth Date, Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">الجنس</span>
          <select
            className="select select-bordered w-full bg-base-300"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            disabled={busy}
          >
            <option value="FEMALE">أنثى (Female)</option>
            <option value="MALE">ذكر (Male)</option>
            <option value="OTHER">آخر (Other)</option>
          </select>
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">تاريخ الميلاد</span>
          <input
            type="date"
            className="input input-bordered w-full bg-base-300"
            value={birthDate ? birthDate.split('T')[0] : ''}
            onChange={(e) => setBirthDate(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">الحالة</span>
          <select
            className="select select-bordered w-full bg-base-300"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={busy}
          >
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="form-control w-full">
        <span className="label-text mb-1 text-xs">ملاحظات إضافية</span>
        <textarea
          className="textarea textarea-bordered w-full bg-base-300 h-20"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={busy}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end mt-4">
        <button
          type="submit"
          className="btn btn-primary btn-sm px-6 font-bold"
          disabled={busy}
        >
          {busy ? <span className="loading loading-spinner loading-xs" /> : 'حفظ البيانات'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm px-6"
          onClick={handleCancelClick}
          disabled={busy}
        >
          إلغاء
        </button>
      </div>
    </form>
  )
}
