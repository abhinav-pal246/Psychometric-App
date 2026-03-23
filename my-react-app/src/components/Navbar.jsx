import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { label: "Home", href: "#" },
  { label: "Features", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "About", href: "#" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, error, signup, login, logout, clearError } = useAuth();
  const [showError, setShowError] = useState(false);

  // Show error toast when error changes
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
        clearError();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <>
      {/* Error Toast */}
      {showError && error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 animate-fade-in">
          <span>{error}</span>
          <button
            onClick={() => { setShowError(false); clearError(); }}
            className="text-white/80 hover:text-white bg-transparent border-none cursor-pointer text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-8 bg-transparent max-md:px-5">
        {/* Logo */}
        <a href="#" className="text-xl font-bold text-black no-underline">
          Brand
        </a>

        {/* Desktop Links */}
        <ul className="flex items-center gap-7 list-none max-md:hidden">
          {navLinks.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="text-sm font-medium text-black/60 no-underline transition-colors duration-200 hover:text-black"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop Buttons */}
        <div className="flex gap-2.5 items-center max-md:hidden">
          {loading ? null : user ? (
            <>
              <span className="text-sm font-medium text-black/70">
                {user.email}
              </span>
              <button
                onClick={logout}
                className="px-5 py-2 text-sm font-semibold text-white bg-black border-[1.5px] border-black rounded-lg cursor-pointer transition-all duration-200 hover:bg-black/80"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={login}
                className="px-5 py-2 text-sm font-semibold text-black bg-transparent border-[1.5px] border-black/30 rounded-lg cursor-pointer transition-all duration-200 hover:border-black"
              >
                Log in
              </button>
              <button
                onClick={signup}
                className="px-5 py-2 text-sm font-semibold text-white bg-black border-[1.5px] border-black rounded-lg cursor-pointer transition-all duration-200 hover:bg-black/80"
              >
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Hamburger (mobile only) */}
        <button
          className="hidden max-md:flex flex-col gap-[5px] bg-transparent border-none cursor-pointer p-1.5"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span
            className={`block w-6 h-0.5 bg-black rounded-sm transition-all duration-300 origin-center ${
              menuOpen ? "rotate-45 translate-x-[5px] translate-y-[5px]" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-black rounded-sm transition-all duration-300 ${
              menuOpen ? "opacity-0 scale-x-0" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-black rounded-sm transition-all duration-300 origin-center ${
              menuOpen ? "-rotate-45 translate-x-[5px] -translate-y-[5px]" : ""
            }`}
          />
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`hidden max-md:block fixed top-16 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl overflow-hidden transition-all duration-300 ${
          menuOpen ? "max-h-96" : "max-h-0"
        }`}
      >
        <div className="flex flex-col gap-1 p-3 px-5 pb-5">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-base font-medium text-black/60 no-underline py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-black/5 hover:text-black"
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-black/10">
            {loading ? null : user ? (
              <>
                <span className="text-sm font-medium text-black/70 px-3">
                  {user.email}
                </span>
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="px-5 py-2 text-sm font-semibold text-white bg-black border-[1.5px] border-black rounded-lg cursor-pointer transition-all duration-200 hover:bg-black/80"
                >
                  Log out
                </button>
              </>
            ) : (
              <div className="flex gap-2.5">
                <button
                  onClick={() => { login(); setMenuOpen(false); }}
                  className="flex-1 px-5 py-2 text-sm font-semibold text-black bg-transparent border-[1.5px] border-black/30 rounded-lg cursor-pointer transition-all duration-200 hover:border-black"
                >
                  Log in
                </button>
                <button
                  onClick={() => { signup(); setMenuOpen(false); }}
                  className="flex-1 px-5 py-2 text-sm font-semibold text-white bg-black border-[1.5px] border-black rounded-lg cursor-pointer transition-all duration-200 hover:bg-black/80"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
