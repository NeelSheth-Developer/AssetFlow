"use client";

import { useState, useEffect } from "react";
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
  Loader2,
  Shield,
  BarChart3,
  Calendar,
  Wrench,
  ClipboardCheck,
  ArrowRight,
  Boxes,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const features = [
  {
    icon: Boxes,
    title: "Asset Lifecycle Management",
    description:
      "Track assets from registration to disposal with full audit history and lifecycle states.",
  },
  {
    icon: Calendar,
    title: "Smart Resource Booking",
    description:
      "Book rooms, vehicles, and equipment with intelligent overlap detection and calendar views.",
  },
  {
    icon: Wrench,
    title: "Maintenance Workflows",
    description:
      "Raise requests, approve repairs, assign technicians — all through a structured pipeline.",
  },
  {
    icon: ClipboardCheck,
    title: "Scheduled Audits",
    description:
      "Run verification cycles with assigned auditors and auto-generated discrepancy reports.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description:
      "Utilization trends, booking heatmaps, and department-wise allocation summaries.",
  },
  {
    icon: Shield,
    title: "Role-Based Access Control",
    description:
      "Four distinct roles — Admin, Asset Manager, Department Head, and Employee.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const success = await login(data.email, data.password);
      if (success) {
        router.push("/");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-5 rounded-[2rem] overflow-hidden shadow-[0_30px_100px_-20px_rgba(99,102,241,0.15),0_10px_40px_-10px_rgba(0,0,0,0.07)] border border-white/60 backdrop-blur-xl bg-white/40"
    >
        {/* Left Side - Project Info (3 cols) */}
        <div className="hidden lg:flex lg:col-span-3 flex-col justify-between p-10 relative overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600">
          {/* Animated decorative circles */}
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              x: [0, 10, 0],
              y: [0, -10, 0],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 right-0 w-72 h-72 bg-white/[0.07] rounded-full -translate-y-1/3 translate-x-1/3 border border-white/10"
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              x: [0, -8, 0],
              y: [0, 8, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-0 left-0 w-48 h-48 bg-white/[0.07] rounded-full translate-y-1/4 -translate-x-1/4 border border-white/10"
          />
          <motion.div
            animate={{
              scale: [1, 0.85, 1.1, 1],
              x: [0, 15, -10, 0],
              y: [0, -10, 15, 0],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-1/2 left-1/3 w-24 h-24 bg-white/[0.06] rounded-full border border-white/10"
          />
          <motion.div
            animate={{
              scale: [1, 1.3, 0.9, 1],
              rotate: [0, 180, 360],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[20%] right-[15%] w-16 h-16 bg-white/[0.04] rounded-full border border-white/[0.08]"
          />
          <motion.div
            animate={{
              scale: [0.8, 1.1, 0.8],
              y: [0, -20, 0],
            }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            className="absolute bottom-[25%] right-[10%] w-32 h-32 bg-white/[0.05] rounded-full border border-white/[0.08]"
          />

          {/* Floating particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -(10 + i * 3), 0],
                x: [0, (i % 2 === 0 ? 5 : -5), 0],
                opacity: [0.2, 0.7, 0.2],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 3 + i * 0.8,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeInOut",
              }}
              className="absolute rounded-full bg-white/30"
              style={{
                width: `${3 + (i % 3) * 2}px`,
                height: `${3 + (i % 3) * 2}px`,
                top: `${12 + i * 10}%`,
                left: `${8 + i * 11}%`,
              }}
            />
          ))}

          {/* Header */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
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
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-[2.2rem] leading-tight font-bold text-white mb-4"
            >
              Enterprise Asset &<br />Resource Management
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-white/70 text-[0.95rem] leading-relaxed max-w-md"
            >
              Digitize how your organization tracks, allocates, and maintains
              physical assets through a centralized ERP platform.
            </motion.p>
          </div>

          {/* Features */}
          <div className="relative z-10 my-6 space-y-2.5">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = activeFeature === index;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -25 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.12, duration: 0.5 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  onClick={() => setActiveFeature(index)}
                  className={cn(
                    "flex items-start gap-3.5 p-3.5 rounded-2xl cursor-pointer border transition-all duration-300",
                    isActive
                      ? "bg-white/[0.12] border-white/[0.15] backdrop-blur-sm"
                      : "bg-transparent border-transparent hover:bg-white/[0.07]"
                  )}
                >
                  <motion.div
                    animate={{
                      y: isActive ? [0, -3, 0] : 0,
                    }}
                    transition={{
                      duration: 2.5 + index * 0.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.3,
                    }}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
                      isActive
                        ? "bg-white/20 border-white/15"
                        : "bg-white/5 border-white/5"
                    )}
                  >
                    <Icon className="size-4 text-white" />
                  </motion.div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-semibold text-white transition-opacity duration-300",
                        !isActive && "opacity-60"
                      )}
                    >
                      {feature.title}
                    </p>
                    <p
                      className={cn(
                        "text-xs text-white/60 mt-0.5 leading-relaxed transition-all duration-300",
                        isActive ? "opacity-100 max-h-20" : "opacity-0 max-h-0 overflow-hidden"
                      )}
                    >
                      {feature.description}
                    </p>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="w-1.5 h-1.5 rounded-full bg-white mt-2 shrink-0"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="relative z-10 flex items-center gap-8"
          >
            {[
              { value: "7", label: "Asset States" },
              { value: "4", label: "User Roles" },
              { value: "10+", label: "Modules" },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-3">
                {i > 0 && <div className="w-px h-8 bg-white/20" />}
                <div className={i > 0 ? "ml-3" : ""}>
                  <span className="text-xl font-bold text-white">
                    {stat.value}
                  </span>
                  <p className="text-xs text-white/50">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right Side - Login Form (2 cols) */}
        <div className="lg:col-span-2 flex flex-col justify-center p-8 sm:p-10 bg-white/70 backdrop-blur-xl">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Package className="size-4 text-indigo-600" />
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
              Welcome back
            </h1>
            <p className="text-sm text-slate-500">
              Sign in to your account to continue
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
          >
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600 text-sm font-medium">
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className={cn(
                    "pl-10 h-12 bg-white/80 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm",
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
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={cn(
                    "pl-10 pr-11 h-12 bg-white/80 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm",
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

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                  className="border-slate-300 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal text-slate-500 cursor-pointer"
                >
                  Remember me
                </Label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 hover:from-indigo-600 hover:via-violet-600 hover:to-purple-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200/50 hover:shadow-indigo-300/50 transition-all duration-300 group"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              Sign In
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
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
            >
              Sign up
            </Link>
          </motion.p>
        </div>
      </motion.div>
  );
}