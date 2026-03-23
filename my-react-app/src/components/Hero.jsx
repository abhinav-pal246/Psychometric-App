import React, { useState, useRef } from "react";

const cards = [
  {
    tag: "Science",
    title: "Science",
    color: "bg-[#F2C94C]",
    link: "/quiz/science",
    description:
      "Dive into the wonders of science with fun quizzes that challenge your knowledge from atoms to galaxies!",
  },
  {
    tag: "PSS-10",
    title: "Technology",
    color: "bg-[#E84C3D]",
    link: "/PSS-10",
    description:
      "Explore the world of technology with the interesting Technology Quiz and see ",
  },
  {
    tag: "Science",
    title: "Science",
    color: "bg-[#2A9D8F]",
    link: "/quiz/science-2",
    description:
      "Explore the fascinating realm of science with thrilling quizzes that test your curiosity and intellect!",
  },
];

const useWindowSize = () => {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  React.useEffect(() => {
    const handle = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return size;
};

export default function Hero() {
  const [active, setActive] = useState(1);
  const startX = useRef(0);
  const { w, h } = useWindowSize();

  /* ---- Card sizing ----
     Phone:  taller cards (maxCard 360, ratio 0.50) but everything fits
     iPad:   taller cards (maxCard 460, ratio 0.50)
     Desktop: unchanged */
  const maxCard = w < 640 ? 360 : w < 1024 ? 460 : w < 1440 ? 440 : 520;
  const heightRatio = w < 640 ? 0.50 : w < 1024 ? 0.50 : 0.48;
  const cardHeight = Math.min(h * heightRatio, maxCard);
  const cardWidth = w < 640 ? cardHeight * 0.75 : cardHeight * 0.7;
  const inactiveHeight = cardHeight - 30;
  const gap = w < 640 ? cardWidth * 0.85 : cardWidth + 30;
  const containerHeight = cardHeight + 30;

  const titleSize = w < 640 ? "text-xl" : w < 1024 ? "text-2xl" : w < 1440 ? "text-3xl" : "text-4xl";
  const descSize = w < 640 ? "text-xs" : w < 1024 ? "text-sm" : "text-base";

  const handleDragStart = (e) => {
    startX.current = e.touches ? e.touches[0].clientX : e.clientX;
  };

  const handleDragEnd = (e) => {
    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const diff = startX.current - endX;
    if (diff > 50 && active < cards.length - 1) setActive(active + 1);
    if (diff < -50 && active > 0) setActive(active - 1);
  };

  return (
    <div className="h-screen font-oswald bg-gradient-to-b from-[#E8DFD0] via-[#F0E9DD] to-[#F5F0E8] flex flex-col items-center overflow-hidden pt-16 sm:pt-20">

      {/* Top text section — tighter vertical spacing on small screens */}
      <div className="w-full max-w-3xl px-6 pt-3 sm:pt-6 lg:pt-8 text-center shrink-0">
        <p className="text-[#4A4540] text-xs sm:text-sm lg:text-base xl:text-lg leading-relaxed">
          Challenge your friends and family with our Quiz app, let's see who comes out on top as the ultimate quiz champion, and earns the bragging rights!
        </p>

        {/* Upgrade banner */}
        <div className="mt-3 sm:mt-4 flex items-center justify-between bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-2 sm:px-5 sm:py-3 lg:px-6 lg:py-4">
          <div className="flex items-center gap-2.5 lg:gap-3">
            <span className="text-xl sm:text-2xl lg:text-3xl">👑</span>
            <div className="text-left">
              <h3 className="font-bold text-xs sm:text-sm lg:text-base text-[#2D2A26]">Upgrade pro</h3>
              <p className="text-[#7A756D] text-[10px] sm:text-xs lg:text-sm">Upgrade to remove ads, unlimited play and access all game</p>
            </div>
          </div>
          <button className="bg-[#2D2A26] text-white text-[10px] sm:text-xs lg:text-sm font-bold px-4 py-1.5 sm:px-5 sm:py-2 lg:px-6 lg:py-2.5 rounded-full whitespace-nowrap">
            Upgrade
          </button>
        </div>

        {/* Section title */}
        <h2 className="mt-3 sm:mt-5 text-left font-bold text-lg sm:text-xl lg:text-2xl xl:text-3xl text-[#2D2A26]">
          Popular Game 🔥
        </h2>
      </div>

      {/* Flexible spacer — distributes remaining space evenly */}
      <div className="flex-1 min-h-1" />

      {/* Card carousel */}
      <div
        className="relative w-full flex items-center justify-center shrink-0"
        style={{ height: containerHeight }}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
      >
        {cards.map((card, i) => {
          const offset = i - active;
          const isActive = i === active;
          return (
            <div
              key={i}
              onClick={() => setActive(i)}
              className={`absolute cursor-pointer transition-all duration-500 ease-in-out rounded-3xl ${card.color} p-5 sm:p-6 lg:p-8 flex flex-col justify-between select-none`}
              style={{
                width: cardWidth,
                height: isActive ? cardHeight : inactiveHeight,
                transform: `translateX(${offset * gap}px) scale(${isActive ? 1 : 0.88})`,
                zIndex: isActive ? 10 : 5 - Math.abs(offset),
                opacity: Math.abs(offset) > 1 ? 0 : isActive ? 1 : 0.7,
                filter: isActive ? "none" : "brightness(0.92)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="bg-black text-white text-[10px] sm:text-xs lg:text-sm font-bold px-3 py-1 lg:px-4 lg:py-1.5 rounded-full tracking-wide">
                  {card.tag}
                </span>
                <span className="w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#E84C3D" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </span>
              </div>

              <div className="mt-3 flex-1">
                <h2 className={`text-white font-bold leading-tight ${titleSize}`}>
                  {card.title}
                </h2>
                <p className={`text-white/90 mt-2 leading-relaxed font-light ${descSize}`}>
                  {card.description}
                </p>
              </div>

              {/* Attempt Now link */}
              <a
                href={card.link}
                onClick={(e) => e.stopPropagation()}
                className="block w-full bg-white text-[#2D2A26] font-bold text-sm py-2.5 rounded-full hover:bg-white/90 transition-colors shadow-md text-center"
              >
                Attempt Now
              </a>

              <div className="flex gap-1.5 mt-3 justify-center">
                {cards.map((_, j) => (
                  <span
                    key={j}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      j === active ? "bg-white w-5" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flexible spacer — keeps arrows from hugging cards */}
      <div className="flex-1 min-h-1" />

      {/* Navigation arrows — always visible above bottom edge */}
      <div className="flex gap-4 pb-6 sm:pb-8 pt-2 shrink-0">
        <button
          onClick={() => setActive(Math.max(0, active - 1))}
          className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          onClick={() => setActive(Math.min(cards.length - 1, active + 1))}
          className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}