// client/src/components/NotificationBell.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Tag,
  CheckCircle2,
  Package,
  Sparkles,
  Check,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '../store';
import { slideDown, staggerContainer, staggerItem, tapFeedback } from '../lib/motion';

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isFirstLoad = useRef(true);
  const navigate = useNavigate();

  const { notifications, unreadCount, markAsRead, markAllAsRead, simulateNewAlert } =
    useNotificationStore();

  // Mark first load complete after initial render
  useEffect(() => {
    isFirstLoad.current = false;
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif) => {
    markAsRead(notif.id);
    if (notif.link) {
      setIsOpen(false);
      navigate(notif.link);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'price':
        return <Tag className="w-4 h-4 text-emerald-400" />;
      case 'verification':
        return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case 'offer':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'listing':
      default:
        return <Package className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <m.button
        whileTap={tapFeedback.whileTap}
        type="button"
        aria-label="View notifications"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl transition flex items-center justify-center ${
          isOpen
            ? 'bg-slate-700 text-white'
            : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80'
        }`}
      >
        <Bell className="w-4 h-4" />

        {/* Badge pops when unread count increases */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <m.span
              key={`badge-${unreadCount}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.8, 1.35, 1], opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center border-2 border-slate-900 shadow-sm shadow-blue-500/50"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </m.span>
          )}
        </AnimatePresence>
      </m.button>

      {/* Notification Dropdown with slideDown and exit animation */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            variants={slideDown}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl z-50 overflow-hidden"
          >
            {/* Dropdown Header */}
            <div className="p-3.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={simulateNewAlert}
                  title="Simulate incoming alert to test badge pop"
                  className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-[11px] font-medium transition flex items-center gap-1"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>Simulate</span>
                </button>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white text-[11px] font-medium transition flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Read all</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List - Staggered fade-in on first load only */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Bell className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs font-medium text-slate-300">No notifications yet</p>
                  <p className="text-[11px] text-slate-500">
                    Activity on your listings and saved items will appear here.
                  </p>
                </div>
              ) : (
                <m.div
                  variants={isFirstLoad.current ? staggerContainer(0.04) : undefined}
                  initial="initial"
                  animate="animate"
                >
                  {notifications.map((notif) => (
                    <m.div
                      key={notif.id}
                      variants={isFirstLoad.current ? staggerItem : undefined}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 transition flex items-start gap-3 cursor-pointer select-none ${
                        notif.unread
                          ? 'bg-slate-800/40 hover:bg-slate-800/70'
                          : 'bg-transparent hover:bg-slate-800/30 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        {getIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className={`text-xs truncate ${
                              notif.unread ? 'font-bold text-white' : 'font-medium text-slate-300'
                            }`}
                          >
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 shrink-0">{notif.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>

                      {notif.unread && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 self-center" />
                      )}
                    </m.div>
                  ))}
                </m.div>
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 px-3.5">
              <span>CampusX Notifications</span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/marketplace');
                }}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
              >
                <span>Browse Listings</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
