export const MEASUREMENT_SYSTEMS = [
  { id: 'weight', label: 'الوزن (Weight)', units: ['kg', 'g', 'ton'] },
  { id: 'volume', label: 'الحجم (Volume)', units: ['l', 'ml'] },
  { id: 'count', label: 'العدد (Count)', units: ['piece', 'unit', 'bottle', 'can', 'cup'] }
];

export const PACKAGING_TYPES = [
  { id: 'single', label: 'حبة / مفرد (Single)' },
  { id: 'box', label: 'صندوق (Box)' },
  { id: 'carton', label: 'كرتونة (Carton)' },
  { id: 'pack', label: 'عبوة (Pack)' },
  { id: 'tray', label: 'طبق (Tray)' },
  { id: 'bundle', label: 'حزمة (Bundle)' },
  { id: 'roll', label: 'رول (Roll)' },
  { id: 'bag', label: 'كيس (Bag)' },
  { id: 'sack', label: 'شوال (Sack)' },
  { id: 'case', label: 'صندوق كبير (Case)' },
  { id: 'pallet', label: 'بالتة (Pallet)' }
];

export const UNIT_Translations: Record<string, string> = {
  'kg': 'كجم',
  'g': 'جرام',
  'ton': 'طن',
  'l': 'لتر',
  'ml': 'مل',
  'piece': 'قطعة',
  'unit': 'وحدة',
  'bottle': 'زجاجة',
  'can': 'عبوة (كانز)',
  'cup': 'كوب'
};

export const PACK_Translations: Record<string, string> = {
  'single': 'مفرد',
  'box': 'صندوق',
  'carton': 'كرتونة',
  'pack': 'عبوة',
  'tray': 'طبق',
  'bundle': 'حزمة',
  'roll': 'رول',
  'bag': 'كيس',
  'sack': 'شوال',
  'case': 'صندوق كبير',
  'pallet': 'بالتة',
};

export interface ProductVariant {
  id: string; // e.g. random uuid
  system: string; // 'weight', 'volume', 'count'
  baseUnit: string; // 'ml', 'kg'
  unitValue: number; // e.g. 330
  packaging: string; // e.g. 'carton'
  qtyPerPackage: number; // e.g. 24
  price: number;
  stock: number;
  sku?: string;
  isDefault: boolean;
}

export function generateVariantName(variant: ProductVariant): string {
  if (!variant || !variant.system) return '';
  const pack = PACK_Translations[variant.packaging] || variant.packaging;
  const unitStr = UNIT_Translations[variant.baseUnit] || variant.baseUnit;
  if (variant.packaging === 'single') {
     return `${variant.unitValue} ${unitStr}`;
  }
  return `${pack} (${variant.qtyPerPackage} × ${variant.unitValue} ${unitStr})`;
}
