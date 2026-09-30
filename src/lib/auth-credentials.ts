import { z } from "zod";

type ValidationSuccess<T> = {
  success: true;
  data: T;
};

type ValidationFailure = {
  success: false;
  errors: Record<string, string>;
};

type ValidationResult<T> =
  | ValidationSuccess<T>
  | ValidationFailure;

type LoginCredentials = {
  email: string;
  password: string;
};

type SignUpCredentials = {
  email: string;
  password: string;
  confirmPassword: string;
};

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address."),

  password: z
    .string()
    .min(1, "Password is required."),
});

const signUpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address."),

    password: z
      .string()
      .min(
        8,
        "Password must be at least 8 characters."
      ),

    confirmPassword: z.string(),
  })
  .refine(
    (data) =>
      data.password ===
      data.confirmPassword,
    {
      message:
        "Passwords do not match.",
      path: ["confirmPassword"],
    }
  );

function formatErrors(
  error: z.ZodError
): Record<string, string> {
  const errors: Record<
    string,
    string
  > = {};

  for (const issue of error.issues) {
    const field =
      issue.path[0]?.toString();

    if (
      field &&
      !errors[field]
    ) {
      errors[field] =
        issue.message;
    }
  }

  return errors;
}

export function validateLoginCredentials(
  input: LoginCredentials
): ValidationResult<LoginCredentials> {
  const result =
    loginSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: formatErrors(
        result.error
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

export function validateSignUpCredentials(
  input: SignUpCredentials
): ValidationResult<SignUpCredentials> {
  const result =
    signUpSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: formatErrors(
        result.error
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}