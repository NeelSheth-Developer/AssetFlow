"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Briefcase,
  Loader2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Marketing",
  "HR",
  "Finance",
  "Operations",
  "Sales",
  "Legal",
] as const;

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid work email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  department: z.string().min(1, "Please select a department"),
  designation: z.string().min(1, "Designation is required"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = useMemo(() => {
    const len = password.length;
    if (len >= 12) return 4;
    if (len >= 8) return 3;
    if (len >= 4) return 2;
    if (len > 0) return 1;
    return 0;
  }, [password]);

  const getColor = (index: number) => {
    if (index >= strength) return "bg-muted";
    if (strength <= 1) return "bg-red-500";
    if (strength <= 2) return "bg-amber-500";
    return "bg-green-500";
  };

  return (
    <div className="flex gap-1 mt-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-200",
            getColor(i)
          )}
        />
      ))}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      department: "",
      designation: "",
    },
  });

  const passwordValue = watch("password");

  const onSubmit = async (data: SignupFormValues) => {
    if (!agreedToTerms) return;
    setIsLoading(true);
    try {
      const success = await signup({
        name: data.name,
        email: data.email,
        password: data.password,
        department: data.department,
        designation: data.designation,
      });
      if (success) {
        router.push("/");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass-heavy rounded-2xl p-8 w-full max-w-md"
    >
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <Package className="size-7 text-indigo-600" />
        <span className="text-xl font-bold text-foreground">AssetFlow</span>
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Create account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Join your organization
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              className={cn("pl-9 h-10", errors.name && "border-destructive")}
              {...register("name")}
            />
          </div>
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Work Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Work Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              className={cn("pl-9 h-10", errors.email && "border-destructive")}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className={cn(
                "pl-9 pr-10 h-10",
                errors.password && "border-destructive"
              )}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <PasswordStrengthIndicator password={passwordValue || ""} />
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Department */}
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Controller
            name="department"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  className={cn(
                    "w-full h-10",
                    errors.department && "border-destructive"
                  )}
                >
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.department && (
            <p className="text-xs text-destructive">
              {errors.department.message}
            </p>
          )}
        </div>

        {/* Designation */}
        <div className="space-y-1.5">
          <Label htmlFor="designation">Designation</Label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="designation"
              type="text"
              placeholder="e.g. Software Engineer"
              className={cn(
                "pl-9 h-10",
                errors.designation && "border-destructive"
              )}
              {...register("designation")}
            />
          </div>
          {errors.designation && (
            <p className="text-xs text-destructive">
              {errors.designation.message}
            </p>
          )}
        </div>

        {/* Role notice */}
        <p className="text-xs text-muted-foreground italic">
          Your account will be created as Employee. Admins can promote roles
          later.
        </p>

        {/* Terms checkbox */}
        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked)}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="text-sm font-normal cursor-pointer leading-tight">
            I agree to the{" "}
            <Link href="#" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Terms of Service
            </Link>
          </Label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading || !agreedToTerms}
          className="w-full bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl h-11 text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : null}
          Create Account
        </Button>
      </form>

      {/* Bottom link */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
