export type MeridianId =
  | "LU" | "LI" | "ST" | "SP" | "HT" | "SI"
  | "BL" | "KI" | "PC" | "SJ" | "GB" | "LR"
  | "REN" | "DU";

export const MERIDIANS: { id: MeridianId; zh: string; en: string; blurb: string }[] = [
  { id: "LU", zh: "手太阴肺经", en: "Lung", blurb: "科普：传统经络体系中与胸、上肢内侧走行相关。" },
  { id: "LI", zh: "手阳明大肠经", en: "Large Intestine", blurb: "科普：常见走行于上肢外侧并上达面部。" },
  { id: "ST", zh: "足阳明胃经", en: "Stomach", blurb: "科普：常见走行于面部、躯干前侧与下肢前外侧。" },
  { id: "SP", zh: "足太阴脾经", en: "Spleen", blurb: "科普：常见走行于下肢内侧并入腹部。" },
  { id: "HT", zh: "手少阴心经", en: "Heart", blurb: "科普：常见走行于上肢内侧并与胸部区域相关。" },
  { id: "SI", zh: "手太阳小肠经", en: "Small Intestine", blurb: "科普：常见走行于上肢后外侧、肩胛并上达面部。" },
  { id: "BL", zh: "足太阳膀胱经", en: "Bladder", blurb: "科普：常见沿背部两侧下行至下肢后侧。" },
  { id: "KI", zh: "足少阴肾经", en: "Kidney", blurb: "科普：常见起于足底并沿下肢内侧上行。" },
  { id: "PC", zh: "手厥阴心包经", en: "Pericardium", blurb: "科普：常见走行于上肢内侧中线附近。" },
  { id: "SJ", zh: "手少阳三焦经", en: "San Jiao", blurb: "科普：常见走行于上肢外侧并经肩颈至耳侧。" },
  { id: "GB", zh: "足少阳胆经", en: "Gallbladder", blurb: "科普：常见走行于体侧、髋外侧与下肢外侧。" },
  { id: "LR", zh: "足厥阴肝经", en: "Liver", blurb: "科普：常见走行于下肢内侧并入腹部。" },
  { id: "REN", zh: "任脉", en: "Conception Vessel", blurb: "科普：常见位于身体前正中线。" },
  { id: "DU", zh: "督脉", en: "Governing Vessel", blurb: "科普：常见位于身体后正中线。" }
];
