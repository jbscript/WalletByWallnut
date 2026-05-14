import React from "react";
import {
  Utensils, ShoppingBag, Home, Bus, Car, Ticket, Monitor, CreditCard,
  TrendingUp, Wallet, Briefcase, Gift, Tag, Coins, Banknote, PiggyBank,
  ArrowLeftRight, LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, "shopping-bag": ShoppingBag, home: Home, bus: Bus, car: Car,
  ticket: Ticket, monitor: Monitor, "credit-card": CreditCard, "trending-up": TrendingUp,
  wallet: Wallet, briefcase: Briefcase, gift: Gift, tag: Tag, coins: Coins,
  banknote: Banknote, "piggy-bank": PiggyBank, "arrow-left-right": ArrowLeftRight,
};

const hexToBg = (hex: string, alpha = 0.12): string => {
  if (!hex || hex[0] !== "#") return `rgba(148,163,184,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

interface Props {
  name?: string;
  color?: string;
  size?: number;
  iconSize?: number;
}

export const CategoryIcon: React.FC<Props> = ({ name = "tag", color = "#94a3b8", size = 40, iconSize = 18 }) => {
  const Cmp = ICONS[name] || Tag;
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: hexToBg(color, 0.14) }}
    >
      <Cmp size={iconSize} style={{ color }} strokeWidth={2.2} />
    </div>
  );
};

export const ICON_NAMES = Object.keys(ICONS);
export default CategoryIcon;
