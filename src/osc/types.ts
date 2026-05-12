export type OscArg =
  | { type: "int"; value: number }
  | { type: "float"; value: number }
  | { type: "string"; value: string }
  | { type: "blob"; value: number[] }
  | { type: "time"; value: { seconds: number; fractional: number } }
  | { type: "long"; value: number }
  | { type: "double"; value: number }
  | { type: "char"; value: string }
  | { type: "color"; value: { red: number; green: number; blue: number; alpha: number } }
  | { type: "midi"; value: { port: number; status: number; data1: number; data2: number } }
  | { type: "bool"; value: boolean }
  | { type: "array"; value: OscArg[] }
  | { type: "nil"; value: null }
  | { type: "inf"; value: null };

export interface OscEvent {
  address: string;
  args: OscArg[];
}
