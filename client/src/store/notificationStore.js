// client/src/store/notificationStore.js
import { create } from 'zustand';

const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Price Dropped',
    message: 'Calculus: Early Transcendentals (8th Ed) dropped from ₹450 to ₹350.',
    time: '5m ago',
    unread: true,
    type: 'price',
    link: '/marketplace',
  },
  {
    id: 'notif-2',
    title: 'Student Verified',
    message: 'Your @chitkara.edu.in email is verified. Student badge is active!',
    time: '1h ago',
    unread: true,
    type: 'verification',
    link: '/profile',
  },
  {
    id: 'notif-3',
    title: 'New Campus Listing',
    message: 'Hero Sprint Pro 21-Speed Mountain Bike was posted in Hostel Essentials.',
    time: '3h ago',
    unread: true,
    type: 'listing',
    link: '/marketplace',
  },
  {
    id: 'notif-4',
    title: 'Welcome to CampusX',
    message: 'Explore verified student listings and trade textbooks or gear safely.',
    time: '1d ago',
    unread: false,
    type: 'welcome',
    link: '/marketplace',
  },
];

const SIMULATED_ALERTS = [
  {
    title: 'New Offer Received',
    message: 'A student made an offer of ₹650 on your Lab Equipment set.',
    type: 'offer',
  },
  {
    title: 'Price Alert',
    message: 'Sony WH-1000XM4 Noise Canceling Headphones dropped by 15%!',
    type: 'price',
  },
  {
    title: 'Campus Meetup Reminder',
    message: 'Safety check: Remember to complete marketplace exchanges in public campus areas.',
    type: 'safety',
  },
  {
    title: 'Trending in Electronics',
    message: 'Texas Instruments TI-84 Plus Graphing Calculator just listed.',
    type: 'listing',
  },
];

let alertCounter = 1;

export const useNotificationStore = create((set, get) => ({
  notifications: INITIAL_NOTIFICATIONS,
  unreadCount: INITIAL_NOTIFICATIONS.filter((n) => n.unread).length,

  markAsRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, unread: false } : n
    );
    const unread = updated.filter((n) => n.unread).length;
    set({ notifications: updated, unreadCount: unread });
  },

  markAllAsRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, unread: false }));
    set({ notifications: updated, unreadCount: 0 });
  },

  addNotification: (notif) => {
    const newNotif = {
      id: `alert-${Date.now()}-${alertCounter++}`,
      time: 'Just now',
      unread: true,
      link: '/marketplace',
      ...notif,
    };
    const updated = [newNotif, ...get().notifications];
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => n.unread).length,
    });
  },

  simulateNewAlert: () => {
    const sample = SIMULATED_ALERTS[alertCounter % SIMULATED_ALERTS.length];
    alertCounter++;
    get().addNotification(sample);
  },
}));
