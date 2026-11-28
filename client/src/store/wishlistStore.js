// client/src/store/wishlistStore.js
import { create } from 'zustand';

const STORAGE_KEY = 'campusx_wishlist_items';

const getInitialWishlist = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistWishlist = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
};

export const useWishlistStore = create((set, get) => ({
  items: getInitialWishlist(),

  has: (productId) => {
    return get().items.some((item) => item.id === productId);
  },

  toggle: (product) => {
    if (!product || !product.id) return false;
    const currentItems = get().items;
    const exists = currentItems.some((item) => item.id === product.id);

    let nextItems;
    if (exists) {
      nextItems = currentItems.filter((item) => item.id !== product.id);
    } else {
      nextItems = [product, ...currentItems];
    }

    persistWishlist(nextItems);
    set({ items: nextItems });
    return !exists;
  },

  remove: (productId) => {
    const nextItems = get().items.filter((item) => item.id !== productId);
    persistWishlist(nextItems);
    set({ items: nextItems });
  },

  clear: () => {
    persistWishlist([]);
    set({ items: [] });
  },
}));
