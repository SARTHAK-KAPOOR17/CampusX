// client/src/pages/VerificationPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, ShieldCheck, AlertCircle, Clock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { verificationApi } from '../services/api';
import { useAuthStore } from '../store';
import { VerifiedBadge } from '../components/VerifiedBadge';

export const VerificationPage = () => {
  const { user, accessToken, setAuth } = useAuthStore();

  const [collegeEmail, setCollegeEmail] = useState(user?.collegeEmail || '');
  const [step, setStep] = useState(user?.isVerifiedStudent ? 'verified' : 'email'); // 'email' | 'otp' | 'verified'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const inputRefs = useRef([]);

  useEffect(() => {
    let active = true;
    verificationApi
      .getStatus()
      .then((res) => {
        if (!active) return;
        const status = res?.data;
        if (status?.isVerifiedStudent) {
          setStep('verified');
          setCollegeEmail(status.collegeEmail || '');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    const trimmed = collegeEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid college email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await verificationApi.requestOtp(trimmed);
      setStep('otp');
      setCooldown(res?.data?.cooldownSeconds || 60);
      setOtpDigits(['', '', '', '', '', '']);
      setInfoMessage(`A 6-digit verification code has been sent to ${trimmed}.`);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }

    // Handle multi-char paste directly into a box
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      chars.forEach((ch, idx) => {
        next[idx] = ch;
      });
      setOtpDigits(next);
      const focusIdx = Math.min(chars.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, idx) => {
      next[idx] = ch;
    });
    setOtpDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleConfirmOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const code = otpDigits.join('');
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await verificationApi.confirmOtp(code);
      if (res?.data?.user) {
        setAuth({ user: res.data.user, accessToken });
      }
      setStep('verified');
      setInfoMessage('Your university email is verified!');
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          {user?.isVerifiedStudent && <VerifiedBadge compact />}
        </div>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            {step === 'verified' ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <MailCheck className="w-6 h-6" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">Student Email Verification</h1>
          <p className="text-sm text-slate-400">
            Verify your university email to unlock trusted student status on CampusX.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && step !== 'verified' && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-sm">
            <MailCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
            <span>{infoMessage}</span>
          </div>
        )}

        {step === 'verified' && (
          <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">You&apos;re a Verified Student!</h2>
            <p className="text-sm text-slate-300">
              Verified college email:{' '}
              <span className="font-mono text-emerald-300">
                {user?.collegeEmail || collegeEmail}
              </span>
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                to="/profile"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
              >
                Edit Profile
              </Link>
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="college-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                College Email Address
              </label>
              <input
                id="college-email"
                type="email"
                value={collegeEmail}
                onChange={(e) => setCollegeEmail(e.target.value)}
                placeholder="student@campusx.edu"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Use an approved university domain (e.g., <code>@campusx.edu</code>, <code>@mit.edu</code>,{' '}
                <code>@stanford.edu</code>).
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/20"
            >
              {loading ? 'Sending Verification Code...' : 'Send 6-Digit OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleConfirmOtp} className="space-y-5" noValidate>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 text-center">
                Enter 6-Digit Verification Code
              </label>
              <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    aria-label={`OTP digit ${idx + 1}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono rounded-xl bg-slate-900/80 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20"
            >
              {loading ? 'Verifying...' : 'Confirm & Verify'}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setError('');
                  setInfoMessage('');
                }}
                className="text-slate-300 hover:text-white underline"
              >
                Change email
              </button>

              {cooldown > 0 ? (
                <span className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  Resend in {cooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleRequestOtp()}
                  className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Resend OTP
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
