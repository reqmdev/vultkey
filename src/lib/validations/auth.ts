import { z } from "zod";

const email = z.string().trim().email("Geçerli bir e-posta gir.").max(254, "E-posta çok uzun.");
const password = z
  .string()
  .min(12, "Şifre en az 12 karakter olmalı.")
  .max(128, "Şifre çok uzun.")
  .regex(/[a-z]/, "En az bir küçük harf kullan.")
  .regex(/[A-Z]/, "En az bir büyük harf kullan.")
  .regex(/[0-9]/, "En az bir rakam kullan.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Şifreni gir.").max(128, "Şifre çok uzun.")
});

export const signupSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string().min(1, "Şifreyi tekrar gir.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Şifreler eşleşmiyor.",
    path: ["confirmPassword"]
  });

export const forgotPasswordSchema = z.object({
  email
});

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, "Şifreyi tekrar gir.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Şifreler eşleşmiyor.",
    path: ["confirmPassword"]
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
