import { z } from 'zod'

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^(\+63|0)[0-9]{10}$/, 'Enter a valid PH phone number (e.g. 09171234567)').optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const bookingSchema = z.object({
  venueId: z.string().uuid('Invalid venue'),
  packageId: z.string().uuid().optional(),
  eventType: z.string().min(1, 'Event type is required'),
  eventDate: z.string().min(1, 'Event date is required'),
  guestCount: z.number().int().min(1, 'Guest count must be at least 1').max(1000),
  notes: z.string().max(500).optional(),
})

export const messageSchema = z.object({
  receiverId: z.string().uuid('Invalid receiver'),
  content: z.string().min(1, 'Message cannot be empty').max(1000),
  bookingId: z.string().uuid().optional(),
  venueId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
})

export const inquirySchema = z.object({
  venueId: z.string().uuid('Choose a valid venue').optional(),
  packageId: z.string().uuid('Choose a valid package').optional(),
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().email('Enter a valid email').max(254),
  phone: z.string().trim().max(40).optional(),
  eventType: z.string().trim().min(1, 'Choose an event type').max(80),
  eventDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date').optional(),
  guests: z.number().int().min(1).max(1000).optional(),
  message: z.string().trim().min(1, 'Write a message for the venue').max(500),
}).refine(data => Boolean(data.venueId || data.packageId), {
  message: 'Choose a venue or package',
  path: ['venueId'],
})

export const venueSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  location: z.string().min(2).max(200),
  capacity: z.number().int().min(1),
  price: z.number().min(0),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
})

// ── Client email OTP (passwordless / booking gate) ───────────────────────────
export const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  token: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
  /** 'signup' = post-registration confirm  |  'email' = passwordless login  |  'email_change' | 'magiclink' */
  type: z.enum(['signup', 'email', 'magiclink', 'email_change']).default('email'),
})

export const resendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  /** Which Supabase OTP type to resend */
  type: z.enum(['signup', 'email_change']).default('signup'),
})

// ── Staff TOTP MFA ────────────────────────────────────────────────────────────
export const mfaEnrollConfirmSchema = z.object({
  factorId: z.string().min(1, 'Factor ID is required'),
  code: z
    .string()
    .length(6, 'TOTP code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
})

export const mfaVerifySchema = z.object({
  factorId: z.string().min(1, 'Factor ID is required'),
  challengeId: z.string().min(1, 'Challenge ID is required'),
  code: z
    .string()
    .length(6, 'TOTP code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
})

export const mfaRecoverySchema = z.object({
  code: z
    .string()
    .min(1, 'Recovery code is required')
    .max(64, 'Invalid recovery code'),
})

export const mfaUnenrollSchema = z.object({
  factorId: z.string().min(1, 'Factor ID is required'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type BookingInput = z.infer<typeof bookingSchema>
export type MessageInput = z.infer<typeof messageSchema>
export type VenueInput = z.infer<typeof venueSchema>
export type SendOtpInput = z.infer<typeof sendOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ResendOtpInput = z.infer<typeof resendOtpSchema>
export type MfaEnrollConfirmInput = z.infer<typeof mfaEnrollConfirmSchema>
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>
export type MfaRecoveryInput = z.infer<typeof mfaRecoverySchema>
