import { collection, doc, getDocs, setDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Unit, UnitConversion } from '../types';

class UnitService {
  private static instance: UnitService;
  private units: Unit[] = [];
  private conversions: UnitConversion[] = [];

  private constructor() {}

  public static getInstance(): UnitService {
    if (!UnitService.instance) {
      UnitService.instance = new UnitService();
    }
    return UnitService.instance;
  }

  public async loadUnits() {
    const unitSnap = await getDocs(collection(db, 'units'));
    this.units = unitSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
    
    const convSnap = await getDocs(collection(db, 'conversions'));
    this.conversions = convSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UnitConversion));
  }

  public getUnit(unitId: string): Unit | undefined {
    return this.units.find(u => u.id === unitId);
  }

  public getAllUnits(): Unit[] {
    return this.units;
  }

  public convert(amount: number, fromUnitId: string, toUnitId: string): number {
    if (fromUnitId === toUnitId) return amount;

    // Find direct conversion
    const direct = this.conversions.find(c => c.fromUnitId === fromUnitId && c.toUnitId === toUnitId);
    if (direct) return amount * direct.multiplier;

    // Find inverse conversion
    const inverse = this.conversions.find(c => c.fromUnitId === toUnitId && c.toUnitId === fromUnitId);
    if (inverse) return amount / inverse.multiplier;

    // TODO: Implement complex path finding for conversions if needed
    console.warn(`No conversion found from ${fromUnitId} to ${toUnitId}`);
    return amount;
  }

  public formatQuantity(amount: number, unitId: string): string {
    const unit = this.getUnit(unitId);
    return `${amount} ${unit?.abbreviation || unit?.name || unitId}`;
  }

  // Admin methods
  public async addUnit(unit: Omit<Unit, 'id'>) {
    const unitRef = doc(collection(db, 'units'));
    await setDoc(unitRef, unit);
    await this.loadUnits();
  }

  public async addConversion(conversion: Omit<UnitConversion, 'id'>) {
    const convRef = doc(collection(db, 'conversions'));
    await setDoc(convRef, conversion);
    await this.loadUnits();
  }
}

export const unitService = UnitService.getInstance();
