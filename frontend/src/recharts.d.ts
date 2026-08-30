declare module "recharts" {
  import type { ComponentType, ReactNode } from "react";
  export const AreaChart: ComponentType<Record<string, unknown>>;
  export const Area: ComponentType<Record<string, unknown>>;
  export const XAxis: ComponentType<Record<string, unknown>>;
  export const YAxis: ComponentType<Record<string, unknown>>;
  export const CartesianGrid: ComponentType<Record<string, unknown>>;
  export const Tooltip: ComponentType<Record<string, unknown>>;
  export const ResponsiveContainer: ComponentType<
    Record<string, unknown> & { children?: ReactNode }
  >;
  export const BarChart: ComponentType<Record<string, unknown>>;
  export const Bar: ComponentType<Record<string, unknown>>;
  export const PieChart: ComponentType<Record<string, unknown>>;
  export const Pie: ComponentType<Record<string, unknown>>;
  export const Cell: ComponentType<Record<string, unknown>>;
  export const Legend: ComponentType<Record<string, unknown>>;
}
