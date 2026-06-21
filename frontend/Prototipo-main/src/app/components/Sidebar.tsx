import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import figmaAsset from "../../imports/logo_2024_(1).png";
import {
  LayoutDashboard,
  Store,
  GraduationCap,
  ShieldCheck,
  Wrench,
  AlertTriangle,
  Megaphone,
  Briefcase,
  Building2,
  BarChart2,
  ChevronLeft,
  LogOut,
  MapPin,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Lojistas", icon: Store },
  { label: "Treinamentos", icon: GraduationCap, path: "/treinamentos" },
  { label: "Seguros", icon: ShieldCheck },
  { label: "Manutenção", icon: Wrench },
  { label: "Sinistros", icon: AlertTriangle },
  { label: "Marketing", icon: Megaphone },
  { label: "Comercial", icon: Briefcase },
  { label: "Institucional", icon: Building2 },
  { label: "Relatórios", icon: BarChart2 },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      setUserEmail(user.email || "");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        if (error.status !== 406) {
          console.error(error);
        }
      }

      if (profile?.display_name && profile.display_name !== user.email) {
        setUserName(profile.display_name);
      } else if (user.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      } else if (user.email) {
        setUserName(user.email.split("@")[0]);
      }
    };

    loadProfile();
  }, []);

  const initials = useMemo(() => {
    const parts = userName.split(" ").filter(Boolean);
    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [userName]);

  return (
    <div className="h-full flex-shrink-0" style={{ backgroundColor: "#8B1A1A" }}>
      <aside className="w-64 h-full flex flex-col flex-shrink-0" style={{ backgroundColor: "#8B1A1A" }}>
        {/* Logo Area */}
        <div className="px-5 py-5 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-12 h-12 flex-shrink-0">
              <div className="absolute inset-0 bg-yellow-400 opacity-60 blur-xl scale-125 rounded-full"></div>
              <ImageWithFallback
                src={figmaAsset}
                className="w-full h-full object-contain relative z-10"
                alt="Flamboyant logo"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-white/60 leading-tight">
                Flamboyant
              </p>
              <p className="text-xs font-semibold text-white leading-tight">JP Mall</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors group"
              aria-label="Fechar menu"
            >
              <ChevronLeft className={`w-6 h-6 text-white/70 transition-transform duration-500 ease-in-out group-active:scale-95 ${!isOpen ? '-rotate-180' : 'rotate-0'}`} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path
              ? (item.path === "/treinamentos"
                  ? (location.pathname === "/treinamentos" || location.pathname === "/")
                  : location.pathname === item.path)
              : false;
            const className = `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer text-left ${isActive
              ? "bg-white/15 text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white"
              }`;

            if (item.path) {
              return (
                <Link key={item.label} to={item.path} className={className}>
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} />
                  <span className={isActive ? "font-medium" : ""}>{item.label}</span>
                </Link>
              );
            }

            return (
              <button key={item.label} className={className} disabled>
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Card */}
        <div className="mx-3 mb-4 p-3 rounded-xl flex items-center justify-between bg-white/10">
          <Link to="/perfil" className="flex items-center gap-3 min-w-0 pr-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: "#D93030", color: "#ffffff" }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {userName || "Usuário"}
              </p>
              <p className="text-xs text-white/60 truncate">
                {userEmail || ""}
              </p>
            </div>
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth");
            }}
            className="text-white/50 hover:text-white transition-colors flex-shrink-0"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>
    </div>
  );
}
