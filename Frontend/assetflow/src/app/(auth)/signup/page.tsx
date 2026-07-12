"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
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
  Loader2,
  ArrowRight,
  CheckCircle2,
  Shield,
  Boxes,
  BarChart3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

function PasswordStrengthIndicator({ password }: { password: string }) {
  const { strength, label, color } = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { strength: 1, label: "Weak", color: "bg-red-400" };
    if (score <= 2) return { strength: 2, label: "Fair", color: "bg-amber-400" };
    if (score <= 3) return { strength: 3, label: "Good", color: "bg-blue-400" };
    return { strength: 4, label: "Strong", color: "bg-green-400" };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i <= strength ? color : "bg-slate-200"
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs", strength <= 1 ? "text-red-500" : strength <= 2 ? "text-amber-600" : "text-slate-500")}>
        {label}
      </p>
    </div>
  );
}

const benefits = [
  {
    icon: Boxes,
    title: "Track all your assets",
    description: "Full lifecycle from registration to disposal",
  },
  {
    icon: Shield,
    title: "Secure & role-based",
    description: "Access controlled by your admin's assignment",
  },
  {
    icon: BarChart3,
    title: "Real-time insights",
    description: "Dashboards, reports, and utilization analytics",
  },
];

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const passwordValue = watch("password");

  const onSubmit = async (data: SignupFormValues) => {
    if (!agreedToTerms) {
      toast.error("Please agree to the Terms of Service");
      return;
    }
    setIsLoading(true);
    try {
      const success = await signup({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      if (success) {
        router.push("/");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-5 rounded-[2rem] overflow-hidden shadow-[0_30px_100px_-20px_rgba(99,102,241,0.15),0_10px_40px_-10px_rgba(0,0,0,0.07)] border border-white/60 backdrop-blur-xl bg-white/40"
      >
        {/* Left Side - Benefits (3 cols) */}
        <div className="hidden lg:flex lg:col-span-3 flex-col justify-between p-10 relative overflow-hidden bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500">
          {/* Animated decorative circles */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], x: [0, 12, 0], y: [0, -12, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 right-0 w-72 h-72 bg-white/[0.07] rounded-full -translate-y-1/3 translate-x-1/3 border border-white/10"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], x: [0, -10, 0], y: [0, 10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-0 left-0 w-48 h-48 bg-white/[0.07] rounded-full translate-y-1/4 -translate-x-1/4 border border-white/10"
          />
          <motion.div
            animate={{ scale: [1, 0.8, 1.15, 1], x: [0, 10, -15, 0], y: [0, -15, 10, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-2/3 right-1/4 w-20 h-20 bg-white/[0.06] rounded-full border border-white/10"
          />
          <motion.div
            animate={{ scale: [1, 1.3, 0.9, 1], rotate: [0, 180, 360] }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            className="absolute top-[15%] right-[20%] w-14 h-14 bg-white/[0.04] rounded-full border border-white/[0.08]"
          />
          <motion.div
            animate={{ scale: [0.9, 1.2, 0.9], y: [0, -18, 0], x: [0, 8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            className="absolute bottom-[20%] right-[8%] w-28 h-28 bg-white/[0.05] rounded-full border border-white/[0.08]"
          />

          {/* Floating particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -(8 + i * 3), 0],
                x: [0, (i % 2 === 0 ? 6 : -6), 0],
                opacity: [0.15, 0.6, 0.15],
                scale: [1, 1.4, 1],
              }}
              transition={{
                duration: 3 + i * 0.7,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeInOut",
              }}
              className="absolute rounded-full bg-white/25"
              style={{
                width: `${3 + (i % 3) * 2}px`,
                height: `${3 + (i % 3) * 2}px`,
                top: `${10 + i * 11}%`,
                left: `${6 + i * 11}%`,
              }}
            />
          ))}

          {/* Header */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-3 mb-10"
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20"
              >
                <Package className="size-5 text-white" />
              </motion.div>
              <span className="text-2xl font-bold text-white tracking-tight">
                AssetFlow
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="text-[2.2rem] leading-tight font-bold text-white mb-4"
            >
              Join your team on<br />AssetFlow today
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="text-white/70 text-[0.95rem] leading-relaxed max-w-md"
            >
              Create your employee account and start managing assets, booking
              resources, and tracking maintenance — all in one place.
            </motion.p>
          </div>

          {/* Benefits with hover animations */}
          <div className="relative z-10 my-8 space-y-4">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -25 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.15, duration: 0.5 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/[0.08] cursor-default transition-colors hover:bg-white/[0.14]"
                >
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{
                      duration: 2.5 + index * 0.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.3,
                    }}
                    className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/10"
                  >
                    <Icon className="size-5 text-white" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {benefit.title}
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Info notice with pulse */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="relative z-10 flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <CheckCircle2 className="size-5 text-white/70 shrink-0" />
            </motion.div>
            <p className="text-xs text-white/60 leading-relaxed">
              Your account starts as Employee. Your organization&apos;s admin can
              assign departments and promote roles from the directory.
            </p>
          </motion.div>
        </div>

        {/* Right Side - Signup Form (2 cols) */}
        <div className="lg:col-span-2 flex flex-col justify-center p-8 sm:p-10 bg-white/70 backdrop-blur-xl">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Package className="size-4 text-violet-600" />
            </div>
            <span className="text-xl font-bold text-slate-800">AssetFlow</span>
          </div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold text-slate-800 mb-1.5">
              Create your account
            </h1>
            <p className="text-sm text-slate-500">
              Get started with AssetFlow in seconds
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-600 text-sm font-medium">
                Full Name
              </Label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Raj Mehta"
                  className={cn(
                    "pl-10 h-12 bg-white/80 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all shadow-sm",
                    errors.name && "border-red-300 focus:ring-red-100"
                  )}
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500"
                >
                  {errors.name.message}
                </motion.p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600 text-sm font-medium">
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className={cn(
                    "pl-10 h-12 bg-white/80 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all shadow-sm",
                    errors.email && "border-red-300 focus:ring-red-100"
                  )}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500"
                >
                  {errors.email.message}
                </motion.p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-600 text-sm font-medium">
                Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  className={cn(
                    "pl-10 pr-11 h-12 bg-white/80 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all shadow-sm",
                    errors.password && "border-red-300 focus:ring-red-100"
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500"
                >
                  {errors.password.message}
                </motion.p>
              )}
            </div>

            {/* Role notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-50/70 border border-violet-100">
              <Shield className="size-4 text-violet-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed">
                Your account will be created as{" "}
                <span className="font-semibold text-violet-700">Employee</span>.
                Admins can assign your department and promote your role.
              </p>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(!!checked)}
                className="mt-0.5 border-slate-300 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
              />
              <Label
                htmlFor="terms"
                className="text-sm font-normal text-slate-500 cursor-pointer leading-relaxed"
              >
                I agree to the{" "}
                <Link
                  href="#"
                  className="text-violet-600 hover:text-violet-700 font-medium"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="#"
                  className="text-violet-600 hover:text-violet-700 font-medium"
                >
                  Privacy Policy
                </Link>
              </Label>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading || !agreedToTerms}
              className="w-full h-12 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 hover:from-violet-600 hover:via-purple-600 hover:to-fuchsia-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-200/50 hover:shadow-violet-300/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              Create Account
              {!isLoading && (
                <ArrowRight className="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
              )}
            </Button>
          </motion.form>

          {/* Bottom */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-sm text-slate-500 mt-8"
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-violet-600 hover:text-violet-700 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
