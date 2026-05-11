import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SupplierStoreProduct, PackagingLevel } from '../types';

class InventoryService {
  private static instance: InventoryService;

  private constructor() {}

  public static getInstance(): InventoryService {
    if (!InventoryService.instance) {
      InventoryService.instance = new InventoryService();
    }
    return InventoryService.instance;
  }

  /**
   * Safe stock reservation/reduction using transactions
   */
  public async adjustStock(productId: string, deltaInBaseUnits: number) {
    const productRef = doc(db, 'products', productId);

    await runTransaction(db, async (transaction) => {
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) {
        throw new Error("Product not found");
      }

      const productData = productDoc.data() as SupplierStoreProduct;
      const currentStock = productData.stock || 0;
      const newStock = currentStock + deltaInBaseUnits;

      if (newStock < 0) {
        throw new Error(`Insufficient stock for product ${productData.name}. Current: ${currentStock}, Requested reduction: ${Math.abs(deltaInBaseUnits)}`);
      }

      transaction.update(productRef, { 
        stock: newStock,
        updatedAt: new Date().toISOString(),
        available: newStock > 0
      });
    });
  }

  public async checkAvailability(productId: string, quantityInBaseUnits: number): Promise<boolean> {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) return false;
    
    const product = productSnap.data() as SupplierStoreProduct;
    return (product.stock || 0) >= quantityInBaseUnits && product.available;
  }

  /**
   * Helper to calculate base unit quantity from a packaging level
   */
  public calculateBaseQuantity(product: SupplierStoreProduct, quantity: number, packagingLevelId?: string): number {
    if (!packagingLevelId) return quantity;
    
    const level = product.packagingLevels.find(l => l.id === packagingLevelId);
    if (!level) return quantity; // Fallback to 1:1 if level not found
    
    return quantity * level.quantityInBaseUnit;
  }
}

export const inventoryService = InventoryService.getInstance();
