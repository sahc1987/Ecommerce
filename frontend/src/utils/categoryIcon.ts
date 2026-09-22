import {
  Laptop, Smartphone, Headphones, Watch, Tablet, Gamepad2, Camera, Cable,
  Home, Tv, Speaker, Keyboard, Mouse, Printer, LucideIcon, Tag,
} from 'lucide-react';

const ICONS: [RegExp, LucideIcon][] = [
  [/laptop|notebook|computer|pc/i, Laptop],
  [/phone|mobile/i, Smartphone],
  [/headphone|earbud|audio|earphone/i, Headphones],
  [/watch|wearable/i, Watch],
  [/tablet|ipad/i, Tablet],
  [/gam(e|ing)|console/i, Gamepad2],
  [/camera|photo/i, Camera],
  [/accessor|cable|charger/i, Cable],
  [/smart home|home/i, Home],
  [/tv|television|monitor|display/i, Tv],
  [/speaker/i, Speaker],
  [/keyboard/i, Keyboard],
  [/mouse/i, Mouse],
  [/printer/i, Printer],
];

/** Picks a lucide icon for a category name; falls back to a generic tag. */
export const categoryIcon = (name: string): LucideIcon =>
  ICONS.find(([re]) => re.test(name))?.[1] ?? Tag;
