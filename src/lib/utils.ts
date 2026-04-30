import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Haversine formula to calculate distance between two points in km
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export interface GeoLocation {
  lat: number;
  lng: number;
}
export function formatArabicDate(date: Date): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

export function isRequestExpired(request: any): boolean {
  if (!request) return false;
  if (['delivered', 'cancelled'].includes(request.status)) return false;
  
  const INACTIVITY_LIMIT_MS = request.requestType === 'bulk' ? 48 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  let lastActivity = 0;
  if (request.updatedAt?.toMillis) {
    lastActivity = request.updatedAt.toMillis();
  } else if (request.createdAt?.toMillis) {
    lastActivity = request.createdAt.toMillis();
  } else if (request.updatedAt) {
    lastActivity = new Date(request.updatedAt).getTime();
  } else if (request.createdAt) {
    lastActivity = new Date(request.createdAt).getTime();
  }
  
  if (!lastActivity || isNaN(lastActivity)) return false;
  return (now - lastActivity > INACTIVITY_LIMIT_MS);
}

export async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3, delayMs = 1000): Promise<Response> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && response.status >= 500) {
        throw new Error(`Server Error: ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        // Exponential backoff
        await new Promise(res => setTimeout(res, delayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

export function convertArabicNumerals(str: string): string {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (w) => arabicNumbers.indexOf(w).toString());
}

export function resizeImage(file: File, maxWidth = 800, maxHeight = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}


